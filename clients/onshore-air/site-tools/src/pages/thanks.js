const L = require('../layout');
const { S, icon, callBtn } = L;

module.exports = {
  path: '/thanks/',
  out: 'thanks/index.html',
  title: 'Thanks, your request is in | Onshore Air',
  description: 'Thanks for getting in touch with Onshore Air. Luke will call you back soon.',
  robots: 'noindex, follow',
  quoteHref: '/contact/#quote',
  main: `
<section class="message-page">
  <div class="container">
    <span class="message-icon">${icon('check')}</span>
    <h1>Thanks, your request is in</h1>
    <p class="lede">Luke will be in touch soon to talk through what you need. If it’s urgent, or you’d rather talk now, give him a call.</p>
    <div class="message-actions">${callBtn('btn-lg', 'Call')}<a class="btn btn-outline btn-lg" href="/">Back to home</a></div>
    <p class="message-meta">${icon('clock')}${S.hoursShort} · Sunday closed</p>
  </div>
</section>
`,
};
