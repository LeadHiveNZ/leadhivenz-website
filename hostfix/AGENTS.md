<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HostFix project notes

Read `README.md` first, then `DECISIONS.md`, then `docs/PLAN.md` (the status block at the top lists
where the build differs from the original plan). The owner of this project is a non-technical founder:
explain choices in plain words, and keep everything simple enough for one virtual assistant to run.

`DECISIONS.md` is where decisions made outside the code are written down, newest first, with the code
changes each one still needs. When it contradicts a comment in the code, it wins and the code is wrong.
Read it before changing a price, a fee, a surcharge or anything the business promises, and add a line to
it when you change one.

### Where the rules live

| Rule | File |
| --- | --- |
| Prices, surcharges, tax, what each side pays and gets | `src/lib/jobs/pricing.ts` |
| Logging a job, guest reports, cancelling | `src/lib/jobs/create.ts` |
| Arriving, quotes, finishing, "could not get in" | `src/lib/jobs/work.ts` |
| The offer cascade: first choice, backup, everyone, dispatcher | `src/lib/dispatch/cascade.ts` |
| Everything the clock drives | `src/lib/dispatch/tick.ts`, called by `/api/cron/tick` |
| Charging, paying tradies, credits, disputes, refunds | `src/lib/billing/settle.ts` |
| Memberships and referrals | `src/lib/properties/service.ts` |
| The dispatcher's queue | `src/lib/ops/exceptions.ts` |
| Who is signed in and what they may open | `src/lib/auth/current.ts` |
| One-tap links in texts | `src/lib/links.ts`, `src/lib/access/links.ts` |
| The words of every text | `src/lib/notify/messages.ts` |
| Stripe | `src/lib/payments/stripe-gateway.ts`, `product-events.ts`, `deposit.ts` |

### Rules that must not be broken

- **Never lose a lead.** Saving and alerting are separate. If saving fails, the alert still goes out with
  every detail (`src/lib/leads/service.ts`).
- **Money is whole cents plus a currency.** Never a decimal. Format with `formatMoney` (`src/lib/money.ts`).
- **Every money movement changes its record and writes the audit entry in the same database step**
  (`db.tx`), and is safe to call twice. A call to Stripe is claimed first, made with an idempotency key,
  then recorded (`src/lib/billing/settle.ts`).
- **The audit log is append-only.** Never add update or delete access to it.
- **All times come from the app's clock** (`now()` in `src/lib/clock.ts`), never `new Date()` or the
  database's `now()`. The tests and the demo move that clock.
- **Nothing tied to one town, currency or tax rate.** Those live on the market row in the database.
- **The real prices are researched but not loaded yet.** `seed/menu-queenstown.proposed.json` holds 59
  researched Queenstown jobs and is the file that should replace the live menu. Swapping it in breaks 27
  money tests on purpose and is a task in `DECISIONS.md`. Until then `seed/menu-queenstown.json` is still
  placeholders and nothing may be shown to a real owner as a price. The researched prices sit at local
  market rate, not above it, so nothing may tell an owner they pay a premium for price certainty.
- **There is one membership.** Essential, 24-hour response. Urgent response is an add-on the owner pays
  for, never an inclusion. Priority was removed because delivering it cost more than it charged
  (`DECISIONS.md`). A surcharge always goes to the tradie in full.
- **Urgent work is never discounted.** Whatever rate a tradie is on for booked work, same-day, urgent
  and after-hours jobs pay the full card rate. A discounted urgent rate puts the network last in a cold
  snap, which is when the response guarantee is actually tested.
  `config/markets.ts` only seeds a market that does not exist yet.
- **Licensed work is only offered to a tradie with a licence on file that has not expired.** Checked when
  offering and again when accepting or assigning.
- **A link in a text never changes anything by being opened.** Phones and chat apps open links to preview
  them. Accepting needs a button press.
- **Plain language on every screen.** No jargon. Error messages say what to do next.
- **Never promise tradies money in the bank faster than Stripe pays it** (`payoutArrival` in
  `config/markets.ts`). A test fails if "48 hours" returns to the tradie page.
- **No legal wording.** Terms, privacy, tradie agreement and insurance stay as placeholders until a lawyer
  writes them (`docs/LEGAL-TODO.md`).
- **Secrets only in environment variables.** Add new ones to `.env.example`, `SETUP.md`, `tests/setup.ts`,
  `playwright.config.ts` and the setup checklist (`src/lib/status.ts`).
- **People only see their own data.** Every query for an owner or tradie takes their id. Private pages
  call `requireOwner()`, `requireTradie()`, `requireStaff()` or `requireAdminRole()` themselves. The proxy
  is a convenience, not the lock. Every table has Row Level Security on with no policies. Extend
  `tests/unit/access.test.ts` and the "people only see their own data" browser test with anything new.

### Next.js 16 with Cache Components: what bit us

- A component that depends on the visitor must touch the request (`await connection()`, `cookies()`)
  **before any early return**. Otherwise the build can freeze it as fixed content.
- `now()` and random values need `await connection()` first, inside `<Suspense>`. `currentViewer()` and
  `currentStaff()` do this for signed-in pages. Public token pages (`/r`, `/j`, `/o`) do it themselves.
- `usePathname()` in a layout above a dynamic route needs its own `<Suspense>` (`NavLink`, `MetaPixel`).
- Page-level redirects for signed-out visitors arrive after the page has started streaming. `src/proxy.ts`
  does the proper redirect first.
- A server action that redirects to a **route handler** never lands. Redirect to a page.
- `updateTag` works only inside a server action. Public pages for a market added after the build need
  `revalidatePath` and an uncached fallback (`publicMarketNow`).
- Files read at run time (`content/*.md`, `supabase/migrations/*.sql`) must be listed in
  `outputFileTracingIncludes` in `next.config.ts`.
- After a form action React resets the form. Use hidden inputs with button-style choices, or a `key` tied
  to the saved value (`src/components/jobs/ReportForm.tsx`, `src/components/forms/Fields.tsx`).
- Next keeps the page you came from in the DOM, hidden. Browser tests must look at visible text only
  (`shown()` in `e2e/product.spec.ts`).

### Before saying something is done

```bash
npm run check                          # lint, types, unit tests
npx next build && npm run test:e2e     # real browser, phone size, three copies of the site
npm run test:db                        # needs DATABASE_URL for a throwaway Postgres
```

- Tests run during every deploy with the real keys present. `tests/setup.ts` hides them from the tests.
- Unit tests run on a real Postgres engine inside the test process (`tests/unit/db.ts`), with the real
  migrations. `npm run test:db` repeats them on a real server, which is where the same-second races are proven.
- Outside services are tested against stand-ins (`tests/unit/helpers.ts`, `e2e/fake-stripe.mjs`, the demo
  payment gateway). **The Stripe calls for memberships, job charges and tradie payouts have never run
  against a real Stripe account.** `docs/STRIPE-TEST-CHECKLIST.md` is the manual run.
- Read the provider's current documentation before changing any call to an outside service. Do not rely
  on memory.
- To look at the product: `npm run demo`, then `/demo`. Delete `.data/` to reset the sample business.
