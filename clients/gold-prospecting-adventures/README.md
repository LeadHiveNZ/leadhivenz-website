# Gold Prospecting Adventures — brochure site

Client: **Ian Lawson**, Gold Prospecting Adventures, Murchison (Tasman), New Zealand.
Phone **022 533 5445** (`tel:+64225335445`). No email yet, no booking system: the phone
number is the primary call to action on every page (hero, header, sticky mobile bar, call band,
footer). A secondary **enquiry form** sits on Contact and at the foot of Home (see below).

Offer: guests stay at Ian's place in Murchison and go gold panning / recreational prospecting
in the local rivers with him.

## What was built

A 5-page static site. Plain HTML + one CSS file + a small vanilla JS file. No framework,
no build step, no external dependencies other than Google Fonts.

| File                 | Page                          | H1                               |
|----------------------|-------------------------------|----------------------------------|
| `index.html`         | Home                          | Gold Prospecting Adventures      |
| `the-adventure.html` | The gold panning experience   | The gold panning adventure       |
| `stay.html`          | Staying at Ian's place        | Your base in the hills           |
| `getting-here.html`  | Murchison, drive times, map   | Getting to Murchison             |
| `contact.html`       | Call Ian                      | Call Ian                         |

```
assets/css/style.css     all styles (palette + fonts as CSS custom properties at the top)
assets/js/main.js        mobile menu, missing-photo fallback, footer year, enquiry form
assets/img/              photos, logo.svg (full badge), logo-mark.svg (header mark),
                         grain-fine.svg (cream sections) / grain-wood.svg (dark band, footer)
assets/img/PHOTO-CREDITS.md   source + licence for every placeholder photo
favicon.svg              simplified mark
DESIGN-NOTES.md          reference sites studied for the restyle + the decisions taken
sitemap.xml, robots.txt
screens/                 Playwright first-screen renders of each page at 390x844
                         (`*-mobile-fold.png`) and 1440x900 (`*-desktop-fold.png`)
```

### Design

Restyled October 2026 after agency feedback: still rustic Central Otago, but presented like the
region's better lodges, wineries and heritage businesses rather than an old Western. The references
and reasoning are in [`DESIGN-NOTES.md`](DESIGN-NOTES.md).

- **Look:** warm cream pages, big quiet photography, a refined serif, thin hairline rules, and
  flat rectangular buttons. Each page has at most one dark "timber" band (Home: gold-rush
  heritage; Adventure: history; Stay: evenings; Getting Here: the drive; Contact: the phone
  panel), plus the footer. Heritage comes from the type, the gold, the c.1900 Buller Gorge
  postcards and the copy. The signboard, ropes, nail heads, planks, torn paper edges and chunky
  timber frames have all been removed.
- **Fonts** (Google Fonts, `display=swap`, preconnected):
  - **Fraunces** for headings, the hero wordmark, ledes, big phone numbers and captions.
    Weights 300 to 500, optical sizing on, `SOFT` and `WONK` axes set to 0 so it stays
    classical.
  - **Inter** for body (17px), nav, buttons and labels. Eyebrows, nav and buttons are 11 to 13px
    uppercase with 0.14 to 0.24em tracking.
  - Rye, Alfa Slab One and Lora are gone.
- **Palette** (`:root` in `style.css`):

  | Role | Name | Hex |
  |---|---|---|
  | Page | cream | `#F3EEE4` |
  | Cards and form fields | cream-hi | `#FBF8F2` |
  | Alternate sections | corrugated-iron pale | `#E7E3DA` |
  | Hairlines | rule / rule-strong | `#D9D6CF` / `#BDB7AB` |
  | Body text | schist | `#4A4A48` |
  | Small muted text | muted | `#5F5D58` |
  | Decorative only | schist-2 | `#7C7A74` |
  | Headings and dark buttons | ink | `#211A15` |
  | Dark band and footer | timber | `#241D18` |
  | Primary button and ornament | gold | `#C9972B` |
  | Gold text on cream | gold-ink | `#7A5A1A` |
  | Accents on dark | tussock / tussock-hi | `#C8A24A` / `#DDBF72` |
  | Kept in reserve | beech | `#3F5243` |

  Every text pairing passes WCAG AA. The lowest are gold-ink on pale at 4.96:1 and muted on
  pale at 5.14:1; ink on the gold button is 6.5:1. Form field borders are 3.4:1.
- **Textures:**
  - `grain-fine.svg`: a very faint noise tile on the cream and pale sections.
  - `grain-wood.svg`: at 13% opacity on the dark band and footer only.
  - One ornament (hairline, gold nugget, hairline, pure CSS `.orn`), used once or twice per page.
  - The "From the pan" gallery keeps taped prints, toned down to under 1 degree of tilt and
    thin tape.
