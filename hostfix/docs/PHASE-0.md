# Phase 0: the demand test

Built 15 November 2026. This note says what exists, how to try it, and what is deliberately not done.

## What was built

1. **Owner landing page** (`/owners`) and **tradie landing page** (`/tradies`). The words come from
   `content/landing-owner.md` and `content/landing-tradie.md`.
2. **Owner form:** name, phone, email, number of properties, who manages them now, where the owner lives.
3. **Tradie form:** name, phone, trade, licence number if licensed, days available.
4. **Founding member deposit:** after the owner form, the thank-you page offers a NZ$49 refundable deposit,
   paid by card on Stripe's own page.
5. **Every lead is saved**, and you get a **text and an email** the moment one arrives.
6. **Leads page** (`/admin`), behind a password: every lead with its source and date, deposit status,
   totals, a spreadsheet download, and a setup checklist with a "send me a test alert" button.
7. **Tracking:** Meta Pixel and Meta Conversions API (Lead, SubmitApplication, Purchase), Vercel page
   analytics, and the source of every lead (which ad, which campaign).
8. **Brand in one file** (`config/brand.ts`). **Market settings in one file** (`config/markets.ts`):
   currency, tax rate, prices and deposit. Nothing is tied to Queenstown or to New Zealand dollars in the code.
9. **Placeholder legal pages**, clearly marked, and a brief for your lawyer (`docs/LEGAL-TODO.md`).
10. **The Queenstown menu** (`seed/menu-queenstown.json`) with 25 placeholder jobs for you to price.

## What to click

Once it is deployed (SETUP.md steps 0 to 3):

1. **`/owners` on your phone.** Read the page. Yellow highlights are placeholders to replace.
2. **Fill in the owner form** with your own details. You land on "You're on the list."
3. **Check your phone and inbox** for the alert (after SETUP.md steps 4 and 5).
4. **`/admin`**, sign in. Your lead is at the top. Tap the phone number: it dials.
5. **Scroll to the setup checklist.** Press **Send me a test alert**.
6. **Try to break the form:** type a bad email or a short phone number. The messages should be in plain words,
   and what you typed should still be there.
7. **`/tradies`:** fill in the tradie form. On `/admin`, tap **Tradies** to filter.
8. **Deposit** (after SETUP.md step 6): fill in the owner form again with a different phone number, press
   **Reserve my founding spot**, pay with test card `4242 4242 4242 4242`. You should see "You're a founding
   member", get a "Deposit paid" alert, and see **Paid NZ$49** on `/admin`. Then refund it in Stripe and watch
   it change to **Refunded**.
9. **Source tracking:** open `/owners?utm_source=facebook&utm_campaign=test-campaign` and submit. The lead
   shows "Facebook / Instagram" and "test-campaign".
10. **Download spreadsheet** on `/admin`.

## How it protects you

- **A lead is never lost.** If the database is down, the alert still goes out with every detail, marked
  "NOT SAVED". Only if saving and alerting both fail is the visitor asked to try again.
- **Robots are turned away quietly:** a hidden trap field, a "too fast to be human" check, and a limit of
  six submissions per visitor every ten minutes.
- **The same person pressing the button twice is one lead and one alert.**
- **A deposit is recorded exactly once**, however many times Stripe reports it. A second payment from the
  same person is flagged to you for refund. Every money movement is written to a log that cannot be edited.
- **Messages from Stripe are checked for a genuine signature** before anything is done.
- **The leads page is private.** Wrong passwords are limited to eight tries per fifteen minutes. The
  password check is repeated on every private page and download.
- **Card numbers never touch the site.** Stripe's page takes the card.

## How it was checked

| Check | Result |
| --- | --- |
| Unit tests of the logic (leads, alerts, money, sign-in, tracking, copy) | 317 pass |
| Browser tests at phone size, clicking through the real site (forms, robots, private pages, the whole deposit journey, refunds, forged Stripe messages) | 38 pass |
| Database file run for real on Postgres 16, twice, with 49 checks on its rules and permissions | pass |
| Type checking and code linting | clean |
| Known security problems in the packages used | none |

**What has not been run against the live services.** No accounts exist yet, so these were tested
against stand-ins that behave as each provider's documentation describes:

- Supabase's web API (the database rules themselves were tested for real on Postgres).
- Stripe (tested against a stand-in Stripe, and against Stripe's own signature tools).
- ClickSend, Twilio, Resend and Meta (tested against recorded request and reply shapes).

The first real test of each is a step in SETUP.md, and the setup checklist on `/admin` reports the result.

## Not done yet, on purpose

- **Legal pages.** Placeholders only. A lawyer must write them.
- **Real copy.** The landing page words are a strong first draft with `[EDIT]` placeholders for facts
  only you know (launch date, founding member perk, example prices).
- **Real menu prices.** `seed/menu-queenstown.json` holds placeholders.
- **A confirmation email or text to the person who filled in the form.** Only you are alerted.
  Easy to add once your domain is verified in Resend.
- **Meta "instant form" lead ads.** The tracking covers ads that send people to these pages. If you want
  leads from forms filled in inside Facebook to land in the same list, say so and it can be added.
- **Google Ads conversion tracking.** The leads list already shows which leads came from Google Ads.
  Reporting conversions back to Google Ads is a small addition.
- **More than one market at a time.** The pages sell the one market set as the launch market. Adding a
  second town is a small job, and becomes a screen in Phase 4.
- **Install to home screen.** Comes with Phase 1, when there is something to sign in to.
- **Everything in Phases 1 to 5:** owner accounts, properties, jobs, the offer cascade, payouts, the dispatcher view.

## Decisions taken to get here

You said "Build it" without answering the five questions in the plan, so the defaults stated there were
used. None of them affects Phase 0. They are listed at the top of `docs/PLAN.md` and can all still be changed.
