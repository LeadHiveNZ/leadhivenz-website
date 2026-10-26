#!/usr/bin/env node
// Renders the 1200x630 Open Graph image (aerial hero + logo + tagline) with Playwright, using the
// site's own self-hosted fonts and images, then saves it as an optimised JPEG.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '..', 'site');
const url = (p) => 'file://' + path.join(SITE, p);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Outfit;src:url(${url('assets/fonts/outfit-latin.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:Inter;src:url(${url('assets/fonts/inter-latin.woff2')}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#0C1D45;font-family:Inter,sans-serif}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 70%}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,20,48,.94) 0%,rgba(8,20,48,.86) 38%,rgba(8,20,48,.25) 72%,rgba(8,20,48,0) 100%)}
.copy{position:absolute;left:72px;top:64px;width:600px;color:#fff}
.logo{height:150px;display:block;margin-bottom:34px}
h1{font-family:Outfit,sans-serif;font-weight:700;font-size:60px;line-height:1.02;letter-spacing:-.02em}
h1 span{color:#F3B941}
p{margin-top:18px;font-size:24px;color:#D5E2F5;font-weight:500}
.tel{margin-top:30px;display:inline-block;background:#F3B941;color:#0C1D45;font-family:Outfit,sans-serif;font-weight:700;font-size:28px;padding:14px 28px;border-radius:999px}
</style></head><body>
<img class="bg" src="${url('assets/img/coast-aerial-1600.jpg')}">
<div class="shade"></div>
<div class="copy">
  <img class="logo" src="${url('assets/img/logo.png')}">
  <h1>Sunshine Coast air conditioning, <span>done properly.</span></h1>
  <p>Installs · Repairs · Hydro cleaning · Servicing</p>
  <div class="tel">0444 541 409</div>
</div></body></html>`;

(async () => {
  const tmpHtml = path.join(__dirname, '.cache', 'og.html');
  fs.mkdirSync(path.dirname(tmpHtml), { recursive: true });
  fs.writeFileSync(tmpHtml, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + tmpHtml, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = path.join(__dirname, '.cache', 'og.png');
  await page.screenshot({ path: png });
  await browser.close();
  const out = path.join(SITE, 'assets', 'img', 'og-image.jpg');
  execFileSync('convert', [png, '-strip', '-sampling-factor', '4:2:0', '-interlace', 'Plane', '-quality', '82', out]);
  console.log('og-image.jpg', (fs.statSync(out).size / 1024).toFixed(0), 'KB');
})();
