import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * WHY A TRADIE'S PAYMENT IS HELD, AND LETTING IT GO.
 *
 * A finished job's payout is `held` while any of these is still open:
 *
 *   job_check        the app could not confirm the job and the owner, the
 *                    timer or the team has not decided yet (DECISIONS.md,
 *                    2026-11-19, src/lib/jobs/confirm.ts)
 *   receipt_missing  an off-list part's receipt is still to come
 *                    (DECISIONS.md, 2026-11-20, src/lib/jobs/parts.ts), or one
 *                    our team asked for as a spot check (2026-11-23)
 *   receipt_check    a receipt the checks flagged, waiting for the team
 *   not_described    the tradie said "not the job described" and the owner
 *                    may still object, or the team has not decided yet
 *                    (DECISIONS.md, 2026-11-20, third entry, src/lib/jobs/not-described.ts)
 *
 * When the last one closes, the payout is due at its usual time (the
 * market's hold after the job) or now if that has passed, and only once the
 * owner's card has been charged or not (the tradie never waits for it). A dispute pauses a payout separately
 * (`paused`), in billing/settle.ts.
 */

export type HoldReason = "job_check" | "receipt_missing" | "receipt_check" | "not_described";

export async function holdReasons(db: Db, jobId: string): Promise<HoldReason[]> {
  const reasons: HoldReason[] = [];
  const job = await db.query<{ confirm_status: string | null; not_described_status: string | null }>("select confirm_status, not_described_status from public.jobs where id = $1::uuid", [jobId]);
  if (["waiting", "staff_queue", "staff_held"].includes(job[0]?.confirm_status ?? "")) reasons.push("job_check");
  if (["waiting", "owner_objects"].includes(job[0]?.not_described_status ?? "")) reasons.push("not_described");
  const parts = await db.query<{ missing: boolean; checking: boolean }>(
    `select bool_or(receipt_status in ('needed', 'to_follow', 'requested', 'refunding')) as missing,
            bool_or(check_status in ('flagged', 'held')) as checking
       from public.job_parts where job_id = $1::uuid and status = 'active'`,
    [jobId],
  );
  if (parts[0]?.missing) reasons.push("receipt_missing");
  if (parts[0]?.checking) reasons.push("receipt_check");
  return reasons;
}

/** Holds a payout that has not gone yet. Returns true when it was moved to held. */
export async function holdPayout(db: Db, jobId: string): Promise<boolean> {
  const rows = await db.query("update public.payouts set status = 'held' where job_id = $1::uuid and status in ('waiting', 'scheduled') returning id", [jobId]);
  return rows.length > 0;
}

/**
 * Lets a held payout go when nothing is holding it any more. Returns the
 * amount released, or 0 when it is still held (or was not held).
 */
export async function releaseIfClear(db: Db, jobId: string): Promise<number> {
  if ((await holdReasons(db, jobId)).length > 0) return 0;
  // Scheduled whatever the owner's card has done: the tradie never waits for it (DECISIONS.md, 2026-11-20, second entry).
  const rows = await db.query<{ amount_cents: number }>(
    `update public.payouts set status = 'scheduled', release_at = greatest(release_at, $2::timestamptz)
      where job_id = $1::uuid and status = 'held' returning amount_cents`,
    [jobId, now().toISOString()],
  );
  return rows[0] ? Number(rows[0].amount_cents) : 0;
}
