<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HostFix project notes

Read `README.md` first, then `DECISIONS.md`, then `docs/PLAN.md` (the status block at the top lists
where the build differs from the original plan). The owner of this project is a non-technical founder:
explain choices in plain words, and keep everything simple enough for one virtual assistant to run.

`DECISIONS.md` is where decisions made outside the code are written down, newest first, with the code
changes each one still needs. When it contradicts a comment in the code, it wins and the code is wrong.
Read it before changing a price, a fee, a surcharge or anything the business promises, and add a line to
it when you change one.

### Where the rules live

| Rule | File |
| --- | --- |
| Prices, surcharges, tax, what each side pays and gets (parts sums too) | `src/lib/jobs/pricing.ts` |
| Parts on a job: the price list, receipts, asking first, receipts to follow, receipt checks | `src/lib/jobs/parts.ts`, `seed/parts-queenstown.json` |
| Why a payout is held (a flagged job, a receipt) and letting it go | `src/lib/billing/holds.ts` |
| The hold on the owner's card: placed when a job goes out, renewed, let go, captured | `src/lib/billing/card-holds.ts`, `sendOut` in `src/lib/jobs/create.ts`, `chargeJob` in `settle.ts` |
| The payout guarantee (NZ$1,000 of a job's price), the part of a payout that waits | `payoutWaits` in `pricing.ts`, `releasePayout`/`releaseDueRests` in `settle.ts` |
| The tiered fee (15% to NZ$1,000 of a job's price, 3% above) | `tieredFee`/`tierRelief` in `pricing.ts`, `recalcTotals` in `src/lib/jobs/store.ts` (`jobs.tier_relief_cents`), `markets.tier_threshold_cents`/`above_tier_fee_bps` |
| Big work's 50% deposit (bank debit or card) and the rest at Job done; bank debits clearing or failing | `answerQuote`/`depositOutcome` in `src/lib/jobs/work.ts`, `chargeJob`/`jobDebitOutcome` in `settle.ts`, `src/lib/billing/debits.ts`, `/app/billing/bank` |
| Own clients at 5%: tradie + property pairs, the guard, invite links | `src/lib/clients/own-clients.ts`, `src/app/i/[token]/page.tsx`, `src/app/actions/clients.ts` |
| Pattern flags (same tradie and owner, cancelled after On my way) | `src/lib/ops/patterns.ts` |
| Logging a job, guest reports, the card check before sending out, cancelling | `src/lib/jobs/create.ts`, `cardProblem` in `src/lib/owners/service.ts` |
| "Is a guest staying?", the guest's texts, letting yourself in | `src/lib/jobs/guest-form.ts`, `src/components/jobs/SafetyNotes.tsx` |
| Chargebacks: the evidence pack, whose fault, balances taken from later payouts | `src/lib/billing/chargebacks.ts`, `releasePayout` in `settle.ts`, `/admin/jobs/[id]/evidence` |
| The tradie agreement agreed in the app, and a fee change's 30 days | `TRADIE_AGREEMENT_VERSION` in `src/lib/tradies/service.ts`, `applyScheduledFees` in `src/lib/markets/admin.ts` |
| Arriving, quotes, finishing, "could not get in" | `src/lib/jobs/work.ts` |
| "Not the job described", the owner's objection, Pay call-out / No call-out | `src/lib/jobs/not-described.ts` |
| Fixed hourly rates for extra work (four trades), the NZ$1,000 line, the call-out credit | `src/lib/jobs/rates.ts`, `hourlyLabour` and `quoteAmounts` in `pricing.ts` |
| Quote rate and hours quoted per tradie | `src/lib/tradies/quote-rate.ts` |
| Text, email or app notification; STOP; the first-text STOP line | `enqueue` in `src/lib/notify/outbox.ts`, `src/lib/notify/push.ts`, `src/lib/notify/inbound.ts` |
| The offer cascade: first choice, backup, everyone, dispatcher; "Not sure" jobs and picking the trade | `src/lib/dispatch/cascade.ts` |
| Emergency (within the hour, everyone at once), the step-down to urgent; each tradie's own hours, a standard job waiting for them | `stepDownEmergencies`/`switchToUrgent`/`offerWaitingJobs` in `src/lib/dispatch/cascade.ts`, `eligibleTradies` in `src/lib/tradies/service.ts` |
| Who is on right now (Urgent and Emergency only offered then), after-hours cover per trade | `src/lib/tradies/cover.ts` |
| The trades, which need a licence, which need an LBP number | `config/trades.ts` |
| Service areas (no travel charge): each market's areas, a property's area from its suburb, the areas a tradie covers | `src/lib/markets/areas.ts`, `areas` in `config/markets.ts`, `setTradieAreas` and the `area` criterion in `src/lib/tradies/service.ts` |
| Pre-launch: who can join, what is open before a market is live, the words, the one email on go-live | `src/lib/markets/stage.ts`, `src/lib/markets/launch.ts`, `markets.pre_launch`, `src/lib/owners/card-pages.ts` |
| Everything the clock drives | `src/lib/dispatch/tick.ts`, called by `/api/cron/tick` |
| Charging, paying tradies, credits, disputes, refunds | `src/lib/billing/settle.ts` |
| Memberships and referrals | `src/lib/properties/service.ts` |
| The dispatcher's queue | `src/lib/ops/exceptions.ts` |
| Arrival windows, surcharges settled at Arrived, distances | `src/lib/jobs/arrival.ts` |
| The checks on every finished job: location at both taps, photos, time on site, the flags | `src/lib/jobs/checks.ts` |
| A flagged job: the owner's answer, the 48 hours, trusted tradies, the dispatcher's Approve or Hold | `src/lib/jobs/confirm.ts` |
| Each property's map pin, the address lookup (LINZ) and the map pictures | `src/lib/properties/pin.ts`, `src/lib/maps/geocode.ts`, `src/lib/maps/tiles.ts` |
| On-time record, network order, no-shows, trust and flagged jobs (never declines) | `src/lib/tradies/reliability.ts` |
| Who is signed in and what they may open | `src/lib/auth/current.ts` |
| One-tap links in texts | `src/lib/links.ts`, `src/lib/access/links.ts` |
| Cleaners and co-hosts: the team, groups, each person's one link and their list of houses | `src/lib/team/service.ts`, `src/lib/team/device.ts`, `src/app/r/[token]/page.tsx` |
| Pasting a spreadsheet of properties | `src/lib/properties/import.ts` |
| The words of every text | `src/lib/notify/messages.ts` |
| Stripe | `src/lib/payments/stripe-gateway.ts`, `product-events.ts`, `deposit.ts` |
| The owner's invoice per job, in the tradie's name (HostFix as agent); GST only for a GST-registered tradie | `src/lib/billing/invoices.ts`, `/app/jobs/[id]/invoice` |
| The criminal record check noted before a first approval | `markRecordCheckSeen`, `setTradieStatus` in `src/lib/tradies/service.ts` |

### Rules that must not be broken

- **Never lose a lead.** Saving and alerting are separate. If saving fails, the alert still goes out with
  every detail (`src/lib/leads/service.ts`).
- **Money is whole cents plus a currency.** Never a decimal. Format with `formatMoney` (`src/lib/money.ts`).
- **Every money movement changes its record and writes the audit entry in the same database step**
  (`db.tx`), and is safe to call twice. A call to Stripe is claimed first, made with an idempotency key,
  then recorded (`src/lib/billing/settle.ts`).
- **The audit log is append-only.** Never add update or delete access to it.
- **All times come from the app's clock** (`now()` in `src/lib/clock.ts`), never `new Date()` or the
  database's `now()`. The tests and the demo move that clock.
- **Nothing tied to one town, currency or tax rate.** Those live on the market row in the database.
- **The real prices are loaded.** `seed/menu-queenstown.json` is the 111 researched Queenstown jobs (EL-07 added 24 Nov 2026, fourth entry) (60 on 16 Nov 2026,
  32 for the new trades and 18 sizes and one-room cleans on 24 Nov 2026, each new one with a `source`; 18 with no local
  figure load switched off, `needsLocalQuote`, and 4 add-ons, `isAddOn`, because a job holds one menu item). Prices are
  fixed by size, never by the hour (DECISIONS.md, 2026-11-24, second entry): window cleans by storeys and bedrooms, lawns
  by area, hedges by length, garden tidies in 1- and 2-hour blocks, one-room cleans as visits on their own with the
  cleaner's travel and minimum in the price, and common pairs (bedroom and bathroom) as items of their own. It only fills an empty database: after that, prices change on the admin screen. The prices sit at local market
  rate, not above it, so nothing may tell an owner they pay a premium for price certainty. Money tests
  are worked out by hand from the menu file, never pasted from what the code returns.
- **Every promise on a public page must be something the code does today**, or be tracked as owed in
  `DECISIONS.md` and on the go-live checklist (the founding half price is one). No unsourced statistics.
- **Free to join; the money is the 15% inside every fixed job price** (`DECISIONS.md`, 2026-11-17; 3% on the part of
  a job's price above NZ$1,000 since 2026-11-23, second entry).
  Essential costs NZ$0: a property is covered once a card is on file, with no subscription. The founding
  deposit is no longer offered (paid ones are refunded by hand); the lead form has one button, "send me
  the price list". The demand test's scorecard still counts leads and any deposits paid before the change.
- **Two tiers, one fee.** Essential (free) for owners. Portfolio for managers with 10+ properties, a
  retainer banded by portfolio size, built and switched off for now. The platform fee is tiered (DECISIONS.md,
  2026-11-23, second entry): 15% of the first NZ$1,000 of every job's price and 3% of the part above it
  (`markets.tier_threshold_cents` 100000, `above_tier_fee_bps` 300; `TIER_THRESHOLD_CENTS`, `ABOVE_TIER_FEE_BPS` are
  the starting values), on everything the 15% applies to (menu price, surcharges, call-out, quotes, hourly); parts
  keep their own 3% and are left out of the price. Each line is priced as before; `recalcTotals` gives the tradie
  the difference above the line (`tierRelief`, `jobs.tier_relief_cents`, inside `tradie_total_cents`). NZ$15,000:
  150 + 420 = 570 to HostFix, 14,430 to the tradie. The offer, job page and Pay page show the fee. The one exception
  is a tradie's own client (DECISIONS.md, 2026-11-23): a job between an own-client
  pair (one tradie, one property, made by an invite link from either side) takes 5% (`OWN_CLIENT_FEE_BPS`) below the
  line (3% above it, as every job) on
  everything the 15% applies to (menu share, surcharges, call-out, quotes, hourly), set on the job
  (`jobs.platform_fee_bps`) when that tradie accepts; that tradie is first choice there in their trade. No pair
  where HostFix already offered that tradie a job at that place, matched by normalised address or pin, never by
  account (`hostFixIntroduced`). Owners HostFix introduced stay at 15% through the app, with no time limit: the
  12-month rule and the NZ$250 buyout are gone. One rule replaces them: an app job is finished and paid in the
  app; finishing one outside it can lead to removal, which a person decides. Urgent response is an add-on
  the owner pays for, never an inclusion; Priority was removed because delivering it cost more than it charged. The 15% applies to the urgent and after-hours
  surcharges too: the tradie gets each surcharge less the fee (`surchargeShare` in `src/lib/jobs/pricing.ts`),
  on top of their menu share, and the offer text shows that share (`DECISIONS.md`, 2026-11-18). Parts are
  the tradie's own price less 3%: see the parts rule below.
- **HostFix never loses its margin because a tradie is unreliable, and the owner pays only for what
  happened** (`DECISIONS.md`, 2026-11-18). No missed-promise credit is ever created (`markMissedWindows`
  in `src/lib/billing/settle.ts` only marks and flags; a credit made before 18 Nov 2026 still comes off its
  own job's charge). The Arrived tap settles the surcharges (`markArrived`, `src/lib/jobs/arrival.ts`), so
  the owner sees the final lines before the charge: an urgent job reached after its deadline has no urgent
  line for anyone (owner 0, tradie 0, us 0), and the after-hours line stays only if the tap is outside
  working hours. A normal job's tradie picks a two-hour window inside the promise when accepting, and on
  time means by its end. A normal job nobody accepts in the market's hours (3 by default) texts the owner
  ("you pay nothing unless a tradie does the job") and alerts the team. The owner has "The tradie isn't
  here" (a button) once Arrived is tapped. The first choice or backup may suggest a later time; the owner waits (the promise
  moves, urgent stops being urgent) or sends it on, and no answer in the market's hours (2) sends it on.
  Those two owner texts are never sent 9pm to 7am (held until 7am), and on a normal job both clocks count
  only 7am to 9pm (`addTextingHours`, `src/lib/time.ts`). Urgent jobs run any time. The terms and tradie
  agreement read these numbers from the market and the constants (`tests/unit/legal.test.ts`).
- **Pattern flags go to the queue, never to a removal** (DECISIONS.md, 2026-11-23, `src/lib/ops/patterns.ts`): the
  same tradie and owner with 2 or more accepted jobs in 90 days that ended without Job done (cancelled after On my
  way, or a no-show), or a tradie with 3 or more accepted jobs in 90 days cancelled after On my way. Neutral words,
  never counted as a decline, never a change to an account.
- **Declining a job never counts against a tradie, anywhere** (contractor status). Only arrivals at jobs
  they accepted count (`src/lib/tradies/reliability.ts`): under 90% on time over their last 20 (from 10
  arrivals) puts them in a later wave of network offers, never out of a first-choice or backup slot. A
  no-show (accepted, nobody there by the promised time) goes to the queue; 3 in 90 days flags them for a
  conversation. Only a person removes a tradie. The owner is never told a tradie "passed" or "declined".
- **Every finished job is checked, and the owner is asked before the team** (`DECISIONS.md`, 2026-11-19).
  Every property has a map pin (`src/lib/properties/pin.ts`): looked up from the address in the LINZ address
  list when `LINZ_DATA_KEY` is set, confirmed or moved by the owner on a small map, and cleared when the
  street address changes. Arrived needs a "before" photo and Job done an "after" photo, taken in the app,
  each stamped with the server's time and the phone's location. Both taps are compared with the pin (with
  no pin, the middle of earlier trusted arrivals): over 300 m (`FAR_METRES`) or no location is a flag, and
  the tap is never refused. Job done under `min_minutes_on_site` (10) after Arrived is a flag, except
  diagnosis and look-and-price jobs and "could not get in"; so is a photo dated 30 minutes or more before the job was logged.
  A job with no flags pays exactly as before. A flagged one charges the owner as normal, holds the payout
  (`held`) and asks the owner, in neutral words that never accuse the tradie, to look at the before and
  after photos and press "Yes, it's fixed" (released) or "Something's wrong" (the dispute). No answer in
  `owner_confirm_hours` (48): a trusted tradie (10 or more finished jobs before this one, no other flag in
  90 days) is paid and the flag is logged; anyone else goes to the queue for one-tap Approve or Hold
  (`src/lib/jobs/confirm.ts`). 3 flagged jobs in 90 days flags the tradie for a conversation, never removal.
  Only accepted, finished jobs can be flagged. The terms, privacy page and tradie agreement read these
  numbers from the market and the constants (`tests/unit/legal.test.ts`). Never call any other map or
  address service, or a paid one, without the founder's yes.
- **Parts: the tradie's own price, asking first, and spot checks** (`DECISIONS.md`, 2026-11-23, replacing 2026-11-20
  for parts added from then; `src/lib/jobs/parts.ts`). On any job. Small parts up to `partsIncludedCents` (NZ$20) are
  in the price: a part whose price times quantity is at or under it is refused. Every other part is the tradie's
  own price including GST (`kind = 'priced'`): the owner pays it, the tradie gets it less 3% (`PART_FEE_BPS`), no
  receipt needed. The market's price list (`price_list_items`) is only quick picks that fill in a name and price,
  both editable; a pick priced over 1.5 times its list price (`PART_PRICE_FLAG_MULTIPLE`) goes to the queue
  (`part_price`), nothing held. Up to `partsApprovalCents` (NZ$150) of parts on a job, within the property's overall
  limit, are added at once and the owner texted; above it the owner approves first. Staff can request the receipt
  for any part (`requestReceipt`, a spot check): the payout is held (`holds.ts`) until it arrives; 7 days without it
  refunds the part out of the held payout (`refundMissingReceipts`). A receipt sent is checked: dated over 90 days
  before the job, or the same file on another job's part, holds the payout for Approve or Hold. The receipt is seen
  by staff and the tradie who sent it, never the owner. Owner words come from `partsWords`; never say "retail" or
  "at cost" to an owner. Parts added before 23 Nov 2026 keep their terms (list price, or receipt plus 20% with
  "receipt to follow"); before 20 Nov 2026, at cost.
- **A hold on the owner's card before a job goes out** (DECISIONS.md, 2026-11-23, `src/lib/billing/card-holds.ts`).
  `sendOut` places a manual-capture, off-session hold for the job's known price (menu price with GST and any
  surcharge, or the call-out for off-menu work) before `startDispatch`; the Stripe call is outside any `db.tx`,
  claimed first (`card_holds`, status `placing`) with the key `hostfix-job-<id>-hold-<seq>`. A declined hold is a
  card problem (`card_hold = 'declined'`): an owner logging is refused (the job is cancelled at no cost), anyone
  else's report waits and is retried only once a new card is saved. `keepHoldsAlive` (the timer) renews a hold 12
  hours before `capture_before` on an open job and lets the old one go; a visit further off than a fresh hold
  lasts gets its hold a day before (`jobs.hold_due_at`). `chargeJob` captures up to the held amount, then charges
  anything beyond it separately (`payments.hold_captured_cents`, `extra_payment_intent_id`); refunds come off the
  first payment first (`refundAcross`). Cancelled before Arrived (even after On my way): the hold is let go, the
  owner pays nothing, the tradie bears their travel. Cancelled by the owner after Arrived: the call-out is captured
  and the tradie paid their share (`cancelledOnSiteLines`). The demo gateway and `e2e/fake-stripe.mjs` behave the same.
- **A finished job is paid whatever the owner's card does, up to NZ$1,000 of its price** (DECISIONS.md, 2026-11-20,
  second entry; capped 2026-11-23). A payout never waits for the charge for the first `payout_guarantee_cents`
  (NZ$1,000, a market column) of the job's price not yet collected; the tradie's share of anything above that
  waits (`payouts.waits_cents`) and is sent as a second transfer once the money arrives (`releaseDueRests`). A
  charge that fails four times, or a bank debit that fails once (not retried by itself; the next try is on the
  card), is what the owner owes, and blocks their
  new jobs (`cardProblem`: no card, expired, a failed charge, or a declined hold). No job is sent to tradies without a usable
  saved card: an owner is refused, anyone else's report is held (`card_hold`) until the card is sorted.
  A lost chargeback the team marks as the tradie's fault becomes a balance taken from later payouts, never
  more than half of any one (`deducted_cents`); otherwise HostFix carries it.
