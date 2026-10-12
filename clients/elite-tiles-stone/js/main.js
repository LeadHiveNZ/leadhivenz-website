/* ==========================================================================
   Elite Tiles & Stone Limited — shared script (vanilla, no dependencies)
   1. Boot + no-JS failsafe signal
   2. Sticky header state
   3. Mobile menu
   4. Scroll reveal
   5. Stat counters
   6. Quote form (front-end only)
   7. Project lightbox
   ========================================================================== */
(function () {
  'use strict';

  /* 1. Boot ------------------------------------------------------------- */
  // Tells the inline <head> failsafe that this script loaded, so it keeps
  // the `.js` class (which enables the reveal start states).
  window.ETS_READY = true;

  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapTab(event, container, extra) {
    if (event.key !== 'Tab') return;
    var nodes = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE));
    if (extra) nodes.unshift(extra);
    nodes = nodes.filter(function (el) { return el.offsetParent !== null || el === extra; });
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* 2. Sticky header ---------------------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var ticking = false;
    var updateHeader = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    };
    updateHeader();
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }

  /* 3. Mobile menu ------------------------------------------------------ */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    var isOpen = function () { return toggle.getAttribute('aria-expanded') === 'true'; };

    var setMenu = function (open, returnFocus) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      if (open) {
        var firstLink = nav.querySelector('.nav-link');
        window.setTimeout(function () { if (firstLink) firstLink.focus(); }, 60);
      } else if (returnFocus) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', function () { setMenu(!isOpen(), true); });

    document.addEventListener('keydown', function (event) {
      if (!isOpen()) return;
      if (event.key === 'Escape') {
        setMenu(false, true);
      } else {
        trapTab(event, nav, toggle);
      }
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a') && isOpen()) setMenu(false, false);
    });

    // Close if the viewport grows past the mobile breakpoint
    var desktop = window.matchMedia('(min-width: 961px)');
    var onBreakpoint = function (mq) { if (mq.matches && isOpen()) setMenu(false, false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
    else if (desktop.addListener) desktop.addListener(onBreakpoint);
  }

  /* 4. Scroll reveal ---------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  var showAll = function () {
    Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('is-visible'); });
  };

  if (reduceMotion || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(revealEls, function (el) { revealObserver.observe(el); });

    // Anything already scrolled past (e.g. deep link / restored scroll) shows immediately
    window.addEventListener('load', function () {
      Array.prototype.forEach.call(revealEls, function (el) {
        if (el.getBoundingClientRect().bottom < 0) el.classList.add('is-visible');
      });
    });
  }

  /* 5. Stat counters ---------------------------------------------------- */
  // Markup: <span data-count="100">100</span> — the final value is in the
  // HTML so it reads correctly without JS or with reduced motion.
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    var runCounter = function (el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var duration = 1600;
      var start = null;
      var step = function (now) {
        if (start === null) start = now;
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    var counterObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });

    Array.prototype.forEach.call(counters, function (el) {
      el.textContent = '0';
      counterObserver.observe(el);
    });
  }

  /* 6. Quote form ------------------------------------------------------- */
  // Front-end only. To go live, point the form's `action` at a form service
  // (e.g. Formspree / Netlify Forms) and submit with fetch() inside onValid.
  var form = document.querySelector('[data-quote-form]');
  if (form) {
    form.setAttribute('novalidate', '');
    var success = document.querySelector('[data-form-success]');

    var rules = {
      name: function (v) { return v.trim().length >= 2 || 'Please enter your name.'; },
      phone: function (v) {
        return v.replace(/[^\d]/g, '').length >= 7 || 'Please enter a phone number we can reach you on.';
      },
      email: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.';
      },
      type: function (v) { return v !== '' || 'Please choose a project type.'; }
    };

    var setError = function (input, message) {
      var field = input.closest('.field');
      var error = field ? field.querySelector('.field__error') : null;
      if (message) {
        if (field) field.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
        if (error) error.textContent = message;
      } else {
        if (field) field.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
        if (error) error.textContent = '';
      }
    };

    var validate = function (input) {
      var rule = rules[input.name];
      if (!rule) return true;
      var result = rule(input.value);
      setError(input, result === true ? '' : result);
      return result === true;
    };

    form.addEventListener('input', function (event) {
      if (event.target.getAttribute('aria-invalid') === 'true') validate(event.target);
    });
    form.addEventListener('change', function (event) {
      if (event.target.getAttribute('aria-invalid') === 'true') validate(event.target);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var firstInvalid = null;
      Array.prototype.forEach.call(form.elements, function (input) {
        if (!input.name) return;
        if (!validate(input) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.focus();
      }
    });
  }

  /* 7. Lightbox --------------------------------------------------------- */
  var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
  if (triggers.length) {
    var icon = function (d) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d +
        '" fill="none" stroke="currentColor" stroke-width="1.25"/></svg>';
    };

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Project image viewer');
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML =
      '<p class="lightbox__counter" aria-live="polite"></p>' +
      '<figure class="lightbox__figure">' +
        '<img class="lightbox__img" alt="">' +
        '<figcaption class="lightbox__caption">' +
          '<span class="lightbox__title"></span>' +
          '<span class="lightbox__meta"></span>' +
        '</figcaption>' +
      '</figure>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous image">' + icon('M15 5l-7 7 7 7') + '</button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Next image">' + icon('M9 5l7 7-7 7') + '</button>' +
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Close image viewer">' + icon('M5 5l14 14M19 5L5 19') + '</button>';
    document.body.appendChild(box);

    var lbImg = box.querySelector('.lightbox__img');
    var lbTitle = box.querySelector('.lightbox__title');
    var lbMeta = box.querySelector('.lightbox__meta');
    var lbCounter = box.querySelector('.lightbox__counter');
    var btnPrev = box.querySelector('.lightbox__prev');
    var btnNext = box.querySelector('.lightbox__next');
    var btnClose = box.querySelector('.lightbox__close');
    var current = 0;
    var lastFocus = null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    if (triggers.length < 2) {
      btnPrev.hidden = true;
      btnNext.hidden = true;
    }

    var show = function (index) {
      current = (index + triggers.length) % triggers.length;
      var trigger = triggers[current];
      var thumb = trigger.querySelector('img');
      lbImg.classList.add('is-loading');
      lbImg.onload = function () { lbImg.classList.remove('is-loading'); };
      lbImg.src = trigger.getAttribute('href');
      lbImg.alt = thumb ? thumb.alt : '';
      if (lbImg.complete) lbImg.classList.remove('is-loading');
      lbTitle.textContent = trigger.getAttribute('data-title') || '';
      lbMeta.textContent = trigger.getAttribute('data-meta') || '';
      lbCounter.textContent = pad(current + 1) + ' / ' + pad(triggers.length);

      // Preload neighbours
      [current - 1, current + 1].forEach(function (i) {
        var t = triggers[(i + triggers.length) % triggers.length];
        var pre = new Image();
        pre.src = t.getAttribute('href');
      });
    };

    var open = function (index) {
      lastFocus = document.activeElement;
      show(index);
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      root.classList.add('lightbox-open');
      btnClose.focus();
    };

    var close = function () {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      root.classList.remove('lightbox-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    triggers.forEach(function (trigger, index) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        open(index);
      });
    });

    btnPrev.addEventListener('click', function () { show(current - 1); });
    btnNext.addEventListener('click', function () { show(current + 1); });
    btnClose.addEventListener('click', close);

    // Clicking the backdrop (anything that isn't the image or a control) closes
    box.addEventListener('click', function (event) {
      if (event.target === box || event.target.classList.contains('lightbox__figure')) close();
    });

    document.addEventListener('keydown', function (event) {
      if (!box.classList.contains('is-open')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
      else trapTab(event, box);
    });

    // Basic swipe support on touch screens
    var touchX = null;
    box.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }
})();
