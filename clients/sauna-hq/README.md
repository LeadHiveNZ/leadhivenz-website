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

## Still to fill in (as of 2 Nov 2026)

- Thermo Aspen / Alder cover width and its own board count.
- Black aluminium skirting price per 3.6 m length (currently 0, quantity still shown).
- Narvi charge prices beyond NM 600, NS 600, NC 600 and Saana 680.
- Glazing rate per m2 (placeholder $950).
- Medium and large job flat rates (only the small-job tier is calibrated).
