// Usage: node tools/shots.js  (serves dist/ and screenshots key pages at 1440 and 390)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8765'], { cwd: path.join(__dirname, '..', 'dist'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const pages = ['', 'services/', 'services/exterior-painting/', 'services/interior-painting/', 'services/roof-painting/', 'projects/', 'reviews/', 'about/', 'process/', 'areas/', 'faq/', 'contact/'];
  for (const w of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const p of pages) {
      await page.goto(`http://localhost:8765/${p}`, { waitUntil: 'networkidle' });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(400);
      const name = (p || 'home').replace(/\//g, '_').replace(/_$/, '');
      await page.screenshot({ path: `screens/${name}-${w}.png`, fullPage: true });
      await page.screenshot({ path: `screens/${name}-${w}-fold.png`, fullPage: false });
    }
    await ctx.close();
  }
  await browser.close(); srv.kill();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
