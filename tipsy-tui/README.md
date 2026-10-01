# The Tipsy Tui — Bookings app

A phone app for Joe and Kieran that turns a signed contract into a booked job: time slot on the calendar, run sheet, checklist, crew, and money, all shared between both phones.

**What's in here**

| Folder | What it is |
|---|---|
| `app/` | The app. Plain HTML/CSS/JS, no build step. Installs to the home screen like a normal app. |
| `supabase/schema.sql` | The database (bookings, tasks, crew). Paste into Supabase once. |
| `supabase/functions/intake/` | Reads a pasted contract, quote, email or PDF with Claude and returns the booking. |
| `supabase/functions/calendar/` | A calendar feed. Subscribe once and every job shows up in Google Calendar or iPhone Calendar. |

**How you'll use it day to day**

1. Client signs. Open the app → **Book** → attach the agreement or quote PDF (or a photo once the AI function is on), or paste the email thread.
2. Tap **Book it in**. That's it. The job is saved, it's on the shared calendar, the run sheet is built (depart time, set-up, bar hours, pack-down, home), the checklist is created with due dates and each task already assigned (client, money and paperwork to Joe; caravan, stock and gear to Kieran; day-of jobs to both), and you're both rostered as crew.
3. Anything it couldn't read is listed at the top of the job page ("no bar hours found", "venue says TBC"). Fix it with **Edit booking** and tap **All sorted**.
4. If it can't find the client's name or the date it shows the check screen instead of guessing. Untick "Book it straight in" on the Book screen if you'd rather always review first.

Who gets which tasks is set in `app/config.js` (`ASSIGN`). Swap the names if Kieran does the paperwork and you do the gear.

Without Supabase the app runs in **Demo mode** on one device with example jobs, so you can try it before setting anything up.

---

## Setup (about 30 minutes, no coding, no command line)

