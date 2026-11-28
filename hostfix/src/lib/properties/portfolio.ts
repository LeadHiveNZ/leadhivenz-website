import type { Market } from "@config/markets";
import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { isUniqueViolation, type Db } from "@/lib/db/types";
import { taxPortion } from "@/lib/jobs/pricing";
import { bandFor, highestPricedBand, lowestBand, minimumProperties } from "@/lib/markets/bands";
import { bookingOpen, inPreLaunch, ownersCanJoin, preLaunchWords } from "@/lib/markets/stage";
import { getMarket, getTier, listTiers, type Tier } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException } from "@/lib/ops/exceptions";
import { getBilling, getOwner, saveBilling } from "@/lib/owners/service";
import type { CardSummary, InvoiceSummary, PaymentsGateway, Provider, TierForBilling } from "@/lib/payments/gateway";
import { isUuid } from "@/lib/uuid";

/**
 * PORTFOLIO: ONE RETAINER FOR A WHOLE ACCOUNT (DECISIONS.md, 2026-11-17).
 *
 * An owner with one holiday home pays Essential for that property. A manager
 * with 10 or more properties picks Portfolio once, for the account. Every
 * property they add after that joins it, with no card page of its own, and
 * they pay one monthly retainer set by how many properties are on it:
 *
 *   10-24 NZ$600 · 25-49 NZ$900 · 50-99 NZ$1,200 · 100+ by arrangement
 *
 * The bands live on the tier in the database (src/lib/markets/bands.ts reads
 * them). Jobs at a Portfolio property are priced, charged and paid exactly as
 * at any other: only the access fee is different.
 *
 * Each property under a portfolio keeps the portfolio's status (active,
 * past_due, cancelled), so everything that asks "is this property covered?"
 * works unchanged. The subscription itself sits on the portfolio row.
 *
 * When a manager adds or removes a property, the band is checked again. If it
 * moves, the payment company is told the new amount for the NEXT monthly
 * payment (never a part-month charge), and the change is written to the audit
 * log. Two things go to a person instead of being decided here:
 *   - fewer than 10 properties: they stay on the lowest band until someone decides
 *   - 100 or more: they keep paying the 50-99 band until someone sets their price
 *
 * Every read takes the owner's id, except the ones named "ForStaff".
 */

export type PortfolioStatus = "setup" | "active" | "past_due" | "cancelled";

export type Portfolio = {
  id: string;
  createdAt: Date;
  ownerId: string;
  market: string;
  tierId: string;
  status: PortfolioStatus;
  subscriptionProvider: Provider | null;
  subscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  memberSince: Date | null;
  cancelledAt: Date | null;
  /** What the retainer charges from the next payment. Null until it is started. */
  bandCents: number | null;
  /** How many properties that amount was worked out from. */
  propertyCountBilled: number;
  bandVersion: number;
  /** A price a person agreed with the manager. While set, the band check never changes the price. */
  agreedCents: number | null;
};

type PortfolioRow = {
  id: string; created_at: Date; owner_id: string; market: string; tier_id: string; status: PortfolioStatus;
  subscription_provider: Provider | null; subscription_id: string | null; current_period_end: Date | null;
  cancel_at_period_end: boolean; member_since: Date | null; cancelled_at: Date | null; band_cents: number | null;
  property_count_billed: number; band_version: number; agreed_cents: number | null;
};

const date = (value: Date | null) => (value ? new Date(value) : null);
const numberOrNull = (value: number | null) => (value === null || value === undefined ? null : Number(value));

function rowToPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id, createdAt: new Date(row.created_at), ownerId: row.owner_id, market: row.market, tierId: row.tier_id, status: row.status,
    subscriptionProvider: row.subscription_provider, subscriptionId: row.subscription_id, currentPeriodEnd: date(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end, memberSince: date(row.member_since), cancelledAt: date(row.cancelled_at),
    bandCents: numberOrNull(row.band_cents), propertyCountBilled: Number(row.property_count_billed), bandVersion: Number(row.band_version),
    agreedCents: numberOrNull(row.agreed_cents),
  };
}

export class PortfolioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioError";
  }
}

// ---------------------------------------------------------------------------
// READING
// ---------------------------------------------------------------------------

