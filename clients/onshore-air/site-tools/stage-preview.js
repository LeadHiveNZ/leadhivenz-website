// Stage a click-through PREVIEW copy of site/ for hosts that serve files by exact path (no directory
// index, no root-relative URLs), such as the claude.ai artifact host. Rewrites every root-relative URL
// to a relative one and every "/page/" link to "page/index.html". The Netlify zip is NOT affected.
// Usage: node stage-preview.js <out-dir>
const fs = require('fs'), path = require('path');
const src = path.resolve(__dirname, '..', 'site');
const out = path.resolve(process.argv[2] || path.join(__dirname, 'out', 'preview'));
fs.rmSync(out, { recursive: true, force: true });
const skip = new Set(['netlify.toml', '_redirects', 'robots.txt', 'sitemap.xml']);
fs.cpSync(src, out, { recursive: true, filter: p => !skip.has(path.basename(p)) });
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pages = ['installations', 'repairs', 'hydro-cleaning', 'maintenance', 'about', 'service-areas', 'contact', 'thanks'];
let rewrites = 0;
for (const file of walk(out)) {
  if (!/\.(html|css|webmanifest)$/.test(file)) continue;
  const depth = path.relative(out, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const up = depth ? '../'.repeat(depth) : './';
  let s = fs.readFileSync(file, 'utf8'), before = s;
  // "/page/" and "/page/#frag" -> "page/index.html"
  s = s.replace(new RegExp(`(href=")/(${pages.join('|')})/(#[^"]*)?"`, 'g'), (_, a, p, f) => `${a}${up}${p}/index.html${f || ''}"`);
  // "/" home link (not "//" or "/x")
  s = s.replace(/(href=")\/(#[^"]*)?"/g, (_, a, f) => `${a}${up}index.html${f || ''}"`);
  // other root-relative asset URLs in attributes and srcset
  s = s.replace(/((?:href|src|content|poster)=")\/(?!\/)/g, (_, a) => `${a}${up}`);
  s = s.replace(/(srcset=")([^"]+)"/g, (_, a, v) => `${a}${v.replace(/(^|,\s*)\/(?!\/)/g, `$1${up}`)}"`);
  // CSS url(/assets/...) -> relative to the css file
  s = s.replace(/url\((['"]?)\/(?!\/)/g, (_, q) => `url(${q}${up}`);
  // webmanifest JSON paths
  if (file.endsWith('.webmanifest')) s = s.replace(/"src":\s*"\/(?!\/)/g, `"src": "${up}`);
  if (s !== before) { rewrites++; fs.writeFileSync(file, s); }
}
// og:url / canonical stay absolute (https://onshoreair.com.au/...), which is correct for a preview.
const leftovers = walk(out).filter(f => /\.(html|css)$/.test(f)).flatMap(f => {
  const s = fs.readFileSync(f, 'utf8'); const m = s.match(/(?:href|src)="\/(?!\/)[^"]*"/g) || []; return m.map(x => `${path.relative(out, f)}: ${x}`);
});
if (leftovers.length) { console.error('root-relative URLs remain:\n' + leftovers.join('\n')); process.exit(1); }
// every relative href/src must resolve
const missing = [];
for (const f of walk(out).filter(f => f.endsWith('.html'))) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:href|src)="([^"#:][^"]*)"/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(m[1])) continue; const target = m[1].split("#")[0].split("?")[0]; if (!target) continue;
    if (!fs.existsSync(path.resolve(path.dirname(f), target))) missing.push(`${path.relative(out, f)} -> ${m[1]}`);
  }
}
if (missing.length) { console.error('unresolved links:\n' + missing.join('\n')); process.exit(1); }
console.log(`staged ${out}: ${walk(out).length} files, ${rewrites} rewritten, 0 unresolved links`);
