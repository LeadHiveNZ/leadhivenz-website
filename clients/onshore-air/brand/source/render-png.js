// Render every SVG to PNG (2x) + icon sizes. Usage: node render-png.js
const fs = require('fs'), path = require('path');
const { build, CONCEPTS, OUT } = require('./build');
const { svgToPng, close } = require('./lib/render');
const NOMINAL = { 'primary-stacked': 600, 'horizontal': 900, 'horizontal-compact': 600, 'wordmark': 800, 'mono': 600, 'horizontal-mono': 900, 'icon': 512 };
function nominal(f) {
  const b = f.replace('.svg', '').replace(/-on-navy$/, '').replace(/-(navy|white)$/, '');
  if (b.startsWith('icon')) return 512;
  return NOMINAL[b] || 600;
}
(async () => {
  for (const cfg of CONCEPTS) {
    const r = build(cfg); const dir = path.join(OUT, cfg.id, 'png'); fs.mkdirSync(dir, { recursive: true });
    for (const [fname, svg] of Object.entries(r.files)) {
      if (fname.startsWith('_')) continue;
      const vb = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
      const w = nominal(fname), h = Math.round(w * vb[3] / vb[2]);
      await svgToPng(svg, path.join(dir, fname.replace('.svg', '@2x.png')), { width: w, height: h, dsf: 2 });
    }
    for (const s of [16, 32, 64, 180, 512]) {
      // 16 and 32 px use the optically adjusted favicon cut; 64 px and up use the master icon
      const src = s <= 32 ? 'favicon' : 'icon';
      await svgToPng(r.files[src + '.svg'], path.join(dir, `icon-${s}.png`), { width: s, height: s, dsf: 1 });
      await svgToPng(r.files[src + '-app.svg'], path.join(dir, `icon-app-${s}.png`), { width: s, height: s, dsf: 1 });
    }
    // master icon at small sizes too, for the comparison in the presentation
    for (const s of [16, 32]) await svgToPng(r.files['icon.svg'], path.join(dir, `icon-master-${s}.png`), { width: s, height: s, dsf: 1 });
    console.log(cfg.id, fs.readdirSync(dir).length, 'pngs');
  }
  await close();
})();
