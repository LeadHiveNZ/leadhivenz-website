// Renders the droplet icon to PNG at the sizes the manifest needs. Uses the pre-installed
// Playwright Chromium. Run: node scripts/make-icons.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const ACCENT = process.env.ICON_ACCENT ?? "#FF6B00";
const NAVY = process.env.ICON_BG ?? "#0B2545";

const svg = (size, maskable) => {
  const pad = maskable ? size * 0.2 : size * 0.12;
  const r = maskable ? 0 : size * 0.2;
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 24})">
    <path d="M12 2.5c3.2 4.3 7 8.4 7 12.6a7 7 0 0 1-14 0c0-4.2 3.8-8.3 7-12.6z" fill="${ACCENT}"/>
    <path d="M9 15.2a3 3 0 0 0 2.2 2.9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
};

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon.svg", svg(512, false));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, maskable)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(`public/icons/${file}`, buf);
  console.log("wrote", file);
}
await browser.close();
