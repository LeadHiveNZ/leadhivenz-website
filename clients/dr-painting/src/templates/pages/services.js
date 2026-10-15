'use strict';
const X = require('../sections');
const S = require('../schema');
const page = require('./_page');

module.exports = (C) => {
  const q = 'contact.html#quote';
  const m = C.pages.services;
  const trail = [{ label: 'Home', href: 'index.html', file: 'index.html' }, { label: 'Services', file: 'services.html' }];
  return [page(C, 'services', {
    q,
    jsonld: [S.breadcrumbs(C, trail)],
    main: X.pageHero(C, { img: m.img, eyebrow: m.eyebrow, h1: m.h1, sub: m.sub, crumbs: trail, q })
      + X.servicesSection(C, q)
  })];
};