- **Work that takes a job over NZ$1,000 takes a 50% deposit** (DECISIONS.md, 2026-11-23, second entry; replaces
  "charged in full on approval"). Such a quote (`quotes.deposit`, `DEPOSIT_ABOVE_CENTS`) always waits for the owner,
  even inside their limit; parts never do. Approving takes `depositFor`: half the approved amount the card hold does
  not cover (`job_prepayments`, key `hostfix-quote-<quote>-deposit-<try>`). By default from the owner's NZ bank
  account by Stripe NZ BECS Direct Debit (saved once on Stripe's page with its mandate, `owner_billing.bank_*`,
  `/app/billing/bank`; none saved asks them to add it or pay by card): `processing` for a few working days, the
  quote stays pending and the tradie is texted "approved, deposit clearing" and must not start; cleared
  (`payment_intent.succeeded`, or `checkDebits` asking hourly) approves it and texts "deposit cleared, go ahead";
  failed leaves it unapproved, texts both, and raises `deposit_failed`. By card: charged at once, approved when it goes
  through. At Job done the rest is taken the same way as the deposit (`payments.method`): the hold first, then a bank
  debit (`processing` until it clears, key `hostfix-job-<job>-debit-<try>`) or a card charge. A deposit for work that
  does not go ahead is refunded (`refundDuePrepayments`). The demo gateway (debits clear 72 hours on the app's clock;
  `demo_bank_fails` fails) and `e2e/fake-stripe.mjs` behave the same.
