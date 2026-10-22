# Gold Exchange — concept preview

Client: **Gold Exchange** (goldexchange.com.au), gold buyer and refiner. Offices in Sydney CBD,
Wollongong and Newcastle (Charlestown).

Pitch: premium, scroll-driven redesign concept to replace the current WordPress/Elementor site.
This is a **bespoke build**, not a copy of a master template, so the CONFIG-only rule for the
other client folders does not apply here.

## Preview

Open `index.html` directly in a browser (double-click works; all libraries are classic scripts so
nothing needs a server) or serve the folder:

```
npx http-server clients -p 8765   # then http://127.0.0.1:8765/gold-exchange/
```

Best shown on a laptop or desktop with a mouse: the custom cursor, magnetic buttons, drag-to-spin
gold bar and the pinned horizontal gallery are the "wow" moments. It also works on mobile
(native swipe gallery, floating call bar).

## What's in it

| Section | What it does |
|---|---|
| Loader | Counter + gold bar wipe, logo on dark |
| Hero | WebGL gold ingots, coins and nuggets tumble around the headline; a field of gold dust streams toward the viewer and speeds up with scroll velocity; rotating word (gold / diamonds / jewellery / watches / bullion / coins / silver / platinum); live spot-price ticker |
| Hero scroll | Hero is pinned; headline pushes toward the camera and blurs, 3D gold flies past |
| Manifesto | Oversized statement that lights up word by word as you scroll; animated stats |
| What we buy | Pinned horizontal gallery of all 10 categories with counter and progress bar |
| Live prices | Working calculator: metal × purity × grams → indicative AUD value from live spot |
| How to sell | Sticky heading, 3 steps, gold line draws in as you scroll |
| Why choose us | 5 cards with cursor spotlight + "highest payout guaranteed" seal |
| Services | Estate jewellery, liquidators/receivers, refining & assaying — full copy with read-more |
| Investment gold | Drag-to-spin 3D gold bar rendered in WebGL |
| Reviews | Auto-advancing testimonials with word-by-word reveal |
| Locations | 3 office cards with directions + call buttons, open/closed status if hours are set |
| FAQ | Accordion |
| News | 3 latest blog posts |
| Contact | Lead form (preview only, no backend) + office phone numbers |

Files: `index.html`, `css/style.css`, `js/scene.js` (Three.js layer), `js/app.js` (GSAP, Lenis,
calculator, UI), `assets/` (logo, photos pulled from the current site).

Libraries (CDN, pinned): GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.14, Three.js 0.147 + RoomEnvironment.
Fonts: Syne (display) + Inter (body) from Google Fonts.

## Live prices

Spot prices come from `api.gold-api.com` (XAU/XAG/XPT/XPD in USD) and the AUD rate from
`open.er-api.com`, both free and CORS-enabled. If either fails the page falls back to the values
hard-coded in `js/app.js` (`PRICES`) and the label reads "Indicative spot" instead of "Live".
The calculator shows **pure-metal content at spot**, clearly labelled as indicative, not a quote.
For production, swap in the client's actual buy-rate percentages.

## Brand

Logo: the client's `GE-logo.png` (168×36, the only size on their site). `logo-dark.png` is a
recoloured copy for dark backgrounds (navy "Exchange" → ivory). Ask the client for the vector
logo before launch; the PNG is soft on retina screens.

Colours: logo gold `#F7A51C` (site uses `#FCA311`), logo navy `#1F4579`, site dark `#16202F`.
Page background is `#070A12`.

## Content sources

All copy is from goldexchange.com.au (home, services, what we buy, how to sell, buy investment
gold, FAQs, contact). Where the site had no copy (section intros, button labels, stat captions)
the wording was written to match the site's own claims only.

## Check with the client before launch

- **Phone numbers.** The current site's header and footer disagree. Used the footer values:
  Sydney (02) 9269 0061, Wollongong (02) 4225 7600, Newcastle 0499 777 662. The header lists
  (02) 9269 0061 for Wollongong and (02) 4225 7600 for Newcastle.
- **Years of experience.** Site says "30+ years" (home) and "over 25 years" (footer). Used 30+.
- **Opening hours.** Not published on the site; the location cards say "Call for today's hours"
  until `data-hours` is filled (format `Mon-Fri 9:30-17:00;Sat 10:00-14:00`), which switches on
  the live open/closed indicator.
- **Guarantee wording.** "Highest payout guaranteed", "Australia's #1 gold buyer" and "no hidden
  commissions or fees" are the client's own claims, reproduced as-is.
- **Lead form** needs a backend (same Resend route as the other LeadHive clients) and the
  client's notification email.
- **Blog images** on the current site are stock news photos; confirm licensing or replace.
