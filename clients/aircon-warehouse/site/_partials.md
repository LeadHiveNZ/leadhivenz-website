# Aircon Warehouse: building inner pages

Use `styles.css` + `main.js` only. No new colours, fonts or frameworks. Copy from `index.html`, never retype.

## 1. New page checklist
1. Copy `<head>` from index.html. Change `<title>`, description, canonical, `og:title`/`og:url`. Keep fonts, favicons, styles.css, `main.js` (defer), the HVACBusiness JSON-LD. Add an FAQPage JSON-LD only if the page has an FAQ.
2. Copy everything between `<!-- HEADER START -->` and `<!-- HEADER END -->` (skip link, **icon sprite**, utility bar, header, mobile menu). Add `aria-current="page"` to the matching link in **both** `.nav` and `.mobile-menu`.
3. `<main id="main">`: page-hero → sections (alternate `.band` / `.band band-cloud`) → FAQ (3–5) → CTA band.
4. Copy everything between `<!-- FOOTER START -->` and `<!-- FOOTER END -->` (footer + mobile bottom bar).
5. Run the screenshot script at 1440 and 390: scrollWidth must equal the viewport, zero console errors.

## 2. Page hero (one H1 per page)
```html
<section class="page-hero" aria-labelledby="page-title">
  <img class="page-hero__mark" src="../assets/logo-mark.png" alt="" aria-hidden="true" width="379" height="379">
  <div class="container"><div class="page-hero__inner">
    <ol class="breadcrumb" role="list"><li><a href="index.html">Home</a></li><li aria-current="page">Heat Pumps</li></ol>
    <p class="eyebrow">High-wall heat pumps</p>
    <h1 id="page-title">High-wall heat pumps for bedrooms and living rooms</h1>
    <p class="lead">One or two sentences.</p>
    <div class="btn-row btn-row--stack">
      <a class="btn btn-primary btn-lg" href="#quote">Get a free quote <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>
      <a class="btn btn-ghost btn-lg" href="tel:+6492159544"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>Call 09 215 9544</a>
    </div>
  </div></div>
</section>
```

## 3. Service-page layout with sticky quote aside (heat-pumps, ducted, supply-install)
Aside is 360px and sticky on desktop; it stacks under the content on mobile. The aside's form uses an `hq-` style id prefix unique to the page (e.g. `aq-`).
```html
<section class="band"><div class="container layout-aside">
  <div class="layout-aside__main">
    <div class="prose"><h2>…</h2><p>…</p></div>
    <!-- more blocks: .table-wrap, .grid-2 of .card, .checklist, .photo-slot … -->
  </div>
  <aside class="layout-aside__aside" aria-label="Quick quote">
    <div class="quote-card" id="quote">
      <div class="quote-card__head"><h2>Quick quote</h2><p>We reply within one business day.</p></div>
      <!-- the compact <form> from index.html (hero), with ids re-prefixed -->
    </div>
    <p class="aside-note"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg><span>Rather talk? <a href="tel:+6492159544">09 215 9544</a>, 7 days</span></p>
  </aside>
</div></section>
```
In the aside the compact form's 2-up name/phone row stays 2-up at ≥720px; that is intended.

