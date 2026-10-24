# Design notes: Gold Prospecting Adventures restyle

Brief from Joe: keep it rustic Central Otago, drop the "old Western cartoon" look (Rye lettering,
hanging ropes, nail heads, torn paper on every section), and present it the way the region's
better wineries, lodges and heritage businesses do.

## What we looked at (October 2026)

Fonts were read from each live page's computed styles; the look was judged from 1440px screenshots.

| Site | Type | Takeaway |
|---|---|---|
| **Cardrona Distillery** (cardronadistillery.com) | EB Garamond for everything; nav in uppercase with ~0.1em tracking | One classical serif carries the heritage. Dark, quiet barrel-room photo; the only "rustic" note is the photography. Buttons are 1px outlined rectangles. |
| **Olivers, Clyde** (olivers.co.nz) | Operetta (high-contrast display serif) for headings, Proxima Nova Light for body and nav | 1860s stone buildings, but the site uses a big light serif and plenty of air. Charcoal nav with small tracked labels in tussock gold, and olive/tussock bands (#9C8B5E-ish) behind cream cards. The schist texture is a thin strip, not a costume. |
| **Amisfield** (amisfield.co.nz) | Untitled Sans 12px uppercase for UI, Signifier Light serif for headings | Warm off-white (#F8F7F2), a large photo of a schist gable, hairline rules between nav items, one flat terracotta button. The stone and corrugated iron in the photos supply all the texture. |
| **Chard Farm** (chardfarm.co.nz) | Heldane serif, uppercase with tracking for labels; Söhne for nav | Charcoal #292929, thin 1px outline buttons with uppercase serif labels. Restrained and confident. |
| **Minaret Station** (minaretstation.com) | Proxima Nova Light at large sizes, Inter Tight for UI | Lodge site: white space, big statement sentences in a light weight, earthy brown (#584528) as the only accent. |
| **Lakes District Museum, Arrowtown** (museumqueenstown.com) | The Seasons (soft high-contrast serif) + Articulat sans | Shows heritage without props: a confident modern serif in a mustard gold and deep gold-brown (#5F4009) palette. |
| *Counter-example:* **Goldfields Mining Centre** (goldfieldsmining.co.nz) | League Gothic + Gotham in heavy tracked caps | The closest competitor in subject. The heavy condensed poster type and yellow "BOOK ONLINE!" read as a tourist attraction. This is the look to avoid. |

Also checked but not used: Rippon (Larken serif on #FFFAF5 cream), Kinross (GT Canon serif with
Poppins on #EFEFEF), Gibbston Valley, The Camp. Most were behind age gates or cookie overlays, and
they showed the same patterns.

**Common patterns:** one good serif for headings (usually light to regular weight, never a novelty
face); a plain sans in small tracked capitals for nav, eyebrows and buttons; a warm off-white page
with dark charcoal or brown text; gold, ochre or tussock used sparingly as the accent; big, quiet
photography with generous margins; texture in the photos instead of the CSS; flat rectangular
buttons with no bevels; thin rules instead of boxes.

## Decisions for this site

- **Type.** Headings use **Fraunces** (Google Fonts) at weight 350 to 500 with the SOFT and WONK
  axes set to 0. That gives a warm, slightly old-style serif with some 19th-century character,
  without the wild-west costume. Body, nav, labels and buttons use **Inter**: 17px body, and
  12 to 13px uppercase with 0.14 to 0.2em tracking for eyebrows, nav and buttons. Rye, Alfa Slab
  One and Lora have been removed.
- **Palette.**
  - Warm cream `#F3EEE4` for the page, with alternate sections in pale corrugated iron `#E4E0D7`
    (rules in `#D9D6CF`).
  - Schist grey `#4A4A48` for body text, and a darker `#5E5C57` for muted text so it passes AA.
  - Near-black timber `#211A15` for headings and dark bands.
  - Antique gold `#C9972B` for primary buttons only, tussock `#C8A24A` for accents on dark,
    `#7A5A1A` for gold text on cream.
  - Beech green `#3F5243` is kept only for small icons.
- **Surfaces.** Each page has at most one dark timber band plus the footer. Both have a very
  faint wood grain (the existing SVG at about 5% opacity). Cream sections carry a barely visible
  paper grain. There are no torn edges, ropes, nail heads, planks, bevels or drop-shadowed
  wordmarks.
- **Layout.** Max content width is 1140px. Sections have 96 to 144px of vertical padding on
  desktop. Photography is larger, with no chunky frames: images are flush, and 1px hairlines
  appear only where an image sits on the same colour as its background. Section headings are
  left-aligned with a short gold hairline before the eyebrow.
- **Hero.** The full-bleed river photo carries the page, with the wordmark set large in Fraunces
  over a soft bottom scrim. The signboard and its ropes are gone. The round logo badge stays as
  the header mark and in the footer. The drive-time fingerposts are now a slim strip of tracked
  capitals with hairline dividers at the foot of the hero.
- **Heritage cues** come from the c.1900 Buller Gorge postcards (shown as plain prints with a
  thin cream border, barely tilted), the gold accent, the serif, and the copy. The gold
  hairline-and-nugget ornament appears at most twice per page.
- **Buttons and forms.** Buttons are flat rectangles with 2px corners and uppercase Inter labels.
  Primary is solid gold with dark text, secondary is a 1px outline. Form fields are white-ish
  with a 1px schist rule and a gold focus ring, with small tracked labels.
- **Phone first.** The gold Call Ian button stays the primary action everywhere. The enquiry
  form is secondary: it sits beside the phone block on Contact, beside the closing call panel on
  Home, and gets a quiet "or send an enquiry" link in the other pages' call bands.
