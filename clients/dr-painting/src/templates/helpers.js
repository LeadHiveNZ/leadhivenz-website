'use strict';
/* Shared helpers for the templates: escaping, icons, image slots, hours, URLs. */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M20 6 9 17l-5-5',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  clip: 'M9 3h6v3H9zM9 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-3M9 12h6M9 16h4',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  roller: 'M4 3h13a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM18 5.5h2a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1h-8.5v3.5M10 14.5h3v7h-3z',
  roof: 'M2 12 12 4l10 8M5 10v10h14V10M9 20v-5h6v5',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 7h3M8 11h3M8 15h3',
  brush: 'M9.1 14.9 3 21M14 4l6 6-7.6 7.6a2 2 0 0 1-2.8 0l-3.2-3.2a2 2 0 0 1 0-2.8zM17 1l6 6',
  fence: 'M4 21V7l2-3 2 3v14M16 21V7l2-3 2 3v14M10 21V7l2-3 2 3v14M2 10h20M2 17h20',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  quote: 'M3 21c3 0 7-1 7-8V5H3v8h4c0 4-2 5-4 5zM14 21c3 0 7-1 7-8V5h-7v8h4c0 4-2 5-4 5z'
};
const icon = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[n] || ''}"/></svg>`;
const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
const arrow = icon('arrow', 'arrow');

/* Image slot: a .ph box that site.js fills with an <img> (unless ?placeholders=1).
   opts: alt, cls, icon, w, h, widths[], sizes, eager, attrs (extra raw attributes) */
function slot(key, opts) {
  opts = opts || {};
  const a = [`class="ph${opts.cls ? ' ' + opts.cls : ''}"`, `data-img="${esc(key)}"`];
  if (opts.alt) a.push(`data-alt="${esc(opts.alt)}"`);
  if (opts.w) a.push(`data-w="${opts.w}"`, `data-h="${opts.h}"`);
  if (opts.widths) a.push(`data-widths="${opts.widths.join(',')}"`);
  if (opts.sizes) a.push(`data-sizes="${esc(opts.sizes)}"`);
  if (opts.eager) a.push('data-eager');
  if (opts.attrs) a.push(opts.attrs);
  const ic = opts.icon ? `<span class="ph__icon">${icon(opts.icon)}</span>` : '';
  return `<div ${a.join(' ')}>${ic}</div>`;
}

const tel = (C) => `tel:${C.business.phoneTel}`;
const telAttr = (C) => `href="${esc(tel(C))}" data-tel`;
const phone = (C) => `<span data-bind="business.phoneDisplay">${esc(C.business.phoneDisplay)}</span>`;

const serviceFile = (s) => `${s.slug}.html`;
const serviceName = (s) => s.name || s.title;
const absUrl = (C, file) => C.business.url + (file === 'index.html' ? '' : file);
const ogImg = (C, key) => (C.IMG[key] || C.IMG.hero).replace(/([?&])w=\d+/, '$1w=1200&h=630');

/* Hours */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DNAME = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const DFULL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const SCHEMA_D = { mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa', sun: 'Su' };
const fmtT = (t) => { const [h, m] = t.split(':').map(Number); const s = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; return hh + (m ? ':' + String(m).padStart(2, '0') : '') + s; };
function hourGroups(C) {
  const g = [];
  DAYS.forEach((d) => {
    const v = C.hours[d]; const key = v ? v.join('-') : 'closed';
    const lastG = g[g.length - 1];
    if (lastG && lastG.key === key) lastG.days.push(d); else g.push({ key, v, days: [d] });
  });
  return g.map((x) => Object.assign(x, {
    label: x.days.length > 1 ? `${DNAME[x.days[0]]}–${DNAME[x.days[x.days.length - 1]]}` : DNAME[x.days[0]],
    time: x.v ? fmtT(x.v[0]) + '–' + fmtT(x.v[1]) : 'Closed'
  }));
}

const allTowns = (C) => C.areas.flatMap((a) => a.towns.map((t) => Object.assign({ region: a.region }, t)));

/* Claims: only the ones switched on in CONFIG.claims */
function claimList(C) {
  const cl = C.claims, out = [];
  if (cl.guarantee) out.push(['shield', cl.guarantee]);
  if (cl.masterPainters) out.push(['award', 'Master Painters NZ member']);
  if (cl.dulux) out.push(['award', 'Dulux Accredited Painter']);
  if (cl.resene) out.push(['award', 'Resene approved']);
  if (cl.siteSafe) out.push(['shield', 'Site Safe certified']);
  if (cl.insured) out.push(['shield', cl.insuranceText || 'Fully insured']);
  if (cl.googleRating && cl.googleReviewCount) out.push(['award', `${cl.googleRating} stars from ${cl.googleReviewCount} Google reviews`]);
  return out;
}

module.exports = { esc, ICONS, icon, star, arrow, slot, tel, telAttr, phone, serviceFile, serviceName, absUrl, ogImg, DAYS, DFULL, SCHEMA_D, hourGroups, allTowns, claimList };
