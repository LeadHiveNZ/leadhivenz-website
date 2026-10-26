#!/usr/bin/env node
// Full-page screenshots of every page at 390x844 (phone) and 1280x800 (desktop) into ../site-screens.
// The clock is pinned to a Tuesday 10:30am Brisbane time so the hours-aware status line renders its
// "Open now" state consistently; pass --closed to capture the after-hours state instead.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { createServer } = require('./serve');

const OUT = path.resolve(__dirname, '..', 'site-screens');
const PAGES = [['home', '/'], ['installations', '/installations/'], ['repairs', '/repairs/'], ['hydro-cleaning', '/hydro-cleaning/'], ['maintenance', '/maintenance/'], ['about', '/about/'], ['service-areas', '/service-areas/'], ['contact', '/contact/'], ['thanks', '/thanks/'], ['404', '/this-page-does-not-exist/']];
const closed = process.argv.includes('--closed');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const when = closed ? '2026-10-27T19:30:00+10:00' : '2026-10-27T10:30:00+10:00';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = createServer().listen(0);
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  const viewports = [['390', { width: 390, height: 844 }, true], ['1280', { width: 1280, height: 800 }, false]];
  for (const [tag, viewport, mobile] of viewports) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, timezoneId: 'Australia/Brisbane' });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(when));
    for (const [name, url] of PAGES) {
      if (only.length && !only.includes(name)) continue;
      await page.goto(base + url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      // load every lazy image before the full-page capture: scroll the page through, then wait until
      // every <img> has decoded pixels (img.complete is unreliable for deferred lazy images)
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 40)); }
      });
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => [...document.images].every((img) => img.naturalWidth > 0), null, { timeout: 15000 });
      await page.evaluate(async () => { await Promise.all([...document.images].map((img) => img.decode().catch(() => {}))); window.scrollTo({ top: 0, behavior: 'instant' }); });
      await page.waitForTimeout(200);
      if (mobile && name === 'home') {
        // first screen exactly as a phone shows it (sticky call bar in place)
        await page.screenshot({ path: path.join(OUT, `home-390-first-screen${closed ? '-closed' : ''}.png`) });
      }
      // A full-page capture would paint the fixed call bar at the first viewport's bottom edge, over the
      // content. Pin it to the end of the document instead, where it sits over the footer's reserved space.
      const style = await page.addStyleTag({ content: 'body{position:relative}.call-bar{position:absolute!important}' });
      const file = path.join(OUT, `${name}-${tag}${closed ? '-closed' : ''}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await style.evaluate((el) => el.remove());
      const dims = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
      console.log(`${path.basename(file)}  ${dims[0]}x${dims[1]}`);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
})();
