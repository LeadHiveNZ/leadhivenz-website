# Living Colour Ltd: website handover

A static, multi-page website for Living Colour Ltd (Howick, Auckland painters), ready to deploy on Netlify.
It uses plain HTML, CSS and JS with no framework and no npm. A small Python script (standard library only) builds the site.

- **Live domain (assumed):** `https://www.livingcolourltd.co.nz`, the current Wix site. This domain is used in canonical tags, the sitemap, Open Graph tags and schema. To change it, edit `SITE` in `build.py` plus the two `og:image`/`twitter:image` URLs in `src/partials/layout.html` and the URLs in `src/data/business.json`.
- **Pages (16 indexable, plus thanks and 404):** `/`, `/services/`, `/services/interior-painting/`, `/services/exterior-painting/`, `/services/roof-painting/`, `/services/commercial-painting/`, `/services/surface-preparation-repairs/`, `/services/staining-timber-finishes/`, `/projects/`, `/reviews/`, `/about/`, `/process/`, `/areas/`, `/faq/`, `/contact/`, `/privacy/`, `/thanks/` (noindex), `/404.html` (noindex).

## Build

```bash
cd clients/living-colour
python3 build.py          # builds src/ -> dist/, writes sitemap.xml + robots.txt, checks every internal link and #anchor
python3 build.py --zip    # same, plus living-colour-site.zip (index.html sits at the zip root)
```

The build exits non-zero if any internal link, anchor or tag balance is broken.
To preview: `cd dist && python3 -m http.server 8000`, then open http://localhost:8000. Opening `dist/index.html` straight from disk (`file://`) also works, because a few lines of JS rewrite folder links to `index.html`.

## Deploy to Netlify

- **Drag and drop:** run `python3 build.py --zip` and drop `living-colour-site.zip` (or the `dist/` folder) onto Netlify. `dist/_headers` and `dist/_redirects` carry the security and cache headers and the old-URL redirects.
- **From Git:** in Netlify set *Base directory* to `clients/living-colour`; the `netlify.toml` there runs `python3 build.py` and publishes `dist`.
- **Forms:** two Netlify forms are detected automatically at deploy time: `quote` (contact page, with photo upload) and `quick-quote` (home page). Both use a honeypot (`bot-field`) and redirect to `/thanks/`. After the first deploy, go to *Site settings, then Forms, then Form notifications* and add an email notification to `info@livingcolourltd.co.nz`.
  - The photo field uses `multiple` as briefed. Netlify caps a submission at 8MB, and older Netlify docs say only one file per input is kept. **Send a test submission with 2 or 3 photos after deploying.** If only one arrives, swap the single input in `src/pages/contact.html` for three inputs named `photo1`, `photo2` and `photo3`.
- **Domain:** point `www.livingcolourltd.co.nz` at Netlify and set it as the primary domain. Netlify then redirects the apex domain. `/registration` (the only other page on the old Wix site) redirects to `/contact/`.

## Folder map

```
build.py                 generator + link checker + zipper (~200 lines, stdlib only)
netlify.toml             Git-based deploy config (headers, redirects)
tools/make_images.py     regenerates placeholder photos and the OG image (needs Pillow; not part of the build)
tools/fonts/             Montserrat ExtraBold, used only to draw og.jpg
src/pages/*.html         one file per page: front-matter comment + page body
src/partials/            layout (head), header (nav + mega menu), footer, page-hero, cta band, icons (SVG sprite), service cards, service <option>s
src/data/reviews.json    the 20 curated reviews (used everywhere through {{reviews:1,2,3}})
src/data/projects.json   22 real jobs; the first 9 have photos (used through {{projects:...}} / {{projectlist:...}})
src/data/business.json   LocalBusiness/HousePainter JSON-LD for the home page
src/css/site.css         all styles (brand tokens at the top)
src/js/site.js           nav drawer, mega menu, reveal-on-scroll, counters, review carousel, form niceties
src/img/                 photos (placeholders for now) + brand/ (logo, favicons)
src/static/              _headers, _redirects (copied to dist root)
screens/                 Playwright screenshots (1440px and 390px)
```

### Editing content

