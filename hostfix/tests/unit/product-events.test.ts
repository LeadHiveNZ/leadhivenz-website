import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargeJob } from "@/lib/billing/settle";
import { addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { createJob } from "@/lib/jobs/create";
import { completeJob, markArrived } from "@/lib/jobs/work";
import { getBilling, saveBilling } from "@/lib/owners/service";
import type { StripeMessage } from "@/lib/payments/deposit";
import { addMonths } from "@/lib/payments/gateway";
import { handleProductMessage, type ProductDeps } from "@/lib/payments/product-events";
import type { StripeAccount } from "@/lib/payments/stripe";
import { activateMembership, getProperty } from "@/lib/properties/service";
import { testDb } from "./db";
import { addPaidTier, gatewayFor, liveMarket, logJob, makeOwner, makeProperty, makeTradie, menuItem, MONDAY_10AM, offersFor, photo, textsTo } from "./factory";

/**
 * WHAT STRIPE TELLS US, and what the app does about it. These use made-up
 * Stripe messages in the same shape Stripe sends, so no real Stripe account
 * is needed. Every message is sent twice at least once, because Stripe does
 * that too, and nothing may happen twice.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const account: StripeAccount = { country: "NZ", secretKey: "sk_test_unit", webhookSecret: "whsec_unit", mode: "test" };
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

let counter = 0;
function event(type: string, object: unknown): StripeMessage {
  counter += 1;
  return { kind: "snapshot", event: { id: `evt_${counter}`, type, data: { object } } as unknown as Stripe.Event };
}

function invoice(id: string, subscriptionId: string, amount: number, start: Date): Stripe.Invoice {
  return {
    id, amount_paid: amount, currency: "nzd", created: seconds(start), period_start: seconds(start), period_end: seconds(addMonths(start, 1)),
    status_transitions: { paid_at: seconds(start) },
    lines: { data: [{ period: { start: seconds(start), end: seconds(addMonths(start, 1)) } }] },
    parent: { subscription_details: { subscription: subscriptionId } },
  } as unknown as Stripe.Invoice;
}

/**
 * An owner whose property is a member through Stripe (rather than the pretend payment company), on a
 * priced per-property membership (NZ$99 a month): Essential is free to join, and has no monthly payments.
 */
async function stripeMember() {
  await liveMarket(t.db);
  await addPaidTier(t.db);
  const owner = await makeOwner(t.db, { card: "none" });
  const property = await makeProperty(t.db, owner.ownerId, { tier: "paid", member: false });
  return { owner, property };
}

async function activeStripeMember() {
  const s = await stripeMember();
  await activateMembership(t.db, {
    propertyId: s.property.id, provider: "stripe", subscriptionId: "sub_1", periodEnd: addMonths(MONDAY_10AM, 1), customerId: "cus_1",
    card: { paymentMethodId: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 },
    invoice: { invoiceId: "in_first", amountCents: 9900, currency: "NZD", periodStart: MONDAY_10AM, periodEnd: addMonths(MONDAY_10AM, 1), paidAt: MONDAY_10AM },
  });
  return s;
}

const invoices = () => t.db.query<{ provider_invoice_id: string; status: string; amount_cents: number }>("select provider_invoice_id, status, amount_cents from public.membership_invoices order by created_at, id");
const queue = async () => (await t.db.query<{ kind: string; summary: string }>("select kind, summary from public.exceptions where status = 'open' order by created_at")).map((row) => row);

describe("a free membership's save-your-card page is completed", () => {
  const card = { paymentMethodId: "pm_free", brand: "visa", last4: "1881", expMonth: 3, expYear: 2031 };
  const session = { id: "cs_setup_1", mode: "setup", metadata: { hostfix_purpose: "card_setup" } };

  it("saves the card and covers the property, with no subscription and nothing charged, once however many times Stripe says so", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await makeProperty(t.db, owner.ownerId, { member: false });
    // The site saved who the owner is at Stripe before sending them to the page.
    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "stripe", customerId: "cus_free" });
    const deps: ProductDeps = { cardFromSetupCheckout: async () => ({ propertyId: property.id, ownerId: owner.ownerId, customerId: "cus_free", card }) };

    expect(await handleProductMessage(t.db, event("checkout.session.completed", session), account, deps)).toEqual({ handled: true, outcome: "free_membership_started" });
    expect(await handleProductMessage(t.db, event("checkout.session.completed", session), account, deps)).toEqual({ handled: true, outcome: "free_membership_started" });
    expect(await getProperty(t.db, owner.ownerId, property.id)).toMatchObject({ status: "active", subscriptionId: null, currentPeriodEnd: null });
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toMatchObject({ provider: "stripe", customerId: "cus_free", paymentMethodId: "pm_free", cardLast4: "1881" });
    expect(await invoices()).toEqual([]);
    const started = await t.db.query("select 1 from public.audit_log where entity_id = $1 and action = 'membership.started'", [property.id]);
    expect(started).toHaveLength(1);
  });

  it("does nothing when no card was saved, or for a customer it does not know", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await makeProperty(t.db, owner.ownerId, { member: false });
    expect(await handleProductMessage(t.db, event("checkout.session.completed", session), account, { cardFromSetupCheckout: async () => null })).toEqual({ handled: true, outcome: "card_not_saved" });
    const stranger: ProductDeps = { cardFromSetupCheckout: async () => ({ propertyId: property.id, ownerId: null, customerId: "cus_nobody", card }) };
    expect(await handleProductMessage(t.db, event("checkout.session.completed", session), account, stranger)).toEqual({ handled: true, outcome: "property_missing" });
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");
  });
});

