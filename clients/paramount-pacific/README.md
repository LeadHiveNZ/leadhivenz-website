# Paramount Pacific: website

Client: **Paramount Pacific Property Development Ltd** (brand on site: **Paramount Pacific**).
Owner: Uele (Willie) Tasmania. Auckland building company, 20+ years, new builds and renovations.
Specialties: major renovations, concreting, fencing.

A premium multi-page brochure site. Static HTML/CSS/JS: no framework, no build step, no libraries.
It opens straight from the file system and works on any static host, including in a sub-folder,
because every path is relative.

## Preview

- Open `index.html` in a browser (double-click works; `file://` is fine).
- Or serve the folder: `cd clients/paramount-pacific && python3 -m http.server 8000`, then open http://localhost:8000
- Check at 375, 768, 1280 and 1600 px wide.

## File map

```
index.html                      Home
about.html                      About / Willie and the team                 (phase 2)
services.html                   Services overview, links to the 8 pages     (phase 2)
services/
  renovations.html              Major renovations: THE PATTERN for every service page
  residential-building.html     (phase 2)
  concrete.html                 (phase 2)
  fencing-gates.html            (phase 2)
  foundations.html              (phase 2)
  roofing.html                  (phase 2)
  plumbing-drainlaying.html     (phase 2) Plumbing + Drainlaying on one page
  paving-driveways.html         (phase 2)
projects.html                   Recent work gallery                         (phase 2)
areas.html                      9 service areas                             (phase 2)
contact.html                    Contact + quote form                        (phase 2)
assets/css/site.css             The ONE stylesheet. Design tokens at the top, sections numbered 01–24
assets/js/config.js             window.PP_CONFIG: the ONE file to edit for business details
assets/js/site.js               Config fill, header, mobile nav, reveal, current page, quote form
assets/img/logo-placeholder.svg        Monogram "PP", amber tile (header)
assets/img/logo-placeholder-light.svg  Monogram, off-white outline (dark footer)
assets/img/favicon.svg                 Favicon (amber PP on charcoal)
assets/img/motif.svg                   Abstract Pacific geometric tile (used by CSS)
assets/img/og-image.png                1200x630 social share image (brand placeholder)
_partials/                      Canonical markup to copy into new pages (not linked from the site)
  head.html                     <head> boilerplate + page skeleton
  header.html / footer.html     For top-level pages
  header.services.html / footer.services.html   For pages inside services/
  quote-form.html               The quote form (contact page)
```

### Path rules
- Top-level pages: `assets/...`, `index.html`, `about.html`, `services/<key>.html`.
- Pages in `services/`: `../assets/...`, `../index.html`, `../about.html`, siblings as `./<key>.html`.
- Never use a leading `/`.

## Placeholders: what to swap when the client sends real details

### 1. Business details: `assets/js/config.js` (one file)
| Key | Placeholder | Notes |
|---|---|---|
| `phone` | `021 000 0000` | `phoneHref` (tel:+64…) is derived automatically |
| `email` | `info@paramountpacific.co.nz` | |
| `address` | `Auckland, New Zealand` | |
| `hours` | `Mon–Fri 7am–5pm, Sat by appointment` | |
| `social.facebook` / `social.instagram` | blank | blank hides the footer icons |
| `logoUrl` / `logoLightUrl` | blank | blank shows the PP monogram |
| `formEndpoint` | blank | blank makes the quote form open a pre-filled email instead (mailto) |
| `siteUrl` | `https://paramountpacific.co.nz` | domain not confirmed |

These values are ALSO hard-coded in a few places that JavaScript can't (or shouldn't) fill.
Update them too:
- The **JSON-LD** blocks in `index.html` and `contact.html` (telephone `+64210000000`, email, address, url).
- `canonical` / `og:url` / `og:image` on every page (domain).
- The literal fallback text inside `[data-config]` elements (search for `021 000 0000`). Only seen without JS.

### 2. Logo
Put the real file in `assets/img/` and set `logoUrl: "assets/img/logo.svg"` (site-root relative;
`site.js` adds `../` on service pages). The wordmark text hides automatically when a logo is set.
Add `logoLightUrl` if a reversed version exists for the dark footer.
Then update the favicon and `og-image.png`.

### 3. Photos: `.ph` placeholders
Every photo slot is a designed placeholder with a `data-photo` key and a corner label naming the
intended shot. To go live, drop an `<img>` inside the element and remove `aria-hidden="true"`:
```html
<figure class="ph ph-4x3" data-photo="reno-kitchen">
  <img src="../assets/img/photos/reno-kitchen.jpg" alt="Renovated kitchen with central island, Howick" loading="lazy">
</figure>
```
The aspect ratio is locked by the class. The image covers the box, and the placeholder art and label
hide automatically. Delete the `<span class="ph-label">` too. Suggested size: 1600px on the long edge, WebP or JPG.

