// Mark geometry for the three Onshore Air concepts.
// Every builder works in a frame centred on (0,0) with the main circle at R=100 (Horizon: sun R=70)
// and returns [{ item: paper.PathItem, role }]. Roles map to palette colours in config.js.
// Gaps between shapes are true knockouts, so the marks work on any background.
const { paper, circle, curve, between, I, S, U } = require('../lib/geo');
const rad = a => a * Math.PI / 180;

/* Concept 1, Evolution: disc split by a diagonal S-wave into flat bands (cool top-right, warm bottom-left). */
function evolution(o = {}) {
  const R = 100, alpha = rad(o.alpha ?? 28), A = o.A ?? 9, wl = o.wl ?? 1.0;
  const edges = o.edges ?? [44, 0, -44];          // band boundaries along the normal (cool side positive)
  const gaps = o.gaps ?? [5, 7, 5];               // knockout width at each boundary
  const roles = o.roles ?? ['navy', 'ocean', 'sun', 'sunset'];
  const dx = Math.cos(alpha), dy = Math.sin(alpha), nx = Math.sin(alpha), ny = -Math.cos(alpha);
  const amps = o.amps;                            // optional per-boundary wave amplitude
  const w = (t, a = A) => a * Math.sin(Math.PI * t / (R * wl) + (o.phase ?? 0));
  const wave = (off, a = A) => curve(t => [t * dx + (off + w(t, a)) * nx, t * dy + (off + w(t, a)) * ny], -1.7 * R, 1.7 * R, 140, 0.005);
  const disc = circle(0, 0, R);
  const E = [3 * R, ...edges, -3 * R], G = [0, ...gaps, 0];
  const out = [];
  for (let i = 0; i < E.length - 1; i++) {
    const top = E[i] - G[i] / 2, bot = E[i + 1] + G[i + 1] / 2;
    const aT = amps ? (i === 0 ? 0 : amps[i - 1]) : A, aB = amps ? (i + 1 >= E.length - 1 ? 0 : amps[i]) : A;
    const reg = between(wave(bot, aB), wave(top, aT));
    out.push({ item: I(disc, reg), role: roles[i] });
  }
  return out;
}

/* Ribbon (constant or variable thickness) along a centreline c(t) -> [x, y]. */
function ribbon(c, t0, t1, th, n = 200, roundCaps = false) {
  const pts = []; for (let i = 0; i <= n; i++) pts.push(c(t0 + (t1 - t0) * i / n));
  const L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const m = Math.hypot(tx, ty); tx /= m; ty /= m;
    const h = (typeof th === 'function' ? th(i / n) : th) / 2;
    L.push([pts[i][0] - ty * h, pts[i][1] + tx * h]); Rr.push([pts[i][0] + ty * h, pts[i][1] - tx * h]);
  }
  const p = new paper.Path([...L, ...Rr.reverse()].map(([x, y]) => new paper.Point(x, y))); p.closed = true; p.simplify(0.01);
  let out = p;
  if (roundCaps) {
    const h0 = (typeof th === 'function' ? th(0) : th) / 2, h1 = (typeof th === 'function' ? th(1) : th) / 2;
    out = U(U(out, circle(pts[0][0], pts[0][1], h0)), circle(pts[n][0], pts[n][1], h1));
  }
  return out;
}

/* Concept 2, Horizon: the sun sits on a horizon line that sweeps up its right side like a breeze.
   Built from explicit edges so it is a filled shape, not a stroke:
   - inner edge: straight horizon at y = R + gap, then an exact concentric arc (constant gap to the sun)
   - outer edge: inner edge + thickness; full weight under the sun, then tapering to a point after `wrap` degrees
   `rightCap: 'round'` gives the constant-width, round-capped alternative and `rightCap: 'square'` the round-1
   "hook"; both are kept only for the comparison sheet in screens/. */