- **Layout:** content is at most 1140px wide, with 80 to 144px of section padding. Photos are
  flush, with no frames. Home hero: full-bleed photo with the wordmark set large in Fraunces
  over a soft scrim, and a slim drive-time strip at its foot. Inner heroes: full-bleed photo with
  the title bottom-left.
- **Logo:** `assets/img/logo.svg` is a placeholder badge: round timber plaque, gold rope ring,
  "GOLD PROSPECTING ADVENTURES" around the top rim and "MURCHISON · NEW ZEALAND" around the
  bottom, crossed pick and shovel behind a gold pan with a nugget, three stars. The rim text is
  converted to outlines, so it renders identically everywhere (no font needed).
  `logo-mark.svg` (header) and `favicon.svg` are the same emblem without the text.

## Enquiry form

Two placements, same fields: **Contact** (beside the phone panel, `#enquiry`) and a compact copy
at the foot of **Home** (beside the closing call panel). The other pages' call bands link to
`contact.html#enquiry` with a quiet "Prefer to write?" line. The phone number stays the primary
CTA everywhere.

- **Fields:** Name\*, Phone\*, Email, Preferred dates, Number of people (1 / 2 / 3 / 4 / 5+),
  Message, a hidden honeypot (`company`), plus hidden `form-name=enquiry` and `page`
  (Home/Contact). Under the fields: "Ian will call or text you back."
- **Markup:**
  `<form class="enquiry" method="POST" action="contact.html?sent=1" data-netlify="true" name="enquiry" netlify-honeypot="company">`
- **Behaviour** (`assets/js/main.js`):
  - Name and phone are checked client-side, with friendly inline messages, `aria-invalid` and
    focus on the first problem. An email address, if given, must look valid.
  - Without JavaScript, the native `required` attributes still apply.
  - If `window.GPA_CONFIG.formEndpoint` is set, the form POSTs JSON there with `fetch`. On success
    the form is replaced with "Thanks, Ian will be in touch" plus the phone number. On failure an
    inline error appears with the phone number. The JSON contains `name`, `phone`, `email`,
    `dates`, `people`, `message`, `page`, `form-name`, `company`, `source` and `pageUrl`.
  - If `formEndpoint` is empty, the browser does a normal form POST to the form's `action`.
  - Any page opened with `?sent=1` shows the thank-you state instead of the form. Use this as a
    redirect target.
  - A filled-in honeypot is silently "accepted" and nothing is sent.
- **Config:** each page's `<head>` has `window.GPA_CONFIG = { formEndpoint: "" };` with a comment.
  Change it on **both** `index.html` and `contact.html` (the other pages carry it for
  consistency).

**Three ways to host the form:**

1. **Netlify Forms (no backend).** Deploy the folder to Netlify. The `data-netlify` attribute
   registers the `enquiry` form at deploy time, and submissions appear under Site → Forms. Add an
   email notification to hello@leadhivenz.com (and/or Ian) in Netlify's form settings.
   - After a native submit, Netlify shows the page named in `action`, which is
     `contact.html?sent=1` on both forms, so visitors land on the thank-you state.
2. **LeadHive's Lovable + Resend route.** Same as Northland Handyman. If the site is rebuilt in
   or proxied through the Lovable project, set
   `formEndpoint: "/api/public/enquiry"` (or the full `https://…/api/public/enquiry` URL,
   which needs CORS allowing this domain). That route emails the enquiry to
   hello@leadhivenz.com via Resend. Check that its expected field names match the JSON above,
   and add Ian's address as a second recipient once he has one.
3. **Any other endpoint** (Formspree, Basin, a Cloudflare/Vercel function, Make or Zapier
   webhook). Put its URL in `GPA_CONFIG.formEndpoint`. It must accept a JSON POST, return 2xx
   on success, and allow CORS from the site's domain. Alternatively, leave `formEndpoint`
   empty and point the form's `action` at the service's form URL for a plain POST.

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
7. **Texting.** contact.html has an "Or send Ian a text" button (`sms:` link), the copy says
   he will call back after a text, and the enquiry form says "Ian will call or text you back".
   Remove if he prefers calls only.
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
14. **Photo of the house (still needed).** Ian's river and gold photos are now in, but
    `homestead.jpg` (stay page hero) is still a Commons bush-and-river landscape, NOT his house.
    The hero reads "Your base in the hills" so it works with a landscape until he sends a
    photo of the house/verandah. A photo of Ian himself on the river would also help.
15. **Guests in photos (NEW).** `ian-guest-panning.jpg` and `ian-nugget-in-hand.jpg` show guests'
    faces (home cards, adventure gallery). Ian must confirm both guests are happy to appear on
    the website. If not, swap in `ian-pan-in-creek.jpg` / `ian-gold-flakes.jpg`.
