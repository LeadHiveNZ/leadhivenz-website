# LeadHive Partner Portal

A phone-first portal each LeadHive partner (plumber, sparky, handyman…) logs into to see
their leads, listen to call recordings, read Joe's monthly notes and tag what happened with
each lead. Joe uploads one Nimbata CSV per partner per month, pastes the notes, hits publish.

Same setup as The Tipsy Tui: **Supabase** holds the logins, data and files, **Netlify** hosts
the app, the code lives in this repo. No Lovable credits, no per-use cost.

```
portal/
  app/                          ← the live app (Netlify base directory)
    public/                     static site: index.html, app.js, demo-data.js, config.js, icons, manifest
    netlify/functions/          server bits: enquiry webhook, partner login creation, publish email
    supabase/schema.sql         tables, row level security, triggers, views, storage buckets
    supabase/seed-demo.sql      demo partner (Mike's Plumbing) for sales calls
    netlify.toml, package.json  Netlify config + the one server dependency
    scripts/make-seed.js        regenerates seed-demo.sql from demo-data.js
  leadhive-portal-master.html   the original design prototype (kept as the design record)
  screens/                      rendered previews: 01–15 prototype, live-* the real app in demo mode
```

## Try it now (no setup)

Open `app/public/index.html` through any static server, or once deployed add `?demo` to the
URL. Demo logins: partner `mike@mikesplumbing.co.nz` / `demo`, admin `hello@leadhivenz.com` / `admin`.
Demo mode never touches the real database, so it's safe to show prospects on the live domain.

## Go live (about 15 minutes)

### 1. Supabase (free tier is plenty)
1. supabase.com → New project → name it `leadhive-portal`, region Sydney. Save the DB password.
2. SQL editor → paste all of `app/supabase/schema.sql` → Run. (Safe to re-run later.)
3. Optional: paste `app/supabase/seed-demo.sql` → Run, for the demo partner.
4. Authentication → Providers → Email → turn **off** "Confirm email" (partners log in straight
   away with the password you set them).
5. Authentication → URL configuration → Site URL `https://portal.leadhivenz.com`, and add
   `https://portal.leadhivenz.com/*` (and your `*.netlify.app` URL) to Redirect URLs.
6. Project Settings → API: copy the **Project URL** and the **anon public** key into
   `app/public/config.js`. Copy the **service_role** key for Netlify (step 2). Never put the
   service_role key in config.js or send it anywhere.

### 2. Netlify
1. Add new site → Import from GitHub → this repo, branch `main`.
2. Build settings: **Base directory** `portal/app`, build command empty, publish directory `public`.
   (`portal/app/netlify.toml` sets the functions folder and the `/api/*` routes.)
3. Environment variables:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the service_role key
   - `RESEND_API_KEY` = your Resend key (for the "your results are in" email)
   - `RESEND_FROM_EMAIL` = `LeadHive <hello@leadhivenz.com>` (once the domain is verified in Resend)
   - `PORTAL_URL` = `https://portal.leadhivenz.com`
4. Deploy, then Domain settings → add `portal.leadhivenz.com` (CNAME to the Netlify site).

### 3. You become the admin
Open the portal → "First time here? Set up your login" → sign up as **hello@leadhivenz.com**.
That email is made admin automatically (see `handle_new_user` in the schema). Anyone else who
signs up becomes a partner only if a client row with their email exists.

### 4. Add a partner
Admin → + New partner → fill in the business, plan and their email, type a password →
"Create partner + login". Tap "Copy login message" and text it to them. Done.
(Creating the login goes through `/api/create-login`, which needs the Netlify env vars above.)

## Monthly routine (about 5 minutes per partner)

1. Nimbata → Call log → filter the partner's project + the month → Export CSV.
2. Admin → Upload month → pick partner + month → drop the CSV. Check the "Looks good" chip,
   missed %, average call, recordings count.
3. Tap **Copy summary for Claude**, paste it into Claude with the Google Ads spend. Claude
   returns the 2–3 sentence summary and three "What I'm changing" points.
4. Paste them in, type the ad spend (admin only), attach the PDF from the lead-report skill if
   you made one, **Publish to partner**. They get an email and it's live in their portal.

Upload as often as you like (weekly, fortnightly, month end): each upload **adds** calls that
aren't in the portal yet and **refreshes** the ones that are, matched by Nimbata call id or
caller + time, and never touches the partner's tags. Mid-month, tap **Save draft**: the calls
show up for the partner straight away under "this month so far", the notes stay hidden until
you publish. Tick "Replace the month" only when you want calls that aren't in the file removed.

## Who sees what

