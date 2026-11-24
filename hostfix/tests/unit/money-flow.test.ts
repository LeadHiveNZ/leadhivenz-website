import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addGoodwillCredit, applyPendingCredits, chargeDuePayments, chargeJob, flagAtRisk, markMissedWindows, MAX_CHARGE_ATTEMPTS, raiseDispute, releaseDuePayouts, resolveDispute, retryPayout } from "@/lib/billing/settle";
import { ownerStatement } from "@/lib/billing/statements";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { getMarket } from "@/lib/markets/store";
import { clearHourlyRate, hourlyRate, hourlyRates, saveHourlyRate } from "@/lib/jobs/rates";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { cancelJob } from "@/lib/jobs/create";
import { getJobForStaff, listLines, listQuotes } from "@/lib/jobs/store";
import { completeJob, decideQuote, markEnRoute, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { saveBilling, unpaidJobs } from "@/lib/owners/service";
import { addParts } from "@/lib/jobs/parts";
import { DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import type { Property } from "@/lib/properties/service";
import { testDb } from "./db";
import { addPlusTier, arrive, auditActions, cardDeclinesFromNow, gatewayFor, holdRanOut, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, MONDAY_9PM, offersFor, openExceptions, photo, textsTo, messagesTo } from "./factory";

/**
 * THE PRICES THESE TESTS ARE BUILT ON. They come from seed/menu-queenstown.json
 * (whole dollars there, cents here) and were worked out by hand from that file:
 *
 *   PL-01  Toilet seat or cistern parts     owner 22500   tradie 19000   we keep 3500
 *   PL-03, PL-04, PL-06, PL-07 (plumbing)   owner 23500   tradie 20000   we keep 3500
 *   Urgent surcharge 5000 and after-hours surcharge 14000 (DECISIONS.md, 2026-11-18). Both carry
 *   the 15% fee: urgent 5000 - 750 = 4250 to the tradie, after hours 14000 - 2100 = 11900
 *   Off-menu call-out                       owner 22500   tradie 19000   we keep 3500
 *   A quote takes the job over the limit when quotes add up to more than 60000
 *   Parts above 15000 need the owner's yes whatever the total
 *   Off-menu labour: the tradie gets 85%. Parts (DECISIONS.md, 2026-11-20) are in tests/unit/parts.test.ts.
 *   Essential membership: free to join (DECISIONS.md, 2026-11-17). No monthly price.
 *   Missed promise: nothing is credited any more (DECISIONS.md, 2026-11-18). A credit made before
 *   then still comes off its own job's charge.
 *
 * A job logged without a code is PL-01.
 *
 * IF THE MENU CHANGES, WORK EVERY NUMBER OUT AGAIN FROM THE FILE. Never paste
 * in what the code returns: these tests are the only independent check on the
 * money, and a test copied from the code's output checks nothing.
 */

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

type Setup = Awaited<ReturnType<typeof setup>>;

async function setup(options: { tier?: "essential" | "plus"; card?: "ok" | "declines"; market?: Record<string, unknown>; trades?: string[] } = {}) {
  // These tests are about the money, and finish a job in the same minute the tradie arrives. The time-on-site
  // check (10 minutes by default) is switched off here; tests/unit/job-checks.test.ts covers it at its default.
  await liveMarket(t.db, { min_minutes_on_site: 0, ...options.market });
  // A card that declines from the start would decline the hold placed when the job goes out, and the job would
  // never be sent (DECISIONS.md, 2026-11-23). "declines" here is a card that was fine at booking, then declined,
  // and the hold on it ran out before the job was done: so the whole charge goes to the card, as before holds.
  const owner = await makeOwner(t.db, { card: "ok" });
  const property = await makeProperty(t.db, owner.ownerId, { tier: options.tier ?? "essential" });
  const tradie = await makeTradie(t.db, { slot: 1, afterHours: true, trades: options.trades ?? ["plumber"], licence: options.trades?.[0] === "handyman" ? "none" : "valid", name: "Wakatipu Plumbing" });
  return { owner, property, tradie, declinesLater: options.card === "declines" };
}

/** Logs a job and takes it as far as the tradie being on site. */
async function onSite(s: Setup, overrides: Parameters<typeof logJob>[2] = {}, property: Property = s.property) {
  const job = await logJob(t.db, property, overrides);
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  if (s.declinesLater) {
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    await holdRanOut(t.db, job.id);
  }
  await markEnRoute(t.db, job.id, s.tradie.tradieId);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  return arrived.job;
}

async function finish(s: Setup, jobId: string) {
  const result = await completeJob(t.db, jobId, s.tradie.tradieId, { note: "All sorted.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
  if (!result.ok) throw new Error(result.message);
  return result.job;
}

const payment = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number; tax_cents: number; attempts: number; refunded_cents: number; next_retry_at: Date | null; last_error: string | null }>("select * from public.payments where job_id = $1::uuid", [jobId]))[0];
const payout = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number; release_at: Date; transfer_id: string | null }>("select * from public.payouts where job_id = $1::uuid", [jobId]))[0];
const moneyLog = async (jobId: string) =>
  (await t.db.query<{ action: string; amount: number | null }>("select action, amount from public.audit_log where entity_id = $1 and amount is not null order by id", [jobId])).map((row) => `${row.action}:${row.amount}`);

