# Manawatū Electrician — landing pages

Client: **Watchdog Security and Electrical (Duncan Hodges)**, Levin-based.
Deal: exclusive electrician spot from Palmerston North and Feilding down to Paekākāriki,
$1,500 + GST/month (ad spend included) + $500 setup, 3-month term then month to month with
14 days' notice. Agreement signed 26/11/2026. Target go-live Monday 30/11/2026.
No heat pumps (Duncan doesn't do them).

Built from `templates/handyman-master.html`. Only the `CONFIG` block was changed; template
logic, markup and CSS are byte-identical to the master (verified by prefix/suffix diff).
`variant` is `emergency`, so the home page and the faults page use the open/closed call
kicker; the security, CCTV and power pages use `intent: "planned"` (quote button shown).

## Pages (one per Google Ads ad group)

| Route                    | CONFIG key | Ad group           | H1                                         |
|--------------------------|------------|--------------------|--------------------------------------------|
| `/`                      | `default`  | Quote Intent       | Need an electrician in Manawatū or Kāpiti? |
| `/electrical-faults`     | `faults`   | Emergency Intent   | Power out or switchboard tripping?         |
| `/security-alarms`       | `security` | Alarms & Security  | Need an alarm or security system?          |
| `/cctv-installation`     | `cctv`     | CCTV Cameras       | Want CCTV cameras installed?               |
| `/power-points-lighting` | `general`  | (sitelink only)    | Power points, lighting or a new oven?      |

Screens of each page are in `screens/`.

## Filled from email / Duncan's website

- Phone **021 0845 9700** (Duncan's mobile). This is the number the Nimbata project must
  be set to **replace**.
- Area (Duncan, 22/10 and 16/11): Palmerston North / Feilding south through Levin, Foxton,
  Ōtaki and the Kāpiti Coast to Paekākāriki. 19 towns in the dropdown.
- Services (Duncan, 22/10): security systems, CCTV, intruder alarms, general electrical.
  watchdog.kiwi also lists access control and "licensed electricians".
- Reviews: the three testimonials on watchdog.kiwi, verbatim (one typo fixed: "any one").

## Confirm with Duncan before launch

- **Hours**: set to Mon–Fri 7am–6pm (also the ad schedule). Change `hours` if different.
- **Google reviews**: trust strip says "Recommended locally". Swap for a real Google review
  count if he has one.
- **Logo / photo**: blank, so initials "ME" and "D" render.
- **Domain**: Joe confirmed 26/11 he registered the correct spelling, manawatuelectrician.co.nz.

## Lovable

Remixed from Northland Handyman on 26/11/2026, then converted (5.5 credits).

- Editor: https://lovable.dev/projects/962ccf69-6526-4825-bb85-bc82621495e8
- Preview: https://id-preview--962ccf69-6526-4825-bb85-bc82621495e8.lovable.app
- `src/lib/site-config.ts` holds this CONFIG with `form.endpoint` set to `/api/public/enquiry`.
- Published 26/11/2026 at https://manawatu-electrician.lovable.app (custom domain not yet
  connected; do that in Lovable → Settings → Domains). Live check: call buttons dial
  +64 21 0845 9700. `RESEND_API_KEY` must be re-entered in Project Settings → Secrets after the
  remix, or the form returns a 503.
- The Nimbata script in `__root.tsx` is still the one copied from Northland. Replace it with
  the Manawatū project's snippet if Nimbata snippets are per project.

## Google Ads (account 314-103-9827, via Windsor)

Campaign **Manawatu Electrician** (id 24550549106), created 26/11/2026, **paused**.
$25/day, manual CPC, Mon–Fri 07:00–18:00, radius targeting around Palmerston North (18 km),
Feilding (8), Levin (14), Shannon (6), Foxton (8), Ōtaki (9), Paraparaumu (9) and
Paekākāriki (4). Stops short of Pukerua Bay (Wellington Electrician's area).

Ad groups (all paused): Quote Intent 202463173357 ($9), Emergency Intent 208122841411 ($10),
CCTV Cameras 201686970719 ($7), Alarms & Security 200195145817 ($7).
Structure copied from Hamilton (CPA ~$32) and Wellington (CPA ~$40) Electrician, last 90 days.

Built 26/11/2026, everything paused:
- Keywords (all PHRASE, paused): Quote Intent 20 (town + "electrician(s)", "electrician near me"),
  Emergency Intent 12 ("emergency electrician near me", fault terms), CCTV 12, Alarms 12.
- One RSA per ad group (15 headlines, 4 descriptions, paused), final URLs on manawatuelectrician.co.nz.
- 41 campaign negatives (jobs/DIY/training, heat pumps/aircon/solar, retailers, and Wellington,
  Porirua, Hutt, Whanganui, Masterton as phrase to protect neighbouring spots).
- Callouts: Licensed Electricians, Free Security Quotes, CCTV & Alarm Installs, Local to Palmy & Kāpiti.
- Sitelinks to the four service pages.

Audit 27/11/2026 (Windsor read-back):
- Campaign status reads ENABLED; all 4 ad groups and 4 ads are PAUSED, so $0 spend so far.
- Location option is already PRESENCE (it can also be set with Windsor `update_campaign_settings`).
- Geo: the 8 radius zones are live, **plus a whole-region target, Manawatu-Whanganui Region
  (geoTargetConstants/21305)**. That stretches to Whanganui, Taihape, Ruapehu and Dannevirke.
  Remove it before go-live: `set_campaign_geo_targeting` with `locations: []` and the 8 proximities.
- No overlap with Wellington Electrician (Wellington City, Karori, 6011, 6021 only).
- Ads: Emergency Intent and Alarms & Security APPROVED. Quote Intent and CCTV DISAPPROVED for
  "destination not working" (DNS not found, checked 26–27/11, before the domain resolved). All
  pages return 200 now; Google re-checks on its own, or use Resubmit in Google Ads → Ads → policy.

**Live 27/11/2026** (Duncan's $2,300 setup + first month confirmed paid by Joe):
- Region target 21305 removed; geo is now the 8 radius zones only. Duncan's own words
  (22/10): "confirming I'm not in whanganui… roughly paekakariki to palmy north/fielding".
- Enabled: all 56 keywords, 4 ads, 4 ad groups (campaign was already enabled).
- Call asset (added by Joe): 06 882 0164, Nimbata's call-extension number. The site's Nimbata
  numbers are 06 882 0163 for direct visitors and 06 882 0162 for ad clicks (gclid).
- Quote Intent and CCTV ads still show the old "destination not working" disapproval until
  Google re-checks; Resubmit in the Google Ads UI to speed it up.
