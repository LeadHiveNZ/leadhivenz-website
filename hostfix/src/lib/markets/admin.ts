import { countryDefaults, type BillingBasis, type CountryCode, type MarketStage, type RetainerBand } from "@config/markets";
import { findTrade } from "@config/trades";
import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { formatDate, isValidTimeZone, WEEKDAYS } from "@/lib/time";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { isUuid } from "@/lib/uuid";
import { bandProblem, lowestBand } from "./bands";
import { getMarket, listMenu, listTiers } from "./store";

/**
 * WHAT THE ADMIN CAN CHANGE: a market's settings, its membership tiers, its
 * menu, and adding a new market by copying an existing one.
 *
 * Every change is checked here and written to the audit log with the old and
 * new values. A price change only affects jobs logged afterwards: each job
 * keeps the prices it was logged with.
 */

export class AdminInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInputError";
  }
}

const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "tradie", "tradies", "owners", "owner", "legal", "sign-in", "sign-up", "sign-out", "demo", "r", "o", "j", "files",
  "refer", "icon", "robots", "sitemap", "manifest", "_next", "static", "public",
]);

function cents(value: number, what: string, max = 1_000_000): number {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new AdminInputError(`${what} must be a whole amount between 0 and ${max / 100}.`);
  return value;
}

export type MarketPatch = Partial<{
  name: string;
  stage: MarketStage;
  timezone: string;
  taxRate: number;
  taxName: string;
  taxRegistered: boolean;
  taxNumber: string | null;
  platformFeeBps: number;
  urgentSurchargeCents: number;
  afterHoursSurchargeCents: number;
  diagnosisFeeCents: number;
  diagnosisPayoutCents: number;
  approvalThresholdCents: number;
  partsIncludedCents: number;
  partsApprovalCents: number;
  payoutGuaranteeCents: number;
  offerMinutes: number;
  hoursStart: number;
  hoursEnd: number;
  workDays: string[];
  payoutHoldHours: number;
  unacceptedAlertHours: number;
  counterOfferHours: number;
  minMinutesOnSite: number;
  ownerConfirmHours: number;
  notDescribedHours: number;
  offerPushSmsMinutes: number;
  referralRewardCents: number;
  referralPaidMonths: number;
  depositEnabled: boolean;
  depositCents: number;
  depositTerms: string[];
  depositSpots: number | null;
  replyByText: boolean;
}>;

const COLUMNS: Record<keyof MarketPatch, string> = {
  name: "name", stage: "stage", timezone: "timezone", taxRate: "tax_rate", taxName: "tax_name", taxRegistered: "tax_registered",
  taxNumber: "tax_number", platformFeeBps: "platform_fee_bps", urgentSurchargeCents: "urgent_surcharge_cents",
  afterHoursSurchargeCents: "after_hours_surcharge_cents", diagnosisFeeCents: "diagnosis_fee_cents",
  diagnosisPayoutCents: "diagnosis_payout_cents", approvalThresholdCents: "approval_threshold_cents",
  partsIncludedCents: "parts_included_cents", partsApprovalCents: "parts_approval_cents", payoutGuaranteeCents: "payout_guarantee_cents", offerMinutes: "offer_minutes",
  hoursStart: "hours_start", hoursEnd: "hours_end", workDays: "work_days", payoutHoldHours: "payout_hold_hours",
  unacceptedAlertHours: "unaccepted_alert_hours", counterOfferHours: "counter_offer_hours",
  minMinutesOnSite: "min_minutes_on_site", ownerConfirmHours: "owner_confirm_hours",
  notDescribedHours: "not_described_hours", offerPushSmsMinutes: "offer_push_sms_minutes",
  referralRewardCents: "referral_reward_cents", referralPaidMonths: "referral_paid_months", depositEnabled: "deposit_enabled",
  depositCents: "deposit_cents", depositTerms: "deposit_terms", depositSpots: "deposit_spots", replyByText: "reply_by_text",
};

