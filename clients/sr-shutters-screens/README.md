# SR Shutters & Screens: demo site (multi-page)

Client: **SR Shutters & Screens (Shane Bartolo)**, owner-operator. Plantation shutters, aluminium/outdoor
shutters, security screens and doors, fly screens, blinds. Brisbane, Moreton Bay, Logan, Redlands, Ipswich,
Gold Coast and Sunshine Coast, QLD.
Deal: **demo request only, no deal yet.** Built for Joe to show Shane. Current site is srshuttersandscreens.com.au
(WordPress/Elementor by CMAK Digital).

## What's in the folder

| Path | What |
|---|---|
| `*.html` | 15 static pages (see the page map below). Relative links throughout, so it works from file:// or any plain web host |
| `assets/css/site.css` | The whole visual system, shared by every page (tokens, type, header, sections, product pages, review page) |
| `assets/js/site.js` | Shared script: phone sync from `#nb-source`, header, products dropdown, mobile menu, scroll reveal, before/after sliders, gallery filter + lightbox, quote form, mobile bar, QR codes. Holds `GOOGLE_REVIEW_URL` |
| `assets/img/` | 43 curated files, 6.0 MB. Only Shane's real installs + logos. See `assets/img/INDEX.md` |
| `screens/` | Screenshots of every page (list below) |
| `research/` | Design brief, current-site content, audit, online presence (source of every fact on the site) |

## Preview

