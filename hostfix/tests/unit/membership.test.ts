import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { runTick } from "@/lib/dispatch/tick";
import { AdminInputError, saveTier } from "@/lib/markets/admin";
import { listTiers } from "@/lib/markets/store";
import { createOwnerAccount, getBilling, unusedDeposit } from "@/lib/owners/service";
import { completeDemoCardSetup, completeDemoCheckout, createDemoGateway } from "@/lib/payments/demo-gateway";
import { addMonths } from "@/lib/payments/gateway";
import { activateFreeMembership, activateMembership, changeTier, createProperty, endMembership, getProperty, PropertyError, recordMembershipPaymentFailed, recordRenewal, requestCancel, startMembership } from "@/lib/properties/service";
import { SqlLeadStore } from "@/lib/store/sql";
import { testDb } from "./db";
import { addPaidTier, addPlusTier, auditActions, gatewayFor, liveMarket, makeOwner, makeProperty, MONDAY_10AM, openExceptions, textsTo } from "./factory";
import { ownerLead } from "./store-contract";

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const urls = { successUrl: "http://localhost:3000/app/properties/x/welcome", cancelUrl: "http://localhost:3000/app/properties/x" };
const invoices = async (propertyId: string) =>
  t.db.query<{ amount_cents: number; list_cents: number; status: string }>("select amount_cents, list_cents, status from public.membership_invoices where property_id = $1::uuid order by created_at, id", [propertyId]);

describe("starting a membership", () => {
  it("sends a new owner to the card page, and the property becomes a member when they pay", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid", member: false });
    expect(property.status).toBe("setup");
    const gateway = createDemoGateway(t.db, "NZ");

    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    if (started.kind !== "redirect") throw new Error("expected a card page");
    expect(started.url).toMatch(/^\/demo\/checkout\//);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");

    const paid = await completeDemoCheckout(t.db, started.url.split("/").pop()!);
    const active = await activateMembership(t.db, {
      propertyId: property.id, provider: "demo", subscriptionId: paid!.subscriptionId, periodEnd: paid!.periodEnd, invoice: paid!.invoice,
      card: paid!.card, customerId: paid!.checkout.customerId,
    });
    expect(active).toMatchObject({ status: "active", subscriptionId: paid!.subscriptionId });
    expect(active!.memberSince?.getTime()).toBe(MONDAY_10AM.getTime());
    expect(active!.currentPeriodEnd?.getTime()).toBe(addMonths(MONDAY_10AM, 1).getTime());
    expect(await invoices(property.id)).toEqual([{ amount_cents: 9900, list_cents: 9900, status: "paid" }]);
    // The card is now on file for jobs.
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toMatchObject({ paymentMethodId: "demo_pm_ok", cardLast4: "4242" });
    // The card page cannot be "paid" twice.
    expect(await completeDemoCheckout(t.db, started.url.split("/").pop()!)).toBeNull();
  });

  it("uses the saved card for the owner's next property, with no card page", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const second = await makeProperty(t.db, owner.ownerId, { tier: "paid", member: false });
    const started = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: second.id, ...urls });
    expect(started.kind).toBe("active");
    // The paid tier, NZ$99 a month. Each property is its own membership at the full price.
    expect(await invoices(second.id)).toEqual([{ amount_cents: 9900, list_cents: 9900, status: "paid" }]);
  });

  it("being told twice about the same payment changes nothing the second time", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid", member: false });
    const input = {
      propertyId: property.id, provider: "demo" as const, subscriptionId: "demo_sub_same", periodEnd: addMonths(MONDAY_10AM, 1), customerId: "demo_cus_x", card: null,
      invoice: { invoiceId: "demo_in_same", amountCents: 9900, currency: "NZD", periodStart: MONDAY_10AM, periodEnd: addMonths(MONDAY_10AM, 1), paidAt: MONDAY_10AM },
    };
    await activateMembership(t.db, input);
    await activateMembership(t.db, input);
    expect(await invoices(property.id)).toHaveLength(1);
    const started = await t.db.query("select 1 from public.audit_log where entity_id = $1 and action = 'membership.started'", [property.id]);
    expect(started).toHaveLength(1);
  });

  it("is not possible in a market that is not live, or with another market's tier", async () => {
    const owner = await makeOwner(t.db);
    const tiers = await listTiers(t.db, "queenstown");
    const input = { market: "queenstown", name: "Too early", addressLine1: "1 Main St", suburb: "", postcode: "", accessNotes: "", tierId: tiers[0]!.id };
    await expect(createProperty(t.db, owner.ownerId, input)).rejects.toBeInstanceOf(PropertyError);
    await liveMarket(t.db);
    await expect(createProperty(t.db, owner.ownerId, { ...input, tierId: "00000000-0000-4000-8000-000000000000" })).rejects.toBeInstanceOf(PropertyError);
    expect((await createProperty(t.db, owner.ownerId, input)).status).toBe("setup");
  });
});

