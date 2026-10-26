#!/usr/bin/env node
// QA checks for the built site:
//  1. every internal href/src/srcset/url() resolves to a file in ../site (and #anchors exist)
//  2. no external URL is fetched at runtime (only tel:, mailto:, canonical/og URLs and JSON-LD may mention http)
//  3. one <h1> per page, unique titles/descriptions, alt on every <img>
//  4. home page weight measured in Chromium (all lazy images loaded), phone and desktop
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createServer, SITE } = require('./serve');

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(SITE);
const rel = (p) => path.relative(SITE, p);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const textAssets = files.filter((f) => /\.(css|js|svg|webmanifest|xml|txt|toml)$/.test(f) || path.basename(f) === '_redirects');

let misses = 0, externals = 0, problems = 0;
const fail = (kind, where, what) => { console.log(`  ${kind}: ${where} -> ${what}`); };

function resolveLocal(ref, fromFile) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return fromFile;
  let target = clean.startsWith('/') ? path.join(SITE, clean) : path.join(path.dirname(fromFile), clean);
  if (clean.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, 'index.html');
  return target;
}
const idsCache = {};
const idsOf = (file) => idsCache[file] || (idsCache[file] = new Set([...fs.readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

console.log('1) internal links and assets');
let refCount = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const refs = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) refs.push(m[1]);
  for (const m of html.matchAll(/\s(?:srcset|imagesrcset)="([^"]+)"/g)) m[1].split(',').forEach((c) => refs.push(c.trim().split(/\s+/)[0]));
  for (const ref of refs) {
    if (/^(tel:|mailto:|data:)/.test(ref)) continue;
    if (/^https?:\/\//.test(ref)) continue; // handled in check 2
    refCount++;
    const target = resolveLocal(ref, file);
    if (!fs.existsSync(target)) { misses++; fail('MISSING', rel(file), ref); continue; }
    const hash = ref.split('#')[1];
    if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) { misses++; fail('NO ANCHOR', rel(file), ref); }
  }
}
for (const file of textAssets.filter((f) => f.endsWith('.css'))) {
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (m[1].startsWith('data:')) continue;
    refCount++;
    if (!fs.existsSync(resolveLocal(m[1], file))) { misses++; fail('MISSING', rel(file), m[1]); }
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(SITE, 'site.webmanifest'), 'utf8'));
for (const icon of manifest.icons) { refCount++; if (!fs.existsSync(path.join(SITE, icon.src))) { misses++; fail('MISSING', 'site.webmanifest', icon.src); } }
console.log(`   ${refCount} internal references checked, ${misses} missing`);

console.log('2) external URLs (runtime fetches)');
const allowedLine = (line) => /rel="canonical"|property="og:(url|image)"/.test(line);
for (const file of [...htmlFiles, ...textAssets]) {
  if (/\.(xml|txt|toml)$/.test(file) || path.basename(file) === '_redirects') continue; // sitemap/robots/config: not fetched by pages
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''); // JSON-LD is data, not fetched
  text = text.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');           // SVG namespace, not a request
  text.split('\n').forEach((line) => {
    for (const m of line.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'<>)]*/gi)) {
      if (allowedLine(line) && m[0].startsWith(require('./src/site').origin + '/')) continue;
      externals++; fail('EXTERNAL', rel(file), m[0]);
    }
  });
}
console.log(`   ${externals} external runtime URLs`);

console.log('3) page basics');
const titles = new Map(), descs = new Map();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];
  const imgsNoAlt = [...html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)].length;
  const imgsNoSize = [...html.matchAll(/<img\b(?![^>]*\bwidth=)[^>]*>/g)].length;
  const nb = (html.match(/id="nb-source"/g) || []).length;
  const tel = [...html.matchAll(/href="(tel:[^"]+)"/g)].map((m) => m[1]);
  const badTel = tel.filter((t) => t !== 'tel:+61444541409').length;
  const issues = [];
  if (h1 !== 1) issues.push(`${h1} h1`);
  if (!title) issues.push('no title'); else if (titles.has(title)) issues.push('duplicate title'); else titles.set(title, file);
  if (!desc) issues.push('no description'); else if (descs.has(desc)) issues.push('duplicate description'); else descs.set(desc, file);
  if (title && title.length > 65) issues.push('title over 65 chars');
  if (desc && desc.length > 160) issues.push('description over 160 chars');
  if (imgsNoAlt) issues.push(`${imgsNoAlt} img without alt`);
  if (imgsNoSize) issues.push(`${imgsNoSize} img without width/height`);
  if (nb !== 1) issues.push(`${nb} #nb-source`);
  if (badTel) issues.push(`${badTel} wrong tel: links`);
  const forms = (html.match(/<form /g) || []).length;
  problems += issues.length;
  console.log(`   ${rel(file).padEnd(28)} h1=${h1} tel-links=${tel.length} forms=${forms} title=${(title || '').length}ch desc=${(desc || '').length}ch ${issues.length ? 'ISSUES: ' + issues.join(', ') : 'ok'}`);
}

(async () => {
  console.log('4) home page weight (Chromium, every lazy image loaded)');
  const { chromium } = require('playwright');
  const server = createServer().listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  for (const [label, opts] of [['phone 390px @3x', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true }], ['desktop 1280px @1x', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }], ['desktop 1440px @2x', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const seen = new Map();
    page.on('response', async (res) => { try { const b = await res.body(); seen.set(res.url(), b); } catch (e) { /* redirects */ } });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } });
    await page.waitForLoadState('networkidle');
    let raw = 0, wire = 0; const byType = {};
    for (const [url, body] of seen) {
      const ext = path.extname(new URL(url).pathname) || '.html';
      raw += body.length;
      const compressible = /\.(html|css|js|svg|json|webmanifest)$/.test(ext);
      const w = compressible ? zlib.brotliCompressSync(body).length : body.length;
      wire += w; byType[ext] = (byType[ext] || 0) + w;
    }
    const kb = (n) => (n / 1024).toFixed(0) + ' KB';
    console.log(`   ${label.padEnd(20)} ${seen.size} requests, ${kb(raw)} uncompressed, ${kb(wire)} over the wire (brotli text) | ${Object.entries(byType).map(([k, v]) => `${k} ${kb(v)}`).join(', ')}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(`\nSUMMARY: ${misses} missing internal refs, ${externals} external runtime URLs, ${problems} page issues`);
  process.exitCode = misses || externals || problems ? 1 : 0;
})();
