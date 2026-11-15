# Setup checklist

Every account you need and every key you need to paste, in the order to do them.
Each step switches on one more part of the system. After each step, open `/admin` on your
site: the **Setup checklist** at the bottom shows what is ready and what is still to do.

You never put a key into the code. Every key goes into one place:
**Vercel > your project > Settings > Environment Variables**. After adding or changing
keys you must **redeploy** (Deployments > the latest one > ... > Redeploy) for them to take effect.

Facts in this file were checked against each provider's own documentation on 15 November 2026.
Where a menu name could not be confirmed it says so.

## What it costs to run Phase 0

| Service | Cost | Note |
| --- | --- | --- |
| Vercel | US$20 a month | The free plan does not allow business use, and cannot deploy from an organisation's private repository. You need Pro. |
| Supabase | Free to start, then US$25 a month | Free projects are paused after one week with no activity. Move to Pro before you spend money on ads. |
| Stripe | No monthly fee | 2.65% + NZ$0.30 per New Zealand card payment. About NZ$1.60 on a NZ$49 deposit. |
| Resend | Free | Up to 3,000 emails a month, 100 a day. |
| ClickSend | About 1 to 3 US cents per text | Pay as you go. |
| Domain name | About NZ$25 to NZ$40 a year | |

---

## Step 0. Get the code onto the branch your site will deploy from

The code is on a working branch called `claude/hopeful-hamilton-yd41nf`.

**Easiest:** ask Claude to "open the pull request", then press **Merge** on GitHub.
After that, Vercel deploys it without any extra settings.

**Or:** leave it where it is and, in step 2, tell Vercel to deploy that branch
(Settings > Environments > Production > Branch Tracking).

---

## Step 1. Supabase: the database (10 minutes)

1. Go to supabase.com and sign up. Create a **New project**.
   - Name: `hostfix`
   - Region: **Oceania (Sydney)**. It is the closest to New Zealand and Australia. Choose carefully: pick it at the start.
   - Let it generate a database password and save that in your password manager. The site does not need it.
2. Create the tables. In the left menu open **SQL Editor**, press **New query**, and paste in the
   whole of the file `supabase/migrations/20261115000000_phase0_leads.sql` (open it on GitHub and use the
   "copy raw file" button). Press **Run**. You should see "Success. No rows returned".
   If Supabase asks you to confirm because the query "has destructive operations", that is expected. Confirm it.
   Running the file twice does no harm.
3. Copy two values:
   - The **Project URL** (press **Connect** at the top of the project). This is `SUPABASE_URL`.
   - The **secret key**: **Settings > API Keys**. It starts with `sb_secret_`. This is `SUPABASE_SECRET_KEY`.
     Do not use the publishable key. The setup checklist will tell you if you paste the wrong one.

## Step 2. Vercel: put the site online (15 minutes)

