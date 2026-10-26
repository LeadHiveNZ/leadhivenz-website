# SR Shutters & Screens: demo site

Client: **SR Shutters & Screens (Shane Bartolo)**, owner-operator. Plantation shutters, aluminium/outdoor
shutters, security screens and doors, fly screens, blinds. Brisbane, Moreton Bay, Logan, Redlands, Ipswich,
Gold Coast and Sunshine Coast, QLD.
Deal: **demo request only, no deal yet.** Built for Joe to show Shane. Current site is srshuttersandscreens.com.au
(WordPress/Elementor by CMAK Digital).

## What's in the folder

| Path | What |
|---|---|
| `index.html` | Home page demo. One file, inline CSS + vanilla JS, Google Fonts, images from `assets/img/` |
| `review.html` | The `/review` page behind the QR card, SMS and email. `?demo=1` shows the "For Shane" panel |
| `assets/img/` | 43 curated files, 6.0 MB. Only Shane's real installs + logos. See `assets/img/INDEX.md` |
| `screens/` | `home-desktop.png`, `home-mobile.png`, `home-first-screen-mobile.png`, `home-first-screen-desktop.png`, `review-desktop.png`, `review-mobile.png` |
| `research/` | Design brief, current-site content, audit, online presence (source of every fact on the page) |

## Preview

