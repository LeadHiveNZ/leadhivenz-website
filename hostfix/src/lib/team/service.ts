import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { randomToken } from "@/lib/ids";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { rowToProperty, type Property } from "@/lib/properties/service";
import { isUuid } from "@/lib/uuid";

/**
 * AN OWNER'S TEAM: cleaners and co-hosts (DECISIONS.md, 2026-11-18).
 *
 * A cleaner is a person, not a link. The person is a user, known by their
 * mobile, with one team link for life. Each owner who adds that mobile has
 * their own team member row: the name they know the person by, whether a
 * tradie is sent straight away or the owner is asked first, and which
 * properties and groups the person may report on.
 *
 * Every function an owner uses takes the owner's id and puts it in the
 * query, so an owner can only ever see or change their own team, groups and
 * properties. The functions for the cleaner's link start from the link and
 * only ever return properties that belong to an owner who has that person on
 * their team right now.
 */

export type Dispatch = "straight" | "ask";

export type TeamMember = {
  id: string;
  createdAt: Date;
  ownerId: string;
  linkId: string;
  name: string;
  phone: string;
  dispatch: Dispatch;
  /** Properties ticked one by one. */
  propertyIds: string[];
  /** Groups ticked. Every property in them is covered, including ones added later. */
  groupIds: string[];
};

export type PropertyGroup = { id: string; ownerId: string; name: string; propertyIds: string[] };

export class TeamError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "TeamError";
  }
}

/** The address of a person's team link. */
export function teamLinkUrl(token: string): string {
  return `${baseUrl()}/r/${token}`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// ---------------------------------------------------------------------------
// THE OWNER'S SIDE
// ---------------------------------------------------------------------------

type MemberRow = { id: string; created_at: Date; owner_id: string; link_id: string; name: string; phone: string; dispatch: Dispatch };

async function accessFor(db: Db, memberIds: string[]): Promise<Map<string, { propertyIds: string[]; groupIds: string[] }>> {
  const out = new Map<string, { propertyIds: string[]; groupIds: string[] }>();
  for (const id of memberIds) out.set(id, { propertyIds: [], groupIds: [] });
  if (memberIds.length === 0) return out;
  const rows = await db.query<{ member_id: string; property_id: string | null; group_id: string | null }>(
    "select member_id, property_id, group_id from public.team_access where member_id = any($1::uuid[]) order by created_at",
    [memberIds],
  );
  for (const row of rows) {
    const entry = out.get(row.member_id)!;
    if (row.property_id) entry.propertyIds.push(row.property_id);
    if (row.group_id) entry.groupIds.push(row.group_id);
  }
  return out;
}

async function membersWhere(db: Db, where: string, params: unknown[]): Promise<TeamMember[]> {
  const rows = await db.query<MemberRow>(
    `select m.id, m.created_at, m.owner_id, m.link_id, m.name, u.phone, m.dispatch
       from public.team_members m
       join public.team_links l on l.id = m.link_id
       join public.users u on u.id = l.user_id
      where m.removed_at is null and ${where}
      order by m.created_at`,
    params,
  );
  const access = await accessFor(db, rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id, createdAt: new Date(row.created_at), ownerId: row.owner_id, linkId: row.link_id, name: row.name, phone: row.phone,
    dispatch: row.dispatch, ...access.get(row.id)!,
  }));
}

/** The owner's team, oldest first. Removed people are not on it. */
export async function listTeam(db: Db, ownerId: string): Promise<TeamMember[]> {
  return membersWhere(db, "m.owner_id = $1::uuid", [ownerId]);
}

export async function countTeam(db: Db, ownerId: string): Promise<number> {
  const rows = await db.query<{ count: number }>("select count(*) as count from public.team_members where owner_id = $1::uuid and removed_at is null", [ownerId]);
  return Number(rows[0]?.count ?? 0);
}

/** One person on this owner's team, or null. Never someone on another owner's team. */
export async function getTeamMember(db: Db, ownerId: string, memberId: string): Promise<TeamMember | null> {
  if (!isUuid(memberId)) return null;
  return (await membersWhere(db, "m.owner_id = $1::uuid and m.id = $2::uuid", [ownerId, memberId]))[0] ?? null;
}

