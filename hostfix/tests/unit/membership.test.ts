import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { runTick } from "@/lib/dispatch/tick";
import { listTiers } from "@/lib/markets/store";
import { createOwnerAccount, getBilling, unusedDeposit } from "@/lib/owners/service";
import { completeDemoCheckout, createDemoGateway } from "@/lib/payments/demo-gateway";
import { addMonths } from "@/lib/payments/gateway";
import { activateMembership, changeTier, createProperty, endMembership, getProperty, PropertyError, recordMembershipPaymentFailed, recordRenewal, requestCancel, startMembership } from "@/lib/properties/service";
import { SqlLeadStore } from "@/lib/store/sql";
import { testDb } from "./db";
import { gatewayFor, liveMarket, makeOwner, makeProperty, MONDAY_10AM, openExceptions, textsTo } from "./factory";
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
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await makeProperty(t.db, owner.ownerId, { member: false });
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
    const owner = await makeOwner(t.db);
    const second = await makeProperty(t.db, owner.ownerId, { member: false, tier: "priority" });
    const started = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: second.id, ...urls });
    expect(started.kind).toBe("active");
    expect(await invoices(second.id)).toEqual([{ amount_cents: 14900, list_cents: 14900, status: "paid" }]);
  });

  it("being told twice about the same payment changes nothing the second time", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { member: false });
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

describe("the founding member deposit", () => {
  it("follows the owner from the landing page and comes off their first month, once", async () => {
    await liveMarket(t.db);
    const store = new SqlLeadStore(async () => t.db, "demo");
    const lead = await store.insertLead(ownerLead({ email: "founder@example.com", phone: "+64211230001" }));
    await store.recordDepositPaid({ leadId: lead.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" });

    const { ownerId } = await createOwnerAccount(t.db, { name: "Fiona Founder", email: "founder@example.com", phone: "+64211230001" });
    expect(await unusedDeposit(t.db, ownerId, "NZD")).toEqual({ leadId: lead.id, amountCents: 4900 });
    expect((await store.getLead(lead.id))!.convertedAt).not.toBeNull();

    const first = await makeProperty(t.db, ownerId, { member: false });
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
    const second = await makeProperty(t.db, ownerId, { member: false });
    expect((await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId, propertyId: second.id, ...urls })).kind).toBe("active");
    expect(await invoices(second.id)).toEqual([{ amount_cents: 9900, list_cents: 9900, status: "paid" }]);
  });

  it("is not taken off for someone whose deposit was refunded", async () => {
    await liveMarket(t.db);
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
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const next = { invoiceId: "in_month_2", amountCents: 9900, currency: "NZD", periodStart: addMonths(MONDAY_10AM, 1), periodEnd: addMonths(MONDAY_10AM, 2), paidAt: addMonths(MONDAY_10AM, 1) };
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: next })).toBe(true);
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: next })).toBe(false);
    expect(await invoices(property.id)).toHaveLength(2);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.currentPeriodEnd?.getTime()).toBe(addMonths(MONDAY_10AM, 2).getTime());
    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: "unknown", invoice: next })).toBe(false);
  });

  it("a failed payment puts new jobs on hold and texts the owner; the next good payment lifts it", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const failed = { invoiceId: "in_failed", amountCents: 9900, currency: "NZD", periodStart: addMonths(MONDAY_10AM, 1), periodEnd: addMonths(MONDAY_10AM, 2), paidAt: addMonths(MONDAY_10AM, 1) };
    expect(await recordMembershipPaymentFailed(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: failed, updateCardUrl: "http://localhost:3000/app/billing" })).toBe(true);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("past_due");
    expect((await textsTo(t.db, owner.user.phone!, "membership_failed"))[0]!.body).toContain("did not go through");

    expect(await recordRenewal(t.db, { provider: "demo", subscriptionId: property.subscriptionId!, invoice: { ...failed, invoiceId: "in_retry_ok" } })).toBe(true);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("active");
  });

  it("in the demo the timer renews memberships itself, taking off any credit given that month", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
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
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
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
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! })).toBe(true);
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! })).toBe(false);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("cancelled");
  });

  it("a property can move between tiers", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "essential" });
    const priority = (await listTiers(t.db, "queenstown")).find((tier) => tier.key === "priority")!;
    const changed = await changeTier(t.db, createDemoGateway(t.db, "NZ"), owner.ownerId, property.id, priority.id);
    expect(changed!.tierId).toBe(priority.id);
  });
});

describe("referrals", () => {
  it("a cleaner who brings in a property is owed NZ$100 once it has paid for three months", async () => {
    await liveMarket(t.db);
    await t.db.query("insert into public.referrers (name, phone, code) values ('Sam Cleaner', '+64225550009', 'SAM1234')");
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { referralCode: "sam1234" });
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
    await t.db.query("insert into public.referrers (name, phone, code) values ('Sam Cleaner', '+64225550010', 'SAM5678')");
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { referralCode: "SAM5678" });
    await endMembership(t.db, { provider: "demo", subscriptionId: property.subscriptionId! });
    expect((await t.db.query<{ status: string }>("select status from public.referrals where property_id = $1::uuid", [property.id]))[0]!.status).toBe("void");

    const other = await makeProperty(t.db, owner.ownerId, { referralCode: "NOSUCHCODE" });
    expect(await t.db.query("select 1 from public.referrals where property_id = $1::uuid", [other.id])).toEqual([]);
  });
});