describe("a finished menu job", () => {
  it("at a free Essential property is charged the menu price exactly as before, with no membership payment", async () => {
    const s = await setup();
    expect(s.property).toMatchObject({ status: "active", subscriptionId: null });
    const job = await onSite(s, { code: "PL-01" });
    const done = await finish(s, job.id);
    // PL-01: owner 225 dollars, tradie 190 dollars in the menu file.
    expect(done).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 19000 });
    expect(await t.db.query("select 1 from public.membership_invoices where property_id = $1::uuid", [s.property.id])).toEqual([]);
  });

  it("charges the owner the menu price, pays the tradie the menu payout a day later, and keeps the rest", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    setTestNow(addMinutes(MONDAY_10AM, 90));
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ status: "completed", outcome: "done", ownerTotalCents: 22500, tradieTotalCents: 19000 });

    // Recorded as owed in the same step as the job being marked done. The tradie's payment is scheduled at
    // once for 24 hours after Job done: it no longer waits for the card (DECISIONS.md, 2026-11-20, second entry).
    expect(await payment(job.id)).toMatchObject({ status: "pending", amount_cents: 22500 });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });

    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500, attempts: 1 });
    const due = await payout(job.id);
    expect(due).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    expect(new Date(due!.release_at).getTime()).toBe(addHours(addMinutes(MONDAY_10AM, 90), 24).getTime());

    const told = await messagesTo(t.db, s.owner.user.phone!, "job_done");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain("is done, NZ$225 charged.");

    // 23 hours on: still held. 24 hours on: sent.
    setTestNow(addHours(addMinutes(MONDAY_10AM, 90), 23));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    setTestNow(addHours(addMinutes(MONDAY_10AM, 90), 24));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
    expect((await messagesTo(t.db, s.tradie.phone, "payout_sent"))[0]!.body).toContain("NZ$190 for job");

    // The NZ$225 was held on the card when the job went out, and the charge was taken from that hold (DECISIONS.md, 2026-11-23).
    expect(await moneyLog(job.id)).toEqual(["job.created:22500", "hold.placed:22500", "job.completed:22500", "hold.captured:22500", "payment.succeeded:22500", "payout.sent:19000"]);
    // What the platform keeps is the difference. The menu sets each owner price at the tradie's
    // payout divided by 0.85, to the nearest NZ$5: 190 / 0.85 = 223.53, so NZ$225, and we keep NZ$35.
    expect(22500 - 19000).toBe(3500);
  });

  it("a charge cut off half-way is repeated with the same key, so it can never become two charges", async () => {
    const s = await setup();
    const job = await onSite(s);
    // With no hold left on the card, the whole charge is a separate charge on the saved card, as before holds.
    await holdRanOut(t.db, job.id);
    await finish(s, job.id);
    const keys: string[] = [];
    const base = gatewayFor(t.db)("NZ")!;
    let crash = true;
    const flaky = () => ({
      ...base,
      chargeJob: async (input: Parameters<typeof base.chargeJob>[0]) => {
        keys.push(input.idempotencyKey);
        if (crash) {
          crash = false;
          // The server dies before it can write anything down.
          throw new Error("connection lost");
        }
        return base.chargeJob(input);
      },
    });
    // The first try is recorded as a failure because the call threw: that is a definite answer.
    expect(await chargeJob(t.db, flaky, job.id)).toBe("failed");
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await chargeJob(t.db, flaky, job.id)).toBe("succeeded");
    expect(keys).toEqual([`hostfix-job-${job.id}-charge-1`, `hostfix-job-${job.id}-charge-2`]);

    // While one server holds the charge, another that tries at the same moment stands down.
    const second = await onSite(s, { code: "PL-03" });
    await finish(s, second.id);
    await t.db.query("update public.payments set claimed_until = $2::timestamptz where job_id = $1::uuid", [second.id, addHours(MONDAY_10AM, 25).toISOString()]);
    expect(await chargeJob(t.db, gatewayFor(t.db), second.id)).toBe("skipped");
    // Once the hold has lapsed (the first server died), the charge is picked up, still as try number one.
    setTestNow(addHours(MONDAY_10AM, 26));
    expect(await chargeJob(t.db, gatewayFor(t.db), second.id)).toBe("succeeded");
    expect(await payment(second.id)).toMatchObject({ status: "succeeded", attempts: 1 });
  });

  it("never charges twice and never pays twice, however often it is asked", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    expect((await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [], ...HOUSE })).ok).toBe(true);
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("skipped");
    setTestNow(addHours(MONDAY_10AM, 30));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);

    expect((await moneyLog(job.id)).filter((line) => line.startsWith("payment.succeeded"))).toHaveLength(1);
    expect((await moneyLog(job.id)).filter((line) => line.startsWith("payout.sent"))).toHaveLength(1);
    expect(await messagesTo(t.db, s.owner.user.phone!, "job_done")).toHaveLength(1);
    expect((await t.db.query("select 1 from public.payments where job_id = $1::uuid", [job.id])).length).toBe(1);
  });

  it("cannot be finished without a photo", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await completeJob(t.db, job.id, s.tradie.tradieId, { note: "Done", uploadIds: [], ...HOUSE });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.message).toContain("photo");
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("on_site");
    expect(await payment(job.id)).toBeUndefined();
  });

  it("cannot be finished with someone else's photo, or before arriving", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    const mine = await photo(t.db, `tradie:${s.tradie.tradieId}`);
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [mine], ...HOUSE })).toMatchObject({ ok: false });

    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    const stranger = await photo(t.db, "tradie:00000000-0000-4000-8000-000000000000");
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [stranger], ...HOUSE })).toMatchObject({ ok: false });
  });

  it("is run end to end by the timer alone", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    // The charge was never attempted (say the server restarted). The timer picks it up.
    setTestNow(addMinutes(MONDAY_10AM, 5));
    const first = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(first.cards_charged).toBe(1);
    setTestNow(addHours(MONDAY_10AM, 25));
    const second = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(second.payouts_sent).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent" });
  });
});

