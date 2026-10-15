import { site, tel, mailto } from '../data/site.mjs';
import { featured, handyman } from '../data/services.mjs';
import { icon } from './icons.mjs';

export function footer() {
  return `<footer class="ftr" id="site-footer">
  <div class="wrap ftr-grid">
    <div class="ftr-brand">
      <a class="brand" href="/" aria-label="${site.name}, home"><img src="/images/logo-lockup.png" width="460" height="112" alt="${site.name}" loading="lazy"></a>
      <p>Owner-operated property maintenance and repairs for Christchurch homes, landlords and property managers.</p>
      <p class="ftr-tag">${site.tagline}</p>
    </div>
    <nav class="ftr-col" aria-label="Services">
      <h2 class="ftr-h">Services</h2>
      <ul>
${featured.map((s) => `        <li><a href="/services/${s.slug}/">${s.name}</a></li>`).join('\n')}
        <li><a href="/services/${handyman.slug}/">${handyman.name}</a></li>
      </ul>
    </nav>
    <nav class="ftr-col" aria-label="Company">
      <h2 class="ftr-h">Company</h2>
      <ul>
        <li><a href="/about/">About</a></li>
        <li><a href="/our-work/">Our work</a></li>
        <li><a href="/areas/">Service areas</a></li>
        <li><a href="/contact/">Contact</a></li>
      </ul>
    </nav>
    <div class="ftr-col">
      <h2 class="ftr-h">Contact</h2>
      <ul class="ftr-contact">
        <li><a href="${tel}">${icon('phone')}${site.phone}</a></li>
        <li><a href="${mailto}">${icon('mail')}${site.email}</a></li>
        <li>${icon('clock')}<span>${site.hours.map((h) => `${h.label}: ${h.value}`).join('<br>')}</span></li>
        <li>${icon('pin')}<span>${site.city}, ${site.region}</span></li>
      </ul>
    </div>
  </div>
  <div class="wrap ftr-bottom">
    <p>© ${site.year} ${site.legalName}</p>
    <p><a href="${site.leadhive}" rel="noopener">Website by LeadHive</a></p>
  </div>
</footer>`;
}
