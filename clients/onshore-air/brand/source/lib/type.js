// Text -> SVG outline paths with kerning + tracking (opentype.js, no shaping needed for caps Latin)
const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');
const FONT_DIR = path.join(__dirname, '..', 'fonts');
const cache = {};

// opentype.js 2.0's toPathData() emits NaN for some coordinates, so serialise commands ourselves.
function num(v, dec) { let s = (+v).toFixed(dec); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }
function pathData(cmds, dec = 2) {
  let out = '';
  for (const c of cmds) {
    const n = v => num(v, dec);
    if (c.type === 'M' || c.type === 'L') out += c.type + n(c.x) + ' ' + n(c.y);
    else if (c.type === 'Q') out += 'Q' + n(c.x1) + ' ' + n(c.y1) + ' ' + n(c.x) + ' ' + n(c.y);
    else if (c.type === 'C') out += 'C' + n(c.x1) + ' ' + n(c.y1) + ' ' + n(c.x2) + ' ' + n(c.y2) + ' ' + n(c.x) + ' ' + n(c.y);
    else if (c.type === 'Z') out += 'Z';
    if (/NaN|Infinity/.test(out)) throw new Error('bad path command ' + JSON.stringify(c));
  }
  return out;
}

function font(name) {
  if (!cache[name]) {
    const b = fs.readFileSync(path.join(FONT_DIR, name + '.ttf'));
    cache[name] = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  return cache[name];
}

/**
 * setText(fontName, text, opts) -> { d, advance, bbox:{x1,y1,x2,y2,w,h}, glyphs:[{ch,x,d,bbox}] }
 * opts.size      font size in user units
 * opts.tracking  letter-spacing in 1/1000 em (applied between glyphs, not after the last)
 * opts.wordSpace extra space added to the space glyph, 1/1000 em
 * opts.pairs     manual optical kerning, e.g. {'AI': -10} in 1/1000 em
 * opts.x, opts.y origin (y = baseline)
 */
function setText(fontName, text, opts = {}) {
  const f = font(fontName);
  const size = opts.size || 100, tracking = opts.tracking || 0, x0 = opts.x || 0, y = opts.y || 0;
  const scale = size / f.unitsPerEm, dec = opts.decimals ?? 2;
  const chars = [...text];
  const glyphs = chars.map(c => f.charToGlyph(c));
  let cx = x0; const out = []; const bb = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  glyphs.forEach((g, i) => {
    const p = g.getPath(cx, y, size);
    const d = pathData(p.commands, dec);
    if (d && chars[i] !== ' ') {
      const b = p.getBoundingBox();
      bb.x1 = Math.min(bb.x1, b.x1); bb.y1 = Math.min(bb.y1, b.y1);
      bb.x2 = Math.max(bb.x2, b.x2); bb.y2 = Math.max(bb.y2, b.y2);
      out.push({ ch: chars[i], x: cx, d, bbox: b });
    }
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) {
      if (opts.kern !== false) adv += f.getKerningValue(g, glyphs[i + 1]) * scale;
      adv += tracking / 1000 * size;
      if (chars[i] === ' ' && opts.wordSpace) adv += opts.wordSpace / 1000 * size;
      const pr = (opts.pairs || {})[chars[i] + chars[i + 1]];
      if (pr) adv += pr / 1000 * size;
    }
    cx += adv;
  });
  bb.w = bb.x2 - bb.x1; bb.h = bb.y2 - bb.y1;
  return { d: out.map(o => o.d).join(''), advance: cx - x0, bbox: bb, glyphs: out };
}

/** Solve tracking so that the ink width of `text` equals targetWidth (bisection). */
function fitTracking(fontName, text, size, targetWidth, opts = {}) {
  let lo = -200, hi = 2000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const w = setText(fontName, text, { ...opts, size, tracking: mid }).bbox.w;
    if (w > targetWidth) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function metrics(fontName) {
  const f = font(fontName);
  return { upm: f.unitsPerEm, cap: f.tables.os2.sCapHeight, xh: f.tables.os2.sxHeight, family: f.getEnglishName('fontFamily'), sub: f.getEnglishName('fontSubfamily') };
}

module.exports = { font, setText, fitTracking, metrics, pathData, num };
