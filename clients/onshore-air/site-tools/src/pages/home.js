const L = require('../layout');
const { S, icon, picture, preloadImage, callBtn, quoteBtn, status, eyebrow, sectionHead, stars } = L;

const HERO_SIZES = '(max-width: 899px) 200vw, 100vw';
const cardSizes = '(min-width: 1100px) 282px, (min-width: 640px) 46vw, calc(100vw - 40px)';

const services = [
  ['card-installations', 'snow', '/installations/', 'Installations', 'Split systems, multi-head and ducted, sized to your home and installed neatly.', 'Split system air conditioner installed above a bedroom window'],
  ['card-repairs', 'wrench', '/repairs/', 'Repairs', 'Not cooling, leaking, noisy or showing an error code? Found, explained and quoted before work starts.', 'Inside an air conditioner: control board and wiring opened up for diagnosis'],
  ['card-hydro', 'drop', '/hydro-cleaning/', 'Hydro cleaning', 'A deep wash of the coil, fan and drain tray that clears out mould and grime a filter clean can’t reach.', 'Split system opened up for a hydro clean, with a cleaning bag fitted underneath'],
  ['card-maintenance', 'clipboard', '/maintenance/', 'Maintenance', 'A yearly service that keeps your system efficient, catches problems early and helps it last.', 'Daikin outdoor unit installed beside a brick home'],
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
  preload: preloadImage('coast-aerial', HERO_SIZES),
  jsonld: [ld],
  main: `
<section class="hero" aria-labelledby="hero-title">
  <div class="container hero-inner">
    ${status()}
    <h1 id="hero-title">Sunshine Coast air conditioning, <em>done properly.</em></h1>
    <p class="hero-lede">Installs, repairs, hydro cleans and servicing from Luke, a licensed local technician with 15+ years on the tools. Free quotes, fair prices and a workmanship guarantee.</p>
    <div class="hero-actions">${callBtn('btn-lg', 'Call')}${quoteBtn('btn-ghost btn-lg')}</div>
    <ul class="hero-meta"><li>${stars()}5.0 Google rating</li><li>${icon('pin')}Caloundra to Noosa</li></ul>
  </div>
  ${picture('coast-aerial', { alt: 'Aerial view of Sunshine Coast sandbanks and coastline with the Glass House Mountains on the horizon', sizes: HERO_SIZES, eager: true, priority: true, cls: 'hero-media' })}
  <figure class="hero-review">
    ${stars()}
    <blockquote><p>“${S.reviews[0].text}”</p></blockquote>
    <figcaption><strong>${S.reviews[0].name}</strong> · Google review</figcaption>
  </figure>
</section>

${L.trustStrip()}

<section class="section" aria-labelledby="services-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'What we do', title: 'Everything your air con needs, from one local tech', lede: 'From a new split system in the bedroom to a unit that’s suddenly blowing warm air, Luke handles the lot. One number to call, one person to deal with.', id: 'services-title' })}
    <ul class="cards cards--4">
      ${services.map(([img, ic, href, title, text, alt]) => `<li class="card">
        <div class="card-media">${picture(img, { alt, sizes: cardSizes })}</div>
        <div class="card-body">
          <span class="card-icon">${icon(ic)}</span>
          <h3><a href="${href}">${title}</a></h3>
          <p>${text}</p>
          <span class="card-link" aria-hidden="true">Find out more ${icon('arrow')}</span>
        </div>
      </li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="section section--sand" aria-labelledby="why-title">
  <div class="container split">
    <div class="photo-stack">
      ${picture('luke-hydro-clean', { alt: 'Luke from Onshore Air hydro cleaning a wall-mounted split system', sizes: '(min-width: 960px) 520px, 88vw', cls: 'photo-main' })}
      ${picture('outdoor-fujitsu', { alt: 'Fujitsu outdoor unit with a neat, covered pipe run up the wall', sizes: '(min-width: 960px) 240px, 40vw', cls: 'photo-inset' })}
      <p class="photo-badge"><strong>15+</strong><span>years on the tools</span></p>
    </div>
    <div>
      ${eyebrow('Why Onshore Air')}
      <h2 id="why-title">One local tech, start to finish</h2>
      <p class="lede">Onshore Air is Luke, an air conditioning technician based in Pacific Paradise with more than 15 years in the trade. The person who quotes your job is the person who does the work, and the one who picks up if you ever need him again.</p>
      <ul class="feature-list">
        <li class="feature"><span class="feature-icon">${icon('users')}</span><div><h3>Straight answers</h3><p>Honest advice on the right system for your home, and on whether a repair is worth doing at all.</p></div></li>
        <li class="feature"><span class="feature-icon">${icon('sparkle')}</span><div><h3>Neat, careful work</h3><p>Tidy pipe runs, covers where lines are on show, and your place left as clean as he found it.</p></div></li>
        <li class="feature"><span class="feature-icon">${icon('shield')}</span><div><h3>Licensed and insured</h3><p>Fully licensed and insured, with Australian Refrigeration Council licence ${S.licence}.</p></div></li>
        <li class="feature"><span class="feature-icon">${icon('dollar')}</span><div><h3>Free quotes, fair prices</h3><p>Clear, competitive quotes with no pressure to go ahead, backed by a workmanship guarantee.</p></div></li>
      </ul>
      <p class="mt-lg"><a class="btn btn-outline" href="/about/">More about Luke</a></p>
    </div>
  </div>
</section>

<section class="section section--tight" aria-labelledby="brands-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Brands', title: 'Quality brands, installed and serviced', id: 'brands-title', center: true })}
    ${L.brandBadges()}
  </div>
</section>

${L.reviews()}

<section class="section section--navy area-band waves-bg" aria-labelledby="area-title">
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
