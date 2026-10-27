/* ============================================================
   AROHA CAMPERS — SITE CONFIG
   Edit the values in CONFIG only. Everything below is wiring.
   ============================================================ */
var CONFIG = {
  phoneDisplay: "0800 20 30 60",
  phoneTel: "0800203060",            // digits only, used in tel: links
  whatsapp: "",                       // e.g. "64211234567" (country code, no + or spaces). Leave "" to hide WhatsApp buttons.
  messenger: "",                      // e.g. "https://m.me/arohacampers". Leave "" to hide Messenger buttons.
  email: "",                          // e.g. "hello@arohacampers.co.nz". Shown on contact page + used as form fallback.
  formEndpoint: "",                   // e.g. "https://formspree.io/f/xxxxxxxx" or "https://api.web3forms.com/submit". Leave "" to fall back to email.
  web3formsKey: "",                   // only if using Web3Forms
  thankYouPage: "thank-you.html"
};

(function(){
  var $$ = function(s,c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); };

  /* phone */
  $$("[data-phone]").forEach(function(el){ el.textContent = CONFIG.phoneDisplay; });
  $$("a[data-tel]").forEach(function(a){ a.href = "tel:" + CONFIG.phoneTel; });

  /* whatsapp */
  var waMsg = encodeURIComponent("Kia ora Aroha Campers, I'd like an offer on my campervan. Make/model/year: ... Location: ... Flying out on: ...");
  $$("a[data-wa]").forEach(function(a){
    if(!CONFIG.whatsapp){ a.style.display="none"; return; }
    a.href = "https://wa.me/" + CONFIG.whatsapp + "?text=" + waMsg;
    a.target="_blank"; a.rel="noopener";
  });
  /* messenger */
  $$("a[data-msgr]").forEach(function(a){
    if(!CONFIG.messenger){ a.style.display="none"; return; }
    a.href = CONFIG.messenger; a.target="_blank"; a.rel="noopener";
  });
  /* email */
  $$("[data-email]").forEach(function(el){
    if(!CONFIG.email){ el.closest("[data-email-wrap]") ? el.closest("[data-email-wrap]").style.display="none" : el.style.display="none"; return; }
    el.textContent = CONFIG.email; if(el.tagName==="A") el.href = "mailto:" + CONFIG.email;
  });

  /* mobile nav */
  var burger = document.getElementById("burger"), mnav = document.getElementById("mnav");
  if(burger && mnav){ burger.addEventListener("click", function(){ var o = mnav.classList.toggle("open"); burger.setAttribute("aria-expanded", o ? "true":"false"); }); }

  /* year */
  $$("[data-year]").forEach(function(el){ el.textContent = new Date().getFullYear(); });

  /* quick form on home page -> full form with prefill */
  var quick = document.getElementById("quick-form");
  if(quick){
    quick.addEventListener("submit", function(e){
      e.preventDefault();
      var p = new URLSearchParams();
      $$("input,select", quick).forEach(function(i){ if(i.name && i.value) p.set(i.name, i.value); });
      location.href = "sell-my-campervan.html?" + p.toString() + "#offer-form";
    });
  }

  /* prefill full form from query string */
  var full = document.getElementById("offer-form");
  if(full){
    var q = new URLSearchParams(location.search);
    q.forEach(function(v,k){ var f = full.querySelector('[name="'+k+'"]'); if(f && !f.value) f.value = v; });
  }

  /* submit handler for all lead forms */
  $$("form[data-lead]").forEach(function(form){
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]"), msg = form.querySelector(".msg");
      if(form.querySelector(".hp input") && form.querySelector(".hp input").value) return; // honeypot
      if(!form.checkValidity()){ form.reportValidity(); return; }
      var fd = new FormData(form);
      fd.append("page", location.href);
      fd.append("subject", "New campervan offer request — Aroha Campers");

      /* Fallback: no endpoint configured -> open email client */
      if(!CONFIG.formEndpoint){
        var lines = [];
        fd.forEach(function(v,k){ if(typeof v === "string" && v && k!=="page") lines.push(k + ": " + v); });
        var to = CONFIG.email || "";
        location.href = "mailto:" + to + "?subject=" + encodeURIComponent("Campervan offer request") + "&body=" + encodeURIComponent(lines.join("\n"));
        if(msg){ msg.textContent = "Opening your email app… If nothing happens, call " + CONFIG.phoneDisplay + "."; msg.style.color="#1E6B2E"; }
        return;
      }
      if(CONFIG.web3formsKey) fd.append("access_key", CONFIG.web3formsKey);
      btn.disabled = true; var old = btn.textContent; btn.textContent = "Sending…";
      fetch(CONFIG.formEndpoint, { method:"POST", body: fd, headers:{ "Accept":"application/json" } })
        .then(function(r){ if(!r.ok) throw new Error("bad"); location.href = CONFIG.thankYouPage; })
        .catch(function(){ btn.disabled=false; btn.textContent=old; if(msg) msg.textContent = "Sorry, that didn't send. Please call or text " + CONFIG.phoneDisplay + " instead."; });
    });
  });

  /* file size guard (photos) */
  $$("input[type=file]").forEach(function(inp){
    inp.addEventListener("change", function(){
      var total = 0; Array.prototype.forEach.call(inp.files, function(f){ total += f.size; });
      if(total > 25*1024*1024){ alert("Photos are over 25MB in total. Please pick fewer or smaller photos, or send them by WhatsApp / Messenger."); inp.value=""; }
    });
  });
})();
