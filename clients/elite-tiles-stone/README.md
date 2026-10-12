# Elite Tiles & Stone Limited — Christchurch

Premium five-page static site (no frameworks, Google Fonts only). Open `index.html` directly
in a browser to preview; all paths are relative.

```
index.html      Home — hero, positioning, services preview, featured project, testimonial, CTA
services.html   Kitchens / Bathrooms / Floors / Stone & Outdoor (+ anchors, capability strip)
projects.html   Gallery with lightbox — HTML comment inside shows the template for adding photos
about.html      Story, values, 4-step process
contact.html    Quote form (front-end only), contact details, service-area list
css/styles.css  Shared design system (logo grey/charcoal palette, Cormorant Garamond + Jost)
js/main.js      Nav, scroll reveals, lightbox, form validation
```

## Swap before launch
- **Phone** `021 000 0000` is still a placeholder — appears on every page, in `contact.html`,
  and in the JSON-LD block in `index.html`. (Email is the client's real address.)
- **Domain** `https://www.elitetilesandstone.co.nz` is a guess (used in OG tags + JSON-LD).
- **Testimonial** on the home page and the "5★ Client rated" stat are placeholders — replace
  with a real review or remove.
- **Project captions** (suburbs Cashmere/Burnside/Ilam/Halswell/Merivale/Riccarton/St Albans/
  Rolleston/Wigram), featured-project scope and
  "600 × 1200 mm" tile size on Services are plausible placeholders — correct to real jobs.
- **Form backend**: form currently shows a success message only. Wire to Formspree/Netlify
  Forms — comments in `contact.html` and `js/main.js` mark the spot.
- Facebook link points to the client's page: https://www.facebook.com/profile.php?id=61585140662981
