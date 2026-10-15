/* =====================================================================
   D|R Painting: shared behaviour for every page.
   Markup is pre-rendered by src/build.js; this script adds photos,
   the live hours chip, phone links, and the interactive components.
   Every init guards on its elements, so all pages load the same file.
   Needs window.CONFIG (assets/config.js) loaded first.
   ===================================================================== */
(function () {
  'use strict';
  const C = window.CONFIG;
  if (!C) return;
  const doc = document;
  const root = doc.documentElement;
  const params = new URLSearchParams(location.search);
  const PH = params.has('placeholders') && params.get('placeholders') !== '0';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (PH) root.classList.add('ph-mode');

  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), C);
  // Where "free quote" links go: the form on this page if there is one, else the contact page.
  const QUOTE = $('#quote form, form#quoteForm') ? '#quote' : 'contact.html#quote';

  /* ---------- Images with graceful fallback (skipped entirely in ?placeholders=1) ---------- */
  function srcFor(key, w) {
    if (PH) return '';
    const u = C.IMG[key];
    if (!u) return '';
    return w ? u.replace(/([?&])w=\d+/, '$1w=' + w) : u;
  }
  function imgTag(key, alt, w, h, opts) {
    opts = opts || {};
    const u = srcFor(key, w);
    if (!u) return '';
    const set = (opts.widths || []).map((x) => `${esc(srcFor(key, x))} ${x}w`).join(', ');
    return `<img src="${esc(u)}"${set ? ` srcset="${set}" sizes="${opts.sizes || '100vw'}"` : ''} alt="${esc(alt)}" width="${w}" height="${h}"${opts.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" onload="this.classList.add('is-loaded')" onerror="this.parentNode&&this.parentNode.classList.add('ph--failed');this.remove()">`;
  }
  const ROLLER = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 3h13a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM18 5.5h2a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1h-8.5v3.5M10 14.5h3v7h-3z"/></svg>';
  function pic(key, alt, w, h) {
    return `<div class="ph"><span class="ph__icon">${ROLLER}</span>${imgTag(key, alt, w, h)}</div>`;
  }
  root.style.setProperty('--hero-pos', C.IMG.heroPosition || '70% center');
  // Each [data-img] slot is a pre-rendered .ph box; data-* carry the size hints.
  $$('[data-img]').forEach((el) => {
    const d = el.dataset;
    const widths = (d.widths || '800,1200,1600,2200').split(',').map(Number);
    el.insertAdjacentHTML('beforeend', imgTag(d.img, d.alt || '', +d.w || 1600, +d.h || 1067, {
      eager: 'eager' in d, widths, sizes: d.sizes || '(min-width: 1000px) 1240px, 100vw'
    }));
  });

  /* ---------- Simple bindings (already rendered; re-applied so edits to config.js show up) ---------- */
  $$('[data-bind]').forEach((el) => { const v = get(el.dataset.bind); if (v != null) el.textContent = v; });
  $$('[data-tel]').forEach((el) => { el.href = 'tel:' + C.business.phoneTel; });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- FAQ accordion ---------- */
  $$('.acc__btn').forEach((btn) => btn.addEventListener('click', () => {
    const item = btn.closest('.acc__item');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    item.classList.toggle('is-open', open);
    const panel = doc.getElementById(btn.getAttribute('aria-controls'));
    if (panel) { if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', ''); }
  }));

  /* ---------- Hours chip (NZ time) ---------- */
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  function nzNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: C.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const o = {}; parts.forEach((p) => { o[p.type] = p.value; });
      return { day: o.weekday.slice(0, 3).toLowerCase(), mins: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (e) { const d = new Date(); return { day: DAYS[(d.getDay() + 6) % 7], mins: d.getHours() * 60 + d.getMinutes() }; }
  }
  function updateStatus() {
    const n = nzNow(); const h = C.hours[n.day];
    const toM = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
    const open = !!h && n.mins >= toM(h[0]) && n.mins < toM(h[1]);
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('is-open', open);
      el.href = open ? 'tel:' + C.business.phoneTel : QUOTE;
      el.innerHTML = `<span class="status__dot" aria-hidden="true"></span><span>${open ? `Open now · call ${esc(C.business.contactName)}` : 'After hours · message us, we reply first thing'}</span>`;
    });
  }
  if ($('[data-status]')) { updateStatus(); setInterval(updateStatus, 60000); }

  /* =================== Behaviour =================== */

  /* Header: solid + shrink on scroll; mobile bar after the hero, hidden while the form is on screen */
  const hdr = $('#hdr'), mbar = $('[data-mbar]'), hero = $('.hero'), quoteSec = $('#quote');
  let ticking = false, quoteVisible = false;
  function onScroll() {
    const y = window.scrollY;
    if (hdr) hdr.classList.toggle('is-scrolled', y > 24);
    if (mbar) mbar.classList.toggle('is-on', y > (hero ? hero.offsetHeight * 0.55 : 240) && !quoteVisible);
    ticking = false;
  }
  window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  if (quoteSec && 'IntersectionObserver' in window) {
    new IntersectionObserver((ents) => { quoteVisible = ents[0].isIntersecting; onScroll(); }, { threshold: 0.15 }).observe(quoteSec);
  }
  onScroll();

  /* Mobile menu */
  (function () {
    const burger = $('.burger'), mnav = $('#mnav');
    if (!burger || !mnav) return;
    function setMenu(open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mnav.classList.toggle('is-open', open);
      root.style.overflow = open ? 'hidden' : '';
      if (mbar) mbar.style.visibility = open ? 'hidden' : '';
      $$('li', mnav).forEach((li, i) => { li.style.transitionDelay = open ? (0.05 + i * 0.04) + 's' : '0s'; });
      if (open) { if (hdr) hdr.classList.add('is-scrolled'); setTimeout(() => { const a = $('a', mnav); a && a.focus(); }, 50); } else { onScroll(); }
    }
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    mnav.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) setMenu(false); });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mnav.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1180 && mnav.classList.contains('is-open')) setMenu(false); });
    // keep focus in the menu while open
    mnav.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [burger].concat($$('a', mnav)); const i = f.indexOf(doc.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    burger.addEventListener('keydown', (e) => { if (e.key === 'Tab' && !e.shiftKey && mnav.classList.contains('is-open')) { e.preventDefault(); $('a', mnav).focus(); } });
  })();

  /* Scroll reveal */
  const revealEls = $$('[data-reveal]');
  if (REDUCED || !('IntersectionObserver' in window)) revealEls.forEach((el) => el.classList.add('is-in'));
  else {
    const rio = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => rio.observe(el));
  }

  /* Before / after slider */
  (function () {
    const ba = $('[data-ba]'); if (!ba) return;
    const knob = $('.ba__knob', ba);
    const labB = $('.ba__lab--b', ba), labA = $('.ba__lab--a', ba);
    let pos = 50, drag = false, raf = 0;
    function set(p) {
      pos = Math.max(0, Math.min(100, p));
      ba.style.setProperty('--pos', pos + '%');
      knob.setAttribute('aria-valuenow', String(Math.round(pos)));
      knob.setAttribute('aria-valuetext', Math.round(pos) + '% before');
      labB.style.opacity = pos < 14 ? 0 : 1; labA.style.opacity = pos > 86 ? 0 : 1;
    }
    const fromX = (x) => { const r = ba.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };
    ba.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = true; cancelAnimationFrame(raf); ba.classList.add('is-drag'); ba.setPointerCapture(e.pointerId); set(fromX(e.clientX)); });
    ba.addEventListener('pointermove', (e) => { if (drag) set(fromX(e.clientX)); });
    const end = () => { drag = false; ba.classList.remove('is-drag'); };
    ba.addEventListener('pointerup', end); ba.addEventListener('pointercancel', end);
    knob.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 4;
      const k = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
      if (k) { e.preventDefault(); set(pos + k); } else if (e.key === 'Home') { e.preventDefault(); set(0); } else if (e.key === 'End') { e.preventDefault(); set(100); }
    });
    set(50);
    // One gentle hint sweep the first time it comes into view
    if (!REDUCED && 'IntersectionObserver' in window) {
      const hio = new IntersectionObserver((ents) => {
        if (!ents[0].isIntersecting) return; hio.disconnect();
        const keys = [[0, 50], [700, 72], [1500, 30], [2200, 50]]; const t0 = performance.now() + 400;
        const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        (function tick(now) {
          if (drag) return; const t = now - t0; if (t < 0) { raf = requestAnimationFrame(tick); return; }
          for (let i = 0; i < keys.length - 1; i++) { const [ta, va] = keys[i], [tb, vb] = keys[i + 1]; if (t <= tb) { set(va + (vb - va) * ease((t - ta) / (tb - ta))); raf = requestAnimationFrame(tick); return; } }
          set(50);
        })(performance.now());
      }, { threshold: 0.6 });
      hio.observe(ba);
    }
  })();

  /* Lightbox (cycles through every photo in CONFIG.gallery, even where the page shows fewer) */
  (function () {
    const lb = $('#lb'), gal = $('[data-gallery]');
    if (!lb || !gal || typeof lb.showModal !== 'function') return;
    let idx = 0;
    const show = (i) => {
      idx = (i + C.gallery.length) % C.gallery.length; const g = C.gallery[idx];
      $('[data-lb-media]', lb).innerHTML = pic(g.img, g.title + ', ' + g.sub, 1600, 1067);
      const im = $('[data-lb-media] img', lb); if (im) im.removeAttribute('loading');
      $('[data-lb-t]', lb).textContent = g.title; $('[data-lb-s]', lb).textContent = '· ' + g.sub;
      $('[data-lb-n]', lb).textContent = (idx + 1) + ' / ' + C.gallery.length;
    };
    gal.addEventListener('click', (e) => { const b = e.target.closest('[data-gi]'); if (!b) return; show(+b.dataset.gi); lb.showModal(); });
    lb.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lb]'); if (a) { const act = a.dataset.lb; if (act === 'close') lb.close(); else show(idx + (act === 'next' ? 1 : -1)); return; }
      if (e.target === lb) lb.close();
    });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); });
    let sx = null;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); sx = null; });
  })();

  /* Map tabs (Google map iframe only loads when its tab is opened) + town hover */
  (function () {
    const tabs = $$('.mapcard__tabs [role="tab"]');
    function select(tab) {
      tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; const p = doc.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on; });
      if (tab.id === 'tab-g') {
        const g = $('[data-gmap]');
        if (g && !g.firstChild) g.innerHTML = `<iframe class="gmap" title="Google map centred on ${esc(C.business.town)}" src="${esc(C.map.embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
      }
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; select(n); n.focus(); } });
    });
    const hl = (name, on) => $$(`[data-town="${CSS.escape(name)}"]`).forEach((el) => el.classList.toggle('is-hl', on));
    $$('.chip[data-town]').forEach((c) => {
      c.addEventListener('mouseenter', () => hl(c.dataset.town, true));
      c.addEventListener('mouseleave', () => hl(c.dataset.town, false));
    });
  })();

  /* Quote form */
  (function () {
    const form = $('#quoteForm'); if (!form) return;
    const msg = $('[data-form-msg]', form);
    const fields = ['name', 'mobile', 'town', 'job'];
    const valid = (name, v) => name === 'mobile' ? v.replace(/[^\d]/g, '').length >= 7 : v.trim().length > 0;
    fields.forEach((n) => form.elements[n].addEventListener('input', () => {
      const f = form.elements[n].closest('.f'); if (f.classList.contains('has-err') && valid(n, form.elements[n].value)) { f.classList.remove('has-err'); form.elements[n].removeAttribute('aria-invalid'); }
    }));
    function done(name, text) {
      $('[data-done-name]', form).textContent = name ? name.split(' ')[0] : 'we’ve got it';
      $('[data-done-text]', form).textContent = text;
      form.classList.add('is-done');
      const d = $('[data-done]', form); d.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.textContent = '';
      let first = null;
      fields.forEach((n) => {
        const el = form.elements[n], ok = valid(n, el.value);
        el.closest('.f').classList.toggle('has-err', !ok);
        if (!ok) { el.setAttribute('aria-invalid', 'true'); first = first || el; } else el.removeAttribute('aria-invalid');
      });
      if (first) { first.focus(); return; }
      if (form.elements.company.value) return; // honeypot
      const data = {
        name: form.elements.name.value.trim(), mobile: form.elements.mobile.value.trim(),
        town: form.elements.town.value, job: form.elements.job.value, message: form.elements.message.value.trim(),
        business: C.business.name, page: location.href, submittedAt: new Date().toISOString()
      };
      const btn = $('button[type="submit"]', form);
      if (C.formEndpoint) {
        btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
        try {
          const res = await fetch(C.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(res.status);
          done(data.name, `Darren or Rich will be in touch soon to book a time to look at the job. Need it sooner? Call ${C.business.phoneDisplay}.`);
        } catch (err) {
          msg.textContent = `Sorry, that didn't send. Please call or text ${C.business.phoneDisplay} and we'll sort it.`;
        } finally { btn.disabled = false; btn.firstChild.textContent = 'Send my request '; }
        return;
      }
      const subject = `Quote request: ${data.job} in ${data.town}`;
      const body = `Name: ${data.name}\nMobile: ${data.mobile}\nArea: ${data.town}\nJob: ${data.job}\n\n${data.message || ''}`;
      if (C.business.email) window.location.href = `mailto:${C.business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      else window.location.href = `sms:${C.business.phoneTel}?&body=${encodeURIComponent(subject + '\n' + body)}`;
      done(data.name, `Your email app should open with your details filled in. Just hit send. If it didn't open, call or text ${C.business.phoneDisplay}.`);
    });
  })();
})();
