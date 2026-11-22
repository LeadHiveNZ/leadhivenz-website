import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { randomToken } from "@/lib/ids";
import { distanceMetres } from "@/lib/jobs/arrival";
import { OWN_CLIENT_FEE_BPS, ownClientLines } from "@/lib/jobs/pricing";
import { listLines, recalcTotals } from "@/lib/jobs/store";
import type { Market } from "@config/markets";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { getPropertyForStaff, type Property } from "@/lib/properties/service";
import { isUuid } from "@/lib/uuid";

/**
 * OWN CLIENTS AT 5% (DECISIONS.md, 2026-11-23).
 *
 * A tradie can bring their own clients to HostFix, and an owner can bring
 * their own tradie. Either way the result is a PAIR: one tradie and one
 * property. Jobs between the pair take a 5% platform fee (OWN_CLIENT_FEE_BPS)
 * on everything the 15% applies to (the menu share, the surcharges, the
 * call-out, quotes and hourly work). Every other tradie and trade at that
 * property stays at the market's fee, and the paired tradie is the first
 * choice for that property in their trades.
 *
 *   from the tradie   they send their client an invite from the app. The
 *                     owner opens it, signs up or signs in, picks the
 *                     property (or adds it) and presses the button.
 *   from the owner    "Bring your own tradie" on a property page. The tradie
 *                     gets a one-tap link, signs up (normal approval: insurance,
 *                     licence, agreement) and presses the button.
 *
 * Opening an invite link changes nothing; pressing its button does.
 *
 * THE GUARD: no pair if HostFix already introduced that tradie to that
 * property, meaning they have been offered, or done, a HostFix job there
 * (an offer that was not itself an own-client offer). It is matched by the
 * property's address (normalised) or its map pin, never by the account, so
 * deleting a property and adding it again does not reset it.
 */

/** Two map pins this close are the same place for the guard. */
export const SAME_PLACE_METRES = 25;

const WORDS: Record<string, string> = {
  street: "st", road: "rd", avenue: "ave", drive: "dr", place: "pl", crescent: "cres", terrace: "tce", lane: "ln", highway: "hwy",
  court: "ct", parade: "pde", close: "cl", grove: "gr", heights: "hts", boulevard: "blvd", way: "way", unit: "", flat: "", apartment: "",
};

/** The property's address, normalised: lower case, no punctuation, common street words shortened. "3/88 Fernhill Road, Fernhill 9300" and "3 / 88 fernhill rd fernhill 9300" match. */
export function addressKey(property: Pick<Property, "addressLine1" | "addressLine2" | "suburb" | "postcode">): string {
  const words = [property.addressLine1, property.addressLine2 ?? "", property.suburb, property.postcode]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => (word in WORDS ? WORDS[word]! : word))
    .filter(Boolean);
  return words.join("");
}

/** True when two properties are the same place: the same normalised address, or map pins within 25 m. */
export function samePlace(
  a: Pick<Property, "addressLine1" | "addressLine2" | "suburb" | "postcode" | "pin">,
  b: Pick<Property, "addressLine1" | "addressLine2" | "suburb" | "postcode" | "pin">,
): boolean {
  if (addressKey(a) === addressKey(b)) return true;
  return Boolean(a.pin && b.pin && distanceMetres(a.pin, b.pin) <= SAME_PLACE_METRES);
}

/** True when HostFix has already offered this tradie a job, or they did one, at this place (any account's property there). */
export async function hostFixIntroduced(db: Db, tradieId: string, property: Property): Promise<boolean> {
  const rows = await db.query<{ property_id: string }>(
    `select distinct j.property_id from public.offers o join public.jobs j on j.id = o.job_id
      where o.tradie_id = $1::uuid and not o.own_client`,
    [tradieId],
  );
  for (const row of rows) {
    const other = row.property_id === property.id ? property : await getPropertyForStaff(db, row.property_id);
    if (other && samePlace(other, property)) return true;
  }
  return false;
}

export type Pair = { id: string; tradieId: string; propertyId: string; ownerId: string; via: "tradie_invite" | "owner_invite"; createdAt: Date };

