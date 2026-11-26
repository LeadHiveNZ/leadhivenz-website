import type { Db } from "@/lib/db/types";
import type { Tier } from "@/lib/markets/store";
import type { Property } from "@/lib/properties/service";
import { monthBounds, monthKey } from "@/lib/time";

/**
 * Whether a membership covers the urgent surcharge on a job logged now. Only urgent: an emergency is always a paid
 * extra (DECISIONS.md, 2026-11-26, second entry). Kept apart from create.ts so the cascade can use it too.
 */

/** How many included urgent call-outs this property has already used this calendar month. */
async function includedUrgentUsed(db: Db, propertyId: string, month: string, timeZone: string): Promise<number> {
  const { start, end } = monthBounds(month, timeZone);
  const rows = await db.query<{ count: number }>(
    `select count(*) as count
       from public.jobs j
      where j.property_id = $1::uuid and j.status <> 'cancelled'
        and j.created_at >= $2::timestamptz and j.created_at < $3::timestamptz
        and exists (select 1 from public.job_lines l where l.job_id = j.id and l.kind = 'urgent' and l.owner_cents = 0 and l.status = 'active')`,
    [propertyId, start.toISOString(), end.toISOString()],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Whether the owner's tier covers the urgent surcharge for a job logged now. */
export async function urgentIsIncluded(db: Db, property: Pick<Property, "id">, tier: Tier | null, timeZone: string, at: Date): Promise<boolean> {
  if (!tier?.urgentIncluded) return false;
  if (tier.urgentIncludedPerMonth === null) return true;
  return (await includedUrgentUsed(db, property.id, monthKey(at, timeZone), timeZone)) < tier.urgentIncludedPerMonth;
}
