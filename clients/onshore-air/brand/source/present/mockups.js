// Pure SVG/HTML/CSS mockups. Each takes a concept build result r = { cfg, files, P }.
const { inline, nest, outline, textSVG, svgData } = require('./parts');
const BIZ = { phone: '0444 541 409', email: 'onshoreair@outlook.com', web: 'onshoreair.com.au', arc: 'AU067414', place: 'Pacific Paradise QLD 4564' };
let n = 0;

/* ---------------- Van side panel (white LWB van, facing left) ---------------- */
function fitOutline(font, str, cap, maxW, o) {
  let t = outline(font, str, cap, o);
  if (t.w > maxW) t = outline(font, str, cap * maxW / t.w, o);
  return t;
}
function van(r) {
  n++; const id = 'v' + n;
  const P = r.P.colour, navy = P.navy, F = r.cfg.fonts;
  const body = 'M84,410 L72,336 Q70,306 90,296 L140,268 Q170,256 222,246 L238,240 Q256,200 276,160 L292,124 Q302,98 336,98 L1012,96 Q1036,96 1037,120 L1042,392 Q1042,410 1024,410 L912.45,410 A64,64 0 0 0 787.55,410 L312.45,410 A64,64 0 0 0 187.55,410 Z';
  const wheel = cx => `<g><circle cx="${cx}" cy="424" r="55" fill="#17181b"/><circle cx="${cx}" cy="424" r="34" fill="#cfd4da"/><circle cx="${cx}" cy="424" r="27" fill="#aab0b8"/>${[0, 72, 144, 216, 288].map(a => { const t = a * Math.PI / 180; return `<circle cx="${(cx + 16 * Math.cos(t)).toFixed(1)}" cy="${(424 + 16 * Math.sin(t)).toFixed(1)}" r="3.2" fill="#7b828c"/>`; }).join('')}<circle cx="${cx}" cy="424" r="8" fill="#8c939c"/></g>`;
  const well = cx => `<circle cx="${cx}" cy="424" r="63" fill="#24272d"/>`;
  // cargo panel copy: logo, phone, web (all above the gold stripe at y=331)
  const logo = nest(r.files['horizontal.svg'], 737, 112, { w: 450, anchor: 'middle' });
  const phone = fitOutline(F.name, BIZ.phone, 36, 400, { x: 737, y: 112 + logo.h + 52, fill: navy, anchor: 'middle', tracking: 30 });
  const web = fitOutline(F.desc, BIZ.web.toUpperCase(), 12, 300, { x: 737, y: 112 + logo.h + 78, fill: P.desc, anchor: 'middle', tracking: 240 });
  // skirt copy between the wheel arches (x 330..770)
  const services = fitOutline(F.desc, 'INSTALLATIONS · REPAIRS · MAINTENANCE · HYDRO CLEANING', 11, 430, { x: 550, y: 380, fill: '#FFFFFF', anchor: 'middle', tracking: 140 });
  // cab door: icon + licence, between window bottom (240) and stripe (331)
  const doorIcon = nest(r.files['icon.svg'], 352, 276, { w: 50, anchor: 'center' });
  const lic = fitOutline(F.desc, 'ARC ' + BIZ.arc, 8, 120, { x: 352, y: 318, fill: navy, anchor: 'middle', tracking: 140 });
  return `<svg class="mock-van" viewBox="0 0 1100 500" role="img" aria-label="${r.cfg.title} concept on a white van side panel">
  <defs>
    <clipPath id="${id}c"><path d="${body}"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".72" stop-color="#f4f6f8"/><stop offset="1" stop-color="#dfe3e8"/></linearGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4a5e"/><stop offset=".55" stop-color="#1f2a38"/><stop offset="1" stop-color="#2c3a4c"/></linearGradient>
    <filter id="${id}s" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <ellipse cx="560" cy="478" rx="520" ry="16" fill="#000" opacity=".22" filter="url(#${id}s)"/>
  ${well(250)}${well(850)}
  <path d="${body}" fill="url(#${id}g)" stroke="#c9ced5" stroke-width="2"/>
  <g clip-path="url(#${id}c)">
    <rect x="0" y="338" width="1100" height="90" fill="${navy}"/>
    <rect x="0" y="331" width="1100" height="5" fill="${P.sun}"/>
    <path d="M60,346 L190,346 L190,420 L60,420 Z" fill="#1d2026" opacity=".55"/>
    ${services.path}
  </g>
  <path d="M226,246 L292,112 Q298,102 312,102 L262,244 Z" fill="url(#${id}w)"/>
  <path d="M312,118 L452,116 L454,236 L270,238 Z" fill="url(#${id}w)"/>
  <path d="M330,120 L380,119 L300,236 L280,236 Z" fill="#ffffff" opacity=".08"/>
  <path d="M464,104 L464,328 M226,252 L222,328 M700,104 L700,328 M1010,108 L1012,328" stroke="#e2e6eb" stroke-width="1.6" fill="none"/>
  <rect x="428" y="262" width="26" height="7" rx="3" fill="#c3c9d0"/>
  <rect x="246" y="194" width="20" height="32" rx="6" fill="#1f2430"/><path d="M262,214 L276,220" stroke="#1f2430" stroke-width="5"/>
  <path d="M90,296 L140,270 L156,284 L104,306 Q94,308 90,302 Z" fill="#eef2f6" stroke="#9aa4b0" stroke-width="2"/>
  <path d="M76,312 L118,308 L120,328 L78,332 Z" fill="#2a2f37"/>
  <rect x="1028" y="132" width="11" height="112" rx="4" fill="#c4332b"/>
  ${wheel(250)}${wheel(850)}
  ${logo.svg}
  ${phone.path}${web.path}
  ${doorIcon.svg}${lic.path}
</svg>`;
}

