import { site, tel } from '../data/site.mjs';
import { featured, handyman } from '../data/services.mjs';
import { icon } from './icons.mjs';

const links = [
  ['/our-work/', 'Our work'],
  ['/areas/', 'Service areas'],
  ['/about/', 'About'],
  ['/contact/', 'Contact'],
];

const cur = (path, href) => (path === href || (href !== '/' && path.startsWith(href)) ? ' aria-current="page"' : '');

export function header(path) {
  const inServices = path.startsWith('/services/');
  return `<a class="skip" href="#main">Skip to content</a>
<header class="hdr">
  <div class="wrap hdr-in">
    <a class="brand" href="/" aria-label="${site.name}, home"><img src="/images/logo-lockup.png" width="460" height="112" alt="${site.name}"></a>
    <nav class="nav" aria-label="Main">
      <ul class="nav-list">
        <li class="has-mega">
          <a class="nav-link nav-services" href="/services/"${inServices ? ' aria-current="page"' : ''}>Services</a><button class="mega-btn" type="button" aria-expanded="false" aria-controls="mega" aria-label="Show services menu">${icon('chevron')}</button>
          <div class="mega" id="mega">
            <ul class="mega-grid">
${featured.map((s) => `              <li><a class="mega-item" href="/services/${s.slug}/"${cur(path, `/services/${s.slug}/`)}>${icon(s.icon, 'icon mega-ic')}<span><strong>${s.name}</strong><small>${s.card}</small></span></a></li>`).join('\n')}
            </ul>
            <div class="mega-foot">
              <a href="/services/${handyman.slug}/">${icon('wrench')}<span><strong>Handyman &amp; small jobs</strong> Everything else on the list</span></a>
              <a class="link-arrow" href="/services/">All services ${icon('arrow')}</a>
            </div>
          </div>
        </li>
${links.map(([h, t]) => `        <li><a class="nav-link" href="${h}"${cur(path, h)}>${t}</a></li>`).join('\n')}
      </ul>
    </nav>
    <a class="btn btn-pink btn-sm hdr-call" href="${tel}">${icon('phone')}<span class="hdr-call-num">${site.phone}</span><span class="hdr-call-short">Call</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Open menu">${icon('menu')}</button>
  </div>
</header>
<div class="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Site menu" hidden>
  <div class="wrap mnav-top">
    <a class="brand" href="/" aria-label="${site.name}, home"><img src="/images/logo-lockup.png" width="460" height="112" alt="${site.name}"></a>
    <button class="menu-btn menu-close" type="button" aria-label="Close menu">${icon('close')}</button>
  </div>
  <nav class="wrap mnav-body" aria-label="Mobile">
    <p class="eyebrow">Services</p>
    <ul class="mnav-services">
${[...featured, handyman].map((s) => `      <li><a href="/services/${s.slug}/"${cur(path, `/services/${s.slug}/`)}>${icon(s.icon)}${s.name}</a></li>`).join('\n')}
    </ul>
    <ul class="mnav-links">
      <li><a href="/services/"${path === '/services/' ? ' aria-current="page"' : ''}>All services</a></li>
${links.map(([h, t]) => `      <li><a href="${h}"${cur(path, h)}>${t}</a></li>`).join('\n')}
    </ul>
    <a class="btn btn-pink btn-lg btn-block" href="${tel}">${icon('phone')}Call ${site.phone}</a>
    <a class="btn btn-ghost btn-lg btn-block" href="/contact/">Get a free quote</a>
  </nav>
</div>`;
}
