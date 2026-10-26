# Why srshuttersandscreens.com.au under-performs: audit

Checked 26 Oct 2026 against the live HTML of all 86 pages in the sitemap. Every point below is verified, not assumed. The site is WordPress + Elementor, built by CMAK Digital in Feb–Apr 2026 and hosted on Hostinger.

**For Joe, in one line:** the site looks busy, but Google sees 68 copy-paste suburb pages, three brand names and a 40 MB home page. Customers see a stock-photo "Shane", AI before/after shots and a phone number that doesn't match Google.

---

## Top 5 (lead with these)

1. **68 cloned suburb pages ("doorway pages").** There are 34 `plantation-shutters-{suburb}` and 34 `security-screens-{suburb}` pages, all created on one day (17 Apr 2026). Once the suburb name is swapped they are **100% identical**: same copy, same images, same "Karen M" testimonial. They include Gold Coast, Sunshine Coast and Ipswich. Google treats this pattern as scaled or doorway content and tends to ignore it or demote the site. The pages are linked only from the two parent service pages and an HTML "sitemap" page; the home page's suburb list isn't linked at all.
2. **Trust content is fake or can't be verified.**
   - The "Hi I'm Shane Bartolo" hero figure is an **AI-generated tradesman** in blue overalls with an SR logo patch. It is not Shane.
   - The **Before & After** slider uses **Google Gemini AI images**. Filenames are `Gemini_Generated_Image_*`, the Gemini sparkle watermark is visible, and the "before" shots were made by erasing the shutters from real "after" photos.
   - **12 named page testimonials (13 quotes) can't be matched to any Google review.** "Karen M" appears on 70 pages with the closing suburb swapped ("…highly recommend SR Shutters and Blinds to anyone in Kallangur / Inala / Gold Coast…").
   - This is an ACCC / Australian Consumer Law risk (misleading testimonials) as well as a credibility problem. The irony is that Shane has **47 real install photos** and **4 genuine 5★ Google reviews** he isn't using properly.
3. **The home page loads ~39.6 MB of images.** The four before/after images are 7–9 MB PNGs each (8.9 MB, 8.5 MB, 8.5 MB, 7.4 MB) and the AI "Shane" is a 4.5 MB PNG. On top of that there are 41 stylesheets, 28 external scripts and 3 Google Font families loaded in all 18 weights each. On 4G that is a long white screen, and Core Web Vitals will fail. (The PageSpeed API quota was exhausted, so run PSI live in the meeting for a score.)
4. **Brand and contact details are split everywhere.**
   - The logo says "SR Shutters & **Screens**", but body copy says "SR Shutters and **Blinds**" **571 times across 81 pages**, including the home meta description and several H1s.
   - There are **two Google Business Profiles**: "Screens" (5.0★ / 4 reviews) and "Blinds" (0 reviews, linked to the old site). Both list **0480 431 417**, while the website shows **0411 885 227**.
   - The old GoDaddy site srshuttersblinds.com is still live, and its copy is duplicated on the new home page.
   - FB and IG still use the "Blinds" name.
   - Google can't confidently tie these together, and that hurts map-pack rankings.
5. **Weak for mobile lead generation.**
   - On mobile, the header **phone number, email, Contact button and "Get a Free Quote" button are all hidden** (`elementor-hidden-mobile`).
   - There is no sticky call or quote bar. The only phone CTA is in the hero, and it disappears once you scroll.
   - The quote form has 6 required fields (including a service dropdown) and **no privacy policy**: the footer "Privacy Policy" and "Terms" links point to `#`.

---

## Everything else we found

**On-page SEO**
- The home title "Premium Window Blinds & Shutters Brisbane" has no brand and no "security screens", although security screens are the second core service.
- **8 pages have no meta description** (services, about, contact, gallery and others).
- **/about-us/ and /gallery/ are blank** (header/footer only, no H1) but are still indexable and in the sitemap. They are not in the menu either.
- The Services H1 is broken: "Premium Shutters, Screens & — Supplied & Installed by Shane".
- **Indexable junk** that also sits in the XML sitemap: /maintenance-page/ ("Website is under maintenance"), /thank-you/, and /thank-you-2/, which is a **full duplicate of the aluminium shutters page**. The author archives (/author/cmak/, /author/hanzala/) are public.
- **Cannibalisation:** /shutters-brisbane/, /window-shutters-brisbane/ and /plantation-shutters-brisbane/ all target the same intent.
- The copy is keyword-stuffed and clumsy: "security screen installation near me Brisbane solutions", "best blind installation service near me", "Why Peoples Love Plantation Shutters", "my team" written alongside "I, Shane Bartolo".
- Menu links have no trailing slash, so every nav click triggers a 301 redirect.