function checkMarket(patch: MarketPatch, current: { hoursStart: number; hoursEnd: number; diagnosisFeeCents: number; diagnosisPayoutCents: number }): void {
  if (patch.name !== undefined && (patch.name.trim().length < 2 || patch.name.trim().length > 60)) throw new AdminInputError("The market needs a name.");
  if (patch.stage !== undefined && !["draft", "waitlist", "live", "paused"].includes(patch.stage)) throw new AdminInputError("That is not a stage.");
  if (patch.timezone !== undefined && !isValidTimeZone(patch.timezone)) throw new AdminInputError("That is not a timezone. Use one like Pacific/Auckland or Australia/Brisbane.");
  if (patch.taxRate !== undefined && !(patch.taxRate >= 0 && patch.taxRate <= 0.3)) throw new AdminInputError("The tax rate must be between 0% and 30%.");
  if (patch.platformFeeBps !== undefined && (!Number.isInteger(patch.platformFeeBps) || patch.platformFeeBps < 0 || patch.platformFeeBps > 5000)) {
    throw new AdminInputError("The platform fee must be between 0% and 50%.");
  }
  for (const key of ["urgentSurchargeCents", "afterHoursSurchargeCents", "diagnosisFeeCents", "diagnosisPayoutCents", "approvalThresholdCents", "partsIncludedCents", "partsApprovalCents", "payoutGuaranteeCents", "referralRewardCents", "depositCents"] as const) {
    if (patch[key] !== undefined) cents(patch[key]!, "That amount");
  }
  const fee = patch.diagnosisFeeCents ?? current.diagnosisFeeCents;
  const payout = patch.diagnosisPayoutCents ?? current.diagnosisPayoutCents;
  if (payout > fee) throw new AdminInputError("The diagnosis payout cannot be more than the diagnosis fee.");
  if (patch.offerMinutes !== undefined && (!Number.isInteger(patch.offerMinutes) || patch.offerMinutes < 1 || patch.offerMinutes > 240)) {
    throw new AdminInputError("The offer window must be between 1 and 240 minutes.");
  }
  const start = patch.hoursStart ?? current.hoursStart;
  const end = patch.hoursEnd ?? current.hoursEnd;
  const halfHour = (value: number) => Number.isInteger(value * 2);
  if (!halfHour(start) || !halfHour(end) || start < 0 || start > 23.5 || end > 24 || end <= start) {
    throw new AdminInputError("Working hours must start before they end, on the hour or the half hour.");
  }
  if (patch.workDays !== undefined && (patch.workDays.length === 0 || patch.workDays.some((day) => !WEEKDAYS.includes(day as (typeof WEEKDAYS)[number])))) {
    throw new AdminInputError("Choose at least one working day.");
  }
  if (patch.depositSpots !== undefined && patch.depositSpots !== null && (!Number.isInteger(patch.depositSpots) || patch.depositSpots < 1 || patch.depositSpots > 1000)) {
    throw new AdminInputError("Founding spots must be a whole number from 1 to 1000, or left empty for no limit.");
  }
  if (patch.depositTerms !== undefined && (patch.depositTerms.length > 6 || patch.depositTerms.some((term) => term.length > 140))) {
    throw new AdminInputError("Keep the deposit's promises to six lines of up to 140 characters each.");
  }
  if (patch.payoutHoldHours !== undefined && (!Number.isInteger(patch.payoutHoldHours) || patch.payoutHoldHours < 0 || patch.payoutHoldHours > 48)) {
    throw new AdminInputError("The payout hold must be between 0 and 48 hours.");
  }
  if (patch.unacceptedAlertHours !== undefined && (!Number.isInteger(patch.unacceptedAlertHours) || patch.unacceptedAlertHours < 1 || patch.unacceptedAlertHours > 23)) {
    throw new AdminInputError("The hours before we ring round for a tradie must be between 1 and 23.");
  }
  if (patch.counterOfferHours !== undefined && (!Number.isInteger(patch.counterOfferHours) || patch.counterOfferHours < 1 || patch.counterOfferHours > 12)) {
    throw new AdminInputError("The hours an owner has to answer a later time must be between 1 and 12.");
  }
  if (patch.minMinutesOnSite !== undefined && (!Number.isInteger(patch.minMinutesOnSite) || patch.minMinutesOnSite < 0 || patch.minMinutesOnSite > 120)) {
    throw new AdminInputError("The shortest time on site must be between 0 and 120 minutes. 0 switches the check off.");
  }
  if (patch.ownerConfirmHours !== undefined && (!Number.isInteger(patch.ownerConfirmHours) || patch.ownerConfirmHours < 1 || patch.ownerConfirmHours > 168)) {
    throw new AdminInputError("The hours an owner has to confirm a job must be between 1 and 168.");
  }
  if (patch.notDescribedHours !== undefined && (!Number.isInteger(patch.notDescribedHours) || patch.notDescribedHours < 1 || patch.notDescribedHours > 168)) {
    throw new AdminInputError("The hours an owner has to say \"This was the job I described\" must be between 1 and 168.");
  }
  if (patch.offerPushSmsMinutes !== undefined && (!Number.isInteger(patch.offerPushSmsMinutes) || patch.offerPushSmsMinutes < 0 || patch.offerPushSmsMinutes > 15)) {
    throw new AdminInputError("The minutes before an unopened offer is also texted must be between 0 and 15.");
  }
  if (patch.referralPaidMonths !== undefined && (!Number.isInteger(patch.referralPaidMonths) || patch.referralPaidMonths < 1 || patch.referralPaidMonths > 24)) {
    throw new AdminInputError("Referral months must be between 1 and 24.");
  }
}

