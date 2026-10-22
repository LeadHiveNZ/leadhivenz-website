/* Gold Exchange — interaction engine
   Lenis smooth scroll + GSAP ScrollTrigger. Loader, hero intro and pin,
   live prices, calculator, horizontal gallery, reveals, reviews, FAQ, nav,
   cursor and magnetic buttons. */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
const isMobile = matchMedia('(max-width: 900px)').matches;
const gx = () => window.__gx || { setHero() {}, setVelocity() {}, intro() {} };

document.documentElement.classList.remove('js-off');
gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'expo.out', duration: 1.2 });
$('#year').textContent = new Date().getFullYear();

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', (e) => { ScrollTrigger.update(); gx().setVelocity(e.velocity || 0); });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  window.lenis = lenis;
}
function scrollTo(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: 'smooth' });
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault(); closeMenu(); scrollTo(id);
}));

/* ---------------- helpers ---------------- */
function splitWords(el) {
  // wraps every word in .w, keeping <em>/<b> classes on their words
  const frag = document.createDocumentFragment();
  const walk = (node, cls) => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const s = document.createElement('span'); s.className = 'w' + (cls ? ' ' + cls : ''); s.textContent = part; frag.appendChild(s);
      });
    } else if (node.nodeType === 1) {
      [...node.childNodes].forEach((n) => walk(n, (cls ? cls + ' ' : '') + (node.className || '')));
    }
  };
  [...el.childNodes].forEach((n) => walk(n, ''));
  el.innerHTML = ''; el.appendChild(frag);
  return $$('.w', el);
}
const fmt = (n, d = 0) => n.toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------------- live prices ---------------- */
const PRICES = {
  XAU: { name: 'Gold', usd: 4027.3 }, XAG: { name: 'Silver', usd: 54.75 },
  XPT: { name: 'Platinum', usd: 1574 }, XPD: { name: 'Palladium', usd: 1077 },
  fx: 1.4232, updated: null, live: false,
};
const OZ = 31.1034768;
const PURITIES = {
  XAU: [['9ct', .375], ['10ct', .417], ['14ct', .585], ['18ct', .75], ['22ct', .916], ['24ct', .999]],
  XAG: [['Sterling 925', .925], ['Fine 999', .999], ['800 silver', .8]],
  XPT: [['Pt 950', .95], ['Pt 900', .9], ['Pt 999', .999]],
  XPD: [['Pd 950', .95], ['Pd 500', .5], ['Pd 999', .999]],
};
const audOz = (sym) => PRICES[sym].usd * PRICES.fx;
const audG = (sym, purity = 1) => audOz(sym) / OZ * purity;

function renderTicker() {
  const items = [
    ['Gold', audOz('XAU'), 'AUD / oz'], ['Gold', PRICES.XAU.usd, 'USD / oz'],
    ['24ct', audG('XAU', .999), 'AUD / g'], ['18ct', audG('XAU', .75), 'AUD / g'], ['9ct', audG('XAU', .375), 'AUD / g'],
    ['Silver', audOz('XAG'), 'AUD / oz'], ['Platinum', audOz('XPT'), 'AUD / oz'], ['Palladium', audOz('XPD'), 'AUD / oz'],
    ['AUD / USD', 1 / PRICES.fx, ''],
  ];
  const html = items.map(([m, p, u]) => `<div class="tk-item"><span class="m">${m}</span><span class="p">${u.startsWith('USD') ? 'US$' : (u ? 'A$' : '')}${fmt(p, p < 100 ? 2 : 0)}</span>${u ? `<span class="u">${u}</span>` : ''}</div>`).join('');
  $('#tickerRow').innerHTML = html + html;
}
async function fetchPrices() {
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => r.ok ? r.json() : Promise.reject(r.status));
  const [xau, xag, xpt, xpd, fx] = await Promise.allSettled([
    get('https://api.gold-api.com/price/XAU'), get('https://api.gold-api.com/price/XAG'),
    get('https://api.gold-api.com/price/XPT'), get('https://api.gold-api.com/price/XPD'),
    get('https://open.er-api.com/v6/latest/USD'),
  ]);
  let ok = false;
  [['XAU', xau], ['XAG', xag], ['XPT', xpt], ['XPD', xpd]].forEach(([k, r]) => { if (r.status === 'fulfilled' && r.value?.price > 0) { PRICES[k].usd = r.value.price; ok = true; } });
  if (fx.status === 'fulfilled' && fx.value?.rates?.AUD) PRICES.fx = fx.value.rates.AUD;
  if (ok) { PRICES.live = true; PRICES.updated = new Date(); }
  renderTicker(); calcUpdate(true);
  $('#priceUpdated').textContent = PRICES.live ? `Live · ${PRICES.updated.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}` : 'Indicative spot';
}
renderTicker();

