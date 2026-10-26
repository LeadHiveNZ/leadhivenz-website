// Geometry helpers for the logo rebuild: Clipper (integer, robust) for booleans and offsets,
// paper.js only to turn dense polygons into smooth cubic Béziers for compact, clean SVG paths.
const ClipperLib = require('clipper-lib');
const paper = require('paper/dist/paper-core.js');

if (!paper.project) paper.setup(new paper.Size(2000, 2000));
const SCALE = 1000; // Clipper works on integers: 0.001 px precision

const toC = (polys) => polys.map((p) => p.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) })));
const fromC = (paths) => paths.map((p) => p.map((q) => [q.X / SCALE, q.Y / SCALE]));

function clip(op, subj, clipPolys) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(toC(subj), ClipperLib.PolyType.ptSubject, true);
  if (clipPolys) c.AddPaths(toC(clipPolys), ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  const type = { union: ClipperLib.ClipType.ctUnion, intersect: ClipperLib.ClipType.ctIntersection, difference: ClipperLib.ClipType.ctDifference, xor: ClipperLib.ClipType.ctXor }[op];
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return fromC(out);
}
const union = (a, b) => clip('union', a, b);
const intersect = (a, b) => clip('intersect', a, b);
const difference = (a, b) => clip('difference', a, b);

// Offset (dilate when delta > 0, erode when delta < 0). join: 'round' | 'miter' | 'square'.
function offset(polys, delta, join = 'round', miterLimit = 2) {
  const co = new ClipperLib.ClipperOffset(miterLimit, 0.02 * SCALE); // arc tolerance 0.02 px
  const jt = { round: ClipperLib.JoinType.jtRound, miter: ClipperLib.JoinType.jtMiter, square: ClipperLib.JoinType.jtSquare }[join];
  co.AddPaths(toC(polys), jt, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * SCALE);
  return fromC(out);
}
// Offset open polylines (centrelines) into closed regions; end: 'butt' | 'square' | 'round'.
function offsetOpen(lines, delta, join = 'miter', end = 'butt', miterLimit = 4) {
  const co = new ClipperLib.ClipperOffset(miterLimit, 0.02 * SCALE);
  const jt = { round: ClipperLib.JoinType.jtRound, miter: ClipperLib.JoinType.jtMiter, square: ClipperLib.JoinType.jtSquare }[join];
  const et = { butt: ClipperLib.EndType.etOpenButt, square: ClipperLib.EndType.etOpenSquare, round: ClipperLib.EndType.etOpenRound }[end];
  co.AddPaths(toC(lines), jt, et);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * SCALE);
  return fromC(out);
}
// Morphological opening: rounds every convex corner to radius r and drops slivers thinner than 2r.
const roundCorners = (polys, r) => offset(offset(polys, -r, 'round'), r, 'round');

// Polygon helpers
const circle = (cx, cy, r, step = 0.6) => {
  const n = Math.max(64, Math.ceil((2 * Math.PI * r) / step));
  return [Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)])];
};
const area = (polys) => polys.reduce((s, p) => s + ClipperLib.Clipper.Area(toC([p])[0]) / (SCALE * SCALE), 0);

// paper.js item (Path/CompoundPath) or SVG path data -> polygons
function flattenPathData(d, tol = 0.05) {
  const item = new paper.CompoundPath({ pathData: d, insert: false });
  item.flatten(tol);
  const kids = item.children && item.children.length ? item.children : [item];
  return kids.map((c) => c.segments.map((s) => [s.point.x, s.point.y])).filter((p) => p.length > 2);
}

