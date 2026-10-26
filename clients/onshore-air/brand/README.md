# Onshore Air: logo refresh, round 1

Three logo concepts for **Onshore Air**, built as complete, portable logo systems, with a client presentation, mockups and a recommendation.
Prepared by LeadHive AU (Joe) for Onshore Air as a value-add. October 2026.

> **Start here:** open `presentation.html` in a browser (it is self-contained), or look at `presentation.png`.
> Mockups of each concept on a van, polo, Google profile, phone, business card and browser tab are in `screens/`.

## Client facts
| | |
|---|---|
| Business | Onshore Air, air-conditioning specialists. Based in Pacific Paradise QLD 4564, servicing the whole Sunshine Coast (Caloundra to Noosa) |
| Owner-operator | Luke |
| Services | Installations, repairs, maintenance, hydro cleaning of split systems |
| Proof points | 5.0 Google rating, 15+ years' experience, licensed and insured (ARC licence **AU067414**), free quotes, workmanship guarantee |
| Brands installed | Mitsubishi Electric, Fujitsu / General Airstage, Daikin, Hisense, Mitsubishi Heavy Industries |
| Contact | 0444 541 409 · onshoreair@outlook.com · onshoreair.com.au |
| Current logo | Gradient striped sphere with outlined, condensed yellow lettering (`reference/current-logo.png`). It cannot be embroidered, printed in one colour or read at small sizes |

## Strategy (from `research.md`)
1. Keep the circular sun/sea symbol and its warm/cool split. It is the brand's only equity, and it literally describes the product (hot outside, cool inside).
2. Rebuild it as flat geometry: 3–5 solid shapes, no gradients, no hairlines, embroidery-safe gaps.
3. Lead with deep navy. Make sun-gold the signature and ocean blue the cool counterpoint. No red (the OEM accent), no lemon yellow (Smarter Air's).
4. Replace the outlined surf-shop lettering with a heavy, kerned geometric sans, delivered as outlines.
5. Ship a full system that sits beside Daikin, Mitsubishi Electric and Airstage dealer badges, from a favicon to a 6 m van.

## The three concepts
| | 1 · Evolution | 2 · Horizon | 3 · Monogram (recommended) |
|---|---|---|---|
| Idea | Today's sphere, grown up. A diagonal S-split disc in four flat bands: heat bottom-left, cool ocean air top-right | The sun sits on one line that is both horizon and onshore breeze, rising to wrap the sun. Sun-over-sea split inside | A heavy navy O (Onshore's initial) framing the sun over a cooling wave, like a porthole |
| Wordmark | Outfit ExtraBold, +50 tracking, R–E +12 | Sora Bold, +150 tracking, word space +60 | Red Hat Display Black, +60 tracking, R–E +10 |
| Descriptor | Outfit SemiBold | Sora SemiBold | Red Hat Display Bold |
| Navy | Onshore Navy `#0B1F5C` (white on it 15.4:1) | Ink Navy `#0C1C45` (16.6:1) | Royal Navy `#0A2272` (14.1:1) |
| Brand colours | Ocean Blue `#1E7FD8` · Sun Yellow `#FFC233` · Sunset Orange `#F5871F` | Sun Gold `#F4B23E` · Sea Blue `#2A7FD4` | Signal Yellow `#FFC629` · Coast Blue `#1B8BE6` |
| On navy | Navy band turns white; descriptor in Sun Yellow (9.5:1) | Line turns white; descriptor in Sun Gold (8.9:1) | Ring turns white; descriptor in Signal Yellow (9.0:1) |

All fonts are Google Fonts under the SIL Open Font Licence 1.1. Every letter is converted to outlines, so no file depends on installed fonts. Fonts are **not** stored in this repo; `source/fetch-fonts.sh` downloads them when regenerating.

**Recommendation: Concept 3, Monogram.** It performs best where Onshore is actually seen: 16 px favicon, Google avatar, cap and polo embroidery, and next to OEM dealer badges. Its one-colour version is two solid shapes, and it keeps the sun/sea equity and colour family. The trade-off is that it drops the diagonal of today's sphere; the counter wave can tilt in round two if Luke wants it back. Evolution is the safe continuity option; Horizon is the most premium at large sizes.

## File guide
Each `concept-*/` folder holds the same set. All SVGs use flat fills only, a correct `viewBox` starting at `0 0`, no fixed width or height, and a margin of half the clear space.

