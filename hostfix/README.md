# HostFix

A maintenance network for short-stay rentals. Owners join free: a property is covered once a card is on file. When
something breaks, the owner, their cleaner or a guest reports it from a fixed-price menu. The job is
offered by text to a local tradie, who has 15 minutes to take it before it moves to the next one. When
it is done the owner's card is charged, the tradie is paid, and the business keeps the difference.
Nobody takes a call, writes a quote or sends an invoice.

Property managers with 10 or more properties can pick Portfolio instead: one monthly retainer for the
whole account, banded by how many properties are on it, with the same job prices and the same 15% fee.

Launch market: Queenstown, New Zealand. Built for many towns across New Zealand and Australia: nothing
is tied to one town, one currency or one tax rate.

**Phases 0 to 4 are built and tested. Phase 5 is planned, not built.** The next step is the demand
test: 14 days of ads to the owner page. Owners join free and pay the fixed price per job; the scorecard counts leads and price-list requests.

## Start here

| You want to | Read |
| --- | --- |
| Run the demand test | **[docs/DEMAND-TEST.md](docs/DEMAND-TEST.md)**: what to set up, the ads, the daily routine, how to read the result |
| Try it now, with nothing set up | **[docs/TRY-IT.md](docs/TRY-IT.md)**: what to click, phase by phase, and what is not done |
| Put it online | **[SETUP.md](SETUP.md)**: every account and key, in order |
| Run it day to day | **[RUNBOOK.md](RUNBOOK.md)**: for the dispatcher, what each alert means and what to do |
| Prove the real payments work | **[docs/STRIPE-TEST-CHECKLIST.md](docs/STRIPE-TEST-CHECKLIST.md)** |
| Brief your lawyer and accountant | **[docs/LEGAL-TODO.md](docs/LEGAL-TODO.md)** |
| See what similar products do | **[docs/MARKET-RESEARCH.md](docs/MARKET-RESEARCH.md)** |
| See the plan, what changed, and what is next | **[docs/PLAN.md](docs/PLAN.md)** |

## Who uses it, and where

| Who | Where | Signs in? |
| --- | --- | --- |
| Visitors | `/`, `/owners`, `/tradies`, `/in/<town>`, `/refer` | No |
| Owner | `/app`: properties, memberships, jobs, billing | Email or mobile, then a six-digit code |
| Cleaner or co-host | `/r/<link>`: the property's team link | No |
| Guest | `/r/<link>`: the QR card in the property | No |
| Tradie taking a job | `/o/<link>`: the link in the offer text | No |
| Tradie | `/tradie`: offers, jobs, pay, profile | Mobile or email, then a six-digit code |
| Owner answering a text | `/j/<link>`: the link in their text | No |
| Dispatcher | `/admin`: the queue, jobs, tradies, owners | Their own email, then a code |
| Admin (you) | `/admin`: everything above, plus numbers, prices, markets, staff | The admin password, or as staff |

## Things you can change without a developer

**On the admin screens** (More > Markets, prices and the menu). These are live the moment you save:

- Every price on the menu, what each tradie is paid, and the jobs on it
- Memberships: price, promise hours, what is included
- Surcharges, the call-out fee, the approval limits, the minutes a tradie has to accept
- Working hours and days, the tax rate, whether the business is registered for tax
- Opening a new town, and moving a town between hidden, waiting list, live and paused
- Tradies, their licences, who gets first pick of each trade
- Staff

**In a file.** Edit it on GitHub (open the file, press the pencil, save). The site rebuilds itself and
the change is live in about three minutes.

| To change | Edit this file |
| --- | --- |
| The words on the owner page | `content/landing-owner.md` |
| The words on the tradie page | `content/landing-tradie.md` |
| Brand name, colours, logo, contact email | `config/brand.ts` |
| The list of trades and which need a licence | `config/trades.ts` |
| How long the pages say a tradie's money takes to reach their bank | `config/markets.ts` (`PAYOUT_ARRIVAL`) |
| The wording of every text message | `src/lib/notify/messages.ts` |

Anything written as `[EDIT: ...]` is a placeholder. It shows highlighted on the live page, and the setup
checklist counts how many are left. If an edit breaks the format, the rebuild stops with a message saying
what is wrong, and the previous version of the site stays live.

`config/markets.ts` and `seed/menu-queenstown.json` are **starting values only**. They are copied into
the database the first time the site is built. After that, change prices on the admin screens.

## How it is built

Mainstream tools, chosen so a small team can maintain it:

- **Next.js + TypeScript** on **Vercel** (the website, its server code, and the once-a-minute timer)
- **Supabase** (the Postgres database and private photo storage)
- **Stripe** (memberships, cards on file, paying tradies through Connect)
- **ClickSend** or **Twilio** (texts), **Resend** (email)
- **Meta Pixel + Conversions API** and **Vercel Web Analytics** (tracking, public pages only)

Where things live:

```
config/      brand, starting markets, trades
content/     the landing page words
seed/        the starting fixed-price menu
supabase/    the database tables. Applied automatically on every deploy
src/app/     the pages and the buttons behind them
src/lib/     the rules: jobs, the offer cascade, money, sign-in, texts, the queue
tests/       automated checks of the rules, run against a real database engine
e2e/         automated checks that click through the real site in a phone-sized browser
docs/        the documents in the table above, and the full research reports
```

## For developers

```bash
npm install
npm run demo        # the whole product at http://localhost:3000/demo, no accounts needed
npm run check       # lint + types + unit tests
npm run build && npm run test:e2e   # browser tests against a real build
npm run test:db     # the same unit tests on real Postgres. Needs DATABASE_URL for a THROWAWAY database
```

- `npm run build` runs the unit tests, then brings the database up to date, then builds. A failing test
  or an unreachable database stops the deploy, and the previous version stays live. To build without a
  database, use `npx next build`.
- Demo mode keeps everything in `.data/`, sends no real texts and moves no real money. It cannot switch
  on once the site is hosted on Vercel.
- Money is always a whole number of cents with its currency beside it. Never a decimal.
- Every job change and every money movement is written to an audit log that cannot be edited.
- The app keeps its own clock (`src/lib/clock.ts`), so tests and the demo can move time.
- This project uses Next.js 16 with Cache Components. Read `AGENTS.md` before changing pages.
