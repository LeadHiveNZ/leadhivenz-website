import { site, tel } from '../data/site.mjs';
import { icon } from './icons.mjs';

export function stickyBar() {
  return `<div class="mbar" id="mbar">
  <a class="btn btn-pink" href="${tel}">${icon('phone')}Call ${site.phone}</a>
  <a class="btn btn-ghost" href="/contact/">Get a quote</a>
</div>`;
}