- **No offers without the current tradie agreement.** Both offer queries require
  `agreement_version = TRADIE_AGREEMENT_VERSION`, which is also the date on the agreement page. Change the
  agreement, bump the version, and every tradie agrees again in the app. A platform fee change waits 30
  days once a market has tradies, and they are texted.
- **A quote on a menu job is for work beyond the job described; "Not the job described" is the only way off the
  menu price** (DECISIONS.md, 2026-11-20, third entry): menu jobs only, a photo and a one-line reason, the call-out
  instead of the menu price, paid only when the owner approves the quote or has not objected in
  `not_described_hours`; until then the payout is held and the owner not charged; an objection goes to the team.
  For plumbers, electricians, gasfitters and handymen, extra work up to NZ$1,000 is quarter hours at the market's fixed
  rate (`DEFAULT_HOURLY_RATES`, NZ$160/160/170/110, confirmed 2026-11-24, second entry; the tradie cannot type another);
  over it, their own price. **Every other trade has no fixed rate**: its extra work is the tradie's own price, approved by
  the owner (their yes, or their limit). "Plumbers and sparkies have a fixed hourly rate; cleaners and the like are priced
  by the job." A rate set on More > Markets overrides a default; emptying the box takes it away. The tradie agreement
  (section 5) names the rated trades from `DEFAULT_HOURLY_RATES`. An off-menu job's call-out comes off its first quote that goes ahead, for both sides in
  proportion. No second call-out on a job. A tradie's quote rate over 25% and over twice the market average flags
  them for a conversation; declines never count.
