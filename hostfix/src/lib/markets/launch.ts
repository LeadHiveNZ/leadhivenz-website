import type { CountryCode, Market } from "@config/markets";
import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { emails, texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { isUuid } from "@/lib/uuid";
import { bookingOpen, inPreLaunch, marketNames, ownersCanJoin, preLaunchWords } from "./stage";
import { listMarkets } from "./store";

/**
 * PRE-LAUNCH AND GOING LIVE (DECISIONS.md, 2026-11-27, second entry).
 *
 * Before a market opens, owners can make their account and add every
 * property. Nothing that needs a card or a tradie works until the market is
 * live. This file answers "where can an owner join?", "is this owner still
 * waiting for their area to open?", and sends the one email each of them gets
 * the day it does.
 */

/** The markets an owner can add a property in today: open ones first, then the ones still in pre-launch. */
export async function joinableMarkets(db: Db): Promise<Market[]> {
  const all = (await listMarkets(db)).filter(ownersCanJoin);
  return [...all.filter(bookingOpen), ...all.filter((market) => !bookingOpen(market))];
}

/** Null when a new owner can make an account today; otherwise the words to show instead. */
export async function signUpRefusal(db: Db): Promise<string | null> {
  return (await joinableMarkets(db)).length > 0 ? null : "We are not open for new members yet. Leave your details and you will be first to hear when we open in your area.";
}

type Placed = { market: string; status: string };

/**
 * Of the markets an owner has properties in, the ones still in pre-launch
 * (cancelled properties aside). Empty for an owner with nothing waiting.
 */
export function waitingMarkets(properties: Placed[], markets: Market[]): Market[] {
  return markets.filter((market) => inPreLaunch(market) && properties.some((property) => property.market === market.slug && property.status !== "cancelled"));
}

/**
 * True when everything this owner has in a country is still in pre-launch, so
 * nothing that saves a card or a bank account is open to them yet. An owner
 * who also has (or had) a property somewhere that is not in pre-launch keeps
 * their card pages: they may have jobs to pay for there.
 */
export function cardsOpenSoon(properties: Placed[], markets: Market[], country: CountryCode): Market[] {
  const here = markets.filter((market) => market.country === country);
  const waiting = waitingMarkets(properties, here);
  if (waiting.length === 0) return [];
  const elsewhere = here.some((market) => !inPreLaunch(market) && properties.some((property) => property.market === market.slug));
  return elsewhere ? [] : waiting;
}

async function placed(db: Db, ownerId: string): Promise<Placed[]> {
  if (!isUuid(ownerId)) return [];
  return db.query<Placed>("select market, status from public.properties where owner_id = $1::uuid", [ownerId]);
}

/**
 * The friendly refusal for anything that would save a card or a bank account
 * for this owner in this country, or null when it may go ahead. Checked by
 * the actions themselves, never only by hiding a button.
 */
export async function cardRefusal(db: Db, ownerId: string, country: CountryCode): Promise<string | null> {
  const waiting = cardsOpenSoon(await placed(db, ownerId), await listMarkets(db), country);
  return waiting.length > 0 ? preLaunchWords.noCardYet(marketNames(waiting)) : null;
}

/** For Admin > Markets: who has set up in this market, cancelled properties aside. */
export async function setUpCounts(db: Db, slug: string): Promise<{ owners: number; properties: number }> {
  const rows = await db.query<{ owners: number | string; properties: number | string }>(
    "select count(distinct owner_id) as owners, count(*) as properties from public.properties where market = $1 and status <> 'cancelled'",
    [slug],
  );
  return { owners: Number(rows[0]?.owners ?? 0), properties: Number(rows[0]?.properties ?? 0) };
}

export type GoLive = { at: Date; owners: number; properties: number; told: number };

/** The last time this market went from the waiting list to live, and who was told. Null if it never has. */
export async function lastGoLive(db: Db, slug: string): Promise<GoLive | null> {
  const rows = await db.query<{ at: Date; detail: Record<string, unknown> | string }>(
    "select at, detail from public.audit_log where action = 'market.went_live' and entity = 'market' and entity_id = $1 order by at desc, id desc limit 1",
    [slug],
  );
  const row = rows[0];
  if (!row) return null;
  const detail = typeof row.detail === "string" ? (JSON.parse(row.detail) as Record<string, unknown>) : row.detail;
  return { at: new Date(row.at), owners: Number(detail.owners ?? 0), properties: Number(detail.properties ?? 0), told: Number(detail.told ?? 0) };
}

/**
 * THE DAY A MARKET GOES LIVE. Called inside the same database step that
 * changes the stage from "waitlist" to "live". Every owner with a property
 * here that is set up and waiting for its card (closed accounts aside) is
 * sent one message through the outbox: an email, or a text for the rare owner
 * with no email address. An owner whose properties here are all covered
 * already has nothing to add, and is not written to. The dedupe key is the market and the owner, so however many times
 * the stage is flipped, nobody is told twice. The link goes to where that
 * owner adds their card: the property, the list when they have several, or
 * Billing when they chose Portfolio.
 */
export async function announceGoLive(db: Db, market: Pick<Market, "slug" | "name">, actor: string): Promise<{ owners: number; properties: number; told: number }> {
  const rows = await db.query<{
    owner_id: string; user_id: string; name: string; email: string | null; phone: string | null;
    properties: number | string; first_property: string; on_portfolio: boolean;
  }>(
    `select o.id as owner_id, u.id as user_id, u.name, u.email, u.phone, count(p.id) as properties,
            (array_agg(p.id order by p.created_at, p.id))[1] as first_property,
            bool_or(p.portfolio_id is not null) as on_portfolio
       from public.properties p
       join public.owners o on o.id = p.owner_id
       join public.users u on u.id = o.user_id
      where p.market = $1 and p.status = 'setup' and u.disabled_at is null
      group by o.id, u.id, u.name, u.email, u.phone
      order by o.id`,
    [market.slug],
  );
  let told = 0;
  let properties = 0;
  for (const row of rows) {
    const count = Number(row.properties);
    properties += count;
    const link = `${baseUrl()}${row.on_portfolio ? "/app/billing" : count === 1 ? `/app/properties/${row.first_property}` : "/app/properties"}`;
    const dedupeKey = `market_live:${market.slug}:${row.owner_id}`;
    let queued = false;
    if (row.email) {
      const mail = emails.marketLive({ name: row.name, market: market.name, link, properties: count, portfolio: Boolean(row.on_portfolio) });
      queued = await enqueue(db, { channel: "email", to: row.email, template: "market_live", subject: mail.subject, body: mail.body, audience: "owner", userId: row.user_id, dedupeKey });
    } else if (row.phone) {
      // A text has no room for a property's own link: the list (or Billing) is one tap from it.
      const short = `${baseUrl()}${row.on_portfolio ? "/app/billing" : "/app/properties"}`;
      queued = await enqueue(db, { channel: "sms", to: row.phone, template: "market_live", body: texts.marketLive({ market: market.name, link: short }), audience: "owner", userId: row.user_id, dedupeKey });
    }
    if (queued) told += 1;
  }
  await audit(db, { actor, action: "market.went_live", entity: "market", entityId: market.slug, detail: { owners: rows.length, properties, told } });
  return { owners: rows.length, properties, told };
}
