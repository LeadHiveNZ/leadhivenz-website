import http from "node:http";
import type { AddressInfo } from "node:net";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chargeJob, raiseDispute, releaseDuePayouts, resolveDispute } from "@/lib/billing/settle";
import { addHours, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { completeJob } from "@/lib/jobs/work";
import { saveBilling } from "@/lib/owners/service";
import type { StripeMessage } from "@/lib/payments/deposit";
import { DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import { PlatformBalanceTooLow, type PaymentsGateway } from "@/lib/payments/gateway";
import { handleProductMessage } from "@/lib/payments/product-events";
import type { StripeAccount } from "@/lib/payments/stripe";
import { createStripeGateway, payoutAccountProfile } from "@/lib/payments/stripe-gateway";
import { testDb } from "./db";
import { arrive, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, openExceptions, photo } from "./factory";

/**
 * WHAT THE FIRST REAL STRIPE SANDBOX RUN FOUND (NZ platform, test mode, 21 Nov 2026), and the fixes
 * (DECISIONS.md, 2026-11-21).
 *
 *   1. A tradie's new payout account asked for a business website. The app now fills in what the
 *      business does (Stripe accepts that instead of a website), its category code, and "individual".
 *   2. A NZ$50 refund before the payout, then a NZ$200 transfer tied to the NZ$235 charge: Stripe refused
 *      it, because only NZ$185 was left of the charge.
 *   3. A tradie paid ahead of a failed card needs HostFix's own available balance, which is often empty
 *      while card money is still on its way. The payout waits and is tried again; it never fails for this.
 *
 * THE NUMBERS, worked out by hand from seed/menu-queenstown.json:
 *   PL-03  owner 23500  tradie 20000  (we keep 3500)
 *   Refund 5000 before the payout. The tradie's share of it is 5000 x 20000 / 23500 = 4255.32, so 4255.
 *   The payout becomes 20000 - 4255 = 15745. What is left of the charge: 23500 - 5000 = 18500.
 *   15745 is under 18500, so the transfer can be tied to the charge.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function finishedJob(options: { card?: "ok" | "declines" } = {}) {
  await liveMarket(t.db, { min_minutes_on_site: 0 });
  const owner = await makeOwner(t.db, { card: options.card ?? "ok" });
  const property = await makeProperty(t.db, owner.ownerId);
  const tradie = await makeTradie(t.db, { slot: 1, trades: ["plumber"], name: "Wakatipu Plumbing" });
  const job = await logJob(t.db, property, { code: "PL-03" });
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  const arrived = await arrive(t.db, job.id, tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  const done = await completeJob(t.db, job.id, tradie.tradieId, { note: "All sorted.", uploadIds: [await photo(t.db, `tradie:${tradie.tradieId}`)], ...HOUSE });
  if (!done.ok) throw new Error(done.message);
  expect(done.job).toMatchObject({ ownerTotalCents: 23500, tradieTotalCents: 20000 });
  return { owner, tradie, job: done.job };
}

type TransferCall = Parameters<PaymentsGateway["transfer"]>[0];

/** The demo payment company, with every transfer written down, and optionally a platform balance that is too low. */
function recording(options: { balanceLow?: () => boolean } = {}) {
  const transfers: TransferCall[] = [];
  const gateways = () => {
    const base = gatewayFor(t.db)("NZ")!;
    return {
      ...base,
      transfer: async (input: TransferCall) => {
        transfers.push(input);
        // Stripe: a transfer tied to a charge works off the charge; one without needs available balance.
        if (!input.chargeId && options.balanceLow?.()) throw new PlatformBalanceTooLow("Insufficient funds in Stripe account.");
        return base.transfer(input);
      },
    };
  };
  return { transfers, gateways };
}

const payoutRow = async (jobId: string) =>
  (await t.db.query<{ status: string; amount_cents: number; attempts: number; balance_waits: number }>("select status, amount_cents, attempts, balance_waits from public.payouts where job_id = $1::uuid", [jobId]))[0]!;
const paymentRow = async (jobId: string) =>
  (await t.db.query<{ amount_cents: number; refunded_cents: number; status: string; payment_intent_id: string }>("select amount_cents, refunded_cents, status, payment_intent_id from public.payments where job_id = $1::uuid", [jobId]))[0]!;

describe("a part refund before the tradie is paid (sandbox: NZ$235 charged, NZ$50 back, NZ$200 transfer refused)", () => {
  it("on the job page: the payout is cut by the tradie's share, and the transfer tied to the charge fits what is left of it", async () => {
    const { owner, job } = await finishedJob();
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    const dispute = await raiseDispute(t.db, job.id, `owner:${owner.ownerId}`, "Still drips a bit");
    if (!dispute.ok) throw new Error("expected a dispute");
    expect(await resolveDispute(t.db, gatewayFor(t.db), dispute.disputeId, { outcome: "refund", refundCents: 5000 }, "NZ$50 back", "staff:va")).toEqual({ ok: true });

    expect(await paymentRow(job.id)).toMatchObject({ amount_cents: 23500, refunded_cents: 5000, status: "part_refunded" });
    expect(await payoutRow(job.id)).toMatchObject({ status: "scheduled", amount_cents: 15745 });

    const { transfers, gateways } = recording();
    setTestNow(addHours(MONDAY_10AM, 1));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ amountCents: 15745 });
    expect(transfers[0]!.chargeId).toMatch(/^demo_ch_/);
    // Never more than the charge less its refunds: 15745 <= 23500 - 5000.
    expect(transfers[0]!.amountCents).toBeLessThanOrEqual(23500 - 5000);
    expect(await payoutRow(job.id)).toMatchObject({ status: "sent", amount_cents: 15745 });
  });

  it("made by hand in Stripe: the same cut is made when Stripe tells us, before the payout goes", async () => {
    const { job } = await finishedJob();
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const { payment_intent_id } = await paymentRow(job.id);
    const account: StripeAccount = { country: "NZ", secretKey: "sk_test_unit", webhookSecret: "whsec_unit", mode: "test" };
    const message: StripeMessage = { kind: "snapshot", event: { id: "evt_sandbox_refund", type: "charge.refunded", data: { object: { id: "ch_x", payment_intent: payment_intent_id } } } as unknown as Stripe.Event };
    const refunds = { fetch: { refundsFor: async () => [{ id: "re_by_hand", amount: 5000, status: "succeeded", metadata: {} } as unknown as Stripe.Refund] } };
    expect(await handleProductMessage(t.db, message, account, refunds)).toEqual({ handled: true, outcome: "refund_outside_app" });
    // Stripe sends the same message twice sometimes: nothing comes off twice.
    expect(await handleProductMessage(t.db, message, account, refunds)).toEqual({ handled: true, outcome: "nothing_to_change" });
    expect(await payoutRow(job.id)).toMatchObject({ status: "scheduled", amount_cents: 15745 });
    const note = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'needs_review'", [job.id]);
    expect(note[0]!.summary).toContain("cut by their share of it (NZ$42.55)");

    const { transfers, gateways } = recording();
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(transfers[0]).toMatchObject({ amountCents: 15745 });
    expect(transfers[0]!.chargeId).toMatch(/^demo_ch_/);
  });

  it("a payout bigger than what is left of its charge is never tied to the charge: it goes from our own balance", async () => {
    const { job } = await finishedJob();
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    // As if NZ$100 had come off the charge without touching the payout (an old missed-promise credit does
    // this): 20000 is more than 23500 - 10000 = 13500, which Stripe would refuse for a tied transfer.
    await t.db.query("update public.payments set refunded_cents = 10000, status = 'part_refunded' where job_id = $1::uuid", [job.id]);
    const { transfers, gateways } = recording();
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(transfers[0]).toMatchObject({ amountCents: 20000, chargeId: null });
  });
});

