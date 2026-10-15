import { site, tel, mailto } from '../data/site.mjs';
import { featured, handyman } from '../data/services.mjs';
import { areas } from '../data/suburbs.mjs';
import { icon } from '../partials/icons.mjs';
import { breadcrumb, eyebrow, mapEmbed } from '../partials/components.mjs';
import { graph, crumbsSchema } from '../partials/schema.mjs';

export function contact() {
  const path = '/contact/';
  const crumbs = [['Home', '/'], ['Contact', path]];
  const svcOptions = [...featured, handyman].map((s) => `<option value="${s.slug}">${s.name}</option>`).join('') + '<option value="other">Something else / a list of jobs</option>';
  const areaOptions = areas.map((a) => `<option>${a}</option>`).join('') + '<option>Other Christchurch suburb</option><option>Outside Christchurch</option>';

  const body = `<section class="phero phero-compact">
  <div class="wrap phero-in">
    <div class="phero-copy">
      ${breadcrumb(crumbs)}
      ${eyebrow('Contact')}
      <h1>Get a free quote</h1>
      <p class="lede">Tell Jamie what needs doing. Add a photo and you will usually get a firm written quote without a site visit.</p>
    </div>
  </div>
</section>

<section class="sec sec-white contact-sec" aria-label="Quote form and contact details">
  <div class="wrap contact">
    <form class="qform" name="quote" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thank-you/" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="form-name" value="quote">
      <p class="hp"><label>Leave this empty: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <h2 class="qform-h">Quote request</h2>
      <p class="qform-sub">Fields marked <span class="req" aria-hidden="true">*</span><span class="sr">with an asterisk</span> are required.</p>
      <div class="f-row">
        <div class="field">
          <label for="f-name">Name <span class="req" aria-hidden="true">*</span></label>
          <input id="f-name" name="name" type="text" autocomplete="name" required aria-describedby="f-name-err">
          <p class="f-err" id="f-name-err" hidden>Please tell us your name.</p>
        </div>
        <div class="field">
          <label for="f-phone">Phone <span class="req" aria-hidden="true">*</span></label>
          <input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required minlength="7" aria-describedby="f-phone-err">
          <p class="f-err" id="f-phone-err" hidden>Please enter a phone number so Jamie can call you back.</p>
        </div>
      </div>
      <div class="field">
        <label for="f-email">Email <span class="opt">(optional)</span></label>
        <input id="f-email" name="email" type="email" autocomplete="email" aria-describedby="f-email-err">
        <p class="f-err" id="f-email-err" hidden>That email address does not look quite right.</p>
      </div>
      <div class="f-row">
        <div class="field">
          <label for="f-suburb">Suburb</label>
          <select id="f-suburb" name="suburb"><option value="">Choose your suburb</option>${areaOptions}</select>
        </div>
        <div class="field">
          <label for="f-service">Service</label>
          <select id="f-service" name="service"><option value="">What do you need?</option>${svcOptions}</select>
        </div>
      </div>
      <div class="field">
        <label for="f-msg">What needs doing?</label>
        <textarea id="f-msg" name="message" rows="5" placeholder="e.g. Mount a 65 inch TV on a GIB wall in the lounge and hide the cables. Also two holes to patch where the old bracket was."></textarea>
      </div>
      <div class="field file">
        <label for="f-photo">${icon('camera')}<span><strong>Add a photo for a faster quote</strong><small>Optional. JPG or PNG, up to 8 MB.</small></span></label>
        <input id="f-photo" name="photo" type="file" accept="image/*" aria-describedby="f-photo-err">
        <p class="f-err" id="f-photo-err" hidden>That photo is over 8 MB. Please choose a smaller one, or text it to ${site.phone}.</p>
      </div>
      <div class="field check">
        <input id="f-consent" name="consent" type="checkbox" value="yes" required aria-describedby="f-consent-err">
        <label for="f-consent">I'm happy for Class 5 Property Services to contact me about this quote.&nbsp;<span class="req" aria-hidden="true">*</span></label>
        <p class="f-err" id="f-consent-err" hidden>Please tick this box so Jamie can get back to you.</p>
      </div>
      <button class="btn btn-pink btn-lg qform-submit" type="submit">Send quote request ${icon('arrow')}</button>
      <p class="qform-note">Jamie will be in touch, usually the same or next working day.</p>
    </form>

    <aside class="cdetails" aria-labelledby="cd-h">
      <h2 id="cd-h">Prefer to talk?</h2>
      <p>Call or text Jamie directly. If he is up a ladder, leave a message and he will call you back.</p>
      <a class="cd-phone" href="${tel}">${icon('phone')}${site.phone}</a>
      <ul class="cd-list">
        <li>${icon('mail')}<div><span class="cd-k">Email</span><a href="${mailto}">${site.email}</a></div></li>
        <li>${icon('clock')}<div><span class="cd-k">Hours</span>${site.hours.map((h) => `<span>${h.label}: ${h.value}</span>`).join('')}</div></li>
        <li>${icon('pin')}<div><span class="cd-k">Areas</span><span>Christchurch and surrounds, including Rolleston, Lincoln, Rangiora and Kaiapoi. <a href="/areas/">See all areas</a></span></div></li>
      </ul>
      <div class="cd-tip">
        <p class="cd-tip-h">${icon('camera')}Quote tip</p>
        <p>One wide photo showing the whole area and one close-up of the problem is perfect. For TVs, include the wall and tell Jamie the screen size.</p>
      </div>
    </aside>
  </div>
</section>

<section class="sec sec-off sec-tight" aria-labelledby="map-h">
  <div class="wrap">
    <h2 id="map-h" class="map-h">Based in Christchurch, working across Canterbury</h2>
    ${mapEmbed()}
  </div>
</section>`;
  return {
    path,
    title: 'Contact & Free Quote | Class 5 Property Services',
    desc: 'Get a free, no-obligation quote from Class 5 Property Services in Christchurch. Call Jamie on 021 704 252 or send a photo of the job with the quote form.',
    body,
    jsonld: graph(crumbsSchema(crumbs), { '@type': 'ContactPage', name: 'Contact Class 5 Property Services', url: `${site.url}${path}` }),
    noCta: true,
  };
}
