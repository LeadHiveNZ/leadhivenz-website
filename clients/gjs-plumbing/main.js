/* ==========================================================================
   GJS Plumbing — main.js (shared by every page, loaded with `defer`)
   1. Active nav link by filename
   2. Sticky header shadow
   3. Mobile menu (aria-expanded, Escape, focus trap, scroll lock)
   4. Services dropdown (hover on desktop, click/tap on touch, keyboard)
   5. Reveal on scroll (IntersectionObserver, graceful fallback)
   6. Quote form validation, Netlify Forms submission + success panel
   7. FAQ accordion ([data-accordion] = one open at a time)
   8. Gallery lightbox ([data-lightbox])
   9. Copyright year ([data-year])
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; }
  function onMq(m, fn) {
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  }
  var reduceMotion = mq('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     1. ACTIVE NAV LINK
     "" / "index.html" = home. Service pages also highlight "Services".
     Works from file://, any sub-path, and clean URLs (/plumbing).
     ------------------------------------------------------------------ */
  var SERVICE_PAGES = ['services.html', 'plumbing.html', 'drainlaying.html', 'gasfitting.html',
    'hot-water.html', 'emergency.html', 'renovations.html'];

  function fileOf(path) {
    var f = (path || '').split('#')[0].split('?')[0].split('/').pop() || 'index.html';
    try { f = decodeURIComponent(f); } catch (e) { /* keep raw */ }
    f = f.toLowerCase();
    if (f.indexOf('.') === -1) f += '.html';
    return f;
  }

  var current = fileOf(location.pathname);

  $$('.nav a[href], .mobile-menu a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || /^(tel:|mailto:|https?:)/i.test(href) || href.indexOf('#') !== -1) return;
    if (fileOf(href) === current) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
  });
  if (SERVICE_PAGES.indexOf(current) !== -1) {
    $$('[data-nav="services"]').forEach(function (a) { a.classList.add('is-active'); });
  }

  /* ------------------------------------------------------------------
     2. HEADER SHADOW ON SCROLL
     ------------------------------------------------------------------ */
  var header = $('.site-header');
  if (header) {
    var ticking = false;
    var setScrolled = function () {
      header.classList.toggle('is-scrolled', (window.pageYOffset || root.scrollTop) > 8);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(setScrolled); }
    }, { passive: true });
    setScrolled();
  }

  /* ------------------------------------------------------------------
     3. MOBILE MENU
     ------------------------------------------------------------------ */
  var toggle = $('.menu-toggle');
  var menu = $('#mobile-menu');
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function menuIsOpen() { return !!menu && menu.classList.contains('is-open'); }

  function openMenu() {
    if (!menu || !toggle) return;
    var top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    menu.style.setProperty('--menu-top', top + 'px');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    root.classList.add('menu-open');
    doc.body.classList.add('menu-open');
    var first = $(FOCUSABLE, menu);
    if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
  }

  function closeMenu(returnFocus) {
    if (!menu || !toggle || !menuIsOpen()) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    root.classList.remove('menu-open');
    doc.body.classList.remove('menu-open');
    if (returnFocus) toggle.focus();
  }

  if (toggle && menu) {
    menu.setAttribute('aria-hidden', 'true');
    toggle.addEventListener('click', function () {
      if (menuIsOpen()) closeMenu(false); else openMenu();
    });
    // Close when a link inside is followed (incl. same-page anchors / tel:)
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) closeMenu(false);
    });
    // Escape to close + simple focus trap (toggle + menu contents)
    doc.addEventListener('keydown', function (e) {
      if (!menuIsOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeMenu(true); return; }
      if (e.key !== 'Tab') return;
      var items = [toggle].concat($$(FOCUSABLE, menu));
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (items.indexOf(doc.activeElement) === -1) { e.preventDefault(); first.focus(); }
    });
    // Desktop nav takes over at ≥1100px
    onMq(mq('(min-width: 1100px)'), function (m) { if (m.matches) closeMenu(false); });
  }

  /* ------------------------------------------------------------------
     4. SERVICES DROPDOWN
     Markup: li.nav__item--dropdown[data-dropdown] > a.nav__link +
             button.nav__dropdown-toggle[aria-expanded] + div.dropdown
     ------------------------------------------------------------------ */
  var canHover = mq('(hover: hover) and (pointer: fine)');

  $$('[data-dropdown]').forEach(function (item) {
    var btn = $('.nav__dropdown-toggle', item);
    var link = $('.nav__link', item);
    var panel = $('.dropdown', item);
    if (!btn || !panel) return;
    var timer;

    function isOpen() { return item.classList.contains('is-open'); }
    function set(open) {
      window.clearTimeout(timer);
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function links() { return $$('a', panel); }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      set(!isOpen());
    });

    item.addEventListener('mouseenter', function () { if (canHover.matches) set(true); });
    item.addEventListener('mouseleave', function () {
      if (!canHover.matches) return;
      timer = window.setTimeout(function () { set(false); }, 140);
    });

    // Touch: first tap on "Services" opens the panel, second tap follows the link
    if (link) {
      link.addEventListener('click', function (e) {
        if (!canHover.matches && !isOpen()) { e.preventDefault(); set(true); }
      });
    }

    item.addEventListener('keydown', function (e) {
      var list = links();
      var idx = list.indexOf(doc.activeElement);
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isOpen()) { e.preventDefault(); set(false); btn.focus(); }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen()) set(true);
        (list[idx + 1] || list[0]).focus();
      } else if (e.key === 'ArrowUp' && idx !== -1) {
        e.preventDefault();
        (list[idx - 1] || list[list.length - 1]).focus();
      }
    });

    item.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !item.contains(e.relatedTarget)) set(false);
    });
    doc.addEventListener('click', function (e) {
      if (isOpen() && !item.contains(e.target)) set(false);
    });
  });

  /* ------------------------------------------------------------------
     5. REVEAL ON SCROLL
     ------------------------------------------------------------------ */
  var reveals = $$('.reveal');
  function revealAll() { reveals.forEach(function (el) { el.classList.add('in'); }); }

  if (!reveals.length) {
    /* nothing to do */
  } else if (reduceMotion || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  }
  window.addEventListener('beforeprint', revealAll);

  /* ------------------------------------------------------------------
     6. QUOTE FORM
     <form data-quote-form novalidate> with .field wrappers.
     - Validates [required], type=email, type=tel (≥7 digits).
     - Custom message per field via data-error="…".
     - ?service=<value> in the URL preselects the service <select>.
     - Hidden honeypot input name="company_website" (class form__hp).
     ------------------------------------------------------------------ */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function messageFor(field) {
    var v = (field.value || '').trim();
    var custom = field.getAttribute('data-error');
    if (field.required && !v) {
      if (custom) return custom;
      return field.tagName === 'SELECT' ? 'Please choose an option.' : 'Please fill in this field.';
    }
    if (v && field.type === 'email' && !EMAIL_RE.test(v)) return 'Please enter a valid email address.';
    if (v && field.type === 'tel' && v.replace(/\D/g, '').length < 7) return 'Please enter a valid phone number.';
    return '';
  }

  function showError(field, msg) {
    var wrap = field.closest('.field') || field.parentNode;
    var id = (field.id || field.name) + '-error';
    var err = doc.getElementById(id);
    if (!err) {
      err = doc.createElement('p');
      err.className = 'field__error';
      err.id = id;
      err.setAttribute('aria-live', 'polite');
      wrap.appendChild(err);
    }
    var described = (field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (msg) {
      err.textContent = msg;
      err.hidden = false;
      wrap.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
      if (described.indexOf(id) === -1) described.push(id);
    } else {
      err.textContent = '';
      err.hidden = true;
      wrap.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
      described = described.filter(function (d) { return d !== id; });
    }
    if (described.length) field.setAttribute('aria-describedby', described.join(' '));
    else field.removeAttribute('aria-describedby');
  }

  function validate(field) {
    var msg = messageFor(field);
    showError(field, msg);
    return !msg;
  }

  function successPanel(form) {
    var nameField = form.querySelector('[name="name"]');
    var first = nameField ? nameField.value.trim().split(/\s+/)[0] : '';
    var panel = doc.createElement('div');
    panel.className = 'form-success';
    panel.setAttribute('role', 'status');
    panel.setAttribute('tabindex', '-1');
    panel.innerHTML =
      '<div class="form-success__icon"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></div>' +
      '<h3 class="form-success__title"></h3>' +
      '<p class="form-success__text">Your quote request is with the team. We’ll be in touch shortly — if it’s urgent, call the office on 06 765 8423, any time.</p>' +
      '<div class="btn-row"><a class="btn btn--primary" href="tel:+6467658423">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>Call 06 765 8423</a></div>';
    // textContent keeps user input safe
    panel.querySelector('.form-success__title').textContent = first ? 'Thanks, ' + first + ' — we’ve got it' : 'Thanks — we’ve got it';
    return panel;
  }

  $$('form[data-quote-form]').forEach(function (form) {
    form.setAttribute('novalidate', '');
    var fields = $$('input, select, textarea', form).filter(function (f) {
      return f.type !== 'hidden' && f.type !== 'submit' && !f.closest('.form__hp');
    });

    // Preselect service from ?service=gasfitting
    try {
      var wanted = new URLSearchParams(location.search).get('service');
      var select = form.querySelector('select[name="service"]');
      if (wanted && select) {
        $$('option', select).forEach(function (o) { if (o.value === wanted) select.value = wanted; });
      }
    } catch (e) { /* URLSearchParams unsupported: ignore */ }

    // Re-validate a field live once it has been flagged
    fields.forEach(function (f) {
      var evt = f.tagName === 'SELECT' ? 'change' : 'input';
      f.addEventListener(evt, function () {
        if (f.getAttribute('aria-invalid') === 'true') validate(f);
      });
      f.addEventListener('blur', function () {
        if (f.value && f.value.trim()) validate(f);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      fields.forEach(function (f) {
        if (!validate(f) && !firstBad) firstBad = f;
      });
      if (firstBad) { firstBad.focus(); return; }

      var hp = form.querySelector('[name="company_website"]');
      var isBot = hp && hp.value;
      var btn = form.querySelector('button[type="submit"]');
      var card = form.closest('.form-card') || form.parentNode;
      var note = form.querySelector('.form__note') || card.querySelector('.form__note');

      function showSuccess() {
        var panel = successPanel(form);
        form.parentNode.replaceChild(panel, form);
        panel.focus({ preventScroll: true });
        if (panel.scrollIntoView) panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      }
      function showSendError() {
        if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute('data-label') || 'Send quote request'; }
        if (note) {
          note.innerHTML = 'Sorry, that didn\u2019t send. Please call <a href="tel:+6467658423">06 765 8423</a> or email <a href="mailto:grahamgjs@xtra.co.nz">grahamgjs@xtra.co.nz</a>.';
          note.setAttribute('role', 'alert');
        }
      }

      /* ----------------------------------------------------------------
         Submission. On Netlify the form is picked up by Netlify Forms
         (data-netlify="true" on the <form>): we POST it in the background
         and show the success panel. Set the notification email in the
         Netlify dashboard (Forms -> quote -> Notifications).
         Off Netlify (local preview, file://) nothing is sent.
         ---------------------------------------------------------------- */
      if (isBot) { showSuccess(); return; }
      var onNetlify = form.hasAttribute('data-netlify') && /^https?:$/.test(location.protocol);
      if (!onNetlify) { showSuccess(); return; }

      if (btn) { btn.setAttribute('data-label', btn.textContent); btn.disabled = true; btn.textContent = 'Sending\u2026'; }
      fetch(form.getAttribute('action') || location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function (r) { if (!r.ok) throw r; showSuccess(); })
        .catch(showSendError);
      return;

    });
  });

  /* ------------------------------------------------------------------
     7. FAQ ACCORDION — <div class="faq" data-accordion>
     ------------------------------------------------------------------ */
  $$('[data-accordion]').forEach(function (group) {
    var items = $$('details', group);
    items.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        items.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  });

  /* ------------------------------------------------------------------
     8. GALLERY LIGHTBOX — <a href="big.jpg" data-lightbox> <img alt>
     Falls back to opening the image if <dialog> is unsupported.
     ------------------------------------------------------------------ */
  var lbLinks = $$('a[data-lightbox]');
  if (lbLinks.length && typeof HTMLDialogElement === 'function') {
    var dlg = doc.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Image viewer');
    dlg.innerHTML =
      '<img class="lightbox__img" alt="">' +
      '<div class="lightbox__bar"><p class="lightbox__caption"></p>' +
      '<button class="lightbox__close" type="button" aria-label="Close image">' +
      '<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></div>';
    doc.body.appendChild(dlg);
    var lbImg = $('.lightbox__img', dlg);
    var lbCap = $('.lightbox__caption', dlg);
    $('.lightbox__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

    lbLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var img = $('img', a);
        var fig = a.closest('figure');
        var cap = fig ? $('figcaption', fig) : null;
        // Use the image actually displayed (it may have fallen back to a placeholder)
        lbImg.src = img && img.currentSrc ? img.currentSrc : a.getAttribute('href');
        lbImg.alt = img ? img.alt : '';
        lbCap.textContent = cap ? cap.textContent.replace(/\s+/g, ' ').trim() : (img ? img.alt : '');
        dlg.showModal();
      });
    });
  }

  /* ------------------------------------------------------------------
     9. COPYRIGHT YEAR
     ------------------------------------------------------------------ */
  var year = String(new Date().getFullYear());
  $$('[data-year]').forEach(function (el) { el.textContent = year; });
})();
