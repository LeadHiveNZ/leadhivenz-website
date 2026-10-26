/* Straight Line Landscaping – preview site behaviour. Vanilla JS, no dependencies. */
(function () {
  'use strict';

  // Header: transparent over the hero on load, solid off-white once scrolled (or while the menu is open)
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  function updateHeader() {
    if (!header) return;
    var solid = window.scrollY > 40 || (nav && nav.classList.contains('open'));
    header.classList.toggle('is-solid', !!solid);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // Mobile nav toggle
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      updateHeader();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        updateHeader();
        toggle.focus();
      }
    });
  }

  // Desktop services dropdown (also opens on hover/focus via CSS)
  document.querySelectorAll('.has-sub').forEach(function (li) {
    var btn = li.querySelector('.sub-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    li.addEventListener('focusout', function (e) {
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Projects gallery filter
  var filters = document.querySelector('.filters');
  var gallery = document.querySelector('.gallery');
  var countEl = document.querySelector('[data-count]');
  function visibleItems() {
    return gallery ? Array.prototype.filter.call(gallery.children, function (li) { return !li.hidden; }) : [];
  }
  if (filters && gallery) {
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      var f = btn.getAttribute('data-filter');
      filters.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      Array.prototype.forEach.call(gallery.children, function (li) {
        var cats = (li.getAttribute('data-cats') || '').split(' ');
        li.hidden = !(f === 'all' || cats.indexOf(f) !== -1);
      });
      if (countEl) {
        var n = visibleItems().length;
        countEl.textContent = n + (n === 1 ? ' photo' : ' photos');
      }
    });
  }

  // Lightbox (progressive enhancement: links open the full image without JS)
  var lb = document.getElementById('lightbox');
  if (lb && gallery && typeof lb.showModal === 'function') {
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('figcaption');
    var current = null;
    function show(link) {
      current = link;
      lbImg.src = link.getAttribute('href');
      lbImg.alt = link.querySelector('img').alt;
      lbCap.textContent = link.getAttribute('data-caption') || '';
    }
    function step(dir) {
      var links = visibleItems().map(function (li) { return li.querySelector('a'); });
      var i = links.indexOf(current);
      if (i === -1) return;
      show(links[(i + dir + links.length) % links.length]);
    }
    gallery.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      show(a);
      lb.showModal();
    });
    lb.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { step(1); });
    lb.querySelector('.lb-close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    lb.addEventListener('close', function () { if (current) current.focus(); });
  }

  // Quote form (demo only: nothing is sent anywhere)
  var form = document.getElementById('quote-form');
  if (form) {
    // Pre-tick a service when arriving from a service page, e.g. contact.html?service=decks
    try {
      var svc = new URLSearchParams(window.location.search).get('service');
      if (svc) {
        var box = form.querySelector('input[name="service"][value="' + svc.replace(/[^a-z-]/g, '') + '"]');
        if (box) box.checked = true;
      }
    } catch (err) { /* ignore */ }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var name = (form.elements.name.value || '').trim().split(' ')[0];
      var thanks = document.getElementById('form-thanks');
      thanks.querySelector('[data-name]').textContent = name ? ', ' + name : '';
      form.hidden = true;
      thanks.hidden = false;
      thanks.setAttribute('tabindex', '-1');
      thanks.focus();
      thanks.scrollIntoView({ block: 'center' });
    });
  }
})();