| File | What it is | Use it for |
|---|---|---|
| `primary-stacked.svg` | Mark over wordmark, full colour | Business card front, square social posts, signage |
| `primary-stacked-on-navy.svg` | Same, recoloured for navy backgrounds | Website hero, dark signage, card backs |
| `horizontal.svg` | Mark left, wordmark plus "AIR CONDITIONING · SUNSHINE COAST" | Van side, invoices, quotes, email signature, desktop website header |
| `horizontal-on-navy.svg` | Same, for navy backgrounds | Website header on navy |
| `horizontal-compact.svg` / `-on-navy.svg` | Mark plus wordmark, no descriptor | Mobile header, anything under 240 px wide |
| `wordmark.svg` | ONSHORE AIR on its own | Where the mark is already present (e.g. next to the app icon) |
| `icon.svg` / `icon-on-navy.svg` | Mark only, square artboard | Profile pictures on white, stickers, sign corners |
| `icon-app.svg` | Mark on a full-bleed navy tile | Google Business Profile, Facebook and Instagram avatars, apple-touch-icon |
| `favicon.svg` | Optically adjusted cut for 16–48 px. Adapts to dark browser themes | `<link rel="icon" href="favicon.svg" type="image/svg+xml">` |
| `favicon-app.svg` | Favicon cut on the navy tile | Small avatars and tiles |
| `mono-navy.svg` / `mono-white.svg` | One-colour stacked logo, **embroidery cut** (widened gaps) | Polo and cap embroidery, engraving, one-colour print, van magnets |
| `horizontal-mono-navy.svg` / `-white.svg` | One-colour horizontal, embroidery cut | Hi-vis vests, rear windows, one-colour signage |
| `icon-mono-navy.svg` / `-white.svg` | One-colour mark, embroidery cut | Cap side, sleeve, tools, stamps |
| `png/*@2x.png` | 2× renders of every SVG (transparent) | Office documents, social schedulers, quick previews |
| `png/icon-16/32/64/180/512.png` | Icon sizes (16 and 32 from the favicon cut) | `favicon.ico` fallback, apple-touch (180), GBP upload (512) |
| `png/icon-app-*.png` | Navy-tile icon at the same sizes | Avatars that need a filled background |

Other files here: `presentation.html` / `.png` (the client deck), `screens/` (section and mockup screenshots), `research.md` (category research), `critique.md` (the iteration log), `reference/current-logo.png` (the logo being replaced) and `source/` (the generator).

## Usage rules
**Clear space.** Keep **x** clear on every side, where x is the cap height of ONSHORE in the wordmark. In the stacked and horizontal SVGs, x is exactly 100 viewBox units.

**Minimum sizes**
| Artwork | Screen | Print |
|---|---|---|
| Horizontal with descriptor | 240 px wide | 60 mm wide |
| Compact horizontal | 120 px wide | 30 mm wide |
| Stacked | 120 px wide | 25 mm wide |
| Embroidery (mono files) | n/a | 60 mm wide on a polo chest, 50 mm on a cap front |
| Icon / app tile | 64 px | 8 mm |
| Favicon cut | 16–48 px | n/a |

**Which file for which job**
- **Embroidery (polos, caps):** `mono-white.svg` on navy garments, `mono-navy.svg` on white or light garments. Send the SVG to the embroiderer to digitise; ask for a sew-out proof.
- **Van wrap or magnet:** `horizontal.svg`, scaled up as vector (never from a PNG), about 1.2–1.6 m wide on a LWB van side. Set the phone number in the concept's wordmark font, at least 120 mm cap height. Use the mono files for one-colour cut vinyl.
- **Favicon:** `favicon.svg` plus `png/icon-32.png` as fallback, and `png/icon-app-180.png` as `apple-touch-icon`.
- **Google Business Profile, Facebook, Instagram:** upload `png/icon-app-512.png`. The platforms crop it to a circle and it is designed for that.
- **Website header:** `horizontal-on-navy.svg` on desktop, `horizontal-compact-on-navy.svg` on mobile (about 30 px high).
- **Invoices, quotes, email signature:** `horizontal.svg`, or its 2× PNG where SVG is not supported.
- **Business cards:** `primary-stacked.svg` on the front, `icon-on-navy.svg` plus details on a navy back.

**Don'ts.** Don't recolour outside the palette, add gradients, shadows or outlines, stretch or rotate, or place the full-colour logo on a busy photo. On navy, always switch to the `-on-navy` or `mono-white` files.

## What to send the client (Luke)
1. `presentation.png`, or `presentation.html` as an attachment (it opens offline). Optionally the six `screens/mock-*.png` images for a quick look on his phone.
2. A short cover note, e.g.:
   > Hi Luke, here are three directions for the Onshore Air logo refresh. All of them keep your sun-and-sea circle and colours, but rebuild them so they work on the van, embroidered on polos, as your Google profile picture and as a website icon. Our pick is Concept 3, the "Monogram". Have a look at the mockups and let us know which one feels most like Onshore. We'll then do one round of tweaks and send the final files.
3. Once he chooses: one refinement round, then send that concept's folder. Before print, proof CMYK values on stock (they are not yet proofed) and run an IP Australia trade-mark search.

## Regenerating
The artwork is generated, not hand-drawn, so round-two changes are a config edit.
```bash
cd clients/onshore-air/brand/source
npm install            # opentype.js + paper. PNGs and screenshots also need Playwright with Chromium:
                       # use a global install, or: npm i -D playwright && npx playwright install chromium
npm run fonts          # downloads the six TTFs into source/fonts (git-ignored)
npm run all            # rebuilds the concept folders, PNGs, presentation and screens one level up
```
Geometry lives in `concepts/marks.js`; palettes, fonts, tracking and lockup proportions live in `concepts/config.js`.
