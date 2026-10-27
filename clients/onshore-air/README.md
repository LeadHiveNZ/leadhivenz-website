# Onshore Air — website

Multi-page static website for **Onshore Air** (Luke, Pacific Paradise QLD 4564), air conditioning
installs, repairs, hydro cleaning and maintenance across the Sunshine Coast. Built to deploy on
Netlify by drag-and-drop: no build step, no external requests at runtime, phone-first.

```
clients/onshore-air/
  site/                    the Netlify publish folder (index.html at its root) — this is what goes live
  dist/onshore-air-site.zip  the same folder zipped for app.netlify.com/drop
  site-tools/              page generator + image, font, screenshot, QA and zip helpers
  site-tools/logo/         vector rebuild of the client's logo (sphere geometry + wordmark outlines)
  site-tools/out/          logo-compare.png: original vs vector at the same size, on black, navy and white
  site-screens/            full-page screenshots of every page at 390x844 and 1280x800
  brand/                   logo refresh concepts (separate job, see brand/README.md)
```

## Pages and routes

| Route | File | Notes |
|---|---|---|
| `/` | `site/index.html` | Photo hero (Luke at work) with Google and ARCtick chips, trust card, service photo cards, brand logo strip, hydro before/after slider band, Meet Luke, Google review cards, aerial service-area band, orange call band, quote form. `HVACBusiness` JSON-LD |
| `/installations/` | `site/installations/index.html` | System types, what's included (photo + ticks), numbered steps, photo grid, brand logos, FAQ, call band, form |
| `/repairs/` | `site/repairs/index.html` | Symptom cards, same-day / quoted-first navy band, numbered steps, brand logos, FAQ, call band, form |
| `/hydro-cleaning/` | `site/hydro-cleaning/index.html` | What it is + what's included, before/after drag slider band, why, who it's for, price block, FAQ, call band, form |
| `/maintenance/` | `site/maintenance/index.html` | Service checklist (photo + ticks), benefit cards, who books, FAQ, call band, form |
| `/about/` | `site/about/index.html` | "G'day, I'm Luke" hero, half-bleed coil-cleaning photo with his story, trust card and business facts, photo grid, reviews, call band, form |
| `/service-areas/` | `site/service-areas/index.html` | Full-width aerial hero, every suburb grouped north / central / south / hinterland, coast and hinterland band, call band, form |
| `/contact/` | `site/contact/index.html` | Navy contact card (phone, email, hours, suburb, ABN, licence), stylised inline SVG map (no embed), what to have handy, call band, form |
| `/thanks/` | `site/thanks/index.html` | Form success page with service cards (`noindex`) |
| any missing URL | `site/404.html` | Netlify serves it automatically (`noindex`) |

Also in `site/`: `robots.txt`, `sitemap.xml`, `site.webmanifest`, `favicon.ico`, `netlify.toml`
(security headers, 1-year immutable caching for `/assets/*`, 301s) and `_redirects` (same 301s, fallback).

Canonical host: `https://www.onshoreair.com.au` (with www), the host the Wix site uses and Google has indexed. Every
canonical, `og:url`, JSON-LD `@id`/`url`/`image`, `sitemap.xml` entry and the robots.txt sitemap line use it
(`origin` in `site-tools/src/site.js`).

Every URL from the old Wix sitemap and blog feed is redirected with a 301 (first match wins):

| Old Wix URL | New page |
|---|---|
| `/cleaning` | `/hydro-cleaning/` |
| `/contact-8`, `/inquiry-services-page` | `/contact/` |
| `/home`, `/blog`, `/blog/*` | `/` |
| `/post/professional-air-conditioner-cleaning-services-on-the-sunshine-coast` | `/hydro-cleaning/` |
| `/post/fast-reliable-air-conditioner-repairs-on-the-sunshine-coast` | `/repairs/` |
| `/post/expert-air-conditioning-installations-on-the-sunshine-coast` | `/installations/` |
| `/post/*` (any other old post, after the three above) | `/` |
| `/<page>.html` for every page, `/cleaning.html`, `/contact-8.html` | the matching new page |

`/installations` and `/repairs` keep working as-is (Netlify adds the trailing slash).

## Deploy on Netlify

1. Log in at https://app.netlify.com/drop and drag `dist/onshore-air-site.zip` (or the `site/` folder) onto the page.
2. **Forms:** in the new site (Netlify now calls it a "project"), open **Forms** and click *Enable form detection*,
   then drag the zip on again (Deploys → drag and drop) so Netlify picks up the `quote` form. Every page's form posts to Netlify Forms and lands on `/thanks/`;
   the honeypot field is `company`, and a hidden `page` field records which page the lead came from.
