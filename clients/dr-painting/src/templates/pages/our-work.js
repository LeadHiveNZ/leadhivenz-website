'use strict';
const X = require('../sections');
const S = require('../schema');
const page = require('./_page');

module.exports = (C) => {
  const q = 'contact.html#quote';
  const m = C.pages['our-work'];
  const trail = [{ label: 'Home', href: 'index.html', file: 'index.html' }, { label: 'Our Work', file: m.file }];
  return [page(C, 'our-work', {
    q,
    jsonld: [S.breadcrumbs(C, trail)],
    main: X.pageHero(C, { img: m.img, eyebrow: m.eyebrow, h1: m.h1, sub: m.sub, crumbs: trail, q })
      + X.workSection(C, q, { head: { eyebrow: 'Before and after', h2: 'See what a proper repaint does.', lede: 'Drag the slider to compare. Tap any photo below to see it larger.' }, band: true })
      + X.lightbox()
  })];
};
