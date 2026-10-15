import { site, tel } from '../data/site.mjs';
import { featured, handyman, everything } from '../data/services.mjs';
import { homeFaqs, whyPoints } from '../data/faqs.mjs';
import { icon } from '../partials/icons.mjs';
import { img } from '../partials/util.mjs';
import { sectionHead, serviceCards, beforeAfter, faqList, testimonialsBlock, stepsBlock, areaChips, trustChips, eyebrow } from '../partials/components.mjs';
import { graph, faqSchema } from '../partials/schema.mjs';

export function home() {
  const body = `<section class="hero">
  <div class="hero-media">${img('ute', { alt: 'The black Class 5 Property Services ute, sign-written with the business name, phone number and email', sizes: '100vw', lazy: false, priority: true })}</div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      ${eyebrow('Christchurch property maintenance')}
      <h1>One tradie for <span class="hl">every job</span> on your property</h1>
      <p class="lede">From TV wall mounting and plaster repairs to decks, fences and custom cabinetry, Jamie handles the whole list so you don't have to juggle five different trades.</p>
      <div class="actions">
        <a class="btn btn-pink btn-lg" href="${tel}">${icon('phone')}Call ${site.phone}</a>
        <a class="btn btn-ghost btn-lg" href="/contact/">Get a free quote ${icon('arrow')}</a>
      </div>
      ${trustChips()}
    </div>
  </div>
</section>

<section class="sec sec-white" aria-labelledby="services-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Services', h2: 'What Jamie can do for your place', lede: 'Six things Christchurch homeowners and landlords call about most. If your job is not here, it is probably on the list further down.', id: 'services-h', split: true })}
    ${serviceCards(featured)}
  </div>
</section>

<section class="sec sec-dark everything" aria-labelledby="everything-h">
  <div class="wrap everything-in">
    <div class="everything-copy">
      ${eyebrow('And everything in between')}
      <h2 id="everything-h">Everything property maintenance</h2>
      <p class="lede">The jobs that sit on the fridge list for months. Most of them take an hour or two, and they are far easier to sort in one visit than to chase five different trades for.</p>
      <a class="link-arrow link-light" href="/services/${handyman.slug}/">Handyman &amp; small jobs ${icon('arrow')}</a>
    </div>
    <ul class="jobwall">
${everything.map((j) => `      <li>${j}</li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="sec sec-off" aria-labelledby="ba-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Recent work', h2: 'Same fence. Different street appeal.', lede: 'A grey, weathered paling fence washed back and stained. No new timber needed, just the right prep and a proper finish.', id: 'ba-h', split: true })}
    ${beforeAfter()}
    <p class="center-link"><a class="link-arrow" href="/our-work/">See more of Jamie's work ${icon('arrow')}</a></p>
  </div>
</section>

<section class="sec sec-white" aria-labelledby="why-h">
  <div class="wrap why">
    <div class="why-head">
      ${eyebrow('Why Class 5')}
      <h2 id="why-h">The tradie you keep in your phone</h2>
      <p class="lede">No call centre, no franchise, no subcontractors. Just Jamie, his ute and a straightforward way of working.</p>
      <figure class="why-photo reveal">${img('new-fence', { alt: 'A new timber paling fence built by Class 5, with painted posts along a back lawn', sizes: '(min-width: 1024px) 40vw, 100vw' })}<figcaption>New paling fence, built and set out by Jamie</figcaption></figure>
    </div>
    <ol class="why-list">
${whyPoints.map(([t, d], i) => `      <li class="reveal"><span class="why-n" aria-hidden="true">0${i + 1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="sec sec-dark" aria-labelledby="how-h">
  <div class="wrap">
    ${sectionHead({ eb: 'How it works', h2: 'Three steps to a shorter to-do list', id: 'how-h', split: true, lede: 'Photos are the fastest way to a price. Snap the job, add a line about what you need, and Jamie will come back to you.' })}
    ${stepsBlock()}
  </div>
</section>

<section class="sec sec-off" aria-labelledby="reviews-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Kind words', h2: 'What customers say', id: 'reviews-h' })}
    ${testimonialsBlock()}
  </div>
</section>

<section class="sec sec-white" aria-labelledby="areas-h">
  <div class="wrap areas-teaser">
    <div>
      ${eyebrow('Service areas')}
      <h2 id="areas-h">Christchurch and surrounds</h2>
      <p class="lede">From Sumner to Rolleston and Halswell to Rangiora. If you are in greater Christchurch, Jamie can get to you.</p>
      <a class="link-arrow" href="/areas/">All service areas ${icon('arrow')}</a>
    </div>
    ${areaChips()}
  </div>
</section>

<section class="sec sec-off" aria-labelledby="faq-h">
  <div class="wrap faq-wrap">
    <div>
      ${eyebrow('FAQ')}
      <h2 id="faq-h">Common questions</h2>
      <p class="lede">Anything else? Call Jamie on <a href="${tel}">${site.phone}</a>.</p>
    </div>
    ${faqList(homeFaqs)}
  </div>
</section>`;

  return {
    path: '/',
    title: 'Handyman & Property Maintenance Christchurch | Class 5',
    desc: 'Christchurch property maintenance by owner-operator Jamie. TV mounting, GIB repairs, cabinetry, decks, fences and the whole to-do list. Free quotes.',
    body,
    jsonld: graph({ '@type': 'WebSite', '@id': `${site.url}/#website`, url: `${site.url}/`, name: site.name, publisher: { '@id': `${site.url}/#business` } }, faqSchema(homeFaqs)),
    preload: `<link rel="preload" as="image" href="/images/ute-1600.jpg" imagesrcset="/images/ute-1600.jpg 1600w, /images/ute-800.jpg 800w" imagesizes="100vw" fetchpriority="high">\n`,
  };
}
