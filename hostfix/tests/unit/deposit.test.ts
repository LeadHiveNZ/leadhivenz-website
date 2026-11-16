import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { launchMarket, type Market } from "@config/markets";
import {
  buildDepositSessionParams,
  depositAvailability,
  DepositNotAllowedError,
  fulfilDepositSession,
  handleStripeEvent,
  handleStripeMessage,
  startDepositCheckout,
  verifyStripeWebhook,
  type DepositDeps,
} from "@/lib/payments/deposit";
import { stripeAccount, stripeClient, type StripeAccount } from "@/lib/payments/stripe";
import { SqlLeadStore } from "@/lib/store/sql";
import type { Lead } from "@/lib/store/types";
import { testDb } from "./db";
import { ownerLead, tradieLead } from "./store-contract";

const t = testDb();
async function freshStore(): Promise<SqlLeadStore> {
  return new SqlLeadStore(async () => t.db, "demo");
}

const account: StripeAccount = { country: "NZ", secretKey: "sk_test_abc123", webhookSecret: "whsec_test_secret", mode: "test" };
const market: Market = launchMarket;
const BASE = "https://hostfix.example";
const quiet = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

type Sent = { template: string; leadId: string | null; sms: string };

function harness(store: SqlLeadStore) {
  const sent: Sent[] = [];
  const deferred: (() => Promise<void>)[] = [];
  const deps: DepositDeps = {
    store,
    defer: (work) => {
      deferred.push(work);
    },
    alert: (async (content: Sent) => {
      sent.push({ template: content.template, leadId: content.leadId, sms: content.sms });
      return { anySent: true, sms: { status: "sent", detail: "" }, email: { status: "sent", detail: "" } };
    }) as unknown as DepositDeps["alert"],
    log: quiet,
  };
  return {
    deps,
    sent,
    runDeferred: async () => {
      for (const work of deferred.splice(0)) await work();
    },
  };
}

function paidSession(lead: Lead, overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    status: "complete",
    amount_total: 4900,
    currency: "nzd",
    client_reference_id: lead.id,
    customer: "cus_1",
    payment_intent: "pi_1",
    metadata: { lead_id: lead.id, market: "queenstown", purpose: "founding_deposit" },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe("what we ask Stripe to charge", () => {
  it("charges the market's deposit, in the market's currency, by card", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const params = buildDepositSessionParams(lead, market, BASE);

    expect(params.mode).toBe("payment");
    expect(params.allowed_payment_method_types).toEqual(["card"]);
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items?.[0]).toMatchObject({
      quantity: 1,
      // Queenstown's founding deposit is $99 (config/markets.ts).
      price_data: { currency: "nzd", unit_amount: 9900, product_data: { name: "HostFix founding member deposit" } },
    });
    expect(params.client_reference_id).toBe(lead.id);
    expect(params.customer_email).toBe("olive@example.com");
    expect(params.metadata).toEqual({ lead_id: lead.id, market: "queenstown", purpose: "founding_deposit" });
    expect(params.payment_intent_data?.metadata).toEqual(params.metadata);
    expect(params.payment_intent_data?.receipt_email).toBe("olive@example.com");
    // The small print next to the pay button is the market's own promises, word for word, so the card page
    // never says something different from the page the owner just read.
    expect(params.custom_text).toEqual({
      submit: {
        message:
          "Half price for your first three months: $49.50 a month, then $99. Your $99 deposit comes off your first bills. " +
          "Refundable any time before your first job. One email and it is back on your card.",
      },
    });
    expect(params.success_url).toBe("https://hostfix.example/owners/deposit/return?session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toBe("https://hostfix.example/owners/thanks?deposit=cancelled");
  });

  it("follows the market: an Australian market charges Australian dollars", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const noosa: Market = { ...market, slug: "noosa", name: "Noosa", country: "AU", currency: "AUD", foundingDeposit: { enabled: true, amountCents: 5900, spots: null, terms: [] } };
    const params = buildDepositSessionParams(lead, noosa, BASE);
    expect(params.line_items?.[0]?.price_data).toMatchObject({ currency: "aud", unit_amount: 5900 });
    expect(params.metadata?.market).toBe("noosa");
    expect(params).not.toHaveProperty("custom_text");
  });

  it("never puts personal details in Stripe metadata", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const text = JSON.stringify(buildDepositSessionParams(lead, market, BASE).metadata);
    expect(text).not.toContain("Olive");
    expect(text).not.toContain("olive@example.com");
    expect(text).not.toContain("+64211234567");
  });

  it("refuses to build a charge for a tradie", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(tradieLead());
    expect(() => buildDepositSessionParams(lead, market, BASE)).toThrow(/Only an owner/);
  });
});

