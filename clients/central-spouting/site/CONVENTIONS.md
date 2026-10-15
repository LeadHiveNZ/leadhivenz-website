# Central Spouting site: build conventions

Read this before you add a page. The design system lives in `css/site.css`, behaviour in `js/site.js`,
and every component is rendered with copy-paste markup in `COMPONENTS.html`. `index.html` is the reference page.

**To make a new page:** copy `PAGE-TEMPLATE.html` to `<route>/index.html`, replace every `[[PLACEHOLDER]]`, delete
the instruction comments, and set the current nav item. Never edit the header, footer or mobile-bar markup beyond that.

---

## 1. Files and routes

```
site/
  index.html                  Home
  404.html                    Not found (Netlify serves it automatically)
  thanks/index.html           Netlify form success page (noindex)
  services/index.html                         ← to build
  services/spouting-replacement/index.html    ← to build (the money page)
  services/new-spouting-fascia/index.html     ← to build (new builds, re-roofs, continuous/longrun option)
  services/fascia/index.html                  ← to build
  services/downpipes/index.html               ← to build
  services/spouting-repairs/index.html        ← to build
  services/gutter-cleaning/index.html         ← to build (cleaning + leaf guard)
  about/index.html  gallery/index.html  contact/index.html  privacy/index.html   ← to build
  areas/index.html + areas/{whanganui,palmerston-north,manawatu,rangitikei,south-taranaki}/index.html ← to build
  css/site.css   js/site.js   favicon.svg
  assets/svg/…               illustrations + icons (paste inline)
  assets/svg/ph/…            placeholder art used by CSS only (do not paste)
  assets/og-image.jpg  assets/logo-512.png  assets/apple-touch-icon.png
  images/…                   client photos (see images/README.md)
  netlify.toml  _redirects  robots.txt  sitemap.xml
  PAGE-TEMPLATE.html  COMPONENTS.html  CONVENTIONS.md   ← internal; 404'd on Netlify by _redirects
```

- **Every page is a folder with `index.html`.** URLs always end in `/` (`/services/fascia/`).
- **Every link and asset is root-relative:** `/css/site.css`, `/js/site.js`, `/images/gallery/01.jpg`, `/contact/#quote`.
  Never `../` and never `index.html` in links. This is what makes nested pages work on Netlify.
  Because of this, preview through a server rather than double-clicking the file:
  `cd site && python3 -m http.server 8000` and open http://localhost:8000/
- Only link to routes listed in `sitemap.xml` (plus `/contact/#quote`, `tel:`, `mailto:`, Facebook).
  If you add a route, add it to `sitemap.xml`.
- Domain `https://centralspouting.co.nz` is a **placeholder** (canonical, OG, JSON-LD, sitemap, robots).
  Use it consistently; it gets find/replaced at launch.

## 2. Page skeleton (order never changes)

```
<head>  title · description · canonical · OG/Twitter · head-common block · LocalBusiness JSON-LD · (BreadcrumbList, Service, FAQPage JSON-LD)
<body class="page-<slug>">
  skip link + HEADER            (verbatim)
  <main id="main">
    .page-hero                  (inner pages)  /  .hero (home only)
    .section …                  (content; numbered eyebrows 01, 02 …)
    CTA BAND                    (verbatim, last thing in <main>)
  </main>
  FOOTER + MOBILE BAR + <script src="/js/site.js" defer>   (verbatim)
```

The head-common block (fonts, CSS, favicon, no-JS slot fallback) is identical on every page:

```html
<meta name="theme-color" content="#121416">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&amp;family=Inter:wght@400..700&amp;display=swap">
<link rel="stylesheet" href="/css/site.css?v=20261015b">
<noscript><style>.slot img{opacity:1}</style></noscript>
```

No inline `<script>` other than JSON-LD (the CSP in `netlify.toml` blocks inline JS). Inline `style="--var:…"` is fine.

## 3. Header, nav, footer, mobile bar

Copy these **verbatim** from `PAGE-TEMPLATE.html`. Each block sits between marker comments:
`<!-- ============ HEADER … -->` … `<!-- ============ /HEADER ============ -->`,
`<!-- ============ FOOTER … -->` … `<!-- ============ /FOOTER ============ -->`, then `<!-- ============ MOBILE CALL / QUOTE BAR … -->`
and the `<script>` tag.

