'use strict';
/* Page shell shared by every page: <head>, logo symbol, header, mobile menu, footer, mobile bar, scripts. */
const H = require('./helpers');
const { esc, icon, arrow, telAttr, phone } = H;
const S = require('./schema');

const LOGO_SYMBOL = `<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true" focusable="false">
  <symbol id="dr-mark" viewBox="0 0 162 78">
    <path fill="#9aa1a9" d="M98 56C122 58 144 48 158 22C152 50 124 68 98 68Z"/>
    <path fill="#5fbf47" stroke="#f6f3ed" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke" d="M102 66C126 68 148 60 161 40C153 62 128 74 102 71Z"/>
    <g transform="translate(15.3 0) skewX(-12)">
      <path fill="#333a44" fill-rule="evenodd" d="M0 3H30C52 3 62 17 62 37.5C62 58 52 72 30 72H0Z M17 17.5H29C39 17.5 44.5 24 44.5 37.5C44.5 51 39 57.5 29 57.5H17Z"/>
      <path fill="#5fbf47" fill-rule="evenodd" stroke="#f6f3ed" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke" d="M58 3H88C104 3 112 13 112 26C112 36.5 106.5 43.5 98 46.5L114 72H93.5L79 49H75V72H58Z M75 17.5V34.5H86.5C91.5 34.5 94.5 31.5 94.5 26C94.5 20.5 91.5 17.5 86.5 17.5Z"/>
    </g>
  </symbol>
</svg>`;

const logo = (C) => `<span class="brand__tile"><svg viewBox="0 0 162 78" role="img" aria-hidden="true" focusable="false"><use href="#dr-mark"/></svg></span><span class="brand__wm"><span class="wm">D<span class="bar">|</span><span class="g">R</span> Painting</span><span class="brand__sub">${esc(C.business.tagline)}</span></span>`;

function head(C, p) {
  const canonical = H.absUrl(C, p.file);
  const og = H.ogImg(C, p.img);
  return `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="theme-color" content="#101317">
${p.noindex ? '<meta name="robots" content="noindex">\n' : `<link rel="canonical" href="${esc(canonical)}">\n`}<meta property="og:type" content="website">
<meta property="og:locale" content="en_NZ">
<meta property="og:site_name" content="${esc(C.business.name)}">
<meta property="og:title" content="${esc(p.ogTitle || p.title)}">
<meta property="og:description" content="${esc(p.ogDescription || p.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://images.unsplash.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/site.css">
${p.jsonld && p.jsonld.length ? `<script type="application/ld+json">${S.toScript(p.jsonld)}</script>\n` : ''}<script>document.documentElement.classList.add('js')</script>
</head>`;
}

function navItems(C, p, mobile) {
  return C.nav.map((n) => {
    const cur = n.page === p.section;
    return `<li><a href="${esc(n.href)}"${cur ? ' class="is-active" aria-current="page"' : ''}${mobile ? ' data-close' : ''}>${esc(n.label)}</a></li>`;
  }).join('');
}

function header(C, p) {
  const home = p.key === 'home';
  return `
<!-- ============ HEADER ============ -->
<header class="hdr" id="hdr">
  <div class="wrap hdr__in">
    <a class="brand" href="${home ? '#top' : 'index.html'}" aria-label="${esc(C.business.name)}, ${home ? 'back to top' : 'home'}">${logo(C)}</a>
    <nav class="nav" aria-label="Main"><ul>${navItems(C, p)}</ul></nav>
    <div class="hdr__act">
      <a class="hdr__phone" ${telAttr(C)}>${icon('phone')}${phone(C)}</a>
      <a class="btn btn--green btn--sm hdr__cta" href="${p.q}">Get a free quote</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Open menu"><span></span><span></span></button>
    </div>
  </div>
</header>

<div class="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Menu">
  <ol>${navItems(C, p, true)}</ol>
  <div class="mnav__foot">
    <a class="status status--solid" data-status href="${p.q}"></a>
    <a class="btn btn--green btn--lg" href="${p.q}" data-close>Get a free quote</a>
    <a class="btn btn--ghost btn--lg" ${telAttr(C)}>${icon('phone')}Call ${phone(C)}</a>
  </div>
</div>`;
}

function footer(C, p) {
  const li = (href, label) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`;
  return `
<!-- ============ FOOTER ============ -->
<footer class="foot">
  <div class="wrap">
    <div class="foot__top">
      <div>
        <a class="brand" href="${p.key === 'home' ? '#top' : 'index.html'}" aria-label="${esc(C.business.name)}, ${p.key === 'home' ? 'back to top' : 'home'}">${logo(C)}</a>
        <p class="foot__blurb" data-bind="business.blurb">${esc(C.business.blurb)}</p>
        <a class="foot__tel" ${telAttr(C)}>${phone(C)}</a>
      </div>
      <div><h4>Explore</h4><ul>${C.nav.map((n) => li(n.href, n.label)).join('')}${li(p.q, 'Free quote')}</ul></div>
      <div><h4>Services</h4><ul>${C.services.map((s) => li(H.serviceFile(s), s.title)).join('')}</ul></div>
      <div><h4>Areas</h4><ul>${C.areas.map((a) => `<li>${esc(a.region)}</li>`).join('')}${li('areas.html', 'All towns we cover')}</ul></div>
      <div><h4>Hours</h4><ul>${H.hourGroups(C).map((g) => `<li>${g.label}: ${g.time}</li>`).join('')}<li style="color:var(--muted-d)">Messages outside hours answered first thing.</li></ul></div>
    </div>
    <div class="foot__big" aria-hidden="true">D<span class="g">|</span>R Painting</div>
    <div class="foot__bot">
      <span>&copy; <span data-year>${new Date().getFullYear()}</span> <span data-bind="business.name">${esc(C.business.name)}</span>. ${esc(C.business.town)}, New Zealand.</span>
      <span>Website by <a href="https://leadhivenz.com" rel="noopener">LeadHive NZ</a></span>
    </div>
  </div>
</footer>

<div class="mbar" data-mbar>
  <a class="btn btn--ghost" ${telAttr(C)}>${icon('phone')}Call</a>
  <a class="btn btn--green" href="${p.q}">Free quote ${arrow}</a>
</div>`;
}

/* p: { key, section, file, title, description, ogTitle?, ogDescription?, img, q, jsonld[], noindex?, main, after? } */
function layout(C, p) {
  return `${head(C, p)}
<body>
<a class="skip" href="#main">Skip to content</a>
${LOGO_SYMBOL}
${header(C, p)}

<main id="main">${p.main}
</main>${p.after || ''}
${footer(C, p)}

<script src="assets/config.js"></script>
<script src="assets/site.js"></script>
</body>
</html>
`;
}

module.exports = { layout, LOGO_SYMBOL };