type PairRow = { id: string; tradie_id: string; property_id: string; owner_id: string; via: Pair["via"]; created_at: Date };
const rowToPair = (row: PairRow): Pair => ({ id: row.id, tradieId: row.tradie_id, propertyId: row.property_id, ownerId: row.owner_id, via: row.via, createdAt: new Date(row.created_at) });

/** The active pair for this tradie and property, if there is one. */
export async function activePair(db: Db, tradieId: string, propertyId: string): Promise<Pair | null> {
  const rows = await db.query<PairRow>("select * from public.own_client_pairs where tradie_id = $1::uuid and property_id = $2::uuid and status = 'active'", [tradieId, propertyId]);
  return rows[0] ? rowToPair(rows[0]) : null;
}

/** The tradies paired with this property: each is the first choice here in their trades. */
export async function pairedTradieIds(db: Db, propertyId: string): Promise<Set<string>> {
  const rows = await db.query<{ tradie_id: string }>("select tradie_id from public.own_client_pairs where property_id = $1::uuid and status = 'active'", [propertyId]);
  return new Set(rows.map((row) => row.tradie_id));
}

export async function pairsForTradie(db: Db, tradieId: string): Promise<(Pair & { propertyName: string; suburb: string; ownerName: string })[]> {
  const rows = await db.query<PairRow & { property_name: string; suburb: string; owner_name: string }>(
    `select c.*, p.name as property_name, p.suburb, u.name as owner_name from public.own_client_pairs c
       join public.properties p on p.id = c.property_id join public.owners o on o.id = c.owner_id join public.users u on u.id = o.user_id
      where c.tradie_id = $1::uuid and c.status = 'active' order by c.created_at desc`,
    [tradieId],
  );
  return rows.map((row) => ({ ...rowToPair(row), propertyName: row.property_name, suburb: row.suburb, ownerName: row.owner_name }));
}

export async function pairsForProperty(db: Db, propertyId: string): Promise<(Pair & { businessName: string; trades: string[] })[]> {
  const rows = await db.query<PairRow & { business_name: string; trades: string[] }>(
    `select c.*, t.business_name, t.trades from public.own_client_pairs c join public.tradies t on t.id = c.tradie_id
      where c.property_id = $1::uuid and c.status = 'active' order by c.created_at`,
    [propertyId],
  );
  return rows.map((row) => ({ ...rowToPair(row), businessName: row.business_name, trades: row.trades ?? [] }));
}

export type PairResult = { ok: true; pair: Pair } | { ok: false; message: string };

/** Makes a pair, inside the caller's database step, unless HostFix already introduced the tradie to the place. */
export async function makePair(db: Db, input: { tradieId: string; property: Property; via: Pair["via"]; inviteId: string | null; actor: string }): Promise<PairResult> {
  const existing = await activePair(db, input.tradieId, input.property.id);
  if (existing) return { ok: true, pair: existing };
  if (await hostFixIntroduced(db, input.tradieId, input.property)) {
    return {
      ok: false,
      message: "HostFix has already sent this tradie a job at this property, so jobs between you stay at the normal fee. You can still book them through HostFix as usual.",
    };
  }
  const at = now();
  const rows = await db.query<PairRow>(
    `insert into public.own_client_pairs (created_at, tradie_id, property_id, owner_id, address_key, via, invite_id)
     values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::uuid)
     on conflict (tradie_id, property_id) do update set status = 'active', ended_at = null
     returning *`,
    [at.toISOString(), input.tradieId, input.property.id, input.property.ownerId, addressKey(input.property), input.via, input.inviteId],
  );
  const pair = rowToPair(rows[0]!);
  await audit(db, {
    actor: input.actor, action: "own_client.paired", entity: "property", entityId: input.property.id,
    detail: { tradie: input.tradieId, via: input.via, invite: input.inviteId, fee_bps: OWN_CLIENT_FEE_BPS },
  });
  return { ok: true, pair };
}

// ---------------------------------------------------------------------------
// THE JOB'S FEE
// ---------------------------------------------------------------------------

/**
 * Once a tradie takes a job, inside the same database step: if they and the property are an own-client pair, the
 * job takes the 5% fee from now on (jobs.platform_fee_bps) and its lines are priced again (ownClientLines). The
 * owner pays the same; the tradie's share goes up. Returns true when the job is an own-client job.
 */
