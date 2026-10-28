# Crew app — Mike's Plumbing & Gas

A phone app (installable web app, no app store) for a small plumbing and gasfitting crew.
Crew see today's jobs from the calendar, move each job through **On the way → On site → Done**,
and attach photos, hours, materials and notes on site, with or without signal. The office sees
both vans live and (phase 2) approves draft invoice lines before anything goes to Xero.

**Phase 1 is built** (this folder). Phase 2 (price book, invoice drafts, Xero) and phase 3
(live Google Calendar sync) are not started. See `PLAN.md` for assumptions and open questions.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind 4, Supabase (auth, Postgres with RLS, storage,
realtime), Vercel. Offline storage is IndexedDB via `idb`. No other runtime dependencies.

## Setup (about 20 minutes)

### 1. Supabase

1. Create a project at supabase.com (Sydney region is closest to NZ).
2. SQL editor → paste and run `supabase/migrations/0001_init.sql`.
3. Authentication → Providers → Email: turn **on** "Enable email provider", turn **off**
   "Confirm email" is fine either way, and turn **off** "Allow new users to sign up"
   (crew are created by the seed script / by you, never by self sign-up).
4. Authentication → URL configuration: Site URL = your Vercel URL (or `http://localhost:3000`
   for now). Add `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`
   to Redirect URLs.
5. Authentication → Sessions: set the refresh-token / session lifetime so a login lasts
   30 days (the app keeps the session refreshed every time it is opened).
6. Project settings → API: copy the project URL, the anon key and the service-role key.

### 2. Environment

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server. Safe to expose; RLS does the protecting. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: seed script, later the calendar sync. Never in the browser. |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used in magic-link redirects. |
| `CREW_EMAIL_MIKE` / `_JONO` / `_TAMA` | Optional. Real inboxes for the three logins when seeding. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID` | Phase 3 live calendar sync. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Phase 2 draft invoice export. |

### 3. Seed the dev database

```bash
npm install
CREW_EMAIL_MIKE=you@yourdomain.nz CREW_EMAIL_JONO=you+jono@yourdomain.nz CREW_EMAIL_TAMA=you+tama@yourdomain.nz npm run seed
```

This creates the three logins and loads `docs/08-jobs-calendar.csv` through the same parser
the live calendar sync will use. Two rows are deliberately broken (a gas job on Tama, a missing
address) so you can see the "didn't parse" panel on the office board. Re-running is safe.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000, enter one of the seeded emails, tap the link in the email.

### 5. Deploy to Vercel

1. Import this repository in Vercel. If the app lives in a sub-folder (as it does here,
   `crew-app/`), set **Root Directory** to `crew-app`.
2. Add the same environment variables. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL.
3. Add `https://YOUR-APP.vercel.app/auth/callback` to Supabase redirect URLs.
4. Deploy. The app is a PWA: on iPhone, open in Safari → Share → **Add to Home Screen**.
   On Android, Chrome shows an **Install app** prompt (or ⋮ → Add to Home screen).

## How to test it on your phone

1. **Install**: open the Vercel URL on an iPhone (Safari) and an Android (Chrome), add to home
   screen, open it from the icon. It opens full-screen with the navy bar.
2. **Log in as Jono**: enter Jono's email, tap the link in the email on the same phone. You land
   on *Today* with Van 2's jobs in time order.
3. **Close a job**: open Karen's job → tap **On the way** → **On site** → *Add before photos*
   (take 2) → *Add hours* → +1 h twice and +15 min for Jono, +1 h for Tama → **Done** → **Done**.
   That is the under-30-second path: after photos it is two taps.
4. **Airplane mode**: open Tom's job (Rangiora) once with signal, then switch to airplane mode.
   Change status, add a photo and hours. You'll see *Saved on phone, will upload (n)*. Turn the
   signal back on: the badge disappears and the office board updates within a second or two.
5. **Log in as Mike** on a laptop: `/office` shows both vans, live status, last photo, and hours
   against quoted hours (red when over). Click a job for everything attached plus **Edit job**.
   *Week & search* shows the week and searches past jobs by suburb or first name.
6. **Log in as Tama**: no prices or rates anywhere (there are none in phase 1 screens at all,
   and the database refuses them to non-admins). On Mike's **Edit job**, tick *Gas job* and Tama
   greys out with **NO GAS**. If you try to force it through the API, the database trigger
   rejects it with "Gas job cannot be assigned to Tama".

## Changing the branding

Everything brand-specific is in **`config/brand.ts`**: business name, short name, phone, city,
time zone, colours, font names, wordmark text / logo image path, van names, travel zones, rate
band hours, photo size, session length.

- To drop in a real logo, put the file in `public/` and set `brand.logo.imageSrc = "/logo.png"`.
- To change fonts, change `brand.fonts` **and** the two imports in `config/fonts.ts`
  (next/font needs static names).
- Icons: `node scripts/make-icons.mjs` regenerates the PNG icons from the droplet;
  `ICON_ACCENT` and `ICON_BG` env vars change its colours. Replace the files in `public/icons/`
  with a real icon when there is one. Update `public/manifest.webmanifest` name fields to match.

Nothing else in the app hard-codes a brand value.

## Where things are

```
config/brand.ts            brand settings (the one file to edit per business)
config/fonts.ts            next/font loaders
supabase/migrations/       schema, RLS policies, triggers (gas rule, crew update rule), storage policies
docs/                      03-price-book.md (phase 2 source of truth), 08-jobs-calendar.csv (dev seed)
scripts/seed.ts            creates logins + seeds jobs from the CSV
scripts/make-icons.mjs     renders PWA icons
proxy.ts                   session refresh + login redirect on every request
lib/calendar/parse.ts      calendar event → job (shared by CSV seed and live sync)
lib/offline/db.ts          IndexedDB cache + outbox
lib/offline/sync.ts        replays the outbox when online
lib/data.ts                reads with cache fallback and pending-change overlay
lib/time.ts                Pacific/Auckland date helpers, rate band rules
app/(crew)/today           Today / tomorrow / yesterday job list
app/(crew)/jobs/[id]       Job screen: directions, call, status button, photos, hours, materials, notes
app/(office)/office        Board (realtime), job detail + edit, week view + search
public/sw.js               service worker (app shell cache, offline fallback)
```

## Rules the app enforces

- Gas jobs can't be assigned to anyone with `can_do_gas = false`: blocked in the UI and by a
  database trigger. A user assigned to gas jobs can't have gas switched off either.
- Crew see only their van's jobs (RLS) and can only change a job's status; every other field
  is Mike's (trigger).
- Nothing is ever sent to a customer. There is no email or SMS code in the app.
- Xero (phase 2) will create DRAFT invoices only.
