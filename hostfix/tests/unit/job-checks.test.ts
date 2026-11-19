import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargeJob, raiseDispute, releaseDuePayouts } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer, expireDueOffers, passOffer } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { checkTap, chooseReference, jobFlags, minutesOnSite, ownerCheckWords, photoIsStale, tooQuick } from "@/lib/jobs/checks";
import { confirmFixed, settleUnansweredChecks, staffDecideCheck } from "@/lib/jobs/confirm";
import { getJobForStaff } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { loadJobView } from "@/lib/jobs/view";
import { completeJob, markArrived, reportNoAccess } from "@/lib/jobs/work";
import { confirmPin } from "@/lib/properties/pin";
import type { Property } from "@/lib/properties/service";
import { flagCounts, recentFlags, tradieTrust } from "@/lib/tradies/reliability";
import { testDb } from "./db";
import { arrive, auditActions, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, openExceptions, photo, messagesTo } from "./factory";

/**
 * IS THE JOB REALLY DONE? (DECISIONS.md, 2026-11-19)
 *
 * The founder's goal: a tradie cannot tap Arrived, photograph his shoe, tap
 * Job done and be paid, and nobody has to look at every job. Every number
 * below is worked out by hand, never copied from what the code returns:
 *
 *   PL-01 Toilet seat or cistern parts: owner 225 dollars, tradie 190 dollars
 *     (seed/menu-queenstown.json) -> charged 22500, the tradie's payout 19000, we keep 3500.
 *   The market holds a payout 24 hours after the job (payout_hold_hours), asks the
 *   owner of a flagged job for 48 hours (owner_confirm_hours) and expects 10 minutes
 *   on site (min_minutes_on_site). A tap more than 300 m from the pin is far.
 *
 *   Distances north-south: the earth's radius is 6,371,000 m, so one degree of
 *   latitude is 6,371,000 x pi / 180 = 111,195 m.
 *     0.0027 degrees = 300.2 m -> 300 m: NOT over 300, so ok
 *     0.0030 degrees = 333.6 m -> 334 m: over 300, so far
 *
 *   Times, Pacific/Auckland (UTC+13 in November):
 *     Mon 16 Nov 10:00am = 2026-11-15T21:00Z (MONDAY_10AM), job logged and accepted
 *     arrived 10:00am, Job done 10:30am, payout due 24 hours later: Tue 17 Nov 10:30am
 *     the owner's 48 hours run to Wed 18 Nov 10:30am
 */

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const TEN_THIRTY = addMinutes(MONDAY_10AM, 30);
const TUESDAY_1030 = addHours(TEN_THIRTY, 24);
const WEDNESDAY_1030 = addHours(TEN_THIRTY, 48);
/** 334 m north of the house: over 300 m. */
const FAR = { lat: HOUSE.lat + 0.003, lng: HOUSE.lng };

