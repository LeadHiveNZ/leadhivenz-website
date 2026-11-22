import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cancelDueHolds, HOLD_VALID_HOURS, keepHoldsAlive } from "@/lib/billing/card-holds";
import { chargeJob, markMissedWindows, refundDuePrepayments, releaseDuePayouts, releaseDueRests } from "@/lib/billing/settle";
import { acceptClientInvite, acceptOwnTradieInvite, addressKey, inviteClient, inviteFromLink, inviteOwnTradie, makePair } from "@/lib/clients/own-clients";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { cancelJob, createJob, releaseCardHolds } from "@/lib/jobs/create";
import { addParts } from "@/lib/jobs/parts";
import { payoutWaits } from "@/lib/jobs/pricing";
import { getJobForStaff } from "@/lib/jobs/store";
import { answerQuote, completeJob, decideQuote, markEnRoute, submitQuote } from "@/lib/jobs/work";
import { saveBilling } from "@/lib/owners/service";
import { DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import type { PaymentsGateway } from "@/lib/payments/gateway";
import { getPropertyForStaff } from "@/lib/properties/service";
import { recentNoShows } from "@/lib/tradies/reliability";
import { testDb } from "./db";
import {
  arrive, auditActions, cardDeclinesFromNow, gatewayFor, holdRanOut, holdsFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, menuItem,
  messagesTo, MONDAY_10AM, offersFor, openExceptions, photo, textsTo,
} from "./factory";

/**
 * DECISIONS.md, 2026-11-23. Every amount is worked out by hand from seed/menu-queenstown.json and the market's
 * starting numbers (config/markets.ts), never copied from what the code returns.
 *
 *   PL-01 owner 22500, tradie 19000.  PL-03 owner 23500, tradie 20000.  Off-menu call-out: owner 22500, tradie 19000.
 *   Urgent NZ$50: the owner pays 5000, the tradie 5000 - 15% (750) = 4250.  Plumber hourly rate NZ$160.
 *   A part at the tradie's price: they get it less 3%.  The payout guarantee: NZ$1,000 (100000) of a job's price.
 *   The own-client fee: 5% (500 basis points).
 *
 * A hold lasts 4 days 18 hours (114 hours) on the pretend card, the shortest real window (Visa, merchant-initiated).
 * A hold running out within 12 hours on an open job is replaced. Times: MONDAY_10AM is Mon 16 Nov 2026, 10am in Queenstown.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function setup() {
  await liveMarket(t.db, { min_minutes_on_site: 0 });
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  const tradie = await makeTradie(t.db, { slot: 1, afterHours: true, name: "Wakatipu Plumbing" });
  return { owner, property, tradie };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function accepted(s: Setup, overrides: Parameters<typeof logJob>[2] = {}, tradieId = s.tradie.tradieId) {
  const job = await logJob(t.db, s.property, overrides);
  const offer = (await offersFor(t.db, job.id)).find((row) => row.tradie_id === tradieId);
  const result = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  if (result.result !== "accepted") throw new Error(result.result);
  return result.job;
}

async function onSite(s: Setup, overrides: Parameters<typeof logJob>[2] = {}) {
  const job = await accepted(s, overrides);
  await markEnRoute(t.db, job.id, s.tradie.tradieId);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  return arrived.job;
}

async function finish(s: Setup, jobId: string, tradieId = s.tradie.tradieId) {
  const done = await completeJob(t.db, jobId, tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${tradieId}`)], ...HOUSE });
  if (!done.ok) throw new Error(done.message);
  return done.job;
}

const payment = async (jobId: string) =>
  (await t.db.query<{ status: string; amount_cents: number; hold_captured_cents: number; payment_intent_id: string | null; extra_payment_intent_id: string | null; refunded_cents: number }>(
    "select * from public.payments where job_id = $1::uuid", [jobId],
  ))[0];
const payout = async (jobId: string) =>
  (await t.db.query<{ status: string; amount_cents: number; waits_cents: number; rest_status: string | null }>("select * from public.payouts where job_id = $1::uuid", [jobId]))[0];

/** The demo payment company, with every call written down. */
function recording() {
  const calls: { kind: string; key: string; amountCents?: number; chargeId?: string | null }[] = [];
  const gateways = () => {
    const base = gatewayFor(t.db)("NZ")!;
    const wrapped: PaymentsGateway = {
      ...base,
      placeHold: async (input) => { calls.push({ kind: "hold", key: input.idempotencyKey, amountCents: input.amountCents }); return base.placeHold(input); },
      captureHold: async (input) => { calls.push({ kind: "capture", key: input.idempotencyKey, amountCents: input.amountCents }); return base.captureHold(input); },
      cancelHold: async (input) => { calls.push({ kind: "cancel", key: input.idempotencyKey }); return base.cancelHold(input); },
      chargeJob: async (input) => { calls.push({ kind: "charge", key: input.idempotencyKey, amountCents: input.amountCents }); return base.chargeJob(input); },
      transfer: async (input) => { calls.push({ kind: "transfer", key: input.idempotencyKey, amountCents: input.amountCents, chargeId: input.chargeId }); return base.transfer(input); },
      refund: async (input) => { calls.push({ kind: "refund", key: input.idempotencyKey, amountCents: input.amountCents }); return base.refund(input); },
    };
    return wrapped;
  };
  return { calls, gateways };
}

describe("a hold on the owner's card when a job goes out", () => {
  it("holds the job's known price: PL-03 23500, PL-01 urgent 22500 + 5000 = 27500, off-menu the 22500 call-out, before anyone is offered it", async () => {
    const s = await setup();
    const menu = await logJob(t.db, s.property, { code: "PL-03" });
    expect(menu.status).toBe("offering");
    const [hold] = await holdsFor(t.db, menu.id);
    expect(hold).toMatchObject({ seq: 1, reason: "booking", status: "held", amount_cents: 23500 });
    expect(new Date(hold!.capture_before!).getTime()).toBe(addHours(MONDAY_10AM, HOLD_VALID_HOURS).getTime());
    expect(await auditActions(t.db, menu.id)).toEqual(["job.created", "hold.placed", "job.dispatched", "job.offered"]);

    const urgent = await logJob(t.db, await makeProperty(t.db, s.owner.ownerId), { code: "PL-01", urgent: true });
    expect((await holdsFor(t.db, urgent.id))[0]).toMatchObject({ amount_cents: 27500 });
    const offMenu = await logJob(t.db, await makeProperty(t.db, s.owner.ownerId), { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak under the sink" });
    expect((await holdsFor(t.db, offMenu.id))[0]).toMatchObject({ amount_cents: 22500 });
  });

  it("a declined hold is a card problem: an owner logging it is told to update the card, and nothing is sent or left waiting", async () => {
    const s = await setup();
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    const item = await menuItem(t.db, "PL-01");
    const result = await createJob(t.db, {
      property: s.property, reportedBy: "owner", reporterName: null, reporterPhone: null, menuItemId: item.id, description: "", urgent: false,
      uploadIds: [], uploader: `owner:${s.owner.ownerId}`, actor: `owner:${s.owner.ownerId}`,
    }, gatewayFor(t.db));
    expect(result).toMatchObject({ ok: false, reason: "card", message: "Your card was declined when we went to hold the job's price on it. Update it on the Billing page and we send a tradie straight away." });
    const jobs = await t.db.query<{ id: string; status: string }>("select id, status from public.jobs");
    expect(jobs.map((job) => job.status)).toEqual(["cancelled"]);
    expect(await offersFor(t.db, jobs[0]!.id)).toHaveLength(0);
    expect(await textsTo(t.db, s.tradie.phone)).toHaveLength(0);
    expect((await t.db.query<{ kind: string }>("select kind from public.exceptions where status = 'open'")).map((row) => row.kind)).toEqual(["card_needed"]);
  });

  it("a declined hold on someone else's report waits for the owner's card; it is tried again only once a new card is saved", async () => {
    const s = await setup();
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    const item = await menuItem(t.db, "PL-01");
    const result = await createJob(t.db, {
      property: s.property, reportedBy: "team", reporterName: "Mele", reporterPhone: "+64225550001", menuItemId: item.id, description: "", urgent: false,
      uploadIds: [], uploader: `report:${s.property.id}`, actor: `report:${s.property.id}`,
    }, gatewayFor(t.db));
    if (!result.ok) throw new Error(result.message);
    expect(result).toMatchObject({ needsOwner: true, job: { status: "awaiting_owner", cardHold: "declined" } });
    expect((await textsTo(t.db, s.owner.user.phone!, "card_needed"))[0]!.body).toContain("is waiting: your card declined. Update it:");
    expect(await openExceptions(t.db, result.job.id)).toEqual(["card_needed"]);
    // A minute later, nothing new: the same card would only decline again.
    setTestNow(addMinutes(MONDAY_10AM, 3));
    expect(await releaseCardHolds(t.db, gatewayFor(t.db))).toBe(0);
    expect(await holdsFor(t.db, result.job.id)).toHaveLength(1);
    // A new card: the hold goes on (try 2, its own key) and the job goes out.
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_new", card: DEMO_CARD_OK });
    setTestNow(addMinutes(MONDAY_10AM, 4));
    expect(await releaseCardHolds(t.db, gatewayFor(t.db))).toBe(1);
    expect((await holdsFor(t.db, result.job.id)).map((hold) => hold.status)).toEqual(["declined", "held"]);
    expect(await getJobForStaff(t.db, result.job.id)).toMatchObject({ status: "offering", cardHold: null });
    expect(await openExceptions(t.db, result.job.id)).toEqual([]);
  });

  it("takes the charge from the hold, and charges anything beyond it separately: 23500 held, 23500 + 4500 = 28000 owed", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-03" });
    // A part at the tradie's price, NZ$45: the owner pays 4500, the tradie gets 4500 - 135 = 4365.
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [{ name: "Tap cartridge", quantity: 1, unitCents: 4500 }] })).toMatchObject({ ok: true, needsApproval: false });
    await finish(s, job.id);
    const { calls, gateways } = recording();
    expect(await chargeJob(t.db, gateways, job.id)).toBe("succeeded");
    // The capture asks for the held 23500 only; the 28000 - 23500 = 4500 beyond it is a second, separate charge.
    const [hold] = await holdsFor(t.db, job.id);
    expect(calls.map(({ kind, key, amountCents }) => ({ kind, key, amountCents }))).toEqual([
      { kind: "capture", key: `hostfix-hold-${hold!.id}-capture`, amountCents: 23500 },
      { kind: "charge", key: `hostfix-job-${job.id}-charge-1`, amountCents: 4500 },
    ]);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 28000, hold_captured_cents: 23500 });
    const paid = (await payment(job.id))!;
    expect(paid.payment_intent_id).toBe(hold!.payment_intent_id);
    expect(paid.extra_payment_intent_id).toMatch(/^demo_pi_/);
    expect((await holdsFor(t.db, job.id))[0]).toMatchObject({ status: "captured", captured_cents: 23500 });
    // The tradie's 20000 + 4365 = 24365 is more than either payment (23500 from the hold, 4500 beyond it), and a transfer
    // tied to a charge may not be more than it, so it goes from HostFix's own balance.
    setTestNow(addHours(MONDAY_10AM, 25));
    await releaseDuePayouts(t.db, gateways);
    expect(calls.at(-1)).toMatchObject({ kind: "transfer", amountCents: 24365, chargeId: null });
  });

  it("takes less than the hold when the price came down, and lets the rest go: urgent PL-01 held 27500, reached late, charged 22500", async () => {
    const s = await setup();
    const job = await accepted(s, { code: "PL-01", urgent: true });
    // The urgent promise is 4 hours. Arrived at 4 hours 30 minutes: no urgent line for anyone (DECISIONS.md, 2026-11-18).
    setTestNow(addMinutes(MONDAY_10AM, 270));
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    await finish(s, job.id);
    const { calls, gateways } = recording();
    expect(await chargeJob(t.db, gateways, job.id)).toBe("succeeded");
    expect(calls).toEqual([expect.objectContaining({ kind: "capture", amountCents: 22500 })]);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500, hold_captured_cents: 22500, extra_payment_intent_id: null });
    expect((await holdsFor(t.db, job.id))[0]).toMatchObject({ amount_cents: 27500, captured_cents: 22500, status: "captured" });
  });

  it("a capture whose answer was lost is asked again with the same key, never as a second charge", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    await finish(s, job.id);
    const keys: string[] = [];
    let lose = true;
    const flaky = () => {
      const base = gatewayFor(t.db)("NZ")!;
      return { ...base, captureHold: async (input: Parameters<PaymentsGateway["captureHold"]>[0]) => {
        keys.push(input.idempotencyKey);
        if (lose) { lose = false; throw new Error("connection reset"); }
        return base.captureHold(input);
      } };
    };
    expect(await chargeJob(t.db, flaky, job.id)).toBe("failed");
    expect((await holdsFor(t.db, job.id))[0]).toMatchObject({ status: "held" });
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await chargeJob(t.db, flaky, job.id)).toBe("succeeded");
    expect(new Set(keys).size).toBe(1);
    expect(keys).toHaveLength(2);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500, hold_captured_cents: 22500 });
  });
});

