# DECISIONS

What was decided outside the code, and what the code still has to catch up on.
Newest at the top. When a decision here contradicts a comment in the code, this
file wins and the code is wrong.

Written for whoever picks the work up next, human or agent. If you change a
price, a fee or a promise, add a line here saying what and why.

---

## 2026-11-17 — Free to join. The money is the 15% on every job.

Owners who rang after the first ads all said the same thing: "$600 a year for
maintenance isn't relevant to me." They were comparing the membership with what
they spend on repairs, not valuing the guarantee, because nobody values a
guarantee from a company that has never turned up for them. The friction is the
card step before the first job, not the number on it. $1 a month has the same
friction as $99.

**The model from today:**

- **Owners pay nothing to join.** No membership, no deposit. They add a property,
  put a card on file, and pay the fixed menu price when a job is done. The 15%
  platform fee is inside every menu price, as it always was.
- **Managers pay nothing to join either.** The Portfolio retainer stays built and
  switched off. A manager is asked to start with 10 properties for 60 days so
  the tradies can handle the volume: that is capacity, not price.
- **The response promise stays: on site within 24 hours, or 4 when urgent.** The
  "that month's membership is free" credit has nothing to credit. Replaced by:
  miss the time and the owner is not charged the call-out portion of that job
  (the market's diagnosis fee, NZ$225 in Queenstown, capped at the job's price).
  The tradie is still paid in full; the platform wears it.
- **Every tradie must have public liability insurance on file**, with the policy
  number and expiry. No insurance, or expired insurance, and the app offers them
  nothing, the same rule as licences.
- **Founding deposits already paid** are refunded in full. There is no first
  bill to take them off.
- **Jobs, quotes, surcharges, payouts and disputes do not change.**

**Why free beats cheap.** Any card step before the first job loses a third of
signups. $0 gets the property into the app, the QR card into the house and the
cleaner onto the link, and the first job makes the sale. A free app is also how
cleaners and managers put whole portfolios in.

**What this does to the money.** A property brings 2 to 4 jobs a year at about
NZ$235, so NZ$70 to NZ$140 a year in platform fee. Queenstown alone tops out
near NZ$200k a year. The business is national, and the levers are volume
discounts from tradies (open spec 3 below, lifting the take from NZ$35 to
about NZ$70 a job), Portfolio retainers when a manager wants guaranteed
capacity, and a low cost per property from owner lists rather than ads.

**Towns open on demand.** Owners anywhere in New Zealand can add a property.
A town opens for jobs only once it has tradies in every trade; until then an
owner there is told so when they try to log a job, and the admin is shown which
towns have properties waiting.

### Code to change

- Essential becomes a NZ$0 tier: the property is a member as soon as a card is
  on file, with no subscription and no monthly invoice. The code paths for a
  priced membership stay, for Portfolio and for a paid tier later.
- The missed-promise credit becomes the call-out credit above.
- Tradies: insurance policy number and expiry on their profile, required before
  approval and checked at offer time.
- Owner page, price list, thank-you page and ads: "free to join, fixed prices,
  pay when it's fixed". The founding deposit button goes. Refund paid deposits.
- Legal pages: a real privacy statement and tradie agreement written from
  `docs/LEGAL-TODO.md`, agreed to in the app with the time recorded. Owner
  terms likewise. Reviewed by Community Law before the first job, and by a
  lawyer at around 100 properties.

---

## 2026-11-17 — A second tier for property managers (Portfolio)

The first inbound owner-side enquiry was not an owner. It was a property
manager with 63 properties. Managers are a real second segment, not a special
case: roughly a quarter of Queenstown's short-stay listings sit under
professional management, so this buyer will come back.

**They are not buying the same thing.** An owner with one holiday home is
buying a phone number to ring — peace of mind they do not currently have. A
manager already has tradies, systems and staff. What they lack is capacity:
the job their own people cannot get to, Friday at 4pm in peak season, with a
guest already in the house. Selling a manager 63 memberships is selling them
something they believe they already own, and it prices at $6,237 a month,
which ends the conversation.

### The structure

**The platform fee never varies: 15% of every job, every tier, every
portfolio size.** That is the spine. Only the access fee changes.

| Tier | Who | Access fee |
| --- | --- | --- |
| Essential | Owners, 1-9 properties | $99 per property per month |
| Portfolio | Managers, 10+ properties | A retainer banded by portfolio size |

Portfolio bands, per month:

| Properties | Retainer |
| --- | --- |
| 10-24 | $600 |
| 25-49 | $900 |
| 50-99 | $1,200 |
| 100+ | By arrangement |

