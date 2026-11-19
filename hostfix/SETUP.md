# Setup checklist

Every account you need and every key you need to paste, in the order to do them.
Each step switches on one more part of the system. After each step, sign in at `/admin`
and open **More > Setup checklist**: it shows what is ready and what is still to do.

You never put a key into the code. Every key goes into one place:
**Vercel > your project > Settings > Environment Variables**. After adding or changing
keys you must **redeploy** (Deployments > the latest one > ... > Redeploy) for them to take effect.

Facts in this file were checked against each provider's own documentation on 15 November 2026.
Where a menu name could not be confirmed it says so. Two things could **not** be tested for real
from where this was built, and are flagged where they come up: the Stripe calls for memberships
and tradie payouts (see `docs/STRIPE-TEST-CHECKLIST.md`), and what ClickSend sends when a tradie
replies to a text.

**Want to try it before setting anything up?** The whole product runs in demo mode with a made-up
business, no accounts and no real money. See "Try the demo" at the bottom.

## What it costs to run

| Service | Cost | Note |
| --- | --- | --- |
| Vercel | US$20 a month | You need the Pro plan: the free plan does not allow business use, and the timer only runs every minute on Pro. |
| Supabase | Free to start, then US$25 a month | Free projects are paused after one week with no activity. Move to Pro before you take real members. |
| Stripe: cards | 2.65% + NZ$0.30 per NZ card payment | Applies to memberships and to each job. Check the pricing page in your own Stripe dashboard: it may add a small percentage for recurring billing. |
| Stripe: paying tradies | NZ$2 per tradie in any month they are paid, plus 0.25% + NZ$0.25 per payment to them | You pay this, not the tradie. On a NZ$200 payout it is about NZ$0.75. |
| Resend | Free | Up to 3,000 emails a month, 100 a day. |
| Texts | About 1 to 3 US cents each | A job sends 6 to 10 texts. Pay as you go. |
| Domain name | About NZ$25 to NZ$40 a year | |
| LINZ address lookup and aerial map | Free | Optional (step 7b). Government data, licensed CC BY 4.0. No card needed. |

On a NZ$235 job (a dripping tap) where you keep NZ$35, Stripe's card fee is about NZ$6.53, the payout fee
about NZ$0.75 and the texts about NZ$0.30. Roughly NZ$27 is left before your own time. The membership fee is where
the margin is. `docs/MARKET-RESEARCH.md` goes through the numbers.

---

## Step 0. Get the code onto the branch your site will deploy from

The code is on a working branch called `claude/hopeful-hamilton-yd41nf`.

**Easiest:** ask Claude to "open the pull request", then press **Merge** on GitHub.
After that, Vercel deploys it without any extra settings.

**Or:** leave it where it is and, in step 2, tell Vercel to deploy that branch
(Settings > Environments > Production > Branch Tracking).

---

## Step 1. Supabase: the database and the photos (10 minutes)

1. Go to supabase.com and sign up. Create a **New project**.
   - Name: `hostfix`
   - Region: **Oceania (Sydney)**. It is the closest to New Zealand and Australia. Choose carefully: it cannot be changed later.
   - **Database password:** let it generate one and **save it in your password manager**. You need it in a moment.
2. Copy the database address. Press **Connect** at the top of the project, find **Connection string**, and
   choose **Transaction pooler**. It looks like this:

   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`

   Replace `[YOUR-PASSWORD]` with the database password from the step above. This whole line is `DATABASE_URL`.
   - It must be the **Transaction pooler** one (the number near the end is `6543`). The "Direct connection" one
     does not work from Vercel. The site tells you plainly if you paste the wrong one.
   - If the password has unusual characters such as `@`, `/` or `#`, generate a new one with letters and
     numbers only (Supabase: Database > Settings > Reset database password). It saves a lot of trouble.
3. Copy two more values, for the photos:
   - The **Project URL** (also under **Connect**). This is `SUPABASE_URL`.
   - The **secret key**: **Settings > API Keys**. It starts with `sb_secret_`. This is `SUPABASE_SECRET_KEY`.
     Do not use the publishable key. The setup checklist tells you if you paste the wrong one.

