import { isUuid } from "@/lib/uuid";
import type { Market } from "@config/markets";
import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { randomToken } from "@/lib/ids";
import { taxPortion } from "@/lib/jobs/pricing";
import { areaForSuburb } from "@/lib/markets/areas";
import { bookingOpen, inPreLaunch, ownersCanJoin, preLaunchWords } from "@/lib/markets/stage";
import { getMarket, getTier, type Tier } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException } from "@/lib/ops/exceptions";
import { getBilling, getOwner, saveBilling, unusedDeposit } from "@/lib/owners/service";
import type { CardSummary, InvoiceSummary, PaymentsGateway, Provider } from "@/lib/payments/gateway";
import { monthKey } from "@/lib/time";
import {
  endPortfolioIn, ensurePortfolioIn, joinPortfolio, lockPortfolioBySubscription, openPortfolio, portfolioPaymentFailedIn, rebandOrFlag,
  removeFromPortfolio, renewPortfolioIn,
} from "./portfolio";

/**
 * PROPERTIES AND THEIR MEMBERSHIPS.
 *
 * Every read here takes the owner's id and puts it in the query, so one owner
 * can never be handed another owner's property. Functions for staff, which
 * skip that, say so in their name.
 */

export type PropertyStatus = "setup" | "active" | "past_due" | "cancelled";

export type Property = {
  id: string;
  createdAt: Date;
  ownerId: string;
  market: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  suburb: string;
  postcode: string;
  accessNotes: string;
  tierId: string | null;
  status: PropertyStatus;
  subscriptionProvider: Provider | null;
  subscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  memberSince: Date | null;
  cancelledAt: Date | null;
  teamToken: string;
  guestToken: string;
  guestAutoDispatch: boolean;
  spendLimitCents: number | null;
  referrerId: string | null;
  /** Set when the property is under a Portfolio account: its cover comes from the one retainer, not its own membership. */
  portfolioId: string | null;
  /** The property's map pin (DECISIONS.md, 2026-11-19). Null until it is looked up or placed. */
  pin: { lat: number; lng: number } | null;
  /** looked_up: found from the address. owner_moved: placed or moved by the owner. none: no pin yet. */
  pinSource: PinSource;
  /** The owner said "Yes, the pin is on the house". */
  pinConfirmedAt: Date | null;
  /** When the address was last looked up. */
  pinLookupAt: Date | null;
  /** "Anything a tradie should know to stay safe?" From the owner, and hazards tradies have found (DECISIONS.md, 2026-11-20). */
  hazards: string;
  /** The key of the market's service area it is in (DECISIONS.md, 2026-11-26). Null: none matched; offered to every tradie. */
  area: string | null;
};

export type PinSource = "looked_up" | "owner_moved" | "none";

type PropertyRow = {
  id: string; created_at: Date; owner_id: string; market: string; name: string; address_line1: string;
  address_line2: string | null; suburb: string; postcode: string; access_notes: string; tier_id: string | null;
  status: PropertyStatus; subscription_provider: Provider | null; subscription_id: string | null;
  current_period_end: Date | null; cancel_at_period_end: boolean; member_since: Date | null; cancelled_at: Date | null;
  team_token: string; guest_token: string; guest_auto_dispatch: boolean; spend_limit_cents: number | null; referrer_id: string | null;
  portfolio_id: string | null;
  pin_lat?: number | string | null; pin_lng?: number | string | null; pin_source?: PinSource | null;
  pin_confirmed_at?: Date | null; pin_lookup_at?: Date | null; hazards?: string | null; area?: string | null;
};

const date = (value: Date | null) => (value ? new Date(value) : null);

export function rowToProperty(row: PropertyRow): Property {
  return {
    id: row.id, createdAt: new Date(row.created_at), ownerId: row.owner_id, market: row.market, name: row.name,
    addressLine1: row.address_line1, addressLine2: row.address_line2, suburb: row.suburb, postcode: row.postcode,
    accessNotes: row.access_notes, tierId: row.tier_id, status: row.status, subscriptionProvider: row.subscription_provider,
    subscriptionId: row.subscription_id, currentPeriodEnd: date(row.current_period_end), cancelAtPeriodEnd: row.cancel_at_period_end,
    memberSince: date(row.member_since), cancelledAt: date(row.cancelled_at), teamToken: row.team_token, guestToken: row.guest_token,
    guestAutoDispatch: row.guest_auto_dispatch, spendLimitCents: row.spend_limit_cents, referrerId: row.referrer_id,
    portfolioId: row.portfolio_id ?? null,
    pin: row.pin_lat === null || row.pin_lat === undefined || row.pin_lng === null || row.pin_lng === undefined ? null : { lat: Number(row.pin_lat), lng: Number(row.pin_lng) },
    pinSource: row.pin_source ?? "none",
    pinConfirmedAt: date(row.pin_confirmed_at ?? null),
    pinLookupAt: date(row.pin_lookup_at ?? null),
    hazards: row.hazards ?? "",
    area: row.area ?? null,
  };
}

/** One line: "14B Lake Esplanade, Frankton 9300". */
export function addressLine(property: Pick<Property, "addressLine1" | "addressLine2" | "suburb" | "postcode">): string {
  return [property.addressLine1, property.addressLine2, [property.suburb, property.postcode].filter(Boolean).join(" ")]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export type PropertyInput = {
  market: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  suburb: string;
  postcode: string;
  accessNotes: string;
  /** Anything a tradie should know to stay safe. */
  hazards?: string;
  /** The service area chosen (a key of the market's areas). Left out or empty, it is worked out from the suburb. */
  area?: string | null;
  tierId: string;
  /** A cleaner's or co-host's referral code, if the owner was sent by one. */
  referralCode?: string | null;
};

export class PropertyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyError";
  }
}

