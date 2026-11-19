# HostFix — Plan and data model (v0, 15 Nov 2026)

> **Status, 18 November 2026: Phases 0 to 4 are built and tested, and the demand test is ready to run.** Phase 5 is planned in section 9 and not built.
> To try it: `docs/TRY-IT.md`. To put it online: `SETUP.md`. For the dispatcher: `RUNBOOK.md`.
> What similar products do and what was taken from them: `docs/MARKET-RESEARCH.md`.
>
> The rest of this document is the plan as first written, before any code. It is kept because the reasoning
> still holds. **Where the build ended up different, this list is right and the older text below is not:**
>
> - **Paying tradies "within 48 hours" cannot be promised as money in the bank.** The payment is *sent* 24
>   hours after the job (the hold is set per market, 48 hours at most). But Stripe holds card money before it
>   can be paid out: 4 working days in New Zealand, 2 in Australia (Stripe's documentation, read 15 Nov
>   2026). So a tradie sees the money about 5 to 6 working days after a job in New Zealand, 3 to 4 in
>   Australia. Every screen and the tradie page now say that. Section 9 explains the one way to make it
>   faster (pay tradies out of money already sitting in your Stripe balance) and why it is not switched on.
> - **The timer is Vercel's**, once a minute (`/api/cron/tick`), not the database's own scheduler. It moves
>   offers on, flags missed promises and no-shows, retries cards and pays tradies. Each step is safe to run twice.
> - **Sign-in is a six-digit code** sent by email or text, made by the app itself. Supabase is used for the
>   database and for photo storage only, not for login.
> - **A tradie does not need to sign in for a job they were offered.** The link in the text is the accept page
>   and then the job page, photos included. They sign in only for their pay, profile and job list.
> - **The app talks to the database directly** and brings the tables up to date on every deploy. No SQL is
>   pasted anywhere by hand.
> - **Every finished job is checked, and the owner is asked before the team** (DECISIONS.md, 2026-11-19).
>   Each property has a map pin (LINZ address lookup, free, optional); Arrived and Job done need before and
>   after photos and are compared with the pin; a flagged job's payout waits for the owner, then a trusted
>   tradie is paid or the dispatcher approves or holds.
> - **Push notifications were not built.** Texts carry everything.
> - **Statements are pages with a Print or save button, not emailed PDFs:** Billing for owners and Pay for
>   tradies, month by month.
> - **Scorecards are worked out when the page is opened**, not overnight.
> - **Referral rewards are tracked and put in the queue when due, then paid by bank transfer by hand.**
> - **A membership's price is fixed once properties have joined it.** To change a price you add a new
>   membership and close the old one to new members (`RUNBOOK.md`).
> - **Owners have one membership: Essential, NZ$99 per property per month, 24-hour response** (`DECISIONS.md`,
>   16 Nov 2026). Priority was removed because delivering it cost more than it charged, so everything below
>   about Priority, its included urgent call-outs and its quarterly check is history. Urgent is always an
>   add-on the owner pays for. (Since 18 Nov 2026 the tradie gets the surcharge less the 15% fee: see below.)
> - **Free to join** (`DECISIONS.md`, 17 Nov 2026): Essential is NZ$0, a property is covered as soon as a
>   card is on file (no subscription, no monthly invoice), and the money is the 15% inside every menu price.
>   (A missed promise took the call-out portion of that job off its charge until 18 Nov 2026: see below.) Tradies need public liability
>   insurance on file, with its certificate uploaded, to be approved or offered work. The founding deposit is no longer offered; paid ones
>   are refunded. The Essential-at-NZ$99 line above is history.
> - **The real Queenstown prices are loaded** (59 researched jobs, `seed/menu-queenstown.json`): urgent
>   NZ$50 (NZ$90 until 18 Nov 2026), after hours NZ$140, NZ$225 to come and look at something off the menu, owner's yes needed above
>   NZ$600. After-hours is before 7am, from 4:30pm and all weekend.
> - **Urgent is NZ$50, and both surcharges carry the 15% fee** (`DECISIONS.md`, 18 Nov 2026). Urgent buys
>   "the tradie drops what they are doing"; after hours stays NZ$140. The tradie gets each surcharge less 15%
>   (NZ$42.50 and NZ$119) on top of their menu share. Section 4's "+NZ$80 to tradie in full" is history.
> - **Portfolio, the second tier, is built** (`DECISIONS.md`, 17 Nov 2026): managers with 10+ properties pay
>   one monthly retainer per account, banded by property count (NZ$600 / 900 / 1,200, 100+ by arrangement),
>   re-banded from the next payment when properties are added or taken off. The 15% job fee is unchanged.
>   100+ pricing and the 60-day pilot are handled by a person.
> - **Paid for what happened, and an on-time record** (`DECISIONS.md`, 18 Nov 2026). Missed promises are no
>   longer credited. An urgent job reached after its deadline has no urgent line for anyone; the after-hours
>   line is charged only if the Arrived tap is outside working hours. A normal job's tradie picks a two-hour
>   arrival window when accepting. Nobody accepting in 3 hours texts the owner and alerts the team. Arrived
>   taps with no location or far from earlier visits are flagged, and the owner has "The tradie isn't here".
>   Network offers go first to tradies on time for 90% of their last 20 arrivals (from 10); declines never
>   count. No-shows go to the queue; 3 in 90 days flags a tradie for a conversation, never automatic removal.
>   The first choice or backup can suggest a later time, and the owner chooses to wait or send it on.
> - **The demand test is built** (`docs/DEMAND-TEST.md`): the owner page sells founding spots for a
>   refundable NZ$99 deposit or sends the full price list, and the leads page keeps the 14-day scorecard.
>
> - **A cleaner is a person, not a link** (`DECISIONS.md`, 18 Nov 2026). Owners add cleaners and co-hosts
>   by name and mobile on **Your team** and tick their houses (or, with 3+ properties, named groups that
>   cover houses added later). Each person has one link for life, listing every house they may report on
>   across every owner who added that mobile; it opens nothing until the phone proves the number with a
>   six-digit code, once. Reports are signed with their name and follow the owner's per-person "send
>   straight away" or "ask me first". The per-property team link keeps working but is no longer offered
>   once an owner has a team. The guest QR card is unchanged. Owners can print every QR card at once and
>   paste up to 200 properties from a spreadsheet.
>
> The five questions in section 6 were never answered, so each default written there is what was built.
> Question 1 (who is the seller for GST) still needs your accountant before the first real job.