describe("surcharges", () => {
  it("urgent: the owner pays NZ$50 more and the tradie gets it less our 15%", async () => {
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    // PL-01 urgent. Owner 22500 + 5000 = 27500. Tradie 19000 + 4250 = 23250.
    expect(job).toMatchObject({ urgency: "urgent", afterHours: false, ownerTotalCents: 27500, tradieTotalCents: 23250, responseHours: 4 });
    const done = await finish(s, job.id);
    // We keep 3500 on the job and 750 on the surcharge: 4250.
    expect(done.ownerTotalCents - done.tradieTotalCents).toBe(4250);
    expect(await payout(job.id)).toMatchObject({ amount_cents: 23250 });
  });

  it("urgent at 9pm: after-hours is added too, and both carry our 15%", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    // Owner 22500 + 5000 + 14000 = 41500. Tradie 19000 + 4250 + 11900 = 35150. We keep 3500 + 750 + 2100 = 6350.
    expect(job).toMatchObject({ afterHours: true, ownerTotalCents: 41500, tradieTotalCents: 35150 });
    expect((await listLines(t.db, job.id)).map((line) => [line.kind, line.ownerCents, line.tradieCents])).toEqual([
      ["menu", 22500, 19000],
      ["urgent", 5000, 4250],
      ["after_hours", 14000, 11900],
    ]);
  });

  it("a job already logged keeps the surcharge it was quoted when the market's price changes", async () => {
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    // Logged at urgent 5000: owner 27500, tradie 23250. Then the admin puts urgent up to 9000.
    await t.db.query("update public.markets set urgent_surcharge_cents = 9000 where slug = $1", [s.property.market]);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ownerTotalCents: 27500, tradieTotalCents: 23250 });
    expect(await payment(job.id)).toMatchObject({ amount_cents: 27500 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 23250 });
  });

  it("a normal job logged at 9pm has no surcharge: it is done in working hours", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await logJob(t.db, s.property);
    expect(job).toMatchObject({ afterHours: false, ownerTotalCents: 22500 });
  });

  // The business sells one membership and urgent is always paid for (DECISIONS.md). The app can still
  // hold a membership that includes urgent call-outs, and the rule that matters must hold if one is ever
  // added: the owner is let off the surcharge, the tradie never is.
  it("on a membership that includes urgent, the owner is not charged for it and the tradie still gets their share", async () => {
    await addPlusTier(t.db);
    const s = await setup({ tier: "plus" });
    const job = await onSite(s, { urgent: true });
    // The owner pays the 22500 job only. The tradie gets 19000 + their 4250 share of the 5000 urgent surcharge.
    expect(job).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 + 4250 });
    const lines = await listLines(t.db, job.id);
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 0, tradieCents: 4250 });
    expect(lines[1]!.label).toContain("included");
  });

  it("the included urgent call-outs can be capped per month", async () => {
    await addPlusTier(t.db, { urgentIncludedPerMonth: 1 });
    const s = await setup({ tier: "plus" });
    const first = await onSite(s, { code: "PL-01", urgent: true });
    expect(first.ownerTotalCents).toBe(22500);
    await finish(s, first.id);
    // The month's one included call-out is used. The next is charged: PL-03 plus the surcharge.
    const second = await logJob(t.db, s.property, { code: "PL-03", urgent: true });
    expect(second.ownerTotalCents).toBe(23500 + 5000);
    // A cancelled job does not use up the allowance.
    await cancelJob(t.db, first.id, { actor: "staff:x", staff: true }, "test");
  });
});

describe("the database change for urgent at NZ$50", () => {
  const file = path.resolve(__dirname, "../../supabase/migrations/20261122000000_urgent_fifty.sql");
  const urgent = async (slug: string) => (await getMarket(t.db, slug))!.urgentSurchargeCents;

  it("moves Queenstown from 9000 to 5000, and a second run does nothing", async () => {
    await liveMarket(t.db);
    // A database set up before the change still says NZ$90.
    await t.db.query("update public.markets set urgent_surcharge_cents = 9000 where slug = 'queenstown'");
    await t.db.exec(fs.readFileSync(file, "utf8"));
    expect(await urgent("queenstown")).toBe(5000);
    await t.db.exec(fs.readFileSync(file, "utf8"));
    expect(await urgent("queenstown")).toBe(5000);
    expect((await getMarket(t.db, "queenstown"))!.afterHoursSurchargeCents).toBe(14000);
  });

  it("leaves a price the admin has already changed by hand", async () => {
    await liveMarket(t.db);
    await t.db.query("update public.markets set urgent_surcharge_cents = 7000 where slug = 'queenstown'");
    await t.db.exec(fs.readFileSync(file, "utf8"));
    expect(await urgent("queenstown")).toBe(7000);
  });

  it("does not touch jobs already logged at NZ$90", async () => {
    const s = await setup();
    await t.db.query("update public.markets set urgent_surcharge_cents = 9000 where slug = 'queenstown'");
    // Logged while urgent was 9000, before the fee applied to surcharges, so stored as the old rule wrote it.
    const job = await onSite(s, { urgent: true });
    await t.db.query("update public.job_lines set tradie_cents = 9000 where job_id = $1::uuid and kind = 'urgent'", [job.id]);
    await t.db.exec(fs.readFileSync(file, "utf8"));
    const lines = await listLines(t.db, job.id);
    expect(lines.map((line) => [line.kind, line.ownerCents, line.tradieCents])).toEqual([["menu", 22500, 19000], ["urgent", 9000, 9000]]);
  });
});

describe("tax", () => {
  it("records no tax while the business is not registered for it", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    expect(await payment(job.id)).toMatchObject({ tax_cents: 0 });
  });

  it("records the GST inside the price once the market is marked as registered", async () => {
    const s = await setup({ market: { tax_registered: true } });
    const job = await onSite(s, { urgent: true });
    await finish(s, job.id);
    // NZ$275 (the NZ$225 job plus NZ$50 urgent) including 15% GST. The GST inside a price that includes
    // it is 3/23 of the price: 275 x 3 / 23 = 35.8695..., so NZ$35.87 to the nearest cent.
    expect(await payment(job.id)).toMatchObject({ amount_cents: 27500, tax_cents: 3587 });
  });

  it("uses each market's own rate", async () => {
    const s = await setup({ market: { tax_registered: true, tax_rate: 0.1 } });
    const job = await onSite(s);
    await finish(s, job.id);
    // NZ$225 including 10% GST: one eleventh of the price is tax. 225 / 11 = 20.4545..., so NZ$20.45.
    expect(await payment(job.id)).toMatchObject({ amount_cents: 22500, tax_cents: 2045 });
  });
});

