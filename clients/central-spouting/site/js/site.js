/* Central Spouting Ltd — site behaviour (js/site.js)
   Dependency-free, defensive: every feature checks that its markup exists.
   Loaded on every page with:  <script src="/js/site.js" defer></script>

   Features
   1. .js class on <html>           5. Image slots (placeholder → real photo)
   2. Sticky header state           6. Colour swatch picker
   3. Mobile nav + dropdowns        7. Before / after slider
   4. Reveal on scroll              8. FAQ single-open (opt-in) + current year
*/
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');

  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); }

  /* 2. Sticky header: adds .is-scrolled once the page moves -------------- */
  var header = doc.querySelector('[data-header]');
  if (header) {
    var ticking = false;
    var setHeader = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    };
    setHeader();
    on(window, 'scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(setHeader); }
    }, { passive: true });
  }

  /* 3. Mobile navigation drawer + dropdown toggles ------------------------ */
  var navToggle = doc.querySelector('[data-nav-toggle]');
  var nav = doc.getElementById('site-nav');
  var DESKTOP = window.matchMedia('(min-width: 1100px)');

  function setNav(open) {
    if (!navToggle || !nav) return;
    doc.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) {
      var first = nav.querySelector('a, button');
      if (first) first.focus({ preventScroll: true });
    }
  }
  on(navToggle, 'click', function () { setNav(!doc.body.classList.contains('nav-open')); });

  function closeSubs(except) {
    $all('.nav__item--has-sub.is-open').forEach(function (item) {
      if (item === except) return;
      item.classList.remove('is-open');
      var b = item.querySelector('.nav__sub-toggle');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  $all('.nav__sub-toggle').forEach(function (btn) {
    on(btn, 'click', function (e) {
      e.stopPropagation();
      var item = btn.closest('.nav__item');
      var open = !item.classList.contains('is-open');
      closeSubs(item);
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  on(doc, 'click', function (e) {
    if (DESKTOP.matches && !e.target.closest('.nav__item--has-sub')) closeSubs();
  });
  on(doc, 'keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (doc.body.classList.contains('nav-open')) { setNav(false); if (navToggle) navToggle.focus(); }
    closeSubs();
  });
  if (nav) {
    on(nav, 'click', function (e) {
      var a = e.target.closest('a');
      if (a && doc.body.classList.contains('nav-open')) setNav(false);
    });
  }
  var onBreakpoint = function (mq) { if (mq.matches) { setNav(false); closeSubs(); } };
  if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', onBreakpoint);
  else if (DESKTOP.addListener) DESKTOP.addListener(onBreakpoint);

  /* 4. Reveal on scroll ---------------------------------------------------- */
  $all('[data-reveal-stagger]').forEach(function (parent) {
    var step = parseInt(parent.getAttribute('data-reveal-stagger'), 10) || 90;
    Array.prototype.forEach.call(parent.children, function (child, i) {
      if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
      child.style.setProperty('--d', (i * step) + 'ms');
    });
  });
  var revealEls = $all('[data-reveal]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content hidden (e.g. print, odd viewports).
    on(window, 'beforeprint', function () { revealEls.forEach(function (el) { el.classList.add('is-visible'); }); });
  }

  /* 5. Image slots ----------------------------------------------------------
     <figure class="slot" data-label="…"><img src="/images/…jpg" alt="…"></figure>
     The <img> is invisible until it loads. A missing file leaves the
     placeholder art in place (or hides [data-hide-if-missing] ancestors). */
  function slotLoaded(slot) {
    slot.classList.add('is-loaded');
    slot.classList.remove('is-missing');
    var host = slot.closest('[data-photo-host]');
    if (host) host.classList.add('has-photo');
  }
  function slotMissing(slot, img) {
    slot.classList.add('is-missing');
    if (img && img.parentNode) img.parentNode.removeChild(img);
    var hide = slot.closest('[data-hide-if-missing]');
    if (hide) hide.hidden = true;
  }
  $all('.slot').forEach(function (slot) {
    var img = slot.querySelector('img');
    if (!img) { slotMissing(slot, null); return; }
    if (img.complete) {
      if (img.naturalWidth > 0) slotLoaded(slot); else slotMissing(slot, img);
    } else {
      on(img, 'load', function () { slotLoaded(slot); });
      on(img, 'error', function () { slotMissing(slot, img); });
    }
  });

  /* 6. Colour swatch picker ------------------------------------------------
     [data-colour-picker] contains radio inputs with data-hex, a
     [data-swatch-stage] (gets --swatch), [data-swatch-name], [data-swatch-hex]. */
  $all('[data-colour-picker]').forEach(function (picker) {
    var stage = picker.querySelector('[data-swatch-stage]');
    var nameEl = picker.querySelector('[data-swatch-name]');
    var hexEl = picker.querySelector('[data-swatch-hex]');
    var apply = function (input) {
      if (!input) return;
      var hex = input.getAttribute('data-hex');
      if (stage && hex) stage.style.setProperty('--swatch', hex);
      if (nameEl) nameEl.textContent = input.value;
      if (hexEl && hex) hexEl.textContent = 'approx. ' + hex;
    };
    $all('input[type="radio"]', picker).forEach(function (input) {
      on(input, 'change', function () { apply(input); });
    });
    apply(picker.querySelector('input[type="radio"]:checked'));
  });

  /* 7. Before / after slider ----------------------------------------------- */
  $all('[data-ba]').forEach(function (ba) {
    var range = ba.querySelector('input[type="range"]');
    if (!range) return;
    var set = function () { ba.style.setProperty('--pos', range.value + '%'); };
    on(range, 'input', set);
    set();
  });

  /* 8a. FAQ: add data-single to .faq to keep only one answer open ---------- */
  $all('.faq[data-single]').forEach(function (faq) {
    var items = $all('details', faq);
    items.forEach(function (d) {
      on(d, 'toggle', function () {
        if (d.open) items.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  });

  /* 8b. Current year ------------------------------------------------------- */
  $all('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