3. **Form notifications:** Site/Project configuration → Notifications → Form submission notifications →
   *Add notification* → Email notification → form `quote` → `onshoreair@outlook.com`. Send a test lead and check spam.
4. **Custom domain:** Domain management → *Add a domain* → `www.onshoreair.com.au`, add `onshoreair.com.au` too, and set
   **`www.onshoreair.com.au` as the primary domain** so Netlify 301-redirects the apex (`onshoreair.com.au`) to www. Point
   DNS at Netlify (either switch nameservers to Netlify DNS, or add the CNAME for www and the A record for the apex that
   Netlify shows), then wait for the free HTTPS certificate. The canonical URLs, sitemap and Open Graph tags already use
   `https://www.onshoreair.com.au`. Keep the Wix site live until DNS has switched.
5. **Nimbata call tracking:** add the Nimbata snippet with Site/Project configuration → Build & deploy → Post processing →
   *Snippet injection* → "Before `</head>`" (applies to every page without a rebuild). Alternatively paste it into the
   `<head>` template in `site-tools/src/layout.js` and rebuild. In Nimbata, set the number to
   replace to `0444 541 409`. Every page has one hidden `<span id="nb-source">0444 541 409</span>`; `site.js` copies
   whatever number Nimbata writes into that span to every visible number and `tel:` link. Never hardcode a tracking number.
6. Submit `https://www.onshoreair.com.au/sitemap.xml` in Google Search Console and update the Google Business Profile
   website link (see "Keeping Luke's SEO" below).

## Keeping Luke's SEO

The move off Wix keeps everything Google already knows about the site:

1. **Keep the domain and the www host.** Same domain, `www.onshoreair.com.au` as the primary (canonical) host, apex
   redirected to it, exactly as on Wix. Do not switch to the bare domain.
2. **Launch with the 301 map.** Every old Wix page, blog page and post URL above redirects permanently to its closest
   new page, so links and rankings carry over instead of hitting 404s.
3. **Submit the new sitemap** (`https://www.onshoreair.com.au/sitemap.xml`) in Google Search Console. The existing
   property stays valid because the domain is unchanged, so there is nothing to re-verify.
4. **Check the redirects with URL Inspection** on the five old URLs (`/cleaning`, `/contact-8`, and the three `/post/...`
   articles): each should report the redirect to its new page. Request indexing of the new home page and service pages.
5. **Update the Google Business Profile** website link to `https://www.onshoreair.com.au/` (and any directory listings).
6. **Expect a short settle period.** Rankings can wobble for a few weeks while Google recrawls and processes the
   redirects; that is normal. Keep the redirects in place permanently.

## Confirm with Luke before launch

- **Hours:** Mon–Fri 7:00–5:00, Saturday 7:00–5:00, Sunday closed (drives the "Open now / Closed" status line, Brisbane time).
- **Suburbs:** the four groups on `/service-areas/`; add or remove any he does or doesn't want to travel to.
- **Prices:** the only price shown is the hydro clean, **$180 + GST** per standard wall split at standard height with
  multi-unit discounts, copied from his current Wix cleaning page. Confirm it is still current (or remove it). Repairs say
  "quoted before work starts" and installs say "free quotes"; no other prices appear.
- **Email:** `onshoreair@outlook.com` is shown on the contact page and footer, and is where form notifications should go.
- **Claims:** 5.0 Google rating, 15+ years, ARC licence AU067414, licensed & insured, workmanship guarantee and
  "same-day where possible" (all from his site); the brands list; the maintenance checklist on `/maintenance/`.
- **Photos:** all photos are his own from the Wix site. Confirm the hydro before/after pair is the same unit, and that
  he's happy with the photos of himself on the About and Hydro cleaning pages.
- **Address:** the site shows suburb only (Pacific Paradise QLD 4564), not the street.

## Logo

The client's only logo file is a 566 x 452 PNG on solid black with compression artefacts, so keyed onto navy it had
muddy edges and went soft on 3x phones. It has been rebuilt as a clean vector that is faithful to the original
(`site-tools/logo/`, run `npm install && node build-logo.js`); `site-tools/out/logo-compare.png` shows the two side by side
at the same size on black, navy and white.

