'use strict';
const H = require('../helpers');
const X = require('../sections');
const S = require('../schema');
const page = require('./_page');
const { esc } = H;

function regionText(C) {
  return `
<!-- ============ REGIONS ============ -->
<section class="sec" id="regions" aria-labelledby="reg-h">
  <div class="wrap">
    <div class="sec__head sec__head--split">
      <div data-reveal>
        <p class="eyebrow">Where we work</p>
        <h2 id="reg-h">Three regions, one local team.</h2>
      </div>
      <p class="lede" data-reveal style="--d:.1s">Same people, same prep and the same free written quote, wherever you are.</p>
    </div>
    <div class="regtext">${C.areas.map((a, i) => `
      <article class="regtext__item" data-reveal style="--d:${+(i * 0.08).toFixed(2)}s">
        <div class="region__h"><h3>${esc(a.region)}</h3><span>${esc(a.note || '')}</span></div>
        <p>${esc(a.about)}</p>
        <p class="regtext__towns">${a.towns.map((t) => esc(t.n)).join(' · ')}</p>
      </article>`).join('')}</div>
  </div>
</section>`;
}

module.exports = (C) => {
  const q = 'contact.html#quote';
  const m = C.pages.areas;
  const trail = [{ label: 'Home', href: 'index.html', file: 'index.html' }, { label: 'Areas', file: m.file }];
  const faqs = [C.faq[C.faqTravel]].concat(C.areasFaq);
  return [page(C, 'areas', {
    q,
    jsonld: [S.breadcrumbs(C, trail), S.faqPage(C, faqs, m.file)],
    main: X.pageHero(C, { img: m.img, eyebrow: m.eyebrow, h1: m.h1, sub: m.sub, crumbs: trail, q })
      + X.areasSection(C)
      + regionText(C)
      + X.faqSection(C, faqs, { cls: 'paper-2', eyebrow: 'Travel', h2: 'Do you come out my way?', lede: 'Most likely. Here’s how travel works.', openFirst: true })
      + X.ctaSection(C, q)
  })];
};
