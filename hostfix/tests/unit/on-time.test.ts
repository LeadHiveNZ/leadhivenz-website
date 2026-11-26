import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargeJob, markMissedWindows } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer, alertNotTakenYet, answerLaterTime, expireDueOffers, expireLaterTimes, passOffer, suggestLaterTime, waitingLaterTime } from "@/lib/dispatch/cascade";
import { arrivalWindows, checkArrival, distanceMetres, laterWindows, linesToDrop, referencePoint, surchargeVerdict, windowLabel } from "@/lib/jobs/arrival";
import { getJobForStaff, listLines } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { loadJobView } from "@/lib/jobs/view";
import { completeJob, reportTradieAbsent } from "@/lib/jobs/work";
import { getMarket } from "@/lib/markets/store";
import { setStaffContacts } from "@/lib/ops/exceptions";
import type { Property } from "@/lib/properties/service";
import { laterWave, onTimeRecords, recentNoShows } from "@/lib/tradies/reliability";
import { addTextingHours, isQuietHours, nextTextingTime } from "@/lib/time";
import { scorecards } from "@/lib/tradies/scorecard";
import { getTradie } from "@/lib/tradies/service";
import { testDb } from "./db";
import { addPlusTier, arrive, auditActions, gatewayFor, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, MONDAY_9PM, offersFor, openExceptions, photo, textsTo } from "./factory";

/**
 * THE RULES OF 18 NOVEMBER 2026 (DECISIONS.md): HostFix no longer pays for an
 * unreliable tradie, and the owner pays only for what actually happened.
 *
 * Every amount below is worked out by hand from seed/menu-queenstown.json and
 * the market's surcharges, never copied from what the code returns:
 *
 *   PL-01 Toilet seat or cistern parts   owner 225 dollars  tradie 190 dollars  -> 22500 / 19000, we keep 3500
 *   HM-01 Shelf, hook or mirror hanging  owner 155 dollars  tradie 130 dollars  -> 15500 / 13000
 *   Urgent surcharge 5000: the tradie gets 5000 less 15% (750) = 4250, we keep 750
 *   After-hours surcharge 14000: the tradie gets 14000 less 15% (2100) = 11900, we keep 2100
 *
 * Queenstown's working hours are 7am to 4:30pm, Monday to Friday, Pacific/Auckland
 * (UTC+13 in November). The times used here:
 *
 *   Mon 16 Nov  6:30am  2026-11-15T17:30Z     Mon 16 Nov 10:00am  2026-11-15T21:00Z (MONDAY_10AM)
 *   Mon 16 Nov  2:00pm  2026-11-16T01:00Z     Mon 16 Nov  9:00pm  2026-11-16T08:00Z (MONDAY_9PM)
 */

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => {
  setTestNow(null);
  setStaffContacts(null);
});

const MONDAY_2PM = new Date("2026-11-16T01:00:00.000Z");
const MONDAY_630AM = new Date("2026-11-15T17:30:00.000Z");
const HOUSE = { lat: -45.03, lng: 168.66 }; // the same spot as the factory's HOUSE

async function setup(options: { tier?: "essential" | "plus"; market?: Record<string, unknown> } = {}) {
  await liveMarket(t.db, options.market ?? {});
  if (options.tier === "plus") await addPlusTier(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId, { tier: options.tier ?? "essential" });
  const first = await makeTradie(t.db, { slot: 1, afterHours: true, name: "Wakatipu Plumbing", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] });
  return { owner, property, first };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function accepted(s: Setup, job: Job, windowEnd?: string) {
  const [offer] = await offersFor(t.db, job.id);
  const result = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link", undefined, { windowEnd: windowEnd ?? null }));
  if (result.result !== "accepted") throw new Error(`Not accepted: ${result.result}`);
  return result.job;
}

