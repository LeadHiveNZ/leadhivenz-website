/* Living Colour Ltd - site behaviour (no dependencies) */
(function () {
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // file:// preview: make folder links open index.html
  if (location.protocol === 'file:') {
    d.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^([a-z]+:|#|\/\/)/i.test(h)) return;
      var m = h.match(/^([^?#]*)(.*)$/), p = m[1];
      if (p === '' || p === '.' || p === '..' || /\/$/.test(p)) {
        a.setAttribute('href', p.replace(/\/?$/, '/').replace(/^\/$/, './') + 'index.html' + m[2]);
      }
    });
  }

  // sticky header shadow
  var hdr = d.querySelector('.site-header');
  function onScroll() { if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile drawer
  var burger = d.querySelector('.burger'), nav = d.getElementById('site-nav');
  function setNav(open) {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
    d.body.classList.toggle('nav-open', open);
  }
  if (burger) burger.addEventListener('click', function () { setNav(burger.getAttribute('aria-expanded') !== 'true'); });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setNav(false); closeMega(); }
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 1060) setNav(false); });

  // services mega menu toggle (click / keyboard / touch)
  var mt = d.querySelector('.mega-toggle'), mli = mt && mt.closest('.has-mega');
  function closeMega() { if (mli) { mli.classList.remove('open'); mt.setAttribute('aria-expanded', 'false'); } }
  if (mt) {
    mt.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !mli.classList.contains('open');
      mli.classList.toggle('open', open);
      mt.setAttribute('aria-expanded', open);
    });
    d.addEventListener('click', function (e) { if (window.innerWidth > 1060 && !mli.contains(e.target)) closeMega(); });
  }

  // reveal on scroll
  var rev = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rev.forEach(function (el) { io.observe(el); });
  } else rev.forEach(function (el) { el.classList.add('in'); });

  // animated counters
  var cs = d.querySelectorAll('[data-count]');
  function count(el) {
    var end = parseFloat(el.getAttribute('data-count')), dec = (el.getAttribute('data-count').split('.')[1] || '').length;
    if (reduce) { el.textContent = end.toFixed(dec); return; }
    var t0 = null, dur = 1400;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1), v = end * (1 - Math.pow(1 - p, 3));
      el.textContent = v.toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { count(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.5 });
    cs.forEach(function (el) { co.observe(el); });
  }

  // review carousels
  d.querySelectorAll('[data-carousel]').forEach(function (wrap) {
    var track = wrap.querySelector('.track'), prev = wrap.querySelector('[data-prev]'), next = wrap.querySelector('[data-next]');
    if (!track) return;
    function by() { var c = track.children[0]; return c ? c.getBoundingClientRect().width + 24 : 300; }
    function upd() {
      if (!prev) return;
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -by(), behavior: reduce ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: by(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  });

  // file input feedback
  d.querySelectorAll('.file-drop input[type=file]').forEach(function (inp) {
    var label = inp.closest('.file-drop').querySelector('strong'), orig = label.textContent;
    inp.addEventListener('change', function () {
      var n = inp.files ? inp.files.length : 0;
      label.textContent = n ? (n === 1 ? inp.files[0].name : n + ' photos selected') : orig;
    });
  });

  // before/after sliders: drag (mouse, pen, horizontal touch) or arrow keys on the range input
  d.querySelectorAll('.ba-frame').forEach(function (f) {
    var r = f.querySelector('.ba-r');
    if (!r) return;
    function set(v) {
      v = Math.max(0, Math.min(100, v));
      r.value = v;
      f.style.setProperty('--pos', v + '%');
      r.setAttribute('aria-valuetext', Math.round(v) + '% before photo');
    }
    function at(e) { var b = f.getBoundingClientRect(); set((e.clientX - b.left) / b.width * 100); }
    function end() { f.classList.remove('drag'); }
    r.addEventListener('input', function () { set(+r.value); });
    f.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      f.setPointerCapture(e.pointerId);
      if (e.pointerType !== 'touch') { f.classList.add('drag'); at(e); e.preventDefault(); r.focus({ preventScroll: true }); }
    });
    f.addEventListener('pointermove', function (e) { if (f.hasPointerCapture(e.pointerId)) { f.classList.add('drag'); at(e); } });
    f.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch' && !f.classList.contains('drag')) at(e); end(); });
    f.addEventListener('pointercancel', end);
    set(+r.value);
  });

  // pre-select service in quote form from ?service=
  var sel = d.querySelector('select[name=service]'), m = location.search.match(/service=([\w-]+)/);
  if (sel && m) Array.prototype.forEach.call(sel.options, function (o) { if (o.getAttribute('data-k') === m[1]) sel.value = o.value; });
})();