1. Go to vercel.com and sign up with your GitHub account. Upgrade the team to **Pro**.
2. Press **Add New > Project** and import the `leadhivenz-website` repository.
3. Before you press Deploy, next to **Root Directory** press **Edit** and choose `hostfix`.
4. Open **Environment Variables** and add these four:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SECRET_KEY` | from step 1 |
   | `ADMIN_PASSWORD` | a long password only you know, at least 10 characters. Use your password manager. |
   | `APP_SECRET` | 40 or more random characters. Use your password manager's generator. You never need to type it again. |

5. Press **Deploy**. In a couple of minutes Vercel gives you a web address ending in `.vercel.app`.
6. In the project, open **Analytics** and press **Enable**. That switches on page view counting.
7. The file `vercel.json` already tells Vercel to run the site's server code in Sydney. To confirm, look at
   **Settings > Functions > Function Regions**. It should say Sydney (syd1). If it says Washington, change it there.

## Step 3. Try it (5 minutes)

1. Open `your-address/owners` on your phone. Fill in the form with your own details.
2. Open `your-address/admin`, sign in with `ADMIN_PASSWORD`. Your lead should be at the top of the list.
3. Scroll to **Setup checklist**. "Database" should say Ready.

You now have a working lead capture site. The next steps add alerts, payments and tracking.

## Step 4. Resend: email alerts (5 minutes)

1. Go to resend.com and sign up **using the email address where you want lead alerts to arrive**.
   Until you verify your own domain, Resend only delivers to the address that owns the account.
2. Open **API Keys**, create a key, and copy it.
3. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the key you just copied |
   | `ALERT_EMAIL_TO` | the same email address you signed up with |

4. Redeploy. On `/admin` press **Send me a test alert**. An email should arrive within a minute.

Later, to send from your own address or to more people: in Resend open **Domains**, add your domain,
add the DNS records it shows you (usually verified within 15 minutes), then set `EMAIL_FROM` to
something like `HostFix <alerts@yourdomain.co.nz>`.

## Step 5. ClickSend: text alerts (10 minutes, plus a wait for New Zealand numbers)

1. Go to clicksend.com, sign up and add a little credit.
2. Find your **API credentials**: a username and an API key. They are in the developer or API section
   of the dashboard (the exact menu name could not be confirmed).
3. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `CLICKSEND_USERNAME` | your ClickSend username |
   | `CLICKSEND_API_KEY` | your ClickSend API key |
   | `ALERT_SMS_TO` | your mobile, written with + and the country code: `+61412345678` or `+64211234567` |

4. Redeploy and press **Send me a test alert** on `/admin`.

**Which number should the alerts go to?**

- **An Australian mobile (+61):** works straight away. ClickSend sends from a shared number with no registration.
- **A New Zealand mobile (+64):** New Zealand phone companies only accept business texts from a registered
  short code. ClickSend will not send any text to a New Zealand number until that registration is done,
  and it takes 4 to 6 weeks. Until then, either send your alerts to an Australian mobile, rely on the
  email alert, or use Twilio for alerts (below).

**Do these two things now, because Phase 2 depends on them:**

- Start ClickSend's **New Zealand registration** (in ClickSend: Global Sending, then the New Zealand
  registration form). Phase 2 texts job offers to Queenstown tradies and cannot work without it.
- Ask ClickSend support to **allow links in your texts**. New ClickSend accounts have texts containing
  web links held back, and Phase 2's one-tap "accept this job" link is a web link.

**Using Twilio instead (optional):** create a Twilio account, buy a number, and set `SMS_PROVIDER=twilio`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. A Twilio trial account can text your own
verified number, which is enough for alerts.

## Step 6. Stripe: the founding member deposit (20 minutes)

Do this twice: first with test keys, so you can try it with a pretend card, then with live keys.

1. Go to stripe.com and create an account for your **New Zealand** business. Stripe starts you in a
   **sandbox** (its test area), where no real money moves.
2. Copy the test secret key: **Developers > API keys**. It starts with `sk_test_`. Never share the secret key.
3. Create the webhook, so Stripe can tell the site when someone pays:
   1. Open **Webhooks** (dashboard.stripe.com/webhooks) and press **Create an event destination**.
   2. Choose **Your account**.
   3. Payload format: either choice works with this site. If unsure, choose **Snapshot**.
   4. Select these three events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`.
   5. Choose **Webhook endpoint** and enter the address `https://YOUR-SITE-ADDRESS/api/stripe/webhook`.
   6. On the next screen press **Reveal secret** and copy the signing secret. It starts with `whsec_`.
4. In Vercel add:

   | Name | Value |
   | --- | --- |
   | `STRIPE_NZ_SECRET_KEY` | the `sk_test_...` key |
   | `STRIPE_NZ_WEBHOOK_SECRET` | the `whsec_...` secret |

5. Redeploy, then test it:
   1. Fill in the owner form. The thank-you page now shows **Lock in your spot for NZ$49**.
   2. Press the button. On Stripe's page pay with the test card `4242 4242 4242 4242`, any future
      expiry date and any three digits.
   3. You should land on "You're a founding member", get a "Deposit paid" alert, and see **Paid NZ$49** on `/admin`.
   4. In Stripe, find the payment and refund it. Within a minute `/admin` shows **Refunded NZ$49**.
