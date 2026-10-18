/* Porirua Hardscapes — shared site script.
   Injects the header, footer and mobile call bar (single source of truth for every page),
   handles nav, phone swap (Nimbata), reveal animations, project filters and the enquiry form. */
(function(){
  var SITE = {
    name: "Porirua Hardscapes",
    tag: "Concrete · Retaining · Earthworks",
    phone: "027 244 4501",            // the number Nimbata is configured to REPLACE
    phoneHref: "tel:+64272444501",
    email: "adam@poriruahardscapes.co.nz",
    facebook: "https://www.facebook.com/p/Porirua-Hardscapes-61576109378291/",   // confirm handle before launch
    instagram: "",
    hours: "7 days · 7am – 6pm",
    endpoint: "/api/public/enquiry"
  };
  var root = document.body.getAttribute("data-root") || "";
  var page = document.body.getAttribute("data-page") || "";
  var R = function(p){ return root + p; };

  var ICON = {
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2z"/></svg>',
    chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    burger:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    fb:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z"/></svg>',
    ig:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
        concrete:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 20L9 4h6l6 16H3z"/><path d="M7 14h10"/></svg>',
    wall:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="4"/><rect x="3" y="10" width="18" height="4"/><rect x="3" y="15" width="18" height="4"/><path d="M9 5v4M15 10v4M9 15v4"/></svg>',
    digger:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h12M4 15h9v3M13 15V9h-4l-3 6"/><path d="M13 11l5-6 3 2-4 6"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/></svg>',
    deck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 10h18M3 14h18M3 18h18M6 10V6M12 10V4M18 10V6"/></svg>',
    leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16z"/><path d="M4 20c4-5 8-8 12-10"/></svg>',
    demo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/><path d="M14 3l6 6"/></svg>'
  };

  var SERVICES = [
    {k:"concrete",  t:"Concrete driveways & slabs", s:"Plain, exposed aggregate, coloured", p:"services/concrete-driveways.html", i:"concrete"},
    {k:"retaining", t:"Retaining walls",             s:"Timber, concrete & block",          p:"services/retaining-walls.html",    i:"wall"},
    {k:"excavation",t:"Excavation & truck hire",     s:"Digger + operator, cartage",        p:"services/excavation-truck-hire.html", i:"digger"},
    {k:"decks",     t:"Decks & fences",              s:"Timber decks, boundary & privacy",  p:"services/decks-fences.html",       i:"deck"},
    {k:"landscaping",t:"Landscape construction",     s:"Paving, edging, lawns, planting",   p:"services/landscaping.html",        i:"leaf"},
    {k:"demolition",t:"Residential demolition",      s:"Houses, garages, sheds, clear-outs",p:"services/demolition.html",         i:"demo"}
  ];

  function brand(dark){
    return '<a class="brand" href="'+R("index.html")+'" aria-label="Porirua Hardscapes home"><img class="logo" src="'+R(dark?"assets/img/logo-dark.png":"assets/img/logo.png")+'" alt="Porirua Hardscapes" width="900" height="427"></a>';
  }
  function on(k){ return page===k ? ' class="on"' : ''; }

  function header(){
    var dd = SERVICES.map(function(s){ return '<a href="'+R(s.p)+'"><i>'+ICON[s.i]+'</i><span><b>'+s.t+'</b><span>'+s.s+'</span></span></a>'; }).join("");
    return ''+
    '<div class="topbar"><div class="wrap"><div class="tb-l"><span><span class="dot"></span>Open now · <span class="hide-m">Quotes 7 days · </span>Porirua, Wellington &amp; the Hutt Valley</span></div>'+
    '<div class="tb-r"><span>36+ years in the trade</span><span>Locally owned, Whitby</span><a href="mailto:'+SITE.email+'">'+SITE.email+'</a></div></div></div>'+
    '<header class="hdr"><div class="wrap">'+brand()+
    '<nav class="nav" aria-label="Main">'+
      '<div class="dd"><button type="button" aria-haspopup="true"'+(page.indexOf("svc")===0?' class="on"':'')+'>Services '+ICON.chev+'</button><div class="dd-menu">'+dd+'<a href="'+R("services/index.html")+'"><i>'+ICON.arrow+'</i><span><b>All services</b><span>What we do and how we work</span></span></a></div></div>'+
      '<a href="'+R("projects.html")+'"'+on("projects")+'>Projects</a>'+
      '<a href="'+R("about.html")+'"'+on("about")+'>About</a>'+
      '<a href="'+R("contact.html")+'#pricing"'+'>Pricing guide</a>'+
      '<a href="'+R("contact.html")+'"'+on("contact")+'>Contact</a>'+
    '</nav>'+
    '<div class="hdr-cta"><a class="phone" href="'+SITE.phoneHref+'">'+ICON.phone+'<span class="nb-phone">'+SITE.phone+'</span></a>'+
    '<a class="btn btn-amber btn-sm" href="'+R("contact.html")+'">Get a free quote</a>'+
    '<button class="burger" type="button" aria-label="Open menu" id="burger">'+ICON.burger+'</button></div>'+
    '</div></header>'+
    '<div class="mnav" id="mnav" aria-hidden="true"><div class="mnav-top">'+brand(true)+'<button class="x" type="button" aria-label="Close menu" id="mclose">'+ICON.x+'</button></div>'+
    '<a class="l1" href="'+R("index.html")+'">Home</a>'+
    '<div class="l2"><div class="t">Services</div>'+SERVICES.map(function(s){return '<a href="'+R(s.p)+'">'+s.t+'</a>';}).join("")+'<a href="'+R("services/index.html")+'">All services →</a></div>'+
    '<a class="l1" href="'+R("projects.html")+'">Projects</a>'+
    '<a class="l1" href="'+R("about.html")+'">About</a>'+
    '<a class="l1" href="'+R("contact.html")+'#pricing">Pricing guide</a>'+
    '<a class="l1" href="'+R("contact.html")+'">Contact</a>'+
    '<div class="mnav-cta"><a class="btn btn-amber btn-lg" href="'+SITE.phoneHref+'">'+ICON.phone+'Call <span class="nb-phone">'+SITE.phone+'</span></a><a class="btn btn-ghost" href="'+R("contact.html")+'">Request a quote</a></div></div>';
  }

  function footer(){
    var y = new Date().getFullYear();
    return ''+
    '<footer class="ftr"><div class="wrap"><div class="cols">'+
    '<div>'+brand(true)+'<p>Concrete, retaining walls, excavation, decks, fences and landscape construction across Porirua, Wellington and the Hutt Valley. Locally owned and operated from Whitby, with 36+ years in the trade.</p>'+
    '<div class="soc">'+(SITE.facebook?'<a href="'+SITE.facebook+'" aria-label="Facebook" target="_blank" rel="noopener">'+ICON.fb+'</a>':'')+(SITE.instagram?'<a href="'+SITE.instagram+'" aria-label="Instagram" target="_blank" rel="noopener">'+ICON.ig+'</a>':'')+'</div></div>'+
    '<div><h4>Services</h4><ul>'+SERVICES.map(function(s){return '<li><a href="'+R(s.p)+'">'+s.t+'</a></li>';}).join("")+'</ul></div>'+
    '<div><h4>Company</h4><ul><li><a href="'+R("about.html")+'">About us</a></li><li><a href="'+R("projects.html")+'">Projects</a></li><li><a href="'+R("contact.html")+'#pricing">Pricing guide</a></li><li><a href="'+R("contact.html")+'#faq">FAQs</a></li><li><a href="'+R("contact.html")+'">Contact &amp; quotes</a></li></ul></div>'+
    '<div><h4>Talk to Adam</h4><a class="big" href="'+SITE.phoneHref+'"><span class="nb-phone">'+SITE.phone+'</span></a><ul><li><a href="mailto:'+SITE.email+'">'+SITE.email+'</a></li><li>'+SITE.hours+'</li><li>Whitby, Porirua 5024</li><li>Serving Porirua · Wellington City · Lower Hutt · Upper Hutt · Kāpiti</li></ul></div>'+
    '</div><div class="base"><span>© '+y+' Porirua Hardscapes Ltd. All rights reserved.</span><span><a href="'+R("contact.html")+'">Free, no-obligation quotes</a> · Site by <a href="https://leadhivenz.com" target="_blank" rel="noopener">LeadHive</a></span></div></div></footer>'+
    '<div class="bar"><a class="b-call" href="'+SITE.phoneHref+'">'+ICON.phone+'Call <span class="nb-phone">'+SITE.phone+'</span></a><a class="b-quote" href="'+R("contact.html")+'">Free quote</a></div>'+
    '<span id="nb-source" data-fallback="'+SITE.phone+'" class="sr">'+SITE.phone+'</span>';
  }

  // ---- inject
  var h = document.getElementById("site-header"); if (h) h.outerHTML = header();
  var f = document.getElementById("site-footer"); if (f) f.outerHTML = footer();

  // ---- mobile nav
  var mnav = document.getElementById("mnav"), burger = document.getElementById("burger"), mclose = document.getElementById("mclose");
  function openM(){ mnav.classList.add("open"); mnav.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
  function closeM(){ mnav.classList.remove("open"); mnav.setAttribute("aria-hidden","true"); document.body.style.overflow=""; }
  if (burger) burger.addEventListener("click", openM);
  if (mclose) mclose.addEventListener("click", closeM);
  document.querySelectorAll(".dd>button").forEach(function(b){ b.addEventListener("click", function(){ b.parentNode.classList.toggle("open"); }); });
  document.addEventListener("click", function(e){ document.querySelectorAll(".dd.open").forEach(function(d){ if(!d.contains(e.target)) d.classList.remove("open"); }); });

  // ---- Nimbata: when the tracking script rewrites #nb-source, mirror it everywhere
  var src = document.getElementById("nb-source");
  if (src && window.MutationObserver) {
    new MutationObserver(function(){
      var n = src.textContent.trim(); if (!n || n === src.dataset.fallback) return;
      document.querySelectorAll(".nb-phone").forEach(function(el){ el.textContent = n; });
      var href = "tel:" + n.replace(/\s+/g,"").replace(/^0/,"+64");
      document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href = href; });
    }).observe(src,{childList:true,characterData:true,subtree:true});
  }

  // ---- photo placeholders: mark as real when an image actually loads
  document.querySelectorAll(".ph img, .lg img").forEach(function(img){
    var box = img.parentNode;
    function ok(){ box.classList.add("has-img"); }
    function bad(){ img.remove(); }
    if (img.complete && img.naturalWidth > 0) ok();
    else if (img.complete) bad();
    else { img.addEventListener("load", ok); img.addEventListener("error", bad); }
  });

  // ---- reveal on scroll
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target);} }); },{rootMargin:"0px 0px -8% 0px"});
    document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });
  } else { document.querySelectorAll(".reveal").forEach(function(el){ el.classList.add("in"); }); }

  // ---- project filters
  var filters = document.querySelector(".filters");
  if (filters) {
    filters.addEventListener("click", function(e){
      var b = e.target.closest("button"); if (!b) return;
      filters.querySelectorAll("button").forEach(function(x){ x.classList.toggle("on", x===b); });
      var k = b.getAttribute("data-f");
      document.querySelectorAll("[data-cat]").forEach(function(t){ t.style.display = (k==="all" || t.getAttribute("data-cat").split(" ").indexOf(k)>-1) ? "" : "none"; });
    });
  }

  // ---- enquiry form(s)
  document.querySelectorAll("form.enquiry").forEach(function(form){
    var msg = form.querySelector(".msg"), btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var fd = new FormData(form), data = {};
      fd.forEach(function(v,k){ if (data[k]) { data[k] = [].concat(data[k], v); } else { data[k] = v; } });
      data.source = "poriruahardscapes.co.nz"; data.page = location.pathname; data.ts = new Date().toISOString();
      if (data.website) return; // honeypot
      btn.disabled = true; btn.textContent = "Sending…"; msg.className = "msg"; msg.textContent = "";
      fetch(SITE.endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})
        .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json ? r.json().catch(function(){return {};}) : {}; })
        .then(function(){ form.reset(); msg.className="msg ok"; msg.textContent="Thanks — Adam will call you back, usually within a couple of hours."; btn.textContent="Sent"; })
        .catch(function(){
          // fallback: open the user's mail client with the details pre-filled
          var body = Object.keys(data).map(function(k){ return k+": "+data[k]; }).join("\n");
          location.href = "mailto:"+SITE.email+"?subject="+encodeURIComponent("Quote request from website")+"&body="+encodeURIComponent(body);
          msg.className="msg"; msg.textContent="Opening your email app — or call us on "+SITE.phone+".";
          btn.disabled=false; btn.textContent="Send my request";
        });
    });
  });
})();
