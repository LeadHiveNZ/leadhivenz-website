// Compose marks + outlined type into lockups; emit clean, transform-free SVG.
const { paper, fromD, bounds } = require('./geo');
const { setText, fitTracking, metrics } = require('./type');

const PREC = 2;
// path data with zero-length h0/v0 segments removed (safe: only when followed by a command letter or end)
const pd = it => it.getPathData(null, PREC).replace(/[hv]-?0(?=[a-zA-Z]|$)/g, '');

/** Outline text as a paper item, baseline at y=0, ink-left at x=0, cap height = cap units. */
function textItem(fontName, str, cap, o = {}) {
  const m = metrics(fontName); const size = cap * m.upm / m.cap;
  const t = setText(fontName, str, { size, tracking: o.tracking || 0, wordSpace: o.wordSpace, pairs: o.pairs });
  const it = fromD(t.d); it.translate(new paper.Point(-t.bbox.x1, 0));
  return { item: it, w: t.bbox.w, cap, size, tracking: o.tracking || 0, ink: t.bbox };
}

/** Text sized to a given ink width by solving tracking. */
function textFit(fontName, str, cap, width, o = {}) {
  const m = metrics(fontName); const size = cap * m.upm / m.cap;
  const tr = fitTracking(fontName, str, size, width, { wordSpace: o.wordSpace, pairs: o.pairs });
  return textItem(fontName, str, cap, { ...o, tracking: tr });
}

/** Scale + place mark parts so that its (reference) box has height h and its top-left at (x,y). */
function placeMark(parts, h, x, y, refBox) {
  const items = parts.map(p => ({ item: p.item.clone(), role: p.role }));
  const b = refBox || bounds(parts.map(p => p.item));
  const s = h / b.height;
  for (const p of items) { p.item.translate(new paper.Point(-b.x, -b.y)); p.item.scale(s, new paper.Point(0, 0)); p.item.translate(new paper.Point(x, y)); }
  return { items, w: b.width * s, h, s };
}

function svgDoc(layers, box, pad, palette, meta) {
  // normalise so the padded artboard starts at 0,0
  const ox = box.x - pad.l, oy = box.y - pad.t;
  const W = +(box.width + pad.l + pad.r).toFixed(2), H = +(box.height + pad.t + pad.b).toFixed(2);
  layers = layers.map(L => { const it = L.item.clone({ insert: false }); it.translate(new paper.Point(-ox, -oy)); return { ...L, item: it }; });
  const vb = [0, 0, W, H];
  // group by layer group then by role -> one <path> per colour per group
  const groups = {};
  for (const L of layers) { (groups[L.group] ||= {}); ((groups[L.group][L.role]) ||= []).push(pd(L.item)); }
  let body = '';
  for (const g of Object.keys(groups)) {
    body += `  <g id="${g}">\n`;
    for (const role of Object.keys(groups[g])) {
      const fill = palette[role]; if (!fill) throw new Error('no colour for role ' + role);
      body += `    <path fill="${fill}" d="${groups[g][role].join(' ')}"/>\n`;
    }
    body += `  </g>\n`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" role="img" aria-labelledby="title">\n  <title id="title">${meta.title}</title>\n${body}</svg>\n`;
}

module.exports = { textItem, textFit, placeMark, svgDoc, bounds, pd };
