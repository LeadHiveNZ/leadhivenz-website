import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * A TRADIE'S ON-TIME RECORD (DECISIONS.md, 2026-11-18).
 *
 * Only jobs the tradie ACCEPTED and ARRIVED at count. Passing on an offer, or
 * letting one run out, never counts against anyone, anywhere: a contractor
 * chooses their work, and that choice must cost them nothing.
 *
 *   network order   once a tradie has arrived at 10 or more jobs, and fewer
 *                   than 90% of their last 20 arrivals were on time, they are
 *                   offered network jobs after the tradies who are on time.
 *                   They still get the offers, in a later wave. A first choice
 *                   or backup for a trade is not moved by this.
 *   no-shows        an accepted job with nobody on site by its promised time.
 *                   3 in 90 days puts the tradie in front of the team to talk
 *                   to. Nobody is ever removed automatically.
 *
 * On time: arrived by the end of the window the tradie chose, or, with no
 * window chosen, by the promised time.
 */

export const ON_TIME_TARGET = 0.9;
export const MIN_ARRIVALS = 10;
export const RECENT_ARRIVALS = 20;
export const NO_SHOW_DAYS = 90;
export const NO_SHOW_REVIEW = 3;

export type OnTimeRecord = { arrivals: number; onTime: number };

/** True when the record puts the tradie in the later wave of network offers. */
export function laterWave(record: OnTimeRecord | undefined): boolean {
  if (!record || record.arrivals < MIN_ARRIVALS) return false;
  return record.onTime / record.arrivals < ON_TIME_TARGET;
}

/** Each tradie's last 20 arrivals and how many were on time. Tradies with none are left out. */
export async function onTimeRecords(db: Db, tradieIds: string[]): Promise<Map<string, OnTimeRecord>> {
  const records = new Map<string, OnTimeRecord>();
  if (tradieIds.length === 0) return records;
  const rows = await db.query<{ tradie_id: string; arrivals: number; on_time: number }>(
    `select tradie_id, count(*) as arrivals, count(*) filter (where on_time) as on_time
       from (
         select tradie_id,
                (coalesce(arrival_window_end, respond_by) is null or arrived_at <= coalesce(arrival_window_end, respond_by)) as on_time,
                row_number() over (partition by tradie_id order by arrived_at desc, id) as n
           from public.jobs
          where tradie_id = any($1::uuid[]) and arrived_at is not null
       ) recent
      where n <= $2
      group by tradie_id`,
    [tradieIds, RECENT_ARRIVALS],
  );
  for (const row of rows) records.set(row.tradie_id, { arrivals: Number(row.arrivals), onTime: Number(row.on_time) });
  return records;
}

/** How many accepted jobs this tradie was not on site for by the promised time, in the last 90 days. */
export async function recentNoShows(db: Db, tradieId: string, at: Date = now()): Promise<number> {
  const rows = await db.query<{ count: number }>(
    "select count(*) as count from public.jobs where tradie_id = $1::uuid and no_show_at is not null and no_show_at > $2::timestamptz",
    [tradieId, addHours(at, -24 * NO_SHOW_DAYS).toISOString()],
  );
  return Number(rows[0]?.count ?? 0);
}

/** True when the admin tradie page should flag this tradie for a conversation. */
export function needsReview(noShows: number): boolean {
  return noShows >= NO_SHOW_REVIEW;
}

/** No-shows in the last 90 days for every tradie in a market, for the admin's list. */
export async function noShowCounts(db: Db, market: string, at: Date = now()): Promise<Map<string, number>> {
  const rows = await db.query<{ tradie_id: string; count: number }>(
    `select tradie_id, count(*) as count from public.jobs
      where market = $1 and tradie_id is not null and no_show_at is not null and no_show_at > $2::timestamptz
      group by tradie_id`,
    [market, addHours(at, -24 * NO_SHOW_DAYS).toISOString()],
  );
  return new Map(rows.map((row) => [row.tradie_id, Number(row.count)]));
}

// ---------------------------------------------------------------------------
// FLAGGED JOBS AND TRUST (DECISIONS.md, 2026-11-19)
// ---------------------------------------------------------------------------
//
// A finished job is flagged when the checks in src/lib/jobs/checks.ts could
// not confirm it (location, photos, time on site). Only jobs the tradie
// accepted and finished can be flagged: passing on an offer, or letting one
// run out, never creates a flag.
//
//   trusted       10 or more finished jobs before this one, and no other
//                 flagged job in the last 90 days. When the owner does not
//                 answer about a flagged job, a trusted tradie is paid and
//                 the flag is only logged.
//   for review    3 or more flagged jobs in 90 days: flagged on the admin
//                 tradie page and in the queue, for a conversation. Nobody is
//                 removed automatically.

export const TRUSTED_FINISHED_JOBS = 10;
export const FLAG_DAYS = 90;
export const FLAG_REVIEW = 3;

export type Trust = { finishedJobs: number; otherFlags: number; trusted: boolean };

/** Whether this tradie is trusted, leaving out the job being decided. */
export async function tradieTrust(db: Db, tradieId: string, exceptJobId: string | null, at: Date = now()): Promise<Trust> {
  const rows = await db.query<{ finished: number; flagged: number }>(
    `select count(*) filter (where status = 'completed') as finished,
            count(*) filter (where cardinality(check_flags) > 0 and completed_at > $3::timestamptz) as flagged
       from public.jobs
      where tradie_id = $1::uuid and ($2::uuid is null or id <> $2::uuid)`,
    [tradieId, exceptJobId, addHours(at, -24 * FLAG_DAYS).toISOString()],
  );
  const finishedJobs = Number(rows[0]?.finished ?? 0);
  const otherFlags = Number(rows[0]?.flagged ?? 0);
  return { finishedJobs, otherFlags, trusted: isTrusted(finishedJobs, otherFlags) };
}

export function isTrusted(finishedJobs: number, otherFlags: number): boolean {
  return finishedJobs >= TRUSTED_FINISHED_JOBS && otherFlags === 0;
}

/** Flagged jobs for this tradie in the last 90 days, this one included. */
export async function recentFlags(db: Db, tradieId: string, at: Date = now()): Promise<number> {
  const rows = await db.query<{ count: number }>(
    "select count(*) as count from public.jobs where tradie_id = $1::uuid and cardinality(check_flags) > 0 and completed_at > $2::timestamptz",
    [tradieId, addHours(at, -24 * FLAG_DAYS).toISOString()],
  );
  return Number(rows[0]?.count ?? 0);
}

export function flagsNeedReview(flagged: number): boolean {
  return flagged >= FLAG_REVIEW;
}

/** Flagged jobs in the last 90 days for every tradie in a market, for the admin's list. */
export async function flagCounts(db: Db, market: string, at: Date = now()): Promise<Map<string, number>> {
  const rows = await db.query<{ tradie_id: string; count: number }>(
    `select tradie_id, count(*) as count from public.jobs
      where market = $1 and tradie_id is not null and cardinality(check_flags) > 0 and completed_at > $2::timestamptz
      group by tradie_id`,
    [market, addHours(at, -24 * FLAG_DAYS).toISOString()],
  );
  return new Map(rows.map((row) => [row.tradie_id, Number(row.count)]));
}
