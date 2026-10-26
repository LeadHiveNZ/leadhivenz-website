const L = require('../layout');
const { S, icon, picture, sectionHead, checklist, eyebrow } = L;

module.exports = {
  path: '/maintenance/',
  out: 'maintenance/index.html',
  title: 'Air Con Servicing & Maintenance Sunshine Coast | Onshore Air',
  description: 'Annual air con servicing on the Sunshine Coast: filters, coil, drainage, refrigerant and electrical checks to keep your system efficient. 0444 541 409.',
  current: '/maintenance/',
  jsonld: [L.breadcrumbLd('Maintenance', '/maintenance/')],
  main: `
${L.pageHero({
    crumb: 'Maintenance',
    h1: 'Air conditioning servicing on the Sunshine Coast',
    lede: 'A yearly service keeps your system running efficiently, catches small problems before they turn into expensive ones and helps it last. Luke checks the whole system, indoors and out, and tells you plainly how it’s going.',
    media: picture('outdoor-daikin', { alt: 'Daikin outdoor unit on a courtyard wall with a neat pipe cover', sizes: '(min-width: 960px) 460px, calc(100vw - 40px)', eager: true, imgCls: 'pos-low' }),
    points: ['Indoor &amp; outdoor checks', 'Homes, rentals &amp; businesses', 'All major brands'],
  })}

<section class="section" aria-labelledby="checked-title">
  <div class="container split">
    <div>
      ${eyebrow('Annual service')}
      <h2 id="checked-title">What’s checked on a service</h2>
      <p class="lede">A proper service is more than a quick filter rinse. Here is what Luke works through on every visit.</p>
      ${checklist([
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
      ], 'checklist--2')}
    </div>
    <figure class="photo-frame">
      ${picture('gallery-twin-fan', { alt: 'Large twin-fan outdoor unit mounted against a brick wall', sizes: '(min-width: 960px) 520px, calc(100vw - 40px)' })}
      <figcaption class="photo-caption">Outdoor units work hard in coastal air. A yearly check keeps them clear and corrosion in check.</figcaption>
    </figure>
  </div>
</section>

<section class="section section--sand" aria-labelledby="benefits-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Why service it', title: 'Small job now, fewer problems later', id: 'benefits-title', center: true })}
    ${L.iconCards([
      ['dollar', 'Lower running costs', 'Clean filters and coils let the system move heat efficiently, so it uses less power to keep you comfortable.'],
      ['shield', 'Fewer breakdowns', 'Worn parts and blocked drains get picked up early, before they fail on the hottest day of the year.'],
      ['sun', 'Longer life', 'Regular care helps your system cope with salt air, humidity and long Queensland summers.'],
      ['wind', 'Healthier air', 'Less dust, mould and bacteria circulating through the rooms you live and sleep in.'],
    ], 'icon-grid--4')}
  </div>
</section>

<section class="section" aria-labelledby="who-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Who books a service', title: 'Homes, rentals and small businesses', id: 'who-title' })}
    <div class="split split--even">
      <div class="panel">
        <span class="ic">${icon('home')}</span>
        <h3>Homeowners</h3>
        <p>Book a service in late winter or spring, before the summer rush, so your system is ready when the heat arrives. Or call whenever it starts to smell, drip or isn’t cooling like it used to.</p>
      </div>
      <div class="panel">
        <span class="ic">${icon('key')}</span>
        <h3>Landlords, property managers &amp; businesses</h3>
        <p>Regular servicing keeps tenants comfortable, helps avoid breakdown call-outs and keeps your records tidy. Just let Luke know how to arrange access when you book.</p>
      </div>
    </div>
    <div class="mt-lg">
      ${L.ctaBand({ title: 'Due for a service?', text: 'If you can’t remember when it was last done, it’s probably time. Book in with Luke.' })}
    </div>
  </div>
</section>

${L.faq([
    ['How often should my air con be serviced?', 'Once a year suits most homes. Beachside homes, rentals and systems that run most days can benefit from a check every six months.'],
    ['What’s the difference between a service and a hydro clean?', 'A service is a health check of the whole system, indoors and out. A <a href="/hydro-cleaning/">hydro clean</a> is a deep wash of the indoor unit’s coil, fan and drain tray. Many people book both at the same visit.'],
    ['Do you service all brands?', 'Yes. Luke services all major brands, including Mitsubishi Electric, Fujitsu, Mitsubishi Heavy Industries, General, Hisense, Daikin and Panasonic.'],
    ['What happens if you find a problem?', 'Luke will explain what he has found, what it means and what it will cost to fix, before doing any extra work. Nothing happens without your go-ahead.'],
    ['Can you service my rental or holiday let?', 'Yes. Just let Luke know who to contact for access when you book, and he can work around tenants or guests.'],
  ], { title: 'Servicing questions', sand: true })}

${L.quoteForm({ source: 'Maintenance', service: 'Maintenance', heading: 'Book a service', lede: `Tell Luke how many systems you have and he’ll call you back to find a time. Or call ${L.NB_PHONE}.` })}
`,
};
