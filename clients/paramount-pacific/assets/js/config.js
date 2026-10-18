/* ==========================================================================
   Paramount Pacific — site config
   --------------------------------------------------------------------------
   The ONE file to edit when the client sends real details. Every page reads
   from window.PP_CONFIG via site.js ([data-config], [data-config-href]).

   PLACEHOLDER values are marked below. JSON-LD blocks in index.html and
   contact.html carry the same values in static form — update them too
   (search the repo for "021 000 0000" / "+64210000000").
   ========================================================================== */
window.PP_CONFIG = (function () {
  "use strict";

  var config = {
    brand: "Paramount Pacific",
    legalName: "Paramount Pacific Property Development Ltd",
    owner: "Uele (Willie) Tasmania",
    ownerShort: "Willie",

    phone: "021 000 0000",                         // PLACEHOLDER
    phoneHref: "",                                 // auto-derived from phone below
    email: "info@paramountpacific.co.nz",          // PLACEHOLDER
    address: "Auckland, New Zealand",              // PLACEHOLDER (suburb / street if wanted)
    hours: "Mon–Fri 7am–5pm, Sat by appointment",  // PLACEHOLDER

    social: {
      facebook: "",                                // PLACEHOLDER — blank hides the icon
      instagram: ""                                // PLACEHOLDER — blank hides the icon
    },

    // Blank => the monogram placeholder SVG is shown.
    logoUrl: "",        // real logo for dark header (relative to site root, e.g. "assets/img/logo.svg", or absolute URL)
    logoLightUrl: "",   // optional variant for the dark footer; falls back to logoUrl

    // Blank => the quote form opens the visitor's email app (mailto:) instead.
    formEndpoint: "",   // PLACEHOLDER e.g. "https://formspree.io/f/xxxx" (expects JSON POST)

    siteUrl: "https://paramountpacific.co.nz",     // PLACEHOLDER domain (used in canonical / OG / JSON-LD)

    areas: [
      { name: "Auckland",              slug: "auckland" },
      { name: "Franklin",              slug: "franklin" },
      { name: "Hauraki Gulf Islands",  slug: "hauraki-gulf-islands" },
      { name: "Manukau",               slug: "manukau" },
      { name: "North Shore",           slug: "north-shore" },
      { name: "Papakura",              slug: "papakura" },
      { name: "Rodney",                slug: "rodney" },
      { name: "Waitakere",             slug: "waitakere" },
      { name: "Waiheke Island",        slug: "waiheke-island" }
    ],

    // path is relative to the site root.
    services: [
      { key: "residential-building", name: "Residential Building", path: "services/residential-building.html",
        short: "New homes and additions, built to plan, to the Code and to the programme." },
      { key: "renovations", name: "Major Renovations", path: "services/renovations.html",
        short: "Kitchens, bathrooms, extensions, re-cladding and open-plan conversions." },
      { key: "concrete", name: "Concrete Services", path: "services/concrete.html",
        short: "Driveways, slabs, paths, exposed aggregate and retaining." },
      { key: "fencing-gates", name: "Fencing & Gates", path: "services/fencing-gates.html",
        short: "Timber, aluminium and pool fencing, plus automatic gates." },
      { key: "foundations", name: "Foundations", path: "services/foundations.html",
        short: "Slab and pile foundations, set out and poured right the first time." },
      { key: "roofing", name: "Roofing", path: "services/roofing.html",
        short: "New roofs, re-roofs and repairs that keep the weather out." },
      { key: "plumbing-drainlaying", name: "Plumbing & Drainlaying", path: "services/plumbing-drainlaying.html",
        short: "Water supply, drainage and stormwater for builds and renovations." },
      { key: "paving-driveways", name: "Paving & Driveways", path: "services/paving-driveways.html",
        short: "Pavers, patios and driveways laid on a proper base." }
    ]
  };

  // "021 000 0000" -> "tel:+64210000000"
  function toE164(nz) {
    var d = String(nz || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.indexOf("64") === 0) return "+" + d;
    if (d.charAt(0) === "0") return "+64" + d.slice(1);
    return "+" + d;
  }
  config.phoneE164 = toE164(config.phone);
  config.phoneHref = config.phoneE164 ? "tel:" + config.phoneE164 : "";

  return config;
})();
