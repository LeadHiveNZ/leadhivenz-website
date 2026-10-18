/* Aircon Warehouse — shared behaviour. Vanilla JS, no dependencies.
   Every feature checks for its elements first, so any page can include this file. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var PHONE_DISPLAY = '09 215 9544';
  var PHONE_HREF = 'tel:+6492159544';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;

  // Reveal: the hidden state only exists once this class is on <html> (see styles.css section 22).
  if (canObserve && !reduceMotion) root.classList.add('js-reveal');

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  function ready(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------------------------------------------------------------- Header shadow */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------- Mobile menu */
  function initMenu() {
    var toggle = $('[data-menu-toggle]');
    var menu = toggle && doc.getElementById(toggle.getAttribute('aria-controls'));
    if (!toggle || !menu) return;

    function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

    function setOpen(open, returnFocus) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      root.classList.toggle('menu-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      if ('inert' in menu) menu.inert = !open;
      if (open) {
        var first = $('a', menu);
        if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 50);
      } else if (returnFocus) {
        toggle.focus();
      }
    }

    setOpen(false);
    toggle.addEventListener('click', function () { setOpen(!isOpen(), true); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) setOpen(false, true);
    });
    $all('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false, false); });
    });
    // Close if the viewport grows past the desktop-nav breakpoint.
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 1180px)');
      var onChange = function (e) { if (e.matches && isOpen()) setOpen(false, false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------------------------------------------------------------- Scroll triggers
     IntersectionObserver fires when an element enters view. A light scroll "sweep" also fires
     for anything the visitor has jumped past (anchor links, End key, fast flicks), so nothing
     is ever left hidden above the viewport. Each callback runs once per element. */
  function onEnter(elements, callback, threshold) {
    var pending = elements.slice();
    if (!pending.length) return;
    function fire(target) {
      var i = pending.indexOf(target);
      if (i === -1) return;
      pending.splice(i, 1);
      if (io) io.unobserve(target);
      callback(target);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) fire(entry.target); });
    }, { rootMargin: '0px 0px -8% 0px', threshold: threshold || 0.08 });
    pending.forEach(function (el) { io.observe(el); });

    var queued = false;
    function sweep() {
      queued = false;
      var limit = window.innerHeight * 0.92;
      pending.slice().forEach(function (el) {
        if (el.getBoundingClientRect().top < limit) fire(el);
      });
      if (!pending.length) window.removeEventListener('scroll', onScroll);
    }
    function onScroll() { if (!queued) { queued = true; window.requestAnimationFrame(sweep); } }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------- Reveal on scroll */
  function initReveal() {
    var items = $all('[data-reveal]');
    if (!items.length) return;
    if (!root.classList.contains('js-reveal')) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    // Optional stagger: data-reveal-stagger on a parent staggers its [data-reveal] children.
    $all('[data-reveal-stagger]').forEach(function (group) {
      $all('[data-reveal]', group).forEach(function (el, i) {
        el.style.setProperty('--reveal-delay', (i * 80) + 'ms');
      });
    });
    onEnter(items, function (el) { el.classList.add('is-in'); });
  }

  /* ---------------------------------------------------------------- Count-up */
  function initCountUp() {
    var nums = $all('[data-count]');
    if (!nums.length || reduceMotion || !canObserve) return; // markup already shows final values

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (isNaN(target)) return;
      var valueEl = $('.count', el) || el;
      var duration = 1200;
      var start = null;
      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        valueEl.textContent = String(Math.round(target * eased));
        if (p < 1) window.requestAnimationFrame(frame);
      }
      valueEl.textContent = '0';
      window.requestAnimationFrame(frame);
    }
    onEnter(nums, run, 0.5);
  }

  /* ---------------------------------------------------------------- Smooth in-page anchors */
  function initAnchors() {
    doc.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href').slice(1);
      var target = id && doc.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
      // Move focus for keyboard users: first form control if the target holds one.
      var focusable = target.querySelector('input, select, textarea') || target;
      if (focusable === target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      window.setTimeout(function () { focusable.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
    });
  }

  /* ---------------------------------------------------------------- Quote forms */
  // Lenient NZ phone check: landline (0X) or mobile (02X), with or without +64, spaces, dashes, brackets.
  function isNzPhone(value) {
    var v = String(value || '').replace(/[\s\-().]/g, '');
    if (/^\+?64/.test(v)) v = '0' + v.replace(/^\+?64/, '');
    return /^0\d{7,10}$/.test(v);
  }
  function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim()); }

  function el(tag, attrs, text) {
    var node = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }

  function errorFor(field) {
    var id = field.id + '-error';
    var err = doc.getElementById(id);
    if (!err) {
      err = el('p', { id: id, 'class': 'field-error', 'aria-live': 'polite' });
      var wrap = field.closest('.field') || field.parentNode;
      wrap.appendChild(err);
    }
    var described = (field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (described.indexOf(id) === -1) { described.push(id); field.setAttribute('aria-describedby', described.join(' ')); }
    return err;
  }

  function setError(field, message) {
    var err = errorFor(field);
    err.textContent = message || '';
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  function validateField(field) {
    var name = field.getAttribute('data-validate') || field.name;
    var value = (field.value || '').trim();
    if (name === 'name') {
      if (value.length < 2) return 'Please tell us your name.';
    } else if (name === 'phone') {
      if (!value) return 'Please add a phone number so we can reach you.';
      if (!isNzPhone(value)) return 'That doesn’t look like an NZ number. Try 09 215 9544 or 021 123 4567.';
    } else if (name === 'email') {
      if (field.required && !value) return 'Please add your email address.';
      if (value && !isEmail(value)) return 'Please check your email address.';
    } else if (field.required && !value) {
      return 'This field is required.';
    }
    return '';
  }

  function successPanel(firstName) {
    var panel = el('div', { 'class': 'form-success', role: 'status', tabindex: '-1' });
    var chip = el('span', { 'class': 'icon-chip', 'aria-hidden': 'true' });
    chip.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
    panel.appendChild(chip);
    panel.appendChild(el('h3', null, 'Thanks, ' + firstName + '.'));
    panel.appendChild(el('p', null, 'We’ll be in touch within one business day.'));
    var p = el('p');
    p.appendChild(doc.createTextNode('Need us sooner? Call '));
    p.appendChild(el('a', { href: PHONE_HREF }, PHONE_DISPLAY));
    p.appendChild(doc.createTextNode(', 7 days, 8am–8pm.'));
    panel.appendChild(p);
    return panel;
  }

  function initForms() {
    $all('form[data-quote-form]').forEach(function (form) {
      form.setAttribute('novalidate', '');
      var fields = $all('input, select, textarea', form).filter(function (f) {
        return f.type !== 'hidden' && f.type !== 'submit' &&
          (f.required || f.name === 'name' || f.name === 'phone' || f.name === 'email');
      });

      // Errors are only added on submit (adding them on blur shifts the layout under the
      // pointer and can swallow the click on the submit button). Once a field is flagged,
      // it re-checks live so the message clears as soon as it is fixed.
      fields.forEach(function (field) {
        function recheck() {
          if (field.getAttribute('aria-invalid') === 'true') setError(field, validateField(field));
        }
        field.addEventListener('input', recheck);
        field.addEventListener('change', recheck);
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var firstInvalid = null;
        fields.forEach(function (field) {
          var msg = validateField(field);
          setError(field, msg);
          if (msg && !firstInvalid) firstInvalid = field;
        });
        if (firstInvalid) { firstInvalid.focus(); return; }

        var nameField = form.querySelector('[name="name"]');
        var first = nameField ? nameField.value.trim().split(/\s+/)[0] : '';
        first = first ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';

        var panel = successPanel(first);
        form.parentNode.replaceChild(panel, form);
        panel.focus({ preventScroll: true });
        var rect = panel.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight) {
          panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
      });
    });
  }

  /* ---------------------------------------------------------------- Footer year */
  function initYear() {
    var y = String(new Date().getFullYear());
    $all('[data-year]').forEach(function (node) { node.textContent = y; });
  }

  ready(function () {
    [initHeader, initMenu, initReveal, initCountUp, initAnchors, initForms, initYear].forEach(function (fn) {
      try { fn(); } catch (err) { if (window.console) console.warn('[aircon-warehouse]', err); }
    });
  });
})();
