const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await p.goto('file://' + __dirname + '/pm.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const out = process.argv[2];
  for (let i = 1; i <= 7; i++) await p.locator('#s' + i).screenshot({ path: `${out}/HostFix-managers-${i}.png` });
  await b.close();
})();