export async function updateMarket(db: Db, slug: string, patch: MarketPatch, actor: string): Promise<void> {
  const current = await getMarket(db, slug);
  if (!current) throw new AdminInputError("That market does not exist.");
  checkMarket(patch, current);
  await db.tx(async (tx) => {
    let rest: MarketPatch = patch;
    // A new platform fee waits 30 days once the market has tradies (tradie agreement, section 8).
    if (patch.platformFeeBps !== undefined) {
      const tradies = await tx.query("select 1 from public.tradies where market = $1 and status in ('applied', 'approved', 'paused') limit 1", [slug]);
      if (tradies.length > 0) {
        rest = { ...patch, platformFeeBps: undefined };
        await scheduleFee(tx, current, patch.platformFeeBps, actor);
      }
    }
    const entries = (Object.entries(rest) as [keyof MarketPatch, unknown][]).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;
    const sets = entries.map(([key], index) => `${COLUMNS[key]} = $${index + 2}${key === "workDays" || key === "depositTerms" ? "::text[]" : ""}`);
    const values = entries.map(([key, value]) => (key === "name" && typeof value === "string" ? value.trim() : value));
    await tx.query(`update public.markets set ${sets.join(", ")}, updated_at = $${entries.length + 2}::timestamptz where slug = $1`, [slug, ...values, now().toISOString()]);
    await audit(tx, { actor, action: "market.updated", entity: "market", entityId: slug, detail: { changed: Object.fromEntries(entries) } });
  });
}

/** Days' notice before a new platform fee applies to tradies (DECISIONS.md, 2026-11-20). */
export const FEE_NOTICE_DAYS = 30;

const percent = (bps: number) => `${bps / 100}%`;

/**
 * Writes down a new platform fee to start FEE_NOTICE_DAYS from now and texts
 * every tradie in the market. Setting the fee back to what it is now calls off
 * a change still waiting.
 */