Open `index.html` in a browser (file:// is fine). From file://, or with `?demo=1`, the quote form skips
the network call and shows the success state, so it demos cleanly. Open `review.html?demo=1` to show Shane
the SMS / email / leave-behind card. Both pages need the internet for fonts and the QR library.

Page weight (Playwright, cold load): home **0.87 MB** first screen on desktop, **0.62 MB** on mobile;
**2.9 MB / 2.3 MB** after scrolling the whole page. His current home page is ~40 MB. No console errors, no 404s.

## Section map (index.html)

| # | Anchor | Section |
|---|---|---|
| 0 | header | Logo, nav, phone, "Book a Free Measure". Turns solid after 80px. Mobile: phone + louvre-line menu |
| 1 | `#top` | Hero. H1 "Plantation Shutters & Security Screens · Brisbane / Fitted by the man who measured them." Louvre-slat reveal on load, "5.0 on Google" chip |
| 2 | trust | Owner-operated · No subcontractors · Free measure & quote · 5.0 on Google · Brisbane-wide |
| 3 | `#collection` | 5 product cards (plantation, security, outdoor/aluminium, fly screens, blinds). Click pre-ticks the product in the form |
| 4 | `#shane` | "You'll deal with Shane. Start to finish." Real install photo + typography, no photo of Shane |
| 5 | `#difference` | Before/after sliders, the 2 genuine pairs. Drag, touch, arrow keys; one gentle nudge on first view |
| 6 | `#work` | 12-photo editorial grid + lightbox (keyboard, prev/next) |
| 7 | `#process` | 4 steps |
| 8 | `#materials` | PVC vs basswood vs aluminium |
| 9 | `#reviews` | The 4 real Google reviews, verbatim, first name + date, "5.0 on Google", link to the profile |
| 10 | `#leave-a-review` | "Happy with your shutters? Tell Brisbane." Gold button → `review.html`, QR, support line |
| 11 | `#areas` | The 35 areas from his current site, grouped into 6 regions |
| 12 | `#faq` | 8 FAQs (native accordion) + FAQPage schema |
| 13 | `#quote` | Form: name, mobile, suburb (35 areas), product chips, message, honeypot, success state |
| 14 | footer | Phone, email, hours, nav, "Leave a Google review", privacy placeholder (`/privacy`) |
| M | mobile bar | "Call Shane" / "Free Quote". Shows after the hero, hides while the form is on screen |

Schema: `HomeAndConstructionBusiness` (phone, email, 35 `areaServed`, hours, logo, images, sameAs FB/IG/GBP),
5 `Service` entries, `FAQPage`. **No AggregateRating** (Google treats self-served review stars as ineligible).

Phone: `#nb-source` holds **0411 885 227** (the number Nimbata must be set to REPLACE). Every
`[data-phone-display]` / `[data-phone-link]` re-syncs from it, same as the handyman template.
Form: posts JSON `{name, phone, suburb, issue, isUrgent, products, message, source}` to
`/functions/v1/send-lead-notification`.

## Pulled from his current site vs new

**From his site / Google (verified):** name, phone 0411 885 227, email, hours, owner name, "No sales reps. No
subcontractors.", family-owned, free measure & quote, "most homes installed in a single day", product list
and wording (PVC/timber, bay/arched/odd shapes, stainless mesh, rust-proof/rot-proof/warp-proof aluminium,
powder-coated, sliding screen doors, blockout/motorised blinds), "flexible payment options", the 35 service
areas, 47 real install photos, both real before/after pairs, the 4 Google reviews (verbatim, typos kept).

**New:** all design and copy structure, the materials guide, process, FAQ wording (rewritten so nothing
unverified is claimed), review band, `/review` page and the review-request sequence, schema, image
optimisation (117 MB → 6 MB).

**Deliberately left out:** the AI "Shane", the AI before/afters, all stock/supplier images, the 13 page
testimonials that aren't on Google ("Karen M" etc.), "15 years", "Founded in 2010", "15-30 / 30 year
warranty", "lifetime guarantee", "certified technicians", "meets Australian standards", brand names, QBCC, ABN.
Warranty is worded as "manufacturer's warranty + SR workmanship guarantee, terms in writing with your quote".

## Review-generation system

1. **Branded link:** `srshuttersandscreens.com.au/review` → `review.html`. Big gold "Leave a Google review"
   button and a QR, both reading one const, `GOOGLE_REVIEW_URL` at the top of the page script (also in
   `index.html` for the QR in the review band). **It currently holds the working write-review fallback for the
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
- **A real photo of Shane** on the job (the positioning block is built to take one)
- Photos of **outdoor/aluminium shutters and fly screens** (those cards use CSS art for now), and whether `security-screens-patio-windows-01` and the bay-window shot are his jobs
- Suburbs for the 4 reviewers, if he knows them (cards show first name + date only)
- Quote turnaround and lead times (copy says "clear written quote" and "single day install" only)
- Base suburb and real service radius (Gold/Sunshine Coast are on his current list)

## Lovable / launch

Same pattern as Northland: the static file is the design source; Lovable gets it as the build brief.

- Routes that would become pages: `/` (this file), service pages `/plantation-shutters-brisbane`,
  `/outdoor-aluminium-shutters-brisbane`, `/security-screens-brisbane`, `/fly-screens-brisbane`,
  `/blinds-brisbane`; guide pages (`/pvc-vs-basswood-vs-aluminium`); 20–30 **genuinely unique** suburb pages
  `/areas/[suburb]` (real jobs + local review each, replacing the 68 clones with 301s); `/reviews`; `/review`
  (this `review.html`); `/gallery`; `/privacy`.
- Keep the Nimbata DNI script in the root layout; `#nb-source` carries 0411 885 227.
- Form: static file uses `/functions/v1/send-lead-notification`; the Lovable build uses its own
  `/api/public/enquiry` → Resend to hello@leadhivenz.com (add srshuttersnscreens@gmail.com as second recipient).
- Reviews: move the 4 cards to a JSON/config list (or a cached Places API pull) so new reviews drop in.

Launch checklist:
1. Confirm the list above with Shane; add QBCC/ABN/warranty only once confirmed.
2. Paste the real review link into `GOOGLE_REVIEW_URL` (both files) and test in a private window.
3. Build in Lovable, publish, attach the domain, 301 the old suburb/thank-you/maintenance URLs.
4. Create the Nimbata project with 0411 885 227 as the number to replace; confirm the swap live.
5. Send a test enquiry end to end; set up the Make/GHL review sequence and print the QR cards.
