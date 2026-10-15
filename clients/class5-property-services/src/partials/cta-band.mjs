import { site, tel } from '../data/site.mjs';
import { icon } from './icons.mjs';

export function ctaBand() {
  return `<section class="cta-band" aria-labelledby="cta-h">
  <div class="wrap cta-in">
    <div>
      <p class="eyebrow eyebrow-ink">Free, no-obligation quotes</p>
      <h2 id="cta-h">Got a job on the list? Tell Jamie what needs doing.</h2>
      <p class="cta-sub">Send a photo for a fast quote, or call for a quick chat about the job.</p>
    </div>
    <div class="cta-actions">
      <a class="btn btn-black btn-lg" href="${tel}">${icon('phone')}Call ${site.phone}</a>
      <a class="btn btn-white btn-lg" href="/contact/">Get a free quote ${icon('arrow')}</a>
    </div>
  </div>
</section>`;
}
