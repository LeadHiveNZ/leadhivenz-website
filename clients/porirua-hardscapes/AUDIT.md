# Porirua Hardscapes — current site audit & rebuild rationale

Audited 18 Oct 2026. The current site (poriruahardscapes.co.nz, mirrored on poriruahardscapes.com) could only be read
through search-engine snippets from this session, because the build environment's network policy blocks the domain,
Facebook and the site's image host. Everything below about the old site comes from those snippets and directory listings.

## What the current site is

- 9 thin pages on a template: home, concrete, retaining walls, landscaping, excavator hire, decks/fences, demolition,
  "projects" (one line of text, no gallery), "quotes".
- Same content served on two domains (.co.nz and .com) — duplicate content in Google's eyes.
- Two different emails (adam@poriruahardscapes.co.nz on most pages, hardscapesporirua@gmail.com on the excavation page).
- Phone 027 244 4501 on every page. "36+ years of experience", "locally owned and operated", free quotes.
- Three testimonials (John MacKay / Island Bay, Gill & Terry / Whitby, one unattributed exposed-aggregate review).
- No named owner on the page (Adam only appears inside reviews), no team photo, no gear photo.
- No prices, no specs (thickness, MPa, mesh), no consent guidance, no guarantee.
- No third-party reviews anywhere: NoCowboys, Bark, BusinessDirectory and Yandex all show 0; no Builderscrack profile;
  Google rating not found. Every competitor that ranks well has dozens (TQ Concrete 109, Capital Retaining 32, Bedrock 13).
- No suburb/location pages and no cost content, which is exactly what Wellington Concrete Driveways and
  Porirua Concrete Contractors rank with for "concrete driveway porirua".

## What competitors do that the old site doesn't

| Competitor | Does |
|---|---|
| Stapp Contracting (Tawa) | Named director, page per sub-service, states job timeframes, testimonials page, commercial credibility |
| Bedrock Pavers | 2-year workmanship guarantee, publishes its spec (20 MPa + mesh), 7 exposed-aggregate variations |
| TQ Concrete Placers | 109 NoCowboys ratings at 97.9%; gets listicle rankings from that |
| Aspen Landscapes | Registered Master Landscapers + SiteSafe badges, "book an on-site visit", publishes minimum job size |
| Tungsten Landscapes | Real gallery, "Leave a review" page, suburb-loaded page titles |
| Wellington Concrete Driveways | Cost-per-m² article, concrete vs pavers article, a page per suburb |

## What the rebuild changes

1. **11 pages instead of 9 thin ones**, each with a job: home, services overview, 6 service pages (one per Google Ads
   ad group and per search intent), projects/reviews, about, contact + pricing + FAQ.
2. **Adam on the page.** Named owner, photo slot, "three walk-throughs" promise, one crew / own gear story.
3. **Transparent pricing guide** (Wellington 2026 ranges, labelled indicative) on the home and contact pages. Buyers
   search "cost per m²"; competitors that publish it rank for it.
4. **Specs and consent rules written down**: 100 mm / 20 MPa / mesh / control joints; 1.5 m retaining threshold;
   deck fall-height rule; 2.5 m fence rule; Porirua vehicle-crossing limits; asbestos survey for pre-2000 demolition.
   Nobody local does this well; it earns trust and long-tail search traffic.
5. **Reviews as a system, not a quote box**: review cards, a "leave a review" block, and a pre-launch task to get a
   Google review link in front of past clients.
6. **One phone pattern everywhere** (header, hero, mobile bar, CTA band, footer), Nimbata-ready via `#nb-source`.
7. **Lead form on every service page** (sticky sidebar) plus a full quote form with service chips and suburb picker.
8. **Technical SEO**: one canonical domain, descriptive slugs, LocalBusiness + Service + FAQPage JSON-LD, sitemap,
   robots, OG image, suburb-rich service-area section.
9. **Design**: one accent colour, big display type, dark/light rhythm, photo placeholders that swap to real photos
   automatically when files are dropped into `assets/img/`.

## Still to pull from the old site / Facebook (blocked here)

Photos of finished jobs, partner/supplier logos, any sponsorship logos, the verbatim testimonial text, the Facebook
page handle and any Google rating. `fetch-assets.sh` downloads every image from the old site when run on a machine
with normal internet access. See README.md for the full pre-launch checklist.
