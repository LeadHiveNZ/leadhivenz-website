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

1. Client signs. Open the app → **Book** → paste the agreement, the quote, or the whole email thread (or attach the PDF).
2. It reads it, fills in the booking, and lists anything to double-check ("no bar hours found", "venue says TBC").
3. Tap **Save and build the checklist**. The job is now on the calendar with a run sheet (depart time, set-up, bar hours, pack-down, home), the standard checklist with due dates, how many bartenders it needs, and the deposit, balance and bond.
4. Both of you see the same jobs. Tick tasks off, pass them to each other with the name pill, roster bartenders, and copy the run sheet into the crew WhatsApp.

Without Supabase the app runs in **Demo mode** on one device with example jobs, so you can try it before setting anything up.

---

## Setup (about 30 minutes, no coding)

### 1. Create the database (Supabase, free)

1. Go to [supabase.com](https://supabase.com), sign up, **New project**. Name it `tipsy-tui`, pick the Sydney region, save the database password somewhere.
2. Left menu → **SQL Editor** → **New query**. Paste the whole of `supabase/schema.sql` and press **Run**. You should see "Success".
3. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**. Add yourself (email + a password you choose). Tick "Auto Confirm User". Do the same for Kieran.
   - To show the right first name on the home screen, open **Table Editor** → `profiles` and set the `name` column to `Joe` and `Kieran`.
4. Left menu → **Project Settings** → **API**. Copy the **Project URL** and the **anon public** key.

### 2. Point the app at it

Open `app/config.js` and paste the two values:

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
```

The anon key is safe to ship in the app. The database rules in `schema.sql` only let logged-in users read or write anything.

### 3. Put the app online (Netlify, free, 2 minutes)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the whole `app` folder onto the page.
3. It gives you a link like `https://something.netlify.app`. Rename it under **Site settings → Change site name** to `tipsytui-bookings` or similar. That's the app's address.

(Any static host works: Vercel, Cloudflare Pages, GitHub Pages. Netlify Drop is just the fastest.)

To update the app later, drag the folder onto the same site's **Deploys** page.

### 4. Install it on both phones

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → ⋮ menu → **Add to Home screen** / **Install app**.

It opens full screen with the Tipsy Tui icon and remembers your login.

### 5. Turn on the AI intake (reads contracts for you)

This needs the Supabase command line once, from a laptop.

```bash
# Install the Supabase CLI (Mac: brew install supabase/tap/supabase, or see supabase.com/docs/guides/cli)
supabase login
cd tipsy-tui/supabase
supabase link --project-ref YOUR_PROJECT_REF      # the xxxx part of https://xxxx.supabase.co

# Your Claude API key from console.anthropic.com → API keys
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

supabase functions deploy intake
```

Cost: a contract read is a fraction of a cent. If the key is missing or wrong, the app quietly falls back to its built-in pattern parser (which already handles your own quote and agreement layouts) and tells you it did.

### 6. Turn on the shared calendar feed

```bash
# Any long random string. This is the "password" in the calendar link.
supabase secrets set CALENDAR_TOKEN=$(openssl rand -hex 16)
supabase functions deploy calendar --no-verify-jwt
```

Then in the app → **More** → paste the token. It builds the link:

```
https://xxxx.supabase.co/functions/v1/calendar?token=YOUR_TOKEN
```

- **Google Calendar (desktop):** Other calendars → **+** → **From URL** → paste.
- **iPhone:** Settings → Apps → Calendar → Accounts → Add Account → Other → **Add Subscribed Calendar** → paste.

Every confirmed and quoted job appears with the run sheet in the event notes. Quoted jobs show as tentative. Calendars refresh the feed themselves (Google can take up to a day; iPhone is quicker).

Each job also has a **Google Calendar** button and a **Download .ics** button for one-off adds.

---

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
- **Calendar link gives "Not found":** the token in the link doesn't match `CALENDAR_TOKEN`, or the function was deployed without `--no-verify-jwt`.