describe("a membership card page is completed", () => {
  const deps = (propertyId: string): ProductDeps => ({
    membershipFromCheckout: async () => ({
      propertyId, ownerId: null, subscriptionId: "sub_new", customerId: "cus_new", periodEnd: addMonths(MONDAY_10AM, 1),
      invoice: { invoiceId: "in_new", amountCents: 9900, currency: "NZD", periodStart: MONDAY_10AM, periodEnd: addMonths(MONDAY_10AM, 1), paidAt: MONDAY_10AM },
      card: { paymentMethodId: "pm_new", brand: "mastercard", last4: "4444", expMonth: 1, expYear: 2031 },
    }),
  });
  const session = { id: "cs_1", mode: "subscription", metadata: { hostfix_purpose: "membership" } };

  it("makes the property a member, saves the card, and does it only once however many times Stripe says so", async () => {
    const { owner, property } = await stripeMember();
    const first = await handleProductMessage(t.db, event("checkout.session.completed", session), account, deps(property.id));
    expect(first).toEqual({ handled: true, outcome: "membership_started" });
    await handleProductMessage(t.db, event("checkout.session.completed", session), account, deps(property.id));

    expect(await getProperty(t.db, owner.ownerId, property.id)).toMatchObject({ status: "active", subscriptionProvider: "stripe", subscriptionId: "sub_new" });
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toMatchObject({ provider: "stripe", customerId: "cus_new", cardLast4: "4444" });
    expect(await invoices()).toEqual([{ provider_invoice_id: "in_new", status: "paid", amount_cents: 9900 }]);
    const started = await t.db.query("select 1 from public.audit_log where action = 'membership.started' and entity_id = $1", [property.id]);
    expect(started).toHaveLength(1);
  });

  it("leaves a founding deposit card page to the deposit code", async () => {
    await stripeMember();
    const result = await handleProductMessage(t.db, event("checkout.session.completed", { id: "cs_2", mode: "payment", metadata: { hostfix_purpose: "founding_deposit" } }), account);
    expect(result).toBeNull();
  });

  it("does nothing when the card page was not paid", async () => {
    const { owner, property } = await stripeMember();
    const result = await handleProductMessage(t.db, event("checkout.session.completed", session), account, { membershipFromCheckout: async () => null });
    expect(result).toEqual({ handled: true, outcome: "membership_not_paid" });
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");
  });
});