16. **Gallery wording.** The adventure page "From the pan" gallery says "Real finds from recent
    trips. No two pans are the same." and captions one photo "A good day's pan". Confirm the
    gold shown really came from his trips; the copy makes no promise about results.
17. **Where enquiries should go (NEW).** The form needs a destination before launch. Decide:
    LeadHive inbox (hello@leadhivenz.com) then forward, straight to Ian (he has no email yet;
    a text/SMS notification via a webhook is possible), or both. Then pick a hosting option
    from "Enquiry form" above. Also confirm Ian is happy to receive written enquiries at all:
    the copy promises he "will call or text you back".

## Swapping the photos, logo and domain

**Photos.** The gold, river and guest photos (`ian-*.jpg`) are Ian's own. The landscapes,
lamp, sluice box and heritage postcards are still placeholders from Wikimedia Commons. Sources,
authors and licences for everything are in
[`assets/img/PHOTO-CREDITS.md`](assets/img/PHOTO-CREDITS.md). Several Commons images are
CC BY / CC BY-SA, so the footer carries a small "Photo credits" line on every page; if a credited
photo is removed, take that author's name out of the line too. To swap a photo, overwrite the
file with the same name (same orientation; JPEG under ~500 KB) and update its `alt` text in the
HTML. When all CC BY / CC BY-SA images have been replaced, delete the `<p class="credits">` line
from the footer of each page. If a photo file is missing, the slot
shows a schist-grey background with a faint logo instead of a broken image.

Current placements:

| File | Used on |
|---|---|
| **Ian's own** | |
| ian-nugget-in-hand.jpg (3:4) | Home card 1 "Learn to pan", Adventure "From the pan" gallery |
| ian-guest-panning.jpg (3:4) | Home card 2 "Work the rivers" |
| ian-robin-pan.jpg (3:4) | Home "Stay with Ian" teaser, Adventure gallery |
| ian-bush-creek-wide.jpg (16:9) | Adventure hero |
| ian-nugget-pile-wide.jpg (4:3) | Adventure intro "Real rivers, real gravel, real gold" |
| ian-gold-flakes.jpg, ian-gravel-gold.jpg (3:4) | Adventure gallery |
| ian-pan-in-creek.jpg (3:4) | Adventure "Who it suits" |
| ian-bush-creek.jpg (3:4) | Stay intro |
| ian-nugget-pile.jpg (3:4) | Contact, beside "Best times to call" |
| ian-*-wide spares (guest-panning, pan-in-creek, gold-flakes) | Not used yet |
| **Commons placeholders** | |
| hero-river.jpg | Home hero, Open Graph / Twitter image on every page |
| sluice-box.jpg | Home card 3 "Hear the old yarns" (heritage) |
| homestead.jpg (landscape, not the house) | Stay hero |
| buller-panorama.jpg | Home full-width band, Contact hero |
| murchison-valley.jpg | Getting Here hero, Contact location |
| lewis-pass-river.jpg | Getting Here "What the drive is like" |
| lamp-evening.jpg | Stay "Evenings on the verandah" |
| heritage-coach.jpg, heritage-gorge.jpg | Home heritage postcards; Adventure history (gorge) |

`sluice-box.jpg` and `lamp-evening.jpg` are portrait shots padded to 16:9, so they are shown
in portrait (3:4) frames (`sluice-box` also gets `.ph--padded`, a slight zoom that crops its
side bars). Every photo slot sets its frame ratio (`--ar`) to match the file.

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

- Every internal `href`/`src` (including `#enquiry` anchors) and every CSS `url()` resolves; no
  duplicate ids; HTML tags balance; one `h1` per page; every `img` has `alt`/`width`/`height`;
  all JSON-LD parses; titles under 60 and descriptions 70 to 160 characters (Python checker).
- No horizontal scroll at 320, 360, 390, 768, 1024 and 1440 px (Playwright).
- Enquiry form tested in Playwright:
  - Empty submit shows both friendly errors and focuses Name. A bad email is caught.
  - With `formEndpoint` empty, a valid submit does a native POST to `contact.html?sent=1` (Netlify Forms records it).
  - With a mocked endpoint, it sends JSON and shows the thank-you state. A mocked 500 shows the
    inline error with the phone number.
  - `?sent=1` shows the thank-you state. With JavaScript disabled, the native `required` is
    still in place.
- Contrast of every palette text pairing checked against WCAG AA (see Design).
- `prefers-reduced-motion` turns off all transitions.
- First screen of every page rendered at 390x844 and 1440x900 with Playwright, after one scroll
  so lazy images load. See `screens/`.
