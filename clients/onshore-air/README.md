# Onshore Air — website

Multi-page static website for **Onshore Air** (Luke, Pacific Paradise QLD 4564), air conditioning
installs, repairs, hydro cleaning and maintenance across the Sunshine Coast. Built to deploy on
Netlify by drag-and-drop: no build step, no external requests at runtime, phone-first.

```
clients/onshore-air/
  site/                    the Netlify publish folder (index.html at its root) — this is what goes live
  dist/onshore-air-site.zip  the same folder zipped for app.netlify.com/drop
  site-tools/              page generator + image, logo, font, screenshot, QA and zip helpers
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

Old Wix URLs are redirected with 301s: `/cleaning` → `/hydro-cleaning/`, `/contact-8` → `/contact/`,
`/home` → `/`, and `/<page>.html` → `/<page>/` for every page. `/installations` and `/repairs` keep working
as-is (Netlify adds the trailing slash).

## Deploy on Netlify

1. Log in at https://app.netlify.com/drop and drag `dist/onshore-air-site.zip` (or the `site/` folder) onto the page.
2. **Forms:** in the new site (Netlify now calls it a "project"), open **Forms** and click *Enable form detection*,
   then drag the zip on again (Deploys → drag and drop) so Netlify picks up the `quote` form. Every page's form posts to Netlify Forms and lands on `/thanks/`;
   the honeypot field is `company`, and a hidden `page` field records which page the lead came from.
3. **Form notifications:** Site/Project configuration → Notifications → Form submission notifications →
   *Add notification* → Email notification → form `quote` → `onshoreair@outlook.com`. Send a test lead and check spam.
4. **Custom domain:** Domain management → *Add a domain* → `onshoreair.com.au` (Netlify also adds `www`). Point DNS at
   Netlify (either switch nameservers to Netlify DNS, or add the A record / CNAME Netlify shows), then wait for the free
   HTTPS certificate. The canonical URLs, sitemap and Open Graph tags already use `https://onshoreair.com.au`. Keep the Wix
   site live until DNS has switched.
5. **Nimbata call tracking:** add the Nimbata snippet with Site/Project configuration → Build & deploy → Post processing →
   *Snippet injection* → "Before `</head>`" (applies to every page without a rebuild). Alternatively paste it into the
   `<head>` template in `site-tools/src/layout.js` and rebuild. In Nimbata, set the number to
   replace to `0444 541 409`. Every page has one hidden `<span id="nb-source">0444 541 409</span>`; `site.js` copies
   whatever number Nimbata writes into that span to every visible number and `tel:` link. Never hardcode a tracking number.
6. Submit `https://onshoreair.com.au/sitemap.xml` in Google Search Console and update the Google Business Profile website link.

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

## Rebuild / edit

Requirements: Node 18+ (no npm install needed), ImageMagick 6 (`convert`) for images, Playwright (`require('playwright')`)
for screenshots and the OG image. Run from `clients/onshore-air/site-tools/`:

| Command | What it does |
|---|---|
| `node build.js` | Regenerates every HTML page plus `sitemap.xml`, `robots.txt`, `netlify.toml`, `_redirects`, `site.webmanifest`, `waves.svg` |
| `node images.js` | Downloads Luke's original photos from Wix into `.cache/` (git-ignored) and exports WebP + JPEG sizes listed in `images.config.js` |
| `bash brand.sh` | Trims the client logo, recovers transparency from its black background, writes logo PNG/WebP, favicons (32, 180, 192, 512) and `favicon.ico` |
| `node og-image.js` | Renders the 1200x630 Open Graph image from the hero photo and logo |
| `bash fonts.sh` | Re-downloads the self-hosted Outfit + Inter woff2 files |
| `node check.js` | Link/asset checker, external-URL check, per-page SEO basics, home page weight |
| `node screenshots.js` | Full-page screenshots into `site-screens/` (390x844 and 1280x800) |
| `bash zip.sh` | Builds `dist/onshore-air-site.zip` with `index.html` at the zip root |

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
  deep orange `#D9731F`, wordmark yellow `#EEDF62`. Brand navy `#0C1D45` / `#081430` is the logo blue's hue taken dark;
  warm sand neutrals `#FBF8F3` / `#F6F0E6`. Call buttons use gold `#F3B941` with navy text.
- Type: Outfit (headings) and Inter (body), self-hosted woff2 (latin subset, variable weight), `font-display: swap`,
  with metric-matched Arial fallbacks to limit layout shift.
- The supplied logo PNG has a solid black background (no alpha); `brand.sh` converts it to a transparent logo for the
  navy header and footer. It is used as-is otherwise.
- No third-party requests: no CDN, analytics, map embed or Google Fonts at runtime. A Content-Security-Policy header was
  left out on purpose so the Nimbata snippet isn't blocked; add one once Nimbata's domains are known.
- QA at handoff: 0 missing internal references, 0 external runtime URLs, one `h1` per page, no horizontal scroll from
  320px to 1920px. Home page weight with every lazy image loaded: about 600 KB on a 3x phone, about 410 KB on a 1280px desktop.
