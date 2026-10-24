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
tools/make_images.py     fills any *missing* photo slot with a placeholder + redraws og.jpg (needs Pillow; not part of the build). Never run it with --force: that overwrites the client photos
tools/shots.js           Playwright screenshots of key pages into screens/ (node tools/shots.js)
tools/fonts/             Montserrat ExtraBold, used only to draw og.jpg
src/pages/*.html         one file per page: front-matter comment + page body
src/partials/            layout (head), header (nav + mega menu), footer, page-hero, cta band, icons (SVG sprite), service cards, service <option>s
src/data/reviews.json    the 20 curated reviews (used everywhere through {{reviews:1,2,3}})
src/data/projects.json   9 photo cards (client job photos) + 13 text cards with suburb and review ({{projects:...}} / {{projectlist:...}})
src/data/business.json   LocalBusiness/HousePainter JSON-LD for the home page
src/css/site.css         all styles (brand tokens at the top)
src/js/site.js           nav drawer, mega menu, reveal-on-scroll, counters, review carousel, before/after sliders, form niceties
src/img/                 client job photos, before/after pairs, a few remaining stock photos + brand/ (logo, favicons)
src/static/              _headers, _redirects (copied to dist root)
screens/                 Playwright screenshots (1440px and 390px)
```

### Editing content

- Page text lives in `src/pages/*.html`. The comment at the top sets `title`, `description`, `path`, and the inner-page hero (`h1`, `eyebrow`, `lead`, `hero` image, `crumbs`). `service:` adds Service schema and `faqschema: yes` adds FAQPage schema (built automatically from the `<details class="faq">` blocks). `cta: no` removes the navy call-to-action band.
- To add a review, add it to `src/data/reviews.json` and reference its `id`. To add a project, append it to `projects.json`. A project card links to its review by `review` id (use `0` or `null` for no quote). `suburb` is optional: photo cards 1 to 9 have no suburb and no review (the photos aren't tied to a specific reviewed job), so they use `kicker` (e.g. "Exterior painting") for the small red label instead. Only attach a suburb or review to a photo card if the photo really is that job.
- Brand colours, spacing and radii are CSS variables at the top of `site.css`.

## Before & after sliders

A small, dependency-free compare slider (CSS in `site.css` under "before & after", JS in `site.js` under "before/after sliders"). The after photo sits underneath, the before photo is clipped on top, and a hidden range input carries keyboard and screen-reader control. Drag with a mouse or finger (vertical swipes still scroll the page), tap to jump, or Tab to it and use the arrow keys. It has no animation beyond a short ease when you click, which is switched off for people who prefer reduced motion. Without JS it shows a fixed 50/50 split.

Where it's used: Home ("Before & after" section after the services grid), Projects (top section, plus the roof composite as a plain image card), Exterior painting (villa slider in the body copy) and Roof painting (the roof composite as a captioned image).

**To add a new pair:**

1. Save two photos of the same view at **exactly the same pixel size** as `src/img/NAME-before.jpg` and `src/img/NAME-after.jpg` (16:10 crops best; around 1600x1000, 150 to 350KB). Shoot both from the same spot so the slider lines up.
2. Add one line to any page:

```
{{ba:ba5|plain-text description of the photos (used for alt text)|<strong>Short title</strong>One-line caption.}}
```

An optional fourth part adds a class: `ba-wide` (full-width, 2:1, as on the home page) or `ba-span2` (two of three columns, as on the Projects page). Put sliders inside a `<div class="ba-grid">` for the three-column layout, or straight into `.prose` body copy for a single one. Don't use `|` or `}` inside the text, and write `&` as a plain `&` in the description (it's escaped for you).

A single composite image (like `roof-before-after.jpg`) isn't a slider. Use a plain `<figure class="ba"><div class="ba-photo"><img ...></div><figcaption>...</figcaption></figure>` (see `svc-roof.html`).

## Photos

Most slots now hold **Living Colour's own job photos** (from the client's Google Business Profile, October 2026). The rest are still **free stock photos** (Unsplash / Pexels licences, no attribution needed; see `src/img/CREDITS.txt`). The Wikimedia Commons photo that needed a credit has been replaced, and the Privacy page credit has been updated to match.

To swap a photo, replace the file in `src/img/` **with exactly the same filename**, then run `python3 build.py`. Images sit in fixed-ratio frames with `object-fit: cover`, so any aspect ratio works, but the sizes below crop best. Compress to roughly 200 to 350KB (heroes) and 120 to 200KB (cards) as progressive JPEG. Photos taken from a Google Business Profile collage can carry white borders: trim them before use (project-04, hero-process, hero-exterior, hero-reviews and ba4-after were trimmed this way).

| File | Status | Used on | Shows / suggested shot |
|---|---|---|---|
| hero-home.jpg | **Client** | Home hero, Services hub hero | Finished two-storey home, black vertical cedar + white plaster |
| hero-exterior.jpg | **Client** | Exterior page | Finished white villa |
| hero-interior.jpg | **Client** | Interior page | Bathroom |
| hero-roof.jpg | **Client** | Roof page | Roof before/after composite (diagonal split) |
| hero-commercial.jpg | **Client** | Commercial page | Striped multicolour feature wall |
| hero-prep.jpg | **Client** | Prep & repairs page | Two-storey home in scaffold |
| hero-about.jpg | **Client** | About | Crew van and truck at a scaffolded modern home |
| hero-projects.jpg | **Client** | Projects | Villa in scaffold |
| hero-reviews.jpg | **Client** | Reviews | White two-storey weatherboard home |
| hero-process.jpg | **Client** | Process | Finished white plaster townhouse |
| hero-staining.jpg | Stock | Staining page | Wanted: a cedar re-stain or deck/fence job |
| hero-contact.jpg | Stock | Contact, Privacy | Wanted: any friendly on-site shot |
| hero-areas.jpg | Stock | Areas | Wanted: an Auckland street of houses |
| hero-faq.jpg | Stock | FAQ | Wanted: brushes, paint tins |
| service-interior/exterior/roof/commercial/prep.jpg | **Client** | Home + Services hub cards | Kitchen / two-storey exterior / roof composite / feature wall / scaffold |
| service-staining.jpg | Stock | Home + Services hub cards | Wanted: stained cedar, deck or fence |
| project-01 ... project-09.jpg | **Client** | Projects (+ home, exterior and staining pages) | 01 two-storey exterior · 02 villa · 03 white weatherboard home · 04 plaster & weatherboard townhouse · 05 striped commercial feature wall · 06 bathroom · 07 bathroom · 08 kitchen · 09 roof composite |
| ba1 ... ba4-before/after.jpg | **Client** | Home, Projects, Exterior (ba2) | 1 two-storey home · 2 villa · 3 weatherboard home · 4 townhouse. Each pair is the same pixel size |
| roof-before-after.jpg | **Client** | Projects, Roof page | Roof composite, pale roof (top) to charcoal (bottom) |
| detail-brush/roller/swatches/weatherboard/door.jpg | Stock | Prep, Interior, Services hub, About, Exterior, Projects | Close-up detail shots |
| auckland-skyline.jpg | Stock | Home (areas), Areas | Auckland skyline / Rangitoto |
| about-andy.jpg | Stock | Home (Meet Andy), About | **A photo of Andy on site.** Currently a faceless stock shot of a painter; replace with Andy's own photo (1000x1250 portrait) |
| og.jpg | Final | Social share image (all pages) | Logo + tagline. Regenerate with `python3 tools/make_images.py` if the logo changes |

The nine photo cards in `projects.json` describe what each photo shows (no suburb, no review). If a photo is swapped, update that card's `type` and `line` to match.

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
11. There's no live Google reviews widget, because no external JS was allowed. The before/after sliders are built in-house with no dependencies.
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
- [ ] **Photos:** real photos for the slots still marked Stock above, especially **Andy's portrait** (`about-andy.jpg`) and a staining job.
- [ ] **Photo cards and before/after captions:** we described each photo from what's visible (e.g. "black cedar", "iron roof", "bathroom repaint"). Please check they're accurate, and tell us the suburb if you'd like it shown.
- [ ] **Weatherboard before/after (ba3):** the before and after were taken from different spots, so the slider doesn't line up. A before photo from the same angle as the after would make it much stronger.
- [ ] **Google review count:** currently 6. Update `src/data/business.json` (`reviewCount`) as it grows.
- [ ] **Domain** and **Netlify form notification email** (`info@livingcolourltd.co.nz`?).
- [ ] **Landline (09 390 8689):** still in use? It isn't shown on the site.

## Next upgrades (optional)

- More before/after pairs, ideally shot from the same spot before and after (add with one line each, see "Before & after sliders").
- Andy's own portrait for `about-andy.jpg`, and real photos for the remaining stock slots.
- A Google Business Profile post linking to the new site; ask recent customers for Google reviews (the link is on `/reviews/` and in the footer).
- Suburb landing pages (e.g. /areas/howick/) once there are 2 to 3 local projects with photos per suburb.
- Netlify Image CDN or pre-generated WebP versions of the photos (several client photos are under 1800px wide, which is fine for now).

## Personal details deliberately left off

At the client's request the site does not name the owner at all outside customer review quotes (which mention "Andy"), gives the base as Howick / East Auckland with no street address, has no NZBN in the footer and no embedded map pin. The contact page links to the Google Business Profile instead. Schema in `src/data/business.json` carries locality only. Add these back if the client wants them.

## Photos: all client-owned (update)

Every image slot now holds one of Living Colour's own job photos; no stock photos remain. ba6 (kitchen) and ba7 (1970s exterior) were supplied at low resolution (about 1000px), so they are used only in the small slider cards and should be replaced with full-size originals if the client has them.

## Forms now go through FormSubmit (not Netlify Forms)

Netlify charges for form email notifications, so both forms POST directly to `https://formsubmit.co/info@livingcolourltd.co.nz` (free, no account, photo attachments included). Hidden fields set the email subject, the redirect to `/thanks/`, a table layout and a honeypot (`_honey`). **First-time activation:** the first submission triggers an "Activate form" email to info@livingcolourltd.co.nz; the client must click it once, after which every submission is delivered. To hide the address from scrapers, FormSubmit gives a random alias after activation; swap it into both `action` attributes if wanted. Netlify form detection can be left on or off; it no longer matters.
