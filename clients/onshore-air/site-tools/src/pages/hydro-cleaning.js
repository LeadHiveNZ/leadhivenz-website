const L = require('../layout');
const { S, ticks, secHead, callBtn } = L;

module.exports = {
  path: '/hydro-cleaning/',
  out: 'hydro-cleaning/index.html',
  title: 'Air Con Hydro Cleaning Sunshine Coast | Onshore Air',
  description: `Split system hydro cleaning across the Sunshine Coast. Clears mould, bacteria and grime for fresher air and lower running costs. Call ${S.phone.display}.`,
  current: '/hydro-cleaning/',
  jsonld: [L.breadcrumbLd('Hydro cleaning', '/hydro-cleaning/')],
  preload: L.pageHeroPreload('hero-hydro'),
  main: `
${L.pageHero({
    crumb: 'Hydro cleaning',
    h1: 'Air con hydro cleaning on the Sunshine Coast',
    lede: 'A filter clean only gets what you can see. I take the covers off and wash out the coil, fan and drain tray, clearing the mould, bacteria and grime that build up inside. $180 + GST per standard wall split.',
    photo: { name: 'hero-hydro', alt: 'Split system opened up for a hydro clean, with a waterproof cleaning bag fitted under the unit' },
  })}

<section class="section" aria-labelledby="what-title">
  <div class="container text-split">
    <div>
      <h2 id="what-title">A deep clean for the parts you can’t reach</h2>
      <p>A hydro clean (also called a hydro pressure clean) is a deep clean of your indoor split system unit.</p>
      <p>I take off the covers and filters, fit a waterproof cleaning bag under the unit, then wash the coil, fan and drain tray with a pressure washer and a cleaning solution made for air conditioners. The dirty water runs into the bag and away, not down your wall or onto the floor.</p>
      <p>It’s the only way to properly clean the barrel fan and coil fins, which is where the mould and grime that cause musty smells actually live.</p>
    </div>
    <div class="panel">
      <h3>What’s included in every clean</h3>
      ${ticks([
        'Check the system’s operation before I start',
        'Remove the indoor covers and filters for a deep clean',
        'Hydro clean the coil, fan and drain pan with cleaning chemicals and a pressure washer',
        'Mould and bacteria treatment using non-toxic solutions',
        'Dry the covers, filters and indoor unit',
        'Reassemble the indoor unit',
        'Re-check the system’s operation',
        'Clear debris from the outdoor unit (if accessible)',
      ])}
    </div>
  </div>
</section>

${L.hydroBand({ title: 'What’s hiding behind the covers', intro: 'The same split system before and after a hydro clean. From the outside, it looked fine.', link: false })}

<section class="section" aria-labelledby="why-title">
  <div class="container">
    ${secHead({ title: 'Cleaner air, lower running costs', id: 'why-title', intro: 'Air cons pull in dust, pet hair, salt and moisture every day. Over time that gunk becomes a breeding ground inside the unit.' })}
    ${L.infoCards([
      ['Mould', 'The coil and fan are dark and damp, exactly where mould grows. Every time the system runs, it can blow spores into the room.'],
      ['Bacteria and allergens', 'Dust, pet hair and bacteria collect on the coil and fan. Clearing them out helps if anyone at home has asthma or allergies.'],
      ['Efficiency', 'A clogged coil can’t move heat properly, so the system works harder and longer to reach the same temperature.'],
      ['Power bills', 'A system that works harder uses more electricity. A clean unit runs more efficiently, which helps keep running costs down.'],
    ], { cols: 4, tone: 'grey' })}
  </div>
</section>

<section class="section band-grey" aria-labelledby="who-title">
  <div class="container">
    ${secHead({ title: 'Worth doing for most homes, essential for some', id: 'who-title' })}
    ${L.infoCards([
      ['Rental properties', 'A clean between tenancies or before an inspection keeps units healthy and tenants happy.'],
      ['Allergy and asthma households', 'Less dust, mould and bacteria blowing around the rooms you sleep and live in.'],
      ['Beachside homes', 'Salt air, sand and humidity mean faster build-up in coastal suburbs like Mudjimba, Marcoola, Twin Waters and Peregian.'],
      ['Homes with pets', 'Pet hair and dander clog filters and coils faster than you’d expect.'],
    ], { cols: 4, tone: 'white' })}
    <div class="tip-row">
      <div class="tip">
        <h3>How often?</h3>
        <p>Once a year is a good rule of thumb for most homes. Clean more often if you’re beachside, have pets, run the system most days, or anyone at home has allergies or asthma.</p>
      </div>
      <div class="tip">
        <h3>Do you need one? Check in 30 seconds</h3>
        <p>Turn the unit off. Gently open the front louvres (the flaps) and shine a torch inside at the barrel-shaped fan. If you see black spots or a furry build-up, that’s mould, and it’s time for a hydro clean.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="price-title">
  <div class="container">
    <div class="price-block">
      <div class="price-block-amount">
        <p class="price-block-label">Hydro clean, per standard wall split</p>
        <p class="price-block-num"><strong>$180</strong><span>+ GST</span></p>
        <p class="price-block-note">About an hour per unit. Multi-unit discounts.</p>
      </div>
      <div class="price-block-copy">
        <h2 id="price-title">Simple pricing</h2>
        <p>A standard wall-mounted split system at standard height is $180 + GST and takes about an hour. Booking several units? Ask about the multi-unit discount. High-set, ceiling or larger units are quoted individually.</p>
        <div class="cta-row">${callBtn('', 'Call Luke')}<a class="text-link" href="#quote">Book online${L.icon('arrow')}</a></div>
      </div>
    </div>
  </div>
</section>

${L.faq([
    ['How long does a hydro clean take?', 'About an hour for a standard wall-mounted split system. If you’re booking several units, I’ll give you a time estimate for the whole job when you book.'],
    ['Will it make a mess?', 'No. A waterproof cleaning bag catches all the dirty water under the unit and the floor is protected. You’re left with a clean unit and a clean room.'],
    ['Is the cleaning solution safe?', 'Yes. I use non-toxic mould and bacteria treatments designed for air conditioners, and everything is rinsed through before the unit goes back together.'],
    ['Can’t I just clean the filters myself?', 'You should rinse the filters every few weeks, and it helps. But the coil, fan and drain tray sit behind the covers and need the unit partly taken apart and washed with the right gear. That’s the part a hydro clean does.'],
    ['Why not just book a cheap clean?', 'Some budget cleans don’t remove the covers or use the wrong chemicals, which leaves mould behind inside the unit. A proper hydro clean takes the unit apart, treats the mould and washes it out.'],
    ['Do you clean all brands?', 'Yes. I clean all the major brands, including Daikin, Panasonic, Mitsubishi Heavy Industries, Mitsubishi Electric, Hisense, Hitachi, TCL, Fujitsu and LG.'],
  ], { title: 'Hydro cleaning questions' })}

${L.ctaOrange({ title: 'Smelling something musty? Call Luke', text: 'Book a hydro clean and breathe easier. Monday to Saturday, 7am to 5pm.' })}

${L.quoteForm({ source: 'Hydro cleaning', service: 'Hydro clean', heading: 'Book a hydro clean', lede: `Let me know how many units you have and roughly where they are, and I’ll call you back to book a time. Or call ${L.NB_PHONE}.` })}
`,
};
