import { describe, expect, it } from "vitest";
import { newLeadToRow, rowToLead, SupabaseStore } from "@/lib/store/supabase";
import type { Lead } from "@/lib/store/types";
import { fakeFetch, jsonReply, type RecordedRequest } from "./helpers";
import { ownerLead } from "./store-contract";

/**
 * The real database is reached through Supabase's web API. These tests stand
 * in for that API and check two things: that we ask it for the right thing,
 * and that we read its answers (and its errors) correctly.
 *
 * The database's own rules are tested for real, against Postgres, by
 * scripts/db-test.sh.
 */

const URL_BASE = "https://abc.supabase.co";
const KEY = "sb_secret_test_key";

const savedRow = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-11-15T02:00:00+00:00",
  lead_type: "owner" as const,
  market: "queenstown",
  name: "Olive Owner",
  phone: "+64211234567",
  email: "olive@example.com",
  property_count: 2,
  managed_by: "self",
  owner_location: "Auckland",
  trade: null,
  licence_number: null,
  days_available: null,
  source: "meta",
  utm_source: "facebook",
  utm_medium: "paid",
  utm_campaign: "qt-owners",
  utm_content: null,
  utm_term: null,
  fbclid: "abc",
  gclid: null,
  ref_code: null,
  referrer: null,
  landing_path: "/owners",
  deposit_status: "none" as const,
  deposit_amount: null,
  deposit_currency: null,
  stripe_account: null,
  stripe_checkout_session_id: null,
  stripe_payment_intent_id: null,
  stripe_customer_id: null,
  deposit_paid_at: null,
  deposit_refunded_at: null,
};

function storeWith(reply: (request: RecordedRequest) => Response) {
  const net = fakeFetch(reply);
  return { store: new SupabaseStore({ url: URL_BASE, secretKey: KEY }, net.fetch), requests: net.requests };
}

const pathOf = (request: RecordedRequest) => request.url.replace(URL_BASE, "");

describe("talking to Supabase", () => {
  it("sends the secret key with every request and never a user session", async () => {
    const { store, requests } = storeWith(() => jsonReply([]));
    await store.listLeads({ limit: 10 });
    expect(requests[0]?.headers.apikey).toBe(KEY);
    expect(requests[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
  });

  it("saves a lead and reads back the saved row", async () => {
    const { store, requests } = storeWith(() => jsonReply(savedRow, 201));
    const lead = await store.insertLead(ownerLead());

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(pathOf(request)).toBe("/rest/v1/leads?select=*");
    expect(request.headers.prefer).toBe("return=representation");
    expect(JSON.parse(request.body)).toEqual(newLeadToRow(ownerLead()));
    expect(JSON.parse(request.body)).toMatchObject({ lead_type: "owner", property_count: 2, utm_campaign: "qt-owners", landing_path: "/owners" });
    // The database sets these itself. The app must never send them.
    for (const column of ["id", "created_at", "deposit_status", "deposit_amount"]) {
      expect(JSON.parse(request.body)).not.toHaveProperty(column);
    }

    expect(lead).toMatchObject({ id: savedRow.id, createdAt: savedRow.created_at, leadType: "owner", propertyCount: 2, depositStatus: "none" });
  });

  it("fails loudly when the database refuses the lead, so the alert fallback kicks in", async () => {
    const { store } = storeWith(() =>
      jsonReply({ code: "23514", message: 'new row for relation "leads" violates check constraint "leads_owner_fields"', details: null, hint: null }, 400),
    );
    await expect(store.insertLead(ownerLead())).rejects.toThrow(/Database problem while saving a lead \[23514\].*leads_owner_fields/);
  });

  it("does not pretend a lead was saved if no saved row comes back", async () => {
    const { store } = storeWith(() => jsonReply({}, 201));
    await expect(store.insertLead(ownerLead())).rejects.toThrow("the saved lead was not returned");
  });

  it("fails when Supabase cannot be reached", async () => {
    const { store } = storeWith(() => {
      throw new TypeError("fetch failed");
    });
    await expect(store.insertLead(ownerLead())).rejects.toThrow(/fetch failed/);
  });

  it("looks for a recent lead by type, phone and time", async () => {
    const { store, requests } = storeWith(() => jsonReply([savedRow]));
    const found = await store.findRecentLead("owner", "+64211234567", "2026-11-15T00:00:00.000Z");
    expect(found?.id).toBe(savedRow.id);
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe("/rest/v1/leads");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      select: "*",
      lead_type: "eq.owner",
      phone: "eq.+64211234567",
      created_at: "gte.2026-11-15T00:00:00.000Z",
      order: "created_at.desc",
      limit: "1",
    });
  });

  it("lists leads newest first, with an optional type filter", async () => {
    const { store, requests } = storeWith(() => jsonReply([savedRow]));
    const leads = await store.listLeads({ leadType: "tradie", limit: 50 });
    expect(leads).toHaveLength(1);
    expect(Object.fromEntries(new URL(requests[0]!.url).searchParams)).toEqual({
      select: "*",
      order: "created_at.desc",
      limit: "50",
      lead_type: "eq.tradie",
    });
  });

  it("returns nothing for a lead that does not exist", async () => {
    const { store } = storeWith(() => jsonReply([]));
    expect(await store.getLead("11111111-1111-4111-8111-111111111111")).toBeNull();
  });

  it("counts leads and adds up paid deposits", async () => {
    const { store } = storeWith((request) => {
      if (request.method === "HEAD") {
        const owners = request.url.includes("eq.owner");
        return new Response(null, { status: 200, headers: { "content-range": owners ? "0-0/7" : "0-0/3" } });
      }
      return jsonReply([
        { deposit_amount: 4900, deposit_currency: "NZD" },
        { deposit_amount: 4900, deposit_currency: "NZD" },
        { deposit_amount: 5900, deposit_currency: "AUD" },
      ]);
    });
    expect(await store.countLeads()).toEqual({
      owners: 7,
      tradies: 3,
      depositsPaid: 3,
      depositTotals: [
        { currency: "NZD", cents: 9800 },
        { currency: "AUD", cents: 5900 },
      ],
    });
  });
});

