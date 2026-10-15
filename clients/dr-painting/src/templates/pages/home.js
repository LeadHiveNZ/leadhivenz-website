'use strict';
const X = require('../sections');
const S = require('../schema');
const page = require('./_page');

module.exports = (C) => {
  const q = '#quote';
  const faqs = C.faqHome.map((i) => C.faq[i]);
  return [page(C, 'home', {
    q,
    jsonld: [S.business(C), S.faqPage(C, faqs, 'index.html')],
    main: X.homeHero(C, q)
      + X.servicesSection(C, q)
      + X.whySection(C)
      + X.workSection(C, q, { count: C.galleryTeaser, more: true })
      + X.lightbox()
      + X.processSection(C)
      + X.areasSection(C, { more: true })
      + X.reviewsSection(C)
      + X.faqSection(C, faqs, { more: { href: 'contact.html#faq', label: 'See all questions' } })
      + X.quoteSection(C)
  })];
};
