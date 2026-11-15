# HostFix

A maintenance network for short-stay rentals. Owners pay a monthly membership per property.
When something breaks, a local tradie fixes it at a fixed price.

**This folder currently holds Phase 0: the demand test.** It is a small website that finds out
whether owners and tradies in Queenstown want this, before the full product is built.

- New here and want it live? Follow **[SETUP.md](SETUP.md)**. It lists every account and key, in order.
- Something odd happened (a strange alert, a failed text)? See **[RUNBOOK.md](RUNBOOK.md)**.
- What was built, what to click, and what is not done yet: **[docs/PHASE-0.md](docs/PHASE-0.md)**.
- The plan and data model for the whole product: **[docs/PLAN.md](docs/PLAN.md)**.
- The brief for your lawyer: **[docs/LEGAL-TODO.md](docs/LEGAL-TODO.md)**.

## What Phase 0 does

| Page | What it is |
| --- | --- |
| `/owners` | Landing page for property owners, with a sign-up form |
| `/tradies` | Landing page for tradies, with a sign-up form |
| `/owners/thanks` | Thank-you page. Offers the founding member deposit by card |
| `/admin` | Password-protected list of leads, with source and date, a spreadsheet download and a setup checklist |

Every lead is saved to the database, and you get a text and an email the moment one arrives.

## Things you can change without a developer

Each of these is one file. Edit it on GitHub (open the file, press the pencil, save). The site
rebuilds itself and the change is live in about two minutes.

| To change | Edit this file |
| --- | --- |
| The words on the owner page | `content/landing-owner.md` |
| The words on the tradie page | `content/landing-tradie.md` |
| Brand name, colours, logo, contact email | `config/brand.ts` |
| Membership prices, deposit amount, deposit promises, currency, tax rate | `config/markets.ts` |
| The list of trades and which need a licence | `config/trades.ts` |
| The fixed-price job menu (used from Phase 2) | `seed/menu-queenstown.json` |

Anything written as `[EDIT: ...]` is a placeholder. It shows highlighted in yellow on the live
page, and the setup checklist at `/admin` counts how many are left.

If an edit breaks the format (for example the headline line is deleted), the rebuild stops
with a message saying what is wrong, and the previous version of the site stays live.

## How it is built

Mainstream tools, chosen so a small team can maintain it:

- **Next.js + TypeScript** on **Vercel** (the website and its server code)
- **Supabase** (Postgres database)
- **Stripe** (card payments)
- **ClickSend** or **Twilio** (texts), **Resend** (email)
- **Meta Pixel + Conversions API** and **Vercel Web Analytics** (tracking)

Where things live:

```
config/      brand, markets, trades: the settings a non-developer may edit
content/     the landing page words, as Markdown
seed/        the fixed-price job menu
supabase/    the database tables, as one SQL file to paste into Supabase
src/app/     the pages
src/lib/     the logic: saving leads, alerts, payments, sign-in, tracking
tests/       automated checks of the logic and of the database
e2e/         automated checks that click through the real site in a browser
docs/        plan, handover notes, legal brief
```

## For developers

```bash
npm install
npm run demo        # the site at http://localhost:3000 with no accounts needed
npm test            # unit tests
npm run build && npm run test:e2e   # browser tests (phone-sized) against a real build
npm run test:db     # database checks. Needs DATABASE_URL pointing at a THROWAWAY Postgres
npm run check       # lint + types + unit tests
```

- `npm run build` runs the unit tests first. A failing test stops the deploy, and the
  previous version stays live.
- Demo mode keeps leads in `.data/` and never sends real alerts. It cannot switch on once
  the site is hosted on Vercel.
- Money is always a whole number of cents, with its currency beside it. Never a decimal.
- Every money movement is written to an audit log that cannot be edited.
- This project uses Next.js 16 with Cache Components. Read `AGENTS.md` before changing pages.
