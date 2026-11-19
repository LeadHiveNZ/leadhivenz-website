# Runbook

For the dispatcher: the person who watches the system. Plain words on what each thing in the queue
means and what to do about it. The last section is for the admin.

## How it works, in one minute

1. An owner logs a job from their app. Their cleaner can log one from their own team link, and a guest
   can report one from the QR card in the property (the owner is asked before anyone is sent for a
   guest's report, and for a cleaner's when the owner chose **Ask me first** for them).
2. The job is **offered by text** to the first-choice tradie for that trade. They have 15 minutes. If
   they pass or do not answer, it goes to the backup for 15 minutes, then to every other approved tradie
   in that trade at once. First to accept gets it.
3. The tradie accepts from the text, taps **I have arrived** at the property, and finishes with a photo.
4. The owner's card is charged the fixed price when the job is done. The tradie's payment is sent a
   day later, and takes a few working days more to reach their bank. That day is the owner's chance to
   say something is wrong.
5. **You only see what the system could not sort out by itself.** That list is the **Queue**. An empty
   queue is the goal.

## Your day

1. Go to the site's address followed by `/admin`. Press **Sign in with my email**, enter your email,
   then the six-digit code it sends you. You land on the Queue.
2. Work from the top. The most pressing item is first. Each one has a **What to do** line and a button
   to open the job or the tradie.
3. Many items close by themselves when the thing they were waiting for happens (a tradie accepts, the
   card goes through). For the rest, press **Mark as dealt with** and write one line on what you did.
4. Once a day, open **Tradies**. Look for anyone **Waiting for approval**, and for any trade showing
   **0 ready** (a job in that trade would have nobody to go to).
5. Glance at **Timer last ran** at the top of the queue. It should say a minute or two. If a red box
   says **The timer has stopped**, tell the admin straight away: nothing moves until it is fixed.

### Five rules

- **Anything with a promised time on it: phone, do not text.** Numbers on the job page are tap-to-call.
- **Never refund in Stripe.** Refund on the job page. That brings the tradie's payment down to match.
- **Only record an owner's yes if they said it to you.** The system keeps a record of who pressed what.
- **Do not cancel a job a tradie has already driven to.** Let them finish, or have them press
  "I could not get in" so they are paid the call-out.
- **You see lockbox codes and phone numbers. Never share them** outside the job they belong to.

---

## The queue, item by item

### Nobody accepted
**Means.** Every tradie who could take the job was offered it, and none said yes. The owner has been
told you are finding someone by hand. The promised time is still running.

**Do.**
1. Open the job. Under "Nobody accepted. Find a tradie" is the list of tradies who do this trade.
2. Ring them, best first. When one says yes, choose them and press **Assign this tradie**. They and the
   owner are texted straight away, and the item closes.
3. Nobody free? Press **Start the offers again from the top**, then ring the owner with an honest time.
4. A tradie marked "no current licence" cannot be given licensed work. "No bank details yet" means
   they can do the job but cannot be paid until they add them. Avoid if you can.

### Running late
**Means.** Three-quarters of the promised time has gone and no tradie is on site yet.

**Do.** Ring the tradie and ask where they are. If they will not make it, tell the owner before the time
passes. If no tradie is booked at all, treat it as "Nobody accepted". It closes when the tradie arrives.

### Missed the promise
**Means.** Nobody had taken the job and nobody was on site by the promised time. Nothing is credited:
missed promises stopped being credited on 18 November 2026 (DECISIONS.md). The owner pays nothing
unless a tradie does the job.

**Do.**
1. Ring the owner and say sorry. Do not make them chase you.
2. Find a tradie and assign them on the job page.
3. Mark as dealt with, noting what went wrong. The admin reads these.