- **Sphere** (`sphere.js`): real geometry measured from the original. Circle fitted to the silhouette; 6 blue stripes above
  an S-shaped seam (the seam read off the original, the stripe lines fanning towards a tangent at the top, gap positions found
  by darkness histograms) and 9 orange "latitude" stripes, concentric arcs fitted to the original's gap radii
  (pitch 17.7 px at source scale). Gaps of 1.9 px, 3.2 px rounded stripe ends, and per-stripe gradients sampled from the
  original (lighter seam-side edge into the stripe colour).
- **Wordmark** (`wordmark.js`): the original is drawn as thick yellow "tube" letters with a thin dark line running down the
  middle of every stroke. It is rebuilt the same way: a thin condensed skeleton, dilated into the yellow tube (stems 25 px
  at source scale, softly squared corners) with the skeleton kept as a 2.6 px navy (`#0C1D45`) inline. Yellow is `#EEDF60`,
  sampled.
- **Font:** 69 font/weight candidates were scored against the original by mask overlap, letter by letter (Bungee Inline,
  Passion One, Changa One, Lilita One, Titan One, Bowlby One, Righteous, Monoton and more as solid faces, and condensed thin faces
  used as tube skeletons). Thin condensed faces as skeletons beat every solid display face (0.88 vs 0.75 best solid, 0.57
  Bungee Inline). The top four (Yanone Kaffeesatz, Sofia Sans Condensed, Saira Extra Condensed, Dosis) were tied within
  0.005 on the letters a font can match (O S H O R E I R, about 0.90), so the pick was made on shape: **Yanone Kaffeesatz
  ExtraLight** (SIL OFL, `site-tools/logo/fonts/`), a 1920s coffee-house condensed face with an oval O, a diagonal-spined S
  and a curved R leg like the original's (the others have boxier O and S or straight R legs). The original's N ("n"-shaped,
  no diagonal) and A (arched, with a curved crossbar) exist in no candidate, so those two are drawn as monoline skeletons
  at the font's stem weight, measured from the original. Each letter is fitted to the original letter's width and
  position. All text is converted to outlines: the SVGs need no font. Scoring tools, candidate list and results:
  `site-tools/logo/font-match/`; overlay sheet: `site-tools/out/font-candidates.jpg`.
- **Files** in `site/assets/img/`: `logo.svg` (stacked, as the original), `logo-horizontal.svg` (sphere left, used in the
  desktop header from 1240 px), `favicon.svg` (sphere only), `logo.png` (used in the JSON-LD), `favicon.ico`
  (16/32/48), `apple-touch-icon.png` and the 192/512 app icons. Extras that are not deployed live in `site-tools/out/`:
  `logo-mark.svg`, `logo-stacked.png` and `logo-horizontal.png` for email signatures, social and directories. The header and footer use
  the SVGs directly in `<img>`, so they are sharp at any size.

## Rebuild / edit

Requirements: Node 18+, ImageMagick 6 (`convert`) for images, Playwright (`require('playwright')`) for screenshots, the
OG image and the logo rasters. The logo generator has its own pinned dependencies (paper 0.16.0, opentype.js 2.0.0,
clipper-lib 6.4.2): `cd site-tools/logo && npm install` once. Run from `clients/onshore-air/site-tools/`:

| Command | What it does |
|---|---|
| `node build.js` | Regenerates every HTML page plus `sitemap.xml`, `robots.txt`, `netlify.toml`, `_redirects`, `site.webmanifest`, `stripes.svg` |
| `node images.js [name ...]` | Downloads Luke's original photos and logos from Wix into `.cache/` (git-ignored) and exports the WebP + JPEG sizes and trimmed logo PNGs listed in `images.config.js` (pass names, e.g. `hero-home logo-daikin`, to redo only those) |
| `cd logo && node build-logo.js` | Rebuilds the vector logo (stacked, horizontal, mark), its PNG exports, favicons, app icons and `out/logo-compare.png` |
| `node og-image.js` | Renders the 1200x630 Open Graph image in the hero style (navy, logo and stripe band, Luke's hydro-clean photo behind the gradient, caps Barlow Condensed headline, orange "Call Luke" button with the number from `site.js`) |
| `bash fonts.sh` | Re-downloads the self-hosted Barlow (400, 600, 700) and Barlow Condensed (600, 700) woff2 files |
| `node check.js` | Link/asset checker, external-URL check (outbound new-tab links listed separately), per-page SEO basics, home page weight |
| `node screenshots.js` | Full-page screenshots into `site-screens/` (390x844 and 1280x800) |
| `bash zip.sh` | Builds `dist/onshore-air-site.zip` with `index.html` at the zip root |
| `node stage-preview.js <dir>` | Stages a click-through preview copy with relative URLs (for hosts without directory indexes) |

`npm run release` runs build → check → screenshots → zip.

Where to edit:
- Business facts (phone, email, hours, suburbs, reviews, brands): `site-tools/src/site.js`
- Shared header, footer, mobile call bar, quote form, schema and page shell: `site-tools/src/layout.js`
- Page copy: `site-tools/src/pages/*.js`
- Styles: `site/assets/css/site.css` (one file). Script: `site/assets/js/site.js` (nav toggle, status line, form validation, Nimbata sync, before/after slider)

Edit the source, run `node build.js`, then `node check.js` and `bash zip.sh`. Do not hand-edit the generated HTML in `site/`:
the next build overwrites it.

## Build notes

- Art direction "Trade": one real local trade business, modelled on Static Electrics (owner up front, dark trust band,
  licence badges) and Thelen (condensed caps, photo cards, solid colour bands) in Onshore Air's colours. White page
  (`#FFFFFF`) with cool grey alternate sections (`#F2F4F7`), Navy-deep `#0A1636` for the header, heroes, dark bands and
  footer, Ink `#0E1F4D` for text and cards. Sunset `#E0702A` is used only on CTAs (navy-deep text, 5.52:1), band edges
  (the 6px line under each hero, the orange call band) and small ticks; Ocean `#1E5CB3` for links. The logo's Seafoam
  `#7CC7DB` and Sun `#F2D45C` appear only in the 8px stripe band under the header.
- Type: Barlow Condensed 700 in caps for H1 (about 72px at 1440, 44px on phones), H2 (about 48 / 34px) and the big phone
  numbers and prices; Barlow 600 sentence case for H3 and buttons; Barlow 400/600 body at 17-18px, line-height 1.55.
  Tracking 0 to +.01em, no italics. Self-hosted woff2 (latin subset, `font-display: swap`) with metric-matched Arial
  fallbacks measured in Chromium.
- Photography carries the page: full-bleed photo heroes (home 620-860px, inner pages 420-520px; the photo fills the
  right ~60% behind a navy gradient, full width for the landscape aerial), three full-bleed image bands on the home page
  (hero, before/after slider, aerial service area), 3:2 service photo cards and 4:5 photo grids. 4px radius, no frames.
- Trust signals use real marks: the ARCtick logo with licence AU067414, Google G and stars, a drawn workmanship seal,
  a shield, a 15+ years badge, and the manufacturer logos from Luke's Wix site (greyscale until hover). The Mitsubishi
  Electric file on Wix is cropped, so it is named in text instead.
- Structure: no eyebrow labels, no hairline rules as structure (rules only as card edges), no numbered index rows.
  Sections alternate dense strips (trust card, logo strip) with image bands and solid navy or orange bands; process
  steps use 52px numbered badges; FAQs are an accordion of boxes. One element overlaps a band edge (the home trust card).
- Copy is in Luke's first person and uses only facts already on his site (15+ years, 5.0 on Google, ARC AU067414,
  ABN, hours, Pacific Paradise, $180 + GST hydro clean, brands, suburbs).
- The before/after slider is a native `<input type="range">` over the photo pair (keyboard, screen reader and pointer
  drag all work; site.js only mirrors its value into a CSS variable). The after photo has an explicit crop in
  `images.config.js` that registers it on the before photo.
- Phone weight: below 600px every photo gets a WebP `<source>` limited to widths up to 900px (`PHONE_CAP` in
  `layout.js`), and hero preloads are media-scoped to match.
- Header: navy-deep, stacked logo at 56 px on phones (it fits beside the phone button at 320 to 390 px), stacked at 60 px
  with the desktop nav (Barlow Condensed caps) from 1180 px, horizontal lockup at 50 px from 1240 px.
- No third-party requests: no CDN, analytics, map embed or Google Fonts at runtime. A Content-Security-Policy header was
  left out on purpose so the Nimbata snippet isn't blocked; add one once Nimbata's domains are known.
- QA at handoff: 0 missing internal references, 0 external runtime URLs, one `h1` per page, no horizontal scroll from
  320px to 1920px. Home page weight with every lazy image loaded: about 607 KB uncompressed (496 KB over the wire) on a
  3x phone, about 622 KB (486 KB) on a 1280px desktop, about 875 KB (739 KB) on a 1440px 2x screen.
