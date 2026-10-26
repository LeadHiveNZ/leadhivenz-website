const L = require('../layout');
const { S, icon, picture, sectionHead, checklist, eyebrow } = L;

module.exports = {
  path: '/hydro-cleaning/',
  out: 'hydro-cleaning/index.html',
  title: 'Air Con Hydro Cleaning Sunshine Coast | Onshore Air',
  description: 'Split system hydro cleaning across the Sunshine Coast. Clears mould, bacteria and grime for fresher air and lower running costs. Call 0444 541 409.',
  current: '/hydro-cleaning/',
  jsonld: [L.breadcrumbLd('Hydro cleaning', '/hydro-cleaning/')],
  main: `
${L.pageHero({
    crumb: 'Hydro cleaning',
    h1: 'Air con hydro cleaning on the Sunshine Coast',
    lede: 'A filter clean only gets what you can see. A hydro clean takes the covers off and washes out the coil, fan and drain tray, clearing the mould, bacteria and grime that build up inside. Fresher air, and a system that doesn’t have to work as hard.',
    media: picture('luke-cleaning-coil', { alt: 'Luke hydro cleaning the coil of a split system, with a cleaning bag catching the water', sizes: '(min-width: 960px) 460px, calc(100vw - 40px)', eager: true }),
    points: ['Mould &amp; bacteria treatment', 'No mess', 'All major brands'],
  })}

<section class="section" aria-labelledby="what-title">
  <div class="container split">
    <div>
      ${eyebrow('What is a hydro clean?')}
      <h2 id="what-title">A deep clean for the parts you can’t reach</h2>
      <p class="lede">Hydro cleaning (also called a hydro pressure clean) is a deep clean of your indoor split system unit.</p>
      <p>Luke removes the covers and filters, fits a waterproof cleaning bag under the unit, then washes the coil, fan and drain tray with a pressure washer and a cleaning solution made for air conditioners. The dirty water runs into the bag and away, not down your wall or onto the floor.</p>
      <p>It is the only way to properly clean the barrel fan and coil fins, which is where the mould and grime that cause musty smells actually live.</p>
    </div>
    <div class="panel panel--sand">
      <h3>What’s included in every clean</h3>
      ${checklist([
        'Check the system’s operation before we start',
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

<section class="section section--sand" aria-labelledby="ba-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Before and after', title: 'What’s hiding behind the covers', lede: 'The same split system before and after a hydro clean. From the outside, it looked fine.', id: 'ba-title' })}
    <div class="ba">
      <figure class="ba-item">
        <div class="ba-photo">${picture('hydro-before', { alt: 'Split system opened up before cleaning, with mould and grime on the coil and barrel fan', sizes: '(min-width: 900px) 580px, calc(100vw - 40px)' })}<span class="ba-tag ba-tag--before">Before</span></div>
        <figcaption class="ba-body">
          <h3>Before: what builds up inside</h3>
          <ul class="ba-list">
            <li>Black mould spots on the barrel fan</li>
            <li>Dust and grime packed into the coil fins</li>
            <li>A musty smell when the system starts</li>
            <li>Weaker airflow and slower cooling</li>
          </ul>
        </figcaption>
      </figure>
      <figure class="ba-item ba-item--after">
        <div class="ba-photo">${picture('hydro-after', { alt: 'The same split system after a hydro clean, with a clean coil and fan', sizes: '(min-width: 900px) 580px, calc(100vw - 40px)' })}<span class="ba-tag ba-tag--after">After</span></div>
        <figcaption class="ba-body">
          <h3>After: what you get back</h3>
          <ul class="ba-list">
            <li>Coil and fan washed clean</li>
            <li>Drain tray flushed so it drains freely</li>
            <li>Fresher-smelling air in the room</li>
            <li>Full airflow and less strain on the system</li>
          </ul>
        </figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="why-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Why it matters', title: 'Cleaner air, lower running costs', lede: 'Air conditioners pull in dust, pet hair, salt and moisture every day. Over time, that gunk becomes a breeding ground inside the unit.', id: 'why-title' })}
    ${L.iconCards([
      ['leaf', 'Mould', 'The coil and fan are dark and damp, exactly where mould grows. Every time the system runs, it can blow spores into the room.'],
      ['heart', 'Bacteria &amp; allergens', 'Dust, pet hair and bacteria collect on the coil and fan. Clearing them out helps if anyone at home has asthma or allergies.'],
      ['gauge', 'Efficiency', 'A clogged coil can’t move heat properly, so the system works harder and longer to reach the same temperature.'],
      ['dollar', 'Power bills', 'A system that works harder uses more electricity. A clean unit runs more efficiently, which helps keep running costs down.'],
    ], 'icon-grid--4')}
  </div>
</section>

<section class="section section--sand" aria-labelledby="who-title">
  <div class="container split split--wide">
    <div>
      ${eyebrow('Who it’s for')}
      <h2 id="who-title">Worth doing for most homes, essential for some</h2>
      ${L.iconCards([
        ['key', 'Rental properties', 'A clean between tenancies or before an inspection keeps units healthy and tenants happy.'],
        ['heart', 'Allergy &amp; asthma households', 'Less dust, mould and bacteria blowing around the rooms you sleep and live in.'],
        ['waves', 'Beachside homes', 'Salt air, sand and humidity mean faster build-up in coastal suburbs like Mudjimba, Marcoola, Twin Waters and Peregian.'],
        ['users', 'Homes with pets', 'Pet hair and dander clog filters and coils faster than you would expect.'],
      ])}
    </div>
    <div class="stack">
      <div class="panel">
        <span class="ic">${icon('calendar')}</span>
        <h3>How often?</h3>
        <p>Once a year is a good rule of thumb for most homes. Clean more often if you are beachside, have pets, run the system most days, or anyone at home has allergies or asthma.</p>
      </div>
      <div class="panel">
        <span class="ic">${icon('sparkle')}</span>
        <h3>Do you need one? Check in 30 seconds</h3>
        <p>Turn the unit off. Gently open the front louvres (the flaps) and shine a torch inside at the barrel-shaped fan. If you see black spots or a furry build-up, that is mould, and it’s time for a hydro clean.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="price-title">
  <div class="container">
    <div class="price-band">
      <div class="price-copy">
        ${eyebrow('Pricing')}
        <h2 id="price-title">Straightforward pricing</h2>
        <p>A standard wall-mounted split system at standard height is <strong>$180 + GST</strong>, and takes about an hour. Booking several units? Ask about the multi-unit discount. High-set, ceiling or larger units are quoted individually.</p>
      </div>
      <div class="price-card" aria-label="Hydro clean price">
        <p class="price-label">Hydro clean, per standard wall split</p>
        <p class="price-amount"><span>$180</span> + GST</p>
        <p class="price-note">About an hour per unit · multi-unit discounts</p>
      </div>
    </div>
    <div class="mt-lg">
      ${L.ctaBand({ title: 'Smelling something musty?', text: 'Book a hydro clean and breathe easier. Luke will tell you on the day if anything else needs attention.' })}
    </div>
  </div>
</section>

${L.faq([
    ['How long does a hydro clean take?', 'About an hour for a standard wall-mounted split system. If you are booking several units, Luke will give you a time estimate for the whole job when you book.'],
    ['Will it make a mess?', 'No. A waterproof cleaning bag catches all the dirty water under the unit and the floor is protected. You are left with a clean unit and a clean room.'],
    ['Is the cleaning solution safe?', 'Yes. Luke uses non-toxic mould and bacteria treatments designed for air conditioners, and everything is rinsed through before the unit goes back together.'],
    ['Can’t I just clean the filters myself?', 'You should rinse the filters every few weeks, and it helps. But the coil, fan and drain tray sit behind the covers and need the unit partly taken apart and washed with the right gear. That is the part a hydro clean does.'],
    ['Why not just book a cheap clean?', 'Some budget cleans don’t remove the covers or use the wrong chemicals, which leaves mould behind inside the unit. A proper hydro clean takes the unit apart, treats the mould and washes it out.'],
    ['Do you clean all brands?', 'Yes. Luke cleans all the major brands, including Daikin, Panasonic, Mitsubishi Heavy Industries, Mitsubishi Electric, Hisense, Hitachi, TCL, Fujitsu and LG.'],
  ], { title: 'Hydro cleaning questions', sand: true })}

${L.quoteForm({ source: 'Hydro cleaning', service: 'Hydro clean', heading: 'Book a hydro clean', lede: `Let Luke know how many units you have and roughly where they are, and he’ll call you back to book a time. Or call ${L.NB_PHONE}.` })}
`,
};