async function tierForMarket(db: Db, tierId: string, market: string): Promise<Tier> {
  const tier = await getTier(db, tierId);
  if (!tier || tier.market !== market || !tier.active) throw new PropertyError("That membership is not available here.");
  return tier;
}

/**
 * Adds a property. If the owner has a Portfolio in that market (or picks the
 * Portfolio membership here, which sets one up for the whole account), the
 * property joins it: no membership of its own, covered at once if the
 * retainer is already paid, and the band is checked again. The gateway is
 * needed for that check to change the retainer; without one a person is told.
 */
export async function createProperty(db: Db, ownerId: string, input: PropertyInput, gateway: PaymentsGateway | null = null): Promise<Property> {
  const created = await db.tx(async (tx) => {
    const market = await getMarket(tx, input.market);
    // Live, or on the waiting list with pre-launch on (DECISIONS.md, 2026-11-27, second entry): the property is
    // saved either way. In pre-launch it stays "setup" until the market is live and a card is on file.
    if (!market || !ownersCanJoin(market)) throw new PropertyError("We are not taking new properties in that area yet.");
    const chosen = await tierForMarket(tx, input.tierId, market.slug);
    const portfolio = chosen.billingBasis === "per_account" ? await ensurePortfolioIn(tx, ownerId, market.slug, chosen) : await openPortfolio(tx, ownerId, market.slug);
    const covered = portfolio && (portfolio.status === "active" || portfolio.status === "past_due") ? portfolio.status : null;

    let referrerId: string | null = null;
    if (input.referralCode) {
      const found = await tx.query<{ id: string }>("select id from public.referrers where code = $1", [input.referralCode.trim().toUpperCase()]);
      referrerId = found[0]?.id ?? null;
    }

    const at = now().toISOString();
    const rows = await tx.query<PropertyRow>(
      `insert into public.properties
         (created_at, owner_id, market, name, address_line1, address_line2, suburb, postcode, access_notes, tier_id, team_token, guest_token, referrer_id,
          portfolio_id, status, member_since, hazards, area)
       values ($1::timestamptz, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11, $12, $13::uuid, $14::uuid, $15, $16::timestamptz, $17, $18)
       returning *`,
      [
        at, ownerId, market.slug, input.name.trim(), input.addressLine1.trim(), input.addressLine2?.trim() || null,
        input.suburb.trim(), input.postcode.trim(), input.accessNotes.trim(), portfolio?.tierId ?? input.tierId, randomToken(20), randomToken(20), referrerId,
        portfolio?.id ?? null, covered ?? "setup", covered ? at : null, (input.hazards ?? "").trim().slice(0, 3000),
        chooseArea(market, input.area, input.suburb),
      ],
    );
    const property = rowToProperty(rows[0]!);
    await audit(tx, {
      actor: `owner:${ownerId}`, action: "property.created", entity: "property", entityId: property.id,
      detail: { market: market.slug, referred: Boolean(referrerId), portfolio: portfolio?.id ?? null },
    });
    return { property, rebandPortfolio: covered ? portfolio!.id : null };
  });
  if (created.rebandPortfolio) await rebandOrFlag(db, gateway, created.rebandPortfolio, `owner:${ownerId}`);
  return created.property;
}

export type PropertyRowInput = Pick<PropertyInput, "name" | "addressLine1" | "suburb" | "postcode" | "accessNotes">;

/**
 * "Add many at once": every row is saved in one step, each through the same
 * path as adding one property, so Portfolio and the audit log work as usual.
 * Free to join (DECISIONS.md, 2026-11-17): with a card already on file each
 * one is covered straight away, exactly as pressing "Cover this property"
 * would. In pre-launch (DECISIONS.md, 2026-11-27, second entry) they are only
 * saved: nothing is covered and the payment company is never asked.
 * `gatewayFor` makes the payment company's gateway for the step everything is
 * saved in, so anything it writes is undone with the rest if a row fails.
 */
export async function createProperties(
  db: Db, ownerId: string, input: { market: string; tierId: string; rows: PropertyRowInput[] }, gatewayFor: (inner: Db) => PaymentsGateway | null,
): Promise<Property[]> {
  const market = await getMarket(db, input.market);
  if (!market || !ownersCanJoin(market)) throw new PropertyError("We are not taking new properties in that area yet.");
  const open = bookingOpen(market);
  return db.tx(async (tx) => {
    const gateway = open ? gatewayFor(tx) : null;
    const card = open ? await getBilling(tx, ownerId, market.country) : null;
    const saved: Property[] = [];
    for (const row of input.rows) {
      const created = await createProperty(tx, ownerId, { ...row, market: market.slug, tierId: input.tierId }, gateway);
      const covered = created.status === "setup" && card?.paymentMethodId && gateway && card.provider === gateway.provider
        ? await activateFreeMembership(tx, { propertyId: created.id, ownerId, provider: card.provider, customerId: card.customerId, card: null })
        : null;
      saved.push(covered ?? created);
    }
    return saved;
  });
}

