// Build all SVG variants for the three concepts (+ review sheet). Usage: node build.js [--png]
const fs = require('fs'), path = require('path');
const { paper } = require('./lib/geo');
const { textItem, textFit, placeMark, svgDoc, bounds } = require('./lib/lockup');
const CONCEPTS = require('./concepts/config');
// BRAND_OUT: where the concept folders are written (default ./out)
const OUT = process.env.BRAND_OUT ? path.resolve(process.env.BRAND_OUT) : path.join(__dirname, 'out');
const C = 100; // name cap height = design unit


function palettes(cfg) {
  const base = Object.fromEntries(cfg.colours.map(c => [c.role, c.hex]));
  const navy = cfg.colours.find(c => c.role === 'navy').hex;
  const colour = { ...base, word: base[cfg.word], desc: base[cfg.desc] };
  const all = v => Object.fromEntries([...Object.keys(colour)].map(k => [k, v]));
  return { colour, onNavy: cfg.onNavy, monoNavy: all(navy), monoWhite: all('#FFFFFF'), navy };
}

function compose(cfg, parts) {
  const name = textItem(cfg.fonts.name, cfg.name.text, C, { tracking: cfg.name.tracking, wordSpace: cfg.name.wordSpace, pairs: cfg.name.pairs });
  const dCap = cfg.descCap * C;
  const desc = textFit(cfg.fonts.desc, cfg.descText, dCap, name.w, { wordSpace: cfg.descWordSpace });

  // ---- stacked: mark centred over name
  const st = cfg.stacked; const mH = st.markH * C;
  const mbox = bounds(parts.map(p => p.item));
  const mW = mbox.width * mH / mbox.height;
  let sx = name.w / 2 - mW / 2;
  if (st.centre === 'blend') { const sunC = parts[0].item.bounds.center.x; const bc = mbox.center.x; sx -= (sunC - bc) * (st.blend ?? 0.5) * (mH / mbox.height); }
  const sm = placeMark(parts, mH, sx + (st.ox || 0) * C, -C - st.gap * C - mH);
  const sName = name.item.clone();
  const stacked = [...sm.items.map(p => ({ ...p, group: 'mark' })), { item: sName, role: 'word', group: 'wordmark' }];

  // ---- horizontal: mark left, name + descriptor right
  const hz = cfg.horizontal;
  const dTop = hz.dGap * C, dBase = dTop + dCap;
  const textTop = -C, textBot = dBase, Ht = textBot - textTop, tc = (textTop + textBot) / 2;
  const hH = hz.markK * Ht; const hW = mbox.width * hH / mbox.height;
  const hy = hz.align === 'bottom' ? dBase - hH : tc - hH / 2;
  const hm = placeMark(parts, hH, 0, hy + (hz.oy || 0) * C);
  const tx = hW + hz.gap * hH;
  const hName = name.item.clone(); hName.translate(new paper.Point(tx, 0));
  const hDesc = desc.item.clone(); hDesc.translate(new paper.Point(tx, dBase));
  const horizontal = [...hm.items.map(p => ({ ...p, group: 'mark' })), { item: hName, role: 'word', group: 'wordmark' }, { item: hDesc, role: 'desc', group: 'descriptor' }];

  // ---- compact horizontal: mark + name only (small digital sizes)
  const cp = cfg.compact; const cH = cp.markK * C; const cW = mbox.width * cH / mbox.height;
  const cy = cp.align === 'baseline' ? 0 - cH + 0.0 * C : -C / 2 - cH / 2;
  const cm = placeMark(parts, cH, 0, cy);
  const cName = name.item.clone(); cName.translate(new paper.Point(cW + cp.gap * cH, 0));
  const compact = [...cm.items.map(p => ({ ...p, group: 'mark' })), { item: cName, role: 'word', group: 'wordmark' }];

  // ---- icon: mark centred in a square
  const im = placeMark(parts, 1000, 0, 0);
  const ib = bounds(im.items.map(p => p.item));
  const icon = im.items.map(p => ({ ...p, group: 'mark' }));

  // ---- wordmark only
  const wordmark = [{ item: name.item.clone(), role: 'word', group: 'wordmark' }];
  return { stacked, horizontal, compact, icon, iconBox: ib, wordmark, meta: { nameTracking: name.tracking, descTracking: desc.tracking, nameW: name.w } };
}

function boxOf(layers) { return bounds(layers.map(l => l.item)); }

