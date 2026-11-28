/**
 * FIRST-TIME SET-UP OF A MARKET.
 *
 * Copies each market in config/markets.ts into the database, with its tiers
 * and its menu from the /seed folder, but ONLY if that market is not in the
 * database yet. It never overwrites anything you have edited on the admin
 * screens.
 *
 * Like migrate-core.ts this is also run by plain Node at build time, so it
 * must not use the "@/..." shortcuts.
 */

import fs from "node:fs";
import path from "node:path";
import { markets as configuredMarkets, type Market } from "../../../config/markets.ts";

export type SeedTarget = {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
};

export type MenuSeedItem = {
  code: string;
  trade: string;
  name: string;
  description?: string;
  tryFirst?: string;
  ownerPriceDollars: number;
  tradiePayoutDollars: number;
  licenceRequired: boolean;
  guestVisible?: boolean;
  /** Whether the job is on the menu. Left out, it follows the two flags below. */
  active?: boolean;
  /** Priced from national averages, not a local quote. Loaded switched off until someone confirms it. */
  needsLocalQuote?: boolean;
  /** Only makes sense alongside another job on the same visit. Loaded switched off: the app cannot attach it yet. */
  isAddOn?: boolean;
  /** A note for the tradie, used as the description when there is none. */
  notes?: string;
  /** Where the price came from (DECISIONS.md, 2026-11-24). For people reading the file. */
  source?: string;
  /** For people reading the file. Nothing reads these yet. */
  isDiagnosis?: boolean;
  seasonal?: { months: number[] };
  tags?: string[];
};

/** A job nobody should be able to book yet is loaded switched off, for the admin to switch on. */
export function startsOnTheMenu(item: Pick<MenuSeedItem, "active" | "needsLocalQuote" | "isAddOn">): boolean {
  return item.active ?? !(item.needsLocalQuote || item.isAddOn);
}

export type MenuSeed = {
  surcharges?: { urgentDollars?: number; afterHoursDollars?: number };
  offMenu?: { diagnosisFeeDollars?: number; diagnosisTradiePayoutDollars?: number; ownerApprovalAboveDollars?: number };
  items: MenuSeedItem[];
};

