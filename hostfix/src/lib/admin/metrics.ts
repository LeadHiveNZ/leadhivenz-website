import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * THE NUMBERS FOR ONE MARKET, for the admin dashboard. Everything is worked
 * out from the database when the page loads. Money is in cents.
 */

export const PERIOD_DAYS = 30;

export type MarketNumbers = {
  market: string;
  currency: string;
  /** Members right now. */
  properties: number;
  propertiesPastDue: number;
  propertiesSetup: number;
  newMembers: number;
  cancelled: number;
  /** Cancelled in the period as a share of members at its start. 0 to 1, or null with no history. */
  churnRate: number | null;
  /**
   * Monthly recurring revenue: the monthly price of every member property on
   * its own membership, plus each Portfolio retainer once (at the band it is
   * billed at), never once per property under it.
   */
  mrrCents: number;
  /** Portfolio accounts paying a retainer right now. */
  portfolios: number;
  /** In the last 30 days: */
  jobsLogged: number;
  jobsCompleted: number;
  jobsCancelled: number;
  jobsOpen: number;
  /** What owners were charged for completed jobs. */
  jobValueCents: number;
  averageJobCents: number | null;
  /** What the platform kept on those jobs. */
  platformCents: number;
  /** Urgent surcharges the platform paid on behalf of members whose tier includes them. */
  urgentAbsorbedCents: number;
  /** Minutes from a job going out to a tradie accepting it. */
  medianMinutesToAccept: number | null;
  /** Hours from a job going out to a tradie being on site. */
  medianHoursToArrive: number | null;
  onTimeRate: number | null;
  /** Promises missed, and what was credited for them. */
  misses: number;
  creditsCents: number;
  refundsCents: number;
  failedPayments: number;
  tradiesApproved: number;
  tradiesWaiting: number;
  openExceptions: number;
};

