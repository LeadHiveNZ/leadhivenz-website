# Runbook

Plain-words instructions for the person watching the system. For each thing that can go wrong:
what it means, and what to do.

In Phase 0 there are no jobs yet, so the only things to watch are leads and deposits. The job
exceptions (nobody accepted, late jobs, disputes) are added to this file when those features are built.

## Daily routine (two minutes)

1. Open `/admin` and sign in.
2. Look at the newest leads. Call or message each new one the same day.
3. Glance at the **Setup checklist** at the bottom. Anything marked **Needs fixing** is urgent.

---

## Alert says "NOT SAVED"

**What it means.** Someone filled in a form, but the database did not save it. The text or email you
received is the **only copy** of that lead.

**What to do.**
1. Copy the person's details somewhere safe straight away (the email has everything).
2. Contact them as normal. They saw a normal thank-you page and do not know anything went wrong.
3. Open `/admin` and read the **Database** line of the setup checklist. It says what is wrong:
   - "Could not reach Supabase": the database may be paused (free plan) or down. Open supabase.com,
     open the project, and press **Restore** if it is paused.
   - "the tables are missing": run the SQL file again (SETUP.md step 1).
   - "rejected the key": the key in Vercel is wrong. Paste it again and redeploy.
4. When it is fixed, submit a test lead to confirm.

## A lead shows "Text FAILED" or "Email FAILED"

**What it means.** The lead was saved and is on the list, but one of the two alerts did not go out.

**What to do.**
1. Nothing is lost. Follow up the lead from the list.
2. Press **Send me a test alert** on `/admin`. It reports the exact reason. Common ones:
   - "ClickSend rejected the username or API key": paste the key again in Vercel, redeploy.
   - A status such as INSUFFICIENT_CREDIT: top up ClickSend.
   - "Resend's test sender can only email the address that owns the Resend account": set `ALERT_EMAIL_TO`
     to that address, or verify your domain in Resend.
3. If texts to a New Zealand number fail, see SETUP.md step 5. New Zealand numbers need a registration first.

## Email says "Action needed: paid the deposit twice"

**What it means.** One owner paid the deposit two separate times. Only the first is counted.

**What to do.**
1. Open Stripe > Payments and find the two payments from that person.
2. Refund the second one in full.
3. Send them a short note to say the duplicate has been refunded.

## Email says "Action needed: deposit with no matching lead"

**What it means.** Stripe took a deposit but the site could not find who it belongs to. This is rare.

**What to do.**
1. Open Stripe > Payments, find the payment, and read the customer's email address.
2. Search for that email on `/admin` (use **Download spreadsheet** and search in it).
3. If the person is on the list, note by hand that they have paid. If they are not, contact them from
   the email address in Stripe.
4. Tell the developer. The email names the Stripe checkout session to look up.

## An owner asks for their deposit back

1. Open Stripe > Payments, find their payment, press **Refund**, refund in full.
2. Within a minute `/admin` shows **Refunded** next to their name. You do not need to change anything on the site.

## An owner says they paid but the list says "Started, not paid"

**What it means.** They opened the card page but the payment did not complete, or Stripe has not told the site yet.

**What to do.**
1. Look in Stripe > Payments for a successful payment from them.
2. If there is none, they did not pay. Ask them to try again from the link in their browser, or fill in the form again.
3. If there is a successful payment and the list still says "Started" after a few minutes, open
   Stripe > Webhooks > your endpoint and look for failed deliveries. Press **Resend** on the failed one.
   If it keeps failing, check the **Card payments** line of the setup checklist and tell the developer.

## Lots of junk leads arriving

**What it means.** A robot has found the form. The form already blocks the common kinds, and limits each
visitor to six submissions every ten minutes.

**What to do.**
1. Junk leads cost a few cents each in texts. Nothing is at risk.
2. If it keeps happening, tell the developer. A "prove you are human" check can be added to the form.

## The site shows an error page, or will not load

1. Check vercel-status.com and status.supabase.com.
2. In Vercel > Deployments, check the latest deployment is marked Ready. If the latest one failed, the
   previous version is still live. Press **Redeploy** on the last one that worked.
3. Tell the developer, with the time it happened.

## Someone asks you to delete their details

1. Find them on `/admin` to confirm what is held.
2. Delete their row in Supabase > Table Editor > `leads`. (The site itself cannot delete leads, on purpose.)
3. If they paid a deposit, refund it in Stripe first.

## Changing the admin password

Change `ADMIN_PASSWORD` in Vercel and redeploy. Everyone who was signed in is signed out at once.
