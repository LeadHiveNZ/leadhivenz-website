import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer, stepDownEmergencies, switchToUrgent } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { previewPrice } from "@/lib/jobs/create";
import { initialLines, noAccessLines, ownClientLines, stepDownSaving, totals } from "@/lib/jobs/pricing";
import { goAheadPrices, reportFormData } from "@/lib/jobs/report-data";
import { getJobForStaff, listLines } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { getMarket } from "@/lib/markets/store";
import { afterHoursCover, combineCover, coverNow, hoursState, noCoverWords, rushRefusal } from "@/lib/tradies/cover";
import { checkWorkingHours, eligibleTradies, getTradie, insideWorkingHours, updateTradie } from "@/lib/tradies/service";
import { testDb } from "./db";
import { addPlusTier, arrive, auditActions, gatewayFor, liveMarket, logJob, makeOwner, makeProperty, makeTradie, menuItem, messagesTo, MONDAY_10AM, MONDAY_9PM, offersFor, textsTo } from "./factory";

/**
 * EMERGENCY, AND EACH TRADIE'S OWN HOURS (DECISIONS.md, 2026-11-26, third entry).
 *
 * Worked out by hand from seed/menu-queenstown.json and config/markets.ts, never copied from the code:
 *   PL-01 Toilet seat or cistern parts: owner 22500, tradie 19000
 *   Emergency NZ$150: 15% of 15000 = 2250, so the tradie's share is 12750 (we keep 2250)
 *   Urgent NZ$50: the tradie's share is 4250
 *   After hours NZ$140: the tradie's share is 11900
 *   PL-01 as an emergency:             owner 22500 + 15000 = 37500, tradie 19000 + 12750 = 31750
 *   ... and after hours as well:       owner 37500 + 14000 = 51500, tradie 31750 + 11900 = 43650
 *   ... switched to urgent:            owner 22500 + 5000 = 27500 (NZ$100 less), tradie 19000 + 4250 = 23250
 * Queenstown: 7am to 4:30pm, Monday to Friday, Pacific/Auckland (UTC+13 in November).
 */

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const market = launchMarket;
const PL01 = { name: "Toilet seat or cistern parts", ownerPriceCents: 22500, tradiePayoutCents: 19000 };
const SUNDAY_10AM = new Date("2026-11-21T21:00:00.000Z"); // Sun 22 Nov 2026, 10am in Queenstown

async function setup() {
  await liveMarket(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  return { owner, property };
}

const active = async (jobId: string, kind: string) => (await listLines(t.db, jobId)).find((line) => line.kind === kind && line.status === "active") ?? null;
const reload = async (job: Job) => (await getJobForStaff(t.db, job.id))!;

describe("the price of an emergency", () => {
  it("adds NZ$150 for the owner and NZ$127.50 for the tradie", () => {
    const lines = initialLines(market, { item: PL01, urgent: false, emergency: true, afterHours: false, urgentIncluded: false });
    expect(lines.map((line) => [line.kind, line.ownerCents, line.tradieCents])).toEqual([["menu", 22500, 19000], ["emergency", 15000, 12750]]);
    expect(totals(lines)).toEqual({ ownerCents: 37500, tradieCents: 31750, platformCents: 5750 });
  });

  it("stacks with the after-hours call-out", () => {
    const lines = initialLines(market, { item: PL01, urgent: false, emergency: true, afterHours: true, urgentIncluded: false });
    expect(lines.map((line) => line.kind)).toEqual(["menu", "emergency", "after_hours"]);
    expect(totals(lines)).toEqual({ ownerCents: 51500, tradieCents: 43650, platformCents: 7850 });
  });

  it("is never covered by a membership that includes urgent", () => {
    const lines = initialLines(market, { item: PL01, urgent: true, emergency: true, afterHours: false, urgentIncluded: true });
    expect(lines.map((line) => [line.kind, line.ownerCents])).toEqual([["menu", 22500], ["emergency", 15000]]);
  });

  it("keeps the emergency line when the tradie cannot get in, and prices it again for an own client (5%)", () => {
    const lines = initialLines(market, { item: PL01, urgent: false, emergency: true, afterHours: false, urgentIncluded: false });
    expect(noAccessLines(market, lines).map((line) => line.kind)).toEqual(["no_access", "emergency"]);
    // 15000 less 5% (750) = 14250.
    expect(ownClientLines(market, lines).find((line) => line.kind === "emergency")!.tradieCents).toBe(14250);
  });

  it("saves NZ$100 when stepped down to urgent", () => {
    expect(stepDownSaving(market)).toBe(10000);
  });

  it("shows the owner the price before they send it, with after hours on top at 9pm", async () => {
    const { property } = await setup();
    const item = await menuItem(t.db, "PL-01");
    const day = (await previewPrice(t.db, property, { menuItemId: item.id, urgent: false, emergency: true }))!;
    expect(day).toMatchObject({ ownerCents: 37500, afterHours: false, responseMinutes: 60 });
    setTestNow(MONDAY_9PM);
    const night = (await previewPrice(t.db, property, { menuItemId: item.id, urgent: false, emergency: true }))!;
    expect(night).toMatchObject({ ownerCents: 51500, afterHours: true });
  });

  it("charges a member whose tier includes urgent the full emergency surcharge", async () => {
    await liveMarket(t.db);
    await addPlusTier(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId, { tier: "plus" });
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property, { emergency: true });
    expect(job).toMatchObject({ urgency: "emergency", ownerTotalCents: 37500, tradieTotalCents: 31750, responseHours: 1 });
  });
});

