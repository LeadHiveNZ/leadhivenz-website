import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkDebits } from "@/lib/billing/debits";
import { chargeDuePayments, chargeJob, refundDuePrepayments, releaseDuePayouts, releaseDueRests } from "@/lib/billing/settle";
import { addHours, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { cancelJob } from "@/lib/jobs/create";
import { depositFor, tieredFee, tierRelief, TIER_THRESHOLD_CENTS, ABOVE_TIER_FEE_BPS } from "@/lib/jobs/pricing";
import { getJobForStaff, getQuote } from "@/lib/jobs/store";
import { answerQuote, completeJob, markEnRoute, submitQuote } from "@/lib/jobs/work";
import { loadJobView } from "@/lib/jobs/view";
import { cardProblem, saveBank, saveBilling } from "@/lib/owners/service";
import { DEMO_BANK_FAILS, DEMO_BANK_OK, DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import type { PaymentsGateway } from "@/lib/payments/gateway";
import type { StripeMessage } from "@/lib/payments/deposit";
import { handleProductMessage } from "@/lib/payments/product-events";
import type { StripeAccount } from "@/lib/payments/stripe";
import { testDb } from "./db";
import { arrive, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, messagesTo, MONDAY_10AM, offersFor, openExceptions, photo } from "./factory";

/**
 * DECISIONS.md, 2026-11-23 (second entry): the tiered fee, and work over NZ$1,000 paid by a 50% deposit (bank debit
 * by default, card as the backup) with the rest at Job done. Every amount is worked out by hand from
 * seed/menu-queenstown.json and config/markets.ts, never copied from what the code returns.
 *
 *   PL-01 owner 22500, tradie 19000 (HostFix keeps 3500). Off-menu call-out: owner 22500, tradie 19000.
 *   The fee: 15% of the first NZ$1,000 (100000) of a job's price, parts aside, and 3% of the rest. 5% below the line for
 *   an own client. A quote at the tradie's own price: they keep 85% of it on the lines; the tier gives back the rest.
 *   The hold on the card at booking: PL-01 22500. The deposit: half the approved amount the hold does not cover.
 *   A pretend bank debit clears 72 hours after it is made (DEMO_DEBIT_HOURS); one from DEMO_BANK_FAILS fails then.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const tier = { thresholdCents: TIER_THRESHOLD_CENTS, aboveBps: ABOVE_TIER_FEE_BPS };

describe("the tiered fee, by hand", () => {
  it("NZ$15,000: 15% of 1,000 (150) + 3% of 14,000 (420) = 570 to HostFix, 14,430 to the tradie", () => {
    expect(tieredFee(1_500_000, 1500, tier)).toBe(57_000);
    expect(1_500_000 - tieredFee(1_500_000, 1500, tier)).toBe(1_443_000);
  });

  it("up to NZ$1,000 it is the plain fee: NZ$800 at 15% is 120; NZ$1,000 is 150", () => {
    expect(tieredFee(80_000, 1500, tier)).toBe(12_000);
    expect(tieredFee(100_000, 1500, tier)).toBe(15_000);
  });

  it("own clients: 5% below the line and 3% above it: NZ$15,000 gives 50 + 420 = 470", () => {
    expect(tieredFee(1_500_000, 500, tier)).toBe(47_000);
  });

  it("the tradie's extra on a job's lines: PL-01 + 6.25 hours at NZ$160 is 2825; parts are left out; under the line nothing", () => {
    // Price 22500 + 100000 = 122500. Kept 3500 + 15000 = 18500. Tiered 15000 + 3% of 22500 (675) = 15675. 18500 - 15675 = 2825.
    const lines = [
      { kind: "menu" as const, label: "PL-01", ownerCents: 22500, tradieCents: 19000 },
      { kind: "quote" as const, label: "Work", ownerCents: 100000, tradieCents: 85000 },
      { kind: "parts" as const, label: "Cistern kit", ownerCents: 15000, tradieCents: 14550 },
    ];
    expect(tierRelief(lines, 1500, tier)).toBe(2825);
    expect(tierRelief(lines.slice(0, 1), 1500, tier)).toBe(0);
  });

  it("NZ$15,000 of quoted work on its own: the lines keep 2250, the tier fee is 570, so the tradie gets 1680 more: 14,430 in all", () => {
    const lines = [{ kind: "quote" as const, label: "Work", ownerCents: 1_500_000, tradieCents: 1_500_000 - 225_000 }];
    expect(tierRelief(lines, 1500, tier)).toBe(225_000 - 57_000);
    expect(1_275_000 + 168_000).toBe(1_443_000);
  });

  it("the deposit: half of what the hold does not cover, an odd cent in the deposit", () => {
    expect(depositFor({ quoteCents: 150000, holdCents: 22500, jobTotalCents: 22500 })).toBe(75000);
    // An urgent line that came off leaves 5000 of a 27500 hold spare: (150000 - 5000) / 2 = 72500.
    expect(depositFor({ quoteCents: 150000, holdCents: 27500, jobTotalCents: 22500 })).toBe(72500);
    expect(depositFor({ quoteCents: 150001, holdCents: 0, jobTotalCents: 22500 })).toBe(75001);
    expect(depositFor({ quoteCents: 3000, holdCents: 27500, jobTotalCents: 22500 })).toBe(0);
  });
});

async function setup(bank: "ok" | "fails" | "none" = "ok") {
  await liveMarket(t.db, { min_minutes_on_site: 0 });
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  const tradie = await makeTradie(t.db, { slot: 1, name: "Wakatipu Plumbing" });
  const billing = (await t.db.query<{ customer_id: string }>("select customer_id from public.owner_billing where owner_id = $1::uuid", [owner.ownerId]))[0]!;
  if (bank !== "none") {
    await saveBank(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "demo", customerId: billing.customer_id, bank: bank === "ok" ? DEMO_BANK_OK : DEMO_BANK_FAILS });
  }
  return { owner, property, tradie };
}
type Setup = Awaited<ReturnType<typeof setup>>;

/** PL-01 on site, then work at the tradie's own price. */
async function bigQuote(s: Setup, labourCents: number) {
  const job = await logJob(t.db, s.property, { code: "PL-01" });
  const offer = (await offersFor(t.db, job.id)).find((row) => row.tradie_id === s.tradie.tradieId);
  const taken = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  if (taken.result !== "accepted") throw new Error(taken.result);
  await markEnRoute(t.db, job.id, s.tradie.tradieId);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace the hot water cylinder", labourCents, uploadIds: [] });
  if (!quoted.ok) throw new Error(quoted.message);
  return { job, quote: quoted.quote };
}

async function finish(s: Setup, jobId: string) {
  return completeJob(t.db, jobId, s.tradie.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
}

const prepayment = async (quoteId: string) =>
  (await t.db.query<{ status: string; method: string; amount_cents: number }>("select status, method, amount_cents from public.job_prepayments where quote_id = $1::uuid", [quoteId]))[0];
const payment = async (jobId: string) =>
  (await t.db.query<{ status: string; method: string; amount_cents: number; hold_captured_cents: number; extra_payment_intent_id: string | null }>("select * from public.payments where job_id = $1::uuid", [jobId]))[0];
const payout = async (jobId: string) =>
  (await t.db.query<{ status: string; amount_cents: number; waits_cents: number; rest_status: string | null }>("select * from public.payouts where job_id = $1::uuid", [jobId]))[0];

function recording() {
  const calls: { kind: string; key: string; amountCents?: number }[] = [];
  const gateways = () => {
    const base = gatewayFor(t.db)("NZ")!;
    const wrapped: PaymentsGateway = {
      ...base,
      captureHold: async (input) => { calls.push({ kind: "capture", key: input.idempotencyKey, amountCents: input.amountCents }); return base.captureHold(input); },
      chargeJob: async (input) => { calls.push({ kind: "charge", key: input.idempotencyKey, amountCents: input.amountCents }); return base.chargeJob(input); },
      debitBank: async (input) => { calls.push({ kind: "debit", key: input.idempotencyKey, amountCents: input.amountCents }); return base.debitBank(input); },
      transfer: async (input) => { calls.push({ kind: "transfer", key: input.idempotencyKey, amountCents: input.amountCents }); return base.transfer(input); },
      refund: async (input) => { calls.push({ kind: "refund", key: input.idempotencyKey, amountCents: input.amountCents }); return base.refund(input); },
    };
    return wrapped;
  };
  return { calls, gateways };
}

describe("work that takes a job over NZ$1,000 always waits for the owner and asks for a deposit", () => {
  it("even work inside the owner's limit: PL-01 22500 + 6.25 hours at NZ$160 (100000) = 122500 is over NZ$1,000", async () => {
    const s = await setup();
    await t.db.query("update public.properties set spend_limit_cents = 500000 where id = $1::uuid", [s.property.id]);
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const offer = (await offersFor(t.db, job.id)).find((row) => row.tradie_id === s.tradie.tradieId);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "New cistern", hours: 6.25, uploadIds: [] });
    expect(quoted).toMatchObject({ ok: true, quote: { status: "pending", deposit: true, ownerTotalCents: 100000 } });
    // 4 hours (64000) keeps it at 86500, under the line: inside the limit, it goes ahead as before.
    const small = await logJob(t.db, await makeProperty(t.db, s.owner.ownerId), { code: "PL-01" });
    const smallOffer = (await offersFor(t.db, small.id)).find((row) => row.tradie_id === s.tradie.tradieId);
    await t.db.tx((tx) => acceptOffer(tx, smallOffer!.id, "link"));
    await markEnRoute(t.db, small.id, s.tradie.tradieId);
    await arrive(t.db, small.id, s.tradie.tradieId, HOUSE);
    await t.db.query("update public.properties set spend_limit_cents = 500000 where id = (select property_id from public.jobs where id = $1::uuid)", [small.id]);
    expect(await submitQuote(t.db, small.id, s.tradie.tradieId, { description: "Small", hours: 4, uploadIds: [] })).toMatchObject({ ok: true, quote: { status: "auto_approved", deposit: false } });
  });
});

describe("the deposit from the owner's bank (the default)", () => {
  it("NZ$1,500 on PL-01: 75000 debited at approval; the tradie waits until it clears; the rest (22500 from the hold, 75000 debited) at Job done", async () => {
    const s = await setup("ok");
    const { job, quote } = await bigQuote(s, 150000);
    const { calls, gateways } = recording();
    const answer = await answerQuote(t.db, gateways, quote.id, true, `owner:${s.owner.ownerId}`);
    expect(answer).toMatchObject({ ok: true, quote: { status: "pending" } });
    expect(calls).toEqual([expect.objectContaining({ kind: "debit", amountCents: 75000, key: `hostfix-quote-${quote.id}-deposit-1` })]);
    expect(await prepayment(quote.id)).toEqual({ status: "processing", method: "bank", amount_cents: 75000 });
    expect((await messagesTo(t.db, s.tradie.phone, "deposit_clearing"))[0]!.body).toContain("approved, deposit clearing (usually 3-4 working days). Don't start yet.");
    // The owner sees it clearing, and cannot answer again; the tradie cannot finish yet.
    const view = await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "owner");
    expect(view.deposit).toMatchObject({ amountCents: 75000, status: "processing", method: "bank", bankSaved: true });
    expect(await answerQuote(t.db, gateways, quote.id, false, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: false });
    expect(await finish(s, job.id)).toMatchObject({ ok: false });
    // Two days on, still processing; at 72 hours it has cleared.
    setTestNow(addHours(MONDAY_10AM, 48));
    expect(await checkDebits(t.db, gateways)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 73));
    expect(await checkDebits(t.db, gateways)).toBe(1);
    expect(await getQuote(t.db, quote.id)).toMatchObject({ status: "approved", decidedBy: `owner:${s.owner.ownerId}` });
    expect((await messagesTo(t.db, s.tradie.phone, "deposit_cleared"))[0]!.body).toContain("deposit cleared, go ahead");
    expect(await checkDebits(t.db, gateways)).toBe(0);

    // Owner 22500 + 150000 = 172500. The tier: price 172500, kept 3500 + 22500 = 26000, tiered 15000 + 3% of 72500 (2175)
    // = 17175, so 8825 more. Tradie 19000 + 127500 + 8825 = 155325 (172500 - 17175).
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ok: true, job: { ownerTotalCents: 172500, tradieTotalCents: 155325, tierReliefCents: 8825 } });
    // Left to charge 172500 - 75000 = 97500: 22500 from the hold, 75000 debited from the bank.
    expect(await chargeJob(t.db, gateways, job.id)).toBe("processing");
    expect(calls.slice(-2)).toEqual([
      expect.objectContaining({ kind: "capture", amountCents: 22500 }),
      expect.objectContaining({ kind: "debit", amountCents: 75000, key: `hostfix-job-${job.id}-debit-1` }),
    ]);
    expect(await payment(job.id)).toMatchObject({ status: "processing", method: "bank", amount_cents: 97500, hold_captured_cents: 22500 });
    expect((await messagesTo(t.db, s.owner.user.phone!, "job_done"))).toHaveLength(1);
    // The payout at the usual time: collected 22500 + 75000 = 97500, not collected 75000, inside the NZ$1,000 guarantee: all 155325 goes.
    setTestNow(addHours(MONDAY_10AM, 73 + 24));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(calls.filter((call) => call.kind === "transfer").map((call) => call.amountCents)).toEqual([155325]);
    // The debit clears 72 hours after Job done.
    setTestNow(addHours(MONDAY_10AM, 73 + 73));
    expect(await checkDebits(t.db, gateways)).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded" });
    expect((await messagesTo(t.db, s.owner.user.phone!, "job_done"))).toHaveLength(1);
    expect(await cardProblem(t.db, s.owner.ownerId, "NZ", addHours(MONDAY_10AM, 146), "Pacific/Auckland")).toBeNull();
  });

  it("with no bank account saved: choosing the bank asks for one first; the default is then the card", async () => {
    const s = await setup("none");
    const { quote } = await bigQuote(s, 150000);
    expect(await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`, { method: "bank" })).toEqual({ ok: false, message: "Add your bank account first, or pay the deposit by card instead." });
    expect(await prepayment(quote.id)).toBeUndefined();
    expect(await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true, quote: { status: "approved" } });
    expect(await prepayment(quote.id)).toEqual({ status: "succeeded", method: "card", amount_cents: 75000 });
  });

  it("a deposit that fails: the quote stays unapproved, the owner and tradie are told, the team has it; the card then pays it on a new key", async () => {
    const s = await setup("fails");
    const { job, quote } = await bigQuote(s, 150000);
    await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`);
    setTestNow(addHours(MONDAY_10AM, 73));
    expect(await checkDebits(t.db, gatewayFor(t.db))).toBe(1);
    expect(await prepayment(quote.id)).toMatchObject({ status: "failed" });
    expect(await getQuote(t.db, quote.id)).toMatchObject({ status: "pending" });
    expect(await getJobForStaff(t.db, job.id)).toMatchObject({ status: "awaiting_approval" });
    expect((await messagesTo(t.db, s.owner.user.phone!, "quote_payment_failed"))[0]!.body).toContain("the NZ$750 deposit from your bank didn't go through, so the work isn't approved.");
    expect((await messagesTo(t.db, s.tradie.phone, "quote_cannot_start"))[0]!.body).toContain("the owner's deposit didn't go through: don't start.");
    expect(await openExceptions(t.db, job.id)).toContain("deposit_failed");
    const { calls, gateways } = recording();
    expect(await answerQuote(t.db, gateways, quote.id, true, `owner:${s.owner.ownerId}`, { method: "card" })).toMatchObject({ ok: true, quote: { status: "approved" } });
    expect(calls).toEqual([expect.objectContaining({ kind: "charge", amountCents: 75000, key: `hostfix-quote-${quote.id}-deposit-2` })]);
  });

  it("a deposit that clears after the job was cancelled is refunded, not approved", async () => {
    const s = await setup("ok");
    const { job, quote } = await bigQuote(s, 150000);
    await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`);
    await cancelJob(t.db, job.id, { actor: "staff:maria", staff: true }, "Owner is selling the house");
    setTestNow(addHours(MONDAY_10AM, 73));
    expect(await checkDebits(t.db, gatewayFor(t.db))).toBe(1);
    expect(await prepayment(quote.id)).toMatchObject({ status: "refund_due" });
    const { calls, gateways } = recording();
    expect(await refundDuePrepayments(t.db, gateways)).toBe(1);
    expect(calls).toEqual([expect.objectContaining({ kind: "refund", amountCents: 75000 })]);
    expect((await messagesTo(t.db, s.owner.user.phone!, "quote_refunded"))[0]!.body).toContain("the NZ$750 deposit you paid for the approved work is refunded");
  });
});

describe("the card instead (for urgent big work)", () => {
  it("charges the 75000 deposit at once and approves; the rest is charged to the card at Job done: 22500 from the hold, 75000 beyond it", async () => {
    const s = await setup("ok");
    const { job, quote } = await bigQuote(s, 150000);
    const { calls, gateways } = recording();
    expect(await answerQuote(t.db, gateways, quote.id, true, `owner:${s.owner.ownerId}`, { method: "card" })).toMatchObject({ ok: true, quote: { status: "approved" } });
    expect(calls).toEqual([expect.objectContaining({ kind: "charge", amountCents: 75000, key: `hostfix-quote-${quote.id}-deposit-1` })]);
    expect((await messagesTo(t.db, s.tradie.phone, "quote_approved"))).toHaveLength(1);
    expect(await finish(s, job.id)).toMatchObject({ ok: true, job: { ownerTotalCents: 172500, tradieTotalCents: 155325 } });
    expect(await chargeJob(t.db, gateways, job.id)).toBe("succeeded");
    expect(calls.slice(-2)).toEqual([
      expect.objectContaining({ kind: "capture", amountCents: 22500 }),
      expect.objectContaining({ kind: "charge", amountCents: 75000, key: `hostfix-job-${job.id}-charge-1` }),
    ]);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", method: "card", amount_cents: 97500 });
  });
});

describe("the debit at Job done fails", () => {
  it("NZ$3,000 on PL-01: the owner owes the 150000, new jobs are blocked, the tradie's share above the guarantee waits; a new card pays it", async () => {
    const s = await setup("ok");
    const { job, quote } = await bigQuote(s, 300000);
    const { calls, gateways } = recording();
    await answerQuote(t.db, gateways, quote.id, true, `owner:${s.owner.ownerId}`);
    setTestNow(addHours(MONDAY_10AM, 73));
    await checkDebits(t.db, gateways);
    // Owner 22500 + 300000 = 322500. Tier: kept 3500 + 45000 = 48500, tiered 15000 + 3% of 222500 (6675) = 21675, so 26825 more.
    // Tradie 19000 + 255000 + 26825 = 300825.
    expect(await finish(s, job.id)).toMatchObject({ ok: true, job: { ownerTotalCents: 322500, tradieTotalCents: 300825 } });
    // The owner's bank account stops working before the second debit.
    await t.db.query("update public.owner_billing set bank_payment_method_id = $2 where owner_id = $1::uuid", [s.owner.ownerId, DEMO_BANK_FAILS.paymentMethodId]);
    // Left: 322500 - 150000 = 172500: 22500 from the hold, 150000 debited.
    expect(await chargeJob(t.db, gateways, job.id)).toBe("processing");
    // The payout at the usual time: collected 22500 + 150000 = 172500, not collected 150000, over the NZ$1,000 50000.
    // Waits 50000 x 300825 / 322500 = 46639.5, so 46640. Sent now: 300825 - 46640 = 254185.
    setTestNow(addHours(MONDAY_10AM, 73 + 24));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", waits_cents: 46640, rest_status: "waiting" });
    expect(calls.filter((call) => call.kind === "transfer").map((call) => call.amountCents)).toEqual([254185]);
    setTestNow(addHours(MONDAY_10AM, 73 + 73));
    expect(await checkDebits(t.db, gateways)).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "failed", method: "card" });
    expect(await openExceptions(t.db, job.id)).toEqual(expect.arrayContaining(["payment_failed", "owner_owes"]));
    expect((await messagesTo(t.db, s.owner.user.phone!, "payment_failed"))[0]!.body).toContain("the NZ$1,500 debit from your bank didn't go through");
    expect(await cardProblem(t.db, s.owner.ownerId, "NZ", addHours(MONDAY_10AM, 146), "Pacific/Auckland")).toBe("unpaid");
    // Not tried again by itself.
    setTestNow(addHours(MONDAY_10AM, 73 + 73 + 48));
    expect(await chargeDuePayments(t.db, gateways)).toBe(0);
    expect(await releaseDueRests(t.db, gateways)).toBe(0);
    // The owner saves a new card: the 150000 goes on it, and the 46640 that waited goes to the tradie.
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_new", card: DEMO_CARD_OK });
    expect(await chargeDuePayments(t.db, gateways)).toBe(1);
    expect(calls.filter((call) => call.kind === "charge").map((call) => call.amountCents)).toEqual([150000]);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded" });
    expect(await releaseDueRests(t.db, gateways)).toBe(1);
    expect(calls.at(-1)).toMatchObject({ kind: "transfer", amountCents: 46640 });
    expect(254185 + 46640).toBe(300825);
  });
});

describe("Stripe's message that a debit cleared", () => {
  it("payment_intent.succeeded for a deposit approves the quote, once, however often it arrives", async () => {
    const s = await setup("ok");
    const { quote } = await bigQuote(s, 150000);
    await answerQuote(t.db, gatewayFor(t.db), quote.id, true, `owner:${s.owner.ownerId}`);
    const intentId = (await t.db.query<{ payment_intent_id: string }>("select payment_intent_id from public.job_prepayments where quote_id = $1::uuid", [quote.id]))[0]!.payment_intent_id;
    const account: StripeAccount = { country: "NZ", secretKey: "sk_test_unit", webhookSecret: "whsec_unit", mode: "test" };
    const message = (type: string): StripeMessage => ({
      kind: "snapshot",
      event: { id: `evt_${type}`, type, data: { object: { id: intentId, object: "payment_intent", status: "succeeded", latest_charge: "ch_x", metadata: { hostfix_debit: "deposit" } } } } as unknown as Stripe.Event,
    });
    expect(await handleProductMessage(t.db, message("payment_intent.succeeded"), account)).toEqual({ handled: true, outcome: "debit_deposit_cleared" });
    expect(await getQuote(t.db, quote.id)).toMatchObject({ status: "approved" });
    expect(await handleProductMessage(t.db, message("payment_intent.succeeded"), account)).toEqual({ handled: true, outcome: "nothing_to_change" });
    expect((await messagesTo(t.db, s.tradie.phone, "deposit_cleared"))).toHaveLength(1);
    // A payment that is not a debit of ours is left for the rest of the app.
    const other: StripeMessage = { kind: "snapshot", event: { id: "evt_other", type: "payment_intent.succeeded", data: { object: { id: "pi_other", metadata: {} } } } as unknown as Stripe.Event };
    expect(await handleProductMessage(t.db, other, account)).toBeNull();
  });
});
