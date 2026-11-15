import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { launchMarket } from "@config/markets";
import { MIN_FILL_MS, RATE_LIMIT_MAX, submitLead, type RawLeadForm, type SubmitDeps } from "@/lib/leads/service";
import { DemoStore } from "@/lib/store/demo";
import type { Lead, LeadStore } from "@/lib/store/types";

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

async function freshStore(): Promise<DemoStore> {
  const folder = await mkdtemp(path.join(os.tmpdir(), "hostfix-svc-"));
  folders.push(folder);
  return new DemoStore(path.join(folder, "demo-db.json"));
}

const NOW = new Date("2026-11-15T02:00:00.000Z");
const quiet = { error: vi.fn(), warn: vi.fn() };

function ownerForm(overrides: Partial<RawLeadForm> = {}, fields: Record<string, unknown> = {}): RawLeadForm {
  return {
    fields: {
      name: "Olive Owner",
      phone: "021 123 4567",
      email: "olive@example.com",
      propertyCount: "2",
      managedBy: "self",
      ownerLocation: "Auckland",
      ...fields,
    },
    attribution: JSON.stringify({ utm_source: "facebook", fbclid: "abc" }),
    honeypot: "",
    startedAt: String(NOW.getTime() - 20_000),
    ...overrides,
  };
}

type Harness = {
  deps: SubmitDeps;
  alerts: { lead: Lead; saved: boolean; store: LeadStore | null }[];
  runDeferred: () => Promise<void>;
};

function harness(store: LeadStore | (() => LeadStore), alertSends = true): Harness {
  const alerts: Harness["alerts"] = [];
  const deferred: (() => Promise<void>)[] = [];
  return {
    alerts,
    runDeferred: async () => {
      for (const work of deferred.splice(0)) await work();
    },
    deps: {
      getStore: typeof store === "function" ? store : () => store,
      sendLeadAlert: async (lead, options, alertStore) => {
        alerts.push({ lead, saved: options.saved, store: alertStore });
        return { anySent: alertSends };
      },
      defer: (work) => {
        deferred.push(work);
      },
      now: () => NOW,
      log: quiet,
    },
  };
}

const context = { market: launchMarket, ipKey: "visitor-1" };

describe("submitting a lead form", () => {
  it("saves the lead, then alerts after the visitor has their answer", async () => {
    const store = await freshStore();
    const h = harness(store);

    const result = await submitLead("owner", ownerForm(), context, h.deps);

    expect(result).toMatchObject({ status: "ok", saved: true, duplicate: false });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(await store.getLead(result.lead.id)).toMatchObject({ name: "Olive Owner", source: "meta", phone: "+64211234567" });

    expect(h.alerts).toHaveLength(0);
    await h.runDeferred();
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0]).toMatchObject({ saved: true, lead: { id: result.lead.id } });
    expect(h.alerts[0]?.store).toBe(store);
  });

  it("saves a tradie lead", async () => {
    const store = await freshStore();
    const h = harness(store);
    const result = await submitLead(
      "tradie",
      {
        fields: { name: "Tane Tradie", phone: "022 123 4567", trade: "plumber", licenceNumber: "PGDB 1", daysAvailable: ["mon"] },
        attribution: "",
        honeypot: "",
        startedAt: "",
      },
      context,
      h.deps,
    );
    expect(result).toMatchObject({ status: "ok", lead: { leadType: "tradie", trade: "plumber", source: "direct" } });
  });

  it("sends back field messages and saves nothing when the form is wrong", async () => {
    const store = await freshStore();
    const h = harness(store);
    const result = await submitLead("owner", ownerForm({}, { email: "nope", phone: "123" }), context, h.deps);
    expect(result).toEqual({
      status: "invalid",
      fieldErrors: {
        email: "That email address doesn't look right. Please check it.",
        phone: "Please enter your mobile number.",
      },
    });
    expect((await store.countLeads()).owners).toBe(0);
    await h.runDeferred();
    expect(h.alerts).toHaveLength(0);
  });

  it("quietly turns away a robot that fills in the hidden field", async () => {
    const store = await freshStore();
    const h = harness(store);
    const result = await submitLead("owner", ownerForm({ honeypot: "http://spam.example" }), context, h.deps);
    expect(result).toEqual({ status: "spam" });
    expect((await store.countLeads()).owners).toBe(0);
    await h.runDeferred();
    expect(h.alerts).toHaveLength(0);
  });

  it("quietly turns away a form sent faster than a person could fill it in", async () => {
    const store = await freshStore();
    const h = harness(store);
    const tooFast = ownerForm({ startedAt: String(NOW.getTime() - (MIN_FILL_MS - 1)) });
    expect(await submitLead("owner", tooFast, context, h.deps)).toEqual({ status: "spam" });
    expect((await store.countLeads()).owners).toBe(0);
  });

  it("accepts a form with no start time or a nonsense one (browsers without JavaScript)", async () => {
    const store = await freshStore();
    const h = harness(store);
    for (const [index, startedAt] of ["", "abc", String(NOW.getTime() + 60_000), "1"].entries()) {
      const result = await submitLead("owner", ownerForm({ startedAt }, { phone: `021 123 45${60 + index}` }), context, h.deps);
      expect(result.status).toBe("ok");
    }
  });

  it("treats the same phone number sent again within ten minutes as one lead and one alert", async () => {
    const store = await freshStore();
    const h = harness(store);
    const first = await submitLead("owner", ownerForm(), context, h.deps);
    const second = await submitLead("owner", ownerForm({}, { name: "Olive O" }), context, h.deps);

    expect(second).toMatchObject({ status: "ok", duplicate: true, saved: true });
    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(second.lead.id).toBe(first.lead.id);
    expect((await store.countLeads()).owners).toBe(1);
    await h.runDeferred();
    expect(h.alerts).toHaveLength(1);
  });

  it("keeps an owner and a tradie with the same phone number as two leads", async () => {
    const store = await freshStore();
    const h = harness(store);
    await submitLead("owner", ownerForm(), context, h.deps);
    const tradie = await submitLead(
      "tradie",
      { fields: { name: "Olive Owner", phone: "021 123 4567", trade: "handyman", daysAvailable: ["sat"] }, attribution: "", honeypot: "", startedAt: "" },
      context,
      h.deps,
    );
    expect(tradie).toMatchObject({ status: "ok", duplicate: false });
    expect(await store.countLeads()).toMatchObject({ owners: 1, tradies: 1 });
  });

  it("stops one visitor flooding the form", async () => {
    const store = await freshStore();
    const h = harness(store);
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const result = await submitLead("owner", ownerForm({}, { phone: `021 555 ${String(1000 + i)}` }), context, h.deps);
      expect(result.status).toBe("ok");
    }
    const blocked = await submitLead("owner", ownerForm({}, { phone: "021 555 2000" }), context, h.deps);
    expect(blocked).toEqual({ status: "rate_limited" });

    const someoneElse = await submitLead("owner", ownerForm({}, { phone: "021 555 3000" }), { ...context, ipKey: "visitor-2" }, h.deps);
    expect(someoneElse.status).toBe("ok");
    expect((await store.countLeads()).owners).toBe(RATE_LIMIT_MAX + 1);
  });

  it("still takes the lead when the rate limit and repeat checks themselves break", async () => {
    const store = await freshStore();
    vi.spyOn(store, "rateLimitHit").mockRejectedValue(new Error("limit table missing"));
    vi.spyOn(store, "findRecentLead").mockRejectedValue(new Error("query failed"));
    const h = harness(store);
    const result = await submitLead("owner", ownerForm(), context, h.deps);
    expect(result).toMatchObject({ status: "ok", saved: true });
  });
});

