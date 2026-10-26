// "ONSHORE AIR" wordmark, rebuilt the way the original is drawn: a thin condensed skeleton letter, a thick
// yellow "tube" around it (outline dilated by d, mitred then softened to radius rr) and the thin letter itself
// kept as the navy inline down the middle of every stroke. Measured on the original (566 px wide):
// silhouette 535 x 78 px at (16, 281), stems 25 px, inline 2-3 px on the stroke centre, very tight spacing.
//
// Letters come from a Google Font (see FONT below; chosen by overlay scoring in README "Logo"), except N and A:
// the original uses Art Deco forms (an "n"-shaped N with no diagonal, and an arched A) that no candidate font
// has, so those two are drawn here as monoline skeletons with the font's own stem weight.
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const G = require('./geom.js');

const TARGET = { x: 16, top: 281, width: 535, cap: 78, stem: 25 };

function loadFont(file) {
  const b = fs.readFileSync(file);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
// opentype.js 2.0 toPathData() can emit NaN, so serialise commands ourselves
function commandsToD(cmds) {
  return cmds.map((c) => {
    if (c.type === 'M') return `M${c.x} ${c.y}`;
    if (c.type === 'L') return `L${c.x} ${c.y}`;
    if (c.type === 'Q') return `Q${c.x1} ${c.y1} ${c.x} ${c.y}`;
    if (c.type === 'C') return `C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`;
    return 'Z';
  }).join('');
}
const bboxOf = (polys) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};

// Monoline skeletons in cap-height units (x right, y up from the baseline), stroked with the font's stem.
// w = distance between stem centres, r = corner radius; measured from the original's inline.
const SKELETONS = {
  N: (w = 0.50, r = 0.16) => [[[0, 0], [0, 1], [w - r, 1], ...arc(w - r, 1 - r, r, 90, 0), [w, 0]]],
  // A: an arch with a rounded top-left shoulder; the crossbar is itself a small arch corner that leaves the left
  // leg at barL and runs level into the right stem at barL + rb (as drawn in the original)
  A: (w = 0.51, r = 0.25, barL = 0.18, rb = 0.18) => [[[0, 0], [0, 1 - r], ...arc(r, 1 - r, r, 180, 90), [w, 1], [w, 0]], [[0, barL], ...arc(rb, barL, rb, 180, 90), [w, barL + rb]]],
};
function arc(cx, cy, r, a0, a1, n = 24) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
}

// Affine transform for opentype path commands: x' = ax*x + bx, y' = y + by
function transformCommands(cmds, ax, bx, by) {
  const X = (x) => ax * x + bx, Y = (y) => y + by;
  return cmds.map((c) => ({ ...c, x: c.x !== undefined ? X(c.x) : c.x, y: c.y !== undefined ? Y(c.y) : c.y,
    x1: c.x1 !== undefined ? X(c.x1) : c.x1, y1: c.y1 !== undefined ? Y(c.y1) : c.y1, x2: c.x2 !== undefined ? X(c.x2) : c.x2, y2: c.y2 !== undefined ? Y(c.y2) : c.y2 }));
}

// Layout is optical, like the original: every letter's silhouette sits a fixed gap from the next, with the
// original's 25 px word space; the gap is solved so the wordmark is exactly TARGET.width wide.
// The original letters' silhouette boxes (x0, x1) measured on the source image, in reading order.
const ORIGINAL_BOXES = [[16, 70], [74, 126], [129, 173], [177, 229], [233, 287], [291, 341], [343, 388], [413, 466], [471, 496], [501, 551]];