describe("an emergency is sent to everyone at once", () => {
  it("offers first choice, backup and everyone else in one go, with the hour as the deadline", async () => {
    const { property } = await setup();
    const first = await makeTradie(t.db, { slot: 1 });
    const backup = await makeTradie(t.db, { slot: 2 });
    const other = await makeTradie(t.db);
    const job = await logJob(t.db, property, { emergency: true });
    expect(job.respondBy!.toISOString()).toBe(addMinutes(MONDAY_10AM, 60).toISOString());
    const offers = await offersFor(t.db, job.id);
    expect(offers.map((offer) => offer.tradie_id).sort()).toEqual([first.tradieId, backup.tradieId, other.tradieId].sort());
    expect(new Set(offers.map((offer) => offer.stage))).toEqual(new Set([3]));
    const text = (await textsTo(t.db, other.phone, "offer"))[0]!.body;
    expect(text).toContain("EMERGENCY");
    expect(text).toContain("NZ$127.50 if there by 11am today");
  });
});

describe("the emergency surcharge is paid only if the tradie arrives within the hour", () => {
  async function booked() {
    const { property } = await setup();
    const tradie = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property, { emergency: true });
    const [offer] = await offersFor(t.db, job.id);
    const took = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    if (took.result !== "accepted") throw new Error(took.result);
    return { job, tradie };
  }

  it("keeps it on time (59 minutes)", async () => {
    const { job, tradie } = await booked();
    setTestNow(addMinutes(MONDAY_10AM, 59));
    expect((await arrive(t.db, job.id, tradie.tradieId)).ok).toBe(true);
    expect(await reload(job)).toMatchObject({ ownerTotalCents: 37500, tradieTotalCents: 31750 });
  });

  it("drops it for everyone when late (61 minutes); the rest of the job is normal", async () => {
    const { job, tradie } = await booked();
    setTestNow(addMinutes(MONDAY_10AM, 61));
    expect((await arrive(t.db, job.id, tradie.tradieId)).ok).toBe(true);
    expect(await active(job.id, "emergency")).toBeNull();
    expect(await reload(job)).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(await auditActions(t.db, job.id)).toContain("job.surcharge_dropped");
  });
});

