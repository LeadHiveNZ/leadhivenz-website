/* Onshore Air · site.js
   1. mobile nav toggle  2. hours-aware status line (Australia/Brisbane)  3. quote form validation
   4. Nimbata call-tracking sync (LeadHive convention: mirrors the number in #nb-source to every phone link).
   5. Before/after comparison slider (a native range input; this only mirrors its value into --pos).
   No dependencies, no network requests. The form posts natively to Netlify Forms. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var each = function (sel, fn) { Array.prototype.forEach.call(doc.querySelectorAll(sel), fn); };

  /* 1. Mobile navigation */
  var toggle = doc.querySelector('.nav-toggle');
  var menu = doc.getElementById('mobile-menu');
  var setMenu = function (open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    root.classList.toggle('menu-open', open);
  };
  if (toggle && menu) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    doc.addEventListener('click', function (e) {
      if (root.classList.contains('menu-open') && !e.target.closest('.header-inner, .mobile-menu')) setMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); toggle.focus(); }
    });
    var desktop = window.matchMedia('(min-width: 1180px)');
    var onChange = function () { if (desktop.matches) setMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
  }

  /* 2. Status line: open Mon–Sat 7:00–17:00 Brisbane time (UTC+10, no daylight saving) */
  var brisbane = function () {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Brisbane', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      var get = function (type) { for (var i = 0; i < parts.length; i++) { if (parts[i].type === type) return parts[i].value; } return ''; };
      var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      if (day < 0) throw new Error('weekday');
      return { day: day, mins: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
    } catch (err) {
      var d = new Date(Date.now() + 10 * 36e5);
      return { day: d.getUTCDay(), mins: d.getUTCHours() * 60 + d.getUTCMinutes() };
    }
  };
  var now = brisbane();
  var workday = now.day >= 1 && now.day <= 6;
  var open = workday && now.mins >= 7 * 60 && now.mins < 17 * 60;
  var when = workday && now.mins < 7 * 60 ? 'from 7am' : (now.day === 6 || now.day === 0 ? 'first thing Monday' : 'first thing tomorrow');
  var statusText = open ? 'Open now · answered by Luke' : 'Closed · leave your details, we’ll call ' + when;
  each('[data-status]', function (el) {
    el.classList.add(open ? 'is-open' : 'is-closed');
    var t = el.querySelector('.status-text');
    if (t) t.textContent = statusText;
  });

  /* 3. Quote form validation (falls back to native required/pattern checks without JS) */
  var form = doc.querySelector('.quote-form');
  if (form) {
    form.setAttribute('novalidate', '');
    var rules = {
      name: function (v) { return v.trim().length >= 2; },
      phone: function (v) { var digits = v.replace(/\D/g, ''); return /^[0-9 +()\-]+$/.test(v.trim()) && digits.length >= 8 && digits.length <= 12; },
      suburb: function (v) { return v.trim().length >= 2; },
      service: function (v) { return v !== ''; }
    };
    var check = function (el) {
      var ok = rules[el.name](el.value);
      el.closest('.field').classList.toggle('has-error', !ok);
      if (ok) el.removeAttribute('aria-invalid'); else el.setAttribute('aria-invalid', 'true');
      return ok;
    };
    var button = form.querySelector('[type="submit"]');
    var label = button && button.querySelector('span');
    var idle = label ? label.textContent : '';
    form.addEventListener('submit', function (e) {
      var first = null;
      Object.keys(rules).forEach(function (name) {
        var el = form.elements[name];
        if (el && !check(el) && !first) first = el;
      });
      if (first) { e.preventDefault(); first.focus(); return; }
      if (button) { button.disabled = true; if (label) label.textContent = 'Sending…'; }
    });
    var recheck = function (e) {
      var el = e.target;
      if (rules[el.name] && el.closest('.field').classList.contains('has-error')) check(el);
    };
    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);
    window.addEventListener('pageshow', function () { if (button) { button.disabled = false; if (label) label.textContent = idle; } });
  }

  /* 4. Nimbata swaps the number inside #nb-source; copy it to every visible number and tel: link */
  var source = doc.getElementById('nb-source');
  if (source && window.MutationObserver) {
    var applied = source.textContent.trim();
    var sync = function () {
      var shown = source.textContent.trim();
      if (!shown || shown === applied) return;
      applied = shown;
      var digits = shown.replace(/[^\d+]/g, '');
      var dial = digits.charAt(0) === '+' ? digits : (digits.charAt(0) === '0' ? '+61' + digits.slice(1) : digits);
      each('[data-phone-display]', function (el) { el.textContent = shown; });
      each('[data-phone-link]', function (el) { el.setAttribute('href', 'tel:' + dial); });
    };
    new MutationObserver(sync).observe(source, { childList: true, characterData: true, subtree: true });
  }

  /* 5. Before/after slider: the range input sits over the whole frame, so drag, click, keyboard and screen readers
     all use the native control. Without JS it rests at 50%. */
  each('[data-compare]', function (el) {
    var input = el.querySelector('.compare-range');
    if (!input) return;
    var set = function () { el.style.setProperty('--pos', input.value + '%'); };
    input.addEventListener('input', set);
    set();
  });
})();
