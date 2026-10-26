const L = require('../layout');
const { S, icon, picture, sectionHead, eyebrow } = L;

module.exports = {
  path: '/repairs/',
  out: 'repairs/index.html',
  title: 'Air Conditioning Repairs Sunshine Coast | Onshore Air',
  description: 'Air con not cooling, leaking, noisy or showing an error code? Sunshine Coast repairs, diagnosed properly and quoted before work starts. 0444 541 409.',
  current: '/repairs/',
  jsonld: [L.breadcrumbLd('Repairs', '/repairs/')],
  main: `
${L.pageHero({
    crumb: 'Repairs',
    h1: 'Air conditioning repairs on the Sunshine Coast',
    lede: 'Not cooling, leaking, making a racket or flashing an error code? Luke finds the actual fault, explains it in plain English and quotes the repair before any work starts. Same-day visits where possible.',
    media: picture('repair-board', { alt: 'Air conditioner opened up to test the control board and wiring', sizes: '(min-width: 960px) 460px, calc(100vw - 40px)', eager: true }),
    points: ['Same-day where possible', 'All major brands', 'Quoted before work starts'],
  })}

<section class="section" aria-labelledby="symptoms-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Common problems', title: 'Sound familiar?', lede: 'These are the most common air con faults. If yours isn’t on the list, call anyway.', id: 'symptoms-title' })}
    ${L.iconCards([
      ['thermo', 'Not cooling (or heating)', 'Blowing warm air, taking forever to cool down, or one room that never gets comfortable. Often low refrigerant, a blocked coil or a failing part.'],
      ['drop', 'Leaking water', 'Water dripping from the indoor unit or running down the wall usually means a blocked drain, a dirty coil or a unit that isn’t sitting level.'],
      ['noise', 'Noisy or rattling', 'Buzzing, squealing, rattling or a loud outdoor unit. Noises tend to get worse, and cheaper to fix the earlier they are caught.'],
      ['alert', 'Error codes and flashing lights', 'A code or flashing light on the display is the system telling you something is wrong. Note it down or take a photo before you call.'],
      ['power', 'Won’t turn on', 'No response from the remote, or it starts and then cuts out. It could be power, the remote, a sensor or a control board.'],
      ['wind', 'Bad smells', 'A musty or mouldy smell when it starts up is usually a dirty coil. A <a href="/hydro-cleaning/">hydro clean</a> is often the fix.'],
    ], 'icon-grid--3')}
  </div>
</section>

<section class="section section--sand" aria-labelledby="pricing-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Straight up', title: 'Fast when it matters, honest about the cost', id: 'pricing-title' })}
    <div class="split split--even">
      <div class="panel">
        <span class="ic">${icon('clock')}</span>
        <h3>Same-day where possible</h3>
        <p>When your air con dies in the middle of a Sunshine Coast summer, you want it sorted now. Luke will get to you the same day wherever he can, and if he can’t, he’ll tell you honestly when he can. Call early in the day for the best chance.</p>
        <p class="panel-cta">${L.callBtn('', 'Call')}</p>
      </div>
      <div class="panel">
        <span class="ic">${icon('dollar')}</span>
        <h3>Quoted before work starts</h3>
        <p>Every repair starts with finding the actual fault. Luke will tell you upfront what the visit and diagnosis involves, explain what he has found, and quote the repair before any work starts.</p>
        <p>If it isn’t worth fixing, for example an old unit with a major failure, he will tell you straight and give you a replacement quote to compare. No surprises on the invoice.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="process-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'How it works', title: 'From breakdown to back up and running', id: 'process-title', center: true })}
    ${L.steps([
      ['Tell Luke what’s happening', 'Call or send the form with the symptoms, the brand and any error code. The more detail, the better prepared he arrives.'],
      ['Find the real fault', 'Luke tests the system properly to find the cause rather than guessing, then explains what he has found in plain English.'],
      ['Quote, fix and test', 'You get a clear price before any work starts. Once you are happy, he repairs it and tests the system so you know it’s working properly.'],
    ])}
    <div class="mt-lg">
      ${L.ctaBand({ title: 'Air con playing up right now?', text: 'Call Luke and describe what it’s doing. If he can get to you today, he will.' })}
    </div>
  </div>
</section>

<section class="section section--tight section--sand" aria-labelledby="brands-title">
  <div class="container">
    ${sectionHead({ eyebrow: 'Brands', title: 'Repairs for all major brands', id: 'brands-title', center: true })}
    ${L.brandBadges(`Plus repairs on ${S.otherBrands} and most other major brands.`)}
  </div>
</section>

${L.faq([
    ['How much does an air con repair cost?', 'It depends on the fault and the parts needed. Luke diagnoses the problem first and quotes the repair before any work starts, so you can decide with the full picture.'],
    ['Is it worth repairing an old air conditioner?', 'Often, yes. Many faults are minor and well worth fixing. But if a unit is old and needs a major part such as a compressor, replacing it can make more sense. Luke will give you both options and an honest opinion.'],
    ['Why is my air conditioner leaking water?', 'Most leaks come from a blocked drain line or drain tray, a dirty coil that is icing up, or a unit that isn’t sitting level. It is usually a straightforward fix, but leave it too long and the water can damage plaster and paint.'],
    ['Why is my air con blowing warm air?', 'First check it is set to Cool and the filters are clean. If it still blows warm, it could be low refrigerant, a faulty sensor or a problem with the outdoor unit. Give Luke a call and he will talk you through it.'],
    ['What does the error code on my unit mean?', 'Codes differ between brands and models. Note the code (or take a photo of the display) and the model number, and tell Luke when you call. He can often tell you what it means over the phone.'],
    ['Do you do same-day repairs?', 'Where possible, yes. It depends on the day’s bookings, so call early and Luke will tell you honestly when he can get there.'],
  ], { title: 'Repair questions', sand: false })}

${L.quoteForm({ source: 'Repairs', service: 'Repair', heading: 'Book a repair', lede: `Tell Luke what the system is doing and he’ll call you back. For the fastest response, call ${L.NB_PHONE}.` })}
`,
};
