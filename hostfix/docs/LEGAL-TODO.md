# Legal: what a lawyer needs to write

Nothing in this project is legal advice, and none of the legal wording has been written. The four
pages below exist on the site as clearly marked placeholders. A lawyer who knows New Zealand consumer
and privacy law (and later Australian law) needs to write them **before you run ads or take deposits**.

This file is a brief to hand to that lawyer: what the business does, and the questions each document
has to answer. It is a list of topics, not draft terms.

## The business in one paragraph

HostFix is a maintenance network for short-stay rental properties. Owners pay a monthly membership per
property. When something breaks, the owner, their cleaner or a guest logs a job from a fixed-price menu.
The job is offered to a local tradie. When it is done, the owner's saved card is charged the menu price,
the tradie is paid, and HostFix keeps a platform fee. Launch market: Queenstown, New Zealand. Australia is planned.

## Where each document appears

| Page | Address on the site | File |
| --- | --- | --- |
| Terms of service | `/legal/terms` | `src/app/(site)/legal/terms/page.tsx` |
| Privacy policy | `/legal/privacy` | `src/app/(site)/legal/privacy/page.tsx` |
| Tradie agreement | `/legal/tradie-agreement` | `src/app/(site)/legal/tradie-agreement/page.tsx` |
| Insurance | `/legal/insurance` | `src/app/(site)/legal/insurance/page.tsx` |

## 1. Privacy policy (needed first: the forms already collect personal details)

What the site collects today, so the policy can describe it accurately:

- **From owners:** name, mobile number, email, number of properties, who manages them, the town they live in.
- **From tradies:** name, mobile number, trade, licence number, days available.
- **From every visitor who submits a form:** which ad or website they came from, and the page they landed on.
- **Cookies:** one to remember which form a visitor filled in (7 days), one for admin sign-in, and Meta's own
  cookies if the Meta Pixel is switched on.
- **Not stored:** card numbers (Stripe holds those) and visitors' internet addresses.

Who the details are shared with: Supabase (database, hosted in Sydney), Vercel (website hosting and page
view counts), Stripe (payments), Resend (alert emails), ClickSend or Twilio (alert texts), and Meta
(a scrambled copy of the email and phone number, for ad measurement, when the Conversions API is switched on).

Questions for the lawyer: New Zealand Privacy Act 2020 notice requirements, Australian Privacy Act once
Australia launches, overseas storage of personal information, how people ask for access or deletion,
how long details are kept, and whether the Meta sharing needs specific wording or consent.

## 2. Terms of service (owners)

- What a membership includes at each tier and what it does not.
- The **response promise**: the site says that if a tradie is not on site inside the response window, that
  month's membership is credited automatically. The exact conditions, limits and exclusions need wording.
- Fixed menu prices, surcharges (urgent, after-hours), parts and materials.
- Off-menu jobs: the diagnosis fee, quotes, and the approval threshold (NZ$400).
- Who may log a job for a property (owner, cleaner, co-host, guest) and the owner's responsibility for those jobs.
- Charging the card on file when a job is completed. Disputes and refunds.
- **The founding member deposit:** refundable before launch, credited against the first month. What happens
  if HostFix does not launch, or launches late.
- Whether HostFix supplies the repair work itself or arranges it between owner and tradie. This also decides
  how GST is charged and who is responsible for the quality of the work (Consumer Guarantees Act, Fair Trading Act).
- Cancellation, minimum term, price changes.

## 3. Tradie agreement

- Independent contractor status.
- Licences: plumbing, gas and electrical work only goes to tradies with a current licence on file. The tradie's
  duty to keep licence details up to date.
- The 15-minute offer window, accepting and passing, and what happens after accepting.
- Payout timing (within 48 hours of completion), the platform fee, surcharges paid to the tradie in full.
- Proof of work (photos), workmanship standards, call-backs and who pays for them.
- Disputes that pause a payout.
- The scorecard (acceptance and on-time rates) and how first-choice status is given or removed.
- Optional monthly fee to hold the first-choice slot (planned, not yet switched on).
- Health and safety obligations when working at a property.
- Referral payments to cleaners and co-hosts (NZ$100 after a property has been a paying member for three months).

## 4. Insurance

- What cover tradies must hold (public liability at least) and how it is evidenced.
- What cover HostFix itself needs as the platform.
- What the owner's own insurance is expected to cover.
- Any wording on the site about insurance must come from your broker or lawyer.

## Other points to raise

- **Marketing claims on the landing pages.** The copy in `content/` makes promises (response times, "approved"
  tradies, the response credit). Have the lawyer read both files once the copy is final.
- **Texts to customers and tradies.** New Zealand's Unsolicited Electronic Messages Act and Australia's Spam Act
  apply to the job texts planned for Phase 2.
- **Licensing rules.** `config/trades.ts` marks which trades need a licence. Confirm the list against the
  rules of the Plumbers, Gasfitters and Drainlayers Board and the Electrical Workers Registration Board.
- **GST.** Ask your accountant how the deposit, the membership and the split between owner price, tradie
  payout and platform fee should be treated.
