# Porirua Hardscapes — website rebuild

Client: **Porirua Hardscapes Ltd (Adam Martin, owner-operator)**, Whitby, Porirua 5024.
Concrete driveways and exposed aggregate, retaining walls, excavation and truck hire, decks and
fences, landscape construction and residential demolition across Porirua, Wellington City, the
Hutt Valley and the Kāpiti Coast.

This is an 11-page static rebuild of poriruahardscapes.co.nz. Plain HTML, one shared stylesheet
(`assets/css/site.css`) and one script (`assets/js/site.js`). The script injects the header,
footer and mobile call bar on every page, swaps the phone number for Nimbata, fades sections
in, runs the project filters and posts the enquiry forms. Nothing external is linked for
images. Every photo is a placeholder that turns into the real photo as soon as a file exists
at its path (see "Photo and logo drop-in" below).

Research behind the copy, pricing and FAQs is in the session's `market-brief.md` (competitors,
Wellington 2026 price ranges, MBIE / Porirua City Council consent rules, keywords).

## Pages

| Route | File | H1 | Target keywords |
|---|---|---|---|
| `/` | `index.html` | Driveways, retaining walls and earthworks, done properly. | concrete contractors porirua, concrete driveways wellington, retaining walls porirua, excavation contractors porirua |
| `/services/` | `services/index.html` | Concrete, retaining, excavation, decks, fences and demolition. One crew. | hard landscaping wellington, landscape construction wellington, concreters near me |
| `/services/concrete-driveways.html` | `services/concrete-driveways.html` | Concrete & exposed aggregate driveways in Porirua and Wellington | concrete driveway porirua, exposed aggregate driveway wellington, exposed aggregate porirua, driveway replacement wellington, concrete paths and patios porirua, vehicle crossing porirua |
| `/services/retaining-walls.html` | `services/retaining-walls.html` | Retaining wall builders in Wellington and Porirua | retaining wall builders wellington, retaining walls porirua, timber retaining wall cost nz, retaining wall consent 1.5m nz, crib wall wellington, retaining wall repair wellington |
| `/services/excavation-truck-hire.html` | `services/excavation-truck-hire.html` | Digger, excavator and truck hire with operator in Porirua | digger hire porirua, digger and operator hire wellington, site preparation wellington, section clearing porirua, truck hire with driver wellington, earthworks tawa |
| `/services/decks-fences.html` | `services/decks-fences.html` | Deck and fence builders in Porirua | deck builders porirua, fence builders porirua, deck cost per m2 wellington, do i need consent for a deck nz |
| `/services/landscaping.html` | `services/landscaping.html` | Landscape construction in Porirua and Wellington | landscaping porirua, landscape construction wellington, hard landscaping wellington, section makeover porirua |
| `/services/demolition.html` | `services/demolition.html` | Residential demolition in Porirua and Wellington | demolition porirua, garage demolition wellington, shed removal porirua, house demolition cost wellington |
| `/projects.html` | `projects.html` | Recent driveways, walls and earthworks across Wellington | concrete driveway porirua (gallery), exposed aggregate wellington, retaining walls porirua, suburb + service long tail |
| `/about.html` | `about.html` | Locally owned in Whitby. 36+ years in the trade. | porirua hardscapes, concrete contractors porirua, locally owned landscaper whitby |
| `/contact.html` | `contact.html` | Get a free on-site quote | concrete driveway cost per m2 wellington, timber retaining wall cost nz, house demolition cost wellington, digger hire porirua (pricing), consent FAQs |

`contact.html` carries the quote form (`#quote`), the full **pricing guide** (`#pricing`) and the
grouped **FAQs** (`#faq`), so the "Pricing guide" and "FAQs" links in the nav and footer go there.
It has LocalBusiness (`HomeAndConstructionBusiness`) and FAQPage JSON-LD. Service pages carry
Service and FAQPage JSON-LD.

`sitemap.xml` lists all 11 pages; `robots.txt` points to it and blocks `_from-old-site/`.

## Preview

```bash
cd clients/porirua-hardscapes
npx http-server -p 8080 -s .      # or: http-server -p 8080 -s .
# open http://127.0.0.1:8080/
```