describe("when the card is declined", () => {
  it("still schedules the tradie's payment, tells the owner, flags the dispatcher, and tries again the next day", async () => {
    const s = await setup({ card: "declines" });
    const job = await onSite(s);
    await finish(s, job.id);

    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("failed");
    const failed = await payment(job.id);
    expect(failed).toMatchObject({ status: "failed", attempts: 1, last_error: "The card was declined." });
    expect(new Date(failed!.next_retry_at!).getTime()).toBe(addHours(MONDAY_10AM, 24).getTime());
    expect(await payout(job.id)).toMatchObject({ status: "scheduled" });
    expect(await openExceptions(t.db, job.id)).toEqual(["payment_failed"]);
    expect((await messagesTo(t.db, s.owner.user.phone!, "payment_failed"))[0]!.body).toContain("could not charge your card NZ$225");
    expect(await messagesTo(t.db, s.owner.user.phone!, "job_done")).toHaveLength(0);

    // 23 hours on: inside the usual 24-hour hold, so nothing is sent yet (tests/unit/safety-and-money.test.ts
    // follows a declined card to the tradie being paid at 24 hours).
    setTestNow(addHours(MONDAY_10AM, 23));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect(await chargeDuePayments(t.db, gatewayFor(t.db))).toBe(0);

    // The owner fixes their card. The next day's retry goes through.
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_fixed", card: DEMO_CARD_OK });
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await chargeDuePayments(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", attempts: 2 });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled" });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    // The owner is only texted about the failure once, however many times it fails.
    expect(await messagesTo(t.db, s.owner.user.phone!, "payment_failed")).toHaveLength(1);
  });

  it("gives up after four tries and leaves it with the dispatcher", async () => {
    const s = await setup({ card: "declines" });
    const job = await onSite(s);
    await finish(s, job.id);
    for (let attempt = 0; attempt < MAX_CHARGE_ATTEMPTS; attempt += 1) {
      setTestNow(addHours(MONDAY_10AM, 24 * attempt));
      expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("failed");
    }
    expect(await payment(job.id)).toMatchObject({ status: "failed", attempts: 4, next_retry_at: null });
    setTestNow(addHours(MONDAY_10AM, 24 * 6));
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("skipped");
    // The tradie's payment is not held back by the card: it stays scheduled for the timer.
    expect(await payout(job.id)).toMatchObject({ status: "scheduled" });
    expect(await openExceptions(t.db, job.id)).toEqual(["payment_failed", "owner_owes"]);
  });

  it("lets a person on the team try the card again after the automatic tries have stopped, and pays the tradie once it goes through", async () => {
    const s = await setup({ card: "declines" });
    const job = await onSite(s);
    await finish(s, job.id);
    for (let attempt = 0; attempt < MAX_CHARGE_ATTEMPTS; attempt += 1) {
      setTestNow(addHours(MONDAY_10AM, 24 * attempt));
      await chargeJob(t.db, gatewayFor(t.db), job.id);
    }
    setTestNow(addHours(MONDAY_10AM, 24 * 6));

    // Still the declining card: the manual try fails too, and is counted.
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id, { force: true })).toBe("failed");
    expect(await payment(job.id)).toMatchObject({ status: "failed", attempts: 5 });

    // The owner is shown it on their home screen. Another owner is not.
    expect(await unpaidJobs(t.db, s.owner.ownerId)).toEqual([{ jobId: job.id, number: job.number, title: job.title, amountCents: 22500, currency: "NZD" }]);
    expect(await unpaidJobs(t.db, (await makeOwner(t.db)).ownerId)).toEqual([]);

    // The owner updates their card. The next manual try charges it, exactly once.
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_fixed", card: DEMO_CARD_OK });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id, { force: true })).toBe("succeeded");
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id, { force: true })).toBe("skipped");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", attempts: 6 });
    expect(await unpaidJobs(t.db, s.owner.ownerId)).toEqual([]);
    expect(await payout(job.id)).toMatchObject({ status: "scheduled" });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    expect((await moneyLog(job.id)).filter((line) => line.startsWith("payment.succeeded"))).toHaveLength(1);
  });
});