Open `index.html` in a browser (file:// is fine) and click through; every link is relative. From file://, or
with `?demo=1`, the quote form on `contact.html` skips the network call and shows the success state, so it
demos cleanly. Product-page CTAs deep-link into the form with the product pre-ticked, e.g.
`contact.html?product=security-screens-doors`. Open `review.html?demo=1` to show Shane the SMS / email /
leave-behind card. Pages need the internet for Google Fonts and the QR library (cdnjs, pinned 1.4.4 + SRI).
To host it, upload the folder as-is to any static host (Netlify drop, S3, cPanel).

Checked with Playwright at 1440×900 and 390×844 on every page: no console errors, no failed requests, no
horizontal scroll on mobile, one H1 per page, no duplicate IDs, all local links and image paths resolve, nav
active state correct. Cold first-screen weight: home 1.1 MB desktop / 0.6 MB mobile; product pages 0.3–0.6 MB.

## Page map

| File | Purpose | `<title>` | Lovable route |
|---|---|---|---|
| `index.html` | Home, kept short: hero, trust strip, 5 product cards, "You'll deal with Shane" (condensed), one before/after slider, 3 reviews, quote CTA band | Plantation Shutters, Security Screens & Blinds Brisbane \| SR Shutters & Screens | `/` |
| `plantation-shutters.html` | Product page + the PVC vs basswood vs aluminium guide (`#materials`), styles, 6 photos, 4 FAQs | Plantation Shutters Brisbane \| Free Measure & Quote \| SR Shutters & Screens | `/plantation-shutters` (or `/plantation-shutters-brisbane`) |
| `security-screens-doors.html` | Product page: stainless mesh doors and window screens, John's review, 4 FAQs | Security Screens & Doors Brisbane \| SR Shutters & Screens | `/security-screens-doors` |
| `outdoor-aluminium-shutters.html` | Product page: patios, pools, balconies, alfresco; CSS material art (no real photos yet), 4 FAQs | Outdoor & Aluminium Shutters Brisbane \| SR Shutters & Screens | `/outdoor-aluminium-shutters` |
| `fly-screens.html` | Product page: sliding screen doors and window fly screens; CSS mesh art, 3 FAQs | Fly Screens & Screen Doors Brisbane \| SR Shutters & Screens | `/fly-screens` |
| `blinds.html` | Product page: roller, blockout, dual, vertical, manual or motorised; 4 photos, 3 FAQs | Blinds Brisbane \| Roller, Blockout & Motorised \| SR Shutters & Screens | `/blinds` |
| `before-after.html` | Both genuine before/after sliders at full width, captions, "how to read these" | Before & After: Shutters & Blinds in Brisbane \| SR Shutters & Screens | `/before-after` |
| `our-work.html` | Full gallery: 21 real installs, product filter, lightbox | Our Work: Shutters, Screens & Blinds in Brisbane \| SR Shutters & Screens | `/gallery` (or `/our-work`) |
| `about.html` | Meet Shane: owner-operator block, 4-step process, the six-point SR promise | About Shane Bartolo, Owner \| SR Shutters & Screens Brisbane | `/about` |
| `reviews.html` | The 4 Google reviews verbatim, "5.0 on Google", "Tell Brisbane" band with QR → `review.html`, link to Google | Reviews: 5.0 on Google \| SR Shutters & Screens Brisbane | `/reviews` |
| `service-areas.html` | 35 areas in 6 regions, a short paragraph per region, links to every product | Service Areas: Brisbane, Moreton Bay, Logan & Redlands \| SR Shutters & Screens | `/service-areas`, then `/areas/[region]` and `/areas/[suburb]` |
| `faq.html` | All 8 FAQs (native accordion) | FAQ: Plantation Shutters, Security Screens & Blinds \| SR Shutters & Screens | `/faq` |
| `contact.html` | Full quote form (`?product=` pre-select), phone, email, hours, "Call Shane" card, what happens next. No sticky mobile bar | Book a Free Measure & Quote \| Contact SR Shutters & Screens Brisbane | `/contact` (or `/quote`) |
| `review.html` | The QR / SMS landing (`?demo=1` = "For Shane" panel). noindex. No sticky mobile bar | Leave a Google Review \| SR Shutters & Screens | `/review` |
| `privacy.html` | Plain privacy policy: what the form collects, used only to arrange the measure and quote, contact email. noindex | Privacy Policy \| SR Shutters & Screens | `/privacy` |

**Shared on every page:** header (logo, "Shutters & Screens" dropdown with the 5 products, Before & After, Our
Work, About, Reviews, FAQ, Contact, phone, "Book a Free Measure"; current page marked with `aria-current`),
a mobile menu listing every page, the footer (products, company links incl. Service areas, Leave a Google
review and Privacy, phone, email, hours) and the sticky "Call Shane | Free Quote" bar (all pages except
`contact.html` and `review.html`; it hides while a quote CTA band is on screen). Product pages link to their
four siblings, to `before-after.html` and to `contact.html?product=<key>`; keys are `plantation-shutters`,
`security-screens-doors`, `outdoor-aluminium-shutters`, `fly-screens`, `blinds`.

**SEO per page:** unique title and meta description, canonical placeholder
`https://srshuttersandscreens.com.au/<slug>`, Open Graph tags, one H1. JSON-LD: `HomeAndConstructionBusiness`
on `index.html` and `about.html`; `Service` (name, provider, areaServed) on each product page; `FAQPage` only on
`faq.html` and the product pages that show FAQs (matching the questions shown); `BreadcrumbList` on every inner
page. **No AggregateRating anywhere** (Google treats self-served review stars as ineligible).

Phone: each page has exactly one `#nb-source` holding **0411 885 227** (the number Nimbata must be set to
REPLACE). Every `[data-phone-display]` / `[data-phone-link]` re-syncs from it, same as the handyman template.
Form: posts JSON `{name, phone, suburb, issue, isUrgent, products, message, source, page}` to
`/functions/v1/send-lead-notification`; honeypot field `website`.

## Screens

`screens/` (256-colour PNGs; full-page shots scaled to keep the folder near 15 MB):
`home-first-screen-desktop.png` (1440×900), `home-first-screen-mobile.png` (390×844 @2x), `home-desktop.png`
(full page, 960 wide), `home-mobile.png`, one `<slug>-desktop.png` per other page (full page, 800 wide):
plantation-shutters, security-screens-doors, outdoor-aluminium-shutters, fly-screens, blinds, before-after,
our-work, about, reviews, service-areas, faq, contact, review, privacy; plus `plantation-shutters-mobile.png`,
`reviews-mobile.png` and `contact-mobile.png`.

## Pulled from his current site vs new

**From his site / Google (verified):** name, phone 0411 885 227, email, hours, owner name, "No sales reps. No
subcontractors.", family-owned, free measure & quote, "most homes installed in a single day", product list
and wording (PVC/timber, bay/arched/odd shapes, stainless mesh, rust-proof/rot-proof/warp-proof aluminium,
powder-coated, sliding screen doors, blockout/motorised blinds), "flexible payment options", the 35 service
areas, 47 real install photos, both real before/after pairs, the 4 Google reviews (verbatim, typos kept).

**New:** all design and copy structure, the multi-page split (product, about, before & after, gallery, reviews,
areas, FAQ, contact, privacy pages), the materials guide, process, FAQ wording (rewritten so nothing
unverified is claimed), review band, `/review` page and the review-request sequence, schema, image
optimisation (117 MB → 6 MB).

**Deliberately left out:** the AI "Shane", the AI before/afters, all stock/supplier images, the 13 page
testimonials that aren't on Google ("Karen M" etc.), "15 years", "Founded in 2010", "15-30 / 30 year
warranty", "lifetime guarantee", "certified technicians", "meets Australian standards", brand names, QBCC, ABN.
Product pages only use copy that is on his site or in the research; where no real photo exists (outdoor
shutters, fly screens) the page says so and shows other real jobs. Warranty is worded as "manufacturer's
warranty + SR workmanship guarantee, terms in writing with your quote".

## Review-generation system

1. **Branded link:** `srshuttersandscreens.com.au/review` → `review.html`. Big gold "Leave a Google review"
   button and a QR, all reading one const, `GOOGLE_REVIEW_URL` at the top of `assets/js/site.js` (the same
   const drives the QR in the "Tell Brisbane" band on `reviews.html`). **It currently holds the working write-review fallback for the
   "SR Shutters and Screens" GBP (place_id `ChIJX0h2jR-nMAYRF8pfdpDSDkM`). Swap in his g.page/r/…/review
   link** (GBP → Read reviews → Get more reviews → Copy) and test in a private window.
2. **QR handover card:** black A6, gold monogram, "Enjoy your new shutters.", QR to `/review`, Shane's number.
   Left on the bench at handover. Mock-up is in `review.html?demo=1`.
3. **Sequence**, sent in Shane's name, same link for everyone, stops once they've reviewed:
   - **Day 0, SMS, 5–6pm** (2–3 hours after he leaves, never while on site):
     > Hi Sarah, Shane from SR here. Thanks for having me today, I hope you love the shutters. If you have a sec, a quick Google review helps a local business heaps: srshuttersandscreens.com.au/review
   - **Day 1, email, ~9:30am.** Subject *Your new shutters, before and after*. Preheader *A couple of photos from yesterday, plus a small favour.*
     > Hi Sarah, Thanks again for choosing SR Shutters & Screens. Here's how your [room] looked before, and how it looks now: [before/after]. If you're happy with how it turned out, would you mind sharing a few words on Google? Mentioning what we installed and your suburb really helps other Brisbane families find us. [Leave a Google review] And if anything isn't perfect, a panel that needs adjusting or a door that sticks, reply to this email or call me on 0411 885 227 and I'll sort it. Cheers, Shane
   - **Day 4, SMS, only if no review:**
     > Hi Sarah, Shane again. No pressure at all, but if you get a minute this week I'd really appreciate a Google review: srshuttersandscreens.com.au/review. Any issues with the shutters, just call me.
4. **Rules:** no gating (no "were you happy?" filter), no incentives, reply to every review within 48 hours
   naming product + suburb. Automation: job marked "Installed" → SMS +2h (9am–7pm window) → email next
   9:30am → SMS day 4 unless marked "Reviewed" (Make or GHL). Monthly one-liner: installs · asked · new reviews · rating.

## Pitch notes (Joe)

From the brief:
1. "Crimsafe, Luxaflex and Norman say 'find a dealer'. Your site says 'you'll deal with Shane, start to finish'. That's the whole pitch."
2. "I looked at 16 of the biggest shutter and screen sites. Not one has a proper before-and-after on the home page. You'll be the only one."
3. "Your Brisbane competitors show a 4.9 with no review count, a cookie banner reading `{title}` and copyright 2023. Next to that, yours looks like a national brand."
4. "The big boys bury their best stuff under sale banners. You lead with craftsmanship and proof, which is how a premium brand earns premium prices."
5. "Davcon has 270 Google reviews and wins on that. This system asks every customer automatically, so you close the gap in months, not years."
6. "Every job turns into a before/after, a gallery shot, a suburb page and a review request. The site grows from work you're already doing."
7. "Once you give me your QBCC number and warranty terms, they go on the page in writing. Most locals just say 'licensed'."
8. "One button, 'Book a Free Measure', everywhere, and a 'Call Shane' bar under their thumb on a phone. Davcon uses five different buttons."
9. "We answer what Brisbane people actually Google: PVC vs basswood, storm season, what shutters cost."
10. "Black and gold, big photos, quiet motion. It looks like a $1 million brand, but it's your real jobs and real reviews, and that's what converts."

From the audit, in my words:
- "Google sees **68 suburb pages that are word-for-word copies** with the suburb swapped, all made on one day. That pattern gets ignored or pushed down."
- "The bloke in blue overalls on your home page **isn't you, he's AI-generated**. So are the before/afters, the Gemini watermark is still on them. And 'Karen M' is on 70 pages. That's an ACCC risk, and you've got 47 real photos and 4 real 5-star reviews you're not using."
- "Your home page is **about 40 MB**. On 4G that's a white screen. This one is under 1 MB to first screen."
- "You've got **two Google Business Profiles** and the website shows **0411 885 227** while both profiles show **0480 431 417**. Merge them, pick one number."
- "On mobile your phone number and quote button are hidden, and there's no privacy policy behind the form."
- "Your 4 reviews are great, but the newest is from March 2025. Nineteen months without one."

## Confirm with Shane before launch

- **QBCC licence number and class** (none shown anywhere today)
- **ABN** (ABN Lookup suggests 79 667 070 340, S & R Investments (Aust) Pty Ltd; confirm before showing)
- **Years trading / his story** (site says "15 years" and "founded 2010"; company registered 2023)
- **Warranty terms [CONFIRM]**: manufacturer warranty per product + the SR workmanship guarantee term in years. Not on the page until confirmed
- **Suppliers / brands** (shutter maker, mesh brand, AS 5039 certification, Australian-made?)
- **Finance**: provider for "flexible payment options", or drop the FAQ
- **Which phone number is right** (0411 885 227 vs 0480 431 417), then **merge the duplicate GBP** ("Blinds" listing) and retire srshuttersblinds.com
- **Real Google review short link** (g.page/r/…/review) for `GOOGLE_REVIEW_URL`
- **A real photo of Shane** on the job (the positioning block on `about.html` and the home page is built to take one)
- **More security door photos** (only 2 real ones, so that page shows 2 instead of 3 to 6)
- **Privacy policy**: confirm the wording, and add analytics / Nimbata call-tracking lines once those scripts go live
- Photos of **outdoor/aluminium shutters and fly screens** (those cards and page heroes use CSS art for now; their galleries carry a "photos still being added" note), and whether `security-screens-patio-windows-01` and the bay-window shot are his jobs
- Suburbs for the 4 reviewers, if he knows them (cards show first name + date only)
- Quote turnaround and lead times (copy says "clear written quote" and "single day install" only)
- Base suburb and real service radius (Gold/Sunshine Coast are on his current list)

## Lovable / launch

Same pattern as Northland: the static pages are the design source; Lovable gets them as the build brief.

- Every static page maps to a route (see the page map above). Shared header, footer and mobile bar become
  layout components; `assets/css/site.css` becomes the theme; `assets/js/site.js` splits into small components.
- **Service areas:** `service-areas.html` lists all 35 areas as plain text. In the Lovable build each region and
  suburb becomes its own route, `/areas/[region]` and `/areas/[suburb]`. Start with 20–30 **genuinely unique**
  suburb pages (real jobs + a local review each) and 301 the 68 cloned suburb pages to them or to `/service-areas`.
  Future suburb pages slot in under the same route without touching the static demo.
- Guide pages to add later: `/pvc-vs-basswood-vs-aluminium` (the materials guide now on the plantation page),
  `/plantation-shutter-cost-brisbane`, `/shutters-vs-blinds`.
- Keep the Nimbata DNI script in the root layout; `#nb-source` carries 0411 885 227.
- Form: static file uses `/functions/v1/send-lead-notification`; the Lovable build uses its own
  `/api/public/enquiry` → Resend to hello@leadhivenz.com (add srshuttersnscreens@gmail.com as second recipient).
- Reviews: move the 4 cards to a JSON/config list (or a cached Places API pull) so new reviews drop in.

Launch checklist:
1. Confirm the list above with Shane; add QBCC/ABN/warranty only once confirmed.
2. Paste the real review link into `GOOGLE_REVIEW_URL` in `assets/js/site.js` and test in a private window.
3. Build in Lovable, publish, attach the domain, 301 the old suburb/thank-you/maintenance URLs.
4. Create the Nimbata project with 0411 885 227 as the number to replace; confirm the swap live.
5. Send a test enquiry end to end; set up the Make/GHL review sequence and print the QR cards.
