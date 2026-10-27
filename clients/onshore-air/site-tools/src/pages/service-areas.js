const L = require('../layout');
const { S, secHead } = L;

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
  preload: L.pageHeroPreload('area-coast', true),
  main: `
${L.pageHero({
    crumb: 'Service areas',
    h1: 'Air conditioning across the Sunshine Coast',
    lede: 'I’m based in Pacific Paradise, right in the middle of the Coast, and I cover everywhere from Caloundra to Noosa and up into the hinterland. If your suburb isn’t listed, call anyway: chances are I can help.',
    photo: { name: 'area-coast', alt: 'Aerial view of the Sunshine Coast: sandbanks, river mouth and the coastline' },
    full: true,
  })}

<section class="section" aria-labelledby="areas-title">
  <div class="container">
    ${secHead({ title: 'Suburbs I cover', id: 'areas-title', intro: 'Installs, repairs, hydro cleans and servicing in every suburb below, plus the streets and estates in between.' })}
    <div class="regions">
      ${S.areas.map((a) => `<article class="region" aria-labelledby="area-${a.key}">
        <h3 id="area-${a.key}">${a.title}</h3>
        <p class="region-range">${a.range}</p>
        <p>${a.text}</p>
        <ul class="region-list">${a.suburbs.map((n) => `<li${n === S.locality ? ' class="is-base"' : ''}>${n}${n === S.locality ? ' (home base)' : ''}</li>`).join('')}</ul>
      </article>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="section on-dark" aria-labelledby="local-title">
  <div class="container">
    ${secHead({ title: 'Coast and hinterland, sorted', id: 'local-title' })}
    <div class="dark-cols">
      <div>
        <h3>Built for coastal conditions</h3>
        <p>Salt air and humidity are tough on air conditioners. Outdoor units corrode faster near the beach, and coils clog sooner. I recommend the right placement and protection on new installs, and regular <a href="/maintenance/">servicing</a> and <a href="/hydro-cleaning/">hydro cleans</a> to keep coastal systems healthy.</p>
      </div>
      <div>
        <h3>Hinterland heat</h3>
        <p>Up the range in Nambour, Palmwoods, Montville and Maleny, summers are still and sticky and winter nights get properly cool. A reverse-cycle system handles both, and I can size one to suit older Queenslanders and new builds alike.</p>
      </div>
    </div>
  </div>
</section>

${L.ctaOrange({ title: 'Not sure if you’re covered? Call Luke', text: 'If I can’t help, I’ll tell you straight away. Monday to Saturday, 7am to 5pm.' })}

${L.quoteForm({ source: 'Service areas', heading: 'Get a free quote in your suburb', lede: `Tell me your suburb and what you need, and I’ll call you back. Or call ${L.NB_PHONE}.` })}
`,
};