### 1. Create the database (Supabase, free)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up with Google or email.
2. **New project**. Organisation: the default one. Name: `tipsy-tui`. Database password: generate one and save it in your password manager (you won't need it day to day). Region: **Sydney**. Click **Create new project** and wait a minute or two.
3. Left menu → **SQL Editor** → **New query** (or the **+**). Paste the whole of `supabase/schema.sql` and press **Run** (or Ctrl/Cmd + Enter). You should see "Success. No rows returned".
4. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**. Email: yours. Password: choose one. Tick **Auto Confirm User**. Create. Repeat for Kieran.
5. Left menu → **Table Editor** → `profiles`. Set `name` to `Joe` and `Kieran` so the home screen greets the right person.
6. Left menu → **Project Settings** (gear) → **API Keys**. Copy the **Publishable key** (`sb_publishable_…`). Also note the **Project URL** at the top (`https://xxxx.supabase.co`). If your project only shows the older **anon** key (`eyJ…`), that works too.

### 2. Point the app at it

Open `app/config.js` and paste the two values:

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "sb_publishable_...",
```

The publishable key is safe to ship in the app. The rules in `schema.sql` only let logged-in users read or write anything.

### 3. Put the app online (Netlify, free, 2 minutes)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the whole `app` folder onto the page.
3. It gives you a link like `https://something.netlify.app`. Rename it under **Site configuration → Change site name** to `tipsytui-bookings` or similar. That's the app's address.

To update the app later, drag the folder onto the same site's **Deploys** page.

### 4. Install it on both phones

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → ⋮ menu → **Add to Home screen** / **Install app**.

It opens full screen with the Tipsy Tui icon and remembers your login.

### 5. Turn on the AI intake (reads contracts, photos and email threads)

All in the Supabase dashboard:

1. Get a Claude API key: [console.anthropic.com](https://console.anthropic.com) → **API Keys** → make sure the workspace selector at the top says **Default** (a key made outside a workspace is rejected with "not scoped to a workspace") → **Create Key**. Add a few dollars of credit under Billing. A contract read costs a fraction of a cent.
2. Supabase left menu → **Edge Functions** → **Secrets** → add `ANTHROPIC_API_KEY` = your key → Save.
3. **Edge Functions** → **Deploy a new function** → **Via Editor**. Name it exactly `intake`. Delete the sample code, paste the whole of `supabase/functions/intake/index.ts`, click **Deploy**.
4. Open the function → **Details** / settings: leave **Verify JWT** on (the app sends the login token).

If the function is missing or the key is wrong, the app falls back to its built-in parser and tells you.

### 6. Turn on the shared calendar feed

1. Make up a long random token (a password generator is fine, 20+ characters, letters and numbers only).
2. **Edge Functions** → **Secrets** → add `CALENDAR_TOKEN` = that token.
3. **Deploy a new function** → **Via Editor** → name `calendar` → paste `supabase/functions/calendar/index.ts` → **Deploy**.
4. Open the function's settings and turn **Verify JWT off** (calendar apps can't log in; the token is the password).
5. In the app → **More** → paste the token. It builds the link:

```
https://xxxx.supabase.co/functions/v1/calendar?token=YOUR_TOKEN
```

- **Google Calendar (desktop):** Other calendars → **+** → **From URL** → paste.
- **iPhone:** Settings → Apps → Calendar → Accounts → Add Account → Other → **Add Subscribed Calendar** → paste.

Every confirmed and quoted job appears with the run sheet in the event notes. Quoted jobs show as tentative. Calendars refresh the feed themselves (Google can take up to a day; iPhone is quicker).

<details><summary>Prefer the command line? (optional)</summary>

```bash
supabase login
cd tipsy-tui/supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... CALENDAR_TOKEN=$(openssl rand -hex 16)
supabase functions deploy intake
supabase functions deploy calendar --no-verify-jwt
```
</details>

## What the app works out for you

All of this comes from the way you already quote and run jobs.

| Thing | Rule |
|---|---|
| Bartenders | 1 per 50 guests (1–50 = 1, 51–100 = 2, and so on). Dry hire = none. Override per job. |
| Timeline | Leave base = bar opens − set-up (1 h default) − drive time. Home = last drinks + pack-down (1 h) + drive. |
| Travel | $50 per 45-minute block one way from Christchurch, rounded up. |
| Drinks | Your own guide: about 4 per guest over 4 h, 5.5 over 6 h, 7 over 8 h. |
| Kegs | If about 40% of drinks go through the taps, at ~100 pours per 50 L keg. A nudge, not an order. |
| Ice | About 1 kg per guest, shown as 5 kg bags. |
| Cups | 2 per guest (plastic). |
| Deposit | 25% of the total unless the contract says otherwise. |
| Balance | Due 7 days before the event. |
| Bond | $300 on dry hire, refund within 7 business days. |
| Wages (internal) | Bartenders × hours (set-up + service + pack-down) × $50/h charge-out. |

The checklist is generated per package (dry hire, BYO, fully catered) with due dates counted back from the event: agreement and deposit, Local Pour Guide or Drinks List guide, rostering, venue access and licence, balance and bond, stock, ice and CO2, caravan checks, day-of steps, and the after-job follow-ups (bond refund, buy-back of unopened stock, review request).

To change any rule, edit the constants at the top of `app/app.js` (`BOND_DEFAULT`, `DEPOSIT_PCT`, `BARTENDER_RATE`) or the `generateTasks` function. They're plain English.

## Adding casual bartenders

**More → Crew → Add bartender.** Then on any job, tick who's working it. The home screen flags jobs in the next 30 days that are short on crew.

## If something's off

- **"Couldn't start"** on launch: the URL or key in `config.js` is wrong, or `schema.sql` hasn't been run.
- **Login fails:** the user wasn't created under Authentication → Users, or wasn't auto-confirmed.
- **Intake says it used the basic parser:** the `intake` function isn't deployed or the `ANTHROPIC_API_KEY` secret is missing.
- **Calendar link gives "Not found" or "Invalid JWT":** the token in the link doesn't match `CALENDAR_TOKEN`, or Verify JWT is still on for the `calendar` function.
