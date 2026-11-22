import { addHours } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import type { Job } from "@/lib/jobs/types";
import { raiseException } from "./exceptions";

/**
 * PATTERN FLAGS (DECISIONS.md, 2026-11-23). Instead of trying to stop every job
 * being finished outside the app, two patterns go to the dispatcher's queue for
 * a person to look at. They never remove anyone, never change an account, and
 * are never counted as a decline. The words never accuse anyone: a pattern can
 * have ordinary reasons (a guest who fixed it, a change of plans).
 *
 *   the same pair   the same tradie and owner have 2 or more jobs in 90 days
 *                   that the tradie accepted and that ended without Job done:
 *                   cancelled after "On my way" (or after Arrived), or a no-show.
 *   one tradie      3 or more jobs a tradie accepted in 90 days were cancelled
 *                   after "On my way" (or after Arrived).
 */

export const PATTERN_DAYS = 90;
export const PATTERN_PAIR_JOBS = 2;
export const PATTERN_TRADIE_CANCELS = 3;

/** Jobs this tradie accepted for this owner that ended without Job done, in the last 90 days. */
export async function pairEndedWithoutDone(db: Db, tradieId: string, ownerId: string, at: Date): Promise<number> {
  const rows = await db.query<{ count: number }>(
    `select count(*) as count from public.jobs
      where tradie_id = $1::uuid and owner_id = $2::uuid and status <> 'completed'
        and ((status = 'cancelled' and (en_route_at is not null or arrived_at is not null)) or no_show_at is not null)
        and coalesce(cancelled_at, no_show_at) > $3::timestamptz`,
    [tradieId, ownerId, addHours(at, -24 * PATTERN_DAYS).toISOString()],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Jobs this tradie accepted that were cancelled after "On my way" (or after Arrived), in the last 90 days. */
export async function cancelledAfterOnMyWay(db: Db, tradieId: string, at: Date): Promise<number> {
  const rows = await db.query<{ count: number }>(
    `select count(*) as count from public.jobs
      where tradie_id = $1::uuid and status = 'cancelled' and (en_route_at is not null or arrived_at is not null)
        and cancelled_at > $2::timestamptz`,
    [tradieId, addHours(at, -24 * PATTERN_DAYS).toISOString()],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Looks at both patterns after a job a tradie accepted ended without Job done (a cancel after "On my way", or a
 * no-show), inside the same database step. Puts what it finds in the queue, once each until it is dealt with.
 */
export async function notePatterns(db: Db, job: Pick<Job, "id" | "market" | "tradieId" | "ownerId">, at: Date): Promise<{ pair: boolean; tradie: boolean }> {
  const found = { pair: false, tradie: false };
  if (!job.tradieId) return found;
  const names = (await db.query<{ tradie: string; owner: string }>(
    `select t.business_name as tradie, u.name as owner
       from public.tradies t, public.owners o join public.users u on u.id = o.user_id
      where t.id = $1::uuid and o.id = $2::uuid`,
    [job.tradieId, job.ownerId],
  ))[0];
  const tradie = names?.tradie ?? "A tradie";
  const owner = names?.owner ?? "an owner";
  const pair = await pairEndedWithoutDone(db, job.tradieId, job.ownerId, at);
  if (pair >= PATTERN_PAIR_JOBS) {
    found.pair = true;
    await raiseException(db, {
      kind: "pattern_pair", market: job.market, jobId: job.id, tradieId: job.tradieId,
      summary: `Worth a look: ${tradie} and ${owner} have had ${pair} jobs in the last ${PATTERN_DAYS} days that ${tradie} accepted and that ended without Job done (cancelled after On my way, or nobody on site by the promised time). There can be ordinary reasons. Nothing has changed on either account, and this is not counted as a decline.`,
      dedupeKey: `pattern_pair:${job.tradieId}:${job.ownerId}`,
    });
  }
  const cancels = await cancelledAfterOnMyWay(db, job.tradieId, at);
  if (cancels >= PATTERN_TRADIE_CANCELS) {
    found.tradie = true;
    await raiseException(db, {
      kind: "pattern_cancels", market: job.market, tradieId: job.tradieId,
      summary: `Worth a look: ${cancels} jobs ${tradie} accepted in the last ${PATTERN_DAYS} days were cancelled after they tapped On my way. There can be ordinary reasons. Nothing has changed on their account, and this is not counted as a decline.`,
      dedupeKey: `pattern_cancels:${job.tradieId}`,
    });
  }
  return found;
}