export async function marketNumbers(db: Db, market: string): Promise<MarketNumbers> {
  const at = now();
  const since = addHours(at, -24 * PERIOD_DAYS).toISOString();
  const nowIso = at.toISOString();

  const props = await db.query<{ currency: string; active: number; past_due: number; setup: number; new_members: number; cancelled: number; mrr: number; portfolios: number }>(
    `select m.currency,
            count(p.id) filter (where p.status = 'active') as active,
            count(p.id) filter (where p.status = 'past_due') as past_due,
            count(p.id) filter (where p.status = 'setup') as setup,
            count(p.id) filter (where p.member_since >= $2::timestamptz and p.status in ('active', 'past_due')) as new_members,
            count(p.id) filter (where p.cancelled_at >= $2::timestamptz and p.member_since is not null) as cancelled,
            coalesce(sum(t.price_cents) filter (where p.status in ('active', 'past_due') and p.portfolio_id is null), 0)
              + (select coalesce(sum(coalesce(f.band_cents, ft.price_cents)), 0) from public.portfolios f join public.membership_tiers ft on ft.id = f.tier_id
                  where f.market = m.slug and f.status in ('active', 'past_due')) as mrr,
            (select count(*) from public.portfolios f where f.market = m.slug and f.status in ('active', 'past_due')) as portfolios
       from public.markets m
       left join public.properties p on p.market = m.slug
       left join public.membership_tiers t on t.id = p.tier_id
      where m.slug = $1
      group by m.slug, m.currency`,
    [market, since],
  );
  const p = props[0] ?? { currency: "NZD", active: 0, past_due: 0, setup: 0, new_members: 0, cancelled: 0, mrr: 0, portfolios: 0 };
  const members = Number(p.active) + Number(p.past_due);
  const membersAtStart = members + Number(p.cancelled) - Number(p.new_members);

  const jobs = await db.query<{
    logged: number; completed: number; cancelled: number; open: number; value: number; platform: number; misses: number;
    median_accept: number | null; median_arrive: number | null; measured: number; on_time: number;
  }>(
    `select count(*) filter (where created_at >= $2::timestamptz) as logged,
            count(*) filter (where status = 'completed' and completed_at >= $2::timestamptz) as completed,
            count(*) filter (where status = 'cancelled' and cancelled_at >= $2::timestamptz) as cancelled,
            count(*) filter (where status not in ('completed', 'cancelled')) as open,
            coalesce(sum(owner_total_cents) filter (where status = 'completed' and completed_at >= $2::timestamptz), 0) as value,
            coalesce(sum(owner_total_cents - tradie_total_cents) filter (where status = 'completed' and completed_at >= $2::timestamptz), 0) as platform,
            count(*) filter (where window_missed_at >= $2::timestamptz) as misses,
            percentile_cont(0.5) within group (order by extract(epoch from (accepted_at - dispatched_at)) / 60)
              filter (where accepted_at >= $2::timestamptz and dispatched_at is not null) as median_accept,
            percentile_cont(0.5) within group (order by extract(epoch from (arrived_at - dispatched_at)) / 3600)
              filter (where arrived_at >= $2::timestamptz and dispatched_at is not null) as median_arrive,
            count(*) filter (where dispatched_at >= $2::timestamptz and respond_by is not null
                             and (arrived_at is not null or (respond_by <= $3::timestamptz and status <> 'cancelled'))) as measured,
            count(*) filter (where dispatched_at >= $2::timestamptz and arrived_at is not null and arrived_at <= respond_by) as on_time
       from public.jobs where market = $1`,
    [market, since, nowIso],
  );
  const j = jobs[0]!;

  const absorbed = await db.query<{ total: number }>(
    `select coalesce(sum(l.tradie_cents - l.owner_cents), 0) as total
       from public.job_lines l join public.jobs j on j.id = l.job_id
      where j.market = $1 and j.status = 'completed' and j.completed_at >= $2::timestamptz and l.kind = 'urgent' and l.status = 'active' and l.owner_cents < l.tradie_cents`,
    [market, since],
  );
  const money = await db.query<{ credits: number; refunds: number; failed: number }>(
    `select (select coalesce(sum(c.amount_cents), 0) from public.credits c join public.properties p on p.id = c.property_id
              where p.market = $1 and c.created_at >= $2::timestamptz and c.status <> 'void' and c.reason <> 'founding_deposit') as credits,
            (select coalesce(sum(pay.refunded_cents), 0) from public.payments pay join public.jobs j on j.id = pay.job_id
              where j.market = $1 and pay.created_at >= $2::timestamptz) as refunds,
            (select count(*) from public.payments pay join public.jobs j on j.id = pay.job_id where j.market = $1 and pay.status = 'failed') as failed`,
    [market, since],
  );
  const people = await db.query<{ approved: number; waiting: number; open: number }>(
    `select (select count(*) from public.tradies where market = $1 and status = 'approved') as approved,
            (select count(*) from public.tradies where market = $1 and status = 'applied') as waiting,
            (select count(*) from public.exceptions where status = 'open' and (market = $1 or market is null)) as open`,
    [market],
  );

  const completed = Number(j.completed);
  const measured = Number(j.measured);
  return {
    market,
    currency: p.currency,
    properties: Number(p.active),
    propertiesPastDue: Number(p.past_due),
    propertiesSetup: Number(p.setup),
    newMembers: Number(p.new_members),
    cancelled: Number(p.cancelled),
    churnRate: membersAtStart > 0 ? Number(p.cancelled) / membersAtStart : null,
    mrrCents: Number(p.mrr),
    portfolios: Number(p.portfolios),
    jobsLogged: Number(j.logged),
    jobsCompleted: completed,
    jobsCancelled: Number(j.cancelled),
    jobsOpen: Number(j.open),
    jobValueCents: Number(j.value),
    averageJobCents: completed > 0 ? Math.round(Number(j.value) / completed) : null,
    platformCents: Number(j.platform),
    urgentAbsorbedCents: Number(absorbed[0]?.total ?? 0),
    medianMinutesToAccept: j.median_accept === null ? null : Math.round(Number(j.median_accept)),
    medianHoursToArrive: j.median_arrive === null ? null : Math.round(Number(j.median_arrive) * 10) / 10,
    onTimeRate: measured > 0 ? Number(j.on_time) / measured : null,
    misses: Number(j.misses),
    creditsCents: Number(money[0]?.credits ?? 0),
    refundsCents: Number(money[0]?.refunds ?? 0),
    failedPayments: Number(money[0]?.failed ?? 0),
    tradiesApproved: Number(people[0]?.approved ?? 0),
    tradiesWaiting: Number(people[0]?.waiting ?? 0),
    openExceptions: Number(people[0]?.open ?? 0),
  };
}