You do **not** paste any SQL anywhere. The tables are made for you each time the site is deployed, and the
private photo folder is made the first time a photo is saved.

## Step 2. Vercel: put the site online (15 minutes)

1. Go to vercel.com and sign up with your GitHub account. Upgrade the team to **Pro**.
2. Press **Add New > Project** and import the `leadhivenz-website` repository.
3. Before you press Deploy, next to **Root Directory** press **Edit** and choose `hostfix`.
4. Open **Environment Variables** and add these six:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | from step 1 |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SECRET_KEY` | from step 1 |
   | `ADMIN_PASSWORD` | a long password only you know, at least 10 characters. Use your password manager. |
   | `APP_SECRET` | 40 or more random characters. Use your password manager's generator. You never need to type it again. |
   | `CRON_SECRET` | another 40 or more random characters. This lets Vercel, and only Vercel, run the timer. |

5. Press **Deploy**. The deploy first runs every automated test, then brings the database up to date, then
   builds the site. It takes about three minutes. If a test fails or the database cannot be reached, the
   deploy stops and nothing changes: that is deliberate. Vercel then gives you a web address ending in `.vercel.app`.
6. Check the timer. In the project open **Settings > Cron Jobs**. You should see `/api/cron/tick` running
   every minute. (The exact menu name could not be confirmed. It may be under the project's **Cron Jobs** tab.)
   This timer is what moves an offer on to the next tradie after 15 minutes, flags a missed promise or a no-show,
   retries cards and pays tradies. If it is not running, none of that happens.
7. In the project, open **Analytics** and press **Enable**. That switches on page view counting.
8. The file `vercel.json` already tells Vercel to run the site's server code in Sydney. To confirm, look at
   **Settings > Functions > Function Regions**. It should say Sydney (syd1). If it says Washington, change it there.

## Step 3. Check it (5 minutes)

1. Open `your-address/admin` and sign in with `ADMIN_PASSWORD`. You land on an empty **Queue**.
2. Open **More > Setup checklist**. "Database", "The timer" and "Photo storage" should say Ready.
   (The timer line can take two minutes after the first deploy.)
3. Open `your-address/owners` on your phone and fill in the form. The lead appears under **More > Leads**.

The site is now live as a waiting-list site, exactly as in Phase 0. The next steps switch on the product.

## Step 4. Resend: email (15 minutes, and you need your domain)

Email does two jobs: it alerts you, and it sends **sign-in codes to owners and staff**. Owners cannot sign
in until this step is finished, including the domain part.

1. Go to resend.com and sign up **using the email address where you want alerts to arrive**.
2. Open **API Keys**, create a key, and copy it.
3. Open **Domains**, add your domain, and add the DNS records it shows you where your domain is managed.
   It is usually verified within 15 minutes. Until this is done Resend only delivers to the address that
   owns the Resend account, so nobody else can receive a sign-in code.
4. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the key you just copied |
   | `ALERT_EMAIL_TO` | where alerts go. Several addresses can be separated with commas. |
   | `EMAIL_FROM` | `HostFix <hello@yourdomain.co.nz>`, using the domain you verified |

5. Redeploy. On **More > Setup checklist** press **Send me a test alert**. An email should arrive within a minute.

## Step 5. Texts (10 minutes, plus a wait for New Zealand numbers)

Texts are how the whole thing runs: offers to tradies, and updates to owners. **Start this step early.**

1. Go to clicksend.com, sign up and add a little credit.
2. Find your **API credentials**: a username and an API key. They are in the developer or API section
   of the dashboard (the exact menu name could not be confirmed).
3. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `CLICKSEND_USERNAME` | your ClickSend username |
   | `CLICKSEND_API_KEY` | your ClickSend API key |
   | `ALERT_SMS_TO` | your mobile, written with + and the country code: `+61412345678` or `+64211234567` |

4. Redeploy and press **Send me a test alert**.

**Two things to do with ClickSend straight away. Nothing works for Queenstown tradies until both are done:**

- Start the **New Zealand registration** (in ClickSend: Global Sending, then the New Zealand registration
  form). New Zealand phone companies only accept business texts from a registered short code, and
  ClickSend will not text a New Zealand number until this is approved. It takes **4 to 6 weeks**.
- Ask ClickSend support to **allow links in your texts**. New accounts have texts containing web links
  held back, and the link is how a tradie accepts a job.

**Using Twilio instead:** create a Twilio account, buy a number, and set `SMS_PROVIDER=twilio`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. Twilio has its own registration rules for
New Zealand. Ask their support what is needed for your number before relying on it.

**Letting tradies reply YES instead of tapping the link (optional, do it later):**
The link in the text always works, so this is an extra. It needs a number that can receive replies.

- *Twilio:* in the number's settings, set "A message comes in" to `https://YOUR-SITE/api/sms/inbound/twilio`.
  The site checks every reply really came from Twilio.
