import { describe, expect, it } from "vitest";
import { SqlLeadStore } from "@/lib/store/sql";
import { testDb } from "./db";
import { ownerLead, runStoreContract } from "./store-contract";

// A brand new database for each test: several of these check the database's
// own clock (newest first, paid-at times).
const t = testDb("fresh");
const freshStore = () => new SqlLeadStore(async () => t.db, "demo");

describe("leads store", () => {
  runStoreContract(freshStore);

  it("writes an audit entry for every lead and every money movement", async () => {
    const store = freshStore();
    const owner = await store.insertLead(ownerLead());
    await store.markDepositStarted({ leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", amount: 4900, currency: "nzd" });
    await store.recordDepositPaid({ leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" });
    await store.recordDepositPaid({ leadId: owner.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" });
    await store.recordDepositRefunded({ paymentIntentId: "pi_1", amountRefunded: 4900, fullyRefunded: true, eventId: "evt_1" });

    const entries = await store.auditEntries();
    expect(entries.map((e) => e.action)).toEqual(["lead.created", "deposit.started", "deposit.paid", "deposit.refunded"]);
    expect(entries[2]).toMatchObject({ actor: "stripe", entityId: owner.id, amount: 4900, currency: "NZD" });
    expect(entries[3]).toMatchObject({ amount: 4900, currency: "NZD", dedupeKey: "stripe:evt_1" });
  });

  it("does not lose leads when many arrive at once", async () => {
    const store = freshStore();
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => store.insertLead(ownerLead({ phone: `+6421100${String(i).padStart(4, "0")}` }))),
    );
    expect((await store.countLeads()).owners).toBe(25);
  });

  it("never lets the audit log be changed or emptied", async () => {
    const store = freshStore();
    await store.insertLead(ownerLead());
    await expect(t.db.query("update public.audit_log set actor = 'x'")).rejects.toThrow(/append-only/);
    await expect(t.db.query("delete from public.audit_log")).rejects.toThrow(/append-only/);
    await expect(t.db.exec("truncate public.audit_log")).rejects.toThrow(/append-only/);
  });
});
