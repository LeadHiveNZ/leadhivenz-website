'use strict';
const X = require('../sections');
const S = require('../schema');
const page = require('./_page');

module.exports = (C) => {
  const q = 'contact.html#quote';
  const m = C.pages.about;
  const trail = [{ label: 'Home', href: 'index.html', file: 'index.html' }, { label: 'About', file: m.file }];
  return [page(C, 'about', {
    q,
    jsonld: [S.breadcrumbs(C, trail)],
    main: X.pageHero(C, { img: m.img, eyebrow: m.eyebrow, h1: m.h1, sub: m.sub, crumbs: trail, q })
      + X.whySection(C)
      + X.processSection(C)
      + X.reviewsSection(C)
      + `
<!-- ============ CTA BAND ============ -->
<section class="sec sec--band" aria-label="Get a free quote">
  <div class="wrap">${X.band(C, q, { title: 'Want Darren and Rich to take a look?', text: 'Tell us about the job. We’ll come out, look it over properly and give you a free written quote.' })}
  </div>
</section>`
  })];
};
