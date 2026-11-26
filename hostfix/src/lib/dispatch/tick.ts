import { purgeOldCodes } from "@/lib/auth/codes";
import { purgeExpiredSessions } from "@/lib/auth/sessions";
import { checkDebits } from "@/lib/billing/debits";
import { applyPendingCredits, chargeDuePayments, flagAtRisk, markMissedWindows, refundDuePrepayments, releaseDuePayouts, releaseDueRests, type GatewayFor } from "@/lib/billing/settle";
import { keepHoldsAlive } from "@/lib/billing/card-holds";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { purgeUnattached } from "@/lib/files/uploads";
import { chaseGuestReports, releaseCardHolds } from "@/lib/jobs/create";
import { applyScheduledFees } from "@/lib/markets/admin";
import { ownerJobUrl } from "@/lib/jobs/context";
import { texts } from "@/lib/notify/messages";
import { enqueue, flushOutbox, type FlushDeps } from "@/lib/notify/outbox";
import { raiseException } from "@/lib/ops/exceptions";
import { addMonths } from "@/lib/payments/gateway";
import { endMembership, recordRenewal } from "@/lib/properties/service";
import { savePayoutAccount } from "@/lib/tradies/service";
import { baseUrl } from "@/lib/env";
import { randomToken } from "@/lib/ids";
import { dateKey, formatDate } from "@/lib/time";
import { alertNotTakenYet, expireDueOffers, expireLaterTimes, offerWaitingJobs, stepDownEmergencies } from "./cascade";
import { settleUnansweredChecks } from "@/lib/jobs/confirm";
import { settleNotDescribed } from "@/lib/jobs/not-described";
import { refundMissingReceipts } from "@/lib/jobs/parts";
import type { Geocoder } from "@/lib/maps/geocode";
import { fillMissingPins } from "@/lib/properties/pin";

/**
 * THE TIMER. Runs every minute (Vercel calls /api/cron/tick). It moves along
 * everything that depends on the clock rather than on someone pressing a
 * button:
 *
 *   offers that have run out          on to the next tradie
 *   a standard job nobody was inside  offered as soon as a tradie's own hours
 *     their hours for                 begin
 *   an emergency nobody took in 10    the owner offered "within 4 hours
 *     minutes                         instead", for less
 *   a later time the owner has not    on to the next tradie
 *     answered in time
 *   a normal job nobody has taken     the owner told, the team asked to ring round
 *     in 3 hours
 *   guest reports nobody answered     a reminder, then cancelled after a day
 *   jobs held for the owner's card    sent out once the card is sorted, with
 *                                     the hold on the card placed first
 *   holds on owners' cards            renewed before they run out on an open
 *                                     job (or placed a day before a far-off
 *                                     visit), and let go once not needed
 *   a new platform fee, 30 days on    starts
 *   jobs close to their promised time into the dispatcher's queue
 *   promises missed                   marked, and the dispatcher told; an
 *                                     accepted job with nobody there is a no-show
 *   cards to try again, payouts due   charged and paid (the part of a big
 *                                     payout that waited for the card, once
 *                                     the card pays)
 *   a quote paid on approval whose    refunded
 *     work did not go ahead
 *   "not the job described", no       the call-out paid (the owner did not object in time)
 *     objection in 24 hours
 *   a flagged job the owner has not   paid if the tradie is trusted, otherwise
 *     confirmed in 48 hours           to the dispatcher to approve or hold
 *   a parts receipt promised at Job   the part refunded to the owner out of the
 *     done, 7 days on and not come    held payment, and the tradie told
 *   quotes nobody answered            a reminder, then the dispatcher
 *   properties with no map pin        looked up from their address, a few at a time
 *   licences running out              the tradie and the admin told
 *
 * Vercel's timer is "best effort": a run can be late, skipped or doubled. So
 * every step works out what is due from the database, and doing a step twice
 * changes nothing the second time.
 */

export type TickReport = Record<string, number | string>;

