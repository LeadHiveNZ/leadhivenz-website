# Legal: what a lawyer needs to write

Nothing in this project is legal advice. On 17 November 2026 the four pages below were written in plain
English from what the software actually does, under the free-to-join model (`DECISIONS.md`). They are
live on the site. The plan: a free Community Law review before the first job, and a paid review by a
lawyer who knows New Zealand consumer and privacy law at around 100 properties (Australian law before the
first Australian market).

This file is the brief for whoever reviews them: what the business does, what the software actually does
today, and the questions each document has to answer. Where a page and this file disagree, the page is
what customers agreed to: fix the page, then this file.

Since this brief was first written, the business changed: **owners pay nothing to join and there is no
monthly membership** (the 15% fee is inside each fixed job price); the missed-promise credit is the
call-out portion of the job, not a month's membership; the founding deposit is no longer offered and paid
ones are refunded; and every tradie must have public liability insurance on file. Read the membership and
deposit paragraphs below with that in mind.

## The business in one paragraph

HostFix is a maintenance network for short-stay rental properties. Owners pay a monthly membership per
property. When something breaks, the owner, their cleaner or a guest logs a job from a fixed-price menu.
The job is offered to a local tradie. When it is done, the owner's saved card is charged the menu price,
the tradie is paid, and HostFix keeps the difference. Launch market: Queenstown, New Zealand. Australia is planned.

## Where each document appears

| Page | Address on the site | File |
| --- | --- | --- |
| Terms of service | `/legal/terms` | `src/app/(site)/legal/terms/page.tsx` |
| Privacy policy | `/legal/privacy` | `src/app/(site)/legal/privacy/page.tsx` |
| Tradie agreement | `/legal/tradie-agreement` | `src/app/(site)/legal/tradie-agreement/page.tsx` |
| Insurance | `/legal/insurance` | `src/app/(site)/legal/insurance/page.tsx` |

## The two questions that shape everything else

Ask these first. The answers change the other documents, the statements and the tax.

1. **Is HostFix the supplier of the repair, or does it arrange the work between owner and tradie?**
   The software works either way. Today the owner pays HostFix one fixed price, HostFix pays the tradie a
   fixed amount, and HostFix chooses who is offered the job. That looks like supply. It decides who answers
   for the quality of the work (Consumer Guarantees Act, Fair Trading Act), who the seller is for GST, and
   in Australia whether HostFix itself needs a contractor's licence (see "Australia" below).
2. **Are the tradies independent contractors?** HostFix sets the price, picks who gets first offer, scores
   them on acceptance and punctuality, and can pause or remove them. They choose which jobs to take, use
   their own tools, and work for others.

## 1. Privacy policy

What the software holds today, so the policy can describe it accurately:

- **Owners:** name, mobile, email, the town they live in, each property's address, and the access notes
  they write for tradies (lockbox codes, alarm codes, where the water shuts off). Photos of the property.
- **Cleaners, co-hosts and guests who report a problem:** their name and mobile number if they give them,
  what they wrote, and their photos. They have no account. A guest reaches the form from a QR card in the property.
- **Tradies:** name, business name, mobile, email, the work they do, licence numbers and their end dates,
  the date their insurance runs out, their tax number, the days they work, and notes written about them by
  staff that the tradie cannot see. Their reliability record (offers accepted, arrivals on time).
- **Where a tradie was when they tapped "I have arrived"**, if their phone allowed it. Asked once, at that moment only.
- **Photos of finished work**, kept with the job.
- **Every text and email the system sends**, with its wording. Sign-in codes and one-tap links are blanked
  out once sent.
- **A permanent record of every job change and every money movement**, with who did it. By design nothing
  in it can be edited or deleted. *This needs squaring with a person's right to have their details removed.*
- **From visitors who fill in a public form:** which ad or website they came from, and the page they landed on.
- **Cookies:** one for being signed in, one for the admin password, one remembering which public form a
  visitor filled in (7 days), and Meta's own cookies on the public pages if the Meta Pixel is switched on.
  Nothing inside the signed-in app is tracked for advertising.