async function scheduleFee(
  db: Db,
  market: { slug: string; name: string; timezone: string; platformFeeBps: number; platformFeeNext?: { bps: number; from: Date } | null },
  bps: number,
  actor: string,
): Promise<void> {
  if (bps === market.platformFeeBps) {
    if (market.platformFeeNext) {
      await db.query("update public.markets set platform_fee_bps_next = null, platform_fee_from = null where slug = $1", [market.slug]);
      await audit(db, { actor, action: "market.fee_change_cancelled", entity: "market", entityId: market.slug, detail: { was: market.platformFeeNext.bps } });
    }
    return;
  }
  if (market.platformFeeNext?.bps === bps) return;
  const from = new Date(now().getTime() + FEE_NOTICE_DAYS * 86_400_000);
  await db.query("update public.markets set platform_fee_bps_next = $2, platform_fee_from = $3::timestamptz where slug = $1", [market.slug, bps, from.toISOString()]);
  await audit(db, {
    actor, action: "market.fee_change_scheduled", entity: "market", entityId: market.slug,
    detail: { from_bps: market.platformFeeBps, to_bps: bps, applies_from: from.toISOString() },
  });
  const tradies = await db.query<{ phone: string | null; user_id: string }>(
    "select u.phone, u.id as user_id from public.tradies t join public.users u on u.id = t.user_id where t.market = $1 and t.status in ('applied', 'approved', 'paused')",
    [market.slug],
  );
  const date = formatDate(from, market.timezone);
  for (const tradie of tradies) {
    if (!tradie.phone) continue;
    await enqueue(db, {
      channel: "sms", to: tradie.phone, template: "fee_change", audience: "tradie", userId: tradie.user_id,
      body: texts.feeChange({ market: market.name, fromPct: percent(market.platformFeeBps), toPct: percent(bps), date }),
      dedupeKey: `fee_change:${market.slug}:${from.toISOString()}:${tradie.user_id}`,
    });
  }
}

/** For the timer: a new platform fee whose 30 days are up starts. */
export async function applyScheduledFees(db: Db): Promise<number> {
  const due = await db.query<{ slug: string; platform_fee_bps: number; platform_fee_bps_next: number }>(
    "select slug, platform_fee_bps, platform_fee_bps_next from public.markets where platform_fee_from is not null and platform_fee_from <= $1::timestamptz",
    [now().toISOString()],
  );
  let applied = 0;
  for (const row of due) {
    const done = await db.tx(async (tx) => {
      const rows = await tx.query(
        `update public.markets set platform_fee_bps = platform_fee_bps_next, platform_fee_bps_next = null, platform_fee_from = null, updated_at = $2::timestamptz
          where slug = $1 and platform_fee_from is not null and platform_fee_from <= $2::timestamptz returning slug`,
        [row.slug, now().toISOString()],
      );
      if (rows.length === 0) return false;
      await audit(tx, { actor: "system", action: "market.fee_changed", entity: "market", entityId: row.slug, detail: { from_bps: row.platform_fee_bps, to_bps: row.platform_fee_bps_next } });
      return true;
    });
    if (done) applied += 1;
  }
  return applied;
}

export type TierInput = {
  id?: string | null;
  key: string;
  name: string;
  priceCents: number;
  responseHours: number;
  urgentResponseHours: number;
  urgentIncluded: boolean;
  urgentIncludedPerMonth: number | null;
  quarterlyCheck: boolean;
  blurb: string;
  active: boolean;
  /** Left out: per property, as before Portfolio existed. */
  billingBasis?: BillingBasis;
  /** per_account only: the retainer bands, lowest first. */
  bands?: RetainerBand[];
};

