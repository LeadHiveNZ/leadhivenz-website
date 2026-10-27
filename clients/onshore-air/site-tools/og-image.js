#!/usr/bin/env node
// Renders the 1200x630 Open Graph image in the site's "Onshore" look: Paper background, the navy header bar with the
// horizontal logo and the stripe band, a Bricolage Grotesque headline with the orange underline, the stripe rule, and Luke's aerial
// photo of the coast with the stripe field at its bottom-left corner. Uses the site's own fonts and logo; the photo is
// read from the cached original (downloaded if missing). Saves an optimised JPEG to site/assets/img/og-image.jpg.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { ogPhoto } = require('./images.config');

const SITE = path.resolve(__dirname, '..', 'site');
const CACHE = path.join(__dirname, '.cache');
const url = (p) => 'file://' + path.join(SITE, p);
const photo = path.join(CACHE, 'originals', ogPhoto);
if (!fs.existsSync(photo)) {
  fs.mkdirSync(path.dirname(photo), { recursive: true });
  execFileSync('curl', ['-sSL', '--fail', '-m', '120', '-A', 'Mozilla/5.0', `https://static.wixstatic.com/media/${ogPhoto}`, '-o', photo]);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Bricolage;src:url(${url('assets/fonts/bricolage-grotesque-latin.woff2')}) format('woff2');font-weight:400 800}
@font-face{font-family:Instrument;src:url(${url('assets/fonts/instrument-sans-latin.woff2')}) format('woff2');font-weight:400 700}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#F4EDE1;color:#0E1F4D;font-family:Instrument,sans-serif}
.bar{height:104px;background:#0A1636;display:flex;align-items:center;padding:0 64px}
.bar img{height:58px}
.band{height:10px;background:#0A1636 url(${url('assets/img/stripes.svg')}) 0 0/100% 12.35px no-repeat}
.main{display:grid;grid-template-columns:1fr 372px;gap:64px;padding:44px 64px 0}
.rule{width:72px;height:17px;background:url(${url('assets/img/stripes.svg')}) 0 0/72px 21px no-repeat;margin-bottom:22px}
.eyebrow{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#1E5CB3}
.eyebrow:before{content:"";width:24px;height:2px;background:#E0702A}
h1{margin-top:14px;font-family:Bricolage,sans-serif;font-variation-settings:"opsz" 96;font-weight:700;font-size:60px;line-height:1;letter-spacing:-.02em}
h1 span{text-decoration:underline;text-decoration-color:#E0702A;text-decoration-thickness:5px;text-underline-offset:9px;text-decoration-skip-ink:none}
.contact{margin-top:26px;display:flex;align-items:baseline;gap:20px}
.phone{font-family:Bricolage,sans-serif;font-variation-settings:"opsz" 96;font-weight:700;font-size:38px;letter-spacing:-.01em}
.services{font-size:19px;color:#34416A}
.photo{position:relative;isolation:isolate;height:420px}
.photo img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;object-position:62% 55%;border-radius:6px;outline:1px solid rgba(14,31,77,.2);outline-offset:-1px}
.field{position:absolute;left:-22px;bottom:-22px;width:58%;height:42%;overflow:hidden;z-index:0}
.field:before{content:"";position:absolute;inset:-70%;background:url(${url('assets/img/stripes.svg')}) 0 0/72px 21px repeat;transform:rotate(32deg)}
</style></head><body>
<div class="bar"><img src="${url('assets/img/logo-horizontal.svg')}" alt=""></div>
<div class="band"></div>
<div class="main">
  <div>
    <div class="rule"></div>
    <div class="eyebrow">Pacific Paradise · Sunshine Coast</div>
    <h1>Sunshine Coast<br>air conditioning,<br><span>done properly.</span></h1>
    <div class="contact"><span class="phone">0444 541 409</span><span class="services">Installs · Repairs · Hydro cleaning · Servicing</span></div>
  </div>
  <div class="photo"><span class="field"></span><img src="file://${photo}" alt=""></div>
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