describe("when the owner says something is wrong", () => {
  it("holds the tradie's money, calls in the dispatcher and tells both people", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);

    setTestNow(addHours(MONDAY_10AM, 3));
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "The toilet is still blocked.");
    expect(dispute).toMatchObject({ ok: true, payoutPaused: true });
    expect(await payout(job.id)).toMatchObject({ status: "paused" });
    expect(await openExceptions(t.db, job.id)).toEqual(["dispute"]);
    expect(await messagesTo(t.db, s.tradie.phone, "payout_on_hold")).toHaveLength(1);
    expect(await messagesTo(t.db, s.owner.user.phone!, "dispute_received")).toHaveLength(1);

    // The hold window passing does not release it.
    setTestNow(addHours(MONDAY_10AM, 48));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect(await payout(job.id)).toMatchObject({ status: "paused" });

    // Raising it again changes nothing.
    expect(await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Still blocked!")).toMatchObject({ ok: true, payoutPaused: false });
  });

  it("resolved for the tradie: they are paid in full straight away", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Not happy");
    if (!dispute.ok) throw new Error("expected a dispute");

    setTestNow(addHours(MONDAY_10AM, 5));
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "pay_tradie" }, "Photos show it was fixed", "staff:va")).toEqual({ ok: true });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", refunded_cents: 0 });
  });

  it("full refund: the owner gets everything back and the tradie is paid nothing", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Nothing was done");
    if (!dispute.ok) throw new Error("expected a dispute");

    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 22500 }, "No work done", "staff:va")).toEqual({ ok: true });
    expect(await payment(job.id)).toMatchObject({ status: "refunded", refunded_cents: 22500 });
    expect(await payout(job.id)).toMatchObject({ status: "cancelled" });
    setTestNow(addHours(MONDAY_10AM, 72));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect(await moneyLog(job.id)).toEqual(["job.created:22500", "hold.placed:22500", "job.completed:22500", "hold.captured:22500", "payment.succeeded:22500", "refund.issued:22500", "payout.reduced:19000"]);
  });

  it("part refund: it comes off the tradie's share and the platform's share in proportion", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Left a mess");
    if (!dispute.ok) throw new Error("expected a dispute");

    // Half back to the owner: NZ$112.50 of the NZ$225. The tradie's NZ$190 becomes NZ$95, and the platform's NZ$35 becomes NZ$17.50.
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 11250 }, "Half back", "staff:va")).toEqual({ ok: true });
    expect(await payment(job.id)).toMatchObject({ status: "part_refunded", refunded_cents: 11250 });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 9500 });
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 9500 });
    const refund = await t.db.query<{ detail: { from_tradie: number; from_platform: number } }>("select detail from public.audit_log where entity_id = $1 and action = 'refund.issued'", [job.id]);
    // The two shares add back up to the refund: 9500 + 1750 = 11250.
    expect(refund[0]!.detail).toMatchObject({ from_tradie: 9500, from_platform: 1750 });
  });

  it("refuses a refund bigger than the owner paid, and a second resolution", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Not happy");
    if (!dispute.ok) throw new Error("expected a dispute");
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 22501 }, "", "staff:va")).toMatchObject({ ok: false });
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 0 }, "", "staff:va")).toMatchObject({ ok: false });
    expect(await payment(job.id)).toMatchObject({ refunded_cents: 0 });

    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 5000 }, "", "staff:va")).toEqual({ ok: true });
    // Already resolved: a second go does nothing more.
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 5000 }, "", "staff:va")).toEqual({ ok: true });
    expect(await payment(job.id)).toMatchObject({ refunded_cents: 5000 });
  });

  it("raised after the tradie was paid: the dispatcher is told the money has already gone", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    setTestNow(addHours(MONDAY_10AM, 30));
    await releaseDuePayouts(t.db, gatewayFor(t.db));
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "It broke again");
    expect(dispute).toMatchObject({ ok: true, payoutPaused: false });
    const queue = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'dispute'", [job.id]);
    expect(queue[0]!.summary).toContain("already been paid");
    if (!dispute.ok) throw new Error("expected a dispute");
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 22500 }, "", "staff:va")).toEqual({ ok: true });
    expect(await payout(job.id)).toMatchObject({ status: "reversed" });
    expect(await auditActions(t.db, job.id)).toContain("payout.reversed");
  });

  it("only works on a finished job", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property);
    expect(await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Where is he?")).toMatchObject({ ok: false });
  });
});

