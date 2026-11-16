# Stripe test checklist

**Why this exists.** Everything in HostFix that moves money is covered by automated tests, but those
tests run against a stand-in for Stripe. The real Stripe calls for memberships, job payments and paying
tradies could not be run from where this was built, because that needs your Stripe account. This list
runs each of them once, in Stripe's test area, where no real money moves.

**Do it before taking a real payment.** It takes about 90 minutes. If a step does not do what it says,
stop, note the step number and what you saw, and bring it back to Claude. Do not go live with a step
failing.

## Before you start

- [ ] `SETUP.md` steps 1 to 6 are done with Stripe's **test** key (`sk_test_...`), the webhook has all nine
      events, and Connect and the customer portal are switched on in the sandbox.
- [ ] Texts work to your own mobile (`SETUP.md` step 5). You will be the test tradie.
- [ ] On the site: More > Setup checklist > "Card payments" says **Connected in TEST mode**.
- [ ] More > Markets, prices and the menu > Queenstown: set **Stage** to "Live" and save.
      *If the real site is already collecting leads, do this on a preview copy instead. Ask Claude.*
- [ ] Have two email addresses ready: one for a pretend owner, one for a pretend tradie.

Stripe's test cards, from its documentation (read 15 November 2026). Any future expiry date and any
three-digit code work with them.

| Card number | What it does |
| --- | --- |
| `4242 4242 4242 4242` | Always succeeds |
| `4000 0000 0000 9995` | Always declined |
| `4000 0000 0000 0341` | Can be saved to a customer, but every charge afterwards is declined |

## A. Memberships

**A1. A new owner joins.**
- [ ] Open `/sign-up`, create an owner, add a property, choose Essential, press **Continue to payment**.
- [ ] You land on Stripe's own card page. Pay with `4242 4242 4242 4242`.
- [ ] *Should happen:* you come back to the site and it says **You are covered**. Billing shows the first
      month. In Stripe, **Customers** shows the owner with one active subscription.
- [ ] Open Stripe > Webhooks > your endpoint. Every delivery shows a green tick.

**A2. A second property uses the saved card.**
- [ ] Add another property and press **Start membership**.
- [ ] *Should happen:* no card page. It is covered straight away, and Stripe shows a second subscription.

**A3. A monthly renewal.**
- [ ] In Stripe, open one of the subscriptions, choose to update it, and reset its billing date to today.
      Stripe then charges a new month at once. (The exact name of this option could not be confirmed.)
- [ ] *Should happen:* within a minute the owner's Billing page shows a second payment for that property.

**A4. A renewal that fails.**
- [ ] On the site, as the owner: Billing > **Change card**. On Stripe's page add `4000 0000 0000 0341` and
      make it the default card. Come back.
- [ ] Reset the subscription's billing date again, as in A3.
- [ ] *Should happen:* the property shows a card problem, and the owner is texted. Now change the card
      back to `4242 4242 4242 4242` for the steps below.

**A5. Changing plan and cancelling.**
- [ ] There is one membership, so to test a change of plan first add a second one on the Markets page (for
      example "Test plan" at NZ$1). On the property page: **Change plan** to it. *Should happen:* Stripe
      shows the new price on the subscription, with no part-month charge. Change back, then close the test
      plan to new members.
- [ ] **Cancel membership**. *Should happen:* the site says when it ends, and Stripe shows the
      subscription set to cancel on that date, not cancelled today.

**A6. The founding deposit comes off the first month.**
- [ ] With the market set back to "Waiting list", fill in the owner form with a new email and pay the
      deposit on the thank-you page. Set the market to "Live" again.
- [ ] Join at `/sign-up` with that same email. *Should happen:* the first month's charge is reduced by the deposit.

## B. A job, start to finish

**B1. A tradie sets up their bank details.**
- [ ] As admin: Tradies > **Add a tradie** with your own mobile, handyman work only. Press **Approve**.
- [ ] Open the link in the text. Profile > **Add bank details**. You land on Stripe's page.
- [ ] Enter Stripe's test details. Its page "Testing Stripe Connect" (docs.stripe.com/connect/testing)
      lists the pretend date of birth, address and bank account to use.
