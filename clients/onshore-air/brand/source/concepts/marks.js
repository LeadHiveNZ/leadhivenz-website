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

/* Concept 2, Horizon: sun on a horizon line that rises to wrap it as an air current.
   The sun keeps the warm/cool split (gold sky over ocean) with a gentle wave knockout. */
function horizon(o = {}) {
  const R = o.R ?? 70, th = o.th ?? 15, gap = o.gap ?? 7, Rr = R + gap + th / 2, end = (o.end ?? -38) * Math.PI / 180, xl = o.xl ?? -125;
  const L1 = 0 - xl; const arcLen = Rr * (Math.PI / 2 - end);
  // centreline: straight horizon from xl to the sun's foot, then a concentric arc up the right side
  const c = s => { if (s <= L1) return [xl + s, Rr]; const a = Math.PI / 2 - (s - L1) / Rr; return [Rr * Math.cos(a), Rr * Math.sin(a)]; };
  const line = ribbon(c, 0, L1 + arcLen, th, 400, o.round ?? false);
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

/* Concept 3, Monogram: heavy O whose counter frames the sun over a wave (porthole view).
   dropSea / dropSun produce the one-colour embroidery cut. */
function monogram(o = {}) {
  const R = 100, r = o.r ?? 62, gap = o.gap ?? 7, A = o.A ?? 7, y0 = o.y0 ?? 10, wg = o.wg ?? 7;
  const ring = S(circle(0, 0, R), circle(0, 0, r));
  const inner = circle(0, 0, r - gap);
  const yc = x => y0 + A * Math.sin(Math.PI * (x + (o.shift ?? 0)) / (o.wl ?? 52));
  const gTop = curve(x => [x, yc(x) - wg / 2], -1.2 * R, 1.2 * R, 160, 0.004);
  const gBot = curve(x => [x, yc(x) + wg / 2], -1.2 * R, 1.2 * R, 160, 0.004);
  const above = between(gTop, curve(x => [x, -3 * R], -1.2 * R, 1.2 * R, 4, 0.1));
  const below = between(gBot, curve(x => [x, 3 * R], -1.2 * R, 1.2 * R, 4, 0.1));
  const out = [{ item: ring, role: 'navy' }];
  if (o.dropSun !== true) out.push({ item: I(inner, above), role: 'sun' });
  if (o.dropSea !== true) out.push({ item: I(inner, below), role: 'ocean' });
  return out;
}

module.exports = { evolution, horizon, monogram, ribbon };