describe("whether the deposit can be offered", () => {
  it("needs the Stripe key for the market's country", () => {
    expect(depositAvailability(market)).toEqual({ available: false, reason: "STRIPE_NZ_SECRET_KEY is not set." });
    vi.stubEnv("STRIPE_AU_SECRET_KEY", "sk_test_au");
    expect(depositAvailability(market)).toEqual({ available: false, reason: "STRIPE_NZ_SECRET_KEY is not set." });
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    expect(depositAvailability(market)).toMatchObject({ available: true, account: { country: "NZ", mode: "test" } });
  });

  it("can be switched off per market", () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const off: Market = { ...market, foundingDeposit: { ...market.foundingDeposit, enabled: false } };
    expect(depositAvailability(off)).toEqual({ available: false, reason: "The deposit offer is switched off for Queenstown." });
  });

  it("refuses a deposit amount that is not whole cents", () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const bad: Market = { ...market, foundingDeposit: { ...market.foundingDeposit, amountCents: 49.5 } };
    expect(depositAvailability(bad).available).toBe(false);
  });

  it("spots the wrong kind of key", () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "pk_test_123");
    expect(stripeAccount("NZ")).toEqual({
      problem: "STRIPE_NZ_SECRET_KEY holds the publishable key (pk_...). Use the secret key instead (sk_...).",
    });
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "hello");
    expect(stripeAccount("NZ")).toMatchObject({ problem: expect.stringContaining("does not look like a Stripe secret key") });
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_live_abc");
    vi.stubEnv("STRIPE_NZ_WEBHOOK_SECRET", "oops");
    expect(stripeAccount("NZ")).toEqual({ problem: "STRIPE_NZ_WEBHOOK_SECRET should start with whsec_." });
    vi.stubEnv("STRIPE_NZ_WEBHOOK_SECRET", "whsec_abc");
    expect(stripeAccount("NZ")).toEqual({
      account: { country: "NZ", secretKey: "sk_live_abc", webhookSecret: "whsec_abc", mode: "live" },
    });
  });
});

