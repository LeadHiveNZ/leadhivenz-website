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
// Phone weight cap: below 600px every photo gets an extra WebP <source> listing only the widths up to PHONE_CAP, so a
// 3x phone downloads a ~900px file instead of the 1100-2000px desktop variants (no visible loss at phone size).
const PHONE_MEDIA = '(max-width: 599px)';
const PHONE_CAP = 900;
const widthsUpTo = (m, cap) => { const w = m.widths.filter((x) => x <= cap); return w.length ? w : [m.widths[0]]; };
const srcset = (name, widths, ext) => widths.map((w) => `/assets/img/${name}-${w}.${ext} ${w}w`).join(', ');
function picture(name, { alt, sizes, eager = false, priority = false, cls = '', imgCls = '', cap = PHONE_CAP }) {
  const m = manifest[name];
  if (!m) throw new Error(`image "${name}" missing from image-manifest.json (run node images.js)`);
  const fallback = m.widths[m.widths.length > 2 ? 1 : 0];
  const loading = eager ? (priority ? ' fetchpriority="high"' : '') : ' loading="lazy"';
  const capped = widthsUpTo(m, cap);
  const phone = capped.length < m.widths.length ? `<source media="${PHONE_MEDIA}" type="image/webp" srcset="${srcset(name, capped, 'webp')}" sizes="${sizes}">` : '';
  return `<picture${cls ? ` class="${cls}"` : ''}>${phone}<source type="image/webp" srcset="${srcset(name, m.widths, 'webp')}" sizes="${sizes}"><img src="/assets/img/${name}-${fallback}.jpg" srcset="${srcset(name, m.widths, 'jpg')}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt)}"${loading} decoding="async"${imgCls ? ` class="${imgCls}"` : ''}></picture>`;
}
// Preloads for a hero image (media-scoped so the browser fetches exactly what the <picture> will pick)
function preloadImage(name, sizes, media = '', capped = false) {
  const m = manifest[name];
  return `<link rel="preload" as="image" type="image/webp" imagesrcset="${srcset(name, capped ? widthsUpTo(m, PHONE_CAP) : m.widths, 'webp')}" imagesizes="${sizes}"${media ? ` media="${media}"` : ''} fetchpriority="high">`;
}
const preloadHero = (name, sizes) => `${preloadImage(name, sizes, PHONE_MEDIA, true)}\n${preloadImage(name, sizes, '(min-width: 600px)')}`;
// Art-directed picture: `wide` from the media query up, `narrow` below it (both WebP + JPEG, intrinsic sizes on each source)
function artPicture({ wide, narrow, media, wideSizes, narrowSizes, alt, cls = '', eager = false, priority = false }) {
  const w = manifest[wide], n = manifest[narrow];
  const loading = eager ? (priority ? ' fetchpriority="high"' : '') : ' loading="lazy"';
  const nCap = widthsUpTo(n, PHONE_CAP);
  return `<picture${cls ? ` class="${cls}"` : ''}><source media="${media}" type="image/webp" srcset="${srcset(wide, w.widths, 'webp')}" sizes="${wideSizes}" width="${w.w}" height="${w.h}"><source media="${media}" srcset="${srcset(wide, w.widths, 'jpg')}" sizes="${wideSizes}" width="${w.w}" height="${w.h}"><source media="${PHONE_MEDIA}" type="image/webp" srcset="${srcset(narrow, nCap, 'webp')}" sizes="${narrowSizes}"><source type="image/webp" srcset="${srcset(narrow, n.widths, 'webp')}" sizes="${narrowSizes}"><img src="/assets/img/${narrow}-${n.widths[1] || n.widths[0]}.jpg" srcset="${srcset(narrow, n.widths, 'jpg')}" sizes="${narrowSizes}" width="${n.w}" height="${n.h}" alt="${esc(alt)}"${loading} decoding="async"></picture>`;
}
// Manufacturer / licence logos exported by images.js (PNG, native resolution)
function logoImg(name, { alt = '', cls = '', eager = false } = {}) {
  const m = manifest[`logo-${name}`];
  if (!m) throw new Error(`logo "${name}" missing from image-manifest.json (run node images.js)`);
  return `<img class="${cls || `logo-${name}`}" src="/assets/img/${m.file}" width="${m.w}" height="${m.h}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
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

/* ---------- marks: stars, Google G, workmanship seal, years badge ---------- */
const STAR = '<path d="M12 2.4l2.95 6.1 6.65.85-4.9 4.6 1.25 6.6L12 17.3l-5.95 3.25 1.25-6.6-4.9-4.6 6.65-.85z"/>';
const stars = () => `<span class="stars" aria-hidden="true">${Array.from({ length: 5 }, () => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" focusable="false">${STAR}</svg>`).join('')}</span>`;
const googleG = () => '<svg class="g-logo" viewBox="0 0 48 48" width="22" height="22" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
// Workmanship seal: a plain drawn roundel (navy ring, orange centre, tick), no award claims
const seal = (id = 'seal-arc') => `<svg class="seal" viewBox="0 0 120 120" width="60" height="60" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="59" fill="#0E1F4D"/><circle cx="60" cy="60" r="53" fill="none" stroke="#E0702A" stroke-width="2.5"/><circle cx="60" cy="60" r="31" fill="#E0702A"/><path d="M47.5 60.5l8.5 8.5 17-18" fill="none" stroke="#0A1636" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><defs><path id="${id}" d="M18 60a42 42 0 1 1 84 0a42 42 0 1 1-84 0"/></defs><text class="seal-text"><textPath href="#${id}" textLength="258" lengthAdjust="spacing">Workmanship • Guaranteed • </textPath></text></svg>`;

/* ---------- small pieces ---------- */
const callBtn = (cls = '', label = '') => `<a class="btn btn-call ${cls}" href="${TEL}" data-phone-link>${icon('phone')}<span>${label ? `<span class="call-word">${label} </span>` : ''}${PHONE}</span></a>`;
const quoteBtn = (cls = 'btn-ghost', href = '#quote', label = 'Get a free quote') => `<a class="btn ${cls}" href="${href}">${label}</a>`;
const status = (cls = '') => `<p class="status${cls ? ' ' + cls : ''}" data-status><span class="status-dot" aria-hidden="true"></span><span class="status-text">${S.hoursShort} · answered by ${S.owner}</span></p>`;
// Plain checklist with orange ticks (no rules)
const ticks = (items, cls = '') => `<ul class="ticks${cls ? ' ' + cls : ''}">${items.map((t) => `<li>${icon('check')}<span>${t}</span></li>`).join('')}</ul>`;
// Section heading: caps H2 and, at most, one short line under it
const secHead = ({ title, id, intro = '', cls = '' }) => `<div class="sec-head${cls ? ' ' + cls : ''}"><h2${id ? ` id="${id}"` : ''}>${title}</h2>${intro ? `<p>${intro}</p>` : ''}</div>`;

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
  <div class="stripe-band" aria-hidden="true"></div>
  <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">
    <div class="container">
      <ul>${navLinks(current)}</ul>
      ${callBtn('btn-lg btn-block', 'Call')}
      <p class="mobile-menu-hours">${S.hoursShort} · Sunday closed</p>
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
        <p class="footer-facts">5.0 on Google. Licensed and insured.</p>
      </div>
      <nav class="footer-col" aria-label="Services"><h2>Services</h2><ul class="footer-links">${S.services.map((s) => `<li><a href="${s.href}">${s.label}</a></li>`).join('')}</ul></nav>
      <nav class="footer-col" aria-label="Company"><h2>Company</h2><ul class="footer-links"><li><a href="/about/">About Luke</a></li><li><a href="/service-areas/">Service areas</a></li><li><a href="/contact/">Contact</a></li><li><a href="${quoteHref}">Get a free quote</a></li></ul></nav>
      <div class="footer-col"><h2>Get in touch</h2>
        <a class="footer-phone" href="${TEL}" data-phone-link>${PHONE}</a>
        <ul class="footer-contact">
          <li><a href="mailto:${S.email}">${S.email}</a></li>
          <li>${S.hoursShort}<br>Sunday closed</li>
          <li>${S.locality} ${S.region} ${S.postcode}<br>Servicing the whole Sunshine Coast</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="footer-bottom-row">
        <p>© ${YEAR} ${S.name}</p>
        <p>ABN ${S.abn}</p>
        <p>ARC licence ${S.licence}</p>
      </div>
    </div>
  </div>
</footer>`;
}
const callBar = (quoteHref) => `<aside class="call-bar" aria-label="Quick contact">${callBtn('', 'Call')}${quoteBtn('btn-ghost', quoteHref, 'Free quote')}</aside>`;

/* ---------- sections ---------- */
// Inner-page hero: the home hero's language at 420-520px. A 3:2 photo fills the right ~58% behind the navy gradient
// (full width when `full`, for the landscape aerial), breadcrumb as small white text, caps H1, a short lede, one
// orange call button plus a quote text link, and the open/closed status. Phones: photo full width, copy below on navy.
const PAGE_HERO_SIZES = '(min-width: 900px) 58vw, 100vw';
const PAGE_HERO_SIZES_FULL = '100vw';
function pageHero({ crumb, h1, lede, photo, full = false, quoteHref = '#quote' }) {
  return `<section class="masthead masthead--page${full ? ' masthead--full' : ''}" aria-labelledby="page-title">
  ${picture(photo.name, { alt: photo.alt, sizes: full ? PAGE_HERO_SIZES_FULL : PAGE_HERO_SIZES, eager: true, priority: true, cls: 'masthead-photo', imgCls: photo.pos ? `pos-${photo.pos}` : '' })}
  <div class="container masthead-inner">
    <div class="masthead-copy">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${crumb}</li></ol></nav>
      <h1 id="page-title">${h1}</h1>
      <p class="masthead-lede">${lede}</p>
      <div class="masthead-cta">
        ${callBtn('btn-xl', 'Call Luke')}
        <a class="masthead-link" href="${quoteHref}">or get a free quote${icon('arrow')}</a>
      </div>
      ${status('status--light')}
    </div>
  </div>
</section>`;
}
const pageHeroPreload = (name, full = false) => preloadHero(name, full ? PAGE_HERO_SIZES_FULL : PAGE_HERO_SIZES);

// Text cards: title + one paragraph each, 2, 3 or 4 across. tone 'white' sits on a grey band, 'grey' on white.
function infoCards(items, { cols = 2, tone = 'grey' } = {}) {
  return `<ul class="info-cards info-cards--${cols} info-cards--${tone}">${items.map(([t, d]) => `<li class="info-card"><h3>${t}</h3><p>${d}</p></li>`).join('')}</ul>`;
}
// Process steps with chunky numbered badges (44px navy circle, white number)
function steps(items) {
  return `<ol class="steps">${items.map(([t, d], i) => `<li class="step"><span class="step-num" aria-hidden="true">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>`;
}
// Photo grid with short plain captions
function photoGrid(items, { sizes = '(min-width: 900px) 384px, calc(50vw - 24px)' } = {}) {
  return `<ul class="photo-grid">${items.map(([img, alt, cap]) => `<li><figure>${picture(img, { alt, sizes })}<figcaption>${cap}</figcaption></figure></li>`).join('')}</ul>`;
}
// The four service photo cards (home and 404)
const SERVICE_CARDS = [
  ['card-installations', '/installations/', 'Installations', 'Split systems, multi-head and ducted, sized for your home and fitted neatly.', 'White split system installed above a bedroom window'],
  ['card-repairs', '/repairs/', 'Repairs', 'Not cooling, leaking or showing an error code? I find the fault and quote before I start.', 'Control board and wiring of an air conditioner opened up for diagnosis'],
  ['card-hydro', '/hydro-cleaning/', 'Hydro cleaning', 'A full wash of the coil, fan and drain tray. $180 + GST per standard wall split.', 'Luke washing the coil of a split system, with a cleaning bag catching the water'],
  ['card-maintenance', '/maintenance/', 'Maintenance', 'A yearly service that keeps your system efficient and picks up problems early.', 'Daikin outdoor unit installed beside a brick home'],
];
const CARD_SIZES = '(min-width: 1240px) 282px, (min-width: 1100px) calc(25vw - 28px), (min-width: 640px) calc(50vw - 52px), calc(100vw - 32px)';
function serviceCards(exclude = '') {
  return `<ul class="cards">
      ${SERVICE_CARDS.filter((c) => c[1] !== exclude).map(([img, href, title, text, alt]) => `<li class="card">
        ${picture(img, { alt, sizes: CARD_SIZES, cls: 'card-photo' })}
        <div class="card-body">
          <h3><a href="${href}">${title}</a></h3>
          <p>${text}</p>
          <span class="card-more" aria-hidden="true">Learn more${icon('arrow')}</span>
        </div>
      </li>`).join('\n      ')}
    </ul>`;
}

function trustCard({ flat = false } = {}) {
  const cell = (mark, title, sub) => `<li><span class="trust-mark">${mark}</span><span class="trust-text"><strong>${title}</strong>${sub}</span></li>`;
  return `<${flat ? 'div' : 'section'} class="trust${flat ? ' trust--flat' : ''}"${flat ? '' : ' aria-label="Licence, rating and guarantee"'}>
  <div class="${flat ? '' : 'container'}"><ul class="trust-card">
    ${cell(logoImg('arc', { alt: 'ARCtick' }), 'ARC licence', S.licence)}
    ${cell(`${googleG()}${stars()}`, '5.0 rating', 'on Google')}
    ${cell(seal('seal-arc-trust'), 'Workmanship', 'guaranteed')}
    ${cell(icon('shield'), 'Licensed', '&amp; insured')}
    ${cell('<span class="badge-num" aria-hidden="true">15+</span>', '15+ years', 'on the tools')}
  </ul></div>
</${flat ? 'div' : 'section'}>`;
}

// Brand strip: the real manufacturer logos from Luke's current site, greyscale until hovered.
// (No Mitsubishi Electric logo: the only file on the Wix site is cropped. It is named in the line underneath.)
function brandStrip({ title = 'Brands Luke installs and services' } = {}) {
  const logos = ['daikin', 'fujitsu', 'mhi', 'hisense', 'general'];
  return `<section class="logos" aria-labelledby="brands-title">
  <div class="container">
    <h2 id="brands-title">${title}</h2>
    <ul class="logo-row">${logos.map((n) => `<li>${logoImg(n, { alt: manifest[`logo-${n}`].label })}</li>`).join('')}</ul>
    <p class="logo-note">Plus Mitsubishi Electric, Panasonic, LG and most other major brands.</p>
  </div>
</section>`;
}

// Reviews: Google-style cards (stars, the review in plain text, first name, "Google review") with the rating and an
// outbound link to the Google results in the header row. The three real reviews from Luke's site, quoted verbatim.
function reviews({ title = 'What locals say about Luke' } = {}) {
  const [renee, lovisa, anne] = S.reviews;
  return `<section class="reviews band-grey" aria-labelledby="reviews-title">
  <div class="container">
    <div class="head-row">
      <h2 id="reviews-title">${title}</h2>
      <div class="g-score">
        <p class="g-score-num">${googleG()}<span>5.0</span>${stars()}<small>on Google</small></p>
        <a class="text-link" href="${S.googleReviews}" target="_blank" rel="noopener">Read reviews on Google${icon('arrow')}<span class="visually-hidden"> (opens in a new tab)</span></a>
      </div>
    </div>
    <ul class="review-cards">${[anne, renee, lovisa].map((r) => `
      <li class="review-card">
        <div class="review-card-top">${stars()}<span class="visually-hidden">Rated 5 out of 5.</span>${googleG()}</div>
        <blockquote><p>${r.text}</p></blockquote>
        <p class="review-who"><span class="avatar" aria-hidden="true">${r.name.charAt(0)}</span><span><strong>${r.name}</strong>Google review</span></p>
      </li>`).join('')}
    </ul>
  </div>
</section>`;
}

// Hydro clean drag comparison: the after photo underneath, the before photo clipped on top, a native range input
// over the whole frame (keyboard and screen readers get a real slider; pointer drag anywhere works). site.js only
// copies the input's value into --pos; without JS it rests at 50%.
function beforeAfter({ sizes = '100vw' } = {}) {
  return `<div class="compare" data-compare>
  ${picture('hydro-after', { alt: 'After the hydro clean: the same unit with a clean coil, filter frame and fan', sizes, cls: 'compare-after' })}
  <div class="compare-before">${picture('hydro-before', { alt: 'Before the hydro clean: the coil and filter frame furred with dust and black mould spots', sizes })}</div>
  <span class="compare-tag compare-tag--before" aria-hidden="true">Before</span><span class="compare-tag compare-tag--after" aria-hidden="true">After</span>
  <input class="compare-range" type="range" min="0" max="100" value="50" step="1" aria-label="Compare before and after: move left to see more of the clean unit, right to see more of the dirty one">
  <span class="compare-handle" aria-hidden="true"><span class="compare-knob">${icon('arrows')}</span></span>
</div>`;
}

// Full-bleed navy band with the drag comparison and the hydro clean price (home and hydro page)
function hydroBand({ title = 'What a hydro clean gets out', intro = 'Same unit, before and after. A filter clean only gets the filter. A hydro clean washes the coil, fan and drain tray, where the mould and grime build up.', id = 'hydro-title', link = true } = {}) {
  return `<section class="hydro on-dark" aria-labelledby="${id}">
  <div class="container hydro-head">
    <div>
      <h2 id="${id}">${title}</h2>
      <p>${intro}</p>
    </div>
    <p class="price-tag"><strong>$180</strong><span>+ GST per standard wall split</span></p>
  </div>
  ${beforeAfter()}
  <div class="container hydro-foot">
    <p>Drag the handle to compare.</p>
    <div class="cta-row">
      <a class="btn btn-call" href="#quote">Book a hydro clean</a>
      ${link ? `<a class="text-link" href="/hydro-cleaning/">How a hydro clean works${icon('arrow')}</a>` : ''}
    </div>
  </div>
</section>`;
}

// Closing CTA: a solid orange band with navy text, the phone as a big Barlow Condensed link, and the hours
function ctaOrange({ title = 'Need a quote or a repair? Call Luke', text = 'Monday to Saturday, 7am to 5pm. Sunday closed.' } = {}) {
  return `<section class="cta-orange" aria-labelledby="cta-title">
  <div class="container cta-orange-inner">
    <div><h2 id="cta-title">${title}</h2><p>${text}</p></div>
    <a class="big-phone" href="${TEL}" data-phone-link>${icon('phone')}${PHONE}</a>
  </div>
</section>`;
}

// FAQ accordion: each question a white box on a grey band (or grey on white); plus turns to minus when open
function faq(items, { title = 'Questions people ask', grey = true } = {}) {
  return `<section class="section faq-section${grey ? ' band-grey' : ''}" aria-labelledby="faq-title">
  <div class="container faq-layout">
    ${secHead({ title, id: 'faq-title', intro: `Something else? Call Luke on ${PHONE}.` })}
    <div class="faq">${items.map(([q, a]) => `<details><summary><span>${q}</span><span class="pm" aria-hidden="true"></span></summary><div class="faq-answer"><p>${a}</p></div></details>`).join('')}</div>
  </div>
</section>`;
}

const SERVICE_OPTIONS = ['Installation', 'Repair', 'Hydro clean', 'Maintenance', 'Not sure'];
function quoteForm({ heading = 'Get a free quote', lede, service = '', source, aside = '' }) {
  const opts = SERVICE_OPTIONS.map((o) => `<option${o === service ? ' selected' : ''}>${o}</option>`).join('');
  return `<section class="section quote" id="quote" aria-labelledby="quote-title">
  <div class="container quote-grid">
    <div class="quote-aside">
      ${aside || `<h2 id="quote-title">${heading}</h2>
      <p>${lede || `Tell me what you need and I'll call you back to talk it through. Prefer to talk now? Call me on ${NB_PHONE}.`}</p>
      <ul class="ticks">${['Free quotes on new installs', 'Repairs quoted before any work starts', 'Workmanship guarantee on every job'].map((t) => `<li>${icon('check')}<span>${t}</span></li>`).join('')}</ul>
      <div class="call-block">
        <p class="call-block-label">Talk to Luke directly</p>
        <a class="call-number" href="${TEL}" data-phone-link>${PHONE}</a>
        ${status()}
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
        <button class="btn btn-call btn-lg btn-block quote-submit" type="submit"><span>Send my request</span>${icon('arrow')}</button>
        <p class="form-note">Sent straight to Luke. No spam, ever.</p>
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
<meta property="og:image:alt" content="Onshore Air: Luke hydro cleaning a split system, beside the headline and a Call Luke button">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/assets/fonts/barlow-condensed-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/barlow-400-latin.woff2" as="font" type="font/woff2" crossorigin>
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
  S, icon, esc, TEL, PHONE, NB_PHONE, picture, artPicture, preloadImage, preloadHero, logoImg, stars, googleG, seal, logo, callBtn, quoteBtn, status, ticks, secHead,
  pageHero, pageHeroPreload, infoCards, steps, photoGrid, serviceCards, trustCard, brandStrip, reviews, beforeAfter, hydroBand, ctaOrange, faq, quoteForm, breadcrumbLd, page,
};
