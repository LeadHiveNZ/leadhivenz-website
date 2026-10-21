// Renders every concept at every size to ../<name>-<W>x<H>.png and reports text coverage.
// Usage: node render.js [concept ...]      (concepts: builders property trades card)
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const SIZES = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
const ALL = ['builders', 'property', 'trades', 'card'];

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
      // Concept D: text on the trade card counts too (with the logo printed on it). The card is turned a
      // few degrees, so its boxes are measured with the turn taken off: same area, not the inflated
      // axis-aligned box around each slanted line. The card sits clear of the copy, so the two add.
      const stats = await page.evaluate(() => {
        const collect = (root, rects) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let n; while ((n = walker.nextNode())) {
            if (!n.textContent.trim()) continue;
            const r = document.createRange(); r.selectNodeContents(n);
            for (const b of r.getClientRects()) rects.push([b.left, b.top, b.right, b.bottom]);
          }
          return rects;
        };
        const rects = collect(document.querySelector('.copy'), []);
        for (const sel of ['.logo', '.btn', '.badge']) { const b = document.querySelector(sel).getBoundingClientRect(); rects.push([b.left, b.top, b.right, b.bottom]); }
        const cw = document.querySelector('.card-wrap'), cardRects = [];
        let cb = null;
        if (cw) {
          cb = cw.getBoundingClientRect();
          const keep = cw.style.transform; cw.style.transform = 'translate(-50%, -50%)';
          collect(cw.querySelector('.card'), cardRects);
          const lb = cw.querySelector('.card-logo').getBoundingClientRect(); cardRects.push([lb.left, lb.top, lb.right, lb.bottom]);
          cw.style.transform = keep;
        }
        const W = innerWidth, H = innerHeight;
        const area = (list) => { const grid = new Uint8Array(W * H);
          for (const [l, t, r, b] of list) for (let y = Math.max(0, t | 0); y < Math.min(H, Math.ceil(b)); y++) grid.fill(1, y * W + Math.max(0, l | 0), y * W + Math.min(W, Math.ceil(r)));
          let on = 0; for (const v of grid) on += v; return on; };
        const on = area(rects) + (cardRects.length ? area(cardRects) : 0);
        const copy = document.querySelector('.copy').getBoundingClientRect();
        const logo = document.querySelector('.logo').getBoundingClientRect();
        return { card: cb ? `${Math.round(cb.left)},${Math.round(cb.top)}-${Math.round(cb.right)},${Math.round(cb.bottom)}` : '', cover: (100 * on / (W * H)).toFixed(1), copyTop: Math.round(copy.top), copyBottom: Math.round(copy.bottom), logoTop: Math.round(logo.top), h1Lines: Math.round(document.querySelector('h1').getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)) };
      });
      const out = path.join(__dirname, '..', `trade-ad-${c}-${w}x${h}.png`);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
      console.log(`${path.basename(out)}  fonts:${fontsOk ? 'ok' : 'MISSING'}  text:${stats.cover}%  logoTop:${stats.logoTop}  copy:${stats.copyTop}-${stats.copyBottom}  h1 lines:${stats.h1Lines}${stats.card ? '  card:' + stats.card : ''}`);
      await ctx.close();
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