function cents(dollars: number, what: string): number {
  const value = Math.round(dollars * 100);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Seed menu: ${what} is not a valid amount.`);
  return value;
}

/**
 * Markets that load another market's menu and parts list instead of a file of their own.
 * Wānaka charges Queenstown's prices (DECISIONS.md, 2026-11-24, third entry): one file, so the two cannot drift
 * at set-up. After set-up each market's prices live in the database and are edited on the admin screen.
 */
export const SHARED_SEED: Record<string, string> = { wanaka: "queenstown" };

function seedSlug(seedDir: string, kind: "menu" | "parts", slug: string): string {
  const shared = SHARED_SEED[slug];
  return shared && !fs.existsSync(path.join(seedDir, `${kind}-${slug}.json`)) ? shared : slug;
}

export function readMenuSeed(seedDir: string, slug: string): MenuSeed | null {
  const file = path.join(seedDir, `menu-${seedSlug(seedDir, "menu", slug)}.json`);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as MenuSeed;
  if (!Array.isArray(parsed.items)) throw new Error(`${file} has no "items" list.`);
  return parsed;
}

/** The market's settings with the menu file's surcharges and limits laid over them. */
export function withMenuSettings(market: Market, menu: MenuSeed | null): Market {
  if (!menu) return market;
  const merged = { ...market };
  const s = menu.surcharges ?? {};
  const o = menu.offMenu ?? {};
  if (s.urgentDollars !== undefined) merged.urgentSurchargeCents = cents(s.urgentDollars, "urgentDollars");
  if (s.afterHoursDollars !== undefined) merged.afterHoursSurchargeCents = cents(s.afterHoursDollars, "afterHoursDollars");
  if (o.diagnosisFeeDollars !== undefined) merged.diagnosisFeeCents = cents(o.diagnosisFeeDollars, "diagnosisFeeDollars");
  if (o.diagnosisTradiePayoutDollars !== undefined) {
    merged.diagnosisPayoutCents = cents(o.diagnosisTradiePayoutDollars, "diagnosisTradiePayoutDollars");
  }
  if (o.ownerApprovalAboveDollars !== undefined) {
    merged.approvalThresholdCents = cents(o.ownerApprovalAboveDollars, "ownerApprovalAboveDollars");
  }
  return merged;
}

export async function insertMarket(db: SeedTarget, market: Market): Promise<void> {
  await db.query(
    `insert into public.markets (
       slug, name, country, currency, timezone, stage,
       tax_rate, tax_name, tax_registered, tax_number,
       platform_fee_bps, urgent_surcharge_cents, after_hours_surcharge_cents,
       diagnosis_fee_cents, diagnosis_payout_cents, approval_threshold_cents,
       parts_included_cents, parts_approval_cents,
       offer_minutes, hours_start, hours_end, work_days, payout_hold_hours,
       referral_reward_cents, referral_paid_months,
       deposit_enabled, deposit_cents, deposit_terms, reply_by_text, deposit_spots,
       unaccepted_alert_hours, counter_offer_hours,
       min_minutes_on_site, owner_confirm_hours, map_lat, map_lng, payout_guarantee_cents,
       tier_threshold_cents, above_tier_fee_bps, areas,
       emergency_surcharge_cents, emergency_response_minutes, emergency_step_down_minutes,
       pre_launch
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13,
       $14, $15, $16,
       $17, $18,
       $19, $20, $21, $22::text[], $23,
       $24, $25,
       $26, $27, $28::text[], $29, $30,
       $31, $32,
       $33, $34, $35, $36, $37,
       $38, $39, $40::jsonb,
       $41, $42, $43,
       $44
     )`,
    [
      market.slug, market.name, market.country, market.currency, market.timezone, market.stage,
      market.taxRate, market.taxName, market.taxRegistered, market.taxNumber,
      market.platformFeeBps, market.urgentSurchargeCents, market.afterHoursSurchargeCents,
      market.diagnosisFeeCents, market.diagnosisPayoutCents, market.approvalThresholdCents,
      market.partsIncludedCents, market.partsApprovalCents,
      market.offerMinutes, market.hoursStart, market.hoursEnd, market.workDays, market.payoutHoldHours,
      market.referralRewardCents, market.referralPaidMonths,
      market.foundingDeposit.enabled, market.foundingDeposit.amountCents, market.foundingDeposit.terms, market.replyByText,
      market.foundingDeposit.spots,
      market.unacceptedAlertHours, market.counterOfferHours,
      market.minMinutesOnSite, market.ownerConfirmHours, market.mapCentre?.lat ?? null, market.mapCentre?.lng ?? null, market.payoutGuaranteeCents,
      market.tierThresholdCents, market.aboveTierFeeBps, JSON.stringify(market.areas ?? []),
      market.emergencySurchargeCents, market.emergencyResponseMinutes, market.emergencyStepDownMinutes,
      Boolean(market.preLaunch),
    ],
  );

  let sort = 0;
  for (const tier of market.tiers) {
    await db.query(
      `insert into public.membership_tiers (
         market, key, name, price_cents, response_hours, urgent_response_hours,
         urgent_included, urgent_included_per_month, quarterly_check, blurb, sort, billing_basis, bands
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
      [
        market.slug, tier.key, tier.name, tier.monthlyPriceCents, tier.responseHours, tier.urgentResponseHours,
        tier.urgentIncluded, tier.urgentIncludedPerMonth, tier.quarterlyCheck, tier.blurb, sort,
        tier.billingBasis ?? "per_property", JSON.stringify(tier.bands ?? []),
      ],
    );
    sort += 10;
  }
}

