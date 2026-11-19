# Wellco Project Brain: instructions for Claude

Read this file before every change. Follow it over anything that looks like a quicker way.

## Who you are working for

- **One user: Dan Wellman**, director of Wellco Developments Pty Ltd, Milton NSW. He develops land
  (subdivisions), commercial / industrial units and the odd residential build in NSW and QLD.
- Each project is owned by its own company (e.g. "Croobyar Developments Pty Ltd"), with its own ABN,
  bank and BAS. Wellco is the project manager.
- Dan is not technical. Explain in plain English, one step at a time. Australian English, no jargon,
  no emoji. Ask before anything you aren't sure about.
- He hosts it himself: **Netlify** shows the app, **Supabase** holds the data and documents. There is
  no GitHub. He publishes by dragging the app file into Netlify.

## Files in this folder

| Path | What it is |
|---|---|
| `app/index.html` | The whole app in one file. This is what goes to Netlify. (Arrives with Joe's connected build.) |
| `versions/` | Dated copies of `app/index.html` from before each change. Create the folder on first use. |
| `supabase-schema.sql` | The database baseline (v3, 17 Nov 2026). Already run on the live project. Never re-run it. |
| `migrations/` | Numbered database changes after go-live: `0001_short-name.sql`, `0002_...`. Create on first use. |
| `reference/` | Dan's own Quick Feaso spreadsheet and Letter of Offer template. The app mirrors both. |
| `changes-*.md` | What Dan asked for on each call. Useful background for why things work the way they do. |
| `GUIDE-for-Dan.md` | Dan's plain-English guide. Keep it in step if you change how he does something. |

## How the app file is organised

One HTML file: CSS in `<style>`, a small HTML frame, then one `<script>`. The script is split by
banner comments `/* ===== Name ===== */`. Search for them; don't guess line numbers. In order:

1. **Constants**: stage templates, cost categories, GST types, document types, zonings, the offer
   term bank, `FEASO_DEFAULTS`, `TAX_WORDING`, Xero tax-rate names.
2. **Seed**: `buildSeed()` makes the demo data. In the connected build, data comes from Supabase instead.
3. **Utilities and GST maths**: `h()`, `fmtMoney()`, dates, financial years, `lineGst`, `lineTotal`,
   `lineEx`, `invEx/invGst/invTotal`, `catEx`.
4. **State**: `loadState()`, `save()`, `commit()` (save + re-render), lookups such as `getProject`.
5. **Helpers**: stages, contacts and roles, companies (`co(p)` is a project's owner), funds needed,
   `feasoCalc()`, task-date links (`rippleFrom`), offer terms (`parseTerm`).
6. **Views**: `viewHome`, `viewProject` (+ `tabStage`, `tabMoney`, `tabDocuments`...), `viewDeals`,
   `viewDeal` (Details / Quick feaso / Offers / Documents), `viewContacts`, `viewExports`,
   `viewSettings`, `viewNew` (new project wizard). Each returns an HTML string.
7. **Render dispatcher**: `VIEWS` maps a route (`#/project/CROOBYAR/money/in`) to a view; `render()`
   draws it. `go(hash)` navigates. Keep the `IN_ARTIFACT` / `memHash` routing working.
8. **Actions**: clicks are handled once, by `data-action="name"` on the element, looked up in
   `ACTIONS`. Forms use `data-form="name"` and `FORMS`. Typing / selects use `data-input` in the
   input and change listeners. Add a new button by adding a `data-action` and an `ACTIONS` entry.
   Never add inline `onclick`.
9. **Exports**: `bookFor` (year-end workbook), `basBook`, `feasoBook`, `downloadBook`, `artifactSave`,
   `offerDocx`, `offerPdf`.
10. **Events and boot** at the very end.

Rules for code:
- **Escape everything you put into HTML with `h()`**. Names, notes and descriptions come from Dan
  and from contacts. Never build HTML from raw text.
- Every action that changes data writes a log entry (`addLog` for a project, `dealLog` for a deal,
  `addGlobalLog` for lists and settings) and then `commit()`.
- Nothing is sent, issued, approved or paid without Dan approving it in a drawer (`openApproval`).
- Keep phone and desktop working: check 390 px and 1366 px widths, no sideways scrolling.

### State shape and storage

- Top level: `projects`, `deals`, `contacts`, `companies`, `categories`, `roles`, `templates`,
  `zonings`, `docTypes`, `termBank`, `scopeRoles`, `settings`, `log`, `version`.
- A project has `stages`, `tasks`, `rfqs`, `engagements`, `invoicesIn` (bills, each with `lines`),
  `invoicesOut`, `sales`, `funds`, `docs`, `trust`, `log`, and a `companyId`.
- A deal has `feasos` (saved versions), `offers`, `docs`, `log`.
- **Today the file still keeps data in the browser** (`localStorage`, key `STORE_KEY`, currently
  `wellco_demo_v4`). The connected build moves it to Supabase tables that mirror this shape (see
  `supabase-schema.sql`). Until then, anything Dan types lives only in that browser.
- **Migration rule**: if you change the shape of saved data, either bump `STORE_KEY` (old data is
  then ignored and the app starts fresh, only acceptable while it's still a demo) or write code that
  upgrades the old shape. Once the app is on Supabase, shape changes are database migrations (below),
  never a key bump.

## Design rules

- **Shopify Polaris look**: use the colour, spacing, radius and shadow tokens already on `:root`.
  Reuse the existing pieces: `card`, `itable` tables, `badge`, `btn` / `btn-primary`, drawers
  (`openSheet`), `ptabs`, `summary` strips. No new colours, gradients, icons sets or decorations.
- **Font: Inter only.** The one exception is the letter of offer preview, Word file and PDF, which
  copy Dan's own template (Calibri / Helvetica, his olive colours). Keep that inside `.letter`.
- **Xero money words**: Bills (money in), Invoices (money out), Draft, Awaiting approval, Awaiting
  payment, Paid. Tax rates: GST on Expenses, GST Free Expenses, Input Taxed, GST on Income,
  GST Free Income, Margin scheme. Dan uses Xero daily; don't invent new terms.
- Plain, short copy. Sentence case. Dates like 2 Nov 2026 on screen.

## Money rules that must never break

Changing any of these needs **Dan's accountant (Pereira & Co) to agree first**. If Dan asks for a
change here, explain the effect and suggest he checks with Lucy before you do it.

1. **GST is per line, never per bill.** Each bill line has its own tax rate and its own cost category.
   - GST on Expenses: amount is ex GST, GST = 10%.
   - GST Free and Input Taxed: GST is always $0 (council contributions, duty, LRS fees, interest).
   - Margin scheme (lot sales only): GST = (sale price − margin base) ÷ 11; deposits held in trust
     have their GST attributed at settlement.
2. **Every total adds up by line.** Budget vs actual, committed, paid, BAS, funds needed and every
   Excel sheet sum the lines. The sum of all lines must equal the sum of all bills, to the cent.
3. **Financial year** runs 1 July to 30 June, labelled `FY2025-26`.
4. **BAS** is per company per quarter: Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun. Labels:
   G1 total sales, 1A GST on sales, G11 purchases, 1B GST on purchases. Bills count on their invoice
   date once approved (drafts don't count). Budget figures are all ex GST.
5. **Quick Feaso must still reproduce Dan's Lynches Creek example.** Open a deal > Quick feaso >
   Reset to deal, then set Lots 30, Price per lot 300000, Purchase Price 800000, Equity 800000, land
   and construction loan months 12 and 12, GST under margin = Margin scheme, everything else as the
   defaults (his sheet's figures). Don't save it as a version. The result must be exactly: net revenue $7,939,545,
   total cost $5,699,500, total inc finance $5,970,773, **net profit $1,968,773, MoC 32.97%**.
   The cell references in `feasoCalc` follow his spreadsheet (`reference/Quick Feso Subdivision.xlsx`).

## Supabase rules

- **One owner.** Row Level Security (RLS) means only Dan's login sees rows where `owner_id` is his.
  Never switch RLS off on a table, never add a policy that lets anyone else read or write.
- **Only the anon / publishable key goes in the app.** Never put the `service_role` (secret) key in
  `app/index.html`, in this folder, or in chat. If you see one, stop and tell Dan to rotate it.
- **Changing the database** (new table, column or rule):
  1. Make a backup first: in Supabase, Database > Backups, check there's a backup from today, and ask
     Dan to run the Excel exports (Exports page) and save them to OneDrive.
  2. Write the change as a new file `migrations/NNNN_short-name.sql`, next number up, with a comment
     at the top saying what it does and why. Never edit `supabase-schema.sql` or an earlier migration.
  3. Explain it to Dan in plain words. He pastes it into Supabase > SQL Editor and presses Run.
  4. Update the app to match, then run the pre-publish checklist.
- **Never run `supabase-tests.sql` on the live project.** It creates test users and fake projects.
  It's for a local test database only (Joe keeps it).
- Never run `delete`, `drop`, `truncate` or bulk `update` on live data. See "Refuse or escalate".

## Before you hand Dan a new file: the checklist (every time, no skipping)

1. Copy the current `app/index.html` to `versions/index-YYYY-MM-DD-HHMM.html` **before** editing.
2. Make the change. Keep it as small as the request.
3. Open `app/index.html` in a browser (double-click it). With the connected build, log in as Dan.
   Only look at live data; don't save test records. If a test needs a save, use a project clearly
   named TEST and delete it straight after.
4. Click through and check nothing is broken, on a normal window and a phone-width window:
   - Home loads with Needs attention and the projects table.
   - Open a project (e.g. Croobyar): Stage & tasks, Quotes, Money, Documents, Log.
   - Money > Bills: open a split bill (one with lines in two categories) and check the totals.
   - Money > GST / BAS: the quarter figures show.
   - Exports: download a year-end workbook and open it.
   - A deal > Quick feaso: the Lynches Creek example above gives net profit $1,968,773, MoC 32.97%.
5. Open the browser's developer console (F12 > Console): **no red errors**.
6. Tell Dan in two or three plain sentences what changed and what he should look at.
7. Only then: he drags `app/index.html` into Netlify (below).

If any check fails, fix it or put back the copy from `versions/`. Never ask Dan to publish a file
that hasn't passed.

## Publishing and undo

- **Publish**: netlify.com > log in > the Wellco site > **Deploys** > drag `app/index.html` onto the
  drop area. It goes live in under a minute at the usual address.
- **Undo**: Netlify > Deploys > click the previous good deploy > **Publish deploy**. Instant, and the
  data in Supabase isn't touched. Then put the matching file back from `versions/`.
- A database migration can't be undone this way. That's why the backup comes first.

## Refuse or escalate (tell Dan to talk to Joe or his accountant first)

- Anything that **deletes data in bulk**, wipes a table, resets the app, or removes a project,
  company or contact that has bills, documents or log history.
- **Changes to GST, BAS or the money totals** (rules above) without the accountant agreeing.
- **Storing passwords**, bank logins, TFNs or ID documents in the app, or putting any secret key in
  the file.
- Turning off the approval step, RLS, or the login.
- Anything that sends email, pays money, or lodges anything automatically.
- Big rebuilds ("redo the whole Money page"): suggest Dan gets it quoted instead.

When you refuse, say why in one sentence and suggest the safe alternative.

## Known demo leftovers (until Joe's connected build lands)

- Data is in browser storage, not Supabase. Clearing the browser clears it.
- `TODAY` is fixed at 2 Nov 2026 for the demo; the connected build uses the real date.
- Sending emails, OneDrive backups and file storage are shown, not done. The build connects them.