**Schema / structured data**
- Only the Yoast defaults are present. The home and service pages are marked up as **`NewsArticle` written by "Manan" / "CMAK"**.
- The Organization "logo" is a template gold "S" icon (Group-6.svg), not the SR logo.
- **No `LocalBusiness` / `HomeAndConstructionBusiness`**: no phone, service area, hours, `aggregateRating`, `sameAs` socials or `Service` markup. That leaves no route to review stars in search results.

**Trust signals missing**
- No ABN (it is 79 667 070 340), no QBCC licence, no insurance details, no address or suburb, no Google map, no link to the GBP.
- No supplier or brand names at all (no Crimsafe, Invisi-Gard, Prowler Proof, Amplimesh or similar). Security-screen buyers search by brand.
- The warranty story contradicts itself: "15-30 Years Warranty" (home), "30 Year Warranty" (old site), "lifetime craftsmanship guarantee" (shutters page), and the outdoor page's FAQ "What warranty do you offer?" has an **empty answer**.
- Unverified claims: "Over 15 years' experience" and the old site's "Founded in 2010", against a company registered in 2023. Also "certified technicians" and "payment plans" (no provider named).

**Images**
- Product pages use stock and supplier images, including **US colonial exterior shutters, a bamboo roman blind and a louvre-roof pergola**, none of which SR sells.
- The same handful of stock images (3–6 per service) is repeated across all 70 Brisbane and suburb pages.
- 14 of 22 images on the home page have no alt text. Others use filenames as alt text ("Gemini_Generated_Image_44u7n…", "2400 by 1792 pixels", "WhatsApp Image 2026-02-27…").
- Full-size originals are served where thumbnails would do, and the srcset/size handling is ignored on the big PNGs.

**Tech / lock-in**
- The page builder stack is Elementor + ElementsKit + Essential Addons + Header Footer Elementor + Gravity Forms + MetForm (an unused second form plugin) + Hostinger Reach. That's heavy, and every addon is a maintenance and security liability.
- 87 separate Elementor CSS files are generated.
- Two GTM containers are loaded alongside GA4 and the Meta pixel, so tracking may be firing twice.
- Ownership question for Shane: who controls the Hostinger account, the WP admin and the domain? (CMAK built it.)
- **Fair to acknowledge:** HTTPS, LiteSpeed cache, a decent server response (~0.8 s TTFB), a Yoast XML sitemap, GA4/pixel installed, a click-to-call link in the hero, and dedicated service pages do exist. The site isn't empty. It is padded, inconsistent and untrustworthy.

---

## What the new site fixes
- **One brand, one NAP.** "SR Shutters & Screens" everywhere, with one phone number matching GBP. Merge the duplicate GBP and redirect srshuttersblinds.com.
- **Real proof.** A real photo of Shane, a gallery of his 47 genuine install photos, the real before/after pairs, the live Google reviews feed and a review-request flow.
- **Trust bar.** ABN, QBCC licence, insured, a written warranty term per product, named suppliers/mesh brands and the free measure & quote.
- **Fewer, better pages.** Strong pages for Plantation Shutters, Security Screens & Doors, Aluminium/Outdoor Shutters and Blinds, plus a small number of **genuinely unique** area pages (real jobs and photos per region) instead of 68 clones. The junk pages get noindexed or deleted.
- **Local schema.** `HomeAndConstructionBusiness` + `Service` + `AggregateRating` + FAQ, with sameAs links to GBP, FB and IG.
- **Mobile-first lead capture.** A sticky "Call Shane / Free Quote" bar, a 3-field quote form, a privacy policy and call and form tracking through a single GTM.
- **Fast.** Images resized to WebP/AVIF under 200 KB, two font weights and no page-builder bloat. Target under 2 MB per page and LCP under 2.5 s on mobile.
