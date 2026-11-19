import { isUuid } from "@/lib/uuid";
import { countryDefaults, type BillingBasis, type CountryCode, type CurrencyCode, type Market, type MarketStage, type MembershipTier, type RetainerBand } from "@config/markets";
import type { Db } from "@/lib/db/types";

/**
 * MARKETS, TIERS AND THE MENU, as kept in the database.
 * The database is the source of truth. config/markets.ts only supplies the
 * starting values for a market the database has not seen before.
 */

export type MenuItem = {
  id: string;
  market: string;
  code: string;
  trade: string;
  name: string;
  description: string;
  tryFirst: string;
  ownerPriceCents: number;
  tradiePayoutCents: number;
  licenceRequired: boolean;
  guestVisible: boolean;
  sort: number;
  active: boolean;
};

type MarketRow = {
  slug: string; name: string; country: CountryCode; currency: CurrencyCode; timezone: string; stage: MarketStage;
  tax_rate: number; tax_name: string; tax_registered: boolean; tax_number: string | null;
  platform_fee_bps: number; platform_fee_bps_next?: number | null; platform_fee_from?: Date | string | null; urgent_surcharge_cents: number; after_hours_surcharge_cents: number;
  diagnosis_fee_cents: number; diagnosis_payout_cents: number; approval_threshold_cents: number;
  parts_included_cents: number; parts_approval_cents: number;
  offer_minutes: number; hours_start: number; hours_end: number; work_days: string[]; payout_hold_hours: number;
  unaccepted_alert_hours?: number | null; counter_offer_hours?: number | null;
  min_minutes_on_site?: number | null; owner_confirm_hours?: number | null; map_lat?: number | string | null; map_lng?: number | string | null;
  referral_reward_cents: number; referral_paid_months: number;
  deposit_enabled: boolean; deposit_cents: number; deposit_terms: string[]; deposit_spots: number | null; reply_by_text: boolean;
};

type TierRow = {
  id: string; market: string; key: string; name: string; price_cents: number; response_hours: number;
  urgent_response_hours: number; urgent_included: boolean; urgent_included_per_month: number | null;
  quarterly_check: boolean; blurb: string; sort: number; active: boolean; provider_product_id: string | null;
  billing_basis: BillingBasis; bands: RetainerBand[] | string | null;
};

/** The bands as stored, read back as whole numbers whichever way the database hands them over. */
function readBands(raw: TierRow["bands"]): RetainerBand[] {
  const list = typeof raw === "string" ? (JSON.parse(raw) as RetainerBand[]) : (raw ?? []);
  return list.map((band) => ({
    from: Number(band.from),
    to: band.to === null || band.to === undefined ? null : Number(band.to),
    cents: band.cents === null || band.cents === undefined ? null : Number(band.cents),
  }));
}

type MenuRow = {
  id: string; market: string; code: string; trade: string; name: string; description: string; try_first: string;
  owner_price_cents: number; tradie_payout_cents: number; licence_required: boolean; guest_visible: boolean;
  sort: number; active: boolean;
};

export type Tier = MembershipTier & { id: string; market: string; active: boolean; sort: number; providerProductId: string | null };

function rowToTier(row: TierRow): Tier {
  return {
    id: row.id,
    market: row.market,
    key: row.key,
    name: row.name,
    monthlyPriceCents: row.price_cents,
    responseHours: row.response_hours,
    urgentResponseHours: row.urgent_response_hours,
    urgentIncluded: row.urgent_included,
    urgentIncludedPerMonth: row.urgent_included_per_month,
    quarterlyCheck: row.quarterly_check,
    blurb: row.blurb,
    active: row.active,
    sort: row.sort,
    providerProductId: row.provider_product_id,
    billingBasis: row.billing_basis ?? "per_property",
    bands: readBands(row.bands),
  };
}

