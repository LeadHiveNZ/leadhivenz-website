<!--
=====================================================================
JOE ONLY. Delete this whole comment block before sending to Dan.
=====================================================================

BEFORE SENDING
- Fill [DEMO LINK] (Netlify Drop / Lovable link, test on mobile data first).
- Square-bracket numbers are placeholders: [6,500] [250] [390] [50%]. Remove the brackets once set.
- GST on your fees: LeadHive is NZ based. Check with your accountant whether you add anything for
  an Australian business client, then set the "(AUD, ...)" line in Investment.
- Send as PDF (export this .md) or paste into an email with the demo link above the fold.

PRICING RATIONALE
- Build fee range: AU$5,500 to 8,500. Recommend AU$6,500.
  - About 15 build days (see README phase table). AU$6.5k is ~AU$430/day, fair for a Lovable +
    Supabase build where you reuse the demo and schema already done.
  - Go to 7,500 to 8,500 if Dan wants real Gmail sending + Calendar sync + email-in inbox in v1,
    or if data load from his old spreadsheets is messy (several live companies).
  - Don't go under 5,500: the GST/BAS and exports are the hard bits and that's where the value is.
- Value anchors for the conversation (don't put in the client copy):
  - His own story: a $200k council fee booked as if it had GST. One mistake like that on one project
    costs more than the whole build.
  - A Xero file per project company is roughly AU$35 to 75 a month each; 4 to 6 live companies is
    AU$2k to 5k a year before any project-tracking tool. He told you he's cutting subscriptions.
  - A part-time bookkeeper / admin for this is well over AU$10k a year.
- Retainer AU$250/month (Option A): roughly 2 hours of changes a month, backup check, quick Zooms.
  Month to month, no lock-in. That matters to Dan ("no million subscriptions").
  Bigger additions get a fixed quote.
- Option B AU$390/month: AU$250 support + ~AU$40 Supabase Pro + Make.com + your time on hosting
  and margin for carrying the risk. Keep the gap clear so A looks like the better deal.

WHAT TO PUSH
- Option A. It's what you told him on the call ("build it on yours and host it on yours"), he owns
  his data and PDFs outright, and you don't carry hosting risk. Frame B as "if you'd rather not deal
  with any accounts at all", and say B can switch to A later in 15 minutes.
- Get the 50% deposit and a kick-off date in the same reply. Momentum matters; he's keen now.
- Ask for one real past project's numbers (any spreadsheet) at kick-off: it's the best test of the
  GST and export tabs.

LIKELY OBJECTIONS
- "Can't I just do this in Claude/Excel?" He tried: "fuck, that's painful". Spreadsheets don't
  remind him, don't hold the PDFs, and don't stop a GST-free line being entered with GST.
- "Another subscription?" Option A: he pays Supabase directly (AU$0 to 40) and that's the only
  platform. Your retainer is support, cancel any time.
- "What if you get hit by a bus?" Data and files are in his own account, OneDrive gets a nightly
  copy, and he can export everything to Excel any day.
- "Why not Xero tracking categories?" He already said it doesn't work: each company is its own
  ABN and books. This keeps each one standalone and Wellco stays on Xero.
- "Accountant access?" He said not needed. Excel export covers it. Read-only login is a later add-on.
- "App Store?" Home-screen web app on iPhone/iPad, looks and opens like an app. No App Store fees
  or review delays. Native app is out of scope.
=====================================================================
-->

# Wellco Project Brain

**Proposal for Dan Wellman, Wellco Developments Pty Ltd**
Prepared by Joe Ingram, LeadHive · hello@leadhivenz.com · November 2026

**Have a click around the demo first: [DEMO LINK]**
It works on your phone, iPad and laptop. Nothing you do in it gets sent anywhere.

---

## What you told me

- **One place.** You don't want a million subscriptions to a million platforms. Nothing fancy, no KPIs or performance dashboards. You know your numbers.
- **Each company stands alone.** Every project is its own registered company with its own ABN, GST, bank and books. Trying to run that through one Xero file and tally it out into jobs isn't clean.
- **The GST traps.** Council fees, contributions, stamp duty, lands department registration and some land purchases carry no GST, and governments don't label it. You can have a million dollars of costs in a project with no GST in it, and that's where people get caught out. Then there's the margin scheme on sales.
- **"Have I chased that up?"** The process is the same every time, but it lives in your head. Miss the electricity connection application and that's three months gone. Money's time.
- **Three quotes for everything,** same request every time, and the ability to see who you picked and why.
- **On the road** in the caravan with the laptop, plus the phone and iPad.
- **Excel to the accountant** with the tallies and BAS figures. No portal logins needed.
- **PDFs everywhere,** stored with the job, and OneDrive kept as a backup.

## What I'll build

One app with all your project companies in it, each kept completely separate. Every project runs through the same 8 stages:

**1** Sourcing · **2** Feasibility · **3** Acquisition & DD · **4** Consultants · **5** Development Approval · **6** Construction · **7** Sales & Settlements · **8** Bonds & Wind-up

**Projects & stages**
- Home screen with "Needs you today" first: approvals waiting, overdue tasks, quotes to chase, bills due, lead-time warnings.
- One card per live project: stage, next deadline, budget vs committed vs paid.
- Checklist for every stage with due dates and lead-time warnings (e.g. "apply for the Endeavour Energy connection now, 3-month lead time").
- New project in 3 steps: site and lot/plan, company details (ABN, GST, bank), confirm. It sets up the checklist, budget and folders for you.
- Deal log for sites from agents and listings, with the feaso result. A "go" site becomes a project in one tap.

**Quotes & engagements**
- Quote requests drafted from your own templates. Minimum 3 per scope, with a flag if you're short.
- Quotes side by side (price, inclusions, exclusions), pick one and record why.
- Engagement letters and purchase orders issued in the project company's name, with % claimed tracked against each.

**Money & GST**
- Every invoice line marked taxable, GST-free, input taxed or margin scheme. GST-free lines can't carry GST by mistake.
- Invoices in (bills, progress claims, council fees) and invoices out (lot deposits, settlements).
- Budget vs actual by category: acquisition, holding, consultants, council and government, construction, sales, management fee.
- Quarterly BAS summary per company: GST collected, GST paid, GST-free spend, net.
- Financial years worked out automatically (1 July to 30 June), so a project running over 3 or 4 years rolls over cleanly.
- Wellco's management fee tracked as its own line. Intercompany loans and distributions to the trust flagged for year end.

**Documents**
- Upload PDFs from your phone, iPad or laptop, filed under the project.
- Named automatically: `CROOBYAR_Quote_SouthcoastCivil_2026-10-14`.

**Contacts**
- One shared list of consultants, contractors, agents, solicitors and council contacts, reusable on every project.
- ABN, licence and insurance expiry (warns you 60 days out), which projects they've worked on, your notes on them.

**Exports**
- Year-end workbook per company per financial year, BAS summary, and a full project workbook. Real Excel files with tabs for Summary, Budget, Quotes, Engagements, Invoices In, Invoices Out, Sales, GST/BAS and Tax Summary.

**Approvals & log**
- Nothing gets sent, issued or paid until you tap Approve. You see exactly what's going out first.
- Every action logged per project, so you can always see what happened and when.

**Mobile**
- Works on your phone, iPad and laptop. Add it to your home screen and it opens like an app.

## How it works under the hood

Your data and PDFs live in your own Supabase account (a secure online database, Sydney servers), so you own it outright. The app runs in the browser on your phone, iPad and laptop, and you log in with your Wellco email. Every night the PDFs copy across to your OneDrive and every week the Excel workbooks do too, so if anything ever goes down you've still got the lot. Wellco Developments itself stays on Xero exactly as it is now.

## What's not included

- No KPIs, dashboards or performance reports. You said you don't need them.
- No extra users. It's built for you. Your accountant gets Excel, not a login.
- No Xero connection in this version. Wellco stays on Xero; project companies run in the app.
- No payments. The app records what's paid; you still pay from the bank as normal.
- Not tax advice. The app makes the GST treatment clear on every line; your accountant still signs off the BAS.

## Build plan & timeline

About 4 to 6 weeks from go to settled in.

| Phase | What happens | When |
|---|---|---|
| 1. Demo | The clickable demo you've got now. Tell me what to change. | Done |
| 2. Version 1 live | Set up your Supabase account with you on a short Zoom, build the real app, load your current projects, test on your phone and iPad. | Weeks 1 to 3 |
| 3. Tweaks | You use it on real jobs for 30 days. Anything that doesn't suit how you work, I change. | Weeks 4 to 6 |

## Investment

(AUD)

**Option A: I build it, you own it** (recommended)
- Build: **AU$[6,500]** one-off. Includes setting it all up on your own Supabase account, loading your current projects, and 30 days of tweaks after it goes live.
- Support: **AU$[250]/month** after that. Changes and small additions, a monthly check that the backups are running, and those quick 5-minute Zooms when you need something. Month to month, cancel any time.
- You pay Supabase directly: about AU$0 to 40 a month depending on plan. That's the only platform you're paying for.

**Option B: I build it and host it for you**
- Build: **AU$[6,500]** one-off, same as above.
- Hosting & support: **AU$[390]/month**, covering Supabase, backups, changes and support. No accounts for you to deal with. If you ever want it on your own account, I move it across for you. Your data is always yours.

Bigger additions later (like forwarding emails and PDFs straight into a project, or a calendar link for DA dates and settlements) get quoted up front before any work starts.

## Next steps

1. Reply **"go"** and tell me A or B.
2. [50%] deposit to lock in the start date. The balance is due when version 1 is live.
3. Kick-off Zoom (30 minutes): set up your account, go through your current projects, and grab one old project's numbers to test the GST and exports against.
4. Version 1 live in 3 weeks.

Any questions, give me a ring or reply to this email.

Cheers,
**Joe Ingram**
LeadHive · hello@leadhivenz.com