## 4. Full quote form (contact page). Grouped: "About the job" then "Your details"
```html
<div class="form-panel" id="quote">
<form class="form" data-quote-form aria-label="Free quote request">
  <fieldset class="form-group">
    <legend class="form-group__title"><span class="step-num">1</span>About the job</legend>
    <div class="form-grid">
      <div class="field"><label for="q-interest">I’m interested in</label>
        <select id="q-interest" name="interest"><option>Heat pump for a home</option><option>Ducted or multi-room</option><option>Supply &amp; install package</option><option>Trade or commercial</option><option>New build or development</option><option>Not sure yet</option></select></div>
      <div class="field"><label for="q-suburb">Suburb <span class="opt">(optional)</span></label><input id="q-suburb" name="suburb" type="text" autocomplete="address-level2"></div>
      <div class="field span-2"><label for="q-message">Message <span class="opt">(optional)</span></label><textarea id="q-message" name="message" placeholder="Rooms, sizes, anything we should know"></textarea></div>
    </div>
  </fieldset>
  <fieldset class="form-group">
    <legend class="form-group__title"><span class="step-num">2</span>Your details</legend>
    <div class="form-grid">
      <div class="field"><label for="q-name">Name</label><input id="q-name" name="name" type="text" autocomplete="name" required></div>
      <div class="field"><label for="q-phone">Phone</label><input id="q-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required></div>
      <div class="field span-2"><label for="q-email">Email <span class="opt">(optional)</span></label><input id="q-email" name="email" type="email" autocomplete="email"></div>
    </div>
  </fieldset>
  <button class="btn btn-primary" type="submit">Request my free quote <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button>
  <p class="form-privacy"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg>Free and no obligation. We only use your details to quote.</p>
</form>
</div>
```
`main.js` handles any `form[data-quote-form]`: validates `name` + `phone` (lenient NZ), `email` if filled, anything `required`; shows inline errors; then swaps in "Thanks, {first name}…". Keep `name="name|phone|email"`. No `action`, no mailto. Trade form (commercial): same pattern, add Company + Trade type fields and change the button label.

## 5. FAQ
```html
<section class="band band-cloud" aria-labelledby="faq-title"><div class="container faq-layout">
  <div class="section-head"><p class="eyebrow">FAQ</p><h2 id="faq-title">Heat pump questions</h2></div>
  <div class="faq">
    <details><summary>Question? <span class="faq__icon" aria-hidden="true"><svg class="icon"><use href="#i-plus"/></svg></span></summary>
      <div class="faq__answer"><p>Answer.</p></div></details>
  </div>
</div></section>
```

## 6. CTA band (last section of every page): copy section 12 of index.html as is (`.band.band-coral.cta-band`). You may change the H2.

## Class list
- Layout: `.container` `.container-narrow` `.band` `.band-tight` `.band-flush-top` `.band-cloud` `.band-navy` `.band-coral` `.grid-2/3/4` `.split` (+`-even` `-reverse` `-top`) `.stack` `.layout-aside`
- Heads: `.section-head` (+`--center` `--split` with `.section-head__action`) `.eyebrow` `.rule` `.lead` `.muted` `.small` `.note`
- Buttons: `.btn` + `.btn-primary` `.btn-ghost` `.btn-navy` `.btn-white` `.btn-link` · `.btn-lg` `.btn-block` · `.btn-row` (`--stack` = full width < 480px) · `.on-dark` for ghost/link on navy outside a band
- Components: `.card` `.card-dark` `.service-card` `.icon-chip` (`--warm` `--dark` `--lg`) `.feature-list/.feature` `.checklist` `.badge` (`--warm` `--on-dark`) `.trust-strip` `.stat-panel` `.price-grid/.price-tile` (`--feature`) `.price-note` `.steps/.step` `.brand-row` `.promise-grid/.promise` `.faq` `.suburb-grid` `.address-line` `.cta-band` `.media` (`--16x9` `--wide` `--4x3` `--3x4` `--1x1`) `.media-caption` `.service-card__media` (`--wide`) `.hero--photo/.hero__photo` `.page-hero--photo/.page-hero__photo` `.promise-layout` `.promise-grid--2` `.photo-slot` (`--wide`) `.info-list` `.table-wrap/.table` `.prose`
- Forms: `.form` (`--compact`) `.form-panel` `.form-grid` `.span-2` `.form-group` `.form-group__title` `.field` `.opt` `.form-privacy`
- JS hooks: `[data-reveal]` (fade-up once), `[data-reveal-stagger]` (on parent), `[data-count]` with an inner `.count`, `[data-year]`, `form[data-quote-form]`, `[data-menu-toggle]`

## Icons
Sprite lives in the header partial: `<svg class="icon" aria-hidden="true"><use href="#i-NAME"/></svg>`. Names: snow flame home building wrench shield clock pin phone mail star check check-circle arrow external bolt leaf dollar thermo fan highwall ducted package users ruler calendar receipt sparkle volume drop plus menu close lock info. New icons: 24×24 viewBox, stroke only (the `.icon` class sets 1.75 stroke, round caps). Add them to the sprite on **every** page.

