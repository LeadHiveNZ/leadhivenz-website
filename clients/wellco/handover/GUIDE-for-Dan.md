# Your project app: how it all works

Dan, this is the short version. Keep it handy.

## Your three accounts and what they do

| Account | What it does for you |
|---|---|
| **Supabase** | Holds all your data (projects, bills, contacts, deals) and your documents. Your login to the app is stored here. |
| **Netlify** | Shows the app at its web address, on your phone, iPad and computer. |
| **The Wellco folder on your laptop** (inside OneDrive) | Holds the app file itself (`app/index.html`), older copies of it, and instructions for Claude. OneDrive backs it up automatically. |

All three are in your name. Joe can help only if you invite him.

## Asking Claude for a change

1. Open the **Claude** desktop app and choose **Claude Code**.
2. Choose the **Wellco Project Brain** folder on your laptop.
3. Tell it what you want in normal words, for example: "On the Deals page, add a field for the
   agent's phone number." One change at a time works best.
4. Claude reads its instructions in the folder, saves a copy of the current app first, makes the
   change and checks it. Let it finish its checks.
5. Claude opens the changed app on your laptop so you can have a look yourself (log in as usual).
6. Happy with it? Go to **netlify.com** > your Wellco site > **Deploys**, and drag the **`app`
   folder** onto the box. It's live in about a minute.

If Claude says a change needs Joe or your accountant, that's on purpose: some changes (GST, BAS,
deleting data, the database) are risky to do on your own.

## Undoing a bad change

1. Go to **netlify.com** > your Wellco site > **Deploys**.
2. Click the last version that worked.
3. Click **Publish deploy**. The app goes straight back to how it was.

Your data isn't affected by this. Then tell Claude: "Put back the previous version of the app file."

## Backups

- **Supabase** backs up your data every day once you're on the Pro plan. Keep Pro switched on.
- **Every quarter**, go to **Exports** in the app, download **Everything** (one workbook with all your
  data) plus the year-end and BAS workbooks for each company, and save them in your OneDrive.
- Your documents (PDFs, plans, photos) live in Supabase Storage, which is backed up with your data.
- **Forgot your password?** On the login screen, tap "Forgot your password?" and follow the email.
- Keep your accountant's sign-off on each BAS and year-end as usual. The app helps you get the
  figures ready; Lucy still checks and lodges them.

## What Joe looks after

- Joe connects the app to your Supabase account, puts it on your Netlify account, loads your
  current projects, companies and contacts, and shows you how to use it.
- For **30 days after the app goes live**, Joe fixes any faults in his work at no charge.

## After that

- You make your own changes with Claude, as above.
- If something you or Claude changed breaks, Joe can fix it, but that's quoted as new work.
- Bigger additions (new screens, connecting another service) are quoted by Joe before he starts.
- Keep paying Supabase (Pro) and Netlify yourself. They're your accounts.

## Three things never to do

1. Never give anyone your Supabase password or the "service role" key, and never paste it into Claude.
2. Never let anything delete projects or bills in bulk.
3. Never publish a file Claude hasn't checked.