describe("the step-down: nobody free within the hour", () => {
  it("texts the owner once after 10 minutes, and changes nothing by itself", async () => {
    const { property, owner } = await setup();
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property, { emergency: true });
    setTestNow(addMinutes(MONDAY_10AM, 9));
    expect(await stepDownEmergencies(t.db)).toBe(0);
    setTestNow(addMinutes(MONDAY_10AM, 10));
    expect(await stepDownEmergencies(t.db)).toBe(1);
    expect(await stepDownEmergencies(t.db)).toBe(0);
    const sent = await messagesTo(t.db, owner.user.phone!, "emergency_step_down");
    expect(sent.some((message) => (message.body ?? "").includes("Switch to within 4h and save NZ$100?"))).toBe(true);
    expect(sent.some((message) => (message.body ?? "").includes("we'll take NZ$100 off?"))).toBe(true);
    expect(await reload(job)).toMatchObject({ urgency: "emergency", ownerTotalCents: 37500 });
    expect(await auditActions(t.db, job.id)).toContain("job.step_down_offered");
  });

  it("runs from the timer", async () => {
    const { property } = await setup();
    await makeTradie(t.db, { slot: 1 });
    await logJob(t.db, property, { emergency: true });
    setTestNow(addMinutes(MONDAY_10AM, 11));
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db) });
    expect(report.emergency_step_down).toBe(1);
  });

  it("one tap makes it urgent: the urgent line replaces the emergency line, NZ$100 less, offered again as urgent", async () => {
    const { property } = await setup();
    const first = await makeTradie(t.db, { slot: 1 });
    const other = await makeTradie(t.db);
    const job = await logJob(t.db, property, { emergency: true });
    setTestNow(addMinutes(MONDAY_10AM, 10));
    await stepDownEmergencies(t.db);
    const result = await t.db.tx((tx) => switchToUrgent(tx, job.id, `owner:${job.ownerId}`));
    if (!result.ok) throw new Error(result.message);
    expect(result.savingCents).toBe(10000);
    const now = await reload(job);
    expect(now).toMatchObject({ urgency: "urgent", ownerTotalCents: 27500, tradieTotalCents: 23250, responseHours: 4, offerRound: 2 });
    expect(now.respondBy!.toISOString()).toBe(addMinutes(MONDAY_10AM, 10 + 240).toISOString());
    expect(await active(job.id, "emergency")).toBeNull();
    expect((await active(job.id, "urgent"))!.ownerCents).toBe(5000);
    // Round 2 is the urgent cascade: first choice on their own first.
    const round2 = (await offersFor(t.db, job.id)).filter((offer) => offer.round === 2);
    expect(round2.map((offer) => offer.tradie_id)).toEqual([first.tradieId]);
    expect(round2.map((offer) => offer.tradie_id)).not.toContain(other.tradieId);
    expect(await auditActions(t.db, job.id)).toContain("job.stepped_down");
    // A second tap does nothing.
    expect((await t.db.tx((tx) => switchToUrgent(tx, job.id, "owner:x"))).ok).toBe(false);
  });

  it("keeps the after-hours line when an emergency at 9pm is switched to urgent", async () => {
    setTestNow(MONDAY_9PM);
    const { property } = await setup();
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property, { emergency: true });
    expect(job.ownerTotalCents).toBe(51500);
    const result = await t.db.tx((tx) => switchToUrgent(tx, job.id, "owner:x"));
    expect(result.ok).toBe(true);
    expect(await reload(job)).toMatchObject({ ownerTotalCents: 41500 });
  });

  it("cannot be used once a tradie has taken it", async () => {
    const { property } = await setup();
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property, { emergency: true });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    setTestNow(addMinutes(MONDAY_10AM, 15));
    expect(await stepDownEmergencies(t.db)).toBe(0);
    expect((await t.db.tx((tx) => switchToUrgent(tx, job.id, "owner:x"))).ok).toBe(false);
  });
});

describe("each tradie's own hours decide who is offered a job", () => {
  const criteria = { market: "queenstown", trade: "plumber", licenceRequired: true, today: "2026-11-16", weekday: "mon" };

  it("offers only inside the window, on one of their days", async () => {
    await liveMarket(t.db);
    const day = await makeTradie(t.db, { hours: [7, 16.5], days: ["mon", "tue"] });
    const late = await makeTradie(t.db, { hours: [6, 22], days: ["mon"] });
    const ids = async (hour: number, weekday = "mon") => (await eligibleTradies(t.db, { ...criteria, weekday, hour })).map((c) => c.tradieId).sort();
    expect(await ids(10)).toEqual([day.tradieId, late.tradieId].sort());
    expect(await ids(16.5)).toEqual([late.tradieId]);
    expect(await ids(21.5)).toEqual([late.tradieId]);
    expect(await ids(22)).toEqual([]);
    expect(await ids(6.5)).toEqual([late.tradieId]);
    expect(await ids(10, "tue")).toEqual([day.tradieId]);
    expect(await ids(10, "sun")).toEqual([]);
  });

  it("sends an urgent job at 9pm only to a tradie whose hours reach 9pm", async () => {
    setTestNow(MONDAY_9PM);
    const { property } = await setup();
    await makeTradie(t.db, { slot: 1, hours: [7, 16.5] });
    const night = await makeTradie(t.db, { slot: 2, hours: [6, 22] });
    const job = await logJob(t.db, property, { urgent: true });
    expect((await offersFor(t.db, job.id)).map((offer) => offer.tradie_id)).toEqual([night.tradieId]);
  });

  it("checks and reads a tradie's hours", async () => {
    expect(() => checkWorkingHours(7, 16.5)).not.toThrow();
    expect(() => checkWorkingHours(17, 7)).toThrow();
    expect(() => checkWorkingHours(7.25, 16)).toThrow();
    const tradie = { daysAvailable: ["mon"], hoursFrom: 7, hoursTo: 17 };
    expect(insideWorkingHours(tradie, MONDAY_10AM, "Pacific/Auckland")).toBe(true);
    expect(insideWorkingHours(tradie, MONDAY_9PM, "Pacific/Auckland")).toBe(false);
  });

  it("saves the hours a tradie picks", async () => {
    await liveMarket(t.db);
    const tradie = await makeTradie(t.db);
    await updateTradie(t.db, tradie.tradieId, { hoursFrom: 6, hoursTo: 17 }, "test");
    expect(await getTradie(t.db, tradie.tradieId)).toMatchObject({ hoursFrom: 6, hoursTo: 17 });
  });
});