/**
 * The property's service area (DECISIONS.md, 2026-11-26): the one chosen if the
 * market has it, otherwise worked out from the suburb, otherwise null.
 */
export function chooseArea(market: Pick<Market, "areas">, chosen: string | null | undefined, suburb: string): string | null {
  if (chosen && market.areas.some((area) => area.key === chosen)) return chosen;
  return areaForSuburb(market.areas, suburb);
}

/**
 * Staff set (or clear) a property's service area from the admin owner page,
 * for a suburb the list did not match. Null clears it: offered to everyone.
 */
export async function setPropertyAreaForStaff(db: Db, propertyId: string, area: string | null, actor: string): Promise<Property | null> {
  const current = await getPropertyForStaff(db, propertyId);
  if (!current) return null;
  const market = await getMarket(db, current.market);
  if (area !== null && !market?.areas.some((candidate) => candidate.key === area)) throw new PropertyError("That area is not in this property's market.");
  const rows = await db.query<PropertyRow>("update public.properties set area = $2 where id = $1::uuid returning *", [propertyId, area]);
  await audit(db, { actor, action: "property.area_set", entity: "property", entityId: propertyId, detail: { area, before: current.area } });
  return rows[0] ? rowToProperty(rows[0]) : null;
}

export type PropertyPatch = Partial<Pick<PropertyInput, "name" | "addressLine1" | "addressLine2" | "suburb" | "postcode" | "accessNotes" | "hazards" | "area">> & {
  guestAutoDispatch?: boolean;
  spendLimitCents?: number | null;
};

export async function updateProperty(db: Db, ownerId: string, propertyId: string, patch: PropertyPatch): Promise<Property | null> {
  const current = await getProperty(db, ownerId, propertyId);
  if (!current) return null;
  // A new street address means the old map pin may be somewhere else: it is cleared, and looked up again (DECISIONS.md, 2026-11-19).
  const moved = (patch.addressLine1 !== undefined && patch.addressLine1.trim() !== current.addressLine1)
    || (patch.suburb !== undefined && patch.suburb.trim() !== current.suburb)
    || (patch.postcode !== undefined && patch.postcode.trim() !== current.postcode);
  // The area: the one chosen; or, when none is chosen and the suburb changed, worked out again from the new suburb.
  const suburb = patch.suburb?.trim() ?? current.suburb;
  const suburbChanged = suburb !== current.suburb;
  let area = current.area;
  if (patch.area || suburbChanged) {
    const market = await getMarket(db, current.market);
    area = market ? chooseArea(market, patch.area, suburb) : current.area;
  }
  const rows = await db.query<PropertyRow>(
    `update public.properties set
        name = $3, address_line1 = $4, address_line2 = $5, suburb = $6, postcode = $7, access_notes = $8,
        guest_auto_dispatch = $9, spend_limit_cents = $10, hazards = $12, area = $13,
        pin_lat = case when $11::boolean then null else pin_lat end,
        pin_lng = case when $11::boolean then null else pin_lng end,
        pin_source = case when $11::boolean then 'none' else pin_source end,
        pin_confirmed_at = case when $11::boolean then null else pin_confirmed_at end,
        pin_lookup_at = case when $11::boolean then null else pin_lookup_at end
      where id = $1::uuid and owner_id = $2::uuid
      returning *`,
    [
      propertyId, ownerId,
      patch.name?.trim() ?? current.name,
      patch.addressLine1?.trim() ?? current.addressLine1,
      patch.addressLine2 === undefined ? current.addressLine2 : patch.addressLine2?.trim() || null,
      patch.suburb?.trim() ?? current.suburb,
      patch.postcode?.trim() ?? current.postcode,
      patch.accessNotes?.trim() ?? current.accessNotes,
      patch.guestAutoDispatch ?? current.guestAutoDispatch,
      patch.spendLimitCents === undefined ? current.spendLimitCents : patch.spendLimitCents,
      moved,
      patch.hazards === undefined ? current.hazards : patch.hazards.trim().slice(0, 3000),
      area,
    ],
  );
  await audit(db, { actor: `owner:${ownerId}`, action: "property.updated", entity: "property", entityId: propertyId, detail: { fields: Object.keys(patch), pin_cleared: moved && current.pin !== null } });
  return rows[0] ? rowToProperty(rows[0]) : null;
}

/** One of this owner's properties, or null. Never another owner's. */
export async function getProperty(db: Db, ownerId: string, propertyId: string): Promise<Property | null> {
  if (!isUuid(propertyId)) return null;
  const rows = await db.query<PropertyRow>("select * from public.properties where id = $1::uuid and owner_id = $2::uuid", [propertyId, ownerId]);
  return rows[0] ? rowToProperty(rows[0]) : null;
}

export async function listProperties(db: Db, ownerId: string): Promise<Property[]> {
  const rows = await db.query<PropertyRow>(
    "select * from public.properties where owner_id = $1::uuid order by (status = 'cancelled'), created_at",
    [ownerId],
  );
  return rows.map(rowToProperty);
}

/** For staff and for the system itself. Not scoped to an owner. */
export async function getPropertyForStaff(db: Db, propertyId: string): Promise<Property | null> {
  if (!isUuid(propertyId)) return null;
  const rows = await db.query<PropertyRow>("select * from public.properties where id = $1::uuid", [propertyId]);
  return rows[0] ? rowToProperty(rows[0]) : null;
}

/**
 * The property a report link belongs to. "team" links are for cleaners and
 * co-hosts. "guest" links are the QR code in the property.
 */