**Only per-page change:** add `aria-current="page"` to this page's `<a>` in the header. On any `/services/*` page also add
class `is-current` to the Services `<li class="nav__item nav__item--has-sub">`; on any `/areas/*` page add it to the Service areas `<li>`.

Nav structure (labels and hrefs are fixed):

| Item | href | Dropdown |
|---|---|---|
| Home | `/` | |
| Services ▾ | `/services/` | Spouting replacement `/services/spouting-replacement/` · New spouting & fascia `/services/new-spouting-fascia/` · Fascia `/services/fascia/` · Downpipes `/services/downpipes/` · Spouting repairs `/services/spouting-repairs/` · Gutter cleaning & guard `/services/gutter-cleaning/` · All services `/services/` |
| About | `/about/` | |
| Gallery | `/gallery/` | |
| Service areas ▾ | `/areas/` | Whanganui `/areas/whanganui/` · Palmerston North `/areas/palmerston-north/` · Manawatū `/areas/manawatu/` · Rangitīkei `/areas/rangitikei/` · South Taranaki `/areas/south-taranaki/` · All service areas `/areas/` |
| Contact | `/contact/` | |

Header actions: "Call Dylan / 020 470 9967" (`tel:+64204709967`) and "Free quote" (`/contact/#quote`).
Below 1100px the nav becomes a drawer (`[data-nav-toggle]`, `#site-nav`) and the fixed **mobile bar** shows Call Dylan + Free quote.

**Footer NAP (must match Google Business Profile exactly):**
Central Spouting Ltd · 020 470 9967 · office@centralspouting.co.nz · Whanganui, New Zealand · Mon–Fri, 7:30am–5pm.
Phone links are always `href="tel:+64204709967"`, displayed as `020 470 9967`. Never use any other number.

## 4. Design tokens (use these, never raw values)

- **Colours:** ironsand `--ink-900 #121416`, `--ink-800 #1F2225`, paper `--paper #F6F4EF`, stone `--paper-2 #EDEAE2`.
  **One accent: the logo's electric blue `--blue #0078C8`**, in four tokens: `--blue` (fills: primary buttons with white text 4.65:1,
  dots, focus rings, map pin), `--blue-hover #0068AE` (button hover, white 5.85:1), `--blue-ink #005A99` (blue text/icons on paper 6.54:1,
  stone 5.98:1, white 7.19:1) and `--blue-lite #3D9FE0` (blue text/icons on ironsand 6.36:1, ink-800 5.51:1). For text and icons use
  `var(--accent-text)`, which resolves to the right one for the section's theme. Use blue sparingly:
  primary buttons, eyebrow numerals, one italic `<em>` per headline, small icons. No orange, no second accent.
- **Logo:** `/assets/logo.png` (400×169, white type + blue on transparent; cropped from `brand/logo-mark-name.png` without the
  Dylan / phone line). Header 50px high (40px under 600px), footer 56px. Only ever on a dark background.
  The favicon stays the SVG house mark (`favicon.svg`), recoloured blue. Client originals live in `brand/`.
- Components read theme variables (`--bg --fg --fg-muted --line --surface --accent-text`), so they adapt to the section they sit in.
- **Type:** display `Source Serif 4` (variable, optical sizes) for headings; `Inter` for everything else.
  Classes: `.display` (home H1 only) · `.page-hero__title` (inner H1) · `.h2` · `.h3` · `.h4` · `.lede` · `.eyebrow` · `.micro`.
  (Fraunces was the original brief, but its Google Fonts build has no precomposed macron vowels, so ā ē ī ō ū render broken.
  Source Serif 4 renders Manawatū, Rangitīkei, Hāwera and Pātea correctly. Always use macrons.)
- Spacing / radius / shadow: `--space-1…11`, `--section-y`, `--radius-sm|--radius|--radius-lg|--radius-pill`, `--shadow-sm|--shadow|--shadow-lg`.

## 5. Section pattern

```html
<section class="section section--paper" id="anchor" aria-labelledby="x-title">
  <div class="container">
    <header class="section-head section-head--split">   <!-- --split: title left, lede right on desktop -->
      <p class="eyebrow"><span class="eyebrow__num">01</span>Label</p>
      <h2 id="x-title" class="h2">Heading with an <em>italic finish.</em></h2>
      <p class="lede">One supporting sentence.</p>
    </header>
    …
  </div>
</section>
```