/* ---------------- calculator ---------------- */
const calc = { metal: 'XAU', purity: .75, grams: 20 };
const resultNum = $('#resultNum');
const shown = { v: 0 };
function buildPurity() {
  const wrap = $('#purityChips'); wrap.innerHTML = '';
  PURITIES[calc.metal].forEach(([label, f], i) => {
    const b = document.createElement('button'); b.className = 'chip' + ((calc.metal === 'XAU' ? f === .75 : i === 0) ? ' on' : ''); b.type = 'button';
    b.innerHTML = `${label} <small>${Math.round(f * 1000) / 10}%</small>`; b.dataset.f = f;
    b.addEventListener('click', () => { $$('.chip', wrap).forEach((c) => c.classList.remove('on')); b.classList.add('on'); calc.purity = f; calcUpdate(); });
    wrap.appendChild(b);
  });
  calc.purity = +$('.chip.on', wrap).dataset.f;
}
function calcUpdate(instant) {
  const perG = audG(calc.metal, calc.purity);
  const v = perG * calc.grams;
  const label = $('#purityChips .chip.on')?.firstChild?.textContent.trim() || '';
  $('#resultPerGram').textContent = `A$${fmt(perG, 2)}`;
  $('#resultPurity').textContent = `${label} ${PRICES[calc.metal].name.toLowerCase()}`;
  $('#resultSpot').textContent = `A$${fmt(audOz(calc.metal), 2)}`;
  $('#resultFx').textContent = fmt(PRICES.fx, 4);
  gsap.to(shown, { v, duration: instant ? 0.3 : 0.9, ease: 'power3.out', overwrite: true, onUpdate: () => { resultNum.textContent = fmt(shown.v, shown.v < 1000 ? 2 : 0); } });
}
$$('#metalChips .chip').forEach((b) => b.addEventListener('click', () => {
  $$('#metalChips .chip').forEach((c) => c.classList.remove('on')); b.classList.add('on');
  calc.metal = b.dataset.metal; buildPurity(); calcUpdate();
}));
const wIn = $('#weightInput'), wR = $('#weightRange');
function setGrams(g, from) {
  calc.grams = Math.max(0.1, Math.min(5000, +g || 0));
  if (from !== 'input') wIn.value = +calc.grams.toFixed(1);
  if (from !== 'range') wR.value = Math.min(500, calc.grams);
  wR.style.setProperty('--fill', `${(Math.min(500, calc.grams) - 1) / 499 * 100}%`);
  calcUpdate();
}
wIn.addEventListener('input', () => setGrams(wIn.value, 'input'));
wR.addEventListener('input', () => setGrams(wR.value, 'range'));
$$('#presets button').forEach((b) => b.addEventListener('click', () => setGrams(b.dataset.g)));
buildPurity(); setGrams(20);
fetchPrices();

/* ---------------- marquee strips ---------------- */
(function strips() {
  const words = ['Scrap gold', 'Fine jewellery', 'Diamonds', 'Watches', 'Bullion', 'Coins', 'Silver', 'Platinum', 'Engagement rings', 'Nuggets'];
  const html = words.map((w) => `<span>${w}<i></i></span>`).join('');
  $('#strip1').innerHTML = html + html;
  $('#strip2').innerHTML = ['Free valuations', 'Highest payout guaranteed', 'No hidden fees', 'Paid on the spot', 'Sydney', 'Wollongong', 'Newcastle'].map((w) => `<span>${w}<i></i></span>`).join('').repeat(2);
})();

/* ---------------- hero rotator ---------------- */
(function rotator() {
  const words = $$('#rotator span'); let i = 0;
  function next() {
    const cur = words[i]; i = (i + 1) % words.length; const nxt = words[i];
    gsap.to(cur, { yPercent: -100, opacity: 0, duration: .6, ease: 'power3.in', onComplete: () => { cur.classList.remove('on'); gsap.set(cur, { clearProps: 'transform,opacity' }); } });
    gsap.fromTo(nxt, { y: 0, yPercent: 100, opacity: 1 }, { yPercent: 0, opacity: 1, duration: .9, ease: 'expo.out', delay: .35, onStart: () => nxt.classList.add('on') });
  }
  window.__startRotator = () => setInterval(next, 2600);
})();