function build(cfg) {
  const dir = path.join(OUT, cfg.id); fs.mkdirSync(dir, { recursive: true });
  const P = palettes(cfg); const L = compose(cfg, cfg.mark()); const LM = compose(cfg, (cfg.monoMark || cfg.mark)());
  const LS = compose(cfg, (cfg.smallMark || cfg.mark)());
  const T = `Onshore Air logo, ${cfg.title} concept`;
  const padL = { l: 0.5 * C, r: 0.5 * C, t: 0.5 * C, b: 0.5 * C };
  const files = {};
  const emit = (fname, layers, pal, pad, title, box) => {
    const svg = svgDoc(layers, box || boxOf(layers), pad, pal, { title });
    fs.writeFileSync(path.join(dir, fname), svg); files[fname] = svg;
  };
  emit('primary-stacked.svg', L.stacked, P.colour, padL, T + ' (stacked)');
  emit('primary-stacked-on-navy.svg', L.stacked, P.onNavy, padL, T + ' (stacked, for navy backgrounds)');
  emit('horizontal.svg', L.horizontal, P.colour, padL, T + ' (horizontal)');
  emit('horizontal-on-navy.svg', L.horizontal, P.onNavy, padL, T + ' (horizontal, for navy backgrounds)');
  emit('wordmark.svg', L.wordmark, P.colour, padL, T + ' (wordmark)');
  emit('horizontal-compact.svg', L.compact, P.colour, padL, T + ' (compact horizontal, no descriptor)');
  emit('horizontal-compact-on-navy.svg', L.compact, P.onNavy, padL, T + ' (compact horizontal, for navy backgrounds)');
  emit('mono-navy.svg', LM.stacked, P.monoNavy, padL, T + ' (one colour navy, embroidery cut)');
  emit('mono-white.svg', LM.stacked, P.monoWhite, padL, T + ' (one colour white, embroidery cut)');
  emit('horizontal-mono-navy.svg', LM.horizontal, P.monoNavy, padL, T + ' (horizontal, one colour navy)');
  emit('horizontal-mono-white.svg', LM.horizontal, P.monoWhite, padL, T + ' (horizontal, one colour white)');
  // icon: square viewBox
  const b = L.iconBox; const side = Math.max(b.width, b.height) * 1.12;
  const sq = { x: b.center.x - side / 2, y: b.center.y - side / 2, width: side, height: side };
  const z = { l: 0, r: 0, t: 0, b: 0 };
  emit('icon.svg', L.icon, P.colour, z, T + ' (icon)', sq);
  emit('icon-on-navy.svg', L.icon, P.onNavy, z, T + ' (icon, for navy backgrounds)', sq);
  { // app / avatar icon: full-bleed navy square, mark at ~70%
    const side2 = Math.max(b.width, b.height) / 0.70;
    const sq2 = { x: b.center.x - side2 / 2, y: b.center.y - side2 / 2, width: side2, height: side2 };
    const bgRect = new paper.Path.Rectangle(new paper.Point(sq2.x, sq2.y), new paper.Size(side2, side2));
    const layers = [{ item: bgRect, role: 'bg', group: 'background' }, ...L.icon];
    emit('icon-app.svg', layers, { ...P.onNavy, bg: P.navy }, z, T + ' (app and avatar icon)', sq2);
  }
  { // favicon cut: optically adjusted for 16-48 px (heavier strokes, wider gaps)
    const bs = LS.iconBox; const sd = Math.max(bs.width, bs.height) * 1.06;
    const sqs = { x: bs.center.x - sd / 2, y: bs.center.y - sd / 2, width: sd, height: sd };
    emit('favicon.svg', LS.icon, P.colour, z, T + ' (favicon cut for 16-48 px)', sqs);
    // adaptive: navy parts turn white when the browser UI is dark
    let fav = files['favicon.svg'];
    fav = fav.split(`fill="${P.colour.navy}"`).join('class="n"');
    fav = fav.replace(/(<title[^>]*>[^<]*<\/title>)/, `$1\n  <style>.n{fill:${P.colour.navy}}@media (prefers-color-scheme:dark){.n{fill:#FFFFFF}}</style>`);
    fs.writeFileSync(path.join(dir, 'favicon.svg'), fav); files['favicon.svg'] = fav;
    files['_favicon-dark-preview'] = fav.replace(/<style>[^<]*<\/style>/, '<style>.n{fill:#FFFFFF}</style>');
    const sd2 = Math.max(bs.width, bs.height) / 0.78;
    const sq3 = { x: bs.center.x - sd2 / 2, y: bs.center.y - sd2 / 2, width: sd2, height: sd2 };
    const bg2 = new paper.Path.Rectangle(new paper.Point(sq3.x, sq3.y), new paper.Size(sd2, sd2));
    emit('favicon-app.svg', [{ item: bg2, role: 'bg', group: 'background' }, ...LS.icon], { ...P.onNavy, bg: P.navy }, z, T + ' (favicon cut on navy tile)', sq3);
  }
  emit('icon-mono-navy.svg', LM.icon, P.monoNavy, z, T + ' (icon, one colour navy)', sq);
  emit('icon-mono-white.svg', LM.icon, P.monoWhite, z, T + ' (icon, one colour white)', sq);
  return { cfg, files, meta: L.meta, P };
}

module.exports = { build, CONCEPTS, OUT };
if (require.main === module) {
  for (const cfg of CONCEPTS) { const r = build(cfg); console.log(cfg.id, JSON.stringify(r.meta)); }
}