export async function findPropertyByReportToken(db: Db, token: string): Promise<{ property: Property; via: "team" | "guest" } | null> {
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return null;
  const rows = await db.query<PropertyRow>("select * from public.properties where team_token = $1 or guest_token = $1", [token]);
  const row = rows[0];
  if (!row) return null;
  return { property: rowToProperty(row), via: row.team_token === token ? "team" : "guest" };
}

/** Makes a new report link, which stops the old one (and any printed QR code) working. */
export async function rotateReportLink(db: Db, ownerId: string, propertyId: string, which: "team" | "guest"): Promise<Property | null> {
  const column = which === "team" ? "team_token" : "guest_token";
  const rows = await db.query<PropertyRow>(
    `update public.properties set ${column} = $3 where id = $1::uuid and owner_id = $2::uuid returning *`,
    [propertyId, ownerId, randomToken(20)],
  );
  if (!rows[0]) return null;
  await audit(db, { actor: `owner:${ownerId}`, action: "property.link_replaced", entity: "property", entityId: propertyId, detail: { which } });
  return rowToProperty(rows[0]);
}

// ---------------------------------------------------------------------------
// MEMBERSHIP
// ---------------------------------------------------------------------------

export type MembershipStartResult =
  | { kind: "redirect"; url: string }
  | { kind: "active"; property: Property }
  | { kind: "error"; message: string };

/**
 * Starts the membership for a property.
 *
 * A free membership (price 0, DECISIONS.md 2026-11-17) is "card on file": no
 * subscription and no monthly payment. With a card already saved the property
 * is covered at once. Without one, the owner is sent to the payment company's
 * page to save a card, with nothing charged, and covered when they come back.
 *
 * A priced membership: the first time, the owner is sent to a card page.
 * After that their saved card is used and the property is a member straight
 * away.
 */