function horizon(o = {}) {
  const R = o.R ?? 70, th = o.th ?? 17, gap = o.gap ?? 7, Ri = R + gap;
  const wrap = rad(o.wrap ?? 108), a0 = Math.PI / 2, a1 = a0 - wrap;   // screen angles: 90deg = 6 o'clock
  const xl = o.xl ?? -125, hold = rad(o.hold ?? 18), pow = o.pow ?? 0.7;
  const P = (x, y) => new paper.Point(x, y), polar = (r, a) => P(r * Math.cos(a), r * Math.sin(a));
  const thick = a => { const done = a0 - a; if (done <= hold) return th; const u = Math.max(0, 1 - (done - hold) / (wrap - hold)); return th * Math.pow(Math.sin(u * Math.PI / 2), pow); };
  const shape = new paper.Path();
  shape.add(P(xl, Ri)); shape.add(P(0, Ri));
  shape.arcTo(polar(Ri, (a0 + a1) / 2), polar(Ri, a1));               // exact inner arc, ends at the tip
  let line;
  if ((o.rightCap ?? 'taper') === 'taper') {
    const outer = new paper.Path();
    for (let i = 0; i <= 240; i++) { const a = a1 + (a0 - a1) * i / 240; outer.add(polar(Ri + thick(a), a)); }
    outer.simplify(o.tol ?? 0.002);
    shape.lastSegment.handleOut = outer.firstSegment.handleOut;          // smooth departure from the tip
    for (const seg of outer.segments.slice(1)) shape.add(seg.clone());
    shape.lastSegment.handleOut = new paper.Point(0, 0);
    shape.add(P(xl, Ri + th));
    shape.closed = true; line = shape;
  } else {                                                             // constant width: 'round' cap, or 'square' (round-1 hook)
    shape.add(polar(Ri + th, a1));
    shape.arcTo(polar(Ri + th, (a0 + a1) / 2), polar(Ri + th, a0));
    shape.add(P(xl, Ri + th));
    shape.closed = true;
    line = o.rightCap === 'square' ? shape : U(shape, circle((Ri + th / 2) * Math.cos(a1), (Ri + th / 2) * Math.sin(a1), th / 2));
  }
  const out = [];
  if (o.split) {
    const A = o.A ?? 4, y0 = o.y0 ?? 14, wg = o.wg ?? 6, wl = o.wl ?? 70;
    const yc = x => y0 + A * Math.sin(Math.PI * x / wl);
    const gT = curve(x => [x, yc(x) - wg / 2], -1.5 * R, 1.5 * R, 160, 0.003), gB = curve(x => [x, yc(x) + wg / 2], -1.5 * R, 1.5 * R, 160, 0.003);
    out.push({ item: I(circle(0, 0, R), between(gT, curve(x => [x, -3 * R], -1.5 * R, 1.5 * R, 4, .1))), role: 'sun' });
    out.push({ item: I(circle(0, 0, R), between(gB, curve(x => [x, 3 * R], -1.5 * R, 1.5 * R, 4, .1))), role: 'ocean' });
  } else out.push({ item: circle(0, 0, R), role: 'sun' });
  out.push({ item: line, role: o.lineRole ?? 'navy' });
  return out;
}

/* Concept 3, Monogram: a navy O whose counter holds the original diagonal sun-meets-sea split
   (warm bottom-left, cool top-right, one gentle S-curve). split: 'flat' gives the round-1 horizontal wave,
   kept for the comparison in critique.md. dropSea / dropSun produce the one-colour embroidery cut. */
function monogram(o = {}) {
  const R = 100, r = o.r ?? 67, gap = o.gap ?? 7, wg = o.wg ?? 7.5;
  const ring = S(circle(0, 0, R), circle(0, 0, r));
  const ri = r - gap, inner = circle(0, 0, ri);
  let warm, cool;
  if ((o.split ?? 'diagonal') === 'diagonal') {
    const alpha = rad(o.alpha ?? 30), A = o.A ?? 6.5, s0 = o.s0 ?? 0;
    const dx = Math.cos(alpha), dy = Math.sin(alpha), nx = Math.sin(alpha), ny = -Math.cos(alpha);
    const w = t => A * Math.sin(Math.PI * t / ri);
    const wave = off => curve(t => [t * dx + (off + w(t)) * nx, t * dy + (off + w(t)) * ny], -1.4 * R, 1.4 * R, 160, 0.004);
    cool = I(inner, between(wave(s0 + wg / 2), wave(3 * R)));
    warm = I(inner, between(wave(-3 * R), wave(s0 - wg / 2)));
  } else {
    const A = o.A ?? 7, y0 = o.y0 ?? 10;
    const yc = x => y0 + A * Math.sin(Math.PI * (x + (o.shift ?? 0)) / (o.wl ?? 52));
    const gTop = curve(x => [x, yc(x) - wg / 2], -1.2 * R, 1.2 * R, 160, 0.004);
    const gBot = curve(x => [x, yc(x) + wg / 2], -1.2 * R, 1.2 * R, 160, 0.004);
    warm = I(inner, between(gTop, curve(x => [x, -3 * R], -1.2 * R, 1.2 * R, 4, 0.1)));
    cool = I(inner, between(gBot, curve(x => [x, 3 * R], -1.2 * R, 1.2 * R, 4, 0.1)));
  }
  const out = [{ item: ring, role: 'navy' }];
  if (o.dropSun !== true) out.push({ item: warm, role: 'sun' });
  if (o.dropSea !== true) out.push({ item: cool, role: 'ocean' });
  return out;
}

module.exports = { evolution, horizon, monogram, ribbon };
