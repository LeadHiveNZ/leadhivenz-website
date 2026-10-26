// Playwright helpers: render an SVG string/file or an HTML file to PNG
const { chromium } = require('playwright');
let browser = null;
async function getBrowser() { if (!browser) browser = await chromium.launch(); return browser; }
async function close() { if (browser) { await browser.close(); browser = null; } }

/** Render SVG markup into a PNG of exact pixel width/height (CSS px), deviceScaleFactor dsf. */
async function svgToPng(svg, outFile, { width, height, dsf = 1, background = 'transparent' } = {}) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: dsf });
  const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${background};}
  svg{display:block;width:${width}px;height:${height}px}</style></head><body>${svg}</body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: outFile, omitBackground: background === 'transparent', clip: { x: 0, y: 0, width, height } });
  await page.close();
}

async function htmlToPng(htmlFile, outFile, { width = 1400, dsf = 1, fullPage = true, selector = null } = {}) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: dsf });
  await page.goto('file://' + htmlFile, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  if (selector) {
    const el = await page.$(selector);
    await el.screenshot({ path: outFile });
  } else {
    await page.screenshot({ path: outFile, fullPage });
  }
  await page.close();
}

module.exports = { getBrowser, close, svgToPng, htmlToPng };