- Page text lives in `src/pages/*.html`. The comment at the top sets `title`, `description`, `path`, and the inner-page hero (`h1`, `eyebrow`, `lead`, `hero` image, `crumbs`). `service:` adds Service schema and `faqschema: yes` adds FAQPage schema (built automatically from the `<details class="faq">` blocks). `cta: no` removes the navy call-to-action band.
- To add a review, add it to `src/data/reviews.json` and reference its `id`. To add a project, append it to `projects.json`. A project card links to its review by `review` id (use `0` for no quote).
- Brand colours, spacing and radii are CSS variables at the top of `site.css`.

## Swapping in real photos

Every image is currently a **free stock photo** (Unsplash / Pexels licences, plus two Wikimedia Commons photos under CC BY 4.0 that are credited on the Privacy page; see `src/img/CREDITS.txt`). They are representative, not Andy's actual jobs, so swap them for real job photos as they come in. `tools/make_images.py` can regenerate gradient placeholders if a slot is ever empty. Replace each file in `src/img/` with a real photo **with exactly the same filename**, then run `python3 build.py`. Images sit in fixed-ratio frames with `object-fit: cover`, so any aspect ratio works, but the sizes below crop best. Compress to roughly 200 to 350KB (heroes) and 120 to 200KB (cards) as progressive JPEG, or let Netlify Image CDN handle it later.

| File | Size | Used on | Suggested shot |
|---|---|---|---|
| hero-home.jpg | 2000x1125 | Home hero, Services hub hero | Best finished exterior, wide, bright sky. Left third should be calm (text sits there) |
| hero-interior.jpg | 2000x1125 | Interior page | Finished living room or hallway |
| hero-exterior.jpg | 2000x1125 | Exterior page | Two-storey exterior, e.g. Takapuna or Penrose |
| hero-roof.jpg | 2000x1125 | Roof page | Freshly coated roof |
| hero-commercial.jpg | 2000x1125 | Commercial page | Office or school interior |
| hero-prep.jpg | 2000x1125 | Prep & repairs page | Sanding or filling in progress |
| hero-staining.jpg | 2000x1125 | Staining page | Epsom cedar re-stain (black Cool Cote) |
| hero-about.jpg | 2000x1125 | About | Team on site / van |
| hero-contact.jpg | 2000x1125 | Contact, Privacy | Any friendly on-site shot |
| hero-areas.jpg | 2000x1125 | Areas | Auckland street of houses |
| hero-reviews.jpg | 2000x1125 | Reviews | Happy finished home |
| hero-projects.jpg | 2000x1125 | Projects | Finished project, wide |
| hero-process.jpg | 2000x1125 | Process | Prep / masking in progress |
| hero-faq.jpg | 2000x1125 | FAQ | Brushes, paint tins |
| service-interior/exterior/roof/commercial/prep/staining.jpg | 1200x900 | Home + Services hub cards | One per service |
| project-01.jpg ... project-09.jpg | 1200x900 | Projects (+ home, service pages) | 01 Takapuna 2-storey exterior · 02 Albany monoclad · 03 Epsom cedar re-stain · 04 Penrose stucco · 05 Mt Eden bungalow interior · 06 Freemans Bay bedrooms · 07 CBD office make-good · 08 Royal Oak roughcast · 09 Massey exterior |
| detail-brush.jpg | 1200x900 | Prep page | Brush cutting in |
| detail-roller.jpg | 1200x900 | Interior page | Roller on wall |
| detail-swatches.jpg | 1200x900 | Services hub, About | Resene/Dulux swatches |
| detail-weatherboard.jpg | 1200x900 | Exterior page | Close-up of painted boards |
| detail-door.jpg | 1200x900 | Projects | Freshly painted front door |
| auckland-skyline.jpg | 1200x900 | Home (areas), Areas | Auckland skyline / Rangitoto |
| about-andy.jpg | 1000x1250 (portrait) | Home (Meet Andy), About | **A photo of Andy on site.** Currently a faceless stock shot of a painter; replace with Andy's own photo |
| og.jpg | 1200x630 | Social share image (all pages) | Already final (logo + tagline). Regenerate with `python3 tools/make_images.py` if the logo changes |

