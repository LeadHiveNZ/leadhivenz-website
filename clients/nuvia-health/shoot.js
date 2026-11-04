// Nuvia Health checks + screenshots. Serve the repo root first:
//   python3 -m http.server 8765 --bind 127.0.0.1 &
// Usage: node clients/nuvia-health/shoot.js [checks|shots|both] [outdir]
const { chromium } = require('playwright');
const path = require('path');
const BASE = 'http://127.0.0.1:8765/clients/nuvia-health/nuvia-health.html';
const mode = process.argv[2] || 'both';
const OUT = process.argv[3] || path.join(__dirname, 'screens');

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}
async function scrollThrough(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const step = Math.round(innerHeight * 0.6);
    for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 400));
    document.querySelectorAll('.rv').forEach(e => e.classList.add('in'));
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
    scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const rec = (name, ok, info = '') => { results.push({ name, ok, info }); };
  for (const style of [1, 2, 3]) {
    for (const vp of [{ w: 1440, h: 900, tag: 'desktop' }, { w: 390, h: 844, tag: 'mobile' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: vp.tag === 'mobile', hasTouch: vp.tag === 'mobile' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      await page.goto(`${BASE}?style=${style}`, { waitUntil: 'load' });
      await settle(page);
      await scrollThrough(page);
      const L = `s${style} ${vp.tag}`;
      if (mode !== 'shots') {
        const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        rec(`${L} no horizontal scroll`, sw[0] <= sw[1], `${sw[0]}/${sw[1]}`);
        // ignore third-party map iframe noise, report separately
        const own = errors.filter(e => !/google|gstatic|maps/i.test(e));
        rec(`${L} zero console errors`, own.length === 0, own.slice(0, 3).join(' | ') + (errors.length > own.length ? ` (+${errors.length - own.length} 3rd-party map msgs)` : ''));
        const bad = await page.evaluate(() => [...document.images].filter(i => !i.closest('[data-hero]') || getComputedStyle(i.closest('[data-hero]')).display !== 'none').filter(i => !(i.naturalWidth > 0)).map(i => i.src));
        rec(`${L} all visible imgs loaded`, bad.length === 0, bad.join(', '));
        const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(h.slice(1))));
        rec(`${L} anchors resolve`, anchors.length === 0, [...new Set(anchors)].join(','));
        const pill = await page.evaluate(() => { const d = document.getElementById('dev'); const r = d.getBoundingClientRect(); return { right: innerWidth - r.right, top: r.top, n: d.querySelectorAll('a').length }; });
        rec(`${L} dev pill top-right`, pill.n === 3 && pill.right < 20 && pill.top < 200, JSON.stringify(pill));
        if (vp.tag === 'mobile') {
          const small = await page.evaluate(() => {
            const els = [...document.querySelectorAll('a[href],button,input,select,textarea,label.consent')];
            return els.filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
              if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') return false;
              if (e.closest('#dev') || e.closest('.mnav')) return false;
              if (e.type === 'checkbox') return false; // its label is the target
              let h = r.height; const lab = e.closest('label'); if (lab) h = Math.max(h, lab.getBoundingClientRect().height);
              return h < 44; }).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height) + ':' + (e.textContent || e.name || '').trim().slice(0, 30));
          });
          rec(`${L} tap targets >=44px`, small.length === 0, small.slice(0, 12).join(' | '));
          // hamburger
          await page.evaluate(() => scrollTo(0, 0));
          await page.click('#burger');
          await page.waitForTimeout(450);
          const opened = await page.evaluate(() => document.getElementById('nav').classList.contains('open') && getComputedStyle(document.getElementById('mnav')).visibility === 'visible');
          const mnavSmall = await page.evaluate(() => [...document.querySelectorAll('.mnav a')].filter(a => a.getBoundingClientRect().height < 44).length);
          await page.click('#burger');
          await page.waitForTimeout(450);
          const closed = await page.evaluate(() => !document.getElementById('nav').classList.contains('open'));
          rec(`${L} hamburger open/close`, opened && closed && mnavSmall === 0, `open=${opened} close=${closed} smallLinks=${mnavSmall}`);
        }
        // FAQ toggles
        const faq = await page.evaluate(async () => {
          const qs = [...document.querySelectorAll('.acc-q')]; let ok = 0;
          for (const q of qs) { const was = q.getAttribute('aria-expanded') === 'true'; q.click(); await new Promise(r => setTimeout(r, 30)); if ((q.getAttribute('aria-expanded') === 'true') !== was) ok++; }
          return [ok, qs.length];
        });
        rec(`${L} FAQ toggles`, faq[0] === faq[1] && faq[1] === 8, `${faq[0]}/${faq[1]}`);
        // form
        await page.evaluate(() => document.getElementById('book').scrollIntoView());
        await page.click('#bk-form button[type=submit]');
        const blocked = await page.evaluate(() => !document.getElementById('form-card').classList.contains('sent') && document.querySelectorAll('.fld.err').length > 0);
        await page.fill('#f-name', 'Test Patient'); await page.fill('#f-mob', '0400 000 000');
        await page.selectOption('#f-svc', { index: 1 }); await page.check('#f-consent');
        await page.click('#bk-form button[type=submit]'); await page.waitForTimeout(200);
        const sent = await page.evaluate(() => document.getElementById('form-card').classList.contains('sent') && getComputedStyle(document.querySelector('.done')).display !== 'none');
        rec(`${L} form validates + success`, blocked && sent, `blocked=${blocked} sent=${sent}`);
        // style pill switches
        const next = style % 3 + 1;
        await page.evaluate(() => scrollTo(0, 0));
        await page.click(`#dev a[href="?style=${next}"]`);
        await page.waitForLoadState('load');
        const cls = await page.evaluate(() => document.body.className);
        rec(`${L} pill switches to style ${next}`, cls === 's' + next, cls);
      }
      if (mode !== 'checks') {
        await page.goto(`${BASE}?style=${style}`, { waitUntil: 'load' });
        await settle(page); await scrollThrough(page);
        await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0); });
        await page.waitForTimeout(300);
        const f = path.join(OUT, `style${style}-${vp.tag}`);
        if (vp.tag === 'desktop') {
          await page.screenshot({ path: f + '-first-screen.png' });
          await page.screenshot({ path: f + '.png', fullPage: true, scale: 'css' });
        } else {
          // full-page capture: pin the fixed mobile bar to the document bottom so it doesn't float mid-page
          await page.addStyleTag({ content: 'body{position:relative}.mbar{position:absolute!important;bottom:0!important}' });
          await page.screenshot({ path: f + '.png', fullPage: true, scale: 'css' });
          await page.evaluate(() => document.querySelectorAll('style').forEach(st => { if (st.textContent.startsWith('body{position:relative}')) st.remove(); }));
          await page.screenshot({ path: f + '-first-screen.png' });
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  if (mode !== 'shots') { for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.info ? '  [' + r.info + ']' : '')); console.log(results.filter(r => !r.ok).length + ' failures'); }
})();