describe("monthly payments", () => {
  it("records a renewal once and moves the paid-up date on", async () => {
    const { owner, property } = await activeStripeMember();
    const nextMonth = addMonths(MONDAY_10AM, 1);
    setTestNow(nextMonth);
    const paid = event("invoice.paid", invoice("in_second", "sub_1", 9900, nextMonth));
    expect(await handleProductMessage(t.db, paid, account)).toEqual({ handled: true, outcome: "membership_paid" });
    expect(await handleProductMessage(t.db, paid, account)).toEqual({ handled: true, outcome: "nothing_to_change" });

    expect((await invoices()).map((row) => row.provider_invoice_id)).toEqual(["in_first", "in_second"]);
    const after = await getProperty(t.db, owner.ownerId, property.id);
    expect(after!.currentPeriodEnd!.toISOString()).toBe(addMonths(nextMonth, 1).toISOString());
  });

  it("holds new jobs when a payment fails, texts the owner once, and lifts the hold when it is paid", async () => {
    const { owner, property } = await activeStripeMember();
    await makeTradie(t.db, { slot: 1 });
    const nextMonth = addMonths(MONDAY_10AM, 1);
    setTestNow(nextMonth);
    const failed = event("invoice.payment_failed", invoice("in_second", "sub_1", 0, nextMonth));
    expect(await handleProductMessage(t.db, failed, account)).toEqual({ handled: true, outcome: "membership_payment_failed" });
    expect(await handleProductMessage(t.db, failed, account)).toEqual({ handled: true, outcome: "nothing_to_change" });

    const held = (await getProperty(t.db, owner.ownerId, property.id))!;
    expect(held.status).toBe("past_due");
    expect(await textsTo(t.db, owner.user.phone!, "membership_failed")).toHaveLength(1);
    const refused = await createJob(t.db, {
      property: held, reportedBy: "owner", reporterName: null, reporterPhone: null, menuItemId: (await menuItem(t.db, "PL-01")).id, description: "",
      urgent: false, uploadIds: [], uploader: `owner:${owner.ownerId}`, actor: `owner:${owner.ownerId}`,
    });
    expect(refused).toMatchObject({ ok: false, reason: "not_member" });

    await handleProductMessage(t.db, event("invoice.paid", invoice("in_second", "sub_1", 9900, nextMonth)), account);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("active");
  });

  it("ignores an invoice that is not for a membership", async () => {
    await activeStripeMember();
    const loose = { ...invoice("in_other", "sub_1", 500, MONDAY_10AM), parent: null } as unknown as Stripe.Invoice;
    expect(await handleProductMessage(t.db, event("invoice.paid", loose), account)).toBeNull();
  });

  it("reads the full invoice when Stripe sends only its name", async () => {
    await activeStripeMember();
    const nextMonth = addMonths(MONDAY_10AM, 1);
    const thin: StripeMessage = { kind: "thin", id: "evt_thin", type: "v1.invoice.paid", relatedObjectId: "in_thin" };
    const asked: string[] = [];
    const result = await handleProductMessage(t.db, thin, account, {
      fetch: { invoice: async (id) => { asked.push(id); return invoice(id, "sub_1", 9900, nextMonth); } },
    });
    expect(asked).toEqual(["in_thin"]);
    expect(result).toEqual({ handled: true, outcome: "membership_paid" });
  });
});

describe("a membership ending", () => {
  it("notes a cancellation made on Stripe's own page, then ends the membership when Stripe says it is over", async () => {
    const { owner, property } = await activeStripeMember();
    const ends = addMonths(MONDAY_10AM, 1);
    const updated = { id: "sub_1", cancel_at_period_end: true, cancel_at: seconds(ends), items: { data: [{ current_period_end: seconds(ends) }] } };
    expect(await handleProductMessage(t.db, event("customer.subscription.updated", updated), account)).toEqual({ handled: true, outcome: "membership_updated" });
    expect(await handleProductMessage(t.db, event("customer.subscription.updated", updated), account)).toEqual({ handled: true, outcome: "nothing_to_change" });
    expect(await getProperty(t.db, owner.ownerId, property.id)).toMatchObject({ status: "active", cancelAtPeriodEnd: true });

    expect(await handleProductMessage(t.db, event("customer.subscription.deleted", { id: "sub_1" }), account)).toEqual({ handled: true, outcome: "membership_ended" });
    expect(await handleProductMessage(t.db, event("customer.subscription.deleted", { id: "sub_1" }), account)).toEqual({ handled: true, outcome: "nothing_to_change" });
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("cancelled");
  });
});

describe("the owner changes their card on Stripe's page", () => {
  it("saves the new card for charging jobs", async () => {
    const { owner } = await activeStripeMember();
    const result = await handleProductMessage(t.db, event("customer.updated", { id: "cus_1" }), account, {
      defaultCard: async () => ({ paymentMethodId: "pm_2", brand: "amex", last4: "0005", expMonth: 6, expYear: 2032 }),
    });
    expect(result).toEqual({ handled: true, outcome: "card_updated" });
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toMatchObject({ paymentMethodId: "pm_2", cardBrand: "amex", cardLast4: "0005" });
  });

  it("ignores a customer that is not one of our owners", async () => {
    await activeStripeMember();
    expect(await handleProductMessage(t.db, event("customer.updated", { id: "cus_stranger" }), account)).toBeNull();
  });
});

