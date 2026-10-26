# Straight Line Landscaping — website preview

Prospect: **Matt, owner of Straight Line Landscaping**, Tauranga (Bay of Plenty 3110).
A multi-page static preview built to show Matt what his own website could look like, using
his real job photos. This is a **sales preview**, not a LeadHive Google Ads landing page, so it
does not use `templates/` (no CONFIG block, Nimbata swap or lead endpoint).

Business name used: **Straight Line Landscaping**. His Facebook page is titled
"Straightline Landscape" (facebook.com/straifht); confirm the trading name with Matt.
The top-ranking Tauranga competitor (Tauranga Landscaping) is also led by a "Matthew", so the
site is branded around the "Straight Line" name rather than leading with Matt's first name.

## Preview

Plain HTML/CSS/vanilla JS, no build step. All links are relative, so it works:

- from disk: open `index.html` in a browser (file://),
- on any static host, or when the folder is published as an artifact.

The only external request is the Google Font (Archivo, one variable-font request covering
weights 400 to 900 and the width axis); the site falls back to system fonts without it. Every page carries `<meta name="robots" content="noindex, nofollow">` so a hosted
preview is not indexed. **Remove it at launch.**

## Pages

| File | H1 | Title tag |
|---|---|---|
| `index.html` | Tauranga Landscaping, Retaining Walls & Ready Lawns | Landscaper Tauranga \| Retaining Walls, Lawns & Decks \| Straight Line Landscaping |
| `retaining-walls-tauranga.html` | Retaining Wall Builders in Tauranga | Retaining Walls Tauranga \| Timber & Block \| Straight Line Landscaping |
| `ready-lawn-tauranga.html` | Ready Lawn Installation in Tauranga | Ready Lawn Installation Tauranga \| Instant Turf \| Straight Line |
| `irrigation-tauranga.html` | Irrigation Systems Installed Across Tauranga & the Western Bay | Irrigation Installation Tauranga & Bay of Plenty \| Straight Line |
| `decks-tauranga.html` | Deck Builders in Tauranga | Decks & Decking Tauranga \| Straight Line Landscaping |
| `fencing-tauranga.html` | Fencing Contractors in Tauranga | Fencing Tauranga \| Timber Fences & Gates \| Straight Line |
| `landscaping-tauranga.html` | Landscaping Services in Tauranga | Landscaping Tauranga \| Full Garden Makeovers \| Straight Line |
| `projects.html` | Recent Landscaping Projects Around Tauranga | Landscaping Projects Tauranga \| Straight Line Landscaping |
| `about.html` | Meet Matt: Landscaping in Tauranga Since 2012 | About Matt \| Straight Line Landscaping Tauranga |
| `areas.html` | Landscaping Across Tauranga & the Western Bay of Plenty | Service Areas \| Landscaper Tauranga, Papamoa & Mount \| Straight Line |
| `contact.html` | Get a Free Landscaping Quote | Free Quote \| Straight Line Landscaping Tauranga |

Sitemap, H1s and titles follow the research brief (`inspiration-brief.md`, 26 Oct 2026). Per-suburb
area pages (/landscaping-papamoa etc.) are left for the live build; `areas.html` lists all 15
suburbs grouped into four areas.

Each page has one H1, a unique title and ~150-character meta description, a relative
`rel="canonical"`, Open Graph tags, and LocalBusiness JSON-LD (name, phone, email, Tauranga /
Bay of Plenty / 3110 / NZ, areaServed Tauranga + Western Bay of Plenty, **no rating**). Service
pages add BreadcrumbList, FAQPage (5 Q&As matching the visible accordion) and Service schema.
**At launch:** make canonical, breadcrumb and `og:image` URLs absolute on the real domain and add
`url` to the LocalBusiness schema.

Service pages: hero photo, 300–400 words of Tauranga-specific copy (consent thresholds, materials,
drainage, base prep etc., written generically with no supplier or product claims), "What's
included" box, photo strip, 4-step process, FAQ accordion, related services and CTA block.
Links from a service page to the form pre-tick that service (`contact.html?service=decks`).

## Assets

- `assets/style.css`, `assets/site.js` (nav toggle, services dropdown, gallery filter, lightbox, demo form)
- `assets/logo.svg` (horizontal lockup, ink #0E1A14), `assets/logo-light.svg` (reversed white, used
  over hero photos and in the footer), `assets/logo-mark.svg` (square mark), `assets/favicon.svg`
  (same as the mark). Purely typographic: "STRAIGHT LINE" in Archivo 900 (slightly
  expanded width) uppercase with wide tracking, a single horizontal rule underneath that runs past the
  wordmark on the right, and small spaced caps "LANDSCAPING" below the rule. No icon. The mark is
  an ink square with "SL" in Archivo 900 and the same single rule threaded through the letters.
  Monochrome. Text is converted to outlines (Archivo), so the logo renders identically everywhere.
- `photos/`: 41 of Matt's Facebook photos (all quality 4–5 picks plus selected 3s, and two
  in-progress fencing shots because fencing photos are thin). Resized (hero images 1200px long
  edge, others 900px), JPEG q76, EXIF stripped, original `sl-NN` names kept. Also `hero-home.jpg`
  (1920px) and `hero-home-mobile.jpg` (900x1350 crop, used below 768px): the stock placeholder home hero.
  `photos/thumbs/`: 480px-wide versions for grids. Captions and alt text come from the photo
  manifest. Gallery filter tags: decking (incl. build-in-progress "team" shots), retaining,
  fencing, gardens (manifest "general"), lawns & irrigation; a few photos carry two tags where
  the caption shows both (e.g. retaining wall with new lawn).
