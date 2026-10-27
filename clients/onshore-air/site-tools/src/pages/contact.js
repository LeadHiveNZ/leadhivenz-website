const L = require('../layout');
const { S, TEL, PHONE, secHead, status, icon } = L;

// Stylised (not to scale) map of the service corridor, drawn inline: no external map embed or requests.
const mapArt = `<svg class="map-art" viewBox="0 0 360 300" role="img" aria-labelledby="map-art-title">
  <title id="map-art-title">Stylised map of the Sunshine Coast from Noosa to Caloundra, with Onshore Air based in Pacific Paradise</title>
  <rect width="360" height="300" fill="#1E5CB3"/>
  <path d="M0 0H232c10 6 30 10 30 22s-16 14-20 26c-5 16 6 34 3 52-2 14-9 22-6 34 3 10 13 12 13 22s-12 12-12 22 14 14 14 26-12 16-10 30c2 12 14 18 10 34-2 8-10 12-14 20-3 6-2 12 0 12H0z" fill="#F2F4F7"/>
  <path d="M232 0c10 6 30 10 30 22s-16 14-20 26c-5 16 6 34 3 52-2 14-9 22-6 34 3 10 13 12 13 22s-12 12-12 22 14 14 14 26-12 16-10 30c2 12 14 18 10 34-2 8-10 12-14 20-3 6-2 12 0 12" fill="none" stroke="#0E1F4D" stroke-width="1.5" stroke-opacity=".45"/>
  <g fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1.5"><path d="M280 60c20-6 40 6 60 0M286 120c18-6 36 6 54 0M282 190c20-6 38 6 58 0M286 250c18-6 36 6 54 0"/></g>
  <g font-family="Barlow, Arial, sans-serif" font-size="12.5" font-weight="600" fill="#FFFFFF">
    <circle cx="252" cy="26" r="3.5" fill="#FFFFFF"/><text x="262" y="30">Noosa</text>
    <circle cx="243" cy="92" r="3.5" fill="#FFFFFF"/><text x="253" y="96">Coolum</text>
    <circle cx="246" cy="178" r="3.5" fill="#FFFFFF"/><text x="257" y="182">Maroochydore</text>
    <circle cx="250" cy="206" r="3.5" fill="#FFFFFF"/><text x="260" y="210">Mooloolaba</text>
    <circle cx="246" cy="282" r="3.5" fill="#FFFFFF"/><text x="256" y="286">Caloundra</text>
    <g fill="#3A4668" text-anchor="middle"><circle cx="132" cy="198" r="3.5"/><text x="132" y="217">Nambour</text><circle cx="74" cy="250" r="3.5"/><text x="74" y="269">Maleny</text></g>
    <circle cx="230" cy="140" r="14" fill="#E0702A" fill-opacity=".25"/><circle cx="230" cy="140" r="6.5" fill="#E0702A"/>
    <text x="213" y="145" text-anchor="end" fill="#0E1F4D" font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing=".3">PACIFIC PARADISE</text>
    <text x="213" y="160" text-anchor="end" fill="#3A4668" font-size="11" font-weight="600">Home base</text>
  </g>
</svg>`;

module.exports = {
  path: '/contact/',
  out: 'contact/index.html',
  title: `Contact Onshore Air | Call ${S.phone.display}`,
  description: `Call Luke on ${S.phone.display} or request a free quote online. Onshore Air, Pacific Paradise QLD 4564, servicing the whole Sunshine Coast. Mon–Sat 7am–5pm.`,
  current: '/contact/',
  jsonld: [L.breadcrumbLd('Contact', '/contact/')],
  preload: L.pageHeroPreload('hero-contact'),
  main: `
${L.pageHero({
    crumb: 'Contact',
    h1: 'Contact Onshore Air',
    lede: 'The quickest way to get an answer is to call. If I’m up a ladder, leave a message or send the form and I’ll get back to you.',
    photo: { name: 'hero-contact', alt: 'White wall-mounted split system installed by Onshore Air' },
  })}

<section class="section" aria-labelledby="talk-title">
  <div class="container contact-grid">
    <div class="contact-card on-dark">
      <h2 id="talk-title">Talk to Luke</h2>
      <a class="big-phone big-phone--light" href="${TEL}" data-phone-link>${icon('phone')}${PHONE}</a>
      ${status('status--light')}
      <dl class="contact-list">
        <div><dt>Email</dt><dd><a href="mailto:${S.email}">${S.email}</a></dd></div>
        <div><dt>Hours</dt><dd>${S.hoursShort}<br>Sunday closed</dd></div>
        <div><dt>Based in</dt><dd>${S.locality} ${S.region} ${S.postcode}<br>Servicing the whole Sunshine Coast</dd></div>
        <div><dt>ABN</dt><dd>${S.abn}</dd></div>
        <div><dt>ARC licence</dt><dd>${S.licence}</dd></div>
      </dl>
    </div>
    <figure class="map-card">
      ${mapArt}
      <figcaption>
        <h3>A mobile service: I come to you</h3>
        <p>There’s no shopfront to visit. I’m based in ${S.locality} and work on-site at homes and businesses anywhere from Caloundra to Noosa and the hinterland.</p>
      </figcaption>
    </figure>
  </div>
</section>

<section class="section band-grey" aria-labelledby="tips-title">
  <div class="container">
    ${secHead({ title: 'Have these handy and I can help faster', id: 'tips-title' })}
    ${L.infoCards([
      ['Brand and model', 'Usually on a sticker on the side of the indoor unit or on the outdoor unit.'],
      ['Any error code', 'Note the code or flashing-light pattern on the display, or snap a photo of it.'],
      ['Where the units are', 'Which rooms, roughly how high, and where the outdoor unit sits.'],
      ['When suits you', 'Mornings, afternoons or Saturdays: I’ll work around you where I can.'],
    ], { cols: 4, tone: 'white' })}
  </div>
</section>

${L.ctaOrange()}

${L.quoteForm({ source: 'Contact', heading: 'Request a call back', lede: `Fill in the form and I’ll call you back. If it’s urgent, calling ${L.NB_PHONE} is always quickest.` })}
`,
};