describe("free to join (DECISIONS.md, 2026-11-17)", () => {
  // Essential costs 0 a month in config/markets.ts and in the database change. A property on it is covered
  // as soon as a card is on file: no subscription, no period end and no monthly invoice.
  const audits = async (propertyId: string) => t.db.query<{ action: string; amount: number | null }>("select action, amount from public.audit_log where entity_id = $1 order by id", [propertyId]);

  it("with a card already on file, the property is covered at once, with nothing charged", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { member: false });
    const started = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    if (started.kind !== "active") throw new Error("expected the property to be covered at once");
    expect(started.property).toMatchObject({ status: "active", subscriptionId: null, subscriptionProvider: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });
    expect(started.property.memberSince?.getTime()).toBe(MONDAY_10AM.getTime());
    expect(await invoices(property.id)).toEqual([]);
    expect((await audits(property.id)).filter((row) => row.action === "membership.started")).toEqual([{ action: "membership.started", amount: 0 }]);

    // Asking again changes nothing and writes nothing more.
    expect((await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: property.id, ...urls })).kind).toBe("active");
    expect((await audits(property.id)).filter((row) => row.action === "membership.started")).toHaveLength(1);
  });

  it("with no card, the owner is sent to the card page, nothing is charged, and the property is covered once the card is saved", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await makeProperty(t.db, owner.ownerId, { member: false });
    const started = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    if (started.kind !== "redirect") throw new Error("expected the card page");
    expect(started.url).toMatch(/^\/demo\/checkout\//);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");
    const id = started.url.split("/").pop()!;
    // It is a card page only: it cannot be "paid" as a monthly membership.
    expect(await completeDemoCheckout(t.db, id)).toBeNull();

    const saved = await completeDemoCardSetup(t.db, id);
    expect(saved!.checkout).toMatchObject({ setupOnly: true, priceCents: 0, propertyId: property.id });
    const covered = await activateFreeMembership(t.db, { propertyId: property.id, ownerId: owner.ownerId, provider: "demo", customerId: saved!.checkout.customerId, card: saved!.card });
    expect(covered).toMatchObject({ status: "active", subscriptionId: null, currentPeriodEnd: null });
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toMatchObject({ paymentMethodId: "demo_pm_ok", cardLast4: "4242" });
    expect(await invoices(property.id)).toEqual([]);
    // The card page cannot be used twice, and being told twice changes nothing.
    expect(await completeDemoCardSetup(t.db, id)).toBeNull();
    await activateFreeMembership(t.db, { propertyId: property.id, ownerId: owner.ownerId, provider: "demo", customerId: saved!.checkout.customerId, card: saved!.card });
    expect((await audits(property.id)).filter((row) => row.action === "membership.started")).toHaveLength(1);
    // Another owner cannot cover someone else's property with their card.
    const stranger = await makeOwner(t.db);
    const theirs = await makeProperty(t.db, owner.ownerId, { member: false });
    expect(await activateFreeMembership(t.db, { propertyId: theirs.id, ownerId: stranger.ownerId, provider: "demo", customerId: "demo_cus_stranger", card: null })).toBeNull();
  });

  it("the monthly-payment messages never touch a free property, because it has no subscription", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    expect(property).toMatchObject({ status: "active", subscriptionId: null });
    const invoice = { invoiceId: "in_free", amountCents: 9900, currency: "NZD", periodStart: MONDAY_10AM, periodEnd: addMonths(MONDAY_10AM, 1), paidAt: MONDAY_10AM };
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: "", invoice })).toBe(false);
    expect(await recordMembershipPaymentFailed(t.db, { provider: "demo", subscriptionId: "", invoice, updateCardUrl: "http://localhost:3000/app/billing" })).toBe(false);
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: "" })).toBe(false);
    // A month on, the demo timer has nothing to renew for it.
    setTestNow(addMonths(MONDAY_10AM, 1));
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(report.demo_renewals).toBe(0);
    expect(await getProperty(t.db, owner.ownerId, property.id)).toMatchObject({ status: "active", subscriptionId: null });
    expect(await invoices(property.id)).toEqual([]);
  });

  it("leaving ends cover at once: there is no month paid for to run out", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const left = await requestCancel(t.db, createDemoGateway(t.db, "NZ"), owner.ownerId, property.id);
    expect(left).toMatchObject({ status: "cancelled", cancelAtPeriodEnd: false, currentPeriodEnd: null });
    expect(left!.cancelledAt?.getTime()).toBe(MONDAY_10AM.getTime());
    expect(await auditActions(t.db, property.id)).toContain("membership.ended");
    // And it can be covered again, on the same card.
    const back = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    expect(back.kind === "active" && back.property.status).toBe("active");
  });

  it("moves between free and paid: a paid plan starts on the saved card, and going back to free stops it", async () => {
    await liveMarket(t.db);
    const paid = await addPaidTier(t.db);
    const essential = (await listTiers(t.db, "queenstown")).find((tier) => tier.key === "essential")!;
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const gateway = createDemoGateway(t.db, "NZ");

    const upgraded = await changeTier(t.db, gateway, owner.ownerId, property.id, paid.id);
    expect(upgraded).toMatchObject({ status: "active", tierId: paid.id, subscriptionProvider: "demo" });
    expect(upgraded!.subscriptionId).toMatch(/^demo_sub_/);
    expect(upgraded!.currentPeriodEnd?.getTime()).toBe(addMonths(MONDAY_10AM, 1).getTime());
    // The paid tier is NZ$99 a month, charged today.
    expect(await invoices(property.id)).toEqual([{ amount_cents: 9900, list_cents: 9900, status: "paid" }]);

    const back = await changeTier(t.db, gateway, owner.ownerId, property.id, essential.id);
    expect(back).toMatchObject({ status: "active", tierId: essential.id, subscriptionId: null, subscriptionProvider: null, currentPeriodEnd: null });
    // The old subscription ending later does not end the free cover.
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: upgraded!.subscriptionId! })).toBe(false);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("active");
    expect(await invoices(property.id)).toHaveLength(1);
  });

  it("will not start a paid plan from free without a card that works", async () => {
    await liveMarket(t.db);
    const paid = await addPaidTier(t.db);
    const owner = await makeOwner(t.db, { card: "declines" });
    const property = await makeProperty(t.db, owner.ownerId);
    await expect(changeTier(t.db, createDemoGateway(t.db, "NZ"), owner.ownerId, property.id, paid.id)).rejects.toThrow(/did not go through/);
    expect((await getProperty(t.db, owner.ownerId, property.id))!).toMatchObject({ tierId: property.tierId, subscriptionId: null, status: "active" });
    await expect(changeTier(t.db, null, owner.ownerId, property.id, paid.id)).rejects.toBeInstanceOf(PropertyError);
  });
});

