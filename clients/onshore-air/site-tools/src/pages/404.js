const L = require('../layout');
const { S, callBtn, icon } = L;

module.exports = {
  path: '/404.html',
  out: '404.html',
  title: 'Page not found | Onshore Air',
  description: 'Sorry, that page doesn’t exist. Find air conditioning installs, repairs, hydro cleaning and servicing across the Sunshine Coast at Onshore Air.',
  robots: 'noindex, follow',
  canonical: false,
  quoteHref: '/contact/#quote',
  main: `
<section class="message on-dark" aria-labelledby="page-title">
  <div class="container">
    <h1 id="page-title">Sorry, I can’t find that page</h1>
    <p class="masthead-lede">It may have moved when the website was updated. Try one of these instead, or give me a call.</p>
    <div class="masthead-cta">${callBtn('btn-xl', 'Call Luke')}<a class="masthead-link" href="/">Go to the home page${icon('arrow')}</a></div>
  </div>
</section>

<section class="section" aria-labelledby="more-title">
  <div class="container">
    <div class="sec-head"><h2 id="more-title">Popular pages</h2></div>
    ${L.serviceCards()}
    <ul class="more-links">${S.nav.filter((n) => !S.services.some((s) => s.href === n.href)).map((n) => `<li><a class="text-link" href="${n.href}">${n.label}${icon('arrow')}</a></li>`).join('')}</ul>
  </div>
</section>
`,
};