/** One of this owner's portfolios, or null. Never another owner's. */
export async function getPortfolio(db: Db, ownerId: string, portfolioId: string): Promise<Portfolio | null> {
  if (!isUuid(portfolioId) || !isUuid(ownerId)) return null;
  const rows = await db.query<PortfolioRow>("select * from public.portfolios where id = $1::uuid and owner_id = $2::uuid", [portfolioId, ownerId]);
  return rows[0] ? rowToPortfolio(rows[0]) : null;
}

/** This owner's portfolios, open ones first. */
export async function listPortfolios(db: Db, ownerId: string): Promise<Portfolio[]> {
  if (!isUuid(ownerId)) return [];
  const rows = await db.query<PortfolioRow>("select * from public.portfolios where owner_id = $1::uuid order by (status = 'cancelled'), created_at", [ownerId]);
  return rows.map(rowToPortfolio);
}

/** The owner's portfolio in a market that has not ended, if they chose one. */
export async function openPortfolio(db: Db, ownerId: string, market: string): Promise<Portfolio | null> {
  if (!isUuid(ownerId)) return null;
  const rows = await db.query<PortfolioRow>(
    "select * from public.portfolios where owner_id = $1::uuid and market = $2 and status <> 'cancelled'",
    [ownerId, market],
  );
  return rows[0] ? rowToPortfolio(rows[0]) : null;
}

/** For staff and for the system itself. Not scoped to an owner. */
export async function getPortfolioForStaff(db: Db, portfolioId: string): Promise<Portfolio | null> {
  if (!isUuid(portfolioId)) return null;
  const rows = await db.query<PortfolioRow>("select * from public.portfolios where id = $1::uuid", [portfolioId]);
  return rows[0] ? rowToPortfolio(rows[0]) : null;
}

