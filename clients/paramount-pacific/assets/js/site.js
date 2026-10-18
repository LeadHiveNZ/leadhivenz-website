/* ==========================================================================
   Paramount Pacific — site behaviour (no libraries)
   1. Config fill        [data-config], [data-config-href], [data-year], logo swap
   2. Header             .is-scrolled after a few px of scroll
   3. Mobile nav         toggle, aria-expanded, Escape, focus trap, scroll lock
   4. Current page       aria-current="page" on matching [data-nav-link]
   5. Reveal on scroll   .reveal -> .reveal.in
   6. Quote form         form[data-pp-form]: JSON POST to formEndpoint, else mailto:
   ========================================================================== */
(function () {
  "use strict";

  var C = window.PP_CONFIG || {};
  var root = document.documentElement;

  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function get(path) {
    return String(path).split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, C);
  }

  /* 1. CONFIG FILL ------------------------------------------------------- */
  function fillConfig() {
    $all("[data-config]").forEach(function (el) {
      var v = get(el.getAttribute("data-config"));
      if (v == null || v === "") {
        if (el.hasAttribute("data-config-hide-empty")) el.hidden = true;
        return;
      }
      el.textContent = v;
    });

    $all("[data-config-href]").forEach(function (el) {
      var key = el.getAttribute("data-config-href");
      var href = "";
      if (key === "phone") href = C.phoneHref;
      else if (key === "email") href = C.email ? "mailto:" + C.email : "";
      else href = get(key) || "";
      if (href) { el.setAttribute("href", href); el.hidden = false; }
      else if (el.hasAttribute("data-config-hide-empty") || key.indexOf("social.") === 0) el.hidden = true;
    });

    $all("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

    // Logo: swap the monogram for the real logo when logoUrl is set.
    // logoUrl is site-root relative; img[data-logo-base] gives the prefix ("" or "../").
    $all("img[data-logo]").forEach(function (img) {
      var url = img.getAttribute("data-logo") === "light" ? (C.logoLightUrl || C.logoUrl) : C.logoUrl;
      if (!url) return;
      var isAbsolute = /^(https?:)?\/\//.test(url) || url.charAt(0) === "/";
      img.src = isAbsolute ? url : (img.getAttribute("data-logo-base") || "") + url;
      img.alt = C.brand || "";
      var brand = img.closest(".brand");
      if (brand) brand.classList.add("has-logo");
    });

    // <select data-config-options="services"> gets populated if it only holds a placeholder.
    $all("select[data-config-options]").forEach(function (sel) {
      var list = get(sel.getAttribute("data-config-options"));
      if (!Array.isArray(list) || sel.options.length > 1) return;
      list.forEach(function (item) {
        var o = document.createElement("option");
        o.value = o.textContent = item.name;
        sel.appendChild(o);
      });
      var other = document.createElement("option");
      other.value = other.textContent = "Something else";
      sel.appendChild(other);
    });
  }

  /* 2. HEADER ------------------------------------------------------------ */
  function initHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* 3. MOBILE NAV -------------------------------------------------------- */
  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var panel = document.getElementById("mobile-nav");
    if (!toggle || !panel) return;
    var label = toggle.querySelector(".visually-hidden");

    function focusables() {
      return [toggle].concat($all("a[href], button:not([disabled])", panel));
    }
    function setOpen(open, restoreFocus) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) label.textContent = open ? "Close menu" : "Open menu";
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) panel.removeAttribute("inert"); else panel.setAttribute("inert", "");
      document.body.classList.toggle("nav-open", open);
      if (open) {
        var first = panel.querySelector("a[href]");
        if (first) window.setTimeout(function () { first.focus(); }, 60);
      } else if (restoreFocus) {
        toggle.focus();
      }
    }
    setOpen(false);

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a[href]")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false, true); return; }
      if (e.key === "Tab") {
        var f = focusables(), i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    // Close if the viewport grows past the mobile breakpoint.
    var mq = window.matchMedia("(min-width: 900px)");
    var onMq = function (ev) { if (ev.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  /* 4. CURRENT PAGE ------------------------------------------------------ */
  function markCurrent() {
    var segs = window.location.pathname.split("/").filter(Boolean);
    var file = segs.length ? segs[segs.length - 1] : "index.html";
    if (file.indexOf(".") === -1) file = "index.html"; // folder URL, e.g. "/"
    var inServices = segs.length > 1 && segs[segs.length - 2] === "services";
    $all("[data-nav-link]").forEach(function (a) {
      var target = (a.getAttribute("href") || "").split("#")[0].split("?")[0].split("/").pop() || "index.html";
      var match = inServices ? target === "services.html" : target === file;
      if (match) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* 5. REVEAL ------------------------------------------------------------ */
  function initReveal() {
    var els = $all(".reveal");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!els.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* 6. QUOTE FORM -------------------------------------------------------- */
  function initForms() {
    $all("form[data-pp-form]").forEach(function (form) {
      var status = form.querySelector(".form-status");
      var submit = form.querySelector("[type=submit]");
      var submitText = submit ? submit.innerHTML : "";

      function show(kind, msg) {
        if (!status) return;
        status.className = "form-status is-" + kind;
        status.textContent = msg;
        status.hidden = false;
      }
      function busy(on) {
        if (!submit) return;
        submit.disabled = on;
        submit.innerHTML = on ? "Sending…" : submitText;
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });

        // Honeypot: bots fill the hidden field. Pretend success, send nothing.
        if (data.company_website) {
          form.reset();
          show("success", "Thanks — we've got your request and will be in touch shortly.");
          return;
        }
        delete data.company_website;
        data.page = window.location.href;
        data.submitted = new Date().toISOString();

        var first = data.name ? " " + data.name.split(" ")[0] : "";
        var okMsg = "Thanks" + first + " — we've got your request. " +
          (C.ownerShort || "We") + " will be in touch soon.";
        var errMsg = "Sorry, that didn't send. Please call " + (C.phone || "us") +
          (C.email ? " or email " + C.email : "") + ".";

        if (C.formEndpoint) {
          busy(true);
          fetch(C.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(data)
          }).then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            form.reset();
            show("success", okMsg);
          }).catch(function () {
            show("error", errMsg);
          }).then(function () { busy(false); });
          return;
        }

        // No endpoint yet: hand off to the visitor's email app.
        var labels = { name: "Name", phone: "Phone", email: "Email", suburb: "Suburb", service: "Service", message: "Job details" };
        var lines = Object.keys(labels).filter(function (k) { return data[k]; })
          .map(function (k) { return labels[k] + ": " + data[k]; });
        var subject = "Quote request" + (data.service ? " – " + data.service : "") + (data.suburb ? ", " + data.suburb : "");
        var href = "mailto:" + (C.email || "") + "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(lines.join("\n") + "\n\nSent from " + data.page);
        window.location.href = href;
        show("success", "Your email app should now open with your details filled in — just press send. " +
          "Nothing opened? Call " + (C.phone || "us") + (C.email ? " or email " + C.email : "") + ".");
      });
    });
  }

  function init() {
    root.classList.add("js");
    fillConfig();
    initHeader();
    initMobileNav();
    markCurrent();
    initReveal();
    initForms();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