Use a server, not `file://`, so the `../` paths on service pages and the form behave as live.
On `projects.html`, the filter buttons hide and show tiles by `data-cat` (a tile can carry two
categories, e.g. `data-cat="concrete demolition"`).

## Photo and logo drop-in

Every photo is a `.ph` placeholder: a stone-coloured box with a caption saying what should go
there. Save a JPG at the exact path below and it replaces the placeholder automatically (the
caption hides itself). Missing files are simply hidden, so the site never shows a broken image.
Aim for landscape JPGs around 1600 px wide, under 400 KB, unless noted. Logos are PNGs with a
transparent background, about 300×120.

Regenerate this list after any page change:

```bash
# every <img> on the site is a .ph / .lg placeholder
grep -rhoE '<img src="[^"]+"' --include='*.html' . | sed -E 's#<img src="(\.\./)?##; s#"$##' | sort -u
```

All paths are relative to the site root (service pages reference them with `../`).

**Shared / homepage (`index.html`, `services/index.html`)**

| Path | What should go there |
|---|---|
| `assets/img/og.jpg` | Social share image, 1200×630, best driveway shot with the logo (referenced in every page's `og:image`) |
| `assets/img/hero-driveway.jpg` | Home hero, portrait-ish crop: exposed aggregate driveway, Whitby |
| `assets/img/svc-concrete.jpg` | Service card: concrete driveway |
| `assets/img/svc-retaining.jpg` | Service card: retaining wall |
| `assets/img/svc-excavation.jpg` | Service card: digger and tip truck |
| `assets/img/svc-decks.jpg` | Service card: deck and fence |
| `assets/img/svc-landscaping.jpg` | Service card: finished landscaping |
| `assets/img/svc-demolition.jpg` | Service card: demolition / site clearance |
| `assets/img/adam.jpg` | Home "Why people call Adam": Adam on site, portrait 4:5 |
| `assets/img/crew-1.jpg` | Home: the crew working (square) |
| `assets/img/gear-1.jpg` | Home: our excavator and truck (square) |
| `assets/img/proj-1.jpg` | Home recent work tile 1: exposed aggregate driveway, Whitby |
| `assets/img/proj-2.jpg` | Home recent work tile 2: timber retaining wall, Tawa |
| `assets/img/proj-3.jpg` | Home recent work tile 3: driveway replacement, Island Bay |
| `assets/img/services-crew-on-site-hero.jpg` | Services hub hero: the crew on site |
| `assets/img/adam-on-site.jpg` | Services hub: Adam on site |
| `assets/img/crew-boxing-driveway.jpg` | Services hub: crew boxing a driveway |
| `assets/img/gear-digger-truck.jpg` | Services hub: digger and truck |

**Service pages (`services/*.html`)**

| Path | What should go there |
|---|---|
| `assets/img/concrete-driveway-exposed-aggregate-hero.jpg` | Concrete hero: exposed aggregate driveway, Porirua |
| `assets/img/concrete-exposed-aggregate-whitby.jpg` | Concrete gallery: exposed aggregate, Whitby |
| `assets/img/concrete-driveway-island-bay.jpg` | Concrete gallery: driveway replacement, Island Bay |
| `assets/img/concrete-patio-path-porirua.jpg` | Concrete gallery: patio and side path |
| `assets/img/retaining-wall-timber-hillside-hero.jpg` | Retaining hero: timber wall on a hillside |
| `assets/img/retaining-timber-tawa-1.jpg` | Retaining gallery: 1.4 m timber wall, Tawa |
| `assets/img/retaining-drainage-scoria.jpg` | Retaining gallery: drainage coil and scoria behind a wall (in-progress shot) |
| `assets/img/retaining-block-wall-whitby.jpg` | Retaining gallery: block wall |
| `assets/img/excavation-digger-tip-truck-hero.jpg` | Excavation hero: digger and tip truck |
| `assets/img/excavation-site-prep-slab.jpg` | Excavation gallery: site prep for a slab |
| `assets/img/excavation-drainage-trench.jpg` | Excavation gallery: drainage trench |
| `assets/img/excavation-tip-truck-cartage.jpg` | Excavation gallery: tip truck loaded / cartage |
| `assets/img/deck-timber-privacy-fence-hero.jpg` | Decks hero: timber deck and privacy fence |
| `assets/img/deck-pine-ground-level.jpg` | Decks gallery: ground-level pine deck |
| `assets/img/fence-boundary-paling.jpg` | Decks gallery: boundary paling fence |
| `assets/img/deck-hillside-balustrade.jpg` | Decks gallery: hillside deck with balustrade |
| `assets/img/landscaping-courtyard-garden-hero.jpg` | Landscaping hero: courtyard and garden beds |
| `assets/img/landscaping-courtyard-paving.jpg` | Landscaping gallery: paved courtyard |
| `assets/img/landscaping-lawn-garden-beds.jpg` | Landscaping gallery: lawn and garden beds |
| `assets/img/landscaping-section-makeover.jpg` | Landscaping gallery: full section make-over |
| `assets/img/demolition-garage-site-clearance-hero.jpg` | Demolition hero: garage demolition |
| `assets/img/demolition-garage-porirua.jpg` | Demolition gallery: garage coming down |
| `assets/img/demolition-slab-breakout.jpg` | Demolition gallery: old slab break-out |
| `assets/img/demolition-site-cleared.jpg` | Demolition gallery: cleared and levelled site |

**Projects (`projects.html`)** — the 12 tiles are **placeholder projects**. Replace each title,
suburb and spec line with a real job from Adam / Facebook, then drop its photo at the path
(rename the file to match the real job if you like, and update the `src`).

| Path | What should go there |
|---|---|
| `assets/img/projects/projects-hero.jpg` | Projects hero: the single best finished job, wide |
| `assets/img/projects/exposed-aggregate-driveway-whitby.jpg` | Big tile (concrete): exposed aggregate driveway |
| `assets/img/projects/timber-retaining-wall-tawa.jpg` | Tile (retaining): timber wall |
| `assets/img/projects/driveway-replacement-island-bay.jpg` | Tile (concrete): driveway replacement |
| `assets/img/projects/site-prep-churton-park.jpg` | Tile (excavation): site prep |
| `assets/img/projects/kwila-deck-plimmerton.jpg` | Tile (decks): hardwood deck |
| `assets/img/projects/courtyard-paving-paremata.jpg` | Tile (landscaping): courtyard paving |
| `assets/img/projects/garage-demolition-titahi-bay.jpg` | Tile (demolition): garage removal |
| `assets/img/projects/block-retaining-wall-johnsonville.jpg` | Tile (retaining): block / engineered wall |
| `assets/img/projects/coloured-patio-pauatahanui.jpg` | Tile (concrete): coloured patio and paths |
| `assets/img/projects/section-clearing-pukerua-bay.jpg` | Tile (excavation): section clearing |
| `assets/img/projects/boundary-fence-camborne.jpg` | Tile (fences): boundary fence |
| `assets/img/projects/section-makeover-upper-hutt.jpg` | Tile (landscaping): section make-over |
| `assets/img/projects/before-driveway-1.jpg` | Before/after pair 1, BEFORE: old cracked driveway |
| `assets/img/projects/after-driveway-1.jpg` | Before/after pair 1, AFTER: same angle, new driveway |
| `assets/img/projects/before-retaining-1.jpg` | Before/after pair 2, BEFORE: slumping bank |
| `assets/img/projects/after-retaining-1.jpg` | Before/after pair 2, AFTER: same angle, new wall |

**About (`about.html`)**

| Path | What should go there |
|---|---|
| `assets/img/about-crew-gear.jpg` | About hero: crew standing with the digger and truck |
| `assets/img/adam-portrait.jpg` | Story section: Adam, portrait 4:5 |
| `assets/img/team/adam.jpg` | Who's on site: Adam, square head-and-shoulders |
| `assets/img/team/crew-lead.jpg` | Who's on site: crew lead, square (name is a "Name" placeholder) |
| `assets/img/team/operator.jpg` | Who's on site: operator, square (name is a "Name" placeholder) |
| `assets/img/partners/partner-1.png` … `partner-6.png` | Supplier / partner logos (home shows 1–5, about shows 1–6) |
| `assets/img/sponsors/sponsor-1.png` … `sponsor-4.png` | Sponsored club / community group logos |

**Contact (`contact.html`)**

| Path | What should go there |
|---|---|
| `assets/img/contact-site-visit.jpg` | Contact hero: Adam measuring up on a quote visit |
| `assets/img/service-area-map.jpg` | Service area map. Better: replace the `<figure>` with a Google Maps `<iframe loading="lazy">` centred on Porirua (comment in the file marks the spot) |

## Real assets now in place (18 Oct 2026)

The old site (a Duda build) was crawled from a separate session once the environment allowed the domain. Everything
it had is in `assets/img/_from-old-site/` (78 originals + `manifest.tsv` + the saved page HTML) and
`OLD-SITE-INVENTORY.md` (every page's text verbatim, five reviews, partner list, proposed mapping).

What was placed:
- Real logo (`assets/img/logo.png`, dark-background variant `logo-dark.png`) in the header, footer and mobile menu.
  Brand yellow `#FCB912` sampled from the logo is now the site accent.
- 59 photo slots filled from the old gallery and service pages (cropped to each slot's ratio, max 1600 px, JPEG q82).
- Six partner logos from the old "Our Partners" page: AM Hire, RGS Reeve Gunite Services, TOA ITM, OTS, HireWays,
  ZWB Zane White Business is shown as a text label (the old site only had a business-card screenshot; ask for a proper logo file, then add it as partners/partner-6.png).
- All five reviews verbatim (John MacKay, Gill & Terry, Keith Nicol, Joel Johnson, Laura Jefferies).
- Project tiles retitled to describe what is actually in each photo. The old gallery had **no captions or suburbs**,
  so suburb names were removed rather than invented.

Still placeholders (grey tiles): `adam.jpg`-style slots now show the crew (no photo of Adam exists on the old
site), `team/*.jpg`, `retaining-block-wall-whitby.jpg`, `deck-hillside-balustrade.jpg`, `service-area-map.jpg`.
The old site has **no sponsors**, so the sponsorship section was removed from about.html.
The old site also has a Partners page at `/hardscaping-services-wellington`; 301 it to `/about.html`.
Facebook: the page is `facebook.com/p/Porirua-Hardscapes-61576109378291/` (668 followers); nothing on it is
reachable without a login. Update `SITE.facebook` in `assets/js/site.js` to that URL before launch.

## Google Business Profile (checked 18 Oct 2026)

Adam already has a profile: "Porirua Hardscapes · Concrete contractor", **4.0 from 4 Google reviews**, phone
+64 27 244 4501, hours showing "Closes 6 pm", areas served "Porirua and nearby areas". The site's hours were
changed to 7am–6pm to match it; confirm the opening time with Adam and keep the two identical.

Launch-day steps on the profile: point the Website button at the new domain, upload 10–20 of the job photos from
`assets/img/_from-old-site/`, set the service area to the suburbs on the About page, and copy the "Get more reviews"
link into `projects.html` (the "Review on Google" button still has `href="#"`). Then send that link to the five
reviewers already on the site. Sitelinks under the brand result are generated by Google from site structure
(distinct titles, breadcrumbs, sitemap, internal links, which this build has); they refresh after re-indexing.

## Blocked in this session (superseded, kept for the record)

The build environment's network policy **denied poriruahardscapes.co.nz,
poriruahardscapes.com and facebook.com**. So none of the following could be pulled, and the site
ships with placeholders for them:

- photos of real jobs, Adam, the crew and the gear
- partner / supplier logos and sponsor logos
- verbatim testimonial wording (the three reviews on the site come from search-engine snippets
  of the old site and are marked in an HTML comment)
- anything from the Facebook page (job photos, reviews, sponsorship posts)

`fetch-assets.sh` does the pull on any machine with normal internet:

```bash
cd clients/porirua-hardscapes && bash fetch-assets.sh
```

It downloads the old site's pages (both domains) into `assets/img/_from-old-site/_pages/`,
greps out every image URL (`img src`, `data-src`, `srcset`, `og:image`, CSS `background-image`,
Wix `static.wixstatic.com` and Squarespace CDN patterns, original sizes), downloads them into
`assets/img/_from-old-site/` and prints a manifest (`manifest.tsv`: file, size, dimensions, page,
source URL). Then rename the good ones into the paths above. Don't publish `_from-old-site/`.

**Exactly what to pull from the old site:**

1. Home page: hero photo, every gallery / project photo, the logo (SVG or large PNG), and the
   full text of all testimonials (copy verbatim into `index.html`, `projects.html` and any
   service page that quotes one; fix "tradesman" / "tradesmen" to match the original).
2. `/concrete-services-wellington`: driveway, exposed aggregate, patio and slab photos.
3. `/retaining-wall-construction-wellington`: wall photos, especially in-progress drainage shots.
4. `/excavator-hire-services-wellington`: digger and truck photos (and note the gmail address on
   this page; see email below).
5. `/construction-demolition-services-wellington`: demolition photos.
6. `/fencing-services-wellington` and `/landscaping-services-wellington`: fence, deck and
   landscaping photos.
7. `/new-landscaping-projects-wellington`: project photos with suburbs (feed `projects.html`).
8. Any supplier, partner, association or sponsor logos and names anywhere on the site or footer.
9. Facebook (manually, logged in): recent job photos with suburbs, before/after pairs, reviews and
   recommendations (with permission to quote first name + suburb), and any club sponsorship posts.
10. The old site mentions **arborist services**. There is no page for it in the rebuild; ask Adam
    whether to add one or drop it.

## Confirm with Adam before launch

- [ ] **"36+ years in the trade"**: worded as Adam's / the team's experience, never "company founded
      36 years ago" (the company was incorporated 1 March 2026). Confirm the number.
- [ ] **Address**: the site publishes only "Whitby, Porirua 5024". The registered office is a street
      address that may be his home. Only add it to the JSON-LD and Google Business Profile if he wants it.
- [ ] **Email**: the site uses adam@poriruahardscapes.co.nz only. The old excavation page shows
      hardscapesporirua@gmail.com. Confirm the .co.nz address is monitored.
- [ ] **Hours**: "7 days · 7am – 7pm" (site.js `SITE.hours`, JSON-LD `openingHours`).
- [ ] **Insurance**: the about-page FAQ answer "Yes — ask for our certificate of currency" is a
      placeholder in an HTML comment flagged CONFIRM WITH ADAM. Remove the question if he can't supply one.
- [ ] **Google review link**: `projects.html` "Review on Google" is `href="#"`. Set up / claim the
      Google Business Profile and paste its review link (`https://g.page/r/…/review`).
- [ ] **Facebook handle**: `https://www.facebook.com/p/Porirua-Hardscapes-61576109378291/` is assumed (site.js
      `SITE.facebook` and the projects page). Confirm the real URL. Add Instagram to `SITE.instagram` if he has one.
- [ ] **Sponsorships**: about page has 4 sponsor slots and "[Clubs we support]". Fill or remove the section.
- [ ] **Suppliers / partners**: 6 logo slots. Fill or delete empty ones.
- [ ] **Crew names and photos**: "Name" placeholders on the about page. Check permission to show staff.
- [ ] **Verbatim reviews**: replace the three snippet-sourced testimonials with the exact wording.
- [ ] **Project gallery**: 12 tiles on `projects.html` are generic placeholder projects (marked in an
      HTML comment). Replace every one with a real job before launch. Never publish invented jobs.
- [ ] **Pricing figures**: every range on `contact.html#pricing` and the home teaser is an aggregator
      figure from the 2026 market brief, not Adam's rate card. Confirm each one, and the GST basis
      (some sources quote +GST; the site says "GST incl."). The cleanfill figure is Southern Landfill's
      domestic rate; swap for the tip he actually uses if different.
- [ ] **Commercial work**: the about FAQ and homepage say we do commercial / light civil. Confirm scope.
- [ ] **BuildHub "featured in"**: links to buildhub.co.nz/guides/best-concrete-contractors-wellington. Check it still lists PH.
- [ ] **Domains**: pick `www.poriruahardscapes.co.nz` as canonical (already set in every `<link rel="canonical">`)
      and **301 `poriruahardscapes.com/*` → `https://www.poriruahardscapes.co.nz/*`** to stop duplicate content.
- [ ] **301 map of old slugs → new files** (set on the host, both domains):

| Old URL | New URL |
|---|---|
| `/concrete-services-wellington` | `/services/concrete-driveways.html` |
| `/retaining-wall-construction-wellington` | `/services/retaining-walls.html` |
| `/excavator-hire-services-wellington` | `/services/excavation-truck-hire.html` |
| `/fencing-services-wellington` | `/services/decks-fences.html` |
| `/landscaping-services-wellington` | `/services/landscaping.html` |
| `/construction-demolition-services-wellington` | `/services/demolition.html` |
| `/new-landscaping-projects-wellington` | `/projects.html` |
| `/landscaping-and-construction-quotes` | `/contact.html` |
| any other old path | `/` |

## Phone tracking (Nimbata)

- Phone **027 244 4501** (Adam's mobile) is the number the Nimbata project must be set to
  **replace**. It's written as `<span class="nb-phone">027 244 4501</span>` inside every `tel:` link,
  and site.js keeps a hidden `#nb-source` span. When Nimbata rewrites `#nb-source`, site.js mirrors the
  tracking number into every `.nb-phone` and every `tel:` href.
- Create the Nimbata project for Porirua Hardscapes with 027 244 4501 as the source number and add
  its DNI script to every page's `<head>` (or the Lovable root layout) before launch.

## Enquiry form

- Forms are `<form class="enquiry">` (the full form is `contact.html#quote`). site.js posts JSON to
  `SITE.endpoint` = **`/api/public/enquiry`**, adding `source`, `page` and `ts`. Fields: `name`,
  `phone`, `email`, `suburb`, `service[]` (multi), `timeframe`, `message`. A hidden honeypot `website`
  field drops bot submissions.
- If the endpoint fails (e.g. static preview with no backend), the form falls back to opening a
  pre-filled `mailto:adam@poriruahardscapes.co.nz`, so no lead is lost in testing.
- Same pattern as Tauranga / Northland: the Lovable build's `/api/public/enquiry` route emails the
  enquiry to hello@leadhivenz.com via Resend. Add adam@poriruahardscapes.co.nz as a second recipient if
  leads should reach him directly. `RESEND_API_KEY` must be set in Project Settings → Secrets (a 503 from
  the form means it's missing); without `RESEND_FROM_EMAIL` the sender falls back to onboarding@resend.dev.

## Lovable

Not yet created. When porting:

- Remix from an existing LeadHive client project with the same SitePage + site-config structure, and
  keep this site's markup and `site.css` as the source of truth (port page by page; the header/footer
  in `site.js` becomes the root layout).
- Routes: `/`, `/services`, `/services/concrete-driveways`, `/services/retaining-walls`,
  `/services/excavation-truck-hire`, `/services/decks-fences`, `/services/landscaping`,
  `/services/demolition`, `/projects`, `/about`, `/contact`. If the routes drop `.html`, update the
  canonicals, `sitemap.xml` and the 301 map above to match.
- `form.endpoint` = `/api/public/enquiry`. Root layout keeps the Nimbata DNI script; `#nb-source`
  carries 027 244 4501.
- Upload the photos/logos into the project's public `assets/img/` with the same paths.

## Launch checklist

1. Work through "Confirm with Adam" and replace every placeholder project, name and logo slot.
2. Run `fetch-assets.sh`, drop the photos into their paths. A branded `og.jpg` is already in place; swap it for a real driveway shot when you have one.
3. Publish, attach `www.poriruahardscapes.co.nz`, set the .com → .co.nz and old-slug 301s.
4. Create the Nimbata project (027 244 4501 as the number to replace) and confirm the swap live.
5. Send a test enquiry and confirm it lands at hello@leadhivenz.com (and Adam, if added).
6. Submit `sitemap.xml` in Google Search Console; set up the Google Business Profile, paste its
   review link into `projects.html`, and email it to past clients.
