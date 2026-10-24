/* Gold Prospecting Adventures: small vanilla helpers (no framework). */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 960) setOpen(false); });
  }

  // Photos: if a jpg is missing, hide the broken image so the tinted frame shows instead.
  var markMissing = function (img) { img.classList.add('is-missing'); };
  Array.prototype.forEach.call(document.querySelectorAll('.ph img, .hero-media img'), function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) { markMissing(img); return; }
    img.addEventListener('error', function () { markMissing(img); }, { once: true });
  });

  // Footer year
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
