import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * THE AUDIT LOG. Every job state change and every cent that moves is written
 * here, in the same database step as the change itself. Rows can be added but
 * never changed or removed (the database enforces that).
 */

export type AuditInput = {
  /** Who did it: "owner:<id>", "tradie:<id>", "staff:<id>", "admin", "system", "stripe", "report:<property id>". */
  actor: string;
  /** What happened: "job.accepted", "payment.succeeded", ... */
  action: string;
  entity: string;
  entityId?: string | null;
  /** Cents, for money movements. */
  amount?: number | null;
  currency?: string | null;
  detail?: Record<string, unknown>;
  /** An entry with the same key is only ever stored once. */
  dedupeKey?: string | null;
};

/** Writes one entry. Returns false when an entry with the same dedupe key already existed. */
export async function audit(db: Db, entry: AuditInput): Promise<boolean> {
  const rows = await db.query(
    `insert into public.audit_log (at, actor, action, entity, entity_id, amount, currency, detail, dedupe_key)
     values ($1::timestamptz, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     on conflict (dedupe_key) do nothing
     returning id`,
    [
      now().toISOString(), entry.actor, entry.action, entry.entity, entry.entityId ?? null, entry.amount ?? null,
      entry.currency ? entry.currency.toUpperCase() : null, JSON.stringify(entry.detail ?? {}), entry.dedupeKey ?? null,
    ],
  );
  return rows.length > 0;
}

export type AuditRow = {
  id: number;
  at: Date;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  amount: number | null;
  currency: string | null;
  detail: Record<string, unknown>;
};

export async function auditTrail(db: Db, filter: { entity?: string; entityId?: string; limit?: number; newestFirst?: boolean } = {}): Promise<AuditRow[]> {
  const rows = await db.query<{
    id: number; at: Date; actor: string; action: string; entity: string; entity_id: string | null;
    amount: number | null; currency: string | null; detail: Record<string, unknown>;
  }>(
    `select id, at, actor, action, entity, entity_id, amount, currency, detail
       from public.audit_log
      where ($1::text is null or entity = $1) and ($2::text is null or entity_id = $2)
      order by at ${filter.newestFirst ? "desc" : "asc"}, id ${filter.newestFirst ? "desc" : "asc"} limit $3`,
    [filter.entity ?? null, filter.entityId ?? null, filter.limit ?? 500],
  );
  return rows.map((row) => ({
    id: Number(row.id), at: new Date(row.at), actor: row.actor, action: row.action, entity: row.entity,
    entityId: row.entity_id, amount: row.amount, currency: row.currency, detail: row.detail ?? {},
  }));
}
