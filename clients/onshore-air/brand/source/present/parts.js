// Helpers for the presentation page
const { setText, metrics } = require('../lib/type');



/** Text as outlined paths in a given font. cap = cap height in output units. Returns {path, w, h, bbox} positioned with baseline at (x,y). */
function outline(fontName, str, cap, { x = 0, y = 0, fill = '#000', tracking = 0, anchor = 'start' } = {}) {
  const m = metrics(fontName); const size = cap * m.upm / m.cap;
  const t = setText(fontName, str, { size, tracking, decimals: 1 });
  let dx = x - t.bbox.x1; if (anchor === 'middle') dx -= t.bbox.w / 2; if (anchor === 'end') dx -= t.bbox.w;
  const t2 = setText(fontName, str, { size, tracking, x: dx, y, decimals: 1 });
  return { path: `<path fill="${fill}" d="${t2.d}"/>`, w: t.bbox.w, bbox: t2.bbox };
}

/** Standalone inline SVG of text sized by cap height in CSS px. */
function textSVG(fontName, str, capPx, fill, { tracking = 0, cls = '', label, maxW, cqBase } = {}) {
  const o = outline(fontName, str, 100, { fill, tracking });
  const b = o.bbox; const pad = 6;
  const vb = [b.x1 - pad, b.y1 - pad, b.w + 2 * pad, b.h + 2 * pad];
  if (maxW && capPx * vb[2] / 100 > maxW) capPx = maxW * 100 / vb[2];
  const hPx = capPx * vb[3] / 100;
  // cqBase: also size in container-query units (cqw of a container cqBase px wide) so the text scales with it; px stays as fallback
  const h = `height:${hPx.toFixed(2)}px;` + (cqBase ? `height:${(hPx / cqBase * 100).toFixed(3)}cqw;` : '');
  return `<svg class="${cls}" role="img" aria-label="${(label || str).replace(/"/g, '')}" viewBox="${vb.map(v => v.toFixed(2)).join(' ')}" style="${h}width:auto;display:block">${o.path}</svg>`;
}

const viewBox = svg => svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);

/** <image> inside an SVG scene that references an asset file (sized from the asset's viewBox). */
function imageRef(href, svg, x, y, { w, h, anchor = 'start' } = {}) {
  const v = viewBox(svg); if (w && !h) h = w * v[3] / v[2]; if (h && !w) w = h * v[2] / v[3];
  if (anchor === 'middle') x -= w / 2;
  if (anchor === 'center') { x -= w / 2; y -= h / 2; }
  return { svg: `<image href="${href}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"/>`, w, h };
}

/** <img> referencing an asset SVG/PNG; width/height carry the intrinsic aspect so the layout never jumps. */
function imgRef(href, svg, { cls = '', alt = '' } = {}) {
  const v = svg ? viewBox(svg) : [0, 0, 1, 1];
  return `<img src="${href}"${cls ? ` class="${cls}"` : ''} alt="${alt.replace(/"/g, '')}" width="${Math.round(v[2])}" height="${Math.round(v[3])}" decoding="async">`;
}

module.exports = { outline, textSVG, viewBox, imageRef, imgRef };
