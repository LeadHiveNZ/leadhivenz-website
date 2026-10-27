const L = require('../layout');
const { S, picture, ticks, secHead } = L;

const gallery = [
  ['gallery-split-window', 'Wall split system above a bedroom window', 'Wall split above a bedroom window'],
  ['gallery-white-split', 'Slimline white wall-mounted split system', 'Slimline white wall split'],
  ['gallery-bedroom', 'Newly installed split system above a window with a roller blind', 'Bedroom split, just installed'],
  ['gallery-twin-fan', 'Large twin-fan outdoor unit against a brick wall', 'Twin-fan outdoor unit for a larger system'],
  ['gallery-fujitsu', 'Fujitsu outdoor unit with covered pipework running up the wall', 'Fujitsu outdoor unit, pipework covered'],
  ['gallery-daikin-pipe', 'Daikin outdoor unit on a courtyard wall with a neat pipe cover', 'Daikin outdoor unit, neat pipe cover'],
];

module.exports = {
  path: '/installations/',
  out: 'installations/index.html',
  title: 'Air Conditioning Installation Sunshine Coast | Onshore Air',
  description: `Split system, multi-head and ducted air conditioning installed across the Sunshine Coast by a licensed local tech. Free quotes. Call ${S.phone.display}.`,
  current: '/installations/',
  jsonld: [L.breadcrumbLd('Installations', '/installations/')],
  preload: L.pageHeroPreload('hero-installations'),
  main: `
${L.pageHero({
    crumb: 'Installations',
    h1: 'Air conditioning installation on the Sunshine Coast',
    lede: 'New build, renovation or swapping out a tired old unit. I size the system to the room, install it neatly and show you how to get the best out of it. Free quotes and a workmanship guarantee.',
    photo: { name: 'hero-installations', alt: 'Black wall-mounted split system installed by Onshore Air' },
  })}

<section class="section band-grey" aria-labelledby="types-title">
  <div class="container">
    ${secHead({ title: 'Split, multi-head or ducted', id: 'types-title', intro: 'One cool bedroom or the whole house: I’ll recommend what suits your home and budget.' })}
    ${L.infoCards([
      ['Split systems', 'The go-to for bedrooms, living areas and granny flats. Quiet inverter units sized to the room, so they aren’t running flat out every summer afternoon.'],
      ['Multi-head systems', 'Two or more indoor units running off one outdoor unit. Handy when you want several rooms cooled but only have space for one condenser.'],
      ['Ducted systems', 'Ceiling vents through the house, zoned so you only cool the rooms you’re using. Suits larger and two-storey homes.'],
      ['New builds and replacements', 'I can plan unit locations and pipe runs with you or your builder before the walls close in, or swap an old system for a new one with minimal fuss.'],
    ], { cols: 4, tone: 'white' })}
  </div>
</section>

<section class="section" aria-labelledby="included-title">
  <div class="container media-split">
    ${picture('outdoor-weatherboard', { alt: 'Outdoor unit installed beside a weatherboard home with a covered pipe run', sizes: '(min-width: 960px) 480px, calc(100vw - 32px)', cls: 'media-photo' })}
    <div>
      <h2 id="included-title">What you get with every install</h2>
      <p>A good install is the difference between a system that runs quietly for years and one that struggles from day one. This is what I do on every job.</p>
      ${ticks([
        'A free quote with honest advice on size, brand and where the units should go',
        'A system sized to the room, its insulation and how much sun it gets',
        'Indoor and outdoor units mounted level and secure',
        'Neat pipe runs, with covers where they’re on show',
        'Drainage set up properly, so it won’t drip down your wall',
        'Commissioning and testing before I leave',
        'A walk-through of the remote and the settings that save power',
        'Clean-up before I go, and a workmanship guarantee',
      ], 'ticks--lg')}
    </div>
  </div>
</section>

<section class="section on-dark steps-band" aria-labelledby="process-title">
  <div class="container">
    ${secHead({ title: 'Quote, install, handover', id: 'process-title' })}
    ${L.steps([
      ['Free quote', 'Call or send the form. I talk through what you need, check the space and give you a clear quote with options to suit your budget. No pressure.'],
      ['Installation', 'I turn up when I say I will, protect your floors and install the system neatly, with tidy pipework and proper drainage.'],
      ['Handover', 'I test everything, show you how to use it and clean up, so you’re ready for a Sunshine Coast summer.'],
    ])}
  </div>
</section>

<section class="section" aria-labelledby="gallery-title">
  <div class="container">
    ${secHead({ title: 'Recent installs', id: 'gallery-title', intro: 'Real jobs from around the Coast, photographed on the day.' })}
    ${L.photoGrid(gallery)}
  </div>
</section>

${L.brandStrip({ title: 'Brands I install' })}

${L.faq([
    ['How much does it cost to install a split system?', 'It depends on the size of the unit, the brand and how far the pipes need to run between the indoor and outdoor units. Quotes are free, so you’ll know the exact price before you commit to anything.'],
    ['What size air conditioner do I need?', 'It depends on the room’s size, ceiling height, insulation, windows and which way it faces. Too small and it runs flat out; too big and it cycles on and off and wastes power. I work it out properly when I quote.'],
    ['Should I get a split system or ducted?', 'Split systems are the most affordable way to cool individual rooms. Ducted suits larger homes where you want every room comfortable from one discreet system. Multi-head sits in between. I’ll talk you through the trade-offs for your home.'],
    ['Which brand is best?', 'Mitsubishi Electric, Fujitsu, Mitsubishi Heavy Industries, General and Hisense all make reliable systems. The best fit depends on your budget, the room and the features you want, and I’ll give you honest options rather than push one brand.'],
    ['Can you replace my old air conditioner?', 'Yes. I can take out the old unit and install the new one, often in the same spot where that makes sense. If the existing pipework isn’t suitable, I’ll explain why before I quote.'],
    ['Do you install in new builds and renovations?', 'Yes. I can work with you or your builder to plan unit locations and run pipework and drains before the walls are closed in, then fit and commission the units at the end.'],
    ['Is the installation guaranteed?', 'Yes. Every installation comes with a workmanship guarantee, and I’m happy to talk you through what it covers when I quote.'],
  ], { title: 'Installation questions', grey: false })}

${L.ctaOrange({ title: 'Ready for a cooler summer? Call Luke' })}

${L.quoteForm({ source: 'Installations', service: 'Installation', heading: 'Get a free installation quote', lede: `Tell me about the rooms you want cooled and I’ll call you back to talk options. Prefer to talk now? Call me on ${L.NB_PHONE}.` })}
`,
};