> **Status, 15 Nov 2026: Phase 0 is built.** See `docs/PHASE-0.md` for what to click and `SETUP.md` to put it online.
>
> **Decisions taken when you said "Build it":**
> - The code lives in the `hostfix/` folder of the LeadHive repository for now (the faster option in section 7).
>   Vercel deploys from a subfolder without trouble. Moving it to its own repository later is still easy.
> - The five questions in section 6 were not answered, so each **default** stated there is assumed. None of
>   them affects Phase 0. Question 1 (GST) must be settled with your accountant before Phase 3.
> - Phase 0 serves one launch market at a time, set in `config/markets.ts`. Per-market web addresses arrive
>   with the add-a-market screen in Phase 4.
>
> **Corrections to this plan, found while building:**
> - **Vercel Pro is required** (US$20 a month). The free plan does not allow business use and cannot deploy
>   from an organisation's private repository. The plan below said the timer design would avoid paying for
>   Pro. The timer design stands, but Pro is needed anyway.
> - **Supabase's free plan pauses a project after one week with no activity.** Budget US$25 a month before running ads.
> - **New ClickSend accounts have texts containing web links held back.** Phase 2's one-tap accept link is a
>   web link, so this must be cleared with ClickSend support (or Twilio used) before Phase 2. See SETUP.md step 5.
> - **Stripe now offers two webhook message formats.** The site accepts both.
> - **Vercel runs server code in the United States by default.** `vercel.json` moves it to Sydney, next to the database.

Working name HostFix. Two-sided maintenance network for short-stay rentals. Launch market Queenstown,
built to run in many markets across NZ and AU. This document is the plan you asked for before any code
is written. It has four parts: what I checked with outside providers, the decisions I have made, the data
model in plain words, and the five questions I need you to answer.

---

## 1. What I checked with the outside providers (read 15 Nov 2026)

