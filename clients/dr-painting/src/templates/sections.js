'use strict';
/* Reusable page sections. Markup and classes match the approved single-page design;
   each function takes CONFIG (C) plus options and returns an HTML string. */
const H = require('./helpers');
const { esc, icon, star, arrow, slot, telAttr, phone, serviceFile, serviceName } = H;
const travelMap = require('./map');

const SVC_SIZES = '(min-width: 1180px) 300px, (min-width: 640px) 50vw, 100vw';

/* ---------- Heroes ---------- */
function homeHero(C, q) {
  const h1 = esc(C.hero.h1).replace(/\*(.+?)\*/, '<span class="hl">$1<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14C40 6 90 4 197 9"/></svg></span>');
  return `
<!-- ============ HERO ============ -->
<section class="hero" id="top" aria-labelledby="hero-h">
  ${slot('hero', { cls: 'hero__media', eager: true, sizes: '100vw' })}
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="wrap hero__in">
    <div class="hero__copy">
      <p class="eyebrow eyebrow--light">${esc(C.hero.eyebrow)}</p>
      <h1 class="hero__h1" id="hero-h">${h1}</h1>
      <p class="hero__sub">${esc(C.hero.sub)}</p>
      <div class="hero__ctas">
        <a class="btn btn--green btn--lg" href="${q}">Get a free quote ${arrow}</a>
        <a class="btn btn--ghost btn--lg" ${telAttr(C)}>${icon('phone')}Call ${phone(C)}</a>
      </div>
      <a class="status" data-status href="${q}"></a>
    </div>
    <ul class="trust" aria-label="Why people call us">${C.trust.map((t) => `<li>${icon(t.icon)}<div><b>${esc(t.big)}</b><span>${esc(t.small)}</span></div></li>`).join('')}</ul>
  </div>
</section>`;
}

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) => i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.label)}</span></li>`
    : `<li><a href="${esc(it.href)}">${esc(it.label)}</a></li>`).join('')}</ol></nav>`;
}

/* Inner-page hero: same photo + shade treatment as the home hero, shorter, smaller H1. */
function pageHero(C, o) {
  return `
<!-- ============ PAGE HERO ============ -->
<section class="hero hero--page${o.cls ? ' ' + o.cls : ''}" id="top" aria-labelledby="hero-h">
  ${slot(o.img || 'hero', { cls: 'hero__media', eager: true, sizes: '100vw', alt: o.imgAlt || '' })}
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="wrap hero__in">
    <div class="hero__copy">
      ${o.crumbs ? crumbs(o.crumbs) : ''}
      ${o.eyebrow ? `<p class="eyebrow eyebrow--light">${esc(o.eyebrow)}</p>` : ''}
      <h1 class="hero__h1" id="hero-h">${o.h1Html || esc(o.h1)}</h1>
      ${o.sub ? `<p class="hero__sub">${esc(o.sub)}</p>` : ''}
      ${o.ctas === false ? '' : `<div class="hero__ctas">
        ${o.ctas || `<a class="btn btn--green btn--lg" href="${o.q}">Get a free quote ${arrow}</a>
        <a class="btn btn--ghost btn--lg" ${telAttr(C)}>${icon('phone')}Call ${phone(C)}</a>`}
      </div>`}
      ${o.status === false ? '' : `<a class="status" data-status href="${o.q}"></a>`}
    </div>
  </div>
</section>`;
}

/* ---------- Services ---------- */
function serviceCard(C, s, delayIdx) {
  const n = C.services.indexOf(s) + 1;
  return `
    <article class="svc${s.feature ? ' svc--feature' : ''}" data-reveal style="--d:${+((delayIdx % 4) * 0.07).toFixed(2)}s">
      <div style="position:relative">${slot(s.img, { alt: s.title, icon: s.icon, w: 800, h: 600, widths: [480, 800, 1100], sizes: SVC_SIZES })}<span class="svc__num">${String(n).padStart(2, '0')}</span></div>
      <div class="svc__body">
        ${s.feature ? `<span class="svc__tag">${esc(s.feature)}</span>` : ''}
        <h3><a href="${serviceFile(s)}">${esc(s.title)}</a></h3>
        <p>${esc(s.desc)}</p>
        <ul aria-label="What's included">${s.includes.map((x) => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul>
        <span class="svc__more" aria-hidden="true">Find out more ${icon('arrow')}</span>
      </div>
    </article>`;
}