A manager with 63 properties pays $1,200 a month plus 15% of jobs — around
$1,975 a month on an estimate of 25 overflow jobs.

**Why a band and not a per-property rate.** What a manager buys is guaranteed
response capacity, and capacity does not scale one-to-one with doors. It
scales with how many things break at once. A band says that honestly and
survives the obvious question on a sales call.

### The intro offer, in both tiers

The rule is the same — a small commitment to start — but the instrument
differs, because discounting a manager anchors them to the lower number and
makes month four a fight.

- **Essential: lower the price.** Half price for the first three months.
- **Portfolio: lower the scope.** A 60-day pilot on 10 properties at the
  10-24 band, then the real band. No discount is given, so there is no
  discount to claw back.

The pilot is also how the prices get tested. Every price in the menu is
researched rather than observed, and ten properties for 60 days produces real
job costs before the other 53 are priced.

### What is built (the app bills Portfolio itself)

- **A tier says how it is charged.** `billingBasis` on `MembershipTier`
  (`config/markets.ts`) is `per_property` (Essential) or `per_account`
  (Portfolio), and a per-account tier carries its bands. Both are columns on
  `membership_tiers` (migration `20261119000000_portfolio.sql`), editable on
  Admin > Markets > the market > Memberships, with plain-language labels. The
  bands are checked there: lowest first, no gaps or overlaps, only the top band
  open-ended or "by arrangement". Queenstown has Portfolio with the bands above.
- **The membership belongs to the account.** A new `portfolios` table holds the
  one retainer: the subscription, the band it is billed at and how many
  properties that was worked out from. Each property under it points at it and
  keeps the portfolio's status, so jobs, guest reports and cover checks are
  unchanged. Essential is untouched: still one subscription per property.
