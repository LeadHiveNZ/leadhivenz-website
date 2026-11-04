# Nuvia Health — premium website demo

Client: **Nuvia Health** (contact: Sumit), multi-service healthcare clinic, Notting Hill VIC 3168
(Melbourne south-east, next to Monash Uni Clayton). Mobile **0468 330 003** (+61 468 330 003),
sumitsheoran88@gmail.com.
Deal: website demo request via the LeadHive form on 26/10/2026. Joe replied on 29/10 asking for a
logo, photos and the services list. **Nothing has been received yet**, so the demo treats Nuvia as a
new or pre-launch clinic. Every business fact we don't have is a clearly marked placeholder, and
nothing is invented (no AHPRA numbers, review counts, years in business or accreditation).

Single self-contained file: `nuvia-health.html` (~106 KB, inline CSS/JS/SVG, Google Fonts and
Unsplash photos are the only external requests). Business facts live in the `CONFIG` block at the
bottom of the file (marked `▼ CONFIG ▼`). Services, pillars, fees, team, FAQ, hours, trust strip,
contact details and hero copy all render from it.

## Brand

- Typographic wordmark "NUVIA / HEALTH" (Cormorant Garamond, letter-spaced) with a small gold "N"
  ring mark, inline SVG. Black on light styles, white on the dark nav and in the footer. No logo
  file was supplied.
- Gold `#C9A227` / `#B8922A`; buttons use a subtle metallic gradient `#E3C25B → #B8912B` with
  black text. Gold body text uses `#8C6A22` for contrast.
- Ink `#0B0B0C`, secondary `#5B5B60`, ivory `#FAF7F0`, warm grey `#F3F1EC`, rules `#E6E2D8`.
- Cormorant Garamond (display) + Manrope (body). One gold line-icon set (inline SVG, 1.5 stroke)
  for every service, value and trust item.

## Three front-page styles

Open `nuvia-health.html` in a browser and add `?style=1`, `?style=2` or `?style=3`. The black
"preview" pill top-right switches between them. It is **dev-only** and not part of the client site.

| Style | Direction | Hero |
|---|---|---|
| `?style=1` (default) | Editorial luxe: ivory, serif, gold hairlines | "Thoughtful healthcare, close to home." Split layout, tall arched photo with an offset gold frame |
| `?style=2` | Dark concierge: near-black, full-bleed photo | "Healthcare that *listens*." White serif, "listens" in gold italic; services grid also goes dark |
| `?style=3` | Modern clinical: warm grey, all-sans | "Your GP, mind and body care, under one roof." In-hero booking card: In clinic / Telehealth, GP · Mental Health · Weight Management pills, next six open days, Book |

Every hero has a gold "Book an appointment" button, a ghost "Call 0468 330 003" button, the microcopy
"New patients welcome · Medicare rebates may apply for eligible patients" and the trust strip.

## Page sections

Black utility bar · sticky nav (Services, Mental Health, Weight Management, Team, Fees, Contact +
Book appointment; hamburger under 1180px) · hero + trust strip · three pillars · 12-service grid
("Care for the whole person.") · How it works ("Seeing us is simple.") · weight management feature ·
mental health band (full black, crisis line) · Why Nuvia (4 value cards) · telehealth band · fees
table (all TBC) · team (3 placeholder cards) · what patients value + Google badge (placeholder, no
rating) · location (hours, map embed with styled fallback) · FAQ (8) · booking form (in-page success
state) · final black CTA · footer (Acknowledgement of Country, 000 line, legal links, ABN) · mobile
sticky Call/Book bar.

Each service card's "Book" link, and the pillar and feature CTAs, pre-select that service in the
form. The style-3 booking card also writes the chosen day and mode into the message field.

## Placeholders to confirm with Sumit

