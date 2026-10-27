const L = require('../layout');
const { S, secHead, callBtn } = L;

module.exports = {
  path: '/repairs/',
  out: 'repairs/index.html',
  title: 'Air Conditioning Repairs Sunshine Coast | Onshore Air',
  description: `Air con not cooling, leaking, noisy or showing an error code? Sunshine Coast repairs, diagnosed properly and quoted before work starts. ${S.phone.display}.`,
  current: '/repairs/',
  jsonld: [L.breadcrumbLd('Repairs', '/repairs/')],
  preload: L.pageHeroPreload('hero-repairs'),
  main: `
${L.pageHero({
    crumb: 'Repairs',
    h1: 'Air conditioning repairs on the Sunshine Coast',
    lede: 'Not cooling, leaking, making a racket or flashing an error code? I find the actual fault, explain it in plain English and quote the repair before any work starts. Same-day visits where I can.',
    photo: { name: 'hero-repairs', alt: 'Air conditioner opened up to test the control board and wiring' },
  })}

<section class="section" aria-labelledby="symptoms-title">
  <div class="container">
    ${secHead({ title: 'Sound familiar?', id: 'symptoms-title', intro: 'The most common faults I get called out for. If yours isn’t here, call anyway.' })}
    ${L.infoCards([
      ['Not cooling (or heating)', 'Blowing warm air, taking forever to cool down, or one room that never gets comfortable. Often low refrigerant, a blocked coil or a failing part.'],
      ['Leaking water', 'Water dripping from the indoor unit or running down the wall usually means a blocked drain, a dirty coil or a unit that isn’t sitting level.'],
      ['Noisy or rattling', 'Buzzing, squealing, rattling or a loud outdoor unit. Noises tend to get worse, and cheaper to fix the earlier they’re caught.'],
      ['Error codes and flashing lights', 'A code or flashing light on the display is the system telling you something’s wrong. Note it down or take a photo before you call.'],
      ['Won’t turn on', 'No response from the remote, or it starts and then cuts out. It could be power, the remote, a sensor or a control board.'],
      ['Bad smells', 'A musty or mouldy smell when it starts up is usually a dirty coil. A <a href="/hydro-cleaning/">hydro clean</a> is often the fix.'],
    ], { cols: 3, tone: 'grey' })}
  </div>
</section>

<section class="section on-dark" aria-labelledby="pricing-title">
  <div class="container">
    ${secHead({ title: 'Fast when it matters, upfront about the cost', id: 'pricing-title' })}
    <div class="dark-cols">
      <div>
        <h3>Same-day where possible</h3>
        <p>When your air con dies in the middle of a Sunshine Coast summer, you want it sorted now. I’ll get to you the same day wherever I can, and if I can’t, I’ll tell you honestly when I can. Call early in the day for the best chance.</p>
        ${callBtn('', 'Call Luke')}
      </div>
      <div>
        <h3>Quoted before work starts</h3>
        <p>Every repair starts with finding the actual fault. I’ll tell you upfront what the visit and diagnosis involves, explain what I’ve found, and quote the repair before any work starts.</p>
        <p>If it isn’t worth fixing, say an old unit with a major failure, I’ll tell you and give you a replacement quote to compare. No surprises on the invoice.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="process-title">
  <div class="container">
    ${secHead({ title: 'From breakdown to back up and running', id: 'process-title' })}
    ${L.steps([
      ['Tell me what’s happening', 'Call or send the form with the symptoms, the brand and any error code. The more detail, the better prepared I arrive.'],
      ['I find the real fault', 'I test the system properly to find the cause rather than guessing, then explain what I’ve found in plain English.'],
      ['Quote, fix and test', 'You get a clear price before any work starts. Once you’re happy, I repair it and test the system so you know it’s working properly.'],
    ])}
  </div>
</section>

${L.brandStrip({ title: 'Brands I repair' })}

${L.faq([
    ['How much does an air con repair cost?', 'It depends on the fault and the parts needed. I diagnose the problem first and quote the repair before any work starts, so you can decide with the full picture.'],
    ['Is it worth repairing an old air conditioner?', 'Often, yes. Many faults are minor and well worth fixing. But if a unit is old and needs a major part such as a compressor, replacing it can make more sense. I’ll give you both options and an honest opinion.'],
    ['Why is my air conditioner leaking water?', 'Most leaks come from a blocked drain line or drain tray, a dirty coil that’s icing up, or a unit that isn’t sitting level. It’s usually a straightforward fix, but leave it too long and the water can damage plaster and paint.'],
    ['Why is my air con blowing warm air?', 'First check it’s set to Cool and the filters are clean. If it still blows warm, it could be low refrigerant, a faulty sensor or a problem with the outdoor unit. Give me a call and I’ll talk you through it.'],
    ['What does the error code on my unit mean?', 'Codes differ between brands and models. Note the code (or take a photo of the display) and the model number, and tell me when you call. I can often tell you what it means over the phone.'],
    ['Do you do same-day repairs?', 'Where possible, yes. It depends on the day’s bookings, so call early and I’ll tell you honestly when I can get there.'],
  ], { title: 'Repair questions', grey: false })}

${L.ctaOrange({ title: 'Air con playing up? Call Luke', text: 'Describe what it’s doing. If I can get to you today, I will.' })}

${L.quoteForm({ source: 'Repairs', service: 'Repair', heading: 'Book a repair', lede: `Tell me what the system is doing and I’ll call you back. For the fastest response, call ${L.NB_PHONE}.` })}
`,
};