/** The link of someone on this owner's team, so the owner can send it again. Null for anyone else. */
export async function linkTokenFor(db: Db, ownerId: string, memberId: string): Promise<string | null> {
  if (!isUuid(memberId)) return null;
  const rows = await db.query<{ link_token: string }>(
    "select l.link_token from public.team_members m join public.team_links l on l.id = m.link_id where m.id = $1::uuid and m.owner_id = $2::uuid and m.removed_at is null",
    [memberId, ownerId],
  );
  return rows[0]?.link_token ?? null;
}

/** Keeps only the ids that are this owner's properties. */
async function ownersProperties(db: Db, ownerId: string, ids: string[]): Promise<string[]> {
  const wanted = [...new Set(ids.filter(isUuid))];
  if (wanted.length === 0) return [];
  const rows = await db.query<{ id: string }>("select id from public.properties where owner_id = $1::uuid and id = any($2::uuid[])", [ownerId, wanted]);
  const mine = new Set(rows.map((row) => row.id));
  return wanted.filter((id) => mine.has(id));
}

/** Keeps only the ids that are this owner's groups. */
async function ownersGroups(db: Db, ownerId: string, ids: string[]): Promise<string[]> {
  const wanted = [...new Set(ids.filter(isUuid))];
  if (wanted.length === 0) return [];
  const rows = await db.query<{ id: string }>("select id from public.property_groups where owner_id = $1::uuid and id = any($2::uuid[])", [ownerId, wanted]);
  const mine = new Set(rows.map((row) => row.id));
  return wanted.filter((id) => mine.has(id));
}

/** Replaces what a team member may report on. Returns what was added and taken away. */
async function setAccess(db: Db, memberId: string, propertyIds: string[], groupIds: string[]) {
  const before = (await accessFor(db, [memberId])).get(memberId)!;
  const at = now().toISOString();
  await db.query("delete from public.team_access where member_id = $1::uuid", [memberId]);
  for (const propertyId of propertyIds) {
    await db.query("insert into public.team_access (created_at, member_id, property_id) values ($1::timestamptz, $2::uuid, $3::uuid)", [at, memberId, propertyId]);
  }
  for (const groupId of groupIds) {
    await db.query("insert into public.team_access (created_at, member_id, group_id) values ($1::timestamptz, $2::uuid, $3::uuid)", [at, memberId, groupId]);
  }
  return {
    propertiesAdded: propertyIds.filter((id) => !before.propertyIds.includes(id)),
    propertiesRemoved: before.propertyIds.filter((id) => !propertyIds.includes(id)),
    groupsAdded: groupIds.filter((id) => !before.groupIds.includes(id)),
    groupsRemoved: before.groupIds.filter((id) => !groupIds.includes(id)),
  };
}

export type TeamInput = { name: string; dispatch: Dispatch; propertyIds: string[]; groupIds: string[] };

function checkName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 1 || clean.length > 80) throw new TeamError("Enter their name, as you would say it.", "name");
  return clean;
}

/**
 * Adds a cleaner or co-host to the owner's team, by name and mobile
 * (already in international format). The person keeps one link for life: if
 * another owner added the same mobile first, it is the same link, and the
 * houses ticked here join their list. They are texted the link.
 */
