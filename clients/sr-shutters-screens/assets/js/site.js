/* SR Shutters & Screens: shared script for every page (LeadHive demo, Oct 2026). Vanilla JS, no build step.

   ▼▼ PASTE THE REAL LINK ▼▼
   Joe: replace GOOGLE_REVIEW_URL with Shane's short review link from Google Business Profile
   (Read reviews → Get more reviews → Copy), e.g. "https://g.page/r/XXXXXXXXXXXX/review", then test it in a
   private window. The value below is the write-review fallback built from the "SR Shutters and Screens"
   GBP place_id found in research. It works, but the g.page link is the one Google supports long term.
   This one const drives the QR codes and the gold button on review.html and the QR on reviews.html.

   PHONE: each page has ONE #nb-source span holding the number Nimbata is set to REPLACE (0411 885 227).
   Every [data-phone-display] / [data-phone-link] re-syncs from it, so when Nimbata swaps that span the
   whole page follows.

   FORM (contact.html): posts JSON to LEAD_ENDPOINT. From file:// or with ?demo=1 it skips the network
   call and shows the success state. contact.html?product=<key> pre-ticks a product chip. */
const GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJX0h2jR-nMAYRF8pfdpDSDkM";
const LEAD_ENDPOINT = "/functions/v1/send-lead-notification";
const DEMO = location.protocol === "file:" || /[?&]demo=1/.test(location.search);
const QR_LIB = { src: "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
                 integrity: "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1" };

