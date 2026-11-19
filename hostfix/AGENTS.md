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
| Prices, surcharges, tax, what each side pays and gets | `src/lib/jobs/pricing.ts` |
| Logging a job, guest reports, cancelling | `src/lib/jobs/create.ts` |
| Arriving, quotes, finishing, "could not get in" | `src/lib/jobs/work.ts` |
| The offer cascade: first choice, backup, everyone, dispatcher | `src/lib/dispatch/cascade.ts` |
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
- **The real prices are loaded.** `seed/menu-queenstown.json` is the 60 researched Queenstown jobs. It only
  fills an empty database: after that, prices change on the admin screen. The prices sit at local market
  rate, not above it, so nothing may tell an owner they pay a premium for price certainty. Money tests
  are worked out by hand from the menu file, never pasted from what the code returns.
- **Every promise on a public page must be something the code does today**, or be tracked as owed in
  `DECISIONS.md` and on the go-live checklist (the founding half price is one). No unsourced statistics.
- **Free to join; the money is the 15% inside every fixed job price** (`DECISIONS.md`, 2026-11-17).
  Essential costs NZ$0: a property is covered once a card is on file, with no subscription. The founding
  deposit is no longer offered (paid ones are refunded by hand); the lead form has one button, "send me
  the price list". The demand test's scorecard still counts leads and any deposits paid before the change.
- **Two tiers, one fee.** Essential (free) for owners. Portfolio for managers with 10+ properties, a
  retainer banded by portfolio size, built and switched off for now. The platform fee is 15% of every job
  in both, and never varies. Urgent response is an add-on the owner pays for, never an inclusion; Priority
  was removed because delivering it cost more than it charged. The 15% applies to the urgent and after-hours
  surcharges too: the tradie gets each surcharge less the fee (`surchargeShare` in `src/lib/jobs/pricing.ts`),
  on top of their menu share, and the offer text shows that share (`DECISIONS.md`, 2026-11-18). Parts are
  passed on at cost with no fee.
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
- **No insurance, no jobs.** A tradie needs public liability insurance (insurer, policy number, expiry) on
  file and the certificate of currency uploaded (an `insurance_certificate` file, `src/lib/tradies/certificate.ts`)
  before approval, and the offer query skips anyone whose insurance has run out or has no certificate, the
  same as licences. The newest certificate is the current one; older ones are kept. Only staff approve.
  A tradie waiting for approval can sign in, but only to their profile (`requireTradie`).
- **Urgent work is never discounted.** Whatever rate a tradie is on for booked work, same-day, urgent
  and after-hours jobs pay the full card rate. A discounted urgent rate puts the network last in a cold
  snap, which is when the response guarantee is actually tested.
  `config/markets.ts` only seeds a market that does not exist yet.
- **Licensed work is only offered to a tradie with a licence on file that has not expired.** Checked when
  offering and again when accepting or assigning.
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
npx next build && npm run test:e2e     # real browser, phone size, three copies of the site
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
