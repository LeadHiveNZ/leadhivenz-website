/* Aroha Seniors: small enhancements shared by every page.
   The site still works without this file: links, the menu (<details>), FAQ and the
   forms' email fallback are all plain HTML. Settings arrive in window.ASCT from build.py. */
(function () {
  const cfg = window.ASCT || {};
  const d = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---- Text size (A / A+ / A++), remembered in this browser ---- */
  const sizeBtns = $$('.textsize button');
  function setSize(s, save) {
    if (s === 'md') d.removeAttribute('data-fs'); else d.setAttribute('data-fs', s);
    sizeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === s)));
    if (save) { try { localStorage.setItem('aroha-text', s); } catch (e) {} }
  }
  setSize(d.getAttribute('data-fs') || 'md', false);
  sizeBtns.forEach(b => b.addEventListener('click', () => setSize(b.dataset.size, true)));

  /* ---- Mobile menu: size the panel to the screen, lock page scroll, close on Escape ---- */
  const head = $('.site-head'), menu = $('.mnav');
  if (menu) {
    const place = () => menu.style.setProperty('--panel-h', Math.max(200, innerHeight - head.getBoundingClientRect().bottom) + 'px');
    menu.addEventListener('toggle', () => {
      if (menu.open) place();
      document.body.style.overflow = menu.open ? 'hidden' : '';
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.open) { menu.open = false; $('summary', menu).focus(); }
    });
    addEventListener('resize', () => { if (menu.open) { if (innerWidth > 980) menu.open = false; else place(); } });
  }

  /* ---- Header shadow once the page scrolls ---- */
  const onScroll = () => head.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---- Fade sections in as they scroll into view ---- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  $$('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'));

  /* ---- "Register your interest" links pass ?i=Volunteer etc. to preselect the form ---- */
  const pick = new URLSearchParams(location.search).get('i');
  const sel = $('#gi-type');
  if (pick && sel && [...sel.options].some(o => o.value === pick)) sel.value = pick;

  /* ---- Forms: post to the endpoint, or open the visitor's email app ---- */
  $$('form[data-form]').forEach(form => {
    form.noValidate = true;
    const err = $('.form-err', form);
    const f = n => form.querySelector('[name="' + n + '"]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const name = (data.name || '').trim(), phone = (data.phone || '').trim(), email = (data.email || '').trim();
      $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
      let msg = '';
      if (!name) { msg = 'Please tell us your name.'; f('name').setAttribute('aria-invalid', 'true'); f('name').focus(); }
      else if (!phone && !email) { msg = 'Please leave a phone number or an email so we can reply.'; f('phone').setAttribute('aria-invalid', 'true'); f('phone').focus(); }
      else if (email && !/^\S+@\S+\.\S+$/.test(email)) { msg = 'That email address doesn\'t look quite right.'; f('email').setAttribute('aria-invalid', 'true'); f('email').focus(); }
      err.textContent = msg; err.classList.toggle('on', !!msg);
      if (msg) return;

      const btn = $('button[type="submit"]', form);
      if (cfg.formEndpoint) {
        btn.disabled = true;
        try {
          const res = await fetch(cfg.formEndpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ form: form.dataset.form, page: location.href, sentAt: new Date().toISOString() }, data))
          });
          if (!res.ok) throw new Error(res.status);
          thank(form, name, false);
        } catch (x) {
          btn.disabled = false;
          err.textContent = 'Sorry, that didn\'t send. Please call or text us on ' + cfg.phone + '.';
          err.classList.add('on');
        }
      } else {
        const lines = Object.entries(data).filter(([, v]) => String(v).trim()).map(([k, v]) => k.charAt(0).toUpperCase() + k.slice(1) + ': ' + v);
        location.href = 'mailto:' + cfg.email + '?subject=' + encodeURIComponent('Website enquiry (' + form.dataset.form + '): ' + name) + '&body=' + encodeURIComponent(lines.join('\n'));
        thank(form, name, true);
      }
    });
  });
  function thank(form, name, viaEmail) {
    const box = document.createElement('div');
    box.className = 'thanks';
    box.setAttribute('role', 'status');
    box.innerHTML = '<span class="tile-ic t-leaf"><svg class="ic"><use href="#i-check"/></svg></span><h3></h3><p></p>';
    box.querySelector('h3').textContent = 'Ngā mihi, ' + name.split(' ')[0] + '!';
    box.querySelector('p').textContent = viaEmail
      ? 'Your email app should now open with your message ready to send. If it doesn\'t, call or text us on ' + cfg.phone + '.'
      : 'Thanks for getting in touch. We\'ll be in contact soon.';
    form.replaceWith(box);
    box.setAttribute('tabindex', '-1'); box.focus();
  }
})();