describe("the promised time", () => {
  // Missing it no longer costs HostFix anything (DECISIONS.md, 2026-11-18). It is tracked, and the
  // dispatcher is told: an accepted job with nobody there is a no-show ("call the tradie").

  it("credits nothing when nobody is on site by the promised time, and charges and pays the job as normal", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));

    // One minute before the 24 hours are up: nothing.
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), -1));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 0, noShows: 0 });

    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 1, noShows: 1 });
    expect(await t.db.query("select 1 from public.credits")).toHaveLength(0);
    const marked = (await getJobForStaff(t.db, job.id))!;
    expect(marked.windowMissedAt).not.toBeNull();
    expect(marked.noShowAt).not.toBeNull();
    // Accepted and nobody there: the dispatcher is asked to call the tradie.
    expect(await openExceptions(t.db, job.id)).toContain("no_show");
    const [raised] = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'no_show'", [job.id]);
    expect(raised!.summary).toContain("Wakatipu Plumbing accepted and is not on site");
    expect(raised!.summary).toContain("Call the tradie");
    expect(await textsTo(t.db, s.owner.user.phone!, "window_missed")).toHaveLength(0);
    expect(await auditActions(t.db, job.id)).toEqual(expect.arrayContaining(["job.window_missed", "job.no_show"]));
    expect(await auditActions(t.db, job.id)).not.toContain("credit.created");
    // Running the check again changes nothing.
    expect(await markMissedWindows(t.db)).toEqual({ missed: 0, noShows: 0 });

    // The tradie gets there late and finishes. PL-01 has no surcharge, so the owner pays 22500 and the tradie gets 19000.
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    if (!arrived.ok) throw new Error(arrived.message);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await payment(job.id)).toMatchObject({ status: "pending", amount_cents: 22500 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 19000 });
  });

  it("a job nobody has taken by the promised time is a miss, not a no-show", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 1, noShows: 0 });
    expect(await openExceptions(t.db, job.id)).toContain("missed_window");
    expect((await getJobForStaff(t.db, job.id))!.noShowAt).toBeNull();
  });

  it("a missed-promise credit made before the change still comes off its own job's charge", async () => {
    // As the old timer wrote it on 17 November: the call-out, min(22500, the job's 22500) = 22500.
    const s = await setup();
    const job = await logJob(t.db, s.property, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    // Off-menu: the job starts at the diagnosis fee, owner 22500, tradie 19000.
    expect(job).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    await t.db.query(
      `insert into public.credits (created_at, owner_id, property_id, job_id, reason, amount_cents, currency, month, status, note, created_by)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, 'missed_window', 22500, 'NZD', '2026-11', 'pending', 'Made before the change', 'system')`,
      [MONDAY_10AM.toISOString(), s.owner.ownerId, s.property.id, job.id],
    );
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    if (!arrived.ok) throw new Error(arrived.message);
    // The tradie quotes 3.75 hours at the plumber's NZ$160: 60000 of work. The call-out credit (DECISIONS.md, 2026-11-20,
    // third entry) takes the 22500 call-out off it, so the owner is asked for 37500 more, inside the 60000 limit.
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", hours: 3.75, uploadIds: [] });
    if (!quoted.ok) throw new Error(quoted.message);
    const done = await finish(s, job.id);
    // Owner: 22500 call-out + 60000 - 22500 credit = 60000. Tradie: 19000 + (60000 - 22500) x 0.85 = 19000 + 31875 = 50875.
    expect(done).toMatchObject({ ownerTotalCents: 60000, tradieTotalCents: 50875 });
    // Charged 60000 - the old 22500 missed-time credit = 37500. The tradie still gets all 50875.
    expect(await payment(job.id)).toMatchObject({ status: "pending", amount_cents: 37500 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 50875 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect((await t.db.query<{ status: string }>("select status from public.credits where job_id = $1::uuid", [job.id]))[0]!.status).toBe("applied");
    // It came off this job, so nothing goes to the payment company as a separate credit.
    expect(await applyPendingCredits(t.db, gatewayFor(t.db))).toBe(0);

    const market = (await getMarket(t.db, "queenstown"))!;
    const statement = await ownerStatement(t.db, s.owner.ownerId, market, "2026-11");
    expect(statement.lines.filter((line) => line.kind === "job").map((line) => [line.description, line.amountCents])).toEqual([
      [`Job ${job.number}: Leak under the sink (NZ$225 off: we missed our promised time)`, 37500],
    ]);
    expect(statement).toMatchObject({ jobsCents: 37500, creditsCents: 0, membershipCents: 0, totalCents: 37500 });
  });

  it("does not mark a miss when the tradie arrived in time, even by a minute", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), -1));
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    setTestNow(addHours(MONDAY_10AM, 30));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 0, noShows: 0 });
    const arrived = await t.db.query<{ detail: { on_time: boolean } }>("select detail from public.audit_log where entity_id = $1 and action = 'job.arrived'", [job.id]);
    expect(arrived[0]!.detail.on_time).toBe(true);
  });

  it("uses the 4-hour window for an urgent job", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { urgent: true });
    setTestNow(addMinutes(addHours(MONDAY_10AM, 4), -1));
    expect((await markMissedWindows(t.db)).missed).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 4));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 1, noShows: 0 });
    expect(job.responseHours).toBe(4);
  });

  it("never marks a cancelled job or a guest report still waiting for the owner", async () => {
    const s = await setup();
    const cancelled = await logJob(t.db, s.property, { code: "PL-01" });
    await cancelJob(t.db, cancelled.id, { actor: `owner:${s.owner.ownerId}` }, "Changed my mind");
    await logJob(t.db, s.property, { code: "PL-03", reportedBy: "guest" });
    setTestNow(addHours(MONDAY_10AM, 48));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 0, noShows: 0 });
  });

  it("warns the dispatcher three quarters of the way to the promised time", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property);
    setTestNow(addHours(MONDAY_10AM, 17));
    expect(await flagAtRisk(t.db)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 18));
    expect(await flagAtRisk(t.db)).toBe(1);
    expect(await flagAtRisk(t.db)).toBe(0);
    expect(await openExceptions(t.db, job.id)).toEqual(["at_risk"]);
    // Arriving clears it.
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    expect(await openExceptions(t.db, job.id)).toEqual([]);
  });
});