- **Every text fits one 160-character GSM-7 message with "Reply STOP to opt out" added** (tested with long,
  realistic values in `tests/unit/messages.test.ts`), never carries a street address or access details (offers
  and "job yours" included: those are only on the job page), and STOP is obeyed per number (sign-in codes
  excepted). Job done, receipts and payment/payout notices go by email to anyone with an email address. Offers go
  by app notification first when it is on; owners' updates go by notification instead of text.
- **No insurance, no jobs.** A tradie needs public liability insurance (insurer, policy number, expiry) on
  file and the certificate of currency uploaded (an `insurance_certificate` file, `src/lib/tradies/certificate.ts`)
  before approval, and the offer query skips anyone whose insurance has run out or has no certificate, the
  same as licences. The newest certificate is the current one; older ones are kept. Only staff approve.
  A tradie waiting for approval can sign in, but only to their profile (`requireTradie`).
- **Urgent work is never discounted.** Whatever rate a tradie is on for booked work, same-day, urgent
  and after-hours jobs pay the full card rate. A discounted urgent rate puts the network last in a cold
  snap, which is when the response guarantee is actually tested.
  `config/markets.ts` only seeds a market that does not exist yet.
- **Licensed work is only offered to a tradie with a licence on file that has not expired** (plumbing, gas,
  electrical, appliances, heat pumps, drainage and septic). **Building work only goes to a tradie with an LBP
  number on file** (`lbpRequired`, `needsLbp` in `config/trades.ts`; DECISIONS.md, 2026-11-24). Both are checked
  when offering and again when accepting or assigning (`eligibleTradies`, `canStillTake`).