describe("starting the card payment", () => {
  function fakeStripe() {
    const create = vi.fn(async () => ({ id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" }));
    return { stripe: { checkout: { sessions: { create } } } as unknown as Stripe, create };
  }

  it("creates the card page and marks the lead as started", async () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const { stripe, create } = fakeStripe();

    const result = await startDepositCheckout(lead, market, BASE, { store, stripe, now: () => 1_700_000_000_000 });

    expect(result).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_new", sessionId: "cs_test_new" });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as unknown as [Stripe.Checkout.SessionCreateParams, { idempotencyKey: string }];
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(9900);
    expect(options.idempotencyKey).toBe(`hostfix-deposit-${lead.id}-${Math.floor(1_700_000_000_000 / 60_000)}`);
    expect(await store.getLead(lead.id)).toMatchObject({
      depositStatus: "started",
      depositAmount: 9900,
      depositCurrency: "NZD",
      stripeAccount: "NZ",
      stripeCheckoutSessionId: "cs_test_new",
    });
  });

  it("will not start a second payment for someone who has paid", async () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const paid = await store.recordDepositPaid({ leadId: lead.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" });
    const { stripe, create } = fakeStripe();
    await expect(startDepositCheckout(paid!, market, BASE, { store, stripe })).rejects.toBeInstanceOf(DepositNotAllowedError);
    expect(create).not.toHaveBeenCalled();
  });

  it("will not start when card payments are not connected", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const { stripe, create } = fakeStripe();
    await expect(startDepositCheckout(lead, market, BASE, { store, stripe })).rejects.toThrow("STRIPE_NZ_SECRET_KEY is not set.");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("recording a paid deposit", () => {
  it("records it, writes the audit entry and alerts you, once", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);

    const result = await fulfilDepositSession(paidSession(lead), account, h.deps);

    expect(result.outcome).toBe("recorded");
    expect(result.lead).toMatchObject({
      depositStatus: "paid",
      depositAmount: 4900,
      depositCurrency: "NZD",
      stripeAccount: "NZ",
      stripeCheckoutSessionId: "cs_test_1",
      stripePaymentIntentId: "pi_1",
      stripeCustomerId: "cus_1",
    });
    await h.runDeferred();
    expect(h.sent).toEqual([{ template: "deposit_alert", leadId: lead.id, sms: "HostFix: DEPOSIT PAID NZ$49 by Olive Owner, 021 123 4567." }]);

    const paidEntries = (await store.auditEntries()).filter((e) => e.action === "deposit.paid");
    expect(paidEntries).toHaveLength(1);
    expect(paidEntries[0]).toMatchObject({ actor: "stripe", entityId: lead.id, amount: 4900, currency: "NZD" });
  });

  it("changes nothing when Stripe tells us twice (webhook and returning browser)", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);

    const results = await Promise.all([
      fulfilDepositSession(paidSession(lead), account, h.deps),
      fulfilDepositSession(paidSession(lead), account, h.deps),
      fulfilDepositSession(paidSession(lead), account, h.deps),
    ]);
    await h.runDeferred();

    expect(results.map((r) => r.outcome).sort()).toEqual(["already_recorded", "already_recorded", "recorded"]);
    expect(h.sent).toHaveLength(1);
    expect((await store.auditEntries()).filter((e) => e.action === "deposit.paid")).toHaveLength(1);
    expect(await store.countLeads()).toMatchObject({ depositsPaid: 1, depositTotals: [{ currency: "NZD", cents: 4900 }] });
  });

  it("records what was actually paid, not what we expected", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    const result = await fulfilDepositSession(paidSession(lead, { amount_total: 5900, currency: "aud" }), { ...account, country: "AU" }, h.deps);
    expect(result.lead).toMatchObject({ depositAmount: 5900, depositCurrency: "AUD", stripeAccount: "AU" });
  });

  it("does nothing until the money has actually arrived", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    for (const session of [
      paidSession(lead, { payment_status: "unpaid" }),
      paidSession(lead, { payment_status: "no_payment_required" }),
      paidSession(lead, { amount_total: null }),
    ]) {
      expect((await fulfilDepositSession(session, account, h.deps)).outcome).toBe("not_paid");
    }
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "none" });
    await h.runDeferred();
    expect(h.sent).toHaveLength(0);
  });

  it("ignores Stripe payments that are not founding deposits", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    expect((await fulfilDepositSession(paidSession(lead, { metadata: { purpose: "something_else" } }), account, h.deps)).outcome).toBe("not_a_deposit");
    expect((await fulfilDepositSession(paidSession(lead, { metadata: null }), account, h.deps)).outcome).toBe("not_a_deposit");
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "none" });
  });

  it("flags a second, separate payment so you can refund it, and says so only once", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    await fulfilDepositSession(paidSession(lead), account, h.deps);

    const second = paidSession(lead, { id: "cs_test_2", payment_intent: "pi_2" });
    const first = await fulfilDepositSession(second, account, h.deps);
    const again = await fulfilDepositSession(second, account, h.deps);
    await h.runDeferred();

    expect(first.outcome).toBe("duplicate_payment");
    expect(again.outcome).toBe("duplicate_payment");
    expect(h.sent.map((s) => s.template)).toEqual(["deposit_alert", "deposit_duplicate_alert"]);
    const entries = (await store.auditEntries()).filter((e) => e.action === "deposit.duplicate_payment");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amount: 4900, currency: "NZD", entityId: lead.id });
    expect(await store.getLead(lead.id)).toMatchObject({ stripeCheckoutSessionId: "cs_test_1", stripePaymentIntentId: "pi_1" });
    expect((await store.countLeads()).depositTotals).toEqual([{ currency: "NZD", cents: 4900 }]);
  });

  it("raises the alarm when money arrives for a lead that does not exist", async () => {
    const store = await freshStore();
    const h = harness(store);
    const ghost = { id: "99999999-9999-4999-8999-999999999999" } as Lead;
    const result = await fulfilDepositSession(paidSession(ghost), account, h.deps);
    await fulfilDepositSession(paidSession(ghost), account, h.deps);
    await h.runDeferred();

    expect(result.outcome).toBe("unknown_lead");
    expect(h.sent.map((s) => s.template)).toEqual(["deposit_orphan_alert"]);
    expect((await store.auditEntries()).filter((e) => e.action === "deposit.paid_without_lead")).toHaveLength(1);
  });

  it("keeps the payment recorded even if the alert fails", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    h.deps.alert = (async () => {
      throw new Error("provider down");
    }) as unknown as DepositDeps["alert"];
    const result = await fulfilDepositSession(paidSession(lead), account, h.deps);
    await expect(h.runDeferred()).resolves.toBeUndefined();
    expect(result.outcome).toBe("recorded");
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "paid" });
  });
});