export async function applyOwnClientFee(db: Db, jobId: string, tradieId: string, propertyId: string, market: Market): Promise<boolean> {
  if (!(await activePair(db, tradieId, propertyId))) return false;
  await db.query("update public.jobs set platform_fee_bps = $2 where id = $1::uuid", [jobId, OWN_CLIENT_FEE_BPS]);
  const lines = (await listLines(db, jobId)).filter((line) => line.status !== "void");
  for (const line of ownClientLines(market, lines)) {
    await db.query("update public.job_lines set tradie_cents = $2 where id = $1::uuid", [line.id, line.tradieCents]);
  }
  await recalcTotals(db, jobId, market.taxRate, market.taxRegistered);
  await audit(db, { actor: "system", action: "job.own_client_fee", entity: "job", entityId: jobId, detail: { fee_bps: OWN_CLIENT_FEE_BPS, tradie: tradieId } });
  return true;
}

// ---------------------------------------------------------------------------
// INVITE LINKS
// ---------------------------------------------------------------------------

export type Invite = {
  id: string; createdAt: Date; token: string; fromSide: "tradie" | "owner"; tradieId: string | null; ownerId: string | null; propertyId: string | null;
  name: string; phone: string | null; email: string | null; trade: string | null; status: "open" | "used" | "cancelled"; usedAt: Date | null;
};

type InviteRow = {
  id: string; created_at: Date; token: string; from_side: Invite["fromSide"]; tradie_id: string | null; owner_id: string | null; property_id: string | null;
  name: string; phone: string | null; email: string | null; trade: string | null; status: Invite["status"]; used_at: Date | null;
};

const rowToInvite = (row: InviteRow): Invite => ({
  id: row.id, createdAt: new Date(row.created_at), token: row.token, fromSide: row.from_side, tradieId: row.tradie_id, ownerId: row.owner_id, propertyId: row.property_id,
  name: row.name, phone: row.phone, email: row.email, trade: row.trade, status: row.status, usedAt: row.used_at ? new Date(row.used_at) : null,
});

export const inviteUrl = (token: string) => `${baseUrl()}/i/${token}`;

/** Looking an invite up from its link. A code that is not one gets the same answer as one that does not exist. */
export async function inviteFromLink(db: Db, token: string): Promise<Invite | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const rows = await db.query<InviteRow>("select * from public.client_invites where token = $1", [token]);
  return rows[0] ? rowToInvite(rows[0]) : null;
}

export async function invitesFromTradie(db: Db, tradieId: string): Promise<Invite[]> {
  const rows = await db.query<InviteRow>("select * from public.client_invites where tradie_id = $1::uuid and from_side = 'tradie' order by created_at desc limit 50", [tradieId]);
  return rows.map(rowToInvite);
}

export async function invitesForProperty(db: Db, ownerId: string, propertyId: string): Promise<Invite[]> {
  const rows = await db.query<InviteRow>("select * from public.client_invites where owner_id = $1::uuid and property_id = $2::uuid and from_side = 'owner' order by created_at desc limit 20", [ownerId, propertyId]);
  return rows.map(rowToInvite);
}

/** A tradie invites a client of theirs. The client is texted (or emailed) the link. */
export async function inviteClient(db: Db, input: { tradieId: string; businessName: string; name: string; phone: string | null; email: string | null }): Promise<{ ok: true; invite: Invite } | { ok: false; message: string }> {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, message: "Enter your client's name." };
  if (!input.phone && !input.email) return { ok: false, message: "Enter their mobile number or email address, so we can send them the link." };
  return db.tx(async (tx) => {
    const at = now();
    const rows = await tx.query<InviteRow>(
      `insert into public.client_invites (created_at, token, from_side, tradie_id, name, phone, email) values ($1::timestamptz, $2, 'tradie', $3::uuid, $4, $5, $6) returning *`,
      [at.toISOString(), randomToken(24), input.tradieId, name.slice(0, 80), input.phone, input.email],
    );
    const invite = rowToInvite(rows[0]!);
    await audit(tx, { actor: `tradie:${input.tradieId}`, action: "own_client.invited", entity: "tradie", entityId: input.tradieId, detail: { invite: invite.id, name } });
    const body = texts.clientInvite({ tradie: input.businessName, link: inviteUrl(invite.token) });
    if (input.phone) await enqueue(tx, { channel: "sms", to: input.phone, template: "client_invite", audience: "owner", body, dedupeKey: `client_invite:${invite.id}` });
    else if (input.email) await enqueue(tx, { channel: "email", to: input.email, template: "client_invite", subject: `${input.businessName} invites you to book them through HostFix`, audience: "owner", body, dedupeKey: `client_invite:${invite.id}` });
    return { ok: true as const, invite };
  });
}