function band(C, q, o) {
  o = o || {};
  return `
    <div class="band" data-reveal>
      <p>${esc(o.title || 'Not sure what you need?')}<span>${esc(o.text || 'Tell us what you’ve got. We’ll come and look, and give you a straight answer and a written quote.')}</span></p>
      <div class="band__ctas">
        <a class="btn btn--dark" href="${q}">Get a free quote ${arrow}</a>
        <a class="btn btn--outline" ${telAttr(C)}>${icon('phone')}${phone(C)}</a>
      </div>
    </div>`;
}

function servicesSection(C, q) {
  return `
<!-- ============ SERVICES ============ -->
<section class="sec" id="services" aria-labelledby="svc-h">
  <div class="wrap">
    <div class="sec__head sec__head--split">
      <div data-reveal>
        <p class="eyebrow">Services</p>
        <h2 id="svc-h">Painting and property care, start to finish.</h2>
      </div>
      <p class="lede" data-reveal style="--d:.1s">From a single bedroom to a full exterior repaint, plus the small handyman jobs that come with owning a home. One local team, one tidy job.</p>
    </div>
    <div class="svc-grid">${C.services.map((s, i) => serviceCard(C, s, i)).join('')}</div>
    ${band(C, q)}
  </div>
</section>`;
}

/* ---------- Why ---------- */
function whySection(C) {
  const claims = H.claimList(C);
  return `
<!-- ============ WHY ============ -->
<section class="sec dark" id="why" aria-labelledby="why-h">
  <div class="wrap why">
    <div class="why__media" data-reveal>
      ${slot('why', { alt: 'Painter rolling a fresh coat of paint onto a wall', icon: 'roller', w: 1000, h: 1250, widths: [600, 900, 1200], sizes: '(min-width: 1000px) 560px, 100vw' })}
      <div class="why__stat">
        <strong data-bind="business.years">${esc(C.business.years)}</strong>
        <span>years on the tools<small>Darren and Rich, owner-operators</small></span>
      </div>
    </div>
    <div class="why__copy">
      <div data-reveal>
        <p class="eyebrow">Why D|R</p>
        <h2 id="why-h">Two owners. <span style="white-space:nowrap">Twenty-five</span> years. No shortcuts.</h2>
        <p class="lede">When you book D|R Painting, the people who quote the job are the people who do the job. That's how it stays done right.</p>
      </div>
      <div class="pts">${C.points.map((p, i) => `
    <div class="pt" data-reveal style="--d:${+(i * 0.08).toFixed(2)}s"><div class="pt__ic">${icon(p.icon)}</div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join('')}</div>
      <div class="claims">${claims.map(([ic, t]) => `<span class="claim">${icon(ic)}${esc(t)}</span>`).join('')}</div>
    </div>
  </div>
</section>`;
}

/* ---------- Work: before/after + gallery ---------- */
function workSection(C, q, o) {
  o = o || {};
  const items = C.gallery.slice(0, o.count || C.gallery.length);
  const head = o.head || { eyebrow: 'Our work', h2: 'Good prep shows in the finish.', lede: 'Drag the slider to see what a proper repaint does for a room. A few recent finishes below.' };
  return `
<!-- ============ WORK ============ -->
<section class="sec" id="work" aria-labelledby="work-h">
  <div class="wrap">
    <div class="sec__head sec__head--split">
      <div data-reveal>
        <p class="eyebrow">${esc(head.eyebrow)}</p>
        <h2 id="work-h">${esc(head.h2)}</h2>
      </div>
      <p class="lede" data-reveal style="--d:.1s">${esc(head.lede)}</p>
    </div>
    <div data-reveal>
      <div class="ba${C.beforeAfter.simulate ? ' simulate' : ''}" data-ba>
        ${slot('after', { cls: 'ba__after', alt: 'After: freshly repainted living room' })}
        ${slot('before', { cls: 'ba__before', alt: 'Before: tired, marked walls ahead of the repaint' })}
        <span class="ba__lab ba__lab--b">Before</span>
        <span class="ba__lab ba__lab--a">After</span>
        <div class="ba__line" aria-hidden="true"></div>
        <div class="ba__knob" role="slider" tabindex="0" aria-label="Before and after comparison. Use arrow keys to compare." aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="50% before">
          <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M10 8 4 14l6 6M18 8l6 6-6 6"/></svg>
        </div>
      </div>
      <p class="ba__cap"><span><b data-bind="beforeAfter.title">${esc(C.beforeAfter.title)}</b> · <span data-bind="beforeAfter.detail">${esc(C.beforeAfter.detail)}</span></span><span>Drag or use arrow keys</span></p>
    </div>
    <div class="gal${items.length < C.gallery.length ? ' gal--teaser' : ''}" data-gallery>${items.map((g, i) => `
    <button class="gal__item" type="button" data-gi="${i}" data-reveal style="--d:${+((i % 3) * 0.08).toFixed(2)}s" aria-label="View larger: ${esc(g.title)}, ${esc(g.sub)}">
      ${slot(g.img, { alt: g.title + ', ' + g.sub, icon: 'roller', w: 1200, h: 900, widths: [600, 900, 1200], sizes: '(min-width: 900px) 50vw, 100vw' }).replace(/^<div/, '<span').replace(/<\/div>$/, '</span>')}
      <span class="gal__cap"><span><b>${esc(g.title)}</b><span>${esc(g.sub)}</span></span><span class="gal__plus">${icon('plus')}</span></span>
    </button>`).join('')}</div>
    ${o.more ? `<div class="sec__more" data-reveal><a class="btn btn--outline" href="our-work.html">See more of our work ${arrow}</a></div>` : ''}
    ${o.band ? band(C, q, { title: 'Like what you see?', text: 'Tell us about your place. We’ll come and look, and give you a straight answer and a written quote.' }) : ''}
  </div>