describe("messages from Stripe (webhook)", () => {
  function event(type: string, object: unknown, id = "evt_1"): Stripe.Event {
    return { id, object: "event", type, data: { object } } as unknown as Stripe.Event;
  }

  it("records a deposit when the checkout completes", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    const result = await handleStripeEvent(event("checkout.session.completed", paidSession(lead)), account, h.deps);
    expect(result).toEqual({ handled: true, outcome: "recorded" });
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "paid" });
  });

  it("marks the lead refunded on a full refund, once per Stripe event", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    await handleStripeEvent(event("checkout.session.completed", paidSession(lead)), account, h.deps);

    const charge = { id: "ch_1", payment_intent: "pi_1", amount: 4900, amount_refunded: 4900, refunded: true };
    expect(await handleStripeEvent(event("charge.refunded", charge, "evt_r1"), account, h.deps)).toEqual({ handled: true, outcome: "refunded" });
    expect(await handleStripeEvent(event("charge.refunded", charge, "evt_r1"), account, h.deps)).toEqual({ handled: true, outcome: "nothing_to_change" });

    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "refunded" });
    const refunds = (await store.auditEntries()).filter((e) => e.action === "deposit.refunded");
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 4900, currency: "NZD" });
    expect((await store.countLeads()).depositsPaid).toBe(0);
  });

  it("logs a part refund but leaves the lead as paid", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    await handleStripeEvent(event("checkout.session.completed", paidSession(lead)), account, h.deps);
    const charge = { id: "ch_1", payment_intent: "pi_1", amount: 4900, amount_refunded: 1000, refunded: false };
    expect(await handleStripeEvent(event("charge.refunded", charge, "evt_p1"), account, h.deps)).toEqual({ handled: true, outcome: "part_refunded" });
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "paid" });
    expect((await store.auditEntries()).filter((e) => e.action === "deposit.part_refunded")).toHaveLength(1);
  });

  it("ignores refunds of payments it does not know and other message types", async () => {
    const store = await freshStore();
    const h = harness(store);
    const charge = { id: "ch_9", payment_intent: "pi_unknown", amount_refunded: 100, refunded: true };
    expect(await handleStripeEvent(event("charge.refunded", charge), account, h.deps)).toEqual({ handled: true, outcome: "nothing_to_change" });
    expect(await handleStripeEvent(event("charge.refunded", { ...charge, payment_intent: null }), account, h.deps)).toEqual({ handled: false, outcome: "no_payment_intent" });
    expect(await handleStripeEvent(event("customer.created", {}), account, h.deps)).toEqual({ handled: false, outcome: "ignored" });
  });
});