- *ClickSend:* add `SMS_INBOUND_SECRET` in Vercel (40 random characters), then create an inbound rule that
  forwards replies to `https://YOUR-SITE/api/sms/inbound/clicksend?key=THE-SAME-40-CHARACTERS`.
  **Not confirmed:** ClickSend's documentation could not be read far enough to be sure what it sends, so
  the site reads the reply tolerantly and keeps a copy of exactly what arrived. Test one real reply
  before telling tradies they can do this.
- Then, on **More > Markets, prices and the menu > your market**, tick "Tradies can accept by replying YES to the text" and save.

## Step 6. Stripe: memberships, job payments and paying tradies (45 minutes)

Do all of this in Stripe's **sandbox** first (its test area, where no real money moves), work through
`docs/STRIPE-TEST-CHECKLIST.md`, and only then repeat it with live keys.

1. Go to stripe.com and create an account for your **New Zealand** business.
2. Copy the test secret key: **Developers > API keys**. It starts with `sk_test_`. Never share the secret key.
3. Create the webhook, so Stripe can tell the site what happens to money:
   1. Open **Webhooks** (dashboard.stripe.com/webhooks) and press **Create an event destination**.
   2. Choose **Your account**.
   3. Payload format: either choice works with this site. If unsure, choose **Snapshot**.
   4. Select these **nine** events:
      - `checkout.session.completed`
      - `checkout.session.async_payment_succeeded`
      - `invoice.paid`
      - `invoice.payment_failed`
      - `customer.subscription.updated`
      - `customer.subscription.deleted`
      - `customer.updated`
      - `charge.refunded`
      - `charge.dispute.created`
      - `charge.dispute.closed` (so a lost chargeback comes to the queue for "whose fault?")
   5. Choose **Webhook endpoint** and enter the address `https://YOUR-SITE-ADDRESS/api/stripe/webhook`.
   6. On the next screen press **Reveal secret** and copy the signing secret. It starts with `whsec_`.
