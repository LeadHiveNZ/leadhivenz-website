/* =====================================================================
   CONFIG: everything client-specific lives here. build.js renders every
   page from it, and ships it to the browser as assets/config.js
   (window.CONFIG) for the hours chip, phone links and the quote form.
   Swap this file to reuse the site for another painting client.
   ===================================================================== */
const CONFIG = {
  business: {
    name: 'D|R Painting',
    owners: 'Darren and Rich',
    contactName: 'Rich',                 // used in the "Open now · call Rich" chip
    phoneDisplay: '028 468 9753',
    phoneTel: '+64284689753',
    email: 'quotes@example.co.nz',       // PLACEHOLDER: confirm with Rich before launch (used for the mailto fallback)
    url: 'https://www.example.co.nz/',   // PLACEHOLDER: live domain (canonical, og:url, sitemap). Keep the trailing slash.
    town: 'Whanganui',
    tagline: 'WHANGANUI · MANAWATŪ · TARANAKI',   // logo lockup line under the wordmark
    region: 'Manawatū-Whanganui',
    years: '25',
    blurb: 'Owner-operated painters based in Whanganui. Interior and exterior repaints, roofs, wallpapering and handyman work across Manawatū and South Taranaki.',
    geo: { lat: -39.9301, lng: 175.0479 }
  },

  // Quote form: POST JSON here (e.g. a Make/Zapier webhook or Formspree). Empty = open a pre-filled email instead.
  formEndpoint: '',

  // Opening hours in NZ time (Pacific/Auckland). null = closed.
  hours: {
    mon: ['07:00', '18:00'], tue: ['07:00', '18:00'], wed: ['07:00', '18:00'],
    thu: ['07:00', '18:00'], fri: ['07:00', '18:00'], sat: ['07:00', '18:00'], sun: null
  },
  timeZone: 'Pacific/Auckland',

  // Verified claims. Everything here is OFF / EMPTY until confirmed.
  claims: {
    guarantee: 'Workmanship guarantee on every job',  // generic, OK to show
    masterPainters: false,     // confirm with Rich before launch (Master Painters NZ member)
    dulux: false,              // confirm with Rich before launch (Dulux Accredited Painter)
    resene: false,             // confirm with Rich before launch (Resene Eco.Decorator / approved)
    siteSafe: false,           // confirm with Rich before launch (Site Safe passport)
    insured: false,            // confirm with Rich before launch
    insuranceText: '',         // confirm with Rich before launch, e.g. 'Fully insured, $2m public liability'
    googleRating: '',          // confirm with Rich before launch, e.g. '5.0'
    googleReviewCount: ''      // confirm with Rich before launch, e.g. '27'
  },

  hero: {
    eyebrow: 'Whanganui · Manawatū · South Taranaki',
    h1: 'Painters in Whanganui who do the prep *properly*, so the finish lasts.',
    sub: 'Darren and Rich bring 25 years on the brush to every job, inside and out. Free quotes, fast and reliable service, and no job too big or small.'
  },

  trust: [
    { icon: 'award', big: '25+ years', small: 'experience' },
    { icon: 'clip',  big: 'Free',       small: 'written quotes' },
    { icon: 'home',  big: 'Locally owned', small: 'by Darren and Rich' },
    { icon: 'pin',   big: 'Whanganui', small: 'Manawatū · South Taranaki' }
  ],

  // Header / footer / mobile menu. `page` matches a key in `pages` and marks the current link.
  nav: [
    { label: 'Home',     href: 'index.html',    page: 'home' },
    { label: 'Services', href: 'services.html', page: 'services' },
    { label: 'Our Work', href: 'our-work.html', page: 'our-work' },
    { label: 'About',    href: 'about.html',    page: 'about' },
    { label: 'Areas',    href: 'areas.html',    page: 'areas' },
    { label: 'Contact',  href: 'contact.html',  page: 'contact' }
  ],

  // Per-page SEO + page-hero copy. `img` is a key in IMG (hero photo and og:image).
  pages: {
    home: {
      file: 'index.html',
      title: 'D|R Painting | Painters in Whanganui, Manawatū & South Taranaki',
      description: 'Owner-operated painters based in Whanganui. Interior and exterior repaints, roof painting, wallpapering and handyman work across Manawatū and South Taranaki. 25 years experience. Free quotes. Call 028 468 9753.',
      ogTitle: 'D|R Painting | Painters in Whanganui',
      ogDescription: 'Interior and exterior repaints, roofs and handyman work across Whanganui, Manawatū and South Taranaki. 25 years experience. Free quotes.',
      img: 'hero'
    },
    services: {
      file: 'services.html', label: 'Services',
      title: 'Painting Services in Whanganui | D|R Painting',
      description: 'Interior and exterior painting, roof painting, new builds, commercial and body corporate work, wallpapering, decks and fences, and handyman jobs across Whanganui, Manawatū and South Taranaki.',
      img: 'svc_exterior',
      eyebrow: 'Services',
      h1: 'Painting services in Whanganui, Manawatū & South Taranaki',
      sub: 'Eight services, one local team. Darren and Rich quote the job, do the job and leave the place tidy.'
    },
    'our-work': {
      file: 'our-work.html', label: 'Our Work',
      title: 'Our Work | Painting Jobs Around Whanganui | D|R Painting',
      description: 'See what a proper repaint does. Before and after, plus recent interior and exterior finishes from D|R Painting in Whanganui, Manawatū and South Taranaki.',
      img: 'gallery_1',
      eyebrow: 'Our work',
      h1: 'Good prep shows in the finish.',
      sub: 'Drag the slider to see what a proper repaint does for a room, then have a look through a few recent finishes.'
    },
    about: {
      file: 'about.html', label: 'About',
      title: 'About Darren and Rich | D|R Painting, Whanganui',
      description: 'D|R Painting is Darren and Rich: owner-operated painters based in Whanganui with 25 years on the tools. The people who quote your job are the people who do it.',
      img: 'why',
      eyebrow: 'About D|R',
      h1: 'Darren and Rich. Owner-operated painters in Whanganui.',
      sub: '25 years on the tools, inside and out. You deal with the same two people from the first visit to the final walkthrough.'
    },
    areas: {
      file: 'areas.html', label: 'Areas',
      title: 'Areas We Cover | Whanganui, Manawatū & South Taranaki | D|R Painting',
      description: 'Based in Whanganui and travelling anywhere in Manawatū and South Taranaki, including Palmerston North, Feilding, Levin, Hāwera, Stratford and Ōpunake. Free quotes wherever you are.',
      img: 'hero',
      eyebrow: 'Service areas',
      h1: 'Painters for Whanganui, Manawatū & South Taranaki',
      sub: 'Based in Whanganui. Working right across the region. If your town isn’t listed, call anyway. Chances are we’re out your way.'
    },
    contact: {
      file: 'contact.html', label: 'Contact',
      title: 'Get a Free Painting Quote | D|R Painting, Whanganui',
      description: 'Request a free, written painting quote from D|R Painting. Call or text 028 468 9753, or send a few details and Darren or Rich will get back to you to book a time.',
      img: 'hero',
      eyebrow: 'Contact',
      h1: 'Get a free quote.',
      sub: 'Call or text 028 468 9753, or send a few details below. Darren or Rich will get back to you to book a time to look at the job.'
    },
    '404': {
      file: '404.html', label: 'Page not found',
      title: 'Page not found | D|R Painting',
      description: 'That page has moved or doesn’t exist. Head back to the D|R Painting home page or call 028 468 9753.',
      img: 'hero', noindex: true
    }
  },

  // Each service gets its own page (slug + '.html').
  services: [
    { id: 'interior', slug: 'interior-painting', headline: 'Clean lines, tidy rooms, no fuss.', title: 'Interior painting', img: 'svc_interior', icon: 'roller',
      desc: 'Walls, ceilings, doors and trim. Furniture covered, floors protected, rooms back in use fast.',
      includes: ['Walls & ceilings', 'Doors, skirtings & trim', 'Filling & minor plaster repairs'],
      metaTitle: 'Interior Painting Whanganui | D|R Painting',
      metaDescription: 'Interior painters in Whanganui, Manawatū and South Taranaki. Walls, ceilings, doors and trim, with furniture covered and floors protected. Free written quotes. Call 028 468 9753.',
      intro: 'Most interior repaints come down to the same thing: walls and ceilings that look tired, marked or dated. We move and cover the furniture, protect the floors, fill the dents and cracks and sand back before any paint goes on. Cutting in is done by hand, so the lines against ceilings, skirtings and architraves come out clean. Darren or Rich is on every job, from the first look to the tidy-up at the end of each day, so you deal with the same people the whole way through. One bedroom or the whole house, you get a free written quote before we start.',
      included: ['Walls and ceilings', 'Doors, skirtings, architraves and trim', 'Filling, sanding and minor plaster repairs', 'Kitchens, bathrooms and hallways', 'Furniture moved and covered, floors protected', 'A colour consult if you want one', 'Tidy-up at the end of every day'],
      steps: [
        { title: 'Look and quote', text: 'We walk through the rooms with you, check the surfaces and talk through colours and sheen levels. You get a written quote, free.' },
        { title: 'Protect and prep', text: 'Furniture moved and covered, floors and fittings protected. Holes and cracks filled, then everything sanded and spot-primed.' },
        { title: 'Cut in and roll', text: 'Ceilings first, then walls, then doors and trim. Lines cut in by hand and the coats built up for an even, solid finish.' },
        { title: 'Walkthrough', text: 'We check every room with you, sort anything you spot and put the furniture back where it was.' }
      ],
      faqs: [
        { q: 'Do we need to move out while you paint inside?', a: 'Usually not. We work room by room, so most of the house stays usable while we’re there. We plan the order of rooms with you when we quote, so bedrooms and the kitchen are out of action for as little time as possible.' },
        { q: 'Can you help us choose colours?', a: 'Yes. We offer a colour consult if you want one and can talk through how a colour will look in your rooms and light. If you already know what you want, we’re happy to work with your preferred brand and colour range.' },
        { q: 'How long does an interior repaint take?', a: 'Most rooms take one to two days, depending on the size of the room, how much prep is needed and how many surfaces are being painted. A whole house takes longer. You get a timeframe with your quote.' }
      ],
      related: ['exterior', 'wallpaper', 'handyman'] },
    { id: 'exterior', slug: 'exterior-painting', headline: 'The prep is what makes it last.', title: 'Exterior painting', img: 'svc_exterior', icon: 'home',
      desc: 'Weatherboards, plaster, brick and timber. Washed, scraped, sanded and primed before the topcoat.',
      includes: ['Weatherboards & fascias', 'Plaster & brick', 'Windows, sills & doors'],
      metaTitle: 'Exterior House Painting Whanganui | D|R Painting',
      metaDescription: 'Exterior repaints in Whanganui, Manawatū and South Taranaki. Weatherboards, plaster, brick and timber, washed, scraped, sanded and primed properly. Free written quotes. Call 028 468 9753.',
      intro: 'An exterior repaint is only as good as the prep underneath it. Weatherboards are washed down, loose and flaking paint is scraped back, bare timber is sanded and primed, and gaps are filled before a topcoat goes anywhere near them. Plaster, brick, fascias, windows and doors get the same treatment. Sun, wind and coastal weather are hard on paint around here, so we recommend the right product for each surface and how exposed it is. You get a clear written quote and a timeframe up front, and we keep you posted if rain pushes things out. Darren or Rich is on site for the whole job.',
      included: ['Weatherboards and cladding', 'Fascias, barge boards and soffits', 'Plaster and brick', 'Windows, sills and doors', 'Wash-down before painting', 'Scraping, sanding, filling and priming', 'The right product for each surface'],
      steps: [
        { title: 'Look and quote', text: 'We walk around the house with you, check the boards and the existing paint, and give you a written quote and timeframe.' },
        { title: 'Wash and prep', text: 'The house is washed down, then loose paint scraped back, edges sanded, gaps filled and bare timber primed.' },
        { title: 'Topcoats', text: 'Paint goes on once the surface is sound and dry. We work around the weather and keep you posted if rain moves things.' },
        { title: 'Final walkthrough', text: 'We walk the job with you, touch up anything you spot and leave the section tidy.' }
      ],
      faqs: [
        { q: 'When is the best time of year for an exterior repaint?', a: 'Paint needs dry surfaces and settled weather to go on properly, so most exterior work happens from spring through autumn. We plan the job around the forecast and keep you posted if rain pushes things out. It’s worth getting your quote in early.' },
        { q: 'How long does an exterior repaint take?', a: 'A typical exterior repaint takes one to three weeks, depending on the size of the house, how much prep is needed and the weather. You’ll get a timeframe with your quote.' },
        { q: 'Do I need to be home while you work?', a: 'No. As long as we can get to the outside of the house, you can carry on as normal. We’ll let you know if windows or doors need to stay shut while paint dries.' }
      ],
      related: ['roof', 'decks', 'handyman'] },
    { id: 'roof', slug: 'roof-painting', headline: 'More years from the roof you have.', title: 'Roof painting', img: 'svc_roof', icon: 'roof',
      desc: 'Iron and tile roofs cleaned, rust-treated and recoated to add years to the roof.',
      includes: ['Wash & moss treatment', 'Rust treatment & primer', 'Two full topcoats'],
      metaTitle: 'Roof Painting Whanganui | D|R Painting',
      metaDescription: 'Roof painting in Whanganui, Manawatū and South Taranaki. Iron and tile roofs washed, moss and rust treated, primed and recoated with two full topcoats. Free quotes. Call 028 468 9753.',
      intro: 'Roof painting is one of the best-value jobs on a house. An iron or tile roof that has gone chalky, faded or started to rust can get years more life from a proper recoat. We wash the roof, treat moss and lichen, deal with rust spots and prime bare or treated areas, then put on two full topcoats. We look over the fixings and flashings as we go and tell you about anything that needs attention. Roof work depends on dry weather more than anything else, so we book it around the forecast and keep you in the loop from quote to finish.',
      included: ['Iron and tile roofs', 'Wash-down and moss treatment', 'Rust treatment and primer', 'Two full topcoats', 'Fixings and flashings looked over', 'Colour advice to suit the house'],
      steps: [
        { title: 'Inspect and quote', text: 'We look over the roof, check rust, fixings and flashings, and give you a straight answer and a written quote.' },
        { title: 'Wash and treat', text: 'The roof is washed, moss and lichen treated, and rust spots wire-brushed and treated.' },
        { title: 'Prime and topcoat', text: 'Primer on bare and treated areas, then two full topcoats in dry, settled weather.' }
      ],
      faqs: [
        { q: 'Is my roof worth painting, or does it need replacing?', a: 'If the iron is still sound, with surface rust rather than holes, a recoat is usually worth doing. We’ll look at it properly and give you a straight answer. If we think it’s past painting, we’ll tell you.' },
        { q: 'Can you paint a tile roof?', a: 'Yes. Tile roofs are washed, treated for moss and lichen and recoated, the same as iron. We’ll point out any cracked or loose tiles when we quote.' },
        { q: 'How much does the weather matter for roof painting?', a: 'A lot. The roof has to be dry before and after each coat, so we book roof work around the forecast and keep you posted if the weather moves things.' }
      ],
      related: ['exterior', 'handyman', 'decks'] },
    { id: 'newbuild', slug: 'new-builds-renovations', headline: 'Painting that fits the build programme.', title: 'New builds & renovations', img: 'svc_newbuild', icon: 'layers',
      desc: 'Working to your builder’s schedule, from first coat on new plasterboard to final touch-ups.',
      includes: ['Builder liaison', 'Sealer, undercoat & topcoats', 'Final touch-ups'],
      metaTitle: 'New Build & Renovation Painting Whanganui | D|R Painting',
      metaDescription: 'Painting for new builds, renovations and extensions in Whanganui, Manawatū and South Taranaki. We work to your builder’s schedule, from sealer on new plasterboard to final touch-ups.',
      intro: 'On a new build or renovation, the painter has to fit in with everyone else on site. We work to your builder’s schedule, stay in touch so we’re ready when the plasterboard is stopped, and get the sealer, undercoats and topcoats on in the right order. Interiors, exteriors, joinery and trim are all part of it. Once the other trades are finished we come back for the final touch-ups, so the house is handed over clean. Whether you’re the builder or the homeowner running the project, you get one clear written quote and one team to deal with from start to finish.',
      included: ['Builder liaison and scheduling', 'Sealer, undercoat and topcoats', 'Interior walls, ceilings and trim', 'Exterior cladding and joinery', 'Renovations and extensions', 'Final touch-ups before handover'],
      steps: [
        { title: 'Quote from plans or on site', text: 'Send us the plans or have us walk the site. You get a written quote that lines up with the build programme.' },
        { title: 'Fit in with the build', text: 'We stay in touch with the builder so we’re ready when stopping is done, and work around the other trades.' },
        { title: 'Seal, undercoat, topcoat', text: 'Each surface gets the right paint system, applied in order and given time to dry between coats.' },
        { title: 'Touch-ups and handover', text: 'When the other trades are finished, we come back for the final touch-ups so the house is ready to hand over.' }
      ],
      faqs: [
        { q: 'Do you work directly with builders?', a: 'Yes. We can quote and work for the builder or for the homeowner, and either way we stay in touch with the builder so painting fits the programme.' },
        { q: 'Can you quote from plans?', a: 'Yes. Send through the plans and we can give you a quote to work with, then confirm it once we’ve seen the site.' },
        { q: 'Do you paint renovations and extensions too?', a: 'Yes. Extensions, kitchen and bathroom renovations and alterations are all part of it. We match the new work to the existing paint so it sits with the rest of the house.' }
      ],
      related: ['interior', 'exterior', 'commercial'] },
    { id: 'commercial', slug: 'commercial-painting', headline: 'Planned around tenants and trading hours.', title: 'Commercial & body corporate', name: 'Commercial & body corporate painting', img: 'svc_commercial', icon: 'building',
      desc: 'Shops, offices, rentals and multi-unit sites, planned around tenants and trading hours.',
      includes: ['Rental turnovers', 'Work planned around tenants', 'Clear written quotes'],
      metaTitle: 'Commercial & Body Corporate Painting Whanganui | D|R Painting',
      metaDescription: 'Commercial painting in Whanganui, Manawatū and South Taranaki. Shops, offices, rentals and body corporate sites, planned around tenants and trading hours. Clear written quotes.',
      intro: 'Commercial painting is mostly about planning. Shops and offices need to keep trading, tenants need to get on with their lives, and a body corporate committee needs a clear quote it can take to a meeting. We plan the work around trading hours and tenants, keep disruption down and let people know what’s happening before it happens. Rental turnovers are done quickly so the property is ready for the next tenants. Darren or Rich runs each job directly, so property managers and committees have one contact from quote to sign-off, and the site is left tidy at the end of every day.',
      included: ['Shops and offices', 'Rental turnovers', 'Body corporate and multi-unit sites', 'Work planned around tenants and trading hours', 'Interior and exterior', 'Clear written quotes for owners and committees'],
      steps: [
        { title: 'Site visit and scope', text: 'We look over the site, talk through access, tenants and timing, and give you a clear written quote.' },
        { title: 'Plan around people', text: 'We agree the order of work with you and let tenants or staff know what’s coming and when.' },
        { title: 'Paint and keep tidy', text: 'Work goes ahead area by area, with the site left tidy at the end of every day.' },
        { title: 'Sign-off', text: 'We walk the job with you or the property manager and sort anything on the list.' }
      ],
      faqs: [
        { q: 'Can you work around our trading hours?', a: 'Yes. Tell us when your quiet times are and we’ll plan the order of work around them when we quote, so customers and staff are disturbed as little as possible.' },
        { q: 'Do you do rental turnovers?', a: 'Yes. We can repaint between tenants, take care of the small handyman jobs at the same time and get the property ready for the next tenants.' },
        { q: 'Can you quote for a body corporate?', a: 'Yes. You get a clear written quote that sets out the scope, so the committee can compare it and make a decision. We’re happy to talk it through with the committee or the property manager.' }
      ],
      related: ['exterior', 'interior', 'handyman'] },
    { id: 'wallpaper', slug: 'wallpapering', headline: 'Paper that sits flat and lines up.', title: 'Wallpapering & feature walls', img: 'svc_wallpaper', icon: 'brush',
      desc: 'Old paper stripped, new paper hung and pattern-matched, and feature walls that lift a room.',
      includes: ['Wallpaper stripping', 'Hanging & pattern matching', 'Feature walls'],
      metaTitle: 'Wallpapering & Feature Walls Whanganui | D|R Painting',
      metaDescription: 'Wallpaper stripping, hanging and pattern matching, plus feature walls, in Whanganui, Manawatū and South Taranaki. Free written quotes. Call 028 468 9753.',
      intro: 'Wallpaper can lift a room in a way paint can’t, but only if the wall underneath is right and the pattern lines up. We strip the old paper, repair and prepare the wall, then hang the new paper with the pattern matched across every join. If you would rather paint, we can strip the old paper and get the walls ready for a repaint instead. A feature wall is a good way to add colour or pattern to a room without committing the whole space, and we can help you work out which wall suits it best. Choose the paper yourself or talk options through with us.',
      included: ['Wallpaper stripping', 'Wall repairs and preparation', 'Hanging and pattern matching', 'Feature walls', 'Stripping and prep for a repaint', 'Help choosing where a feature wall works'],
      steps: [
        { title: 'Look and measure', text: 'We check the walls, measure up and talk through the paper you have in mind. You get a written quote.' },
        { title: 'Strip and prepare', text: 'Old paper stripped, walls repaired, sanded and sealed so the new paper sits flat.' },
        { title: 'Hang and match', text: 'Paper hung with tight joins, the pattern matched across the wall and the edges trimmed clean.' }
      ],
      faqs: [
        { q: 'Can you remove old wallpaper and paint instead?', a: 'Yes. We strip the old paper, repair the wall underneath and prepare it for painting. Older walls sometimes need extra work once the paper is off, and we’ll tell you if that’s the case.' },
        { q: 'Do I need to buy the wallpaper?', a: 'You can choose and buy the paper yourself, or talk through options with us first. Either way, we’ll tell you how many rolls you need once we’ve measured up.' },
        { q: 'Is a feature wall worth it?', a: 'For a lot of rooms, yes. A feature wall adds colour or pattern without taking over the space, and it’s a smaller job than papering a whole room.' }
      ],
      related: ['interior', 'newbuild', 'handyman'] },
    { id: 'decks', slug: 'decks-fences-staining', headline: 'Protect the timber before it goes grey.', title: 'Decks, fences & staining', img: 'svc_decks', icon: 'fence',
      desc: 'Decks, fences and pergolas cleaned, stained or oiled to protect the timber from sun and rain.',
      includes: ['Clean & sand', 'Stain or oil', 'Fence painting'],
      metaTitle: 'Deck Staining & Fence Painting Whanganui | D|R Painting',
      metaDescription: 'Decks, fences and pergolas cleaned, sanded, stained or oiled across Whanganui, Manawatū and South Taranaki. Protect the timber from sun and rain. Free written quotes.',
      intro: 'Outdoor timber takes a beating from sun and rain. A deck that has gone grey or a fence that has started to split will keep going downhill unless it is protected. We clean the timber, sand back rough and weathered areas, then stain or oil decks and pergolas, or paint fences, so the timber is protected and looks cared for again. We’ll talk through whether stain, oil or paint suits your timber and how you use the space. It pairs well with an exterior repaint, or it can be done on its own before summer so the deck is ready when you want it.',
      included: ['Decks and steps', 'Fences and gates', 'Pergolas and outdoor timber', 'Cleaning and sanding', 'Staining or oiling', 'Fence painting'],
      steps: [
        { title: 'Look and quote', text: 'We check the timber, talk through stain, oil or paint, and give you a written quote.' },
        { title: 'Clean and sand', text: 'Timber washed down and left to dry, then rough and weathered areas sanded back.' },
        { title: 'Stain, oil or paint', text: 'Coats applied evenly along the grain in dry weather, with time to dry before the deck goes back into use.' }
      ],
      faqs: [
        { q: 'Should I stain, oil or paint my deck?', a: 'It depends on the timber, how much sun it gets and how you use it. Oils and stains soak in and show the grain. Paint gives a solid colour but shows wear sooner on a deck that gets a lot of foot traffic. We’ll recommend what suits.' },
        { q: 'How often does a deck need re-oiling or re-staining?', a: 'It depends on the product and how exposed the deck is. Decks in full sun need it more often. When the colour fades and water stops beading on the surface, it’s time.' },
        { q: 'Can you paint a long boundary fence?', a: 'Yes. Fences big and small. We clean the timber first so the paint or stain lasts, and we’ll talk to you about getting to the neighbour’s side if that’s needed.' }
      ],
      related: ['exterior', 'handyman', 'roof'] },
    { id: 'handyman', slug: 'handyman-property-maintenance', headline: 'The small jobs, sorted with the paint.', title: 'Handyman & property maintenance', img: 'svc_handyman', icon: 'wrench', feature: 'Popular add-on',
      desc: 'Small repairs, gutter cleaning and the prep jobs before paint. One call, one tidy job.',
      includes: ['Small repairs & board replacement', 'Gutter cleaning', 'Water blasting & prep'],
      metaTitle: 'Handyman & Property Maintenance Whanganui | D|R Painting',
      metaDescription: 'Small repairs, board replacement, gutter cleaning and water blasting in Whanganui, Manawatū and South Taranaki. The jobs before paint, done by the same team. Call 028 468 9753.',
      intro: 'Most houses have a list of small jobs that never quite get done. A rotten board, gutters full of leaves, a path that needs water blasting, a few things to fix before the painters arrive. We take care of those as part of a paint job or on their own. It makes sense to sort the repairs before the paint goes on, and having one team do both means one call, one quote and one tidy job. It works well for landlords and property managers between tenants, too. If it’s on your list and it’s around the house, it’s worth asking.',
      included: ['Small repairs', 'Rotten or damaged board replacement', 'Gutter cleaning', 'Water blasting', 'Prep jobs before painting', 'Maintenance between tenants'],
      steps: [
        { title: 'Send us the list', text: 'Call, text or send the quote form with what needs doing. A rough list is fine.' },
        { title: 'Quote and plan', text: 'We look over the jobs, give you a written quote and book a time that suits.' },
        { title: 'Get it done', text: 'Repairs, cleaning and prep done properly, and the place left tidy.' }
      ],
      faqs: [
        { q: 'Do you do handyman jobs without any painting?', a: 'Yes. No job too big or small. A list of handyman jobs is worth a call, whether or not there’s painting involved.' },
        { q: 'Can you replace rotten weatherboards before a repaint?', a: 'Yes. Replacing damaged boards before a repaint is part of doing the prep properly. We’ll point out any boards that need replacing when we quote.' },
        { q: 'Do you water blast houses and paths?', a: 'Yes. Water blasting is part of our prep for exterior work, and we also do it on its own for houses, paths and outdoor areas.' }
      ],
      related: ['exterior', 'decks', 'commercial'] }
  ],

  points: [
    { icon: 'user', title: 'Darren or Rich on every job', text: 'Owner-operated. The people who quote your job are the people on your job, from first visit to clean-up.' },
    { icon: 'layers', title: 'Prep done properly', text: 'Wash, scrape, fill, sand, prime. Most paint failures start with skipped prep. We don’t skip it.' },
    { icon: 'clock', title: 'Tidy, on time, in touch', text: 'We turn up when we say, keep you posted as the job goes, and leave the place tidy every day.' },
    { icon: 'pin', title: 'Local, and we travel', text: 'Based in Whanganui and working right across Manawatū and South Taranaki. Same free quote, wherever you are.' }
  ],

  beforeAfter: {
    title: 'Living room repaint',
    detail: 'walls, ceiling and trim',
    simulate: true   // true = "before" is the after photo with a weathered filter (demo). Set false once real before/after photos are in IMG.
  },

  gallery: [
    { img: 'gallery_1', title: 'Exterior repaint', sub: 'Weatherboards, fascias & trim' },
    { img: 'gallery_2', title: 'Living room', sub: 'Walls, ceiling & trim' },
    { img: 'gallery_3', title: 'Open-plan living', sub: 'Interior repaint' },
    { img: 'gallery_4', title: 'Kitchen', sub: 'Walls & ceiling' },
    { img: 'gallery_5', title: 'Main bedroom', sub: 'Interior repaint' },
    { img: 'gallery_6', title: 'Full exterior', sub: 'House & roof' }
  ],
  galleryTeaser: 3,   // tiles shown on the home page

  steps: [
    { title: 'Free quote on site', text: 'We come to you, look over the job and talk it through. You get a clear written quote, free.', time: 'Free, no obligation' },
    { title: 'Colour & plan', text: 'A colour consult if you want one, the right products for each surface, and a start date that suits you.', time: 'Booked around you' },
    { title: 'Prep & paint', text: 'Wash, scrape, fill, sand and prime. Then the coats go on, cut in clean and finished properly.', time: 'The bit we don’t rush' },
    { title: 'Final walkthrough', text: 'We walk the job with you, sort anything you spot, and leave the place tidy.', time: 'Signed off together' }
  ],

  // Towns: lat/lng drive the travel map. lab = label side (r, l, t, b). `about` is the paragraph on areas.html.
  areas: [
    { region: 'Whanganui', note: 'Home base',
      about: 'Whanganui is home base. Most of our work is in and around the city and the towns close by, including Marton, Bulls and Hunterville. Being local means quick site visits for quotes, and when the weather turns we’re never far from the job.',
      towns: [
      { n: 'Whanganui', lat: -39.930, lng: 175.048, hub: true, lab: 'b' },
      { n: 'Marton', lat: -40.069, lng: 175.378, lab: 'r' },
      { n: 'Bulls', lat: -40.174, lng: 175.384, lab: 'l' },
      { n: 'Hunterville', lat: -39.936, lng: 175.567, lab: 't' }
    ]},
    { region: 'Manawatū', note: 'We travel',
      about: 'We travel anywhere in Manawatū, from Palmerston North, Feilding and Ashhurst to Sanson, Foxton and Levin. Same team, same prep and the same free written quote. Exterior repaints, roofs and full interiors are all worth the trip, and smaller jobs are still worth a call.',
      towns: [
      { n: 'Palmerston North', lat: -40.352, lng: 175.608, lab: 'b' },
      { n: 'Feilding', lat: -40.225, lng: 175.565, lab: 'r' },
      { n: 'Ashhurst', lat: -40.293, lng: 175.754, lab: 'r' },
      { n: 'Sanson', lat: -40.218, lng: 175.424, lab: 'b' },
      { n: 'Foxton', lat: -40.472, lng: 175.284, lab: 'l' },
      { n: 'Levin', lat: -40.622, lng: 175.286, lab: 'r' }
    ]},
    { region: 'South Taranaki', note: 'We travel',
      about: 'Up the coast we cover South Taranaki, including Waverley, Pātea, Hāwera, Eltham, Manaia, Ōpunake and Stratford. Coastal wind and salt are hard on weatherboards and roofs out this way, so the prep and the right products matter even more.',
      towns: [
      { n: 'Waverley', lat: -39.764, lng: 174.632, lab: 'r' },
      { n: 'Pātea', lat: -39.757, lng: 174.476, lab: 'l' },
      { n: 'Hāwera', lat: -39.590, lng: 174.283, lab: 'r' },
      { n: 'Eltham', lat: -39.429, lng: 174.300, lab: 'r' },
      { n: 'Manaia', lat: -39.551, lng: 174.125, lab: 'b' },
      { n: 'Ōpunake', lat: -39.456, lng: 173.858, lab: 'b' },
      { n: 'Stratford', lat: -39.338, lng: 174.284, lab: 'r' }
    ]}
  ],

  map: {
    bounds: { west: 173.70, east: 176.15, north: -39.02, south: -40.72 },
    // Rough west-coast outline (lng, lat), north to south. Sea is to the west/south of this line.
    coast: [[174.02,-39.02],[173.90,-39.12],[173.80,-39.19],[173.76,-39.28],[173.79,-39.39],[173.84,-39.47],[173.97,-39.54],[174.11,-39.58],[174.22,-39.61],[174.37,-39.70],[174.47,-39.78],[174.62,-39.84],[174.80,-39.89],[174.99,-39.95],[175.12,-40.04],[175.19,-40.15],[175.22,-40.30],[175.22,-40.46],[175.19,-40.58],[175.15,-40.72]],
    peak: { n: 'Taranaki Maunga', lat: -39.296, lng: 174.064 },
    rings: [50, 100],  // km from home base
    embed: 'https://www.google.com/maps?q=Whanganui,New+Zealand&output=embed',
    link: 'https://www.google.com/maps?q=Whanganui,New+Zealand'
  },

  reviews: [
    // SAMPLE — replace with real reviews before launch
    { name: 'Sarah', town: 'Whanganui', job: 'Exterior repaint', text: 'Darren and Rich repainted our weatherboards and the prep was thorough. They turned up when they said they would and left the section spotless.' },
    // SAMPLE — replace with real reviews before launch
    { name: 'Mike', town: 'Palmerston North', job: 'Interior', text: 'Lounge and hallway done in two days. Good communication the whole way through and a really clean finish. We’ll use them again.' },
    // SAMPLE — replace with real reviews before launch
    { name: 'Janine', town: 'Hāwera', job: 'Roof & fascias', text: 'Roof and fascias done before winter. Sound advice on colour, a fair price and no mess left behind.' }
  ],

  faq: [
    { q: 'How much does painting cost?', a: 'It depends on the size of the job, the condition of the surfaces and what’s being painted. A single bedroom and a full exterior repaint are very different jobs. We come out, look at it properly and give you a free written quote, so you know the number before we start.' },
    { q: 'How long does a job take?', a: 'Most interior rooms take one to two days. A typical exterior repaint takes one to three weeks, depending on size, how much prep is needed and the weather. You’ll get a timeframe with your quote, and we’ll keep you posted if rain pushes things out.' },
    { q: 'Do you travel to Palmerston North or Hāwera?', a: 'Yes. We’re based in Whanganui and travel anywhere in Manawatū and South Taranaki, including Palmerston North, Feilding, Levin, Hāwera, Stratford and Ōpunake. If you’re not sure we cover your area, give us a call.' },
    { q: 'What paint brands do you use?', a: 'We use quality paints from the major New Zealand suppliers and are happy to work with your preferred brand and colour range. We’ll recommend the right product for each surface and how exposed it is to the weather.' },
    { q: 'Do you do small jobs?', a: 'Yes. No job too big or small. One room, a front door, a fence or a list of handyman jobs, it’s all worth a call.' },
    { q: 'Are your quotes free?', a: 'Yes. Quotes are free, written and come with no obligation. We come to you, measure up and talk through colours and options.' }
  ],
  faqHome: [0, 1, 5],   // indexes into faq[] shown on the home page (contact.html shows all)
  faqTravel: 2,         // the travel question, shown first on areas.html
  areasFaq: [
    { q: 'My town isn’t listed. Can you still help?', a: 'Probably. The list covers the towns we get to most, but we travel anywhere in Manawatū and South Taranaki. If your town isn’t listed, call anyway. Chances are we’re out your way.' },
    { q: 'Is the quote still free if I’m out of town?', a: 'Yes. Same free written quote, wherever you are in the area. We come to you, look over the job and talk it through.' }
  ],

  ticks: [
    'Free written quote, no obligation',
    'Colour advice if you want it',
    'Interior, exterior, roofs and handyman jobs'
  ],

  /* Every image on the site. Swap these for the client's own photos (same keys).
     Format: https://images.unsplash.com/photo-<id>?auto=format&fit=crop&w=1600&q=80 */
  IMG: {
    heroPosition:   '70% center',   // CSS object-position for the hero photo: keeps the subject right of the headline
    hero:           'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80',
    why:            'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=80',
    svc_interior:   'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80',
    svc_exterior:   'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    svc_roof:       'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1600&q=80',
    svc_newbuild:   'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80',
    svc_commercial: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
    svc_wallpaper:  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
    svc_decks:      'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=80',
    svc_handyman:   'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1600&q=80',
    before:         'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80',
    after:          'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80',
    gallery_1:      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
    gallery_2:      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
    gallery_3:      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
    gallery_4:      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    gallery_5:      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80',
    gallery_6:      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80'
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