/** How many properties are on the portfolio now: every one that has not been removed. */
export async function countPortfolioProperties(db: Db, portfolioId: string): Promise<number> {
  const rows = await db.query<{ count: number }>(
    "select count(*) as count from public.properties where portfolio_id = $1::uuid and status <> 'cancelled'",
    [portfolioId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** The Portfolio membership a market offers, if any. */
export async function portfolioTier(db: Db, market: string): Promise<Tier | null> {
  return (await listTiers(db, market)).find((tier) => tier.active && tier.billingBasis === "per_account") ?? null;
}

// ---------------------------------------------------------------------------
// WHAT THE RETAINER SHOULD BE
// ---------------------------------------------------------------------------

export type Retainer = {
  cents: number;
  label: string;
  /** Set when a person has to look at it. The price above is what is billed until they do. */
  needsPerson: "below_minimum" | "by_arrangement" | null;
};

/**
 * The retainer for this many properties. An agreed price always wins. Fewer
 * than the minimum: the lowest band, flagged. A "by arrangement" count: the
 * highest priced band, flagged. Null only when the tier has no priced band.
 */
export function retainerFor(tier: Tier, propertyCount: number, agreedCents: number | null): Retainer | null {
  if (agreedCents !== null) return { cents: agreedCents, label: "agreed price", needsPerson: null };
  if (propertyCount < minimumProperties(tier)) {
    const lowest = lowestBand(tier);
    return lowest ? { ...lowest, needsPerson: "below_minimum" } : null;
  }
  const band = bandFor(tier, propertyCount);
  if (band) return { ...band, needsPerson: null };
  const highest = highestPricedBand(tier);
  return highest ? { ...highest, needsPerson: "by_arrangement" } : null;
}

const billingTier = (tier: Tier, cents: number): TierForBilling => ({
  id: tier.id, key: tier.key, name: tier.name, priceCents: cents, providerProductId: tier.providerProductId,
});

async function ownerName(db: Db, ownerId: string): Promise<string> {
  return (await getOwner(db, ownerId))?.name ?? "A Portfolio manager";
}

async function flagForPerson(db: Db, portfolio: Portfolio, market: Market, tier: Tier, count: number, retainer: Retainer): Promise<void> {
  if (!retainer.needsPerson) return;
  const name = await ownerName(db, portfolio.ownerId);
  const money = formatMoney(retainer.cents, market.currency);
  const summary =
    retainer.needsPerson === "below_minimum"
      ? `${name}'s Portfolio is down to ${count} ${count === 1 ? "property" : "properties"}, fewer than ${minimumProperties(tier)}. They stay on the lowest band (${money} a month) until you decide whether they stay on Portfolio. Nothing was moved automatically.`
      : `${name}'s Portfolio now has ${count} properties. ${count} is priced by arrangement: agree a retainer with them and set it on their page under Owners. Until then they keep paying ${money} a month (the ${retainer.label} band).`;
  await raiseException(db, {
    kind: "portfolio_band", market: portfolio.market, summary,
    dedupeKey: `portfolio_band:${portfolio.id}:${retainer.needsPerson}`,
  });
}

// ---------------------------------------------------------------------------
// CHOOSING AND STARTING
// ---------------------------------------------------------------------------

/**
 * Inside a step that is already open: the owner's portfolio in this market,
 * made now if they have none. Properties they added that have not started a
 * membership yet join it.
 */
export async function ensurePortfolioIn(tx: Db, ownerId: string, market: string, tier: Tier): Promise<Portfolio> {
  const existing = await openPortfolio(tx, ownerId, market);
  if (existing) return existing;
  const at = now().toISOString();
  const rows = await tx.query<PortfolioRow>(
    `insert into public.portfolios (created_at, owner_id, market, tier_id) values ($1::timestamptz, $2::uuid, $3, $4::uuid)
     on conflict (owner_id, market) where status <> 'cancelled' do nothing returning *`,
    [at, ownerId, market, tier.id],
  );
  if (!rows[0]) return (await openPortfolio(tx, ownerId, market))!;
  const portfolio = rowToPortfolio(rows[0]);
  const moved = await tx.query(
    `update public.properties set portfolio_id = $1::uuid, tier_id = $2::uuid
      where owner_id = $3::uuid and market = $4 and status = 'setup' and portfolio_id is null returning id`,
    [portfolio.id, tier.id, ownerId, market],
  );
  await audit(tx, { actor: `owner:${ownerId}`, action: "portfolio.chosen", entity: "portfolio", entityId: portfolio.id, detail: { market, tier: tier.key, properties_joined: moved.length } });
  return portfolio;
}

/**
 * The owner picks Portfolio for their account in one market. Safe to call twice. Choosing takes no card and starts
 * nothing, so it is open in pre-launch too (DECISIONS.md, 2026-11-27, second entry); starting the retainer is not.
 */
export async function choosePortfolio(db: Db, ownerId: string, marketSlug: string): Promise<Portfolio> {
  const market = await getMarket(db, marketSlug);
  if (!market || !ownersCanJoin(market)) throw new PortfolioError("We are not taking new members in that area right now.");
  const tier = await portfolioTier(db, market.slug);
  if (!tier) throw new PortfolioError("Portfolio is not offered in that area yet.");
  try {
    return await db.tx((tx) => ensurePortfolioIn(tx, ownerId, market.slug, tier));
  } catch (error) {
    // Two clicks at once: the other one made it.
    if (isUniqueViolation(error)) return (await openPortfolio(db, ownerId, market.slug))!;
    throw error;
  }
}

export type PortfolioStartResult =
  | { kind: "redirect"; url: string }
  | { kind: "active"; portfolio: Portfolio }
  | { kind: "error"; message: string };

/**
 * Starts the one retainer. Needs at least 10 properties on the account. For
 * 100 and more there is no price the app may set: the team is told, and the
 * manager can start once a person has set their price.
 */
export async function startPortfolio(
  db: Db,
  gateway: PaymentsGateway,
  input: { ownerId: string; portfolioId: string; successUrl: string; cancelUrl: string },
): Promise<PortfolioStartResult> {
  const portfolio = await getPortfolio(db, input.ownerId, input.portfolioId);
  const owner = await getOwner(db, input.ownerId);
  if (!portfolio || !owner || portfolio.status === "cancelled") return { kind: "error", message: "We could not find that Portfolio." };
  if (portfolio.status === "active" || portfolio.status === "past_due") return { kind: "active", portfolio };
  const market = await getMarket(db, portfolio.market);
  const tier = await getTier(db, portfolio.tierId);
  if (!market || !tier) return { kind: "error", message: "Portfolio is not available here any more. Please contact us." };
  // Pre-launch (DECISIONS.md, 2026-11-27, second entry): the retainer cannot start, and no card is asked for, until
  // the market is live. Refused before the payment company is asked for anything.
  if (inPreLaunch(market)) return { kind: "error", message: preLaunchWords.noCardYet(market.name) };
  if (!bookingOpen(market)) return { kind: "error", message: "We are not taking new members in that area right now." };

  const count = await countPortfolioProperties(db, portfolio.id);
  const minimum = minimumProperties(tier);
  if (count < minimum && portfolio.agreedCents === null) {
    return {
      kind: "error",
      message: `Portfolio is for ${minimum} or more properties. You have ${count} so far: add ${minimum - count} more, then start the retainer.`,
    };
  }
  const retainer = retainerFor(tier, count, portfolio.agreedCents);
  if (!retainer || retainer.needsPerson === "by_arrangement") {
    await raiseException(db, {
      kind: "portfolio_band", market: market.slug,
      summary: `${owner.name} wants to start Portfolio with ${count} properties. That many is priced by arrangement, so the app has not charged anything. Agree a retainer with them and set it on their page under Owners. They can then start it.`,
      dedupeKey: `portfolio_band:${portfolio.id}:start`,
    });
    return {
      kind: "error",
      message: `For ${count} properties we agree the retainer with you rather than charge a set band. Nothing has been charged. We have told the team, and someone will be in touch to agree it.`,
    };
  }

  const existing = await getBilling(db, input.ownerId, market.country);
  const usable = existing && existing.provider === gateway.provider ? existing : null;
  const customerId = await gateway.ensureCustomer({
    ownerId: owner.id, name: owner.name, email: owner.email, phone: owner.phone, existingCustomerId: usable?.customerId ?? null,
  });
  await saveBilling(db, { ownerId: owner.id, country: market.country, provider: gateway.provider, customerId });
  // The amount being asked for, kept so the band check knows where it starts from.
  await db.query(
    "update public.portfolios set band_cents = $3, property_count_billed = $4 where id = $1::uuid and owner_id = $2::uuid and status = 'setup'",
    [portfolio.id, owner.id, retainer.cents, count],
  );

  const started = await gateway.startMembership({
    customerId,
    paymentMethodId: usable?.paymentMethodId ?? null,
    ownerId: owner.id,
    propertyId: null,
    portfolioId: portfolio.id,
    propertyName: `Portfolio, ${count} properties`,
    tier: billingTier(tier, retainer.cents),
    market,
    // Portfolio has no discount (DECISIONS.md): its intro offer is a smaller pilot, not a lower price.
    discountCents: 0,
    discountLabel: null,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
  if (started.providerProductId && started.providerProductId !== tier.providerProductId) {
    await db.query("update public.membership_tiers set provider_product_id = $2 where id = $1::uuid", [tier.id, started.providerProductId]);
  }
  if (started.kind === "redirect") return { kind: "redirect", url: started.url };
  const activated = await activatePortfolio(db, {
    portfolioId: portfolio.id, provider: gateway.provider, subscriptionId: started.subscriptionId, periodEnd: started.periodEnd,
    invoice: started.invoice, card: started.card, customerId,
  });
  return activated ? { kind: "active", portfolio: activated } : { kind: "error", message: "The retainer could not be started. Please try again." };
}

export type PortfolioActivation = {
  portfolioId: string;
  provider: Provider;
  subscriptionId: string;
  periodEnd: Date;
  invoice: InvoiceSummary | null;
  card: CardSummary | null;
  customerId: string;
};

/**
 * The first retainer payment went through: the portfolio and every property
 * on it are covered. Safe to call twice (the card page tells us, and so does
 * the payment company a moment later).
 */
export async function activatePortfolio(db: Db, input: PortfolioActivation): Promise<Portfolio | null> {
  return db.tx(async (tx) => {
    const locked = await tx.query<PortfolioRow>("select * from public.portfolios where id = $1::uuid for update", [input.portfolioId]);
    if (!locked[0]) return null;
    const before = rowToPortfolio(locked[0]);
    const market = await getMarket(tx, before.market);
    const tier = await getTier(tx, before.tierId);
    if (!market || !tier) return null;
    const at = now();

    await saveBilling(tx, { ownerId: before.ownerId, country: market.country, provider: input.provider, customerId: input.customerId, card: input.card });
    const firstTime = before.subscriptionId !== input.subscriptionId || before.status === "setup";
    const updated = await tx.query<PortfolioRow>(
      `update public.portfolios set
          status = 'active', subscription_provider = $2, subscription_id = $3, current_period_end = $4::timestamptz,
          cancel_at_period_end = false, cancelled_at = null, member_since = coalesce(member_since, $5::timestamptz),
          band_cents = coalesce(band_cents, $6)
        where id = $1::uuid returning *`,
      [before.id, input.provider, input.subscriptionId, input.periodEnd.toISOString(), at.toISOString(), input.invoice?.amountCents || tier.monthlyPriceCents],
    );
    const portfolio = rowToPortfolio(updated[0]!);
    // Every property on it is now covered.
    await tx.query(
      `update public.properties set status = 'active', cancelled_at = null, cancel_at_period_end = false,
              member_since = coalesce(member_since, $2::timestamptz)
        where portfolio_id = $1::uuid and status in ('setup', 'past_due')`,
      [portfolio.id, at.toISOString()],
    );
    if (firstTime) {
      await audit(tx, {
        actor: input.provider, action: "portfolio.started", entity: "portfolio", entityId: portfolio.id,
        amount: portfolio.bandCents, currency: market.currency,
        detail: { tier: tier.key, subscription: input.subscriptionId, properties: portfolio.propertyCountBilled },
        dedupeKey: `portfolio.started:${input.provider}:${input.subscriptionId}`,
      });
    }
    if (input.invoice) await recordPortfolioInvoice(tx, portfolio, market, input.invoice, input.provider, "paid");
    return portfolio;
  });
}

async function recordPortfolioInvoice(
  db: Db, portfolio: Portfolio, market: Market, invoice: InvoiceSummary, provider: Provider, status: "paid" | "failed",
): Promise<boolean> {
  const rows = await db.query(
    `insert into public.membership_invoices
       (created_at, portfolio_id, owner_id, provider, provider_invoice_id, amount_cents, list_cents, tax_cents, currency, status, period_start, period_end, paid_at)
     values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::timestamptz)
     on conflict (provider, provider_invoice_id) do update set status = excluded.status, paid_at = excluded.paid_at
       where public.membership_invoices.status <> excluded.status
     returning id`,
    [
      now().toISOString(), portfolio.id, portfolio.ownerId, provider, invoice.invoiceId, invoice.amountCents, portfolio.bandCents ?? invoice.amountCents,
      market.taxRegistered ? taxPortion(invoice.amountCents, market.taxRate) : 0, invoice.currency.toUpperCase(), status,
      invoice.periodStart.toISOString(), invoice.periodEnd.toISOString(), status === "paid" ? invoice.paidAt.toISOString() : null,
    ],
  );
  if (rows.length === 0) return false;
  await audit(db, {
    actor: provider, action: status === "paid" ? "portfolio.paid" : "portfolio.payment_failed", entity: "portfolio", entityId: portfolio.id,
    amount: invoice.amountCents, currency: invoice.currency, detail: { invoice: invoice.invoiceId, properties: portfolio.propertyCountBilled },
    dedupeKey: `portfolio.${status}:${provider}:${invoice.invoiceId}`,
  });
  return true;
}

// ---------------------------------------------------------------------------
// WHAT THE PAYMENT COMPANY TELLS US. Each takes a step that is already open
// (called from the matching function in service.ts, which finds a property's
// own membership first and a portfolio second).
// ---------------------------------------------------------------------------

export async function lockPortfolioBySubscription(tx: Db, provider: Provider, subscriptionId: string): Promise<Portfolio | null> {
  const rows = await tx.query<PortfolioRow>(
    "select * from public.portfolios where subscription_provider = $1 and subscription_id = $2 for update",
    [provider, subscriptionId],
  );
  return rows[0] ? rowToPortfolio(rows[0]) : null;
}

/** A monthly retainer payment went through. */
export async function renewPortfolioIn(tx: Db, portfolio: Portfolio, provider: Provider, invoice: InvoiceSummary): Promise<boolean> {
  const market = await getMarket(tx, portfolio.market);
  if (!market) return false;
  const fresh = await recordPortfolioInvoice(tx, portfolio, market, invoice, provider, "paid");
  await tx.query(
    `update public.portfolios set status = case when status = 'cancelled' then status else 'active' end,
            current_period_end = greatest(coalesce(current_period_end, $2::timestamptz), $2::timestamptz)
      where id = $1::uuid`,
    [portfolio.id, invoice.periodEnd.toISOString()],
  );
  if (portfolio.status !== "cancelled") {
    await tx.query("update public.properties set status = 'active' where portfolio_id = $1::uuid and status = 'past_due'", [portfolio.id]);
  }
  return fresh;
}

/** A monthly retainer payment failed. No new jobs at any of its properties until the card is fixed. */
export async function portfolioPaymentFailedIn(tx: Db, portfolio: Portfolio, provider: Provider, invoice: InvoiceSummary, updateCardUrl: string): Promise<boolean> {
  const market = await getMarket(tx, portfolio.market);
  const owner = await getOwner(tx, portfolio.ownerId);
  if (!market || !owner) return false;
  const fresh = await recordPortfolioInvoice(tx, portfolio, market, invoice, provider, "failed");
  if (!fresh) return false;
  await tx.query("update public.portfolios set status = 'past_due' where id = $1::uuid and status = 'active'", [portfolio.id]);
  await tx.query("update public.properties set status = 'past_due' where portfolio_id = $1::uuid and status = 'active'", [portfolio.id]);
  if (owner.phone) {
    await enqueue(tx, {
      channel: "sms", to: owner.phone, template: "membership_failed", audience: "owner", userId: owner.userId,
      body: texts.membershipFailed({ property: "your Portfolio", link: updateCardUrl }),
      dedupeKey: `membership_failed:${invoice.invoiceId}`,
    });
  }
  return true;
}

/** The retainer has ended: every property on it stops being covered. */
export async function endPortfolioIn(tx: Db, portfolio: Portfolio, provider: Provider, subscriptionId: string): Promise<boolean> {
  if (portfolio.status === "cancelled") return false;
  const at = now().toISOString();
  await tx.query("update public.portfolios set status = 'cancelled', cancelled_at = $2::timestamptz, cancel_at_period_end = false where id = $1::uuid", [portfolio.id, at]);
  await tx.query(
    "update public.properties set status = 'cancelled', cancelled_at = $2::timestamptz, cancel_at_period_end = false where portfolio_id = $1::uuid and status <> 'cancelled'",
    [portfolio.id, at],
  );
  await audit(tx, { actor: provider, action: "portfolio.ended", entity: "portfolio", entityId: portfolio.id, detail: { subscription: subscriptionId }, dedupeKey: `portfolio.ended:${provider}:${subscriptionId}` });
  return true;
}

// ---------------------------------------------------------------------------
// THE BAND CHECK
// ---------------------------------------------------------------------------

export type BandCheck = { propertyCount: number; cents: number | null; changed: boolean };

/**
 * Works the band out again after a property was added or removed. If the
 * retainer moves, the payment company is told the new amount for the next
 * monthly payment, and the change is audited, all while the portfolio is
 * locked so two changes at once cannot cross. If the call to the payment
 * company fails, nothing is recorded and the next check tries again. Safe to
 * call twice: the second call finds nothing to change.
 */
export async function rebandPortfolio(db: Db, gateway: PaymentsGateway | null, portfolioId: string, actor: string): Promise<BandCheck> {
  return db.tx(async (tx) => {
    const locked = await tx.query<PortfolioRow>("select * from public.portfolios where id = $1::uuid for update", [portfolioId]);
    if (!locked[0]) return { propertyCount: 0, cents: null, changed: false };
    const portfolio = rowToPortfolio(locked[0]);
    const count = await countPortfolioProperties(tx, portfolio.id);
    const market = await getMarket(tx, portfolio.market);
    const tier = await getTier(tx, portfolio.tierId);
    const paying = portfolio.status === "active" || portfolio.status === "past_due";
    if (!market || !tier || !paying || !portfolio.subscriptionId) {
      await tx.query("update public.portfolios set property_count_billed = $2 where id = $1::uuid and status = 'setup'", [portfolio.id, count]);
      return { propertyCount: count, cents: portfolio.bandCents, changed: false };
    }

    const retainer = retainerFor(tier, count, portfolio.agreedCents);
    if (!retainer) return { propertyCount: count, cents: portfolio.bandCents, changed: false };
    await flagForPerson(tx, portfolio, market, tier, count, retainer);

    if (retainer.cents === portfolio.bandCents) {
      await tx.query("update public.portfolios set property_count_billed = $2 where id = $1::uuid", [portfolio.id, count]);
      return { propertyCount: count, cents: retainer.cents, changed: false };
    }

    const version = portfolio.bandVersion + 1;
    const money = formatMoney(retainer.cents, market.currency);
    if (!gateway || gateway.provider !== portfolio.subscriptionProvider) {
      // Card payments are not reachable from here, so the price cannot be changed safely. A person does it.
      await raiseException(tx, {
        kind: "portfolio_band", market: market.slug,
        summary: `${await ownerName(tx, portfolio.ownerId)}'s Portfolio now has ${count} properties and should move to ${money} a month (${retainer.label}), but card payments could not be reached to change it. Change the retainer by hand on their page under Owners.`,
        dedupeKey: `portfolio_band:${portfolio.id}:unreachable:v${version}`,
      });
      return { propertyCount: count, cents: portfolio.bandCents, changed: false };
    }

    await gateway.changeMembershipPrice({
      subscriptionId: portfolio.subscriptionId,
      tier: billingTier(tier, retainer.cents),
      market,
      idempotencyKey: `hostfix-band-${portfolio.id}-v${version}-${retainer.cents}`,
    });
    await tx.query(
      "update public.portfolios set band_cents = $2, band_version = $3, property_count_billed = $4 where id = $1::uuid",
      [portfolio.id, retainer.cents, version, count],
    );
    await audit(tx, {
      actor, action: "portfolio.band_changed", entity: "portfolio", entityId: portfolio.id, amount: retainer.cents, currency: market.currency,
      detail: {
        from_cents: portfolio.bandCents, to_cents: retainer.cents, band: retainer.label, properties: count,
        from_properties: portfolio.propertyCountBilled, starts: portfolio.currentPeriodEnd?.toISOString() ?? null,
      },
      dedupeKey: `portfolio.band_changed:${portfolio.id}:v${version}`,
    });
    return { propertyCount: count, cents: retainer.cents, changed: true };
  });
}

/**
 * The band check after an owner adds or takes off a property. The property
 * change has already been saved, so a payment company that cannot be reached
 * must not undo it or show the owner an error: nothing about the band is
 * recorded, a person is told, and the next check (another change, or the
 * admin saving the retainer) tries again.
 */
export async function rebandOrFlag(db: Db, gateway: PaymentsGateway | null, portfolioId: string, actor: string): Promise<BandCheck | null> {
  try {
    return await rebandPortfolio(db, gateway, portfolioId, actor);
  } catch (error) {
    console.error("[portfolio] the band check failed:", error instanceof Error ? error.message : error);
    const portfolio = await getPortfolioForStaff(db, portfolioId);
    if (portfolio) {
      await raiseException(db, {
        kind: "portfolio_band", market: portfolio.market,
        summary: `${await ownerName(db, portfolio.ownerId)}'s Portfolio changed size, but the payment company could not be reached to change the retainer. Open their page under Owners and press Save retainer to try again.`,
        dedupeKey: `portfolio_band:${portfolio.id}:failed`,
      });
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// THE OWNER'S OTHER BUTTONS
// ---------------------------------------------------------------------------

/**
 * Takes a property off the portfolio, from now. It stops being covered at
 * once (there is no part-month refund: the retainer is for the account), and
 * the band is checked again for the next payment.
 */
export async function removeFromPortfolio(db: Db, gateway: PaymentsGateway | null, ownerId: string, propertyId: string): Promise<boolean> {
  const removed = await db.tx(async (tx) => {
    const rows = await tx.query<{ portfolio_id: string }>(
      `update public.properties set status = 'cancelled', cancelled_at = $3::timestamptz, cancel_at_period_end = false
        where id = $1::uuid and owner_id = $2::uuid and portfolio_id is not null and status <> 'cancelled' returning portfolio_id`,
      [propertyId, ownerId, now().toISOString()],
    );
    if (!rows[0]) return null;
    await audit(tx, { actor: `owner:${ownerId}`, action: "portfolio.property_removed", entity: "property", entityId: propertyId, detail: { portfolio: rows[0].portfolio_id } });
    return rows[0].portfolio_id;
  });
  if (!removed) return false;
  await rebandOrFlag(db, gateway, removed, `owner:${ownerId}`);
  return true;
}

/** Puts a property (removed earlier, or never started) back on the owner's portfolio. */
export async function joinPortfolio(db: Db, gateway: PaymentsGateway | null, ownerId: string, propertyId: string, portfolio: Portfolio): Promise<boolean> {
  if (portfolio.ownerId !== ownerId || portfolio.status === "cancelled") return false;
  const status = portfolio.status === "active" || portfolio.status === "past_due" ? portfolio.status : "setup";
  const rows = await db.query(
    `update public.properties set portfolio_id = $3::uuid, tier_id = $4::uuid, status = $5, cancelled_at = null, cancel_at_period_end = false,
            subscription_provider = null, subscription_id = null,
            member_since = case when $5 = 'setup' then member_since else coalesce(member_since, $6::timestamptz) end
      where id = $1::uuid and owner_id = $2::uuid and market = $7 and status in ('setup', 'cancelled') returning id`,
    [propertyId, ownerId, portfolio.id, portfolio.tierId, status, now().toISOString(), portfolio.market],
  );
  if (rows.length === 0) return false;
  await audit(db, { actor: `owner:${ownerId}`, action: "portfolio.property_joined", entity: "property", entityId: propertyId, detail: { portfolio: portfolio.id } });
  await rebandOrFlag(db, gateway, portfolio.id, `owner:${ownerId}`);
  return true;
}

/**
 * The owner asked to end the retainer. A paying one runs to the end of the
 * month already paid for. One that never started ends now, and its
 * properties go back to choosing a membership of their own.
 */
export async function cancelPortfolio(db: Db, gateway: PaymentsGateway | null, ownerId: string, portfolioId: string): Promise<Portfolio | null> {
  const portfolio = await getPortfolio(db, ownerId, portfolioId);
  if (!portfolio) return null;
  if (portfolio.status === "cancelled" || portfolio.cancelAtPeriodEnd) return portfolio;
  if (portfolio.status === "setup") {
    await db.tx(async (tx) => {
      await tx.query("update public.portfolios set status = 'cancelled', cancelled_at = $2::timestamptz where id = $1::uuid", [portfolio.id, now().toISOString()]);
      await tx.query("update public.properties set portfolio_id = null, tier_id = null where portfolio_id = $1::uuid and status = 'setup'", [portfolio.id]);
      await audit(tx, { actor: `owner:${ownerId}`, action: "portfolio.cancelled", entity: "portfolio", entityId: portfolio.id, detail: { started: false } });
    });
    return getPortfolio(db, ownerId, portfolioId);
  }
  if (portfolio.subscriptionId && gateway && gateway.provider === portfolio.subscriptionProvider) {
    await gateway.cancelMembership(portfolio.subscriptionId);
  }
  await db.query("update public.portfolios set cancel_at_period_end = true where id = $1::uuid and owner_id = $2::uuid", [portfolio.id, ownerId]);
  await db.query("update public.properties set cancel_at_period_end = true, current_period_end = $2::timestamptz where portfolio_id = $1::uuid and status <> 'cancelled'", [
    portfolio.id,
    portfolio.currentPeriodEnd?.toISOString() ?? null,
  ]);
  await audit(db, { actor: `owner:${ownerId}`, action: "portfolio.cancel_requested", entity: "portfolio", entityId: portfolio.id, detail: { ends: portfolio.currentPeriodEnd?.toISOString() ?? null } });
  return getPortfolio(db, ownerId, portfolioId);
}

/**
 * Staff only: a retainer agreed with the manager by a person (100 and more
 * properties are by arrangement), or null to go back to the bands. Takes
 * effect from the next monthly payment, like every band change.
 */
export async function setAgreedRetainer(db: Db, gateway: PaymentsGateway | null, portfolioId: string, agreedCents: number | null, actor: string): Promise<BandCheck | null> {
  if (agreedCents !== null && (!Number.isInteger(agreedCents) || agreedCents <= 0 || agreedCents > 5_000_000)) {
    throw new PortfolioError("Enter the agreed retainer as an amount more than zero, or leave it empty to go back to the bands.");
  }
  const portfolio = await getPortfolioForStaff(db, portfolioId);
  if (!portfolio) return null;
  await db.query("update public.portfolios set agreed_cents = $2 where id = $1::uuid", [portfolio.id, agreedCents]);
  await audit(db, { actor, action: "portfolio.agreed_price_set", entity: "portfolio", entityId: portfolio.id, amount: agreedCents, detail: { before: portfolio.agreedCents } });
  return rebandPortfolio(db, gateway, portfolio.id, actor);
}