4. Switch on **Connect**, which is how tradies are paid into their own bank accounts. In the Stripe
   dashboard open **Connect** and follow "Get started". Stripe asks what your platform does and who is
   responsible if a payment is disputed: the site is built for **you (the platform) to collect the money
   and pay tradies afterwards**, with tradies using Stripe's own simple page to enter their bank details.
   (The exact wording of Stripe's questions could not be confirmed.)
5. Switch on the **customer portal**, which is the page owners use to change their card:
   **Settings > Billing > Customer portal**. Allow customers to **update payment methods** and **view
   invoices**. Save it. (It has to be saved once in the sandbox and once in live mode.)
6. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `STRIPE_NZ_SECRET_KEY` | the `sk_test_...` key |
   | `STRIPE_NZ_WEBHOOK_SECRET` | the `whsec_...` secret |

7. Redeploy, then work through `docs/STRIPE-TEST-CHECKLIST.md` with Stripe's test card `4242 4242 4242 4242`.
8. **Going live:** finish Stripe's business verification, leave the sandbox (account picker, top left),
   then repeat steps 2 to 6 with the live key (`sk_live_...`) and a new webhook made in live mode.

Things to know:

- Stripe's pages take the card and the tradie's bank details. The site never sees either.
- **When tradies get their money.** The site sends a tradie's payment 24 hours after the job. Stripe then
  holds card money before it can be paid out: 4 working days in New Zealand, 2 in Australia. So the money
  shows in a tradie's bank about 5 to 6 working days after a job in New Zealand. The site tells tradies
  exactly that. `docs/PLAN.md` (section 9, item A) explains how to get it down to 2 or 3 days once you
  have income sitting in Stripe.
- **Refund from the job page in the team area, not in Stripe.** The job page refunds the owner and brings
  the tradie's payment down to match in one step. A refund made by hand in Stripe is noticed and put in
  the queue; if the tradie has not been paid yet their payment is brought down by their share of it, as on
  the job page, and if they have, it is left for you to sort out.
- **Keep a float of NZ$500 to NZ$1,000 in Stripe.** A tradie is paid whatever the owner's card does. When the
  card has paid, the tradie's payment comes out of that charge, even while the card money is still on its
  way. When it has not, it comes out of HostFix's own **available** Stripe balance, and in New Zealand card
  money takes about 4 working days to become available, so a new account often has nothing there. Then the
  payment waits, the site tries again every minute, and "Top up the Stripe balance" appears in the queue.
  To keep a float: **Settings > Payouts > Minimum balance**, switch it on and set NZ$500 to NZ$1,000 (Stripe
  keeps that much back from its payouts to your bank). Stripe's "add funds" (top-ups from your bank) is not
  open to every New Zealand account yet; use it if your dashboard offers it.
- **A tradie's bank details page.** The site tells Stripe what the tradie does (for example "Plumbing
  maintenance and repairs for holiday homes, booked through HostFix"), their trade's category, and that they
  are a sole trader, so Stripe's page does not ask for a business website. The tradie confirms these on
  Stripe's page. Whether a tradie who trades through a company can change "sole trader" on that page is not
  confirmed yet: it is a step in `docs/STRIPE-TEST-CHECKLIST.md`.
- One Stripe account per country. Australia needs its own account and its own pair of keys
  (`STRIPE_AU_SECRET_KEY`, `STRIPE_AU_WEBHOOK_SECRET`), because Stripe cannot pay Australian tradies
  from a New Zealand account.
- **Ask your accountant before the first real job:** who is the seller for GST (you or the tradie), and
  what a tax invoice has to show. Until you tick "The business is registered for GST" on the market's
  settings, statements show no GST at all. See `docs/LEGAL-TODO.md`.

## Step 7. Meta: ad tracking (15 minutes)

1. In Meta **Events Manager** (business.facebook.com/events_manager), create or open your Pixel. Copy the **Pixel ID** (a number).
2. In the Pixel's **Settings**, find **Conversions API** and under "Set up manually" press **Generate access token**. Copy it.
3. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_META_PIXEL_ID` | the Pixel ID |
   | `META_CAPI_ACCESS_TOKEN` | the access token |

4. Redeploy. (The Pixel ID is built into the pages, so this one always needs a redeploy.)
5. To check it: in Events Manager open **Test Events**, copy the test code, add it in Vercel as
   `META_TEST_EVENT_CODE`, redeploy, and submit a form. You should see the events arrive.
   **Remove `META_TEST_EVENT_CODE` when you finish.**

What Meta is told, so you can build campaigns around it:

| Event | When |
| --- | --- |
| `PageView` | every public page |
| `Lead` | an owner submits the waiting-list form |
| `SubmitApplication` | a tradie submits the form |
| `Purchase` | a founding deposit is paid (with its value) |

Owners and tradies fire different events on purpose, so a campaign for owners is optimised for owners only.
Each event is sent twice, from the browser and from the server, and Meta counts it once. Email and phone are
only ever sent to Meta in scrambled (hashed) form. Nothing inside the signed-in app is tracked.

To tag your ad links so the leads list shows the source and campaign, add this to the end of the link:
`?utm_source=facebook&utm_medium=paid&utm_campaign=YOUR-CAMPAIGN-NAME&utm_content=YOUR-AD-NAME`

## Step 7b. Maps: each property's pin (15 minutes, optional, free)

Every property has a pin on a small map. When a tradie taps Arrived and Job done, the app checks they are within
300 m of it (DECISIONS.md, 2026-11-19). Without these two keys the pin still works: owners place it by tapping the
map, or with "I'm at the property now", on OpenStreetMap's street map. With them, the pin starts on the house by
itself and owners see aerial photos. Both are free, from Toitū Te Whenua Land Information New Zealand (LINZ).
Nothing here costs money, and nothing needs a card.

- [ ] **Address lookup.** Go to data.linz.govt.nz, make a free account, open your account menu, then API keys,
  and create a key (tick the box for access to the data services, "WFS"; the exact wording may differ). Add it as
  `LINZ_DATA_KEY`. The app uses LINZ's "NZ Addresses" list. Not confirmed from here: the menu names in the LINZ
  site, because this could not be tried with a real account.
- [ ] **Aerial photos.** Email LINZ Basemaps (the address is on basemaps.linz.govt.nz, under Help or Contact) and
  ask for a free "developer" API key for a public website, giving the site's address. It never expires. The key
  the Basemaps website shows you straight away also works, but runs out after 90 days. Add it as
  `LINZ_BASEMAPS_KEY`. The key is visible in owners' browsers: that is how LINZ map keys work.
- [ ] Redeploy, then check the setup checklist says **Address lookup** and **Map pictures** are ready.
- [ ] Existing properties: each owner is asked to check their pin on the Properties page. The timer looks up
  addresses that have never been looked up, ten a minute.

## Step 7b. App notifications (5 minutes, free, optional)

With these set, tradies and owners see "Turn on notifications" in the app. A tradie with notifications on gets each job
offer as a notification first; the text follows 3 minutes later only if they have not opened it (the minutes are a
market setting). An owner with notifications on gets their job updates as notifications instead of texts. On an iPhone,
notifications only work once HostFix is added to the home screen; the app explains that. Nothing here costs money.

- [ ] On your computer, in the project folder, run `npx web-push generate-vapid-keys`. It prints a public key and a
  private key. Add them as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, and add `VAPID_SUBJECT` as `mailto:` followed by
  your email address (for example `mailto:hello@hostfix.co.nz`). Never change the pair once people have turned
  notifications on: they would have to turn them on again.
- [ ] Redeploy, then check the setup checklist says **App notifications** is ready.

## Step 8. Your own domain (10 minutes)

1. Buy the domain anywhere.
2. In Vercel: **Settings > Domains**, add it, and add the DNS records Vercel shows you. The security
   certificate is automatic.
3. In Stripe, edit the webhook so its address uses the new domain. If you set up text replies, change
   those addresses too.
4. Redeploy. The links in texts and on QR cards use the new domain from then on. **QR cards printed before
   the change keep working only while the old address does**, so settle the domain before any are printed.

## Step 9. Opening a market for business

Everything below is done on the site, signed in as admin. No code.

- [ ] **Prices.** More > Markets, prices and the menu > Queenstown. Every price on the menu is a
      placeholder. Set the real owner price and tradie payout for each job, and check the two memberships.
      Settle the membership prices before the first owner joins: once a property is a member on a
      membership, that membership's price is fixed (`RUNBOOK.md` explains how to change it later).
- [ ] **Tradies.** Tradies > Add a tradie (or More > Leads > "Make a tradie" for one who filled in the
      form). Enter and check each licence against the public register, approve them, and they are texted a
      link to sign in and add their bank details. A tradie is only offered jobs once that is done.
- [ ] **First choice and backup.** On the Tradies page, choose who gets first pick of each trade. Any
      trade showing "0 ready" would send its jobs straight to the queue.
- [ ] **Your dispatcher.** More > Staff > Add someone. They sign in with their own email. Give them `RUNBOOK.md`.
- [ ] **Go live.** More > Markets, prices and the menu > Queenstown. Set **Stage** to "Live" and save.
      The public pages change from collecting interest to letting owners join straight away. The "Ready
      to go live?" list at the top of that page tells you what is missing.
- [ ] **Invite the waiting list.** More > Leads > "Invite to join" beside each owner.

## Step 10. Before you spend money on ads

For the demand test you need less than all of this: `docs/DEMAND-TEST.md` lists exactly which steps, and
how to run the 14 days.

- [ ] Replace every `[EDIT: ...]` placeholder. The setup checklist counts them for you.
- [ ] Put your contact email and company name in `config/brand.ts`.
- [ ] Have a lawyer write the four legal pages and answer the questions in `docs/LEGAL-TODO.md`.
- [ ] Move Supabase to the Pro plan so the database cannot be paused.
- [ ] Switch Stripe to live keys and run one real job end to end with a friendly owner and tradie.
- [ ] Check the timer line on the setup checklist says Ready.

## Adding another market later

More > Markets, prices and the menu > "Add a market". It copies the memberships and menu from a market you choose, as a
starting point, and starts hidden. Check every price (they are copied as numbers, so NZ$180 becomes
A$180), add tradies, then change its stage. A market in another country also needs that country's Stripe
keys (step 6) and, for texts, whatever registration that country requires.

## Every setting in one place

| Name | Needed for | Where it comes from |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Signing in at `/admin` as the owner of the business | You choose it |
| `APP_SECRET` | Sign-in, and the one-tap links in texts | 40+ random characters |
| `DATABASE_URL` | Everything that is saved | Supabase > Connect > Transaction pooler |
| `DATABASE_CA_CERT` | Optional. Checks the database's identity as well as encrypting | Supabase > Database > Settings > SSL Configuration |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Photos | Supabase > Connect, and Settings > API Keys |
| `SUPABASE_BUCKET` | Optional. The photo folder's name (default `hostfix`) | You choose it |
| `CRON_SECRET` | The once-a-minute timer | 40+ random characters |
| `ALERT_EMAIL_TO` | Email alerts to you | Your email address |
| `RESEND_API_KEY` | All email, including sign-in codes | Resend > API Keys |
| `EMAIL_FROM` | Sending to anyone but yourself | After verifying a domain in Resend |
| `ALERT_SMS_TO` | Text alerts to you | Your mobile, as +61... or +64... |
| `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY` | All texts | ClickSend API credentials |
| `SMS_FROM` | Optional. The sender name or number on texts | ClickSend |
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Optional. Texts through Twilio instead | Twilio console |
| `SMS_INBOUND_SECRET` | Optional. Tradies replying YES through ClickSend | 40+ random characters |
| `STRIPE_NZ_SECRET_KEY` | Memberships, job payments, paying tradies, deposits | Stripe > Developers > API keys |
| `STRIPE_NZ_WEBHOOK_SECRET` | Stripe telling the site what happened | Stripe > Webhooks > your endpoint > Reveal secret |
| `STRIPE_AU_SECRET_KEY`, `STRIPE_AU_WEBHOOK_SECRET` | The same, for Australian markets | A separate Australian Stripe account |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel | Meta Events Manager |
| `META_CAPI_ACCESS_TOKEN` | Meta Conversions API | Meta Events Manager > Settings > Conversions API |
| `META_TEST_EVENT_CODE` | Optional. Only while testing | Meta Events Manager > Test Events |
| `LINZ_DATA_KEY` | Optional. Finding each property's map pin from its address | data.linz.govt.nz > your account > API keys (free) |
| `LINZ_BASEMAPS_KEY` | Optional. Aerial photos under the pin map | A developer key from LINZ Basemaps (free) |
| `MAP_TILES` | Optional. `off` shows no map pictures (used by the browser tests) | You choose it |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Optional. App notifications (offers first by notification, fewer texts) | Run `npx web-push generate-vapid-keys` once (free) |
| `VAPID_SUBJECT` | With the two above: who the push services can contact | `mailto:` and your email address |

## Try the demo

The demo is the real product with a made-up business in it: three owners, five tradies and nine jobs at
different points. No accounts, no real texts, no real money. It is the quickest way to see every screen,
and it is safe to press every button.

On a computer with Node.js 22 or newer:

```bash
cd hostfix
```

```bash
npm install
```

```bash
npm run demo
```

Then open `http://localhost:3000/demo`. The demo menu lets you be an owner, a tradie, the dispatcher or
the admin, open anyone's pretend phone to read their texts, and skip the clock ahead to watch an offer
move on or a tradie get paid. To start again from the beginning, stop it, delete the `.data` folder and
run it again. `docs/TRY-IT.md` has a walk-through.

Demo mode can never switch on once the site is on Vercel.
