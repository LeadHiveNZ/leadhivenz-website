// Helpers for the presentation page
const fs = require('fs');
const { setText, metrics } = require('../lib/type');
let uid = 0;

/** Inline an SVG file string into HTML: unique ids, optional size/class. */
function inline(svg, { w, h, cls = '', style = '', label } = {}) {
  uid++;
  let s = svg.replace(/\sid="(mark|wordmark|descriptor|background)"/g, ' class="$1"');
  s = s.replace('id="title"', `id="t${uid}"`).replace('aria-labelledby="title"', `aria-labelledby="t${uid}"`);
  if (label) s = s.replace(/<title id="t\d+">[^<]*<\/title>/, `<title id="t${uid}">${label}</title>`);
  const attrs = [w ? `width="${w}"` : '', h ? `height="${h}"` : '', cls ? `class="${cls}"` : '', style ? `style="${style}"` : ''].filter(Boolean).join(' ');
  return s.replace('<svg ', `<svg ${attrs} `);
}

/** Nest an SVG inside another SVG at x,y with width (height from aspect) or height. */
function nest(svg, x, y, { w, h, anchor = 'start' } = {}) {
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  if (w && !h) h = w * vb[3] / vb[2]; if (h && !w) w = h * vb[2] / vb[3];
  if (anchor === 'middle') x -= w / 2;
  if (anchor === 'center') { x -= w / 2; y -= h / 2; }
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title[^>]*>[^<]*<\/title>/, '')
    .replace(/\sid="[^"]*"/g, '');
  return { svg: `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${vb.join(' ')}">${inner}</svg>`, w, h };
}

/** Text as outlined paths in a given font. cap = cap height in output units. Returns {path, w, h, bbox} positioned with baseline at (x,y). */
function outline(fontName, str, cap, { x = 0, y = 0, fill = '#000', tracking = 0, anchor = 'start' } = {}) {
  const m = metrics(fontName); const size = cap * m.upm / m.cap;
  const t = setText(fontName, str, { size, tracking });
  let dx = x - t.bbox.x1; if (anchor === 'middle') dx -= t.bbox.w / 2; if (anchor === 'end') dx -= t.bbox.w;
  const t2 = setText(fontName, str, { size, tracking, x: dx, y });
  return { path: `<path fill="${fill}" d="${t2.d}"/>`, w: t.bbox.w, bbox: t2.bbox };
}

/** Standalone inline SVG of text sized by cap height in CSS px. */
function textSVG(fontName, str, capPx, fill, { tracking = 0, cls = '', label, maxW } = {}) {
  const o = outline(fontName, str, 100, { fill, tracking });
  const b = o.bbox; const pad = 6;
  const vb = [b.x1 - pad, b.y1 - pad, b.w + 2 * pad, b.h + 2 * pad];
  if (maxW && capPx * vb[2] / 100 > maxW) capPx = maxW * 100 / vb[2];
  const hPx = capPx * vb[3] / 100;
  return `<svg class="${cls}" role="img" aria-label="${(label || str).replace(/"/g, '')}" viewBox="${vb.map(v => v.toFixed(2)).join(' ')}" style="height:${hPx.toFixed(2)}px;width:auto;display:block">${o.path}</svg>`;
}

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const svgData = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
module.exports = { inline, nest, outline, textSVG, b64, svgData };
