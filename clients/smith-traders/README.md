# Smith Traders — seller intake page (Meta ads)

Client: **Smith Traders 2010 Ltd (Mitch & Nicky Smith)**, truck and machinery brokers, 830 Oropi Road, Tauriko, Tauranga.
Deal: LeadHive Seller Campaign (Meta), $500 setup + $2,000/month incl. ~$1,000 ad spend, 90-day pilot (see `prospects/smith-traders/pitch-brief.md` §9b).

Standalone seller-intake page on its own domain, branded Smith Traders, hosted and maintained by LeadHive.
Facebook / Instagram lead ads run NZ-wide from the Smith Traders Facebook page and land here. One job:
the seller sends the form or taps to call Mitch. Mitch's own site (smithtraders.co.nz) is not touched; the
page links out to it and to his Deals on Wheels stock feed.

File: `smith-traders-seller.html`. Same mechanics as `templates/handyman-master.html` (CONFIG block is the only
editable zone, `?page=` variants, `#nb-source` Nimbata swap, JSON form POST, hours-aware status line, sections
auto-hide when their CONFIG array is empty, mobile sticky call bar). Its own design: Smith Traders brand red
and charcoal, Bebas Neue headings, real photos.

## Pages (one per ad angle)

| URL                 | Key          | Ad angle (pitch brief §5)                    | H1                                   |
|---------------------|--------------|----------------------------------------------|--------------------------------------|
| `/`                 | `default`    | 1. Holding cost: parked up, still paying     | Parked up and still costing you?     |
| `/?page=contract`   | `contract`   | 2. Keep it earning on contract while it sells| Keep it earning while we sell it     |
| `/?page=auction`    | `auction`    | 3. Anti-auction / don't fire-sale it         | Don't fire-sale it at auction        |
| `/?page=downsizing` | `downsizing` | 4. Downsizing the fleet                      | Downsizing the fleet?                |
| `/?page=pacific`    | `pacific`    | 5. Buyers in NZ and the Pacific              | Buyers in NZ and across the Pacific  |
| `/?page=appraisal`  | `appraisal`  | "What's my machine worth" (also suits 6. proof carousel) | What's your machine worth? |
| `/?page=privacy`    | —            | Privacy policy URL for Instant Forms + Pixel | Privacy policy                       |

Each key sets eyebrow, H1, lede, primary CTA label, hero photo and page title. `appraisal` also preselects
"Just want to know what it's worth" in the form. Unknown keys fall back to `default`. Add UTM params to each
ad URL (`utm_source=facebook&utm_campaign=...&utm_content=<angle>`); they are passed through in the lead JSON.

Copy follows Meta's personal-attributes rule: it talks about the machine (parked up, idle, surplus), never the
viewer's finances.

## Preview

