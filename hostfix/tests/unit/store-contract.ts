import { expect, it } from "vitest";
import type { LeadStore, NewLead } from "@/lib/store/types";

/**
 * The behaviour every lead store must have. The demo store runs these on every
 * test run. The same rules are checked against the real database functions in
 * tests/db/phase0.checks.sql.
 */

export function ownerLead(overrides: Partial<NewLead> = {}): NewLead {
  return {
    leadType: "owner",
    market: "queenstown",
    name: "Olive Owner",
    phone: "+64211234567",
    email: "olive@example.com",
    propertyCount: 2,
    managedBy: "self",
    ownerLocation: "Auckland",
    trade: null,
    licenceNumber: null,
    daysAvailable: null,
    source: "meta",
    utmSource: "facebook",
    utmMedium: "paid",
    utmCampaign: "qt-owners",
    utmContent: null,
    utmTerm: null,
    fbclid: "abc",
    gclid: null,
    refCode: null,
    referrer: null,
    landingPath: "/owners",
    ...overrides,
  };
}

export function tradieLead(overrides: Partial<NewLead> = {}): NewLead {
  return {
    leadType: "tradie",
    market: "queenstown",
    name: "Tane Tradie",
    phone: "+64221234567",
    email: null,
    propertyCount: null,
    managedBy: null,
    ownerLocation: null,
    trade: "plumber",
    licenceNumber: "PGDB 12345",
    daysAvailable: ["mon", "tue"],
    source: "direct",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    fbclid: null,
    gclid: null,
    refCode: null,
    referrer: null,
    landingPath: "/tradies",
    ...overrides,
  };
}

