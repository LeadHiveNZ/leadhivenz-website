# Class 5 Property Services — website

Website for **Class 5 Property Services Ltd** (Jamie, Christchurch), built by LeadHive.
Plain static HTML/CSS/JS: no WordPress, no page builder and no monthly platform fees. It is fast and secure, and Netlify hosts it for free.

## What was built

20 pages, all written for Christchurch homeowners, landlords and property managers:

| Page | Address |
|---|---|
| Home | `/` |
| Services hub | `/services/` |
| TV wall mounting | `/services/tv-wall-mounting-christchurch/` |
| Plastering & GIB repairs | `/services/plastering-repairs-christchurch/` |
| Cabinetry & shelving | `/services/cabinetry-christchurch/` |
| Decks | `/services/decks-christchurch/` |
| Fences & gates | `/services/fences-gates-christchurch/` |
| Rental property maintenance | `/services/rental-property-maintenance-christchurch/` |
| Handyman & small jobs | `/services/handyman-christchurch/` |
| Service areas hub (with map) | `/areas/` |
| Suburb pages | `/areas/riccarton/`, `/areas/papanui/`, `/areas/halswell/`, `/areas/rangiora/`, `/areas/rolleston/` |
| About | `/about/` |
| Our work (before/after slider and gallery) | `/our-work/` |
| Contact and quote form (with photo upload) | `/contact/` |
| Thank-you page (after the form is sent) | `/thank-you/` |
| 404 page | `/404.html` |

The site also includes:

- **SEO:** a unique title and description on every page, Google business details (structured data) on every page, plus FAQ and breadcrumb data where relevant. It also has `sitemap.xml`, `robots.txt` and social share images.
- **Mobile:** a sticky "Call / Get a quote" bar on phones and a full-screen mobile menu.
- **Quote form:** built on Netlify Forms, so no extra service is needed. Customers can attach a photo.

## Before launch: confirm with Jamie

These items are placeholders or assumptions. Please check each one with Jamie.

1. **Domain:** the site assumes `www.class5services.co.nz`. If it's different, change `url` in `src/data/site.mjs` and rebuild.
2. **Hours:** Mon–Fri 7:30am–5:30pm, Sat by arrangement is a placeholder (`src/data/site.mjs`).
3. **Reviews:** the 3 testimonials are made-up PLACEHOLDERS ("Sarah, Halswell" and so on). Replace them with Jamie's real Google or Facebook reviews in `src/data/testimonials.mjs` (first name and suburb only), or delete the section. They must not go live as they are.
4. **Insurance / LBP / guarantees:** the site does not claim Jamie is insured, a Licensed Building Practitioner or offers a guarantee, and gives no years in business or job counts. If any of these are true, they can be added.
5. **"No call-out fee for quotes":** the site says quotes are free and no-obligation. Confirm that's right.
6. **More photos:** only fence, gate and ute photos exist. Photos of TVs mounted, plaster repairs, cabinetry and decks would make the service pages much stronger. Send them to LeadHive.
7. **Google Business Profile link** and **Facebook page link:** not on the site yet. Send them through and they'll go in the footer.
8. **Form notifications:** after the first deploy, in Netlify go to *Forms → quote → Settings → Form notifications* and add Jamie's email so quote requests reach him.

## How to deploy (Netlify, drag and drop)

1. Use `class5-property-services-netlify.zip` in this folder (it is the contents of `site/`, ready to go). If you rebuild the site, re-create it with `cd site && zip -r ../class5-property-services-netlify.zip .` so `index.html` stays at the top level of the zip.
2. Log in to app.netlify.com → **Add new site → Deploy manually** → drag the zip in.
3. Under **Domain management**, add Jamie's domain and follow the DNS steps.
4. Submit a test quote with a photo and check it appears under **Forms**.

`site/netlify.toml` already sets up clean URLs, security headers, caching and the 404 page.

## How to rebuild after changes

You need Node.js 22 or newer. Nothing else gets installed.

```
cd clients/class5-property-services
node src/build.mjs
```

This rebuilds everything in `site/` except `site/images/`. It also prints word counts and warns you if the placeholder reviews are still there.

If you change or add photos or the logo, also run `node src/build.mjs --assets`. This needs ImageMagick installed, and it regenerates the resized photos, favicons and the share image.

### Change the phone number, email or hours
Edit `src/data/site.mjs` → `phone`, `phoneIntl` (`+64...` with no spaces), `phoneSchema`, `email` and `hours`. Rebuild. Every page, button and the structured data update together.

### Add a service
1. Open `src/data/services.mjs`, copy an existing service block and give it a new `slug` (for example `gutter-repairs-christchurch`).
2. Write its copy (title ≤ 60 characters, description ≤ 155) and pick an `icon` from `src/partials/icons.mjs`.
3. Set `featured: true` to show it in the main service grids, or `false` to show it in menus and the footer only.
4. Add its slug to the `related` list of 1–2 other services, then rebuild. The page, menus, footer, sitemap and form dropdown all update automatically.

### Add a suburb page
Copy a block in `src/data/suburbs.mjs`, write a unique 250–350 word intro and rebuild.

## Folder layout

```
src/
  build.mjs        build script (no npm packages)
  assets.mjs       ImageMagick image/favicon generation (only with --assets)
  data/            business details, services, suburbs, FAQs, testimonials
  partials/        head, header, footer, CTA band, sticky bar, shared components, schema
  pages/           one template per page type
  assets/          style.css and main.js (copied to site/ on build)
  static/          favicons + share image (copied to site/ on build)
site/              the finished website. This folder is what goes to Netlify.
```
