import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { acceptOffer, suggestLaterTime } from "@/lib/dispatch/cascade";
import { attachUploads, canView, checkFile, getUpload, recordUpload } from "@/lib/files/uploads";
import { getJobForOwner, getJobForStaff, getJobForTradie, listJobsForOwner, listJobsForTradie, listLiveOffersForTradie } from "@/lib/jobs/store";
import { completeJob, markArrived, markEnRoute, reportHazard, reportNoAccess, reportTradieAbsent, submitQuote } from "@/lib/jobs/work";
import { balanceOwed } from "@/lib/billing/chargebacks";
import { confirmFixed } from "@/lib/jobs/confirm";
import { addParts } from "@/lib/jobs/parts";
import { confirmPin, propertiesNeedingPin } from "@/lib/properties/pin";
import { laterWindows } from "@/lib/jobs/arrival";
import { loadJobView } from "@/lib/jobs/view";
import { getMarket } from "@/lib/markets/store";
import { offerLinkCode, offerLinkMatches, ownerJobLinkCode, ownerJobLinkMatches, parseLinkCode } from "@/lib/links";
import { changeTier, findPropertyByReportToken, getProperty, listProperties, requestCancel, rotateReportLink, updateProperty } from "@/lib/properties/service";
import { createDemoGateway } from "@/lib/payments/demo-gateway";
import { cancelPortfolio, countPortfolioProperties, getPortfolio, joinPortfolio, listPortfolios, openPortfolio, removeFromPortfolio, startPortfolio } from "@/lib/properties/portfolio";
import type { FileStore } from "@/lib/files/store";
import { listInsuranceCertificates, saveInsuranceCertificate } from "@/lib/tradies/certificate";
import { createTradie, getTradie } from "@/lib/tradies/service";
import { getUser, viewerFor } from "@/lib/auth/users";
import { TEAM_DEVICE_COOKIE, teamDeviceMatches } from "@/lib/team/device";
import {
  addTeamMember, createGroup, deleteGroup, findTeamLink, getGroup, getTeamMember, houseForLink, housesForLink, listGroups, listTeam, removeTeamMember,
  updateGroup, updateTeamMember,
} from "@/lib/team/service";
import { testDb } from "./db";
import { arrive, auditActions, certificate, HOUSE, liveMarket, logJob, makeOwner, makePortfolio, makeProperty, makeTradie, MONDAY_10AM, offersFor, photo } from "./factory";