export async function saveTier(db: Db, market: string, input: TierInput, actor: string): Promise<string> {
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(input.key)) throw new AdminInputError("The tier's short code must be lower-case letters, for example essential.");
  if (input.name.trim().length < 2) throw new AdminInputError("The tier needs a name.");
  const basis: BillingBasis = input.billingBasis ?? "per_property";
  if (basis !== "per_property" && basis !== "per_account") throw new AdminInputError("Choose how the membership is charged.");
  const bands = basis === "per_account" ? (input.bands ?? []) : [];
  if (basis === "per_account") {
    const problem = bandProblem(bands);
    if (problem) throw new AdminInputError(problem);
  }
  // A retainer's headline price is its lowest band: what a portfolio starts from.
  const priceCents = basis === "per_account" ? lowestBand({ billingBasis: basis, bands, monthlyPriceCents: 0 })!.cents : input.priceCents;
  // A per-property membership may be free (DECISIONS.md, 2026-11-17): the property is covered once a card is on file.
  // A retainer for a whole account always has a price.
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 5_000_000) throw new AdminInputError("The monthly price must be zero or more.");
  if (basis === "per_account" && priceCents <= 0) throw new AdminInputError("A retainer for the whole account needs a monthly price more than zero.");
  if (!Number.isInteger(input.responseHours) || input.responseHours < 1 || input.responseHours > 168) throw new AdminInputError("The response promise must be between 1 and 168 hours.");
  if (!Number.isInteger(input.urgentResponseHours) || input.urgentResponseHours < 1 || input.urgentResponseHours > 48) throw new AdminInputError("The urgent response promise must be between 1 and 48 hours.");
  if (input.urgentIncludedPerMonth !== null && (!Number.isInteger(input.urgentIncludedPerMonth) || input.urgentIncludedPerMonth < 0)) {
    throw new AdminInputError("Included urgent call-outs per month must be a whole number, or left empty for no limit.");
  }
  const values = [
    market, input.key, input.name.trim(), priceCents, input.responseHours, input.urgentResponseHours, input.urgentIncluded,
    input.urgentIncludedPerMonth, input.quarterlyCheck, input.blurb.trim(), input.active, basis, JSON.stringify(bands),
  ];
  let id = input.id ?? null;
  if (id) {
    if (!isUuid(id)) throw new AdminInputError("That tier does not exist.");
    // The price members see is this price, and the payment company charges
    // what was agreed when they joined. Changing it under them would make the
    // two disagree, so a membership with members on it keeps its price.
    const before = await db.query<{ price_cents: number; billing_basis: BillingBasis; bands: unknown }>(
      "select price_cents, billing_basis, bands from public.membership_tiers where market = $1 and id = $2::uuid",
      [market, id],
    );
    if (before.length === 0) throw new AdminInputError("That tier does not exist.");
    const was = before[0]!;
    const portfolios = await db.query<{ count: number }>(
      "select count(*) as count from public.portfolios where tier_id = $1::uuid and status <> 'cancelled'",
      [id],
    );
    const portfolioCount = Number(portfolios[0]?.count ?? 0);
    if (was.billing_basis !== basis) {
      const using = await db.query<{ count: number }>("select count(*) as count from public.properties where tier_id = $1::uuid and status <> 'cancelled'", [id]);
      if (Number(using[0]?.count ?? 0) + portfolioCount > 0) {
        throw new AdminInputError("This membership is in use, so how it is charged cannot change. Add a new membership instead, and untick \"Offered to new members\" on this one.");
      }
    }
    // The same rule as a price: a Portfolio that is paying keeps the bands it joined on.
    const shape = (list: RetainerBand[]) => JSON.stringify(list.map((band) => [Number(band.from), band.to === null ? null : Number(band.to), band.cents === null ? null : Number(band.cents)]));
    const storedBands = (typeof was.bands === "string" ? JSON.parse(was.bands) : (was.bands ?? [])) as RetainerBand[];
    if (basis === "per_account" && shape(storedBands) !== shape(bands) && portfolioCount > 0) {
      throw new AdminInputError(
        `${portfolioCount} ${portfolioCount === 1 ? "portfolio is" : "portfolios are"} on these bands. To change them, add a new Portfolio membership with the new bands and untick "Offered to new members" on this one. To change one manager's retainer, use their page under Owners.`,
      );
    }
    if (Number(was.price_cents) !== priceCents && basis === "per_property") {
      const members = await db.query<{ count: number }>(
        "select count(*) as count from public.properties where tier_id = $1::uuid and status in ('active', 'past_due')",
        [id],
      );
      const count = Number(members[0]?.count ?? 0);
      if (count > 0) {
        throw new AdminInputError(
          `${count} ${count === 1 ? "property is a member" : "properties are members"} on this membership and ${count === 1 ? "is" : "are"} charged its current price each month. ` +
            'To change the price, add a new membership at the new price and untick "Offered to new members" on this one. Members stay on the old price until they switch.',
        );
      }
    }
    const rows = await db.query(
      `update public.membership_tiers set key = $2, name = $3, price_cents = $4, response_hours = $5, urgent_response_hours = $6,
              urgent_included = $7, urgent_included_per_month = $8, quarterly_check = $9, blurb = $10, active = $11,
              billing_basis = $12, bands = $13::jsonb
        where market = $1 and id = $14::uuid returning id`,
      [...values, id],
    );
    if (rows.length === 0) throw new AdminInputError("That tier does not exist.");
  } else {
    const rows = await db.query<{ id: string }>(
      `insert into public.membership_tiers (market, key, name, price_cents, response_hours, urgent_response_hours, urgent_included, urgent_included_per_month, quarterly_check, blurb, active, billing_basis, bands, sort)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, (select coalesce(max(sort), 0) + 10 from public.membership_tiers where market = $1))
       returning id`,
      values,
    );
    id = rows[0]!.id;
  }
  await audit(db, { actor, action: "tier.saved", entity: "market", entityId: market, amount: priceCents, detail: { tier: input.key, ...input, priceCents, billingBasis: basis, bands } });
  return id!;
}

