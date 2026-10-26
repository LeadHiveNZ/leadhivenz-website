#!/usr/bin/env node
// Builds the vector Onshore Air logo and every raster derived from it.
//   site/assets/img/logo.svg              stacked lockup (as the original): sphere above, wordmark below
//   site/assets/img/logo-horizontal.svg   sphere left of the wordmark (desktop header)
//   site/assets/img/logo-mark.svg         sphere only (favicon.svg is the same file)
//   site/assets/img/logo.png|webp, logo-2x.png|webp  raster exports (3x / 2x of the 56 px mobile header)
//   favicon.ico (16/32/48), favicon.svg, apple-touch-icon.png (180), icon-192.png, icon-512.png (maskable-safe)
//   ../out/logo-compare.png               acceptance check: original vs vector at the same size, navy + white
// Usage: npm install && node build-logo.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const G = require('./geom.js');
const Sphere = require('./sphere.js');
const Word = require('./wordmark.js');
const R = require('./render.js');

const SITE_IMG = path.resolve(__dirname, '..', '..', 'site', 'assets', 'img');
const SITE = path.resolve(__dirname, '..', '..', 'site');
const OUT = path.resolve(__dirname, '..', 'out');
const ORIGINAL = path.resolve(__dirname, '..', 'source', 'onshore-logo-original.png');
const FONT = path.join(__dirname, 'fonts', 'YanoneKaffeesatz-ExtraLight.ttf');
fs.mkdirSync(OUT, { recursive: true });

// Colours sampled from the original (medians per stripe: seam/top edge -> body), see README "Logo".
const NAVY = '#0C1D45';
const YELLOW = '#EEDF60';
const STRIPES = {
  blue0: ['#68CAD9', '#60CCDC'], blue1: ['#64C9D7', '#56B0D2'], blue2: ['#4D90BC', '#377EB7'],
  blue3: ['#2B559E', '#1C439A'], blue4: ['#1E4399', '#193F99'], blue5: ['#1F4399', '#193F9A'],
  orange0: ['#E7D77B', '#EBD259'], orange1: ['#E8CF6B', '#EAC650'], orange2: ['#E7C25A', '#E8B947'],
  orange3: ['#E5B444', '#E8AC40'], orange4: ['#E6A938', '#E7A036'], orange5: ['#E49F2F', '#E59730'],
  orange6: ['#E29529', '#E48928'], orange7: ['#E18C24', '#E37E20'], orange8: ['#DF7B1F', '#DF7B1F'],
};

// ---------- geometry (original 566x452 pixel space) ----------
const sphere = Sphere.build();
const word = Word.build({ fontFile: FONT });
const SPH = { cx: Sphere.P.c[0], cy: Sphere.P.c[1], r: Sphere.P.R };
const WORD = { x0: Word.TARGET.x, y0: Word.TARGET.top, w: Word.TARGET.width, h: Word.TARGET.cap };

// Elements with a transform (scale s, translate tx, ty) baked into the coordinates.
function sphereSvg(s, tx, ty, idp) {
  const T = ([x, y]) => [x * s + tx, y * s + ty];
  const defs = [], paths = [];
  sphere.forEach((part, i) => {
    const id = `${idp}${i}`;
    const [c0, c1] = STRIPES[part.family + part.index];
    if (part.family === 'blue') {
      const [x1, y1] = T(part.grad.from), [x2, y2] = T(part.grad.to);
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${G.fmt(x1)}" y1="${G.fmt(y1)}" x2="${G.fmt(x2)}" y2="${G.fmt(y2)}"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`);
    } else {
      const [cx, cy] = T(part.grad.centre); const rOut = part.grad.rOut * s, rIn = part.grad.rIn * s;
      defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${G.fmt(cx)}" cy="${G.fmt(cy)}" r="${G.fmt(rOut)}"><stop offset="${G.fmt(Math.max(0, rIn / rOut))}" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>`);
    }
    paths.push(`<path fill="url(#${id})" d="${G.toPathData(part.polys, { tol: 0.04, transform: T })}"/>`);
  });
  return { defs: defs.join(''), body: `<g>${paths.join('')}</g>` };
}
function wordSvg(s, tx, ty) {
  const T = ([x, y]) => [x * s + tx, y * s + ty];
  const yellow = G.toPathData(word.yellow, { tol: 0.03, transform: T });
  const inline = G.transformPathData(word.inlineD, s, tx, ty) + G.toPathData(word.inlinePolys, { tol: 0.02, transform: T });
  return `<g><path fill="${YELLOW}" d="${yellow}"/><path fill="${NAVY}" d="${inline}"/></g>`;
}
const svgDoc = (w, h, defs, body, title = 'Onshore Air') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G.fmt(w)} ${G.fmt(h)}" width="${G.fmt(w)}" height="${G.fmt(h)}" role="img" aria-label="${title}"><title>${title}</title><defs>${defs}</defs>${body}</svg>\n`;

