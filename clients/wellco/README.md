# Wellco Project Brain: runbook

Client: **Wellco Developments Pty Ltd** (ABN 81 096 401 400, ACN 096 401 400), Milton NSW, est. 2001.
Contact: Dan Wellman, Managing Director, dan.wellman@wellco.au.
Build: Joe Ingram, LeadHive (hello@leadhivenz.com). Source: Zoom with Dan + his build brief, 2 Nov 2026.

One app for Dan to run the admin of each project company: 8-stage checklists, RFQs and quotes,
engagements, invoices with GST flags, budget vs actual, BAS summaries, PDFs, Excel for the
accountant. Single user. Wellco itself stays on Xero.

## What's in this folder

```
clients/wellco/
  wellco-demo.html       clickable demo (single file, no build step, seed data is fictional)
  screens/               screenshots of the demo for the proposal / email
  proposal.md            client proposal to Dan (Joe-only notes in the HTML comment at the top)
  supabase-schema.sql    production database + file storage for the real app (paste into Supabase)
  README.md              this file
```

Demo seed data is made up: Croobyar Rd Milton, Princes Hwy Ulladulla, Bells Rd Jimboomba QLD,
Hawken Dr Vincentia, closed project at Wandandian. Dan's real projects get loaded in Phase 2.

---

## 1. Sending the demo

The demo is one HTML file. It saves Dan's clicks in his own browser (localStorage), so anything he
changes stays on that device only, and **Settings > Reset demo data** puts it back.

- **Offline / file://**: double-click `wellco-demo.html` and it opens in any browser. Fine for Joe and
  for Dan on a laptop. Needs internet once for the font and for the Excel export library (cdnjs); without
  it the app still works but the Export buttons won't.
- **Don't email the file to a phone.** iPhone Mail previews HTML attachments without running the app.
  Send a link instead.
- **Fastest link (2 minutes): Netlify Drop**
  1. Make a folder, copy `wellco-demo.html` into it and rename the copy `index.html`.
  2. Go to app.netlify.com/drop and drag the folder onto the page.
  3. Site settings > Change site name > `wellco-demo` (gives `wellco-demo.netlify.app`).
  4. Open the link on your phone on mobile data (not wifi) before sending.
- **Alternatives**: GitHub Pages from this repo, or publish it as a Lovable project (see Option C).

### Pre-send checklist

- [ ] Opens on laptop (Chrome + Safari), iPhone Safari and iPad. No sideways scroll at phone width.
- [ ] First-run welcome sheet says "Hi Dan" and the 3 suggested things to try all work.
- [ ] Home "Needs you today" list shows items; each project card opens its project.
- [ ] Approve & send drawer shows the "Demo, nothing is actually sent" badge.
- [ ] Each Export button downloads a real `.xlsx` that opens in Excel with all tabs
      (Summary, Budget, RFQs & Quotes, Engagements, Invoices In, Invoices Out, Sales, GST-BAS, Tax Summary).
- [ ] GST-free lines (council contributions, stamp duty, LRS) show $0 GST in the BAS tab.
- [ ] Settings shows Wellco's real details (ABN 81 096 401 400, Milton NSW). Project companies are fictional.
- [ ] Closed project reads "Wandandian" everywhere (an early spec said Berry).
- [ ] Reset demo data works. Dark mode looks right. No "lorem", no "TODO", no console errors.
- [ ] Screenshots saved to `screens/` (home, project, quotes compare, money/GST, approval drawer).
- [ ] Hosted link + `[DEMO LINK]` placeholder in `proposal.md` filled in. Pricing placeholders checked.

---

## 2. Hosting options for the real app

Two choices about **who owns the backend** (A or B), and one about **how the front end gets built** (C,
which sits on top of A or B). On the call Joe pitched A: build it on Dan's account so he owns it.

### Option A (recommended): Supabase on Dan's own account

Dan owns the data and the PDFs and pays Supabase directly. Joe is invited as a team member.

**A1. Dan creates the account** (do it together on a 10-minute Zoom)
1. supabase.com > Start your project > sign up with **dan.wellman@wellco.au**.
2. It creates an organisation. Name it `Wellco Developments`. Plan: start Free, move to Pro at go-live (see costs).
3. Organisation > Team > Invite > `hello@leadhivenz.com` as **Developer** (or Administrator).

