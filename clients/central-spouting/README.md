# Central Spouting Ltd — website

Client: **Central Spouting Ltd** (Dylan), Whanganui. Spouting, fascia and downpipes across Whanganui,
Manawatū, Rangitīkei and South Taranaki. Built 14 Oct 2026 as a multi-page static site, ready for Netlify.

Deal: $500 setup + $20/month hosting retainer (Stripe link still to be created, see below).

```
site/                         the deployable site (drag this folder, or the zip, into Netlify)
central-spouting-site.zip     same thing zipped, minus internal build files
screens/                      full-page screenshots of every page at 390px and 1440px
```

## Pages (18 routes)

| Route | Page |
|---|---|
| `/` | Home: hero, trust strip, services, why Dylan, colour picker + profiles, process, areas map, gallery teaser, FAQ |
| `/services/` | Services overview + "which service do I need" symptom list |
| `/services/spouting-replacement/` | The money page: signs, step-by-step, materials, profiles, price factors, before/after, FAQ |
| `/services/new-spouting-fascia/` | New builds, extensions, re-roofs, rural sheds |
| `/services/fascia/` | Fascia repair/replacement, internal-gutter-to-external conversion |
| `/services/downpipes/` | Downpipes, rainwater heads, tank connections |
| `/services/spouting-repairs/` | Repairs, repair-vs-replace, storm damage, insurer reports |
| `/services/gutter-cleaning/` | Cleaning and leaf guard (honest about guards) |
| `/about/` | Dylan, how we work, values, products, "reviews coming soon" |
| `/gallery/` | 12 photo slots (07–12 auto-hide until photos exist), 2 before/after sliders |
| `/areas/` + `/areas/{whanganui,palmerston-north,manawatu,rangitikei,south-taranaki}/` | Unique local pages |
| `/contact/` | Netlify quote form (`#quote`), call card, map, FAQ |
| `/privacy/`, `/thanks/`, `404` | |

Preview locally: `cd site && python3 -m http.server 8000` then open http://localhost:8000/ (links are root-relative,
so double-clicking the file won't work).

## Deploy to Netlify (drag and drop)

1. app.netlify.com → Add new site → Deploy manually → drop `central-spouting-site.zip` (or the `site/` folder).
2. Site settings → Forms: enable form detection (it's on by default for drag-and-drop). The form is named `quote`.
3. Forms → Form notifications → add email notification to Dylan's address (and hello@leadhivenz.com).
   Submissions include an optional photo upload.
4. Domain: when confirmed, find/replace `https://centralspouting.co.nz` in every HTML file plus `sitemap.xml` and
   `robots.txt` (18 pages; one `sed` does it), then re-upload.
5. Headers, caching, 404 and vanity redirects (`/quote`, `/facebook`, `/spouting`, town names) are in `netlify.toml`
   and `_redirects` and need nothing from you.

## Photos (the one thing missing)

No photos could be pulled from Facebook: facebook.com and fbcdn.net are blocked in the build environment.
Every photo slot shows a designed blueprint-style placeholder until a file with the right name is dropped into
`site/images/` (see `site/images/README.md` for the exact filenames and sizes). No HTML change is needed; the photo
fades in automatically. After adding photos, update the `alt` text and the gallery captions (currently placeholder
"service · town" labels) to describe the real jobs.

Minimum set to make the site sing: `hero.jpg`, `about-dylan.jpg`, `gallery/01–06.jpg`, one before/after pair.

## CONFIRM with Dylan before launch

Nothing on the site is fabricated: no reviews, star ratings, job counts or years in business. Everything below is a
reasonable assumption that needs a yes from Dylan. Each one is also marked `<!-- CONFIRM -->` in the HTML.

**Contact details**
- Phone **020 470 9967** everywhere (your brief). Facebook and the Whāriki directory list **027 768 8464**. Confirm which is current and make the Facebook page match.
- Email office@centralspouting.co.nz (from the public directory listing).
- Hours Mon–Fri 7:30am–5pm (placeholder; footer, contact card, JSON-LD).
- Domain centralspouting.co.nz (placeholder; nothing resolves there yet).
- Facebook URL https://www.facebook.com/profile.php?id=61571118375658.

**Claims on the site**
- "Backed by our workmanship guarantee" (no term stated). Set the term or remove.
- "Fully insured".
- Continuous / longrun spouting "available" (supplied and fitted; the site never claims on-site roll-forming).
- "We can often quote from photos"; "fixed-price written quote"; "most single-storey homes are done in a day".
- Prices new builds from plans or a roof layout.
- Can supply a written report and quote for insurance claims.
- Small repairs done on the first visit where he has the parts.
- Fits snow straps / snow guards (Taihape copy).
- Rural sheds, tank connections and first-flush diverters are in scope.
- Leaf guard: which product/brand he installs.
- Rainwater heads: materials and finishes he supplies.
- Products: COLORSTEEL®, ColorCote®, Marley (Stormcloud / Typhoon named as examples). Confirm current suppliers.
- Colour picker: 8 verified COLORSTEEL colours + 6 commonly listed ones (Gull Grey, Thunder Grey, Mist Green,
  Permanent Green, Pioneer Red, Scoria, marked `data-confirm`). Delete any he can't supply.

**Travel and areas**
- Whanganui home base; Manawatū, Rangitīkei and South Taranaki regularly; New Plymouth for larger jobs only.
  Confirm travel limits and any minimum job size (Palmerston North "about an hour", New Plymouth "about 2.5 hours").
- Local colour on area pages (suburb housing ages, Castlecliff / Foxton Beach / Pātea corrosion zones, Manawatū wind)
  is general knowledge, not sourced. Dylan to sanity-check.

**About / privacy**
- Biographical lines on `/about/` (why he started, that he answers the phone, quotes and installs personally).
- Dylan is the privacy officer; no analytics or pixels installed; how long form submissions are kept.

## Stripe (not done yet)

The Stripe connector was not authorised in the build session, so the payment link does not exist yet. Spec:
- Product 1: "Website setup — Central Spouting" one-off **NZ$500**.
- Product 2: "Website hosting & care" recurring **NZ$20 / month**.
- One Payment Link with both line items (one-off + subscription), customer collects name, email, business name.

## Build notes

- Pure HTML/CSS/JS, no build step, no CDN scripts. Google Fonts (Source Serif 4 + Inter) via `<link>`.
  Fraunces was dropped because its Google Fonts build breaks macron vowels (Manawatū, Rangitīkei, Hāwera, Pātea).
- Accent: brass `#C8A24A` on ironsand `#121416` / paper `#F6F4EF`. All text pairs meet WCAG AA.
- Design rules, components and the page skeleton: `site/CONVENTIONS.md`, `site/PAGE-TEMPLATE.html`,
  `site/COMPONENTS.html` (internal; `_redirects` 404s them on Netlify and they are left out of the zip).
- JSON-LD on every page (LocalBusiness + Breadcrumb + Service/FAQPage where relevant). No `aggregateRating`
  until real reviews exist.
- Strict CSP in `netlify.toml`: no inline scripts. If you add analytics later, add its host to `script-src`/`connect-src`.