function build({ fontFile, text = 'ONSHORE AIR', custom = ['N', 'A'], rr = 3.0, miterLimit = 4, xStretch = 1.04, wordSpace = 25, skeleton = {}, boxes: fitBoxes = ORIGINAL_BOXES, inlineWeight = 2.6 }) {
  const font = loadFont(fontFile);
  const upem = font.unitsPerEm;
  const capU = (() => { const g = font.charToGlyph('H').getBoundingBox(); return g.y2 - g.y1; })();
  const stemU = (() => { const g = font.charToGlyph('I').getBoundingBox(); return g.x2 - g.x1; })();
  // solve size and tube half-width d: cap = glyphCap + 2d, stem = glyphStem + 2d
  let d = 10, size = 60;
  for (let i = 0; i < 8; i++) { size = ((TARGET.cap - 2 * d) * upem) / capU; d = (TARGET.stem - (stemU * size) / upem) / 2; }
  const k = size / upem, capPx = capU * k, stemPx = stemU * k;
  const tubeOf = (thin) => G.offset(G.offset(thin, d - rr, 'miter', miterLimit), rr, 'round');

  // each letter at the origin: thin skeleton region, its tube and the tube's box
  const letters = [...text].map((ch) => {
    if (ch === ' ') return { ch, space: true };
    if (custom.includes(ch) && SKELETONS[ch]) {
      const lines = SKELETONS[ch](...(skeleton[ch] || [])).map((l) => l.map(([u, v]) => [stemPx / 2 + u * (capPx - stemPx), -stemPx / 2 - v * (capPx - stemPx)]));
      const thin = G.offsetOpen(lines, stemPx / 2, 'miter', 'butt');
      return { ch, thin, tube: tubeOf(thin) };
    }
    const glyph = font.charToGlyph(ch);
    const cmds = glyph.getPath(0, 0, size).commands;
    const bb0 = glyph.getBoundingBox(); const gx0 = bb0.x1 * k;
    const scaled = transformCommands(cmds, xStretch, gx0 * (1 - xStretch), 0); // widen about the glyph's left edge
    const thin = G.union(G.flattenPathData(commandsToD(scaled), 0.02));
    return { ch, thin, tube: tubeOf(thin), cmds: scaled };
  });
  letters.forEach((l) => { if (!l.space) l.box = bboxOf(l.tube); });
  // optional: fit every letter to the original's letter box (scale the thin skeleton horizontally, so the
  // stroke weight is untouched) and place it there, reproducing the original's widths and spacing exactly
  if (fitBoxes) {
    let i = 0;
    for (const l of letters) {
      if (l.space) continue;
      const [bx0, bx1] = fitBoxes[i++];
      for (let it = 0; it < 3; it++) {
        const sx = (bx1 - bx0 - 2 * d) / (l.box.w - 2 * d);
        const ox = bboxOf(l.thin).x0;
        if (l.cmds) { l.cmds = transformCommands(l.cmds, sx, ox * (1 - sx), 0); l.thin = G.union(G.flattenPathData(commandsToD(l.cmds), 0.02)); }
        else l.thin = l.thin.map((p) => p.map(([px, py]) => [ox + (px - ox) * sx, py]));
        l.tube = tubeOf(l.thin); l.box = bboxOf(l.tube);
      }
      l.target = bx0;
    }
  }
  const ink = letters.filter((l) => !l.space);
  const sumW = ink.reduce((s, l) => s + l.box.w, 0);
  const pairs = ink.length - 1 - letters.filter((l) => l.space).length; // letter-to-letter gaps inside words
  const gap = (TARGET.width - sumW - wordSpace * letters.filter((l) => l.space).length) / pairs;
  // place
  let x = TARGET.x; let prevSpace = false; let first = true;
  const placed = [];
  for (const l of letters) {
    if (l.space) { prevSpace = true; continue; }
    if (!first) x += prevSpace ? wordSpace : gap;
    if (l.target !== undefined) x = l.target;
    const dx = x - l.box.x0, dy = TARGET.top - l.box.y0;
    placed.push({ ...l, dx, dy });
    x += l.box.w; prevSpace = false; first = false;
  }
  const mv = (polys, dx, dy) => polys.map((p) => p.map(([px, py]) => [px + dx, py + dy]));
  const yellow = G.union(placed.flatMap((l) => mv(l.tube, l.dx, l.dy)));
  // inline: the skeleton itself, thickened to the original's ~2.6 px line (as outlines, not a stroke)
  const grow = (inlineWeight - stemPx) / 2;
  const inlineD = grow > 0.01 ? '' : placed.filter((l) => l.cmds).map((l) => commandsToD(transformCommands(l.cmds, 1, l.dx, l.dy)).replace(/-?\d*\.\d+/g, (m) => G.fmt(parseFloat(m)))).join('');
  const inlinePolys = placed.filter((l) => grow > 0.01 || !l.cmds).flatMap((l) => mv(grow > 0.01 ? G.offset(l.thin, grow, 'round') : l.thin, l.dx, l.dy));
  const boxes = placed.map((l) => ({ ch: l.ch, x0: +(l.box.x0 + l.dx).toFixed(1), x1: +(l.box.x1 + l.dx).toFixed(1) }));
  return { yellow, inlineD, inlinePolys, boxes, meta: { size: +size.toFixed(2), d: +d.toFixed(2), stemPx: +stemPx.toFixed(2), inlineWeight, capPx: +capPx.toFixed(2), gap: +gap.toFixed(2), wordSpace, xStretch, rr } };
}

module.exports = { build, TARGET, loadFont, ORIGINAL_BOXES };
