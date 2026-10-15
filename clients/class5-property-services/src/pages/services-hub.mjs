import { site } from '../data/site.mjs';
import { featured, handyman, everything } from '../data/services.mjs';
import { icon } from '../partials/icons.mjs';
import { pageHero, sectionHead, serviceCards, stepsBlock } from '../partials/components.mjs';
import { graph, crumbsSchema } from '../partials/schema.mjs';

export function servicesHub() {
  const path = '/services/';
  const crumbs = [['Home', '/'], ['Services', path]];
  const body = `${pageHero({ crumbs, eb: 'Services', h1: 'Property maintenance services in Christchurch', lede: 'Six core services and a long list of small jobs, all handled by one owner-operator. Pick a service below, or send Jamie your whole list and get it quoted in one go.' })}

<section class="sec sec-white" aria-labelledby="core-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Core services', h2: 'The six jobs Jamie is called for most', id: 'core-h', split: true, lede: 'Each one has its own page with what is included, common jobs, honest answers to the usual questions and a quick way to get a quote.' })}
    ${serviceCards(featured, { expanded: true })}
  </div>
</section>

<section class="sec sec-dark everything" aria-labelledby="else-h">
  <div class="wrap everything-in">
    <div class="everything-copy">
      <p class="eyebrow">Everything else</p>
      <h2 id="else-h">Handyman &amp; small jobs</h2>
      <p class="lede">If it is part of looking after a house, it is probably on Jamie's list. Bundle a few small jobs together and get them sorted in one visit.</p>
      <a class="btn btn-pink" href="/services/${handyman.slug}/">Handyman services ${icon('arrow')}</a>
    </div>
    <ul class="jobwall">
${everything.map((j) => `      <li>${j}</li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="sec sec-white" aria-labelledby="process-h">
  <div class="wrap">
    ${sectionHead({ eb: 'How it works', h2: 'Simple from the first message', id: 'process-h' })}
    ${stepsBlock()}
  </div>
</section>`;
  return {
    path,
    title: 'Property Maintenance Services Christchurch | Class 5',
    desc: 'Class 5 services in Christchurch: TV mounting, plaster and GIB repairs, cabinetry, decks, fences and gates, rental maintenance and handyman jobs.',
    body,
    jsonld: graph(crumbsSchema(crumbs), {
      '@type': 'ItemList',
      itemListElement: [...featured, handyman].map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${site.url}/services/${s.slug}/` })),
    }),
  };
}
