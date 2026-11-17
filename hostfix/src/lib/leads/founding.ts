import { findMarket, launchMarket, type Market } from "@config/markets";
import type { Db } from "@/lib/db/types";
import { getMarket } from "@/lib/markets/store";

/**
 * THE FOUNDING OFFER during the demand test: a limited number of founding
 * spots, each taken by paying a refundable deposit.
 */

/**
 * The market as it is now. The admin changes the deposit amount, its promises
 * and the number of spots on the Markets screen, and those are what the owner
 * is shown and charged. If the database cannot be reached, the starting values
 * in config/markets.ts are used, so the page never breaks.
 */
export async function currentMarket(open: () => Promise<Db>, slug: string, log: Pick<Console, "error"> = console): Promise<Market> {
  try {
    const found = await getMarket(await open(), slug);
    if (found) return found;
  } catch (error) {
    log.error("[founding] could not read the market, using the starting values:", error instanceof Error ? error.message : error);
  }
  return findMarket(slug) ?? launchMarket;
}

/** How many founding spots are taken: deposits paid, and deposits already used against a membership. */
export async function foundingSpotsTaken(db: Db, market: string): Promise<number> {
  const rows = await db.query<{ count: number }>(
    "select count(*) as count from public.leads where market = $1 and lead_type = 'owner' and deposit_status in ('paid', 'credited')",
    [market],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Spots still open, or null when the market sets no limit. Never below zero. */
export function spotsLeft(market: Pick<Market, "foundingDeposit">, taken: number): number | null {
  const spots = market.foundingDeposit.spots;
  if (spots === null) return null;
  return Math.max(0, spots - taken);
}

/** Only worth saying how few are left once it is a small number. "25 of 25 left" reads as nobody joining. */
export const SHOW_SPOTS_LEFT_AT = 10;

/**
 * The go-live checklist line for founding deposits. HostFix is free to join
 * (DECISIONS.md, 2026-11-17), so no new deposit is taken and every deposit
 * already paid is refunded in full, by hand, in Stripe (RUNBOOK.md). The line
 * stays on the checklist until the last paid deposit shows as refunded.
 */
export const FOUNDING_REFUND_DOES = "HostFix is free to join, so each one is refunded in full in Stripe (RUNBOOK.md, \"Refunding the founding deposits\") and the owner is told";

export type FoundingBillingLine = { state: "todo" | "problem"; detail: string };

/** A line for the go-live checklist, or null when no founding deposit is still held. */
export function foundingBillingLine(market: Pick<Market, "name" | "stage" | "foundingDeposit">, taken: number): FoundingBillingLine | null {
  if (taken === 0) return null;
  const promised = market.foundingDeposit.terms.length > 0 ? ` They were promised ${market.foundingDeposit.terms.map((term) => `"${term}"`).join(", ")}.` : "";
  const held = `${taken} founding ${taken === 1 ? "deposit is" : "deposits are"} still held in ${market.name}.`;
  return {
    state: market.stage === "live" ? "problem" : "todo",
    detail: `${held} ${FOUNDING_REFUND_DOES}.${promised}${market.stage === "live" ? ` ${market.name} is live, so do this before their first job is charged.` : ""}`,
  };
}
