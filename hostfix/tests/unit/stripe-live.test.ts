import { appendFileSync } from "node:fs";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { cancelDueHolds } from "@/lib/billing/card-holds";
import { chargeJob, raiseDispute, releaseDuePayouts, resolveDispute, retryPayout, type GatewayFor } from "@/lib/billing/settle";
import { addHours, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { cancelJob, createJob } from "@/lib/jobs/create";
import { completeJob } from "@/lib/jobs/work";
import { createOwnerAccount, getBilling, saveBank, saveBilling } from "@/lib/owners/service";
import type { StripeMessage } from "@/lib/payments/deposit";
import { handleProductMessage } from "@/lib/payments/product-events";
import { stripeClient, type StripeAccount } from "@/lib/payments/stripe";
import { createStripeGateway } from "@/lib/payments/stripe-gateway";
import { activateFreeMembership, getProperty, startMembership, type Property } from "@/lib/properties/service";
import { savePayoutAccount } from "@/lib/tradies/service";
import { testDb } from "./db";
import { arrive, holdsFor, HOUSE, liveMarket, makeProperty, makeTradie, menuItem, MONDAY_10AM, offersFor, openExceptions, photo } from "./factory";
import { inspectStripeFormPage, readStripePage, saveBankOnStripePage, saveCardOnStripePage } from "./stripe-live-pages";

/**
 * THE REAL STRIPE RUN (DECISIONS.md, 2026-11-27, third entry).
 *
 * Every other money test uses a stand-in for Stripe. This file runs the app's own money code (the same
 * functions the site calls) against Stripe's TEST area, with Stripe's test cards, so no real money moves. It
 * is skipped unless asked for:
 *
 *   LIVE_STRIPE_RUN=1                       run it
 *   LIVE_STRIPE_KEY=sk_test_...             the HostFix sandbox secret key (never a live key: the file refuses one)
 *   LIVE_STRIPE_PAYEE=acct_...              a tradie payout account in the sandbox that Stripe has switched on
 *   LIVE_STRIPE_SERVER=http://localhost:N   optional: an address that forwards to api.stripe.com (used where the
 *                                           key is supplied by a network proxy and never seen here)
 *
 * It needs a browser (Playwright's), because the owner's card page and bank-account page are Stripe's own.
 * Each run makes a few test customers and payments in the sandbox. Stripe also sends its messages about them
 * to the live site's webhook, which ignores them (it knows none of these owners). Bank disputes are NOT run
 * here for that reason: the live site would put a real item in the team's queue.
 *
 * THE NUMBERS, by hand from seed/menu-queenstown.json: PL-03 owner 23500, tradie 20000; the call-out 22500, tradie 19000.
 */

const RUN = process.env.LIVE_STRIPE_RUN === "1";
const KEY = process.env.LIVE_STRIPE_KEY ?? "sk_test_supplied_by_proxy";
const SERVER = process.env.LIVE_STRIPE_SERVER ?? "";
const PAYEE = process.env.LIVE_STRIPE_PAYEE ?? "";
const SITE = "http://localhost:3311";
/**
 * Stripe's card and bank pages can be filled in and sent only when this machine holds the key itself. Where a
 * network proxy supplies the key (LIVE_STRIPE_SERVER), it supplies it to the page's own calls too, and Stripe
 * refuses a card number sent with a secret key. There the pages are opened and read, and the saving is done
 * through Stripe's API with its test payment methods instead.
 */
const CAN_SEND_PAGES = !SERVER;

const account: StripeAccount = { country: "NZ", secretKey: KEY, webhookSecret: null, mode: "test" };
const t = testDb();
const gateways: GatewayFor = () => createStripeGateway(account);
const stripe = () => stripeClient(account);
const notes: string[] = [];
const NOTES_FILE = process.env.LIVE_STRIPE_NOTES ?? "";
const note = (line: string) => {
  notes.push(line);
  console.log(`[stripe-live] ${line}`);
  if (NOTES_FILE) appendFileSync(NOTES_FILE, `${line}\n`);
};

let run = 0;
const stamp = () => `${Date.now().toString(36)}${(run += 1)}`;

/** A new owner and an uncovered property, as the sign-up screens leave them. */
async function newOwner(label: string) {
  const id = stamp();
  const { user, ownerId } = await createOwnerAccount(t.db, { name: `Olive ${label}`, email: `olive.${id}@example.com`, phone: `+64211${String(Date.now() + run).slice(-6)}` });
  const property = await makeProperty(t.db, ownerId, { member: false, name: `Lakeview ${id}` });
  return { user, ownerId, property };
}

/** An owner with a card saved through Stripe's API (the card page itself has its own test). `card` is a Stripe test PaymentMethod. */
async function ownerWithCard(label: string, card: string = "pm_card_visa") {
  const owner = await newOwner(label);
  const gateway = gateways("NZ")!;
  const customerId = await gateway.ensureCustomer({ ownerId: owner.ownerId, name: owner.user.name, email: owner.user.email, phone: owner.user.phone, existingCustomerId: null });
  const method = await stripe().paymentMethods.attach(card, { customer: customerId });
  await stripe().customers.update(customerId, { invoice_settings: { default_payment_method: method.id } });
  const summary = { paymentMethodId: method.id, brand: method.card?.brand ?? null, last4: method.card?.last4 ?? null, expMonth: method.card?.exp_month ?? null, expYear: method.card?.exp_year ?? null };
  await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "stripe", customerId, card: summary });
  const property = (await activateFreeMembership(t.db, { propertyId: owner.property.id, ownerId: owner.ownerId, provider: "stripe", customerId, card: null }))!;
  return { ...owner, property, customerId, paymentMethodId: method.id };
}

