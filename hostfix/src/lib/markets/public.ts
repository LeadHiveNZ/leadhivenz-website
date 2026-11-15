import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { launchMarket, markets as configuredMarkets, type Market } from "@config/markets";
import { databaseKind, getDb } from "@/lib/db";
import { readMenuSeed } from "@/lib/db/seed-core";
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
  try {
    const seed = readMenuSeed(path.join(process.cwd(), "seed"), market.slug);
    menu = (seed?.items ?? []).map((item) => ({
      code: item.code, trade: item.trade, name: item.name, ownerPriceCents: Math.round(item.ownerPriceDollars * 100),
      tradiePayoutCents: Math.round(item.tradiePayoutDollars * 100), licenceRequired: item.licenceRequired, tryFirst: item.tryFirst ?? "",
    }));
  } catch {
    // No menu file is fine: the page simply shows no menu.
  }
  return { market, menu };
}

function building(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Every market the public may see (waitlist or live), oldest first. */
export async function publicMarkets(): Promise<PublicMarket[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(MARKETS_TAG);

  const kind = databaseKind();
  if (kind === "none" || (kind === "embedded" && building())) return configuredMarkets.map(fromConfig);
  try {
    const db = await getDb();
    const found = (await listMarkets(db)).filter((market) => market.stage === "waitlist" || market.stage === "live" || market.stage === "paused");
    if (found.length === 0) return configuredMarkets.map(fromConfig);
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
  } catch {
    return configuredMarkets.map(fromConfig);
  }
}

/** One market by its short code, or the main one when no code is given. Null if it does not exist. */
export async function publicMarket(slug?: string | null): Promise<PublicMarket | null> {
  const all = await publicMarkets();
  if (!slug) return all.find((entry) => entry.market.slug === launchMarket.slug) ?? all[0] ?? null;
  return all.find((entry) => entry.market.slug === slug) ?? null;
}
