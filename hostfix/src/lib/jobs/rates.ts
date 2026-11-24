import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * FIXED HOURLY RATES FOR EXTRA WORK (DECISIONS.md, 2026-11-20, third entry).
 *
 * Extra work up to HOURLY_LIMIT_CENTS (NZ$1,000) is quoted in hours at the
 * market's rate for the trade: what the owner pays an hour, GST included. The
 * tradie cannot type a different rate. Bigger work the tradie prices their own
 * way. The platform fee comes off the labour, as on every quote.
 *
 * The defaults below were confirmed by the founder on 24 Nov 2026 against
 * Queenstown 2026 rates (DECISIONS.md, 2026-11-24, second entry): plumbers and
 * electricians have a fixed hourly rate; cleaners and the like are priced by
 * the job. Every other trade has no rate and is priced the tradie's own way,
 * approved by the owner, unless one is set on the Markets screen.
 */
export const HOURLY_LIMIT_CENTS = 100_000;

export const DEFAULT_HOURLY_RATES: Record<string, number> = {
  plumber: 16_000,
  electrician: 16_000,
  gasfitter: 17_000,
  handyman: 11_000,
};

export async function hourlyRates(db: Db, market: string): Promise<Record<string, number>> {
  const rows = await db.query<{ trade: string; hourly_cents: number }>("select trade, hourly_cents from public.trade_rates where market = $1", [market]);
  const rates: Record<string, number> = { ...DEFAULT_HOURLY_RATES };
  for (const row of rows) rates[row.trade] = Number(row.hourly_cents);
  return rates;
}

export async function hourlyRate(db: Db, market: string, trade: string): Promise<number | null> {
  return (await hourlyRates(db, market))[trade] ?? null;
}

export async function saveHourlyRate(db: Db, market: string, trade: string, hourlyCents: number, actor: string): Promise<void> {
  if (!Number.isInteger(hourlyCents) || hourlyCents < 1000 || hourlyCents > 100_000) throw new Error("An hourly rate must be between NZ$10 and NZ$1,000.");
  await db.tx(async (tx) => {
    await tx.query(
      `insert into public.trade_rates (market, trade, hourly_cents, updated_at) values ($1, $2, $3, $4::timestamptz)
       on conflict (market, trade) do update set hourly_cents = excluded.hourly_cents, updated_at = excluded.updated_at`,
      [market, trade, hourlyCents, now().toISOString()],
    );
    await audit(tx, { actor, action: "market.hourly_rate", entity: "market", entityId: market, amount: hourlyCents, detail: { trade } });
  });
}

/**
 * Takes away a rate saved on the Markets screen: the trade goes back to its default (the four above) or, for
 * every other trade, to the tradie's own price.
 */
export async function clearHourlyRate(db: Db, market: string, trade: string, actor: string): Promise<void> {
  await db.tx(async (tx) => {
    const removed = await tx.query("delete from public.trade_rates where market = $1 and trade = $2 returning trade", [market, trade]);
    if (removed.length > 0) await audit(tx, { actor, action: "market.hourly_rate_cleared", entity: "market", entityId: market, detail: { trade } });
  });
}