async function plumber() {
  const tradie = await makeTradie(t.db, { slot: 1, trades: ["plumber"], name: `Wakatipu Plumbing ${stamp()}` });
  await savePayoutAccount(t.db, tradie.tradieId, { provider: "stripe", accountId: PAYEE, payoutsEnabled: true });
  return tradie;
}

async function log(property: Property, ownerId: string, code = "PL-03") {
  const item = await menuItem(t.db, code);
  return createJob(t.db, {
    property, reportedBy: "owner", reporterName: null, reporterPhone: null, menuItemId: item.id, description: "", urgent: false,
    uploadIds: [], uploader: `owner:${ownerId}`, actor: `owner:${ownerId}`,
  }, gateways);
}

async function accept(jobId: string) {
  const [offer] = await offersFor(t.db, jobId);
  if (!offer) throw new Error("The job was not offered to anyone.");
  await t.db.tx((tx) => acceptOffer(tx, offer.id, "link"));
}

async function finish(jobId: string, tradieId: string) {
  const arrived = await arrive(t.db, jobId, tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  const done = await completeJob(t.db, jobId, tradieId, { note: "All sorted.", uploadIds: [await photo(t.db, `tradie:${tradieId}`)], ...HOUSE });
  if (!done.ok) throw new Error(done.message);
  return done.job;
}

const paymentRow = async (jobId: string) =>
  (await t.db.query<{ amount_cents: number; refunded_cents: number; status: string; payment_intent_id: string | null; extra_payment_intent_id: string | null }>(
    "select amount_cents, refunded_cents, status, payment_intent_id, extra_payment_intent_id from public.payments where job_id = $1::uuid", [jobId]))[0];
const payoutRow = async (jobId: string) =>
  (await t.db.query<{ status: string; amount_cents: number; transfer_id: string | null }>("select status, amount_cents, transfer_id from public.payouts where job_id = $1::uuid", [jobId]))[0];

/** Waits for Stripe's own message about something, as its webhook would deliver it. */
async function stripeEvent(type: string, objectId: string): Promise<Stripe.Event> {
  for (let i = 0; i < 40; i += 1) {
    const events = await stripe().events.list({ type, limit: 30 });
    const found = events.data.find((event) => (event.data.object as { id?: string }).id === objectId);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Stripe did not report ${type} for ${objectId} within a minute.`);
}

const sessionIdFrom = (address: string) => new URL(address).searchParams.get("session_id") ?? "";

describe.skipIf(!RUN)("the app's money code against Stripe's real test area", () => {
  beforeEach(() => {
    if (!/^(sk|rk)_test_/.test(KEY)) throw new Error("LIVE_STRIPE_KEY must be a TEST key (sk_test_...). This file never runs against live money.");
    if (!PAYEE) throw new Error("Set LIVE_STRIPE_PAYEE to a sandbox payout account that Stripe has switched on.");
    if (SERVER) process.env.STRIPE_TEST_SERVER = SERVER;
    setTestNow(MONDAY_10AM);
    return () => setTestNow(null);
  });

  it("an owner saves a card on Stripe's own page, Stripe tells us, and the property is covered", { timeout: 240_000 }, async () => {
    await liveMarket(t.db);
    const owner = await newOwner("Cardpage");
    const started = await startMembership(t.db, gateways("NZ")!, { ownerId: owner.ownerId, propertyId: owner.property.id, successUrl: `${SITE}/app/membership/return`, cancelUrl: `${SITE}/app/billing` });
    if (started.kind !== "redirect") throw new Error(`Expected Stripe's card page, got ${JSON.stringify(started)}`);
    expect(started.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const seen = await inspectStripeFormPage(started.url);
    note(`Card page offers: ${seen.offered.join(", ") || "(card fields only)"}; fields: ${seen.fields.join(", ")}`);
    // Only a card can hold a job's price. A bank account or anything else on this page would save something a hold cannot use.
    expect(seen.offered.filter((choice) => choice !== "Card")).toEqual([]);
    expect(seen.fields).toEqual(expect.arrayContaining(["payment-numberInput", "payment-expiryInput", "payment-cvcInput"]));
    expect(seen.words).toContain("Nothing is charged now.");

    if (!CAN_SEND_PAGES) {
      note("Card page: opened and read, not sent (the key is supplied by the network here). Saving a card and Stripe's message about it are covered through the API in the next tests.");
    } else {
      const page = await saveCardOnStripePage(started.url, `${SITE}/app/membership/return`, { number: "4242 4242 4242 4242", name: owner.user.name });
      const sessionId = sessionIdFrom(page.returnedTo);
      expect(sessionId).toMatch(/^cs_test_/);
      const event = await stripeEvent("checkout.session.completed", sessionId);
      const message: StripeMessage = { kind: "snapshot", event };
      expect(await handleProductMessage(t.db, message, account)).toEqual({ handled: true, outcome: "free_membership_started" });
      // Stripe sends messages twice sometimes: nothing breaks.
      expect((await handleProductMessage(t.db, message, account))?.handled).toBe(true);
      const saved = await getBilling(t.db, owner.ownerId, "NZ");
      expect(saved).toMatchObject({ provider: "stripe", cardBrand: "visa", cardLast4: "4242" });
      expect((await getProperty(t.db, owner.ownerId, owner.property.id))!.status).toBe("active");
      const customer = await stripe().customers.retrieve(saved!.customerId);
      expect(!customer.deleted && customer.invoice_settings.default_payment_method).toBe(saved!.paymentMethodId);
    }

    const billing = await getBilling(t.db, owner.ownerId, "NZ");
    expect(billing?.customerId).toMatch(/^cus_/);
    // The page where an owner changes their card later.
    const portal = await gateways("NZ")!.billingPortalUrl({ customerId: billing!.customerId, ownerId: owner.ownerId, returnUrl: `${SITE}/app/billing` });
    expect(portal).toMatch(/^https:\/\/billing\.stripe\.com\//);
  });

  it("a job from start to finish: the price is held, taken at Job done, the tradie is paid, then NZ$50 is refunded and their share comes back", { timeout: 180_000 }, async () => {
    await liveMarket(t.db, { min_minutes_on_site: 0 });
    const owner = await ownerWithCard("Jobflow");
    const tradie = await plumber();

    const logged = await log(owner.property, owner.ownerId);
    if (!logged.ok) throw new Error(`The job was not sent: ${logged.message}`);
    const job = logged.job;
    const [hold] = await holdsFor(t.db, job.id);
    expect(hold).toMatchObject({ status: "held", amount_cents: 23500 });
    const held = await stripe().paymentIntents.retrieve(hold!.payment_intent_id!);
    expect(held).toMatchObject({ status: "requires_capture", amount: 23500, amount_capturable: 23500, currency: "nzd" });
    expect(hold!.capture_before).not.toBeNull();
    note(`A hold on a Visa lasts ${((new Date(hold!.capture_before!).getTime() - held.created * 1000) / 3_600_000).toFixed(1)} hours (Stripe's capture_before).`);

    await accept(job.id);
    const done = await finish(job.id, tradie.tradieId);
    expect(done).toMatchObject({ ownerTotalCents: 23500, tradieTotalCents: 20000 });
    expect(await chargeJob(t.db, gateways, job.id)).toBe("succeeded");
    // Asking twice never charges twice.
    expect(await chargeJob(t.db, gateways, job.id)).toBe("skipped");
    const taken = await stripe().paymentIntents.retrieve(hold!.payment_intent_id!);
    expect(taken).toMatchObject({ status: "succeeded", amount_received: 23500 });
    expect(await paymentRow(job.id)).toMatchObject({ amount_cents: 23500, status: "succeeded", payment_intent_id: hold!.payment_intent_id });

    // 24 hours later the tradie's NZ$200 goes, tied to the owner's charge.
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    const payout = (await payoutRow(job.id))!;
    expect(payout).toMatchObject({ status: "sent", amount_cents: 20000 });
    const transfer = await stripe().transfers.retrieve(payout.transfer_id!);
    expect(transfer).toMatchObject({ amount: 20000, currency: "nzd", destination: PAYEE, source_transaction: taken.latest_charge });
    expect(await releaseDuePayouts(t.db, gateways)).toBe(0);

    // The owner says something is wrong; the team gives NZ$50 back. The tradie's share of it (4255) is taken back.
    const dispute = await raiseDispute(t.db, job.id, `owner:${owner.ownerId}`, "Still drips a bit");
    if (!dispute.ok) throw new Error("The problem could not be raised.");
    expect(await resolveDispute(t.db, gateways, dispute.disputeId, { outcome: "refund", refundCents: 5000 }, "NZ$50 back", "staff:test")).toEqual({ ok: true });
    expect(await paymentRow(job.id)).toMatchObject({ refunded_cents: 5000, status: "part_refunded" });
    const refunds = await stripe().refunds.list({ payment_intent: hold!.payment_intent_id!, limit: 10 });
    expect(refunds.data.map((refund) => [refund.amount, refund.status, refund.metadata?.hostfix_refund])).toEqual([[5000, "succeeded", "app"]]);
    const after = await stripe().transfers.retrieve(payout.transfer_id!);
    note(`After a NZ$50 refund on a paid job, Stripe shows NZ$${(after.amount_reversed / 100).toFixed(2)} taken back from the tradie's NZ$200.`);
    expect(after.amount_reversed).toBe(4255);

    // Stripe's own message about that refund changes nothing a second time: it was made on the job page.
    const charge = typeof taken.latest_charge === "string" ? taken.latest_charge : taken.latest_charge!.id;
    const refunded = await stripeEvent("charge.refunded", charge);
    expect((await handleProductMessage(t.db, { kind: "snapshot", event: refunded }, account))?.outcome).toBe("nothing_to_change");
    expect(await paymentRow(job.id)).toMatchObject({ refunded_cents: 5000 });
  });

  it("cancelled before the tradie arrives: the hold is let go and nothing is charged", { timeout: 120_000 }, async () => {
    await liveMarket(t.db, { min_minutes_on_site: 0 });
    const owner = await ownerWithCard("Cancel");
    await plumber();
    const logged = await log(owner.property, owner.ownerId);
    if (!logged.ok) throw new Error(logged.message);
    await accept(logged.job.id);
    const [hold] = await holdsFor(t.db, logged.job.id);
    expect(await cancelJob(t.db, logged.job.id, { actor: `owner:${owner.ownerId}` }, "The guest fixed it")).toMatchObject({ ok: true });
    expect(await cancelDueHolds(t.db, gateways, logged.job.id)).toBe(1);
    expect(await cancelDueHolds(t.db, gateways, logged.job.id)).toBe(0);
    const intent = await stripe().paymentIntents.retrieve(hold!.payment_intent_id!, { expand: ["latest_charge.balance_transaction"] });
    expect(intent).toMatchObject({ status: "canceled", amount_received: 0 });
    const charge = intent.latest_charge as Stripe.Charge | null;
    // No money moved, so Stripe made no balance entry and took no fee.
    expect(charge?.balance_transaction ?? null).toBeNull();
    expect(await paymentRow(logged.job.id)).toBeUndefined();
  });

  it("cancelled by the owner after the tradie arrived: only the NZ$225 call-out is taken from the NZ$235 hold, and the tradie is paid NZ$190", { timeout: 120_000 }, async () => {
    await liveMarket(t.db, { min_minutes_on_site: 0 });
    const owner = await ownerWithCard("Callout");
    const tradie = await plumber();
    const logged = await log(owner.property, owner.ownerId);
    if (!logged.ok) throw new Error(logged.message);
    await accept(logged.job.id);
    const arrived = await arrive(t.db, logged.job.id, tradie.tradieId, HOUSE);
    if (!arrived.ok) throw new Error(arrived.message);
    const [hold] = await holdsFor(t.db, logged.job.id);
    expect(await cancelJob(t.db, logged.job.id, { actor: `owner:${owner.ownerId}` }, "Changed my mind")).toMatchObject({ ok: true, callOutCents: 22500 });
    expect(await chargeJob(t.db, gateways, logged.job.id)).toBe("succeeded");
    const intent = await stripe().paymentIntents.retrieve(hold!.payment_intent_id!, { expand: ["latest_charge"] });
    expect(intent).toMatchObject({ status: "succeeded", amount: 23500, amount_received: 22500 });
    expect((intent.latest_charge as Stripe.Charge).amount_captured).toBe(22500);
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(await payoutRow(logged.job.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
  });

  it("a card that declines the hold: the owner is told, and no tradie is sent", { timeout: 120_000 }, async () => {
    await liveMarket(t.db);
    // Stripe's test card 4000 0000 0000 0341: it can be saved, and every charge on it is declined.
    const owner = await ownerWithCard("Declined", "pm_card_chargeCustomerFail");
    await plumber();
    const logged = await log(owner.property, owner.ownerId);
    expect(logged).toMatchObject({ ok: false, reason: "card" });
    const jobs = await t.db.query<{ id: string; status: string }>("select id, status from public.jobs");
    expect(jobs.map((job) => job.status)).toEqual(["cancelled"]);
    expect(await offersFor(t.db, jobs[0]!.id)).toHaveLength(0);
    note(`A declined hold reads to the owner: "${logged.ok ? "" : logged.message}"`);
  });

  it("the card fails at Job done after the hold ran out: the tradie is still paid from HostFix's balance, and the card is charged once it is fixed", { timeout: 180_000 }, async () => {
    await liveMarket(t.db, { min_minutes_on_site: 0 });
    const owner = await ownerWithCard("Latefail");
    const tradie = await plumber();
    const logged = await log(owner.property, owner.ownerId);
    if (!logged.ok) throw new Error(logged.message);
    await accept(logged.job.id);
    // The hold runs out in Stripe (let go), and the owner's card starts declining, before the job is finished.
    const [hold] = await holdsFor(t.db, logged.job.id);
    await stripe().paymentIntents.cancel(hold!.payment_intent_id!);
    const bad = await stripe().paymentMethods.attach("pm_card_chargeCustomerFail", { customer: owner.customerId });
    await stripe().customers.update(owner.customerId, { invoice_settings: { default_payment_method: bad.id } });
    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "stripe", customerId: owner.customerId, card: { paymentMethodId: bad.id, brand: "visa", last4: "0341", expMonth: 12, expYear: 2034 } });

    const done = await finish(logged.job.id, tradie.tradieId);
    expect(await chargeJob(t.db, gateways, done.id)).toBe("failed");
    expect(await openExceptions(t.db, done.id)).toContain("payment_failed");

    // The payout guarantee: paid at the usual time anyway, from HostFix's own Stripe balance (no charge to tie it to).
    setTestNow(addHours(MONDAY_10AM, 25));
    const sent = await releaseDuePayouts(t.db, gateways);
    const payout = (await payoutRow(done.id))!;
    note(`Tradie paid ahead of a failed card: payout is "${payout.status}" (${sent} sent). A sandbox with too little available balance shows "waiting" here instead.`);
    expect(["sent", "waiting", "scheduled"]).toContain(payout.status);
    if (payout.status === "sent") {
      const transfer = await stripe().transfers.retrieve(payout.transfer_id!);
      expect(transfer).toMatchObject({ amount: 20000, destination: PAYEE, source_transaction: null });
    }

    // The owner fixes their card; the team presses "Try the card again now".
    await stripe().customers.update(owner.customerId, { invoice_settings: { default_payment_method: owner.paymentMethodId } });
    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "stripe", customerId: owner.customerId, card: { paymentMethodId: owner.paymentMethodId, brand: "visa", last4: "4242", expMonth: 12, expYear: 2034 } });
    expect(await chargeJob(t.db, gateways, done.id, { force: true })).toBe("succeeded");
    expect(await paymentRow(done.id)).toMatchObject({ amount_cents: 23500, status: "succeeded" });
    if (payout.status !== "sent") expect(["sent", "skipped"]).toContain(await retryPayout(t.db, gateways, done.id, "staff:test"));
  });

  it("a refund made by hand in Stripe is noticed, and the tradie's payment not yet sent is cut by their share", { timeout: 180_000 }, async () => {
    await liveMarket(t.db, { min_minutes_on_site: 0 });
    const owner = await ownerWithCard("Byhand");
    const tradie = await plumber();
    const logged = await log(owner.property, owner.ownerId);
    if (!logged.ok) throw new Error(logged.message);
    await accept(logged.job.id);
    const done = await finish(logged.job.id, tradie.tradieId);
    expect(await chargeJob(t.db, gateways, done.id)).toBe("succeeded");
    const payment = (await paymentRow(done.id))!;
    // Someone refunds NZ$10 in Stripe's dashboard instead of on the job page.
    const refund = await stripe().refunds.create({ payment_intent: payment.payment_intent_id!, amount: 1000 });
    const intent = await stripe().paymentIntents.retrieve(payment.payment_intent_id!);
    const event = await stripeEvent("charge.refunded", intent.latest_charge as string);
    expect(await handleProductMessage(t.db, { kind: "snapshot", event }, account)).toEqual({ handled: true, outcome: "refund_outside_app" });
    expect(await paymentRow(done.id)).toMatchObject({ refunded_cents: 1000, status: "part_refunded" });
    // 1000 x 20000 / 23500 = 851.06, so 851 comes off: 19149.
    expect(await payoutRow(done.id)).toMatchObject({ amount_cents: 19149 });
    expect(await openExceptions(t.db, done.id)).toContain("needs_review");
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await releaseDuePayouts(t.db, gateways)).toBe(1);
    expect(await payoutRow(done.id)).toMatchObject({ status: "sent", amount_cents: 19149 });
    expect(refund.status).toBe("succeeded");
  });

  it("a tradie's payout account: Stripe accepts what we send, gives a set-up page, and reports whether it can be paid", { timeout: 180_000 }, async () => {
    const gateway = gateways("NZ")!;
    const id = stamp();
    const created = await gateway.createPayoutAccount({ tradieId: `live-test-${id}`, businessName: `Test Sparky ${id}`, email: `sparky.${id}@example.com`, trades: ["electrician"] });
    try {
      expect(created.accountId).toMatch(/^acct_/);
      const made = await stripe().accounts.retrieve(created.accountId);
      expect(made).toMatchObject({ country: "NZ", business_type: "individual" });
      expect(made.business_profile?.mcc).toBe("1731");
      // The page must not ask a sole trader for a website: Stripe takes the description of the work instead.
      expect(made.requirements?.currently_due ?? []).not.toContain("business_profile.url");
      note(`A new tradie account still needs, on Stripe's page: ${(made.requirements?.currently_due ?? []).join(", ")}`);
      const link = await gateway.payoutOnboardingUrl({ accountId: created.accountId, tradieId: `live-test-${id}`, returnUrl: `${SITE}/tradie/profile`, refreshUrl: `${SITE}/tradie/profile` });
      expect(link).toMatch(/^https:\/\/connect\.stripe\.com\//);
      const page = await readStripePage(link);
      note(`Stripe's tradie set-up page opened (${page.status}) and reads: ${page.words.slice(0, 160)}`);
      expect(page.status).toBeLessThan(400);
      expect(await gateway.payoutAccountStatus(created.accountId)).toEqual({ payoutsEnabled: false, detailsSubmitted: false });
    } finally {
      await stripe().accounts.del(created.accountId).catch(() => {});
    }
    // The sandbox's finished account: can be paid.
    expect(await gateway.payoutAccountStatus(PAYEE)).toMatchObject({ payoutsEnabled: true });
    note(`The tradie's Stripe dashboard link: ${(await gateway.payoutDashboardUrl(PAYEE)) ? "given" : "not available for this account"}`);
  });

  it("a goodwill credit lands on the owner's Stripe balance", { timeout: 60_000 }, async () => {
    await liveMarket(t.db);
    const owner = await ownerWithCard("Credit");
    const credit = await gateways("NZ")!.creditCustomer({ customerId: owner.customerId, amountCents: 2000, currency: "NZD", description: "Goodwill credit", idempotencyKey: `hostfix-live-credit-${stamp()}` });
    expect(credit.ref).toMatch(/^cbtxn_/);
    const customer = await stripe().customers.retrieve(owner.customerId);
    expect(!customer.deleted && customer.balance).toBe(-2000);
  });

  it("an owner adds a NZ bank account on Stripe's page, and a NZ$750 deposit is debited from it", { timeout: 420_000 }, async () => {
    await liveMarket(t.db);
    const owner = await ownerWithCard("Bank");
    const gateway = gateways("NZ")!;
    const market = (await liveMarket(t.db))!;
    const started = await gateway.startBankSetup({ customerId: owner.customerId, ownerId: owner.ownerId, market, successUrl: `${SITE}/app/billing/bank/return`, cancelUrl: `${SITE}/app/billing` });
    // Stripe's test account that clears: 11-0000-0000000-010 (docs.stripe.com/payments/nz-bank-account).
    const bank = { name: owner.user.name, email: owner.user.email!, bank: "11", branch: "0000", account: "0000000", suffix: "010" };
    const seen = await inspectStripeFormPage(started.url);
    note(`Bank page offers: ${seen.offered.join(", ") || "(bank fields only)"}; fields: ${seen.fields.join(", ")}`);
    expect(seen.offered.filter((choice) => choice !== "NZ Direct Debit")).toEqual([]);
    expect(seen.words).toContain("Nothing is taken now.");
    if (CAN_SEND_PAGES) {
      const page = await saveBankOnStripePage(started.url, `${SITE}/app/billing/bank/return`, bank);
      const event = await stripeEvent("checkout.session.completed", sessionIdFrom(page.returnedTo));
      expect(await handleProductMessage(t.db, { kind: "snapshot", event }, account)).toEqual({ handled: true, outcome: "bank_saved" });
    } else {
      // The same thing Stripe's page does when the owner agrees: a SetupIntent that saves the account with its mandate.
      const intent = await stripe().setupIntents.create({
        customer: owner.customerId, confirm: true, allowed_payment_method_types: ["nz_bank_account"],
        payment_method_data: {
          type: "nz_bank_account", billing_details: { name: bank.name, email: bank.email },
          nz_bank_account: { bank_code: bank.bank, branch_code: bank.branch, account_number: bank.account, suffix: bank.suffix },
        },
        mandate_data: { customer_acceptance: { type: "online", online: { ip_address: "203.0.113.10", user_agent: "HostFix live test" } } },
        expand: ["payment_method"],
      });
      expect(intent.status).toBe("succeeded");
      const method = intent.payment_method as Stripe.PaymentMethod;
      await saveBank(t.db, {
        ownerId: owner.ownerId, country: "NZ", provider: "stripe", customerId: owner.customerId,
        bank: { paymentMethodId: method.id, bankName: method.nz_bank_account?.bank_name ?? null, last4: method.nz_bank_account?.last4 ?? null, mandateId: typeof intent.mandate === "string" ? intent.mandate : (intent.mandate?.id ?? null) },
      });
      note("Bank page: opened and read, not sent. The account was saved through Stripe's API the way the page saves it.");
    }
    const billing = (await getBilling(t.db, owner.ownerId, "NZ"))!;
    expect(billing.bankPaymentMethodId).toMatch(/^pm_/);
    note(`Bank saved: ${billing.bankName ?? "(no bank name)"}`);

    const debit = await gateway.debitBank({
      customerId: owner.customerId, paymentMethodId: billing.bankPaymentMethodId!, amountCents: 75000, currency: "NZD", description: "Deposit for big work (test)", jobNumber: 9000 + run, purpose: "deposit",
      idempotencyKey: `hostfix-live-debit-${stamp()}`,
    });
    expect(debit.status).toBe("processing");
    let latest = debit;
    for (let i = 0; i < 60 && latest.status === "processing"; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      latest = await gateway.debitStatus(debit.paymentIntentId!);
    }
    note(`A NZ$750 bank debit was "processing" at once and, after waiting up to 5 minutes, is "${latest.status}".`);
    expect(["processing", "succeeded"]).toContain(latest.status);
  });

  it("writes down what the run found", () => {
    console.log(`\n===== STRIPE LIVE RUN NOTES =====\n${notes.join("\n")}\n=================================\n`);
    expect(true).toBe(true);
  });
});