/**
 * PEOPLE ONLY SEE THEIR OWN DATA.
 *
 * Two owners and two tradies. Every way of reading or changing something is
 * tried by the wrong person, and must come back empty or refused.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function twoOfEverything() {
  await liveMarket(t.db);
  const alice = await makeOwner(t.db);
  const bob = await makeOwner(t.db);
  const aliceHome = await makeProperty(t.db, alice.ownerId, { name: "Alice's bach" });
  const bobHome = await makeProperty(t.db, bob.ownerId, { name: "Bob's apartment" });
  const mike = await makeTradie(t.db, { slot: 1 });
  const dave = await makeTradie(t.db, { slot: 2 });
  const aliceJob = await logJob(t.db, aliceHome);
  const [offer] = await offersFor(t.db, aliceJob.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  return { alice, bob, aliceHome, bobHome, mike, dave, aliceJob, offer: offer! };
}

describe("owners", () => {
  it("cannot open another owner's property", async () => {
    const { alice, bob, aliceHome, bobHome } = await twoOfEverything();
    expect((await getProperty(t.db, alice.ownerId, aliceHome.id))?.name).toBe("Alice's bach");
    expect(await getProperty(t.db, bob.ownerId, aliceHome.id)).toBeNull();
    expect(await getProperty(t.db, alice.ownerId, bobHome.id)).toBeNull();
    expect((await listProperties(t.db, bob.ownerId)).map((p) => p.name)).toEqual(["Bob's apartment"]);
  });

  it("cannot change, cancel, re-tier or re-link another owner's property", async () => {
    const { alice, bob, aliceHome } = await twoOfEverything();
    expect(await updateProperty(t.db, bob.ownerId, aliceHome.id, { accessNotes: "Hacked", name: "Mine now" })).toBeNull();
    expect(await requestCancel(t.db, null, bob.ownerId, aliceHome.id)).toBeNull();
    expect(await changeTier(t.db, null, bob.ownerId, aliceHome.id, aliceHome.tierId!)).toBeNull();
    expect(await rotateReportLink(t.db, bob.ownerId, aliceHome.id, "guest")).toBeNull();

    const untouched = await getProperty(t.db, alice.ownerId, aliceHome.id);
    expect(untouched).toMatchObject({ name: "Alice's bach", accessNotes: aliceHome.accessNotes, guestToken: aliceHome.guestToken, cancelAtPeriodEnd: false });
  });

  it("cannot open or list another owner's jobs", async () => {
    const { alice, bob, aliceJob } = await twoOfEverything();
    expect((await getJobForOwner(t.db, alice.ownerId, aliceJob.id))?.id).toBe(aliceJob.id);
    expect(await getJobForOwner(t.db, bob.ownerId, aliceJob.id)).toBeNull();
    expect(await listJobsForOwner(t.db, bob.ownerId)).toEqual([]);
    expect((await listJobsForOwner(t.db, alice.ownerId)).map((job) => job.id)).toEqual([aliceJob.id]);
  });
});

describe("owners on Portfolio", () => {
  it("cannot read, start, cancel, re-price or change another owner's portfolio or its properties", async () => {
    await liveMarket(t.db);
    const alice = await makeOwner(t.db);
    const bob = await makeOwner(t.db);
    const { portfolio, properties } = await makePortfolio(t.db, alice.ownerId, 10);
    const gateway = createDemoGateway(t.db, "NZ");

    // Alice sees hers. Bob sees nothing, whichever way he asks.
    expect((await getPortfolio(t.db, alice.ownerId, portfolio.id))?.id).toBe(portfolio.id);
    expect(await getPortfolio(t.db, bob.ownerId, portfolio.id)).toBeNull();
    expect(await listPortfolios(t.db, bob.ownerId)).toEqual([]);
    expect(await openPortfolio(t.db, bob.ownerId, "queenstown")).toBeNull();
    expect(await getProperty(t.db, bob.ownerId, properties[0]!.id)).toBeNull();

    // Nor can he act on it.
    expect(await startPortfolio(t.db, gateway, { ownerId: bob.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" })).toEqual({ kind: "error", message: "We could not find that Portfolio." });
    expect(await cancelPortfolio(t.db, gateway, bob.ownerId, portfolio.id)).toBeNull();
    expect(await removeFromPortfolio(t.db, gateway, bob.ownerId, properties[0]!.id)).toBe(false);
    expect(await requestCancel(t.db, gateway, bob.ownerId, properties[0]!.id)).toBeNull();
    // Putting his own property on Alice's portfolio is refused too.
    const bobHome = await makeProperty(t.db, bob.ownerId, { member: false });
    expect(await joinPortfolio(t.db, gateway, bob.ownerId, bobHome.id, portfolio)).toBe(false);
    expect((await getProperty(t.db, bob.ownerId, bobHome.id))?.portfolioId).toBeNull();

    // Alice's portfolio is exactly as it was: ten properties covered, NZ$600, not ending.
    expect(await getPortfolio(t.db, alice.ownerId, portfolio.id)).toMatchObject({ status: "active", bandCents: 60000, cancelAtPeriodEnd: false });
    expect(await countPortfolioProperties(t.db, portfolio.id)).toBe(10);
  });
});

describe("cleaners and co-hosts on a team (DECISIONS.md, 2026-11-18)", () => {
  const MELE = "+64211239002";
  const SECRET = "test-secret-that-is-at-least-32-characters";

  it("see only the houses they were given, and nothing of billing, jobs or the owner's account", async () => {
    const { alice, bob, aliceHome, bobHome } = await twoOfEverything();
    const aliceSecond = await makeProperty(t.db, alice.ownerId, { name: "Alice's flat" });
    const { member, linkToken } = await addTeamMember(t.db, alice.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id], groupIds: [] });
    const link = (await findTeamLink(t.db, linkToken))!;
    expect((await housesForLink(t.db, link.id)).map((house) => house.property.name)).toEqual(["Alice's bach"]);
    expect(await houseForLink(t.db, link.id, aliceSecond.id)).toBeNull();
    expect(await houseForLink(t.db, link.id, bobHome.id)).toBeNull();
    // What the list hands over: the house, the name she is known by and the owner's first name. No card, no billing, no prices.
    const house = (await houseForLink(t.db, link.id, aliceHome.id))!;
    expect(Object.keys(house).sort()).toEqual(["dispatch", "memberId", "memberName", "ownerFirstName", "property"]);
    expect(JSON.stringify(house)).not.toMatch(/card|billing|customer|payment/i);
    // Her account is not an owner, a tradie or staff, so every signed-in page refuses her.
    const viewer = await viewerFor(t.db, (await getUser(t.db, link.userId))!);
    expect(viewer).toMatchObject({ ownerId: null, tradieId: null, staffRole: null });
    expect(member.ownerId).toBe(alice.ownerId);
    void bob;
  });

  it("removed by one owner, still see the other owner's houses", async () => {
    const { alice, bob, aliceHome, bobHome } = await twoOfEverything();
    const fromAlice = await addTeamMember(t.db, alice.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id], groupIds: [] });
    await addTeamMember(t.db, bob.ownerId, MELE, { name: "Mele", dispatch: "ask", propertyIds: [bobHome.id], groupIds: [] });
    const link = (await findTeamLink(t.db, fromAlice.linkToken))!;
    expect((await housesForLink(t.db, link.id)).map((house) => house.property.name).sort()).toEqual(["Alice's bach", "Bob's apartment"]);
    expect(await removeTeamMember(t.db, alice.ownerId, fromAlice.member.id)).toBe(true);
    expect((await housesForLink(t.db, link.id)).map((house) => house.property.name)).toEqual(["Bob's apartment"]);
  });

  it("cannot be seen, changed or removed by another owner, who cannot give away houses that are not theirs", async () => {
    const { alice, bob, aliceHome, bobHome } = await twoOfEverything();
    const { member, linkToken } = await addTeamMember(t.db, alice.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id], groupIds: [] });
    expect(await getTeamMember(t.db, bob.ownerId, member.id)).toBeNull();
    expect(await listTeam(t.db, bob.ownerId)).toEqual([]);
    expect(await updateTeamMember(t.db, bob.ownerId, member.id, { name: "Hacked", dispatch: "ask", propertyIds: [bobHome.id], groupIds: [] })).toBeNull();
    expect(await removeTeamMember(t.db, bob.ownerId, member.id)).toBe(false);
    expect(await getTeamMember(t.db, alice.ownerId, member.id)).toMatchObject({ name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id] });

    // Bob adds her too, ticking Alice's house and Alice's group: neither is given.
    const aliceGroup = await createGroup(t.db, alice.ownerId, { name: "Alice's", propertyIds: [aliceHome.id] });
    const fromBob = await addTeamMember(t.db, bob.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id, bobHome.id], groupIds: [aliceGroup.id] });
    expect(fromBob.member).toMatchObject({ propertyIds: [bobHome.id], groupIds: [] });
    const houses = await housesForLink(t.db, (await findTeamLink(t.db, linkToken))!.id);
    // Alice's house is on the list once, as Alice's, never as Bob's.
    expect(houses.map((house) => [house.property.name, house.memberId])).toEqual([["Alice's bach", member.id], ["Bob's apartment", fromBob.member.id]]);

    // Groups are private too.
    const bobGroup = await createGroup(t.db, bob.ownerId, { name: "Bob's", propertyIds: [aliceHome.id, bobHome.id] });
    expect(bobGroup.propertyIds).toEqual([bobHome.id]);
    expect(await getGroup(t.db, bob.ownerId, aliceGroup.id)).toBeNull();
    expect(await listGroups(t.db, bob.ownerId)).toHaveLength(1);
    expect(await updateGroup(t.db, bob.ownerId, aliceGroup.id, { name: "Mine", propertyIds: [bobHome.id] })).toBeNull();
    expect(await deleteGroup(t.db, bob.ownerId, aliceGroup.id)).toBe(false);
    expect(await getGroup(t.db, alice.ownerId, aliceGroup.id)).toMatchObject({ name: "Alice's", propertyIds: [aliceHome.id] });
  });

  it("need the phone's cookie: a forwarded link with no cookie opens nothing but the code screen", async () => {
    const { alice, aliceHome } = await twoOfEverything();
    const { linkToken } = await addTeamMember(t.db, alice.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id], groupIds: [] });
    const link = (await findTeamLink(t.db, linkToken))!;
    expect(TEAM_DEVICE_COOKIE).toBe("hf_team");
    expect(teamDeviceMatches(SECRET, undefined, link)).toBe(false);
    // A link that is not a team link, or a guest QR code, is never mistaken for one.
    expect(await findTeamLink(t.db, aliceHome.guestToken)).toBeNull();
    expect(await findTeamLink(t.db, "AAAAAAAAAAAAAAAAAAAAAAAA")).toBeNull();
  });

  it("leave the guest QR card anonymous and per property", async () => {
    const { alice, aliceHome } = await twoOfEverything();
    const { linkToken } = await addTeamMember(t.db, alice.ownerId, MELE, { name: "Mele", dispatch: "straight", propertyIds: [aliceHome.id], groupIds: [] });
    const found = await findPropertyByReportToken(t.db, aliceHome.guestToken);
    expect(found).toMatchObject({ via: "guest", property: { id: aliceHome.id } });
    // The team link is not a property link, and the guest link carries no person.
    expect(await findPropertyByReportToken(t.db, linkToken)).toBeNull();
    const guestJob = await logJob(t.db, aliceHome, { reportedBy: "guest", reporterName: "Gus", reporterPhone: null, code: "PL-03" });
    expect(guestJob.teamMemberId).toBeNull();
  });
});

describe("tradies", () => {
  it("can open a job only once it is theirs", async () => {
    const { mike, dave, aliceJob, bobHome } = await twoOfEverything();
    expect((await getJobForTradie(t.db, mike.tradieId, aliceJob.id))?.id).toBe(aliceJob.id);
    expect(await getJobForTradie(t.db, dave.tradieId, aliceJob.id)).toBeNull();
    expect(await listJobsForTradie(t.db, dave.tradieId)).toEqual([]);

    // A job on offer to Mike but not yet accepted is not his to open, and Dave sees nothing of it.
    const offered = await logJob(t.db, bobHome, { code: "PL-03" });
    expect(await getJobForTradie(t.db, mike.tradieId, offered.id)).toBeNull();
    expect((await listLiveOffersForTradie(t.db, mike.tradieId, MONDAY_10AM)).map((o) => o.jobId)).toEqual([offered.id]);
    expect(await listLiveOffersForTradie(t.db, dave.tradieId, MONDAY_10AM)).toEqual([]);
  });

  it("cannot take any step on someone else's job", async () => {
    const { mike, dave, aliceJob } = await twoOfEverything();
    const mine = await photo(t.db, `tradie:${dave.tradieId}`);
    expect(await markEnRoute(t.db, aliceJob.id, dave.tradieId)).toMatchObject({ ok: false });
    expect(await arrive(t.db, aliceJob.id, dave.tradieId, HOUSE)).toMatchObject({ ok: false });
    await arrive(t.db, aliceJob.id, mike.tradieId, HOUSE);
    expect(await submitQuote(t.db, aliceJob.id, dave.tradieId, { description: "Extra", labourCents: 5000, uploadIds: [] })).toMatchObject({ ok: false });
    expect(await completeJob(t.db, aliceJob.id, dave.tradieId, { note: "", uploadIds: [mine], ...HOUSE })).toMatchObject({ ok: false });
    expect(await reportNoAccess(t.db, aliceJob.id, dave.tradieId, { note: "Could not get in at all", uploadIds: [mine], ...HOUSE })).toMatchObject({ ok: false });
    expect((await getJobForTradie(t.db, mike.tradieId, aliceJob.id))!.status).toBe("on_site");
  });

  it("see nothing of the owner's choice about a later time, and only a chosen tradie can suggest one (DECISIONS.md, 2026-11-18)", async () => {
    const { bob, bobHome, mike, dave } = await twoOfEverything();
    const job = await logJob(t.db, bobHome, { code: "PL-03" });
    const [offer] = await offersFor(t.db, job.id);
    expect(offer!.tradie_id).toBe(mike.tradieId);
    const market = (await getMarket(t.db, "queenstown"))!;
    const later = laterWindows(market, job.respondBy!, MONDAY_10AM)[0]!;
    expect((await t.db.tx((tx) => suggestLaterTime(tx, offer!.id, later.end.toISOString(), "link"))).ok).toBe(true);
    // The owner sees the choice. A tradie's view of the job never carries it.
    expect((await loadJobView(t.db, (await getJobForOwner(t.db, bob.ownerId, job.id))!, "owner")).laterTime).not.toBeNull();
    expect((await loadJobView(t.db, job, "tradie")).laterTime).toBeNull();
    // The backup has no offer on this job, so nothing to suggest on, and Mike cannot suggest twice.
    expect(await listLiveOffersForTradie(t.db, dave.tradieId, MONDAY_10AM)).toEqual([]);
    expect((await t.db.tx((tx) => suggestLaterTime(tx, offer!.id, later.end.toISOString(), "link"))).ok).toBe(false);
  });

  it("an owner cannot say the tradie is missing from another owner's job, and the button does nothing before Arrived", async () => {
    const { alice, aliceJob, mike } = await twoOfEverything();
    expect(await reportTradieAbsent(t.db, aliceJob.id, `owner:${alice.ownerId}`)).toMatchObject({ ok: false });
    await arrive(t.db, aliceJob.id, mike.tradieId, HOUSE);
    // The action finds the job through the owner's own id or their one-tap link first: Bob's id finds nothing.
    expect(await getJobForOwner(t.db, (await makeOwner(t.db)).ownerId, aliceJob.id)).toBeNull();
  });
});

describe("checking a finished job (DECISIONS.md, 2026-11-19)", () => {
  it("an owner cannot confirm another owner's flagged job, or move another owner's map pin", async () => {
    const { alice, bob, aliceHome, mike, aliceJob } = await twoOfEverything();
    // No location at either tap: flagged, and the payment held for Alice to confirm.
    await arrive(t.db, aliceJob.id, mike.tradieId);
    await completeJob(t.db, aliceJob.id, mike.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${mike.tradieId}`)] });
    expect((await getJobForStaff(t.db, aliceJob.id))!.confirmStatus).toBe("waiting");
    expect(await confirmFixed(t.db, aliceJob.id, bob.ownerId, `owner:${bob.ownerId}`)).toMatchObject({ ok: false });
    expect((await getJobForStaff(t.db, aliceJob.id))!.confirmStatus).toBe("waiting");
    expect(await confirmFixed(t.db, aliceJob.id, alice.ownerId, `owner:${alice.ownerId}`)).toMatchObject({ ok: true });

    expect(await confirmPin(t.db, bob.ownerId, aliceHome.id, { lat: -45.03, lng: 168.66, moved: true })).toMatchObject({ ok: false });
    expect((await getProperty(t.db, alice.ownerId, aliceHome.id))!.pin).toBeNull();
    expect(await propertiesNeedingPin(t.db, bob.ownerId)).toEqual([expect.objectContaining({ name: "Bob's apartment" })]);
  });

  it("before photos are seen by the job's owner, the tradie on it and staff. Nobody else", async () => {
    const { alice, bob, mike, dave, aliceJob } = await twoOfEverything();
    const before = await photo(t.db, `tradie:${mike.tradieId}`, "before");
    // Dave cannot attach his own before photo to Mike's job, nor Mike's.
    expect(await markArrived(t.db, aliceJob.id, dave.tradieId, { uploadIds: [before] })).toMatchObject({ ok: false });
    expect(await markArrived(t.db, aliceJob.id, mike.tradieId, { uploadIds: [before] })).toMatchObject({ ok: true });
    const upload = (await getUpload(t.db, before))!;
    expect(upload).toMatchObject({ kind: "before", attached: true, jobId: aliceJob.id });
    expect(await canView(t.db, upload, { ownerId: alice.ownerId })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: mike.tradieId })).toBe(true);
    expect(await canView(t.db, upload, { staff: true })).toBe(true);
    expect(await canView(t.db, upload, { ownerId: bob.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { tradieId: dave.tradieId })).toBe(false);
    expect(await canView(t.db, upload, {})).toBe(false);
  });
});

describe("parts receipts (DECISIONS.md, 2026-11-20)", () => {
  it("are seen by staff and the tradie who sent them. Never the owner, another owner or another tradie", async () => {
    const { alice, bob, mike, dave, aliceJob } = await twoOfEverything();
    await arrive(t.db, aliceJob.id, mike.tradieId, HOUSE);
    const id = await photo(t.db, `tradie:${mike.tradieId}`, "receipt");
    // Dave cannot put parts on Mike's job, nor attach Mike's receipt.
    expect(await addParts(t.db, aliceJob.id, dave.tradieId, { list: [], offList: { description: "Pipe", receiptTotalCents: 5000, amountCents: 5000, uploadId: id } })).toMatchObject({ ok: false });
    expect(await addParts(t.db, aliceJob.id, mike.tradieId, { list: [], offList: { description: "Pipe", receiptTotalCents: 5000, amountCents: 5000, uploadId: id } })).toMatchObject({ ok: true });
    const upload = (await getUpload(t.db, id))!;
    expect(upload).toMatchObject({ kind: "receipt", attached: true, jobId: aliceJob.id });
    expect(await canView(t.db, upload, { staff: true })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: mike.tradieId })).toBe(true);
    expect(await canView(t.db, upload, { ownerId: alice.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { ownerId: bob.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { tradieId: dave.tradieId })).toBe(false);
    expect(await canView(t.db, upload, {})).toBe(false);
    const view = await loadJobView(t.db, (await getJobForOwner(t.db, alice.ownerId, aliceJob.id))!, "owner");
    expect(view.receipts).toEqual([]);
    expect(view.parts.every((part) => part.receiptUploadId === null)).toBe(true);
  });
});

describe("guests, hazards and chargebacks (DECISIONS.md, 2026-11-20, second entry)", () => {
  it("a staying guest's number is seen by the owner who gave it and staff, never a tradie or another owner", async () => {
    const { alice, bob, mike, dave, aliceHome } = await twoOfEverything();
    const job = await logJob(t.db, aliceHome, { code: "PL-03", guestStaying: "yes", guestName: "Sam", guestPhone: "+64215550009" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    expect((await getJobForOwner(t.db, alice.ownerId, job.id))?.guestPhone).toBe("+64215550009");
    expect(await getJobForOwner(t.db, bob.ownerId, job.id)).toBeNull();
    const taker = (await getJobForStaff(t.db, job.id))!.tradieId!;
    expect(await getJobForTradie(t.db, taker, job.id)).toMatchObject({ guestName: "Sam", guestPhone: null });
    expect(await getJobForTradie(t.db, taker === mike.tradieId ? dave.tradieId : mike.tradieId, job.id)).toBeNull();
    expect((await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "tradie")).job.guestPhone).toBeNull();
  });

  it("only the tradie on the job can add a hazard to its property", async () => {
    const { mike, dave, aliceJob } = await twoOfEverything();
    expect(await reportHazard(t.db, aliceJob.id, dave.tradieId, "Steep icy drive")).toEqual({ ok: false, message: "That job is not one of yours." });
    expect(await reportHazard(t.db, aliceJob.id, mike.tradieId, "Steep icy drive")).toMatchObject({ ok: true });
  });

  it("a balance owed from a lost chargeback is read for its own tradie only, and the tables are closed to the public", async () => {
    const { mike, dave, aliceJob } = await twoOfEverything();
    await t.db.query(
      "insert into public.tradie_balances (created_at, tradie_id, job_id, reason, amount_cents, currency) values (now(), $1::uuid, $2::uuid, 'test', 5000, 'NZD')",
      [mike.tradieId, aliceJob.id],
    );
    expect(await balanceOwed(t.db, mike.tradieId)).toBe(5000);
    expect(await balanceOwed(t.db, dave.tradieId)).toBe(0);
    const rls = await t.db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname in ('chargebacks', 'tradie_balances', 'balance_recoveries') order by relname",
    );
    expect(rls).toEqual([
      { relname: "balance_recoveries", relrowsecurity: true }, { relname: "chargebacks", relrowsecurity: true }, { relname: "tradie_balances", relrowsecurity: true },
    ]);
  });
});

describe("photos", () => {
  it("are visible to the job's owner, the tradie on the job, and staff. Nobody else", async () => {
    const { alice, bob, mike, dave, aliceJob } = await twoOfEverything();
    await arrive(t.db, aliceJob.id, mike.tradieId, HOUSE);
    const id = await photo(t.db, `tradie:${mike.tradieId}`);
    await completeJob(t.db, aliceJob.id, mike.tradieId, { note: "", uploadIds: [id], ...HOUSE });
    const upload = (await getUpload(t.db, id))!;
    expect(upload).toMatchObject({ attached: true, jobId: aliceJob.id });

    expect(await canView(t.db, upload, { ownerId: alice.ownerId })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: mike.tradieId })).toBe(true);
    expect(await canView(t.db, upload, { staff: true })).toBe(true);
    expect(await canView(t.db, upload, { ownerId: bob.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { tradieId: dave.tradieId })).toBe(false);
    expect(await canView(t.db, upload, {})).toBe(false);
    expect(await canView(t.db, upload, { uploader: "report:someone-else" })).toBe(false);
  });

  it("of a property (the lockbox, the switchboard) are shown to a tradie only while they have a job under way there", async () => {
    const { alice, bob, aliceHome, mike, dave, aliceJob } = await twoOfEverything();
    const record = await recordUpload(t.db, { kind: "property", storageKey: "property/test/lockbox.jpg", contentType: "image/jpeg", bytes: 100, uploadedBy: `owner:${alice.ownerId}` });
    await attachUploads(t.db, [record.id], { kind: "property", uploadedBy: `owner:${alice.ownerId}`, propertyId: aliceHome.id });
    const upload = (await getUpload(t.db, record.id))!;
    expect(upload).toMatchObject({ attached: true, propertyId: aliceHome.id, jobId: null });

    // Mike has accepted a job at Alice's property. Dave was never on it.
    expect(await canView(t.db, upload, { ownerId: alice.ownerId })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: mike.tradieId })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: dave.tradieId })).toBe(false);
    expect(await canView(t.db, upload, { ownerId: bob.ownerId })).toBe(false);
    expect(await canView(t.db, upload, {})).toBe(false);

    // Once the job is finished, Mike can no longer see how to get into the property.
    await arrive(t.db, aliceJob.id, mike.tradieId, HOUSE);
    await completeJob(t.db, aliceJob.id, mike.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${mike.tradieId}`)], ...HOUSE });
    expect(await canView(t.db, upload, { tradieId: mike.tradieId })).toBe(false);
    expect(await canView(t.db, upload, { ownerId: alice.ownerId })).toBe(true);
  });

  it("can only be attached by the person who uploaded them, once, to the right kind of thing", async () => {
    const { mike, dave, aliceJob } = await twoOfEverything();
    const id = await photo(t.db, `tradie:${mike.tradieId}`);
    expect(await attachUploads(t.db, [id], { kind: "completion", uploadedBy: `tradie:${dave.tradieId}`, jobId: aliceJob.id })).toBe(0);
    expect(await attachUploads(t.db, [id], { kind: "report", uploadedBy: `tradie:${mike.tradieId}`, jobId: aliceJob.id })).toBe(0);
    expect(await attachUploads(t.db, [id, "not-an-id"], { kind: "completion", uploadedBy: `tradie:${mike.tradieId}`, jobId: aliceJob.id })).toBe(1);
    expect(await attachUploads(t.db, [id], { kind: "completion", uploadedBy: `tradie:${mike.tradieId}`, jobId: aliceJob.id })).toBe(0);
  });

  it("must really be photos: the file's contents are checked, not its name", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const script = new TextEncoder().encode("<script>alert(1)</script>");
    const pdf = new TextEncoder().encode("%PDF-1.7 ...");
    expect(checkFile("report", "image/jpeg", jpeg)).toEqual({ ok: true, ext: "jpg" });
    expect(checkFile("report", "image/png", png)).toEqual({ ok: true, ext: "png" });
    expect(checkFile("report", "image/jpeg", script)).toMatchObject({ ok: false });
    expect(checkFile("report", "text/html", script)).toMatchObject({ ok: false });
    expect(checkFile("report", "image/svg+xml", script)).toMatchObject({ ok: false });
    expect(checkFile("report", "image/jpeg", new Uint8Array(0))).toMatchObject({ ok: false });
    expect(checkFile("report", "image/jpeg", new Uint8Array(5 * 1024 * 1024).fill(0xff))).toMatchObject({ ok: false });
    // A PDF is fine for a licence, not for a job photo.
    expect(checkFile("licence", "application/pdf", pdf)).toEqual({ ok: true, ext: "pdf" });
    expect(checkFile("completion", "application/pdf", pdf)).toMatchObject({ ok: false });
  });
});

/** A file store kept in memory, standing in for Supabase Storage. */
function memoryStore(): FileStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    kind: "disk", files,
    async put(key, bytes) { files.set(key, bytes); },
    async get(key) { return files.get(key) ?? null; },
    async remove(keys) { for (const key of keys) files.delete(key); },
  };
}

