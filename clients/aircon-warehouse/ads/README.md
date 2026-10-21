# Aircon Warehouse: trade-partner Meta ads (static images)

There are three concepts, each in three sizes. Upload the 4:5 file as the main feed creative. Use the square file for placements that need 1:1, and the 9:16 file for Stories and Reels.
The ad copy variants (A, B and C) are in `growth/content.md`, section 3. Pair each image with its variant in the same ad.

Every image carries the white logo (top-left), a navy shade over the photo, a headline in white with one phrase in the coral gradient, a badge, a coral pill reading "Apply for a trade account", and the line "09 215 9544 · airconwarehouse.co.nz".
None of them has ratings, accreditations, warranty years, prices, competitor names or emoji.

## Files

| File | Size / placement | Concept | Pairs with |
|---|---|---|---|
| trade-ad-builders-1080x1350.png | 4:5 feed (main) | A Builders & developers | Variant A |
| trade-ad-builders-1080x1080.png | 1:1 square | A Builders & developers | Variant A |
| trade-ad-builders-1080x1920.png | 9:16 story / reel | A Builders & developers | Variant A |
| trade-ad-property-1080x1350.png | 4:5 feed (main) | B Property managers | Variant B |
| trade-ad-property-1080x1080.png | 1:1 square | B Property managers | Variant B |
| trade-ad-property-1080x1920.png | 9:16 story / reel | B Property managers | Variant B |
| trade-ad-trades-1080x1350.png | 4:5 feed (main) | C Electricians, plumbers, trades | Variant C |
| trade-ad-trades-1080x1080.png | 1:1 square | C Electricians, plumbers, trades | Variant C |
| trade-ad-trades-1080x1920.png | 9:16 story / reel | C Electricians, plumbers, trades | Variant C |

## Copy on each concept

**A: Builders & developers** (`trade-ad-builders-*`)
- Photo: the real apartment build under scaffolding, with Darren pointing at the Aircon Warehouse banner. Both stay clear of the copy in every size.
- Badge: Supply only or supply & install
- Headline: 40 units? Same team, **floor by floor.** (accent)
- Sub: Trade pricing on Daikin, Fujitsu & Haier. Quotes from your plans in 1 business day.
- Ad text to use: Variant A. Headline "Trade pricing on heat pumps. Quotes from your plans.", CTA Apply Now.

**B: Property managers** (`trade-ad-property-*`)
- Photo: a modern living room with a high-wall unit on a dark feature wall (stock placeholder).
- Badge: Trade accounts · Open 7 days
- Headline: Heat pumps for your whole portfolio. **One contact.** (accent)
- Sub: Sized for the living room, installed around your tenants, paperwork for the tenancy file.
- Ad text to use: Variant B. Headline "Portfolio pricing on heat pumps. One contact, every property.", CTA Apply Now.

**C: Trades** (`trade-ad-trades-*`)
- Photo: a clean white high-wall indoor unit (stock placeholder, `high-wall-unit-closeup`). The unit sits in the upper half and the copy sits on the quiet navy field below it.
- Badge: Warehouse in Wiri · 7 days
- Headline: Add heat pumps to **your jobs.** (accent)
- Sub: Trade pricing on the unit. We install, or you do. One warranty contact.
- Ad text to use: Variant C. Headline "Add heat pumps to your jobs. Trade pricing, 7 days.", CTA Apply Now.

On every concept, the button reads "Apply for a trade account" and the footer reads "09 215 9544 · airconwarehouse.co.nz".

## Specs and checks
- The 9:16 files keep all text and the logo inside the middle 1080x1420 (y 250 to 1670). Logo top is at 290 and the copy ends at 1630. The top and bottom 250 px hold only photo or navy.
- Text coverage, measured as the union of text line boxes, logo, badge and button, as a share of the frame: builders 18 to 19%, property 21 to 23%, trades 17 to 18%. All are under 25%.
- Fonts: Plus Jakarta Sans 700/800 (headline and button) and Inter 500/600 (badge, sub, contact), loaded from Google Fonts. Colours come from `site/styles.css`: navy #111433, coral #ED1554 to sunset #F7935A, blue in the logo mark.

## Photo edits (made in `src/prep-images.py`, originals untouched)
- Apartment build (`assets/site-banner.jpg`): the "New Tech" builders' site sign, which shows another company's name and phone number, is blurred and dimmed.
- Living room (`assets/stock/living-room-heat-pump-1600.jpg`): the small manufacturer logo on the indoor unit is painted out.
- Indoor unit (`assets/stock/high-wall-unit-closeup-1600.jpg`): used as is. The only marking is a generic "INVERTER" label.
- B and C use stock photos as placeholders (see `assets/stock/CREDITS.md`). Swap them for Darren's own job photos when he has them.

## Editing and re-rendering
- `src/trade-ad-builders.html`, `src/trade-ad-property.html` and `src/trade-ad-trades.html` hold one concept each. Open one with `?size=feed`, `?size=square` or `?size=story` to preview a size. Each file has a small `<style>` block for photo framing per size. The shared layout is in `src/ads.css`.
- `node src/render.js` re-renders all nine PNGs into this folder. It uses Playwright from `/opt/node-tools`, an exact viewport, deviceScaleFactor 1, and waits for fonts. It also prints text coverage. Add `builders`, `property` or `trades` as an argument to render one concept.
- `python3 src/prep-images.py` rebuilds `src/img/` from `assets/`.
