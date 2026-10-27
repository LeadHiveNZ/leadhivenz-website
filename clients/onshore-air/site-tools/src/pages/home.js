const L = require('../layout');
const { S, icon, picture, artPicture, preloadImage, logoImg, googleG, stars, callBtn, status, TEL, PHONE } = L;

// Hero: art-directed. From 900px the landscape 4:3 crop (hero-home) fills the right ~64% of the band behind the navy
// gradient; phones get the 4:5 crop (luke-hydro-clean) shown square, full width, above the copy.
const HERO_MEDIA = '(min-width: 900px)';
const HERO_WIDE_SIZES = '(min-width: 1100px) 64vw, 58vw';
const CARD_SIZES = '(min-width: 1240px) 282px, (min-width: 1100px) calc(25vw - 28px), (min-width: 640px) calc(50vw - 52px), calc(100vw - 32px)';

const services = [
  ['card-installations', '/installations/', 'Installations', 'Split systems, multi-head and ducted, sized for your home and fitted neatly.', 'White split system installed above a bedroom window'],
  ['card-repairs', '/repairs/', 'Repairs', 'Not cooling, leaking or showing an error code? I find the fault and quote before I start.', 'Control board and wiring of an air conditioner opened up for diagnosis'],
  ['card-hydro', '/hydro-cleaning/', 'Hydro cleaning', 'A full wash of the coil, fan and drain tray. $180 + GST per standard wall split.', 'Luke washing the coil of a split system, with a cleaning bag catching the water'],
  ['card-maintenance', '/maintenance/', 'Maintenance', 'A yearly service that keeps your system efficient and picks up problems early.', 'Daikin outdoor unit installed beside a brick home'],
];

// Suburbs from the service-areas page, in the same order (northern beaches, central, southern, hinterland)
const suburbs = S.areas.flatMap((a) => a.suburbs);

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
  description: `Air con installs, repairs, hydro cleaning and servicing from Caloundra to Noosa. Licensed local tech, 15+ years experience. Free quotes on ${S.phone.display}.`,
  current: '/',
  preload: [preloadImage('hero-home', HERO_WIDE_SIZES, HERO_MEDIA), preloadImage('luke-hydro-clean', '100vw', '(max-width: 899px)')].join('\n'),
  jsonld: [ld],
  main: `
<section class="masthead" aria-labelledby="hero-title">
  ${artPicture({ wide: 'hero-home', narrow: 'luke-hydro-clean', media: HERO_MEDIA, wideSizes: HERO_WIDE_SIZES, narrowSizes: '100vw', alt: 'Luke from Onshore Air hydro cleaning a wall-mounted split system, with a cleaning bag fitted under the unit', cls: 'masthead-photo', eager: true, priority: true })}
  <div class="container masthead-inner">
    <div class="masthead-copy">
      <h1 id="hero-title">Sunshine Coast air conditioning by a licensed local tech</h1>
      <p class="masthead-lede">I’m Luke. I’ve been installing, fixing and cleaning air cons for more than 15 years, for homes from Caloundra to Noosa. When you call, you get me, and I’m the one who turns up and does the job.</p>
      <div class="masthead-cta">
        ${callBtn('btn-xl', 'Call Luke')}
        <a class="masthead-link" href="#quote">or get a free quote${icon('arrow')}</a>
      </div>
      ${status('status--light')}
      <ul class="proof" aria-label="Rating and licence">
        <li class="proof-chip">${googleG()}<span>${stars()}<span>5.0 on Google</span></span></li>
        <li class="proof-chip">${logoImg('arc', { alt: 'ARCtick', eager: true })}<span>Licence ${S.licence}</span></li>
      </ul>
    </div>
  </div>
</section>

${L.trustCard()}

<section class="section services" aria-labelledby="services-title">
  <div class="container">
    <div class="head-row">
      <h2 id="services-title">Installs, repairs, cleans and servicing</h2>
    </div>
    <ul class="cards">
      ${services.map(([img, href, title, text, alt]) => `<li class="card">
        ${picture(img, { alt, sizes: CARD_SIZES, cls: 'card-photo' })}
        <div class="card-body">
          <h3><a href="${href}">${title}</a></h3>
          <p>${text}</p>
          <span class="card-more" aria-hidden="true">Learn more${icon('arrow')}</span>
        </div>
      </li>`).join('\n      ')}
    </ul>
  </div>
</section>

${L.brandStrip()}

<section class="hydro on-dark" aria-labelledby="hydro-title">
  <div class="container hydro-head">
    <div>
      <h2 id="hydro-title">What a hydro clean gets out</h2>
      <p>Same unit, before and after. A filter clean only gets the filter. A hydro clean washes the coil, fan and drain tray, where the mould and grime build up.</p>
    </div>
    <p class="price-tag"><strong>$180</strong><span>+ GST per standard wall split</span></p>
  </div>
  ${L.beforeAfter()}
  <div class="container hydro-foot">
    <p>Drag the handle to compare.</p>
    <div class="cta-row">
      <a class="btn btn-call" href="#quote">Book a hydro clean</a>
      <a class="text-link" href="/hydro-cleaning/">How a hydro clean works${icon('arrow')}</a>
    </div>
  </div>
</section>

<section class="luke" aria-labelledby="luke-title">
  <div class="container luke-grid">
    <!-- Photo: replace with a front-on portrait of Luke (landscape or 4:5, face visible) when he supplies one. -->
    ${picture('luke-cleaning-coil', { alt: 'Luke cleaning the coil of a split system', sizes: '(min-width: 960px) 560px, calc(100vw - 32px)', cls: 'luke-photo' })}
    <div class="luke-copy">
      <h2 id="luke-title">G’day, I’m Luke</h2>
      <p>Onshore Air is me. I’ve been working on air conditioners for more than 15 years, and I’m based in Pacific Paradise, right in the middle of the Coast.</p>
      <p>I take the call, I come out and quote the job, and I’m the one who does the work. If anything needs looking at later, you ring the same number and get me again.</p>
      <p>I hold an Australian Refrigeration Council licence (${S.licence}), I’m fully insured, and I back every job with a workmanship guarantee.</p>
      <div class="luke-call">
        <span>Call me on</span>
        <a class="big-phone" href="${TEL}" data-phone-link>${PHONE}</a>
      </div>
      <a class="text-link" href="/about/">More about me${icon('arrow')}</a>
    </div>
  </div>
</section>

${L.reviews()}

<section class="area" aria-labelledby="area-title">
  ${picture('area-coast', { alt: '', sizes: '100vw', cls: 'area-bg' })}
  <div class="container">
    <h2 id="area-title">Caloundra to Noosa and the hinterland</h2>
    <p class="area-intro">I work right along the Coast from my base in Pacific Paradise, from Pelican Waters up to Noosa Heads and out to Maleny.</p>
    <ul class="suburbs">${suburbs.map((n) => `<li${n === S.locality ? ' class="is-base"' : ''}>${n}${n === S.locality ? ' (home base)' : ''}</li>`).join('')}</ul>
    <a class="btn btn-white" href="/service-areas/">Service areas in detail${icon('arrow')}</a>
  </div>
</section>

${L.ctaOrange()}

${L.quoteForm({ source: 'Home', heading: 'Get a free quote' })}
`,
};
