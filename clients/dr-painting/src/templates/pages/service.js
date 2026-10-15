'use strict';
/* One page per CONFIG.services entry: <slug>.html */
const H = require('../helpers');
const X = require('../sections');
const S = require('../schema');
const { esc, icon, arrow, telAttr, phone } = H;

function intro(C, s) {
  const claims = H.claimList(C);
  return `
<!-- ============ INTRO ============ -->
<section class="sec" id="overview" aria-labelledby="intro-h">
  <div class="wrap intro">
    <div class="intro__copy" data-reveal>
      <p class="eyebrow">${esc(s.title)}</p>
      <h2 id="intro-h">${esc(s.headline)}</h2>
      <p class="intro__text">${esc(s.intro)}</p>
      ${claims.length ? `<div class="claims claims--light">${claims.map(([ic, t]) => `<span class="claim">${icon(ic)}${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    <aside class="incl" data-reveal style="--d:.1s" aria-labelledby="incl-h">
      <h3 id="incl-h">What's included</h3>
      <ul>${s.included.map((x) => `<li>${icon('check')}<span>${esc(x)}</span></li>`).join('')}</ul>
      <div class="incl__foot">
        <a class="btn btn--green" href="#quote">Get a free quote ${arrow}</a>
        <a class="btn btn--outline" ${telAttr(C)}>${icon('phone')}${phone(C)}</a>
      </div>
    </aside>
  </div>
</section>`;
}

function related(C, s) {
  const cards = s.related.map((id) => C.services.find((x) => x.id === id));
  return `
<!-- ============ RELATED ============ -->
<section class="sec paper-2" id="related" aria-labelledby="rel-h">
  <div class="wrap">
    <div class="sec__head sec__head--split">
      <div data-reveal>
        <p class="eyebrow">Related services</p>
        <h2 id="rel-h">Often booked together.</h2>
      </div>
      <p class="lede" data-reveal style="--d:.1s">One local team for the whole job, inside and out. Ask about combining work when we come to quote.</p>
    </div>
    <div class="svc-grid svc-grid--3">${cards.map((c, i) => X.serviceCard(C, c, i)).join('')}</div>
    <div class="sec__more" data-reveal><a class="btn btn--outline" href="services.html">All services ${arrow}</a></div>
  </div>
</section>`;
}

module.exports = (C) => C.services.map((s) => {
  const file = H.serviceFile(s);
  const name = H.serviceName(s);
  const trail = [
    { label: 'Home', href: 'index.html', file: 'index.html' },
    { label: 'Services', href: 'services.html', file: 'services.html' },
    { label: s.title, file }
  ];
  const p = {
    key: 'service-' + s.id, section: 'services', file, img: s.img, q: '#quote',
    title: s.metaTitle, description: s.metaDescription
  };
  p.jsonld = [S.webPage(C, p), S.service(C, s), S.faqPage(C, s.faqs, file), S.breadcrumbs(C, trail)];
  p.main = X.pageHero(C, { img: s.img, imgAlt: s.title, h1: `${name} in Whanganui, Manawatū & South Taranaki`, sub: s.desc, crumbs: trail, q: '#quote' })
    + intro(C, s)
    + X.processSection(C, { steps: s.steps, eyebrow: 'How we do it', h2: `${s.steps.length === 3 ? 'Three' : 'Four'} steps, done properly.` })
    + X.faqSection(C, s.faqs, { h2: `Questions about ${s.title.toLowerCase()}.`, lede: 'Straight answers to what people usually ask before booking.', more: { href: 'contact.html#faq', label: 'More questions and answers' } })
    + related(C, s)
    + X.quoteSection(C, { job: s.title });
  return p;
});