6. **Going live:** finish Stripe's business verification, leave the sandbox (account picker, top left),
   then repeat steps 2 to 4 with the live key (`sk_live_...`) and a new webhook made in live mode.
   The setup checklist changes from "TEST mode" to "Connected and taking real payments".

Things to know:

- Stripe's page takes the card. The site never sees a card number.
- To refund a deposit, refund the payment in Stripe. The site updates itself.
- Ask your accountant how to treat deposits for GST. The site does not add or report GST in Phase 0.
- The deposit amount and its promises ("Comes off your first month", "Fully refundable any time before
  we launch") are in `config/markets.ts`. They are shown to customers on the site and on Stripe's page,
  so only promise what you will honour.

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
| `PageView` | every page |
| `Lead` | an owner submits the form |
| `SubmitApplication` | a tradie submits the form |
| `Purchase` | a deposit is paid (with its value) |

Owners and tradies fire different events on purpose, so a campaign for owners is optimised for owners only.
Each event is sent twice, from the browser and from the server, and Meta counts it once. The server copy
keeps your numbers accurate when ad blockers or iPhones stop the browser copy. Email and phone are only ever
sent to Meta in scrambled (hashed) form.

To tag your ad links so the leads list shows the source and campaign, add this to the end of the link:
`?utm_source=facebook&utm_medium=paid&utm_campaign=YOUR-CAMPAIGN-NAME&utm_content=YOUR-AD-NAME`

## Step 8. Your own domain (10 minutes)

1. Buy the domain anywhere.
2. In Vercel: **Settings > Domains**, add it, and add the DNS records Vercel shows you. The security
   certificate is automatic.
3. In Stripe, edit the webhook so its address uses the new domain.
4. Redeploy.

## Step 9. Before you spend money on ads

- [ ] Replace every `[EDIT: ...]` placeholder. The setup checklist counts them for you.
- [ ] Put your contact email and company name in `config/brand.ts`.
- [ ] Have a lawyer write the four legal pages. See `docs/LEGAL-TODO.md`. Meta requires a real privacy
      policy for lead ads, and New Zealand privacy law requires you to tell people what you collect and why.
- [ ] Move Supabase to the Pro plan so the database cannot be paused.
- [ ] Switch Stripe to live keys.
- [ ] Send yourself one real lead from your phone and check the text, the email and `/admin`.
- [ ] Fill in the real prices in `seed/menu-queenstown.json`. Nothing uses them until Phase 2, but the
      landing page asks for two or three example prices.

## Every setting in one place

| Name | Needed for | Where it comes from |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Signing in to `/admin` | You choose it |
| `APP_SECRET` | Signing in, and remembering who filled in a form | 40+ random characters |
| `SUPABASE_URL` | Saving leads | Supabase > Connect |
| `SUPABASE_SECRET_KEY` | Saving leads | Supabase > Settings > API Keys |
| `ALERT_EMAIL_TO` | Email alerts | Your email address |
| `RESEND_API_KEY` | Email alerts | Resend > API Keys |
| `EMAIL_FROM` | Optional. Sending from your own address | After verifying a domain in Resend |
| `ALERT_SMS_TO` | Text alerts | Your mobile, as +61... or +64... |
| `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY` | Text alerts | ClickSend API credentials |
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Optional. Texts through Twilio instead | Twilio console |
| `STRIPE_NZ_SECRET_KEY` | Deposits | Stripe > Developers > API keys |
| `STRIPE_NZ_WEBHOOK_SECRET` | Deposits | Stripe > Webhooks > your endpoint > Reveal secret |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel | Meta Events Manager |
| `META_CAPI_ACCESS_TOKEN` | Meta Conversions API | Meta Events Manager > Settings > Conversions API |
| `META_TEST_EVENT_CODE` | Optional. Only while testing | Meta Events Manager > Test Events |