describe("cancelling (DECISIONS.md, 2026-11-23)", () => {
  it("before Arrived, even after On my way, is free: the hold is let go, nothing is charged, the tradie is not paid", async () => {
    const s = await setup();
    const job = await accepted(s, { code: "PL-03" });
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    const result = await cancelJob(t.db, job.id, { actor: `owner:${s.owner.ownerId}` }, "The guest fixed it");
    expect(result).toMatchObject({ ok: true, job: { status: "cancelled" } });
    expect((await holdsFor(t.db, job.id))[0]).toMatchObject({ status: "cancel_due" });
    const { calls, gateways } = recording();
    expect(await cancelDueHolds(t.db, gateways, job.id)).toBe(1);
    const [hold] = await holdsFor(t.db, job.id);
    expect(calls).toEqual([{ kind: "cancel", key: `hostfix-hold-${hold!.id}-cancel` }]);
    expect(hold).toMatchObject({ status: "cancelled" });
    expect(await payment(job.id)).toBeUndefined();
    expect(await payout(job.id)).toBeUndefined();
    expect((await textsTo(t.db, s.tradie.phone, "job_cancelled"))[0]!.body).toContain("is cancelled. No need to go.");
    // Letting it go twice is harmless.
    expect(await cancelDueHolds(t.db, gateways, job.id)).toBe(0);
  });

  it("after Arrived, the owner pays the call-out from the hold and the tradie is paid theirs: PL-03 23500 becomes 22500, tradie 19000", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-03" });
    const result = await cancelJob(t.db, job.id, { actor: `owner:${s.owner.ownerId}` }, "Changed my mind");
    // The call-out: the smaller of the call-out (22500) and the job (23500) is 22500; the tradie the smaller of 19000 and 22500.
    expect(result).toMatchObject({ ok: true, callOutCents: 22500, job: { status: "cancelled", ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    const { calls, gateways } = recording();
    expect(await chargeJob(t.db, gateways, job.id)).toBe("succeeded");
    expect(calls).toEqual([expect.objectContaining({ kind: "capture", amountCents: 22500 })]);
    expect((await messagesTo(t.db, s.owner.user.phone!, "call_out_charged"))[0]!.body).toContain("cancelled after the tradie arrived: NZ$225 call-out charged");
    expect((await textsTo(t.db, s.tradie.phone, "job_cancelled"))[0]!.body).toContain("You're paid the call-out, NZ$190, at the usual time.");
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
  });

  it("after Arrived, our team can cancel without a charge: the hold is let go", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-03" });
    expect(await cancelJob(t.db, job.id, { actor: "staff:maria", staff: true }, "Owner rang: plans changed")).toMatchObject({ ok: true, job: { status: "cancelled" } });
    expect((await holdsFor(t.db, job.id))[0]).toMatchObject({ status: "cancel_due" });
    expect(await payment(job.id)).toBeUndefined();
  });
});

describe("keeping a hold alive", () => {
  it("replaces a hold running out within 12 hours on an open job, then lets the old one go", async () => {
    const s = await setup();
    // Nobody can take it (no plumber is free), so it sits open in the dispatcher's queue.
    await t.db.query("update public.tradies set status = 'paused' where id = $1::uuid", [s.tradie.tradieId]);
    const job = await logJob(t.db, s.property, { code: "PL-03" });
    expect(job.status).toBe("unfilled");
    // 114 - 13 = 101 hours on: not yet (more than 12 hours left).
    setTestNow(addHours(MONDAY_10AM, HOLD_VALID_HOURS - 13));
    const { calls, gateways } = recording();
    expect(await keepHoldsAlive(t.db, gateways)).toMatchObject({ renewed: 0 });
    // 114 - 12 = 102 hours on: a fresh hold, then the old one let go.
    setTestNow(addHours(MONDAY_10AM, HOLD_VALID_HOURS - 12));
    expect(await keepHoldsAlive(t.db, gateways)).toMatchObject({ renewed: 1, released: 1 });
    const holds = await holdsFor(t.db, job.id);
    expect(holds.map((hold) => [hold.seq, hold.reason, hold.status, hold.amount_cents])).toEqual([[1, "booking", "cancelled", 23500], [2, "refresh", "held", 23500]]);
    expect(calls.map((call) => call.key)).toEqual([`hostfix-job-${job.id}-hold-2`, `hostfix-hold-${holds[0]!.id}-cancel`]);
    // Running again changes nothing.
    expect(await keepHoldsAlive(t.db, gateways)).toMatchObject({ renewed: 0, released: 0 });
  });

  it("a visit further away than a hold lasts: the hold is let go, and placed again a day before the visit", async () => {
    const s = await setup();
    const job = await accepted(s, { code: "PL-03" });
    // A visit 10 days ahead (240 hours). A fresh hold placed at 102 hours would last to 102 + 114 = 216 hours: not long enough.
    const visit = addHours(MONDAY_10AM, 10 * 24);
    await t.db.query("update public.jobs set respond_by = $2::timestamptz, arrival_window_start = $3::timestamptz, arrival_window_end = $2::timestamptz where id = $1::uuid", [
      job.id, addHours(visit, 2).toISOString(), visit.toISOString(),
    ]);
    setTestNow(addHours(MONDAY_10AM, HOLD_VALID_HOURS - 12));
    expect(await keepHoldsAlive(t.db, gatewayFor(t.db))).toMatchObject({ scheduled: 1, released: 1 });
    expect((await getJobForStaff(t.db, job.id))!.holdDueAt?.getTime()).toBe(addHours(visit, -24).getTime());
    expect((await holdsFor(t.db, job.id)).map((hold) => hold.status)).toEqual(["cancelled"]);
    // A day before the visit, the hold goes back on.
    setTestNow(addHours(visit, -24));
    expect(await keepHoldsAlive(t.db, gatewayFor(t.db))).toMatchObject({ placed: 1 });
    expect((await holdsFor(t.db, job.id)).map((hold) => [hold.reason, hold.status])).toEqual([["booking", "cancelled"], ["scheduled", "held"]]);
    expect((await getJobForStaff(t.db, job.id))!.holdDueAt).toBeNull();
  });

  it("a renewal the card declines keeps the job booked, tells the owner and the team once, and is not tried every minute", async () => {
    const s = await setup();
    const job = await accepted(s, { code: "PL-03" });
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    setTestNow(addHours(MONDAY_10AM, HOLD_VALID_HOURS - 12));
    await keepHoldsAlive(t.db, gatewayFor(t.db));
    setTestNow(addHours(MONDAY_10AM, HOLD_VALID_HOURS - 11));
    await keepHoldsAlive(t.db, gatewayFor(t.db));
    expect((await holdsFor(t.db, job.id)).map((hold) => hold.status)).toEqual(["held", "declined"]);
    expect(await getJobForStaff(t.db, job.id)).toMatchObject({ status: "accepted" });
    expect(await openExceptions(t.db, job.id)).toEqual(["hold_failed"]);
    expect(await textsTo(t.db, s.owner.user.phone!, "hold_failed")).toHaveLength(1);
  });
});

describe("pattern flags (DECISIONS.md, 2026-11-23)", () => {
  it("the same tradie and owner with 2 accepted jobs in 90 days ended without Job done: to the queue once, nothing changed, never a decline", async () => {
    const s = await setup();
    const first = await accepted(s, { code: "PL-03" });
    await markEnRoute(t.db, first.id, s.tradie.tradieId);
    await cancelJob(t.db, first.id, { actor: `owner:${s.owner.ownerId}` }, "Sorted");
    expect(await t.db.query("select 1 from public.exceptions where kind like 'pattern_%'")).toHaveLength(0);
    // A no-show on a second job for the same owner: accepted, nobody there by the promised time.
    setTestNow(addHours(MONDAY_10AM, 1));
    const second = await accepted(s, { code: "PL-01" });
    setTestNow(addHours(MONDAY_10AM, 26));
    await markMissedWindows(t.db);
    const flags = await t.db.query<{ kind: string; summary: string }>("select kind, summary from public.exceptions where kind like 'pattern_%' and status = 'open'");
    expect(flags.map((row) => row.kind)).toEqual(["pattern_pair"]);
    expect(flags[0]!.summary).toContain("have had 2 jobs in the last 90 days that Wakatipu Plumbing accepted and that ended without Job done");
    expect(flags[0]!.summary).toContain("Nothing has changed on either account, and this is not counted as a decline.");
    expect(flags[0]!.summary).not.toMatch(/off the app|cheat|suspicious|fraud/i);
    expect(await recentNoShows(t.db, s.tradie.tradieId)).toBe(1);
    expect((await t.db.query<{ status: string }>("select status from public.tradies where id = $1::uuid", [s.tradie.tradieId]))[0]!.status).toBe("approved");
    expect(second.id).not.toBe(first.id);
  });

  it("a tradie with 3 accepted jobs in 90 days cancelled after On my way: to the queue; cancels before On my way never count", async () => {
    const s = await setup();
    for (let n = 0; n < 2; n += 1) {
      const owner = await makeOwner(t.db);
      const job = await accepted({ ...s, owner, property: await makeProperty(t.db, owner.ownerId) }, { code: "PL-01" });
      await markEnRoute(t.db, job.id, s.tradie.tradieId);
      await cancelJob(t.db, job.id, { actor: `owner:${owner.ownerId}` }, "Sorted");
    }
    // Cancelled before On my way: not part of either pattern.
    const early = await accepted(s, { code: "PL-01" });
    await cancelJob(t.db, early.id, { actor: `owner:${s.owner.ownerId}` }, "Sorted");
    expect(await t.db.query("select 1 from public.exceptions where kind = 'pattern_cancels'")).toHaveLength(0);
    const third = await accepted(s, { code: "PL-03" });
    await markEnRoute(t.db, third.id, s.tradie.tradieId);
    await cancelJob(t.db, third.id, { actor: `owner:${s.owner.ownerId}` }, "Sorted");
    const flags = await t.db.query<{ summary: string }>("select summary from public.exceptions where kind = 'pattern_cancels' and status = 'open'");
    expect(flags).toHaveLength(1);
    expect(flags[0]!.summary).toContain("3 jobs Wakatipu Plumbing accepted in the last 90 days were cancelled after they tapped On my way");
  });
});

describe("the payout guarantee, up to NZ$1,000 of a job's price (DECISIONS.md, 2026-11-23)", () => {
  it("the sum, by hand: a NZ$1,500 job, tradie 127500, NZ$1,265 not collected: 26500 over, 22525 waits", () => {
    expect(payoutWaits({ ownerTotalCents: 150000, collectedCents: 23500, guaranteeCents: 100000, payoutCents: 127500 })).toBe(22525);
    expect(payoutWaits({ ownerTotalCents: 150000, collectedCents: 50000, guaranteeCents: 100000, payoutCents: 127500 })).toBe(0);
    expect(payoutWaits({ ownerTotalCents: 90000, collectedCents: 0, guaranteeCents: 100000, payoutCents: 76500 })).toBe(0);
    expect(payoutWaits({ ownerTotalCents: 150000, collectedCents: 0, guaranteeCents: 0, payoutCents: 127500 })).toBe(127500);
  });

  it("pays the guaranteed part at the usual time, and the rest once the card pays", async () => {
    const s = await setup();
    const job = await onSite(s, { code: "PL-01" });
    // 6.25 hours at NZ$160 = 100000 of work, the most that can be quoted in hours; the tradie keeps 100000 - 15000 = 85000.
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace the cistern and the pipe behind it", hours: 6.25, uploadIds: [] });
    if (!quoted.ok) throw new Error(quoted.message);
    expect(await decideQuote(t.db, quoted.quote.id, true, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true });
    // NZ$150 of parts: 15000, the tradie 15000 - 450 = 14550. Over the overall limit, so the owner says yes.
    const parts = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [{ name: "Cistern kit", quantity: 1, unitCents: 15000 }] });
    if (!parts.ok) throw new Error(parts.message);
    await decideQuote(t.db, parts.quote.id, true, `owner:${s.owner.ownerId}`);
    // Owner 22500 + 100000 + 15000 = 137500. Tradie 19000 + 85000 + 14550 = 118550.
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ownerTotalCents: 137500, tradieTotalCents: 118550 });
    // The card declines now: the 22500 hold is taken, the 115000 beyond it fails.
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    const { calls, gateways } = recording();
    expect(await chargeJob(t.db, gateways, job.id)).toBe("failed");
    expect(await payment(job.id)).toMatchObject({ status: "failed", amount_cents: 137500, hold_captured_cents: 22500 });
    expect((await messagesTo(t.db, s.owner.user.phone!, "payment_failed"))[0]!.body).toContain("could not charge your card NZ$1,150");
    // Not collected: 137500 - 22500 = 115000. Over the NZ$1,000: 15000. Waits: 15000 x 118550 / 137500 = 12932.7, so 12933.
    // Sent at the usual time: 118550 - 12933 = 105617.
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(calls.filter((call) => call.kind === "transfer").map((call) => call.amountCents)).toEqual([105617]);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 118550, waits_cents: 12933, rest_status: "waiting" });
    expect((await messagesTo(t.db, s.tradie.phone, "payout_sent"))[0]!.body).toContain("NZ$1,056.17 for job");
    expect(await releaseDueRests(t.db, gateways)).toBe(0);
    // The owner saves a new card; it is charged, and the rest goes to the tradie, on its own key.
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_new", card: DEMO_CARD_OK });
    expect(await chargeJob(t.db, gateways, job.id, { force: true })).toBe("succeeded");
    expect(await payout(job.id)).toMatchObject({ rest_status: "due" });
    expect(await releaseDueRests(t.db, gateways)).toBe(1);
    expect(calls.at(-1)).toMatchObject({ kind: "transfer", amountCents: 12933, key: `hostfix-job-${job.id}-payout-rest` });
    expect(await payout(job.id)).toMatchObject({ rest_status: "sent" });
    expect(await releaseDueRests(t.db, gateways)).toBe(0);
    // 105617 + 12933 = 118550: the tradie got their full share, once.
    expect(105617 + 12933).toBe(118550);
  });
});

