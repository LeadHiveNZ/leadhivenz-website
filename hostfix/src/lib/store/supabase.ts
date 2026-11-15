import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEntry,
  DepositPaidArgs,
  DepositRefundedArgs,
  DepositStartedArgs,
  Lead,
  LeadCounts,
  LeadStore,
  LeadType,
  NewLead,
  NotificationRecord,
  StoredNotification,
} from "./types";

/**
 * SUPABASE STORE
 * Talks to the real database using the SECRET key, which only ever lives on
 * the server. Tables and functions are created by the SQL file in
 * supabase/migrations.
 */

export type SupabaseSettings = { url: string; secretKey: string };

type FetchLike = typeof fetch;

/** A row of the `leads` table, exactly as the database names the columns. */
type LeadRow = {
  id: string;
  created_at: string;
  lead_type: LeadType;
  market: string;
  name: string;
  phone: string;
  email: string | null;
  property_count: number | null;
  managed_by: string | null;
  owner_location: string | null;
  trade: string | null;
  licence_number: string | null;
  days_available: string[] | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  ref_code: string | null;
  referrer: string | null;
  landing_path: string | null;
  deposit_status: Lead["depositStatus"];
  deposit_amount: number | null;
  deposit_currency: string | null;
  stripe_account: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  deposit_paid_at: string | null;
  deposit_refunded_at: string | null;
};

export function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    createdAt: row.created_at,
    leadType: row.lead_type,
    market: row.market,
    name: row.name,
    phone: row.phone,
    email: row.email,
    propertyCount: row.property_count,
    managedBy: row.managed_by,
    ownerLocation: row.owner_location,
    trade: row.trade,
    licenceNumber: row.licence_number,
    daysAvailable: row.days_available,
    source: row.source,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmContent: row.utm_content,
    utmTerm: row.utm_term,
    fbclid: row.fbclid,
    gclid: row.gclid,
    refCode: row.ref_code,
    referrer: row.referrer,
    landingPath: row.landing_path,
    depositStatus: row.deposit_status,
    depositAmount: row.deposit_amount,
    depositCurrency: row.deposit_currency,
    stripeAccount: row.stripe_account,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeCustomerId: row.stripe_customer_id,
    depositPaidAt: row.deposit_paid_at,
    depositRefundedAt: row.deposit_refunded_at,
  };
}

export function newLeadToRow(lead: NewLead) {
  return {
    lead_type: lead.leadType,
    market: lead.market,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    property_count: lead.propertyCount,
    managed_by: lead.managedBy,
    owner_location: lead.ownerLocation,
    trade: lead.trade,
    licence_number: lead.licenceNumber,
    days_available: lead.daysAvailable,
    source: lead.source,
    utm_source: lead.utmSource,
    utm_medium: lead.utmMedium,
    utm_campaign: lead.utmCampaign,
    utm_content: lead.utmContent,
    utm_term: lead.utmTerm,
    fbclid: lead.fbclid,
    gclid: lead.gclid,
    ref_code: lead.refCode,
    referrer: lead.referrer,
    landing_path: lead.landingPath,
  };
}

type DbError = { message: string; code?: string; details?: string | null; hint?: string | null };

function fail(what: string, error: DbError): never {
  const code = error.code ? ` [${error.code}]` : "";
  throw new Error(`Database problem while ${what}${code}: ${error.message}`);
}

/** How long any one database request may take before we give up. */
const REQUEST_TIMEOUT_MS = 8_000;
/**
 * The two quick checks made before a lead is saved (rate limit, repeat lead)
 * get much less time. If the database is struggling, a visitor must not be
 * left waiting on checks that are only nice-to-have.
 */
const QUICK_CHECK_TIMEOUT_MS = 3_000;

