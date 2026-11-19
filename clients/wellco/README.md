# Wellco Project Brain: runbook

Client: **Wellco Developments Pty Ltd** (ABN 81 096 401 400, ACN 096 401 400), Milton NSW, est. 2001.
Contact: Dan Wellman, Managing Director, dan.wellman@wellco.net.au.
Build: Joe Ingram, LeadHive (hello@leadhivenz.com). Source: Zoom with Dan + his build brief, 2 Nov 2026.

One app for Dan to run the admin of each project company: stage checklists (9 stages by default,
editable), RFQs and quotes, engagements, bills with GST and cost category per line, budget vs actual,
BAS per company, documents, Excel for the accountant. Single user. Wellco itself stays on Xero.

**16 Nov 2026 setup call:** Dan is happy with the layout; the schema has been updated for his
changes. See [Changes from 16 Nov call](#changes-from-16-nov-call) below.
**17 Nov 2026 feedback on draft 2:** Quick Feaso, Make Offer, fuller "Log a site", task dates that
follow each other. Schema v3. See [Changes from 17 Nov](#changes-from-17-nov) below.

## What's in this folder

```
clients/wellco/
  wellco-demo.html       clickable demo (single file, no build step, seed data is fictional)
  screens/               screenshots of the demo for the proposal / email
  proposal.md            client proposal to Dan (Joe-only notes in the HTML comment at the top)
  changes-2026-11-16.md  what Dan asked for on the 16 Nov setup call (the source for v2)
  changes-2026-11-17.md  Dan's feedback on draft 2 (the source for v3)
  reference/             Dan's own files: Quick Feso Subdivision.xlsx, Letter of Offer template .docx
  supabase-schema.sql    production database + file storage for the real app (paste into Supabase), v3
  supabase-tests.sql     local Postgres test script for the schema (never run on Dan's project)
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
- [ ] Reset demo data works. Looks right on phone and laptop. No "lorem", no "TODO", no console errors.
- [ ] Screenshots saved to `screens/` (home, project, quotes compare, money/GST, approval drawer).
- [ ] Hosted link + `[DEMO LINK]` placeholder in `proposal.md` filled in. Pricing placeholders checked.

---

## 2. Hosting options for the real app

Two choices about **who owns the backend** (A or B), and one about **how the front end gets built** (C,
which sits on top of A or B). On the call Joe pitched A: build it on Dan's account so he owns it.

### Option A (recommended): Supabase on Dan's own account

Dan owns the data and the PDFs and pays Supabase directly. Joe is invited as a team member.

**A1. Dan creates the account** (do it together on a 10-minute Zoom)
1. supabase.com > Start your project > sign up with **dan.wellman@wellco.net.au**.
2. It creates an organisation. Name it `Wellco Developments`. Plan: start Free, move to Pro at go-live (see costs).
3. Organisation > Team > Invite > `hello@leadhivenz.com` as **Administrator** (Dan stays Owner).

**A2. Create the project** (Joe, from the invite)
1. New project > name `wellco-project-brain`.
2. Database password: generate, save it in Dan's password manager (and yours). You rarely need it.
3. Region: **Sydney (ap-southeast-2)**. Create, wait ~2 minutes.

**A3. Run the schema**
1. Left menu > **SQL Editor** > New query.
2. Paste all of `supabase-schema.sql` > **Run**. Expect "Success. No rows returned".
3. Check: Table Editor shows 31 tables (projects, project_stages, companies, contacts, tasks,
   invoice_in_lines, deal_feasos, deal_offers...). Storage shows the `project-documents` bucket (private).
4. The stage templates, contact categories / roles, project types, document types, zonings, the offer
   term bank and the Wellco company row are created per user **when Dan's login is created (A5)**, so they are empty until then.

**A4. File storage**
- The schema creates the private bucket `project-documents` and its access rules. Nothing to click.
- Any file type (PDF, Excel, Word, photos). The extension is stored on the document row.
- Path convention (the app and the database both use it):
  `<ProjectID>/<doc_type>/<ProjectID>_<DocType>_<Party>_<YYYY-MM-DD>.<ext>`
  e.g. `CROOBYAR/quote/CROOBYAR_Quote_SouthcoastCivil_2026-10-14.pdf`
- Files dropped on a deal go to `deals/<deal_id>/<doc_type>/Deal-<Address>_<DocType>_<Party>_<date>.<ext>`.
  When the deal becomes a project (`convert_deal_to_project`) the rows move to the project, filed under
  stage 1, and are renamed to the project naming; the files stay at the deals/ path (still allowed).
- Files can only be uploaded into a folder named after one of Dan's projects or deals.
- If the bucket step errors (bucket made by hand first), the database part is already saved. Re-run only PART 2.

**A5. Login for Dan only**
1. Authentication > Sign In / Providers > **Email** on. Confirm email: on.
2. Authentication > Users > Add user > Create new user > `dan.wellman@wellco.net.au`, a strong password,
   tick Auto Confirm. (His settings row and default lists are created automatically.)
   Check in SQL Editor: `select project_type, count(*) from stage_templates group by 1;` gives
   commercial_industrial 9, land_subdivision 9, residential_build 8. Then fill in Wellco's ABN on the
   `Wellco Developments Pty Ltd` row in `companies`.
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
4. Tell Lovable: "The database schema already exists. Use the existing tables, views and functions
   (v_project_summary, v_project_stages, v_needs_attention, v_bas_summary, v_bas_company_quarters,
   v_bas_by_project, v_budget_vs_actual, v_funds_needed, v_project_issuer, v_rfq_status,
   v_engagement_progress, v_contacts, v_contacts_by_category, v_documents, v_deals, v_deal_feasos,
   v_offer_letters; create_project_from_template, add_project_stage, add_template_stage,
   convert_deal_to_project, close_company, delete_contact_role, file_offer_letter). Bills are a header in
   invoices_in plus rows in invoice_in_lines. Do not create or change tables unless I ask."
   Use plan mode for each section (Projects, Quotes, Money...) before letting it write code.
5. Publish > connect a domain like `app.wellco.au` (needs a paid Lovable plan; Dan adds one DNS record).
6. On Dan's iPhone/iPad: open the link in Safari > Share > **Add to Home Screen**. It opens full screen
   like an app. No App Store needed.

---

## 3. OneDrive backup workflow

Dan wants OneDrive as the "if something goes down" copy. Two jobs:

| Job | When | What lands in OneDrive |
|---|---|---|
| Documents | Nightly, 2am | New/changed files (any type), same folders as the app: `/Wellco/Project Brain backups/<ProjectID>/<doc_type>/<file>` and `.../deals/<deal_id>/...` |
| Workbooks | Weekly, Sunday night | One `.xlsx` per active company: `/Wellco/Project Brain backups/Workbooks/<Company>_<FY>_<date>.xlsx` (same tabs as the Export button) |

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
| 2.2 | Projects & stages | Home "Needs you today", project cards, stage stepper from `project_stages`, checklists, lead-time warnings, new project wizard by type (land / commercial / residential) with street / suburb / state / postcode. Settings: edit stage templates and template tasks; on a project, rename / insert stages and tasks. Task due dates editable on the task, or set to follow another task or a project date (exchange, DD expiry, unconditional, DA approval, settlement) | 3 days |
| 2.3 | Contacts, deals & companies | Contacts A to Z by category with editable categories and roles (rename, delete with "move contacts to"), phone and mobile, expiry warnings. Log a site with split address, zoning (Settings list), land and minimum lot size, yield, purchase tax type; documents dropped straight on the deal; "Create project" carries it all across. Companies register (owner per project, assign when registered, close after bonds) | 2.5 days |
| 2.3b | Quick Feaso & Make Offer | Quick Feaso on a deal (his spreadsheet, prefilled from the deal, saved as versions). Make Offer: offers per deal from his term bank, status, one accepted; letter generated as PDF in the browser in his layout and filed on the deal | 2.5 days |
| 2.4 | Quotes & engagements | RFQ templates, side-by-side compare, min-3 check, appoint with reason, POs/engagement letters as PDF in the project company's name | 2.5 days |
| 2.5 | Approvals & email | Approval drawer, real sending from Dan's Gmail (Make.com Gmail module, or Gmail API with an internal Workspace OAuth app), action log | 1.5 days |
| 2.6 | Money & GST | Bills and sales invoices with lines (GST treatment AND cost category per line), budget vs actual by line, BAS per company per quarter with the "nothing to lodge" list, funds needed before sign-off, FY roll-over, intercompany/distribution flags | 3.5 days |
| 2.7 | Documents | Upload any file type from phone/iPad camera or files, auto-naming, folders by stage and by type, preview (PDF; Excel/Word download) | 1.5 days |
| 2.8 | Exports | One BAS workbook per company per quarter, year-end workbook per company per FY, full project workbook (.xlsx) | 1.5 days |
| 2.9 | Backups | Make.com nightly PDFs + weekly workbooks to OneDrive | 0.5 day |
| 2.10 | Data load & handover | Load Dan's live projects from his spreadsheets, test on his phone/iPad/laptop, handover Zoom | 1.5 days |
| | **Total** | **v1 live in ~4 weeks of calendar time** | **~20.5 days** |
| 3 | Tweaks | 30 days of Dan using it for real; fixes and small changes included | as needed |

**Later (quote separately if Dan asks):** forward-an-email/PDF-to-the-app inbox that drafts the invoice or
quote for approval, Google Calendar sync for DA dates and settlements, read-only accountant login,
Xero link for Wellco's management fee invoices.

## 5. Open items to confirm with Dan

- Per company: GST registration date and BAS cycle (quarterly or not lodging yet), so the quarter-end
  list shows the right "lodge / nil BAS / nothing to lodge".
- Management fee basis (fixed / % of costs / one invoice at the end). Field exists in Settings.
- Cash or accruals GST basis per company (the BAS view uses invoice date; switch to paid date if cash).
- Which entity is principal contractor / licence holder (from his brief; the app works either way).
- GST treatments and margin scheme: Dan's accountant signs off the categories before the first real BAS.

## Changes from 16 Nov call

Source: `changes-2026-11-16.md` (Dan + Joe setup call). Schema is now **v2**: it replaces v1 outright
(nothing was loaded into Dan's Supabase yet). Tested on local Postgres 16 with `supabase-tests.sql`:
two fresh databases, 82 checks, all passing.

| # | Dan asked for | Where it lives now |
|---|---|---|
| 1 | New stage 7 **Certification & Registration** (9 stages), with funds needed before sign-off | `stage_templates` seed; `funds_needed` + `v_funds_needed` (total / paid / still to find), shows on "Needs you today" from Construction on |
| 2 | Add / rename stages and tasks himself | `stage_templates` + `stage_template_tasks` (defaults, Settings) copied into `project_stages` + `tasks` per project; `add_project_stage`, `add_template_stage` |
| 3 | Residential build type | `project_types` table (Dan can add more), own 8-stage template |
| 4 | Add roles and categories, contact in two categories | `contact_categories`, `contact_roles`, `contact_role_links`, `contact_extra_categories`; `v_contacts_by_category` |
| 5 | Cost category per bill line | `invoice_in_lines` / `invoice_out_lines`; header totals come from the lines; budget, BAS and home screen add up by line; lines lock once approved |
| 6 | Documents on deals, filed by stage and type, any file type | `documents.deal_id` or `project_id` (exactly one), `stage_id`, `document_types`; `convert_deal_to_project` moves them to stage 1 and logs it |
| 7 | Register of his companies, one owning each project | `companies`; `projects.owner_company_id` (blank while "Dan Wellman and/or nominee"); `v_project_issuer` for everything issued; `v_bas_summary` per company per quarter; `v_bas_company_quarters` for nil / nothing-to-lodge; `close_company` |
| 8 | Excel download broken from the shared link | Demo fix, not schema (`wellco-demo.html`) |

App notes for the build:
- Show stage numbers from `v_project_stages.stage_no` (1..n in order), never a stored number.
- Find "the Certification stage" by `stage_key = 'certification'`, not by name or position (Dan may rename it).
- A one-line bill can still be saved in one go: insert the header with `amount_ex_gst` / `gst_amount`
  and the line is created for you. Split bills: header first, then one `invoice_in_lines` row per line.
- Issued documents (RFQs, engagement letters, POs, sales invoices) take the name, ABN and bank from
  `v_project_issuer`, which reads "Dan Wellman and/or nominee" until a company is assigned.

## Changes from 17 Nov

Source: `changes-2026-11-17.md` (Dan's email on draft 2) and his two files in `reference/`. Schema is now
**v3** (replaces v2 outright; still nothing loaded on Dan's Supabase). `supabase-tests.sql`: two fresh
Postgres 16 databases, 139 checks, all passing, including his Quick Feaso example to the cent.

| # | Dan asked for | Where it lives now |
|---|---|---|
| 1 | Quick Feaso button on a deal | `deal_feasos` (inputs, one row per saved version; lots, land price and sales GST method fill from the deal; every other default is his sheet's figure) + `v_deal_feasos` (his formulas, rounded at the end). His example (30 lots x $300,000, land $800,000, equity $800,000): net revenue $7,939,545.45, total cost $5,699,500.00, inc finance $5,970,772.50, net profit $1,968,772.95, MoC 0.3297 |
| 2 | Make Offer tab, several offers per deal | `deal_offers` (status draft / sent / countered / accepted / declined / withdrawn, one accepted per deal, conditions as an ordered list, `document_id` for the generated letter); `offer_terms` seeded with the 41 options from his Word term bank, word for word; `v_offer_letters` lays out page 1 of his template |
| 3 | Log a site captures more and carries into the project | `deals`: street / suburb / state / postcode (+ `address` for display), lot / DP, `zoning_id` (`zonings`, his list), land area, min lot size, yield + unit (lots / factory units / units), purchase tax type. `convert_deal_to_project` copies all of it plus notes, documents, the latest feaso (`projects.feaso_id`, headline budget) and the accepted offer (`projects.accepted_offer_id`, purchase price, exchange date) |
| 4 | Edit original info after creation | Plain columns on deals and projects; a converted deal can't be deleted (it's the project's history) |
| 5 | Mobile as well as phone | `contacts.mobile` |
| 6 | Rename and delete roles | Rename = update the name (links are by id). Delete: refused while in use, or `delete_contact_role(role, move_to_role)` moves the contacts first |
| 7 | Contacts A to Z | `v_contacts.sort_name` (company, else name, any case) |
| 8 | Postcode on the new project form | `projects.street / suburb / state / postcode`; same split on the company's registered address |
| 9 | Task due dates editable; real dates move | `tasks.due_on` editable. Optional rule: follow another task (its due date or the day it's ticked off) or a project date (`exchange_on`, `dd_expiry_on`, `unconditional_on`, `da_approval_on`, `settlement_on`) by N days. Changes ripple down the chain; a date Dan types sticks (`manual_override`); loops refused. Template tasks carry default rules (DD 60 days after exchange, settlement 120 days after DD, electricity application on DA approval) |
| 10 | Document types editable | `document_types`: add, rename (file-name code follows), delete if unused |

App notes for the build:
- Quick Feaso: save a new version per change (don't edit old ones); show `v_deal_feasos` where `is_latest`.
  His per-lot "Total cost" excludes the land; it is `cost_to_complete_per_lot`.
- Fixes to his sheet: the fixed 30 lots (legal quantity, two per-lot cells) and 29 for s94 now follow the
  lot count, with `existing_lot_credit` (default 1) for lots already on title.
- Make Offer: the term drop-downs read `offer_terms` by field; Dan can type his own wording too.
  Generate the letter from `v_offer_letters`, file it as a document on the deal, set `deal_offers.document_id`.
- Task dates: set the project's milestone dates (exchange etc.) and the following tasks fill themselves.
  Show a small "follows ..." note and a "reset to rule" action (clears `manual_override`).

**18 Nov addendum (Dan's answers).** Schema v3 updated; tests now 146 checks, all passing on two fresh
databases.
- Quick Feaso finance has a months input: `land_loan_months` and `construction_loan_months` (default 12,
  must be above 0). Interest = debt x rate x months / 12, construction still on half the balance. 12 / 12
  still gives his example to the cent; 6 construction months halves construction interest; 18 land months
  gives 1.5x land interest.
- Offers go out as PDF. `deal_offers.letter_format` is `pdf` by default (`docx` still possible). The app
  generates the PDF client-side (in the browser, from `v_offer_letters`), calls
  `file_offer_letter(offer_id)` to get the document row and storage path (new "Letter of offer" document
  type, standard name ending `.pdf`, e.g. `Deal-21TynanRdTabletop_LetterOfOffer_Offer1_2026-11-17.pdf`),
  uploads the file there, and the offer links to it. Each regenerate files a new copy.
