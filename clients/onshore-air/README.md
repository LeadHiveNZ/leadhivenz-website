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
| `/` | `site/index.html` | Hero (aerial coast photo), status line, trust strip, services, why Onshore, brands, reviews, service area, quote form. `HVACBusiness` JSON-LD |
| `/installations/` | `site/installations/index.html` | Split, multi-head, ducted, new builds/replacements, what's included, process, gallery, brands, FAQ, form |
| `/repairs/` | `site/repairs/index.html` | Symptoms, same-day where possible, "quoted before work starts", process, brands, FAQ, form |
| `/hydro-cleaning/` | `site/hydro-cleaning/index.html` | What it is, real before/after photos, why, who it's for, how often, price, FAQ, form |
| `/maintenance/` | `site/maintenance/index.html` | Annual service checklist, benefits, who books, FAQ, form |
| `/about/` | `site/about/index.html` | Luke, 15+ years, Pacific Paradise, licence/insurance, how he works, photos, reviews, form |
| `/service-areas/` | `site/service-areas/index.html` | Suburbs grouped north / central / south / hinterland, form |
| `/contact/` | `site/contact/index.html` | Phone, email, hours, suburb-level address, stylised map note (no embed), form |
| `/thanks/` | `site/thanks/index.html` | Form success page (`noindex`) |
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
  desktop header from 1240 px), `logo-mark.svg` / `favicon.svg` (sphere only), raster exports `logo.png`/`logo.webp`
  (3x of the 56 px mobile header, used in the JSON-LD) and `logo-2x.png`/`logo-2x.webp` for email signatures and
  directories, plus `favicon.ico` (16/32/48), `apple-touch-icon.png` and the 192/512 app icons. The header and footer use
  the SVGs directly in `<img>`, so they are sharp at any size.

## Rebuild / edit

Requirements: Node 18+, ImageMagick 6 (`convert`) for images, Playwright (`require('playwright')`) for screenshots, the
OG image and the logo rasters. The logo generator has its own pinned dependencies (paper 0.16.0, opentype.js 2.0.0,
clipper-lib 6.4.2): `cd site-tools/logo && npm install` once. Run from `clients/onshore-air/site-tools/`:

| Command | What it does |
|---|---|
| `node build.js` | Regenerates every HTML page plus `sitemap.xml`, `robots.txt`, `netlify.toml`, `_redirects`, `site.webmanifest`, `waves.svg` |
| `node images.js` | Downloads Luke's original photos from Wix into `.cache/` (git-ignored) and exports WebP + JPEG sizes listed in `images.config.js` |
| `cd logo && node build-logo.js` | Rebuilds the vector logo (stacked, horizontal, mark), its PNG/WebP exports, favicons, app icons and `out/logo-compare.png` |
| `node og-image.js` | Renders the 1200x630 Open Graph image from the hero photo and `logo.svg` |
| `bash fonts.sh` | Re-downloads the self-hosted Outfit + Inter woff2 files |
| `node check.js` | Link/asset checker, external-URL check, per-page SEO basics, home page weight |
| `node screenshots.js` | Full-page screenshots into `site-screens/` (390x844 and 1280x800) |
| `bash zip.sh` | Builds `dist/onshore-air-site.zip` with `index.html` at the zip root |
| `node stage-preview.js <dir>` | Stages a click-through preview copy with relative URLs (for hosts without directory indexes) |

`npm run release` runs build → check → screenshots → zip.

Where to edit:
- Business facts (phone, email, hours, suburbs, reviews, brands): `site-tools/src/site.js`
- Shared header, footer, mobile call bar, quote form, schema and page shell: `site-tools/src/layout.js`
- Page copy: `site-tools/src/pages/*.js`
- Styles: `site/assets/css/site.css` (one file). Script: `site/assets/js/site.js` (nav toggle, status line, form validation, Nimbata sync)

Edit the source, run `node build.js`, then `node check.js` and `bash zip.sh`. Do not hand-edit the generated HTML in `site/`:
the next build overwrites it.

## Build notes

- Palette sampled from the logo with ImageMagick: deep blue `#264BA1`, sky `#5BB5D0`, gold `#E2B656`, orange `#E49A2D`,
  deep orange `#D9731F`, wordmark yellow `#EEDF60`. Brand navy `#0C1D45` / `#081430` is the logo blue's hue taken dark;
  warm sand neutrals `#FBF8F3` / `#F6F0E6`. Call buttons use gold `#F3B941` with navy text.
- Type: Outfit (headings) and Inter (body), self-hosted woff2 (latin subset, variable weight), `font-display: swap`,
  with metric-matched Arial fallbacks to limit layout shift.
- Header: stacked logo at 56 px on phones (it fits beside the phone button at 320 to 390 px), stacked at 60 px with the
  desktop nav from 1180 px, horizontal lockup at 50 px from 1240 px. Nav links never wrap from 1180 px up.
- No third-party requests: no CDN, analytics, map embed or Google Fonts at runtime. A Content-Security-Policy header was
  left out on purpose so the Nimbata snippet isn't blocked; add one once Nimbata's domains are known.
- QA at handoff: 0 missing internal references, 0 external runtime URLs, one `h1` per page, no horizontal scroll from
  320px to 1920px. Home page weight with every lazy image loaded: about 614 KB uncompressed (506 KB over the wire) on a
  3x phone, about 460 KB (326 KB) on a 1280px desktop.
