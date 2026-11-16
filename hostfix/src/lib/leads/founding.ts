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
 * What billing does with a founding deposit today. The deposit's promises are
 * free text the admin edits, so the checklist cannot tell whether billing
 * keeps them: it shows both side by side until someone checks. DECISIONS.md
 * has the founding discount as work still owed.
 */
export const FOUNDING_BILLING_DOES = "the deposit comes off the first month's bill (up to one month's price), then the membership is full price";

export type FoundingBillingLine = { state: "todo" | "problem"; detail: string };

/** A line for the go-live checklist, or null when there is no founding offer to keep. */
export function foundingBillingLine(market: Pick<Market, "name" | "stage" | "foundingDeposit">, taken: number): FoundingBillingLine | null {
  const { enabled, terms } = market.foundingDeposit;
  if (terms.length === 0 || (!enabled && taken === 0)) return null;
  const promised = terms.map((term) => `"${term}"`).join(", ");
  const owners = `${taken} founding ${taken === 1 ? "spot" : "spots"} taken so far.`;
  if (market.stage === "live" && taken > 0) {
    return {
      state: "problem",
      detail: `${market.name} is live and founding members start paying now. They were promised ${promised}. Billing only does this: ${FOUNDING_BILLING_DOES}. Give any missing discount by hand as a credit on each founding owner's page until it is built. ${owners}`,
    };
  }
  return {
    state: "todo",
    detail: `The ${market.name} founding offer promises ${promised}. Billing only does this: ${FOUNDING_BILLING_DOES}. Anything more, like half-price months, must be built before ${market.name} goes live, or the promises changed on the Markets page before anyone else pays. ${owners}`,
  };
}
