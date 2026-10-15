import { site } from '../data/site.mjs';
import { areas } from '../data/suburbs.mjs';
import { services } from '../data/services.mjs';

const ID = `${site.url}/#business`;

export const business = () => ({
  '@type': 'HomeAndConstructionBusiness',
  '@id': ID,
  name: site.name,
  legalName: site.legalName,
  slogan: site.tagline,
  description: site.description,
  url: `${site.url}/`,
  telephone: site.phoneSchema,
  email: site.email,
  logo: `${site.url}/images/logo-dark.png`,
  image: `${site.url}/images/class5-ute.jpg`,
  address: { '@type': 'PostalAddress', addressLocality: site.city, addressRegion: site.region, addressCountry: 'NZ' },
  areaServed: [{ '@type': 'City', name: 'Christchurch' }, ...areas.map((a) => ({ '@type': 'Place', name: `${a}, ${['Rangiora', 'Kaiapoi'].includes(a) ? 'Waimakariri' : ['Rolleston', 'Lincoln', 'Prebbleton'].includes(a) ? 'Selwyn' : 'Christchurch'}` }))],
  openingHoursSpecification: site.hoursSchema.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes })),
  knowsAbout: services.map((s) => s.name),
});

export const crumbsSchema = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site.url + href })),
});

export const faqSchema = (faqs) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

export const serviceSchema = ({ name, desc, path, area = 'Christchurch' }) => ({
  '@type': 'Service',
  name,
  serviceType: name,
  description: desc,
  url: site.url + path,
  provider: { '@id': ID },
  areaServed: { '@type': 'Place', name: area },
});

export const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': [business(), ...nodes.filter(Boolean)] });