export type TickDeps = {
  gatewayFor: GatewayFor;
  flush?: FlushDeps;
  /** Deletes files from storage. Left out in tests. */
  removeFiles?: (keys: string[]) => Promise<void>;
  /** Looks up map pins for properties that have none (DECISIONS.md, 2026-11-19). Left out when no key is set, and in tests. */
  geocoder?: Geocoder | null;
  log?: Pick<Console, "error">;
};

async function chaseQuotes(db: Db): Promise<number> {
  const at = now();
  let chased = 0;
  const rows = await db.query<{
    id: string; job_id: string; created_at: Date; reminded_at: Date | null; owner_total_cents: number; number: number; title: string;
    currency: string; market: string; property_name: string; owner_phone: string | null; owner_user: string; tradie_name: string;
  }>(
    `select q.id, q.job_id, q.created_at, q.reminded_at, q.owner_total_cents, j.number, j.title, j.currency, j.market,
            p.name as property_name, u.phone as owner_phone, u.id as owner_user, t.business_name as tradie_name
       from public.quotes q
       join public.jobs j on j.id = q.job_id
       join public.properties p on p.id = j.property_id
       join public.owners o on o.id = j.owner_id
       join public.users u on u.id = o.user_id
       join public.tradies t on t.id = q.tradie_id
      where q.status = 'pending' and q.created_at <= $1::timestamptz
        -- Approved, with the deposit clearing from the bank: nothing for the owner to answer (DECISIONS.md, 2026-11-23, second entry).
        and not exists (select 1 from public.job_prepayments x where x.quote_id = q.id and x.status = 'processing')
      limit 100`,
    [addHours(at, -1).toISOString()],
  );
  for (const row of rows) {
    const ageHours = (at.getTime() - new Date(row.created_at).getTime()) / 3_600_000;
    await db.tx(async (tx) => {
      if (!row.reminded_at) {
        const claimed = await tx.query("update public.quotes set reminded_at = $2::timestamptz where id = $1::uuid and reminded_at is null and status = 'pending' returning id", [row.id, at.toISOString()]);
        if (claimed.length > 0 && row.owner_phone) {
          await enqueue(tx, {
            channel: "sms", to: row.owner_phone, template: "quote_reminder", audience: "owner", jobId: row.job_id, userId: row.owner_user,
            body: texts.quoteNeedsApproval({
              tradie: row.tradie_name, amountCents: row.owner_total_cents, currency: row.currency, property: row.property_name,
              link: ownerJobUrl({ id: row.job_id, number: Number(row.number) }),
            }),
            dedupeKey: `quote_reminder:${row.id}`,
          });
          chased += 1;
        }
      }
      if (ageHours >= 4) {
        await raiseException(tx, {
          kind: "quote_waiting", market: row.market, jobId: row.job_id,
          summary: `Job ${Number(row.number)}: the owner has not answered ${row.tradie_name}'s quote for ${Math.round(ageHours)} hours. The tradie is waiting.`,
          dedupeKey: `quote_waiting:${row.id}`,
        });
      }
    });
  }
  return chased;
}

async function warnExpiringLicences(db: Db): Promise<number> {
  const at = now();
  const rows = await db.query<{
    id: string; tradie_id: string; trade: string; expires_on: string; business_name: string; market: string; timezone: string; phone: string | null; user_id: string;
  }>(
    `select l.id, l.tradie_id, l.trade, l.expires_on, t.business_name, t.market, m.timezone, u.phone, u.id as user_id
       from public.tradie_licences l
       join public.tradies t on t.id = l.tradie_id
       join public.markets m on m.slug = t.market
       join public.users u on u.id = t.user_id
      where t.status in ('approved', 'paused') and l.expires_on <= ($1::date + 30)
      limit 200`,
    [dateKey(at, "UTC")],
  );
  let warned = 0;
  for (const row of rows) {
    const expires = String(row.expires_on).slice(0, 10);
    const expired = expires < dateKey(at, row.timezone);
    const fresh = await raiseException(db, {
      kind: "licence_expiring", market: row.market, tradieId: row.tradie_id,
      summary: `${row.business_name}'s ${row.trade} licence ${expired ? "ran out" : "runs out"} on ${formatDate(new Date(`${expires}T12:00:00Z`), "UTC")}. ${expired ? "They are no longer offered licensed work." : "After that they will not be offered licensed work."}`,
      dedupeKey: `licence_expiring:${row.id}:${expires}`,
    });
    if (fresh && row.phone) {
      await enqueue(db, {
        channel: "sms", to: row.phone, template: "licence_expiring", audience: "tradie", userId: row.user_id,
        body: texts.licenceExpiring({ trade: row.trade.replace(/_/g, " "), date: formatDate(new Date(`${expires}T12:00:00Z`), "UTC"), link: `${baseUrl()}/tradie/profile` }),
        dedupeKey: `licence_expiring_sms:${row.id}:${expires}`,
      });
      warned += 1;
    }
  }
  return warned;
}

