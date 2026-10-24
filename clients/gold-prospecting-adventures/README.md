# Gold Prospecting Adventures — brochure site

Client: **Ian Lawson**, Gold Prospecting Adventures, Murchison (Tasman), New Zealand.
Phone **022 533 5445** (`tel:+64225335445`). No email yet, no booking system: the phone
number is the call to action on every page (hero, header, sticky mobile bar, call band, footer).

Offer: guests stay at Ian's place in Murchison and go gold panning / recreational prospecting
in the local rivers with him.

## What was built

A 5-page static site. Plain HTML + one CSS file + a few lines of vanilla JS. No framework,
no build step, no external dependencies other than Google Fonts.

| File                 | Page                          | H1                               |
|----------------------|-------------------------------|----------------------------------|
| `index.html`         | Home                          | Gold Prospecting Adventures (sign) |
| `the-adventure.html` | The gold panning experience   | The gold panning adventure       |
| `stay.html`          | Staying at Ian's place        | Your base in the hills           |
| `getting-here.html`  | Murchison, drive times, map   | Getting to Murchison             |
| `contact.html`       | Call Ian                      | Call Ian                         |

```
assets/css/style.css     all styles (palette + fonts as CSS custom properties at the top)
assets/js/main.js        mobile menu, hides any missing photo, footer year
assets/img/              photos, logo.svg (full badge), logo-mark.svg (header mark),
                         grain-paper.svg / grain-wood.svg / torn-edge.svg (textures)
assets/img/PHOTO-CREDITS.md   source + licence for every placeholder photo
favicon.svg              simplified mark
sitemap.xml, robots.txt
screens/                 Playwright first-screen renders of each page at 390x844
                         (`*-mobile-fold.png`) and 1440x900 (`*-desktop-fold.png`)
```

### Design

- **Look:** hand-painted wooden signage, aged paper and hammered gold. Wood is CSS gradients
  over an SVG turbulence grain (`grain-wood.svg`); paper is an SVG noise tile with a vignette;
  torn paper edges are an SVG mask (`torn-edge.svg`); gold nail heads are radial gradients.
  No raster textures.
- **Palette** (`:root` in `style.css`): timber `#2B1D12`, walnut `#5A3A22`, paper `#F1E6CF` /
  `#E8D9B8`, antique gold `#C9972B` / highlight `#E6B84A`, river stone `#6E6A62`, bush green
  `#2F4A36`, ink `#1B140E`. Two darker text-only variants keep small text at WCAG AA on paper:
  `--gold-ink #7A5414` and `--stone-ink #5B574F`.
- **Fonts** (Google Fonts, `display=swap`, preconnected): **Rye** for the wordmark and page-hero
  titles only, **Alfa Slab One** for headings and buttons, **Lora** for body text.
- **Logo:** `assets/img/logo.svg` is a placeholder badge: round timber plaque, gold rope ring,
  "GOLD PROSPECTING ADVENTURES" around the top rim and "MURCHISON · NEW ZEALAND" around the
  bottom, crossed pick and shovel behind a gold pan with a nugget, three stars. The rim text is
  converted to outlines, so it renders identically everywhere (no font needed).
  `logo-mark.svg` (header) and `favicon.svg` are the same emblem without the text.

## Confirm with Ian before launch

Everything below is written so it stays true, but Ian should check it. Items marked in the HTML
with `<!-- CONFIRM WITH IAN -->` are the ones most likely to need a wording change.

1. **"All panning gear supplied"** (the-adventure.html, kit list). Does he supply pans and
   tools for everyone? Anything guests should bring themselves (gumboots, waders)?
2. **"You keep what you find"** (the-adventure.html stamp). Confirm guests keep their gold.
3. **"A bed at Ian's place"** listed under Supplied. Confirm accommodation is always included
   with the panning (or whether day trips without a stay are possible).
4. **Rooms, beds, meals, maximum group size.** Not stated anywhere; the copy says "talk to Ian".
   If he gives us numbers (e.g. "sleeps 4, breakfast included") add them to the stay page
   "Good to know" list.
5. **Prices, season and minimum stay.** Not stated; copy says "call Ian for dates and prices".
6. **Best times to call** (contact.html): we wrote "often out on the river during the day...
   early mornings and evenings are usually easiest". Confirm, or give actual hours.
7. **Texting.** contact.html has an "Or send Ian a text" button (`sms:` link) and the copy says
   he will call back after a text. Remove if he prefers calls only.
8. **Breakfast at the house** (adventure "A day" timeline: "Breakfast and a game plan") and
   "Back to the homestead" in the evening. Fine if he's happy with that framing.
9. **Who it suits:** we say families, retirees and overseas visitors are welcome, and to mention
   kids' ages or limited mobility when calling. Any age limits?
