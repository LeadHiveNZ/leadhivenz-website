const L = require('../layout');
const { S, icon, TEL, PHONE, sectionHead, eyebrow } = L;

// Stylised (not to scale) map of the service corridor, drawn inline: no external map embed or requests.
const mapArt = `<svg class="map-art" viewBox="0 0 360 300" role="img" aria-labelledby="map-art-title">
  <title id="map-art-title">Stylised map of the Sunshine Coast from Noosa to Caloundra, with Onshore Air based in Pacific Paradise</title>
  <defs><linearGradient id="sea" x1="0" x2="1"><stop offset="0" stop-color="#1A3576"/><stop offset="1" stop-color="#264BA1"/></linearGradient></defs>
  <rect width="360" height="300" fill="url(#sea)"/>
  <path d="M0 0H232c10 6 30 10 30 22s-16 14-20 26c-5 16 6 34 3 52-2 14-9 22-6 34 3 10 13 12 13 22s-12 12-12 22 14 14 14 26-12 16-10 30c2 12 14 18 10 34-2 8-10 12-14 20-3 6-2 12 0 12H0z" fill="#0C1D45"/>
  <path d="M232 0c10 6 30 10 30 22s-16 14-20 26c-5 16 6 34 3 52-2 14-9 22-6 34 3 10 13 12 13 22s-12 12-12 22 14 14 14 26-12 16-10 30c2 12 14 18 10 34-2 8-10 12-14 20-3 6-2 12 0 12" fill="none" stroke="#5BB5D0" stroke-width="2" stroke-opacity=".7"/>
  <g fill="none" stroke="#5BB5D0" stroke-opacity=".18" stroke-width="1.5"><path d="M280 60c20-6 40 6 60 0M286 120c18-6 36 6 54 0M282 190c20-6 38 6 58 0M286 250c18-6 36 6 54 0"/></g>
  <g font-family="Inter, Arial, sans-serif" font-size="12" font-weight="600" fill="#D3DEF0">
    <circle cx="252" cy="26" r="4" fill="#5BB5D0"/><text x="262" y="30">Noosa</text>
    <circle cx="243" cy="92" r="4" fill="#5BB5D0"/><text x="253" y="96">Coolum</text>
    <circle cx="246" cy="178" r="4" fill="#5BB5D0"/><text x="257" y="182">Maroochydore</text>
    <circle cx="250" cy="206" r="4" fill="#5BB5D0"/><text x="260" y="210">Mooloolaba</text>
    <circle cx="246" cy="282" r="4" fill="#5BB5D0"/><text x="256" y="286">Caloundra</text>
    <g fill="#A9B8D3" font-weight="500" text-anchor="middle"><circle cx="132" cy="198" r="3.5"/><text x="132" y="217">Nambour</text><circle cx="74" cy="250" r="3.5"/><text x="74" y="269">Maleny</text></g>
    <circle cx="230" cy="140" r="14" fill="#F3B941" fill-opacity=".22"/><circle cx="230" cy="140" r="6" fill="#F3B941"/>
    <text x="216" y="144" text-anchor="end" fill="#fff" font-size="13" font-weight="700">Pacific Paradise</text>
    <text x="216" y="160" text-anchor="end" fill="#F3B941" font-size="10" font-weight="700" letter-spacing="1.2">HOME BASE</text>
  </g>
</svg>`;

const aside = `${eyebrow('Send a message')}
      <h2 id="quote-title">Request a call back</h2>
      <p class="lede">Fill in the form and Luke will call you back. If it’s urgent, calling ${L.NB_PHONE} is always quickest.</p>
      <div class="map-note">
        ${mapArt}
        <div class="map-note-body">
          <h3>A mobile service: Luke comes to you</h3>
          <p>There’s no shopfront to visit. Onshore Air is based in ${S.locality} and works on-site at homes and businesses anywhere from Caloundra to Noosa and the hinterland.</p>
        </div>
      </div>`;

module.exports = {
  path: '/contact/',
  out: 'contact/index.html',
  title: 'Contact Onshore Air | Call 0444 541 409',
  description: 'Call Luke on 0444 541 409 or request a free quote online. Onshore Air, Pacific Paradise QLD 4564, servicing the whole Sunshine Coast. Mon–Sat 7am–5pm.',
  current: '/contact/',
  jsonld: [L.breadcrumbLd('Contact', '/contact/')],
  main: `
${L.pageHero({
    crumb: 'Contact',
    h1: 'Contact Onshore Air',
    lede: 'The quickest way to get an answer is to call. If Luke is up a ladder, leave a message or send the form and he’ll get back to you.',
    cls: 'page-hero--contact',
    media: `<div class="contact-card">
      <h2>Talk to Luke</h2>
      <div class="contact-row contact-row--big"><span class="row-icon">${icon('phone')}</span><span><span class="row-label">Phone</span><a href="${TEL}" data-phone-link>${PHONE}</a></span></div>
      <div class="contact-row"><span class="row-icon">${icon('mail')}</span><span><span class="row-label">Email</span><a href="mailto:${S.email}">${S.email}</a></span></div>
      <div class="contact-row"><span class="row-icon">${icon('clock')}</span><span><span class="row-label">Hours</span><span class="row-value">${S.hoursShort}</span><span class="row-sub">Sunday closed</span></span></div>
      <div class="contact-row"><span class="row-icon">${icon('pin')}</span><span><span class="row-label">Based in</span><span class="row-value">${S.locality} ${S.region} ${S.postcode}</span><span class="row-sub">Servicing the whole Sunshine Coast</span></span></div>
    </div>`,
    points: [],
  })}

${L.quoteForm({ source: 'Contact', aside })}

<section class="section" aria-labelledby="tips-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Before you call', title: 'Have these handy and Luke can help faster', id: 'tips-title', center: true })}
    ${L.iconCards([
      ['badge', 'Brand and model', 'Usually on a sticker on the side of the indoor unit or on the outdoor unit.'],
      ['alert', 'Any error code', 'Note the code or flashing-light pattern on the display, or snap a photo of it.'],
      ['home', 'Where the units are', 'Which rooms, roughly how high, and where the outdoor unit sits.'],
      ['clock', 'When suits you', 'Mornings, afternoons or Saturdays: Luke will work around you where he can.'],
    ], 'icon-grid--4')}
    <dl class="biz-details">
      <div><dt>ABN</dt><dd>${S.abn}</dd></div>
      <div><dt>ARC licence</dt><dd>${S.licence}</dd></div>
      <div><dt>Email</dt><dd><a href="mailto:${S.email}">${S.email}</a></dd></div>
    </dl>
  </div>
</section>
`,
};