/**
 * A tradie's public liability insurance running out: the dispatcher and the
 * tradie are told 30 days before, and again once it has run out (from then on
 * the tradie is offered nothing). The same rule as licences.
 */
async function warnExpiringInsurance(db: Db): Promise<number> {
  const at = now();
  const rows = await db.query<{ id: string; insurance_expires_on: string; business_name: string; market: string; timezone: string; phone: string | null; user_id: string }>(
    `select t.id, t.insurance_expires_on, t.business_name, t.market, m.timezone, u.phone, u.id as user_id
       from public.tradies t
       join public.markets m on m.slug = t.market
       join public.users u on u.id = t.user_id
      where t.status in ('approved', 'paused') and t.insurance_expires_on is not null
        and t.insurance_expires_on <= (($1::timestamptz at time zone m.timezone)::date + 30)
      limit 200`,
    [at.toISOString()],
  );
  let warned = 0;
  for (const row of rows) {
    const expires = String(row.insurance_expires_on).slice(0, 10);
    const expired = expires < dateKey(at, row.timezone);
    const date = formatDate(new Date(`${expires}T12:00:00Z`), "UTC");
    const fresh = await raiseException(db, {
      kind: "insurance_expiring", market: row.market, tradieId: row.id,
      summary: `${row.business_name}'s public liability insurance ${expired ? "ran out" : "runs out"} on ${date}. ${expired ? "They are no longer offered any jobs." : "After that they will not be offered any jobs."}`,
      dedupeKey: `insurance_expiring:${row.id}:${expires}:${expired ? "expired" : "soon"}`,
    });
    if (fresh && row.phone) {
      await enqueue(db, {
        channel: "sms", to: row.phone, template: "insurance_expiring", audience: "tradie", userId: row.user_id,
        body: texts.insuranceExpiring({ date, link: `${baseUrl()}/tradie/profile` }),
        dedupeKey: `insurance_expiring_sms:${row.id}:${expires}:${expired ? "expired" : "soon"}`,
      });
      warned += 1;
    }
  }
  return warned;
}

/** Demo memberships have no payment company to renew them, so the timer does it. */
async function renewDemoMemberships(db: Db): Promise<number> {
  const at = now();
  const due = await db.query<{ id: string; subscription_id: string; current_period_end: Date; price_cents: number; currency: string; cancel_at_period_end: boolean }>(
    `select p.id, p.subscription_id, p.current_period_end, t.price_cents, m.currency, p.cancel_at_period_end
       from public.properties p
       join public.membership_tiers t on t.id = p.tier_id
       join public.markets m on m.slug = p.market
      where p.subscription_provider = 'demo' and p.status = 'active' and p.current_period_end <= $1::timestamptz
      limit 100`,
    [at.toISOString()],
  );
  let renewed = 0;
  for (const row of due) {
    if (row.cancel_at_period_end) {
      await db.query("update public.properties set status = 'cancelled', cancelled_at = $2::timestamptz, cancel_at_period_end = false where id = $1::uuid", [row.id, at.toISOString()]);
      continue;
    }
    const start = new Date(row.current_period_end);
    // Credits given since the last payment come off this one, as they would with a real payment company.
    const credits = await db.query<{ total: number }>(
      `select coalesce(sum(amount_cents), 0) as total from public.credits
        where property_id = $1::uuid and status = 'applied' and reason <> 'founding_deposit' and not (reason = 'missed_window' and job_id is not null) and created_at > $2::timestamptz and created_at <= $3::timestamptz`,
      [row.id, addMonths(start, -1).toISOString(), start.toISOString()],
    );
    const amount = Math.max(0, row.price_cents - Number(credits[0]?.total ?? 0));
    const fresh = await recordRenewal(db, {
      provider: "demo", subscriptionId: row.subscription_id,
      invoice: { invoiceId: `demo_in_${randomToken(14)}`, amountCents: amount, currency: row.currency, periodStart: start, periodEnd: addMonths(start, 1), paidAt: at },
    });
    if (fresh) renewed += 1;
  }
  // Portfolio retainers renew on the same turn, counted with the rest.
  return renewed + (await renewDemoPortfolios(db));
}