describe("off-menu work and quotes", () => {
  it("starts with the fixed diagnosis fee, and is a diagnosis-only job if nothing more is approved", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Water coming through the ceiling" });
    expect(job).toMatchObject({ offMenu: true, licenceRequired: true, ownerTotalCents: 22500, tradieTotalCents: 19000 });
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "diagnosis_only", ownerTotalCents: 22500, tradieTotalCents: 19000 });
  });

  it("an off-menu quote the owner approves has the NZ$225 call-out taken off it, for both sides in proportion (DECISIONS.md, 2026-11-20, third entry)", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    // 3.75 hours at NZ$160 = 60000 of work. Less the 22500 call-out credit: the owner is asked for 37500 more,
    // inside the NZ$600 limit, so it goes ahead. The tradie gets 85% of 37500 = 31875 more (the fee is 5625).
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", hours: 3.75, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    expect(result.quote).toMatchObject({ status: "auto_approved", needsApproval: false, hours: 3.75, rateCents: 16000, labourCents: 60000, creditCents: 22500, ownerTotalCents: 37500, tradieTotalCents: 31875 });
    // Owner: 22500 + 60000 - 22500 = 60000. Tradie: the 19000 call-out payout + 31875 = 50875. HostFix keeps 9125.
    expect(result.job).toMatchObject({ status: "on_site", ownerTotalCents: 60000, tradieTotalCents: 50875 });
    const lines = (await listLines(t.db, job.id)).filter((line) => line.status === "active").map((line) => [line.kind, line.ownerCents, line.tradieCents]);
    // The credit line: owner -22500; tradie 31875 - 51000 = -19125.
    expect(lines).toEqual([["diagnosis", 22500, 19000], ["quote", 60000, 51000], ["adjustment", -22500, -19125]]);
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_going_ahead"))[0]!.body).toContain("is doing NZ$375 more work");
    const done = await finish(s, job.id);
    expect(done.outcome).toBe("done");
  });

  it("an off-menu quote the owner declines leaves the NZ$225 call-out standing", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Hot water cylinder leaking" });
    // 5.75 hours = 92000. Less 22500: 69500 more, over the 60000 limit, so it waits for the owner.
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace cylinder", hours: 5.75, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    expect(result.quote).toMatchObject({ status: "pending", needsApproval: true, ownerTotalCents: 69500 });
    const declined = await decideQuote(t.db, result.quote.id, false, `owner:${s.owner.ownerId}`);
    if (!declined.ok) throw new Error(declined.message);
    expect(declined.job).toMatchObject({ status: "on_site", ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await textsTo(t.db, s.tradie.phone, "quote_declined")).toHaveLength(1);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "diagnosis_only", ownerTotalCents: 22500 });
    expect((await listLines(t.db, job.id)).filter((line) => line.status === "void").map((line) => line.kind)).toEqual(["quote", "adjustment"]);
  });

  it("an off-menu quote over the limit stops everything until the owner says yes", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Hot water cylinder leaking" });
    // 5.5 hours = 88000 of work. Less the 22500 credit: 65500 more, over 60000.
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace cylinder valve", hours: 5.5, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    // The tradie's share: 65500 less 15% (9825) = 55675.
    expect(result.quote).toMatchObject({ status: "pending", needsApproval: true, ownerTotalCents: 65500, tradieTotalCents: 55675 });
    // Nothing is added to the bill yet, and the job cannot be finished.
    expect(result.job).toMatchObject({ status: "awaiting_approval", ownerTotalCents: 22500 });
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_needs_approval"))[0]!.body).toContain("quoted NZ$655 for more work");
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE })).toMatchObject({ ok: false });
    expect(await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Another", hours: 0.25, uploadIds: [] })).toMatchObject({ ok: false });

    const approved = await decideQuote(t.db, result.quote.id, true, `owner:${s.owner.ownerId}`);
    if (!approved.ok) throw new Error(approved.message);
    // Owner: 22500 + 88000 - 22500 = 88000. Tradie: 19000 + 55675 = 74675.
    expect(approved.job).toMatchObject({ status: "on_site", ownerTotalCents: 88000, tradieTotalCents: 74675 });
    expect((await textsTo(t.db, s.tradie.phone, "quote_approved"))[0]!.body).toContain("approved your NZ$655 quote");
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "done", ownerTotalCents: 88000 });
    // Deciding again changes nothing.
    await decideQuote(t.db, result.quote.id, false, `owner:${s.owner.ownerId}`);
    expect((await listQuotes(t.db, job.id))[0]!.status).toBe("approved");
  });

  it("on a menu job, extra work up to the NZ$600 limit goes ahead: 3.75 hours at NZ$160 is exactly 60000", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", hours: 3.75, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    // No call-out credit on a menu job: the described job is still done at the menu price. 600 x 0.85 = 510.
    expect(result.quote).toMatchObject({ status: "auto_approved", ownerTotalCents: 60000, tradieTotalCents: 51000, creditCents: 0 });
    expect(result.job).toMatchObject({ ownerTotalCents: 22500 + 60000, tradieTotalCents: 19000 + 51000 });
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_going_ahead"))[0]!.body).toContain("in your limit");
  });

  it("a quarter hour over the limit needs the owner's yes: 4 hours is 64000", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", hours: 4, uploadIds: [] });
    expect(result.ok && result.quote).toMatchObject({ status: "pending", needsApproval: true, ownerTotalCents: 64000 });
  });

  it("work up to NZ$1,000 is quoted in quarter hours at the fixed rate; above it the tradie prices it their own way", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    const own = (labourCents: number) => submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Re-pipe the bathroom", labourCents, uploadIds: [] });
    // Their own price for NZ$1,000 or less is refused: it goes in hours at NZ$160.
    expect(await own(100000)).toEqual({ ok: false, message: "Work up to NZ$1,000 is quoted in hours at the fixed rate of NZ$160 an hour." });
    // Hours that come to more than NZ$1,000 are refused: 6.5 hours is 104000.
    expect(await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Re-pipe", hours: 6.5, uploadIds: [] })).toMatchObject({ ok: false });
    // Not a quarter hour.
    expect(await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Re-pipe", hours: 1.1, uploadIds: [] })).toMatchObject({ ok: false });
    // 6.25 hours is exactly 100000, allowed.
    const quarters = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Re-pipe", hours: 6.25, uploadIds: [] });
    expect(quarters.ok && quarters.quote).toMatchObject({ labourCents: 100000, hours: 6.25, rateCents: 16000, status: "pending" });
    await decideQuote(t.db, quarters.ok ? quarters.quote.id : "", false, `owner:${s.owner.ownerId}`);
    // Over NZ$1,000 their own price: 150000, tradie 127500.
    const big = await own(150000);
    expect(big.ok && big.quote).toMatchObject({ labourCents: 150000, hours: null, rateCents: null, ownerTotalCents: 150000, tradieTotalCents: 127500 });
  });

  it("the hourly rate is the market's, set on the admin screen, and the tradie cannot type another", async () => {
    const s = await setup();
    await saveHourlyRate(t.db, "queenstown", "plumber", 15000, "admin:test");
    const job = await onSite(s, { code: "PL-01" });
    // 1.5 hours at NZ$150 = 22500; the tradie gets 85%: 19125.
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace isolating valve", hours: 1.5, uploadIds: [] });
    expect(result.ok && result.quote).toMatchObject({ labourCents: 22500, rateCents: 15000, tradieTotalCents: 19125 });
    // Emptying the box takes the saved rate away: the plumber goes back to the confirmed NZ$160.
    await clearHourlyRate(t.db, "queenstown", "plumber", "admin:test");
    expect(await hourlyRate(t.db, "queenstown", "plumber")).toBe(16000);
    expect(await t.db.query("select 1 from public.audit_log where action = 'market.hourly_rate_cleared' and entity_id = 'queenstown'")).toHaveLength(1);
  });

  it("only plumbers, electricians, gasfitters and handymen have a fixed rate; every other trade quotes its own way (DECISIONS.md, 2026-11-24, second entry)", async () => {
    const rates = await hourlyRates(t.db, "queenstown");
    expect(rates).toEqual({ plumber: 16000, electrician: 16000, gasfitter: 17000, handyman: 11000 });
    for (const trade of ["cleaner", "window_cleaner", "gardener", "painter", "roofer", "pest_control", "carpet_cleaner", "pool_spa", "builder", "drainage_septic", "appliance_tech", "heat_pump_tech", "locksmith"]) {
      expect(await hourlyRate(t.db, "queenstown", trade), trade).toBeNull();
    }
    // A rate set for a trade and then emptied: back to no rate.
    await saveHourlyRate(t.db, "queenstown", "cleaner", 7000, "admin:test");
    expect(await hourlyRate(t.db, "queenstown", "cleaner")).toBe(7000);
    await clearHourlyRate(t.db, "queenstown", "cleaner", "admin:test");
    expect(await hourlyRate(t.db, "queenstown", "cleaner")).toBeNull();
  });

  it("small quotes cannot be stacked up past the limit without approval", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    // 2.25 hours (36000) is inside the NZ$600 limit by itself. A second 1.75 hours (28000) would take the extras to 64000, so it waits for a yes.
    const first = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace pan connector", hours: 2.25, uploadIds: [] });
    expect(first.ok && first.quote.status).toBe("auto_approved");
    const second = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace isolating valve", hours: 1.75, uploadIds: [] });
    expect(second.ok && second.quote.status).toBe("pending");
  });

  it("uses the owner's own limit when they have set one", async () => {
    const s = await setup();
    await t.db.query("update public.properties set spend_limit_cents = 10000 where id = $1::uuid", [s.property.id]);
    const job = await onSite(s, { code: "PL-01" }, { ...s.property, spendLimitCents: 10000 });
    const quote = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Extra", hours: 1, uploadIds: [] });
    expect(quote.ok && quote.quote.needsApproval).toBe(true);
  });

  it("cannot carry parts any more: parts are added on their own, at the price list or the receipt plus 20% (DECISIONS.md, 2026-11-20)", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-04" });
    expect(await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "New mixer", labourCents: 0, uploadIds: [] })).toMatchObject({ ok: false });
  });
});