- **The owner picks Portfolio once**, on the Billing page or as the membership
  for a new property. Properties not yet paying for themselves join it, and so
  does every property added after. There is no per-property card page. The
  retainer cannot start below 10 properties ("Portfolio is for 10 or more
  properties"). The Billing page shows the one retainer, the band, the number
  of properties and the next payment date.
- **The band follows the property count.** Adding or taking a property off
  re-checks it (`bandFor` in `src/lib/markets/bands.ts`, `rebandPortfolio` in
  `src/lib/properties/portfolio.ts`). A change goes to Stripe for the next
  monthly payment, never a part-month charge, and is written to the audit log.
- **Jobs are the same.** Menu price, surcharges, the 15% fee, the owner's card
  charged and the tradie paid, exactly as for Essential.
- **The numbers count each retainer once.** Monthly membership income is
  per-property members times their price, plus each Portfolio retainer once.
- **Content:** `{{portfolio_from}}` (the lowest band) and a second "What it
  costs" card for managers on the owner page.

### What is still done by a person

- **100 or more properties is priced by arrangement.** The app never sets that
  price. Starting a Portfolio of 100+ is refused with a message, and the queue
  gets a "Portfolio price needs a person" item. An account that grows to 100
  keeps paying the 50-99 band until the admin sets the agreed retainer on the
  owner's page under Owners (it then takes effect from the next payment).
- **Fewer than 10 properties.** An account that drops below 10 stays on the
  lowest band and goes to the queue. Nobody is moved to Essential
  automatically.
- **The 60-day pilot.** A Portfolio with exactly 10 properties is billed at the
  10-24 band, which is the pilot. The 60 days themselves are not tracked by the
  app: note the start date and the review date below, and talk to the manager
  before day 60.
- **Missed promises on a Portfolio property** are not credited automatically
  (see "Owner decisions still outstanding").

Portfolio pilots under way (manager, start date, review date):

<!-- Add each pilot here: name, the date the retainer started, the date 60 days on. -->

### Settled in the build, to confirm with the founder

These were not covered by the decision. Each was the simplest reading, and
each can be changed:

- Taking a property off a Portfolio stops its cover at once (there is no
  part-month refund, as the retainer is for the account). The band drops from
  the next payment.
- An owner already paying Essential for a property keeps that subscription
  when they pick Portfolio. Only properties not yet paying join. To move one
  across, cancel its Essential membership; once the month it paid for has run
  out, add it to the Portfolio from its page.
- The founding deposit is never taken off a Portfolio retainer (Portfolio has
  no discount).
- Referral rewards are not paid for properties on a Portfolio (the reward
  counts a property's own monthly payments, and a Portfolio property has none).
- A market that offers no Portfolio shows an `[EDIT]` marker where
  `{{portfolio_from}}` would be, so the gap is counted on the admin screen.
- The first draft of this entry listed a `tier: "essential" | "priority"`
  union in `src/lib/content.ts` to fix. It no longer exists, so nothing needed
  changing there.

---

## 2026-11-16 — The demand test is built; real prices loaded; Priority removed

Done in the code (branch `claude/hopeful-hamilton-yd41nf`):

- **The researched menu is live.** `seed/menu-queenstown.json` is the 59 researched jobs and the
  `.proposed` file is gone. The 27 money tests were re-derived by hand from the new prices, not pasted
  from output (`tests/unit/money-flow.test.ts` header shows the working). Surcharges, off-menu fee,
  payout and approval limit are the new numbers, in the seed and in the `config/markets.ts` defaults.
- **The five `needsLocalQuote` jobs and the two add-ons start switched off** (`startsOnTheMenu` in
  `src/lib/db/seed-core.ts`), so 52 jobs can be booked and are on the price list. Switch one on from
  More > Markets once a local has confirmed its price.
- **25 jobs are owner-only** (`guestVisible: false`): upkeep, compliance checks, outdoor and seasonal
  work that a guest has no reason to report.
- **Priority is gone.** One membership, Essential, NZ$99. The code can still hold a membership that
  includes urgent call-outs (tested), but none is offered.
- **After-hours is before 7am, from 4:30pm, and all of Saturday and Sunday** (the row above: "after
  4:30pm and Saturdays"). Working hours can now be set to the half hour (migration
  `20261118000100_half_hour_working_day.sql`). Queenstown: 7am to 4:30pm, Monday to Friday. The old
  default was 7am to 6pm, Monday to Saturday. Public holidays are still treated as normal days: open spec 1.
- **The owner page is the demand-test page**: real prices, a NZ$99 refundable founding deposit as the
  first button and "Not yet: just send me the price list" as the second, 25 founding spots that stop
  taking cards when gone, the full price list on the thank-you page and by email (with a link back to the
  founding spot), and a 14-day scorecard on the leads page. `docs/DEMAND-TEST.md` is how to run it.
- **The pass mark is three owners with a card down** (`TARGETS` in `src/lib/leads/demand-test.ts`).
  Ten owner leads and two handymen, a plumber and an electrician are shown alongside it as signs, not
  as the pass mark.

Choices made while building it, for you to overrule:

- **Nothing on the page that is not built or not sourced.** Left out from the earlier drafts: "one
  number" to ring, calendar and guest-message links, one-off door codes, an app, the "three in four
  problems" statistic, what a Queenstown property earns, and any price comparison with the AA. "Who
  this is not for" says an owner who only wants emergency cover at their own home is better off with a
  home emergency plan, without naming a price.
- **The founding promises are the admin's own words** (More > Markets), shown word for word on the page,
  the card page and the email, so they can never drift apart.
- **Price list emails need your own domain in Resend.** With Resend's test sender the email is skipped
  and the leads page says so. The owner still sees the list on the thank-you page.

### Owed before Queenstown goes live

- **Founding billing.** The page promises founding members half price for three months (NZ$49.50 a
  month, then NZ$99) and that the NZ$99 deposit comes off their first bills. Billing today takes the
  deposit off the first month, up to one month's price, and charges full price after. Build a
  three-month 50% discount on the Stripe subscription for owners with a founding deposit, and carry any
  deposit left over into the next bills, or change the promise before anyone else pays. The go-live
  checklist shows this line until then (`foundingBillingLine` in `src/lib/leads/founding.ts`).
- **The weekly payout cycle** in "Facts that must not drift" below (everything closed Monday to Sunday
  lands the following Tuesday) is not built. The code pays each job after a 24-hour hold, and the
  tradie page says "about 5 to 6 working days after the job", which is what the code does.

---

## 2026-11-16 — Real prices researched (now loaded: see above)

*Done: the swap is made and the tests re-derived (entry above). Kept for the
reasoning.* `seed/menu-queenstown.proposed.json` held 59 researched jobs meant to
replace the placeholder menu.

Where the prices came from: Queenstown call-out plus first-hour rates as
advertised in November 2026. A local plumber or electrician charges a $90-130
call-out and $90-150 for the first hour, excluding GST. That is $207-322
including GST for an hour on site. The menu's typical $235 job sits in the lower
middle of that band.

That matters for the sales story. An earlier draft claimed the menu was priced
about 18% above market. It is not. That 18% was against the *national* average.
Against Queenstown the menu is at market. Nothing on a page or in an email
should say owners pay a premium for price certainty, because they don't.

Five items are priced off national averages rather than Queenstown quotes and
carry `needsLocalQuote: true`: `GD-01`, `PV-01`, `PV-02`, `PV-04`, `OD-03`.
Ring a local and confirm each one before an owner can book it.

### What the proposed file changes

| What | Live now | Proposed | Why |
| --- | --- | --- | --- |
| Jobs on the menu | 25 | 59 | The 25 missed most of what actually goes wrong in a short-stay house: winter work, compliance checks, outdoor and preventative jobs. |
| `urgentDollars` | 80 | 90 | A tradie dropping a booked job for a same-day call-out needs more than $80 to make it worth doing. |
| `afterHoursDollars` | 120 | 140 | Same reasoning, after 4:30pm and Saturdays. |
| `diagnosisFeeDollars` | 120 | 225 | $120 did not cover an hour on site at Queenstown rates. It was a loss on every off-menu job. |
| `diagnosisTradiePayoutDollars` | 102 | 190 | Holds the 15% fee on the new number. |
| `ownerApprovalAboveDollars` | 400 | 600 | At $400 the owner was being woken for ordinary jobs. $600 sits above almost every line on the menu, so an approval request means something unusual has been found. |
| `placeholderPrices` | `true` | `false` | |

The platform fee is unchanged: 15% of the owner price. Every owner price in the
proposed file is `payout / 0.85` rounded to the nearest $5, and the file's own
checks confirm no mismatches, no duplicate codes, and payout always below owner
price.

### The swap is a job, not a file copy — read this before doing it

`tests/global-setup.ts` seeds the test database from the live menu through
`seedMarkets`, so the money tests are built on the real prices. Overwriting the
menu turns 27 tests red in three files:

- `tests/unit/money-flow.test.ts` — 22 tests
- `tests/unit/cascade.test.ts` — 4 tests
- `tests/unit/demo-sample.test.ts` — 1 test

They fail for honest reasons. `HM-01`, which several fixtures log, goes from
$130 to $155. The $220 / $187 item the surcharge tests are built on
(`PL-01` today) is not $220 in the proposed menu. The surcharge and threshold
numbers are written into test *titles* as well as assertions — "the owner pays
NZ$80 more", "a quote over NZ$400 stops everything".

**Re-derive every number from the new prices. Do not paste in whatever the code
now returns.** These tests are the only independent check on the money path. A
test updated to match the output it is supposed to be checking is worse than no
test, and this is the one place in the app where that costs real money. The
arithmetic in them is written to be readable for exactly this reason
(`ownerTotalCents: 22000 + 8000 + 12000`) — keep that style, change the parts.

Also in the same commit:

- `tests/unit/config.test.ts` — the job-count range (20-30), the surcharge
  equality at line 99 and the $400 threshold at line 100 all pin the old values
- delete `seed/menu-queenstown.proposed.json` once it is the live file, so there
  is only ever one menu

`config/markets.ts` holds the same numbers as template defaults for a new
market. `seedMarkets` merges the seed file over the top, so Queenstown is
correct either way, but update the defaults too or the next market starts wrong.

---

## 2026-11-16 — The Priority tier is dead

There is one membership: Essential, $99 per property per month, 24-hour
response. Urgent response is an add-on the owner pays for, never an inclusion.

Priority was $149 for a 4-hour response, four urgent call-outs and four
quarterly checks. Delivering that costs about $68 a month against a $50
premium. It lost money on every customer who used what they paid for, and the
customers most likely to buy it are the ones most likely to use it.

*Done: removed from the config, the copy, the demo and the tests (entry above).*
**What had to change.** The tier was live in:

- `config/markets.ts` — the `priority` tier in `launchMarket.tiers`
- `src/lib/content.ts:26,66,69` — the `tier: "essential" | "priority"` union and the copy
- `src/lib/demo/sample.ts:68,199,210` — two demo properties on `tier: "priority"`
- `tests/unit/config.test.ts:23-41` — two tests require a Priority tier to exist and to cost more than Essential

Removing it means deleting the tier, narrowing the union, moving the demo
properties to `essential`, and replacing those two tests with ones that assert a
single tier.

A second tier may come back later. If it does it is priced off what it costs to
deliver, not off what looks good next to $99.

---

## Open specs — code changes the decisions need

These were decided but not built. Each one needs code, not a seed edit.

### 1. A third surcharge tier for Sundays and public holidays

$220, four-hour window, the whole surcharge to the tradie. Saturdays stay on
the after-hours rate.

No key exists for it. It needs:

- a field in the seed schema and in `src/lib/db/seed-core.ts` (see the
  `surcharges` block it reads around line 34 and merges around line 59)
- a column and a `Market` field alongside `afterHoursSurchargeCents` in
  `config/markets.ts`
- the window itself in whatever decides after-hours, so a Sunday is told apart
  from a Saturday
- a public holiday list per market. NZ holidays move. Southland and Otago
  anniversary days are regional and Queenstown observes Otago.

### 2. Urgent allowance per plan

`config/markets.ts:38-40` already has `urgentIncluded` and
`urgentIncludedPerMonth`, which is the right shape. Nothing sets them to
anything but off, which is correct for a single-tier Essential.

Keep the fields. If a tier ever includes urgent call-outs, the allowance is
four a *year*, not one a month. One a month costs about $30 a month to deliver
and would need a $50 premium to clear.

### 3. Two rates per job: routine and card

A tradie who books a job 24 hours ahead or more is paid the `routineRate`,
15-20% below the card rate. Same-day, urgent and after-hours work is always
paid the full `cardRate`.

The hard rule: **urgent work is never discounted.** A tradie on a discounted
urgent rate puts you last on a cold snap morning, which is exactly when the
response guarantee is being tested.

This is the lever that buys exclusivity. A $40 routine discount across 20 jobs
a month is $9,600 a year from one tradie. A $300 a month slot fee is $3,600.
The discount is worth 2.7 times the fee and is easier to sell, because the
tradie pays nothing up front and carries no ad spend. Pick one. Never both.

**Not ready to build.** It only pays off above roughly 60 properties. At 25
properties the network generates about 37 jobs a month spread across five
trades, so no single tradie sees enough volume for a discount to be worth
giving. Build the schema when the volume is in sight, not before.

### 4. Tradie volume floor

A tradie who takes fewer than 15 jobs a month reverts to the card rate. Same
timing as item 3 — it is meaningless until the volume exists.

### 5. Pre-authorise on accept, capture on close

This answers "who carries the risk when the owner's card fails after the tradie
has done the work". Nobody should. Pre-authorise the owner's card at the moment
the tradie accepts the offer, and capture when the job closes. A card that
cannot be pre-authorised means the job never gets offered.

---

## Owner decisions still outstanding

Not mine to make and not the code's.

- **What a missed promise on a Portfolio property is worth.** Essential credits
  that month's membership for the property. A Portfolio property has no price
  of its own, and a twelfth of the retainer, a share per property or a flat
  amount are all possible. Until this is decided the app credits nothing
  automatically on a Portfolio property and puts "Missed window on a Portfolio
  property" in the queue for a person to decide and credit by hand.
- **GST: principal or agent.** Whether the platform charges owners $235 and
  pays a tradie $200 as a principal, or collects $235 on the tradie's behalf
  and keeps $35 as commission. It changes what goes on every invoice and what
  gets returned to IRD. Joe's accountant decides. Until then
  `pricesIncludeGst: true` means the owner price is GST-inclusive and nothing
  more is claimed.
- **Legal documents.** Terms, the privacy statement, the tradie agreement and
  the insurance position stay placeholders until a lawyer writes them. See
  `docs/LEGAL-TODO.md`. The access-release design matters here: the platform
  hands out street addresses and door codes to houses that may have guests
  inside. Police vetting of tradies is not optional.

---

## Facts that must not drift

Things that have already been got wrong once.

- **Tradie payment timing.** Stripe holds New Zealand card money about four
  working days, and a payout takes another one or two. Money lands five to
  eight days out. Never promise 48 hours. The cycle is weekly: everything
  closed Monday to Sunday lands the following Tuesday. Predictable beats fast
  when the alternative is a 30-day invoice.
  `payoutArrival` in `config/markets.ts` is the single source of truth, and a
  test fails if "48 hours" reappears on the tradie page.
- **The competitor is scope, not price.** AA Home Response Plus is $209 a year
  against $1,188 for Essential. The answer is never that AA is worse value. It
  is that AA covers an emergency at your own home during business hours and
  does not send a tradie to a house with a guest in it on a Sunday. If an
  owner only wants emergency cover, AA is the better buy and the page says so.
- **SMS.** New Zealand has no alphanumeric sender IDs. A short code takes five
  to six weeks to provision with any provider, URL whitelisting is mandatory,
  and Twilio requires "Reply to this SMS will be charged" in every message.
  None of that blocks the first 20-30 jobs a month, which can run on a personal
  phone and web push.
- **Nothing is proven yet.** There are no paying owners. Every number in this
  file is a cost or a rate, not a demand signal. The demand test comes first.
