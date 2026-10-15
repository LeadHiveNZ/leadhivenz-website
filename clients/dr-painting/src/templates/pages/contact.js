'use strict';
const X = require('../sections');
const S = require('../schema');
const page = require('./_page');

module.exports = (C) => {
  const q = '#quote';
  const m = C.pages.contact;
  const trail = [{ label: 'Home', href: 'index.html', file: 'index.html' }, { label: 'Contact', file: m.file }];
  return [page(C, 'contact', {
    q,
    jsonld: [S.business(C), S.breadcrumbs(C, trail), S.faqPage(C, C.faq, m.file)],
    main: X.pageHero(C, { cls: 'hero--short hero--contact', img: m.img, eyebrow: m.eyebrow, h1: m.h1, sub: m.sub, crumbs: trail, q, ctas: false, status: false })
      + X.quoteSection(C, { hours: true })
      + X.faqSection(C, C.faq)
  })];
};