describe("the founding member deposit", () => {
  it("follows the owner from the landing page and comes off their first month, once", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const store = new SqlLeadStore(async () => t.db, "demo");
    const lead = await store.insertLead(ownerLead({ email: "founder@example.com", phone: "+64211230001" }));
    await store.recordDepositPaid({ leadId: lead.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" });

    const { ownerId } = await createOwnerAccount(t.db, { name: "Fiona Founder", email: "founder@example.com", phone: "+64211230001" });
    expect(await unusedDeposit(t.db, ownerId, "NZD")).toEqual({ leadId: lead.id, amountCents: 4900 });
    expect((await store.getLead(lead.id))!.convertedAt).not.toBeNull();

    const first = await makeProperty(t.db, ownerId, { tier: "paid", member: false });
    const started = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId, propertyId: first.id, ...urls });
    if (started.kind !== "redirect") throw new Error("expected a card page");
    const paid = await completeDemoCheckout(t.db, started.url.split("/").pop()!);
    expect(paid!.checkout).toMatchObject({ priceCents: 9900, discountCents: 4900, discountLabel: "Founding member deposit" });
    expect(paid!.invoice.amountCents).toBe(5000);
    await activateMembership(t.db, { propertyId: first.id, provider: "demo", subscriptionId: paid!.subscriptionId, periodEnd: paid!.periodEnd, invoice: paid!.invoice, card: paid!.card, customerId: paid!.checkout.customerId });

    expect((await store.getLead(lead.id))!.depositStatus).toBe("credited");
    expect(await invoices(first.id)).toEqual([{ amount_cents: 5000, list_cents: 9900, status: "paid" }]);
    const credits = await t.db.query<{ reason: string; amount_cents: number; status: string }>("select reason, amount_cents, status from public.credits where owner_id = $1::uuid", [ownerId]);
    expect(credits).toEqual([{ reason: "founding_deposit", amount_cents: 4900, status: "applied" }]);

    // It is not taken off a second property.
    expect(await unusedDeposit(t.db, ownerId, "NZD")).toBeNull();
    const second = await makeProperty(t.db, ownerId, { tier: "paid", member: false });
    expect((await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId, propertyId: second.id, ...urls })).kind).toBe("active");
    expect(await invoices(second.id)).toEqual([{ amount_cents: 9900, list_cents: 9900, status: "paid" }]);
  });

  it("is not taken off for someone whose deposit was refunded", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const store = new SqlLeadStore(async () => t.db, "demo");
    const lead = await store.insertLead(ownerLead({ email: "refunded@example.com", phone: "+64211230002" }));
    await store.recordDepositPaid({ leadId: lead.id, stripeAccount: "NZ", checkoutSessionId: "cs_2", paymentIntentId: "pi_2", customerId: null, amount: 4900, currency: "nzd" });
    await store.recordDepositRefunded({ paymentIntentId: "pi_2", amountRefunded: 4900, fullyRefunded: true, eventId: "evt_r" });
    const { ownerId } = await createOwnerAccount(t.db, { name: "Rita", email: "refunded@example.com", phone: "+64211230002" });
    expect(await unusedDeposit(t.db, ownerId, "NZD")).toBeNull();
  });
});