describe("checking a webhook message really came from Stripe", () => {
  const body = JSON.stringify({ id: "evt_signed", object: "event", type: "checkout.session.completed", data: { object: {} } });
  const header = (secret: string) => stripeClient(account).webhooks.generateTestHeaderString({ payload: body, secret });

  it("accepts a message signed with our secret and says which account sent it", () => {
    const result = verifyStripeWebhook(body, header("whsec_test_secret"), [account]);
    expect(result?.message).toMatchObject({ kind: "snapshot", event: { id: "evt_signed" } });
    expect(result?.account.country).toBe("NZ");
  });

  it("works out which country's account sent the message", () => {
    const au: StripeAccount = { country: "AU", secretKey: "sk_test_au999", webhookSecret: "whsec_au_secret", mode: "test" };
    const result = verifyStripeWebhook(body, header("whsec_au_secret"), [account, au]);
    expect(result?.account.country).toBe("AU");
  });

  it("rejects a forged message, a changed message and a wrong secret", () => {
    expect(verifyStripeWebhook(body, header("whsec_someone_else"), [account])).toBeNull();
    expect(verifyStripeWebhook(body.replace("evt_signed", "evt_forged"), header("whsec_test_secret"), [account])).toBeNull();
    expect(verifyStripeWebhook(body, "t=1,v1=deadbeef", [account])).toBeNull();
    expect(verifyStripeWebhook(body, "", [account])).toBeNull();
  });

  it("rejects everything when no signing secret is set", () => {
    expect(verifyStripeWebhook(body, header("whsec_test_secret"), [{ ...account, webhookSecret: null }])).toBeNull();
    expect(verifyStripeWebhook(body, header("whsec_test_secret"), [])).toBeNull();
  });

  it("rejects a correctly signed message that is not valid JSON", () => {
    const junk = "this is not json";
    const signature = stripeClient(account).webhooks.generateTestHeaderString({ payload: junk, secret: "whsec_test_secret" });
    expect(verifyStripeWebhook(junk, signature, [account])).toBeNull();
  });

  it("rejects an old message that someone replays later", () => {
    const stale = stripeClient(account).webhooks.generateTestHeaderString({
      payload: body,
      secret: "whsec_test_secret",
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(verifyStripeWebhook(body, stale, [account])).toBeNull();
  });
});

describe("the newer, shorter message format from Stripe (thin events)", () => {
  const sign = (payload: string) => stripeClient(account).webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
  const thin = (type: string, relatedId: string | null, id = "evt_thin_1") =>
    JSON.stringify({
      id,
      object: "v2.core.event",
      type,
      livemode: false,
      created: "2026-11-15T02:00:00.000Z",
      related_object: relatedId ? { id: relatedId, type: "checkout.session", url: `/v1/checkout/sessions/${relatedId}` } : null,
    });

  it("is recognised once its signature checks out", () => {
    const body = thin("v1.checkout.session.completed", "cs_test_1");
    expect(verifyStripeWebhook(body, sign(body), [account])?.message).toEqual({
      kind: "thin",
      id: "evt_thin_1",
      type: "v1.checkout.session.completed",
      relatedObjectId: "cs_test_1",
    });
    expect(verifyStripeWebhook(body, "t=1,v1=bad", [account])).toBeNull();
  });

  it("looks the payment up at Stripe and records the deposit", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    const fetchSession = vi.fn(async () => paidSession(lead));

    const message = { kind: "thin" as const, id: "evt_thin_1", type: "v1.checkout.session.completed", relatedObjectId: "cs_test_1" };
    const first = await handleStripeMessage(message, account, { ...h.deps, fetchSession });
    const second = await handleStripeMessage(message, account, { ...h.deps, fetchSession });

    expect(fetchSession).toHaveBeenCalledWith("cs_test_1", account);
    expect(first).toEqual({ handled: true, outcome: "recorded" });
    expect(second).toEqual({ handled: true, outcome: "already_recorded" });
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "paid", depositAmount: 4900 });
  });

  it("looks the charge up at Stripe and records a refund once", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    await handleStripeEvent({ id: "evt_1", type: "checkout.session.completed", data: { object: paidSession(lead) } } as unknown as Stripe.Event, account, h.deps);

    const fetchCharge = vi.fn(async () => ({ id: "ch_1", payment_intent: "pi_1", amount_refunded: 4900, refunded: true }) as unknown as Stripe.Charge);
    const message = { kind: "thin" as const, id: "evt_thin_refund", type: "v1.charge.refunded", relatedObjectId: "ch_1" };
    expect(await handleStripeMessage(message, account, { ...h.deps, fetchCharge })).toEqual({ handled: true, outcome: "refunded" });
    expect(await handleStripeMessage(message, account, { ...h.deps, fetchCharge })).toEqual({ handled: true, outcome: "nothing_to_change" });
    expect(await store.getLead(lead.id)).toMatchObject({ depositStatus: "refunded" });
    expect((await store.auditEntries()).filter((e) => e.action === "deposit.refunded")).toHaveLength(1);
  });

  it("ignores thin messages it does not use, or that name no record", async () => {
    const store = await freshStore();
    const h = harness(store);
    const fetchSession = vi.fn();
    expect(await handleStripeMessage({ kind: "thin", id: "e", type: "v1.customer.created", relatedObjectId: "cus_1" }, account, { ...h.deps, fetchSession })).toEqual({ handled: false, outcome: "ignored" });
    expect(await handleStripeMessage({ kind: "thin", id: "e", type: "v1.checkout.session.completed", relatedObjectId: null }, account, { ...h.deps, fetchSession })).toEqual({ handled: false, outcome: "ignored" });
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("raises an error if the lookup fails, so Stripe sends the message again later", async () => {
    const store = await freshStore();
    const h = harness(store);
    const fetchSession = vi.fn(async () => {
      throw new Error("Stripe is unreachable");
    });
    const message = { kind: "thin" as const, id: "e", type: "v1.checkout.session.completed", relatedObjectId: "cs_test_1" };
    await expect(handleStripeMessage(message, account, { ...h.deps, fetchSession })).rejects.toThrow("Stripe is unreachable");
  });

  it("still handles the older, full message format", async () => {
    const store = await freshStore();
    const lead = await store.insertLead(ownerLead());
    const h = harness(store);
    const event = { id: "evt_1", type: "checkout.session.completed", data: { object: paidSession(lead) } } as unknown as Stripe.Event;
    expect(await handleStripeMessage({ kind: "snapshot", event }, account, h.deps)).toEqual({ handled: true, outcome: "recorded" });
  });
});