export async function addTeamMember(db: Db, ownerId: string, phone: string, input: TeamInput): Promise<{ member: TeamMember; linkToken: string }> {
  const name = checkName(input.name);
  const added = await db.tx(async (tx) => {
    const own = await tx.query<{ phone: string | null; name: string }>(
      "select u.phone, u.name from public.owners o join public.users u on u.id = o.user_id where o.id = $1::uuid",
      [ownerId],
    );
    if (!own[0]) throw new TeamError("We could not find your account. Sign in again.");
    if (own[0].phone === phone) throw new TeamError("That is your own mobile. Add your cleaner's or co-host's number.", "phone");

    // The person: an existing account with this mobile, or a new one.
    let userId = (await tx.query<{ id: string }>("select id from public.users where phone = $1", [phone]))[0]?.id;
    if (!userId) {
      userId = (await tx.query<{ id: string }>(
        "insert into public.users (created_at, name, phone) values ($1::timestamptz, $2, $3) returning id",
        [now().toISOString(), name, phone],
      ))[0]!.id;
    }
    // Their one link for life.
    let link = (await tx.query<{ id: string; link_token: string }>("select id, link_token from public.team_links where user_id = $1::uuid", [userId]))[0];
    if (!link) {
      link = (await tx.query<{ id: string; link_token: string }>(
        "insert into public.team_links (created_at, user_id, link_token) values ($1::timestamptz, $2::uuid, $3) returning id, link_token",
        [now().toISOString(), userId, randomToken(24)],
      ))[0]!;
    }

    const existing = (await tx.query<{ id: string; removed_at: Date | null }>(
      "select id, removed_at from public.team_members where owner_id = $1::uuid and link_id = $2::uuid for update",
      [ownerId, link.id],
    ))[0];
    if (existing && existing.removed_at === null) throw new TeamError("That mobile is already on your team. Open them below to change their houses.", "phone");
    let memberId: string;
    if (existing) {
      // Added again after being removed: the same row, so their old jobs still say who reported them.
      await tx.query("update public.team_members set name = $2, dispatch = $3, removed_at = null where id = $1::uuid", [existing.id, name, input.dispatch]);
      memberId = existing.id;
    } else {
      memberId = (await tx.query<{ id: string }>(
        "insert into public.team_members (created_at, owner_id, link_id, name, dispatch) values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5) returning id",
        [now().toISOString(), ownerId, link.id, name, input.dispatch],
      ))[0]!.id;
    }
    const propertyIds = await ownersProperties(tx, ownerId, input.propertyIds);
    const groupIds = await ownersGroups(tx, ownerId, input.groupIds);
    await setAccess(tx, memberId, propertyIds, groupIds);
    await audit(tx, {
      actor: `owner:${ownerId}`, action: "team.added", entity: "team_member", entityId: memberId,
      detail: { dispatch: input.dispatch, properties: propertyIds, groups: groupIds, again: Boolean(existing) },
    });
    await enqueue(tx, {
      channel: "sms", to: phone, template: "team_invite", audience: "reporter", userId,
      body: texts.teamInvite({ name, owner: firstName(own[0].name), link: teamLinkUrl(link.link_token) }),
      dedupeKey: `team_invite:${memberId}:${randomToken(8)}`,
    });
    return { memberId, linkToken: link.link_token };
  });
  return { member: (await getTeamMember(db, ownerId, added.memberId))!, linkToken: added.linkToken };
}

/** Changes a team member's name, setting, properties and groups. Null if they are not on this owner's team. */
export async function updateTeamMember(db: Db, ownerId: string, memberId: string, input: TeamInput): Promise<TeamMember | null> {
  const name = checkName(input.name);
  const changed = await db.tx(async (tx) => {
    if (!isUuid(memberId)) return false;
    const rows = await tx.query<{ id: string }>(
      "update public.team_members set name = $3, dispatch = $4 where id = $1::uuid and owner_id = $2::uuid and removed_at is null returning id",
      [memberId, ownerId, name, input.dispatch],
    );
    if (!rows[0]) return false;
    const diff = await setAccess(tx, memberId, await ownersProperties(tx, ownerId, input.propertyIds), await ownersGroups(tx, ownerId, input.groupIds));
    await audit(tx, {
      actor: `owner:${ownerId}`, action: "team.properties_changed", entity: "team_member", entityId: memberId,
      detail: { dispatch: input.dispatch, properties_added: diff.propertiesAdded, properties_removed: diff.propertiesRemoved, groups_added: diff.groupsAdded, groups_removed: diff.groupsRemoved },
    });
    return true;
  });
  return changed ? getTeamMember(db, ownerId, memberId) : null;
}

/**
 * Takes someone off the owner's team: every one of this owner's houses goes
 * from their list at once. Houses other owners have given them stay.
 */