describe("each month", () => {
  it("a payment extends the membership and is recorded once", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    const next = { invoiceId: "in_month_2", amountCents: 9900, currency: "NZD", periodStart: addMonths(MONDAY_10AM, 1), periodEnd: addMonths(MONDAY_10AM, 2), paidAt: addMonths(MONDAY_10AM, 1) };
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: next })).toBe(true);
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: next })).toBe(false);
    expect(await invoices(property.id)).toHaveLength(2);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.currentPeriodEnd?.getTime()).toBe(addMonths(MONDAY_10AM, 2).getTime());
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: "unknown", invoice: next })).toBe(false);
  });

  it("a failed payment puts new jobs on hold and texts the owner; the next good payment lifts it", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    const failed = { invoiceId: "in_failed", amountCents: 9900, currency: "NZD", periodStart: addMonths(MONDAY_10AM, 1), periodEnd: addMonths(MONDAY_10AM, 2), paidAt: addMonths(MONDAY_10AM, 1) };
    expect(await recordMembershipPaymentFailed(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: failed, updateCardUrl: "http://localhost:3000/app/billing" })).toBe(true);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("past_due");
    expect((await textsTo(t.db, owner.user.phone!, "membership_failed"))[0]!.body).toContain("did not go through");

    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: { ...failed, invoiceId: "in_retry_ok" } })).toBe(true);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("active");
  });

  it("in the demo the timer renews memberships itself, taking off any credit given that month", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    await t.db.query(
      `insert into public.credits (created_at, owner_id, property_id, reason, amount_cents, currency, month, status, created_by)
       values ($1::timestamptz, $2::uuid, $3::uuid, 'goodwill', 2000, 'NZD', '2026-11', 'applied', 'test')`,
      [new Date(MONDAY_10AM.getTime() + 86_400_000).toISOString(), owner.ownerId, property.id],
    );
    setTestNow(addMonths(MONDAY_10AM, 1));
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(report.demo_renewals).toBe(1);
    expect(await invoices(property.id)).toEqual([
      { amount_cents: 9900, list_cents: 9900, status: "paid" },
      { amount_cents: 7900, list_cents: 9900, status: "paid" },
    ]);
  });
});

describe("leaving and changing", () => {
  it("cancelling keeps the property a member until the month already paid for runs out", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    const cancelled = await requestCancel(t.db, createDemoGateway(t.db, "NZ"), owner.ownerId, property.id);
    expect(cancelled).toMatchObject({ status: "active", cancelAtPeriodEnd: true });

    setTestNow(addMonths(MONDAY_10AM, 1));
    await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(await getProperty(t.db, owner.ownerId, property.id)).toMatchObject({ status: "cancelled", cancelAtPeriodEnd: false });
    // No second charge was made.
    expect(await invoices(property.id)).toHaveLength(1);
  });

  it("the payment company ending a membership ends it here too, once", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! })).toBe(true);
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! })).toBe(false);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("cancelled");
  });

  it("a property can move between memberships, when there is more than one", async () => {
    // The business sells one membership today. If a second is ever added on the Markets screen, moving must work.
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const plus = await addPlusTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    const changed = await changeTier(t.db, createDemoGateway(t.db, "NZ"), owner.ownerId, property.id, plus.id);
    expect(changed!.tierId).toBe(plus.id);
  });
});

