const L = require('../layout');
const { S, TEL, PHONE, sectionHead, eyebrow } = L;

// Stylised (not to scale) map of the service corridor, drawn inline: no external map embed or requests.
const mapArt = `<svg class="map-art" viewBox="0 0 360 300" role="img" aria-labelledby="map-art-title">
  <title id="map-art-title">Stylised map of the Sunshine Coast from Noosa to Caloundra, with Onshore Air based in Pacific Paradise</title>
  <rect width="360" height="300" fill="#1E5CB3"/>
  <path d="M0 0H232c10 6 30 10 30 22s-16 14-20 26c-5 16 6 34 3 52-2 14-9 22-6 34 3 10 13 12 13 22s-12 12-12 22 14 14 14 26-12 16-10 30c2 12 14 18 10 34-2 8-10 12-14 20-3 6-2 12 0 12H0z" fill="#EADFCC"/>
  <path d="M232 0c10 6 30 10 30 22s-16 14-20 26c-5 16 6 34 3 52-2 14-9 22-6 34 3 10 13 12 13 22s-12 12-12 22 14 14 14 26-12 16-10 30c2 12 14 18 10 34-2 8-10 12-14 20-3 6-2 12 0 12" fill="none" stroke="#0E1F4D" stroke-width="1.5" stroke-opacity=".55"/>
  <g fill="none" stroke="#F4EDE1" stroke-opacity=".3" stroke-width="1.5"><path d="M280 60c20-6 40 6 60 0M286 120c18-6 36 6 54 0M282 190c20-6 38 6 58 0M286 250c18-6 36 6 54 0"/></g>
  <g font-family="Instrument Sans, Arial, sans-serif" font-size="12" font-weight="600" fill="#FFFFFF">
    <circle cx="252" cy="26" r="3.5" fill="#F4EDE1"/><text x="262" y="30">Noosa</text>
    <circle cx="243" cy="92" r="3.5" fill="#F4EDE1"/><text x="253" y="96">Coolum</text>
    <circle cx="246" cy="178" r="3.5" fill="#F4EDE1"/><text x="257" y="182">Maroochydore</text>
    <circle cx="250" cy="206" r="3.5" fill="#F4EDE1"/><text x="260" y="210">Mooloolaba</text>
    <circle cx="246" cy="282" r="3.5" fill="#F4EDE1"/><text x="256" y="286">Caloundra</text>
    <g fill="#34416A" font-weight="500" text-anchor="middle"><circle cx="132" cy="198" r="3.5"/><text x="132" y="217">Nambour</text><circle cx="74" cy="250" r="3.5"/><text x="74" y="269">Maleny</text></g>
    <circle cx="230" cy="140" r="13" fill="#E0702A" fill-opacity=".25"/><circle cx="230" cy="140" r="6" fill="#E0702A"/>
    <text x="214" y="144" text-anchor="end" fill="#0E1F4D" font-family="Fraunces, Georgia, serif" font-size="15" font-weight="600">Pacific Paradise</text>
    <text x="214" y="160" text-anchor="end" fill="#34416A" font-size="10" font-weight="600" letter-spacing="1.2">HOME BASE</text>
  </g>
</svg>`;

const aside = `${L.stripeRule()}${eyebrow('Send a message')}
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
    block: `<div class="contact-card">
      <h2>Talk to Luke</h2>
      <div class="contact-row contact-row--big"><span class="row-label">Phone</span><a href="${TEL}" data-phone-link>${PHONE}</a></div>
      <div class="contact-row"><span class="row-label">Email</span><a href="mailto:${S.email}">${S.email}</a></div>
      <div class="contact-row"><span class="row-label">Hours</span><span class="row-value">${S.hoursShort}</span><span class="row-sub">Sunday closed</span></div>
      <div class="contact-row"><span class="row-label">Based in</span><span class="row-value">${S.locality} ${S.region} ${S.postcode}</span><span class="row-sub">Servicing the whole Sunshine Coast</span></div>
    </div>`,
  })}

${L.quoteForm({ source: 'Contact', aside })}

<section class="section" aria-labelledby="tips-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Before you call', title: 'Have these handy and Luke can help faster', id: 'tips-title' })}
    ${L.rows([
      ['Brand and model', 'Usually on a sticker on the side of the indoor unit or on the outdoor unit.'],
      ['Any error code', 'Note the code or flashing-light pattern on the display, or snap a photo of it.'],
      ['Where the units are', 'Which rooms, roughly how high, and where the outdoor unit sits.'],
      ['When suits you', 'Mornings, afternoons or Saturdays: Luke will work around you where he can.'],
    ], { cols: 2 })}
    <dl class="biz-details">
      <div><dt>ABN</dt><dd>${S.abn}</dd></div>
      <div><dt>ARC licence</dt><dd>${S.licence}</dd></div>
      <div><dt>Email</dt><dd><a href="mailto:${S.email}">${S.email}</a></dd></div>
    </dl>
  </div>
</section>
`,
};
