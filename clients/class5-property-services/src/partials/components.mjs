import { site, tel } from '../data/site.mjs';
import { testimonials } from '../data/testimonials.mjs';
import { steps } from '../data/faqs.mjs';
import { suburbs, areas } from '../data/suburbs.mjs';
import { icon } from './icons.mjs';
import { img, esc } from './util.mjs';

export const eyebrow = (t, cls = '') => `<p class="eyebrow${cls ? ' ' + cls : ''}">${t}</p>`;

export function sectionHead({ eb, h2, lede = '', id, split = false, cls = '' }) {
  return `<div class="sec-head${split ? ' sec-head-split' : ''}${cls ? ' ' + cls : ''}">
  <div>${eb ? eyebrow(eb) : ''}<h2 id="${id}">${h2}</h2></div>
  ${lede ? `<p class="lede">${lede}</p>` : ''}
</div>`;
}

export const ctas = (quoteHref = '/contact/') => `<div class="actions">
  <a class="btn btn-pink btn-lg" href="${tel}">${icon('phone')}Call ${site.phone}</a>
  <a class="btn btn-ghost btn-lg" href="${quoteHref}">Get a free quote ${icon('arrow')}</a>
</div>`;

export const trustChips = () => `<ul class="trust" aria-label="Why Class 5">
${['Owner-operated', 'Christchurch-wide', 'Free, no-obligation quotes', 'Tidy, reliable, on time'].map((t) => `  <li>${icon('check')}${t}</li>`).join('\n')}
</ul>`;

export function breadcrumb(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>
${items.map(([name, href], i) => (i === items.length - 1 ? `  <li><span aria-current="page">${name}</span></li>` : `  <li><a href="${href}">${name}</a></li>`)).join('\n')}
</ol></nav>`;
}

// Inner-page hero (dark). `aside` is optional right-column HTML.
export function pageHero({ crumbs, eb, h1, lede, aside = '', quoteHref, chips = true, cls = '' }) {
  return `<section class="phero${aside ? ' phero-split' : ''}${cls ? ' ' + cls : ''}">
  <div class="wrap phero-in">
    <div class="phero-copy">
      ${crumbs ? breadcrumb(crumbs) : ''}
      ${eyebrow(eb)}
      <h1>${h1}</h1>
      <p class="lede">${lede}</p>
      ${ctas(quoteHref)}
      ${chips ? trustChips() : ''}
    </div>
    ${aside}
  </div>
</section>`;
}

export function serviceCards(list, { headingLevel = 3, expanded = false } = {}) {
  return `<ul class="cards${expanded ? ' cards-expanded' : ''}">
${list.map((s, i) => `  <li class="card reveal">
    <a class="card-link" href="/services/${s.slug}/">
      <span class="card-top"><span class="card-ic">${icon(s.icon)}</span><span class="card-num">0${i + 1}</span></span>
      <h${headingLevel} class="card-h">${s.name}</h${headingLevel}>
      <p>${s.card}</p>
      ${expanded ? `<ul class="card-jobs">${s.jobs.slice(0, 4).map((j) => `<li>${j}</li>`).join('')}</ul>` : ''}
      <span class="card-more">Learn more ${icon('arrow')}</span>
    </a>
  </li>`).join('\n')}
</ul>`;
}

export const chipList = (items, cls = 'chips') => `<ul class="${cls}">
${items.map((t) => `  <li>${t}</li>`).join('\n')}
</ul>`;

export function beforeAfter({ caption = 'Fence restoration, Christchurch', lazy = true } = {}) {
  return `<figure class="ba">
  <div class="ba-frame">
    <div class="ba-img ba-after"><span class="ba-tag">After</span>${img('fence-after-aligned', { alt: 'After: the same fence washed and stained a rich red-brown, with the letterbox restored', sizes: '(min-width: 1280px) 1200px, 100vw', lazy })}</div>
    <div class="ba-img ba-before"><span class="ba-tag">Before</span>${img('fence-before', { alt: 'Before: a grey, weathered timber paling fence with a faded letterbox', sizes: '(min-width: 1280px) 1200px, 100vw', lazy })}</div>
    <input class="ba-range" type="range" min="0" max="100" value="50" step="1" aria-label="Before and after comparison. Move left to see more of the after photo, right to see more of the before photo">
    <span class="ba-handle" aria-hidden="true"><span class="ba-knob"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span></span>
  </div>
  <figcaption><span class="ba-cap">${caption}</span><span class="ba-hint">Drag the handle or use your arrow keys to compare</span></figcaption>
</figure>`;
}

export function faqList(faqs, id = 'faq-h') {
  return `<div class="faq">
${faqs.map(([q, a]) => `  <details class="faq-item">
    <summary><span>${q}</span>${icon('plus', 'icon faq-ic')}</summary>
    <div class="faq-a"><p>${a}</p></div>
  </details>`).join('\n')}
</div>`;
}

export function testimonialsBlock() {
  // NOTE: placeholder testimonials - see README. Replace in src/data/testimonials.mjs.
  return `<ul class="quotes">
${testimonials.map((t) => `  <li class="quote reveal">
    <figure>
      ${icon('quote', 'icon quote-ic')}
      <blockquote><p>${t.quote}</p></blockquote>
      <figcaption><strong>${t.name}</strong><span>${t.suburb} · ${t.job}</span></figcaption>
    </figure>
  </li>`).join('\n')}
</ul>`;
}

export function stepsBlock(list = steps) {
  return `<ol class="steps">
${list.map(([t, d], i) => `  <li class="step reveal"><span class="step-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${t}</h3><p>${d}</p></li>`).join('\n')}
</ol>`;
}

const suburbPage = Object.fromEntries(suburbs.map((s) => [s.name, s.slug]));
export const areaLink = (name) => (suburbPage[name] ? `<a href="/areas/${suburbPage[name]}/">${name}</a>` : `<span>${name}</span>`);

export function areaChips(list = areas) {
  return `<ul class="area-chips">
${list.map((a) => `  <li${suburbPage[a] ? ' class="has-page"' : ''}>${areaLink(a)}</li>`).join('\n')}
</ul>`;
}

export const mapEmbed = (q = 'Christchurch,New+Zealand', z = 11, title = 'Map of the Christchurch service area') => `<div class="map">
  <iframe src="https://www.google.com/maps?q=${q}&amp;z=${z}&amp;output=embed" title="${esc(title)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" width="1200" height="450"></iframe>
</div>`;

export const darkPanel = ({ kicker, statement, iconName }) => `<div class="tpanel reveal">
  ${icon(iconName, 'icon tpanel-ic')}
  <p class="tpanel-k">${kicker}</p>
  <p class="tpanel-s">${statement}</p>
  <span class="tpanel-bar" aria-hidden="true"></span>
</div>`;