function rowToMarket(row: MarketRow, tiers: Tier[]): Market {
  return {
    slug: row.slug,
    name: row.name,
    country: row.country,
    countryName: countryDefaults(row.country).countryName,
    currency: row.currency,
    timezone: row.timezone,
    stage: row.stage,
    taxRate: Number(row.tax_rate),
    taxName: row.tax_name,
    taxRegistered: row.tax_registered,
    taxNumber: row.tax_number,
    platformFeeBps: row.platform_fee_bps,
    platformFeeNext:
      row.platform_fee_bps_next === null || row.platform_fee_bps_next === undefined || !row.platform_fee_from
        ? null
        : { bps: Number(row.platform_fee_bps_next), from: new Date(row.platform_fee_from) },
    urgentSurchargeCents: row.urgent_surcharge_cents,
    afterHoursSurchargeCents: row.after_hours_surcharge_cents,
    diagnosisFeeCents: row.diagnosis_fee_cents,
    diagnosisPayoutCents: row.diagnosis_payout_cents,
    approvalThresholdCents: row.approval_threshold_cents,
    partsIncludedCents: row.parts_included_cents,
    partsApprovalCents: row.parts_approval_cents,
    offerMinutes: row.offer_minutes,
    hoursStart: row.hours_start,
    hoursEnd: row.hours_end,
    workDays: row.work_days,
    payoutHoldHours: row.payout_hold_hours,
    unacceptedAlertHours: Number(row.unaccepted_alert_hours ?? 3),
    counterOfferHours: Number(row.counter_offer_hours ?? 2),
    minMinutesOnSite: Number(row.min_minutes_on_site ?? 10),
    ownerConfirmHours: Number(row.owner_confirm_hours ?? 48),
    mapCentre: row.map_lat === null || row.map_lat === undefined || row.map_lng === null || row.map_lng === undefined ? null : { lat: Number(row.map_lat), lng: Number(row.map_lng) },
    referralRewardCents: row.referral_reward_cents,
    referralPaidMonths: row.referral_paid_months,
    replyByText: row.reply_by_text,
    tiers: tiers.filter((tier) => tier.market === row.slug && tier.active),
    foundingDeposit: {
      enabled: row.deposit_enabled, amountCents: row.deposit_cents, terms: row.deposit_terms,
      spots: row.deposit_spots === null || row.deposit_spots === undefined ? null : Number(row.deposit_spots),
    },
  };
}

function rowToMenuItem(row: MenuRow): MenuItem {
  return {
    id: row.id,
    market: row.market,
    code: row.code,
    trade: row.trade,
    name: row.name,
    description: row.description,
    tryFirst: row.try_first,
    ownerPriceCents: row.owner_price_cents,
    tradiePayoutCents: row.tradie_payout_cents,
    licenceRequired: row.licence_required,
    guestVisible: row.guest_visible,
    sort: row.sort,
    active: row.active,
  };
}

export async function listTiers(db: Db, market?: string): Promise<Tier[]> {
  const rows = await db.query<TierRow>(
    "select * from public.membership_tiers where ($1::text is null or market = $1) order by market, sort, price_cents",
    [market ?? null],
  );
  return rows.map(rowToTier);
}

export async function getTier(db: Db, id: string): Promise<Tier | null> {
  if (!isUuid(id)) return null;
  const rows = await db.query<TierRow>("select * from public.membership_tiers where id = $1::uuid", [id]);
  return rows[0] ? rowToTier(rows[0]) : null;
}

export async function listMarkets(db: Db): Promise<Market[]> {
  const rows = await db.query<MarketRow>("select * from public.markets order by created_at, slug");
  if (rows.length === 0) return [];
  const tiers = await listTiers(db);
  return rows.map((row) => rowToMarket(row, tiers));
}

export async function getMarket(db: Db, slug: string): Promise<Market | null> {
  const rows = await db.query<MarketRow>("select * from public.markets where slug = $1", [slug]);
  if (!rows[0]) return null;
  return rowToMarket(rows[0], await listTiers(db, slug));
}

export async function mustGetMarket(db: Db, slug: string): Promise<Market> {
  const market = await getMarket(db, slug);
  if (!market) throw new Error(`Market "${slug}" does not exist.`);
  return market;
}

export async function listMenu(db: Db, market: string, options: { includeInactive?: boolean } = {}): Promise<MenuItem[]> {
  const rows = await db.query<MenuRow>(
    `select * from public.menu_items
      where market = $1 and ($2::boolean or active)
      order by sort, code`,
    [market, options.includeInactive ?? false],
  );
  return rows.map(rowToMenuItem);
}

export async function getMenuItem(db: Db, id: string): Promise<MenuItem | null> {
  if (!isUuid(id)) return null;
  const rows = await db.query<MenuRow>("select * from public.menu_items where id = $1::uuid", [id]);
  return rows[0] ? rowToMenuItem(rows[0]) : null;
}
