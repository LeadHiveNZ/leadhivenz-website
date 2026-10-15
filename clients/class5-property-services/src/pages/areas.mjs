import { site, tel } from '../data/site.mjs';
import { suburbs, areas } from '../data/suburbs.mjs';
import { featured, bySlug } from '../data/services.mjs';
import { icon } from '../partials/icons.mjs';
import { pageHero, sectionHead, areaChips, mapEmbed, areaLink, eyebrow, serviceCards } from '../partials/components.mjs';
import { graph, crumbsSchema, serviceSchema } from '../partials/schema.mjs';

export function areasHub() {
  const path = '/areas/';
  const crumbs = [['Home', '/'], ['Service areas', path]];
  const body = `${pageHero({ crumbs, eb: 'Service areas', h1: 'Service areas across Christchurch and surrounds', lede: 'Class 5 covers greater Christchurch, from the city\'s eastern beaches to the growing towns of Selwyn and Waimakariri. If your suburb is not listed, ask anyway.' })}

<section class="sec sec-white" aria-labelledby="list-h">
  <div class="wrap areas-hub">
    <div class="prose">
      ${eyebrow('Where Jamie works')}
      <h2 id="list-h">Suburbs and towns we cover</h2>
      <p>Most work is within Christchurch city, including the established suburbs of Riccarton, Papanui, Fendalton and St Albans, the newer neighbourhoods around Halswell and Wigram, and the coastal suburbs of Sumner and New Brighton.</p>
      <p>Class 5 also covers the satellite towns: Rolleston, Lincoln and Prebbleton to the south-west, and Rangiora and Kaiapoi to the north. Suburbs with their own page are highlighted.</p>
    </div>
    ${areaChips(areas)}
  </div>
</section>

<section class="sec sec-off" aria-labelledby="pages-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Local pages', h2: 'Popular areas', id: 'pages-h' })}
    <ul class="sub-cards">
${suburbs.map((s) => `      <li class="reveal"><a href="/areas/${s.slug}/">${icon('pin')}<span class="sub-name">${s.name}</span><span class="sub-lede">${s.lede}</span><span class="card-more">View ${s.name} ${icon('arrow')}</span></a></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="sec sec-white" aria-labelledby="map-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Map', h2: 'Greater Christchurch', id: 'map-h', split: true, lede: `Not sure if you are in the area? Call Jamie on <a href="${tel}">${site.phone}</a>.` })}
    ${mapEmbed()}
  </div>
</section>`;
  return {
    path,
    title: 'Service Areas Christchurch | Class 5 Property Services',
    desc: 'Class 5 Property Services covers Christchurch and surrounds: Riccarton, Papanui, Halswell, Sumner, Rolleston, Lincoln, Rangiora, Kaiapoi and more.',
    body,
    jsonld: graph(crumbsSchema(crumbs)),
  };
}

export function suburbPage(s) {
  const path = `/areas/${s.slug}/`;
  const crumbs = [['Home', '/'], ['Service areas', '/areas/'], [s.name, path]];
  const ordered = [...s.focus.map((f) => bySlug[f]), ...featured.filter((f) => !s.focus.includes(f.slug))];
  const body = `${pageHero({ crumbs, eb: `${s.name} · Christchurch`, h1: s.h1, lede: s.lede })}

<section class="sec sec-white" aria-labelledby="local-h">
  <div class="wrap sub-intro">
    <div class="prose">
      <h2 id="local-h">Your local tradie in ${s.name}</h2>
${s.intro.map((p) => `      <p>${p}</p>`).join('\n')}
    </div>
    <aside class="quote-card" aria-label="Get a quote">
      <span class="quote-card-ic">${icon('camera')}</span>
      <p class="quote-card-h">Quote for ${s.name}</p>
      <p>Send a photo of the job and your street. Jamie will come back with a written quote.</p>
      <a class="btn btn-pink btn-block" href="/contact/?suburb=${encodeURIComponent(s.name)}">Get a free quote ${icon('arrow')}</a>
      <a class="btn btn-outline btn-block" href="${tel}">${icon('phone')}${site.phone}</a>
      <div class="nearby">
        <p class="nearby-h">Also nearby</p>
        <ul>${s.nearby.map((n) => `<li>${areaLink(n)}</li>`).join('')}</ul>
      </div>
    </aside>
  </div>
</section>

<section class="sec sec-off" aria-labelledby="svc-h">
  <div class="wrap">
    ${sectionHead({ eb: `Services in ${s.name}`, h2: `What Jamie does in ${s.name}`, id: 'svc-h', split: true, lede: `All six core services are available in ${s.name}, plus general handyman work and small jobs.` })}
    ${serviceCards(ordered)}
    <p class="center-link"><a class="link-arrow" href="/areas/">All service areas ${icon('arrow')}</a></p>
  </div>
</section>`;
  return {
    path,
    title: s.title,
    desc: s.desc,
    body,
    jsonld: graph(serviceSchema({ name: `Property maintenance in ${s.name}`, desc: s.desc, path, area: s.name }), crumbsSchema(crumbs)),
    suburbWords: s.intro.join(' '),
  };
}