- **A job nobody can match goes to a person, never to handymen by default** (DECISIONS.md, 2026-11-24). Off the
  menu the owner picks a trade or "Not sure" (trade `other`); a "Not sure" job is held on the card, then waits in
  the queue (`trade_needed`) until staff tap a trade (`chooseTrade` in `src/lib/dispatch/cascade.ts`). A trade no
  approved tradie in the market has goes straight to the queue as "Nobody accepted", saying so. The trade keys in
  `config/trades.ts` are shared with the separate public sign-up form: never rename one.
- **A link in a text never changes anything by being opened.** Phones and chat apps open links to preview
  them. Accepting needs a button press.
- **Plain language on every screen.** No jargon. Error messages say what to do next.
- **Never promise tradies money in the bank faster than Stripe pays it** (`payoutArrival` in
  `config/markets.ts`). A test fails if "48 hours" returns to the tradie page.
- **The legal pages say only what the app does.** Terms, privacy, the tradie agreement and insurance are
  written in plain English from the code's behaviour (`docs/LEGAL-TODO.md`). Change the page when the
  behaviour changes, and never promise more than the code keeps. Community Law reads them before the
  first job; a lawyer at around 100 properties.
- **Secrets only in environment variables.** Add new ones to `.env.example`, `SETUP.md`, `tests/setup.ts`,
  `playwright.config.ts` and the setup checklist (`src/lib/status.ts`).
