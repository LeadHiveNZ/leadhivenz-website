import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addHours, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { canView, getUpload } from "@/lib/files/uploads";
import { addCertificates, CERTIFICATE_DAYS_AFTER, jobCertificates } from "@/lib/jobs/certificates";
import { loadJobView } from "@/lib/jobs/view";
import { completeJob, markEnRoute } from "@/lib/jobs/work";
import { testDb } from "./db";
import { arrive, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, messagesTo, MONDAY_10AM, offersFor, photo } from "./factory";

/**
 * COMPLIANCE CERTIFICATES ON A JOB (DECISIONS.md, 2026-11-26). The tradie who did the job adds a Certificate of
 * Compliance or the like from Arrived until 60 days after Job done; the owner sees it on the job page and is emailed.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function jobOnSite() {
  await liveMarket(t.db, { min_minutes_on_site: 0 });
  const owner = await makeOwner(t.db, { card: "ok" });
  const property = await makeProperty(t.db, owner.ownerId);
  const tradie = await makeTradie(t.db, { slot: 1, trades: ["electrician"] });
  const job = await logJob(t.db, property, { code: "EL-01" });
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  await markEnRoute(t.db, job.id, tradie.tradieId);
  const arrived = await arrive(t.db, job.id, tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  return { owner, property, tradie, job };
}

describe("certificates", () => {
  it("are added by the job's tradie, labelled, kept with the job and property, and the owner is emailed", async () => {
    const s = await jobOnSite();
    const file = await photo(t.db, `tradie:${s.tradie.tradieId}`, "certificate");
    const result = await addCertificates(t.db, s.job.id, s.tradie.tradieId, { uploadIds: [file], label: "Certificate of Compliance (electrical)" }, MONDAY_10AM);
    expect(result).toEqual({ ok: true, added: 1 });
    const [cert] = await jobCertificates(t.db, s.job.id);
    expect(cert).toMatchObject({ id: file, label: "Certificate of Compliance (electrical)", jobId: s.job.id, propertyId: s.property.id, attached: true });
    expect((await loadJobView(t.db, (await getUploadJob(s.job.id))!, "owner")).certificates.map((upload) => upload.id)).toEqual([file]);
    const mails = await messagesTo(t.db, s.owner.user.phone!, "certificate_added");
    expect(mails).toHaveLength(1);
    expect(mails[0]!.body).toContain("Certificate of Compliance (electrical)");
    // The owner and the tradie may open it; another owner may not.
    const upload = (await getUpload(t.db, file))!;
    expect(await canView(t.db, upload, { ownerId: s.owner.ownerId })).toBe(true);
    const stranger = await makeOwner(t.db, { card: "none" });
    expect(await canView(t.db, upload, { ownerId: stranger.ownerId })).toBe(false);
  });

  it("refuses another tradie, a missing label, a missing file, and a job not yet arrived at", async () => {
    const s = await jobOnSite();
    const other = await makeTradie(t.db, { trades: ["electrician"] });
    const theirs = await photo(t.db, `tradie:${other.tradieId}`, "certificate");
    expect(await addCertificates(t.db, s.job.id, other.tradieId, { uploadIds: [theirs], label: "Electrical Safety Certificate" }, MONDAY_10AM)).toMatchObject({ ok: false, message: "This job is not yours." });
    const mine = await photo(t.db, `tradie:${s.tradie.tradieId}`, "certificate");
    expect(await addCertificates(t.db, s.job.id, s.tradie.tradieId, { uploadIds: [mine], label: "A made-up certificate" }, MONDAY_10AM)).toMatchObject({ ok: false });
    expect(await addCertificates(t.db, s.job.id, s.tradie.tradieId, { uploadIds: [], label: "Electrical Safety Certificate" }, MONDAY_10AM)).toMatchObject({ ok: false });
    // A file someone else uploaded is never attached, even by the job's tradie.
    expect(await addCertificates(t.db, s.job.id, s.tradie.tradieId, { uploadIds: [theirs], label: "Electrical Safety Certificate" }, MONDAY_10AM)).toMatchObject({ ok: false });
    expect(await jobCertificates(t.db, s.job.id)).toEqual([]);

    // Before Arrived: not yet.
    const owner = await makeOwner(t.db, { card: "ok" });
    const property = await makeProperty(t.db, owner.ownerId);
    const early = await logJob(t.db, property, { code: "EL-01" });
    const [offer] = await offersFor(t.db, early.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    const tradieId = (await getUploadJob(early.id))!.tradieId!;
    const file = await photo(t.db, `tradie:${tradieId}`, "certificate");
    expect(await addCertificates(t.db, early.id, tradieId, { uploadIds: [file], label: "Electrical Safety Certificate" }, MONDAY_10AM)).toMatchObject({ ok: false });
  });

  it(`can be added after Job done for ${CERTIFICATE_DAYS_AFTER} days, then not`, async () => {
    const s = await jobOnSite();
    const done = await completeJob(t.db, s.job.id, s.tradie.tradieId, { note: "Swapped the power point.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`, "completion")], lat: HOUSE.lat, lng: HOUSE.lng });
    if (!done.ok) throw new Error(done.message);
    const later = addHours(MONDAY_10AM, 24 * CERTIFICATE_DAYS_AFTER - 1);
    const a = await photo(t.db, `tradie:${s.tradie.tradieId}`, "certificate");
    expect(await addCertificates(t.db, s.job.id, s.tradie.tradieId, { uploadIds: [a], label: "Certificate of Compliance (electrical)" }, later)).toMatchObject({ ok: true });
    const b = await photo(t.db, `tradie:${s.tradie.tradieId}`, "certificate");
    expect(await addCertificates(t.db, s.job.id, s.tradie.tradieId, { uploadIds: [b], label: "Electrical Safety Certificate" }, addHours(MONDAY_10AM, 24 * CERTIFICATE_DAYS_AFTER + 1))).toMatchObject({ ok: false });
  });
});

async function getUploadJob(jobId: string) {
  const { getJobForStaff } = await import("@/lib/jobs/store");
  return getJobForStaff(t.db, jobId);
}