describe("referrals", () => {
  it("a cleaner who brings in a property is owed NZ$100 once it has paid for three months", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    await t.db.query("insert into public.referrers (name, phone, code) values ('Sam Cleaner', '+64225550009', 'SAM1234')");
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid", referralCode: "sam1234" });
    const referral = async () => (await t.db.query<{ status: string; reward_cents: number }>("select status, reward_cents from public.referrals where property_id = $1::uuid", [property.id]))[0];
    expect(await referral()).toEqual({ status: "pending", reward_cents: 10000 });

    const pay = (month: number) =>
      recordRenewal(t.db, {
        provider: "demo", subscriptionId: property.subscriptionId!,
        invoice: { invoiceId: `in_ref_${month}`, amountCents: 9900, currency: "NZD", periodStart: addMonths(MONDAY_10AM, month), periodEnd: addMonths(MONDAY_10AM, month + 1), paidAt: addMonths(MONDAY_10AM, month) },
      });
    await pay(1);
    expect((await referral())!.status).toBe("pending");
    await pay(2);
    expect((await referral())!.status).toBe("due");
    const queue = await t.db.query<{ summary: string }>("select summary from public.exceptions where kind = 'referral_due' and status = 'open'");
    expect(queue).toHaveLength(1);
    expect(queue[0]!.summary).toContain("Pay Sam Cleaner");
    await pay(3);
    expect(await t.db.query("select 1 from public.exceptions where kind = 'referral_due'")).toHaveLength(1);
    expect(await openExceptions(t.db, "00000000-0000-4000-8000-000000000000")).toEqual([]);
  });

  it("is void if the property leaves before the three months are up, and an unknown code is ignored", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    await t.db.query("insert into public.referrers (name, phone, code) values ('Sam Cleaner', '+64225550010', 'SAM5678')");
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "paid", referralCode: "SAM5678" });
    await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! });
    expect((await t.db.query<{ status: string }>("select status from public.referrals where property_id = $1::uuid", [property.id]))[0]!.status).toBe("void");

    const other = await makeProperty(t.db, owner.ownerId, { tier: "paid", referralCode: "NOSUCHCODE" });
    expect(await t.db.query("select 1 from public.referrals where property_id = $1::uuid", [other.id])).toEqual([]);
  });
});

