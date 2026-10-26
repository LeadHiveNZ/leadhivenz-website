// Onshore Air sphere rebuilt as vector geometry from measurements of the client's original logo
// (../source/onshore-logo-original.png, 566x452 RGB on black). Coordinates are in the original's pixel space
// so the vector can be overlaid on the source; build-logo.js normalises the final viewBox.
//
// Measured construction (see README "Logo"):
//  - Circle: centre (282.1, 168.3), radius 102.6 (least-squares fit to the silhouette).
//  - Blue family (top right), 6 stripes. Gap line 0 is the seam, an S-curve read off the original. Line 6 is a
//    flatter line tangent to the top of the circle. Lines 1..5 are blends between them at kPos, which reproduces
//    the measured fan (gaps found by darkness histograms in this frame).
//  - Orange family (bottom left), 9 stripes: concentric "latitude" arcs around (220, 19), radius 117.0 + 17.7 j
//    (least-squares fit to the gap darkness peaks), so the stripes run flat on the left and sweep up into the seam.
//  - Gaps 1.9 px; every stripe gets 3.2 px rounded ends (morphological opening), like the original's soft caps.
//  - Colours: per-stripe 2-stop gradients sampled from the original (lighter seam/top edge -> stripe colour).
const G = require('./geom.js');

const P = {
  c: [282.1, 168.3], R: 102.6,
  axisDeg: 32, spine: [264.2, 158.0],
  seam: [[196.5, 112.0], [217.0, 125.5], [240.4, 142.4], [263.7, 157.9], [283.7, 171.2], [303.6, 183.0], [320.1, 194.9], [332.9, 208.6], [345.6, 228.4], [351.9, 236.8], [358, 246]],
  topV0: 99.0, topSlope: 0.2126,
  kPos: [0, 1.08, 2.12, 3.12, 4.12, 5.12, 6.0],
  orangeCentre: [220, 19], orangeR0: 117.0, orangePitch: 17.7, orangeLines: 8,
  gap: 1.9, round: 3.2,
};

const rad = (d) => (d * Math.PI) / 180;
function frame(p = P) {
  const a = rad(p.axisDeg);
  const U = [Math.cos(a), Math.sin(a)], V = [Math.sin(a), -Math.cos(a)];
  return {
    toUV: ([x, y]) => { const dx = x - p.spine[0], dy = y - p.spine[1]; return [dx * U[0] + dy * U[1], dx * V[0] + dy * V[1]]; },
    toXY: ([u, v]) => [p.spine[0] + u * U[0] + v * V[0], p.spine[1] + u * U[1] + v * V[1]],
  };
}
// Catmull-Rom through the seam samples, linear beyond the ends
function interp(xs, ys, x) {
  const n = xs.length - 1;
  if (x <= xs[0]) return ys[0] + ((x - xs[0]) * (ys[1] - ys[0])) / (xs[1] - xs[0]);
  if (x >= xs[n]) return ys[n] + ((x - xs[n]) * (ys[n] - ys[n - 1])) / (xs[n] - xs[n - 1]);
  let i = 0; while (xs[i + 1] < x) i++;
  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  const p0 = ys[Math.max(0, i - 1)], p1 = ys[i], p2 = ys[i + 1], p3 = ys[Math.min(n, i + 2)];
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
function lineV(p, u, k) { // v of blend line at parameter k (0 = seam, 6 = top tangent)
  const { toUV } = frame(p);
  const s = p.seam.map(toUV);
  const v0 = interp(s.map((q) => q[0]), s.map((q) => q[1]), u);
  const v6 = p.topV0 + p.topSlope * u;
  return v0 + ((v6 - v0) * k) / 6;
}

function build(p = P) {
  const { toUV, toXY } = frame(p);
  const [uc] = toUV(p.c);
  const us = []; for (let u = uc - p.R - 10; u <= uc + p.R + 10; u += 0.75) us.push(u);
  const disc = G.circle(p.c[0], p.c[1], p.R, 0.4);
  const h = p.gap / 2;
  const parts = [];
  // blue stripes between consecutive kPos lines
  for (let i = 0; i < p.kPos.length - 1; i++) {
    const lo = us.map((u) => toXY([u, lineV(p, u, p.kPos[i]) + h]));
    const hi = us.map((u) => toXY([u, Math.max(lineV(p, u, p.kPos[i + 1]) - h, lineV(p, u, p.kPos[i]) + h + 0.01)]));
    let shape = G.intersect([[...lo, ...hi.reverse()]], disc);
    shape = G.roundCorners(shape, p.round);
    const uMid = uc; // gradient axis through the circle centre's u
    parts.push({ family: 'blue', index: i, polys: shape,
      grad: { from: toXY([uMid, lineV(p, uMid, p.kPos[i]) + h]), to: toXY([uMid, lineV(p, uMid, p.kPos[i + 1]) - h]) } });
  }
  // orange side of the seam (below the seam gap)
  const side = [[...us.map((u) => toXY([u, lineV(p, u, 0) - h])), toXY([us[us.length - 1], -500]), toXY([us[0], -500])]];
  const orangeArea = G.intersect(disc, side);
  const [ox, oy] = p.orangeCentre;
  const rAt = (j) => p.orangeR0 + j * p.orangePitch;
  for (let j = 0; j <= p.orangeLines; j++) {
    const rIn = j === 0 ? 0 : rAt(j - 1) + h;
    const rOut = j === p.orangeLines ? 420 : rAt(j) - h;
    let ring = G.circle(ox, oy, rOut, 0.4);
    if (rIn > 0) ring = G.difference(ring, G.circle(ox, oy, rIn, 0.4));
    let shape = G.roundCorners(G.intersect(ring, orangeArea), p.round);
    if (G.area(shape) < 20) continue;
    parts.push({ family: 'orange', index: j, polys: shape, grad: { centre: [ox, oy], rIn: Math.max(rIn, rAt(j - 1) || 0), rOut } });
  }
  return parts;
}

module.exports = { P, build, frame, lineV };
