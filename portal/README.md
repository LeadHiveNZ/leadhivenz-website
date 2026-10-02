# LeadHive Partner Portal

A phone-first portal each LeadHive partner (plumber, sparky, handyman…) logs into to see
their leads, listen to call recordings, read Joe's monthly notes and tag what happened with
each lead. Joe uploads one Nimbata CSV per partner per month, pastes the notes, hits publish.

```
portal/
  leadhive-portal-master.html   working prototype: every screen, demo data, real CSV parser
  screens/                      rendered previews (iPhone width) of every screen
  assets/leadhive-logo.png      original logo (not used in the UI: it says "New Zealand")
  README.md                     this file
```

## Try the prototype

Open `leadhive-portal-master.html` in a browser (works from a phone too). Demo logins:

| Role   | Email                      | Password |
|--------|----------------------------|----------|
| Client | mike@mikesplumbing.co.nz   | demo     |
| Admin  | hello@leadhivenz.com       | admin    |

Everything runs in the browser on demo data saved in localStorage. Admin → "Reset demo data"
puts it back. Add `?dev` to the URL for a route switcher. The prototype is good enough to put
in front of a prospect on a sales call: log in as Mike, scroll the home screen, play a call.

## The live build (Lovable)

- Editor: https://lovable.dev/projects/c99140b8-686a-499b-9197-fc1242e355a2
- Preview: https://id-preview--c99140b8-686a-499b-9197-fc1242e355a2.lovable.app
- Stack: Lovable Cloud (Supabase auth + Postgres + storage), TanStack Start server routes,
  Resend for the "your results are in" email, PWA manifest so it installs like an app.
- Suggested domain: `portal.leadhivenz.com` (add a "Partner login" link on leadhivenz.com).

The prototype is the design reference for the Lovable build. If the build drifts, point the
agent back at this folder.

## Who sees what

| Screen        | Client sees                                                                 | Admin sees extra                              |
|---------------|-----------------------------------------------------------------------------|-----------------------------------------------|
| Home          | leads this month vs plan, calls / web / answered / missed / avg call, note from Joe, leads by month, by week, latest leads | "View as" any partner                         |
| Leads         | every call + web enquiry, filters (to tag, missed, web, recorded, won)      | same                                          |
| Lead          | caller, call back / text, recording player, Joe's note, outcome tagging     | same                                          |
| Reports       | one report per published month: stats, ROI card, Joe's summary, 3 changes, PDF | drafts                                        |
| Account       | plan, fee, next invoice, contact Joe, add-to-home-screen                    |                                               |
| Admin         |                                                                             | partners list, upload month, settings & login, margin per month, enquiry webhook |

Clients never see Google Ads spend unless the per-partner toggle is on. Cost per lead shown to
clients is **fee ÷ leads** (e.g. $1,500 ÷ 22 = $68), never ad spend.

## Monthly routine (about 5 minutes per partner)

1. Nimbata → Call log → filter the partner's project + the month → Export CSV.
2. Admin → Upload month → pick partner + month → drop the CSV. Check the "Looks good" chip
   and the missed %, avg call, recordings count.
3. Tap **Copy summary for Claude**, paste it into Claude with the Google Ads spend. Claude
   returns the 2–3 sentence summary and three "What I'm changing" points.
4. Paste them in, type the ad spend (admin only), attach the PDF from the lead-report skill
   if you made one, **Publish to client**. They get an email and it's live in their portal.

Web enquiries don't wait for month end: the landing page posts them to the portal the moment
they're sent (see webhook below). Calls arrive with the CSV; a Nimbata webhook can make them
live later (phase 2).

## CSV format (Nimbata export)

Headers are matched loosely (case and spaces ignored). Minimum useful columns:

| Field      | Accepted headers                                              | Notes                                     |
|------------|---------------------------------------------------------------|-------------------------------------------|
| Date/time  | Date + Time, or Date/Time, Start time, Timestamp               | dd/mm/yyyy, optional am/pm, or ISO        |
| Caller     | Caller, Caller ID, Caller Number, From, Phone                  |                                           |
| Duration   | Call Duration, Duration, Talk time                             | seconds, m:ss, h:mm:ss or "2m 34s"        |
| Outcome    | Outcome, Status, Disposition                                   | answered / missed / voicemail; if missing, answered when ≥ 20s |
| Recording  | Recording, Recording URL, Recorded                             | URL, or yes/no                            |
| Optional   | Tracking Number, Source, Campaign, Keyword, City, Call ID, Notes, Lead Status, Value | kept in `raw`             |

Only rows dated in the selected month are imported. Re-importing a month replaces its calls
but keeps the client's tags on rows that match (Call ID, or date + caller).

## Enquiry webhook (add to each landing page)

Each partner has a key in Admin → Settings. In the landing page's `src/routes/api/public/enquiry.ts`,
after the Resend email succeeds, add:

```ts
await fetch("https://portal.leadhivenz.com/api/webhooks/enquiry", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-leadhive-key": process.env["LEADHIVE_PORTAL_KEY"]! },
  body: JSON.stringify({ name, phone, suburb, issue, isUrgent, page }),
}).catch(() => {});
```

and set `LEADHIVE_PORTAL_KEY` in that Lovable project's secrets to the partner's key.

## Outcome tagging = the ROI engine

Partners tag each lead New / Quoted / Won (+ job value) / Not a lead / Spam. The portal then
shows "$5,750 in won jobs from a $1,500 plan · 3.8x". Use it in every renewal and upsell
conversation, and feed "not a lead" / "spam" back into negative keywords.

## Data model (for the Lovable build)

`profiles` (role admin|client, client_id) · `clients` (business, contact, package, fee, target
min/max, show_cost_per_lead, show_ad_spend, webhook_key) · `months` (client_id, ym, status,
ad_spend, summary, points[], pdf_path, published_at) · `calls` (client_id, called_at, caller,
duration_sec, outcome, keyword, campaign, city, recording_url/path, nimbata_call_id, admin_note,
client_status, job_value, client_note, raw) · `enquiries` (client_id, received_at, name, phone,
suburb, message, is_urgent, page, client_status, job_value, client_note).