/* ---------------- Navy polo with small mono-white chest crest ---------------- */
function polo(r) {
  n++; const id = 'p' + n;
  const base = '#16244b', dark = '#0f1a38', light = '#203260';
  const crest = nest(r.files['mono-white.svg'], 290, 140, { w: 64, anchor: 'center' });
  return `<svg class="mock-polo" viewBox="0 0 420 460" role="img" aria-label="${r.cfg.title} concept embroidered on a navy polo">
  <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark}"/><stop offset=".25" stop-color="${base}"/><stop offset=".75" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <filter id="${id}s"><feGaussianBlur stdDeviation="6"/></filter></defs>
  <ellipse cx="210" cy="446" rx="150" ry="8" fill="#000" opacity=".18" filter="url(#${id}s)"/>
  <path d="M150,38 C130,44 100,50 78,58 L18,118 Q10,128 18,138 L58,186 Q66,192 74,184 L96,160 L100,430 Q210,446 320,430 L324,160 L346,184 Q354,192 362,186 L402,138 Q410,128 402,118 L342,58 C320,50 290,44 270,38 Q210,62 150,38 Z" fill="url(#${id}g)"/>
  <path d="M18,138 L58,186 Q66,192 74,184 L80,177 L26,120 Z" fill="${dark}" opacity=".6"/>
  <path d="M402,138 L362,186 Q354,192 346,184 L340,177 L394,120 Z" fill="${dark}" opacity=".6"/>
  <path d="M96,160 Q102,300 100,430" stroke="${dark}" stroke-width="3" fill="none" opacity=".5"/>
  <path d="M324,160 Q318,300 320,430" stroke="${dark}" stroke-width="3" fill="none" opacity=".5"/>
  <path d="M150,38 Q210,20 270,38 Q210,52 150,38 Z" fill="${dark}"/>
  <rect x="198" y="58" width="24" height="96" rx="3" fill="${base}" stroke="${dark}" stroke-width="2"/>
  <circle cx="210" cy="86" r="3.6" fill="#d9dde3"/><circle cx="210" cy="112" r="3.6" fill="#d9dde3"/><circle cx="210" cy="138" r="3.6" fill="#d9dde3"/>
  <path d="M150,38 Q170,56 204,98 L192,108 Q160,90 128,72 L130,52 Z" fill="${light}" stroke="${dark}" stroke-width="1.5"/>
  <path d="M270,38 Q250,56 216,98 L228,108 Q260,90 292,72 L290,52 Z" fill="${light}" stroke="${dark}" stroke-width="1.5"/>
  <path d="M120,300 Q160,320 150,380 M300,260 Q270,300 286,360" stroke="${dark}" stroke-width="10" fill="none" opacity=".25" stroke-linecap="round"/>
  ${crest.svg}
</svg>`;
}

/* ---------------- Google Business Profile card ---------------- */
function gbp(r) {
  const star = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path fill="#F5B301" d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/></svg>';
  const btn = (label, d) => `<div class="gbtn"><span class="gic"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${d}" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${label}</div>`;
  return `<div class="gbp" role="img" aria-label="${r.cfg.title} concept as a Google Business Profile avatar">
    <div class="gcover"><div class="gsun" style="background:${r.P.colour.sun}"></div></div>
    <div class="gav">${inline(r.files['icon-app.svg'], { cls: 'gavimg' })}</div>
    <div class="gbody">
      <div class="gname">Onshore Air</div>
      <div class="grate"><b>5.0</b> ${star.repeat(5)} <span>(14)</span></div>
      <div class="gcat">Air conditioning contractor · Pacific Paradise</div>
      <div class="gopen"><b>Open</b> · Closes 5 pm</div>
      <div class="gbtns">${btn('Directions', 'M12 2l8 8-8 8-8-8z M9 13v-3h5M12 7l2 3-2 3')}${btn('Call', 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2')}${btn('Website', 'M12 3a9 9 0 100 18 9 9 0 000-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18')}${btn('Save', 'M6 3h12v18l-6-4-6 4z')}</div>
      <div class="gmaps"><span class="gpin">${inline(r.files['icon-app.svg'], { cls: 'gpinimg' })}</span> How it shows as a Maps result at 32 px</div>
    </div>
  </div>`;
}

