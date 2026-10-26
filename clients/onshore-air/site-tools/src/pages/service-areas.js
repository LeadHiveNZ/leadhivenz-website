const L = require('../layout');
const { S, icon, sectionHead, eyebrow } = L;

const allSuburbs = S.areas.flatMap((a) => a.suburbs);

module.exports = {
  path: '/service-areas/',
  out: 'service-areas/index.html',
  title: 'Service Areas: Caloundra to Noosa | Onshore Air',
  description: 'Air conditioning across the whole Sunshine Coast, Caloundra to Noosa and the hinterland: Maroochydore, Buderim, Coolum, Nambour, Maleny and more.',
  current: '/service-areas/',
  jsonld: [
    L.breadcrumbLd('Service areas', '/service-areas/'),
    {
      '@context': 'https://schema.org', '@type': 'Service', serviceType: 'Air conditioning installation, repair, hydro cleaning and maintenance',
      provider: { '@id': `${S.origin}/#business` },
      areaServed: allSuburbs.map((n) => ({ '@type': 'Place', name: `${n}, QLD` })),
    },
  ],
  main: `
${L.pageHero({
    crumb: 'Service areas',
    h1: 'Air conditioning across the Sunshine Coast',
    lede: 'Based in Pacific Paradise, right in the middle of the Coast, Luke covers everywhere from Caloundra to Noosa and up into the hinterland. If your suburb isn’t listed below, call anyway: chances are he can help.',
    media: `<div class="route-card"><p class="route-title">The Coast, north to south</p>${L.route()}</div>`,
    points: ['Caloundra to Noosa', 'Hinterland towns', 'Homes &amp; businesses'],
  })}

<section class="section" aria-labelledby="areas-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Where we work', title: 'Suburbs we cover', lede: 'Installs, repairs, hydro cleans and servicing are available in every suburb below, plus the streets and estates in between.', id: 'areas-title' })}
    <div class="area-grid">
      ${S.areas.map((a) => `<article class="area-card" aria-labelledby="area-${a.key}">
        <h3 id="area-${a.key}">${a.title}</h3>
        <p class="area-range">${a.range}</p>
        <p>${a.text}</p>
        <ul class="chips">${a.suburbs.map((n) => `<li class="chip${n === S.locality ? ' chip--base' : ''}">${n}${n === S.locality ? ' · our base' : ''}</li>`).join('')}</ul>
      </article>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="section section--sand" aria-labelledby="local-title">
  <div class="container split split--even">
    <div class="panel">
      <span class="ic">${icon('waves')}</span>
      <h3 id="local-title">Built for coastal conditions</h3>
      <p>Salt air and humidity are tough on air conditioners. Outdoor units corrode faster near the beach, and coils clog sooner. Luke recommends the right placement and protection on new installs, and regular <a href="/maintenance/">servicing</a> and <a href="/hydro-cleaning/">hydro cleans</a> to keep coastal systems healthy.</p>
    </div>
    <div class="panel">
      <span class="ic">${icon('sun')}</span>
      <h3>Hinterland heat, sorted</h3>
      <p>Up the range in Nambour, Palmwoods, Montville and Maleny, summers are still and sticky and winter nights get properly cool. A reverse-cycle system handles both, and Luke can size one to suit older Queenslanders and new builds alike.</p>
    </div>
  </div>
  <div class="container mt-lg">
    ${L.ctaBand({ title: 'Not sure if you’re covered?', text: 'Give Luke a call. If he can’t help, he’ll tell you straight away.' })}
  </div>
</section>

${L.quoteForm({ source: 'Service areas', heading: 'Get a free quote in your suburb', lede: `Tell Luke your suburb and what you need, and he’ll call you back. Or call ${L.NB_PHONE}.` })}
`,
};
