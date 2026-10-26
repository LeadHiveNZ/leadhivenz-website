// Render SVG/HTML to PNG with headless Chromium (Playwright). Used for comparisons and raster exports.
const { chromium } = require('playwright');
let browserP = null;
const browser = () => (browserP = browserP || chromium.launch());
async function htmlToPng(html, out, { width, height, transparent = false } = {}) {
  const b = await browser();
  const page = await b.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: Math.ceil(width), height: Math.ceil(height) } });
  await page.close();
}
async function svgToPng(svg, out, width, height, { background = null } = {}) {
  const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${background || 'transparent'}}svg{display:block}</style></head><body>${svg.replace('<svg ', `<svg width="${width}" height="${height}" `)}</body></html>`;
  await htmlToPng(html, out, { width, height, transparent: !background });
}
const close = async () => { if (browserP) { (await browserP).close(); browserP = null; } };
module.exports = { htmlToPng, svgToPng, close };