const PDF = new TextEncoder().encode("%PDF-1.7 certificate of currency");

describe("insurance certificates", () => {
  it("are visible only to staff and the tradie they belong to: not an owner they work for, not another tradie", async () => {
    const { alice, mike, dave } = await twoOfEverything();
    const id = await certificate(t.db, mike.tradieId);
    const upload = (await getUpload(t.db, id))!;
    expect(upload).toMatchObject({ kind: "insurance_certificate", attached: true, tradieId: mike.tradieId, jobId: null });

    expect(await canView(t.db, upload, { staff: true })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: mike.tradieId, uploader: `tradie:${mike.tradieId}` })).toBe(true);
    // Alice has a job with Mike, and still cannot see his certificate.
    expect(await canView(t.db, upload, { ownerId: alice.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { tradieId: dave.tradieId, uploader: `tradie:${dave.tradieId}` })).toBe(false);
    expect(await canView(t.db, upload, {})).toBe(false);
  });

  it("must be a PDF, JPG or PNG, checked by its contents", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBP");
    expect(checkFile("insurance_certificate", "application/pdf", PDF)).toEqual({ ok: true, ext: "pdf" });
    expect(checkFile("insurance_certificate", "image/jpeg", jpeg)).toEqual({ ok: true, ext: "jpg" });
    expect(checkFile("insurance_certificate", "image/png", png)).toEqual({ ok: true, ext: "png" });
    expect(checkFile("insurance_certificate", "image/webp", webp)).toEqual({ ok: false, reason: "Please send the certificate as a PDF, JPG or PNG file." });
    expect(checkFile("insurance_certificate", "application/pdf", new TextEncoder().encode("<html>"))).toMatchObject({ ok: false });
    expect(checkFile("insurance_certificate", "application/pdf", new Uint8Array(5 * 1024 * 1024).fill(0x25))).toMatchObject({ ok: false });
  });

  it("are stored, recorded and audited together, and nothing is recorded when there is nowhere to store them", async () => {
    const { mike } = await twoOfEverything();
    const before = (await listInsuranceCertificates(t.db, mike.tradieId)).length;
    const nowhere = await saveInsuranceCertificate(t.db, null, { tradieId: mike.tradieId }, { bytes: PDF, contentType: "application/pdf", uploadedBy: `tradie:${mike.tradieId}`, actor: `tradie:${mike.tradieId}` });
    expect(nowhere).toMatchObject({ ok: false, reason: expect.stringContaining("Add it later from your profile") });
    expect(await listInsuranceCertificates(t.db, mike.tradieId)).toHaveLength(before);

    // A minute later than the one already on file, so the new one is the newest.
    setTestNow(new Date(MONDAY_10AM.getTime() + 60_000));
    const store = memoryStore();
    const saved = await saveInsuranceCertificate(t.db, store, { tradieId: mike.tradieId }, { bytes: PDF, contentType: "application/pdf", uploadedBy: `tradie:${mike.tradieId}`, actor: `tradie:${mike.tradieId}` });
    expect(saved.ok).toBe(true);
    expect(store.files.size).toBe(1);
    expect((await getTradie(t.db, mike.tradieId))!.insuranceCertificateId).toBe(saved.ok ? saved.uploadId : null);
    expect(await auditActions(t.db, mike.tradieId)).toContain("tradie.insurance_certificate_uploaded");
  });

  it("sent with the sign-up form are seen only by staff, then move to the tradie with their LBP number", async () => {
    await liveMarket(t.db);
    const lead = (await t.db.query<{ id: string }>(
      "insert into public.leads (lead_type, market, name, phone, trade, lbp_number) values ('tradie', 'queenstown', 'Lena Lead', '+64220009999', 'builder', 'BP998877') returning id",
    ))[0]!.id;
    const saved = await saveInsuranceCertificate(t.db, memoryStore(), { leadId: lead }, { bytes: PDF, contentType: "application/pdf", uploadedBy: `lead:${lead}`, actor: `lead:${lead}` });
    if (!saved.ok) throw new Error(saved.reason);
    const before = (await getUpload(t.db, saved.uploadId))!;
    expect(before).toMatchObject({ leadId: lead, tradieId: null });
    expect(await canView(t.db, before, { staff: true })).toBe(true);
    expect(await canView(t.db, before, { uploader: `lead:${lead}` })).toBe(false);
    expect(await auditActions(t.db, lead)).toContain("lead.insurance_certificate_uploaded");

    const { tradieId } = await createTradie(t.db, {
      name: "Lena Lead", phone: "+64220009999", email: null, market: "queenstown", businessName: "Lena Builds", trades: ["handyman"],
      daysAvailable: ["mon"], afterHours: false, gstRegistered: false, licences: [], leadId: lead,
    });
    const tradie = (await getTradie(t.db, tradieId))!;
    expect(tradie).toMatchObject({ lbpNumber: "BP998877", insuranceCertificateId: saved.uploadId, status: "applied" });
    expect(await canView(t.db, (await getUpload(t.db, saved.uploadId))!, { tradieId })).toBe(true);
  });
});

