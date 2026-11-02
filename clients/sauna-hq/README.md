# Sauna HQ quote builder

Single-file quoting tool for Sauna HQ (Marko Tossavainen, Dandenong South VIC). Room size in,
every timber costed at the lengths boards are bought in, Narvi heater sized from the room
volume, materials order list and client quote text out. Calibrated against the Suren
Chandrajit job (2010 x 1320 x 2100) and Marko's own costing spreadsheet.

## Files

- `quote-builder.html`  the whole app: markup, CSS, JS and the Sauna HQ logo embedded. No build step, no server code.

## Hosting

It is one static file. Any of these work:

1. **Netlify Drop** (fastest): drag the `sauna-hq` folder onto https://app.netlify.com/drop, rename the file to `index.html` first if you want the bare URL.
2. **Vercel / Cloudflare Pages / GitHub Pages**: point at this folder, no framework, no build command.
3. **Lovable**: paste the file as a static page if you want it alongside the other client sites.

Put it behind a password (Netlify site protection, Cloudflare Access, or a basic-auth rule on
the host). It carries Marko's buy prices and markup, so it should not be publicly indexable.
The file already sets `noindex,nofollow`.

Fonts load from Google Fonts. Everything else is inline, so it also runs from a local file.

## What works where

| Feature | Hosted on your own domain | Claude artifact link |
|---|---|---|
| Costing, materials list, client quote | yes | yes |
| Rates and standards editing | yes | yes |
| "Read the plans or a photo" with Claude | hidden (needs the Claude viewer) | yes |

The plan reader calls Claude through the artifact runtime and only appears inside
claude.ai. On a normal host the card stays hidden and Marko types the sizes.

## Where the numbers live

Rates and standards save in the browser's local storage on the machine Marko uses. They are
not on a server. Use **Rates and standards > Copy rates** to back them up or move them to
another computer, and **Import pasted rates** on the other end. To change the shipped
defaults for everyone, edit `DEFAULT_RATES` near the top of the `<script>` block.

## Loaded rates (2 Nov 2026, from Marko)

- Cedar 85 x 12 lining $17.80/lm (80 cover), 90 x 35 planks and cleats $38.50, 90 x 17 infill and backrest $28.50, trims $6.50.
- Alder 120 x 15 lining $16.80/lm (107 cover), 120 x 28 planks $29.00, 90 x 15 infill and backrest $17.00, trims $6.00.
- Accoya 140 x 15 lining $22.10/lm (124 cover), 140 x 20 planks $23.70, 140 x 15 infill and backrest $23.20, trims $7.90.
- Black aluminium skirting $58.50 per 3.6 m length.
- Narvi residential and commercial price lists (retail inc GST, October 2023 lists, due for a refresh).

## Still to fill in

- Glazing rate per m2 (placeholder $950).
- Medium and large job flat rates (only the small-job tier is calibrated).
- Backrest: priced as 3 rails of the infill board. Marko's sheet carried $315 for the Chandrajit backrest, the material alone is $180, so confirm what else is in his number.
- Heater prices once Marko refreshes the lists. From January all heaters ship with a Wifi controller; the Wifi upgrade line is hidden (rate 0) and can be switched back on under Rates for old stock.