describe("when the database is struggling", () => {
  it("skips the repeat check once the rate limit check has failed, to keep the visitor's wait short", async () => {
    const store = await freshStore();
    vi.spyOn(store, "rateLimitHit").mockRejectedValue(new Error("timed out"));
    const repeatCheck = vi.spyOn(store, "findRecentLead");
    const h = harness(store);
    const result = await submitLead("owner", ownerForm(), context, h.deps);
    expect(result).toMatchObject({ status: "ok", saved: true });
    expect(repeatCheck).not.toHaveBeenCalled();
  });
});

describe("never losing a lead", () => {
  it("sends the alert straight away, marked NOT SAVED, when the database is down", async () => {
    const store = await freshStore();
    vi.spyOn(store, "insertLead").mockRejectedValue(new Error("database is down"));
    const h = harness(store);

    const result = await submitLead("owner", ownerForm(), context, h.deps);

    expect(result).toMatchObject({ status: "ok", saved: false, duplicate: false });
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0]).toMatchObject({
      saved: false,
      store: null,
      lead: { name: "Olive Owner", phone: "+64211234567", email: "olive@example.com", propertyCount: 2 },
    });
  });

  it("does the same when the database was never connected", async () => {
    const h = harness(() => {
      throw new Error("not configured");
    });
    const result = await submitLead("owner", ownerForm(), context, h.deps);
    expect(result).toMatchObject({ status: "ok", saved: false });
    expect(h.alerts).toHaveLength(1);
  });

  it("tells the visitor to try again only when saving AND alerting both fail", async () => {
    const store = await freshStore();
    vi.spyOn(store, "insertLead").mockRejectedValue(new Error("database is down"));
    const h = harness(store, false);
    expect(await submitLead("owner", ownerForm(), context, h.deps)).toEqual({ status: "failed" });
  });

  it("also fails safely if the alert itself throws", async () => {
    const h = harness(() => {
      throw new Error("not configured");
    });
    h.deps.sendLeadAlert = async () => {
      throw new Error("alert provider exploded");
    };
    expect(await submitLead("owner", ownerForm(), context, h.deps)).toEqual({ status: "failed" });
  });

  it("keeps a saved lead even if its alert later fails", async () => {
    const store = await freshStore();
    const h = harness(store);
    h.deps.sendLeadAlert = async () => {
      throw new Error("alert provider exploded");
    };
    const result = await submitLead("owner", ownerForm(), context, h.deps);
    await expect(h.runDeferred()).resolves.toBeUndefined();
    expect(result.status).toBe("ok");
    expect((await store.countLeads()).owners).toBe(1);
  });
});
