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
| How to sell | Three ways to sell (in store / by post / door to door) and the 3-step Gold Exchange Pack flow, gold line draws in as you scroll |
| Why choose us | Client's own 15-second promo reel (hotlinked from their site, muted autoplay, sound toggle), 5 cards with cursor spotlight, "highest payout guaranteed" seal |
| Services | Estate jewellery, liquidators/receivers, refining & assaying — full copy with read-more |
| Investment gold | Drag-to-spin 3D gold bar rendered in WebGL |
| Reviews | 6 testimonials (4 from the current site, 2 from the older goldexchange.net.au) with word-by-word reveal |
| Locations | 3 office cards with the site's published hours, live open/closed indicator (Sydney time), directions + call buttons |
| FAQ | All 8 FAQs from the site as an accordion |
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

Logo: the current site only serves a 168×36 PNG, but the older sister site goldexchange.net.au
serves the same artwork at 3089×636. `assets/logo.png` is that file at 1400px wide;
`assets/logo-dark.png` is a recoloured copy for dark backgrounds (navy "Exchange" → ivory).
No vector version exists anywhere online; ask the client for one before launch.
`favicon-256.png` is the X-and-swoosh symbol extracted from their favicon.

Colours: logo gold `#F7A51C` (site uses `#FCA311`), logo navy `#1F4579`, site dark `#16202F`.
Page background is `#070A12`.

## Content sources

All copy is from goldexchange.com.au (home, the 10 what-we-buy pages, services, how to sell,
buy investment gold, FAQs, contact, blog). Two extra testimonials come from the older
goldexchange.net.au, which the current site still uses for its contact email. Where the site had
no copy (section intros, button labels, stat captions) the wording was written to match the
site's own claims only. The full content pack (content.md / content.json / assets.md / brand.md)
is in the session scratchpad and worth keeping if the deal closes.

## Check with the client before launch

- **Phone numbers.** The current site's header and footer disagree. Used the contact-page
  values: Sydney (02) 9269 0061, Wollongong (02) 4225 7600, Newcastle 0499 777 662, and the
  national 1300 020 095 (used in body copy across the site) for the nav, menu and footer.
- **Years of experience.** Site says "30+ years" (home, services) and "over 25 years" (footer).
  Used 30+.
- **Opening hours.** Taken from the contact page: Sydney Mon–Fri 9–5, Sat 10:30–2:30;
  Wollongong Mon–Fri 9:30–5, Sat 9:30–4; Newcastle Mon–Fri 9:30–5, Sat 9:30–5. The older
  .net.au site lists different hours, so confirm. Hours live in each card's `data-hours`.
- **Fees.** The site says "no hidden commissions or fees" but also mentions a "small assaying
  and processing fee" for the post pack, and quotes 98–101% of market (bullion page) against
  98–100% (FAQ). The preview uses "no hidden commissions or fees" and 98–101%; confirm both.
- **Post-pack insurance.** $15,000 on the site, $10,000 in the older site's terms.
- **FAQ correction.** The site's FAQ says 22ct gold is 96.1% pure; the preview says 91.7%
  (the correct figure).
- **Business details.** No ABN, licence statement, privacy policy or terms appear on the current
  site, although the post pack asks for ID. The older site's terms carry an ABN; confirm the
  trading name, ABN and current offices with the client before publishing any of them.
- **Promo video** is hotlinked from the client's WordPress uploads for the preview; host it
  properly for production.
- **Guarantee wording.** "Highest payout guaranteed", "Australia's #1 gold buyer" and "no hidden
  commissions or fees" are the client's own claims, reproduced as-is.
- **Lead form** needs a backend (same Resend route as the other LeadHive clients) and the
  client's notification email.
- **Blog posts** are third-party news articles copied onto the site; two of their stock images
  show Bitcoin and were not used. Confirm licensing or replace with original content.
