# SEO build, 7 Oct 2026

## LeadHiveNZ (Lovable project ec2c7f2f)

Goal: rank for "marketing agency for tradies NZ", "lead generation for tradies", "[trade] leads
[region]", and be quotable by AI answer engines. Lovable's Vite stack prerenders for verified crawlers,
so no SSR migration was needed.

New: `src/lib/site.ts` (single SITE_URL), `src/data/coverage.ts` (every trade×region slot with status
and real numbers), `src/data/guides.ts` (6 long-form guides), `Seo.tsx` (canonical/OG/JSON-LD helper),
`OpenSpots.tsx` (open regions front-and-centre), `CoverageCarousel.tsx` (interactive embla carousel,
filter by trade, tap to expand, waitlist/claim CTAs), pages `/areas`, `/leads/:slug` (trade hubs +
one page per slot, 29 pages), `/guides`, `/guides/:slug`. Rewritten: `Index.tsx`, `App.tsx`,
`index.html`, header/footer, robots.txt (AI bots allowed), sitemap.xml (36 URLs), llms.txt.

Schema: Organization/ProfessionalService + OfferCatalog, WebSite, Service + Offer per slot, FAQPage
on every page, BreadcrumbList, Article on guides.

## ContentHive AU (Lovable project bfe5c813)

Rewritten `src/pages/Index.tsx`: cream sections between black, CSS phone mockups, weekly posting
calendar, Melbourne service areas, "who's behind it" proof (15k followers, LeadHive), FAQ.
`routes/index.tsx`: real title/description, canonical, Organization + FAQPage JSON-LD.
Added robots.txt, sitemap.xml, llms.txt.

## Open questions for Joe

1. Live domain: code uses https://leadhivenz.co; email is @leadhivenz.com. Set SITE_URL once in
   `src/lib/site.ts` (and index.html/robots/sitemap/llms) if the published domain is .com.
2. ContentHive canonical assumes https://contenthive.au. Change in `routes/index.tsx`, robots, sitemap.
3. Add `public/og-leadhive.png` (1200×630) to LeadHiveNZ: the meta tags reference it.
4. Google Search Console: verify both domains and submit sitemaps. Connect Search Console to Windsor.