### Stripe (payments, cards on file, paying tradies)

| Thing | New Zealand | Australia |
| --- | --- | --- |
| Card payments, saved cards, subscriptions | Yes. 2.65% + NZ$0.30 per domestic card payment (Connect pricing page says 2.7%; confirm in your dashboard) | Yes. 1.65% + A$0.30 (Connect page says 1.7%) |
| Stripe Connect (pay tradies into their own bank account) | Yes. NZ$2 per tradie per month they get paid, plus 0.25% + NZ$0.25 per payout | Yes. A$2 per active tradie per month, plus 0.25% + A$0.25 per payout |
| Bank-account debit instead of card | NZ BECS Direct Debit, 1% + NZ$0.40 capped at NZ$4 | AU BECS Direct Debit and PayTo, 1% + A$0.30 capped at A$3.50 |
| GST calculation (Stripe Tax) | Supported | Supported |
| Instant payouts to tradies | Debit card only | Bank or debit card |

**The catch:** Stripe only lets platforms based in the US, UK, Europe, Canada or Switzerland pay tradies in a
different country. A New Zealand Stripe account cannot pay an Australian tradie, and the reverse. So:

- **Decision:** one Stripe account per country. The NZ Stripe account runs every NZ market; an AU Stripe
  account runs every AU market. The software picks the right one from the market record. You will need a
  legal entity in each country to open each account (question 5 below).

### SMS (job offers to tradies, status texts to owners)

| Thing | New Zealand | Australia |
| --- | --- | --- |
| Send texts from a normal mobile number | NZ carriers do not allow it. Both Twilio and ClickSend say NZ requires a registered dedicated short code (4 to 6 weeks to set up, NZ$65 to NZ$350 a month plus setup, sales-led) | Yes. ClickSend sells a dedicated AU mobile number instantly (business details needed); Twilio A$8.25/month |
| Tradie replies "YES" to a text | Only via that short code | Yes, on a dedicated number |
| Registration before sending anything | Yes. ClickSend requires sender registration (form, then their sales team) before even a test text to NZ | Alphanumeric sender names must be pre-registered (about 5 business days). Dedicated numbers do not need that |
| Rough cost per text | ClickSend US$0.009 to US$0.028 depending on volume. Twilio about US$0.105 from an international number | ClickSend same tiers. Twilio US$0.0515 out, US$0.0075 in |

**What this means:**

- **Accept-by-link is the primary mechanism everywhere.** Every offer text carries a short, single-use
  link. One tap opens an accept/pass page with no login. This works in both countries from day one and is
  faster than typing a reply anyway.
- **Reply-by-text is a per-market switch.** It turns on for a market once that market has a two-way number
  or short code. Australia can have it from launch. New Zealand gets it if and when you decide a short
  code is worth NZ$65+ a month.
- **Provider:** ClickSend (Australian company, one account covers NZ and AU, pay as you go, replies free,
  plain REST API). It sits behind a small adapter so swapping to Twilio is a config change, not a rebuild.
- **Critical path for you, this week:** start ClickSend's New Zealand sender registration. Nothing can be
  texted to an NZ phone until that is approved. I will give you the exact steps in the accounts checklist.
- **Belt and braces:** installed-to-home-screen web apps can receive push notifications on iPhone and
  Android. Phase 2 sends every job offer by push as well as text, so a tradie who has the app installed
  gets it even if a text is delayed.

### Everything else

Next.js on Vercel, Supabase (database, login, photo storage), Resend for email, Meta Pixel plus Conversions
API for lead-ad tracking, Vercel Analytics for page stats. None of these have country restrictions that
affect us. For the 15-minute offer timer I will use Supabase's built-in scheduler (pg_cron) ticking every
minute. (Correction: Vercel Pro is needed regardless, see the status note at the top.)

---

## 2. Decisions I have made (you can override any of them)

1. **Stack stays as you suggested.** Next.js + TypeScript on Vercel, Supabase, Stripe, ClickSend, Resend.
   All mainstream, all well documented, all have free tiers big enough for launch.
2. **One codebase, many markets, many Stripe accounts.** Every price, tax rate, currency, timezone, business
   hours window and fee lives on the market record. No town, currency or tax rate is written into code.