Open `smith-traders-seller.html` in a browser (file://) and the black dev switcher appears top right; over
http add `&dev=1`. It is preview-only. Screens in `screens/`:
`default-390-full.png`, `default-390-first-screen.png`, `default-1280.png`, `default-1280-full.png`,
`auction-390-full.png`, `privacy-390-full.png`. The fixed bottom bar is hidden in the full-page captures
(Playwright paints fixed elements mid-page); `default-390-first-screen.png` shows it in place.
Checked: no horizontal scroll at 360px on every key; form flow end to end with a mocked endpoint.

## Form

Two steps, built to fit one phone screen each.

- Step 1: machine type (tap tiles: Excavator / digger, Truck, Dozer, Loader, Grader, Roller / compaction,
  Trailer, Forestry, Crane / Hiab, Other), region (16 NZ regions), mobile. All required. Phone must be NZ
  format: mobile `02x` + 7–9 digits, or a landline `03`–`09` + 7 digits; `+64` accepted.
- Step 2: name (required), make & model, year (1950 to next year), hours or kms, finance owing
  (Yes / No / Rather not say), when do you want it sold (As soon as possible / In the next 1–3 months /
  Just want to know what it's worth), photos (multiple, optional, "or text photos to 027 253 0888"), email.
- Hidden honeypot field (`f-company`); bots that fill it get a fake success and nothing is posted.
- Photos are shrunk in the browser to max 1600px JPEG (a 3.8MB phone photo becomes ~260KB of base64), up to
  8 photos. If the base64 total is still over `form.photoMaxBase64` (4,000,000 chars) they are dropped,
  `photosSkipped` is true, `photosNote` says so, and the seller is told to text them to Mitch.

POST `F.endpoint` (`/api/public/enquiry`), `Content-Type: application/json`. The first five keys match the
handyman template so the existing Lovable enquiry route and email keep working; the rest are extra.

```json
{
  "name": "Dave Wilson",
  "phone": "027 123 4567",
  "suburb": "Waikato",
  "issue": "Excavator / digger · Hitachi ZX135US · 2014 · 9,200 hrs · finance owing: No · Just want to know what it's worth",
  "isUrgent": false,
  "leadId": "8cf76bb4-87e0-4a67-9e98-4a040158add7",
  "phoneE164": "+64271234567",
  "email": "",
  "region": "Waikato",
  "machineType": "Excavator / digger",
  "makeModel": "Hitachi ZX135US",
  "year": 2014,
  "hoursKms": "9,200 hrs",
  "financeOwing": "No",
  "timing": "Just want to know what it's worth",
  "photos": [{ "name": "IMG_0412.jpg", "type": "image/jpeg", "data": "<base64, no data: prefix>" }],
  "photosSkipped": false,
  "photosNote": "",
  "page": "appraisal",
  "source": { "utm_source": "fb", "fbclid": "abc" },
  "landingUrl": "https://<domain>/?page=appraisal&utm_source=fb&fbclid=abc",
  "referrer": "",
  "submittedAt": "2026-10-23T01:56:32.540Z",
  "business": "Smith Traders 2010 Ltd"
}
```

`isUrgent` is true when timing is "As soon as possible". On a 2xx the form is replaced by a success panel naming
Mitch ("Mitch will call you within the hour" in hours; "first thing Monday/tomorrow/this morning" outside
hours, plus the hours label). On error: "That didn't send. Please call or text Mitch on 027 253 0888 instead."

The Lovable enquiry route must accept a body up to ~5MB (photos) and should attach or link the photos in the
email to Mitch. If that is awkward, drop photos from the email and store them (Supabase storage) with a link.

## Tracking

- **Meta Pixel**: set `tracking.metaPixelId`. Empty = no snippet. Fires `PageView` on load, `Contact` on any
  tap-to-call and on completing step 1, and `Lead` on a successful submit with `eventID = leadId` so a
  Conversions API event sent from Make/Lovable with the same `leadId` de-duplicates.
- **GA4**: set `tracking.ga4Id`. Empty = no snippet. Events `click_to_call`, `form_step_1`, `generate_lead`.
- **Nimbata**: like Northland, the static file has no Nimbata script; the Lovable root layout carries the
  DNI script. `#nb-source` is filled with `business.phone` (027 253 0888) and every
  `[data-phone-display]` / `[data-phone-link]` follows it, exactly as in the handyman template.

## Images used (re-host these in Lovable)

All from the client's Squarespace site (`images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/...`)
except the stock photos, which are on the Deals on Wheels CDN. The page adds `?format=300w` / `?format=1500w`.

| Use | URL |
|---|---|
| Logo (white badge with shadow, needs a dark background) | https://images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/1655762320572-GW1CJOQMULHTRSVAUE52/smith-traders-logo-white-shad.png |
| Hero: default, auction, appraisal | https://images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/1654139368852-P45SK77W93AMM3CXDDXC/site-digger-web.jpg |
| Hero: contract, downsizing | https://images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/1654127693025-YO2HC2RDGMTKNUNMGLL1/truck-road-web.jpg |
| Hero: pacific | https://images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/1654143201614-IERIY6FU0NF3MTNVC74Y/shipping-wharf-web.jpg |
| Mitch | https://images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/1655762814834-PFJF6HQ9V7Y5I1YV3FHL/mitch-smith.jpg |
| Nicky | https://images.squarespace-cdn.com/content/v1/6296bbbbbd847a08d48507df/1655762832433-K6IN937HLC03J5KCAZ0P/nicky-smith.jpg |
| 1993 Kenworth T800 | https://assets.primecreative.com.au/imagegen/max/pcr/800/-/assets/momoads/2024/12/12/114733/2148708665.jpg |
| 2015 Hino 700 FY Hiab | https://assets.primecreative.com.au/imagegen/max/pcr/800/-/assets/momoads/2026/03/24/110707/1956541580.jpg |
| 2020 Isuzu CYJ400 + PK50 Hiab | https://assets.primecreative.com.au/imagegen/max/pcr/800/-/assets/momoads/2024/12/09/070749/2165471456.jpg |
| Tigercat 630 | https://assets.primecreative.com.au/imagegen/max/pcr/800/-/assets/momoads/2024/12/11/125300/1189169044.jpg |
| Doosan DX255LC | https://assets.primecreative.com.au/imagegen/max/pcr/800/-/assets/momoads/2026/03/25/071033/2288533336.jpg |
| CAT 950H loader | https://assets.primecreative.com.au/imagegen/max/pcr/800/-/assets/momoads/2024/12/05/091440/2167610852.jpg |

Fallbacks are built in: logo → "ST" ring wordmark, faces → initials, stock photo → model name on grey,
hero → plain charcoal. The three hero photos look like stock images bought for the 2022 site; swap them for
Mitch's own yard or machine photos as soon as he sends some (pitch brief §5: this audience spots stock imagery).
The six units were live in the feed on 23 Oct 2026 (stock feed ids 1009552, 1067869, 1009147, 1009430,
1068075, 1008812); replace any that sell. Cards link to the full stock list, not to individual listings.

Brand taken from the Squarespace theme CSS: accent red `#FC221C` (buttons use a deeper `#D81B15` for
contrast), black `#231F20`, dark accent `#40140F`; headings Bebas Neue (same as his site), body Archivo
(his site uses Adobe's Aktiv Grotesk, not on Google Fonts).

## Set before launch (CONFIG)

| Key | Now | Set to |
|---|---|---|
| `site.domain` | `""` | The chosen domain, no protocol. Only used for the canonical tag; nothing visible depends on it. |
| `tracking.metaPixelId` | `""` | Pixel / dataset id from the LeadHive portfolio (§9a step 5) |
| `tracking.ga4Id` | `""` | GA4 measurement id `G-...` |
| `form.endpoint` | `/api/public/enquiry` | The Lovable enquiry route (same as Northland). Route leads to Mitch (SMS + email) via Make. |
| `business.phone` | `027 253 0888` | Keep. Create the Nimbata project with this as the number to replace. His site writes it `027 2530 888`; check Nimbata matches digits, not formatting. |
| `hours` | Mon–Fri 8am–5pm | Mitch's real hours (not published anywhere). Drives the status line and the success message. |

Privacy policy URL for Instant Forms and the Pixel: `https://<domain>/?page=privacy` (or a `/privacy` route
in Lovable). "Last updated" date is in `privacy.updated`.

## Mitch to confirm before launch

- **Fee wording.** Fees are not published. Page says "you'll know the fee before you agree to anything" and
  "Fee agreed with Mitch before anything is listed". Not stated: "no sale, no fee". If that is his model, add
  it to the FAQ and the comparison; it is the strongest line against auction.
- **Buy outright.** FAQ says Smith Traders sells on your behalf, "ask Mitch" for an outright sale. Confirm.
- **Years in trade.** Chip says "Since 2011, selling on behalf" (company incorporated 22 Nov 2011). His logo
  says "Est 2010" and his About page says 15 and 30 years. Pick one number.
- **$1.9M.** "Average of $1.9 million in sales over the last 3 years" is from his 2022 About page. Confirm it
  still holds, or give a current figure.
- **"Within the hour".** Success message promises a call within the hour in business hours. He must agree
  to it (pitch brief: speed-to-lead under 15 minutes).
- **"Every viewing and negotiation."** His site says Mitch is "on the ground to facilitate viewings and
  negotiations"; the page says "every". Confirm.
- **Market appraisal.** Is it free? The page does not say so.
- **Finance answer.** FAQ only says Mitch talks it through before listing. If he settles finance from the sale
  proceeds, say so.
- **Photos.** OK to use his and Nicky's 2022 headshots, the three hero photos and the six listing photos?
- **Named clients.** RJ Lincoln, Pro Floors, JD Fieldservices, Regal Haulage, McLeod Cranes are on his About
  page; confirm they are still current and he is happy for them to appear in an ad landing page.

## Domain candidates (availability not checked)

sellmymachine.co.nz, sellmydigger.co.nz, sellyourtruck.co.nz, parkedup.co.nz. `parkedup.co.nz` matches the
lead ad angle; `sellmymachine.co.nz` covers trucks and diggers. The brand on the page is Smith Traders either way.

## Lovable build notes

- New project (do not remix a handyman site: different layout). Port the CONFIG verbatim into
  `src/lib/site-config.ts` and the locked logic into one `SellerPage` component.
- Routes: `/` reads `?page=` for the variant (keeps every ad on one URL; Meta ad URLs carry the key), plus
  `/privacy` rendering the privacy view. Optional `/contract`, `/auction` etc. aliases if Joe prefers clean URLs.
- Root layout: Nimbata DNI script; Pixel and GA4 only when the ids are set.
- Enquiry route: raise the body limit to ~5MB, validate the same fields server-side, email Mitch
  (admin@smithtraders.co.nz) and LeadHive, store photos, and post `leadId` to Make so CAPI sends `Lead` with
  `event_id = leadId`.
- Self-host Bebas Neue and Archivo, and re-host every image above.
- The dev switcher (`#dev`) is preview-only; leave it out.
