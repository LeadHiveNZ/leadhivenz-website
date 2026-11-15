import { migrationsDir, migrationStatus } from "@/lib/db/migrate-core";
import type { Db } from "@/lib/db/types";
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
 * THE LEADS STORE. Plain SQL against the one database layer (src/lib/db), so
 * the live site, demo mode and the tests all run exactly the same statements.
 * Tables and functions come from the files in supabase/migrations.
 */

type LeadRow = {
  id: string;
  created_at: Date;
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
  deposit_paid_at: Date | null;
  deposit_refunded_at: Date | null;
  converted_at: Date | null;
  invited_at: Date | null;
};

const iso = (value: Date | string | null): string | null =>
  value === null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    createdAt: iso(row.created_at)!,
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
    depositPaidAt: iso(row.deposit_paid_at),
    depositRefundedAt: iso(row.deposit_refunded_at),
    convertedAt: iso(row.converted_at),
    invitedAt: iso(row.invited_at),
  };
}

export class SqlLeadStore implements LeadStore {
  constructor(
    private readonly open: () => Promise<Db>,
    readonly kind: "postgres" | "demo",
  ) {}

  async insertLead(lead: NewLead): Promise<Lead> {
    const db = await this.open();
    const rows = await db.query<LeadRow>(
      `insert into public.leads (
         lead_type, market, name, phone, email, property_count, managed_by, owner_location,
         trade, licence_number, days_available, source, utm_source, utm_medium, utm_campaign,
         utm_content, utm_term, fbclid, gclid, ref_code, referrer, landing_path
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       returning *`,
      [
        lead.leadType, lead.market, lead.name, lead.phone, lead.email, lead.propertyCount, lead.managedBy,
        lead.ownerLocation, lead.trade, lead.licenceNumber, lead.daysAvailable, lead.source, lead.utmSource,
        lead.utmMedium, lead.utmCampaign, lead.utmContent, lead.utmTerm, lead.fbclid, lead.gclid, lead.refCode,
        lead.referrer, lead.landingPath,
      ],
    );
    const row = rows[0];
    // A save that hands nothing back must never be reported as saved.
    if (!row?.id) throw new Error("Database problem while saving the lead: the saved lead was not returned.");
    return rowToLead(row);
  }

  async findRecentLead(leadType: LeadType, phone: string, sinceIso: string): Promise<Lead | null> {
    const db = await this.open();
    const rows = await db.query<LeadRow>(
      `select * from public.leads
        where lead_type = $1 and phone = $2 and created_at >= $3::timestamptz
        order by created_at desc limit 1`,
      [leadType, phone, sinceIso],
    );
    return rows[0] ? rowToLead(rows[0]) : null;
  }

  async getLead(id: string): Promise<Lead | null> {
    const db = await this.open();
    const rows = await db.query<LeadRow>("select * from public.leads where id = $1::uuid", [id]);
    return rows[0] ? rowToLead(rows[0]) : null;
  }

  async listLeads(options: { leadType?: LeadType; limit: number }): Promise<Lead[]> {
    const db = await this.open();
    const rows = await db.query<LeadRow>(
      `select * from public.leads
        where ($1::text is null or lead_type = $1)
        order by created_at desc limit $2`,
      [options.leadType ?? null, options.limit],
    );
    return rows.map(rowToLead);
  }

  async countLeads(): Promise<LeadCounts> {
    const db = await this.open();
    // One after the other: a single database connection handles one statement at a time.
    const counts = await db.query<{ owners: number; tradies: number; paid: number }>(
      `select count(*) filter (where lead_type = 'owner') as owners,
              count(*) filter (where lead_type = 'tradie') as tradies,
              count(*) filter (where deposit_status in ('paid', 'credited')) as paid
         from public.leads`,
    );
    const totals = await db.query<{ currency: string; cents: number }>(
      `select deposit_currency as currency, sum(deposit_amount) as cents
         from public.leads
        where deposit_status in ('paid', 'credited') and deposit_currency is not null
        group by deposit_currency order by deposit_currency`,
    );
    const row = counts[0] ?? { owners: 0, tradies: 0, paid: 0 };
    return {
      owners: Number(row.owners),
      tradies: Number(row.tradies),
      depositsPaid: Number(row.paid),
      depositTotals: totals.map((t) => ({ currency: t.currency, cents: Number(t.cents) })),
    };
  }

  private async leadFunction(sql: string, params: unknown[]): Promise<Lead | null> {
    const db = await this.open();
    const rows = await db.query<LeadRow>(sql, params);
    return rows[0]?.id ? rowToLead(rows[0]) : null;
  }

  markDepositStarted(args: DepositStartedArgs): Promise<Lead | null> {
    return this.leadFunction("select * from public.mark_deposit_started($1::uuid, $2, $3, $4, $5)", [
      args.leadId, args.stripeAccount, args.checkoutSessionId, args.amount, args.currency,
    ]);
  }