/** An owner brings their own tradie to a property. The tradie is texted a one-tap link. */
export async function inviteOwnTradie(db: Db, input: { ownerId: string; ownerName: string; property: Property; name: string; phone: string; trade: string | null }): Promise<{ ok: true; invite: Invite } | { ok: false; message: string }> {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, message: "Enter your tradie's name or business name." };
  if (input.property.ownerId !== input.ownerId) return { ok: false, message: "We could not find that property." };
  return db.tx(async (tx) => {
    const at = now();
    const rows = await tx.query<InviteRow>(
      `insert into public.client_invites (created_at, token, from_side, owner_id, property_id, name, phone, trade) values ($1::timestamptz, $2, 'owner', $3::uuid, $4::uuid, $5, $6, $7) returning *`,
      [at.toISOString(), randomToken(24), input.ownerId, input.property.id, name.slice(0, 80), input.phone, input.trade],
    );
    const invite = rowToInvite(rows[0]!);
    await audit(tx, { actor: `owner:${input.ownerId}`, action: "own_client.tradie_invited", entity: "property", entityId: input.property.id, detail: { invite: invite.id, name, trade: input.trade } });
    await enqueue(tx, {
      channel: "sms", to: input.phone, template: "own_tradie_invite", audience: "tradie",
      body: texts.ownTradieInvite({ owner: input.ownerName, link: inviteUrl(invite.token) }), dedupeKey: `own_tradie_invite:${invite.id}`,
    });
    return { ok: true as const, invite };
  });
}

/** The owner presses the button on a tradie's invite, for one of their properties. */
export async function acceptClientInvite(db: Db, token: string, ownerId: string, propertyId: string): Promise<PairResult> {
  if (!isUuid(propertyId)) return { ok: false, message: "Choose which property." };
  return db.tx(async (tx) => {
    const invite = await inviteFromLink(tx, token);
    if (!invite || invite.fromSide !== "tradie" || invite.status === "cancelled" || !invite.tradieId) return { ok: false, message: "This invite does not work any more. Ask your tradie to send a new one." };
    const property = await getPropertyForStaff(tx, propertyId);
    if (!property || property.ownerId !== ownerId) return { ok: false, message: "Choose one of your properties." };
    const made = await makePair(tx, { tradieId: invite.tradieId, property, via: "tradie_invite", inviteId: invite.id, actor: `owner:${ownerId}` });
    if (made.ok) await tx.query("update public.client_invites set status = 'used', used_at = coalesce(used_at, $2::timestamptz), pair_id = coalesce(pair_id, $3::uuid) where id = $1::uuid", [invite.id, now().toISOString(), made.pair.id]);
    return made;
  });
}

/** The tradie presses the button on an owner's invite. They may still be waiting for approval: offers only start once approved. */
export async function acceptOwnTradieInvite(db: Db, token: string, tradieId: string): Promise<PairResult> {
  return db.tx(async (tx) => {
    const invite = await inviteFromLink(tx, token);
    if (!invite || invite.fromSide !== "owner" || invite.status !== "open" || !invite.propertyId) return { ok: false, message: "This invite does not work any more. Ask the owner to send a new one." };
    const property = await getPropertyForStaff(tx, invite.propertyId);
    if (!property) return { ok: false, message: "That property is no longer on HostFix." };
    const made = await makePair(tx, { tradieId, property, via: "owner_invite", inviteId: invite.id, actor: `tradie:${tradieId}` });
    if (made.ok) await tx.query("update public.client_invites set status = 'used', used_at = $2::timestamptz, tradie_id = $3::uuid, pair_id = $4::uuid where id = $1::uuid", [invite.id, now().toISOString(), tradieId, made.pair.id]);
    return made;
  });
}
