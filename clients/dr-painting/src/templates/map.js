'use strict';
/* Stylised travel map (inline SVG) built from town coordinates in CONFIG.areas / CONFIG.map. */
const { esc, allTowns } = require('./helpers');

module.exports = function travelMap(C) {
  const m = C.map, b = m.bounds;
  const midLat = (b.north + b.south) / 2;
  const ky = 340, kx = ky * Math.cos(midLat * Math.PI / 180);
  const W = Math.round((b.east - b.west) * kx), H = Math.round((b.north - b.south) * ky);
  const P = (lng, lat) => [+((lng - b.west) * kx).toFixed(1), +((b.north - lat) * ky).toFixed(1)];
  const pts = m.coast.map(([lng, lat]) => P(lng, lat));
  // Catmull-Rom -> cubic bezier for a smooth coastline
  let coast = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    coast += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  const last = pts[pts.length - 1];
  const ocean = `${coast}L${last[0]} ${H}L0 ${H}L0 0L${pts[0][0]} 0Z`;
  const towns = allTowns(C);
  const hub = towns.find((t) => t.hub) || towns[0];
  const [hx, hy] = P(hub.lng, hub.lat);
  const kmPx = ky / 111;
  const rings = (m.rings || []).map((km) => `<circle class="ring" cx="${hx}" cy="${hy}" r="${(km * kmPx).toFixed(1)}"/><text class="ringlab" x="${hx + km * kmPx * 0.7071 + 6}" y="${hy - km * kmPx * 0.7071}">${km} km</text>`).join('');
  const routes = towns.filter((t) => !t.hub).map((t) => { const [x, y] = P(t.lng, t.lat); const mx = (hx + x) / 2, my = (hy + y) / 2 - Math.hypot(x - hx, y - hy) * 0.12; return `<path class="route" d="M${hx} ${hy}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x} ${y}"/>`; }).join('');
  const lab = (t, x, y) => {
    const o = { r: [x + 11, y + 6, 'start'], l: [x - 11, y + 6, 'end'], t: [x, y - 13, 'middle'], b: [x, y + 26, 'middle'] }[t.lab || 'r'];
    return `<text class="${t.hub ? 'hublab' : 'lab'}" x="${o[0]}" y="${t.hub ? o[1] + 6 : o[1]}" text-anchor="${o[2]}">${esc(t.n)}</text>`;
  };
  const dots = towns.map((t) => { const [x, y] = P(t.lng, t.lat); return t.hub
    ? `<g class="town" data-town="${esc(t.n)}"><circle class="pulse" cx="${x}" cy="${y}" r="10"/><circle class="hub" cx="${x}" cy="${y}" r="9"/><circle fill="#101317" cx="${x}" cy="${y}" r="3.5"/>${lab(t, x, y)}</g>`
    : `<g class="town" data-town="${esc(t.n)}"><circle class="dot" cx="${x}" cy="${y}" r="5"/>${lab(t, x, y)}</g>`; }).join('');
  let peak = '';
  if (m.peak) { const [px, py] = P(m.peak.lng, m.peak.lat); peak = [34, 22, 11].map((r) => `<circle class="mt" cx="${px}" cy="${py}" r="${r}"/>`).join('') + `<path d="M${px - 7} ${py + 4}L${px} ${py - 7}L${px + 7} ${py + 4}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-linejoin="round"/><text class="mtlab" x="${px}" y="${py - 42}" text-anchor="middle">${esc(m.peak.n)}</text>`; }
  return `<svg class="rmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of our travel area: based in ${esc(hub.n)}, covering ${towns.length - 1} towns across Manawatū and South Taranaki">
      <defs><pattern id="sea" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 11.5h12" stroke="rgba(255,255,255,.035)"/></pattern></defs>
      <path class="ocean" d="${ocean}"/><path d="${ocean}" fill="url(#sea)"/><path class="coast" d="${coast}"/>
      <text class="sealab" x="${W * 0.12}" y="${H * 0.82}">TASMAN SEA</text>
      ${rings}${peak}${routes}${dots}</svg>`;
};
