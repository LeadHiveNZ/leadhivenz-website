// Shared page shell and partials. Every page is rendered through page(), so the header, footer,
// call bar, form and schema stay identical across the site.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('./site');
const { icon } = require('./icons');

const SITE_DIR = path.resolve(__dirname, '..', '..', 'site');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));
const hashOf = (rel) => crypto.createHash('sha1').update(fs.readFileSync(path.join(SITE_DIR, rel))).digest('hex').slice(0, 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TEL = `tel:${S.phone.tel}`;
const PHONE = `<span data-phone-display>${S.phone.display}</span>`;
// Phone number for running text: non-breaking spaces so it never splits across lines
const NB_PHONE = S.phone.display.replace(/ /g, '\u00A0');
const YEAR = 2026;

/* ---------- images ---------- */
function picture(name, { alt, sizes, eager = false, priority = false, cls = '', imgCls = '' }) {
  const m = manifest[name];
  if (!m) throw new Error(`image "${name}" missing from image-manifest.json (run node images.js)`);
  const set = (ext) => m.widths.map((w) => `/assets/img/${name}-${w}.${ext} ${w}w`).join(', ');
  const fallback = m.widths[m.widths.length > 2 ? 1 : 0];
  const loading = eager ? (priority ? ' fetchpriority="high"' : '') : ' loading="lazy"';
  return `<picture${cls ? ` class="${cls}"` : ''}><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="/assets/img/${name}-${fallback}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt)}"${loading} decoding="async"${imgCls ? ` class="${imgCls}"` : ''}></picture>`;
}
function preloadImage(name, sizes) {
  const m = manifest[name];
  const set = m.widths.map((w) => `/assets/img/${name}-${w}.webp ${w}w`).join(', ');
  return `<link rel="preload" as="image" type="image/webp" imagesrcset="${set}" imagesizes="${sizes}" fetchpriority="high">`;
}
// Vector logo (site-tools/logo/build-logo.js). Intrinsic sizes come from each SVG's viewBox.
const svgSize = (file) => {
  const m = fs.readFileSync(path.join(SITE_DIR, 'assets', 'img', file), 'utf8').match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return { w: Math.round(parseFloat(m[1])), h: Math.round(parseFloat(m[2])) };
};
// ?v=content-hash: /assets/* is cached for a year (immutable), so a changed logo gets a new URL
const LOGO = { stacked: { src: `/assets/img/logo.svg?v=${hashOf('assets/img/logo.svg')}`, ...svgSize('logo.svg') }, horizontal: { src: `/assets/img/logo-horizontal.svg?v=${hashOf('assets/img/logo-horizontal.svg')}`, ...svgSize('logo-horizontal.svg') } };
// Header lockup: stacked on phones (it fits the 390 px header with the phone button), horizontal from 1240 px.
const HEADER_HORIZONTAL_FROM = process.env.HEADER_LOCKUP === 'stacked' ? null : 1240;
const logo = (cls = '', eager = true) => `<img class="${cls}" src="${LOGO.stacked.src}" width="${LOGO.stacked.w}" height="${LOGO.stacked.h}" alt="Onshore Air"${eager ? '' : ' loading="lazy"'} decoding="async">`;
const headerLogo = () => HEADER_HORIZONTAL_FROM
  ? `<picture class="brand-logo"><source media="(min-width: ${HEADER_HORIZONTAL_FROM}px)" srcset="${LOGO.horizontal.src}" width="${LOGO.horizontal.w}" height="${LOGO.horizontal.h}"><img src="${LOGO.stacked.src}" width="${LOGO.stacked.w}" height="${LOGO.stacked.h}" alt="Onshore Air" decoding="async"></picture>`
  : `<picture class="brand-logo">${logo()}</picture>`;

/* ---------- small pieces ---------- */
const callBtn = (cls = '', label = '') => `<a class="btn btn-call ${cls}" href="${TEL}" data-phone-link>${icon('phone')}<span>${label ? `<span class="call-word">${label} </span>` : ''}${PHONE}</span></a>`;
const quoteBtn = (cls = 'btn-ghost', href = '#quote', label = 'Get a free quote') => `<a class="btn ${cls}" href="${href}">${label}</a>`;
const status = (cls = '') => `<p class="status${cls ? ' ' + cls : ''}" data-status><span class="status-dot" aria-hidden="true"></span><span class="status-text">${S.hoursShort} · answered by ${S.owner}</span></p>`;
const checklist = (items, cls = '') => `<ul class="checklist${cls ? ' ' + cls : ''}">${items.map((t) => `<li><span class="check">${icon('check')}</span><span>${t}</span></li>`).join('')}</ul>`;
const eyebrow = (t, cls = '') => `<p class="eyebrow${cls ? ' ' + cls : ''}">${t}</p>`;
const sectionHead = ({ eyebrow: e, title, lede, center = false, id, light = false }) =>
  `<div class="section-head${center ? ' section-head--center' : ''}">${e ? eyebrow(e, light ? 'eyebrow--light' : '') : ''}<h2${id ? ` id="${id}"` : ''}>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`;
const stars = () => `<span class="stars" aria-hidden="true">${icon('star').repeat(5)}</span>`;

/* ---------- header / footer / call bar ---------- */
function navLinks(current) {
  return S.nav.map((n) => `<li><a href="${n.href}"${n.href === current ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('');
}
function header(current) {
  return `<a class="skip-link" href="#main">Skip to content</a>
<span class="nb-source" id="nb-source" aria-hidden="true">${S.phone.display}</span>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/">${headerLogo()}<span class="visually-hidden"> home</span></a>
    <nav class="nav-desktop" aria-label="Main"><ul>${navLinks(current)}</ul></nav>
    <a class="btn btn-call header-call" href="${TEL}" data-phone-link>${icon('phone')}<span class="header-call-text">${PHONE}</span><span class="header-call-short" aria-hidden="true">Call</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu"><span class="visually-hidden">Menu</span>${icon('menu', 'icon-open')}${icon('close', 'icon-close')}</button>
  </div>
  <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">
    <div class="container">
      <ul>${navLinks(current)}</ul>
      ${callBtn('btn-lg btn-block', 'Call')}
      <p class="mobile-menu-hours">${icon('clock')}${S.hoursShort} · Sunday closed</p>
    </div>
  </nav>
</header>`;
}
function footer(quoteHref) {
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="footer-logo">${logo('', false)}<span class="visually-hidden"> home</span></a>
        <p>Air conditioning installs, repairs, hydro cleaning and servicing across the Sunshine Coast. Locally owned and operated from ${S.locality}.</p>
        <ul class="footer-badges"><li>${icon('star')}5.0 Google rating</li><li>${icon('shield')}Licensed &amp; insured</li></ul>
      </div>
      <nav class="footer-col" aria-label="Services"><h2>Services</h2><ul class="footer-links">${S.services.map((s) => `<li><a href="${s.href}">${s.label}</a></li>`).join('')}</ul></nav>
      <nav class="footer-col" aria-label="Company"><h2>Company</h2><ul class="footer-links"><li><a href="/about/">About Luke</a></li><li><a href="/service-areas/">Service areas</a></li><li><a href="/contact/">Contact</a></li><li><a href="${quoteHref}">Get a free quote</a></li></ul></nav>
      <div class="footer-col"><h2>Get in touch</h2>
        <ul class="footer-contact">
          <li>${icon('phone')}<a href="${TEL}" data-phone-link>${PHONE}</a></li>
          <li>${icon('mail')}<a href="mailto:${S.email}">${S.email}</a></li>
          <li>${icon('clock')}<span>${S.hoursShort}<br>Sunday closed</span></li>
          <li>${icon('pin')}<span>${S.locality} ${S.region} ${S.postcode}<br>Servicing the whole Sunshine Coast</span></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${YEAR} ${S.name}</p>
      <p>ABN ${S.abn}</p>
      <p>ARC licence ${S.licence}</p>
    </div>
  </div>
</footer>`;
}
const callBar = (quoteHref) => `<aside class="call-bar" aria-label="Quick contact">${callBtn('', 'Call')}${quoteBtn('btn-ghost', quoteHref, 'Free quote')}</aside>`;

/* ---------- sections ---------- */
function pageHero({ crumb, h1, lede, media = '', points = [], quoteHref = '#quote', cls = '' }) {
  return `<section class="page-hero${cls ? ' ' + cls : ''}">
  <div class="container page-hero-grid">
    <div class="page-hero-copy">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">${crumb}</span></li></ol></nav>
      ${status()}
      <h1>${h1}</h1>
      <p class="page-hero-lede">${lede}</p>
      <div class="hero-actions">${callBtn('btn-lg', 'Call')}${quoteBtn('btn-ghost btn-lg', quoteHref)}</div>
      ${points.length ? `<ul class="hero-points">${points.map((p) => `<li>${icon('check')}${p}</li>`).join('')}</ul>` : ''}
    </div>
    ${media ? `<div class="page-hero-media">${media}</div>` : ''}
  </div>
</section>`;
}

function trustStrip() {
  const items = [
    ['star', '5.0 Google rating', 'From local customers'],
    ['calendar', '15+ years experience', 'On the tools'],
    ['badge', `ARC licence ${S.licence}`, 'Refrigerant handling'],
    ['shield', 'Licensed &amp; insured', 'Covered on every job'],
    ['award', 'Workmanship guarantee', 'Luke backs his work'],
  ];
  return `<section class="trust" aria-label="Why you can trust Onshore Air">
  <div class="container"><ul class="trust-card">${items.map(([i, t, s]) => `<li class="trust-item"><span class="trust-icon">${icon(i)}</span><span><strong>${t}</strong><span>${s}</span></span></li>`).join('')}</ul></div>
</section>`;
}

function brandBadges(note = true) {
  const text = typeof note === 'string' ? note : `Plus servicing and cleaning for ${S.otherBrands} and most other major brands.`;
  return `<ul class="brands">${S.brands.map((b) => `<li class="brand-badge">${b}</li>`).join('')}</ul>${note ? `<p class="brands-note">${text}</p>` : ''}`;
}

function reviews({ title = 'Locals rate Luke 5.0 on Google', eyebrowText = 'Reviews', sand = true } = {}) {
  return `<section class="section${sand ? ' section--sand' : ''}" aria-labelledby="reviews-title">
  <div class="container">
    <div class="reviews-head">
      ${sectionHead({ eyebrow: eyebrowText, title, id: 'reviews-title' })}
      <p class="rating-summary"><span class="rating-score">5.0</span><span class="rating-meta">${stars()}<span>Google rating</span></span></p>
    </div>
    <div class="reviews">${S.reviews.map((r) => `<figure class="review">${icon('quote', 'review-quote')}${stars()}<blockquote><p>${r.text}</p></blockquote><figcaption><span class="avatar" aria-hidden="true">${r.name[0]}</span><span><span class="review-name">${r.name}</span><span class="review-src">Google review</span></span></figcaption></figure>`).join('')}</div>
  </div>
</section>`;
}

function route() {
  return `<ol class="route">${S.route.map((r) => r === S.locality
    ? `<li class="is-base"><span class="route-name">${r}</span><small>Home base</small></li>`
    : `<li><span class="route-name">${r}</span></li>`).join('')}</ol>`;
}

function ctaBand({ title, text, quoteHref = '#quote' }) {
  return `<div class="cta-band">
  <div class="cta-band-copy"><h2>${title}</h2><p>${text}</p></div>
  <div class="cta-band-actions">${callBtn('btn-lg', 'Call')}${quoteBtn('btn-ghost btn-lg', quoteHref)}</div>
</div>`;
}

function faq(items, { title = 'Questions people ask', eyebrowText = 'FAQ', sand = false } = {}) {
  return `<section class="section${sand ? ' section--sand' : ''}" aria-labelledby="faq-title">
  <div class="container">
    ${sectionHead({ eyebrow: eyebrowText, title, id: 'faq-title', center: true })}
    <div class="faq">${items.map(([q, a]) => `<details><summary><span>${q}</span><span class="faq-icon">${icon('plus')}</span></summary><div class="faq-answer"><p>${a}</p></div></details>`).join('')}</div>
  </div>
</section>`;
}

function steps(items) {
  return `<ol class="steps">${items.map(([t, d]) => `<li class="step"><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>`;
}

function iconCards(items, cls = '') {
  return `<ul class="icon-grid${cls ? ' ' + cls : ''}">${items.map(([i, t, d]) => `<li class="icon-card"><span class="ic">${icon(i)}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ul>`;
}

const SERVICE_OPTIONS = ['Installation', 'Repair', 'Hydro clean', 'Maintenance', 'Not sure'];
function quoteForm({ heading = 'Get a free quote', lede, service = '', source, aside = '' }) {
  const opts = SERVICE_OPTIONS.map((o) => `<option${o === service ? ' selected' : ''}>${o}</option>`).join('');
  return `<section class="section quote" id="quote" aria-labelledby="quote-title">
  <div class="container quote-grid">
    <div class="quote-aside">
      ${aside || `${eyebrow('Free quotes')}
      <h2 id="quote-title">${heading}</h2>
      <p class="lede">${lede || `Tell Luke what you need and he'll call you back to talk it through. Prefer to talk now? Call ${NB_PHONE}.`}</p>
      <div class="call-card">
        <p class="call-card-label">Talk to Luke directly</p>
        <a class="call-card-number" href="${TEL}" data-phone-link>${icon('phone')}${PHONE}</a>
        ${status('status--card')}
        <dl class="hours">${S.hours.map((h) => `<div><dt>${h.label}</dt><dd>${h.value}</dd></div>`).join('')}</dl>
      </div>`}
    </div>
    <div class="form-card">
      <form class="quote-form" name="quote" method="POST" data-netlify="true" netlify-honeypot="company" action="/thanks/">
        <input type="hidden" name="form-name" value="quote">
        <input type="hidden" name="page" value="${source}">
        <p class="hp" aria-hidden="true"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>
        <div class="form-grid">
          <div class="field">
            <label for="q-name">Your name</label>
            <input id="q-name" name="name" type="text" autocomplete="name" required minlength="2" aria-describedby="q-name-err">
            <p class="field-error" id="q-name-err">Please tell us your name.</p>
          </div>
          <div class="field">
            <label for="q-phone">Phone</label>
            <input id="q-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required pattern="[0-9 +\\(\\)\\-]{8,20}" aria-describedby="q-phone-err">
            <p class="field-error" id="q-phone-err">Please enter a phone number Luke can call you on.</p>
          </div>
          <div class="field">
            <label for="q-suburb">Suburb</label>
            <input id="q-suburb" name="suburb" type="text" autocomplete="address-level2" required aria-describedby="q-suburb-err">
            <p class="field-error" id="q-suburb-err">Which suburb is the job in?</p>
          </div>
          <div class="field">
            <label for="q-service">What do you need?</label>
            <div class="select"><select id="q-service" name="service" required aria-describedby="q-service-err"><option value="">Choose one</option>${opts}</select>${icon('chevron')}</div>
            <p class="field-error" id="q-service-err">Please choose the closest option.</p>
          </div>
          <div class="field field--full">
            <label for="q-message">Message <span class="opt">(optional)</span></label>
            <textarea id="q-message" name="message" rows="4" placeholder="The room, the brand of unit, what it's doing, best time to call…"></textarea>
          </div>
        </div>
        <button class="btn btn-navy btn-lg btn-block quote-submit" type="submit"><span>Send my request</span>${icon('arrow')}</button>
        <p class="form-note">${icon('shield')}Sent straight to Luke. No spam, ever.</p>
      </form>
    </div>
  </div>
</section>`;
}

/* ---------- schema ---------- */
function breadcrumbLd(name, p) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: S.origin + '/' },
      { '@type': 'ListItem', position: 2, name, item: S.origin + p },
    ],
  };
}