</section>`;
}

function lightbox() {
  return `
<dialog class="lb" id="lb" aria-label="Photo viewer">
  <button class="lb__btn lb__close" type="button" data-lb="close" aria-label="Close">${icon('x')}</button>
  <button class="lb__btn lb__prev" type="button" data-lb="prev" aria-label="Previous photo">${icon('left')}</button>
  <button class="lb__btn lb__next" type="button" data-lb="next" aria-label="Next photo">${icon('right')}</button>
  <figure class="lb__fig"><div data-lb-media></div><figcaption class="lb__cap"><span><b data-lb-t></b> <span data-lb-s></span></span><span class="lb__count" data-lb-n></span></figcaption></figure>
</dialog>`;
}

/* ---------- Process ---------- */
function processSection(C, o) {
  o = o || {};
  const steps = o.steps || C.steps;
  return `
<!-- ============ PROCESS ============ -->
<section class="sec dark dark--2" id="process" aria-labelledby="proc-h">
  <div class="wrap">
    <div class="sec__head sec__head--split">
      <div data-reveal>
        <p class="eyebrow">${esc(o.eyebrow || 'How it works')}</p>
        <h2 id="proc-h">${esc(o.h2 || 'Four steps. No surprises.')}</h2>
      </div>
      <p class="lede" data-reveal style="--d:.1s">${esc(o.lede || 'You know what\'s happening, when, and what it costs before a brush comes out.')}</p>
    </div>
    <ol class="steps${steps.length === 3 ? ' steps--3' : ''}">${steps.map((s, i) => `
    <li class="step" data-reveal style="--d:${+(i * 0.1).toFixed(2)}s"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${s.time ? `<span class="step__time">${esc(s.time)}</span>` : ''}</li>`).join('')}</ol>
  </div>
</section>`;
}

/* ---------- Areas ---------- */
function regionCards(C) {
  return C.areas.map((a, i) => `
    <div class="region" data-reveal style="--d:${+(i * 0.08).toFixed(2)}s">
      <div class="region__h"><h3>${esc(a.region)}</h3><span>${esc(a.note || '')}</span></div>
      <ul class="chips">${a.towns.map((t) => `<li class="chip${t.hub ? ' chip--hub' : ''}" data-town="${esc(t.n)}">${t.hub ? icon('pin') : ''}${esc(t.n)}</li>`).join('')}</ul>
    </div>`).join('');
}
function areasSection(C, o) {
  o = o || {};
  return `
<!-- ============ AREAS ============ -->
<section class="sec paper-2" id="areas" aria-labelledby="areas-h">
  <div class="wrap areas">
    <div>
      <div data-reveal>
        <p class="eyebrow">Service areas</p>
        <h2 id="areas-h">Based in Whanganui. Working right across the region.</h2>
        <p class="lede" style="margin-top:20px">We travel anywhere in Manawatū and South Taranaki. If your town isn't listed, call anyway. Chances are we're out your way.</p>
      </div>
      <div class="regions">${regionCards(C)}</div>
      ${o.more ? `<div class="sec__more" data-reveal><a class="btn btn--outline" href="areas.html">More about the areas we cover ${arrow}</a></div>` : ''}
    </div>
    <div class="mapcard" data-reveal style="--d:.1s">
      <div class="mapcard__tabs" role="tablist" aria-label="Map view">
        <button type="button" role="tab" id="tab-r" aria-selected="true" aria-controls="panel-r">Travel area</button>
        <button type="button" role="tab" id="tab-g" aria-selected="false" aria-controls="panel-g" tabindex="-1">Google Maps</button>
      </div>
      <div class="mapcard__panel" id="panel-r" role="tabpanel" aria-labelledby="tab-r">${travelMap(C)}</div>
      <div class="mapcard__panel" id="panel-g" role="tabpanel" aria-labelledby="tab-g" hidden data-gmap></div>
      <div class="mapcard__foot"><span>Home base: ${esc(C.business.town)}</span><a ${telAttr(C)}>${icon('phone')}Check we cover you</a></div>
    </div>
  </div>