3. **Money is stored in cents as whole numbers**, never decimals, with the currency next to it. All money
   maths lives in one tested module.
4. **Charge type:** "separate charges and transfers". The owner's card is charged on completion into the
   HostFix Stripe balance. The tradie's share is transferred after a hold (24 hours as built, set per
   market) unless a dispute is open. This is the only Stripe pattern that lets a dispute pause the payout.
5. **Tradies never log in to accept.** Signed single-use links. They do log in (phone number + one-time
   code) to upload photos and see their jobs, because that needs to be private.
6. **Owners log in by email magic link or phone code.** No passwords to forget.
7. **Reporters (cleaners, guests) never log in.** The property's report link and QR code identify the
   property. Spam protection by rate limit and a "who are you" field.
8. **Dispatcher and admin are the same app with different permissions.** The dispatcher sees only the
   exceptions queue. Admin sees everything.
9. **Every job state change and every cent that moves is written to an audit log** that nothing can edit.
10. **Database rules (row-level security) enforce who sees what**, not just the screens. Tested.
11. **Legal pages** (terms, privacy, tradie agreement, insurance wording) are placeholder pages marked
    "DRAFT — lawyer to write". I will not write legal terms.
12. **Repository:** this plan is parked in your LeadHive landing-pages repo. HostFix should be its own
    repo. See the note at the end.

### Things you asked for that I recommend changing

- **"Accept or pass by reply"** cannot be the main path in NZ (see SMS above). Link first, reply where
  available. No loss to the tradie: one tap either way.
- **Membership credit on a missed window** is automatic as you asked, but I will cap it at one credit per
  property per month and require the job to have been a valid, dispatched job. Otherwise one bad weekend
  costs you a month of revenue on every property.
- **Charging the owner's card the moment the tradie taps Complete** with no owner review is a chargeback
  risk. I will keep auto-charge (you asked for no admin work) but the owner gets a text with photos and a
  "Something wrong?" link at that moment, and the tradie payout hold (24 hours as built) is the dispute window.
- **Phase 0 deposit** should be refundable and credited against the first month. Taking non-refundable
  money before tradies exist is a trust problem in a small town.

---

## 3. Data model in plain words

Each line is a table (a list of records). Indented lines are the important fields.

**markets** — one per city or region you operate in
  name, country, currency, GST rate, timezone, business hours (start, end, which days), platform fee %
  (default 15), urgent surcharge, after-hours surcharge, response windows (standard, urgent),
  which Stripe account to use, which SMS sender to use, reply-by-text on/off, status (planning/live/paused)

**membership_tiers** — per market, e.g. Essential NZ$99, Priority NZ$149
  market, name, monthly price, standard response hours, urgent included yes/no, quarterly check yes/no,
  Stripe price id

**users** — anyone who logs in
  name, phone, email, role (owner / tradie / dispatcher / admin), market(s)

**owners** — extra details for owners
  user, Stripe customer id, default card on file, billing address

**properties**
  owner, market, nickname, address, access notes (lockbox code, alarm, parking), photos,
  tier, membership status, Stripe subscription id, report link code, QR code, referred-by (reporter)

**trades** — plumber, electrician, handyman, gasfitter, locksmith, etc.
  name, licence required yes/no

**tradies**
  user, market, business name, GST registered yes/no, trades (list), licence number, licence expiry,
  Stripe connected account id, payout onboarding complete yes/no, status (pending/approved/paused),
  30-day acceptance rate, 30-day on-time rate (both recalculated nightly)

**tradie_slots** — who is first choice and backup for a trade in a market
  market, trade, tradie, rank (1 = first choice, 2 = backup), optional monthly slot fee, fee active yes/no
  (data model only in v1, fee switched off)

**menu_items** — the fixed-price menu, per market
  market, trade, name, plain description, owner price, tradie payout, licence required yes/no, active yes/no

**jobs** — the heart of the system
  property, market, menu item (or "off-menu"), description, photos, urgency (standard/urgent),
  logged by (owner / cleaner / guest, name and phone), logged at,
  status (new → offered → accepted → on the way → on site → done → charged → paid out,
          plus: needs quote, awaiting owner approval, disputed, cancelled, nobody available),
  assigned tradie, promised-by time, arrived at, completed at,
  price lines (see job_lines), owner approval needed yes/no, approved at