describe("when the tradie cannot get in", () => {
  it("charges the call-out fee instead of the job", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-06", urgent: true });
    expect(job.ownerTotalCents).toBe(23500 + 5000);
    const result = await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Lockbox code did not work, nobody answering.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
    if (!result.ok) throw new Error(result.message);
    // The job's own price is replaced by the call-out (225 to the owner, 190 to the tradie). The urgent surcharge
    // stays, with its fee: owner 22500 + 5000 = 27500, tradie 19000 + 4250 = 23250.
    expect(result.job).toMatchObject({ status: "completed", outcome: "no_access", ownerTotalCents: 27500, tradieTotalCents: 23250 });
    expect(await payment(job.id)).toMatchObject({ amount_cents: 27500 });
  });

  it("needs a reason and a photo", async () => {
    const s = await setup();
    const job = await onSite(s);
    expect(await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [], ...HOUSE })).toMatchObject({ ok: false });
    expect(await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Gate locked, no answer", uploadIds: [], ...HOUSE })).toMatchObject({ ok: false });
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("on_site");
  });
});

describe("other money rules", () => {
  it("a goodwill credit is recorded, audited and passed to the payment company", async () => {
    const s = await setup();
    expect(await addGoodwillCredit(t.db, gatewayFor(t.db), { propertyId: s.property.id, amountCents: 5000, note: "Sorry for the wait" }, "staff:va")).toEqual({ ok: true });
    const credit = await t.db.query<{ status: string; amount_cents: number; created_by: string }>("select status, amount_cents, created_by from public.credits where reason = 'goodwill'");
    expect(credit).toEqual([{ status: "applied", amount_cents: 5000, created_by: "staff:va" }]);
    expect(await addGoodwillCredit(t.db, gatewayFor(t.db), { propertyId: s.property.id, amountCents: 0, note: "" }, "staff:va")).toMatchObject({ ok: false });
  });

  it("a payout that cannot be sent goes to the dispatcher and can be tried again", async () => {
    const s = await setup();
    await t.db.query("update public.tradies set payout_account_id = 'demo_acct_broken' where id = $1::uuid", [s.tradie.tradieId]);
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    for (let i = 0; i < 3; i += 1) {
      setTestNow(addHours(MONDAY_10AM, 25 + i));
      await releaseDuePayouts(t.db, gatewayFor(t.db));
    }
    expect(await payout(job.id)).toMatchObject({ status: "failed" });
    expect(await openExceptions(t.db, job.id)).toEqual(["payout_failed"]);

    await t.db.query("update public.tradies set payout_account_id = 'demo_acct_fixed' where id = $1::uuid", [s.tradie.tradieId]);
    expect(await retryPayout(t.db, gatewayFor(t.db), job.id, "staff:va")).toBe("sent");
    expect(await openExceptions(t.db, job.id)).toEqual([]);
  });

  it("every amount in the money tables is a whole number of cents", async () => {
    const s = await setup({ market: { tax_registered: true } });
    const job = await onSite(s, { urgent: true });
    await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Odd amount", hours: 0.25, uploadIds: [] });
    const parts = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [{ name: "Odd part", quantity: 3, unitCents: 1111 }] });
    expect(parts).toMatchObject({ ok: true, needsApproval: false });
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const lines = await listLines(t.db, job.id);
    for (const line of lines) {
      expect(Number.isInteger(line.ownerCents)).toBe(true);
      expect(Number.isInteger(line.tradieCents)).toBe(true);
    }
    const paid = await payment(job.id);
    const owed = await payout(job.id);
    // What the owner paid is exactly what the tradie gets plus what the platform keeps.
    const platform = lines.filter((l) => l.status === "active").reduce((sum, l) => sum + l.ownerCents - l.tradieCents, 0);
    expect(paid!.amount_cents).toBe(owed!.amount_cents + platform);
    // NZ$35 on the menu job. On the urgent surcharge: 15% of 5000 is 750. On the quote: a quarter hour at NZ$160
    // is 4000, and 15% of it is 600. On the part off the list: 20% of 3333 is 666.6, charged as 667, and 15% of
    // that is 100.05, kept as 100. 3500 + 750 + 600 + 100 = 4950.
    expect(platform).toBe(3500 + 750 + 600 + 100);
  });
});
