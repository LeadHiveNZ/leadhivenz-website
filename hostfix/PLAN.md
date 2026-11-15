# HostFix — Plan and data model (v0, 15 Nov 2026)

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
minute, which avoids paying for Vercel Pro just for a timer.

---

## 2. Decisions I have made (you can override any of them)

1. **Stack stays as you suggested.** Next.js + TypeScript on Vercel, Supabase, Stripe, ClickSend, Resend.
   All mainstream, all well documented, all have free tiers big enough for launch.
2. **One codebase, many markets, many Stripe accounts.** Every price, tax rate, currency, timezone, business
   hours window and fee lives on the market record. No town, currency or tax rate is written into code.
3. **Money is stored in cents as whole numbers**, never decimals, with the currency next to it. All money
   maths lives in one tested module.
4. **Charge type:** "separate charges and transfers". The owner's card is charged on completion into the
   HostFix Stripe balance. The tradie's share is transferred 48 hours later unless a dispute is open. This
   is the only Stripe pattern that lets a dispute pause the payout.
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
  "Something wrong?" link at that moment, and the 48-hour tradie payout hold is the dispute window.
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
| 3 Money | Tradie payout onboarding, charge on completion, 48h payout, GST per market, statements, auto credit, dispute button | 3–4 sittings |
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