describe("money movements go through the database's own functions", () => {
  it("records a paid deposit and returns the lead the first time", async () => {
    const paidRow = { ...savedRow, deposit_status: "paid" as const, deposit_amount: 4900, deposit_currency: "NZD", stripe_payment_intent_id: "pi_1" };
    const { store, requests } = storeWith(() => jsonReply([paidRow]));
    const lead = await store.recordDepositPaid({
      leadId: savedRow.id,
      stripeAccount: "NZ",
      checkoutSessionId: "cs_1",
      paymentIntentId: "pi_1",
      customerId: "cus_1",
      amount: 4900,
      currency: "nzd",
    });

    expect(requests[0]?.method).toBe("POST");
    expect(pathOf(requests[0]!)).toBe("/rest/v1/rpc/record_deposit_paid");
    expect(JSON.parse(requests[0]!.body)).toEqual({
      p_lead_id: savedRow.id,
      p_stripe_account: "NZ",
      p_checkout_session_id: "cs_1",
      p_payment_intent_id: "pi_1",
      p_customer_id: "cus_1",
      p_amount: 4900,
      p_currency: "nzd",
    });
    expect(lead).toMatchObject({ depositStatus: "paid", depositAmount: 4900, depositCurrency: "NZD", stripePaymentIntentId: "pi_1" });
  });

  it("returns nothing when the database says the payment was already recorded", async () => {
    const { store } = storeWith(() => jsonReply([]));
    const args = { leadId: savedRow.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" };
    expect(await store.recordDepositPaid(args)).toBeNull();
  });

  it("starts and refunds deposits through their own functions", async () => {
    const { store, requests } = storeWith(() => jsonReply([savedRow]));
    await store.markDepositStarted({ leadId: savedRow.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", amount: 4900, currency: "NZD" });
    await store.recordDepositRefunded({ paymentIntentId: "pi_1", amountRefunded: 4900, fullyRefunded: true, eventId: "evt_1" });
    expect(requests.map(pathOf)).toEqual(["/rest/v1/rpc/mark_deposit_started", "/rest/v1/rpc/record_deposit_refunded"]);
    expect(JSON.parse(requests[1]!.body)).toEqual({ p_payment_intent_id: "pi_1", p_amount_refunded: 4900, p_fully_refunded: true, p_event_id: "evt_1" });
  });

  it("raises an error if a money function fails, so Stripe is asked to try again", async () => {
    const { store } = storeWith(() => jsonReply({ code: "42883", message: "function public.record_deposit_paid does not exist" }, 404));
    const args = { leadId: savedRow.id, stripeAccount: "NZ", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", customerId: null, amount: 4900, currency: "nzd" };
    await expect(store.recordDepositPaid(args)).rejects.toThrow(/recording a paid deposit/);
  });

  it("writes an audit entry once per dedupe key", async () => {
    const replies = [jsonReply([{ id: 1 }], 201), jsonReply([], 201)];
    const { store, requests } = storeWith(() => replies.shift()!);
    const entry = { actor: "stripe", action: "deposit.duplicate_payment", entity: "lead", entityId: "x", amount: 4900, currency: "NZD", dedupeKey: "duplicate:cs_2" };
    expect(await store.audit(entry)).toBe(true);
    expect(await store.audit(entry)).toBe(false);
    expect(pathOf(requests[0]!)).toBe("/rest/v1/audit_log?on_conflict=dedupe_key&select=id");
    expect(requests[0]?.headers.prefer).toContain("resolution=ignore-duplicates");
    expect(JSON.parse(requests[0]!.body)).toMatchObject({ actor: "stripe", amount: 4900, currency: "NZD", dedupe_key: "duplicate:cs_2", entity_id: "x" });
  });

  it("asks the database to count rate-limit hits", async () => {
    const replies = [jsonReply(true), jsonReply(false)];
    const { store, requests } = storeWith(() => replies.shift()!);
    expect(await store.rateLimitHit("lead:abc", 600, 6)).toBe(true);
    expect(await store.rateLimitHit("lead:abc", 600, 6)).toBe(false);
    expect(pathOf(requests[0]!)).toBe("/rest/v1/rpc/rate_limit_hit");
    expect(JSON.parse(requests[0]!.body)).toEqual({ p_key: "lead:abc", p_window_seconds: 600, p_max_hits: 6 });
  });
});

describe("the health check explains what is wrong in plain words", () => {
  it("is happy when the leads table answers", async () => {
    const { store } = storeWith(() => jsonReply([]));
    expect(await store.health()).toEqual({ ok: true, detail: "Connected, and the tables are in place." });
  });

  it("spots that the SQL file has not been run yet", async () => {
    const { store } = storeWith(() =>
      jsonReply({ code: "PGRST205", message: "Could not find the table 'public.leads' in the schema cache", details: null, hint: null }, 404),
    );
    const health = await store.health();
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("the tables are missing");
    expect(health.detail).toContain("SETUP.md step 2");
  });

  it("spots a rejected key", async () => {
    const { store } = storeWith(() => jsonReply({ message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." }, 401));
    const health = await store.health();
    expect(health).toEqual({ ok: false, detail: "Supabase rejected the key. Check SUPABASE_SECRET_KEY is the secret key for this project." });
  });

  it("spots a wrong address", async () => {
    const { store } = storeWith(() => {
      throw new TypeError("fetch failed");
    });
    const health = await store.health();
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("Check SUPABASE_URL");
  });
});

describe("column names", () => {
  it("every field of a lead maps to a database column and back", () => {
    const lead: Lead = rowToLead({ ...savedRow, lead_type: "tradie", trade: "plumber", licence_number: "PGDB 1", days_available: ["mon", "tue"] });
    // No field may come back undefined: that would mean a column was missed.
    for (const [field, value] of Object.entries(lead)) {
      expect(value, `lead.${field}`).not.toBeUndefined();
    }
    expect(Object.keys(lead)).toHaveLength(Object.keys(savedRow).length);
    expect(lead).toMatchObject({ leadType: "tradie", trade: "plumber", licenceNumber: "PGDB 1", daysAvailable: ["mon", "tue"], landingPath: "/owners" });
  });
});
