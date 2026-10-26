# Timber & Turf: website

Static multi-page site for Timber & Turf (Chris, Manukau): fencing, concrete, landscaping, decks, steps, retaining walls and digger work across South & East Auckland.

Pure HTML/CSS/JS. No build step, no framework, no dependencies apart from Google Fonts (Barlow + Barlow Condensed).

## What's in `site/`

| Path | Page |
|---|---|
| `/` (`index.html`) | Home: hero, services grid, why us, recent work, how it works, service areas, CTA. LocalBusiness JSON-LD. |
| `/fencing/` | Timber fencing |
| `/concrete/` | Concrete paths, pads, driveways, footings |
| `/landscaping/` | Landscaping, section clearing, plus digger & earthworks (`#earthworks`) |
| `/decks-and-retaining/` | Decks & steps (`#decks`) and timber retaining walls (`#retaining`) |
| `/gallery/` | All job photos with captions |
| `/about/` | About Chris / how we work |
| `/contact/` | Quote form (Netlify Forms), phone, email, hours, areas |
| `/thanks/` | Form success page (noindex) |
| `404.html` | Not found page (Netlify serves it automatically) |

Other files:

- `assets/css/style.css`: the one shared stylesheet. Brand colours are CSS custom properties at the top (`--timber`, `--turf`, `--ink`, `--paper` and so on).
- `assets/js/main.js`: mobile menu, current-page highlight, footer year.
- `assets/img/logo.svg` (light backgrounds), `logo-white.svg` (dark backgrounds), `logo-icon.svg` (square mark). The wordmark text is converted to outlines, so the logos render the same everywhere, including email signatures and printing.
- `favicon.svg`, `apple-touch-icon.png` (180px), `assets/img/og-image.jpg` (1200x630 social share image).
- `assets/img/*-sm.jpg`: smaller copies of each photo, served through `srcset` on mobile.
- `robots.txt`, `sitemap.xml`, `netlify.toml` (cache and security headers only).

Each service page has its own FAQ with FAQPage JSON-LD and links to `/contact/` for quotes. There is only one form on the whole site (`name="quote"` on `/contact/`), so Netlify's form detection picks up a single form.

## Deploy to Netlify

1. Zip the **contents** of `site/`, so `index.html` sits at the top of the zip and isn't inside a `site/` folder. Or just drag the `site` folder itself.
2. Netlify dashboard → **Add new site → Deploy manually** → drag the zip or folder in.
3. **Forms:** after the first deploy, open **Site configuration → Forms**. Enable form detection if it's off, then redeploy once so the `quote` form gets registered. Send a test submission from `/contact/`.
4. **Form notifications:** go to **Forms → Form notifications → Add notification → Email notification**, choose the `quote` form, and add:
   - `lagisamafuao2505@gmail.com` (Chris)
   - `hello@leadhivenz.com` (LeadHive copy)
5. **Custom domain:** go to **Domain management → Add a domain**, then point DNS at Netlify and let Netlify issue the free SSL certificate.
6. **Placeholder domain:** canonical URLs, Open Graph URLs, JSON-LD and `sitemap.xml` all use `https://timberandturf.co.nz/`. If the real domain is different, find and replace `https://timberandturf.co.nz` across `site/` before deploying.
7. After go-live, submit `https://<domain>/sitemap.xml` in Google Search Console, and set up or link a Google Business Profile.

To preview locally: `cd site && python3 -m http.server 8787`, then open http://localhost:8787/. The form only works once the site is on Netlify.

## Confirm with Chris

- [ ] **Hours.** The contact page says "Mon–Sat, 7am–6pm". This is a placeholder. Confirm or correct it.
- [ ] **Suburbs.** Confirm the service area list (Manukau, Manurewa, Papakura, Takanini, Flat Bush, Botany, Howick, Pakuranga, Ōtara, Papatoetoe, Māngere, Wiri, Clevedon, Hill Park, Weymouth, Wattle Downs, Conifer Grove, Drury). Ask about any areas to add or remove.
- [ ] **Services wording.** Check he's happy with what's listed: driveways, gates, ready lawn, hedge trimming, green waste removal, slat-style fences, and "our own small digger". Some of this is inferred from the logo and photos.
- [ ] **Insurance, NZBN, LBP or other credentials.** None are shown on the site. Add them only if Chris confirms them and wants them displayed.
- [ ] **Google reviews.** There are no reviews or testimonials on the site. Add real ones once he has them, or link his Google Business Profile.
- [ ] **Photos.** There are only five photos so far, and there's no concrete photo at all. Ask for more job photos, especially concrete, fencing and before/afters, plus a photo of Chris or his ute or digger for the About page. Landscape (horizontal) shots work best for page headers.
- [ ] **Business name and email.** Confirm "Timber & Turf" is the trading name and that the Gmail address is the one he wants shown. A domain email (for example chris@timberandturf.co.nz) would look more professional once the domain is set up.
- [ ] **Domain.** Confirm the domain, then update the placeholder (see step 6 above).
