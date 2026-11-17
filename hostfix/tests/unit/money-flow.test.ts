import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addGoodwillCredit, applyPendingCredits, chargeDuePayments, chargeJob, creditMissedWindows, flagAtRisk, MAX_CHARGE_ATTEMPTS, raiseDispute, releaseDuePayouts, resolveDispute, retryPayout } from "@/lib/billing/settle";
import { ownerStatement } from "@/lib/billing/statements";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { getMarket } from "@/lib/markets/store";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { cancelJob } from "@/lib/jobs/create";
import { getJobForStaff, listLines, listQuotes } from "@/lib/jobs/store";
import { completeJob, decideQuote, markArrived, markEnRoute, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { saveBilling, unpaidJobs } from "@/lib/owners/service";
import { DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import type { Property } from "@/lib/properties/service";
import { testDb } from "./db";
import { addPlusTier, auditActions, gatewayFor, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, MONDAY_9PM, offersFor, openExceptions, photo, textsTo } from "./factory";

/**
 * THE PRICES THESE TESTS ARE BUILT ON. They come from seed/menu-queenstown.json
 * (whole dollars there, cents here) and were worked out by hand from that file:
 *
 *   PL-01  Toilet seat or cistern parts     owner 22500   tradie 19000   we keep 3500
 *   PL-03, PL-04, PL-06, PL-07 (plumbing)   owner 23500   tradie 20000   we keep 3500
 *   Urgent surcharge 9000 and after-hours surcharge 14000: the tradie gets all of both
 *   Off-menu call-out                       owner 22500   tradie 19000   we keep 3500
 *   A quote takes the job over the limit when quotes add up to more than 60000
 *   Parts above 15000 need the owner's yes whatever the total
 *   Off-menu labour: the tradie gets 85%. Parts pass through at cost.
 *   Essential membership: free to join (DECISIONS.md, 2026-11-17). No monthly price.
 *   Missed promise: the call-out portion is on us, min(diagnosis fee 22500, the job's price)
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
  await liveMarket(t.db, options.market ?? {});
  const owner = await makeOwner(t.db, { card: options.card ?? "ok" });
  const property = await makeProperty(t.db, owner.ownerId, { tier: options.tier ?? "essential" });
  const tradie = await makeTradie(t.db, { slot: 1, afterHours: true, trades: options.trades ?? ["plumber"], licence: options.trades?.[0] === "handyman" ? "none" : "valid", name: "Wakatipu Plumbing" });
  return { owner, property, tradie };
}

/** Logs a job and takes it as far as the tradie being on site. */
async function onSite(s: Setup, overrides: Parameters<typeof logJob>[2] = {}, property: Property = s.property) {
  const job = await logJob(t.db, property, overrides);
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  await markEnRoute(t.db, job.id, s.tradie.tradieId);
  const arrived = await markArrived(t.db, job.id, s.tradie.tradieId, { lat: -45.03, lng: 168.66 });
  if (!arrived.ok) throw new Error(arrived.message);
  return arrived.job;
}

async function finish(s: Setup, jobId: string) {
  const result = await completeJob(t.db, jobId, s.tradie.tradieId, { note: "All sorted.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)] });
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

    // Recorded as owed in the same step as the job being marked done.
    expect(await payment(job.id)).toMatchObject({ status: "pending", amount_cents: 22500 });
    expect(await payout(job.id)).toMatchObject({ status: "waiting", amount_cents: 19000 });

    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500, attempts: 1 });
    const due = await payout(job.id);
    expect(due).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    expect(new Date(due!.release_at).getTime()).toBe(addHours(addMinutes(MONDAY_10AM, 90), 24).getTime());

    const told = await textsTo(t.db, s.owner.user.phone!, "job_done");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain("NZ$225 charged to your card");

    // 23 hours on: still held. 24 hours on: sent.
    setTestNow(addHours(addMinutes(MONDAY_10AM, 90), 23));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    setTestNow(addHours(addMinutes(MONDAY_10AM, 90), 24));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
    expect((await textsTo(t.db, s.tradie.phone, "payout_sent"))[0]!.body).toContain("NZ$190 for job");

    expect(await moneyLog(job.id)).toEqual(["job.created:22500", "job.completed:22500", "payment.succeeded:22500", "payout.sent:19000"]);
    // What the platform keeps is the difference. The menu sets each owner price at the tradie's
    // payout divided by 0.85, to the nearest NZ$5: 190 / 0.85 = 223.53, so NZ$225, and we keep NZ$35.
    expect(22500 - 19000).toBe(3500);
  });

  it("a charge cut off half-way is repeated with the same key, so it can never become two charges", async () => {
    const s = await setup();
    const job = await onSite(s);
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
    expect((await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [] })).ok).toBe(true);
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("skipped");
    setTestNow(addHours(MONDAY_10AM, 30));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);

    expect((await moneyLog(job.id)).filter((line) => line.startsWith("payment.succeeded"))).toHaveLength(1);
    expect((await moneyLog(job.id)).filter((line) => line.startsWith("payout.sent"))).toHaveLength(1);
    expect(await textsTo(t.db, s.owner.user.phone!, "job_done")).toHaveLength(1);
    expect((await t.db.query("select 1 from public.payments where job_id = $1::uuid", [job.id])).length).toBe(1);
  });

  it("cannot be finished without a photo", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await completeJob(t.db, job.id, s.tradie.tradieId, { note: "Done", uploadIds: [] });
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
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [mine] })).toMatchObject({ ok: false });

    await markArrived(t.db, job.id, s.tradie.tradieId);
    const stranger = await photo(t.db, "tradie:00000000-0000-4000-8000-000000000000");
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [stranger] })).toMatchObject({ ok: false });
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
  it("urgent: the owner pays NZ$90 more and all of it goes to the tradie", async () => {
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    expect(job).toMatchObject({ urgency: "urgent", afterHours: false, ownerTotalCents: 22500 + 9000, tradieTotalCents: 19000 + 9000, responseHours: 4 });
    const done = await finish(s, job.id);
    // The surcharge adds nothing to what we keep: still the NZ$35 on the job itself.
    expect(done.ownerTotalCents - done.tradieTotalCents).toBe(3500);
  });

  it("urgent at 9pm: after-hours is added too, and both go to the tradie in full", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    expect(job).toMatchObject({ afterHours: true, ownerTotalCents: 22500 + 9000 + 14000, tradieTotalCents: 19000 + 9000 + 14000 });
    expect((await listLines(t.db, job.id)).map((line) => [line.kind, line.ownerCents, line.tradieCents])).toEqual([
      ["menu", 22500, 19000],
      ["urgent", 9000, 9000],
      ["after_hours", 14000, 14000],
    ]);
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
  it("on a membership that includes urgent, the owner is not charged for it and the tradie still gets it", async () => {
    await addPlusTier(t.db);
    const s = await setup({ tier: "plus" });
    const job = await onSite(s, { urgent: true });
    expect(job).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 + 9000 });
    const lines = await listLines(t.db, job.id);
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 0, tradieCents: 9000 });
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
    expect(second.ownerTotalCents).toBe(23500 + 9000);
    // A cancelled job does not use up the allowance.
    await cancelJob(t.db, first.id, { actor: "staff:x", staff: true }, "test");
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
    // NZ$315 (the NZ$225 job plus NZ$90 urgent) including 15% GST. The GST inside a price that includes
    // it is 3/23 of the price: 315 x 3 / 23 = 41.0869..., so NZ$41.09 to the nearest cent.
    expect(await payment(job.id)).toMatchObject({ amount_cents: 31500, tax_cents: 4109 });
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
  it("does not pay the tradie, tells the owner, flags the dispatcher, and tries again the next day", async () => {
    const s = await setup({ card: "declines" });
    const job = await onSite(s);
    await finish(s, job.id);

    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("failed");
    const failed = await payment(job.id);
    expect(failed).toMatchObject({ status: "failed", attempts: 1, last_error: "The card was declined." });
    expect(new Date(failed!.next_retry_at!).getTime()).toBe(addHours(MONDAY_10AM, 24).getTime());
    expect(await payout(job.id)).toMatchObject({ status: "waiting" });
    expect(await openExceptions(t.db, job.id)).toEqual(["payment_failed"]);
    expect((await textsTo(t.db, s.owner.user.phone!, "payment_failed"))[0]!.body).toContain("could not charge your card NZ$225");
    expect(await textsTo(t.db, s.owner.user.phone!, "job_done")).toHaveLength(0);

    // Nothing is released to the tradie however long we wait.
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
    expect(await textsTo(t.db, s.owner.user.phone!, "payment_failed")).toHaveLength(1);
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
    expect(await payout(job.id)).toMatchObject({ status: "waiting" });
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
    expect(await textsTo(t.db, s.tradie.phone, "payout_on_hold")).toHaveLength(1);
    expect(await textsTo(t.db, s.owner.user.phone!, "dispute_received")).toHaveLength(1);

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
    expect(await moneyLog(job.id)).toEqual(["job.created:22500", "job.completed:22500", "payment.succeeded:22500", "refund.issued:22500", "payout.reduced:19000"]);
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

describe("the response guarantee", () => {
  // The call-out portion of the job is on us: min(the market's diagnosis fee, the job's price).
  // Queenstown's diagnosis fee is 225 dollars in the menu file ("offMenu"), so 22500 cents.

  it("takes the call-out portion off a PL-01 when nobody is on site by the promised time, and pays the tradie in full", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));

    // One minute before the 24 hours are up: nothing.
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), -1));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 0, credited: 0 });

    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 1, credited: 1 });
    // PL-01 is 22500. The credit is min(22500, 22500) = 22500: the whole job.
    const credit = await t.db.query<{ amount_cents: number; month: string; status: string; reason: string }>("select amount_cents, month, status, reason from public.credits where job_id = $1::uuid", [job.id]);
    expect(credit).toEqual([{ amount_cents: 22500, month: "2026-11", status: "pending", reason: "missed_window" }]);
    expect((await getJobForStaff(t.db, job.id))!.windowMissedAt).not.toBeNull();
    expect(await openExceptions(t.db, job.id)).toContain("missed_window");
    expect((await textsTo(t.db, s.owner.user.phone!, "window_missed"))[0]!.body).toContain("we missed our promised time at");
    expect((await textsTo(t.db, s.owner.user.phone!, "window_missed"))[0]!.body).toContain("so NZ$225 of this job is on us");
    expect(await auditActions(t.db, job.id)).toEqual(expect.arrayContaining(["job.window_missed", "credit.created"]));

    // It comes off this job's own charge, never a membership payment: nothing is passed to the payment company.
    expect(await applyPendingCredits(t.db, gatewayFor(t.db))).toBe(0);
    // Running the check again does not credit twice.
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 0, credited: 0 });

    // The tradie gets there late and finishes. 22500 - 22500 = 0 to charge, so there is no charge at all.
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    const arrived = await markArrived(t.db, job.id, s.tradie.tradieId, { lat: -45.03, lng: 168.66 });
    if (!arrived.ok) throw new Error(arrived.message);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await payment(job.id)).toBeUndefined();
    // The tradie is paid the full 19000, with nothing to wait for. The platform takes 0 and pays out 19000: it wears 19000 on this job.
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    expect((await t.db.query<{ status: string }>("select status from public.credits where job_id = $1::uuid", [job.id]))[0]!.status).toBe("applied");
    expect(await moneyLog(job.id)).toEqual(expect.arrayContaining(["credit.applied:22500"]));
  });

  it("is capped at the job's price: HM-01 is 15500, so 15500 is on us", async () => {
    const s = await setup({ trades: ["handyman"] });
    const job = await logJob(t.db, s.property, { code: "HM-01" });
    // HM-01, Shelf, hook or mirror hanging: owner 155 dollars, tradie 130 dollars in the menu file.
    expect(job).toMatchObject({ ownerTotalCents: 15500, tradieTotalCents: 13000 });
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 1, credited: 1 });
    // min(22500, 15500) = 15500.
    expect((await t.db.query<{ amount_cents: number }>("select amount_cents from public.credits where job_id = $1::uuid", [job.id]))[0]!.amount_cents).toBe(15500);
    expect((await textsTo(t.db, s.owner.user.phone!, "window_missed"))[0]!.body).toContain("so NZ$155 of this job is on us");
  });

  it("on a job that grows to a 60000 quote, the credit is still the 22500 call-out, and the rest is charged", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    // Off-menu: the job starts at the diagnosis fee, owner 22500, tradie 19000.
    expect(job).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 1, credited: 1 });
    // min(22500, 22500) = 22500.
    expect((await t.db.query<{ amount_cents: number }>("select amount_cents from public.credits where job_id = $1::uuid", [job.id]))[0]!.amount_cents).toBe(22500);

    // Late, the tradie arrives and quotes 52000 labour + 8000 parts = 60000, inside the 60000 limit, so it goes ahead.
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    const arrived = await markArrived(t.db, job.id, s.tradie.tradieId, { lat: -45.03, lng: 168.66 });
    if (!arrived.ok) throw new Error(arrived.message);
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", labourCents: 52000, partsCents: 8000, uploadIds: [] });
    if (!quoted.ok) throw new Error(quoted.message);
    const done = await finish(s, job.id);
    // Owner: 22500 call-out + 60000 quote = 82500. Tradie: 19000 + 52000 x 0.85 (44200) + 8000 parts = 71200.
    expect(done).toMatchObject({ ownerTotalCents: 82500, tradieTotalCents: 71200 });
    // Charged 82500 - 22500 = 60000. The tradie still gets all 71200.
    expect(await payment(job.id)).toMatchObject({ status: "pending", amount_cents: 60000 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 71200 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 60000 });

    // The statement shows the job at what was charged, says why, and shows no credit still to come.
    const market = (await getMarket(t.db, "queenstown"))!;
    const statement = await ownerStatement(t.db, s.owner.ownerId, market, "2026-11");
    expect(statement.lines.filter((line) => line.kind === "job").map((line) => [line.description, line.amountCents])).toEqual([
      [`Job ${job.number}: Leak under the sink (NZ$225 off: we missed our promised time)`, 60000],
    ]);
    expect(statement).toMatchObject({ jobsCents: 60000, creditsCents: 0, membershipCents: 0, totalCents: 60000 });
  });

  it("does not credit when the tradie arrived in time, even by a minute", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), -1));
    await markArrived(t.db, job.id, s.tradie.tradieId);
    setTestNow(addHours(MONDAY_10AM, 30));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 0, credited: 0 });
    const arrived = await t.db.query<{ detail: { on_time: boolean } }>("select detail from public.audit_log where entity_id = $1 and action = 'job.arrived'", [job.id]);
    expect(arrived[0]!.detail.on_time).toBe(true);
  });

  it("uses the 4-hour window for an urgent job", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { urgent: true });
    setTestNow(addMinutes(addHours(MONDAY_10AM, 4), -1));
    expect((await creditMissedWindows(t.db)).missed).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 4));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 1, credited: 1 });
    expect(job.responseHours).toBe(4);
  });

  it("is capped at one credit per property per calendar month", async () => {
    const s = await setup();
    const first = await logJob(t.db, s.property, { code: "PL-01" });
    const second = await logJob(t.db, s.property, { code: "PL-03" });
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 2, credited: 1 });
    expect((await t.db.query("select 1 from public.credits where property_id = $1::uuid and reason = 'missed_window'", [s.property.id])).length).toBe(1);
    // Both misses are still logged and in front of the dispatcher.
    expect(await openExceptions(t.db, first.id)).toContain("missed_window");
    expect(await openExceptions(t.db, second.id)).toContain("missed_window");
    const capped = await t.db.query<{ summary: string }>("select summary from public.exceptions where kind = 'missed_window' order by created_at, id");
    expect(capped.some((row) => row.summary.includes("No credit this time"))).toBe(true);
  });

  it("gives a fresh credit in a new month, and a separate one for another property", async () => {
    const s = await setup();
    const other = await makeProperty(t.db, s.owner.ownerId);
    await logJob(t.db, s.property, { code: "PL-01" });
    await logJob(t.db, other, { code: "PL-01" });
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 2, credited: 2 });

    // December (New Zealand time): the same property can be credited again.
    setTestNow(new Date("2026-12-05T21:00:00.000Z"));
    await t.db.query("update public.properties set status = 'active' where id = $1::uuid", [s.property.id]);
    await logJob(t.db, s.property, { code: "PL-03" });
    setTestNow(new Date("2026-12-06T22:00:00.000Z"));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 1, credited: 1 });
    const months = await t.db.query<{ month: string }>("select month from public.credits where property_id = $1::uuid order by month", [s.property.id]);
    expect(months.map((row) => row.month)).toEqual(["2026-11", "2026-12"]);
  });

  it("never credits a cancelled job or a guest report still waiting for the owner", async () => {
    const s = await setup();
    const cancelled = await logJob(t.db, s.property, { code: "PL-01" });
    await cancelJob(t.db, cancelled.id, { actor: `owner:${s.owner.ownerId}` }, "Changed my mind");
    await logJob(t.db, s.property, { code: "PL-03", reportedBy: "guest" });
    setTestNow(addHours(MONDAY_10AM, 48));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 0, credited: 0 });
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
    await markArrived(t.db, job.id, s.tradie.tradieId);
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

  it("a quote of NZ$600 or less goes ahead and the owner is told", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    // Exactly NZ$600: NZ$520 labour and NZ$80 parts. "Over NZ$600" needs a yes, so NZ$600 itself does not.
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", labourCents: 52000, partsCents: 8000, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    // The tradie gets 85% of the labour (520 x 0.85 = NZ$442) and all of the parts.
    expect(result.quote).toMatchObject({ status: "auto_approved", needsApproval: false, ownerTotalCents: 60000, tradieTotalCents: 44200 + 8000 });
    expect(result.job).toMatchObject({ status: "on_site", ownerTotalCents: 22500 + 60000, tradieTotalCents: 19000 + 52200 });
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_going_ahead"))[0]!.body).toContain("inside your pre-approved limit");
    const done = await finish(s, job.id);
    expect(done.outcome).toBe("done");
  });

  it("one dollar over the limit needs the owner's yes", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap and isolating valve", labourCents: 60100, partsCents: 0, uploadIds: [] });
    expect(result.ok && result.quote).toMatchObject({ status: "pending", needsApproval: true, ownerTotalCents: 60100 });
  });

  it("a quote over NZ$600 stops everything until the owner says yes", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Hot water cylinder leaking" });
    // NZ$550 labour and NZ$120 parts: NZ$670.
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace cylinder valve", labourCents: 55000, partsCents: 12000, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    expect(result.quote).toMatchObject({ status: "pending", needsApproval: true, ownerTotalCents: 67000 });
    // Nothing is added to the bill yet, and the job cannot be finished.
    expect(result.job).toMatchObject({ status: "awaiting_approval", ownerTotalCents: 22500 });
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_needs_approval"))[0]!.body).toContain("Nothing starts until you say yes");
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)] })).toMatchObject({ ok: false });
    expect(await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Another", labourCents: 1000, partsCents: 0, uploadIds: [] })).toMatchObject({ ok: false });

    const approved = await decideQuote(t.db, result.quote.id, true, `owner:${s.owner.ownerId}`);
    if (!approved.ok) throw new Error(approved.message);
    // The platform keeps 15% of the NZ$550 labour (NZ$82.50), so the tradie gets NZ$467.50 of it. Parts pass through at cost.
    expect(approved.job).toMatchObject({ status: "on_site", ownerTotalCents: 22500 + 67000, tradieTotalCents: 19000 + 46750 + 12000 });
    expect((await textsTo(t.db, s.tradie.phone, "quote_approved"))[0]!.body).toContain("approved your quote of NZ$670");
    const done = await finish(s, job.id);
    // The call-out and the quote together: 225 + 670.
    expect(done).toMatchObject({ outcome: "done", ownerTotalCents: 89500 });
    // Deciding again changes nothing.
    await decideQuote(t.db, result.quote.id, false, `owner:${s.owner.ownerId}`);
    expect((await listQuotes(t.db, job.id))[0]!.status).toBe("approved");
  });

  it("a declined quote leaves only the call-out to pay", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Hot water cylinder leaking" });
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace cylinder", labourCents: 90000, partsCents: 0, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    const declined = await decideQuote(t.db, result.quote.id, false, `owner:${s.owner.ownerId}`);
    if (!declined.ok) throw new Error(declined.message);
    expect(declined.job).toMatchObject({ status: "on_site", ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await textsTo(t.db, s.tradie.phone, "quote_declined")).toHaveLength(1);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "diagnosis_only", ownerTotalCents: 22500 });
    expect((await listLines(t.db, job.id)).filter((line) => line.status === "void").map((line) => line.kind)).toEqual(["quote"]);
  });

  it("small quotes cannot be stacked up past the limit without approval", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    // NZ$350 is inside the NZ$600 limit by itself. A second NZ$300 would take the extras to NZ$650, so it waits for a yes.
    const first = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace pan connector", labourCents: 35000, partsCents: 0, uploadIds: [] });
    expect(first.ok && first.quote.status).toBe("auto_approved");
    const second = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace isolating valve", labourCents: 30000, partsCents: 0, uploadIds: [] });
    expect(second.ok && second.quote.status).toBe("pending");
  });

  it("uses the owner's own limit when they have set one", async () => {
    const s = await setup();
    await t.db.query("update public.properties set spend_limit_cents = 10000 where id = $1::uuid", [s.property.id]);
    const job = await onSite(s, { code: "PL-01" }, { ...s.property, spendLimitCents: 10000 });
    const quote = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Extra", labourCents: 15000, partsCents: 0, uploadIds: [] });
    expect(quote.ok && quote.quote.needsApproval).toBe(true);
  });

  it("parts over NZ$150 need the owner's yes even on a cheap job", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-04" });
    const quote = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "New mixer", labourCents: 0, partsCents: 18000, uploadIds: [] });
    expect(quote.ok && quote.quote.needsApproval).toBe(true);
    const cheap = await onSite(s, { code: "PL-07" });
    const small = await submitQuote(t.db, cheap.id, s.tradie.tradieId, { description: "Hose", labourCents: 0, partsCents: 4500, uploadIds: [] });
    expect(small.ok && small.quote).toMatchObject({ status: "auto_approved", ownerTotalCents: 4500, tradieTotalCents: 4500 });
  });
});

describe("when the tradie cannot get in", () => {
  it("charges the call-out fee instead of the job", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-06", urgent: true });
    expect(job.ownerTotalCents).toBe(23500 + 9000);
    const result = await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Lockbox code did not work, nobody answering.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)] });
    if (!result.ok) throw new Error(result.message);
    // The job's own price is replaced by the call-out (225 to the owner, 190 to the tradie). The urgent surcharge stays.
    expect(result.job).toMatchObject({ status: "completed", outcome: "no_access", ownerTotalCents: 22500 + 9000, tradieTotalCents: 19000 + 9000 });
    expect(await payment(job.id)).toMatchObject({ amount_cents: 31500 });
  });

  it("needs a reason and a photo", async () => {
    const s = await setup();
    const job = await onSite(s);
    expect(await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [] })).toMatchObject({ ok: false });
    expect(await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Gate locked, no answer", uploadIds: [] })).toMatchObject({ ok: false });
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
    await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Odd amount", labourCents: 3333, partsCents: 1111, uploadIds: [] });
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
    // NZ$35 on the menu job. On the quote: the tradie's 85% of 3333 cents is 2833.05, paid as 2833, which leaves 500.
    expect(platform).toBe(3500 + 500);
  });
});