// Stacked: the original lockup, unchanged proportions. Pad 6 px around the artwork, origin at 0,0.
function stacked() {
  const pad = 6;
  const x0 = Math.min(WORD.x0, SPH.cx - SPH.r) - pad, y0 = SPH.cy - SPH.r - pad;
  const x1 = Math.max(WORD.x0 + WORD.w, SPH.cx + SPH.r) + pad, y1 = WORD.y0 + WORD.h + pad;
  const s = 1, sp = sphereSvg(s, -x0, -y0, 's');
  return { svg: svgDoc(x1 - x0, y1 - y0, sp.defs, sp.body + wordSvg(s, -x0, -y0)), w: x1 - x0, h: y1 - y0 };
}
// Horizontal: sphere left; wordmark cap height = 0.40 x sphere diameter, centred on the sphere; gap 0.16 x D.
function horizontal() {
  const D = 2 * SPH.r, pad = 6, capRatio = 0.40, gapRatio = 0.16;
  const ws = (capRatio * D) / WORD.h;                 // scale for the wordmark
  const sx = pad - (SPH.cx - SPH.r), sy = pad - (SPH.cy - SPH.r);
  const wx = pad + D + gapRatio * D - WORD.x0 * ws, wy = pad + SPH.r - (WORD.y0 + WORD.h / 2) * ws;
  const w = pad + D + gapRatio * D + WORD.w * ws + pad, h = D + 2 * pad;
  const sp = sphereSvg(1, sx, sy, 'h');
  return { svg: svgDoc(w, h, sp.defs, sp.body + wordSvg(ws, wx, wy)), w, h };
}
// Mark: sphere only, square, 4 px padding
function mark() {
  const pad = 4, D = 2 * SPH.r, sp = sphereSvg(1, pad - (SPH.cx - SPH.r), pad - (SPH.cy - SPH.r), 'm');
  return { svg: svgDoc(D + 2 * pad, D + 2 * pad, sp.defs, sp.body, 'Onshore Air'), w: D + 2 * pad, h: D + 2 * pad };
}

