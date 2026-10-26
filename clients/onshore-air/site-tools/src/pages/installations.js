const L = require('../layout');
const { S, icon, picture, sectionHead, checklist, eyebrow } = L;

const HERO_IMG_SIZES = '(min-width: 960px) 460px, calc(100vw - 40px)';
const gallery = [
  ['gallery-split-window', 'Wall split system above a bedroom window', 'Wall split above a bedroom window'],
  ['gallery-white-split', 'Slimline white wall-mounted split system', 'Slimline white wall split'],
  ['gallery-bedroom', 'Newly installed split system above a window with a roller blind', 'Bedroom split, just installed'],
  ['gallery-twin-fan', 'Large twin-fan outdoor unit against a brick wall', 'Twin-fan outdoor unit for a larger system'],
  ['gallery-fujitsu', 'Fujitsu outdoor unit with covered pipework running up the wall', 'Fujitsu outdoor unit, covered pipework'],
  ['gallery-daikin-pipe', 'Daikin outdoor unit on a courtyard wall with a neat pipe cover', 'Daikin outdoor unit, neat pipe cover'],
];

module.exports = {
  path: '/installations/',
  out: 'installations/index.html',
  title: 'Air Conditioning Installation Sunshine Coast | Onshore Air',
  description: 'Split system, multi-head and ducted air conditioning installed across the Sunshine Coast by a licensed local tech. Free quotes. Call 0444 541 409.',
  current: '/installations/',
  jsonld: [L.breadcrumbLd('Installations', '/installations/')],
  main: `
${L.pageHero({
    crumb: 'Installations',
    h1: 'Air conditioning installation on the Sunshine Coast',
    lede: 'New build, renovation or replacing a tired old unit: Luke sizes the system to the room, installs it neatly and makes sure you know how to get the best from it. Free quotes, competitive pricing and a workmanship guarantee.',
    media: picture('black-split', { alt: 'Black wall-mounted split system air conditioner installed by Onshore Air', sizes: HERO_IMG_SIZES, eager: true }),
    points: ['Free quotes', 'Split, multi-head &amp; ducted', 'Workmanship guarantee'],
  })}

<section class="section" aria-labelledby="types-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'What we install', title: 'The right system for the way you live', lede: 'Whether you want one cool bedroom or the whole house comfortable, Luke will recommend the system that suits your home and budget, not the one with the biggest margin.', id: 'types-title' })}
    ${L.iconCards([
      ['snow', 'Split systems', 'The go-to for bedrooms, living areas and granny flats. Quiet, efficient inverter units sized to the room, so they are not running flat out every summer afternoon.'],
      ['multi', 'Multi-head systems', 'Two or more indoor units running off a single outdoor unit. Handy when you want several rooms cooled but only have space for one condenser.'],
      ['wind', 'Ducted systems', 'Discreet ceiling vents throughout the house, with zoning so you only cool the rooms you are using. Ideal for larger and two-storey homes.'],
      ['home', 'New builds &amp; replacements', 'Planning unit locations and pipe runs with you or your builder before the walls close in, or swapping an old system for a new one with minimal fuss.'],
    ], 'icon-grid--4')}
  </div>
</section>

<section class="section section--sand" aria-labelledby="included-title">
  <div class="container split split--flip">
    <div>
      ${eyebrow('What’s included')}
      <h2 id="included-title">A proper install, not just a box on the wall</h2>
      <p class="lede">A good install is the difference between a system that runs quietly for years and one that struggles from day one. Here is what you get when Luke installs yours.</p>
      ${checklist([
        'A free quote with honest advice on size, brand and where the units should go',
        'A system sized to the room, its insulation and how much sun it gets',
        'Indoor and outdoor units mounted level and secure',
        'Neat pipe runs, with covers where they are on show',
        'Drainage set up properly, so it won’t drip down your wall',
        'Commissioning and testing before Luke leaves',
        'A walk-through of the remote and the settings that save power',
        'Clean-up before he goes, and a workmanship guarantee',
      ])}
    </div>
    <figure class="photo-frame">
      ${picture('outdoor-weatherboard', { alt: 'Outdoor unit installed beside a weatherboard home with a covered pipe run', sizes: '(min-width: 960px) 520px, calc(100vw - 40px)' })}
      <figcaption class="photo-caption">Outdoor unit tucked in beside a weatherboard home, pipework covered and clipped neatly.</figcaption>
    </figure>
  </div>
</section>

<section class="section" aria-labelledby="process-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'How it works', title: 'Quote, install, handover', lede: 'Three simple steps, with Luke looking after you at every one.', id: 'process-title', center: true })}
    ${L.steps([
      ['Free quote', 'Call or send the form. Luke talks through what you need, checks the space and gives you a clear quote, with options to suit your budget. No pressure.'],
      ['Installation', 'On the day, Luke turns up when he says he will, protects your floors and installs the system neatly, with tidy pipework and proper drainage.'],
      ['Handover', 'He tests everything, shows you how to use it, cleans up and leaves you with a system that’s ready for a Sunshine Coast summer.'],
    ])}
  </div>
</section>

<section class="section section--sand" aria-labelledby="gallery-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Recent work', title: 'Installs Luke is proud of', lede: 'Real jobs from around the Coast, photographed on the day.', id: 'gallery-title' })}
    <ul class="gallery">
      ${gallery.map(([img, alt, cap]) => `<li><figure>${picture(img, { alt, sizes: '(min-width: 900px) 380px, 45vw' })}<figcaption>${cap}</figcaption></figure></li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="section" aria-labelledby="brands-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Brands', title: 'Brands we install', lede: 'Not sure which brand to choose? Luke will explain the differences in plain English and quote options to suit your budget.', id: 'brands-title', center: true })}
    ${L.brandBadges(false)}
    <div class="mt-lg">
      ${L.ctaBand({ title: 'Ready for a cooler summer?', text: 'Book your free quote now and get your new system in before the hottest months.' })}
    </div>
  </div>
</section>

${L.faq([
    ['How much does it cost to install a split system?', 'It depends on the size of the unit, the brand and how far the pipes need to run between the indoor and outdoor units. Luke gives free quotes, so you will know the exact price before you commit to anything.'],
    ['What size air conditioner do I need?', 'It depends on the room’s size, ceiling height, insulation, windows and which way it faces. Too small and it runs flat out; too big and it cycles on and off and wastes power. Luke works it out properly when he quotes.'],
    ['Should I get a split system or ducted?', 'Split systems are the most affordable way to cool individual rooms. Ducted suits larger homes where you want every room comfortable from one discreet system. Multi-head sits in between. Luke will talk you through the trade-offs for your home.'],
    ['Which brand is best?', 'Mitsubishi Electric, Fujitsu, Mitsubishi Heavy Industries, General and Hisense all make reliable systems. The best fit depends on your budget, the room and the features you want, and Luke will give you honest options rather than push one brand.'],
    ['Can you replace my old air conditioner?', 'Yes. Luke can take out the old unit and install the new one, often in the same spot where that makes sense. If the existing pipework isn’t suitable, he will explain why before he quotes.'],
    ['Do you install in new builds and renovations?', 'Yes. Luke can work with you or your builder to plan unit locations and run pipework and drains before the walls are closed in, then fit and commission the units at the end.'],
    ['Is the installation guaranteed?', 'Yes. Luke backs every installation with a workmanship guarantee, and he is happy to talk you through what it covers when he quotes.'],
  ], { sand: true, title: 'Installation questions' })}

${L.quoteForm({ source: 'Installations', service: 'Installation', heading: 'Get a free installation quote', lede: `Tell Luke about the rooms you want cooled and he’ll call you back to talk options. Prefer to talk now? Call ${L.NB_PHONE}.` })}
`,
};