- **People only see their own data.** Every query for an owner or tradie takes their id. Private pages
  call `requireOwner()`, `requireTradie()`, `requireStaff()` or `requireAdminRole()` themselves. The proxy
  is a convenience, not the lock. Every table has Row Level Security on with no policies. Extend
  `tests/unit/access.test.ts` and the "people only see their own data" browser test with anything new.
  A cleaner or co-host has no account pages: their own team link lists only covered properties that an
  owner who has them on their team now has ticked for them (one by one or by group), and only on a phone
  holding the `hf_team` cookie, which is set after a six-digit code to their mobile and signed against the
  link (`src/lib/team/`). A forwarded link shows the code screen and nothing else. The guest QR card stays
  per property and anonymous (DECISIONS.md, 2026-11-18).
- **Before a market is live, nothing takes a card and nothing books a job** (DECISIONS.md, 2026-11-27, second entry).
  A market on the waiting list with `pre_launch` on lets owners sign up and add properties, and nothing else. Never
  check `stage === "live"` for an owner's screen or action: ask `ownersCanJoin`, `bookingOpen` or `inPreLaunch`
  (`src/lib/markets/stage.ts`). Anything new that saves a card, starts a membership or logs a job must refuse in
  pre-launch on the server, before any call to the payment company, with the words in `preLaunchWords`, and show a
  `Notice` instead of its button. Going from waitlist to live emails each owner there once (`announceGoLive`).

