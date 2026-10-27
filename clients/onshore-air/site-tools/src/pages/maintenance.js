const L = require('../layout');
const { S, picture, ticks, secHead } = L;

module.exports = {
  path: '/maintenance/',
  out: 'maintenance/index.html',
  title: 'Air Con Servicing & Maintenance Sunshine Coast | Onshore Air',
  description: `Annual air con servicing on the Sunshine Coast: filters, coil, drainage, refrigerant and electrical checks to keep your system efficient. ${S.phone.display}.`,
  current: '/maintenance/',
  jsonld: [L.breadcrumbLd('Maintenance', '/maintenance/')],
  preload: L.pageHeroPreload('hero-maintenance'),
  main: `
${L.pageHero({
    crumb: 'Maintenance',
    h1: 'Air conditioning servicing on the Sunshine Coast',
    lede: 'A yearly service keeps your system running efficiently, picks up small problems before they turn into expensive ones and helps it last. I check the whole system, indoors and out, and tell you plainly how it’s going.',
    photo: { name: 'hero-maintenance', alt: 'Daikin outdoor unit installed on a courtyard wall with neat pipework' },
  })}

<section class="section" aria-labelledby="checked-title">
  <div class="container media-split">
    ${picture('gallery-twin-fan', { alt: 'Large twin-fan outdoor unit mounted against a brick wall', sizes: '(min-width: 960px) 480px, calc(100vw - 32px)', cls: 'media-photo' })}
    <div>
      <h2 id="checked-title">What I check on a service</h2>
      <p>A proper service is more than a quick filter rinse. This is what I work through on every visit.</p>
      ${ticks([
        'Filters removed, cleaned and checked',
        'Indoor coil and fan inspected for dirt and mould',
        'Drain line and tray checked and flushed so they don’t overflow',
        'Outdoor unit cleared of leaves, sand and debris',
        'Refrigerant operation checked',
        'Electrical connections and isolator inspected',
        'Remote, modes and thermostat tested',
        'Airflow and outlet temperature measured',
        'Corrosion checked, especially on beachside units',
        'A plain-English rundown of anything that needs attention',
      ], 'ticks--2')}
    </div>
  </div>
</section>

<section class="section band-grey" aria-labelledby="benefits-title">
  <div class="container">
    ${secHead({ title: 'Small job now, fewer problems later', id: 'benefits-title' })}
    ${L.infoCards([
      ['Lower running costs', 'Clean filters and coils let the system move heat efficiently, so it uses less power to keep you comfortable.'],
      ['Fewer breakdowns', 'Worn parts and blocked drains get picked up early, before they fail on the hottest day of the year.'],
      ['Longer life', 'Regular care helps your system cope with salt air, humidity and long Queensland summers.'],
      ['Healthier air', 'Less dust, mould and bacteria circulating through the rooms you live and sleep in.'],
    ], { cols: 4, tone: 'white' })}
  </div>
</section>

<section class="section" aria-labelledby="who-title">
  <div class="container">
    ${secHead({ title: 'Homes, rentals and small businesses', id: 'who-title' })}
    <div class="tip-row tip-row--top0">
      <div class="tip">
        <h3>Homeowners</h3>
        <p>Book a service in late winter or spring, before the summer rush, so your system is ready when the heat arrives. Or call whenever it starts to smell, drip or isn’t cooling like it used to.</p>
      </div>
      <div class="tip">
        <h3>Landlords, property managers and businesses</h3>
        <p>Regular servicing keeps tenants comfortable, helps avoid breakdown call-outs and keeps your records tidy. Just let me know how to arrange access when you book.</p>
      </div>
    </div>
  </div>
</section>

${L.faq([
    ['How often should my air con be serviced?', 'Once a year suits most homes. Beachside homes, rentals and systems that run most days can benefit from a check every six months.'],
    ['What’s the difference between a service and a hydro clean?', 'A service is a health check of the whole system, indoors and out. A <a href="/hydro-cleaning/">hydro clean</a> is a deep wash of the indoor unit’s coil, fan and drain tray. Many people book both at the same visit.'],
    ['Do you service all brands?', 'Yes. I service all major brands, including Mitsubishi Electric, Fujitsu, Mitsubishi Heavy Industries, General, Hisense, Daikin and Panasonic.'],
    ['What happens if you find a problem?', 'I’ll explain what I’ve found, what it means and what it will cost to fix, before doing any extra work. Nothing happens without your go-ahead.'],
    ['Can you service my rental or holiday let?', 'Yes. Just let me know who to contact for access when you book, and I can work around tenants or guests.'],
  ], { title: 'Servicing questions' })}

${L.ctaOrange({ title: 'Due for a service? Call Luke', text: 'If you can’t remember when it was last done, it’s probably time. Monday to Saturday, 7am to 5pm.' })}

${L.quoteForm({ source: 'Maintenance', service: 'Maintenance', heading: 'Book a service', lede: `Tell me how many systems you have and I’ll call you back to find a time. Or call ${L.NB_PHONE}.` })}
`,
};
