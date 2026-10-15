'use strict';
const H = require('../helpers');
const X = require('../sections');
const page = require('./_page');
const { icon, arrow, telAttr, phone } = H;

module.exports = (C) => {
  const q = 'contact.html#quote';
  const m = C.pages['404'];
  const p = page(C, '404', {
    q, section: null,
    main: X.pageHero(C, {
      cls: 'hero--short hero--404', img: m.img, eyebrow: 'Error 404', q,
      h1: 'That page isn’t here.',
      sub: 'It may have moved, or the link might be wrong. Head back to the home page, or give us a call and we’ll point you in the right direction.',
      ctas: `<a class="btn btn--green btn--lg" href="index.html">Back to home ${arrow}</a>
        <a class="btn btn--ghost btn--lg" ${telAttr(C)}>${icon('phone')}Call ${phone(C)}</a>`
    })
  });
  p.jsonld = [];
  return [p];
};
