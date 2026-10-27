#!/usr/bin/env node
// Renders the 1200x630 Open Graph image in the site's "Trade" look, the same composition as the home hero: navy-deep
// band with the logo-stripe band under the logo, Luke's hydro-clean photo on the right behind the navy gradient, the
// caps Barlow Condensed headline, and the phone number on an orange button. Uses the site's own fonts, logo and
// exported hero photo; the phone number comes from site.js (the same constant as every page).
// Saves an optimised JPEG to site/assets/img/og-image.jpg.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const S = require('./src/site');

const SITE = path.resolve(__dirname, '..', 'site');
const CACHE = path.join(__dirname, '.cache');
const url = (p) => 'file://' + path.join(SITE, p);
const photo = url('assets/img/hero-home-1440.jpg');
if (!fs.existsSync(path.join(SITE, 'assets/img/hero-home-1440.jpg'))) throw new Error('run node images.js first (hero-home-1440.jpg missing)');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BarlowC;src:url(${url('assets/fonts/barlow-condensed-700-latin.woff2')}) format('woff2');font-weight:700}
@font-face{font-family:Barlow;src:url(${url('assets/fonts/barlow-600-latin.woff2')}) format('woff2');font-weight:600}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0A1636;color:#fff;font-family:Barlow,sans-serif;position:relative}
.photo{position:absolute;top:0;right:0;bottom:0;width:62%;background:url(${photo}) 50% 40%/cover no-repeat}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,#0A1636 0%,#0A1636 38%,rgba(10,22,54,.92) 42%,rgba(10,22,54,.55) 52%,rgba(10,22,54,0) 66%)}
.edge{position:absolute;left:0;right:0;bottom:0;height:12px;background:#E0702A}
.copy{position:absolute;left:64px;top:52px;width:620px}
.logo{height:54px;display:block}
.band{width:240px;height:8px;margin:22px 0 34px;background:url(${url('assets/img/stripes.svg')}) 0 0/100% 9.88px no-repeat}
h1{font-family:BarlowC,sans-serif;font-weight:700;font-size:74px;line-height:1;text-transform:uppercase;letter-spacing:.005em}
.cta{display:inline-flex;align-items:center;gap:14px;margin-top:34px;padding:16px 26px;background:#E0702A;color:#0A1636;border-radius:4px;font-size:26px}
.cta b{font-family:BarlowC,sans-serif;font-weight:700;font-size:40px;letter-spacing:.01em;line-height:1}
.cta svg{width:30px;height:30px}
.meta{margin-top:22px;font-size:21px;color:#E4E9F3}
</style></head><body>
<div class="photo"></div><div class="shade"></div><div class="edge"></div>
<div class="copy">
  <img class="logo" src="${url('assets/img/logo-horizontal.svg')}" alt="">
  <div class="band"></div>
  <h1>Sunshine Coast air conditioning by a licensed local tech</h1>
  <div class="cta"><svg viewBox="0 0 24 24" fill="none" stroke="#0A1636" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 3.5h3.1l1.7 4.4-2.3 1.4a11.6 11.6 0 0 0 7 7l1.4-2.3 4.4 1.7v3.1a1.9 1.9 0 0 1-2 1.9A16.6 16.6 0 0 1 3.3 5.5a1.9 1.9 0 0 1 1.9-2z"/></svg><span>Call Luke</span><b>${S.phone.display}</b></div>
  <p class="meta">Installs, repairs, hydro cleaning and servicing. 5.0 on Google.</p>
</div>
</body></html>`;

(async () => {
  const tmpHtml = path.join(CACHE, 'og.html');
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(tmpHtml, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + tmpHtml, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = path.join(CACHE, 'og.png');
  await page.screenshot({ path: png });
  await browser.close();
  const out = path.join(SITE, 'assets', 'img', 'og-image.jpg');
  execFileSync('convert', [png, '-strip', '-sampling-factor', '4:2:0', '-interlace', 'Plane', '-quality', '84', out]);
  console.log('og-image.jpg', (fs.statSync(out).size / 1024).toFixed(0), 'KB');
})();