(function(){
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;
  if (/[?&]demo=1/.test(location.search)) document.documentElement.classList.add("is-demo");

  /* --- phone propagation from #nb-source (Nimbata) --- */
  const src = $("#nb-source");
  const shownNumber = () => (src && (src.textContent || "").trim()) || (src && src.dataset.fallback) || "0411 885 227";
  const toDial = s => { const d = s.replace(/[^\d+]/g, ""); return d.startsWith("+") ? d : (d.startsWith("0") ? "+61" + d.slice(1) : d); };
  function syncPhone(){
    const shown = shownNumber();
    $$("[data-phone-display]").forEach(el => { if (el.textContent !== shown) el.textContent = shown; });
    $$("[data-phone-link]").forEach(el => el.setAttribute("href", "tel:" + toDial(shown)));
  }
  syncPhone();
  if (src) new MutationObserver(syncPhone).observe(src, {childList:true, characterData:true, subtree:true});
  [300, 900, 2000, 4000].forEach(t => setTimeout(syncPhone, t));

  /* --- header: solid after 80px --- */
  const hdr = $("#hdr");
  const onScroll = () => hdr && hdr.classList.toggle("solid", scrollY > 80 || document.body.classList.contains("menu-open"));
  addEventListener("scroll", onScroll, {passive:true}); onScroll();

  /* --- products dropdown (hover on desktop; click / keyboard toggles) --- */
  const closeDD = except => $$(".dd.open").forEach(dd => { if (dd !== except) { dd.classList.remove("open"); $(".dd-t", dd).setAttribute("aria-expanded", "false"); } });
  $$(".dd").forEach(dd => {
    const t = $(".dd-t", dd);
    t.addEventListener("click", () => { const open = !dd.classList.contains("open"); closeDD(dd); dd.classList.toggle("open", open); t.setAttribute("aria-expanded", open); });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".dd")) closeDD(); });

  /* --- mobile menu --- */
  const burger = $("#burger"), mnav = $("#mnav");
  const setMenu = open => {
    if (!burger || !mnav) return;
    burger.setAttribute("aria-expanded", open); burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mnav.classList.toggle("open", open); document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : ""; onScroll();
  };
  if (burger && mnav) {
    burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
    mnav.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
  }
  addEventListener("keydown", e => { if (e.key === "Escape") { closeDD(); if (mnav && mnav.classList.contains("open")) setMenu(false); } });

  /* --- reveal on scroll (once) --- */
  if (hasIO) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), {threshold:.12, rootMargin:"0px 0px -4% 0px"});
    $$(".rv").forEach(el => io.observe(el));
  } else $$(".rv").forEach(el => el.classList.add("in"));

  /* --- before / after sliders --- */
  $$(".ba-frame").forEach(f => {
    let p = 50, drag = false, touched = false;
    const set = v => { p = Math.max(0, Math.min(100, v)); f.style.setProperty("--p", p + "%"); f.setAttribute("aria-valuenow", Math.round(p)); f.setAttribute("aria-valuetext", Math.round(p) + "% before"); };
    const at = e => { const r = f.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
    f.addEventListener("pointerdown", e => { drag = touched = true; f.classList.add("dragging"); try { f.setPointerCapture(e.pointerId); } catch(_){} at(e); });
    f.addEventListener("pointermove", e => { if (drag) at(e); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => f.addEventListener(t, () => { drag = false; f.classList.remove("dragging"); }));
    f.addEventListener("keydown", e => {
      const k = {ArrowLeft:-5, ArrowDown:-5, ArrowRight:5, ArrowUp:5, PageDown:-20, PageUp:20}[e.key];
      if (k) { touched = true; set(p + k); e.preventDefault(); }
      else if (e.key === "Home") { set(0); e.preventDefault(); } else if (e.key === "End") { set(100); e.preventDefault(); }
    });
    set(50);
    if (!reduce && hasIO) {   /* one gentle nudge the first time it scrolls into view */
      const nio = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; nio.disconnect(); setTimeout(() => {
        if (touched) return; const t0 = performance.now(), D = 1400;
        (function step(t){ if (touched) return; const k = Math.min(1, (t - t0) / D); set(50 + 15 * Math.sin(k * Math.PI)); if (k < 1) requestAnimationFrame(step); })(t0);
      }, 500); }, {threshold:.6});
      nio.observe(f);
    }
  });

  /* --- gallery filter (our-work.html) --- */
  $$(".filt").forEach(bar => {
    const grid = $(bar.dataset.for);
    bar.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !grid) return;
      $$("button", bar).forEach(x => x.setAttribute("aria-pressed", x === b));
      const f = b.dataset.f;
      $$(".tile", grid).forEach(t => { t.hidden = !(f === "all" || t.dataset.cat === f); if (!t.hidden) t.classList.add("in"); });
    });
  });

  /* --- lightbox (any [data-gallery]; only visible tiles take part) --- */
  const lb = $("#lb");
  if (lb) {
    const lbImg = $("#lb-img"), lbCap = $("#lb-cap");
    let set = [], cur = 0;
    const show = i => { cur = (i + set.length) % set.length; const t = set[cur], im = $("img", t), c = $(".cap", t);
      lbImg.src = t.dataset.full; lbImg.alt = im.alt; lbCap.textContent = c ? $("b", c).textContent + " · " + c.lastChild.textContent : ""; };
    $$("[data-gallery] .tile").forEach(t => t.addEventListener("click", () => {
      set = $$(".tile", t.closest("[data-gallery]")).filter(x => !x.hidden);
      show(set.indexOf(t)); if (lb.showModal) lb.showModal(); else lb.setAttribute("open", "");
    }));
    $("#lb-x").addEventListener("click", () => lb.close());
    $("#lb-p").addEventListener("click", () => show(cur - 1));
    $("#lb-n").addEventListener("click", () => show(cur + 1));
    lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", e => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
  }

  /* --- quote form (contact.html) --- */
  const form = $("#lead");
  if (form) {
    const key = new URLSearchParams(location.search).get("product");
    if (key) { const box = $('#lead input[data-key="' + key.replace(/[^a-z-]/g, "") + '"]'); if (box) box.checked = true; }
    const btn = $("#f-btn"), err = $("#f-err");
    const esc = s => s.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const success = name => {
      const first = esc((name || "").trim().split(/\s+/)[0] || "");
      $("#form-card").innerHTML = '<div class="ok" role="status"><div class="okm"><svg aria-hidden="true"><use href="#i-check"/></svg></div><h3>Thanks' + (first ? ", " + first : "") + '.</h3><p>Your request is with Shane. He\'ll call you personally to book a time for your free measure and quote.</p><span class="euc-chip">Request received</span></div>';
      $("#form-card").scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"center"});
    };
    form.addEventListener("submit", async e => {
      e.preventDefault(); err.textContent = "";
      if (!form.reportValidity()) return;
      if ($("#f-web").value) { success($("#f-name").value); return; }            /* honeypot: bots get a silent fake success */
      const products = $$('#lead input[name="product"]:checked').map(i => i.value);
      const msg = $("#f-msg").value.trim();
      const body = { name: $("#f-name").value.trim(), phone: $("#f-phone").value.trim(), suburb: $("#f-suburb").value,
        issue: (products.length ? products.join(", ") : "Not specified") + (msg ? " — " + msg : ""),
        isUrgent: false, products, message: msg, source: "sr-shutters-screens", page: location.pathname + (key ? "?product=" + key : "") };
      if (DEMO) { success(body.name); return; }
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        const r = await fetch(LEAD_ENDPOINT, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
        if (!r.ok) throw new Error(r.status); success(body.name);
      } catch (_) {
        btn.disabled = false; btn.textContent = "Request my free measure";
        err.innerHTML = 'Sorry, that didn\'t send. Please call Shane on <a href="tel:' + toDial(shownNumber()) + '">' + esc(shownNumber()) + "</a>.";
      }
    });
  }

  /* --- mobile bar: shows once the hero has scrolled away, hides while a quote CTA band is on screen --- */
  const mbar = $("#mbar"), top = $("#top");
  if (mbar && top && hasIO) {
    let pastHero = false; const vis = new Set();
    const upd = () => mbar.classList.toggle("show", pastHero && vis.size === 0);
    new IntersectionObserver(es => { pastHero = !es[0].isIntersecting; upd(); }, {rootMargin:"-60% 0px 0px 0px"}).observe(top);
    const hio = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)); upd(); }, {threshold:0});
    $$("[data-mbar-hide]").forEach(el => hio.observe(el));
  }

  /* --- review page: button + printed URL read the one const --- */
  const go = $("#go"); if (go) go.href = GOOGLE_REVIEW_URL;
  const urlText = $("#url-text"); if (urlText) urlText.textContent = GOOGLE_REVIEW_URL.replace(/^https?:\/\//, "");

  /* --- QR codes ([data-qr]); lazy-loads qrcode-generator 1.4.4 from cdnjs when one nears view --- */
  const qrs = $$("[data-qr]");
  if (qrs.length) {
    const draw = () => qrs.forEach(el => { try { const q = qrcode(0, "M"); q.addData(GOOGLE_REVIEW_URL); q.make(); el.innerHTML = q.createSvgTag({cellSize: +el.dataset.qr || 4, margin:0, scalable:true}); } catch(_) { el.textContent = "QR unavailable"; } });
    let loading = false;
    const load = () => { if (window.qrcode) return draw(); if (loading) return; loading = true;
      const s = document.createElement("script"); s.src = QR_LIB.src; s.integrity = QR_LIB.integrity; s.crossOrigin = "anonymous";
      s.onload = draw; s.onerror = () => qrs.forEach(el => { el.textContent = "QR unavailable offline"; }); document.head.appendChild(s); };
    if (document.querySelector("[data-qr-eager]") || !hasIO) load();   /* review.html: draw straight away (codes may sit in hidden panels) */
    else { const qio = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { qio.disconnect(); load(); } }, {rootMargin:"800px 0px"}); qrs.forEach(el => qio.observe(el)); }
  }
})();