/* ---------------- Phone with website header ---------------- */
function phone(r) {
  const P = r.P.colour, F = r.cfg.fonts;
  const h1 = textSVG(F.name, 'COOL, CLEAN AIR', 17, '#FFFFFF', { tracking: 40, maxW: 236 });
  const h2 = textSVG(F.name, 'FOR THE', 17, P.sun, { tracking: 40, maxW: 236 });
  const h3 = textSVG(F.name, 'SUNSHINE COAST', 17, P.sun, { tracking: 40, maxW: 236 });
  const status = '<svg width="58" height="12" viewBox="0 0 58 12" aria-hidden="true"><g fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1"/><path d="M27 4.2a8 8 0 0110 0l-1.3 1.4a6 6 0 00-7.4 0zM29.4 6.8a4.4 4.4 0 015.2 0L32 9.6z"/><rect x="40" y="1.5" width="15" height="9" rx="2.5" fill="none" stroke="#fff" stroke-width="1.2"/><rect x="41.8" y="3.2" width="10.5" height="5.6" rx="1.3"/><rect x="56" y="4.5" width="1.6" height="3" rx=".8"/></g></svg>';
  return `<div class="phone" role="img" aria-label="${r.cfg.title} concept in a mobile website header">
    <div class="pscreen">
      <div class="pstatus" style="background:${r.P.navy}"><span>9:41</span>${status}</div>
      <div class="phead" style="background:${r.P.navy}">${inline(r.files['horizontal-compact-on-navy.svg'], { cls: 'plogo' })}<div class="pburger"><i></i><i></i><i></i></div></div>
      <div class="phero" style="background:${r.P.navy}">
        ${h1}${h2}${h3}
        <p>Installs, repairs, maintenance and hydro cleaning from Caloundra to Noosa.</p>
        <div class="pcta" style="background:${P.sun};color:${r.P.navy}">Call ${BIZ.phone}</div>
        <div class="ptrust">★ 5.0 Google · 15+ yrs · ARC ${BIZ.arc}</div>
      </div>
      <div class="pcards"><div><b>Installations</b><i></i><i class="s"></i></div><div><b>Hydro cleaning</b><i></i><i class="s"></i></div></div>
    </div>
  </div>`;
}

/* ---------------- Business card front / back ---------------- */
function card(r) {
  const P = r.P.colour, F = r.cfg.fonts, on = r.P.onNavy;
  const t = (s, cap, fill, tr = 0, font = F.desc) => textSVG(font, s, cap, fill, { tracking: tr });
  return `<div class="cards" role="img" aria-label="${r.cfg.title} concept on a business card, front and back">
    <div class="bcard front">${inline(r.files['primary-stacked.svg'], { cls: 'bclogo' })}</div>
    <div class="bcard back" style="background:${r.P.navy}">
      <div class="bcl">
        ${t('LUKE', 15, '#FFFFFF', 60, F.name)}
        <div style="height:8px"></div>${t('OWNER · LICENSED TECHNICIAN', 6.5, on.desc, 160)}
        <div style="height:18px"></div>${t(BIZ.phone, 10, '#FFFFFF', 40, F.name)}
        <div style="height:9px"></div>${t(BIZ.email, 7, '#FFFFFF', 20)}
        <div style="height:7px"></div>${t(BIZ.web, 7, '#FFFFFF', 20)}
        <div style="height:14px"></div>${t('ARC LICENCE ' + BIZ.arc + ' · ' + BIZ.place.toUpperCase(), 5, '#AFC1E6', 120)}
      </div>
      ${inline(r.files['icon-on-navy.svg'], { cls: 'bcicon' })}
    </div>
  </div>`;
}

/* ---------------- Browser tabs with favicons (all concepts in one window) ---------------- */
function tabs(rs, dark = false) {
  const tab = (r, active) => `<div class="tab ${active ? 'on' : ''}"><img src="${svgData(dark ? r.files['_favicon-dark-preview'] : r.files['favicon.svg'])}" width="16" height="16" alt="${r.cfg.title} favicon"><span>Onshore Air | ${r.cfg.title}</span><b>×</b></div>`;
  return `<div class="browser ${dark ? 'dark' : ''}">
    <div class="tabbar"><div class="dots"><i></i><i></i><i></i></div>${rs.map((r, i) => tab(r, i === 0)).join('')}<div class="tab ghost"><span>Air conditioning Sunsh…</span></div></div>
    <div class="toolbar"><span class="nav">‹ › ↻</span><div class="url"><svg class="lock" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="5" width="8" height="6.5" rx="1.4" fill="currentColor"/><path d="M3 5V3.6a2 2 0 014 0V5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg> onshoreair.com.au</div></div>
  </div>`;
}

module.exports = { van, polo, gbp, phone, card, tabs, BIZ };