- Backgrounds: `section--paper` (default light), `section--stone` (warm grey), `section--dark` (ironsand), `section--ink` (lighter dark).
  Alternate them; never put two dark sections back to back. `section--tight` reduces vertical padding.
- Containers: `.container` (1216px), `.container--wide` (1408px, used for header/hero/footer/CTA), `.container--narrow`.
- Layout helpers: `.grid .grid--2|3|4`, `.split` (+ `--even --reverse --top`), `.layout-sidebar` (content + sticky aside), `.stack`.
- Numbered eyebrows count up in page order (01, 02, 03 …). The hero's eyebrow uses `.eyebrow--dot` with no number.

## 6. Components (see COMPONENTS.html for live markup)

| Component | Classes |
|---|---|
| Buttons | `.btn` + `--primary` `--secondary` `--dark` `--ghost` · size `--sm` `--lg` `--block` · call style `--call` with `<span class="btn__icon">phone svg</span>` · `.btn-row` `.btn-row--stack-mobile` `.btn-stack` |
| Home hero | `.hero` (+ `data-photo-host`) `.hero__grid` `.hero__copy` `.hero__title` `.hero__lede` `.hero__actions` `.hero__note` `.hero__art` `.trust-strip` |
| Inner hero | `.page-hero` `.page-hero__grid` `.page-hero__copy` `.breadcrumbs` `.page-hero__title` `.page-hero__art` |
| Trust strip | `.trust-strip > .trust-strip__list > .trust-item` (icon, `__title`, `__text`) |
| Service grid | `.service-grid > a.service-card` (`__top __icon __num __title __text __more`) |
| Points | `.points.points--2 > .point` (`__icon __title __text`), `.check-list` |
| Cards | `.card` `.area-card` `.material-grid > .material` `.profile-grid > .profile-card` `.testimonial` (+ `--empty`) `.callout` `.tag` (+ `--accent`) |
| Colour picker | `[data-colour-picker]` with radios `data-hex`, `[data-swatch-stage]`, `[data-swatch-name]`, `[data-swatch-hex]` |
| Process | `ol.process > li.process__step` (`__marker __num __title __text`); `.process--vertical` for one column |
| Areas | `.areas` `.map-frame` (inline `service-area-map.svg`) `.area-list > .area-row` |
| FAQ | `.faq[data-single] > details.faq__item > summary.faq__q + .faq__a` (add FAQPage JSON-LD that matches) |
| Gallery | `.gallery-grid` (+ `--bento`) `> figure.gallery-item > .slot + figcaption` |
| Before/after | `.ba[data-ba]` with `.slot.ba__after`, `.slot.ba__before`, tags, `input.ba__range`, `.ba__handle` |
| CTA band | copy verbatim from `PAGE-TEMPLATE.html` |
| Forms | `.form` `.form__grid` `.field` `.field__label` `.field__input` `.field--full` `.choices > .choice` `.form__hp` `.form-card` |
| Utilities | `.sr-only` `.muted` `.small` `.accent` `.measure` `.mt-4|6|8|xl` `.text-center` `.link-arrow` `.divider` |

Motion: add `data-reveal` to an element, or `data-reveal-stagger="90"` to a parent to reveal its children in turn.
Don't use them in heroes (above the fold). Reduced-motion users see everything immediately.

Icons and illustrations: paste the SVG from `assets/svg/icons/*.svg` or `assets/svg/*.svg` inline (all `currentColor`, 1.5px strokes;
the blue highlight comes from `--ill-accent`). For a decorative copy, remove `<title>`/`role="img"` and wrap it in `aria-hidden="true"`.
If you use the same illustration twice on a page, suffix its internal `id`s so they stay unique.

## 7. Image slots (photos that may not exist yet)

```html
<figure class="slot" data-ph="fascia" data-label="Photo · Fascia replacement">
  <img src="/images/services/fascia.jpg" alt="Grey weatherboard villa with dark grey fascia and white window trims" width="1600" height="1200" loading="lazy" decoding="async">
</figure>
```

- Missing file: the slot keeps an intentional blueprint placeholder (dark panel, fine grid, line art, small label).
  Present file: it fades in and the placeholder disappears. `js/site.js` handles this; no `onerror` attributes.