export async function removeTeamMember(db: Db, ownerId: string, memberId: string): Promise<boolean> {
  if (!isUuid(memberId)) return false;
  return db.tx(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      "update public.team_members set removed_at = $3::timestamptz where id = $1::uuid and owner_id = $2::uuid and removed_at is null returning id",
      [memberId, ownerId, now().toISOString()],
    );
    if (!rows[0]) return false;
    await tx.query("delete from public.team_access where member_id = $1::uuid", [memberId]);
    await audit(tx, { actor: `owner:${ownerId}`, action: "team.removed", entity: "team_member", entityId: memberId });
    return true;
  });
}

/** How many of this owner's houses a team member has on their list, counting groups. */
export function housesCovered(member: Pick<TeamMember, "propertyIds" | "groupIds">, groups: PropertyGroup[]): number {
  const ids = new Set(member.propertyIds);
  for (const group of groups) if (member.groupIds.includes(group.id)) for (const id of group.propertyIds) ids.add(id);
  return ids.size;
}

// ---------------------------------------------------------------------------
// GROUPS
// ---------------------------------------------------------------------------

/** The owner's property groups, by name. */
export async function listGroups(db: Db, ownerId: string): Promise<PropertyGroup[]> {
  const groups = await db.query<{ id: string; owner_id: string; name: string }>(
    "select id, owner_id, name from public.property_groups where owner_id = $1::uuid order by lower(name), created_at",
    [ownerId],
  );
  if (groups.length === 0) return [];
  const members = await db.query<{ group_id: string; property_id: string }>(
    "select gm.group_id, gm.property_id from public.property_group_members gm join public.property_groups g on g.id = gm.group_id where g.owner_id = $1::uuid order by gm.created_at",
    [ownerId],
  );
  return groups.map((group) => ({
    id: group.id, ownerId: group.owner_id, name: group.name,
    propertyIds: members.filter((row) => row.group_id === group.id).map((row) => row.property_id),
  }));
}

export async function getGroup(db: Db, ownerId: string, groupId: string): Promise<PropertyGroup | null> {
  if (!isUuid(groupId)) return null;
  return (await listGroups(db, ownerId)).find((group) => group.id === groupId) ?? null;
}

function checkGroupName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 1 || clean.length > 60) throw new TeamError("Give the group a short name, like Frankton or Lake houses.", "name");
  return clean;
}

async function setGroupProperties(db: Db, groupId: string, propertyIds: string[]) {
  const before = (await db.query<{ property_id: string }>("select property_id from public.property_group_members where group_id = $1::uuid", [groupId])).map((row) => row.property_id);
  await db.query("delete from public.property_group_members where group_id = $1::uuid and not (property_id = any($2::uuid[]))", [groupId, propertyIds]);
  for (const propertyId of propertyIds.filter((id) => !before.includes(id))) {
    await db.query("insert into public.property_group_members (group_id, property_id, created_at) values ($1::uuid, $2::uuid, $3::timestamptz)", [groupId, propertyId, now().toISOString()]);
  }
  return { added: propertyIds.filter((id) => !before.includes(id)), removed: before.filter((id) => !propertyIds.includes(id)) };
}

export async function createGroup(db: Db, ownerId: string, input: { name: string; propertyIds: string[] }): Promise<PropertyGroup> {
  const name = checkGroupName(input.name);
  const id = await db.tx(async (tx) => {
    const groupId = (await tx.query<{ id: string }>(
      "insert into public.property_groups (created_at, owner_id, name) values ($1::timestamptz, $2::uuid, $3) returning id",
      [now().toISOString(), ownerId, name],
    ))[0]!.id;
    const properties = await ownersProperties(tx, ownerId, input.propertyIds);
    await setGroupProperties(tx, groupId, properties);
    await audit(tx, { actor: `owner:${ownerId}`, action: "group.created", entity: "property_group", entityId: groupId, detail: { properties } });
    return groupId;
  });
  return (await getGroup(db, ownerId, id))!;
}

