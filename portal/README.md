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
5. Authentication → URL configuration → Site URL = the portal's address (the `*.netlify.app` one,
   or `https://portal.leadhivenz.com` once connected), and add `<that address>/*` to Redirect URLs.
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
   - `PORTAL_URL` (optional) = the portal's address; links otherwise follow the address the portal is open on
4. Deploy. Optional: Site configuration → Change site name (e.g. `leadhive-portal.netlify.app`), or
   Domain management → add `portal.leadhivenz.com`, which needs the TXT + CNAME records Netlify shows,
   added where leadhivenz.com's DNS lives (Squarespace → Domains). The portal works either way.

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
admin-only table), and they never see a cost per lead at all: the portal shows them the
value of their leads, what they've confirmed won, and their return, nothing that invites a
price conversation.
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

A file that spans several months is split automatically ("Import every month in this file"
is on by default when more than one month is detected). A partner who has been running for
five months can be loaded from one export.

**Backdating a new partner in one go.** Creating a partner takes you straight to their upload
screen. Drop their Nimbata export (and web-enquiries CSV) covering every month so far and a
**Create a report for every month** card appears: one tap imports everything and publishes a
report for each finished month (leads, calls, web enquiries, week-by-week split, and a summary
written from the numbers). The month picked at the top uses your notes if you wrote them; the
current month stays as "this month so far"; months that already have a report are left alone;
no emails go out. Edit any month's notes afterwards from the partner's page.

**Start date.** Set it on the new-partner form or right on the upload screen. Anything before it
is left out on upload, so a previous partner's calls never land on the new one. If everything in
the file is earlier than the start date, the upload screen offers to start from the first lead.

### Web enquiries by CSV

Until a landing page has the webhook, its enquiries arrive as emails. Drop a CSV with
`Date, Name, Phone, Suburb, Message, Urgent, Page` into the second zone on the upload screen;
every month in it is imported and re-uploads are matched on phone + time. Claude can screen
the enquiry emails in hello@leadhivenz.com and produce that CSV per partner.

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

## Replacing a partner in a region

Sign the new one, then Admin → **+ New partner** → in "Replacing a past partner?" pick who
they take over from. Their region, trade and plan are copied in, and the old partner's
enquiry connection moves across, so the landing page keeps posting enquiries without any
change to it. Then: set the new partner's mobile, email and password, create the login, and
in Nimbata change the tracking number's forwarding to the new mobile. Next upload, pick the
new partner. The old partner's history stays on their own record under Past partners.

**Already set up the new partner before adding the old one?** Add the old partner afterwards:
1. **+ New partner** with their business name, region, plan and real start date. Leave email and
   password empty, so no login is created.
2. **Upload month** on their page and drop the Nimbata export for their dates only (filter the
   export to the day they finished), plus their web-enquiries CSV. Save without emailing.
3. Settings → **Partner is leaving…** → reason, **Last day with LeadHive** (their real end date) →
   Pause. They move to Past partners.
4. Open the current partner → Settings → **Took over from** → pick the old partner → Save. This only
   links the history; it doesn't move the enquiry webhook.

The new partner sees the region's track record as **totals only**: leads, calls, web
enquiries and answer rate per month from before they joined (lighter bars on their chart, and
a "before you" list under Reports). They never see the previous partner's callers,
recordings, summaries, tags or job values; that stays private to the old partner's record.

## When a partner leaves

Admin → partner → Settings → **Partner is leaving…** → pick a reason (price, capacity, lead
quality, in-house, seasonal, other) and a note → **Pause their portal**. Their login shows a
"paused" screen, their enquiry webhook stops accepting, and everything (calls, recordings,
tags, reports) is kept. They move to **Past partners** at the bottom of the admin list with
the reason. Open them and tap **Reactivate partner** to switch it all back on in one tap.
**Deleting instead** (test records, or a partner set up wrong): Settings → *Delete this partner
permanently…* → type the business name. Removes their calls, recordings, enquiries, reports and
ad spend for good. Their login stays but is unlinked, and re-links if you create a partner with
the same email. For a real departure, pause instead so the history survives.

The admin list also shows when each partner last opened the portal; two weeks without
opening it is your early warning.

## If something goes wrong

- **Supabase SQL editor says "syntax error" partway through the schema**: the paste was cut short.
  Copy the file from its Raw view (or GitHub's "Copy raw file" button), not by highlighting it.
- **Netlify build fails with "Secrets scanning found secrets"**: `netlify.toml` already lists the
  public values in `SECRETS_SCAN_OMIT_KEYS`; never commit the service role or Resend API key.
- **"login not created: couldn't reach the server"** on an `http://` address: open the
  `https://` address. Netlify redirects server calls to https and the browser blocks that redirect.
- **"login not created: Admin login required"**: in Netlify, `SUPABASE_URL` must be exactly
  `https://<project>.supabase.co` (no `/rest/v1/`) and `SUPABASE_SERVICE_ROLE_KEY` must be the
  service_role key. Trigger a new deploy after changing either.

## Changing things later

- Joe's phone / WhatsApp / email: `app/public/config.js`.
- Copy and layout: `app/public/app.js` (one file, screens are named `renderHome`, `renderLeads`…).
- Database: edit `app/supabase/schema.sql` and re-run it (it's written to be re-runnable).
- Tested locally: the schema and its security rules have an automated test
  (`su postgres -c "psql -d lh_test -f rls_test.sql"` in the dev session) covering admin,
  partner and stranger sessions; the app has a browser test in demo mode.