/** The same for Portfolio retainers on pretend money: one payment for the account, at the band it is billed at. */
async function renewDemoPortfolios(db: Db): Promise<number> {
  const at = now();
  const due = await db.query<{ id: string; subscription_id: string; current_period_end: Date; band_cents: number | null; price_cents: number; currency: string; cancel_at_period_end: boolean }>(
    `select f.id, f.subscription_id, f.current_period_end, f.band_cents, t.price_cents, m.currency, f.cancel_at_period_end
       from public.portfolios f
       join public.membership_tiers t on t.id = f.tier_id
       join public.markets m on m.slug = f.market
      where f.subscription_provider = 'demo' and f.status = 'active' and f.current_period_end <= $1::timestamptz
      limit 100`,
    [at.toISOString()],
  );
  let renewed = 0;
  for (const row of due) {
    if (row.cancel_at_period_end) {
      await endMembership(db, { provider: "demo", subscriptionId: row.subscription_id });
      continue;
    }
    const start = new Date(row.current_period_end);
    const credits = await db.query<{ total: number }>(
      `select coalesce(sum(c.amount_cents), 0) as total from public.credits c join public.properties p on p.id = c.property_id
        where p.portfolio_id = $1::uuid and c.status = 'applied' and c.reason <> 'founding_deposit' and c.created_at > $2::timestamptz and c.created_at <= $3::timestamptz`,
      [row.id, addMonths(start, -1).toISOString(), start.toISOString()],
    );
    const amount = Math.max(0, Number(row.band_cents ?? row.price_cents) - Number(credits[0]?.total ?? 0));
    const fresh = await recordRenewal(db, {
      provider: "demo", subscriptionId: row.subscription_id,
      invoice: { invoiceId: `demo_in_${randomToken(14)}`, amountCents: amount, currency: row.currency, periodStart: start, periodEnd: addMonths(start, 1), paidAt: at },
    });
    if (fresh) renewed += 1;
  }
  return renewed;
}

/** Asks the payment company whether tradies who have started adding bank details have finished. */
async function refreshPayoutAccounts(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const at = now();
  const rows = await db.query<{ id: string; payout_account_id: string; country: "NZ" | "AU" }>(
    `select t.id, t.payout_account_id, m.country
       from public.tradies t join public.markets m on m.slug = t.market
      where t.payout_account_id is not null and not t.payouts_enabled and t.payout_provider = 'stripe'
        and (t.payout_checked_at is null or t.payout_checked_at <= $1::timestamptz)
      limit 25`,
    [addHours(at, -1).toISOString()],
  );
  let enabled = 0;
  for (const row of rows) {
    const gateway = gatewayFor(row.country);
    if (!gateway || gateway.provider !== "stripe") continue;
    try {
      const status = await gateway.payoutAccountStatus(row.payout_account_id);
      await savePayoutAccount(db, row.id, { provider: "stripe", accountId: row.payout_account_id, payoutsEnabled: status.payoutsEnabled });
      if (status.payoutsEnabled) enabled += 1;
    } catch {
      await db.query("update public.tradies set payout_checked_at = $2::timestamptz where id = $1::uuid", [row.id, at.toISOString()]);
    }
  }
  return enabled;
}

