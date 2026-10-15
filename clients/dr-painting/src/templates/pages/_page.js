'use strict';
/* Builds the page object layout() expects from CONFIG.pages[key] plus overrides. */
const S = require('../schema');
module.exports = function page(C, key, extra) {
  const meta = C.pages[key];
  const p = Object.assign({ key, section: key, img: meta.img }, meta, extra);
  p.jsonld = [S.webPage(C, p)].concat(extra.jsonld || []);
  return p;
};
