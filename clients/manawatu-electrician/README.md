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
- **Domain spelling**: Joe wrote "manawatuelctrician.co.nz". Confirm the registered spelling
  before publishing and before ads go live.

## Lovable

Remixed from Northland Handyman on 26/11/2026, then converted (5.5 credits).

- Editor: https://lovable.dev/projects/962ccf69-6526-4825-bb85-bc82621495e8
- Preview: https://id-preview--962ccf69-6526-4825-bb85-bc82621495e8.lovable.app
- `src/lib/site-config.ts` holds this CONFIG with `form.endpoint` set to `/api/public/enquiry`.
- Not published. `RESEND_API_KEY` must be re-entered in Project Settings → Secrets after the
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

Still to add: keywords, RSAs, negatives, callouts, sitelinks, call asset (Nimbata number).
Location option must be switched to "Presence" in the Google Ads UI (not settable via API).