export async function startMembership(
  db: Db,
  gateway: PaymentsGateway,
  input: { ownerId: string; propertyId: string; successUrl: string; cancelUrl: string },
): Promise<MembershipStartResult> {
  const property = await getProperty(db, input.ownerId, input.propertyId);
  const owner = await getOwner(db, input.ownerId);
  if (!property || !owner) return { kind: "error", message: "We could not find that property." };
  if (property.status === "active" || property.status === "past_due") return { kind: "active", property };

  // Pre-launch (DECISIONS.md, 2026-11-27, second entry): no card is saved and nothing starts until the market is
  // live. Refused here, before the payment company is asked for anything.
  const where = await getMarket(db, property.market);
  if (where && inPreLaunch(where)) return { kind: "error", message: preLaunchWords.noCardYet(where.name) };

  // An account on Portfolio: the property joins the one retainer instead of paying for itself.
  const portfolio = await openPortfolio(db, input.ownerId, property.market);
  if (portfolio) {
    await joinPortfolio(db, gateway, input.ownerId, property.id, portfolio);
    const joined = (await getProperty(db, input.ownerId, property.id))!;
    if (joined.status === "active" || joined.status === "past_due") return { kind: "active", property: joined };
    return { kind: "error", message: "This property is on your Portfolio. Start the Portfolio retainer from the Billing page to cover it." };
  }
  if (!property.tierId) return { kind: "error", message: "Choose a membership for this property first." };

  const market = await getMarket(db, property.market);
  const tier = await getTier(db, property.tierId);
  if (!market || !tier) return { kind: "error", message: "That membership is not available any more. Choose another." };
  if (!bookingOpen(market)) return { kind: "error", message: "We are not taking new members in that area right now." };
  if (tier.billingBasis === "per_account") return { kind: "error", message: "Portfolio is chosen once for your whole account, on the Billing page." };

  const existing = await getBilling(db, input.ownerId, market.country);
  const usable = existing && existing.provider === gateway.provider ? existing : null;

  if (tier.monthlyPriceCents === 0) {
    // Free to join: a saved card is all it takes.
    if (usable?.paymentMethodId) {
      const covered = await activateFreeMembership(db, { propertyId: property.id, ownerId: owner.id, provider: gateway.provider, customerId: usable.customerId, card: null });
      return covered ? { kind: "active", property: covered } : { kind: "error", message: "The property could not be covered just now. Please try again." };
    }
    const customerId = await gateway.ensureCustomer({
      ownerId: owner.id, name: owner.name, email: owner.email, phone: owner.phone, existingCustomerId: usable?.customerId ?? null,
    });
    await saveBilling(db, { ownerId: owner.id, country: market.country, provider: gateway.provider, customerId });
    const page = await gateway.startCardSetup({
      customerId, ownerId: owner.id, propertyId: property.id, propertyName: property.name, market, successUrl: input.successUrl, cancelUrl: input.cancelUrl,
    });
    return { kind: "redirect", url: page.url };
  }

  const customerId = await gateway.ensureCustomer({
    ownerId: owner.id, name: owner.name, email: owner.email, phone: owner.phone, existingCustomerId: usable?.customerId ?? null,
  });
  await saveBilling(db, { ownerId: owner.id, country: market.country, provider: gateway.provider, customerId });

  const deposit = await unusedDeposit(db, owner.id, market.currency);
  const discountCents = deposit ? Math.min(deposit.amountCents, tier.monthlyPriceCents) : 0;

  const started = await gateway.startMembership({
    customerId,
    paymentMethodId: usable?.paymentMethodId ?? null,
    ownerId: owner.id,
    propertyId: property.id,
    propertyName: property.name,
    tier: { id: tier.id, key: tier.key, name: tier.name, priceCents: tier.monthlyPriceCents, providerProductId: tier.providerProductId },
    market,
    discountCents,
    discountLabel: deposit ? "Founding member deposit" : null,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
  if (started.providerProductId && started.providerProductId !== tier.providerProductId) {
    await db.query("update public.membership_tiers set provider_product_id = $2 where id = $1::uuid", [tier.id, started.providerProductId]);
  }
  if (started.kind === "redirect") return { kind: "redirect", url: started.url };

  const activated = await activateMembership(db, {
    propertyId: property.id, provider: gateway.provider, subscriptionId: started.subscriptionId, periodEnd: started.periodEnd,
    invoice: started.invoice, card: started.card, customerId,
  });
  return activated ? { kind: "active", property: activated } : { kind: "error", message: "The membership could not be started. Please try again." };
}

/**
 * A free membership starts: the owner has a card on file, so the property is
 * covered from now. No subscription, no period end and no invoice. The card,
 * when the payment company has just saved it, is kept for finished jobs.
 * Safe to call twice: the second call finds the property already covered.
 */
export async function activateFreeMembership(
  db: Db,
  input: { propertyId: string; ownerId: string; provider: Provider; customerId: string; card: CardSummary | null },
): Promise<Property | null> {
  return db.tx(async (tx) => {
    const locked = await tx.query<PropertyRow>("select * from public.properties where id = $1::uuid and owner_id = $2::uuid for update", [input.propertyId, input.ownerId]);
    const row = locked[0];
    if (!row || row.portfolio_id) return null;
    const market = await getMarket(tx, row.market);
    const tier = row.tier_id ? await getTier(tx, row.tier_id) : null;
    if (!market || !tier || tier.monthlyPriceCents !== 0) return null;
    // Pre-launch (DECISIONS.md, 2026-11-27, second entry): no card is kept and no property is covered yet.
    if (inPreLaunch(market)) return null;

    await saveBilling(tx, { ownerId: row.owner_id, country: market.country, provider: input.provider, customerId: input.customerId, card: input.card });
    if (row.status === "active" || row.status === "past_due") return rowToProperty(row);

    const at = now();
    const updated = await tx.query<PropertyRow>(
      `update public.properties set
          status = 'active', subscription_provider = null, subscription_id = null, current_period_end = null,
          cancel_at_period_end = false, cancelled_at = null, member_since = $2::timestamptz
        where id = $1::uuid returning *`,
      [input.propertyId, at.toISOString()],
    );
    const property = rowToProperty(updated[0]!);
    await audit(tx, {
      actor: `owner:${row.owner_id}`, action: "membership.started", entity: "property", entityId: property.id,
      amount: 0, currency: market.currency, detail: { tier: tier.key, free: true, provider: input.provider },
      dedupeKey: `membership.started:free:${property.id}:${at.toISOString()}`,
    });
    // The cleaner or co-host who sent this owner is written down, so nobody's referral is lost. A free
    // property never pays a monthly bill, so the reward never falls due by itself: what earns it on the
    // free model is still to be decided (DECISIONS.md), and a person pays it until then.
    if (row.referrer_id) {
      await tx.query(
        `insert into public.referrals (created_at, referrer_id, property_id, reward_cents, currency)
         values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5) on conflict (property_id) do nothing`,
        [at.toISOString(), row.referrer_id, property.id, market.referralRewardCents, market.currency],
      );
    }
    return property;
  });
}

export type Activation = {
  propertyId: string;
  provider: Provider;
  subscriptionId: string;
  periodEnd: Date;
  invoice: InvoiceSummary | null;
  card: CardSummary | null;
  customerId: string;
};

/**
 * The first membership payment went through: the property becomes a member.
 * Safe to call twice for the same membership (the card page tells us, and so
 * does the payment company a moment later).
 */
export async function activateMembership(db: Db, input: Activation): Promise<Property | null> {
  return db.tx(async (tx) => {
    const locked = await tx.query<PropertyRow>("select * from public.properties where id = $1::uuid for update", [input.propertyId]);
    const row = locked[0];
    if (!row) return null;
    const market = await getMarket(tx, row.market);
    const tier = row.tier_id ? await getTier(tx, row.tier_id) : null;
    if (!market || !tier) return null;
    const at = now();

    await saveBilling(tx, { ownerId: row.owner_id, country: market.country, provider: input.provider, customerId: input.customerId, card: input.card });

    const firstTime = row.subscription_id !== input.subscriptionId || row.status === "setup" || row.status === "cancelled";
    const updated = await tx.query<PropertyRow>(
      `update public.properties set
          status = 'active', subscription_provider = $2, subscription_id = $3, current_period_end = $4::timestamptz,
          cancel_at_period_end = false, cancelled_at = null, member_since = coalesce(member_since, $5::timestamptz)
        where id = $1::uuid returning *`,
      [input.propertyId, input.provider, input.subscriptionId, input.periodEnd.toISOString(), at.toISOString()],
    );
    const property = rowToProperty(updated[0]!);

    if (firstTime) {
      await audit(tx, {
        actor: input.provider, action: "membership.started", entity: "property", entityId: property.id,
        amount: tier.monthlyPriceCents, currency: market.currency, detail: { tier: tier.key, subscription: input.subscriptionId },
        dedupeKey: `membership.started:${input.provider}:${input.subscriptionId}`,
      });

      // A founding deposit paid on the landing page comes off the first month.
      const deposit = await unusedDeposit(tx, row.owner_id, market.currency);
      if (deposit) {
        const amount = Math.min(deposit.amountCents, tier.monthlyPriceCents);
        await tx.query("update public.leads set deposit_status = 'credited' where id = $1::uuid and deposit_status = 'paid'", [deposit.leadId]);
        await tx.query(
          `insert into public.credits (created_at, owner_id, property_id, reason, amount_cents, currency, month, status, note, created_by)
           values ($1::timestamptz, $2::uuid, $3::uuid, 'founding_deposit', $4, $5, $6, 'applied', 'Taken off the first month', 'system')`,
          [at.toISOString(), row.owner_id, property.id, amount, market.currency, monthKey(at, market.timezone)],
        );
        await audit(tx, { actor: "system", action: "credit.applied", entity: "property", entityId: property.id, amount, currency: market.currency, detail: { reason: "founding_deposit", lead: deposit.leadId } });
      }

      // A cleaner or co-host who sent this owner is owed a reward once the
      // property has paid for the set number of months.
      if (row.referrer_id) {
        await tx.query(
          `insert into public.referrals (created_at, referrer_id, property_id, reward_cents, currency)
           values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5) on conflict (property_id) do nothing`,
          [at.toISOString(), row.referrer_id, property.id, market.referralRewardCents, market.currency],
        );
      }
    }

    if (input.invoice) await recordInvoice(tx, property, market, tier, input.invoice, input.provider, "paid");
    return property;
  });
}

async function recordInvoice(
  db: Db, property: Property, market: Market, tier: Tier, invoice: InvoiceSummary, provider: Provider, status: "paid" | "failed",
): Promise<boolean> {
  const rows = await db.query(
    `insert into public.membership_invoices
       (created_at, property_id, owner_id, provider, provider_invoice_id, amount_cents, list_cents, tax_cents, currency, status, period_start, period_end, paid_at)
     values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::timestamptz)
     on conflict (provider, provider_invoice_id) do update set status = excluded.status, paid_at = excluded.paid_at
       where public.membership_invoices.status <> excluded.status
     returning id`,
    [
      now().toISOString(), property.id, property.ownerId, provider, invoice.invoiceId, invoice.amountCents, tier.monthlyPriceCents,
      market.taxRegistered ? taxPortion(invoice.amountCents, market.taxRate) : 0, invoice.currency.toUpperCase(), status,
      invoice.periodStart.toISOString(), invoice.periodEnd.toISOString(), status === "paid" ? invoice.paidAt.toISOString() : null,
    ],
  );
  if (rows.length === 0) return false;
  await audit(db, {
    actor: provider, action: status === "paid" ? "membership.paid" : "membership.payment_failed", entity: "property", entityId: property.id,
    amount: invoice.amountCents, currency: invoice.currency, detail: { invoice: invoice.invoiceId, tier: tier.key },
    dedupeKey: `membership.${status}:${provider}:${invoice.invoiceId}`,
  });
  return true;
}

async function findBySubscription(db: Db, provider: Provider, subscriptionId: string): Promise<Property | null> {
  const rows = await db.query<PropertyRow>(
    "select * from public.properties where subscription_provider = $1 and subscription_id = $2 for update",
    [provider, subscriptionId],
  );
  return rows[0] ? rowToProperty(rows[0]) : null;
}

/** A monthly payment went through. Extends the membership and counts towards any referral. */
export async function recordRenewal(db: Db, input: { provider: Provider; subscriptionId: string; invoice: InvoiceSummary }): Promise<boolean> {
  return db.tx(async (tx) => {
    const property = await findBySubscription(tx, input.provider, input.subscriptionId);
    if (!property) {
      // Not a property's own membership: perhaps a Portfolio retainer.
      const portfolio = await lockPortfolioBySubscription(tx, input.provider, input.subscriptionId);
      return portfolio ? renewPortfolioIn(tx, portfolio, input.provider, input.invoice) : false;
    }
    if (!property.tierId) return false;
    const market = await getMarket(tx, property.market);
    const tier = await getTier(tx, property.tierId);
    if (!market || !tier) return false;

    const fresh = await recordInvoice(tx, property, market, tier, input.invoice, input.provider, "paid");
    await tx.query(
      `update public.properties set status = case when status = 'cancelled' then status else 'active' end,
              current_period_end = greatest(coalesce(current_period_end, $2::timestamptz), $2::timestamptz)
        where id = $1::uuid`,
      [property.id, input.invoice.periodEnd.toISOString()],
    );
    if (fresh) await checkReferral(tx, property.id, market);
    return fresh;
  });
}

/** A monthly payment failed. No new jobs can be logged until the card is fixed. */
export async function recordMembershipPaymentFailed(
  db: Db,
  input: { provider: Provider; subscriptionId: string; invoice: InvoiceSummary; updateCardUrl: string },
): Promise<boolean> {
  return db.tx(async (tx) => {
    const property = await findBySubscription(tx, input.provider, input.subscriptionId);
    if (!property) {
      const portfolio = await lockPortfolioBySubscription(tx, input.provider, input.subscriptionId);
      return portfolio ? portfolioPaymentFailedIn(tx, portfolio, input.provider, input.invoice, input.updateCardUrl) : false;
    }
    if (!property.tierId) return false;
    const market = await getMarket(tx, property.market);
    const tier = await getTier(tx, property.tierId);
    const owner = await getOwner(tx, property.ownerId);
    if (!market || !tier || !owner) return false;

    const fresh = await recordInvoice(tx, property, market, tier, input.invoice, input.provider, "failed");
    if (!fresh) return false;
    await tx.query("update public.properties set status = 'past_due' where id = $1::uuid and status = 'active'", [property.id]);
    if (owner.phone) {
      await enqueue(tx, {
        channel: "sms", to: owner.phone, template: "membership_failed", audience: "owner", userId: owner.userId,
        body: texts.membershipFailed({ property: property.name, link: input.updateCardUrl }),
        dedupeKey: `membership_failed:${input.invoice.invoiceId}`,
      });
    }
    return true;
  });
}

/** The membership has ended (cancelled and run out, or given up on after failed payments). */
export async function endMembership(db: Db, input: { provider: Provider; subscriptionId: string }): Promise<boolean> {
  return db.tx(async (tx) => {
    const property = await findBySubscription(tx, input.provider, input.subscriptionId);
    if (!property) {
      const portfolio = await lockPortfolioBySubscription(tx, input.provider, input.subscriptionId);
      return portfolio ? endPortfolioIn(tx, portfolio, input.provider, input.subscriptionId) : false;
    }
    if (property.status === "cancelled") return false;
    await tx.query("update public.properties set status = 'cancelled', cancelled_at = $2::timestamptz, cancel_at_period_end = false where id = $1::uuid", [
      property.id,
      now().toISOString(),
    ]);
    await tx.query("update public.referrals set status = 'void' where property_id = $1::uuid and status = 'pending'", [property.id]);
    await audit(tx, { actor: input.provider, action: "membership.ended", entity: "property", entityId: property.id, detail: { subscription: input.subscriptionId }, dedupeKey: `membership.ended:${input.provider}:${input.subscriptionId}` });
    return true;
  });
}

/** The owner asked to cancel. The membership runs to the end of the month already paid for. */
export async function requestCancel(db: Db, gateway: PaymentsGateway | null, ownerId: string, propertyId: string): Promise<Property | null> {
  const property = await getProperty(db, ownerId, propertyId);
  if (!property) return null;
  if (property.portfolioId) {
    // On a Portfolio there is nothing of its own to cancel: it comes off the portfolio, and the band is checked again.
    await removeFromPortfolio(db, gateway, ownerId, propertyId);
    return getProperty(db, ownerId, propertyId);
  }
  if (property.status === "setup") {
    await db.query("update public.properties set status = 'cancelled', cancelled_at = $2::timestamptz where id = $1::uuid", [propertyId, now().toISOString()]);
    return getProperty(db, ownerId, propertyId);
  }
  if (property.status === "cancelled" || property.cancelAtPeriodEnd) return property;
  if (!property.subscriptionId) {
    // A free membership: nothing paid in advance, so it ends now.
    const ended = await db.query(
      "update public.properties set status = 'cancelled', cancelled_at = $3::timestamptz, cancel_at_period_end = false, current_period_end = null where id = $1::uuid and owner_id = $2::uuid and status <> 'cancelled' returning id",
      [propertyId, ownerId, now().toISOString()],
    );
    if (ended.length > 0) {
      await db.query("update public.referrals set status = 'void' where property_id = $1::uuid and status = 'pending'", [propertyId]);
      await audit(db, { actor: `owner:${ownerId}`, action: "membership.ended", entity: "property", entityId: propertyId, detail: { free: true } });
    }
    return getProperty(db, ownerId, propertyId);
  }
  if (property.subscriptionId && gateway && gateway.provider === property.subscriptionProvider) {
    await gateway.cancelMembership(property.subscriptionId);
  }
  await db.query("update public.properties set cancel_at_period_end = true where id = $1::uuid and owner_id = $2::uuid", [propertyId, ownerId]);
  await audit(db, { actor: `owner:${ownerId}`, action: "membership.cancel_requested", entity: "property", entityId: propertyId, detail: { ends: property.currentPeriodEnd?.toISOString() ?? null } });
  return getProperty(db, ownerId, propertyId);
}

/**
 * Moves a property to another tier. Between two priced tiers the new price
 * starts with the next monthly payment. A covered property moving from a free
 * tier to a priced one starts paying now, on the saved card. One moving from
 * a priced tier to a free one stops paying: its subscription ends with the
 * month already paid for, and it stays covered with its card on file.
 */
export async function changeTier(db: Db, gateway: PaymentsGateway | null, ownerId: string, propertyId: string, tierId: string): Promise<Property | null> {
  const property = await getProperty(db, ownerId, propertyId);
  if (!property) return null;
  const tier = await tierForMarket(db, tierId, property.market);
  if (property.portfolioId) throw new PropertyError("This property is on your Portfolio. Its cover comes from the one retainer, so there is no plan to change here.");
  if (tier.billingBasis === "per_account") throw new PropertyError("Portfolio is chosen once for your whole account, on the Billing page.");
  const market = await getMarket(db, property.market);
  if (!market) return null;
  const covered = property.status === "active" || property.status === "past_due";

  // Free to priced, while covered: start the monthly payment on the saved card.
  if (covered && !property.subscriptionId && tier.monthlyPriceCents > 0) {
    if (!gateway) throw new PropertyError("Card payments are not switched on yet, so this membership cannot start. Please try again soon.");
    const billing = await getBilling(db, ownerId, market.country);
    if (!billing || billing.provider !== gateway.provider || !billing.paymentMethodId) {
      throw new PropertyError("There is no card on file to pay for this membership. Add one on the Billing page, then try again.");
    }
    const owner = await getOwner(db, ownerId);
    if (!owner) return null;
    const started = await gateway.startMembership({
      customerId: billing.customerId, paymentMethodId: billing.paymentMethodId, ownerId, propertyId: property.id, propertyName: property.name,
      tier: { id: tier.id, key: tier.key, name: tier.name, priceCents: tier.monthlyPriceCents, providerProductId: tier.providerProductId },
      market, discountCents: 0, discountLabel: null, successUrl: `/app/properties/${property.id}`, cancelUrl: `/app/properties/${property.id}`,
    });
    if (started.providerProductId && started.providerProductId !== tier.providerProductId) {
      await db.query("update public.membership_tiers set provider_product_id = $2 where id = $1::uuid", [tier.id, started.providerProductId]);
    }
    if (started.kind !== "active") throw new PropertyError("Your saved card did not go through. Update it on the Billing page, then try again. Nothing has changed.");
    await db.query("update public.properties set tier_id = $3::uuid where id = $1::uuid and owner_id = $2::uuid", [propertyId, ownerId, tierId]);
    await activateMembership(db, {
      propertyId, provider: gateway.provider, subscriptionId: started.subscriptionId, periodEnd: started.periodEnd, invoice: started.invoice, card: started.card,
      customerId: billing.customerId,
    });
    await audit(db, { actor: `owner:${ownerId}`, action: "membership.tier_changed", entity: "property", entityId: propertyId, amount: tier.monthlyPriceCents, currency: market.currency, detail: { tier: tier.key } });
    return getProperty(db, ownerId, propertyId);
  }

  // Priced to free: stop the monthly payment. The property stays covered on its card.
  if (property.subscriptionId && tier.monthlyPriceCents === 0 && property.status !== "cancelled") {
    if (gateway && gateway.provider === property.subscriptionProvider) await gateway.cancelMembership(property.subscriptionId);
    await db.query(
      `update public.properties set tier_id = $3::uuid, subscription_provider = null, subscription_id = null, current_period_end = null, cancel_at_period_end = false,
              status = case when status = 'past_due' then 'active' else status end
        where id = $1::uuid and owner_id = $2::uuid`,
      [propertyId, ownerId, tierId],
    );
    await audit(db, {
      actor: `owner:${ownerId}`, action: "membership.tier_changed", entity: "property", entityId: propertyId, amount: 0, currency: market.currency,
      detail: { tier: tier.key, subscription_stopped: property.subscriptionId },
    });
    return getProperty(db, ownerId, propertyId);
  }

  if (property.subscriptionId && gateway && gateway.provider === property.subscriptionProvider && property.status !== "cancelled") {
    const changed = await gateway.changeMembershipTier({
      subscriptionId: property.subscriptionId,
      tier: { id: tier.id, key: tier.key, name: tier.name, priceCents: tier.monthlyPriceCents, providerProductId: tier.providerProductId },
      market,
    });
    if (changed.providerProductId && changed.providerProductId !== tier.providerProductId) {
      await db.query("update public.membership_tiers set provider_product_id = $2 where id = $1::uuid", [tier.id, changed.providerProductId]);
    }
  }
  await db.query("update public.properties set tier_id = $3::uuid where id = $1::uuid and owner_id = $2::uuid", [propertyId, ownerId, tierId]);
  await audit(db, { actor: `owner:${ownerId}`, action: "membership.tier_changed", entity: "property", entityId: propertyId, amount: tier.monthlyPriceCents, currency: market.currency, detail: { tier: tier.key } });
  return getProperty(db, ownerId, propertyId);
}

/** Marks a referral as due once the property has paid for enough months, and puts it in front of the admin. */
export async function checkReferral(db: Db, propertyId: string, market: Market): Promise<boolean> {
  const referral = await db.query<{ id: string; referrer_name: string; reward_cents: number; currency: string; property_name: string }>(
    `select r.id, f.name as referrer_name, r.reward_cents, r.currency, p.name as property_name
       from public.referrals r
       join public.referrers f on f.id = r.referrer_id
       join public.properties p on p.id = r.property_id
      where r.property_id = $1::uuid and r.status = 'pending' for update of r`,
    [propertyId],
  );
  const row = referral[0];
  if (!row) return false;
  const paid = await db.query<{ count: number }>(
    "select count(*) as count from public.membership_invoices where property_id = $1::uuid and status = 'paid'",
    [propertyId],
  );
  if (Number(paid[0]?.count ?? 0) < market.referralPaidMonths) return false;
  await db.query("update public.referrals set status = 'due', due_at = $2::timestamptz where id = $1::uuid", [row.id, now().toISOString()]);
  await audit(db, { actor: "system", action: "referral.due", entity: "referral", entityId: row.id, amount: row.reward_cents, currency: row.currency, detail: { property: propertyId } });
  await raiseException(db, {
    kind: "referral_due", market: market.slug, propertyId,
    summary: `Pay ${row.referrer_name} their referral reward: ${row.property_name} has been a paying member for ${market.referralPaidMonths} months.`,
    dedupeKey: `referral_due:${row.id}`,
  });
  return true;
}
