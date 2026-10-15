import { site, tel } from '../data/site.mjs';
import { bySlug } from '../data/services.mjs';
import { icon } from '../partials/icons.mjs';
import { img } from '../partials/util.mjs';
import { pageHero, sectionHead, serviceCards, chipList, faqList, stepsBlock, beforeAfter, darkPanel, eyebrow } from '../partials/components.mjs';
import { graph, crumbsSchema, faqSchema, serviceSchema } from '../partials/schema.mjs';

const serviceSteps = (s) => [
  ['Send the details', 'Call, text or use the quote form. A photo or two of the job helps Jamie price it quickly and accurately.'],
  ['Written quote', 'You get a clear, fixed quote showing exactly what is included. No obligation, and nothing starts until you say go.'],
  ['Booked and done', 'Jamie arrives on the agreed day, does the work properly and cleans up before he leaves.'],
];

function visual(s) {
  const v = s.visual;
  if (v.type === 'photo') {
    return `<figure class="svc-photo reveal">${img(v.img, { alt: v.alt, sizes: '(min-width: 1024px) 50vw, 100vw' })}<figcaption>${v.caption}</figcaption></figure>`;
  }
  if (v.type === 'gallery') {
    return `<div class="svc-gallery">
      <figure class="reveal">${img('new-fence', { alt: 'A newly built timber paling fence with painted posts running along a back lawn', sizes: '(min-width: 1024px) 30vw, 100vw' })}<figcaption>New paling fence, built along a back boundary</figcaption></figure>
      <figure class="reveal">${img('timber-gate', { alt: 'A new braced timber side gate with galvanised hinges and a bolt latch, fitted between a brick wall and an old fence', sizes: '(min-width: 1024px) 22vw, 100vw' })}<figcaption>Braced timber side gate with new hardware</figcaption></figure>
    </div>`;
  }
  return darkPanel({ kicker: v.kicker, statement: v.statement, iconName: s.icon });
}

export function servicePage(s) {
  const path = `/services/${s.slug}/`;
  const crumbs = [['Home', '/'], ['Services', '/services/'], [s.name, path]];
  const quoteHref = `/contact/?service=${s.slug}`;
  const related = s.related.map((r) => bySlug[r]);

  const body = `${pageHero({ crumbs, eb: s.eyebrow, h1: s.h1, lede: s.lede, quoteHref })}

<section class="sec sec-white" aria-labelledby="intro-h">
  <div class="wrap svc-intro">
    <div class="prose">
      <h2 id="intro-h">${s.introH2}</h2>
${s.intro.map((p) => `      <p>${p}</p>`).join('\n')}
    </div>
    <aside class="quote-card" aria-label="Get a quote">
      <span class="quote-card-ic">${icon('camera')}</span>
      <p class="quote-card-h">Send a photo for a fast quote</p>
      <p>A couple of photos and a line about the job is usually all Jamie needs to price it.</p>
      <a class="btn btn-pink btn-block" href="${quoteHref}">Get a free quote ${icon('arrow')}</a>
      <a class="btn btn-outline btn-block" href="${tel}">${icon('phone')}${site.phone}</a>
      <ul class="quote-card-list">
        <li>${icon('check')}Free, no-obligation</li>
        <li>${icon('check')}Written quote before work starts</li>
        <li>${icon('check')}Owner-operated</li>
      </ul>
    </aside>
  </div>
</section>

<section class="sec sec-off" aria-labelledby="incl-h">
  <div class="wrap">
    ${sectionHead({ eb: 'What\'s included', h2: `${s.name}: what Jamie covers`, id: 'incl-h' })}
    <ul class="incl">
${s.included.map(([t, d]) => `      <li class="reveal">${icon('check', 'icon incl-ic')}<div><h3>${t}</h3><p>${d}</p></div></li>`).join('\n')}
    </ul>
    <div class="common">
      <h3 class="common-h">Common jobs</h3>
      ${chipList(s.jobs)}
    </div>
  </div>
</section>
${s.slug === 'fences-gates-christchurch' ? `
<section class="sec sec-white" aria-labelledby="fence-ba-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Before & after', h2: 'Fence restoration, Christchurch', id: 'fence-ba-h', split: true, lede: 'The palings were sound but grey and tired. A wash, prep and stain brought the whole fence and letterbox back to life.' })}
    ${beforeAfter()}
  </div>
</section>` : ''}
${s.priceGuide ? `
<section class="sec sec-white price" aria-labelledby="price-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Pricing guide', h2: s.priceGuide.h2, lede: s.priceGuide.intro, id: 'price-h', split: true })}
    <ol class="price-list">
${s.priceGuide.items.map(([t, d], i) => `      <li class="reveal"><span class="price-n" aria-hidden="true">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('\n')}
    </ol>
  </div>
</section>` : ''}

<section class="sec sec-dark" aria-labelledby="why-h">
  <div class="wrap svc-why${s.visual.type === 'gallery' ? ' svc-why-gallery' : ''}">
    <div class="svc-why-copy">
      ${eyebrow('Why Class 5')}
      <h2 id="why-h">${s.whyH2}</h2>
${s.why.map((p) => `      <p>${p}</p>`).join('\n')}
      <ul class="ticks">
        <li>${icon('check')}One person from quote to clean-up</li>
        <li>${icon('check')}Clear written quote, no surprises</li>
        <li>${icon('check')}Christchurch local, Christchurch-wide</li>
      </ul>
    </div>
    ${visual(s)}
  </div>
</section>

<section class="sec sec-white" aria-labelledby="process-h">
  <div class="wrap">
    ${sectionHead({ eb: 'How it works', h2: 'From photo to finished', id: 'process-h' })}
    ${stepsBlock(serviceSteps(s))}
  </div>
</section>

<section class="sec sec-off" aria-labelledby="faq-h">
  <div class="wrap faq-wrap">
    <div>
      ${eyebrow(`FAQ · ${s.name}`)}
      <h2 id="faq-h">Common questions</h2>
      <p class="lede">Something else on your mind? Call Jamie on <a href="${tel}">${site.phone}</a>.</p>
    </div>
    ${faqList(s.faqs)}
  </div>
</section>

<!--wc:skip--><section class="sec sec-white" aria-labelledby="related-h">
  <div class="wrap">
    ${sectionHead({ eb: 'Related services', h2: 'Often booked together', id: 'related-h', split: true, lede: 'Most visits cover more than one job. Add these to your list and get it all quoted at once.' })}
    ${serviceCards(related)}
    <p class="center-link"><a class="link-arrow" href="/services/">View all services ${icon('arrow')}</a></p>
  </div>
</section><!--/wc:skip-->`;

  return {
    path,
    title: s.title,
    desc: s.desc,
    body,
    jsonld: graph(serviceSchema({ name: s.name, desc: s.desc, path }), crumbsSchema(crumbs), faqSchema(s.faqs)),
    wordScope: true,
  };
}