// Polygons -> SVG path data with corner-aware curve fitting. Rings are split at real corners (turn > 35°
// over ~1 px), each smooth run is fitted with cubic Béziers (paper.js PathFitter) and checked against the
// polygon; any run whose fit drifts more than 3x tol is emitted as a polyline instead, so shapes never distort.
const fmt = (n) => { const v = Math.round(n * 100) / 100; return Object.is(v, -0) ? '0' : String(v); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function dedupe(pts, eps = 1e-3) {
  const out = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p);
  while (out.length > 2 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
}
function cornerIndices(pts, angleDeg = 35, reach = 1.0) {
  const n = pts.length, cand = [];
  const back = (i) => { let j = i, L = 0; while (L < reach) { const k = (j - 1 + n) % n; L += dist(pts[k], pts[j]); j = k; if (j === i) break; } return pts[j]; };
  const fwd = (i) => { let j = i, L = 0; while (L < reach) { const k = (j + 1) % n; L += dist(pts[k], pts[j]); j = k; if (j === i) break; } return pts[j]; };
  const turn = pts.map((p, i) => { const a = back(i), c = fwd(i); const d1 = [p[0] - a[0], p[1] - a[1]], d2 = [c[0] - p[0], c[1] - p[1]];
    return Math.abs(Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1])) * 180 / Math.PI; });
  for (let i = 0; i < n; i++) {
    if (turn[i] < angleDeg) continue;
    // keep only the sharpest vertex within the reach window
    let best = true;
    for (let j = 1; j < n; j++) { const k = (i + j) % n; if (dist(pts[k], pts[i]) > reach) break; if (turn[k] > turn[i]) { best = false; break; } }
    for (let j = 1; j < n && best; j++) { const k = (i - j + n) % n; if (dist(pts[k], pts[i]) > reach) break; if (turn[k] >= turn[i]) { best = false; break; } }
    if (best) cand.push(i);
  }
  return cand;
}
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const L2 = dx * dx + dy * dy; let t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function maxDeviation(path, run) {
  // sample the fitted path and measure the distance to the polyline run (both directions)
  let worst = 0;
  const L = path.length, n = Math.max(8, Math.ceil(L / 0.25));
  const poly = run;
  for (let i = 0; i <= n; i++) {
    const q = path.getPointAt((L * i) / n); if (!q) continue; const p = [q.x, q.y];
    let d = Infinity; for (let k = 0; k < poly.length - 1; k++) d = Math.min(d, segDist(p, poly[k], poly[k + 1]));
    worst = Math.max(worst, d);
  }
  return worst;
}
function fitRun(run, tol) {
  // returns SVG commands (without the initial M) from run[0] to run[last]
  const straight = run.every((p) => segDist(p, run[0], run[run.length - 1]) <= tol);
  if (run.length <= 2 || straight) { const e = run[run.length - 1]; return { cmds: `L${fmt(e[0])} ${fmt(e[1])}`, segs: 1 }; }
  const path = new paper.Path({ segments: run, insert: false });
  path.simplify(tol);
  if (maxDeviation(path, run) > 3 * tol) {
    if (run.length > 12) { const m = Math.floor(run.length / 2); const a = fitRun(run.slice(0, m + 1), tol), b = fitRun(run.slice(m), tol); return { cmds: a.cmds + b.cmds, segs: a.segs + b.segs }; }
    return { cmds: run.slice(1).map((p) => `L${fmt(p[0])} ${fmt(p[1])}`).join(''), segs: run.length - 1 };
  }
  let cmds = '';
  const segs = path.segments;
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1], b = segs[i];
    const c1 = a.point.add(a.handleOut), c2 = b.point.add(b.handleIn);
    if (a.handleOut.isZero() && b.handleIn.isZero()) cmds += `L${fmt(b.point.x)} ${fmt(b.point.y)}`;
    else cmds += `C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(b.point.x)} ${fmt(b.point.y)}`;
  }
  return { cmds, segs: segs.length - 1 };
}
function toPathData(polys, { smooth = true, tol = 0.05, transform = (p) => p } = {}) {
  const parts = [];
  for (const poly of polys) {
    const pts = dedupe(poly.map(transform));
    if (pts.length < 3) continue;
    if (!smooth) { parts.push('M' + pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L') + 'Z'); continue; }
    let corners = cornerIndices(pts);
    if (corners.length === 0) { // smooth closed ring: split into 4 runs
      const n = pts.length; corners = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4)];
    }
    const n = pts.length; let d = `M${fmt(pts[corners[0]][0])} ${fmt(pts[corners[0]][1])}`;
    for (let c = 0; c < corners.length; c++) {
      const i0 = corners[c], i1 = corners[(c + 1) % corners.length];
      const run = []; let i = i0; do { run.push(pts[i]); i = (i + 1) % n; } while (i !== i1); run.push(pts[i1]);
      d += fitRun(run, tol).cmds;
    }
    parts.push(d + 'Z');
  }
  return parts.join('');
}

// Scale + translate absolute SVG path data (M/L/C/Q/Z only, as emitted here and by opentype.js).
function transformPathData(d, s, tx, ty) {
  let i = 0;
  return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (m) => { const v = parseFloat(m); const out = i % 2 === 0 ? v * s + tx : v * s + ty; i++; return fmt(out); });
}

module.exports = { transformPathData, paper, union, intersect, difference, offset, offsetOpen, roundCorners, circle, area, flattenPathData, toPathData, fmt };