async function tidyUp(db: Db, deps: TickDeps): Promise<number> {
  await purgeOldCodes(db);
  await purgeExpiredSessions(db);
  await db.query("delete from public.rate_limits where expires_at < $1::timestamptz", [now().toISOString()]);
  const keys = await purgeUnattached(db);
  if (keys.length > 0 && deps.removeFiles) await deps.removeFiles(keys).catch(() => {});
  return keys.length;
}

/**
 * One turn of the timer. Each step is on its own, so a problem in one (a
 * payment company outage, say) never stops the others.
 */
export async function runTick(db: Db, deps: TickDeps): Promise<TickReport> {
  const report: TickReport = {};
  const log = deps.log ?? console;
  const step = async (name: string, work: () => Promise<number | Record<string, number>>) => {
    try {
      const result = await work();
      if (typeof result === "number") report[name] = result;
      else for (const [key, value] of Object.entries(result)) report[`${name}.${key}`] = value;
    } catch (error) {
      report[name] = `failed: ${error instanceof Error ? error.message : String(error)}`;
      log.error(`[tick] ${name} failed:`, error);
    }
  };

  await step("offers_moved_on", () => expireDueOffers(db));
  await step("waiting_for_hours", () => offerWaitingJobs(db));
  await step("emergency_step_down", () => stepDownEmergencies(db));
  await step("later_times_sent_on", () => expireLaterTimes(db));
  await step("not_taken_yet", () => alertNotTakenYet(db));
  await step("guest_reports", () => chaseGuestReports(db));
  await step("card_holds_released", () => releaseCardHolds(db, deps.gatewayFor));
  await step("holds", () => keepHoldsAlive(db, deps.gatewayFor));
  await step("fees_changed", () => applyScheduledFees(db));
  await step("at_risk", () => flagAtRisk(db));
  await step("windows", () => markMissedWindows(db));
  await step("checks", () => settleUnansweredChecks(db));
  await step("callouts_settled", () => settleNotDescribed(db));
  await step("receipts_refunded", () => refundMissingReceipts(db, deps.gatewayFor));
  await step("credits_applied", () => applyPendingCredits(db, deps.gatewayFor));
  await step("cards_charged", () => chargeDuePayments(db, deps.gatewayFor));
  await step("bank_debits", () => checkDebits(db, deps.gatewayFor));
  await step("payouts_sent", () => releaseDuePayouts(db, deps.gatewayFor));
  await step("payout_rests_sent", () => releaseDueRests(db, deps.gatewayFor));
  await step("quotes_refunded", () => refundDuePrepayments(db, deps.gatewayFor));
  await step("quotes_chased", () => chaseQuotes(db));
  await step("licences_warned", () => warnExpiringLicences(db));
  await step("insurance_warned", () => warnExpiringInsurance(db));
  await step("demo_renewals", () => renewDemoMemberships(db));
  await step("payout_accounts", () => refreshPayoutAccounts(db, deps.gatewayFor));
  await step("pins_found", () => fillMissingPins(db, deps.geocoder ?? null));
  await step("files_cleared", () => tidyUp(db, deps));
  await step("messages", async () => {
    const sent = await flushOutbox(db, deps.flush);
    return { sent: sent.sent, failed: sent.failed, demo: sent.demo };
  });

  await db.query(
    `insert into public.app_state (key, value, updated_at) values ('last_tick', $1::jsonb, $2::timestamptz)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify({ at: now().toISOString(), report }), now().toISOString()],
  );
  return report;
}

export async function lastTick(db: Db): Promise<{ at: Date; report: TickReport } | null> {
  const rows = await db.query<{ value: { at: string; report: TickReport } }>("select value from public.app_state where key = 'last_tick'");
  const value = rows[0]?.value;
  return value ? { at: new Date(value.at), report: value.report } : null;
}