export async function insertMenu(db: SeedTarget, slug: string, items: MenuSeedItem[]): Promise<number> {
  let sort = 0;
  for (const item of items) {
    const owner = cents(item.ownerPriceDollars, `${item.code} ownerPriceDollars`);
    const payout = cents(item.tradiePayoutDollars, `${item.code} tradiePayoutDollars`);
    if (payout > owner) throw new Error(`Seed menu: ${item.code} pays the tradie more than the owner is charged.`);
    await db.query(
      `insert into public.menu_items (
         market, code, trade, name, description, try_first,
         owner_price_cents, tradie_payout_cents, licence_required, guest_visible, active, sort
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (market, code) do nothing`,
      [
        slug, item.code, item.trade, item.name, item.description ?? item.notes ?? "", item.tryFirst ?? "",
        owner, payout, item.licenceRequired, item.guestVisible ?? true, startsOnTheMenu(item), sort,
      ],
    );
    sort += 10;
  }
  return items.length;
}

// ---------------------------------------------------------------------------
// THE PARTS PRICE LIST (DECISIONS.md, 2026-11-20)
// ---------------------------------------------------------------------------

export type PartsSeedItem = { code: string; name: string; priceDollars: number; source: string };

export function readPartsSeed(seedDir: string, slug: string): PartsSeedItem[] | null {
  const file = path.join(seedDir, `parts-${seedSlug(seedDir, "parts", slug)}.json`);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { items?: PartsSeedItem[] };
  if (!Array.isArray(parsed.items)) throw new Error(`${file} has no "items" list.`);
  return parsed.items;
}

/**
 * Loads a market's parts price list from /seed, once: only while the market
 * has no list yet and it has never been loaded before, so an admin who
 * removes every item does not get them back on the next deploy.
 */
export async function seedPriceList(db: SeedTarget, seedDir: string, slug: string): Promise<number> {
  const items = readPartsSeed(seedDir, slug);
  if (!items) return 0;
  const key = `price_list_seeded:${slug}`;
  if ((await db.query("select 1 from public.app_state where key = $1", [key])).length > 0) return 0;
  if ((await db.query("select 1 from public.price_list_items where market = $1 limit 1", [slug])).length > 0) return 0;
  let sort = 0;
  for (const item of items) {
    await db.query(
      `insert into public.price_list_items (market, code, name, price_cents, source, sort) values ($1, $2, $3, $4, $5, $6)
       on conflict (market, code) do nothing`,
      [slug, item.code, item.name, cents(item.priceDollars, `${item.code} priceDollars`), item.source, sort],
    );
    sort += 10;
  }
  await db.query("insert into public.app_state (key, value) values ($1, $2::jsonb) on conflict (key) do nothing", [key, JSON.stringify({ items: items.length })]);
  return items.length;
}

/** Adds any configured market that the database does not have yet. Returns their slugs. */
export async function seedMarkets(
  db: SeedTarget,
  seedDir: string,
  log: (line: string) => void = () => {},
): Promise<string[]> {
  const existing = new Set((await db.query("select slug from public.markets")).map((row) => String(row.slug)));
  const added: string[] = [];
  for (const configured of configuredMarkets) {
    if (existing.has(configured.slug)) continue;
    const menu = readMenuSeed(seedDir, configured.slug);
    await insertMarket(db, withMenuSettings(configured, menu));
    const count = menu ? await insertMenu(db, configured.slug, menu.items) : 0;
    log(`Added market ${configured.name} with ${configured.tiers.length} tiers and ${count} menu items.`);
    added.push(configured.slug);
  }
  // Every market in the database whose parts list has never been loaded gets it now, new or not.
  for (const row of await db.query("select slug from public.markets")) {
    const loaded = await seedPriceList(db, seedDir, String(row.slug));
    if (loaded > 0) log(`Loaded ${loaded} parts on the price list for ${String(row.slug)}.`);
  }
  return added;
}