| data-photo key | Page | Intended shot | Ratio |
|---|---|---|---|
| `home-hero` | index | Finished new build exterior at dusk (full-bleed hero, text sits bottom-left) | cover (16:9-ish) |
| `home-why-willie` | index | Willie on site with the crew | 3:4 (4:3 below 900px) |
| `home-spec-renovations` | index | Kitchen renovation | 4:3 |
| `home-spec-concrete` | index | Exposed aggregate driveway | 4:3 |
| `home-spec-fencing` | index | Slat fence and gate | 4:3 |
| `home-project-1` | index | Open-plan renovation, Manukau | large tile |
| `home-project-2` | index | Exposed aggregate driveway, Papakura | tile |
| `home-project-3` | index | Cedar fence + automatic gate, North Shore | tile |
| `reno-hero` | services/renovations | Renovated open-plan living (hero backdrop) | cover |
| `reno-kitchen` | services/renovations | Kitchen renovation, Howick | 4:3 |
| `reno-extension` | services/renovations | Living extension, North Shore | 4:3 |
| `res-hero` | services/residential-building | New build exterior, North Shore (hero backdrop) | cover |
| `res-new-build` | services/residential-building | Completed new home, Papakura | 4:3 |
| `res-minor-dwelling` | services/residential-building | Minor dwelling, Rodney | 4:3 |
| `hero-concrete` | services/concrete | Exposed aggregate driveway, Papakura (hero backdrop) | cover |
| `concrete-driveway-exposed` | services/concrete | Exposed aggregate driveway, Papakura | 4:3 |
| `concrete-slab-pour` | services/concrete | Garage slab pour in progress, Manukau | 4:3 |
| `hero-fencing` | services/fencing-gates | Horizontal slat fence and gate, North Shore (hero backdrop) | cover |
| `fencing-slat-gate` | services/fencing-gates | Cedar slat fence and pedestrian gate, North Shore | 4:3 |
| `fencing-aluminium-auto-gate` | services/fencing-gates | Aluminium fence with automatic sliding gate, Manukau | 4:3 |
| `hero-foundations` | services/foundations | Slab formwork and reinforcing, Franklin (hero backdrop) | cover |
| `foundations-slab-formwork` | services/foundations | Slab formwork, mesh and edge beams ready for inspection, Franklin | 4:3 |
| `foundations-repile` | services/foundations | Re-piling an older home, Waitakere | 4:3 |
| `hero-roofing` | services/roofing | Long-run steel roof on a new build (hero backdrop) | cover |
| `roofing-longrun-install` | services/roofing | Long-run steel install, West Auckland | 4:3 |
| `roofing-gutters` | services/roofing | Spouting and downpipes, North Shore | 4:3 |
| `hero-plumbing-drainlaying` | services/plumbing-drainlaying | Drainlaying in progress on a new build (hero backdrop) | cover |
| `plumbing-drain-install` | services/plumbing-drainlaying | New stormwater drain, Manukau | 4:3 |
| `plumbing-bathroom-rough-in` | services/plumbing-drainlaying | Bathroom pipework before lining, North Shore | 4:3 |
| `hero-paving-driveways` | services/paving-driveways | Exposed aggregate driveway to a new home (hero backdrop) | cover |
| `paving-exposed-aggregate` | services/paving-driveways | Exposed aggregate driveway, Papakura | 4:3 |
| `paving-patio-pavers` | services/paving-driveways | Paved patio and path, North Shore | 4:3 |
| `about-hero` | about | Willie and the crew on site (hero backdrop) | cover |
| `portrait-willie` | about | Portrait of Willie Tasmania, on site or in front of a finished job | 3:4 (4:3 below 900px) |
| `team` | about | The Paramount Pacific team together (no names needed) | 4:3 |
| `services-hero` | services | Framing crew on a new build (hero backdrop) | cover |
| `projects-hero` | projects | Finished renovation, street view (hero backdrop) | cover |
| `project-1` | projects | Kitchen & living renovation, Papakura (renovations) | 4:3 (16:9 at 640–899px) |
| `project-2` | projects | Four-bedroom family home, Pukekohe (new builds) | 4:3 |
| `project-3` | projects | Exposed aggregate driveway, Howick (concrete) | 4:3 |
| `project-4` | projects | Cedar slat fence & sliding gate, Takapuna (fencing) | 4:3 |
| `project-5` | projects | Bathroom rebuild, Henderson (renovations) | 4:3 |
| `project-6` | projects | Retaining wall & steps, Titirangi (concrete) | 4:3 |
| `project-7` | projects | Two-bedroom minor dwelling, Manurewa (new builds) | 4:3 |
| `project-8` | projects | Aluminium pool fence & gate, Orewa (fencing) | 4:3 |
| `project-9` | projects | Re-roof & new spouting, Waiheke Island (other) | 4:3 |
| `areas-hero` | areas | Hauraki Gulf coastline (hero backdrop) | cover |
| `contact-hero` | contact | Willie on site at a quote visit (hero backdrop) | cover |
<!-- Phase 2 agents: append your pages' data-photo keys to this table. -->