## Rules
- Colour: tokens in `:root` only. Coral is the one accent (CTAs, key prices). Sunset never flat. No dark mode. No `!important`.
- Shadows only on the scrolled header and quote cards. Cards are flat with a hairline border.
- Photos: the real banner (`../assets/site-banner-*.jpg`) is on index + commercial. Everything else is a Pexels stock placeholder from `../assets/stock/` (see section 7). Never present a stock person as the team or a stock job as our work. `.photo-slot` is still available for a marked gap: `<figure class="photo-slot"><figcaption>Photo: Daikin high wall, living room</figcaption></figure>`.
- Facts: one phone (09 215 9544 / `tel:+6492159544`), one email (info@airconwarehouse.co.nz), hours "Open 7 days, 8am–8pm". Brands: Daikin, Fujitsu, Haier only. In brand rows write the Fujitsu sub-label "Now GENERAL Airstage"; in prose "Fujitsu (GENERAL Airstage)".
- Any page showing a "from $" price carries once: "Prices incl. GST. Installed prices assume a standard back-to-back installation with up to 3 m of pipe, single storey. Your free quote confirms a fixed price." (use `.price-note`).
- Never: star ratings, review counts, "#1", "licensed", "accredited", warranty years, "Healthy Homes compliant", finance provider names or month counts. Finance wording: "Finance available, including interest-free options. Terms, fees and lending criteria apply; we’ll walk you through them on your quote."
- Images: width/height attributes, `loading="lazy"` below the fold, real alt text. Decorative logo marks get `alt="" aria-hidden="true"`.
- Grids collapse to one column below 720px; any new flex/grid child holding text gets `min-width: 0`.
- Breakpoints: 720 / 1024. Header only: desktop nav from 1180, header phone from 1320. Bottom bar below 768.

## 7. Photography (styles.css section 23)
Every `<img>`: `src` = the -1600 file, `srcset="…-800.jpg 800w, …-1600.jpg 1600w"`, a `sizes`, `width`/`height` of the 1600 file, alt text describing the picture (never "our install"), `loading="lazy"` unless it is a hero. Focal point per image with `style="--focus: 60% 30%"` (object-position x y).
- **Media block:** `<figure class="media media--4x3"><img …></figure>`. `--16x9` is 4:3 below 1024px then 16:9; `--wide` is 16:9 at every width. Caption on the photo: `<figcaption>` (dark pill). Caption under it: wrap the `.media` in a plain `<figure>` and use `<figcaption class="media-caption">`.
- **Card image header:** first child of `.service-card`, `.card` or `.price-tile`: `<div class="service-card__media"><img …></div>` (4:3, `--wide` = 16:9). Bleeds to the card edges, zooms slightly on hover; a following `.icon-chip--lg` overlaps its bottom edge.
- **Home hero:** `.hero.hero--photo`, with `<figure class="hero__photo"><img … fetchpriority="high"></figure>` between `.hero__copy` and the quote card. Desktop: layer under a ~90% navy gradient. Below 1024px: full-bleed band above the quote card.
- **Inner hero:** `.page-hero.page-hero--photo`, drop the `.page-hero__mark`, add `<figure class="page-hero__photo"><img …></figure>` after the `.container`. Desktop: photo fills the right and fades into the navy under the copy (copy max 700px). Below 1024px: band flush with the hero's bottom edge.
- **Heading + photo beside a promise list:** `<div class="promise-layout"><div><div class="section-head">…</div><figure class="media …">…</figure></div><ul class="promise-grid promise-grid--2">…</ul></div>`.
- Check hero text contrast after any photo or overlay change (white and the coral accent must stay ≥ 4.5:1 / 3:1 for large text).
- `technician-inspecting-outdoor-unit` shows a third-party brand on the unit: always use it at 16:9 (`--wide`) with `--focus: 50% 0%` so the logo is cropped out.
