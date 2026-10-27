const L = require('../layout');
const { S, icon, picture, preloadImage, callBtn, quoteBtn, status, eyebrow, sectionHead, stripeRule } = L;

// Hero photo: Luke on the ladder, portrait 4:5, at most 480 px wide on desktop.
const { HERO_SIZES } = L;
const THUMB_SIZES = '(min-width: 900px) 140px, 72px';

const services = [
  ['thumb-installations', '/installations/', 'Installations', 'Split systems, multi-head and ducted, sized to your home and installed neatly.', 'Split system air conditioner installed above a bedroom window'],
  ['thumb-repairs', '/repairs/', 'Repairs', 'Not cooling, leaking, noisy or showing an error code? Found, explained and quoted before work starts.', 'Inside an air conditioner: control board and wiring opened up for diagnosis'],
  ['thumb-hydro', '/hydro-cleaning/', 'Hydro cleaning', 'A deep wash of the coil, fan and drain tray that clears out mould and grime a filter clean can’t reach.', 'Split system opened up for a hydro clean, with a cleaning bag fitted underneath'],
  ['thumb-maintenance', '/maintenance/', 'Maintenance', 'A yearly service that keeps your system efficient, catches problems early and helps it last.', 'Daikin outdoor unit installed beside a brick home'],
];

const points = [
  ['Straight answers.', 'Honest advice on the right system for your home, and on whether a repair is worth doing at all.'],
  ['Neat, careful work.', 'Tidy pipe runs, covers where lines are on show, and your place left as clean as he found it.'],
  ['Licensed and insured.', `Fully licensed and insured, with Australian Refrigeration Council licence ${S.licence}.`],
  ['Free quotes, fair prices.', 'Clear, competitive quotes with no pressure to go ahead, backed by a workmanship guarantee.'],
];

const ld = {
  '@context': 'https://schema.org',
  '@type': 'HVACBusiness',
  '@id': `${S.origin}/#business`,
  name: S.name,
  description: 'Air conditioning installations, repairs, hydro cleaning and maintenance across the Sunshine Coast, from Caloundra to Noosa.',
  url: `${S.origin}/`,
  telephone: S.phone.tel,
  email: S.email,
  image: `${S.origin}/assets/img/logo.png`,
  logo: `${S.origin}/assets/img/logo.png`,
  taxID: S.abn,
  address: { '@type': 'PostalAddress', addressLocality: S.locality, addressRegion: S.region, postalCode: S.postcode, addressCountry: 'AU' },
  areaServed: { '@type': 'Place', name: 'Sunshine Coast, Queensland, Australia' },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '17:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '07:00', closes: '17:00' },
  ],
};

module.exports = {
  path: '/',
  out: 'index.html',
  title: 'Air Conditioning Sunshine Coast | Onshore Air',
  description: 'Air con installs, repairs, hydro cleaning and servicing from Caloundra to Noosa. Licensed local tech, 15+ years experience. Free quotes on 0444 541 409.',
  current: '/',
  preload: preloadImage('luke-hydro-clean', HERO_SIZES),
  jsonld: [ld],
  main: `
<section class="hero" aria-labelledby="hero-title">
  <div class="container hero-grid">
    <div class="hero-copy">
      ${eyebrow('Pacific Paradise · Sunshine Coast')}
      <h1 id="hero-title">Sunshine Coast air conditioning, <span class="u">done properly.</span></h1>
      <p class="hero-lede">Installs, repairs, hydro cleans and servicing from Luke, a licensed local technician with 15+ years on the tools. Free quotes, fair prices and a workmanship guarantee.</p>
    </div>
    <figure class="hero-media">
      <div class="hero-photo">
        <span class="stripe-field" aria-hidden="true"></span>
        ${picture('luke-hydro-clean', { alt: 'Luke from Onshore Air hydro cleaning a wall-mounted split system', sizes: HERO_SIZES, eager: true, priority: true, cls: 'photo' })}
      </div>
      <figcaption class="caption">Luke on a hydro clean, covers off.</figcaption>
    </figure>
    <div class="hero-act">
      <div class="cta-row">${callBtn('', 'Call')}${quoteBtn('btn-line')}</div>
      ${status()}
      <p class="hero-meta"><span><span class="star" aria-hidden="true">★</span> 5.0 Google rating</span><span class="sep" aria-hidden="true">·</span><span>Caloundra to Noosa</span></p>
    </div>
  </div>
</section>

${L.trustStrip()}

<section class="section" aria-labelledby="services-title">
  <div class="container services-layout">
    ${sectionHead({ eyebrow: 'What we do', title: 'Everything your air con needs, from one local tech', lede: 'From a new split system in the bedroom to a unit that’s suddenly blowing warm air, Luke handles the lot. One number to call, one person to deal with.', id: 'services-title' })}
    <ol class="index">
      ${services.map(([img, href, title, text, alt], i) => `<li class="index-row">
        <span class="index-num" aria-hidden="true">0${i + 1}</span>
        <div class="index-body"><h3><a href="${href}">${title}${icon('arrow')}</a></h3><p>${text}</p></div>
        ${picture(img, { alt, sizes: THUMB_SIZES, cls: 'index-thumb photo' })}
      </li>`).join('\n      ')}
    </ol>
  </div>
</section>

<section class="section band-deep" aria-labelledby="why-title">
  <div class="container why-grid">
    <div class="why-photos">
      ${picture('luke-cleaning-coil', { alt: 'Luke from Onshore Air cleaning the coil of a split system, with a cleaning bag catching the water', sizes: '(min-width: 960px) 430px, 72vw', cls: 'photo photo-main' })}
      ${picture('outdoor-fujitsu', { alt: 'Fujitsu outdoor unit with a neat, covered pipe run up the wall', sizes: '(min-width: 960px) 260px, 44vw', cls: 'photo photo-inset' })}
      <p class="why-years"><strong>15+</strong><span>years on the tools</span></p>
    </div>
    <div>
      ${eyebrow('Why Onshore Air')}
      <h2 id="why-title">One local tech, start to finish</h2>
      <p class="lede">Onshore Air is Luke, an air conditioning technician based in Pacific Paradise with more than 15 years in the trade. The person who quotes your job is the person who does the work, and the one who picks up if you ever need him again.</p>
      <ul class="points">${points.map(([lead, text]) => `<li><strong>${lead}</strong> ${text}</li>`).join('')}</ul>
      <a class="text-link" href="/about/">More about Luke${icon('arrow')}</a>
    </div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="brands-title">
  <div class="container brands-block">
    ${sectionHead({ eyebrow: 'Brands', title: 'Quality brands, installed and serviced', id: 'brands-title' })}
    <div>${L.brandBadges()}</div>
  </div>
</section>

${L.reviews({ sand: true })}

<section class="section on-dark area-band" aria-labelledby="area-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Service area', title: 'Caloundra to Noosa, and up into the hinterland', lede: 'Based in Pacific Paradise, right in the middle of the Coast, Luke looks after homes and businesses along the whole Sunshine Coast.', id: 'area-title', light: true })}
    ${L.route()}
    <div class="area-extra">
      <div>
        <p class="area-extra-title">Plus the hinterland</p>
        <ul class="chips chips--dark">${S.hinterland.map((h) => `<li class="chip">${h}</li>`).join('')}</ul>
      </div>
      <a class="btn btn-ghost" href="/service-areas/">See every suburb we cover ${icon('arrow')}</a>
    </div>
  </div>
</section>

${L.quoteForm({ source: 'Home', heading: 'Get a free quote' })}
`,
};