**A2. Create the project** (Joe, from the invite)
1. New project > name `wellco-project-brain`.
2. Database password: generate, save it in Dan's password manager (and yours). You rarely need it.
3. Region: **Sydney (ap-southeast-2)**. Create, wait ~2 minutes.

**A3. Run the schema**
1. Left menu > **SQL Editor** > New query.
2. Paste all of `supabase-schema.sql` > **Run**. Expect "Success. No rows returned".
3. Check: Table Editor shows 15 tables (projects, contacts, tasks, quotes...). Storage shows the
   `project-documents` bucket (private). Run `select * from stages;` and get 8 rows.

**A4. File storage**
- The schema creates the private bucket `project-documents` and its access rules. Nothing to click.
- Path convention (the app and the database both use it):
  `<ProjectID>/<doc_type>/<ProjectID>_<DocType>_<Party>_<YYYY-MM-DD>.pdf`
  e.g. `CROOBYAR/quote/CROOBYAR_Quote_SouthcoastCivil_2026-10-14.pdf`
- Files can only be uploaded into a folder named after one of Dan's projects.
- If the bucket step errors (bucket made by hand first), the database part is already saved. Re-run only PART 2.

**A5. Login for Dan only**
1. Authentication > Sign In / Providers > **Email** on. Confirm email: on.
2. Authentication > Users > Add user > Create new user > `dan.wellman@wellco.au`, a strong password,
   tick Auto Confirm. (His settings row is created automatically.)
3. Authentication > Sign In / Providers > **Allow new users to sign up: OFF**. Important: with this off,
   nobody else can make an account.
4. Optional: Authentication > URL Configuration > Site URL = the app's address (for password reset emails).

**A6. Keys for the app**
1. Project Settings > API (or API Keys) > copy **Project URL** and the **anon / publishable key**.
2. These go into the front end as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (Lovable fills them in automatically when you connect Supabase, see C).
3. The anon key is safe in the app: the database rules (RLS) mean it reads nothing without Dan's login.
   **Never** put the `service_role` / secret key in the app. It only goes in Make.com / edge functions.

**Costs (Dan pays Supabase):**
- Free plan: AU$0, but projects **pause after a week with no activity** and have no automatic backups.
  Fine for build and testing.
- Pro plan: US$25/month (~AU$40). No pausing, daily backups, 100GB file storage. Switch on at go-live.

### Option B: Joe hosts (monthly fee)

Same as A, but the Supabase project lives in **LeadHive's** organisation and Joe pays it.
1. In your Supabase org: New project > `wellco-project-brain` > Sydney. Then A3 to A6 exactly as above.
2. Bill Dan the monthly hosting & support fee (see proposal). Supabase cost comes out of it.
3. Put a handover clause in writing: Dan's data is his. If he leaves, transfer the project to his own org
   (Project Settings > General > Transfer project) or hand over a full export. Switching B to A later is
   a 15-minute job, so this is a low-risk start if Dan can't be bothered with accounts.

### Option C: Lovable front end connected to Supabase (fastest path to a real app)

This repo's client sites already go through Lovable. Use it to turn the demo into the real app.
1. Do A1 to A5 first (or B), so the database exists before Lovable touches anything.
2. lovable.dev > New project. First message: describe the app, paste the "Screens" section of the spec,
   and attach screenshots from `screens/` and `wellco-demo.html` as the visual reference.
3. In the Lovable editor: **Integrations > Supabase > Connect** > log in with the account that can see
   Dan's org > pick `wellco-project-brain`. Choose the external Supabase project, not a new Lovable Cloud
   backend, so the data stays in Dan's account.
4. Tell Lovable: "The database schema already exists. Use the existing tables and views
   (v_project_summary, v_needs_attention, v_bas_summary, v_budget_vs_actual, v_rfq_status,
   v_engagement_progress, v_contacts). Do not create or change tables unless I ask."
   Use plan mode for each section (Projects, Quotes, Money...) before letting it write code.
5. Publish > connect a domain like `app.wellco.au` (needs a paid Lovable plan; Dan adds one DNS record).
6. On Dan's iPhone/iPad: open the link in Safari > Share > **Add to Home Screen**. It opens full screen
   like an app. No App Store needed.

---

## 3. OneDrive backup workflow

Dan wants OneDrive as the "if something goes down" copy. Two jobs:

| Job | When | What lands in OneDrive |
|---|---|---|
| Documents | Nightly, 2am | New/changed PDFs, same folders as the app: `/Wellco/Project Brain backups/<ProjectID>/<doc_type>/<file>.pdf` |
| Workbooks | Weekly, Sunday night | One `.xlsx` per live project company: `/Wellco/Project Brain backups/Workbooks/<ProjectID>_<FY>_<date>.xlsx` (same tabs as the Export button) |

**Simplest: Make.com** (runs on LeadHive's Make account as part of support, so Dan doesn't get another subscription)
1. Connections: Supabase (Project URL + **service_role** key, kept in Make only) and OneDrive (Dan logs in once).
2. Scenario "Wellco docs nightly": Schedule (daily 2am Sydney) > Supabase *Search rows* on `documents`
   where `backed_up_at` is empty or older than `updated_at` > for each: Supabase Storage *Download file*
   (`storage_path`) > OneDrive *Upload a file* (folder from the path) > Supabase *Update row*
   `backed_up_at = now` > at the end, update `wellco_settings.last_document_backup_at`.
3. Scenario "Wellco workbooks weekly": Schedule (Sunday 11pm) > HTTP call to a small Supabase Edge
   Function `export-workbooks` (same SheetJS code as the in-app Export button, returns the .xlsx files) >
   OneDrive *Upload a file* > update `wellco_settings.last_workbook_export_at`.
4. Error handler on both: email hello@leadhivenz.com. The Settings screen shows the last backup times,
   so Dan can see it's working.
5. Volume is tiny (a few dozen PDFs a month), well inside Make's free/entry tier.

**Alternative, no Make:** Supabase Edge Function on a schedule (pg_cron) pushing to OneDrive via Microsoft
Graph. Needs an Azure app registration and token refresh. More fiddly, only worth it if Make is a no-go.

Supabase Pro's own daily database backups cover the data side; the OneDrive copy is Dan's readable spare.

---

## 4. Phase 2 build plan (after Dan says go)

Rough effort for one builder using Lovable + the schema in this folder.

| # | Chunk | What's in it | Est. |
|---|---|---|---|
| 2.1 | Foundation | Dan's Supabase (A1-A6), schema, login, home-screen install, Wellco settings | 0.5 day |
| 2.2 | Projects & stages | Home "Needs you today", project cards, 8-stage stepper, checklists, lead-time warnings, new project wizard (checklist + budget skeleton + folders) | 2 days |
| 2.3 | Contacts & deals | Shared contacts with roles and expiry warnings, sourcing pipeline, "Create project" from a Go site | 1 day |
| 2.4 | Quotes & engagements | RFQ templates, side-by-side compare, min-3 check, appoint with reason, POs/engagement letters as PDF in the project company's name | 2.5 days |
| 2.5 | Approvals & email | Approval drawer, real sending from Dan's Gmail (Make.com Gmail module, or Gmail API with an internal Workspace OAuth app), action log | 1.5 days |
| 2.6 | Money & GST | Invoices in/out with GST treatment per line, budget vs actual, BAS by quarter, FY roll-over, intercompany/distribution flags | 3 days |
| 2.7 | Documents | Upload from phone/iPad camera or files, auto-naming, folders by type, PDF viewer | 1.5 days |
| 2.8 | Exports | Year-end workbook, BAS summary, full project workbook (.xlsx) per company per FY | 1.5 days |
| 2.9 | Backups | Make.com nightly PDFs + weekly workbooks to OneDrive | 0.5 day |
| 2.10 | Data load & handover | Load Dan's live projects from his spreadsheets, test on his phone/iPad/laptop, handover Zoom | 1.5 days |
| | **Total** | **v1 live in ~3 weeks of calendar time** | **~15 days** |
| 3 | Tweaks | 30 days of Dan using it for real; fixes and small changes included | as needed |

**Later (quote separately if Dan asks):** forward-an-email/PDF-to-the-app inbox that drafts the invoice or
quote for approval, Google Calendar sync for DA dates and settlements, read-only accountant login,
Xero link for Wellco's management fee invoices.

## 5. Open items to confirm with Dan

- Management fee basis (fixed / % of costs / one invoice at the end). Field exists in Settings.
- Cash or accruals GST basis per company (the BAS view uses invoice date; switch to paid date if cash).
- Which entity is principal contractor / licence holder (from his brief; the app works either way).
- GST treatments and margin scheme: Dan's accountant signs off the categories before the first real BAS.
