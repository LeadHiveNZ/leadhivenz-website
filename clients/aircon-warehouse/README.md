# Aircon Warehouse — website

Client: **Aircon Warehouse Ltd**, 7/51 Ash Road, Wiri, Manukau, Auckland. Heat pump supply and install
(Daikin, Fujitsu / GENERAL Airstage, Haier), ducted and high wall, trade accounts, finance. Open 7 days.

Status: **client preview build**. Static HTML/CSS/JS in `site/`, assets in `assets/`. No backend yet: the
quote and trade forms validate and show a success state but do not send anywhere. Wire them to the Lovable
`/api/public/enquiry` route (Resend → hello@leadhivenz.com + info@airconwarehouse.co.nz) when the site is
rebuilt in Lovable, same pattern as the handyman sites.

## Pages

| File                  | Nav label          | Purpose |
|-----------------------|--------------------|---------|
| index.html            | Home               | Positioning, pricing band, quote card, routing to services |
| heat-pumps.html       | Heat Pumps         | High-wall bedroom/living, sizing guide, landlords |
| ducted.html           | Ducted             | Whole-home ducted explainer, indicative unit pricing |
| supply-install.html   | Supply & Install   | What a standard install includes, package pricing |
| commercial.html       | Trade & Commercial | Builders, developers, property managers; trade sign-up form |
| finance.html          | Finance            | Finance and interest-free options (no provider named) |
| about.html            | About              | Story, promises, service area, warehouse address |
| contact.html          | Contact            | Full quote form, contact card |
| privacy.html          | (footer)           | Privacy policy, Privacy Act 2020, client to review |
| terms.html            | (footer)           | Terms of trade, CGA / FTA wording, client to review |

## Preview
Open `site/index.html` in a browser. Everything links relatively. Screens of each page (desktop full page
and mobile first screen) are in `screens/`. A shareable preview is published at https://claude.ai/artifact/KSJQ726hVKCznbYY9skySf (private until shared
from its Share menu); it is the same files with `../assets/` rewritten to `assets/`.

## Build notes
- Shared `site/styles.css` and `site/main.js`; each page is plain HTML. `site/_partials.md` explains how to
  add a page. A few pages carry a small page-local `<style>` block marked "candidate for styles.css".
- Forms: any `form[data-quote-form]` is validated by `main.js` and swaps to a success panel. There is no
  endpoint yet.
- No third-party embeds (no map iframe) so the preview works inside the artifact sandbox; the address links
  out to Google Maps instead.
- Fujitsu is written "Fujitsu (GENERAL Airstage)" because Fujitsu General NZ renamed to GENERAL in January 2026.
- The site deliberately shows no star rating, review count, accreditation, warranty years, finance provider
  or "Healthy Homes compliant" wording, because none of it could be verified. Those are the biggest
  conversion lifts once the client supplies the facts (see list below).

## Where the facts came from
All business facts were taken from Aircon Warehouse's own website and Facebook page as indexed by search
(the sandbox could not open the live pages). Phone 09 215 9544, email info@airconwarehouse.co.nz, address,
7-day 8am–8pm hours, the three brands, trade accounts, finance availability and the indicative prices all
come from there. Competitor research (Varcoe, Fonko, HRV, OneAir, Air Conditioning Group, Albany, Kiwi Heat
Pumps and others) shaped the structure, the pricing-conditions wording and the FAQ facts.

## Confirm with the client before launch
1. **Prices.** The site shows indicative figures from their current website (e.g. Fujitsu 2.5 kW $1,799
   installed, Daikin 5.2 kW $2,550 installed, Daikin 6 kW ducted unit $3,640). Their old site shows conflicting
   figures for some models. Get a current price list and update every "from $" figure.
2. **Free quotes and quote turnaround.** The site says quotes are free and come back within one business day.
3. **Fixed quotes.** "Fixed quotes, no surprise extras" is used as a promise. Confirm they'll stand behind it.
4. **Installed-price conditions.** Back-to-back, up to 3 m pipe, single storey. Confirm this matches how they quote.
5. **Electrical.** Who connects the units (registered electrician, Certificate of Compliance)? If confirmed,
   the install pages can state it outright.
6. **Accreditations and warranties.** None could be verified, so none are claimed. If they hold Daikin, GENERAL
   (Fujitsu) or Haier dealer/installer status, add the badges and the warranty years.
7. **Reviews.** No Google rating or reviews were found online. The site deliberately shows no star rating. Set
   up or share the Google Business Profile and send 3–5 verbatim reviews; the "customer promise" block on the
   homepage is where they go.
8. **Finance provider and terms.** The site says "finance available, including interest-free options" only.
   Add the provider, term and fees once confirmed (the finance page is ready for it).
9. **Commercial / new-build work.** The banner photo on the apartment build is used on the Trade & Commercial
   page as "Multi-unit development, Auckland". Confirm they're happy for it to be used and whether they want
   the builder named.
10. **Servicing and repairs.** Not offered on their current site, so there is no servicing page. Add one if they do it.
11. **Hillsborough.** Their Facebook mentions a new Hillsborough site. Second premises or a job? Update About if premises.
12. **Owner / team.** No names or photos were found. An owner's note and installer photos on About would lift
    conversion noticeably; the photo slots are marked in the page.
13. **Logo.** Supplied as JPG; transparent PNGs were cut from it. Ask for the original vector (SVG/AI) for crisp
    rendering and the favicon.
14. **Smaller claims the builders used, all flagged in the copy:** no minimum order for trade accounts;
    commissioning paperwork and model/serial numbers supplied; a deposit on acceptance and the balance on
    completion; old-unit removal priced on the quote; ducted and larger jobs quoted after a free site visit;
    records kept seven years (privacy); quotes valid 30 days and title retained until paid (terms).
15. **Daikin 4.7–10.3 kW supply & install "from about $1,750".** Their old site's range looks inconsistent
    with the 3 kW Lite at $1,950. Confirm before launch.
16. **Domain and hosting.** airconwarehouse.co.nz currently runs a WooCommerce site; plan the cut-over
    (DNS, redirects from /products/ and /product-category/ URLs to the new pages).