/* ---------------- loader + hero intro ---------------- */
const introTl = gsap.timeline({ paused: true })
  .fromTo('.hero .line-in', { yPercent: 115 }, { yPercent: 0, duration: 1.5, stagger: .1, ease: 'expo.out' }, 0)
  .fromTo('[data-hero="eyebrow"]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1 }, .3)
  .fromTo('[data-hero="copy"] > *', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, stagger: .12 }, .55)
  .fromTo('[data-hero="trust"] > div', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, stagger: .08 }, .7)
  .fromTo('[data-hero="ticker"]', { yPercent: 100 }, { yPercent: 0, duration: 1.2 }, .8)
  .fromTo('[data-hero="cue"]', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.2)
  .fromTo('.nav', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, .4)
  .add(() => countUp($$('.hero-trust [data-count]')), .9);

(function loader() {
  const n = { v: 0 }; const num = $('#loader .ld-num');
  gsap.set('.hero .line-in', { yPercent: 115 });
  gsap.set(['[data-hero="eyebrow"]', '[data-hero="cue"]', '[data-hero="copy"] > *', '[data-hero="trust"] > div', '.nav'], { opacity: 0 });
  gsap.set('[data-hero="ticker"]', { yPercent: 100 });
  const tl = gsap.timeline({ onComplete: () => { $('#loader').remove(); lenis && lenis.start(); } });
  tl.to(n, { v: 100, duration: 1.5, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(n.v); } })
    .to('#loader .ld-bar i', { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0)
    .to('#loader .ld-in', { y: -50, opacity: 0, duration: .55, ease: 'power3.in' }, '-=.05')
    .to('#loader', { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '-=.2')
    .add(() => { introTl.play(); gx().intro(); setTimeout(() => window.__startRotator && window.__startRotator(), 1800); }, '-=.75');
})();

/* ---------------- counters ---------------- */
function countUp(els) {
  els.forEach((el) => {
    if (el.dataset.done) return; el.dataset.done = 1;
    const to = +el.dataset.count; const o = { v: 0 };
    const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = pre + fmt(Math.round(o.v)) + suf; } });
  });
}
$$('[data-count]').filter((el) => !el.closest('.hero')).forEach((el) => {
  ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => countUp([el]) });
});

/* ---------------- hero pin: text pushes toward the viewer, gold flies past ---------------- */
if (!reduce) {
  const title = $('#heroTitle');
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: isMobile ? '+=70%' : '+=110%', pin: true, pinSpacing: true, scrub: true,
    onUpdate: (s) => {
      const p = s.progress;
      gsap.set(title, { scale: 1 + p * 1.1, opacity: 1 - Math.min(1, p * 1.45), filter: `blur(${p * 14}px)`, transformOrigin: '0% 100%' });
      gsap.set('.hero-bottom, .hero-eyebrow', { opacity: 1 - Math.min(1, p * 2.2), y: p * -60 });
      gsap.set('[data-hero="cue"]', { opacity: 1 - Math.min(1, p * 4) });
      gx().setHero(p);
    },
  });
}