/** Arrives at `at` with a before photo, and finishes 30 minutes later from the same spot (so the job is not flagged as too quick). */
async function arriveAndFinish(s: Setup, jobId: string, at: Date, where: { lat: number; lng: number } | null = HOUSE) {
  setTestNow(at);
  const arrived = await arrive(t.db, jobId, s.first.tradieId, where ?? {});
  if (!arrived.ok) throw new Error(arrived.message);
  setTestNow(addMinutes(at, 30));
  const done = await completeJob(t.db, jobId, s.first.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${s.first.tradieId}`)], ...(where ?? {}) });
  if (!done.ok) throw new Error(done.message);
  return done.job;
}

const activeLine = async (jobId: string, kind: string) => (await listLines(t.db, jobId)).find((line) => line.kind === kind && line.status === "active") ?? null;
const charged = async (jobId: string) => (await t.db.query<{ amount_cents: number }>("select amount_cents from public.payments where job_id = $1::uuid", [jobId]))[0]?.amount_cents ?? null;
const paidOut = async (jobId: string) => (await t.db.query<{ amount_cents: number }>("select amount_cents from public.payouts where job_id = $1::uuid", [jobId]))[0]?.amount_cents ?? null;

// ---------------------------------------------------------------------------
// RULE 2: LATE ON AN URGENT JOB, THE URGENT SURCHARGE IS NOT CHARGED AT ALL
// ---------------------------------------------------------------------------

describe("an urgent job", () => {
  it("ON TIME: the urgent line is charged and paid. Owner 5000, tradie 4250, HostFix 750 of it", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    // 10am Monday is inside working hours, so there is no after-hours line. The deadline is 4 hours on: 2pm.
    expect(job.respondBy!.toISOString()).toBe(MONDAY_2PM.toISOString());
    expect(job.afterHours).toBe(false);
    await accepted(s, job);
    const done = await arriveAndFinish(s, job.id, addMinutes(MONDAY_2PM, -1));
    expect(await activeLine(job.id, "urgent")).toMatchObject({ ownerCents: 5000, tradieCents: 4250 });
    // Owner 22500 + 5000 = 27500. Tradie 19000 + 4250 = 23250. HostFix 3500 + 750 = 4250.
    expect(done).toMatchObject({ ownerTotalCents: 27500, tradieTotalCents: 23250 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await charged(job.id)).toBe(27500);
    expect(await paidOut(job.id)).toBe(23250);
    expect(27500 - 23250).toBe(4250);
  });

  it("exactly at the deadline still counts as on time", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    await accepted(s, job);
    const done = await arriveAndFinish(s, job.id, MONDAY_2PM);
    expect(done).toMatchObject({ ownerTotalCents: 27500, tradieTotalCents: 23250 });
  });

  it("LATE: the urgent line is dropped for everyone (0, 0, 0) and the rest is charged and paid as normal", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    await accepted(s, job);
    const done = await arriveAndFinish(s, job.id, addMinutes(MONDAY_2PM, 1));
    expect(await activeLine(job.id, "urgent")).toBeNull();
    // Owner 22500 + 0 = 22500. Tradie 19000 + 0 = 19000. HostFix 3500 + 0 = 3500.
    expect(done).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await charged(job.id)).toBe(22500);
    expect(await paidOut(job.id)).toBe(19000);
    expect(await auditActions(t.db, job.id)).toContain("job.surcharge_dropped");
    // The owner sees why on the job page, before the card is charged.
    const history = (await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "owner")).history.map((entry) => `${entry.title}: ${entry.detail ?? ""}`);
    expect(history).toContain("No urgent fee: Not charged, because the tradie arrived after the urgent deadline.");
  });

  it("LATE on a membership that includes urgent: the tradie gets no surcharge share either", async () => {
    const s = await setup({ tier: "plus" });
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    // Included: the owner is charged 0 for the urgent line, and the tradie's 4250 share would be paid by HostFix.
    expect(await activeLine(job.id, "urgent")).toMatchObject({ ownerCents: 0, tradieCents: 4250 });
    await accepted(s, job);
    const done = await arriveAndFinish(s, job.id, addMinutes(MONDAY_2PM, 30));
    // Late: no urgent share. Owner 22500, tradie 19000, HostFix keeps 3500 and pays nothing for the urgent line.
    expect(done).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
  });

  it("the offer text says the urgent share is paid only if on site by the deadline, with the time", async () => {
    const s = await setup();
    await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    const [text] = await textsTo(t.db, s.first.phone, "offer");
    // 19000 + 4250 = 23250.
    expect(text!.body).toContain(": NZ$232.50 (NZ$42.50 if there by 2pm today)");
  });
});

// ---------------------------------------------------------------------------
// RULE 3: AFTER HOURS IS CHARGED FOR WHAT ACTUALLY HAPPENED
// ---------------------------------------------------------------------------

describe("the after-hours surcharge", () => {
  it("is charged when the tradie arrives outside working hours: Monday 9pm job, on site at 10pm", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    expect(job.afterHours).toBe(true);
    await accepted(s, job);
    const done = await arriveAndFinish(s, job.id, addHours(MONDAY_9PM, 1));
    // Owner 22500 + 5000 + 14000 = 41500. Tradie 19000 + 4250 + 11900 = 35150. HostFix 3500 + 750 + 2100 = 6350.
    expect(done).toMatchObject({ ownerTotalCents: 41500, tradieTotalCents: 35150 });
    expect(41500 - 35150).toBe(6350);
  });

  it("is not charged when a job flagged after hours is attended in working hours: 6:30am job, on site at 7:15am", async () => {
    setTestNow(MONDAY_630AM);
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    // Before 7am, so after hours when logged. The urgent deadline is 10:30am.
    expect(job.afterHours).toBe(true);
    expect(job.ownerTotalCents).toBe(41500);
    await accepted(s, job);
    const done = await arriveAndFinish(s, job.id, addMinutes(MONDAY_630AM, 45));
    // 7:15am is inside working hours: no after-hours line for anyone. The urgent line stays (on time).
    // Owner 22500 + 5000 = 27500. Tradie 19000 + 4250 = 23250.
    expect(await activeLine(job.id, "after_hours")).toBeNull();
    expect(await activeLine(job.id, "urgent")).not.toBeNull();
    expect(done).toMatchObject({ ownerTotalCents: 27500, tradieTotalCents: 23250 });
  });

  it("late AND in working hours: both surcharges come off. Monday 9pm job, on site 7:30am Tuesday", async () => {
    setTestNow(MONDAY_9PM);
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    await accepted(s, job);
    // The deadline was 1am. 7:30am Tuesday is late and inside working hours.
    const done = await arriveAndFinish(s, job.id, new Date("2026-11-16T18:30:00.000Z"));
    expect(done).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
  });

  it("the verdict itself, as plain sums", async () => {
    const market = (await getMarket(t.db, "queenstown"))!;
    const urgent = { urgency: "urgent" as const, respondBy: MONDAY_2PM };
    expect(surchargeVerdict(urgent, MONDAY_2PM, market)).toEqual({ dropUrgent: false, dropEmergency: false, dropAfterHours: true });
    expect(surchargeVerdict(urgent, addMinutes(MONDAY_2PM, 1), market)).toEqual({ dropUrgent: true, dropEmergency: false, dropAfterHours: true });
    expect(surchargeVerdict(urgent, MONDAY_9PM, market)).toEqual({ dropUrgent: true, dropEmergency: false, dropAfterHours: false });
    const lines = [{ kind: "menu" as const }, { kind: "urgent" as const }, { kind: "after_hours" as const }];
    expect(linesToDrop(lines, { dropUrgent: true, dropEmergency: false, dropAfterHours: false })).toEqual([{ kind: "urgent" }]);
  });
});

// ---------------------------------------------------------------------------
// RULE 4: AN ARRIVED TAP THAT CANNOT BE TRUSTED IS FLAGGED
// ---------------------------------------------------------------------------

describe("checking where the Arrived tap came from", () => {
  it("measures distance on the earth, worked by hand: 0.0005 degrees of latitude is about 56 m, 0.01 is about 1112 m", () => {
    // 6,371,000 m x 0.0005 x pi / 180 = 55.6 m. x 0.01 = 1111.9 m.
    expect(distanceMetres(HOUSE, { lat: -45.0305, lng: 168.66 })).toBe(56);
    expect(distanceMetres(HOUSE, { lat: -45.04, lng: 168.66 })).toBe(1112);
  });

  it("uses the middle of earlier trusted taps, so one stray tap cannot move the reference far", () => {
    const reference = referencePoint([HOUSE, { lat: -45.0301, lng: 168.6601 }, { lat: -45.5, lng: 169 }]);
    expect(reference).toEqual({ lat: -45.0301, lng: 168.6601 });
    expect(checkArrival(null, [HOUSE]).check).toBe("no_location");
    expect(checkArrival(HOUSE, []).check).toBe("no_reference");
    expect(checkArrival({ lat: -45.0305, lng: 168.66 }, [HOUSE])).toMatchObject({ check: "ok", distanceM: 56 });
    expect(checkArrival({ lat: -45.04, lng: 168.66 }, [HOUSE])).toMatchObject({ check: "far", distanceM: 1112 });
  });

  it("the first visit says 'no reference yet' and raises nothing; a later tap 1.1 km away is recorded as far, for the owner to check rather than the dispatcher", async () => {
    const s = await setup();
    const first = await logJob(t.db, s.property, { code: "PL-01" });
    await accepted(s, first);
    await arriveAndFinish(s, first.id, addHours(MONDAY_10AM, 2));
    expect((await getJobForStaff(t.db, first.id))!.arrivalCheck).toBe("no_reference");
    expect(await openExceptions(t.db, first.id)).not.toContain("arrival_unverified");

    setTestNow(addHours(MONDAY_10AM, 3));
    const second = await logJob(t.db, s.property, { code: "PL-03" });
    await accepted(s, second);
    await arriveAndFinish(s, second.id, addHours(MONDAY_10AM, 4), { lat: -45.0305, lng: 168.66 });
    expect((await getJobForStaff(t.db, second.id))!).toMatchObject({ arrivalCheck: "ok", arrivalDistanceM: 56 });

    setTestNow(addHours(MONDAY_10AM, 5));
    const third = await logJob(t.db, s.property, { code: "PL-01" });
    await accepted(s, third);
    setTestNow(addHours(MONDAY_10AM, 6));
    await arrive(t.db, third.id, s.first.tradieId, { lat: -45.04, lng: 168.66 });
    // The property has no map pin, so the reference is the middle of the two trusted taps: -45.03025, 168.66. 0.00975 degrees is 1084 m.
    expect((await getJobForStaff(t.db, third.id))!).toMatchObject({ arrivalCheck: "far", arrivalDistanceM: 1084, checkReference: "earlier_taps" });
    // Since 19 November 2026 the dispatcher is not called for this: it is one of the job's flags when it is finished (DECISIONS.md).
    expect(await openExceptions(t.db, third.id)).not.toContain("arrival_unverified");
  });

  it("no location from the phone is recorded, and the tap still works", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    await accepted(s, job);
    expect(await arrive(t.db, job.id, s.first.tradieId)).toMatchObject({ ok: true });
    expect((await getJobForStaff(t.db, job.id))!).toMatchObject({ status: "on_site", arrivalCheck: "no_location" });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
  });

  it("the owner's 'tradie has arrived' text points to the job page, and 'The tradie isn't here' raises an urgent exception once", async () => {
    setStaffContacts(() => ({ alertEmails: [], alertPhones: ["+64211112222"], queueUrl: "https://example.com/admin/queue" }));
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    await accepted(s, job);
    // Before the tradie taps Arrived the button does nothing.
    expect(await reportTradieAbsent(t.db, job.id, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: false });
    await arrive(t.db, job.id, s.first.tradieId, HOUSE);
    const [arrivedText] = await textsTo(t.db, s.owner.user.phone!, "tradie_arrived");
    expect(arrivedText!.body).toContain("Not there? Tell us:");
    expect(arrivedText!.body).toMatch(/\/j\/\d+\.[A-Za-z0-9]{12}/);

    expect(await reportTradieAbsent(t.db, job.id, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true });
    expect(await reportTradieAbsent(t.db, job.id, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true });
    expect(await openExceptions(t.db, job.id)).toEqual(["owner_says_absent"]);
    expect(await textsTo(t.db, "+64211112222", "exception")).toHaveLength(1);
    expect((await getJobForStaff(t.db, job.id))!.ownerSaysAbsentAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RULE 5: THE TRADIE PICKS AN ARRIVAL WINDOW WHEN ACCEPTING A NORMAL JOB
// ---------------------------------------------------------------------------

describe("the arrival window", () => {
  it("offers two-hour windows in working hours that all end inside the 24-hour promise", async () => {
    const market = (await getMarket(t.db, "queenstown"))!;
    // Accepting at 10am Monday, promised by 10am Tuesday. Working day 7am to 4:30pm, in two-hour steps from 7am.
    const windows = arrivalWindows(market, MONDAY_10AM, addHours(MONDAY_10AM, 24));
    expect(windows.map((window) => windowLabel(window, MONDAY_10AM, market.timezone))).toEqual([
      "10am to 11am today", // the 9-11 window is under way, so it starts now
      "11am to 1pm today",
      "1pm to 3pm today",
      "3pm to 4:30pm today",
      "7am to 9am tomorrow", // 9-11 tomorrow would end after 10am, outside the promise
    ]);
    expect(windows.every((window) => window.end.getTime() <= addHours(MONDAY_10AM, 24).getTime())).toBe(true);
  });

  it("is stored on the job, texted to the owner and the cleaner, and decides what on time means", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", reportedBy: "team", reporterName: "Mele", reporterPhone: "+64211234599" });
    const onePm = new Date("2026-11-16T00:00:00.000Z");
    const threePm = new Date("2026-11-16T02:00:00.000Z");
    const booked = await accepted(s, job, threePm.toISOString());
    expect(booked.arrivalWindowStart!.toISOString()).toBe(onePm.toISOString());
    expect(booked.arrivalWindowEnd!.toISOString()).toBe(threePm.toISOString());
    expect((await textsTo(t.db, s.owner.user.phone!, "job_booked"))[0]!.body).toContain(", between 1pm and 3pm today");
    expect((await textsTo(t.db, "+64211234599", "reporter_booked"))[0]!.body).toContain("between 1pm and 3pm today");

    // 3:01pm: inside the 24-hour promise, but after the window they chose, so not on time. No money changes on a normal job.
    setTestNow(addMinutes(threePm, 1));
    await arrive(t.db, job.id, s.first.tradieId, HOUSE);
    const [arrived] = await t.db.query<{ detail: { on_time: boolean } }>("select detail from public.audit_log where entity_id = $1 and action = 'job.arrived'", [job.id]);
    expect(arrived!.detail.on_time).toBe(false);
    expect((await getJobForStaff(t.db, job.id))!).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
  });

  it("refuses a window that is not one of the choices", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    const result = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link", undefined, { windowEnd: addHours(MONDAY_10AM, 30).toISOString() }));
    expect(result.result).toBe("window_gone");
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("offering");
  });

  it("an urgent job's window is simply its 4-hour deadline", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    const booked = await accepted(s, job);
    expect(booked.arrivalWindowStart!.toISOString()).toBe(MONDAY_10AM.toISOString());
    expect(booked.arrivalWindowEnd!.toISOString()).toBe(MONDAY_2PM.toISOString());
    expect((await textsTo(t.db, s.owner.user.phone!, "job_booked"))[0]!.body).toContain("by 2pm today");
  });
});

// ---------------------------------------------------------------------------
// RULE 6: NOBODY HAS TAKEN A NORMAL JOB IN 3 HOURS
// ---------------------------------------------------------------------------

describe("a normal job nobody has taken in 3 hours", () => {
  it("texts the owner that we are ringing round and they pay nothing unless a tradie does it, and alerts the founder", async () => {
    setStaffContacts(() => ({ alertEmails: [], alertPhones: ["+64211112222"], queueUrl: "https://example.com/admin/queue" }));
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    setTestNow(addMinutes(addHours(MONDAY_10AM, 3), -1));
    expect(await alertNotTakenYet(t.db)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 3));
    expect(await alertNotTakenYet(t.db)).toBe(1);
    const [told] = await textsTo(t.db, s.owner.user.phone!, "not_taken_yet");
    expect(told!.body).toContain("no tradie for");
    expect(told!.body).toContain("We're ringing round. No charge unless it's done.");
    expect(await openExceptions(t.db, job.id)).toContain("not_taken_yet");
    expect((await textsTo(t.db, "+64211112222", "exception")).some((text) => (text.body ?? "").includes("nobody has taken"))).toBe(true);
    // Once only.
    expect(await alertNotTakenYet(t.db)).toBe(0);
    // When someone takes it, the item leaves the queue.
    await accepted(s, job);
    expect(await openExceptions(t.db, job.id)).not.toContain("not_taken_yet");
  });

  it("is a market setting: at 2 hours it goes at noon", async () => {
    const s = await setup({ market: { unaccepted_alert_hours: 2 } });
    expect((await getMarket(t.db, "queenstown"))!.unacceptedAlertHours).toBe(2);
    await logJob(t.db, s.property, { code: "PL-01" });
    setTestNow(addHours(MONDAY_10AM, 2));
    expect(await alertNotTakenYet(t.db)).toBe(1);
  });

  it("leaves urgent jobs to their own faster alerts, and never fires for a job that was taken", async () => {
    const s = await setup();
    await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    const taken = await logJob(t.db, s.property, { code: "PL-03" });
    await accepted(s, taken);
    setTestNow(addHours(MONDAY_10AM, 3));
    expect(await alertNotTakenYet(t.db)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RULE 7: THE ON-TIME RECORD DECIDES NETWORK ORDER. DECLINES NEVER COUNT.
// ---------------------------------------------------------------------------

/** Builds a history for a tradie through the app itself: handyman jobs only they do, each at its own house, arrived on time or late. */
async function history(owner: { ownerId: string }, tradieId: string, onTime: number, late: number) {
  const start = MONDAY_10AM;
  // The history runs over every day of the week: the tradie works them all, so each job is offered to them.
  await t.db.query("update public.tradies set days_available = '{mon,tue,wed,thu,fri,sat,sun}' where id = $1::uuid", [tradieId]);
  let n = 0;
  for (const arrivesLate of [...Array(onTime).fill(false), ...Array(late).fill(true)] as boolean[]) {
    setTestNow(addHours(start, -24 * 60 + n * 30));
    n += 1;
    const property: Property = await makeProperty(t.db, owner.ownerId);
    const job = await logJob(t.db, property, { code: "HM-01" });
    const offer = (await offersFor(t.db, job.id)).find((row) => row.tradie_id === tradieId)!;
    const took = await t.db.tx((tx) => acceptOffer(tx, offer.id, "link"));
    if (took.result !== "accepted") throw new Error(took.result);
    // No window chosen, so the promise (24 hours) is the deadline.
    setTestNow(addHours(job.dispatchedAt!, arrivesLate ? 25 : 2));
    await arrive(t.db, job.id, tradieId, HOUSE);
  }
  setTestNow(MONDAY_10AM);
}

describe("network offer order", () => {
  it("under 90% on time after 10 arrivals: offered network jobs in a later wave, still offered", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const steady = await makeTradie(t.db, { name: "Steady Ltd", trades: ["plumber", "handyman"] });
    const slipping = await makeTradie(t.db, { name: "Slipping Ltd", trades: ["plumber", "handyman"] });
    const fresh = await makeTradie(t.db, { name: "Fresh Ltd" });
    // Slipping: 8 of 10 on time = 80%, under 90%. Steady: 9 of 10 = 90%, not under.
    await history(owner, slipping.tradieId, 8, 2);
    await history(owner, steady.tradieId, 9, 1);
    const records = await onTimeRecords(t.db, [slipping.tradieId, steady.tradieId, fresh.tradieId]);
    expect(records.get(slipping.tradieId)).toEqual({ arrivals: 10, onTime: 8 });
    expect(records.get(steady.tradieId)).toEqual({ arrivals: 10, onTime: 9 });
    expect(laterWave(records.get(slipping.tradieId))).toBe(true);
    expect(laterWave(records.get(steady.tradieId))).toBe(false);
    // 9 arrivals at 0% would still be too few to judge.
    expect(laterWave({ arrivals: 9, onTime: 0 })).toBe(false);

    const job = await logJob(t.db, property, { code: "PL-01" });
    // No first choice or backup for plumbing here, so it goes straight to everyone: Steady and Fresh first.
    expect((await offersFor(t.db, job.id)).map((offer) => offer.tradie_id).sort()).toEqual([steady.tradieId, fresh.tradieId].sort());
    // Their 15 minutes run out: Slipping gets it in the second wave.
    setTestNow(addMinutes(MONDAY_10AM, 15));
    await expireDueOffers(t.db);
    const second = (await offersFor(t.db, job.id)).filter((offer) => offer.status === "pending");
    expect(second.map((offer) => offer.tradie_id)).toEqual([slipping.tradieId]);
    expect(second[0]!.stage).toBe(3);
  });

  it("passing on offers never changes a tradie's place: 12 passes, still in the first wave, beside a tradie who never passed", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const decliner = await makeTradie(t.db, { name: "Decliner Ltd" });
    const other = await makeTradie(t.db, { name: "Other Ltd" });
    for (let index = 0; index < 12; index += 1) {
      setTestNow(addHours(MONDAY_10AM, -48 + index));
      const job = await logJob(t.db, await makeProperty(t.db, owner.ownerId), { code: "PL-01" });
      const offer = (await offersFor(t.db, job.id)).find((row) => row.tradie_id === decliner.tradieId)!;
      expect(await t.db.tx((tx) => passOffer(tx, offer.id, "link"))).toBe("passed");
    }
    setTestNow(MONDAY_10AM);
    // Nothing on their record, nothing on the scorecard, and no review.
    expect((await onTimeRecords(t.db, [decliner.tradieId])).get(decliner.tradieId)).toBeUndefined();
    const card = (await scorecards(t.db, "queenstown")).find((row) => row.tradieId === decliner.tradieId)!;
    expect(card.belowTarget).toBe(false);
    expect(await recentNoShows(t.db, decliner.tradieId)).toBe(0);

    const job = await logJob(t.db, await makeProperty(t.db, owner.ownerId), { code: "PL-01" });
    const offers = await offersFor(t.db, job.id);
    expect(offers.map((offer) => [offer.tradie_id, offer.stage]).sort()).toEqual([[decliner.tradieId, 3], [other.tradieId, 3]].sort());
    expect((await getTradie(t.db, decliner.tradieId))!.status).toBe("approved");
  });

  it("a first-choice tradie with a slipping record is still offered the job first", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const first = await makeTradie(t.db, { slot: 1, trades: ["plumber", "handyman"] });
    await history(owner, first.tradieId, 5, 5);
    expect(laterWave((await onTimeRecords(t.db, [first.tradieId])).get(first.tradieId))).toBe(true);
    const job = await logJob(t.db, await makeProperty(t.db, owner.ownerId), { code: "PL-01" });
    expect((await offersFor(t.db, job.id)).map((offer) => [offer.tradie_id, offer.stage])).toEqual([[first.tradieId, 1]]);
  });
});

// ---------------------------------------------------------------------------
// RULE 8: NO-SHOWS ON ACCEPTED JOBS
// ---------------------------------------------------------------------------

describe("no-shows", () => {
  it("an accepted job with nobody there asks the dispatcher to call the tradie; the third in 90 days flags them for review, and nothing is changed on their account", async () => {
    const s = await setup();
    const jobs: Job[] = [];
    for (let index = 0; index < 3; index += 1) {
      setTestNow(addHours(MONDAY_10AM, index * 30));
      const job = await logJob(t.db, await makeProperty(t.db, s.owner.ownerId), { code: "PL-01" });
      await accepted(s, job);
      jobs.push(job);
      setTestNow(addHours(MONDAY_10AM, index * 30 + 24));
      expect(await markMissedWindows(t.db)).toEqual({ missed: 1, noShows: 1 });
      expect(await openExceptions(t.db, job.id)).toContain("no_show");
      const review = await t.db.query("select 1 from public.exceptions where kind = 'tradie_review' and tradie_id = $1::uuid", [s.first.tradieId]);
      expect(review).toHaveLength(index === 2 ? 1 : 0);
    }
    expect(await recentNoShows(t.db, s.first.tradieId)).toBe(3);
    // Never removed or paused automatically.
    expect((await getTradie(t.db, s.first.tradieId))!.status).toBe("approved");
    // 91 days on, they have dropped out of the count.
    expect(await recentNoShows(t.db, s.first.tradieId, addHours(MONDAY_10AM, 24 * 91 + 90))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RULE 9: THE CHOSEN TRADIE SUGGESTS A LATER TIME
// ---------------------------------------------------------------------------

describe("the owner's chosen tradie suggests a later time", () => {
  async function suggested(options: { urgent?: boolean; market?: Record<string, unknown> } = {}) {
    const s = await setup({ market: options.market });
    const backup = await makeTradie(t.db, { slot: 2, afterHours: true, name: "Backup Plumbing" });
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: options.urgent ?? false });
    const [offer] = await offersFor(t.db, job.id);
    const market = (await getMarket(t.db, "queenstown"))!;
    // Two days on, Wednesday 9am to 11am: "9am to 11am Wed 18 Nov".
    const later = laterWindows(market, job.respondBy!, MONDAY_10AM).find((window) => window.end.toISOString() === "2026-11-17T22:00:00.000Z")!;
    expect(windowLabel(later, MONDAY_10AM, market.timezone)).toBe("9am to 11am Wed 18 Nov");
    const result = await t.db.tx((tx) => suggestLaterTime(tx, offer!.id, later.end.toISOString(), "link"));
    if (!result.ok) throw new Error(result.message);
    return { s, backup, job, offer: offer!, later, proposal: result.proposal };
  }

  it("asks the owner by text, holds the job, and does not offer it to the backup meanwhile", async () => {
    const { s, backup, job } = await suggested();
    const [asked] = await textsTo(t.db, s.owner.user.phone!, "later_time_offered");
    expect(asked!.body).toContain("Wakatipu Pl... can come between 9am and 11am Wed 18 Nov, not in 24h. Wait?");
    setTestNow(addMinutes(MONDAY_10AM, 30));
    await expireDueOffers(t.db);
    expect(await textsTo(t.db, backup.phone, "offer")).toHaveLength(0);
    expect((await getJobForStaff(t.db, job.id))!.status).toBe("offering");
  });

  it("WAIT: the tradie has the job, and the promise, on-time and no-show are judged against the new time", async () => {
    const { s, job, proposal, later } = await suggested();
    const answer = await t.db.tx((tx) => answerLaterTime(tx, proposal.id, true, `owner:${s.owner.ownerId}`));
    expect(answer).toEqual({ ok: true, waited: true });
    const booked = (await getJobForStaff(t.db, job.id))!;
    expect(booked).toMatchObject({ status: "accepted", tradieId: s.first.tradieId });
    expect(booked.respondBy!.toISOString()).toBe(later.end.toISOString());
    expect(booked.arrivalWindowEnd!.toISOString()).toBe(later.end.toISOString());
    expect((await textsTo(t.db, s.first.phone, "later_time_accepted"))[0]!.body).toContain("is yours, the owner will wait:");
    // The original 24 hours pass: not a miss, because the promise moved.
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await markMissedWindows(t.db)).toEqual({ missed: 0, noShows: 0 });
    setTestNow(later.end);
    expect(await markMissedWindows(t.db)).toEqual({ missed: 1, noShows: 1 });
  });

  it("WAIT on an urgent job: it stops being urgent and the urgent surcharge is charged to nobody", async () => {
    const { s, job, proposal } = await suggested({ urgent: true });
    // Before: 22500 + 5000 = 27500 to the owner, 19000 + 4250 = 23250 to the tradie.
    expect(job).toMatchObject({ ownerTotalCents: 27500, tradieTotalCents: 23250 });
    await t.db.tx((tx) => answerLaterTime(tx, proposal.id, true, `owner:${s.owner.ownerId}`));
    // After: 22500 and 19000. The urgent line is 0 for the owner, 0 for the tradie, 0 for HostFix.
    expect((await getJobForStaff(t.db, job.id))!).toMatchObject({ urgency: "standard", ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await activeLine(job.id, "urgent")).toBeNull();
  });

  it("SEND NOW: the backup is offered it at once and the chosen tradie is told, with no mark against them", async () => {
    const { s, backup, job, proposal } = await suggested();
    expect(await t.db.tx((tx) => answerLaterTime(tx, proposal.id, false, `owner:${s.owner.ownerId}`))).toEqual({ ok: true, waited: false });
    expect(await textsTo(t.db, backup.phone, "offer")).toHaveLength(1);
    expect((await textsTo(t.db, s.first.phone, "later_time_sent_on"))[0]!.body).toContain("This never counts against you.");
    expect(await waitingLaterTime(t.db, job.id)).toBeNull();
    expect((await onTimeRecords(t.db, [s.first.tradieId])).get(s.first.tradieId)).toBeUndefined();
    expect((await scorecards(t.db, "queenstown")).find((card) => card.tradieId === s.first.tradieId)!.belowTarget).toBe(false);
  });

  it("NO ANSWER in 2 hours (a market setting): it goes on to the next tradie by itself", async () => {
    const { backup, job } = await suggested();
    setTestNow(addMinutes(addHours(MONDAY_10AM, 2), -1));
    expect(await expireLaterTimes(t.db)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 2));
    expect(await expireLaterTimes(t.db)).toBe(1);
    expect(await textsTo(t.db, backup.phone, "offer")).toHaveLength(1);
    expect(await auditActions(t.db, job.id)).toContain("job.later_time_expired");
  });

  it("holds back the 3-hour alert while the owner is still choosing", async () => {
    await suggested({ market: { counter_offer_hours: 4 } });
    setTestNow(addHours(MONDAY_10AM, 3));
    expect(await alertNotTakenYet(t.db)).toBe(0);
  });

  it("only the first choice and the backup may suggest a later time, not the wider network", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    await makeTradie(t.db);
    const job = await logJob(t.db, property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    expect(offer!.stage).toBe(3);
    const result = await t.db.tx((tx) => suggestLaterTime(tx, offer!.id, "2026-11-17T22:00:00.000Z", "link"));
    expect(result.ok).toBe(false);
  });

  it("when the chosen tradie passes, the owner reads that they aren't available, never 'passed' or 'declined'", async () => {
    const s = await setup();
    await makeTradie(t.db, { slot: 2, name: "Backup Plumbing" });
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => passOffer(tx, offer!.id, "link"));
    const owner = (await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "owner")).history.map((entry) => entry.title);
    expect(owner).toContain("Wakatipu Plumbing isn't available for this one, so we've sent it to another HostFix tradie.");
    expect(owner.join(" ").toLowerCase()).not.toMatch(/passed|declined/);
  });
});

// ---------------------------------------------------------------------------
// QUIET HOURS: the two new owner texts never go between 9pm and 7am, and their
// clocks on a normal job count only 7am to 9pm (DECISIONS.md, 2026-11-18).
//
//   Mon 16 Nov  6:00pm  2026-11-16T05:00Z     Mon 16 Nov  7:00pm  2026-11-16T06:00Z
//   Mon 16 Nov  9:00pm  2026-11-16T08:00Z     Mon 16 Nov 10:00pm  2026-11-16T09:00Z
//   Tue 17 Nov  7:00am  2026-11-16T18:00Z     Tue 17 Nov  8:00am  2026-11-16T19:00Z
//   Tue 17 Nov  9:00am  2026-11-16T20:00Z
// ---------------------------------------------------------------------------

const MON_6PM = new Date("2026-11-16T05:00:00.000Z");
const MON_7PM = new Date("2026-11-16T06:00:00.000Z");
const MON_10PM = new Date("2026-11-16T09:00:00.000Z");
const TUE_7AM = new Date("2026-11-16T18:00:00.000Z");
const TUE_8AM = new Date("2026-11-16T19:00:00.000Z");
const TUE_9AM = new Date("2026-11-16T20:00:00.000Z");
const ZONE = "Pacific/Auckland";

const sendAfter = async (template: string) =>
  (await t.db.query<{ send_after: Date }>("select send_after from public.notifications where template = $1 order by created_at", [template])).map((row) => new Date(row.send_after).toISOString());

describe("quiet hours", () => {
  it("count only 7am to 9pm, worked by hand", () => {
    // Mon 7pm + 3 hours: 7pm to 9pm is 2, then 7am to 8am Tuesday is the third.
    expect(addTextingHours(MON_7PM, 3, ZONE).toISOString()).toBe(TUE_8AM.toISOString());
    // Mon 10pm + 2 hours: nothing counts until 7am, so 9am Tuesday.
    expect(addTextingHours(MON_10PM, 2, ZONE).toISOString()).toBe(TUE_9AM.toISOString());
    // Daytime is the plain clock: 10am + 3 hours is 1pm.
    expect(addTextingHours(MONDAY_10AM, 3, ZONE).toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(nextTextingTime(MON_10PM, ZONE).toISOString()).toBe(TUE_7AM.toISOString());
    expect(nextTextingTime(addMinutes(TUE_7AM, -1), ZONE).toISOString()).toBe(TUE_7AM.toISOString());
    expect(nextTextingTime(MONDAY_10AM, ZONE).toISOString()).toBe(MONDAY_10AM.toISOString());
    expect(isQuietHours(MONDAY_9PM, ZONE)).toBe(true);
    expect(isQuietHours(addMinutes(MONDAY_9PM, -1), ZONE)).toBe(false);
  });

  it("a normal job logged at 7pm: the 3 hours do not run out overnight, so the alert and the text are at 8am", async () => {
    setTestNow(MON_7PM);
    const s = await setup();
    await logJob(t.db, s.property, { code: "PL-01" });
    setTestNow(MON_10PM);
    expect(await alertNotTakenYet(t.db)).toBe(0);
    setTestNow(addMinutes(TUE_8AM, -1));
    expect(await alertNotTakenYet(t.db)).toBe(0);
    setTestNow(TUE_8AM);
    expect(await alertNotTakenYet(t.db)).toBe(1);
    expect(await sendAfter("not_taken_yet")).toEqual([TUE_8AM.toISOString()]);
  });

  it("a normal job logged at 6pm: due at 9pm exactly, so the queue item appears at 9pm and the owner's text waits for 7am", async () => {
    setTestNow(MON_6PM);
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    setTestNow(MONDAY_9PM);
    expect(await alertNotTakenYet(t.db)).toBe(1);
    expect(await openExceptions(t.db, job.id)).toContain("not_taken_yet");
    expect(await sendAfter("not_taken_yet")).toEqual([TUE_7AM.toISOString()]);
    const [raised] = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'not_taken_yet'", [job.id]);
    expect(raised!.summary).toContain("The owner will be texted at 7am.");
  });

  it("a later time suggested at 10pm on a normal job: the owner is texted at 7am and has until 9am to answer", async () => {
    setTestNow(MON_10PM);
    const s = await setup();
    const backup = await makeTradie(t.db, { slot: 2, name: "Backup Plumbing" });
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    const market = (await getMarket(t.db, "queenstown"))!;
    const later = laterWindows(market, job.respondBy!, MON_10PM)[0]!;
    const result = await t.db.tx((tx) => suggestLaterTime(tx, offer!.id, later.end.toISOString(), "link"));
    if (!result.ok) throw new Error(result.message);
    expect(result.proposal.answerBy.toISOString()).toBe(TUE_9AM.toISOString());
    expect(await sendAfter("later_time_offered")).toEqual([TUE_7AM.toISOString()]);
    setTestNow(addMinutes(TUE_9AM, -1));
    expect(await expireLaterTimes(t.db)).toBe(0);
    setTestNow(TUE_9AM);
    expect(await expireLaterTimes(t.db)).toBe(1);
    expect(await textsTo(t.db, backup.phone, "offer")).toHaveLength(1);
  });

  it("an urgent job is unchanged: suggested at 10pm, the text goes at once and the 2 hours run to midnight", async () => {
    setTestNow(MON_10PM);
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01", urgent: true });
    const [offer] = await offersFor(t.db, job.id);
    const market = (await getMarket(t.db, "queenstown"))!;
    const later = laterWindows(market, job.respondBy!, MON_10PM)[0]!;
    const result = await t.db.tx((tx) => suggestLaterTime(tx, offer!.id, later.end.toISOString(), "link"));
    if (!result.ok) throw new Error(result.message);
    expect(result.proposal.answerBy.toISOString()).toBe(addHours(MON_10PM, 2).toISOString());
    expect(await sendAfter("later_time_offered")).toEqual([MON_10PM.toISOString()]);
  });
});
