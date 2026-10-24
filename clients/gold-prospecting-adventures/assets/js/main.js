/* Gold Prospecting Adventures: small vanilla helpers (no framework). */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');

  var PHONE_DISPLAY = '022 533 5445';
  var PHONE_TEL = 'tel:+64225335445';

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

  /* ------------------------------------------------------------------
     Enquiry form
     - Validates required fields with friendly inline messages.
     - If window.GPA_CONFIG.formEndpoint is set, POSTs JSON there with fetch
       and shows an inline success / error message.
     - Otherwise the browser submits the form natively (Netlify Forms etc.).
     - A page loaded with ?sent=1 (e.g. after a native submit redirects back)
       shows the thank-you state.
     ------------------------------------------------------------------ */
  var cfg = window.GPA_CONFIG || {};
  var endpoint = (cfg.formEndpoint || '').trim();

  var MESSAGES = {
    name: 'Please add your name so Ian knows who to ask for.',
    phone: 'Please add a phone number so Ian can call or text you back.',
    phoneBad: 'That phone number looks a bit short. Please check it.',
    email: 'That email address doesn’t look quite right. Please check it, or leave it blank.'
  };

  var successHTML = function () {
    return '<div class="enq-success" role="status" tabindex="-1">' +
      '<span class="orn" aria-hidden="true"></span>' +
      '<h3>Thanks, Ian will be in touch</h3>' +
      '<p>Your enquiry is on its way. Ian will call or text you back. In a hurry? Give him a ring.</p>' +
      '<a class="big-phone" href="' + PHONE_TEL + '">' + PHONE_DISPLAY + '</a>' +
      '</div>';
  };

  var showSuccess = function (form) {
    var wrap = document.createElement('div');
    wrap.innerHTML = successHTML();
    var box = wrap.firstChild;
    var card = form.closest('.enquiry-card');
    if (card) {
      // keep the card, swap its intro + form for the thank-you message
      Array.prototype.forEach.call(card.querySelectorAll('.kicker, .enquiry-title, .enquiry-intro'), function (el) { el.hidden = true; });
    }
    form.parentNode.replaceChild(box, form);
    box.focus({ preventScroll: true });
    if (box.scrollIntoView && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'center' });
  };

  var setError = function (field, msg) {
    var err = document.getElementById(field.id + '-err');
    if (msg) {
      field.setAttribute('aria-invalid', 'true');
      if (err) err.textContent = msg;
    } else {
      field.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    }
  };

  var checkField = function (field) {
    var v = (field.value || '').trim();
    if (field.name === 'name') return v ? '' : MESSAGES.name;
    if (field.name === 'phone') {
      if (!v) return MESSAGES.phone;
      return v.replace(/\D/g, '').length < 6 ? MESSAGES.phoneBad : '';
    }
    if (field.name === 'email') {
      if (!v) return '';
      return field.validity && field.validity.typeMismatch ? MESSAGES.email : '';
    }
    return '';
  };

  Array.prototype.forEach.call(document.querySelectorAll('form.enquiry'), function (form) {
    if (/[?&]sent=1\b/.test(window.location.search)) { showSuccess(form); return; }

    var fields = Array.prototype.slice.call(form.querySelectorAll('[name="name"], [name="phone"], [name="email"]'));
    var status = form.querySelector('.enq-status');
    var button = form.querySelector('button[type="submit"]');
    var buttonText = button ? button.textContent : '';

    // JS takes over validation (friendlier messages); without JS the native `required` still works.
    form.noValidate = true;

    fields.forEach(function (f) {
      f.addEventListener('blur', function () { if (f.value.trim() || f.hasAttribute('aria-invalid')) setError(f, checkField(f)); });
      f.addEventListener('input', function () { if (f.hasAttribute('aria-invalid')) setError(f, checkField(f)); });
    });

    form.addEventListener('submit', function (e) {
      var firstBad = null;
      fields.forEach(function (f) {
        var msg = checkField(f);
        setError(f, msg);
        if (msg && !firstBad) firstBad = f;
      });
      if (firstBad) {
        e.preventDefault();
        if (status) { status.className = 'enq-status is-error'; status.textContent = 'Almost there. Please check the highlighted fields.'; }
        firstBad.focus();
        return;
      }
      if (status) { status.className = 'enq-status'; status.textContent = ''; }

      // Honeypot filled in: quietly pretend it worked.
      var hp = form.querySelector('[name="company"]');
      if (hp && hp.value) { e.preventDefault(); showSuccess(form); return; }

      if (!endpoint || !window.fetch) return; // native POST (Netlify Forms or the form's action)

      e.preventDefault();
      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === 'submit') return;
        data[el.name] = (el.value || '').trim();
      });
      data.source = 'Gold Prospecting Adventures website';
      data.pageUrl = window.location.href;

      form.classList.add('is-sending');
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showSuccess(form);
      }).catch(function () {
        form.classList.remove('is-sending');
        if (button) { button.disabled = false; button.textContent = buttonText; }
        if (status) {
          status.className = 'enq-status is-error';
          status.innerHTML = 'Sorry, that didn’t send. Please try again, or call or text Ian on <a href="' + PHONE_TEL + '">' + PHONE_DISPLAY + '</a>.';
        }
      });
    });
  });
})();
