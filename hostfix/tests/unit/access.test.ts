import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { attachUploads, canView, checkFile, getUpload, recordUpload } from "@/lib/files/uploads";
import { getJobForOwner, getJobForTradie, listJobsForOwner, listJobsForTradie, listLiveOffersForTradie } from "@/lib/jobs/store";
import { completeJob, markArrived, markEnRoute, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { offerLinkCode, offerLinkMatches, ownerJobLinkCode, ownerJobLinkMatches, parseLinkCode } from "@/lib/links";
import { changeTier, findPropertyByReportToken, getProperty, listProperties, requestCancel, rotateReportLink, updateProperty } from "@/lib/properties/service";
import { createDemoGateway } from "@/lib/payments/demo-gateway";
import { cancelPortfolio, countPortfolioProperties, getPortfolio, joinPortfolio, listPortfolios, openPortfolio, removeFromPortfolio, startPortfolio } from "@/lib/properties/portfolio";
import { testDb } from "./db";
import { liveMarket, logJob, makeOwner, makePortfolio, makeProperty, makeTradie, MONDAY_10AM, offersFor, photo } from "./factory";

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
    expect(await markArrived(t.db, aliceJob.id, dave.tradieId)).toMatchObject({ ok: false });
    await markArrived(t.db, aliceJob.id, mike.tradieId);
    expect(await submitQuote(t.db, aliceJob.id, dave.tradieId, { description: "Extra", labourCents: 5000, partsCents: 0, uploadIds: [] })).toMatchObject({ ok: false });
    expect(await completeJob(t.db, aliceJob.id, dave.tradieId, { note: "", uploadIds: [mine] })).toMatchObject({ ok: false });
    expect(await reportNoAccess(t.db, aliceJob.id, dave.tradieId, { note: "Could not get in at all", uploadIds: [mine] })).toMatchObject({ ok: false });
    expect((await getJobForTradie(t.db, mike.tradieId, aliceJob.id))!.status).toBe("on_site");
  });
});

describe("photos", () => {
  it("are visible to the job's owner, the tradie on the job, and staff. Nobody else", async () => {
    const { alice, bob, mike, dave, aliceJob } = await twoOfEverything();
    await markArrived(t.db, aliceJob.id, mike.tradieId);
    const id = await photo(t.db, `tradie:${mike.tradieId}`);
    await completeJob(t.db, aliceJob.id, mike.tradieId, { note: "", uploadIds: [id] });
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
    await markArrived(t.db, aliceJob.id, mike.tradieId);
    await completeJob(t.db, aliceJob.id, mike.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${mike.tradieId}`)] });
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