**job_lines** — every amount on a job, so the maths is auditable
  job, type (menu price / diagnosis fee / quote / urgent surcharge / after-hours surcharge / parts /
  credit / refund), owner amount, tradie amount, platform fee amount, GST amount

**offers** — each time a job is offered to one tradie
  job, tradie, round (1 first choice, 2 backup, 3 open), sent at, expires at (sent + 15 min),
  response (accepted / passed / no reply), responded at, how (link / text reply / push), signed token

**quotes** — off-menu jobs
  job, tradie, amount, description, photos, needs owner approval yes/no (over threshold),
  owner decision, decided at

**payments** — money in from owners
  job or membership period, owner, amount, GST, Stripe payment id, status, charged at, refunded amount

**payouts** — money out to tradies
  job, tradie, amount, Stripe transfer id, release-after time (completion + 48h), held yes/no (dispute),
  status, paid at

**credits** — guarantee credits and goodwill credits
  property, reason (missed window / goodwill), amount, applied to which invoice, created by (system / admin)

**disputes**
  job, raised by, reason, photos, status (open / resolved for owner / resolved for tradie), resolved by, notes

**referrals**
  reporter (name, phone, optional user), property, member since, paid out yes/no (after 3 paid months),
  payout amount, paid at

**leads** (Phase 0)
  type (owner / tradie), all form fields, source (Meta / Google / direct / referral), landing page,
  deposit paid yes/no, Stripe id, created at

**notifications** — every text, email and push we sent
  to, channel, template, body, provider message id, delivery status, related job

**audit_log** — append only
  who or what, when, table, record, before, after, note

**statements** — generated monthly
  owner or tradie, period, PDF file, totals

---

## 4. How the money works on one job (worked example, Queenstown, GST 15%)

Menu item "Replace shower mixer": owner price NZ$180 incl. GST, tradie payout NZ$130. Owner marks it
urgent (+NZ$80 to tradie in full).

| Line | Owner pays | Tradie gets | HostFix keeps |
| --- | --- | --- | --- |
| Menu price | 180.00 | 130.00 | 50.00 |
| Urgent surcharge | 80.00 | 80.00 | 0.00 |
| **Total** | **260.00** | **210.00** | **50.00** |
| Stripe card fee (2.65% + 0.30) | | | −7.19 |
| Stripe payout fee (0.25% + 0.25) | | | −0.78 |
| **HostFix net before GST** | | | **≈ 42.03** |

Note the spec says "platform fee 15% of job price". On this menu item the gap between owner price and
tradie payout is 27.8%, not 15%. The menu can be defined either way: (a) set tradie payout and the owner
price is payout ÷ 0.85, or (b) set both prices freely and the 15% is just the default used to pre-fill
new menu items. I will build (b) because it is more flexible, with 15% as the default fill. Tell me if you
want it locked to (a).

How GST is split between the three parties depends on your answer to question 1.

---

## 5. Build phases (unchanged from your brief, with what "done" means)

| Phase | What you will be able to click | Rough effort |
| --- | --- | --- |
| 0 Demand test | Owner page with deposit, tradie page, both forms, you get a text + email per lead, password-protected leads list, Meta Pixel firing | 1 sitting |
| 1 Owner & property | Owner signs up, adds property with photos, picks tier, pays by card, gets QR code PDF | 2–3 sittings |
| 2 Jobs & dispatch | Report a job from the QR link, offer cascade by text + link, tradie job page, quotes and approvals, owner status texts | 4–5 sittings |
| 3 Money | Tradie payout onboarding, charge on completion, payout after the hold, GST per market, statements, auto credit, dispute button | 3–4 sittings |
| 4 Running it | Dispatcher exceptions view, admin dashboard per market, scorecards, menu editor, add-a-market | 3 sittings |
| 5 Growth | Planned only | — |

After each phase you get a link, a click-list, and a list of what is not done.

---

## 6. Five questions that change the design

Answer with a line each. "Go with your default" is a fine answer.