- **Not held:** card numbers, and tradies' bank details and identity documents (Stripe holds those). A
  visitor's internet address is used in scrambled form for a few minutes to stop robots flooding the
  forms, and is not kept.

Who sees what, as enforced by the software:

- A tradie sees a property's address and access notes **only after accepting** a job there, and the
  property's photos only while that job is open. Before accepting they see the suburb.
- After accepting, the tradie can see the owner's mobile number, and the owner can see the tradie's
  business name and mobile. A guest's name and number are shown to the owner, the tradie and staff.
- Staff (the dispatcher and the admin) can see everything, including lockbox codes.

Who the details are shared with: Supabase (database and photos, hosted in Sydney), Vercel (website
hosting), Stripe (payments, and identity checks on tradies), Resend (email), ClickSend or Twilio (texts),
and Meta (a scrambled copy of the email and phone number from the public forms, for ad measurement, when
the Conversions API is switched on).

Questions for the lawyer:

- New Zealand Privacy Act 2020 notices. In particular the rule in force since May 2026 about details that
  come from someone else: an owner gives HostFix nothing about their cleaner, but **a guest's details reach
  the owner and the tradie, and the owner's number reaches the tradie.**
- Guests are members of the public, often from overseas, with no relationship with HostFix. What must the
  report form tell them before they press send?
- Holding lockbox and alarm codes: what standard of care, and what to do if they are exposed.
- Recording a tradie's location at arrival: is the single request enough, and what must they be told?
- How long each kind of record is kept, how someone asks for access or deletion, and what can lawfully be
  refused because it is a financial record. **Deleting an owner or tradie today needs a developer.**
- Storage in Australia and the United States (overseas disclosure).
- The Australian Privacy Act, before the first Australian market.

## 2. Terms of service (owners)

What the software does, which the terms need to match:

- **Membership** is per property, per month, charged to a card by Stripe. Cancelling takes effect at the
  end of the month already paid for. A failed monthly payment marks the property as having a card problem.
- **The response promise.** The clock starts when the job is sent out to tradies and runs through nights
  and weekends. "On site" is the tradie's own tap of "I have arrived". If nobody is on site in time, the
  month's membership for that property is credited automatically, **at most once per property per calendar
  month**, as a credit against the next payment, not as cash. *The exact conditions, limits and exclusions
  (no access, owner cancels, off-menu work, a guest report still waiting for the owner) need wording.*
- **Fixed menu prices**, the urgent and after-hours surcharges, small parts included in the price, and
  parts above a set amount needing the owner's yes.
- **Off-menu jobs:** a fixed call-out fee, then a quote. A quote above NZ$600, or above the owner's own
  limit for that property, needs the owner's yes before work starts. If they say no, the call-out is still charged.
- **Who may commit the owner to a charge.** Anyone holding the property's team link (meant for cleaners
  and co-hosts) can send a tradie at the owner's expense with no further check. A guest's report waits for
  the owner's yes unless the owner has switched that off. Staff can log a job for an owner who phones.
- **"I could not get in":** the tradie is paid the call-out and the owner is charged it.
- **Charging the card when the job is done, with no approval step.** A declined card is tried four
  times in all, a day apart, and then a person follows it up.
- **Raising a problem.** The owner can do so from the job page. Inside the first day it holds the tradie's
  payment. HostFix staff decide the outcome: the work stands, or a full or part refund.
- **Price changes.** The software keeps a member on the price they joined at. Moving existing members to a
  new price is not built. The terms should say how and with what notice it can be done.
- **The founding offer**, as shown on the owner page, the card page and the price list email: 25 founding
  properties, a NZ$99 deposit that comes off the first bills and is refundable any time before the first
  job, and half price for the first three months (NZ$49.50 a month, then NZ$99). What happens if HostFix
  does not launch, or launches late. **Billing does not give the half price yet**: see the go-live
  checklist and `DECISIONS.md`.
- **After-hours** is before 7am, from 4:30pm, and all weekend, in Queenstown time. Public holidays are not
  treated differently yet.
- Cancellation, minimum term (none today), and the wording of the automatic-renewal notice.