describe("paying a tradie ahead of a failed card when the HostFix Stripe balance is too low", () => {
  it("waits, never fails, puts one 'top up' item in the queue, tries again on each timer run with a new key, and pays once there is money", async () => {
    const { job } = await finishedJob({ card: "declines" });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("failed");
    let low = true;
    const { transfers, gateways } = recording({ balanceLow: () => low });

    // Due 24 hours after Job done (the market's hold). Four timer runs with the balance still too low:
    // more than the three tries that would mark an ordinary failure as given up.
    const due = addHours(MONDAY_10AM, 24);
    for (let minute = 0; minute < 4; minute += 1) {
      setTestNow(new Date(due.getTime() + minute * 60_000));
      expect(await releaseDuePayouts(t.db, gateways)).toBe(0);
    }
    expect(await payoutRow(job.id)).toMatchObject({ status: "waiting", amount_cents: 20000, attempts: 0, balance_waits: 4 });
    expect(transfers.map((call) => call.chargeId)).toEqual([null, null, null, null]);
    // A refused try is a definite "no", and Stripe replays a saved error for the same key, so each try has its own.
    expect(transfers.map((call) => call.idempotencyKey)).toEqual([
      `hostfix-job-${job.id}-payout`, `hostfix-job-${job.id}-payout-w1`, `hostfix-job-${job.id}-payout-w2`, `hostfix-job-${job.id}-payout-w3`,
    ]);
    expect(await openExceptions(t.db, job.id)).toEqual(["payment_failed", "platform_balance"]);
    const item = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'platform_balance'", [job.id]);
    expect(item).toHaveLength(1);
    expect(item[0]!.summary).toContain("Top up the HostFix Stripe balance to pay Wakatipu Plumbing");
    expect(item[0]!.summary).toContain("NZ$200");
    expect(await t.db.query("select 1 from public.audit_log where action = 'payout.waiting_for_balance' and entity_id = $1", [job.id])).toHaveLength(1);
    expect(await t.db.query("select 1 from public.audit_log where action = 'payout.failed' and entity_id = $1", [job.id])).toHaveLength(0);

    // The admin tops up the balance. The next timer run pays the tradie and clears the queue item.
    low = false;
    setTestNow(new Date(due.getTime() + 5 * 60_000));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(transfers.at(-1)).toMatchObject({ amountCents: 20000, chargeId: null, idempotencyKey: `hostfix-job-${job.id}-payout-w4` });
    expect(await payoutRow(job.id)).toMatchObject({ status: "sent" });
    expect(await openExceptions(t.db, job.id)).toEqual(["payment_failed"]);
  });

  it("a card that goes through while the payout waits lets it go from the charge instead", async () => {
    const { owner, job } = await finishedJob({ card: "declines" });
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    const { transfers, gateways } = recording({ balanceLow: () => true });
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(0);
    expect(await payoutRow(job.id)).toMatchObject({ status: "waiting" });

    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_fixed", card: DEMO_CARD_OK });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id, { force: true })).toBe("succeeded");
    expect(await payoutRow(job.id)).toMatchObject({ status: "scheduled" });
    setTestNow(addHours(MONDAY_10AM, 24.1));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(transfers.at(-1)!.chargeId).toMatch(/^demo_ch_/);
    expect(await openExceptions(t.db, job.id)).toEqual([]);
  });
});