export function runStoreContract(makeStore: () => Promise<LeadStore> | LeadStore) {
  it("saves a lead and gives it an id, a time and no deposit", async () => {
    const store = await makeStore();
    const lead = await store.insertLead(ownerLead());
    expect(lead.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(lead.createdAt))).toBe(false);
    expect(lead).toMatchObject({ name: "Olive Owner", source: "meta", depositStatus: "none", depositAmount: null });
    expect(await store.getLead(lead.id)).toEqual(lead);
  });

  it("returns nothing for a lead that does not exist", async () => {
    const store = await makeStore();
    expect(await store.getLead("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("refuses an owner with no email and a tradie with no trade", async () => {
    const store = await makeStore();
    await expect(store.insertLead(ownerLead({ email: null }))).rejects.toThrow();
    await expect(store.insertLead(tradieLead({ trade: null }))).rejects.toThrow();
  });

  it("lists leads newest first and can filter by type", async () => {
    const store = await makeStore();
    const first = await store.insertLead(ownerLead({ name: "First" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await store.insertLead(tradieLead({ name: "Second" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const third = await store.insertLead(ownerLead({ name: "Third", phone: "+64211111111" }));

    expect((await store.listLeads({ limit: 10 })).map((l) => l.id)).toEqual([third.id, second.id, first.id]);
    expect((await store.listLeads({ limit: 2 })).map((l) => l.id)).toEqual([third.id, second.id]);
    expect((await store.listLeads({ leadType: "tradie", limit: 10 })).map((l) => l.id)).toEqual([second.id]);
  });

  it("finds a recent lead with the same type and phone, and nothing else", async () => {
    const store = await makeStore();
    const before = new Date(Date.now() - 60_000).toISOString();
    const lead = await store.insertLead(ownerLead());
    expect((await store.findRecentLead("owner", lead.phone, before))?.id).toBe(lead.id);
    expect(await store.findRecentLead("tradie", lead.phone, before)).toBeNull();
    expect(await store.findRecentLead("owner", "+64219999999", before)).toBeNull();
    const after = new Date(Date.now() + 60_000).toISOString();
    expect(await store.findRecentLead("owner", lead.phone, after)).toBeNull();
  });

  it("counts leads and adds up paid deposits by currency", async () => {
    const store = await makeStore();
    const a = await store.insertLead(ownerLead());
    const b = await store.insertLead(ownerLead({ phone: "+64211111111" }));
    await store.insertLead(tradieLead());
    await store.recordDepositPaid({ leadId: a.id, stripeAccount: "NZ", checkoutSessionId: "cs_a", paymentIntentId: "pi_a", customerId: null, amount: 4900, currency: "nzd" });
    await store.recordDepositPaid({ leadId: b.id, stripeAccount: "NZ", checkoutSessionId: "cs_b", paymentIntentId: "pi_b", customerId: null, amount: 4900, currency: "nzd" });
    expect(await store.countLeads()).toEqual({
      owners: 2,
      tradies: 1,
      depositsPaid: 2,
      depositTotals: [{ currency: "NZD", cents: 9800 }],
    });
  });

  it("starts a deposit for an owner but never for a tradie", async () => {
    const store = await makeStore();
    const owner = await store.insertLead(ownerLead());
    const tradie = await store.insertLead(tradieLead());
    const started = await store.markDepositStarted({ leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", amount: 4900, currency: "nzd" });
    expect(started).toMatchObject({ depositStatus: "started", depositAmount: 4900, depositCurrency: "NZD", stripeCheckoutSessionId: "cs_1" });
    expect(await store.markDepositStarted({ leadId: tradie.id, stripeAccount: "NZ", checkoutSessionId: "cs_2", amount: 4900, currency: "nzd" })).toBeNull();
  });

  it("records a paid deposit exactly once", async () => {
    const store = await makeStore();
    const owner = await store.insertLead(ownerLead());
    const args = { leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: "cus_1", amount: 4900, currency: "nzd" };

    const first = await store.recordDepositPaid(args);
    expect(first).toMatchObject({
      depositStatus: "paid",
      depositAmount: 4900,
      depositCurrency: "NZD",
      stripePaymentIntentId: "pi_1",
      stripeCustomerId: "cus_1",
    });
    expect(first?.depositPaidAt).toBeTruthy();

    expect(await store.recordDepositPaid(args)).toBeNull();
    expect(await store.recordDepositPaid({ ...args, checkoutSessionId: "cs_other", paymentIntentId: "pi_other" })).toBeNull();
    expect(await store.getLead(owner.id)).toMatchObject({ stripePaymentIntentId: "pi_1", stripeCheckoutSessionId: "cs_1" });

    expect(await store.markDepositStarted({ leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_9", amount: 4900, currency: "nzd" })).toBeNull();
    expect(await store.recordDepositPaid({ ...args, leadId: "00000000-0000-4000-8000-000000000000" })).toBeNull();
  });

  it("records refunds once per event, and only a full refund changes the status", async () => {
    const store = await makeStore();
    const owner = await store.insertLead(ownerLead());
    await store.recordDepositPaid({ leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" });

    const part = await store.recordDepositRefunded({ paymentIntentId: "pi_1", amountRefunded: 1000, fullyRefunded: false, eventId: "evt_1" });
    expect(part).toMatchObject({ depositStatus: "paid" });

    const full = await store.recordDepositRefunded({ paymentIntentId: "pi_1", amountRefunded: 4900, fullyRefunded: true, eventId: "evt_2" });
    expect(full).toMatchObject({ depositStatus: "refunded" });
    expect(full?.depositRefundedAt).toBeTruthy();

    expect(await store.recordDepositRefunded({ paymentIntentId: "pi_1", amountRefunded: 4900, fullyRefunded: true, eventId: "evt_2" })).toBeNull();
    expect(await store.recordDepositRefunded({ paymentIntentId: "pi_unknown", amountRefunded: 4900, fullyRefunded: true, eventId: "evt_3" })).toBeNull();
  });

  it("stores an audit entry with a dedupe key only once", async () => {
    const store = await makeStore();
    expect(await store.audit({ actor: "stripe", action: "deposit.duplicate_payment", entity: "lead", entityId: "x", dedupeKey: "dup:cs_1" })).toBe(true);
    expect(await store.audit({ actor: "stripe", action: "deposit.duplicate_payment", entity: "lead", entityId: "x", dedupeKey: "dup:cs_1" })).toBe(false);
    expect(await store.audit({ actor: "admin", action: "note", entity: "lead", entityId: "x" })).toBe(true);
    expect(await store.audit({ actor: "admin", action: "note", entity: "lead", entityId: "x" })).toBe(true);
  });

  it("keeps a record of alerts against the lead", async () => {
    const store = await makeStore();
    const owner = await store.insertLead(ownerLead());
    await store.logNotification({ channel: "sms", template: "lead_alert", recipient: "+61400000000", status: "sent", provider: "clicksend", providerMessageId: "m1", leadId: owner.id });
    await store.logNotification({ channel: "email", template: "lead_alert", recipient: "me@example.com", status: "failed", provider: "resend", error: "nope", leadId: owner.id });
    await store.logNotification({ channel: "email", template: "test_alert", recipient: "me@example.com", status: "sent" });

    const list = await store.listNotifications([owner.id]);
    expect(list).toHaveLength(2);
    expect(list.map((n) => `${n.channel}:${n.status}`).sort()).toEqual(["email:failed", "sms:sent"]);
    expect(await store.listNotifications([])).toEqual([]);
  });

  it("allows hits up to the limit and refuses the next one", async () => {
    const store = await makeStore();
    expect(await store.rateLimitHit("test:a", 3600, 3)).toBe(true);
    expect(await store.rateLimitHit("test:a", 3600, 3)).toBe(true);
    expect(await store.rateLimitHit("test:a", 3600, 3)).toBe(true);
    expect(await store.rateLimitHit("test:a", 3600, 3)).toBe(false);
    expect(await store.rateLimitHit("test:b", 3600, 3)).toBe(true);
    await expect(store.rateLimitHit("test:c", 0, 3)).rejects.toThrow();
  });

  it("reports that it is healthy", async () => {
    const store = await makeStore();
    expect((await store.health()).ok).toBe(true);
  });
}