10. **Rivers:** deliberately not named. No specific fossicking area is described as "where we go".
11. **Murchison township** is described as having cafés, a pub, a general store and fuel, and a
    local museum (getting-here). True of the town today, but worth a glance.
12. **Drive times** are the approximate figures from the brief: Westport ~1h20, Nelson ~1h45,
    Hanmer Springs ~2h15, Blenheim/Picton ~2h30 (Picton a bit longer), Christchurch ~4h.
13. **Geo coordinates** in the JSON-LD are Murchison township (-41.8036, 172.3263), not the house.
14. **Photo of the house.** `homestead.jpg` is currently a bush-and-river landscape, NOT his house.
    The stay page hero is written as "Your base in the hills" so it works with a landscape, but
    we need a real photo of the house/verandah (and ideally Ian on the river) before launch.

## Swapping the photos, logo and domain

**Photos.** All photos are placeholders from Wikimedia Commons; sources, authors and licences are
in [`assets/img/PHOTO-CREDITS.md`](assets/img/PHOTO-CREDITS.md). Several are CC BY / CC BY-SA, so the
footer carries a small "Photo credits" line on every page. To swap a photo, overwrite the file
with the same name (16:9, about 1920x1080, JPEG under ~400 KB) and update its `alt` text in the
HTML. When all CC BY / CC BY-SA images have been replaced with Ian's own photos, delete the
`<p class="credits">` line from the footer of each page. If a photo file is missing, the frame
shows a tinted background with a faint logo instead of a broken image.

Current placements:

| File | Used on |
|---|---|
| hero-river.jpg | Home hero, Open Graph / Twitter image on every page |
| gold-pan.jpg | Home card 1, Adventure "who it suits" |
| panning-action.jpg | Home card 2, Adventure hero |
| sluice-box.jpg | Home card 3 |
| homestead.jpg (placeholder landscape) | Home "Stay with Ian", Stay hero |
| buller-panorama.jpg | Home full-width band, Stay intro, Contact hero |
| murchison-valley.jpg | Getting Here hero, Contact location |
| lewis-pass-river.jpg | Getting Here "What the drive is like" |
| nuggets.jpg | Adventure intro |
| lamp-evening.jpg | Stay "Evenings on the verandah", Contact |
| heritage-coach.jpg, heritage-gorge.jpg | Home heritage postcards; Adventure history (gorge) |

`gold-pan.jpg`, `sluice-box.jpg` and `lamp-evening.jpg` are portrait shots padded to 16:9, so
they are shown in portrait (3:4) frames. Ian's own photos can be any orientation.

**Logo.** Replace `assets/img/logo.svg` (full badge, square) and `assets/img/logo-mark.svg`
(square, reads at 46px) with the final artwork, keeping the file names; also update
`favicon.svg`. PNG is fine too if the `src` attributes are changed to match.

**Domain.** The placeholder domain is `https://www.goldprospectingadventures.co.nz/`. When the
real domain is known, find-and-replace it across all five `.html` files (canonical, Open Graph,
Twitter, JSON-LD), `sitemap.xml` and `robots.txt`.

## SEO

- Unique `<title>` (all under 60 characters) and meta description per page, aimed at
  "gold panning Murchison", "gold prospecting tours New Zealand", "gold panning experience
  South Island", "Buller gold panning" and "things to do Murchison".
- Canonical, Open Graph and Twitter card tags on every page; `lang="en-NZ"`.
- JSON-LD: home has `TouristAttraction` + `LodgingBusiness` (name, phone, address, geo,
  areaServed, images, logo) plus a `WebSite`, and an `FAQPage` matching the visible FAQ word
  for word. Inner pages have `BreadcrumbList` matching the visible breadcrumb.
- `sitemap.xml` and `robots.txt` at the site root. Submit the sitemap in Google Search Console
  once the domain is live.
- One `h1` per page, descriptive link text, every image has `alt`, `width` and `height`.

**Google Business Profile reminder:** the single biggest thing for "gold panning Murchison"
searches is a Google Business Profile. Set one up for Gold Prospecting Adventures (category
e.g. "Tour operator" / "Tourist attraction"; service area Murchison / Tasman / Buller; phone
022 533 5445; website = the new domain), verify it, add Ian's own photos, and ask happy guests
for Google reviews. Keep the name, phone and town identical to the website.

## Hosting

Static files: upload the whole `gold-prospecting-adventures/` folder (minus `screens/` and this
README if you like) to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel, or
plain cPanel hosting). No server code, database or build step. Lovable is not required. Pages
use `.html` URLs so they work on any host without rewrite rules.

## Checks done

- Every internal `href`/`src` and every CSS `url()` resolves; no duplicate ids; HTML tags
  balance; all JSON-LD parses; titles/descriptions within length (Python checker).
- No horizontal scroll at 320, 375, 390 and 1440 px.
- Rendered at 390x844 and 1440x900 with Playwright; see `screens/`.
