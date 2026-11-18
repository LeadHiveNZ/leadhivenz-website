import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { getJobForOwner } from "@/lib/jobs/store";
import { parsePropertyRows } from "@/lib/properties/import";
import { maskedPhone, openTeamPending, sealTeamDevice, sealTeamPending, teamDeviceMatches } from "@/lib/team/device";
import {
  addTeamMember, createGroup, findTeamLink, housesForLink, listTeam, removeTeamMember, TeamError, updateGroup, updateTeamMember,
} from "@/lib/team/service";
import { testDb } from "./db";
import { auditActions, liveMarket, logJob, makeOwner, makeProperty, MONDAY_10AM, textsTo } from "./factory";

/**
 * A CLEANER IS A PERSON, NOT A LINK (DECISIONS.md, 2026-11-18).
 *
 * One person, one link for life, listing every house they may report on
 * across every owner who added their mobile. Reports are signed with their
 * name and follow each owner's "straight away" or "ask me first".
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const MELE = "+64211239001";
const SECRET = "test-secret-that-is-at-least-32-characters";

async function setup() {
  await liveMarket(t.db);
  const sam = await makeOwner(t.db);
  const priya = await makeOwner(t.db);
  const lakeview = await makeProperty(t.db, sam.ownerId, { name: "Lakeview" });
  const cabin = await makeProperty(t.db, sam.ownerId, { name: "Cabin" });
  const loft = await makeProperty(t.db, sam.ownerId, { name: "Loft" });
  const studio = await makeProperty(t.db, priya.ownerId, { name: "Studio" });
  return { sam, priya, lakeview, cabin, loft, studio };
}

const names = (houses: Awaited<ReturnType<typeof housesForLink>>) => houses.map((house) => house.property.name);

describe("adding a cleaner", () => {
  it("makes one link for the person, texts it to them, and writes the audit entry", async () => {
    const { sam, lakeview } = await setup();
    const { member, linkToken } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] });
    expect(member).toMatchObject({ name: "Mele", phone: MELE, dispatch: "straight", propertyIds: [lakeview.id] });
    expect(linkToken).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(await auditActions(t.db, member.id)).toEqual(["team.added"]);
    const invite = await textsTo(t.db, MELE, "team_invite");
    expect(invite).toHaveLength(1);
    expect(invite[0]!.body).toContain(`/r/${linkToken}`);
    expect(invite[0]!.body).toContain("Mele");
  });

  it("gives the same link when a second owner adds the same mobile, and the list spans both owners", async () => {
    const { sam, priya, lakeview, studio } = await setup();
    const first = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] });
    const second = await addTeamMember(t.db, priya.ownerId, MELE, { name: "Mele F", dispatch: "ask", propertyIds: [studio.id], groupIds: [] });
    expect(second.linkToken).toBe(first.linkToken);
    const link = (await findTeamLink(t.db, first.linkToken))!;
    const houses = await housesForLink(t.db, link.id);
    expect(names(houses)).toEqual(["Lakeview", "Studio"]);
    // Each owner's own name and setting for her.
    expect(houses.map((house) => [house.memberName, house.dispatch])).toEqual([["Mele", "straight"], ["Mele F", "ask"]]);
  });

  it("refuses the owner's own mobile, and someone already on the team", async () => {
    const { sam, lakeview } = await setup();
    await expect(addTeamMember(t.db, sam.ownerId, sam.user.phone!, { name: "Me", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] })).rejects.toBeInstanceOf(TeamError);
    await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] });
    await expect(addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [], groupIds: [] })).rejects.toThrow("already on your team");
  });
});

describe("the list of houses", () => {
  it("loses a house when it is unticked, and writes what changed", async () => {
    const { sam, lakeview, cabin } = await setup();
    const { member, linkToken } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id, cabin.id], groupIds: [] });
    const link = (await findTeamLink(t.db, linkToken))!;
    expect(names(await housesForLink(t.db, link.id))).toEqual(["Cabin", "Lakeview"]);
    await updateTeamMember(t.db, sam.ownerId, member.id, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] });
    expect(names(await housesForLink(t.db, link.id))).toEqual(["Lakeview"]);
    const entry = await t.db.query<{ detail: { properties_removed: string[] } }>("select detail from public.audit_log where action = 'team.properties_changed' and entity_id = $1", [member.id]);
    expect(entry[0]!.detail.properties_removed).toEqual([cabin.id]);
  });

  it("covers a property added to an assigned group later, without touching the cleaner", async () => {
    const { sam, lakeview, cabin, loft } = await setup();
    const group = await createGroup(t.db, sam.ownerId, { name: "Frankton", propertyIds: [lakeview.id] });
    const { linkToken } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [], groupIds: [group.id] });
    const link = (await findTeamLink(t.db, linkToken))!;
    expect(names(await housesForLink(t.db, link.id))).toEqual(["Lakeview"]);
    await updateGroup(t.db, sam.ownerId, group.id, { name: "Frankton", propertyIds: [lakeview.id, cabin.id, loft.id] });
    expect(names(await housesForLink(t.db, link.id))).toEqual(["Cabin", "Lakeview", "Loft"]);
    expect(await auditActions(t.db, group.id)).toEqual(["group.created", "group.changed"]);
  });

  it("shows a house once when it is ticked and also in a group", async () => {
    const { sam, lakeview } = await setup();
    const group = await createGroup(t.db, sam.ownerId, { name: "All", propertyIds: [lakeview.id] });
    const { linkToken } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [group.id] });
    expect(names(await housesForLink(t.db, (await findTeamLink(t.db, linkToken))!.id))).toEqual(["Lakeview"]);
  });

  it("can be put back after removal, as the same team member", async () => {
    const { sam, lakeview } = await setup();
    const { member } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] });
    expect(await removeTeamMember(t.db, sam.ownerId, member.id)).toBe(true);
    expect(await listTeam(t.db, sam.ownerId)).toEqual([]);
    const again = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "ask", propertyIds: [lakeview.id], groupIds: [] });
    expect(again.member.id).toBe(member.id);
    expect(await auditActions(t.db, member.id)).toEqual(["team.added", "team.removed", "team.added"]);
    expect(await textsTo(t.db, MELE, "team_invite")).toHaveLength(2);
  });
});

describe("a report from the cleaner's link", () => {
  it("is signed with her name and sends a tradie straight away when the owner chose that", async () => {
    const { sam, lakeview } = await setup();
    const { member } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [lakeview.id], groupIds: [] });
    const job = await logJob(t.db, lakeview, {
      reportedBy: "team", reporterName: "Mele", reporterPhone: MELE, teamMemberId: member.id, askOwnerFirst: false, urgent: true,
      uploader: `team:${member.linkId}`, actor: `team:${member.id}`,
    });
    // Sent out at once (no tradies are set up here, so it goes straight to the dispatcher), not held for the owner.
    expect(job).toMatchObject({ status: "unfilled", reportedBy: "team", reporterName: "Mele", teamMemberId: member.id, urgency: "urgent" });
    expect((await getJobForOwner(t.db, sam.ownerId, job.id))?.teamMemberId).toBe(member.id);
    const logged = await textsTo(t.db, sam.user.phone!, "job_logged");
    expect(logged[0]!.body).toContain("Mele logged");
    const created = await t.db.query<{ actor: string; detail: { team_member: string } }>("select actor, detail from public.audit_log where action = 'job.created' and entity_id = $1", [job.id]);
    expect(created[0]).toMatchObject({ actor: `team:${member.id}`, detail: { team_member: member.id } });
  });

  it("waits for the owner when the owner asked to say yes first, and never commits them to urgent", async () => {
    const { sam, lakeview } = await setup();
    const { member } = await addTeamMember(t.db, sam.ownerId, MELE, { name: "Mele", dispatch: "ask", propertyIds: [lakeview.id], groupIds: [] });
    const job = await logJob(t.db, lakeview, {
      reportedBy: "team", reporterName: "Mele", reporterPhone: MELE, teamMemberId: member.id, askOwnerFirst: true, urgent: true, description: "Water everywhere",
      uploader: `team:${member.linkId}`, actor: `team:${member.id}`,
    });
    expect(job).toMatchObject({ status: "awaiting_owner", urgency: "standard", description: "Mele says this is urgent. Water everywhere" });
    const asked = await textsTo(t.db, sam.user.phone!, "team_report");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.body).toContain("Mele reported");
  });
});

describe("the phone check", () => {
  it("only accepts a cookie made for this link with this secret", () => {
    const link = { id: "11111111-1111-4111-8111-111111111111", token: "AAAAAAAAAAAAAAAAAAAAAAAA" };
    const other = { id: "22222222-2222-4222-8222-222222222222", token: "BBBBBBBBBBBBBBBBBBBBBBBB" };
    const cookie = sealTeamDevice(SECRET, link);
    expect(teamDeviceMatches(SECRET, cookie, link)).toBe(true);
    expect(teamDeviceMatches(SECRET, cookie, other)).toBe(false);
    expect(teamDeviceMatches(SECRET, cookie, { ...link, token: "CCCCCCCCCCCCCCCCCCCCCCCC" })).toBe(false);
    expect(teamDeviceMatches("another-secret-that-is-32-characters-long", cookie, link)).toBe(false);
    expect(teamDeviceMatches(SECRET, undefined, link)).toBe(false);
    expect(teamDeviceMatches(SECRET, `${link.id}.forged`, link)).toBe(false);
  });

  it("keeps the waiting-for-a-code note for 15 minutes only, and refuses a changed one", () => {
    const sealed = sealTeamPending(SECRET, { linkId: "x", expiresAt: 1_000_000 });
    expect(openTeamPending(SECRET, sealed, 999_999)).toMatchObject({ linkId: "x" });
    expect(openTeamPending(SECRET, sealed, 1_000_001)).toBeNull();
    expect(openTeamPending(SECRET, `${sealed}x`, 999_999)).toBeNull();
  });

  it("shows only enough of the mobile for the person to recognise it", () => {
    expect(maskedPhone("021 123 4521")).toBe("021 *** 4521");
  });
});

describe("pasting a spreadsheet of properties", () => {
  it("reads tabs or commas, skips a heading line, and says each line's problem", () => {
    const pasted = [
      "Name\tAddress\tSuburb\tPostcode\tAccess",
      "Lakeview\t14B Lake Esplanade\tQueenstown\t9300\tLockbox 4821",
      "",
      'Cabin, 27 Atley Road, Arthurs Point, 9371, "Key safe, back door"',
      "No address,,Frankton",
    ].join("\n");
    const { rows, tooMany } = parsePropertyRows(pasted);
    expect(tooMany).toBe(false);
    expect(rows.map((row) => [row.line, row.name, row.addressLine1, row.suburb, row.postcode, row.accessNotes, row.problems])).toEqual([
      [2, "Lakeview", "14B Lake Esplanade", "Queenstown", "9300", "Lockbox 4821", []],
      [4, "Cabin", "27 Atley Road", "Arthurs Point", "9371", "Key safe, back door", []],
      [5, "No address", "", "Frankton", "", "", ["No street address."]],
    ]);
  });

  it("stops at 200 lines", () => {
    const { rows, tooMany } = parsePropertyRows(Array.from({ length: 205 }, (_, index) => `House ${index}, ${index} Main Road, Frankton, 9300`).join("\n"));
    expect(rows).toHaveLength(200);
    expect(tooMany).toBe(true);
  });
});
