# Class 5 Property Services — website design brief

Design lead: Fable (reviews every build). Builder: Opus agent. This brief is the spec.

## Client facts (only use what is here; do not invent credentials)
- Business: **Class 5 Property Services Ltd** — Christchurch, New Zealand. Owner-operator: **Jamie**.
- Tagline on logo: **Maintenance • Repairs • Property Care**
- Phone: **021 704 252**  (tel:+6421704252)
- Email: **jamie@class5services.co.nz**
- Assumed domain: **https://www.class5services.co.nz** (use for canonical / sitemap / OG; README must flag as assumed)
- Service area: Christchurch and surrounds (Rolleston, Rangiora, Kaiapoi, Lincoln, Prebbleton, Halswell, Hornby, Riccarton, Papanui, Sumner, New Brighton, etc.)
- What he does: *everything* residential property maintenance. Named by Joe: TV wall mounting, minor plastering / GIB repairs, cabinetry making, decks, fence repairs, "anything house maintenance". Also: gates, doors/locks/hinges, gutters, small carpentry, rot repairs, painting touch-ups, shelving, flat-pack & furniture assembly, hanging mirrors/art, bathroom/kitchen minor updates, rental property maintenance for landlords & property managers.
- DO NOT claim: insured, Licensed Building Practitioner, years in business, number of jobs, star ratings, Google review counts. (README lists these as "confirm with Jamie".)
- Hours (placeholder, flag in README): Mon–Fri 7:30am–5:30pm, Sat by arrangement.
- Testimonials: no real ones supplied. Include a testimonials section driven by ONE data array with 3 clearly-generic placeholder reviews (first name + suburb only). README must say they are placeholders to replace with Jamie's real Google/Facebook reviews before launch. Do not show star-rating aggregates in schema.

## Brand
- Keep the logo's palette: **black, white, hot pink**.
- Tokens: `--black:#0B0B0D` (page dark), `--black-2:#141418` (cards on dark), `--white:#FFFFFF`, `--off:#F6F6F8` (alternating light sections), `--ink:#111114`, `--ink-2:#4B4B55`, `--ink-3:#8A8A96`, `--rule:#E6E6EB`, `--pink:#F7096B` (brand), `--pink-deep:#D4075A` (small text on white, hover), `--pink-soft:#FFE4EF`.
- Contrast rule: pink text on white only at ≥20px bold, otherwise use `--pink-deep`. White text on pink buttons is fine.
- Fonts (Google Fonts): headings **Outfit** 600/700/800 (geometric, matches the wide logo lettering), body **Inter** 400/500/600. Preconnect + `display=swap`.
- Logo files in `site/images/`: `logo.png` (white+pink on transparent, use on dark), `logo-dark.png` (black+pink on transparent, use on light). Generate a square favicon/apple-touch-icon from the top "C5 house" symbol (crop with ImageMagick, e.g. pink/white mark on black background).
- Mood: **premium trade**. Bold, confident, lots of black, generous whitespace, pink used sparingly as accent (CTA buttons, eyebrow labels, 4px accent bars, hover underlines, icon strokes). Think a $10k agency site for a top-tier tradie: big type, crisp grid, real photos, subtle motion. NOT a template look, NOT purple gradients, NOT rounded-blob illustrations.

## Photos available (`site/images/`) — the only "his work" images allowed
- `class5-ute.jpg` — sign-written black Ford Ranger (great hero/about image)
- `fence-before.jpg` / `fence-after.jpg` — grey weathered fence → stained red-brown fence (use in a before/after slider)
- `fence-before-after.jpg` — stacked composite
- `new-fence-build.jpg` — new timber paling fence
- `timber-gate.jpg` — new timber side gate (portrait)
No stock / AI images. Service cards use custom inline SVG line icons (consistent 1.75px stroke, 24px grid, pink stroke on dark, ink on light). Where a service page needs a visual and no photo exists, use a typographic/dark panel treatment, not a stock photo.

