import { site, tel } from '../data/site.mjs';
import { featured, handyman } from '../data/services.mjs';
import { icon } from '../partials/icons.mjs';
import { eyebrow } from '../partials/components.mjs';
import { graph } from '../partials/schema.mjs';

export function thankYou() {
  return {
    path: '/thank-you/',
    title: 'Thanks, Your Quote Request Is In | Class 5',
    desc: 'Thanks for getting in touch with Class 5 Property Services. Jamie will be in touch about your quote soon.',
    noindex: true,
    noCta: true,
    jsonld: graph(),
    body: `<section class="phero phero-center">
  <div class="wrap phero-in">
    <div class="phero-copy">
      <span class="done-ic">${icon('check')}</span>
      ${eyebrow('Request received')}
      <h1>Thanks, your quote request is in</h1>
      <p class="lede">Jamie will look over the details and get back to you, usually the same or next working day. If it is urgent, give him a call.</p>
      <div class="actions">
        <a class="btn btn-pink btn-lg" href="${tel}">${icon('phone')}Call ${site.phone}</a>
        <a class="btn btn-ghost btn-lg" href="/">Back to home</a>
      </div>
    </div>
  </div>
</section>`,
  };
}

export function notFound() {
  return {
    path: '/404.html',
    title: 'Page Not Found | Class 5 Property Services',
    desc: 'Sorry, that page could not be found. Find Class 5 Property Services in Christchurch or call Jamie on 021 704 252.',
    noindex: true,
    jsonld: graph(),
    body: `<section class="phero phero-center">
  <div class="wrap phero-in">
    <div class="phero-copy">
      <p class="big404" aria-hidden="true">404</p>
      ${eyebrow('Page not found')}
      <h1>That page has gone walkabout</h1>
      <p class="lede">The link may be old or mistyped. Try one of these instead, or call Jamie on <a href="${tel}">${site.phone}</a>.</p>
      <ul class="quick-links">
        <li><a href="/">Home</a></li>
        <li><a href="/services/">All services</a></li>
${[...featured, handyman].map((s) => `        <li><a href="/services/${s.slug}/">${s.name}</a></li>`).join('\n')}
        <li><a href="/contact/">Get a free quote</a></li>
      </ul>
    </div>
  </div>
</section>`,
  };
}
