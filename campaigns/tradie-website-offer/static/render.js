const { chromium } = require('playwright');
(async () => {
  const [,, inFile, outFile, w, h] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await p.goto('file://' + require('path').resolve(inFile));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const fams = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight));
  console.log('fonts loaded:', fams.join(', '));
  await p.screenshot({ path: outFile });
  await b.close();
})();