If the project photos don't match the job in `projects.json`, edit `img`, `type` and `line` there. Project 1 must be a photo of project 1's job.

## Assumptions made

1. The domain stays `www.livingcolourltd.co.nz` (with www, as the current Wix site redirects there).
2. "Andy Bui" is the public name; the legal director name (Tuan Thanh Bui) isn't shown on the site.
3. "12+ years" comes from incorporation on 7 April 2014.
4. "39 five-star reviews on Builderscrack": Builderscrack shows 39 reviews at effectively 5.0, so the stats strip says "Five-star reviews on Builderscrack". The Google rating is shown as 5.0 (6 reviews in schema). Neither number updates itself, so refresh them when they change.
5. Reviews are reproduced from Builderscrack with typos fixed (as in research/reviews.md). The reviews page says so. Google review text wasn't retrievable, so the site links to Google rather than quoting it.
6. Standard-practice process wording (two topcoats, low-odour water-based interior paints, mould wash, spot-priming, edge protection on roofs, daily tidy) describes normal good practice and isn't a guarantee. The client should confirm it matches how they quote.
7. Roof painting is presented as a full service page (see "Client to confirm").
8. Wellington service page copy is kept light ("we also take on work in Wellington"). Suburbs listed: Wellington city, Lower Hutt, Porirua.
9. No prices or cost ranges are published, because there's no client data for them. The FAQ explains that the price depends on the job.
10. Payment wording is generic ("terms are written into your quote; larger jobs may be invoiced in stages").
11. There's no before/after slider and no live Google reviews widget, because there are no before/after photos yet and no external JS was allowed (see "Next upgrades").
12. Year in the footer is hard-coded to 2026; the privacy policy says "Last updated: October 2026".
13. Hours are shown as Mon–Sat 8am–6pm, Sunday closed (from Google Business Profile).

## Client to confirm

- [ ] **Roof painting:** do you offer it, which roof types (iron, concrete tile?) and which coating system? (`src/pages/svc-roof.html`; remove the page and its links if not.)
- [ ] **After-hours / early-start commercial work:** the site says Saturdays, plus "early starts or after-hours work where a site needs it" can be discussed. OK?
- [ ] **Schools in the holidays:** OK to say we plan school work for term breaks?
- [ ] **Body corporate / apartments:** listed under commercial. OK?
- [ ] **Waterblasting** and **roof moss/lichen treatment:** do you do these in-house?
- [ ] **Paint supply:** the FAQ says paint is supplied by us and included in the quote. Correct?
- [ ] **Standard spec:** two topcoats; low-odour water-based paint for most interiors. Correct?
- [ ] **Payment terms:** deposit? progress payments? accepted methods? (FAQ "How do I pay?")
- [ ] **Response time:** we deliberately didn't promise one. Want to add "we reply within 1 working day"?
- [ ] **Workmanship guarantee:** the site only says the work is backed by $100,000 defective-workmanship cover. If you offer a written guarantee (e.g. X years), tell us the term.
- [ ] **Master Painters / other memberships:** not claimed. Add if you're a member.
- [ ] **Wellington:** which areas, and is there any minimum job size?
- [ ] **Hibiscus Coast / Franklin:** happy to travel there for all job sizes?
- [ ] **Mobile number for texts:** OK to say "call or text"? (Currently just "call".)
- [ ] **Photos:** real photos for every slot above, especially **Andy's portrait** (`about-andy.jpg`).
- [ ] **Google review count:** currently 6. Update `src/data/business.json` (`reviewCount`) as it grows.
- [ ] **Domain** and **Netlify form notification email** (`info@livingcolourltd.co.nz`?).
- [ ] **Landline (09 390 8689):** still in use? It isn't shown on the site.

## Next upgrades (optional)

- A before/after slider on the home and exterior pages once paired before/after photos exist.
- A Google Business Profile post linking to the new site; ask recent customers for Google reviews (the link is on `/reviews/` and in the footer).
- Suburb landing pages (e.g. /areas/howick/) once there are 2 to 3 local projects with photos per suburb.
- Netlify Image CDN or pre-generated WebP versions of the real photos.