**1. Who is the seller for GST purposes?**
Option A: HostFix is the seller. The owner gets one HostFix invoice for the full NZ$260 incl. GST. HostFix
pays GST on the full amount and the tradie invoices HostFix for NZ$210 (or HostFix issues a buyer-created
invoice). Tradies who are not GST-registered get paid the same amount but no GST is claimable on their
share.
Option B: HostFix is an agent. The tradie is the seller of the work, HostFix only charges GST on its own
15% fee. Owners get two line items. More complicated statements, less GST exposure for you.
*My default: A. It matches "the founder never sends an invoice" and is what owners expect. Run it past your
accountant before Phase 3; it changes how statements and the menu (incl/excl GST) are built.*

**2. Parts and materials.**
Are menu prices labour plus standard consumables only, with parts added at cost? If so, what is the limit
above which the owner must approve parts before they are bought?
*My default: menu price covers labour and consumables under NZ$30. Parts above that are a separate line at
cost, receipt photo required, owner approval needed above NZ$150. Tradie is paid the parts line in full.*

**3. Who can trigger a paid callout?**
A cleaner logging "blocked drain" should probably dispatch immediately. A guest logging "TV not working"
at 11pm probably should not without the owner saying yes.
*My default: cleaner and co-host reports dispatch straight away; guest reports go to the owner for a
one-tap "Go ahead" text first, with an owner setting to turn auto-dispatch on for guest reports too.*

**4. What counts for the response guarantee?**
Does the 24-hour clock run through the night and weekends, or only business hours? What counts as "on
site" — the tradie tapping "I've arrived" (with location recorded), or the owner confirming? And what hours
are "after-hours" for the surcharge?
*My default: 24h and 4h windows are clock hours, 24/7. "On site" is the tradie's Arrived tap with GPS
logged, disputable by the owner. After-hours is outside 7am–6pm Mon–Sat, set per market.*

**5. Legal entities and Stripe accounts.**
Which company will the NZ Stripe account be under? Do you have, or will you set up, an Australian company
with an ABN? Without one, Australia cannot launch on Stripe at all.
*This does not change code (markets already point at a Stripe account) but it changes your to-do list and
timing for AU.*

---

## 7. Logistics note: where does the code live?

This session is attached to your `leadhivenz-website` repo, which holds the LeadHive client landing pages.
HostFix is a separate product and should be its own repo so the two never tangle. Two options:

- **Recommended:** create an empty GitHub repo called `hostfix` (private), start a new Claude Code session
  on it, paste the brief again, and point me at this plan. I will carry everything over.
- **Faster today:** I build inside a `hostfix/` folder in this repo and we split it out later. Works, but
  deployment to Vercel is messier and the split is a chore.

Phase 0 starts the moment you tell me which, plus your answers (or "defaults") to the five questions.

---

## 8. Accounts you will need (preview; full ordered checklist comes with Phase 0)

GitHub, Vercel, Supabase, Stripe NZ (and later Stripe AU), ClickSend (start NZ sender registration now),
Resend, a domain, Meta Business Suite (Pixel + lead ads), and a lawyer for terms, privacy, tradie agreement
and insurance wording.

---

## 9. Phase 5 and what comes next (planned, not built)

Written 15 November 2026, after Phases 0 to 4 were built. Nothing here is built. Each item says what it
is for, what is already in place, what would have to be built, and roughly how big it is ("a sitting" is
one working session like the ones that built each phase).

### First, three things that are not in your Phase 5 list but matter more

**A. Faster pay for tradies (small, needs a decision from you).** Today a tradie's money is sent after 24
hours and lands about 5 to 6 working days after the job in New Zealand, because Stripe holds card money
for 4 working days. Stripe will pay a tradie straight away if the money comes out of funds that have
already cleared in your Stripe balance. So the fix is a float: leave roughly one week of tradie payouts
sitting in Stripe instead of sweeping everything to your bank, and the app pays tradies from that. Tradies
would then be paid in about 2 to 3 working days. It costs you nothing but the use of that cash. I did not
switch it on because it only works once membership income has built the float, it changes how you take
money out of Stripe, and a mistake in this code pays a tradie twice. Half a sitting, plus a test run.
*Do this before you recruit the second wave of tradies: "paid in two days, no invoice" is the pitch.*