Project captions on the home teaser (suburbs, job types) are illustrative. Replace them with real jobs.

### 4. Reviews
The three home-page testimonials are **placeholders** (marked `<!-- PLACEHOLDER REVIEW -->` in the HTML).
Replace them with verbatim reviews, using the client's permission and their preferred attribution (e.g. first name + suburb).

### 5. Stats
- "20+ years" is real (client's own words).
- The home page uses no other numbers. "8 trades" and "9 areas" come straight from the client's own lists.
- Any other figure added later (projects completed, etc.) must carry `<!-- PLACEHOLDER STAT: confirm with Willie -->` and be listed here.

## Do NOT claim until confirmed with Willie
The site deliberately avoids these claims. Where one would naturally sit, it uses neutral wording
("experienced, professional team"). Add them only once they're confirmed in writing:
- Licensed Building Practitioner (LBP) status, and which licence class
- Master Builders / Certified Builders membership, or any Master Build guarantee
- Public liability or contract works insurance
- Any guarantee or warranty period (e.g. "10-year warranty")
- **Plumbing & drainlaying:** whether this is done by in-house registered/certifying plumbers and
  drainlayers or by licensed subcontractors. Copy currently says the work is coordinated with the build.
  Don't claim registration.
- Response-time promises (the form success message says "in touch soon", not a specific time)
- Real project counts, client numbers, years in business beyond "20+"
- **Free site visit:** the renovations/concrete FAQ blocks and the contact page say the first visit
  and quote carry "no charge". Free *quotes* are safe; confirm Willie is happy to also do a free
  on-site measure-up, or soften to "free written quote" only.
- **Business name spelling:** the client's own blurb reads "Paramount Pacifix" and the brief read
  "Paramount Pacifics". The site uses **Paramount Pacific** / Paramount Pacific Property Development
  Ltd. Confirm the registered name (check the Companies Office) and, if different, search-and-replace
  `Paramount Pacific` across the site plus `brand`/`legalName` in `assets/js/config.js`.

## Components cheat sheet (see comments in site.css)
- Bands: `band-paper` | `band-sand` | `band-ink` | `band-teal` (+ `has-motif` on dark bands). Each section uses one.
- Section spacing: `section`, `section-sm`, `section-lg`. Container: `container`, `container-narrow`.
- Heads: `section-head` (+ `split-head` or `text-center`) > `eyebrow` + `h2` + `lede`.
- Buttons: `btn` + `btn-accent` / `btn-ghost` / `btn-dark`, sizes `btn-sm` / `btn-lg`. Text link: `link-arrow`.
- Hero: `hero` (home) / `hero hero-page` (inner pages, with `breadcrumb`). The first child `.ph` is the backdrop.
- Photo: `ph` + `ph-hero|ph-square|ph-4x3|ph-3x4|ph-16x9` (+ `ph-warm|ph-teal`), `ph-label`, `ph-caption`.
- Cards and lists: `service-grid` (+`cols-3`) > `service-card`; `feature-list`; `feature-grid`; `check-list` (+`cols-2`);
  `steps` > `step`; `specialty-grid` > `specialty`; `project-grid` (+`even`) > `project-tile` (+`tile-lg`);
  `testimonial-grid` > `testimonial`; `area-list`; `areas-grid` > `area-card`; `chips` > `chip`;
  `faq` > `details`; `photo-pair`; `split`; `media-stack` + `media-badge`; `pull-quote`; `stat-row` > `stat`.
- Forms: `form-card` > `form[data-pp-form]` (see `_partials/quote-form.html`); `contact-list`.
- CTA: `cta-band band-teal has-motif` > `container cta-inner`.
- Motion: add `reveal` (optional `d1`–`d3` delays) to blocks below the fold. Never in the hero.
- Config hooks: `data-config="phone|email|hours|address|legalName|brand|owner"`,
  `data-config-href="phone|email|social.facebook|social.instagram"`, `data-year`,
  `select[data-config-options="services"]`, `[data-nav-link]`.

## Lovable port notes
- Each HTML file becomes a route: `/`, `/about`, `/services`, `/services/:key` (one `ServicePage` template
  fed from the services data; `renovations.html` is the reference layout), `/projects`, `/areas`, `/contact`.
- `site.css` becomes the global stylesheet (or `index.css`). The `:root` tokens map 1:1 to CSS variables or a Tailwind theme.
  Keep the band custom-property pattern.
- `PP_CONFIG` becomes `src/site-config.ts` (same shape). Replace the `data-config` runtime fill with direct imports.
- `_partials/header*.html` / `footer*.html` become `<SiteHeader/>` / `<SiteFooter/>`. Use router links and drop the path variants.
- `site.js` behaviours turn into small hooks: header scroll class, mobile nav state, IntersectionObserver reveal.
  The form posts to the Lovable enquiry endpoint instead of `formEndpoint` / mailto.
- `.ph` placeholders become an `<Img>` component that renders the placeholder when `src` is empty.

### Service pages, batch A: placeholder notes
Photo slots on `residential-building`, `concrete`, `fencing-gates` and `foundations` each carry a
`<!-- PLACEHOLDER PHOTO: key -->` comment above the `.ph` element. Their keys are in the table above.
Photo captions (suburbs, job details) are illustrative; replace them with real jobs.
Copy deliberately avoids: LBP / Master Builders / insurance / warranty claims, and any claim that plumbing
or drainlaying is done in-house (the residential-building page says it is "coordinated on the same programme").
Fence height (2 m), vehicle crossing approval (Auckland Transport) and minor dwelling rules are worded
generally ("in most cases", "we'll confirm for your site"). Confirm with Willie before making them firmer.

### Service pages, batch B: placeholder notes
`roofing`, `plumbing-drainlaying` and `paving-driveways` carry a `<!-- PLACEHOLDER PHOTO: key -->` comment above
every `.ph` element (keys in the table above). Photo captions and suburbs are illustrative.
- **Plumbing & drainlaying:** copy says only that the work is "carried out by appropriately certified tradespeople".
  No registration, in-house or subcontractor claim. CCTV inspection is "can arrange", not claimed equipment.
  Emergency unblocking is declined (build and renovation focus; repairs by arrangement). Confirm with Willie.
- **Paving & driveways:** vehicle crossings are worded as "needs approval from Auckland Transport, we work through
  the application with you". Confirm with Willie before making it firmer.
- **Roofing:** no material brands, pitch limits, timeframes in days or warranty claims. "Days rather than weeks" for a
  typical re-roof and driveway are general; confirm with Willie.

### Top-level pages (about, services, projects, areas, contact): placeholder notes
- **Projects (`projects.html`)**: all 9 tiles are placeholders, each marked `<!-- PLACEHOLDER PROJECT -->`. The job types,
  suburbs and one-line notes are illustrative. Replace each tile with a real job (photo, title, suburb, note) and keep its
  `data-cat` (`renovations` | `new-builds` | `concrete` | `fencing` | `other`) so the filter works. Then update the count
  in each filter button (`<span class="count">`) and the "Showing all 9 projects" text. The filter is a small inline
  script at the bottom of `projects.html`.
- **Reviews**: `projects.html` repeats the three home-page testimonials, so each carries `<!-- PLACEHOLDER REVIEW -->`. Replace them in both files.
- **Stats (`about.html`)**: no PLACEHOLDER STAT was needed. The band shows "20+ years" (client's own figure), "8" services and
  "9" areas (counts of the client's own lists) and "Free" quotes.
- **About copy**: Willie's story is the client's own text, polished, in first person ("Hi, I'm Willie"). Have Willie read it before launch.
  The team section says the crew are "builders, concreters and fencers who have worked alongside each other for years"
  (from the brief, no names). Confirm that's accurate.
- **Services overview**: the "One team" band says the foundations, concrete, framing, roofing, fencing and paving are done by
  the team and that plumbing and drainlaying is *scheduled into the same programme* (deliberately not claiming in-house
  registered plumbers or drainlayers; see the do-not-claim list).
- **Areas**: the place names shown as chips under each area are examples of suburbs and towns within it, not a list of past jobs.
- **Contact**: the GeneralContractor JSON-LD is a copy of the one in `index.html`. Update both when real details arrive.
- **CSS added for these pages** (section 25 at the end of `site.css`, additive only): `.stat-row.cols-4`, chips inside
  `.service-card` / `.area-card`, `.areas-grid.with-chips`, `.filter-bar` / `.filter-btn`, `.hero-page.hero-compact`,
  `.contact-layout` / `.contact-aside` / `.form-card-head`, `.steps.steps-vertical`.
