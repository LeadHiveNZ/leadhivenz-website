# D|R Painting: website

Static multi-page site for D|R Painting (Darren and Rich), Whanganui. Phone **028 468 9753**.
Everything client-specific lives in `src/config.js`; a small Node script renders every page from it,
so the folder also works as a master template for other painting clients.

## Structure

```
src/
  config.js            CONFIG: business details, hours, claims, page SEO, services (+ per-service page copy), areas, FAQs, photos
  build.js             renders site/ from config + templates (plain Node, no npm deps)
  check-links.js       asserts every local href/src/#fragment in site/ resolves
  templates/           layout.js (head, header, footer, mobile bar), sections.js, map.js, schema.js (JSON-LD), helpers.js
  templates/pages/     one file per page type: home, services, service (x8), our-work, about, areas, contact, 404
  assets/              site.css, site.js, favicon.svg, logo.svg (copied into site/assets/)
site/                  BUILT OUTPUT. This is what gets uploaded. Do not edit by hand.
screens/               screenshots of the approved single-page design
assets/logo-original.jpg   the flyer logo the SVG mark was redrawn from
```

Pages: `index.html`, `services.html`, eight service pages (`interior-painting.html`, `exterior-painting.html`,
`roof-painting.html`, `new-builds-renovations.html`, `commercial-painting.html`, `wallpapering.html`,
`decks-fences-staining.html`, `handyman-property-maintenance.html`), `our-work.html`, `about.html`, `areas.html`,
`contact.html`, `404.html`, plus `sitemap.xml` and `robots.txt`.

## Build

```
node src/build.js          # deletes site/ and regenerates it
node src/check-links.js    # optional: verify every local link and asset
```

Node 18+ (no `npm install`). Edit `src/config.js` (or a template) and rebuild. `site/assets/config.js`
is generated from `src/config.js` as `window.CONFIG`, which the browser uses for the live
"Open now · call Rich" chip, phone links and the quote form.

## Preview

Open `site/index.html` straight from disk, or run `python3 -m http.server -d site` and go to
`http://localhost:8000/`. All links and assets are relative, so it works from `file://` and from any folder on a host.

- `?placeholders=1` skips every remote photo and shows the branded gradient fallbacks (use this on
  networks that block Unsplash). Failed images fall back to the same gradients on their own.
- The hours chip ("Open now · call Rich" / "After hours") is worked out in NZ time.

## Deploy

- **Netlify Drop**: drag the `site/` folder onto https://app.netlify.com/drop. `404.html` is picked up automatically.
- **Any host (cPanel, GitHub Pages, etc.)**: upload the *contents* of `site/` to the web root
  (`index.html` must sit at the top level, next to `assets/`).
- A zip of `site/` (with `index.html` at its root) is the hand-off file.
- Before launch, set `business.url` in `src/config.js` to the real domain (with trailing slash) and rebuild:
  it drives canonical tags, `og:url`, JSON-LD, `sitemap.xml` and `robots.txt`.
- `404.html` uses relative asset paths like every other page, so it is fully styled for missing pages at the
  site root (e.g. `/old-page`). A missing URL inside a sub-folder (e.g. `/a/b`) shows it unstyled.

## Placeholder content (replace before launch)

- **Photos**: all Unsplash stock, set in `CONFIG.IMG`. Swap in Darren and Rich's own job photos
  (same keys). The gallery captions in `CONFIG.gallery` are generic job types, not real jobs.
  Each page's hero and `og:image` comes from `CONFIG.pages.<page>.img` (service pages use the service photo).
- **Before/after**: `before` and `after` are the same stock photo; the "before" side gets a desaturated,
  vignetted "before" filter because `beforeAfter.simulate` is `true`. Use a real before/after pair and set it to `false`.
- **Reviews**: the 3 testimonials in `CONFIG.reviews` are SAMPLES. Replace with real, verbatim reviews.
- **Email**: `business.email` is `quotes@example.co.nz`. The form opens a pre-filled email to this
  address while `formEndpoint` is empty.
- **Domain**: `business.url` is `https://www.example.co.nz/`.
- **Service page copy** (`services[].intro`, `included`, `steps`, `faqs`, `headline`, meta titles/descriptions)
  and the areas page copy (`areas[].about`, `areasFaq`) were written for the site from the existing claims only.
  Have Rich read them, especially the scope lists (e.g. tile roofs, quoting from plans, water blasting paths).

## Photo check

The build machine could not load Unsplash, so none of these photos has been seen loading. Open each
URL in a browser. If one 404s or is the wrong subject, replace its value in `CONFIG.IMG` (same key).
`IMG.heroPosition` (default `70% center`) sets where the hero photo is anchored so the subject
sits right of the headline; adjust it for the real photo.

- `hero`: https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80
- `why`: https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=80
- `svc_interior`: https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80
- `svc_exterior`: https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80
- `svc_roof`: https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1600&q=80
- `svc_newbuild`: https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80
- `svc_commercial`: https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80
- `svc_wallpaper`: https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80
- `svc_decks`: https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=80
- `svc_handyman`: https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1600&q=80
- `before`: https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80
- `after`: https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80
- `gallery_1`: https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80
- `gallery_2`: https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80
- `gallery_3`: https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80
- `gallery_4`: https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80
- `gallery_5`: https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80
- `gallery_6`: https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80

## Confirm with Rich

- Email address, and whether quote requests should go to a webhook (set `CONFIG.formEndpoint`; it
  POSTs JSON: name, mobile, town, job, message, page, submittedAt).
- Hours (default Mon–Sat 7am–6pm, Sunday closed), and that Rich is the right name for the "call" chip.
- `CONFIG.claims`. Everything is off until confirmed: Master Painters NZ, Dulux / Resene
  accreditation, Site Safe, insurance (with wording), Google rating and review count. Only the
  generic "Workmanship guarantee on every job" shows by default. Check he's happy with that too.
- Services list, especially the handyman items (small repairs, gutter cleaning, water blasting) and
  roof painting, plus the new per-service copy (see above).
- Towns covered (17 across Whanganui, Manawatū and South Taranaki).
- Logo: the header/footer logo is a redrawn inline SVG (`<symbol id="dr-mark">`, also `site/assets/logo.svg`)
  of the flyer's DR mark. Ask for the original vector file if one exists.