async function setup(options: { pin?: boolean } = {}) {
  await liveMarket(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  // The owner put the pin on the house.
  if (options.pin !== false) {
    const pinned = await confirmPin(t.db, owner.ownerId, property.id, { ...HOUSE, moved: true });
    if (!pinned.ok) throw new Error(pinned.message);
  }
  const tradie = await makeTradie(t.db, { slot: 1, name: "Wakatipu Plumbing" });
  return { owner, property, tradie };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function accepted(s: Setup, property: Property = s.property, overrides: Parameters<typeof logJob>[2] = {}): Promise<Job> {
  const job = await logJob(t.db, property, { code: "PL-01", ...overrides });
  const [offer] = await offersFor(t.db, job.id);
  const result = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  if (result.result !== "accepted") throw new Error(result.result);
  return result.job;
}

/** Arrived at `at` from `arrivedFrom`, Job done `minutes` later from `finishedFrom`, then the card is charged. */
async function doJob(
  s: Setup, job: Job,
  options: { at?: Date; minutes?: number; arrivedFrom?: { lat: number; lng: number } | null; finishedFrom?: { lat: number; lng: number } | null } = {},
): Promise<Job> {
  const at = options.at ?? MONDAY_10AM;
  setTestNow(at);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, options.arrivedFrom === undefined ? HOUSE : options.arrivedFrom ?? {});
  if (!arrived.ok) throw new Error(arrived.message);
  setTestNow(addMinutes(at, options.minutes ?? 30));
  const where = options.finishedFrom === undefined ? HOUSE : options.finishedFrom ?? {};
  const done = await completeJob(t.db, job.id, s.tradie.tradieId, { note: "Replaced the cistern valve.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...where });
  if (!done.ok) throw new Error(done.message);
  expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
  return (await getJobForStaff(t.db, job.id))!;
}

const payout = async (jobId: string) =>
  (await t.db.query<{ status: string; amount_cents: number; release_at: Date }>("select status, amount_cents, release_at from public.payouts where job_id = $1::uuid", [jobId]))[0]!;
const charged = async (jobId: string) => Number((await t.db.query<{ amount_cents: number }>("select amount_cents from public.payments where job_id = $1::uuid and status = 'succeeded'", [jobId]))[0]?.amount_cents ?? 0);

// ---------------------------------------------------------------------------
// THE CHECKS THEMSELVES, AS SUMS
// ---------------------------------------------------------------------------

describe("the checks, worked out by hand", () => {
  it("measures each tap against the pin: 300 m is still ok, 334 m is far, no location is a flag", () => {
    const pin = chooseReference(HOUSE, []);
    expect(pin.kind).toBe("pin");
    expect(checkTap({ lat: HOUSE.lat + 0.0027, lng: HOUSE.lng }, pin)).toEqual({ check: "ok", distanceM: 300 });
    expect(checkTap(FAR, pin)).toEqual({ check: "far", distanceM: 334 });
    expect(checkTap(null, pin)).toEqual({ check: "no_location", distanceM: null });
  });

  it("falls back to the middle of earlier trusted taps when the property has no pin, and to nothing at all", () => {
    // Middle of -45.0300 and -45.0302 is -45.0301; of 168.66 and 168.66 is 168.66.
    const middle = chooseReference(null, [HOUSE, { lat: -45.0302, lng: 168.66 }]);
    expect(middle.kind).toBe("earlier_taps");
    expect(middle.point!.lat).toBeCloseTo(-45.0301, 9);
    expect(middle.point!.lng).toBeCloseTo(168.66, 9);
    expect(chooseReference(null, [])).toEqual({ point: null, kind: "none" });
    expect(checkTap(HOUSE, { point: null, kind: "none" }).check).toBe("no_reference");
  });

  it("counts whole minutes on site, and only a done menu job can be too quick", () => {
    expect(minutesOnSite(MONDAY_10AM, addMinutes(MONDAY_10AM, 9.9))).toBe(9);
    const menu = { offMenu: false, title: "Toilet seat or cistern parts" };
    expect(tooQuick(menu, "done", 9, 10)).toBe(true);
    expect(tooQuick(menu, "done", 10, 10)).toBe(false);
    expect(tooQuick({ offMenu: true, title: "Noise in the pipes" }, "done", 2, 10)).toBe(false); // look-and-price
    expect(tooQuick({ offMenu: false, title: "Heat pump fault diagnosis" }, "done", 2, 10)).toBe(false); // HP-03, a diagnosis on the menu
    expect(tooQuick(menu, "diagnosis_only", 2, 10)).toBe(false);
    expect(tooQuick(menu, "no_access", 1, 10)).toBe(false);
    expect(tooQuick(menu, "done", 0, 0)).toBe(false); // 0 switches the check off
  });

  it("calls a photo stale when its own date is 30 minutes or more before the job was logged", () => {
    expect(photoIsStale(addMinutes(MONDAY_10AM, -30), MONDAY_10AM)).toBe(true);
    expect(photoIsStale(addMinutes(MONDAY_10AM, -29), MONDAY_10AM)).toBe(false);
    expect(photoIsStale(null, MONDAY_10AM)).toBe(false);
  });

  it("lists the flags in one order, and asks the owner in neutral words", () => {
    expect(jobFlags({ arrival: "far", finish: "no_location", quick: true, stalePhoto: true })).toEqual(["arrived_far", "finished_no_location", "quick_finish", "old_photo"]);
    expect(jobFlags({ arrival: "no_reference", finish: "ok", quick: false, stalePhoto: false })).toEqual([]);
    expect(ownerCheckWords(["arrived_far"])).toBe("We couldn't confirm the tradie's location for this job. Can you check the photos and confirm it's fixed?");
    expect(ownerCheckWords(["quick_finish"])).toBe("We couldn't confirm how long the job took for this job. Can you check the photos and confirm it's fixed?");
    expect(ownerCheckWords(["arrived_no_location", "quick_finish"])).toContain("We couldn't confirm everything for this job.");
    for (const words of [ownerCheckWords(["arrived_far"]), ownerCheckWords(["old_photo"])]) expect(words).not.toMatch(/fake|lie|cheat|wrong|fraud/i);
  });
});

// ---------------------------------------------------------------------------
// PHOTOS
// ---------------------------------------------------------------------------

describe("before and after photos", () => {
  it("Arrived needs at least one before photo; Job done at least one after photo", async () => {
    const s = await setup();
    const job = await accepted(s);
    const refused = await markArrived(t.db, job.id, s.tradie.tradieId, { ...HOUSE, uploadIds: [] });
    expect(refused).toMatchObject({ ok: false });
    expect(!refused.ok && refused.message).toContain('"before" photo');
    // An after photo cannot stand in for a before photo.
    expect(await markArrived(t.db, job.id, s.tradie.tradieId, { ...HOUSE, uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`, "completion")] })).toMatchObject({ ok: false });
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("accepted");
    expect(await arrive(t.db, job.id, s.tradie.tradieId, HOUSE)).toMatchObject({ ok: true });
    setTestNow(TEN_THIRTY);
    const noAfter = await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [], ...HOUSE });
    expect(!noAfter.ok && noAfter.message).toContain('"after" photo');
  });

  it("stamps each photo with the server's time and the phone's location, and shows them before and after", async () => {
    const s = await setup();
    const job = await accepted(s);
    const before = await photo(t.db, `tradie:${s.tradie.tradieId}`, "before", { ...HOUSE });
    expect(await markArrived(t.db, job.id, s.tradie.tradieId, { ...HOUSE, uploadIds: [before] })).toMatchObject({ ok: true });
    setTestNow(TEN_THIRTY);
    const after = await photo(t.db, `tradie:${s.tradie.tradieId}`, "completion", { ...HOUSE });
    await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [after], ...HOUSE });
    const view = await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "owner");
    expect(view.beforePhotos.map((upload) => [upload.id, upload.createdAt.toISOString(), upload.lat, upload.lng])).toEqual([[before, MONDAY_10AM.toISOString(), HOUSE.lat, HOUSE.lng]]);
    expect(view.afterPhotos.map((upload) => [upload.id, upload.createdAt.toISOString()])).toEqual([[after, TEN_THIRTY.toISOString()]]);
  });

  it("flags a photo whose own date is from before the job was logged", async () => {
    const s = await setup();
    const job = await accepted(s);
    // Taken last Thursday, three and a half days before the job.
    const old = await photo(t.db, `tradie:${s.tradie.tradieId}`, "before", { takenAt: addHours(MONDAY_10AM, -84) });
    await markArrived(t.db, job.id, s.tradie.tradieId, { ...HOUSE, uploadIds: [old] });
    setTestNow(TEN_THIRTY);
    await completeJob(t.db, job.id, s.tradie.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
    expect((await getJobForStaff(t.db, job.id))!).toMatchObject({ checkFlags: ["old_photo"], confirmStatus: "waiting" });
  });
});

// ---------------------------------------------------------------------------
// WHAT HAPPENS TO THE MONEY
// ---------------------------------------------------------------------------

describe("a clean job", () => {
  it("pays out automatically, as before: charged 22500 at 10:30am Monday, 19000 sent at 10:30am Tuesday", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s));
    expect(done).toMatchObject({ arrivalCheck: "ok", arrivalDistanceM: 0, finishCheck: "ok", finishDistanceM: 0, minutesOnSite: 30, checkFlags: [], confirmStatus: null, checkReference: "pin" });
    expect(await charged(done.id)).toBe(22500);
    expect(await payout(done.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    expect(new Date((await payout(done.id)).release_at).toISOString()).toBe(TUESDAY_1030.toISOString());
    // The ordinary "job done" text, and nothing for the owner to confirm.
    expect((await messagesTo(t.db, s.owner.user.phone!, "job_done"))[0]!.body).toContain("is done, NZ$225 charged.");
    expect(await messagesTo(t.db, s.owner.user.phone!, "job_check")).toEqual([]);
    setTestNow(addMinutes(TUESDAY_1030, -1));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    setTestNow(TUESDAY_1030);
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(done.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
    expect(await openExceptions(t.db, done.id)).toEqual([]);
  });
});

describe("a far Arrived tap", () => {
  it("is never refused, flags the job, charges the owner 22500 as normal and holds the tradie's 19000", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    expect(done).toMatchObject({ status: "completed", arrivalCheck: "far", arrivalDistanceM: 334, finishCheck: "ok", checkFlags: ["arrived_far"], confirmStatus: "waiting" });
    expect(done.confirmBy!.toISOString()).toBe(WEDNESDAY_1030.toISOString());
    expect(await charged(done.id)).toBe(22500);
    expect(await payout(done.id)).toMatchObject({ status: "held", amount_cents: 19000 });
    // The owner's "job done" text asks them to check, neutrally, and links to the page (a link never acts by being opened).
    const [text] = await messagesTo(t.db, s.owner.user.phone!, "job_check");
    expect(text!.body).toContain("is done. We couldn't confirm the tradie's location. Check?");
    expect(text!.body).toMatch(/\/j\/\d+\.[A-Za-z0-9]{12}/);
    expect(await messagesTo(t.db, s.owner.user.phone!, "job_done")).toEqual([]);
    // Nothing for the dispatcher yet: the owner is asked first.
    expect(await openExceptions(t.db, done.id)).toEqual([]);
    // Not sent at the usual time while it is held.
    setTestNow(addHours(TUESDAY_1030, 1));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect(await auditActions(t.db, done.id)).toContain("job.flagged");
  });

  it("a Job done tap far away is a flag too, even when Arrived was at the house", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { finishedFrom: FAR });
    expect(done).toMatchObject({ finishCheck: "far", finishDistanceM: 334, checkFlags: ["finished_far"] });
  });
});

describe("no location", () => {
  it("at Arrived and at Job done gives two flags, and both taps still work", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: null, finishedFrom: null });
    expect(done).toMatchObject({ arrivalCheck: "no_location", finishCheck: "no_location", checkFlags: ["arrived_no_location", "finished_no_location"], confirmStatus: "waiting" });
    expect(await payout(done.id)).toMatchObject({ status: "held", amount_cents: 19000 });
  });

  it("a property with no pin and no earlier visits has nothing to compare with: no flag, paid as normal", async () => {
    const s = await setup({ pin: false });
    const done = await doJob(s, await accepted(s));
    expect(done).toMatchObject({ arrivalCheck: "no_reference", checkReference: "own_arrival", finishCheck: "ok", checkFlags: [] });
    expect(await payout(done.id)).toMatchObject({ status: "scheduled" });
  });

  it("with no pin, a later visit is measured against the earlier trusted taps (the old median), 334 m away is far", async () => {
    const s = await setup({ pin: false });
    await doJob(s, await accepted(s));
    const second = await doJob(s, await accepted(s, s.property, { code: "PL-03" }), { at: addHours(MONDAY_10AM, 3), arrivedFrom: FAR, finishedFrom: FAR });
    expect(second).toMatchObject({ checkReference: "earlier_taps", arrivalCheck: "far", arrivalDistanceM: 334, finishCheck: "far", checkFlags: ["arrived_far", "finished_far"] });
  });
});

describe("time on site", () => {
  it("Job done 9 minutes after Arrived is flagged; 10 minutes is not", async () => {
    const s = await setup();
    const quick = await doJob(s, await accepted(s), { minutes: 9 });
    expect(quick).toMatchObject({ minutesOnSite: 9, checkFlags: ["quick_finish"], confirmStatus: "waiting" });
    expect(await payout(quick.id)).toMatchObject({ status: "held", amount_cents: 19000 });
    expect((await messagesTo(t.db, s.owner.user.phone!, "job_check"))[0]!.body).toContain("We couldn't confirm how long the job took.");

    const steady = await doJob(s, await accepted(s, s.property, { code: "PL-03" }), { at: addHours(MONDAY_10AM, 2), minutes: 10 });
    expect(steady).toMatchObject({ minutesOnSite: 10, checkFlags: [], confirmStatus: null });
  });

  it("follows the market's setting", async () => {
    const s = await setup();
    await liveMarket(t.db, { min_minutes_on_site: 20 });
    const done = await doJob(s, await accepted(s), { minutes: 15 });
    expect(done.checkFlags).toEqual(["quick_finish"]);
  });

  it("never flags a look-and-price job or 'could not get in' for being quick", async () => {
    const s = await setup();
    // Off menu: the tradie comes to look and price. Done after 2 minutes, call-out only.
    const look = await doJob(s, await accepted(s, s.property, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Noise in the pipes" }), { minutes: 2 });
    expect(look).toMatchObject({ outcome: "diagnosis_only", minutesOnSite: 2, checkFlags: [] });

    const locked = await accepted(s, s.property, { code: "PL-03" });
    setTestNow(addHours(MONDAY_10AM, 3));
    await arrive(t.db, locked.id, s.tradie.tradieId, HOUSE);
    setTestNow(addMinutes(addHours(MONDAY_10AM, 3), 1));
    const result = await reportNoAccess(t.db, locked.id, s.tradie.tradieId, { note: "Lockbox code did not work, nobody answering.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
    expect(result).toMatchObject({ ok: true, job: { outcome: "no_access", minutesOnSite: 1, checkFlags: [] } });
  });
});

// ---------------------------------------------------------------------------
// WHO DECIDES A FLAGGED JOB
// ---------------------------------------------------------------------------

describe("the owner answers", () => {
  it("'Yes, it's fixed' releases the 19000 at its usual time, Tuesday 10:30am", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    setTestNow(addMinutes(TEN_THIRTY, 30));
    expect(await confirmFixed(t.db, done.id, s.owner.ownerId, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true, job: { confirmStatus: "owner_confirmed" } });
    // Due at the usual time (Tuesday 10:30am), since that is later than now (Monday 11am).
    expect(await payout(done.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    expect(new Date((await payout(done.id)).release_at).toISOString()).toBe(TUESDAY_1030.toISOString());
    // Pressing it twice changes nothing.
    expect(await confirmFixed(t.db, done.id, s.owner.ownerId, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true });
    setTestNow(TUESDAY_1030);
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(done.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
    const confirmed = await t.db.query<{ amount: number }>("select amount from public.audit_log where entity_id = $1 and action = 'job.owner_confirmed'", [done.id]);
    expect(confirmed.map((row) => Number(row.amount))).toEqual([19000]);
  });

  it("'Something's wrong' is the dispute: the payment is paused and the dispatcher is asked", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    expect(await raiseDispute(t.db, done.id, `owner:${s.owner.ownerId}`, "The cistern still runs all night.")).toMatchObject({ ok: true, payoutPaused: true });
    expect((await getJobForStaff(t.db, done.id))!.confirmStatus).toBe("owner_problem");
    expect(await payout(done.id)).toMatchObject({ status: "paused", amount_cents: 19000 });
    expect(await openExceptions(t.db, done.id)).toEqual(["dispute"]);
    // After that, "Yes, it's fixed" is refused and the timer leaves it alone.
    expect(await confirmFixed(t.db, done.id, s.owner.ownerId, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: false });
    setTestNow(WEDNESDAY_1030);
    expect(await settleUnansweredChecks(t.db)).toEqual({ released: 0, toQueue: 0 });
  });

  it("only the job's own owner can confirm it", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    const stranger = await makeOwner(t.db);
    expect(await confirmFixed(t.db, done.id, stranger.ownerId, `owner:${stranger.ownerId}`)).toMatchObject({ ok: false, message: "We could not find that job." });
    expect(await payout(done.id)).toMatchObject({ status: "held" });
  });
});

/** Ten earlier clean jobs for this tradie, on the Monday a fortnight before. */
async function tenCleanJobs(s: Setup) {
  for (let index = 0; index < 10; index += 1) {
    const at = addHours(MONDAY_10AM, -14 * 24 + index * 2);
    setTestNow(at);
    const property = await makeProperty(t.db, s.owner.ownerId);
    await confirmPin(t.db, s.owner.ownerId, property.id, { ...HOUSE, moved: true });
    await doJob(s, await accepted(s, property), { at });
  }
  setTestNow(MONDAY_10AM);
  // All ten were clean, so all ten were paid at their usual time.
  expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(10);
}

describe("the owner says nothing for 48 hours", () => {
  it("a trusted tradie (10 finished jobs, no other flags in 90 days) is paid 19000 at Wednesday 10:30am and the flag is only logged", async () => {
    const s = await setup();
    await tenCleanJobs(s);
    expect(await tradieTrust(t.db, s.tradie.tradieId, null)).toEqual({ finishedJobs: 10, otherFlags: 0, trusted: true });
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    setTestNow(addMinutes(WEDNESDAY_1030, -1));
    expect(await settleUnansweredChecks(t.db)).toEqual({ released: 0, toQueue: 0 });
    setTestNow(WEDNESDAY_1030);
    expect(await settleUnansweredChecks(t.db)).toEqual({ released: 1, toQueue: 0 });
    const job = (await getJobForStaff(t.db, done.id))!;
    expect(job).toMatchObject({ confirmStatus: "released_trusted", checkFlags: ["arrived_far"] });
    // Due now, Wednesday 10:30am: later than its usual Tuesday 10:30am.
    expect(new Date((await payout(done.id)).release_at).toISOString()).toBe(WEDNESDAY_1030.toISOString());
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(done.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
    expect(await openExceptions(t.db, done.id)).toEqual([]);
    expect(await auditActions(t.db, done.id)).toContain("job.check_released");
    // Still on the record: it counts as this tradie's flag for the next 90 days.
    expect(await recentFlags(t.db, s.tradie.tradieId)).toBe(1);
  });

  it("an untrusted tradie (no earlier jobs) goes to the dispatcher's queue to Approve or Hold; the payment stays held", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    setTestNow(WEDNESDAY_1030);
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(report["checks.toQueue"]).toBe(1);
    expect((await getJobForStaff(t.db, done.id))!.confirmStatus).toBe("staff_queue");
    expect(await openExceptions(t.db, done.id)).toEqual(["job_check"]);
    const [item] = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'job_check'", [done.id]);
    expect(item!.summary).toContain("Arrived was tapped 334 m from the property.");
    expect(item!.summary).toContain("0 finished jobs so far, under the 10 that makes a tradie trusted");
    expect(await payout(done.id)).toMatchObject({ status: "held", amount_cents: 19000 });

    // One tap: Approve. The payment is due now, Wednesday 10:30am, and goes out.
    expect(await staffDecideCheck(t.db, done.id, true, "staff:maria")).toMatchObject({ ok: true, job: { confirmStatus: "staff_approved" } });
    expect(await openExceptions(t.db, done.id)).toEqual([]);
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(done.id)).toMatchObject({ status: "sent", amount_cents: 19000 });
  });

  it("Hold keeps the payment held and tells the tradie neutrally; Approve later still pays", async () => {
    const s = await setup();
    const done = await doJob(s, await accepted(s), { arrivedFrom: FAR });
    setTestNow(WEDNESDAY_1030);
    await settleUnansweredChecks(t.db);
    expect(await staffDecideCheck(t.db, done.id, false, "staff:maria", "Ringing the owner.")).toMatchObject({ ok: true, job: { confirmStatus: "staff_held" } });
    expect(await payout(done.id)).toMatchObject({ status: "held" });
    expect((await messagesTo(t.db, s.tradie.phone, "payout_check_held"))[0]!.body).toContain("we are checking this job, so your payment is on hold");
    setTestNow(addHours(WEDNESDAY_1030, 2));
    await staffDecideCheck(t.db, done.id, true, "staff:maria");
    expect(await payout(done.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });
  });

  it("10 finished jobs but another flag in the last 90 days is not trusted: to the queue", async () => {
    const s = await setup();
    await tenCleanJobs(s);
    // A flagged job last week, which the owner confirmed.
    const earlier = await doJob(s, await accepted(s), { at: addHours(MONDAY_10AM, -7 * 24), minutes: 5 });
    await confirmFixed(t.db, earlier.id, s.owner.ownerId, `owner:${s.owner.ownerId}`);
    const done = await doJob(s, await accepted(s, s.property, { code: "PL-03" }), { arrivedFrom: FAR });
    expect(await tradieTrust(t.db, s.tradie.tradieId, done.id)).toEqual({ finishedJobs: 11, otherFlags: 1, trusted: false });
    setTestNow(WEDNESDAY_1030);
    expect(await settleUnansweredChecks(t.db)).toEqual({ released: 0, toQueue: 1 });
  });
});

describe("repeat flags", () => {
  it("3 flagged jobs in 90 days flags the tradie for review on the admin page and in the queue; nothing is changed on their account", async () => {
    const s = await setup();
    for (let index = 0; index < 3; index += 1) {
      const at = addHours(MONDAY_10AM, index * 3);
      await doJob(s, await accepted(s, await pinnedHouse(s)), { at, minutes: 5 });
      const review = await t.db.query("select 1 from public.exceptions where tradie_id = $1::uuid and kind = 'tradie_flags' and status = 'open'", [s.tradie.tradieId]);
      expect(review.length).toBe(index === 2 ? 1 : 0);
    }
    expect(await recentFlags(t.db, s.tradie.tradieId)).toBe(3);
    expect((await flagCounts(t.db, "queenstown")).get(s.tradie.tradieId)).toBe(3);
    const tradie = await t.db.query<{ status: string }>("select status from public.tradies where id = $1::uuid", [s.tradie.tradieId]);
    expect(tradie[0]!.status).toBe("approved");
  });

  it("a flag more than 90 days old no longer counts", async () => {
    const s = await setup();
    await doJob(s, await accepted(s), { at: addHours(MONDAY_10AM, -91 * 24), minutes: 5 });
    setTestNow(MONDAY_10AM);
    expect(await recentFlags(t.db, s.tradie.tradieId)).toBe(0);
  });
});

async function pinnedHouse(s: Setup): Promise<Property> {
  const property = await makeProperty(t.db, s.owner.ownerId);
  await confirmPin(t.db, s.owner.ownerId, property.id, { ...HOUSE, moved: true });
  return property;
}

describe("declining", () => {
  it("never creates a flag: 12 passes and one offer left to run out leave no flags, no review and the same trust", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const decliner = await makeTradie(t.db, { name: "Decliner Ltd" });
    await makeTradie(t.db, { name: "Other Ltd" });
    for (let index = 0; index < 12; index += 1) {
      setTestNow(addHours(MONDAY_10AM, -48 + index));
      const job = await logJob(t.db, await makeProperty(t.db, owner.ownerId), { code: "PL-01" });
      const offer = (await offersFor(t.db, job.id)).find((row) => row.tradie_id === decliner.tradieId)!;
      expect(await t.db.tx((tx) => passOffer(tx, offer.id, "link"))).toBe("passed");
    }
    setTestNow(addHours(MONDAY_10AM, -30));
    await logJob(t.db, await makeProperty(t.db, owner.ownerId), { code: "PL-03" });
    setTestNow(addHours(MONDAY_10AM, -29));
    await expireDueOffers(t.db);
    setTestNow(MONDAY_10AM);
    expect(await recentFlags(t.db, decliner.tradieId)).toBe(0);
    expect(await tradieTrust(t.db, decliner.tradieId, null)).toEqual({ finishedJobs: 0, otherFlags: 0, trusted: false });
    const flagged = await t.db.query("select 1 from public.jobs where cardinality(check_flags) > 0");
    expect(flagged).toEqual([]);
    expect(await t.db.query("select 1 from public.exceptions where kind in ('tradie_flags', 'job_check')")).toEqual([]);
  });
});
