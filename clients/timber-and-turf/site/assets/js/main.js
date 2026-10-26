/* Timber & Turf: mobile nav, current-page highlight, footer year. No dependencies. */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');

  // Footer year
  var year = String(new Date().getFullYear());
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = year;
  });

  // Current-page highlight (pages also ship with aria-current set; this keeps it right if a page is copied)
  var here = window.location.pathname.replace(/index\.html$/, '');
  if (here.charAt(here.length - 1) !== '/') here += '/';
  Array.prototype.forEach.call(document.querySelectorAll('[data-nav] a[href^="/"]'), function (a) {
    var href = a.getAttribute('href');
    if (href === here) {
      a.setAttribute('aria-current', 'page');
    } else if (a.getAttribute('aria-current') === 'page') {
      a.removeAttribute('aria-current');
    }
  });

  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // Close if the viewport grows to desktop while the menu is open
  var mq = window.matchMedia('(min-width: 1260px)');
  var onChange = function (ev) { if (ev.matches) setOpen(false); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();