### Nobody has taken it yet
**Means.** A normal job has gone 3 hours (the market's setting, counting only 7am to 9pm) with nobody
accepting. The owner is texted that we are ringing round and that they pay nothing unless a tradie does
the job (never between 9pm and 7am: the text waits for 7am, and the note says so), and the founder's
phone has been alerted.

**Do.** Ring tradies who do this trade. When one says yes, assign them on the job page. It closes when
someone accepts.

### Tradie not there: call them
**Means.** A tradie accepted the job and was not on site by the promised time (a no-show).

**Do.**
1. Call the tradie. If they are on the way, tell the owner the new time.
2. If they are not coming, cancel the job and log it again so it goes to someone else, and ring the owner.
3. A tradie with 3 no-shows in 90 days shows **Tradie to talk to** in the queue and on their page. Talk to
   them. Never remove a tradie because of the count alone: removal is a person's decision after a
   conversation. Passing on offers is never a reason.

### Arrival not confirmed / Owner says the tradie isn't there
**Means.** The tradie tapped "I have arrived" with no location from their phone, or more than 500 m
from where tradies have been at that house before, or the owner pressed "The tradie isn't here".

**Do.** Ring the tradie now and check where they are. Then ring the owner back. If the tradie was not
there, note it and tell the admin.

### Owner raised a problem
**Means.** After a job, the owner said something is wrong. If they said it inside the first day, the
tradie's payment is on hold until you settle it.

**Do.**
1. Open the job. Read what the owner wrote. Look at the tradie's photos of the finished work.
2. Ring the owner, then the tradie. Ask the tradie to go back and put it right if that is fair.
3. Under "The owner raised a problem", choose **The work stands** (the tradie is paid in full) or
   **Refund the owner** (all or part: the tradie's payment and our fee come down in proportion).
4. Write what was decided and why. **The owner sees this note.** Press **Settle it**.
5. Not sure what is fair, or the amount is large? Ask the admin before settling. It cannot be undone.

### Card payment failed
**Means.** The job is done but the owner's card was declined. They have been texted. It is tried again
once a day, four times in all. **The tradie is not paid until the card goes through.**

**Do.** Ring the owner and ask them to update their card (in their app: **Billing**). Then open the job
and press **Try the card again now**. If the fourth try fails, tell the admin.

### Could not pay the tradie
**Means.** The payment to the tradie's bank did not go through, usually because their bank details
are incomplete. Or: an owner was refunded after the tradie had been paid, and the tradie's share could
not be taken back automatically.

**Do.** For the first: ask the tradie to check their bank details (their app: **Profile**), then open
the job and press **Try paying the tradie again**. For the second: tell the admin, who settles it with
the tradie directly.

### Quote waiting on the owner
**Means.** A tradie on site has quoted for work that needs the owner's yes, and four hours have passed
with no answer. The owner was reminded after one hour.

**Do.** Ring the owner. If they give you an answer, open the job and press **Owner said yes** or
**Owner said no**. The tradie is texted. If the owner says no, the tradie is still paid the call-out.

### Licence running out
**Means.** A tradie's plumbing, gas or electrical licence runs out within 30 days, or already has.
They have been texted. Once it has run out they are **not offered licensed jobs at all**.

**Do.** Ask them for the renewed licence. Check it on the public register (in New Zealand: the Plumbers,
Gasfitters and Drainlayers Board, or the Electrical Workers Registration Board). On their page, enter
the new date, press **Save licence**, then **I have checked this on the register**. Mark as dealt with.

### Insurance running out
**Means.** A tradie's public liability insurance runs out within 30 days, or already has. Once it has run
out they are offered no jobs at all.

**Do.** Ask them for the renewed policy and its certificate. On their page, under **Edit details**, enter
the insurer, the policy number and the new expiry date, and press **Save**. Then **Upload certificate** under
**Public liability insurance** (the new one becomes the current one; older ones stay listed). They can
also do both themselves on their profile. Mark as dealt with.

### A text or email did not send
**Means.** A message did not reach someone. The item says who and why.

**Do.** Usually a wrong number or address. Reach the person another way and fix their details. If many
fail at once, tell the admin: the text or email account may be out of credit. **More > Texts and
emails** shows everything that was sent.

### Referral reward to pay
**Means.** A cleaner or co-host sent an owner who has now paid for long enough to earn them the reward.

**Do.** This is the admin's. They pay it by bank transfer, then press **I have paid this** under
**More > Referrals**. The item closes.

### Bank dispute (chargeback)
**Means.** An owner went to their bank instead of to us, and the bank has taken the money back. The
bank sets a short deadline to answer.

**Do.** **Tell the admin the same day.** They answer it in Stripe using the photos and the job history.

### Portfolio price needs a person
**Means.** A property manager's Portfolio retainer needs a decision the app will not make: they have
dropped below 10 properties (they stay on the lowest band meanwhile), or reached 100 or more (priced by
arrangement: they keep paying the 50-99 band meanwhile, or cannot start until a price is set).

**Do.** Tell the admin. They agree the price with the manager (see "A manager's Portfolio band" below).

### Credit could not be applied / Needs a look
**Means.** Something happened that the app cannot finish by itself: a credit did not reach the payment
company, or someone made a refund in Stripe instead of on the job page.

**Do.** Read the note and tell the admin.

---

## Other things you will be asked to do

**An owner phones in a job.** More > Owners > their name > **Log a job here**. They are charged the
fixed price when it is done, the same as if they had logged it.

**A guest's report is waiting and the owner tells you to go ahead.** Open the job and press
**Owner said yes: send a tradie**.

**Say sorry with a credit.** On the job page or the owner's page: **Give the owner a credit**. It comes
off their next membership payment. It is not money back to their card. Ask the admin above the amount
they have told you is fine.

**Cancel a job.** Job page > **Cancel this job**, with the reason. Nothing is charged. Both sides are texted.

**A new tradie.** Tradies > **Add a tradie** (or More > Leads > **Make a tradie**, admin only). Enter
each licence number and its end date, check it on the register, and their public liability insurance
(insurer, policy number and expiry date). Then check the certificate: on their page under **Public liability
insurance**, open **Current certificate** and make sure the insurer, policy number, expiry date and their name
match what is typed in. If they sent it to you instead, use **Upload certificate**. **Approve** is refused
without all three details and the certificate, or if the insurance has run out. If they gave an LBP number,
**Search the LBP register** checks it (optional: nothing waits on it). Then press **Approve**. That texts them
a link to sign in and add their bank details. Their page shows "Getting offers" once everything is in.

**Refunding the founding deposits.** HostFix is free to join (DECISIONS.md, 17 Nov 2026), so every
founding deposit already paid is refunded in full. In the Stripe dashboard: **Payments**, find the
deposit (search the owner's email), open it, press **Refund**, full amount. You do not need to change
anything on the site: Stripe tells it, and the lead shows **Refunded** on the Leads page by itself. The
Leads page shows who still has **Paid**: work down that list.

**A tradie is letting people down.** The Tradies page shows each one's accepted and on-time figures
for the last 30 days. Under 80% shows in red, and the page suggests swapping first choice and backup.
Pausing or removing a tradie is on their page. Check with the admin first.

**A tradie asks where their money is.** Their **Pay** tab lists each job and the day its payment was
sent. In New Zealand it shows in their bank about 5 to 6 working days after the job, because the payment
company holds card money for 4 working days first. Later than that? Open the job and read "Tradie's
payment" under Money: it says whether it was sent, is on hold, or failed.

**Find out what someone was sent.** The job page lists every text and email about that job.

**How an owner adds a cleaner** (DECISIONS.md, 18 Nov 2026). Properties > **Your team** (or **Add a
cleaner** on a property page). They type the cleaner's name and mobile, tick the houses (or whole groups,
for owners with three or more properties), and choose **Send a tradie straight away** or **Ask me first**,
then **Add and text them their link**. The cleaner gets one text with one link. The first time they open
it on a phone they press **Text me the code** and type the six digits; after that the link opens straight
to their list of houses. The same mobile added by another owner keeps the same link, and the second
owner's houses join the list. Every report is signed with the name the owner typed.

**A cleaner says their link does not work.**
- *"It asks for a code."* That is normal on a new phone, or after about a year. They press **Text me
  the code**. The code goes to the mobile the owner typed: if it is wrong, the owner fixes it by taking
  them off the team and adding them again with the right number.
- *"The house is not on my list."* The owner has not ticked it, has unticked it, or took them off the
  team, or the property is not covered right now. Ask the owner to open **Your team** > the cleaner's
  name and tick it. A house added to a group they have is on their list at once.
- *"The code never arrives."* Check **A text or email did not send** in the queue. Five codes in 15
  minutes is the limit; after that they wait.
- *"Someone else has my link."* The link opens nothing without a code sent to the cleaner's own mobile,
  so a forwarded link shows only the code screen. Nothing to do.

**The older per-property team link.** Properties set up before 18 Nov 2026 have a link for the
property itself. It still works for anyone who has it (a tradie is sent straight away, signed with
whatever name is typed). The owner can replace it on the property page under **Make a new team link for
this property**. Once the owner has anyone on their team, the property page stops offering it.

**Print every QR card, or add many properties.** Properties > **Print every QR card** prints one card
per page. Add a property > **Add many at once** takes lines pasted from a spreadsheet (name, street,
suburb, postcode, access notes; up to 200), shows a problem against any line that is not right, and
saves the rest together. With a card already on file they are covered straight away.

---

## For the admin

**Changing a job price.** More > Markets, prices and the menu > the market > open the job > change
"Owner pays" and "Tradie gets" > **Save job**. It applies to jobs logged from then on. Jobs already
logged keep the price they were logged at.

**Changing a membership price.** Once properties have joined a membership its price is fixed, so that
nobody is shown one price and charged another. To change it: **Add a membership** at the new price, and
untick **Offered to new members** on the old one. Existing members stay on the old one, at the old
price, until they switch in their app. Moving existing members to a new price needs written notice
(ask your lawyer how much) and a developer. The promise hours and what is included can be changed at
any time, and apply to members straight away.

**A manager's Portfolio band.** More > Owners > the manager. The Portfolio card shows how many properties
are on it, the retainer they pay from the next payment, the band, and the next payment date. The band
changes by itself when they add or take off properties (10-24 NZ$600, 25-49 NZ$900, 50-99 NZ$1,200),
always from the next monthly payment. Every change is in More > Audit log as "portfolio.band_changed".
To set a different price (100 or more properties, or anything agreed with them), open **Set an agreed
retainer**, enter the monthly amount and save: it is sent to Stripe for their next payment. Empty the
box to go back to the bands. To change the bands themselves for everyone: More > Markets > the market >
Memberships > Portfolio (only while no Portfolio is paying on them; otherwise add a new Portfolio
membership and close the old one to new members, as for a price change). The 60-day pilot is not
tracked by the app: note it in `DECISIONS.md` and review it by hand.

**Opening a new town.** More > Markets, prices and the menu > **Add a market**. See `SETUP.md`.

**Paying referral rewards.** More > Referrals. Pay by bank transfer, then **I have paid this**.

**Adding or removing a dispatcher.** More > Staff.

**The timer has stopped.** In Vercel, open the project's Cron Jobs and its Logs. Check the plan is
still Pro and `CRON_SECRET` is still set. More > Setup checklist > "The timer" says when it last ran.
When it starts again it catches up by itself: nothing is lost, only late.

**An alert says "NOT SAVED".** Someone filled in a public form but the database did not save it. That
alert is the only copy: copy their details somewhere safe and contact them as normal. Then read the
"Database" line on the setup checklist. A paused Supabase project (free plan) is the usual cause:
open supabase.com and press **Restore**.

**"Action needed: paid the deposit twice".** Refund the second payment in Stripe > Payments.
**"Action needed: deposit with no matching lead".** Find the payer's email in Stripe > Payments and
match it to a lead by hand.

**An owner says they paid but it does not show.** Stripe > Webhooks > your endpoint. Look for failed
deliveries and press **Resend**. If it keeps failing, check "Card payments" on the setup checklist.

**Lots of junk leads arriving.** A robot has found a form. The forms already block the common kinds and
allow each visitor six tries every ten minutes. Junk costs a few cents each in texts and nothing else.
If it keeps happening, tell the developer: a "prove you are human" check can be added.

**The site will not load.** Check vercel-status.com and status.supabase.com. In Vercel > Deployments,
if the newest one failed the previous version is still live: nothing to do but tell the developer.

**Someone asks for their details to be deleted.** A lead with no account: delete their row in
Supabase > Table Editor > `leads`, after refunding any deposit. An owner or tradie with an account:
this needs a developer, because their jobs and payment history have to be kept for tax and are
tied to them. Note the date they asked.

**Changing the admin password.** Change `ADMIN_PASSWORD` in Vercel and redeploy. Anyone signed in with
the password is signed out. Staff who sign in with their own email are not affected.

**Every action is recorded.** More > Audit log shows every job change and every money movement, with
who did it. Nothing in it can be edited or deleted.