## Site map (each page a real HTML file, pretty URLs via Netlify)
Research: Christchurch SERPs are held by franchises (Jim's, Handyman Group) with thin city pages and by marketplaces. Nobody with a real business site owns "TV wall mounting Christchurch". Location-suffixed slugs, one page per service, and a few suburb pages are the gap. "Send a photo for a fast quote" is a differentiator to use on CTAs/forms.
```
/                                              index.html
/services/                                     services hub
/services/handyman-christchurch/               General handyman & small jobs (the "everything else" page)
/services/tv-wall-mounting-christchurch/       TV wall mounting (include a short, honest "what affects the price" guide — no $ figures)
/services/plastering-repairs-christchurch/     Plastering, GIB stopping & plasterboard repairs
/services/cabinetry-christchurch/              Custom cabinetry, shelving & joinery
/services/decks-christchurch/                  Deck building & deck repairs
/services/fences-gates-christchurch/           Fences & gates (build, repair, storm damage, staining)
/services/rental-property-maintenance-christchurch/   For landlords & property managers
/areas/                                        Service areas hub (suburb grid + map)
/areas/riccarton/  /areas/papanui/  /areas/halswell/  /areas/rangiora/  /areas/rolleston/   5 suburb pages (unique 250–350 word intro each, services list, nearby suburbs, CTA; LocalBusiness areaServed)
/about/                                        About Jamie / Class 5
/our-work/                                     Gallery (before/after slider + photos)
/contact/                                      Contact + quote form (Netlify Forms, with photo upload field)
/thank-you/                                    Form success
/404.html, sitemap.xml, robots.txt, netlify.toml, site.webmanifest, favicon.ico/png, apple-touch-icon.png
```
Use `folder/index.html` so Netlify serves clean trailing-slash URLs. All internal links root-relative.
Title pattern: "TV Wall Mounting Christchurch | Class 5 Property Services". H1 pattern: "TV wall mounting in Christchurch" style — plain, keyword-led, human.
Trust phrases competitors use that we CAN use honestly: free no-obligation quotes, written quote before work starts, no call-out fee for quotes (confirm), owner-operated, Christchurch local. Phrases we CANNOT use until confirmed: licensed, insured, LBP, guarantee.

## Build approach
- `clients/class5-property-services/src/` : `build.mjs` (Node 22, no npm deps) + `partials/` (head, header, footer, cta-band, sticky-bar) + `data/` (services, suburbs, testimonials, faqs as JS modules) + page templates.
- `node src/build.mjs` writes the finished static site to `clients/class5-property-services/site/` (plain HTML/CSS/JS/images — this folder IS the Netlify deploy, nothing to build on Netlify).
- Shared `site/css/style.css` (one file, custom properties, mobile-first, ~no dead rules) and `site/js/main.js` (nav toggle, sticky bar, scroll reveal with IntersectionObserver, before/after slider, FAQ accordion is native `<details>`, form UX). No frameworks, no jQuery, no Tailwind.
- `netlify.toml`: publish = site folder relative to the zip root ("."), headers (cache for /images/*, /css/*, /js/* ; X-Frame-Options, X-Content-Type-Options, Referrer-Policy), 404 page, redirect `/index.html` → `/` 301, `/thank-you` exists.
- Contact form: `<form name="quote" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thank-you/" enctype="multipart/form-data">` with fields name, phone (required), email, suburb (select from suburb list), service (select), message, optional photo upload (`<input type="file" name="photo" accept="image/*">`, label "Add a photo for a faster quote"), consent checkbox. Also put a hidden static copy of the form fields so Netlify detects them (same form, static HTML — that's fine). Client-side validation, no JS required to submit.

## Page anatomy
**Global header**: dark, sticky, logo left, nav (Services ▾ mega/dropdown with the 6 services, Our Work, Service Areas, About, Contact), right: phone number as a pink pill button `021 704 252` with phone icon. Mobile: hamburger → full-screen dark menu with the services listed + big call button.
**Sticky mobile bottom bar** (only < 900px): "Call 021 704 252" (pink) + "Get a quote" (white outline).
**Global footer**: black. Logo, one-line description, columns: Services (6 links), Company (About, Our Work, Service Areas, Contact), Contact (phone, email, hours, "Christchurch, Canterbury"). Bottom row: © 2026 Class 5 Property Services Ltd · tiny "Website by LeadHive" link to https://leadhivenz.com.
**CTA band** before footer on every page: black or pink band, "Got a job on the list? Tell Jamie what needs doing." + Call + Get a free quote.

**Home**
1. Hero: full-bleed dark, `class5-ute.jpg` as background with black gradient overlay from left (text legible), eyebrow "Christchurch property maintenance", H1 "One tradie for every job on your property" (or similar — strong, specific, benefit-led; avoid "welcome to"), sub: "From TV wall mounting and plaster repairs to decks, fences and custom cabinetry — Jamie handles the whole list so you don't have to juggle five different trades.", CTAs: pink "Call 021 704 252", outline "Get a free quote". Trust row of 4 chips: Owner-operated · Free, no-obligation quotes · Christchurch-wide · Tidy, reliable, on time.
2. Services grid (6 cards, icon + title + 1 line + "Learn more →"), light section.
3. "Everything property maintenance" — a long list of the small jobs, as a dense chip wall or 3-column list on black. This is the "he does everything" message.
4. Before/after slider (fence), with caption "Fence restoration, Christchurch".
5. Why Class 5 — 4 numbered points (one call, one tradie; quotes upfront; turns up when he says; leaves the place tidy).
6. How it works — 3 steps (Send the list / Get a quote / Job done).
7. Testimonials (placeholder data).
8. Service areas teaser (suburb chips + link).
9. FAQ (5 Qs, `<details>`), FAQPage schema.
10. CTA band, footer.

**Service pages** (same skeleton, unique copy per service, 500–800 words each, written for a Christchurch homeowner, no fluff): hero (dark, eyebrow + H1 + lede + CTAs), "What's included" list, "Common jobs" chips, small "Why Jamie for this" block, a relevant photo where one exists (fences/decks pages get the fence photos; gates get the gate; others use a dark typographic panel), process, FAQ (4 Qs, FAQPage schema), related services, CTA band. `Service` + `BreadcrumbList` JSON-LD.

**Services hub**: intro + the 6 cards expanded + the "everything else" list.
**About**: Jamie's story (keep generic and honest — owner-operator, Christchurch local, takes pride in tidy work; no invented history), ute photo, values, CTA.
**Our work**: before/after slider + photo grid (lightbox optional, keep simple) + "More photos coming" is NOT acceptable copy — just show what exists well.
**Service areas hub**: intro, grid of ~24 suburbs/towns (the 5 with pages are links, rest plain text), embedded Google map (`https://www.google.com/maps?q=Christchurch,New+Zealand&z=11&output=embed`, lazy-loaded), CTA.
**Contact**: two-column: form left, contact details right (phone, email, hours, areas), map below.

## SEO
- Unique `<title>` (≤60 chars, pattern "Service Christchurch | Class 5 Property Services") and meta description (≤155 chars) per page; canonical; OG + Twitter tags with `images/og-default.jpg` (make one: 1200×630, black bg, logo centred, pink accent bar — ImageMagick).
- One H1 per page, logical H2/H3, descriptive alt text on all images, `loading="lazy"` below the fold, `width`/`height` attributes.
- JSON-LD on every page: `HomeAndConstructionBusiness` (name, telephone, email, url, logo, image, areaServed list of suburbs, address locality Christchurch, region Canterbury, country NZ, openingHoursSpecification placeholder) — no aggregateRating. Service pages add `Service` + `BreadcrumbList`; FAQ sections add `FAQPage`.
- `sitemap.xml` with all pages, `robots.txt` referencing it.
- Internal linking: every service page links to 3 related services and the hub; home links to all.

## Quality bar (Fable will check all of these with Playwright screenshots at 390px and 1440px)
- Looks premium at both sizes; no overflow, no horizontal scroll, no text on photo without enough contrast.
- Lighthouse-style hygiene: no console errors, all images have dimensions, fonts preloaded, CSS < 40KB, JS < 15KB.
- Keyboard accessible nav/menu/slider, focus styles visible, skip link, aria-labels on icon buttons, `prefers-reduced-motion` respected.
- Copy is specific and NZ-English (colour, metres, GIB, tradie). No lorem ipsum anywhere. No invented credentials.
- `README.md` in `clients/class5-property-services/`: what was built, how to rebuild, how to deploy to Netlify (drag the zip), what to confirm with Jamie (domain, hours, insurance/LBP, reviews, more photos, Google Business Profile link, Facebook link), how to change phone number / add a service.