- `screens/`: Playwright screenshots (JPEG, full page): home and retaining-walls at 390px;
  home, projects, retaining-walls, about and contact at 1280px.

## Real vs placeholder

| Item | Status |
|---|---|
| Photos | **Real**, Matt's own jobs from the Straightline Landscape Facebook page. No stock except the home hero (next row). People in team photos are not identified. |
| Home hero photo (`photos/hero-home.jpg`, `photos/hero-home-mobile.jpg`) | **Placeholder, stock photo, not Matt's work.** "House with Lawn" by Max Vakhtbovych, https://www.pexels.com/photo/house-with-lawn-7587878/ , Pexels licence (free for commercial use, no attribution required). Used because all of Matt's photos are square Facebook crops and none works as a wide hero. Replace before launch. |
| Phone 020 4006 6910, email sales@straightline1.co.nz, Tauranga 3110 | **Real**, from the Facebook About section |
| Landscaping since 2012, owner for 4 years, services list | **Real**, from Facebook / Matt |
| Logo, mark and favicon | **Placeholder**, designed for the preview; Matt has no logo |
| Reviews block (home, about) | **Placeholder**, clearly labelled "Matt's Google reviews will go here". No ratings, counts or quotes anywhere. |
| Photo of Matt (about page) | **Placeholder** avatar labelled "Photo of Matt"; no confirmed photo of him exists |
| Quote form (contact page) | **Demo only.** On submit, JS shows a thank-you message; nothing is posted or stored. A note under the button says so. Needs a real endpoint (e.g. Lovable route emailing Matt) before launch. |
| Process steps, FAQ answers, service copy | Written for the preview from general NZ practice; nothing claims awards, memberships (no RML), insurance, licences, guarantees, prices or named clients. Have Matt read it. |

Facts source: Straightline Landscape Facebook page, About section, plus what Matt told Joe.

## Open questions for Matt

1. **Domain**: `straightline1.co.nz` (matches his email) did not resolve on 26/10/2026, so there is no live website. Does he own the domain, and can we point it at the new site?
2. **Trading name**: "Straight Line Landscaping" vs "Straightline Landscape" on Facebook.
3. **Logo**: does he want this placeholder developed, or does he have branding (van signage, uniforms)?
4. **Reviews**: set up a Google Business Profile and start collecting reviews; any past client feedback (with permission) to use now?
5. **Hours**: days/hours he takes calls and works (for the site and LocalBusiness schema).
6. **Exact service area**: confirm the 15 suburbs/towns and how far out he goes (Katikati, Te Puke, beyond?).
7. **Lawn and irrigation photos**: only 2 lawn and 1 irrigation photo exist; more would strengthen those pages.
8. **Photo of Matt** for the about page and hero proof (the competitor uses the owner's photo).
9. **About copy**: the brief's H1 says "Landscaping in Tauranga Since 2012". Confirm he has been working in Tauranga (not elsewhere) since 2012, and how he came to own the business 4 years ago.
10. **Services detail**: block retaining walls, composite decking and Wi-Fi irrigation controllers are mentioned as options. Confirm he offers them. Also: garden maintenance, artificial turf (some photos show it), rubber safety surfacing (several photos, not shown on the site)?
11. **Text messages**: the site says "call or text Matt". OK?
12. **Home hero**: Replace the home hero with a wide shot of one of his own finished jobs.