### Next.js 16 with Cache Components: what bit us

- A component that depends on the visitor must touch the request (`await connection()`, `cookies()`)
  **before any early return**. Otherwise the build can freeze it as fixed content.
- `now()` and random values need `await connection()` first, inside `<Suspense>`. `currentViewer()` and
  `currentStaff()` do this for signed-in pages. Public token pages (`/r`, `/j`, `/o`) do it themselves.
- `usePathname()` in a layout above a dynamic route needs its own `<Suspense>` (`NavLink`, `MetaPixel`).
- Page-level redirects for signed-out visitors arrive after the page has started streaming. `src/proxy.ts`
  does the proper redirect first.
- A server action that redirects to a **route handler** never lands. Redirect to a page.
- `updateTag` works only inside a server action. Public pages for a market added after the build need
  `revalidatePath` and an uncached fallback (`publicMarketNow`).
- Files read at run time (`content/*.md`, `supabase/migrations/*.sql`) must be listed in
  `outputFileTracingIncludes` in `next.config.ts`.
- After a form action React resets the form. Use hidden inputs with button-style choices, or a `key` tied
  to the saved value (`src/components/jobs/ReportForm.tsx`, `src/components/forms/Fields.tsx`).
- Next keeps the page you came from in the DOM, hidden. Browser tests must look at visible text only
  (`shown()` in `e2e/product.spec.ts`).

### Before saying something is done

```bash
npm run check                          # lint, types, unit tests
npx next build && npm run test:e2e     # real browser, phone size, four copies of the site
npm run test:db                        # needs DATABASE_URL for a throwaway Postgres
```

- Tests run during every deploy with the real keys present. `tests/setup.ts` hides them from the tests.
- Unit tests run on a real Postgres engine inside the test process (`tests/unit/db.ts`), with the real
  migrations. `npm run test:db` repeats them on a real server, which is where the same-second races are proven.
- Outside services are tested against stand-ins (`tests/unit/helpers.ts`, `e2e/fake-stripe.mjs`, the demo
  payment gateway). **The Stripe calls for memberships, job charges and tradie payouts have never run
  against a real Stripe account.** `docs/STRIPE-TEST-CHECKLIST.md` is the manual run.
- Read the provider's current documentation before changing any call to an outside service. Do not rely
  on memory.
- To look at the product: `npm run demo`, then `/demo`. Delete `.data/` to reset the sample business.