export type MenuItemInput = {
  id?: string | null;
  code: string;
  trade: string;
  name: string;
  description: string;
  tryFirst: string;
  ownerPriceCents: number;
  tradiePayoutCents: number;
  licenceRequired: boolean;
  guestVisible: boolean;
  active: boolean;
};

export async function saveMenuItem(db: Db, market: string, input: MenuItemInput, actor: string): Promise<string> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2,4}-[0-9]{2,3}$/.test(code)) throw new AdminInputError("The code must look like PL-01: two to four letters, a dash, then a number.");
  const trade = findTrade(input.trade);
  if (!trade || trade.key === "other") throw new AdminInputError("Choose the trade this job is for.");
  if (input.name.trim().length < 2 || input.name.trim().length > 80) throw new AdminInputError("The job needs a name of up to 80 characters.");
  if (!Number.isInteger(input.ownerPriceCents) || input.ownerPriceCents <= 0 || input.ownerPriceCents > 1_000_000) throw new AdminInputError("The owner price must be more than zero.");
  if (!Number.isInteger(input.tradiePayoutCents) || input.tradiePayoutCents < 0 || input.tradiePayoutCents > input.ownerPriceCents) {
    throw new AdminInputError("The tradie payout cannot be more than the owner price.");
  }
  // A trade that legally needs a licence cannot have its jobs marked as needing none.
  const licenceRequired = input.licenceRequired || trade.licenceRequired;
  const values = [
    market, code, trade.key, input.name.trim(), input.description.trim(), input.tryFirst.trim(), input.ownerPriceCents,
    input.tradiePayoutCents, licenceRequired, input.guestVisible, input.active, now().toISOString(),
  ];
  let id = input.id ?? null;
  const before = id ? (await listMenu(db, market, { includeInactive: true })).find((item) => item.id === id) : null;
  if (id && !before) throw new AdminInputError("That menu item does not exist.");
  try {
    if (id) {
      const rows = await db.query(
        `update public.menu_items set code = $2, trade = $3, name = $4, description = $5, try_first = $6, owner_price_cents = $7,
                tradie_payout_cents = $8, licence_required = $9, guest_visible = $10, active = $11, updated_at = $12::timestamptz
          where market = $1 and id = $13::uuid returning id`,
        [...values, id],
      );
      if (rows.length === 0) throw new AdminInputError("That menu item does not exist.");
    } else {
      const rows = await db.query<{ id: string }>(
        `insert into public.menu_items (market, code, trade, name, description, try_first, owner_price_cents, tradie_payout_cents, licence_required, guest_visible, active, updated_at, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, (select coalesce(max(sort), 0) + 10 from public.menu_items where market = $1))
         returning id`,
        values,
      );
      id = rows[0]!.id;
    }
  } catch (error) {
    if (error instanceof AdminInputError) throw error;
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") throw new AdminInputError(`There is already a job with the code ${code}.`);
    throw error;
  }
  await audit(db, {
    actor, action: "menu.saved", entity: "market", entityId: market, amount: input.ownerPriceCents,
    detail: {
      code, name: input.name.trim(), owner_price: input.ownerPriceCents, tradie_payout: input.tradiePayoutCents, active: input.active,
      before: before ? { owner_price: before.ownerPriceCents, tradie_payout: before.tradiePayoutCents, active: before.active } : null,
    },
  });
  return id!;
}