/* ---------------- generic reveals ---------------- */
$$('.line-in').filter((el) => !el.closest('.hero')).forEach((el) => {
  gsap.fromTo(el, { yPercent: 115 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el.closest('.line'), start: 'top 90%', once: true } });
});
$$('[data-stagger]').forEach((group) => {
  const kids = $$(':scope > [data-reveal]', group); if (!kids.length) return;
  gsap.to(kids, { opacity: 1, y: 0, duration: 1.3, stagger: .09, ease: 'expo.out', scrollTrigger: { trigger: group, start: 'top 85%', once: true } });
  kids.forEach((k) => k.dataset.revealDone = 1);
});
$$('[data-reveal]').filter((el) => !el.dataset.revealDone).forEach((el) => {
  gsap.to(el, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
});
$$('[data-img-reveal]').forEach((el) => {
  gsap.to(el, { clipPath: 'inset(0 0 0% 0)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
});
$$('[data-parallax]').forEach((img) => {
  gsap.fromTo(img, { yPercent: -8 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});

/* ---------------- manifesto: words light up as you scroll ---------------- */
(function manifesto() {
  const el = $('#manifestoWords'); const words = splitWords(el);
  gsap.to(words, {
    color: (i, t) => (t.classList.contains('gold') ? '#F7A51C' : '#F5EFE3'), stagger: .06, ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: true },
  });
})();

/* ---------------- what we buy: horizontal scroll ---------------- */
(function gallery() {
  const track = $('#buyTrack'); const cards = $$('.buy-card', track); const count = $('#buyCount'); const bar = $('#buyProgress');
  const n = cards.length - 1; // exclude CTA card from the counter
  if (isMobile || reduce) {
    track.addEventListener('scroll', () => {
      const p = track.scrollLeft / (track.scrollWidth - track.clientWidth);
      bar.style.transform = `scaleX(${p})`; count.textContent = String(1 + Math.round(p * (n - 1))).padStart(2, '0');
    }, { passive: true });
    return;
  }
  const dist = () => track.scrollWidth - innerWidth;
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.buy-pin', start: 'top top', end: () => '+=' + dist() * 1.15, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; count.textContent = String(1 + Math.round(s.progress * (n - 1))).padStart(2, '0'); },
    },
  });
  // cards drift up into place as they enter from the right
  cards.forEach((c, i) => gsap.fromTo(c, { y: 60 + (i % 3) * 30 }, { y: 0, ease: 'none', scrollTrigger: { trigger: '.buy-pin', start: 'top top', end: () => '+=' + dist() * 1.15, scrub: 1 } }));
})();

/* ---------------- steps line ---------------- */
gsap.to('#stepsLine', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 60%', scrub: true } });

/* ---------------- spotlight cards ---------------- */
$$('.why-card').forEach((c) => c.addEventListener('pointermove', (e) => {
  const r = c.getBoundingClientRect(); c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

/* ---------------- services read-more ---------------- */
$$('.svc-toggle').forEach((btn) => btn.addEventListener('click', () => {
  const more = $('.svc-more', btn.closest('.svc-body')); const open = btn.classList.toggle('open');
  btn.firstChild.textContent = open ? 'Show less ' : 'Read the full detail ';
  gsap.to(more, { height: open ? 'auto' : 0, opacity: open ? 1 : 0, duration: .8, ease: 'expo.inOut', onComplete: () => ScrollTrigger.refresh() });
}));

/* ---------------- investment bar (WebGL ingot locked to the invest box) ---------------- */
(function investBar() {
  const media = $('#investMedia'); if (!media) return;
  const sync = (on) => gx().setInvest(on, media.getBoundingClientRect());
  ScrollTrigger.create({ trigger: '#invest', start: 'top bottom', end: 'bottom top', onUpdate: () => sync(true), onToggle: (s) => sync(s.isActive) });
  addEventListener('resize', () => sync(true));
  let down = false, lx = 0;
  media.addEventListener('pointerdown', (e) => { down = true; lx = e.clientX; media.setPointerCapture(e.pointerId); });
  media.addEventListener('pointermove', (e) => { if (!down) return; gx().spinBar(e.clientX - lx); lx = e.clientX; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => media.addEventListener(ev, () => { down = false; }));
})();

/* ---------------- reviews ---------------- */
(function reviews() {
  const revs = $$('#revStage .rev'); if (!revs.length) return;
  const star = '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 16.8 6.1 20l1.3-6.5L2.5 8.9l6.6-.8z"/></svg>';
  revs.forEach((r) => { $('.stars', r).innerHTML = star.repeat(5); splitWords($('blockquote', r)); });
  const dots = $('#revDots'); revs.forEach((_, i) => { const d = document.createElement('i'); d.addEventListener('click', () => go(i)); dots.appendChild(d); });
  let i = 0, timer;
  function show(k) {
    const r = revs[k];
    revs.forEach((x) => x.classList.remove('on')); r.classList.add('on');
    $$('i', dots).forEach((d, j) => { d.classList.remove('on'); void d.offsetWidth; if (j === k) d.classList.add('on'); });
    gsap.fromTo($$('.w', r), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .9, stagger: .018, ease: 'expo.out', overwrite: true });
    gsap.fromTo([$('.stars', r), $('cite', r)], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .8, stagger: .1, delay: .2, overwrite: true });
  }
  function go(k) { i = (k + revs.length) % revs.length; show(i); clearInterval(timer); timer = setInterval(() => go(i + 1), 6500); }
  $('#revPrev').addEventListener('click', () => go(i - 1)); $('#revNext').addEventListener('click', () => go(i + 1));
  ScrollTrigger.create({ trigger: '#revStage', start: 'top 80%', once: true, onEnter: () => go(0) });
})();

/* ---------------- FAQ ---------------- */
$$('.faq-item').forEach((item) => {
  const q = $('.faq-q', item), a = $('.faq-a', item);
  q.addEventListener('click', () => {
    const open = item.classList.toggle('open'); q.setAttribute('aria-expanded', open);
    gsap.to(a, { height: open ? 'auto' : 0, duration: .7, ease: 'expo.inOut', onComplete: () => ScrollTrigger.refresh() });
  });
});

/* ---------------- opening hours status ---------------- */
(function hours() {
  // data-hours="Mon-Fri 9:30-17:00;Sat 10:00-14:00" -> computes open/closed in Sydney time
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  $$('.loc[data-hours]').forEach((loc) => {
    const spec = loc.dataset.hours; const status = $('[data-status]', loc); const txt = $('span', status);
    if (!spec || /OPUS_FILL/.test(spec)) return;
    let open = false;
    spec.split(';').forEach((rule) => {
      const m = rule.trim().match(/^(\w{3})(?:-(\w{3}))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/); if (!m) return;
      const d0 = days.indexOf(m[1]), d1 = m[2] ? days.indexOf(m[2]) : d0; const d = now.getDay();
      const inDay = d0 <= d1 ? (d >= d0 && d <= d1) : (d >= d0 || d <= d1);
      const mins = now.getHours() * 60 + now.getMinutes();
      if (inDay && mins >= +m[3] * 60 + +m[4] && mins < +m[5] * 60 + +m[6]) open = true;
    });
    status.classList.toggle('closed', !open); txt.textContent = open ? 'Open now' : 'Closed now';
  });
})();

/* ---------------- nav ---------------- */
const nav = $('#nav'); let lastY = 0;
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (s) => {
    const y = s.scroll(); nav.classList.toggle('scrolled', y > 40);
    if (y > 400 && y > lastY + 4 && !menuOpen) nav.classList.add('hidden'); else if (y < lastY - 4 || y < 400) nav.classList.remove('hidden');
    lastY = y;
  },
});
let menuOpen = false; const menu = $('#menu'), burger = $('#burger');
function closeMenu() { if (!menuOpen) return; menuOpen = false; menu.classList.remove('open'); burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); lenis && lenis.start(); }
burger.addEventListener('click', () => {
  menuOpen = !menuOpen; menu.classList.toggle('open', menuOpen); burger.classList.toggle('open', menuOpen); burger.setAttribute('aria-expanded', menuOpen);
  if (menuOpen) { lenis && lenis.stop(); gsap.fromTo('#menu a.big', { x: -40, opacity: 0 }, { x: 0, opacity: 1, stagger: .06, duration: 1, delay: .2 }); } else lenis && lenis.start();
});

/* ---------------- cursor + magnetic ---------------- */
if (!isTouch && !reduce) {
  const cur = $('.cursor'), dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = $('.cursor-label');
  const m = { x: innerWidth / 2, y: innerHeight / 2 }, r = { x: m.x, y: m.y };
  addEventListener('pointermove', (e) => { m.x = e.clientX; m.y = e.clientY; gsap.set(dot, { x: m.x, y: m.y }); }, { passive: true });
  gsap.ticker.add(() => { r.x += (m.x - r.x) * .16; r.y += (m.y - r.y) * .16; gsap.set(ring, { x: r.x, y: r.y }); });
  $$('a, button, .chip, input[type=range]').forEach((el) => {
    el.addEventListener('pointerenter', () => cur.classList.add('is-link')); el.addEventListener('pointerleave', () => cur.classList.remove('is-link'));
  });
  $$('[data-cursor]').forEach((el) => {
    el.addEventListener('pointerenter', () => { label.textContent = el.dataset.cursor.toUpperCase(); cur.classList.add('is-label'); });
    el.addEventListener('pointerleave', () => cur.classList.remove('is-label'));
  });
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => { const b = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - b.left - b.width / 2) * .28, y: (e.clientY - b.top - b.height / 2) * .28, duration: .6, ease: 'power3.out' }); });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)' }));
  });
} else document.body.classList.remove('no-cursor');

/* ---------------- lead form (preview: no backend wired) ---------------- */
$('#leadForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.currentTarget; const name = $('#fName'), phone = $('#fPhone');
  if (!name.value.trim() || !phone.value.trim()) { gsap.fromTo([name, phone].filter((i) => !i.value.trim()), { x: -6 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)' }); return; }
  $('#formDone').classList.add('on');
});

/* ---------------- refresh after assets settle ---------------- */
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