describe("a market that guarantees nothing ahead of the card", () => {
  it("holds the whole payout until the card pays, checks again daily, and sends it as soon as the card pays: 19000", async () => {
    const s = await setup();
    await t.db.query("update public.markets set payout_guarantee_cents = 0 where slug = 'queenstown'");
    const job = await onSite(s, { code: "PL-01" });
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    await holdRanOut(t.db, job.id);
    await finish(s, job.id);
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("failed");
    // Not collected 22500, over a guarantee of 0: all 19000 waits.
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", rest_status: "waiting", waits_cents: 0 });
    setTestNow(addHours(MONDAY_10AM, 48));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_new", card: DEMO_CARD_OK });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id, { force: true })).toBe("succeeded");
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
  });
});

describe("work the tradie prices over NZ$1,000 is charged when the owner approves it (DECISIONS.md, 2026-11-23)", () => {
  async function bigQuote(s: Setup) {
    const job = await onSite(s, { code: "PL-01" });
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace the hot water cylinder", labourCents: 150000, uploadIds: [] });
    if (!quoted.ok) throw new Error(quoted.message);
    // Over the NZ$600 limit anyway, and work over NZ$1,000 always waits: the tradie keeps 150000 - 22500 = 127500.
    expect(quoted.quote).toMatchObject({ status: "pending", ownerTotalCents: 150000, tradieTotalCents: 127500 });
    return { job, quote: quoted.quote };
  }

  it("charges the full 150000 at once, then the job's own 22500 from the hold at Job done; the tradie's 146500 goes tied to the quote's charge", async () => {
    const s = await setup();
    const { job, quote } = await bigQuote(s);
    // Approving without the payment is refused.
    expect(await decideQuote(t.db, quote.id, true, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: false });
    const { calls, gateways } = recording();
    expect(await answerQuote(t.db, gateways, quote.id, true, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true, quote: { status: "approved" } });
    expect(calls).toEqual([expect.objectContaining({ kind: "charge", amountCents: 150000, key: `hostfix-quote-${quote.id}-prepay-1` })]);
    expect((await t.db.query<{ status: string }>("select status from public.job_prepayments where quote_id = $1::uuid", [quote.id]))[0]!.status).toBe("succeeded");
    // Owner 22500 + 150000 = 172500. Tradie 19000 + 127500 = 146500.
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ownerTotalCents: 172500, tradieTotalCents: 146500 });
    expect(await chargeJob(t.db, gateways, job.id)).toBe("succeeded");
    // Only 172500 - 150000 = 22500 is left to charge, all of it from the hold.
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500, hold_captured_cents: 22500 });
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    const transfer = calls.filter((call) => call.kind === "transfer");
    expect(transfer).toHaveLength(1);
    // Collected 22500 + 150000 = 172500, all of it: nothing waits. 146500 fits the 150000 quote charge, not the 22500.
    expect(transfer[0]).toMatchObject({ amountCents: 146500 });
    expect(transfer[0]!.chargeId).toMatch(/^demo_ch_/);
  });

  it("a declined card: the quote is not approved, the owner is told, the tradie is told the work can't start; a new card then approves it", async () => {
    const s = await setup();
    const { job, quote } = await bigQuote(s);
    await cardDeclinesFromNow(t.db, s.owner.ownerId);
    const answer = await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`);
    expect(answer).toMatchObject({ ok: false, message: "Your card was declined for the NZ$1,500 quote, so it is not approved yet and the work cannot start. Update your card on the Billing page, then approve it again." });
    expect(await getJobForStaff(t.db, job.id)).toMatchObject({ status: "awaiting_approval" });
    expect((await textsTo(t.db, s.tradie.phone, "quote_cannot_start"))[0]!.body).toContain("the owner's card declined the quote: don't start yet.");
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_new", card: DEMO_CARD_OK });
    const { calls, gateways } = recording();
    expect(await answerQuote(t.db, gateways, quote.id, true, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true });
    // A definite "no" moved the next try to a new key.
    expect(calls).toEqual([expect.objectContaining({ kind: "charge", key: `hostfix-quote-${quote.id}-prepay-2` })]);
  });

  it("refunds the 150000 in full if the work then does not go ahead", async () => {
    const s = await setup();
    const { job, quote } = await bigQuote(s);
    await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`);
    await cancelJob(t.db, job.id, { actor: "staff:maria", staff: true }, "Owner is selling the house");
    const { calls, gateways } = recording();
    expect(await refundDuePrepayments(t.db, gateways)).toBe(1);
    expect(calls).toEqual([expect.objectContaining({ kind: "refund", amountCents: 150000 })]);
    expect((await t.db.query<{ status: string; refunded_cents: number }>("select status, refunded_cents from public.job_prepayments where quote_id = $1::uuid", [quote.id]))[0]).toEqual({ status: "refunded", refunded_cents: 150000 });
    expect((await messagesTo(t.db, s.owner.user.phone!, "quote_refunded"))[0]!.body).toContain("the NZ$1,500 you paid for the approved work is refunded");
    expect(await refundDuePrepayments(t.db, gateways)).toBe(0);
  });
});

