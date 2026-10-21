// Renders every concept at every size to ../<name>-<W>x<H>.png and reports text coverage.
// Usage: node render.js [concept ...]      (concepts: builders property trades)
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const SIZES = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
const ALL = ['builders', 'property', 'trades'];

(async () => {
  const only = process.argv.slice(2);
  const concepts = only.length ? only : ALL;
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  for (const c of concepts) {
    for (const [size, [w, h]] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const url = 'file://' + path.join(__dirname, `trade-ad-${c}.html`) + `?size=${size}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const fontsOk = await page.evaluate(() =>
        document.fonts.check("800 40px 'Plus Jakarta Sans'") && document.fonts.check("500 20px 'Inter'"));
      await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
      // Text coverage: union of per-line text boxes + logo box + button pill, as a share of the frame.
      const stats = await page.evaluate(() => {
        const rects = [];
        const walker = document.createTreeWalker(document.querySelector('.copy'), NodeFilter.SHOW_TEXT);
        let n; while ((n = walker.nextNode())) {
          if (!n.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const b of r.getClientRects()) rects.push([b.left, b.top, b.right, b.bottom]);
        }
        for (const sel of ['.logo', '.btn', '.badge']) { const b = document.querySelector(sel).getBoundingClientRect(); rects.push([b.left, b.top, b.right, b.bottom]); }
        const W = innerWidth, H = innerHeight, grid = new Uint8Array(W * H);
        for (const [l, t, r, b] of rects) for (let y = Math.max(0, t | 0); y < Math.min(H, Math.ceil(b)); y++) grid.fill(1, y * W + Math.max(0, l | 0), y * W + Math.min(W, Math.ceil(r)));
        let on = 0; for (const v of grid) on += v;
        const copy = document.querySelector('.copy').getBoundingClientRect();
        const logo = document.querySelector('.logo').getBoundingClientRect();
        return { cover: (100 * on / (W * H)).toFixed(1), copyTop: Math.round(copy.top), copyBottom: Math.round(copy.bottom), logoTop: Math.round(logo.top), h1Lines: Math.round(document.querySelector('h1').getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)) };
      });
      const out = path.join(__dirname, '..', `trade-ad-${c}-${w}x${h}.png`);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
      console.log(`${path.basename(out)}  fonts:${fontsOk ? 'ok' : 'MISSING'}  text:${stats.cover}%  logoTop:${stats.logoTop}  copy:${stats.copyTop}-${stats.copyBottom}  h1 lines:${stats.h1Lines}`);
      await ctx.close();
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
