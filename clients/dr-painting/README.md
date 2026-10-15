# D|R Painting: website

Single-file site (`index.html`: HTML, CSS and vanilla JS, no build step) for D|R Painting
(Darren and Rich), Whanganui. Phone **028 468 9753**. Everything client-specific lives in the
`CONFIG` object at the top of the script, so the file also works as a master template for other
painting clients.

## Preview

Open `index.html` in a browser, or run `python3 -m http.server` in this folder and go to
`http://localhost:8000/`.

- `?placeholders=1` skips every remote photo and shows the branded gradient fallbacks (use this on
  networks that block Unsplash). Failed images fall back to the same gradients on their own.
- The hours chip ("Open now · call Rich" / "After hours") is worked out in NZ time.

## Placeholder content (replace before launch)

- **Photos**: all Unsplash stock, set in `CONFIG.IMG`. Swap in Darren and Rich's own job photos
  (same keys). The gallery captions in `CONFIG.gallery` are generic job types, not real jobs.
- **Before/after**: `before` and `after` are the same stock photo; the "before" side gets a
  desaturated, vignetted "before" filter because `beforeAfter.simulate` is `true`. Use a real before/after pair and set
  it to `false`.
- **Reviews**: the 3 testimonials in `CONFIG.reviews` are SAMPLES. Replace with real, verbatim reviews.
- **Email**: `business.email` is `quotes@example.co.nz`. The form opens a pre-filled email to this
  address while `formEndpoint` is empty.
- **Domain**: canonical / `og:url` / `business.url` use `https://www.example.co.nz/`.

## Photo check

The build machine could not load Unsplash, so none of these photos has been seen loading. Open each
URL in a browser. If one 404s or is the wrong subject, replace its value in `CONFIG.IMG` (same key).
`IMG.heroPosition` (default `70% center`) sets where the hero photo is anchored so the subject
sits right of the headline; adjust it for the real photo.

- `hero`: https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80
- `why`: https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=80
- `svc_interior`: https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80
- `svc_exterior`: https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80
- `svc_roof`: https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1600&q=80
- `svc_newbuild`: https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80
- `svc_commercial`: https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80
- `svc_wallpaper`: https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80
- `svc_decks`: https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=80
- `svc_handyman`: https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1600&q=80
- `before`: https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80
- `after`: https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80
- `gallery_1`: https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80
- `gallery_2`: https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80
- `gallery_3`: https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80
- `gallery_4`: https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80
- `gallery_5`: https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80
- `gallery_6`: https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80

## Confirm with Rich

- Email address, and whether quote requests should go to a webhook (set `CONFIG.formEndpoint`; it
  POSTs JSON: name, mobile, town, job, message, page, submittedAt).
- Hours (default Mon–Sat 7am–6pm, Sunday closed), and that Rich is the right name for the "call" chip.
- `CONFIG.claims`. Everything is off until confirmed: Master Painters NZ, Dulux / Resene
  accreditation, Site Safe, insurance (with wording), Google rating and review count. Only the
  generic "Workmanship guarantee on every job" shows by default. Check he's happy with that too.
- Services list, especially the handyman items (small repairs, gutter cleaning, water blasting) and
  roof painting.
- Towns covered (17 across Whanganui, Manawatū and South Taranaki).
- Logo: the header/footer logo is a redrawn inline SVG (`<symbol id="dr-mark">`) of the flyer's DR mark. Ask for the original
  vector file if one exists.
