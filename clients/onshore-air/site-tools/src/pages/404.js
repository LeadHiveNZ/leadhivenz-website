const L = require('../layout');
const { S, icon, callBtn, stripeRule } = L;

module.exports = {
  path: '/404.html',
  out: '404.html',
  title: 'Page not found | Onshore Air',
  description: 'Sorry, that page doesn’t exist. Find air conditioning installs, repairs, hydro cleaning and servicing across the Sunshine Coast at Onshore Air.',
  robots: 'noindex, follow',
  canonical: false,
  quoteHref: '/contact/#quote',
  main: `
<section class="message-page">
  <div class="container"><div class="message-inner">
    ${stripeRule()}
    <h1>Sorry, we can’t find that page</h1>
    <p class="lede">It may have moved when the website was updated. Try one of these instead, or give Luke a call.</p>
    <div class="message-actions">${callBtn('', 'Call')}<a class="btn btn-line" href="/">Go to the home page</a></div>
    <ul class="link-list">${S.nav.map((n) => `<li><a href="${n.href}">${n.label}${icon('arrow')}</a></li>`).join('')}</ul>
  </div></div>
</section>
`,
};
