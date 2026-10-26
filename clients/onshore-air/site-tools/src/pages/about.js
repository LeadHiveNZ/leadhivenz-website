const L = require('../layout');
const { S, icon, picture, sectionHead, eyebrow } = L;

const work = [
  ['gallery-bedroom', 'Newly installed split system above a window with a roller blind', 'A bedroom split, just installed'],
  ['gallery-split-window', 'Wall split system above a bedroom window', 'A bedroom install'],
  ['repair-board', 'Air conditioner control board opened up for testing', 'Fault-finding on a control board'],
  ['gallery-fujitsu', 'Fujitsu outdoor unit with covered pipework', 'Covered pipework, done neatly'],
  ['black-split', 'Black wall-mounted split system', 'A premium black split system'],
  ['gallery-twin-fan', 'Large twin-fan outdoor unit against a brick wall', 'A larger outdoor unit'],
];

module.exports = {
  path: '/about/',
  out: 'about/index.html',
  title: 'About Luke | Onshore Air, Sunshine Coast Air Conditioning',
  description: 'Onshore Air is Luke, a licensed air con technician based in Pacific Paradise with 15+ years experience. ARC licence AU067414, fully insured.',
  current: '/about/',
  jsonld: [L.breadcrumbLd('About', '/about/')],
  main: `
${L.pageHero({
    crumb: 'About',
    h1: 'Meet Luke, the local behind Onshore Air',
    lede: 'Onshore Air is a small, local business run by Luke, an air conditioning technician with more than 15 years in the trade. Based in Pacific Paradise, he looks after homes and businesses right across the Sunshine Coast.',
    media: picture('luke-hydro-clean', { alt: 'Luke from Onshore Air at work on a split system', sizes: '(min-width: 960px) 460px, calc(100vw - 40px)', eager: true }),
    points: ['15+ years experience', 'ARC licence AU067414', 'Licensed &amp; insured'],
  })}

<section class="section" aria-labelledby="story-title">
  <div class="container split split--flip">
    <div class="prose">
      ${eyebrow('The Onshore way')}
      <h2 id="story-title">Air conditioning the way you’d want it done in your own home</h2>
      <p class="lede">Turn up when you say you will. Explain things clearly. Do neat work. Charge a fair price. That is the whole philosophy, and the reviews say it works.</p>
      <p>When you call Onshore Air, you talk to Luke. He quotes the job, does the work and is the person you call if you ever need anything afterwards. No call centre, no sales pitch, no being passed around.</p>
      <p>After 15+ years working on everything from single bedroom splits to larger multi-room systems, he knows what lasts in Sunshine Coast conditions: the humidity, the salt air and the long, hot summers. He will tell you honestly what your home needs, even when that means a smaller job than you expected.</p>
    </div>
    <figure class="photo-frame">
      ${picture('luke-cleaning-coil', { alt: 'Luke working on the coil of a wall-mounted split system', sizes: '(min-width: 960px) 520px, calc(100vw - 40px)' })}
      <figcaption class="photo-caption">Luke on a hydro clean: covers off, cleaning bag on, coil washed through.</figcaption>
    </figure>
  </div>
</section>

<section class="section section--sand" aria-labelledby="how-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'How Luke works', title: 'What customers notice', lede: 'Straight from his Google reviews.', id: 'how-title', center: true })}
    ${L.iconCards([
      ['clock', 'Reliable and on time', '“He is reliable and was on time both occasions we have used him.”'],
      ['phone', 'Easy to reach', '“He is prompt in responding to communication.”'],
      ['sparkle', 'Professional work', '“Prompt professional service. Did a fantastic job.”'],
      ['dollar', 'Fair prices', '“Fast service and great price. Very happy.”'],
    ], 'icon-grid--4')}
  </div>
</section>

<section class="section" aria-labelledby="creds-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'The paperwork', title: 'Licensed, insured and local', lede: 'The boring-but-important stuff, so you can book with confidence.', id: 'creds-title' })}
    <ul class="cred-grid">
      <li class="cred"><span class="cred-icon">${icon('badge')}</span><span class="cred-label">ARC refrigerant handling licence</span><span class="cred-value">${S.licence}</span></li>
      <li class="cred"><span class="cred-icon">${icon('shield')}</span><span class="cred-label">Cover</span><span class="cred-value">Licensed &amp; insured</span></li>
      <li class="cred"><span class="cred-icon">${icon('calendar')}</span><span class="cred-label">Experience</span><span class="cred-value">15+ years</span></li>
      <li class="cred"><span class="cred-icon">${icon('award')}</span><span class="cred-label">Every job</span><span class="cred-value">Workmanship guarantee</span></li>
      <li class="cred"><span class="cred-icon">${icon('pin')}</span><span class="cred-label">Based in</span><span class="cred-value">${S.locality} ${S.region} ${S.postcode}</span></li>
      <li class="cred"><span class="cred-icon">${icon('building')}</span><span class="cred-label">ABN</span><span class="cred-value">${S.abn}</span></li>
    </ul>
  </div>
</section>

<section class="section section--sand" aria-labelledby="work-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'On the job', title: 'A few of Luke’s recent jobs', id: 'work-title' })}
    <ul class="gallery">
      ${work.map(([img, alt, cap]) => `<li><figure>${picture(img, { alt, sizes: '(min-width: 900px) 380px, 45vw' })}<figcaption>${cap}</figcaption></figure></li>`).join('\n      ')}
    </ul>
  </div>
</section>

${L.reviews({ sand: false, title: 'Don’t just take our word for it' })}

${L.quoteForm({ source: 'About', heading: 'Talk to Luke', lede: `Have a question, or need a quote? Send the form and Luke will call you back. Or call him on ${L.NB_PHONE}.` })}
`,
};