/** A stand-in for Stripe's API on this computer, recording what the app sends. */
async function standInStripe(reply: (path: string) => { status: number; body: unknown }) {
  const requests: { path: string; body: URLSearchParams }[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = (req.url ?? "").split("?")[0]!;
      requests.push({ path, body: new URLSearchParams(raw) });
      const { status, body } = reply(path);
      res.writeHead(status, { "content-type": "application/json", "request-id": "req_standin" });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  vi.stubEnv("STRIPE_TEST_SERVER", `http://127.0.0.1:${port}`);
  // A key of its own, so the app makes a fresh Stripe client that talks to this stand-in.
  const account: StripeAccount = { country: "NZ", secretKey: `sk_test_standin_${port}`, webhookSecret: null, mode: "test" };
  return { requests, account, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

describe("a tradie's new Stripe payout account (sandbox: Stripe asked for a business website)", () => {
  it("fills in what the business does, its category and 'individual', so no website is asked for, and never the terms", async () => {
    const stripe = await standInStripe(() => ({ status: 200, body: { id: "acct_standin", object: "account" } }));
    try {
      const gateway = createStripeGateway(stripe.account);
      expect(await gateway.createPayoutAccount({ tradieId: "t-1", businessName: "Wakatipu Plumbing", email: "w@example.com", trades: ["plumber", "gasfitter"] })).toEqual({ accountId: "acct_standin" });
      const sent = stripe.requests.find((request) => request.path === "/v1/accounts")!.body;
      expect(sent.get("business_type")).toBe("individual");
      expect(sent.get("business_profile[name]")).toBe("Wakatipu Plumbing");
      expect(sent.get("business_profile[product_description]")).toBe("Plumbing and gasfitting maintenance and repairs for holiday homes, booked through HostFix.");
      expect(sent.get("business_profile[mcc]")).toBe("1711");
      expect(sent.get("business_profile[url]")).toBeNull();
      expect(sent.get("controller[stripe_dashboard][type]")).toBe("express");
      expect(sent.get("capabilities[transfers][requested]")).toBe("true");
      expect([...sent.keys()].some((key) => key.startsWith("tos_acceptance"))).toBe(false);
    } finally {
      await stripe.close();
    }
  });

  it("describes each trade in plain words, and leaves the category to Stripe where none plainly fits", () => {
    expect(payoutAccountProfile(["plumber", "electrician", "handyman"])).toEqual({
      product_description: "Plumbing, electrical and handyman maintenance and repairs for holiday homes, booked through HostFix.",
      mcc: "1711",
    });
    expect(payoutAccountProfile(["electrician"])).toEqual({ product_description: "Electrical maintenance and repairs for holiday homes, booked through HostFix.", mcc: "1731" });
    expect(payoutAccountProfile(["locksmith"])).toEqual({ product_description: "Locksmith maintenance and repairs for holiday homes, booked through HostFix." });
    expect(payoutAccountProfile(["other"])).toEqual({ product_description: "Maintenance and repairs for holiday homes, booked through HostFix." });
  });

  it("turns Stripe's 'not enough available balance' into a wait, not a failure", async () => {
    const stripe = await standInStripe(() => ({
      status: 400,
      body: { error: { type: "invalid_request_error", code: "balance_insufficient", message: "You have insufficient available funds in your Stripe account." } },
    }));
    try {
      const gateway = createStripeGateway(stripe.account);
      await expect(gateway.transfer({ accountId: "acct_1", amountCents: 20000, currency: "NZD", chargeId: null, jobNumber: 7, idempotencyKey: "k" })).rejects.toBeInstanceOf(PlatformBalanceTooLow);
      const sent = stripe.requests.find((request) => request.path === "/v1/transfers")!.body;
      expect(sent.get("amount")).toBe("20000");
      expect(sent.get("source_transaction")).toBeNull();
    } finally {
      await stripe.close();
    }
  });
});