| Screen   | Partner                                                                      | Admin extra                                   |
|----------|------------------------------------------------------------------------------|-----------------------------------------------|
| Home     | leads vs plan, calls / web / answered / missed / avg call, note from Joe, leads by month and week, latest leads | "View as" any partner |
| Leads    | every call + web enquiry, filters (to tag, missed, web, recorded, won)       | same                                          |
| Lead     | caller, call back / text, recording player, Joe's note, outcome tagging      | edit Joe's note, attach a recording file      |
| Reports  | one report per published month: stats, ROI card, summary, 3 changes, PDF    | drafts                                        |
| Account  | plan, fee, next invoice, contact Joe, add-to-home-screen                     |                                               |
| Admin    |                                                                              | partners list, upload month, settings & login, margin per month, enquiry webhook key |

Partners never see Google Ads spend unless the per-partner toggle is on (it lives in an
admin-only table). Cost per lead shown to partners is **fee ÷ leads**, never ad spend.
Partners can only change the outcome, job value and note on their own leads (enforced in the
database, not just the UI). Recordings and PDFs are private files served by short-lived links.

## CSV format (Nimbata export)

Headers are matched loosely (case and spaces ignored). Dates are read in the partner's time zone.

| Field      | Accepted headers                                              | Notes                                     |
|------------|---------------------------------------------------------------|-------------------------------------------|
| Date/time  | Date + Time, or Date/Time, Start time, Timestamp               | dd/mm/yyyy, optional am/pm, or ISO        |
| Caller     | Caller, Caller ID, Caller Number, From, Phone                  |                                           |
| Duration   | Call Duration, Duration, Talk time                             | seconds, m:ss, h:mm:ss or "2m 34s"        |
| Outcome    | Outcome, Status, Disposition                                   | answered / missed / voicemail; if missing, answered when ≥ 20s |
| Recording  | Recording, Recording URL                                       | a link; if Nimbata links need a login, attach the file on the lead instead |
| Summary    | Summary, AI Summary, Call Summary, Description                 | the AI call summary; shown to the partner on the lead and as the one-liner in the list |
| Value      | Value, Lead Value, Estimate, Job Value                         | your estimate for that job, shown as "Est." on the lead |
| Optional   | Tracking Number, Source, Campaign, Keyword, City, Call ID, Notes | kept in `raw`                           |

Only rows dated in the selected month are imported.

## Website enquiries land live

Each partner has a webhook key (Admin → partner → Settings, or "Enquiry webhook" copies it).
In the landing page's `src/routes/api/public/enquiry.ts` (Lovable), after the Resend email:

```ts
await fetch("https://portal.leadhivenz.com/api/enquiry", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-leadhive-key": process.env["LEADHIVE_PORTAL_KEY"]! },
  body: JSON.stringify({ name, phone, suburb, issue, isUrgent, page }),
}).catch(() => {});
```

and set `LEADHIVE_PORTAL_KEY` in that Lovable project's secrets to the partner's key. (That edit
is one small Lovable message per landing page; do it when you next touch the page.)

## Won / Lost tagging = the ROI engine

Every lead row has **Won**, **Lost** and **Ongoing** buttons. Won opens a value box prefilled with your
estimate (the CSV "Value" column, or the partner's average job value from Settings); the
partner overwrites it with the real number. Ongoing keeps the lead in play (the Won/Lost
buttons stay on it until it lands). The home screen and report then show
*estimated value of leads* vs *confirmed won* and the partner's return on their own numbers
("4.4x"). Lead detail has New / Ongoing / Won / Lost. **"Not a lead" and "Spam" are admin-only** (set
from the admin box on a lead): partners never get a button that argues for a refund, and the
database refuses the value from a partner login.
Use the return in every renewal and upsell conversation, feed your own "not a lead" and
"spam" flags back into negative keywords, and make tagging a two-minute ritual on the
monthly check-in call.

## When a partner leaves

Admin → partner → Settings → **Partner is leaving…** → pick a reason (price, capacity, lead
quality, in-house, seasonal, other) and a note → **Pause their portal**. Their login shows a
"paused" screen, their enquiry webhook stops accepting, and everything (calls, recordings,
tags, reports) is kept. They move to **Past partners** at the bottom of the admin list with
the reason. Open them and tap **Reactivate partner** to switch it all back on in one tap.
The admin list also shows when each partner last opened the portal; two weeks without
opening it is your early warning.

## Changing things later

- Joe's phone / WhatsApp / email: `app/public/config.js`.
- Copy and layout: `app/public/app.js` (one file, screens are named `renderHome`, `renderLeads`…).
- Database: edit `app/supabase/schema.sql` and re-run it (it's written to be re-runnable).
- Tested locally: the schema and its security rules have an automated test
  (`su postgres -c "psql -d lh_test -f rls_test.sql"` in the dev session) covering admin,
  partner and stranger sessions; the app has a browser test in demo mode.
