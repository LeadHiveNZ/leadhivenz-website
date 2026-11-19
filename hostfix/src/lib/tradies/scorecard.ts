import { findTrade } from "@config/trades";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { listSlots } from "./service";

/**
 * TRADIE SCORECARDS, over the last 30 days:
 *
 *   on time     of the jobs they accepted, how many they reached by the end of
 *               the window they chose (or the promised time, with no window)
 *   offers      how many they were sent and took, shown for interest only
 *
 * Passing on an offer, or letting one run out, NEVER counts against a tradie
 * (DECISIONS.md, 2026-11-18): it protects their standing as a contractor who
 * chooses their own work. Only the on-time number can put a tradie below the
 * target. Below 80% on it, the admin is prompted to swap first choice and
 * backup. A tradie needs a few jobs before it means anything, so nobody is
 * flagged on one bad afternoon. The network order (90% of the last 20
 * arrivals) is worked out separately, in reliability.ts.
 */

export const SCORE_DAYS = 30;
export const TARGET = 0.8;
export const MIN_JOBS = 3;

export type Scorecard = {
  tradieId: string;
  businessName: string;
  offers: number;
  accepted: number;
  jobs: number;
  onTime: number;
  onTimeRate: number | null;
  /** True when there is enough history and the on-time number is under the target. Offers never count. */
  belowTarget: boolean;
  /** Average minutes from offer to accept. */
  avgMinutesToAccept: number | null;
};

export async function scorecards(db: Db, market: string): Promise<Scorecard[]> {
  const at = now();
  const since = addHours(at, -24 * SCORE_DAYS).toISOString();
  const rows = await db.query<{
    id: string; business_name: string; offers: number; accepted: number; avg_minutes: number | null; jobs: number; on_time: number;
  }>(
    `select t.id, t.business_name,
            coalesce(o.offers, 0) as offers, coalesce(o.accepted, 0) as accepted, o.avg_minutes,
            coalesce(j.jobs, 0) as jobs, coalesce(j.on_time, 0) as on_time
       from public.tradies t
       left join lateral (
         select count(*) filter (where status in ('accepted', 'passed', 'expired')) as offers,
                count(*) filter (where status = 'accepted') as accepted,
                avg(extract(epoch from (responded_at - sent_at)) / 60) filter (where status = 'accepted') as avg_minutes
           from public.offers
          where tradie_id = t.id and sent_at >= $2::timestamptz and stage < 4
       ) o on true
       left join lateral (
         select count(*) filter (where arrived_at is not null or (respond_by <= $3::timestamptz and status <> 'cancelled')) as jobs,
                count(*) filter (where arrived_at is not null and arrived_at <= coalesce(arrival_window_end, respond_by)) as on_time
           from public.jobs
          where tradie_id = t.id and accepted_at >= $2::timestamptz
       ) j on true
      where t.market = $1 and t.status in ('approved', 'paused')
      order by t.business_name`,
    [market, since, at.toISOString()],
  );
  return rows.map((row) => {
    const offers = Number(row.offers);
    const accepted = Number(row.accepted);
    const jobs = Number(row.jobs);
    const onTime = Number(row.on_time);
    const onTimeRate = jobs > 0 ? onTime / jobs : null;
    return {
      tradieId: row.id, businessName: row.business_name, offers, accepted, jobs, onTime, onTimeRate,
      belowTarget: jobs >= MIN_JOBS && onTimeRate !== null && onTimeRate < TARGET,
      avgMinutesToAccept: row.avg_minutes === null ? null : Math.round(Number(row.avg_minutes)),
    };
  });
}

export type SwapPrompt = {
  trade: string;
  tradeLabel: string;
  firstChoice: Scorecard;
  backup: Scorecard | null;
  reason: string;
};

const pct = (rate: number | null) => (rate === null ? "no history" : `${Math.round(rate * 100)}%`);

/** For each trade whose first choice has slipped under 80%: the prompt shown to the admin. */
export async function swapPrompts(db: Db, market: string): Promise<SwapPrompt[]> {
  const cards = new Map((await scorecards(db, market)).map((card) => [card.tradieId, card]));
  const slots = await listSlots(db, market);
  const prompts: SwapPrompt[] = [];
  for (const first of slots.filter((slot) => slot.rank === 1)) {
    const card = cards.get(first.tradieId);
    if (!card?.belowTarget) continue;
    const backupSlot = slots.find((slot) => slot.trade === first.trade && slot.rank === 2);
    const backup = backupSlot ? (cards.get(backupSlot.tradieId) ?? null) : null;
    prompts.push({
      trade: first.trade,
      tradeLabel: findTrade(first.trade)?.label ?? first.trade,
      firstChoice: card,
      backup,
      reason: `${card.businessName} was on time for ${pct(card.onTimeRate)} of the jobs they accepted in the last ${SCORE_DAYS} days. The target is ${Math.round(TARGET * 100)}%. Passing on offers is never counted.${backup ? ` ${backup.businessName} (backup): ${pct(backup.onTimeRate)} on time.` : " There is no backup to swap with yet."}`,
    });
  }
  return prompts;
}
