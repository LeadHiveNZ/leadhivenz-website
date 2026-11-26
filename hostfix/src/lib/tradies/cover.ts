import type { Market } from "@config/markets";
import { findTrade, jobTrades, NOT_SURE_TRADE } from "@config/trades";
import type { Db } from "@/lib/db/types";
import { marketToday } from "@/lib/jobs/context";
import { getMarket, getMenuItem } from "@/lib/markets/store";
import { formatDeadline, localParts, WEEKDAYS, zonedInstant, type Weekday } from "@/lib/time";
import { eligibleTradies } from "./service";

/**
 * WHO IS ON RIGHT NOW (DECISIONS.md, 2026-11-26, third entry). Every tradie has their own hours on their own days.
 * The report form only offers Emergency, and only promises Urgent, when at least one tradie who could take the job is
 * inside their hours right now. Otherwise it says when the first one's hours begin, and a standard job waits for them.
 */

export type Hours = { daysAvailable: string[]; hoursFrom: number; hoursTo: number };

/** How far ahead to look for someone's hours beginning. */
const LOOK_AHEAD_DAYS = 8;

/**
 * Whether a tradie is inside their hours at `at`, and if not, when their hours next begin (in the next 8 days), in
 * the market's own time. A Mon-Fri 7am-4:30pm tradie on Friday at 6pm: not on, next from 7am Monday.
 */
export function hoursState(tradie: Hours, at: Date, timeZone: string): { onNow: boolean; nextFrom: Date | null } {
  const today = localParts(at, timeZone);
  for (let offset = 0; offset <= LOOK_AHEAD_DAYS; offset += 1) {
    const noon = new Date(zonedInstant(today.year, today.month, today.day, 12, timeZone).getTime() + offset * 86_400_000);
    const day = localParts(noon, timeZone);
    if (!tradie.daysAvailable.includes(day.weekday)) continue;
    const start = zonedInstant(day.year, day.month, day.day, tradie.hoursFrom, timeZone);
    const end = zonedInstant(day.year, day.month, day.day, tradie.hoursTo, timeZone);
    if (at.getTime() >= start.getTime() && at.getTime() < end.getTime()) return { onNow: true, nextFrom: null };
    if (start.getTime() > at.getTime()) return { onNow: false, nextFrom: start };
  }
  return { onNow: false, nextFrom: null };
}

export type Cover = { onNow: boolean; nextFrom: Date | null };

/** Puts several tradies' states together: on if anyone is on, otherwise the earliest time anyone's hours begin. */
export function combineCover(states: Cover[]): Cover {
  if (states.some((state) => state.onNow)) return { onNow: true, nextFrom: null };
  const next = states.map((state) => state.nextFrom).filter((value): value is Date => value !== null).sort((a, b) => a.getTime() - b.getTime())[0];
  return { onNow: false, nextFrom: next ?? null };
}

/** Whether anyone who could take a job in this trade (approved, insured, licensed where needed) is in their hours now. */
export async function coverNow(db: Db, market: Pick<Market, "slug" | "timezone">, trade: string, at: Date, licenceRequired?: boolean, area?: string | null): Promise<Cover> {
  if (trade === NOT_SURE_TRADE) {
    // "Not sure": our team picks the trade, so anyone on in any trade counts.
    return combineCover(await Promise.all(jobTrades.map((one) => coverNow(db, market, one.key, at, undefined, area))));
  }
  const candidates = await eligibleTradies(db, {
    market: market.slug, trade, licenceRequired: licenceRequired ?? findTrade(trade)?.licenceRequired ?? false, ...marketToday(market, at), hour: null, area,
  });
  if (candidates.length === 0) return { onNow: false, nextFrom: null };
  const rows = await db.query<{ days_available: string[]; hours_from: number | string; hours_to: number | string }>(
    "select days_available, hours_from, hours_to from public.tradies where id = any($1::uuid[])",
    [candidates.map((candidate) => candidate.tradieId)],
  );
  return combineCover(rows.map((row) => hoursState({ daysAvailable: row.days_available, hoursFrom: Number(row.hours_from), hoursTo: Number(row.hours_to) }, at, market.timezone)));
}