describe("Urgent and Emergency are offered only when someone is on (DECISIONS.md, 2026-11-26, third entry)", () => {
  it("works out when a tradie's hours next begin", () => {
    const weekdays = { daysAvailable: ["mon", "tue", "wed", "thu", "fri"], hoursFrom: 7, hoursTo: 16.5 };
    expect(hoursState(weekdays, MONDAY_10AM, "Pacific/Auckland")).toEqual({ onNow: true, nextFrom: null });
    // Monday 9pm: next is Tuesday 7am (2026-11-16T18:00Z).
    expect(hoursState(weekdays, MONDAY_9PM, "Pacific/Auckland").nextFrom!.toISOString()).toBe("2026-11-16T18:00:00.000Z");
    // Sunday 10am: next is Monday 7am (2026-11-22T18:00Z).
    expect(hoursState(weekdays, SUNDAY_10AM, "Pacific/Auckland").nextFrom!.toISOString()).toBe("2026-11-22T18:00:00.000Z");
    expect(combineCover([{ onNow: false, nextFrom: new Date(2) }, { onNow: false, nextFrom: new Date(1) }]).nextFrom!.getTime()).toBe(1);
  });

  it("shows Urgent and Emergency when a plumber is in their hours, and hides them when nobody is", async () => {
    const { property } = await setup();
    await makeTradie(t.db, { hours: [7, 16.5], days: ["mon", "tue", "wed", "thu", "fri"] });
    const day = (await reportFormData(t.db, property, "owner"))!;
    expect(day.cover.plumber).toEqual({ onNow: true, words: null });
    expect(day).toMatchObject({ emergencyMinutes: 60, emergencyCents: 15000 });

    setTestNow(MONDAY_9PM);
    const night = (await reportFormData(t.db, property, "owner"))!;
    expect(night.cover.plumber).toEqual({ onNow: false, words: "No one is on right now. We'll send this to tradies from 7am tomorrow." });
    // A trade with nobody at all.
    expect(night.cover.roofer!.onNow).toBe(false);
    expect(night.cover.roofer!.words).toBe("No one is on right now. Our team will arrange a tradie for you.");
  });

  it("refuses an urgent or emergency report when nobody is on, but never a standard one", async () => {
    const { property } = await setup();
    await makeTradie(t.db, { hours: [7, 16.5] });
    const item = await menuItem(t.db, "PL-01");
    expect(await rushRefusal(t.db, property, { menuItemId: item.id, urgent: false, emergency: true }, MONDAY_10AM)).toBeNull();
    expect(await rushRefusal(t.db, property, { menuItemId: item.id, urgent: true }, MONDAY_9PM)).toContain("No one is on right now");
    expect(await rushRefusal(t.db, property, { menuItemId: item.id, urgent: false }, MONDAY_9PM)).toBeNull();
  });

  it("hides Urgent and Emergency on a guest report's go-ahead when nobody is on", async () => {
    setTestNow(MONDAY_9PM);
    const { property } = await setup();
    await makeTradie(t.db, { hours: [7, 16.5] });
    const job = { menuItemId: (await menuItem(t.db, "PL-01")).id, trade: "plumber", licenceRequired: true };
    const prices = await goAheadPrices(t.db, property, job);
    expect(prices.urgent).toBeNull();
    expect(prices.emergency).toBeNull();
    expect(prices.noCover).toContain("7am tomorrow");
    expect(prices.standard!.ownerCents).toBe(22500);
    setTestNow(MONDAY_10AM);
    expect((await goAheadPrices(t.db, property, job)).emergency!.ownerCents).toBe(37500);
  });

  it("counts on the coverNow of any trade for a Not sure job", async () => {
    const { property } = await setup();
    await makeTradie(t.db, { trades: ["handyman"], licence: "none", hours: [7, 16.5] });
    const queenstown = (await getMarket(t.db, property.market))!;
    expect((await coverNow(t.db, queenstown, "other", MONDAY_10AM)).onNow).toBe(true);
    expect(noCoverWords({ onNow: false, nextFrom: null }, MONDAY_10AM, "Pacific/Auckland")).toContain("Our team will arrange");
  });
});

describe("after-hours cover, for the team", () => {
  it("counts tradies whose hours reach outside working hours, and on which days", () => {
    const rows = afterHoursCover(market, [
      { trades: ["plumber"], daysAvailable: ["mon", "tue"], hoursFrom: 6, hoursTo: 22 },
      { trades: ["plumber"], daysAvailable: ["mon", "sat"], hoursFrom: 7, hoursTo: 16.5 },
      { trades: ["electrician"], daysAvailable: ["mon", "tue", "wed", "thu", "fri"], hoursFrom: 7, hoursTo: 16.5 },
    ]);
    expect(rows.find((row) => row.trade === "plumber")).toMatchObject({ tradies: 2, days: ["mon", "tue", "sat"] });
    expect(rows.find((row) => row.trade === "electrician")).toMatchObject({ tradies: 0, days: [] });
  });
});