describe("own clients at 5% (DECISIONS.md, 2026-11-23)", () => {
  it("normalises an address so the same place matches whatever the account: '88 Fernhill Road, Fernhill 9300' = '88 fernhill rd fernhill 9300'", () => {
    expect(addressKey({ addressLine1: "88 Fernhill Road", addressLine2: null, suburb: "Fernhill", postcode: "9300" })).toBe(
      addressKey({ addressLine1: "88 fernhill rd", addressLine2: "", suburb: "FERNHILL", postcode: "9300" }),
    );
    expect(addressKey({ addressLine1: "3/88 Fernhill Road", addressLine2: null, suburb: "Fernhill", postcode: "9300" })).not.toBe(
      addressKey({ addressLine1: "88 Fernhill Road", addressLine2: null, suburb: "Fernhill", postcode: "9300" }),
    );
  });

  it("a tradie's own client: first choice at the property, the menu share at 5%. PL-03: 23500 - 1175 = 22325 (not 20000)", async () => {
    const s = await setup();
    const own = await makeTradie(t.db, { name: "Mike's Plumbing" });
    const invite = await inviteClient(t.db, { tradieId: own.tradieId, businessName: "Mike's Plumbing", name: "Olive", phone: s.owner.user.phone, email: null });
    if (!invite.ok) throw new Error(invite.message);
    expect((await textsTo(t.db, s.owner.user.phone!, "client_invite"))[0]!.body).toContain("Mike's Plumbing invites you to book them through HostFix: ");
    // Opening the link changes nothing.
    expect(await inviteFromLink(t.db, invite.invite.token)).toMatchObject({ status: "open" });
    expect(await t.db.query("select 1 from public.own_client_pairs")).toHaveLength(0);
    expect(await acceptClientInvite(t.db, invite.invite.token, s.owner.ownerId, s.property.id)).toMatchObject({ ok: true });

    const job = await logJob(t.db, s.property, { code: "PL-03" });
    const offers = await offersFor(t.db, job.id);
    // Mike first, alone, at stage 1; the market's first choice (Wakatipu) moves to stage 2 for this property.
    expect(offers.map((offer) => [offer.tradie_id, offer.stage])).toEqual([[own.tradieId, 1]]);
    expect((await textsTo(t.db, own.phone, "offer"))[0]!.body).toContain("NZ$223.25");
    const taken = await t.db.tx((tx) => acceptOffer(tx, offers[0]!.id, "link"));
    expect(taken).toMatchObject({ result: "accepted", job: { platformFeeBps: 500, ownerTotalCents: 23500, tradieTotalCents: 22325 } });
    // Extra work at 5% too: 2 hours at NZ$160 = 32000, the tradie keeps 32000 - 1600 = 30400.
    await arrive(t.db, job.id, own.tradieId, HOUSE);
    const quoted = await submitQuote(t.db, job.id, own.tradieId, { description: "Replace the trap", hours: 2, uploadIds: [] });
    expect(quoted).toMatchObject({ ok: true, quote: { ownerTotalCents: 32000, tradieTotalCents: 30400 } });
  });

  it("an urgent own-client job: the surcharge at 5% too. PL-01 urgent: owner 27500; tradie 21375 + 4750 = 26125", async () => {
    const s = await setup();
    const own = await makeTradie(t.db, { name: "Mike's Plumbing" });
    const property = await getPropertyForStaff(t.db, s.property.id);
    expect(await makePair(t.db, { tradieId: own.tradieId, property: property!, via: "tradie_invite", inviteId: null, actor: "test" })).toMatchObject({ ok: true });
    const job = await accepted(s, { code: "PL-01", urgent: true }, own.tradieId);
    // 22500 - 5% (1125) = 21375; 5000 - 5% (250) = 4750.
    expect(job).toMatchObject({ platformFeeBps: 500, ownerTotalCents: 27500, tradieTotalCents: 26125 });
    // Another plumber at the same property is still 15%: offered at the market payout of 19000 + 4250 = 23250.
    const other = await logJob(t.db, await makeProperty(t.db, s.owner.ownerId), { code: "PL-01", urgent: true });
    expect((await getJobForStaff(t.db, other.id))).toMatchObject({ platformFeeBps: null, tradieTotalCents: 23250 });
  });

  it("an owner brings their own tradie with a one-tap link; the tradie presses the button, and only then is the pair made", async () => {
    const s = await setup();
    const invite = await inviteOwnTradie(t.db, { ownerId: s.owner.ownerId, ownerName: "Olive Owner", property: s.property, name: "Mike", phone: "+64225550199", trade: "plumber" });
    if (!invite.ok) throw new Error(invite.message);
    expect((await textsTo(t.db, "+64225550199", "own_tradie_invite"))[0]!.body).toContain("Olive Owner wants to book you through HostFix. Sign up:");
    const mike = await makeTradie(t.db, { name: "Mike's Plumbing", approved: false });
    expect(await acceptOwnTradieInvite(t.db, invite.invite.token, mike.tradieId)).toMatchObject({ ok: true, pair: { via: "owner_invite" } });
    expect(await inviteFromLink(t.db, invite.invite.token)).toMatchObject({ status: "used" });
    // Used once: a second press does nothing new.
    expect(await acceptOwnTradieInvite(t.db, invite.invite.token, mike.tradieId)).toMatchObject({ ok: false });
  });

  it("no pair if HostFix already introduced the tradie to that place, matched by address, not by the account", async () => {
    const s = await setup();
    // HostFix offered Wakatipu Plumbing a job at this house.
    await logJob(t.db, s.property, { code: "PL-03" });
    // The owner deletes the property and adds it again under another account, writing the address differently.
    const again = await makeOwner(t.db);
    const readded = await makeProperty(t.db, again.ownerId);
    await t.db.query("update public.properties set address_line1 = upper($2) || ' ', suburb = lower(suburb) where id = $1::uuid", [readded.id, s.property.addressLine1]);
    const property = await getPropertyForStaff(t.db, readded.id);
    const made = await makePair(t.db, { tradieId: s.tradie.tradieId, property: property!, via: "tradie_invite", inviteId: null, actor: "test" });
    expect(made).toMatchObject({ ok: false, message: expect.stringContaining("already sent this tradie a job at this property") });
    // A tradie HostFix never sent there can pair.
    const other = await makeTradie(t.db, { name: "Mike's Plumbing" });
    expect(await makePair(t.db, { tradieId: other.tradieId, property: property!, via: "tradie_invite", inviteId: null, actor: "test" })).toMatchObject({ ok: true });
  });
});
