# Wellco Project Brain: handover pack

This folder goes onto Dan's laptop (inside OneDrive) as the "Wellco Project Brain" folder. Dan opens
it with the Claude desktop app (Claude Code) to make changes, and drags the app file into Netlify to
publish.

## What's in the pack

| File | For | What it is |
|---|---|---|
| `GUIDE-for-Dan.md` | Dan | Plain-English guide: the three accounts, asking Claude for a change, undo, backups, what Joe covers. |
| `CLAUDE.md` | Dan's Claude | Read automatically when Claude opens the folder: how the app is built, design and money rules, Supabase rules, the pre-publish checklist, what to refuse. |
| `supabase-schema.sql` | Reference | The database baseline (v3, 17 Nov 2026). Already run on the live project at setup; never re-run. |
| `reference/` | Reference | Dan's own Quick Feaso spreadsheet and Letter of Offer template, which the app mirrors. |
| `changes-2026-11-16.md`, `changes-2026-11-17.md` | Reference | What Dan asked for on the setup call and in his 17 Nov notes. |

## Arrives with the build

- **`app/index.html`**: the Supabase-connected app. Joe adds it when the paid build is done (it
  replaces the demo file, which isn't included here). Until then, the instructions in `CLAUDE.md`
  describe the app as it will be.

## Created as they're needed

- `versions/`: dated copies of `app/index.html` from before each change.
- `migrations/`: numbered database changes after go-live (`0001_short-name.sql` and so on).

Not in this pack on purpose: `supabase-tests.sql` (local test database only, Joe keeps it) and any
keys or passwords.