describe("changing a membership price", () => {
  const input = (tier: Awaited<ReturnType<typeof listTiers>>[number], patch: Record<string, unknown> = {}) => ({
    id: tier.id, key: tier.key, name: tier.name, priceCents: tier.monthlyPriceCents, responseHours: tier.responseHours,
    urgentResponseHours: tier.urgentResponseHours, urgentIncluded: tier.urgentIncluded, urgentIncludedPerMonth: tier.urgentIncludedPerMonth,
    quarterlyCheck: tier.quarterlyCheck, blurb: tier.blurb, active: tier.active, ...patch,
  });
  const tierNamed = async (key: string) => (await listTiers(t.db, "queenstown")).find((tier) => tier.key === key)!;

  it("is refused while properties are members on it, so nobody is shown one price and charged another", async () => {
    await liveMarket(t.db);
    await addPaidTier(t.db);
    const owner = await makeOwner(t.db);
    await makeProperty(t.db, owner.ownerId, { tier: "paid" });
    const paid = await tierNamed("paid");

    await expect(saveTier(t.db, "queenstown", input(paid, { priceCents: 11900 }), "admin")).rejects.toThrow(AdminInputError);
    await expect(saveTier(t.db, "queenstown", input(paid, { priceCents: 11900 }), "admin")).rejects.toThrow(/1 property is a member/);
    expect((await tierNamed("paid")).monthlyPriceCents).toBe(9900);

    // Everything else about it can still change, and it can be closed to new members.
    await saveTier(t.db, "queenstown", input(paid, { responseHours: 12, active: false }), "admin");
    expect(await tierNamed("paid")).toMatchObject({ monthlyPriceCents: 9900, responseHours: 12, active: false });

    // The new price goes on a new membership, which is the one new members are offered.
    await saveTier(t.db, "queenstown", { ...input(paid, { priceCents: 11900, active: true }), id: null, key: "paid_2027" }, "admin");
    expect(await tierNamed("paid_2027")).toMatchObject({ monthlyPriceCents: 11900, active: true });
  });

  it("is refused on the free Essential too while properties are on it: they joined for nothing and have no monthly payment to charge", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    await makeProperty(t.db, owner.ownerId);
    const essential = await tierNamed("essential");
    expect(essential.monthlyPriceCents).toBe(0);
    await expect(saveTier(t.db, "queenstown", input(essential, { priceCents: 9900 }), "admin")).rejects.toThrow(/1 property is a member/);
    expect((await tierNamed("essential")).monthlyPriceCents).toBe(0);
  });

  it("allows a free per-property membership, but never a free Portfolio retainer", async () => {
    await liveMarket(t.db);
    await saveTier(t.db, "queenstown", { ...input(await tierNamed("essential")), id: null, key: "free_two", name: "Free two", priceCents: 0 }, "admin");
    expect((await tierNamed("free_two")).monthlyPriceCents).toBe(0);
    await expect(saveTier(t.db, "queenstown", { ...input(await tierNamed("essential")), id: null, key: "free_two", priceCents: -1 }, "admin")).rejects.toThrow("The monthly price must be zero or more.");
    await expect(
      saveTier(t.db, "queenstown", { ...input(await tierNamed("essential")), id: null, key: "free_retainer", name: "Free retainer", billingBasis: "per_account", bands: [{ from: 10, to: null, cents: 0 }] }, "admin"),
    ).rejects.toThrow(AdminInputError);
  });

  it("is allowed when nobody is a member on it, or everyone on it has left", async () => {
    await liveMarket(t.db);
    await addPlusTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "plus" });

    // Nobody is on Essential.
    await saveTier(t.db, "queenstown", input(await tierNamed("essential"), { priceCents: 10900 }), "admin");
    expect((await tierNamed("essential")).monthlyPriceCents).toBe(10900);

    // One property is on the second membership, so its price is locked. Then that member leaves.
    await expect(saveTier(t.db, "queenstown", input(await tierNamed("plus"), { priceCents: 15900 }), "admin")).rejects.toThrow(/1 property is a member/);
    await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! });
    await saveTier(t.db, "queenstown", input(await tierNamed("plus"), { priceCents: 15900 }), "admin");
    expect((await tierNamed("plus")).monthlyPriceCents).toBe(15900);
  });

  it("says so plainly when the membership does not exist", async () => {
    await liveMarket(t.db);
    const essential = await tierNamed("essential");
    await expect(saveTier(t.db, "queenstown", input(essential, { id: "not-an-id" }), "admin")).rejects.toThrow("That tier does not exist.");
    await expect(saveTier(t.db, "queenstown", input(essential, { id: "00000000-0000-4000-8000-000000000000" }), "admin")).rejects.toThrow("That tier does not exist.");
  });
});

describe("the database change for free to join", () => {
  const file = path.resolve(__dirname, "../../supabase/migrations/20261120000000_free_to_join.sql");
  const BLURB = "Free to join. Fixed prices, charged only when something is fixed. A tradie on site within 24 hours, or 4 when it's urgent.";

  it("makes an existing Queenstown Essential free, and is safe to run twice", async () => {
    // A database set up before the change: Essential at NZ$99 with its old line.
    await t.db.query("update public.membership_tiers set price_cents = 9900, blurb = 'A tradie on site within 24 hours.' where market = 'queenstown' and key = 'essential'");
    await t.db.exec(fs.readFileSync(file, "utf8"));
    await t.db.exec(fs.readFileSync(file, "utf8"));
    const tiers = await listTiers(t.db, "queenstown");
    expect(tiers.map((tier) => [tier.key, tier.monthlyPriceCents])).toEqual([["essential", 0], ["portfolio", 60000]]);
    expect(tiers[0]!.blurb).toBe(BLURB);
  });

  it("allows a free per-property tier in the database, never a free retainer, and gives tradies the insurance fields", async () => {
    await t.db.exec(fs.readFileSync(file, "utf8"));
    await expect(t.db.query("update public.membership_tiers set price_cents = 0 where key = 'portfolio'")).rejects.toThrow();
    await expect(t.db.query("update public.membership_tiers set price_cents = -1 where key = 'essential'")).rejects.toThrow();
    const columns = await t.db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'tradies' and column_name in ('insurer', 'insurance_policy_number', 'insurance_expires_on') order by column_name",
    );
    expect(columns.map((row) => row.column_name)).toEqual(["insurance_expires_on", "insurance_policy_number", "insurer"]);
  });
});