  recordDepositPaid(args: DepositPaidArgs): Promise<Lead | null> {
    return this.leadFunction("select * from public.record_deposit_paid($1::uuid, $2, $3, $4, $5, $6, $7)", [
      args.leadId, args.stripeAccount, args.checkoutSessionId, args.paymentIntentId, args.customerId, args.amount,
      args.currency,
    ]);
  }

  recordDepositRefunded(args: DepositRefundedArgs): Promise<Lead | null> {
    return this.leadFunction("select * from public.record_deposit_refunded($1, $2, $3, $4)", [
      args.paymentIntentId, args.amountRefunded, args.fullyRefunded, args.eventId,
    ]);
  }

  async logNotification(record: NotificationRecord): Promise<void> {
    const db = await this.open();
    await db.query(
      `insert into public.notifications (channel, template, recipient, status, provider, provider_message_id, error, lead_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8::uuid)`,
      [
        record.channel, record.template, record.recipient, record.status, record.provider ?? null,
        record.providerMessageId ?? null, record.error ? record.error.slice(0, 500) : null, record.leadId ?? null,
      ],
    );
  }

  async listNotifications(leadIds: string[]): Promise<StoredNotification[]> {
    if (leadIds.length === 0) return [];
    const db = await this.open();
    const rows = await db.query<{
      created_at: Date; channel: "sms" | "email"; template: string; recipient: string;
      status: StoredNotification["status"]; provider: string | null; provider_message_id: string | null;
      error: string | null; lead_id: string | null;
    }>(
      `select created_at, channel, template, recipient, status, provider, provider_message_id, error, lead_id
         from public.notifications
        where lead_id = any($1::uuid[])
        order by created_at desc limit 2000`,
      [leadIds],
    );
    return rows.map((row) => ({
      createdAt: iso(row.created_at)!,
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
    const db = await this.open();
    return writeAudit(db, entry);
  }

  async auditEntries(): Promise<(AuditEntry & { at: string })[]> {
    const db = await this.open();
    return listAudit(db);
  }

  async rateLimitHit(key: string, windowSeconds: number, maxHits: number): Promise<boolean> {
    const db = await this.open();
    const rows = await db.query<{ ok: boolean }>("select public.rate_limit_hit($1, $2, $3) as ok", [
      key, windowSeconds, maxHits,
    ]);
    return rows[0]?.ok === true;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const db = await this.open();
      await db.query("select 1 from public.leads limit 1");
      const status = await migrationStatus(db, migrationsDir());
      if (!status.upToDate) {
        return {
          ok: false,
          detail: "Connected, but the database is behind the code. Redeploy the site: the build brings the database up to date.",
        };
      }
      return { ok: true, detail: "Connected and up to date." };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (/relation .* does not exist/i.test(reason)) {
        return { ok: false, detail: "Connected, but the tables are missing. Redeploy the site: the build creates them." };
      }
      return { ok: false, detail: `Cannot reach the database: ${reason}` };
    }
  }
}

/**
 * Writes one audit entry. Returns false when an entry with the same dedupe key
 * already existed, which is how a repeated event is spotted.
 */
export async function writeAudit(db: Db, entry: AuditEntry): Promise<boolean> {
  const rows = await db.query(
    `insert into public.audit_log (actor, action, entity, entity_id, amount, currency, detail, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     on conflict (dedupe_key) do nothing
     returning id`,
    [
      entry.actor, entry.action, entry.entity, entry.entityId ?? null, entry.amount ?? null,
      entry.currency ? entry.currency.toUpperCase() : null, JSON.stringify(entry.detail ?? {}), entry.dedupeKey ?? null,
    ],
  );
  return rows.length > 0;
}

export async function listAudit(
  db: Db,
  filter: { entity?: string; entityId?: string; limit?: number } = {},
): Promise<(AuditEntry & { at: string })[]> {
  const rows = await db.query<{
    at: Date; actor: string; action: string; entity: string; entity_id: string | null; amount: number | null;
    currency: string | null; detail: Record<string, unknown>; dedupe_key: string | null;
  }>(
    `select at, actor, action, entity, entity_id, amount, currency, detail, dedupe_key
       from public.audit_log
      where ($1::text is null or entity = $1) and ($2::text is null or entity_id = $2)
      order by id asc limit $3`,
    [filter.entity ?? null, filter.entityId ?? null, filter.limit ?? 5000],
  );
  return rows.map((row) => ({
    at: iso(row.at)!,
    actor: row.actor,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    amount: row.amount,
    currency: row.currency,
    detail: row.detail,
    dedupeKey: row.dedupe_key,
  }));
}