/** Renames a group and sets which properties are in it. Everyone assigned to the group follows at once. */
export async function updateGroup(db: Db, ownerId: string, groupId: string, input: { name: string; propertyIds: string[] }): Promise<PropertyGroup | null> {
  const name = checkGroupName(input.name);
  if (!isUuid(groupId)) return null;
  const changed = await db.tx(async (tx) => {
    const rows = await tx.query<{ id: string }>("update public.property_groups set name = $3 where id = $1::uuid and owner_id = $2::uuid returning id", [groupId, ownerId, name]);
    if (!rows[0]) return false;
    const diff = await setGroupProperties(tx, groupId, await ownersProperties(tx, ownerId, input.propertyIds));
    await audit(tx, { actor: `owner:${ownerId}`, action: "group.changed", entity: "property_group", entityId: groupId, detail: { name, properties_added: diff.added, properties_removed: diff.removed } });
    return true;
  });
  return changed ? getGroup(db, ownerId, groupId) : null;
}

/** Deletes a group. Its properties stay; anyone assigned only through the group loses them from their list. */
export async function deleteGroup(db: Db, ownerId: string, groupId: string): Promise<boolean> {
  if (!isUuid(groupId)) return false;
  return db.tx(async (tx) => {
    const rows = await tx.query<{ id: string }>("delete from public.property_groups where id = $1::uuid and owner_id = $2::uuid returning id", [groupId, ownerId]);
    if (!rows[0]) return false;
    await audit(tx, { actor: `owner:${ownerId}`, action: "group.deleted", entity: "property_group", entityId: groupId });
    return true;
  });
}

// ---------------------------------------------------------------------------
// THE CLEANER'S SIDE: one link, every house they may report on
// ---------------------------------------------------------------------------

export type TeamLink = { id: string; token: string; userId: string; phone: string };

/** The person a team link belongs to, or null. */
export async function findTeamLink(db: Db, token: string): Promise<TeamLink | null> {
  if (!/^[A-Za-z0-9]{20,40}$/.test(token)) return null;
  const rows = await db.query<{ id: string; link_token: string; user_id: string; phone: string | null; disabled_at: Date | null }>(
    `select l.id, l.link_token, l.user_id, u.phone, u.disabled_at
       from public.team_links l join public.users u on u.id = l.user_id
      where l.link_token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row || !row.phone || row.disabled_at !== null) return null;
  return { id: row.id, token: row.link_token, userId: row.user_id, phone: row.phone };
}

/** A house on a team member's list, with whose it is and how a report from them is handled. */
export type TeamHouse = {
  property: Property;
  memberId: string;
  /** The name this owner knows them by. Reports are signed with it. */
  memberName: string;
  dispatch: Dispatch;
  ownerFirstName: string;
};

/**
 * Every house this person may report on, across every owner who has them on
 * their team now: ticked one by one, or in a ticked group. Only covered
 * properties, and only an owner's own properties, ever appear.
 */
export async function housesForLink(db: Db, linkId: string): Promise<TeamHouse[]> {
  if (!isUuid(linkId)) return [];
  const rows = await db.query<Record<string, unknown> & { member_id: string; member_name: string; dispatch: Dispatch; owner_name: string }>(
    `select distinct on (p.id) p.*, m.id as member_id, m.name as member_name, m.dispatch, u.name as owner_name
       from public.team_members m
       join public.team_access a on a.member_id = m.id
       left join public.property_group_members gm on gm.group_id = a.group_id
       join public.properties p on p.id = coalesce(a.property_id, gm.property_id) and p.owner_id = m.owner_id
       join public.owners o on o.id = m.owner_id
       join public.users u on u.id = o.user_id
      where m.link_id = $1::uuid and m.removed_at is null and p.status = 'active'
      order by p.id`,
    [linkId],
  );
  return rows
    .map((row) => ({
      property: rowToProperty(row as unknown as Parameters<typeof rowToProperty>[0]),
      memberId: row.member_id,
      memberName: row.member_name,
      dispatch: row.dispatch,
      ownerFirstName: firstName(row.owner_name),
    }))
    .sort((a, b) => a.property.name.localeCompare(b.property.name));
}

/** One house on this person's list, or null if it is not on it. */
export async function houseForLink(db: Db, linkId: string, propertyId: string): Promise<TeamHouse | null> {
  if (!isUuid(propertyId)) return null;
  return (await housesForLink(db, linkId)).find((house) => house.property.id === propertyId) ?? null;
}
