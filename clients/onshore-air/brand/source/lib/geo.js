// Geometry helpers on paper.js (headless): booleans with true Bezier output, no clipPaths in final art.
const paper = require('paper');
paper.setup(new paper.Size(2000, 2000));
const P = (x, y) => new paper.Point(x, y);

function circle(cx, cy, r) { return new paper.Path.Circle(P(cx, cy), r); }
function rect(x, y, w, h) { return new paper.Path.Rectangle(P(x, y), new paper.Size(w, h)); }
function fromD(d) { return new paper.CompoundPath(d); }
function poly(points, closed = true) { const p = new paper.Path(points.map(([x, y]) => P(x, y))); p.closed = closed; return p; }

/** Smooth open path through sampled points of f(t) -> [x,y]; simplified to few clean Beziers. */
function curve(f, t0, t1, n = 80, tol = 0.02) {
  const p = new paper.Path();
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; const [x, y] = f(t); p.add(P(x, y)); }
  p.simplify(tol);
  return p;
}

/** Closed region between two open curves a and b (b is reversed and appended). */
function between(a, b) {
  const r = a.clone(); const bb = b.clone(); bb.reverse();
  r.join(bb); r.closePath(); r.closed = true; bb.remove();
  return r;
}

const U = (a, b) => a.unite(b);
const I = (a, b) => a.intersect(b);
const S = (a, b) => a.subtract(b);

function d(item, prec = 2) {
  // absolute-ish clean path data with fixed precision
  return item.getPathData ? item.getPathData(null, prec) : item.pathData;
}
function bounds(items) {
  let b = null; for (const it of items) { const ib = it.bounds; b = b ? b.unite(ib) : ib.clone(); } return b;
}
module.exports = { paper, P, circle, rect, fromD, poly, curve, between, U, I, S, d, bounds };
