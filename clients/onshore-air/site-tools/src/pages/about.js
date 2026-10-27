const L = require('../layout');
const { S, TEL, PHONE, picture, secHead, icon } = L;

const work = [
  ['gallery-bedroom', 'Newly installed split system above a window with a roller blind', 'A bedroom split, just installed'],
  ['repair-board', 'Air conditioner control board opened up for testing', 'Fault-finding on a control board'],
  ['gallery-fujitsu', 'Fujitsu outdoor unit with covered pipework', 'Covered pipework, done neatly'],
  ['gallery-white-split', 'Slimline white wall-mounted split system', 'A slimline white split'],
  ['gallery-twin-fan', 'Large twin-fan outdoor unit against a brick wall', 'A larger outdoor unit'],
  ['gallery-split-window', 'Wall split system above a bedroom window', 'A bedroom install'],
];

module.exports = {
  path: '/about/',
  out: 'about/index.html',
  title: 'About Luke | Onshore Air, Sunshine Coast Air Conditioning',
  description: 'Onshore Air is Luke, a licensed air con technician based in Pacific Paradise with 15+ years experience. ARC licence AU067414, fully insured.',
  current: '/about/',
  jsonld: [L.breadcrumbLd('About', '/about/')],
  preload: L.pageHeroPreload('hero-about'),
  main: `
${L.pageHero({
    crumb: 'About',
    h1: 'G’day, I’m Luke',
    lede: 'Onshore Air is me: a licensed air conditioning tech with more than 15 years in the trade, based in Pacific Paradise and working right across the Sunshine Coast.',
    photo: { name: 'hero-about', alt: 'Luke from Onshore Air hydro cleaning a wall-mounted split system' },
  })}

<section class="about-story" aria-labelledby="story-title">
  <!-- Photo: replace with a front-on portrait of Luke (landscape or 4:5, face visible) when he supplies one. -->
  ${picture('luke-cleaning-coil', { alt: 'Luke washing the coil of a split system, with a cleaning bag catching the water', sizes: '(min-width: 960px) 50vw, 100vw', cls: 'about-photo', cap: 720 })}
  <div class="about-copy">
    <h2 id="story-title">The way I work</h2>
    <p>When you call Onshore Air, you talk to me. I quote the job, I do the work, and I’m the one you call if you ever need anything afterwards. No call centre, no sales pitch, no being passed around.</p>
    <p>I’ve spent more than 15 years working on everything from single bedroom splits to larger multi-room systems, so I know what lasts in Sunshine Coast conditions: the humidity, the salt air and the long, hot summers. I’ll tell you honestly what your home needs, even when that means a smaller job than you expected.</p>
    <p>Turn up when I say I will, explain things clearly, do neat work and charge a fair price. That’s the whole idea, and my reviews say it works.</p>
    <div class="luke-call">
      <span>Call me on</span>
      <a class="big-phone" href="${TEL}" data-phone-link>${PHONE}</a>
    </div>
    <a class="text-link" href="/service-areas/">Where I work${icon('arrow')}</a>
  </div>
</section>

<section class="section band-grey" aria-labelledby="creds-title">
  <div class="container">
    ${secHead({ title: 'Licensed, insured and local', id: 'creds-title', intro: 'The boring but important stuff, so you can book with confidence.' })}
    ${L.trustCard({ flat: true })}
    <dl class="facts">
      <div><dt>ARC refrigerant handling licence</dt><dd>${S.licence}</dd></div>
      <div><dt>ABN</dt><dd>${S.abn}</dd></div>
      <div><dt>Based in</dt><dd>${S.locality} ${S.region} ${S.postcode}</dd></div>
      <div><dt>Hours</dt><dd>${S.hoursShort}</dd></div>
    </dl>
  </div>
</section>

<section class="section" aria-labelledby="work-title">
  <div class="container">
    ${secHead({ title: 'A few recent jobs', id: 'work-title' })}
    ${L.photoGrid(work)}
  </div>
</section>

${L.reviews({ title: 'What locals say' })}

${L.ctaOrange()}

${L.quoteForm({ source: 'About', heading: 'Talk to Luke', lede: `Got a question, or need a quote? Send the form and I’ll call you back. Or call me on ${L.NB_PHONE}.` })}
`,
};
