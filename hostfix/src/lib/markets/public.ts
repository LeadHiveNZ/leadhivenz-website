import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { launchMarket, markets as configuredMarkets, type Market } from "@config/markets";
import { databaseKind, getDb } from "@/lib/db";
import { readMenuSeed, startsOnTheMenu, withMenuSettings } from "@/lib/db/seed-core";
import path from "node:path";
import { listMarkets, listMenu } from "./store";

/**
 * MARKET DETAILS FOR THE PUBLIC PAGES (prices, tiers, the menu).
 *
 * These come from the database, where the admin edits them, and are kept for
 * up to an hour so the landing pages stay fast. Saving a change on an admin
 * screen clears the kept copy straight away.
 *
 * If the database cannot be reached (or while the site is being built on a
 * computer with no database), the starting values in config/markets.ts are
 * used instead, so the public pages never fail.
 */

export type PublicMenuItem = { code: string; trade: string; name: string; ownerPriceCents: number; tradiePayoutCents: number; licenceRequired: boolean; tryFirst: string };
export type PublicMarket = { market: Market; menu: PublicMenuItem[] };

export const MARKETS_TAG = "markets";

function fromConfig(market: Market): PublicMarket {
  let menu: PublicMenuItem[] = [];
  let settings = market;
  try {
    const seed = readMenuSeed(path.join(process.cwd(), "seed"), market.slug);
    // The same two steps the database gets: the file's surcharges laid over the
    // market, and jobs that cannot be booked yet left off the menu.
    settings = withMenuSettings(market, seed);
    menu = (seed?.items ?? []).filter(startsOnTheMenu).map((item) => ({
      code: item.code, trade: item.trade, name: item.name, ownerPriceCents: Math.round(item.ownerPriceDollars * 100),
      tradiePayoutCents: Math.round(item.tradiePayoutDollars * 100), licenceRequired: item.licenceRequired, tryFirst: item.tryFirst ?? "",
    }));
  } catch {
    // No menu file is fine: the page simply shows no menu.
  }
  return { market: settings, menu };
}

function building(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Reads the public markets straight from the database. */
async function fromDatabase(): Promise<PublicMarket[]> {
  const db = await getDb();
  const found = (await listMarkets(db)).filter((market) => market.stage === "waitlist" || market.stage === "live" || market.stage === "paused");
  const result: PublicMarket[] = [];
  for (const market of found) {
    const menu = await listMenu(db, market.slug);
    result.push({
      market,
      menu: menu.map((item) => ({
        code: item.code, trade: item.trade, name: item.name, ownerPriceCents: item.ownerPriceCents, tradiePayoutCents: item.tradiePayoutCents,
        licenceRequired: item.licenceRequired, tryFirst: item.tryFirst,
      })),
    });
  }
  return result;
}

/** Every market the public may see (waitlist or live), oldest first. */
export async function publicMarkets(): Promise<PublicMarket[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKETS_TAG);

  const kind = databaseKind();
  if (kind === "none") return configuredMarkets.map(fromConfig);
  if (kind === "embedded" && building()) {
    // Building the demo. Its sample data opens the first market for business,
    // so the public pages are built to match (unless sample data is switched off).
    const sample = process.env.HOSTFIX_SAMPLE_DATA !== "0";
    return configuredMarkets.map((market) => fromConfig(sample && market.slug === launchMarket.slug ? { ...market, stage: "live" } : market));
  }
  try {
    const found = await fromDatabase();
    return found.length === 0 ? configuredMarkets.map(fromConfig) : found;
  } catch {
    return configuredMarkets.map(fromConfig);
  }
}

/**
 * One market, read from the database this instant rather than from the kept
 * copy. Used only when the kept copy does not have the market, which is the
 * case for a few moments after a new market is opened to the public. Call it
 * only after `await connection()`.
 */
export async function publicMarketNow(slug: string): Promise<PublicMarket | null> {
  if (databaseKind() === "none") return null;
  try {
    return (await fromDatabase()).find((entry) => entry.market.slug === slug) ?? null;
  } catch {
    return null;
  }
}

/** One market by its short code, or the main one when no code is given. Null if it does not exist. */
export async function publicMarket(slug?: string | null): Promise<PublicMarket | null> {
  const all = await publicMarkets();
  if (!slug) return all.find((entry) => entry.market.slug === launchMarket.slug) ?? all[0] ?? null;
  return all.find((entry) => entry.market.slug === slug) ?? null;
}