## 3. Tradie agreement

- Independent contractor status (see the second question at the top).
- **Licences.** Plumbing, gas and electrical work is only offered to a tradie whose licence number and end
  date are on file and in date. Staff check each one against the public register by hand and record that
  they did. The tradie's duty to tell HostFix of any change.
- The offer: 15 minutes for the first choice, then the backup, then everyone. Accepting, passing, and what
  accepting commits them to.
- **Pay.** The amount is fixed and shown in the offer. Surcharges and approved parts go to the tradie in
  full. **Timing, as built:** the payment is sent 24 hours after the job (up to 48, set per market) once the
  owner's card has been charged, and reaches the tradie's bank about 5 to 6 working days after the job in
  New Zealand. **If the owner's card fails, the tradie is not paid until it succeeds.** Is that acceptable,
  or must HostFix carry that risk?
- **A problem raised by the owner** puts the payment on hold, and a refund reduces it in proportion. If
  the tradie has already been paid, the software takes the amount back from their Stripe balance. The
  agreement needs to permit that.
- Proof of work (a photo is required to finish any job), workmanship standards, and coming back to put
  things right at no charge.
- The scorecard (acceptance and on-time rates over 30 days, 80% target) and how first-choice status is
  given, swapped, paused or removed.
- Confidentiality of access codes and owners' details, and not taking HostFix owners' work directly.
- Health and safety at a property, and working alone in empty homes.
- An optional monthly fee to hold the first-choice slot (planned, stored, switched off).

## 4. Referral terms (cleaners and co-hosts)

A separate short document. A cleaner or co-host who sends an owner earns a one-off reward (NZ$100) once
that property has paid for three months. It is paid by bank transfer by hand. Needs: who qualifies, when
it is void, tax on the reward, and what the referrer may and may not say about HostFix.

## 5. Insurance

- What cover tradies must hold (public liability at least), how it is evidenced, and who checks it. The
  software stores the date it runs out. Nothing checks or reminds yet.
- What cover HostFix itself needs, which depends on the first question at the top.
- What the owner's own insurance is expected to cover.
- Any wording on the site about insurance must come from your broker or lawyer.

## 6. For your accountant

- **GST.** Who is the seller of the repair: HostFix or the tradie? Until the market is marked as
  registered, statements show no GST at all. Once it is, the owner's statement shows GST inside the total
  they paid. Tradies who are not registered are paid the same amount.
- What a tax invoice must show, and whether the on-screen monthly statement is enough or a PDF is needed.
- How the deposit, the membership, credits, refunds and the referral reward are treated.
- Whether HostFix should issue buyer-created tax invoices to tradies.

## Australia, before the first Australian market

- In Queensland and New South Wales, licensing can apply to whoever contracts for or advertises building,
  plumbing or electrical work. **Whether HostFix needs its own contractor's licence there depends on the
  first question at the top.** Get this answered before any Australian menu is published.
- A separate Australian company and Stripe account are needed to pay Australian tradies.
- Australian Consumer Law, the Spam Act, and the sender-name register for texts.

## Other points to raise

- **Marketing claims.** The copy in `content/` and on the public pages makes promises: the response time,
  the automatic credit, fixed prices, and when tradies are paid. Have the lawyer read both pages once the
  copy is final.
- **Texts.** Every text names HostFix. Job texts do not say "reply STOP", because New Zealand numbers
  cannot receive replies until a short code is registered. A tradie can stop offers at any time with the
  Pause switch in their profile, and where replies do work, STOP pauses them. Does that meet the
  unsubscribe rule in the Unsolicited Electronic Messages Act and the Spam Act?
- **Licensing rules.** `config/trades.ts` marks which trades need a licence, and each menu job can be
  marked too. The research read the regulators' guidance pages, not the Acts (`docs/MARKET-RESEARCH.md`).
  Confirm the line between handyman work and licensed work, job by job, on the real menu.
- **Chargebacks.** When an owner's bank reverses a payment, the tradie's payment is put on hold if it has
  not gone. Who bears the loss if it has?