</section>`;
}

/* ---------- Reviews ---------- */
function reviewsSection(C) {
  const cl = C.claims;
  const lede = cl.googleRating && cl.googleReviewCount
    ? `<span class="rating"><span class="stars">${star.repeat(5)}</span>${esc(cl.googleRating)} from ${esc(cl.googleReviewCount)} Google reviews</span>`
    : 'Most of our work comes from referrals and repeat customers. Here\'s why.';
  return `
<!-- ============ REVIEWS ============ -->
<section class="sec dark" id="reviews" aria-labelledby="rev-h">
  <div class="wrap">
    <div class="sec__head sec__head--split">
      <div data-reveal>
        <p class="eyebrow">Reviews</p>
        <h2 id="rev-h">What locals say about the work.</h2>
      </div>
      <p class="lede" data-reveal style="--d:.1s">${lede}</p>
    </div>
    <div class="revs">${C.reviews.map((r, i) => `
    <figure class="rev" data-reveal style="--d:${+(i * 0.1).toFixed(2)}s;margin:0">
      <svg class="rev__q" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${H.ICONS.quote}"/></svg>
      <div class="stars" role="img" aria-label="5 out of 5 stars">${star.repeat(5)}</div>
      <blockquote>${esc(r.text)}</blockquote>
      <footer><span class="rev__av" aria-hidden="true">${esc(r.name.charAt(0))}</span><span class="rev__who"><b>${esc(r.name)}</b><span>${esc(r.town)}</span></span>${r.job ? `<span class="rev__job">${esc(r.job)}</span>` : ''}</footer>
    </figure>`).join('')}</div>
  </div>
</section>`;
}

/* ---------- FAQ ---------- */
function faqSection(C, faqs, o) {
  o = o || {};
  const id = o.id || 'faq';
  return `
<!-- ============ FAQ ============ -->
<section class="sec${o.cls ? ' ' + o.cls : ''}" id="${id}" aria-labelledby="${id}-h">
  <div class="wrap faq">
    <div class="faq__aside" data-reveal>
      <p class="eyebrow">${esc(o.eyebrow || 'FAQ')}</p>
      <h2 id="${id}-h" style="margin-top:16px">${esc(o.h2 || 'Good questions, straight answers.')}</h2>
      <p class="lede">${esc(o.lede || 'The things people usually ask before booking a painter.')}</p>
      <div class="askcard">
        <p>Something else on your mind? Call or text <span data-bind="business.contactName">${esc(C.business.contactName)}</span>.</p>
        <a class="tel" ${telAttr(C)}>${icon('phone')}${phone(C)}</a>
      </div>
      ${o.more ? `<p class="faq__more"><a href="${esc(o.more.href)}">${esc(o.more.label)} ${icon('arrow')}</a></p>` : ''}
    </div>
    <div class="acc" data-reveal style="--d:.1s">${faqs.map((f, i) => {
      const open = o.openFirst && i === 0;
      return `
    <div class="acc__item${open ? ' is-open' : ''}">
      <h3 style="margin:0;font:inherit"><button class="acc__btn" type="button" id="${id}-b${i}" aria-expanded="${open}" aria-controls="${id}-p${i}">${esc(f.q)}<span class="acc__pm" aria-hidden="true"></span></button></h3>
      <div class="acc__panel" id="${id}-p${i}" role="region" aria-labelledby="${id}-b${i}"${open ? '' : ' inert'}><div><p>${esc(f.a)}</p></div></div>
    </div>`; }).join('')}</div>
  </div>
</section>`;
}

/* ---------- Quote ---------- */
function quoteSection(C, o) {
  o = o || {};
  const ticks = C.ticks.concat(C.claims.guarantee ? [C.claims.guarantee] : []);
  const towns = C.areas.map((a) => `<optgroup label="${esc(a.region)}">${a.towns.map((t) => `<option>${esc(t.n)}</option>`).join('')}</optgroup>`).join('') + '<option value="Other">Somewhere else</option>';
  const jobs = C.services.map((s) => `<option${o.job === s.title ? ' selected' : ''}>${esc(s.title)}</option>`).join('') + '<option>Something else</option>';
  const hours = o.hours ? `
      <div class="hours">
        <h3>Hours</h3>
        <ul>${H.hourGroups(C).map((g) => `<li><span>${g.label}</span><span>${g.time}</span></li>`).join('')}</ul>
        <p>Messages outside hours answered first thing.</p>
      </div>` : '';
  return `