export class SupabaseStore implements LeadStore {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(settings: SupabaseSettings, fetchImpl: FetchLike = fetch) {
    this.db = createClient(settings.url, settings.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        // Give up after ten seconds instead of leaving a visitor waiting.
        fetch: (input, init) =>
          fetchImpl(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
      },
    });
  }

  async insertLead(lead: NewLead): Promise<Lead> {
    const { data, error } = await this.db.from("leads").insert(newLeadToRow(lead)).select().single();
    if (error) fail("saving a lead", error);
    const row = data as LeadRow | null;
    // Never report a lead as saved unless the database handed the saved row back.
    if (!row || typeof row.id !== "string" || row.id === "") {
      throw new Error("Database problem while saving a lead: the saved lead was not returned.");
    }
    return rowToLead(row);
  }

  async findRecentLead(leadType: LeadType, phone: string, sinceIso: string): Promise<Lead | null> {
    const { data, error } = await this.db
      .from("leads")
      .select()
      .eq("lead_type", leadType)
      .eq("phone", phone)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      // The client library retries failed reads for several seconds. Not here.
      .retry(false)
      .abortSignal(AbortSignal.timeout(QUICK_CHECK_TIMEOUT_MS));
    if (error) fail("checking for a repeat lead", error);
    const row = (data as LeadRow[] | null)?.[0];
    return row ? rowToLead(row) : null;
  }

  async getLead(id: string): Promise<Lead | null> {
    const { data, error } = await this.db.from("leads").select().eq("id", id).maybeSingle();
    if (error) fail("loading a lead", error);
    return data ? rowToLead(data as LeadRow) : null;
  }

  async listLeads(options: { leadType?: LeadType; limit: number }): Promise<Lead[]> {
    let query = this.db.from("leads").select().order("created_at", { ascending: false }).limit(options.limit);
    if (options.leadType) query = query.eq("lead_type", options.leadType);
    const { data, error } = await query;
    if (error) fail("loading the leads list", error);
    return ((data as LeadRow[] | null) ?? []).map(rowToLead);
  }

  async countLeads(): Promise<LeadCounts> {
    const count = async (leadType: LeadType): Promise<number> => {
      const { count: total, error } = await this.db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("lead_type", leadType);
      if (error) fail("counting leads", error);
      return total ?? 0;
    };
    const paid = async () => {
      const { data, error } = await this.db
        .from("leads")
        .select("deposit_amount, deposit_currency")
        .eq("deposit_status", "paid");
      if (error) fail("adding up deposits", error);
      return (data as { deposit_amount: number | null; deposit_currency: string | null }[] | null) ?? [];
    };

    const [owners, tradies, deposits] = await Promise.all([count("owner"), count("tradie"), paid()]);
    const totals = new Map<string, number>();
    let depositsPaid = 0;
    for (const row of deposits) {
      if (!row.deposit_amount || !row.deposit_currency) continue;
      depositsPaid += 1;
      totals.set(row.deposit_currency, (totals.get(row.deposit_currency) ?? 0) + row.deposit_amount);
    }
    return {
      owners,
      tradies,
      depositsPaid,
      depositTotals: [...totals].map(([currency, cents]) => ({ currency, cents })),
    };
  }

  private async callLeadFunction(name: string, args: Record<string, unknown>, what: string): Promise<Lead | null> {
    const { data, error } = await this.db.rpc(name, args);
    if (error) fail(what, error);
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as LeadRow[];
    const row = rows[0];
    return row ? rowToLead(row) : null;
  }

  markDepositStarted(args: DepositStartedArgs): Promise<Lead | null> {
    return this.callLeadFunction(
      "mark_deposit_started",
      {
        p_lead_id: args.leadId,
        p_stripe_account: args.stripeAccount,
        p_checkout_session_id: args.checkoutSessionId,
        p_amount: args.amount,
        p_currency: args.currency,
      },
      "recording that a deposit was started",
    );
  }

  recordDepositPaid(args: DepositPaidArgs): Promise<Lead | null> {
    return this.callLeadFunction(
      "record_deposit_paid",
      {
        p_lead_id: args.leadId,
        p_stripe_account: args.stripeAccount,
        p_checkout_session_id: args.checkoutSessionId,
        p_payment_intent_id: args.paymentIntentId,
        p_customer_id: args.customerId,
        p_amount: args.amount,
        p_currency: args.currency,
      },
      "recording a paid deposit",
    );
  }

  recordDepositRefunded(args: DepositRefundedArgs): Promise<Lead | null> {
    return this.callLeadFunction(
      "record_deposit_refunded",
      {
        p_payment_intent_id: args.paymentIntentId,
        p_amount_refunded: args.amountRefunded,
        p_fully_refunded: args.fullyRefunded,
        p_event_id: args.eventId,
      },
      "recording a refunded deposit",
    );
  }

  async logNotification(record: NotificationRecord): Promise<void> {
    const { error } = await this.db.from("notifications").insert({
      channel: record.channel,
      template: record.template,
      recipient: record.recipient,
      status: record.status,
      provider: record.provider ?? null,
      provider_message_id: record.providerMessageId ?? null,
      error: record.error ? record.error.slice(0, 500) : null,
      lead_id: record.leadId ?? null,
    });
    if (error) fail("logging an alert", error);
  }

  async listNotifications(leadIds: string[]): Promise<StoredNotification[]> {
    if (leadIds.length === 0) return [];
    const { data, error } = await this.db
      .from("notifications")
      .select("created_at, channel, template, recipient, status, provider, provider_message_id, error, lead_id")
      .in("lead_id", leadIds);
    if (error) fail("loading alert history", error);
    type Row = {
      created_at: string;
      channel: StoredNotification["channel"];
      template: string;
      recipient: string;
      status: StoredNotification["status"];
      provider: string | null;
      provider_message_id: string | null;
      error: string | null;
      lead_id: string | null;
    };
    return ((data as Row[] | null) ?? []).map((row) => ({
      createdAt: row.created_at,
      channel: row.channel,
      template: row.template,
      recipient: row.recipient,
      status: row.status,
      provider: row.provider,
      providerMessageId: row.provider_message_id,
      error: row.error,
      leadId: row.lead_id,
    }));
  }

  async audit(entry: AuditEntry): Promise<boolean> {
    const row = {
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      amount: entry.amount ?? null,
      currency: entry.currency ?? null,
      detail: entry.detail ?? {},
      dedupe_key: entry.dedupeKey ?? null,
    };
    if (!entry.dedupeKey) {
      const { error } = await this.db.from("audit_log").insert(row);
      if (error) fail("writing to the audit log", error);
      return true;
    }
    const { data, error } = await this.db
      .from("audit_log")
      .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) fail("writing to the audit log", error);
    return Array.isArray(data) && data.length > 0;
  }

  async rateLimitHit(key: string, windowSeconds: number, maxHits: number): Promise<boolean> {
    const { data, error } = await this.db
      .rpc("rate_limit_hit", {
        p_key: key,
        p_window_seconds: windowSeconds,
        p_max_hits: maxHits,
      })
      .abortSignal(AbortSignal.timeout(QUICK_CHECK_TIMEOUT_MS));
    if (error) fail("checking the rate limit", error);
    return data === true;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const { error } = await this.db
        .from("leads")
        .select("id")
        .limit(1)
        .retry(false)
        .abortSignal(AbortSignal.timeout(5_000));
      if (!error) return { ok: true, detail: "Connected, and the tables are in place." };
      const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
      if (text.includes("pgrst205") || text.includes("42p01") || text.includes("could not find the table")) {
        return {
          ok: false,
          detail: "Connected, but the tables are missing. Run the SQL file from SETUP.md step 2 in the Supabase SQL Editor.",
        };
      }
      if (text.includes("api key") || text.includes("jwt") || text.includes("unauthorized") || text.includes("401")) {
        return { ok: false, detail: "Supabase rejected the key. Check SUPABASE_SECRET_KEY is the secret key for this project." };
      }
      if (text.includes("fetch failed") || text.includes("timeout") || text.includes("aborted") || text.includes("enotfound")) {
        return { ok: false, detail: `Could not reach Supabase. Check SUPABASE_URL. (${error.message})` };
      }
      return { ok: false, detail: `Supabase answered with an error: ${error.message}` };
    } catch (error) {
      return {
        ok: false,
        detail: `Could not reach Supabase. Check SUPABASE_URL. (${error instanceof Error ? error.message : "unknown error"})`,
      };
    }
  }
}