(async () => {
  const t0 = Date.now();
  const L = { stacked: stacked(), horizontal: horizontal(), mark: mark() };
  fs.writeFileSync(path.join(SITE_IMG, 'logo.svg'), L.stacked.svg);
  fs.writeFileSync(path.join(SITE_IMG, 'logo-horizontal.svg'), L.horizontal.svg);
  fs.writeFileSync(path.join(SITE_IMG, 'logo-mark.svg'), L.mark.svg);
  fs.writeFileSync(path.join(SITE_IMG, 'favicon.svg'), L.mark.svg);
  for (const [k, v] of Object.entries(L)) console.log(`${k.padEnd(10)} ${v.w.toFixed(1)} x ${v.h.toFixed(1)}  ${(Buffer.byteLength(v.svg) / 1024).toFixed(1)} KB svg`);

  // ---------- rasters ----------
  const tmp = path.join(OUT, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const png = async (svg, file, w, h, bg = null) => { await R.svgToPng(svg, file, w, h, { background: bg }); return file; };
  const toWebp = (src, dst) => execFileSync('convert', [src, '-strip', '-define', 'webp:lossless=false', '-define', 'webp:alpha-quality=100', '-quality', '92', dst]);
  const optPng = (src, dst) => execFileSync('convert', [src, '-strip', '-define', 'png:compression-level=9', dst]);
  // stacked logo at 3x and 2x of the 56 px mobile header
  for (const [name, hpx] of [['logo', 168], ['logo-2x', 112]]) {
    const wpx = Math.round((L.stacked.w / L.stacked.h) * hpx);
    const raw = await png(L.stacked.svg, path.join(tmp, name + '.png'), wpx, hpx);
    optPng(raw, path.join(SITE_IMG, name + '.png')); toWebp(raw, path.join(SITE_IMG, name + '.webp'));
  }
  // favicons and app icons from the sphere mark
  const markSvg = L.mark.svg;
  const fav = {};
  for (const s of [16, 32, 48]) fav[s] = await png(markSvg, path.join(tmp, `fav-${s}.png`), s, s);
  execFileSync('convert', [fav[16], fav[32], fav[48], path.join(SITE, 'favicon.ico')]);
  const onNavy = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${NAVY}"/><image href="data:image/svg+xml;base64,${Buffer.from(markSvg).toString('base64')}" x="${(size - inner) / 2}" y="${(size - inner) / 2}" width="${inner}" height="${inner}"/></svg>`;
  for (const [name, size, frac] of [['apple-touch-icon', 180, 0.74], ['icon-192', 192, 0.62], ['icon-512', 512, 0.62]]) {
    const raw = await png(onNavy(size, Math.round(size * frac)), path.join(tmp, name + '.png'), size, size, NAVY);
    execFileSync('convert', [raw, '-strip', '-alpha', 'off', '+dither', '-colors', '256', `PNG8:${path.join(SITE_IMG, name + '.png')}`]);
  }

  // ---------- acceptance comparison: original vs vector, same pixel size, on black / navy / white ----------
  const origB64 = fs.readFileSync(ORIGINAL).toString('base64');
  // the original, trimmed to the same artwork box as logo.svg (its pixel space is the vector's pixel space)
  const pad = 6, bx = Math.min(WORD.x0, SPH.cx - SPH.r) - pad, by = SPH.cy - SPH.r - pad;
  const W = 520, H = W * (L.stacked.h / L.stacked.w), S = W / L.stacked.w;
  const keyed = path.join(tmp, 'orig-keyed.png');
  // key the original's black background out (alpha = max(R,G,B)/0.6, colour un-premultiplied) only for this comparison
  execFileSync('convert', [ORIGINAL, '(', '+clone', '-channel', 'RGB', '-separate', '-evaluate-sequence', 'Max', '-evaluate', 'multiply', '1.6667', '-evaluate', 'min', '65535', ')', '-compose', 'CopyOpacity', '-composite', `PNG32:${path.join(tmp, 'k1.png')}`]);
  execFileSync('convert', [path.join(tmp, 'k1.png'), '(', '+clone', '-alpha', 'extract', ')', '-alpha', 'off', '-compose', 'DivideSrc', '-composite', path.join(tmp, 'k2.png')]);
  execFileSync('convert', [path.join(tmp, 'k1.png'), '-alpha', 'extract', path.join(tmp, 'k3.png')]);
  execFileSync('convert', [path.join(tmp, 'k2.png'), path.join(tmp, 'k3.png'), '-compose', 'CopyOpacity', '-composite', `PNG32:${keyed}`]);
  const keyedB64 = fs.readFileSync(keyed).toString('base64');
  const origImg = (b64) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bx} ${by} ${L.stacked.w} ${L.stacked.h}" width="${W}" height="${H}"><image href="data:image/png;base64,${b64}" width="566" height="452"/></svg>`;
  const newImg = `<img src="data:image/svg+xml;base64,${Buffer.from(L.stacked.svg).toString('base64')}" width="${W}" height="${H}">`;
  const cell = (bg, inner, label, fg) => `<figure style="margin:0;background:${bg};padding:22px 26px 12px;border-radius:14px"><div style="width:${W}px;height:${H}px">${inner}</div><figcaption style="font:600 15px/1.3 Inter,Arial,sans-serif;color:${fg};margin-top:10px">${label}</figcaption></figure>`;
  const rows = [
    ['#000000', origImg(origB64), 'Original file as supplied (566 x 452 PNG on black)', newImg, 'New vector logo.svg on black', '#ddd'],
    [NAVY, origImg(keyedB64), 'Original, background keyed out, on site navy', newImg, 'New vector on site navy', '#cfe0ff'],
    ['#FFFFFF', origImg(keyedB64), 'Original, background keyed out, on white', newImg, 'New vector on white', '#333'],
  ];
  const html = `<!doctype html><html><body style="margin:0;padding:28px;background:#E9EDF3;font-family:Arial,sans-serif">
<h1 style="font:700 26px/1.2 Arial,sans-serif;margin:0 0 6px;color:#0C1D45">Onshore Air logo: original vs vector rebuild (same pixel size)</h1>
<p style="font:15px/1.4 Arial,sans-serif;margin:0 0 20px;color:#334">Sphere: 6 blue + 9 orange stripes, curvature, gaps and colours measured from the original. Wordmark: Yanone Kaffeesatz ExtraLight skeleton (N and A drawn to the original's arched forms) stroked as a yellow tube with a navy inline, every letter fitted to the original's letter box.</p>
${rows.map(([bg, a, la, b, lb, fg]) => `<div style="display:flex;gap:20px;margin-bottom:20px">${cell(bg, a, la, fg)}${cell(bg, b, lb, fg)}</div>`).join('')}
</body></html>`;
  const cmpW = 2 * (W + 52) + 20 + 56, cmpH = 3 * (H + 76) + 60 + 110;
  await R.htmlToPng(html, path.join(OUT, 'logo-compare.png'), { width: cmpW, height: cmpH });
  // zoomed detail strip: original vs vector at 4x of the original pixels
  const zoom = 2.2;
  const zw = L.stacked.w * zoom, zh = L.stacked.h * zoom;
  await R.htmlToPng(`<!doctype html><html><body style="margin:0;background:#000;display:flex;gap:16px;padding:16px"><div style="width:${zw}px;height:${zh}px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${bx} ${by} ${L.stacked.w} ${L.stacked.h}" width="${zw}" height="${zh}"><image href="data:image/png;base64,${origB64}" width="566" height="452"/></svg></div><img src="data:image/svg+xml;base64,${Buffer.from(L.stacked.svg).toString('base64')}" width="${zw}" height="${zh}"></body></html>`, path.join(OUT, 'logo-compare-zoom.png'), { width: 2 * zw + 48, height: zh + 32 });
  fs.rmSync(tmp, { recursive: true, force: true });
  await R.close();
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${path.relative(process.cwd(), SITE_IMG)} and ${path.relative(process.cwd(), OUT)}`);
})();