export type NewMarket = { slug: string; name: string; country: CountryCode; timezone: string; copyFrom: string | null };

/**
 * Adds a market. Its tiers and menu are copied from an existing market as a
 * starting point. It starts as a draft: nothing is visible until you move it
 * to "waitlist" or "live". Prices are copied as numbers, so check them when
 * the new market uses a different currency.
 */
export async function createMarket(db: Db, input: NewMarket, actor: string): Promise<void> {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) throw new AdminInputError("The short code must be lower-case letters, numbers and dashes, for example wanaka or gold-coast.");
  if (RESERVED_SLUGS.has(slug)) throw new AdminInputError("That short code is used by the site itself. Choose another.");
  if (input.name.trim().length < 2) throw new AdminInputError("The market needs a name.");
  if (!isValidTimeZone(input.timezone)) throw new AdminInputError("That is not a timezone. Use one like Pacific/Auckland or Australia/Brisbane.");
  if (await getMarket(db, slug)) throw new AdminInputError("There is already a market with that short code.");
  const template = input.copyFrom ? await getMarket(db, input.copyFrom) : null;
  if (input.copyFrom && !template) throw new AdminInputError("The market to copy from does not exist.");
  const defaults = countryDefaults(input.country);

  await db.tx(async (tx) => {
    const at = now().toISOString();
    await tx.query(
      `insert into public.markets (
         slug, created_at, updated_at, name, country, currency, timezone, stage, tax_rate, tax_name,
         platform_fee_bps, urgent_surcharge_cents, after_hours_surcharge_cents, diagnosis_fee_cents, diagnosis_payout_cents,
         approval_threshold_cents, parts_included_cents, parts_approval_cents, offer_minutes, hours_start, hours_end, work_days,
         payout_hold_hours, referral_reward_cents, referral_paid_months, unaccepted_alert_hours, counter_offer_hours,
         min_minutes_on_site, owner_confirm_hours, payout_guarantee_cents, tier_threshold_cents, above_tier_fee_bps)
       values ($1, $2::timestamptz, $2::timestamptz, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::text[], $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)`,
      [
        slug, at, input.name.trim(), input.country, defaults.currency, input.timezone, defaults.taxRate, defaults.taxName,
        template?.platformFeeBps ?? 1500, template?.urgentSurchargeCents ?? 5000, template?.afterHoursSurchargeCents ?? 14000,
        template?.diagnosisFeeCents ?? 22500, template?.diagnosisPayoutCents ?? 19000, template?.approvalThresholdCents ?? 60000,
        template?.partsIncludedCents ?? 2000, template?.partsApprovalCents ?? 15000, template?.offerMinutes ?? 15,
        template?.hoursStart ?? 7, template?.hoursEnd ?? 16.5, template?.workDays ?? ["mon", "tue", "wed", "thu", "fri"],
        template?.payoutHoldHours ?? 24, template?.referralRewardCents ?? 10000, template?.referralPaidMonths ?? 3,
        template?.unacceptedAlertHours ?? 3, template?.counterOfferHours ?? 2,
        template?.minMinutesOnSite ?? 10, template?.ownerConfirmHours ?? 48, template?.payoutGuaranteeCents ?? 100000,
        template?.tierThresholdCents ?? 100000, template?.aboveTierFeeBps ?? 300,
      ],
    );
    let copiedTiers = 0;
    let copiedMenu = 0;
    if (template) {
      for (const tier of await listTiers(tx, template.slug)) {
        await tx.query(
          `insert into public.membership_tiers (market, key, name, price_cents, response_hours, urgent_response_hours, urgent_included, urgent_included_per_month, quarterly_check, blurb, sort, active, billing_basis, bands)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
          [slug, tier.key, tier.name, tier.monthlyPriceCents, tier.responseHours, tier.urgentResponseHours, tier.urgentIncluded, tier.urgentIncludedPerMonth, tier.quarterlyCheck, tier.blurb, tier.sort, tier.active, tier.billingBasis, JSON.stringify(tier.bands)],
        );
        copiedTiers += 1;
      }
      for (const item of await listMenu(tx, template.slug, { includeInactive: true })) {
        await tx.query(
          `insert into public.menu_items (market, code, trade, name, description, try_first, owner_price_cents, tradie_payout_cents, licence_required, guest_visible, sort, active)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [slug, item.code, item.trade, item.name, item.description, item.tryFirst, item.ownerPriceCents, item.tradiePayoutCents, item.licenceRequired, item.guestVisible, item.sort, item.active],
        );
        copiedMenu += 1;
      }
    }
    await audit(tx, { actor, action: "market.created", entity: "market", entityId: slug, detail: { name: input.name, country: input.country, copied_from: input.copyFrom, tiers: copiedTiers, menu_items: copiedMenu } });
  });
}

