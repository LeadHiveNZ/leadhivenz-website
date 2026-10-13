# GJS Plumbing, Drainage & Gasfitting NZ Ltd — website

Client: **GJS Plumbing, Drainage & Gasfitting NZ Ltd** (Graham & Scott), 140 Juliet Street, Stratford 4332, Taranaki.
Full multi-page brochure website (not a landing-page template). Static HTML + CSS + JS, no build step.
Open `index.html` in a browser to preview; every page is a separate file.

## Pages

| File                 | Purpose                                              |
|----------------------|------------------------------------------------------|
| `index.html`         | Home                                                 |
| `services.html`      | Services hub                                         |
| `plumbing.html`      | General & maintenance plumbing                       |
| `drainlaying.html`   | Drainlaying & drainage                               |
| `gasfitting.html`    | Gasfitting                                           |
| `hot-water.html`     | Hot water (cylinders, heat-pump, continuous flow)    |
| `emergency.html`     | 24/7 emergency plumbing                              |
| `renovations.html`   | New builds, renovations, bathrooms, rural            |
| `about.html`         | About / team                                         |
| `gallery.html`       | Our work                                             |
| `service-areas.html` | Taranaki service areas                               |
| `contact.html`       | Contact details + quote form                         |

Shared: `styles.css`, `main.js`, `assets/`.

## Facts used (verified)

- Phones: office **06 765 8423**, Graham **027 4555 270**, Scott **027 4555 271** (from their Facebook banner).
- Email **grahamgjs@xtra.co.nz**. Address **140 Juliet Street, Stratford 4332** (Chamber of Commerce / Yellow listings; "40" visible on the workshop sign).
- Master Plumbers member (badge on their banner; listed on dontriskit.co.nz as GJS New Zealand Ltd).
- 24/7 call-out service (stated on their Facebook page). "Stratford based, Taranaki wide".
- Facebook: https://www.facebook.com/GJS.NZ.LTD/

## Build notes

- `styles.css` holds the whole design system (sections 1–33) plus a page-specific section (34) at the end.
  `main.js` handles the mobile menu, services dropdown, reveal-on-scroll, FAQ, gallery lightbox and the quote form.
- `_partials.md` documents the shared header/footer blocks and every component's markup. Keep the header and
  footer byte-identical across pages (they currently are — a script checked the hashes).
- Logo assets were cut from the Facebook banner (transparent PNGs, dark letters, so only for dark backgrounds).
- Brand blue sampled from the logo: `#07AAE8`. Blue buttons use near-black text for contrast.
- Checked at 360 / 768 / 1440 px on every page: no horizontal overflow, no console errors, one `<h1>` per page,
  titles ≤ 60 chars, descriptions 140–160 chars, all local paths resolve.

## Placeholder photography

Stock photos come from Unsplash (`images.unsplash.com/photo-<id>`) with an `onerror` fallback to the branded
`assets/ph-*.svg` panels, so a missing image never shows as broken. The build sandbox could not reach Unsplash,
so the IDs are unverified: if any photo's subject looks wrong in the browser, swap the ID or replace it with a
client photo. Search the HTML for `images.unsplash.com` (and `PLACEHOLDER PHOTO` in `gallery.html`).

## Confirm with Graham before launch

- **Hours**: site shows Mon–Fri 7:30am–5pm + 24/7 emergency. Edit in the footer of every page and on `contact.html`.
- **Testimonials** are SAMPLE copy (each marked with an HTML comment). Replace with real Google / Facebook reviews.
- **Photos**: placeholder photography loads from Unsplash with a branded SVG fallback. Swap for the client's own job photos in `assets/` and update the `<img>` tags (search for `images.unsplash.com`).
- **Services**: rural / farm plumbing and septic work are listed — confirm they do these. Gas certification wording assumes they issue Gas Certificates (standard for a licensed gasfitter).
- **Team**: Graham is shown as "Owner & Plumber", Scott as "Plumber". Confirm titles and whether they want photos.
- **Claims to check**: council drainage inspections booked and as-builts supplied; septic and sewer connections; gas leak repairs; LPG and natural gas; rental/property-manager maintenance; "we install Ecospring and other systems"; after-hours call-out charges (worded softly, no figures); travel charges (FAQ says confirmed when booking).
- **Place names** use macrons (Ōākura, Pātea, Ōkato, Hāwera, Ōpunake). Change if Graham prefers otherwise.
- **Form**: the quote form shows a success message only; wire it to the Lovable `/api/public/enquiry` route (Resend) when the site is built out, or a Formspree/Netlify endpoint if hosted statically.
- **Tracking**: add Google Analytics / Ads tags in the `<head>` of every page before launch.
- **Nimbata**: if this site is used for LeadHive ads, the tracked number must replace 06 765 8423 on every page (`a[href="tel:+6467658423"]`).