- [ ] *Should happen:* back on the site it says **Bank details set up. You can be paid.** In Stripe,
      **Connect > Accounts** shows the tradie. On the site, the tradie's page says **Getting offers**.
- [ ] On the Tradies page, make yourself first choice for Handyman.

**B2. The job.**
- [ ] As the owner: report a problem, choose a handyman job, press **Send a tradie**.
- [ ] *Should happen:* your mobile gets the offer. Tap the link, **Accept job**, **I have arrived**, add a
      photo, **Job done**.
- [ ] *Should happen:* Stripe > Payments shows the owner charged the menu price. The staff job page says
      the card was charged, and the tradie's payment says "Will be sent on" a date 24 hours away.

**B3. The tradie is paid.**
- [ ] To avoid waiting a day: More > Markets, prices and the menu > Queenstown, set "Hours a tradie's
      payment is held after a job" to 0 and save. Do another job as in B2. **Put it back to 24 afterwards.**
- [ ] *Should happen:* within two minutes of **Job done**, the staff job page says the tradie's payment
      was sent, the tradie gets a text, and Stripe > Connect > the tradie's account shows the amount.
- [ ] **If the queue shows "Could not pay the tradie" instead, copy the message exactly and stop.** This
      is the single most important step on the list.

**B4. A card that declines on a job.**
- [ ] Change the owner's card to `4000 0000 0000 0341` (as in A4). Do a job as in B2.
- [ ] *Should happen:* the queue shows **Card payment failed**. The tradie's payment says it is waiting
      for the owner's card. Nothing is sent to the tradie.
- [ ] Change the card back to `4242 4242 4242 4242`. On the staff job page press **Try the card again now**.
- [ ] *Should happen:* charged, the queue item closes by itself, and the tradie's payment is on its way.

**B5. The owner says something is wrong, before the tradie is paid.**
- [ ] With the hold back at 24 hours, do a job. As the owner, open it and use **Something not right with
      this job?**
- [ ] *Should happen:* the queue shows **Owner raised a problem** and the tradie's payment is on hold.
- [ ] On the staff job page choose **Refund the owner**, enter half the amount, write a note, **Settle it**.
- [ ] *Should happen:* Stripe > Payments shows a part refund. The tradie's payment is now about half and
      is released.

**B6. A refund after the tradie has been paid.**
- [ ] Take a job where the tradie's payment has already been sent (from B3). As the owner raise a problem,
      and as staff refund it in full.
- [ ] *Should happen:* Stripe shows the refund to the owner, and the tradie's account in Stripe shows the
      money taken back. The staff job page says "Taken back after a refund".

**B7. A credit.**
- [ ] On the staff job page: **Give the owner a credit**, NZ$20.
- [ ] *Should happen:* in Stripe, the customer shows a credit balance of NZ$20. Reset the subscription's
      billing date (as in A3): the next month is charged NZ$20 less.

**B8. A refund made in Stripe by mistake.**
- [ ] In Stripe > Payments, refund NZ$10 of a job payment by hand.
- [ ] *Should happen:* the queue shows **Needs a look**, saying the refund was made outside the app.

**B9. A bank dispute.**
- [ ] Stripe's testing page (docs.stripe.com/testing) lists a card under "Disputes" that is charged and
      then disputed. Make it the owner's card and do a job.
- [ ] *Should happen:* the queue shows **Bank dispute (chargeback)**.

## C. Going live

- [ ] Every box above is ticked.
- [ ] Repeat `SETUP.md` step 6 with the live key, a new webhook made in live mode, and Connect and the
      customer portal switched on in live mode.
- [ ] Do **one real job** with a friendly owner and a friendly tradie, with real money, before any ads.
- [ ] **Time that first real payout.** Note the day the job was finished and the day the money showed in
      the tradie's bank. The site tells tradies "about 5 to 6 working days" in New Zealand, which is taken
      from Stripe's documentation, not from a real payout. If yours is different, tell Claude so the
      wording can be corrected (it lives in `config/markets.ts`).

## What these steps do not cover

- **The automatic credit for a missed promise.** It uses the same credit as B7, and the rule itself is
  covered by the automated tests.
- **Australia.** It needs its own Stripe account and its own run through this list.
- **A tradie's first payout taking longer.** Stripe can hold a brand-new account's first payout for
  extra days. The first real job will show it.