<!-- ============ QUOTE ============ -->
<section class="sec dark" id="quote" aria-labelledby="quote-h">
  <div class="wrap quote">
    <div class="quote__copy" data-reveal>
      <p class="eyebrow">Free quote</p>
      <h2 id="quote-h">${esc(o.h2 || 'Tell us about the job. We\'ll come and take a look.')}</h2>
      <p class="lede">Send a few details and Darren or Rich will get back to you to book a time. Prefer to talk it through? Call or text.</p>
      <a class="bigtel" ${telAttr(C)}><span class="bigtel__ic">${icon('phone')}</span><span><small>Call or text</small><b data-bind="business.phoneDisplay">${esc(C.business.phoneDisplay)}</b></span></a>
      <ul class="ticks">${ticks.map((t) => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul>${hours}
      <a class="status status--solid" data-status href="#quote"></a>
    </div>
    <form class="form" id="quoteForm" novalidate data-reveal style="--d:.1s">
      <div class="form__body">
        <h3 class="form__h">Request a free quote</h3>
        <p class="form__sub">Takes about 30 seconds. No obligation.</p>
        <div class="form__grid">
          <div class="f"><label for="q-name">Name</label><input id="q-name" name="name" autocomplete="name" required><p class="f__err">Please add your name.</p></div>
          <div class="f"><label for="q-mobile">Mobile</label><input id="q-mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" placeholder="021 123 4567" required><p class="f__err">Please add a phone number we can reach you on.</p></div>
          <div class="f"><label for="q-town">Suburb / town</label><select id="q-town" name="town" required><option value="">Choose your area</option>${towns}</select><p class="f__err">Please choose your area.</p></div>
          <div class="f"><label for="q-job">Job type</label><select id="q-job" name="job" required><option value="">What needs doing?</option>${jobs}</select><p class="f__err">Please choose a job type.</p></div>
          <div class="f f--full"><label for="q-msg">Message <small>(optional)</small></label><textarea id="q-msg" name="message" placeholder="${esc(o.placeholder || 'e.g. three-bedroom weatherboard house, exterior repaint, some flaking on the north side')}"></textarea></div>
          <div class="hp" aria-hidden="true"><label for="q-company">Company</label><input id="q-company" name="company" tabindex="-1" autocomplete="off"></div>
        </div>
        <div class="form__foot">
          <button class="btn btn--green btn--lg" type="submit">Send my request ${arrow}</button>
          <p>We only use your details to reply about your quote.</p>
        </div>
        <p class="form__msg" role="alert" aria-live="assertive" data-form-msg></p>
      </div>
      <div class="done" tabindex="-1" data-done>
        <div class="done__ic">${icon('check')}</div>
        <h3>Thanks, <span data-done-name>we've got it</span>.</h3>
        <p data-done-text></p>
        <a class="btn btn--dark" ${telAttr(C)}>${icon('phone')}Call ${phone(C)}</a>
      </div>
    </form>
  </div>
</section>`;
}

/* ---------- CTA (dark) ---------- */
function ctaSection(C, q, o) {
  o = o || {};
  return `
<!-- ============ CTA ============ -->
<section class="sec dark cta" aria-labelledby="cta-h">
  <div class="wrap cta__in">
    <div data-reveal>
      <p class="eyebrow">Free quote</p>
      <h2 id="cta-h">${esc(o.h2 || 'Tell us about the job. We\'ll come and take a look.')}</h2>
      <p class="lede">${esc(o.lede || 'Free written quotes, no obligation. Darren or Rich will get back to you to book a time.')}</p>
    </div>
    <div class="cta__act" data-reveal style="--d:.1s">
      <div class="cta__btns">
        <a class="btn btn--green btn--lg" href="${q}">Get a free quote ${arrow}</a>
        <a class="btn btn--ghost btn--lg" ${telAttr(C)}>${icon('phone')}Call ${phone(C)}</a>
      </div>
      <a class="status status--solid" data-status href="${q}"></a>
    </div>
  </div>
</section>`;
}

module.exports = { homeHero, pageHero, crumbs, serviceCard, band, servicesSection, whySection, workSection, lightbox, processSection, regionCards, areasSection, reviewsSection, faqSection, quoteSection, ctaSection, serviceName };
