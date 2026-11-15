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

type MenuSeedItem = {
  code: string;
  trade: string;
  name: string;
  description?: string;
  tryFirst?: string;
  ownerPriceDollars: number;
  tradiePayoutDollars: number;
  licenceRequired: boolean;
  guestVisible?: boolean;
};

type MenuSeed = {
  surcharges?: { urgentDollars?: number; afterHoursDollars?: number };
  offMenu?: { diagnosisFeeDollars?: number; diagnosisTradiePayoutDollars?: number; ownerApprovalAboveDollars?: number };
  items: MenuSeedItem[];
};

function cents(dollars: number, what: string): number {
  const value = Math.round(dollars * 100);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Seed menu: ${what} is not a valid amount.`);
  return value;
}

export function readMenuSeed(seedDir: string, slug: string): MenuSeed | null {
  const file = path.join(seedDir, `menu-${slug}.json`);
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
       deposit_enabled, deposit_cents, deposit_terms, reply_by_text
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13,
       $14, $15, $16,
       $17, $18,
       $19, $20, $21, $22::text[], $23,
       $24, $25,
       $26, $27, $28::text[], $29
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
    ],
  );

  let sort = 0;
  for (const tier of market.tiers) {
    await db.query(
      `insert into public.membership_tiers (
         market, key, name, price_cents, response_hours, urgent_response_hours,
         urgent_included, urgent_included_per_month, quarterly_check, blurb, sort
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        market.slug, tier.key, tier.name, tier.monthlyPriceCents, tier.responseHours, tier.urgentResponseHours,
        tier.urgentIncluded, tier.urgentIncludedPerMonth, tier.quarterlyCheck, tier.blurb, sort,
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
         owner_price_cents, tradie_payout_cents, licence_required, guest_visible, sort
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (market, code) do nothing`,
      [
        slug, item.code, item.trade, item.name, item.description ?? "", item.tryFirst ?? "",
        owner, payout, item.licenceRequired, item.guestVisible ?? true, sort,
      ],
    );
    sort += 10;
  }
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
  return added;
}