describe("links", () => {
  const SECRET = "test-secret-that-is-at-least-32-characters";

  it("a report link opens only its own property, and a replaced link stops working", async () => {
    const { alice, aliceHome, bobHome } = await twoOfEverything();
    expect(await findPropertyByReportToken(t.db, aliceHome.guestToken)).toMatchObject({ via: "guest", property: { id: aliceHome.id } });
    expect(await findPropertyByReportToken(t.db, aliceHome.teamToken)).toMatchObject({ via: "team", property: { id: aliceHome.id } });
    expect(await findPropertyByReportToken(t.db, bobHome.guestToken)).toMatchObject({ property: { id: bobHome.id } });
    expect(await findPropertyByReportToken(t.db, "x".repeat(20))).toBeNull();
    expect(await findPropertyByReportToken(t.db, "' or 1=1 --")).toBeNull();
    expect(aliceHome.guestToken).not.toBe(aliceHome.teamToken);

    const replaced = await rotateReportLink(t.db, alice.ownerId, aliceHome.id, "guest");
    expect(replaced!.guestToken).not.toBe(aliceHome.guestToken);
    expect(await findPropertyByReportToken(t.db, aliceHome.guestToken)).toBeNull();
    expect(await findPropertyByReportToken(t.db, replaced!.guestToken)).toMatchObject({ property: { id: aliceHome.id } });
  });

  it("a one-tap link cannot be guessed, changed to another job, or made without the app's secret", () => {
    const offerA = { number: 1001, id: "11111111-1111-4111-8111-111111111111" };
    const offerB = { number: 1002, id: "22222222-2222-4222-8222-222222222222" };
    const code = offerLinkCode(SECRET, offerA);
    expect(code).toMatch(/^1001\.[A-Za-z0-9]{12}$/);
    const parsed = parseLinkCode(code)!;
    expect(parsed.number).toBe(1001);
    expect(offerLinkMatches(SECRET, offerA, parsed.signature)).toBe(true);

    // Swapping the number for another offer's does not work.
    expect(offerLinkMatches(SECRET, offerB, parsed.signature)).toBe(false);
    // Nor does a signature made with a different secret.
    expect(offerLinkMatches("another-secret-that-is-32-characters-long", offerA, parsed.signature)).toBe(false);
    // An owner's job link cannot be used as an offer link for the same number, or the other way round.
    const jobCode = parseLinkCode(ownerJobLinkCode(SECRET, offerA))!;
    expect(offerLinkMatches(SECRET, offerA, jobCode.signature)).toBe(false);
    expect(ownerJobLinkMatches(SECRET, offerA, jobCode.signature)).toBe(true);
    expect(ownerJobLinkMatches(SECRET, offerA, parsed.signature)).toBe(false);
  });

  it("rejects anything that is not shaped like a link code", () => {
    for (const bad of ["", "1001", "1001.", ".abcdefghijkl", "1001.short", "abc.abcdefghijkl", "1001.abcdefghijk!", "1001.abcdefghijklm", "99999999999999999.abcdefghijkl"]) {
      expect(parseLinkCode(bad)).toBeNull();
    }
  });
});

describe("the database itself", () => {
  it("has row level security switched on for every table", async () => {
    const rows = await t.db.query<{ tablename: string; rowsecurity: boolean }>("select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename");
    expect(rows.length).toBeGreaterThan(25);
    expect(rows.filter((row) => !row.rowsecurity).map((row) => row.tablename)).toEqual([]);
  });

  it("gives the public roles no access to any table", async () => {
    const rows = await t.db.query<{ table_name: string; grantee: string }>(
      "select table_name, grantee from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')",
    );
    expect(rows).toEqual([]);
  });

  it("has no policies that would open a table to the public key", async () => {
    const rows = await t.db.query("select 1 from pg_policies where schemaname = 'public'");
    expect(rows).toEqual([]);
  });
});