/* ---------- shell ---------- */
function page({ path: p, title, description, main, robots = 'index, follow', preload = '', jsonld = [], current, bodyClass = '', quoteHref = '#quote', ogTitle, canonical = true }) {
  const url = S.origin + p;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${url}">\n` : ''}<meta name="robots" content="${robots}">
<meta name="theme-color" content="#0C1D45">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${S.name}">
<meta property="og:locale" content="en_AU">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${url}">\n` : ''}<meta property="og:image" content="${S.origin}/assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Onshore Air logo over an aerial view of the Sunshine Coast">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/outfit-latin.woff2" as="font" type="font/woff2" crossorigin>
${preload ? preload + '\n' : ''}<link rel="stylesheet" href="/assets/css/site.css?v=${hashOf('assets/css/site.css')}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/assets/img/favicon.svg?v=${hashOf('assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<script src="/assets/js/site.js?v=${hashOf('assets/js/site.js')}" defer></script>
${ld ? ld + '\n' : ''}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${header(current)}
<main id="main">
${main}
</main>
${footer(quoteHref)}
${callBar(quoteHref)}
</body>
</html>
`;
}

module.exports = {
  S, icon, esc, TEL, PHONE, NB_PHONE, picture, preloadImage, logo, callBtn, quoteBtn, status, checklist, eyebrow, sectionHead, stars,
  pageHero, trustStrip, brandBadges, reviews, route, ctaBand, faq, steps, iconCards, quoteForm, breadcrumbLd, page,
};