// ---------------------------------------------------------------------------
// THE PARTS PRICE LIST (DECISIONS.md, 2026-11-20)
// ---------------------------------------------------------------------------

export type PriceListInput = { id: string | null; code: string; name: string; priceCents: number; active: boolean; source: string };

/**
 * Adds or changes one part on a market's price list. A new price applies to
 * parts added from now on: parts already on a job keep the price they were
 * added at.
 */
export async function savePriceListItem(db: Db, market: string, input: PriceListInput, actor: string): Promise<string> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2,4}-[0-9]{2,3}$/.test(code)) throw new AdminInputError("The code must look like PTP-01: two to four letters, a dash, then a number.");
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) throw new AdminInputError("The part needs a name of up to 80 characters.");
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0 || input.priceCents > 1_000_000) throw new AdminInputError("The price must be more than zero.");
  const source = input.source.trim().slice(0, 400);
  let id = input.id;
  try {
    if (id) {
      if (!isUuid(id)) throw new AdminInputError("That part is not on the list.");
      const rows = await db.query(
        `update public.price_list_items set code = $3, name = $4, price_cents = $5, active = $6, source = $7, updated_at = $8::timestamptz
          where market = $1 and id = $2::uuid returning id`,
        [market, id, code, name, input.priceCents, input.active, source, now().toISOString()],
      );
      if (rows.length === 0) throw new AdminInputError("That part is not on the list.");
    } else {
      const rows = await db.query<{ id: string }>(
        `insert into public.price_list_items (market, code, name, price_cents, active, source, updated_at, sort)
         values ($1, $2, $3, $4, $5, $6, $7::timestamptz, (select coalesce(max(sort), 0) + 10 from public.price_list_items where market = $1))
         returning id`,
        [market, code, name, input.priceCents, input.active, source, now().toISOString()],
      );
      id = rows[0]!.id;
    }
  } catch (error) {
    if (error instanceof AdminInputError) throw error;
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") throw new AdminInputError(`There is already a part with the code ${code}.`);
    throw error;
  }
  await audit(db, { actor, action: "price_list.saved", entity: "market", entityId: market, amount: input.priceCents, detail: { code, name, price: input.priceCents, active: input.active } });
  return id!;
}
