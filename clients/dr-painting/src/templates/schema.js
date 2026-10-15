'use strict';
/* JSON-LD builders. Each page emits one <script type="application/ld+json"> with an @graph. */
const H = require('./helpers');

const telIntl = (C) => C.business.phoneTel.replace(/^\+64(\d{2})(\d{3})(\d{4})$/, '+64 $1 $2 $3');
const bizId = (C) => C.business.url + '#business';
const address = (C) => ({ '@type': 'PostalAddress', addressLocality: C.business.town, addressRegion: C.business.region, addressCountry: 'NZ' });
const areaServed = (C) => H.allTowns(C).map((t) => ({ '@type': 'City', name: t.n }));

function business(C) {
  const groups = H.hourGroups(C).filter((g) => g.v);
  return {
    '@type': 'HousePainter', '@id': bizId(C),
    name: C.business.name, url: C.business.url, telephone: telIntl(C),
    image: C.IMG.hero, logo: C.business.url + 'assets/logo.svg', description: C.business.blurb, priceRange: '$$',
    address: address(C),
    geo: { '@type': 'GeoCoordinates', latitude: C.business.geo.lat, longitude: C.business.geo.lng },
    areaServed: areaServed(C),
    openingHoursSpecification: groups.map((g) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: g.days.map((d) => 'https://schema.org/' + H.DFULL[d]), opens: g.v[0], closes: g.v[1] })),
    openingHours: groups.map((g) => `${H.SCHEMA_D[g.days[0]]}${g.days.length > 1 ? '-' + H.SCHEMA_D[g.days[g.days.length - 1]] : ''} ${g.v[0]}-${g.v[1]}`),
    hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Painting services', itemListElement: C.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: H.serviceName(s), description: s.desc, url: H.absUrl(C, H.serviceFile(s)) } })) }
  };
}

const provider = (C) => ({ '@type': 'HousePainter', '@id': bizId(C), name: C.business.name, telephone: telIntl(C), url: C.business.url, address: address(C) });

function service(C, s) {
  const url = H.absUrl(C, H.serviceFile(s));
  return {
    '@type': 'Service', '@id': url + '#service', name: H.serviceName(s), serviceType: H.serviceName(s),
    description: s.metaDescription, url, image: C.IMG[s.img],
    provider: provider(C),
    areaServed: C.areas.map((a) => ({ '@type': 'AdministrativeArea', name: a.region }))
  };
}

const faqPage = (C, faqs, file) => ({
  '@type': 'FAQPage', '@id': H.absUrl(C, file) + '#faq',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
});

const breadcrumbs = (C, items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.label, item: H.absUrl(C, it.file) }))
});

const webPage = (C, page) => ({
  '@type': 'WebPage', '@id': H.absUrl(C, page.file) + '#webpage', url: H.absUrl(C, page.file),
  name: page.title, description: page.description, inLanguage: 'en-NZ', about: { '@id': bizId(C) }
});

/* Serialise safely for an inline <script> */
const toScript = (graph) => JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');

module.exports = { business, provider, service, faqPage, breadcrumbs, webPage, toScript };
