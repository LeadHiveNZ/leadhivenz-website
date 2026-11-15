<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HostFix project notes

Read `README.md` first. The owner of this project is a non-technical founder: explain choices in plain
words, and keep everything simple enough for one virtual assistant to run.

### Rules that must not be broken

- **Never lose a lead.** Saving and alerting are separate. If saving fails, the alert still goes out with
  every detail (`src/lib/leads/service.ts`).
- **Money is whole cents plus a currency.** Never a decimal. Format with `formatMoney` (`src/lib/money.ts`).
- **Every money movement goes through a database function** that changes the record and writes the audit
  entry together, and is safe to call twice (`supabase/migrations`, mirrored in `src/lib/store/demo.ts`).
- **The audit log is append-only.** Never add update or delete access to it.
- **Nothing tied to one town, currency or tax rate.** Those live in `config/markets.ts`.
- **Plain language on every screen.** No jargon. Error messages say what to do next.
- **No legal wording.** Terms, privacy, tradie agreement and insurance stay as placeholders until a lawyer
  writes them (`docs/LEGAL-TODO.md`).
- **Secrets only in environment variables.** Add new ones to `.env.example`, `SETUP.md`, `tests/setup.ts`
  and the setup checklist (`src/lib/status.ts`).
- **People only see their own data.** Private pages call `requireAdmin()` themselves. The proxy is a
  convenience, not the lock. Every table has Row Level Security on with no policies.

### Next.js 16 with Cache Components: what bit us

- A component that depends on the visitor must touch the request (`await connection()`, `cookies()`)
  **before any early return**. Otherwise the build can freeze it as fixed content.
- `Date.now()` and random values in a component need `await connection()` first, inside `<Suspense>`.
- Page-level redirects for signed-out visitors arrive after the page has started streaming. `src/proxy.ts`
  does the proper redirect first.
- Files read at run time (`content/*.md`) must be listed in `outputFileTracingIncludes` in `next.config.ts`.
- After a failed form submit React resets the form. Selects and checkbox groups need a `key` tied to the
  saved value to keep the visitor's choice (`src/components/forms/Fields.tsx`).

### Before saying something is done

```bash
npm run check                       # lint, types, unit tests
npm run build && npm run test:e2e   # real browser, phone size
npm run test:db                     # needs DATABASE_URL for a throwaway Postgres
```

- Tests run during every deploy with the real keys present. `tests/setup.ts` hides them from the tests.
- Outside services are tested against stand-ins (`tests/unit/helpers.ts`, `e2e/fake-stripe.mjs`). Read the
  provider's current documentation before changing any call to an outside service. Do not rely on memory.