/** A finished, charged job, and the payment company's reference for the charge. */
async function chargedJob() {
  await liveMarket(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  const tradie = await makeTradie(t.db, { slot: 1 });
  const job = await logJob(t.db, property, { code: "PL-01" });
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  await markArrived(t.db, job.id, tradie.tradieId);
  setTestNow(addMinutes(MONDAY_10AM, 60));
  await completeJob(t.db, job.id, tradie.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${tradie.tradieId}`)] });
  await chargeJob(t.db, gatewayFor(t.db), job.id);
  const rows = await t.db.query<{ payment_intent_id: string }>("select payment_intent_id from public.payments where job_id = $1::uuid", [job.id]);
  return { owner, property, tradie, job, paymentIntentId: rows[0]!.payment_intent_id };
}

describe("a bank reverses a payment (a chargeback)", () => {
  it("holds the tradie's payment if it has not gone, and puts it in front of a person, once", async () => {
    const { job, paymentIntentId } = await chargedJob();
    const dispute = { id: "dp_1", amount: 22000, currency: "nzd", reason: "fraudulent", payment_intent: paymentIntentId };
    expect(await handleProductMessage(t.db, event("charge.dispute.created", dispute), account)).toEqual({ handled: true, outcome: "chargeback_on_job" });
    await handleProductMessage(t.db, event("charge.dispute.created", dispute), account);

    const payout = await t.db.query<{ status: string }>("select status from public.payouts where job_id = $1::uuid", [job.id]);
    expect(payout[0]!.status).toBe("paused");
    const open = await queue();
    expect(open).toHaveLength(1);
    expect(open[0]!.kind).toBe("chargeback");
    expect(open[0]!.summary).toContain(`Job ${job.number}`);
    expect(open[0]!.summary).toContain("NZ$220");
    expect(open[0]!.summary).toContain("The tradie's payment is on hold.");
    expect(await t.db.query("select 1 from public.audit_log where action = 'chargeback.opened'")).toHaveLength(1);
  });

  it("still tells a person when the payment was not for a job", async () => {
    await liveMarket(t.db);
    const result = await handleProductMessage(t.db, event("charge.dispute.created", { id: "dp_2", amount: 9900, currency: "nzd", reason: "general", payment_intent: "pi_membership" }), account);
    expect(result).toEqual({ handled: true, outcome: "chargeback_other" });
    const open = await queue();
    expect(open.map((row) => row.kind)).toEqual(["chargeback"]);
    expect(open[0]!.summary).toContain("not for a job");
  });
});

describe("a refund", () => {
  const refund = (id: string, amount: number, fromApp: boolean, status = "succeeded") => ({ id, amount, status, metadata: fromApp ? { hostfix_refund: "app" } : {} }) as unknown as Stripe.Refund;

  it("made on the job page is already in the books, so the message changes nothing", async () => {
    const { job, paymentIntentId } = await chargedJob();
    const result = await handleProductMessage(t.db, event("charge.refunded", { id: "ch_1", payment_intent: paymentIntentId }), account, {
      fetch: { refundsFor: async () => [refund("re_app", 5000, true)] },
    });
    expect(result).toEqual({ handled: true, outcome: "nothing_to_change" });
    const payment = await t.db.query<{ refunded_cents: number; status: string }>("select refunded_cents, status from public.payments where job_id = $1::uuid", [job.id]);
    expect(payment[0]).toEqual({ refunded_cents: 0, status: "succeeded" });
    expect(await queue()).toHaveLength(0);
  });

  it("made by hand in Stripe is recorded once and flagged, because the tradie's payment was not changed", async () => {
    const { job, paymentIntentId } = await chargedJob();
    const message = event("charge.refunded", { id: "ch_1", payment_intent: paymentIntentId });
    const deps: ProductDeps = { fetch: { refundsFor: async () => [refund("re_hand", 6000, false), refund("re_failed", 9000, false, "failed")] } };
    expect(await handleProductMessage(t.db, message, account, deps)).toEqual({ handled: true, outcome: "refund_outside_app" });
    expect(await handleProductMessage(t.db, message, account, deps)).toEqual({ handled: true, outcome: "nothing_to_change" });

    const payment = await t.db.query<{ refunded_cents: number; status: string }>("select refunded_cents, status from public.payments where job_id = $1::uuid", [job.id]);
    expect(payment[0]).toEqual({ refunded_cents: 6000, status: "part_refunded" });
    const open = await queue();
    expect(open.map((row) => row.kind)).toEqual(["needs_review"]);
    expect(open[0]!.summary).toContain("NZ$60 was refunded in Stripe, not on the job page");
  });

  it("for something that is not a job is left to the deposit code", async () => {
    await liveMarket(t.db);
    expect(await handleProductMessage(t.db, event("charge.refunded", { id: "ch_9", payment_intent: "pi_deposit" }), account)).toBeNull();
  });
});

describe("messages the app does not act on", () => {
  it("are handed back untouched", async () => {
    await liveMarket(t.db);
    expect(await handleProductMessage(t.db, event("payment_intent.created", { id: "pi_x" }), account)).toBeNull();
    expect(await handleProductMessage(t.db, { kind: "thin", id: "evt_t", type: "v1.payout.paid", relatedObjectId: "po_1" }, account)).toBeNull();
  });
});

describe("saving a card", () => {
  it("never wipes a card that is already on file", async () => {
    const { owner } = await activeStripeMember();
    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "stripe", customerId: "cus_1" });
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toMatchObject({ paymentMethodId: "pm_1", cardLast4: "4242" });
  });
});