/** The cover for every trade the report form offers, by trade key, "Not sure" included. */
export async function coverByTrade(db: Db, market: Pick<Market, "slug" | "timezone">, at: Date, area?: string | null): Promise<Record<string, Cover>> {
  const result: Record<string, Cover> = {};
  for (const trade of jobTrades) result[trade.key] = await coverNow(db, market, trade.key, at, undefined, area);
  result[NOT_SURE_TRADE] = combineCover(Object.values(result));
  return result;
}

/** The plain line shown instead of Urgent and Emergency when nobody is on: "No one is on right now. We'll send this to tradies from 7am tomorrow." */
export function noCoverWords(cover: Cover, at: Date, timeZone: string): string {
  return cover.nextFrom
    ? `No one is on right now. We'll send this to tradies from ${formatDeadline(cover.nextFrom, at, timeZone)}.`
    : "No one is on right now. Our team will arrange a tradie for you.";
}

// ---------------------------------------------------------------------------
// AFTER-HOURS COVER, for the team (Admin > Markets)
// ---------------------------------------------------------------------------

export type AfterHoursCover = { trade: string; label: string; tradies: number; days: Weekday[] };

/**
 * For each trade: how many approved tradies' hours reach outside the market's working hours (before hoursStart or
 * past hoursEnd on one of their days, or any hours on a day that is not a working day), and on which days. A 0 means
 * an urgent or emergency job out of hours in that trade has nobody to go to.
 */
export function afterHoursCover(market: Pick<Market, "hoursStart" | "hoursEnd" | "workDays">, tradies: (Hours & { trades: string[] })[]): AfterHoursCover[] {
  return jobTrades.map((trade) => {
    const days = new Set<Weekday>();
    let count = 0;
    for (const tradie of tradies.filter((one) => one.trades.includes(trade.key))) {
      const outside = tradie.daysAvailable.filter((day) => {
        if (!market.workDays.includes(day)) return true;
        return tradie.hoursFrom < market.hoursStart || tradie.hoursTo > market.hoursEnd;
      });
      if (outside.length === 0) continue;
      count += 1;
      for (const day of outside) days.add(day as Weekday);
    }
    return { trade: trade.key, label: trade.label, tradies: count, days: WEEKDAYS.filter((day) => days.has(day)) };
  });
}

/** The same, read from the database: approved tradies in the market. */
export async function marketAfterHoursCover(db: Db, market: Pick<Market, "slug" | "hoursStart" | "hoursEnd" | "workDays">): Promise<AfterHoursCover[]> {
  const rows = await db.query<{ trades: string[]; days_available: string[]; hours_from: number | string; hours_to: number | string }>(
    "select trades, days_available, hours_from, hours_to from public.tradies where market = $1 and status = 'approved'",
    [market.slug],
  );
  return afterHoursCover(market, rows.map((row) => ({ trades: row.trades, daysAvailable: row.days_available, hoursFrom: Number(row.hours_from), hoursTo: Number(row.hours_to) })));
}

/**
 * The server's own check, behind the report form: an urgent or emergency job asked for when nobody who could take
 * it is inside their hours. Returns the words to show (and the job is not logged), or null when it may go ahead.
 * A standard job is never refused for this: it waits for someone's hours.
 */
export async function rushRefusal(
  db: Db, property: { market: string; area?: string | null }, input: { menuItemId: string | null; offMenuTrade?: string | null; urgent: boolean; emergency?: boolean }, at: Date,
): Promise<string | null> {
  if (!input.urgent && !input.emergency) return null;
  const market = await getMarket(db, property.market);
  if (!market) return null;
  const item = input.menuItemId ? await getMenuItem(db, input.menuItemId) : null;
  const trade = item?.trade ?? (findTrade(input.offMenuTrade ?? "") ? input.offMenuTrade! : NOT_SURE_TRADE);
  const cover = await coverNow(db, market, trade, at, item?.licenceRequired, property.area);
  return cover.onNow ? null : `${noCoverWords(cover, at, market.timezone)} Choose Standard to book it now.`;
}