| Item | Where in CONFIG / page | Current value |
|---|---|---|
| Street address, parking, public transport | `business.address`, `business.transport`, JSON-LD `streetAddress` | "Street address to be confirmed", Notting Hill VIC 3168 |
| Opening hours, and whether the clinic is open yet | `hours`, JSON-LD | Mon–Fri 8am–6pm, Sat 9am–1pm, Sun closed (template) |
| Doctors: names, roles, FRACGP/VR, photos, interests, languages | `team` | "Dr A. Sharma / Dr J. Lee / Dr R. Patel", initials avatars, labelled "Placeholder" on page |
| Fees, Medicare rebates, gap, bulk-billing rules | `fees`, `feeNote`, FAQ "Do you bulk bill?" | every cell "TBC"; "Bulk billing may be available for eligible patients" |
| Trust strip claims | `trust` | AHPRA-registered practitioners · Medicare rebates may apply · In-clinic & telehealth · New patients welcome |
| Accreditation (AGPAL/QPA) and MyMedicare | not shown | Deliberately **not claimed** until confirmed |
| Telehealth availability and rules | utility bar, telehealth band, FAQ | Shown as available "for eligible patients" |
| Booking system (HotDoc, HealthEngine, Cliniko or phone only) | all "Book" CTAs point to `#book` | Swap to the booking URL once known; "Book online in under a minute" assumes online booking |
| Languages spoken | FAQ "Which languages do you speak?" | Interpreter wording, languages TBC |
| OSHC billing | FAQ "Do you accept OSHC…?" | "Call to confirm" wording |
| Services actually offered | `services` | All 12 from the brief; remove any not offered |
| Google Business Profile | `business.googleReviewsUrl`, reviews badge | Search link; badge shows no rating, marked "Placeholder" |
| ABN | `business.abn` | "ABN to be confirmed" |
| Clinic email | `business.email` | Sumit's Gmail (swap for a domain address) |
| Domain | JSON-LD `url` | `https://www.nuviahealth.com.au/` assumed |
| Logo | wordmark is inline SVG | No file received; current wordmark is our proposal |
| Photos | Unsplash (illustrative, uncaptioned) | Replace with real clinic and team photos |
| Privacy Policy, Complaints, Terms | footer links | Pages not written yet (links are placeholders) |
| Form endpoint | `form.endpoint` | Blank: submit shows the success state only, no lead is sent |

## Compliance notes applied

- **AHPRA (National Law s133): no testimonials about clinical care.** There are no patient quotes or
  star ratings. "What patients value" lists only non-clinical points (easy to book, seen on time,
  feeling listened to, clean and calm space), and the Google badge shows no number.
- **TGA: no advertising of prescription weight-loss medicines.** No named medicines, no stand-in
  terms ("weight loss injections", "GLP-1", "jab"), no kg figures, no before/afters, no outcome
  promises. Copy says "medically supervised weight management" and "where clinically appropriate,
  all available treatment options". Microcopy: "Treatment is individual and suitability is
  determined by your doctor. Individual results vary."
- No "specialist" for any practitioner ("GP with an interest in…"). No "best", "#1", "cure",
  "transform" or guarantees. "Medicare rebates may apply", "eligible patients", "where eligible"
  throughout.
- Crisis and emergency lines: the mental health band has "In crisis? Call 000, or Lifeline on
  13 11 14." The booking form and footer have "In an emergency call 000."
- The JSON-LD `MedicalClinic` uses placeholder address/hours and claims only `PrimaryCare`.

## Screens

`screens/` holds, for each style: `styleN-desktop.png` (1440 px full page), `styleN-desktop-first-screen.png`
(1440×900), `styleN-mobile.png` (390 px full page) and `styleN-mobile-first-screen.png` (390×844). First screens are
at 2×; full pages at 1× to keep the repo small.

To regenerate, from the repo root:

```
python3 -m http.server 8765 --bind 127.0.0.1 &
node clients/nuvia-health/shoot.js both
```

`shoot.js` (Playwright, `chromium.launch()` with no options) also runs the automated checks: no
horizontal scroll at 390 and 1440, zero console errors, every image loaded, nav anchors resolve,
hamburger opens and closes, all 8 FAQs toggle, form validation and success state, the style pill
switches, and every mobile tap target is at least 44 px. Pass `checks` or `shots` instead of
`both` to run one half. Full-page shots at 2× are large (5–11 MB each).

## Before launch

1. Get the logo, photos, address, hours, doctors, fees and booking system from Sumit, then update CONFIG.
2. Point the Book CTAs at the real booking system, or set `form.endpoint`.
3. Write the Privacy Policy, Complaints and Terms pages.
4. Re-check every compliance point above against the final copy, especially any weight-management
   wording Sumit supplies.
5. Remove the dev preview pill (`#dev` and its script lines) and pick one hero style.
