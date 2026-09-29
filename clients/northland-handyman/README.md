# Northland Handyman — landing pages

Client: **Northland Building Maintenance (Brian Redwood)**, sole trader, Whangārei / Kaipara / Far North.
Deal: Northland handyman spot, $1,500/month trial from 28/09/2026, 15-lead guarantee.

Built from `templates/handyman-master.html`. Only the `CONFIG` block was changed; the
template logic, markup and CSS are byte-identical to the master (verified by diff).

## Pages (one per Google Ads ad group)

| Route              | CONFIG key   | Ad group                   | H1                              |
|--------------------|--------------|----------------------------|---------------------------------|
| `/`                | `default`    | (all / brand)              | Need a handyman in Northland?   |
| `/carpentry`       | `carpentry`  | General carpentry          | Carpentry job in Northland?     |
| `/decks-fences`    | `decks`      | Decks, fences, retaining   | Deck, fence or retaining wall?  |
| `/renovations`     | `renovations`| Renovations                | Planning a renovation?          |
| `/general-repairs` | `repairs`    | Handyman                   | Got a list of small jobs?       |

Point each ad group's final URL at its route. Screens of each page are in `screens/`.

## Preview

Open `northland-handyman-master.html` in a browser. Add `?page=carpentry`, `?page=decks`,
`?page=renovations` or `?page=repairs` to view a service page. The black "preview" switcher
top-right is dev-only and is not part of the Lovable build.

## Filled from CRM / email / public listings

- Phone **022 322 1137** (Brian's mobile, from the email thread). This is the number the
  Nimbata project must be set to **replace**. Create the Nimbata project for Northland
  Handyman with this as the source number before launch; the page swaps it for the
  tracking number automatically via the `#nb-source` span.
- Service area: Warkworth through Whangārei to the Far North (Brian's words, 18/09).
  20 towns/suburbs in the dropdown, Whangārei suburbs first.
- Services: general carpentry, decks / fences / retaining walls, renovations
  (kitchens, bathrooms, tiling, waterproofing), handyman repairs. From the agreement's
  four ad groups and Brian's Builderscrack / website listings.
- Person card: "Brian · Owner-operator · Northland Building Maintenance".

## Confirm with Brian before launch

- **Trust strip** shows "5.0 rated · Builderscrack" (one 5-star review, Kamo kitchen
  cabinetry job). If he has Google reviews, swap `trust[0].lab` for
  "4.9 · 23 Google reviews" style copy.
- **Hours** are the template default (7am–6pm, Mon–Sat). Adjust `hours` if different.
- **Insured / LBP**: the page deliberately makes no insurance or Licensed Building
  Practitioner claim. If Brian is insured, add "Insured" to `business.credential`.
  If he is an LBP, the carpentry and renovations FAQ answers can be strengthened.
- **Reviews and photos** are empty (sections auto-hide). Add verbatim reviews to
  `reviews` and job photo URLs to `photos` when he sends them.
- **Logo / photo**: `business.logoUrl` and `person.photoUrl` are blank; initials "NH"
  and "B" render instead.
- **Form endpoint**: the static file uses `/functions/v1/send-lead-notification`; the Lovable
  build uses its own `/api/public/enquiry` route, which emails the enquiry to
  hello@leadhivenz.com via Resend (same pattern as Tauranga Handyman). Add Brian's
  `nbm.br001@gmail.com` as a second recipient if you want leads to reach him directly.

## Lovable

Remixed from Tauranga Handyman (same SitePage + site-config structure) on 29/09/2026.

- Editor: https://lovable.dev/projects/0f71f34c-8d67-4a57-a0c5-4a19452a11e3
- Preview: https://id-preview--0f71f34c-8d67-4a57-a0c5-4a19452a11e3.lovable.app
- `src/lib/site-config.ts` holds this CONFIG with `form.endpoint` set to `/api/public/enquiry`.
- Routes: `src/routes/index.tsx`, `carpentry.tsx`, `decks-fences.tsx`, `renovations.tsx`,
  `general-repairs.tsx`. Tauranga's fence, deck, gib, painting, gutter and suburb routes were
  removed.
- Root layout keeps the Nimbata DNI script; `#nb-source` carries 022 322 1137 for the swap.
- Check the `RESEND_API_KEY` secret carried over from the remix before publishing; if not,
  add it in the Lovable project settings or the form will return 503.
