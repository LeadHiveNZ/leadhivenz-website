import { site, tel } from '../data/site.mjs';
import { icon } from '../partials/icons.mjs';
import { img } from '../partials/util.mjs';
import { pageHero, sectionHead, eyebrow } from '../partials/components.mjs';
import { graph, crumbsSchema } from '../partials/schema.mjs';

const values = [
  ['list', 'Straight answers', 'If a repair will not last, or a job needs a different trade, Jamie will tell you before you spend money on it.'],
  ['shield', 'Done properly', 'Fixed into framing, set out with a level, the right timber for the job. The parts you cannot see matter most.'],
  ['clock', 'On time', 'Turning up when agreed, and keeping you posted if something changes. It should be normal; it is not always.'],
  ['broom', 'Left tidy', 'Drop sheets down, dust vacuumed, offcuts gone. You should only notice that the job is done.'],
];

export function about() {
  const path = '/about/';
  const crumbs = [['Home', '/'], ['About', path]];
  const body = `${pageHero({ crumbs, eb: 'About Class 5', h1: 'About Jamie and Class&nbsp;5 Property Services', lede: 'A Christchurch owner-operator who takes on the whole property maintenance list, and takes pride in leaving every job tidy.' })}

<section class="sec sec-white" aria-labelledby="story-h">
  <div class="wrap about-story">
    <div class="prose">
      ${eyebrow('The short version')}
      <h2 id="story-h">One tradie, the whole list</h2>
      <p>Class 5 Property Services is Jamie's business. He is a Christchurch local and a practical all-rounder who set up Class 5 for a simple reason: most homes do not need five different trades, they need one reliable person who can work through the list.</p>
      <p>So that is how Class 5 works. The same person answers the phone, writes the quote, turns up to do the job and cleans up afterwards. Whether it is a TV on the wall, a patched-up hallway, a new side gate or a deck that has seen better days, you deal with Jamie from start to finish.</p>
      <p>The name says it too. <strong>Maintenance, repairs and property care</strong>: looking after homes properly, for homeowners, landlords and property managers right across Christchurch and surrounds.</p>
      <p>When a job needs a licensed electrician, plumber or another specialist, Jamie will say so upfront and work alongside them, rather than take on something that is not his to do.</p>
    </div>
    <figure class="about-photo reveal">${img('ute', { alt: 'Jamie\'s black Ford Ranger ute, sign-written with Class 5 Property Services, 021 704 252 and jamie@class5services.co.nz', sizes: '(min-width: 1024px) 45vw, 100vw' })}<figcaption>You will know the ute when it pulls up.</figcaption></figure>
  </div>
</section>

<section class="sec sec-dark" aria-labelledby="values-h">
  <div class="wrap">
    ${sectionHead({ eb: 'How Jamie works', h2: 'Four things you can count on', id: 'values-h' })}
    <ul class="values">
${values.map(([ic, t, d]) => `      <li class="reveal">${icon(ic, 'icon values-ic')}<h3>${t}</h3><p>${d}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="sec sec-white" aria-labelledby="who-h">
  <div class="wrap who">
    ${sectionHead({ eb: 'Who Jamie works for', h2: 'Homeowners, landlords and property managers', id: 'who-h' })}
    <ul class="who-list">
      <li class="reveal"><h3>Homeowners</h3><p>The to-do list, the improvement you have been meaning to make, and the repairs that crop up. <a href="/services/handyman-christchurch/">Handyman services</a></p></li>
      <li class="reveal"><h3>Landlords</h3><p>Repairs between tenancies and the requests that come in during one, with photos sent through. <a href="/services/rental-property-maintenance-christchurch/">Rental maintenance</a></p></li>
      <li class="reveal"><h3>Property managers</h3><p>One reliable contact for maintenance across your portfolio, working to your process. <a href="/contact/">Get in touch</a></p></li>
    </ul>
  </div>
</section>`;
  return {
    path,
    title: 'About Jamie | Class 5 Property Services Christchurch',
    desc: 'Meet Jamie, the owner-operator behind Class 5 Property Services. One Christchurch tradie for maintenance, repairs and property care. Tidy, reliable work.',
    body,
    jsonld: graph(crumbsSchema(crumbs), { '@type': 'AboutPage', name: 'About Class 5 Property Services', url: `${site.url}${path}`, about: { '@id': `${site.url}/#business` } }),
  };
}
