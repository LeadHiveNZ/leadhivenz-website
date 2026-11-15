import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DemoStore } from "@/lib/store/demo";
import { ownerLead, runStoreContract } from "./store-contract";

const folders: string[] = [];

async function freshStore(): Promise<DemoStore> {
  const folder = await mkdtemp(path.join(os.tmpdir(), "hostfix-demo-"));
  folders.push(folder);
  return new DemoStore(path.join(folder, "demo-db.json"));
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

describe("demo store", () => {
  runStoreContract(freshStore);

  it("writes an audit entry for every lead and every money movement", async () => {
    const store = await freshStore();
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

  it("keeps its data between restarts", async () => {
    const first = await freshStore();
    const lead = await first.insertLead(ownerLead());
    const folder = folders[folders.length - 1]!;
    const second = new DemoStore(path.join(folder, "demo-db.json"));
    expect(await second.getLead(lead.id)).toEqual(lead);
  });

  it("does not lose leads when many arrive at once", async () => {
    const store = await freshStore();
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => store.insertLead(ownerLead({ phone: `+6421100${String(i).padStart(4, "0")}` }))),
    );
    expect((await store.countLeads()).owners).toBe(25);
  });
});
