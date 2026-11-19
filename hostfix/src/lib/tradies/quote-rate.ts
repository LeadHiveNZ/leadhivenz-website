import type { Db } from "@/lib/db/types";
import type { Job } from "@/lib/jobs/types";
import { raiseException } from "@/lib/ops/exceptions";

/**
 * QUOTE RATE (DECISIONS.md, 2026-11-20, third entry).
 *
 * Of the menu jobs a tradie accepted and arrived at, the share they turned
 * into a quote for work (not parts alone) or "not the job described", over
 * their last QUOTE_RATE_JOBS (from QUOTE_RATE_MIN_JOBS). Declines never count:
 * only jobs they took. A tradie is put in front of the team for a
 * conversation when their rate is over QUOTE_RATE_FLOOR (25%) AND over
 * QUOTE_RATE_MULTIPLE (2) times the market's average (the average of every
 * tradie in the market with enough jobs). Nothing changes on their account.
 */
export const QUOTE_RATE_JOBS = 20;
export const QUOTE_RATE_MIN_JOBS = 10;
export const QUOTE_RATE_FLOOR = 0.25;
export const QUOTE_RATE_MULTIPLE = 2;

export type QuoteRate = { jobs: number; quoted: number; rate: number | null };

const RECENT = `
  select j.id, j.tradie_id,
         (j.not_described_at is not null or exists (
            select 1 from public.quotes q where q.job_id = j.id and q.labour_cents > 0 and q.status <> 'withdrawn')) as quoted,
         row_number() over (partition by j.tradie_id order by j.accepted_at desc, j.id) as n
    from public.jobs j
   where j.off_menu = false and j.tradie_id is not null and j.accepted_at is not null and j.arrived_at is not null`;

function toRate(jobs: number, quoted: number): QuoteRate {
  return { jobs, quoted, rate: jobs >= QUOTE_RATE_MIN_JOBS ? quoted / jobs : null };
}

export async function quoteRate(db: Db, tradieId: string): Promise<QuoteRate> {
  const rows = await db.query<{ jobs: number; quoted: number }>(
    `select count(*) as jobs, count(*) filter (where quoted) as quoted from (${RECENT} and j.tradie_id = $1::uuid) recent where n <= $2`,
    [tradieId, QUOTE_RATE_JOBS],
  );
  return toRate(Number(rows[0]?.jobs ?? 0), Number(rows[0]?.quoted ?? 0));
}

/** The average quote rate of the tradies in a market with enough jobs to count. Null with none. */
export async function marketQuoteRate(db: Db, market: string): Promise<number | null> {
  const rows = await db.query<{ jobs: number; quoted: number }>(
    `select count(*) as jobs, count(*) filter (where quoted) as quoted
       from (${RECENT} and j.market = $1) recent where n <= $2 group by tradie_id having count(*) >= $3`,
    [market, QUOTE_RATE_JOBS, QUOTE_RATE_MIN_JOBS],
  );
  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + Number(row.quoted) / Number(row.jobs), 0) / rows.length;
}

export function quoteRateFlagged(rate: number | null, average: number | null): boolean {
  return rate !== null && average !== null && rate > QUOTE_RATE_FLOOR && rate > QUOTE_RATE_MULTIPLE * average;
}

/** After a quote on a menu job: puts the tradie in front of the team if their rate stands out. */
export async function noteQuoteRate(db: Db, job: Pick<Job, "offMenu" | "market">, tradieId: string): Promise<boolean> {
  if (job.offMenu) return false;
  const mine = await quoteRate(db, tradieId);
  const average = await marketQuoteRate(db, job.market);
  if (!quoteRateFlagged(mine.rate, average)) return false;
  const name = await db.query<{ business_name: string }>("select business_name from public.tradies where id = $1::uuid", [tradieId]);
  return raiseException(db, {
    kind: "quote_rate", market: job.market, tradieId,
    summary: `${name[0]?.business_name ?? "A tradie"} turned ${mine.quoted} of their last ${mine.jobs} menu jobs into a quote or "not the job described" (${Math.round(mine.rate! * 100)}%), against ${Math.round(average! * 100)}% across the market. Look at those jobs and talk to them. Nothing has been changed on their account.`,
    dedupeKey: `quote_rate:${tradieId}`,
  });
}

export type HoursRow = { jobType: string; mineAverage: number; mineCount: number; othersAverage: number | null; othersCount: number };

/**
 * Average hours quoted per job type, this tradie against everyone else in the
 * market (admin only). A job type is the menu job, or the trade for off-menu work.
 */
export async function hoursByJobType(db: Db, tradieId: string, market: string): Promise<HoursRow[]> {
  const rows = await db.query<{ job_type: string; mine_avg: number | null; mine_n: number; others_avg: number | null; others_n: number }>(
    `select coalesce(m.name, j.trade) as job_type,
            avg(q.hours) filter (where q.tradie_id = $1::uuid) as mine_avg,
            count(*) filter (where q.tradie_id = $1::uuid) as mine_n,
            avg(q.hours) filter (where q.tradie_id <> $1::uuid) as others_avg,
            count(*) filter (where q.tradie_id <> $1::uuid) as others_n
       from public.quotes q
       join public.jobs j on j.id = q.job_id
       left join public.menu_items m on m.id = j.menu_item_id
      where q.hours is not null and q.status in ('approved', 'auto_approved', 'pending') and j.market = $2
      group by 1
     having count(*) filter (where q.tradie_id = $1::uuid) > 0
      order by 1`,
    [tradieId, market],
  );
  return rows.map((row) => ({
    jobType: row.job_type, mineAverage: Number(row.mine_avg ?? 0), mineCount: Number(row.mine_n),
    othersAverage: row.others_avg === null ? null : Number(row.others_avg), othersCount: Number(row.others_n),
  }));
}
