(function () {
'use strict';
var d = document;
var $ = function (s, c) { return (c || d).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
var megaBtn = $('.mega-btn');
var mega = $('#mega');
if (megaBtn && mega) {
var setMega = function (open) {
megaBtn.setAttribute('aria-expanded', String(open));
mega.classList.toggle('open', open);
};
megaBtn.addEventListener('click', function () { setMega(megaBtn.getAttribute('aria-expanded') !== 'true'); });
d.addEventListener('keydown', function (e) {
if (e.key === 'Escape' && mega.classList.contains('open')) { setMega(false); megaBtn.focus(); }
});
d.addEventListener('click', function (e) { if (!e.target.closest('.has-mega')) setMega(false); });
$('.has-mega').addEventListener('focusout', function (e) {
if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) setMega(false);
});
}
var menuBtn = $('.hdr .menu-btn');
var mnav = $('#mnav');
var mbar = $('#mbar');
if (menuBtn && mnav) {
var closeBtn = $('.menu-close', mnav);
var openMenu = function () {
mnav.hidden = false;
menuBtn.setAttribute('aria-expanded', 'true');
d.body.classList.add('menu-open');
if (mbar) mbar.classList.add('is-hidden');
closeBtn.focus();
};
var closeMenu = function () {
if (mnav.hidden) return;
mnav.hidden = true;
menuBtn.setAttribute('aria-expanded', 'false');
d.body.classList.remove('menu-open');
if (mbar) mbar.classList.remove('is-hidden');
menuBtn.focus();
};
menuBtn.addEventListener('click', openMenu);
closeBtn.addEventListener('click', closeMenu);
mnav.addEventListener('keydown', function (e) {
if (e.key === 'Escape') return closeMenu();
if (e.key !== 'Tab') return;
var f = $$('a, button', mnav);
var first = f[0], last = f[f.length - 1];
if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.addEventListener('resize', function () { if (window.innerWidth >= 1080) closeMenu(); });
}
if (mbar) {
var onScroll = function () { mbar.classList.toggle('is-shown', window.scrollY > 420); };
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
}
var reveals = $$('.reveal');
var showAll = function () { reveals.forEach(function (el) { el.classList.add('in'); }); };
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!('IntersectionObserver' in window) || reduce || navigator.webdriver) {
showAll();
} else {
var io = new IntersectionObserver(function (entries) {
entries.forEach(function (en) {
if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
});
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
reveals.forEach(function (el, i) {
el.style.transitionDelay = (i % 3) * 70 + 'ms';
io.observe(el);
});
}
$$('.ba-frame').forEach(function (frame) {
var range = $('.ba-range', frame);
var update = function () {
frame.style.setProperty('--pos', range.value + '%');
range.setAttribute('aria-valuetext', range.value + '% before photo, ' + (100 - range.value) + '% after photo');
};
range.addEventListener('input', update);
update();
});
var lb = $('#lightbox');
if (lb && typeof lb.showModal === 'function') {
var lbBody = $('.lb-body', lb);
$$('[data-lightbox]').forEach(function (a) {
a.addEventListener('click', function (e) {
e.preventDefault();
var src = $('img', a);
lbBody.innerHTML = '';
var im = new Image();
im.src = a.getAttribute('href');
im.alt = src ? src.alt : '';
lbBody.appendChild(im);
lb.showModal();
});
});
$('.lb-close', lb).addEventListener('click', function () { lb.close(); });
lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
}
var form = $('.qform');
if (form) {
var params = new URLSearchParams(location.search);
[['service', '#f-service'], ['suburb', '#f-suburb']].forEach(function (p) {
var v = params.get(p[0]);
var sel = $(p[1], form);
if (v && sel && $$('option', sel).some(function (o) { return (o.value || o.text) === v; })) sel.value = v;
});
var rules = {
'f-name': function (el) { return el.value.trim().length > 0; },
'f-phone': function (el) { return el.value.replace(/\D/g, '').length >= 7; },
'f-email': function (el) { return !el.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()); },
'f-consent': function (el) { return el.checked; },
'f-photo': function (el) { return !el.files || !el.files[0] || el.files[0].size <= 8 * 1024 * 1024; },
};
var check = function (id) {
var el = d.getElementById(id);
var ok = rules[id](el);
var err = d.getElementById(id + '-err');
el.setAttribute('aria-invalid', String(!ok));
if (err) err.hidden = ok;
return ok;
};
Object.keys(rules).forEach(function (id) {
var el = d.getElementById(id);
el.addEventListener(el.type === 'checkbox' || el.type === 'file' ? 'change' : 'blur', function () {
if (el.type === 'file' || el.getAttribute('aria-invalid') === 'true' || el.value) check(id);
});
el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(id); });
});
form.addEventListener('submit', function (e) {
var bad = Object.keys(rules).filter(function (id) { return !check(id); });
if (bad.length) {
e.preventDefault();
d.getElementById(bad[0]).focus();
return;
}
var btn = $('.qform-submit', form);
btn.disabled = true;
btn.firstChild.textContent = 'Sending… ';
});
}
})();