- `data-ph` picks the line art: `eave | downpipe | fascia | ogee | quarter | half | box | map`. `data-label` is the small caption on the placeholder.
- Shape: default 4:3; `slot--portrait` 4:5, `slot--square`, `slot--wide` 16:9, `slot--tall` 3:4, or `style="--ratio: 3 / 2"`.
- `slot--bare`: no placeholder, removed if missing (used for the full-bleed hero photo).
- Wrap in `data-hide-if-missing` to hide the whole wrapper when the photo is missing (gallery page: slots 07–12).
- A `[data-photo-host]` ancestor gets `.has-photo` when its photo loads (the home hero uses it to swap illustration for photo).
- Filenames are fixed; the full list is in `images/README.md`. Always give width/height and an honest, specific `alt`.

## 8. JSON-LD

Every page carries the identical LocalBusiness block (copy from `PAGE-TEMPLATE.html`; it starts with the comment
`<!-- LocalBusiness JSON-LD: identical on every page`). Key values:
`@type ["HomeAndConstructionBusiness","RoofingContractor"]`, `@id https://centralspouting.co.nz/#business`, name Central Spouting Ltd,
telephone `+64 20 470 9967`, email office@centralspouting.co.nz, address locality Whanganui / Manawatū-Whanganui / NZ (no street),
areaServed (Whanganui, Palmerston North, Feilding, Levin, Marton, Bulls, Taihape, Hāwera, Pātea, Waverley, New Plymouth + regions),
opening hours Mon–Fri 07:30–17:00, foundingDate 2024-09, founder Dylan, sameAs Facebook.
Add per page: `BreadcrumbList` (all inner pages), `Service` with `"provider": {"@id": "https://centralspouting.co.nz/#business"}` (service pages),
`FAQPage` (only if the page shows those exact Q&As). **Never add `aggregateRating` or `review` until real reviews are on the page.**

## 9. Quote form (contact page; `id="quote"` is the anchor every CTA uses)

```html
<form class="form" name="quote" method="POST" action="/thanks/" data-netlify="true" netlify-honeypot="bot-field" enctype="multipart/form-data">
  <input type="hidden" name="form-name" value="quote">
  <p class="form__hp"><label>Leave this empty: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
  … fields exactly as in COMPONENTS.html (name, phone, email, town, service checkboxes, message, one photo) …
  <button class="btn btn--primary btn--lg" type="submit">Send my quote request</button>
</form>
```

Only one form named `quote` may exist in the deployed site (COMPONENTS.html deliberately omits `data-netlify`).

## 10. Honesty rules (non-negotiable)

- No fabricated reviews, testimonials, ratings, star counts or review counts. Use `.testimonial--empty` or omit.
- No invented numbers: no "years of experience", "homes completed", "500 jobs", response-time promises or prices.
  The company was registered in September 2024; say "locally owned", not "established".
- Allowed proof points: locally owned & operated in Whanganui · owner (Dylan) on every job · free, itemised, no-obligation quotes ·
  quotes from photos · COLORSTEEL®/ColorCote®/Marley products with manufacturer-backed warranties · tidy clean-up and walk-round.
- Warranty wording, exactly: "Marley uPVC spouting carries a 15-year manufacturer guarantee." and "ColorCote and COLORSTEEL steel
  rainwater goods carry manufacturer warranties that depend on product and exposure zone; we'll tell you exactly what applies to your home."
  **Never** write "Colorsteel 15–30 year" for spouting.
- "Backed by our workmanship guarantee" (no term) and "fully insured": allowed but mark each with `<!-- CONFIRM -->`.
- Continuous / longrun spouting: "available". Do **not** claim Dylan roll-forms on site. Mark `<!-- CONFIRM -->`.
- Gutter guard: be honest that no guard makes spouting maintenance-free.
- Only Central Spouting's own photos. Never stock photos or other companies' work. Never attribute other businesses' reviews.
- Spelling: Whanganui (Wanganui only once, in an FAQ). Always use macrons: Manawatū, Rangitīkei, Hāwera, Pātea, Ōtaki.

## 11. Before you hand back a page

1. Serve the folder (`python3 -m http.server`) and check 390px and 1440px: no horizontal scroll, nothing overlapping.
2. Every `href` is root-relative and in `sitemap.xml`; the page's own route is in `sitemap.xml`.
3. One `<h1>`; headings don't skip levels; every `<img>` has `alt`, `width`, `height`.
4. Title, description, canonical, OG URL all point at this page.
5. Any new claim is either verifiably true or marked `<!-- CONFIRM: … -->` and listed in `clients/central-spouting/README.md`.
