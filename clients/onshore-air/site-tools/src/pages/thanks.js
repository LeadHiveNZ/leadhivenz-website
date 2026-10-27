const L = require('../layout');
const { S, callBtn, status, icon } = L;

module.exports = {
  path: '/thanks/',
  out: 'thanks/index.html',
  title: 'Thanks, your request is in | Onshore Air',
  description: 'Thanks for getting in touch with Onshore Air. Luke will call you back soon.',
  robots: 'noindex, follow',
  quoteHref: '/contact/#quote',
  main: `
<section class="message on-dark" aria-labelledby="page-title">
  <div class="container">
    <h1 id="page-title">Thanks, your request is in</h1>
    <p class="masthead-lede">I’ll be in touch soon to talk through what you need. If it’s urgent, or you’d rather talk now, give me a call.</p>
    <div class="masthead-cta">${callBtn('btn-xl', 'Call Luke')}<a class="masthead-link" href="/">Back to the home page${icon('arrow')}</a></div>
    ${status('status--light')}
  </div>
</section>

<section class="section" aria-labelledby="more-title">
  <div class="container">
    <div class="sec-head"><h2 id="more-title">While you wait</h2><p>What I can help with, from installs to a yearly service.</p></div>
    ${L.serviceCards()}
  </div>
</section>
`,
};
