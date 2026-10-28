# Crew app — plan, assumptions and open questions

The brief asked for questions first, then a plan, then phase 1. This session ran unattended,
so the questions below were answered with the most sensible default and the build went ahead.
Every assumption is one line to change.

## What phase 1 delivers

| Brief says | Built |
| --- | --- |
| Login, magic link, 30 days | Supabase email OTP link, `shouldCreateUser: false` so only seeded crew can log in. Session length is a Supabase dashboard setting (README step 1.5). |
| Today, time order, swipe for tomorrow/yesterday | `/today`, arrows + swipe, pull-down to refresh, `?d=YYYY-MM-DD` deep links. |
| Job: maps, call, access notes, one status button | `/jobs/[id]`. Directions open Google Maps (iPhone offers Apple Maps from there). Status button steps On the way → On site → Done, with a confirm sheet on Done that lists photos/hours. |
| Photos compressed to ~1600px | Canvas resize on the phone, JPEG 0.82, EXIF rotation honoured. |
| Hours +15 min / +1 h per person | Bottom sheet, one row per person on the job. Rate band saved from the job's start time. |
| Materials, notes | Bottom sheets. |
| Offline first + "Saved on phone" badge | IndexedDB cache of jobs; outbox of changes replayed in order on reconnect, visibility change and every 30 s. Badge shows the pending count. |
| Office board, realtime, last photo, hours vs quoted (red if over) | `/office`, Supabase realtime on jobs/time_entries/job_photos with a 60 s poll as backup. Unparsed calendar events panel at the top. |
| Office job detail + edit | `/office/jobs/[id]`, full edit form, gas rule enforced in the form and the DB. |
| Week view + search | `/office/week`. |
| RLS: crew see own van only, never prices | Policies in `0001_init.sql`. Phase 1 has no price columns; `price_book` and `invoice_drafts` will be admin-only when added. |
| Gas rule in DB and UI | Trigger on `jobs` and on `users`, checkbox greyed out with NO GAS in the edit form, parser flags it on import. |
| CSV seed | `npm run seed`, same parser as live sync. |
| PWA install | Manifest, icons, service worker, standalone display, safe-area padding. |
| Brand in one file | `config/brand.ts` (+ two font imports in `config/fonts.ts`). |
| README | Done. |

## Assumptions made (change if wrong)

1. **Vans.** Mike is Van 1; Jono and Tama are Van 2. The CSV has no van column, so the van
   comes from the first name in `who`. Calendar titles use `[Van 1]` / `[Van 2]`.
2. **Rate bands.** Standard = Mon–Fri 7:00am–5:00pm. Night/Sunday = 10:00pm–6:00am any day,
   plus all of Sunday. Everything else = after hours. Public holidays are not auto-detected.
   All in `brand.rateBands`.
3. **Travel zones.** Zone 1 = Christchurch city/inner suburbs, Zone 2 = outer (Rolleston,
   Kaiapoi, Lincoln), Zone 3 = Rangiora, Darfield, Leeston, Akaroa. The calendar can set
   `Zone:`; otherwise the job defaults to Zone 1 and Mike changes it on the job. Phase 2 can add
   a suburb → zone lookup.
4. **Materials markup** (price book) is a placeholder tier table: 40% / 30% / 20%. Mike to confirm.
5. **Quoted hours are visible to crew.** They're hours, not money, and the brief shows crew the
   job description. If Mike would rather hide them, drop the column from the crew select and
   add a view. Prices, rates and margins are not in any crew screen or table they can read.
6. **"Who" line.** Calendar descriptions may include `Who: Jono + Tama`. If absent, everyone
   whose van matches the title is assigned.
7. **Photo kinds.** Before / After / Issue, chosen from a small selector above the Add photos
   button. Default is Before.
8. **Undo.** Crew can step a status back one notch (wrong tap with gloves). Mike can set any
   status from the office.
9. **Done with nothing attached** is allowed but warned ("the office will chase you"). Making it
   a hard block risks the boys not using the app when a phone camera fails.
10. **Repo location.** Built inside `crew-app/` of this repository because that's the only place
    this session can push. It's self-contained: move the folder to its own repo (or set Vercel's
    Root Directory to `crew-app`).

## Questions for Mike (none block phase 1)

- Does Mike want Tama to log his own hours, or only Jono logging for both? (Currently anyone on
  the job can log for anyone on the job.)
- Should crew see tomorrow's jobs the night before? (Yes at the moment.)
- Any job types that are always gas (e.g. "califont", "hob") so the parser can set `Gas: yes`
  automatically? Currently it needs the explicit line.
- Real inboxes for the three logins, and the office phone number for `brand.phone`.

## Phase 2 (after you confirm phase 1 on a phone)

1. `price_book` table seeded from `docs/03-price-book.md`; editable from `/office/price-book`.
2. `invoice_drafts` on every Done job: call-out by band, labour per person per band (first hour
   whole, then 15-minute blocks), travel by zone, sundries by job size, materials at cost +
   markup. Lines that can't be priced are `CHECK`. GST 15% separate.
3. `/office/invoices`: edit lines, approve, export. Xero OAuth, invoices created with
   `Status: DRAFT` only.

## Phase 3

Google Calendar read-only sync (OAuth as Mike) every 10 minutes via a Vercel cron route plus
pull-to-refresh, using `lib/calendar/parse.ts`; failures land in `calendar_sync_issues`.

## Risks flagged in the brief

- **Calendar format**: set the event template in Google Calendar on day one
  (title `[Van 2] Customer - Job type`; lines `Address:`, `Suburb:`, `Phone:`, `Job:`, `Notes:`,
  `Gas: yes/no`, `Quoted hours:`). Anything else shows on the board as unparsed.
- **Privacy**: the app stores names, addresses, phone numbers and photos. Check obligations under
  the NZ Privacy Act with an adviser.
- **Adoption**: 56px buttons, two taps to close after photos, no typing required to close a job.
  Test with gloves on.
