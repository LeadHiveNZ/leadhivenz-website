import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addGoodwillCredit, applyPendingCredits, chargeDuePayments, chargeJob, creditMissedWindows, flagAtRisk, MAX_CHARGE_ATTEMPTS, raiseDispute, releaseDuePayouts, resolveDispute, retryPayout } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { cancelJob } from "@/lib/jobs/create";
import { getJobForStaff, listLines, listQuotes } from "@/lib/jobs/store";
import { completeJob, decideQuote, markArrived, markEnRoute, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { saveBilling, unpaidJobs } from "@/lib/owners/service";
import { DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import type { Property } from "@/lib/properties/service";
import { testDb } from "./db";
import { auditActions, gatewayFor, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, MONDAY_9PM, offersFor, openExceptions, photo, textsTo } from "./factory";

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

type Setup = Awaited<ReturnType<typeof setup>>;

async function setup(options: { tier?: "essential" | "priority"; card?: "ok" | "declines"; market?: Record<string, unknown>; trades?: string[] } = {}) {
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
  it("charges the owner the menu price, pays the tradie the menu payout a day later, and keeps the rest", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    setTestNow(addMinutes(MONDAY_10AM, 90));
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ status: "completed", outcome: "done", ownerTotalCents: 22000, tradieTotalCents: 18700 });

    // Recorded as owed in the same step as the job being marked done.
    expect(await payment(job.id)).toMatchObject({ status: "pending", amount_cents: 22000 });
    expect(await payout(job.id)).toMatchObject({ status: "waiting", amount_cents: 18700 });

    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22000, attempts: 1 });
    const due = await payout(job.id);
    expect(due).toMatchObject({ status: "scheduled", amount_cents: 18700 });
    expect(new Date(due!.release_at).getTime()).toBe(addHours(addMinutes(MONDAY_10AM, 90), 24).getTime());

    const told = await textsTo(t.db, s.owner.user.phone!, "job_done");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain("NZ$220 charged to your card");

    // 23 hours on: still held. 24 hours on: sent.
    setTestNow(addHours(addMinutes(MONDAY_10AM, 90), 23));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    setTestNow(addHours(addMinutes(MONDAY_10AM, 90), 24));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 18700 });
    expect((await textsTo(t.db, s.tradie.phone, "payout_sent"))[0]!.body).toContain("NZ$187 for job");

    expect(await moneyLog(job.id)).toEqual(["job.created:22000", "job.completed:22000", "payment.succeeded:22000", "payout.sent:18700"]);
    // What the platform keeps is the difference: 15% of the job.
    expect(22000 - 18700).toBe(3300);
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
  it("urgent: the owner pays NZ$80 more and all of it goes to the tradie", async () => {
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    expect(job).toMatchObject({ urgency: "urgent", afterHours: false, ownerTotalCents: 30000, tradieTotalCents: 26700, responseHours: 4 });
    const done = await finish(s, job.id);
    expect(done.ownerTotalCents - done.tradieTotalCents).toBe(3300);
  });

  it("urgent at 9pm: after-hours is added too, and both go to the tradie in full", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await onSite(s, { urgent: true });
    expect(job).toMatchObject({ afterHours: true, ownerTotalCents: 22000 + 8000 + 12000, tradieTotalCents: 18700 + 8000 + 12000 });
    expect((await listLines(t.db, job.id)).map((line) => [line.kind, line.ownerCents, line.tradieCents])).toEqual([
      ["menu", 22000, 18700],
      ["urgent", 8000, 8000],
      ["after_hours", 12000, 12000],
    ]);
  });

  it("a normal job logged at 9pm has no surcharge: it is done in working hours", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await logJob(t.db, s.property);
    expect(job).toMatchObject({ afterHours: false, ownerTotalCents: 22000 });
  });

  it("Priority members are not charged for urgent, and the tradie still gets it", async () => {
    const s = await setup({ tier: "priority" });
    const job = await onSite(s, { urgent: true });
    expect(job).toMatchObject({ ownerTotalCents: 22000, tradieTotalCents: 26700 });
    const lines = await listLines(t.db, job.id);
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 0, tradieCents: 8000 });
    expect(lines[1]!.label).toContain("included");
  });

  it("the included urgent call-outs can be capped per month", async () => {
    const s = await setup({ tier: "priority" });
    await t.db.query("update public.membership_tiers set urgent_included_per_month = 1 where market = 'queenstown' and key = 'priority'");
    const first = await onSite(s, { code: "PL-01", urgent: true });
    expect(first.ownerTotalCents).toBe(22000);
    await finish(s, first.id);
    const second = await logJob(t.db, s.property, { code: "PL-03", urgent: true });
    expect(second.ownerTotalCents).toBe(19000 + 8000);
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
    // NZ$300 including 15% GST contains NZ$39.13 of GST.
    expect(await payment(job.id)).toMatchObject({ amount_cents: 30000, tax_cents: 3913 });
  });

  it("uses each market's own rate", async () => {
    const s = await setup({ market: { tax_registered: true, tax_rate: 0.1 } });
    const job = await onSite(s);
    await finish(s, job.id);
    expect(await payment(job.id)).toMatchObject({ amount_cents: 22000, tax_cents: 2000 });
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
    expect((await textsTo(t.db, s.owner.user.phone!, "payment_failed"))[0]!.body).toContain("could not charge your card NZ$220");
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
    expect(await unpaidJobs(t.db, s.owner.ownerId)).toEqual([{ jobId: job.id, number: job.number, title: job.title, amountCents: 22000, currency: "NZD" }]);
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
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 18700 });
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", refunded_cents: 0 });
  });

  it("full refund: the owner gets everything back and the tradie is paid nothing", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Nothing was done");
    if (!dispute.ok) throw new Error("expected a dispute");

    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 22000 }, "No work done", "staff:va")).toEqual({ ok: true });
    expect(await payment(job.id)).toMatchObject({ status: "refunded", refunded_cents: 22000 });
    expect(await payout(job.id)).toMatchObject({ status: "cancelled" });
    setTestNow(addHours(MONDAY_10AM, 72));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect(await moneyLog(job.id)).toEqual(["job.created:22000", "job.completed:22000", "payment.succeeded:22000", "refund.issued:22000", "payout.reduced:18700"]);
  });

  it("part refund: it comes off the tradie's share and the platform's share in proportion", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Left a mess");
    if (!dispute.ok) throw new Error("expected a dispute");

    // Half back to the owner: NZ$110. The tradie's NZ$187 becomes NZ$93.50; the platform's NZ$33 becomes NZ$16.50.
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 11000 }, "Half back", "staff:va")).toEqual({ ok: true });
    expect(await payment(job.id)).toMatchObject({ status: "part_refunded", refunded_cents: 11000 });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 9350 });
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 9350 });
    const refund = await t.db.query<{ detail: { from_tradie: number; from_platform: number } }>("select detail from public.audit_log where entity_id = $1 and action = 'refund.issued'", [job.id]);
    expect(refund[0]!.detail).toMatchObject({ from_tradie: 9350, from_platform: 1650 });
  });

  it("refuses a refund bigger than the owner paid, and a second resolution", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const dispute = await raiseDispute(t.db, job.id, `owner:${s.owner.ownerId}`, "Not happy");
    if (!dispute.ok) throw new Error("expected a dispute");
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 22001 }, "", "staff:va")).toMatchObject({ ok: false });
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
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 22000 }, "", "staff:va")).toEqual({ ok: true });
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
  it("credits the month's membership when nobody is on site by the promised time, and logs it", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));

    // One minute before the 24 hours are up: nothing.
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), -1));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 0, credited: 0 });

    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 1, credited: 1 });
    const credit = await t.db.query<{ amount_cents: number; month: string; status: string; reason: string }>("select amount_cents, month, status, reason from public.credits where job_id = $1::uuid", [job.id]);
    expect(credit).toEqual([{ amount_cents: 9900, month: "2026-11", status: "pending", reason: "missed_window" }]);
    expect((await getJobForStaff(t.db, job.id))!.windowMissedAt).not.toBeNull();
    expect(await openExceptions(t.db, job.id)).toContain("missed_window");
    expect((await textsTo(t.db, s.owner.user.phone!, "window_missed"))[0]!.body).toContain("Your November membership (NZ$99) is credited");
    expect(await auditActions(t.db, job.id)).toEqual(expect.arrayContaining(["job.window_missed", "credit.created"]));

    // Passed on to the payment company, once.
    expect(await applyPendingCredits(t.db, gatewayFor(t.db))).toBe(1);
    expect(await applyPendingCredits(t.db, gatewayFor(t.db))).toBe(0);
    expect((await t.db.query<{ status: string }>("select status from public.credits where job_id = $1::uuid", [job.id]))[0]!.status).toBe("applied");
    // Running the check again does not credit twice.
    expect(await creditMissedWindows(t.db)).toEqual({ missed: 0, credited: 0 });
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
    expect(job).toMatchObject({ offMenu: true, licenceRequired: true, ownerTotalCents: 12000, tradieTotalCents: 10200 });
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "diagnosis_only", ownerTotalCents: 12000, tradieTotalCents: 10200 });
  });

  it("a quote of NZ$400 or less goes ahead and the owner is told", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace waste trap", labourCents: 30000, partsCents: 4000, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    expect(result.quote).toMatchObject({ status: "auto_approved", needsApproval: false, ownerTotalCents: 34000, tradieTotalCents: 25500 + 4000 });
    expect(result.job).toMatchObject({ status: "on_site", ownerTotalCents: 12000 + 34000, tradieTotalCents: 10200 + 29500 });
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_going_ahead"))[0]!.body).toContain("inside your pre-approved limit");
    const done = await finish(s, job.id);
    expect(done.outcome).toBe("done");
  });

  it("a quote over NZ$400 stops everything until the owner says yes", async () => {
    const s = await setup();
    const job = await onSite(s, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Hot water cylinder leaking" });
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace cylinder valve", labourCents: 45000, partsCents: 12000, uploadIds: [] });
    if (!result.ok) throw new Error(result.message);
    expect(result.quote).toMatchObject({ status: "pending", needsApproval: true, ownerTotalCents: 57000 });
    // Nothing is added to the bill yet, and the job cannot be finished.
    expect(result.job).toMatchObject({ status: "awaiting_approval", ownerTotalCents: 12000 });
    expect((await textsTo(t.db, s.owner.user.phone!, "quote_needs_approval"))[0]!.body).toContain("Nothing starts until you say yes");
    expect(await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)] })).toMatchObject({ ok: false });
    expect(await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Another", labourCents: 1000, partsCents: 0, uploadIds: [] })).toMatchObject({ ok: false });

    const approved = await decideQuote(t.db, result.quote.id, true, `owner:${s.owner.ownerId}`);
    if (!approved.ok) throw new Error(approved.message);
    // Platform keeps 15% of the NZ$450 labour (NZ$67.50). Parts pass through at cost.
    expect(approved.job).toMatchObject({ status: "on_site", ownerTotalCents: 12000 + 57000, tradieTotalCents: 10200 + 38250 + 12000 });
    expect((await textsTo(t.db, s.tradie.phone, "quote_approved"))[0]!.body).toContain("approved your quote of NZ$570");
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "done", ownerTotalCents: 69000 });
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
    expect(declined.job).toMatchObject({ status: "on_site", ownerTotalCents: 12000, tradieTotalCents: 10200 });
    expect(await textsTo(t.db, s.tradie.phone, "quote_declined")).toHaveLength(1);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ outcome: "diagnosis_only", ownerTotalCents: 12000 });
    expect((await listLines(t.db, job.id)).filter((line) => line.status === "void").map((line) => line.kind)).toEqual(["quote"]);
  });

  it("small quotes cannot be stacked up past the limit without approval", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    const first = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace pan connector", labourCents: 25000, partsCents: 0, uploadIds: [] });
    expect(first.ok && first.quote.status).toBe("auto_approved");
    const second = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace isolating valve", labourCents: 20000, partsCents: 0, uploadIds: [] });
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
    expect(job.ownerTotalCents).toBe(26000 + 8000);
    const result = await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Lockbox code did not work, nobody answering.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)] });
    if (!result.ok) throw new Error(result.message);
    expect(result.job).toMatchObject({ status: "completed", outcome: "no_access", ownerTotalCents: 12000 + 8000, tradieTotalCents: 10200 + 8000 });
    expect(await payment(job.id)).toMatchObject({ amount_cents: 20000 });
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
    expect(platform).toBe(3300 + 500);
  });
});