**B. The quarterly property check is promised to Priority members today and nothing delivers it.** Until
it is built (item 2 below), someone has to book those checks by hand. If you are not ready to do that,
untick "Includes a property check every three months" on the Priority membership before anyone joins.

**C. Hold the money when the tradie accepts.** Today the owner's card is charged when the job is done. If
it declines, you chase it and the tradie waits. Reserving the amount on the card when a tradie accepts
(as Turno does for cleaning) finds a dead card before anyone drives anywhere. Half a sitting.

### The five features you listed, in the order I would build them

**1. Cleaner and co-host accounts (build first).**
*Why.* A cleaner with twelve properties is twelve sales in one conversation, and they are the people on
site when something breaks. A third of Queenstown listings are with hosts who run 2 to 9 properties.
*In place.* Referral codes and the reward, a join page for referrers (`/refer`), and the no-login report
link per property.
*To build.* A sign-in for cleaners. One screen listing every property they look after (the owner grants
this with one tap). Report a problem at any of them without hunting for the right link. Their referral
earnings and when each is due. One to two sittings.

**2. Quarterly property check with a photo checklist.**
*Why.* It is the main reason to pay NZ$50 more for Priority, it catches problems before a guest does, and
every check is a reason to book paid work. *In place.* The promise, as a tick on the membership.
*To build.* A checklist per market (smoke alarms, taps, drains, heat pump filters, locks, bulbs), a job
type that is booked for a date instead of a response time, the tradie's checklist screen with a photo per
item, a report to the owner with "fix this for NZ$X" buttons from the menu, and the timer creating one
every three months. Decide who pays the tradie for the visit: it comes out of the membership. Two sittings.

**3. Seasonal packages (a pre-winter check, a pre-summer deck and barbecue check).**
*Why.* One-off income per property at the times tradies are quiet, and a reason to email every member.
*In place.* Fixed prices, card on file, the offer cascade, photos. *To build.* A package is a menu item
with a booking window instead of a promise, so most of the work is shared with item 2. A page to buy it,
and a way to offer a batch of them to one tradie as a run. One sitting after item 2.

**4. Connections to property management software.**
*Why.* Managers with ten or more listings (a third of the market) live in Guesty, Hostaway or Breezeway.
They will not open a second app, but they will use HostFix if a task raised there becomes a job here.
*To build, in this order.* First an email address and a web address per property that turn a message into
a reported problem, which works with any of them through Zapier or Make and takes one sitting. Then one
proper connection, to whichever product your first three managers actually use. Two to three sittings,
and each of those companies has its own approval process. *Do not start until a manager asks for it.*

**5. Tradie slot fees (build last, and maybe never).**
*Why you want it.* Income from the supply side. *Why I would wait.* The research found that charging
tradies for position or leads is the most complained-about model in this industry: hipages keeps only
58% of that income year on year, and gave the regulator an undertaking over how it locked tradies in. And a first-choice slot
that is bought, not earned, works against your own response promise: your credits are paid by your worst
first-choice tradie. *In place.* The fee and an on/off switch are stored against each first-choice and
backup slot. Nothing charges it.
*If you do switch it on:* only where three or more tradies want the same slot, charge it as a monthly
card payment, and keep the 80% rule above it, so a tradie who stops performing loses the slot whatever
they pay. One sitting.

### Smaller things found during the build

| What | Why it matters | Size |
| --- | --- | --- |
| Move existing members to a new price, with notice | Today a price rise only reaches new members | Half a sitting, plus your lawyer's wording |
| Delete or anonymise a person on request | Privacy law. Today it needs a developer | Half a sitting |
| Reminders before a tradie's insurance runs out | The date is stored. Nothing warns anyone | Small |
| Hide real phone numbers between owner and tradie | Stops jobs being taken off the platform | One sitting, and a monthly cost per number |
| Tax invoices as PDFs | Depends on the accountant's answer about GST | One sitting |
| Hear from Stripe the moment a tradie's bank details are approved | Today the app checks when they come back, and every hour | Small |
| Push notifications for tradies who install the app | A second way to reach them if a text is slow | One sitting |
| A "prove you are human" check on the public forms | Only if junk leads become a problem | Small |
