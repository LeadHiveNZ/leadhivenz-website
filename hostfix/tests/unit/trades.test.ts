import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { acceptOffer, assignTradie, chooseTrade, reoffer } from "@/lib/dispatch/cascade";
import { cancelJob } from "@/lib/jobs/create";
import { reportFormData } from "@/lib/jobs/report-data";
import { getJobForStaff } from "@/lib/jobs/store";
import { listExceptions } from "@/lib/ops/exceptions";
import { canStillTake, updateTradie } from "@/lib/tradies/service";
import { testDb } from "./db";
import { auditActions, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, openExceptions, textsTo } from "./factory";

/**
 * The trades added on 24 Nov 2026 (DECISIONS.md, 2026-11-24): cleaning and nine more, building work only for an
 * LBP, and jobs nobody can match going to a person rather than to handymen.
 *
 * Amounts, worked by hand from seed/menu-queenstown.json:
 *   CL-02 "Turnover, entry or exit clean, 2 or 3 bedrooms": owner NZ$270 (27000), cleaner NZ$230 (23000).
 *   Urgent adds NZ$50 (5000) to the owner and 5000 less 15% (750) = 4250 to the cleaner: owner 32000, cleaner 27250.
 *   BL-02 "Deck boards replaced, up to 3": owner NZ$245 (24500), builder NZ$210 (21000).
 *   Off the menu: the call-out, NZ$225 (22500) held on the card, NZ$190 (19000) to the tradie.
 */

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function member() {
  await liveMarket(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  return { owner, property };
}

const job = async (jobId: string) => (await getJobForStaff(t.db, jobId))!;
const holds = async (jobId: string) => t.db.query<{ amount_cents: number }>("select amount_cents from public.card_holds where job_id = $1::uuid order by seq", [jobId]);

describe("cleaning", () => {
  it("offers a turnover clean to the first-choice cleaner at the menu payout, with the price held on the card", async () => {
    const { property } = await member();
    const cleaner = await makeTradie(t.db, { trades: ["cleaner"], licence: "none", slot: 1 });
    const handyman = await makeTradie(t.db, { trades: ["handyman"], licence: "none", slot: 1 });
    const clean = await logJob(t.db, property, { code: "CL-02" });
    expect(clean).toMatchObject({ status: "offering", trade: "cleaner", licenceRequired: false, ownerTotalCents: 27000, tradieTotalCents: 23000 });
    expect((await holds(clean.id)).map((hold) => hold.amount_cents)).toEqual([27000]);
    expect((await offersFor(t.db, clean.id)).map((offer) => offer.tradie_id)).toEqual([cleaner.tradieId]);
    expect(await textsTo(t.db, handyman.phone, "offer")).toHaveLength(0);
  });

  it("before today's check-in is the urgent add-on, not a separate price", async () => {
    const { property } = await member();
    await makeTradie(t.db, { trades: ["cleaner"], licence: "none", slot: 1 });
    const urgent = await logJob(t.db, property, { code: "CL-02", urgent: true });
    expect(urgent).toMatchObject({ urgency: "urgent", ownerTotalCents: 27000 + 5000, tradieTotalCents: 23000 + 4250 });
    expect((await holds(urgent.id)).map((hold) => hold.amount_cents)).toEqual([32000]);
  });
});

describe("building work only goes to an LBP", () => {
  it("is offered only to a builder with an LBP number on file", async () => {
    const { property } = await member();
    const noLbp = await makeTradie(t.db, { trades: ["builder"], licence: "none", slot: 1 });
    const withLbp = await makeTradie(t.db, { trades: ["builder"], licence: "none", slot: 2 });
    await updateTradie(t.db, withLbp.tradieId, { lbpNumber: "BP 123456" }, "test");
    const deck = await logJob(t.db, property, { code: "BL-02" });
    expect(deck).toMatchObject({ trade: "builder", ownerTotalCents: 24500, tradieTotalCents: 21000 });
    // The first choice has no LBP number, so the backup is the first one asked.
    expect((await offersFor(t.db, deck.id)).map((offer) => [offer.tradie_id, offer.stage])).toEqual([[withLbp.tradieId, 2]]);
    expect(await textsTo(t.db, noLbp.phone, "offer")).toHaveLength(0);
  });

  it("is checked again when accepting and when our team assigns it", async () => {
    const { property } = await member();
    const builder = await makeTradie(t.db, { trades: ["builder"], licence: "none", slot: 1 });
    const other = await makeTradie(t.db, { trades: ["builder"], licence: "none" });
    await updateTradie(t.db, builder.tradieId, { lbpNumber: "BP 123456" }, "test");
    const deck = await logJob(t.db, property, { code: "BL-02" });
    const [offer] = await offersFor(t.db, deck.id);
    const today = { market: "queenstown", trade: "builder", licenceRequired: false, today: "2026-11-16" };
    expect(await canStillTake(t.db, builder.tradieId, today)).toBe(true);
    expect(await canStillTake(t.db, other.tradieId, today)).toBe(false);
    await updateTradie(t.db, builder.tradieId, { lbpNumber: null }, "test");
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("not_eligible");
    expect((await t.db.tx((tx) => assignTradie(tx, deck.id, other.tradieId, "staff:test"))).result).toBe("not_eligible");
    expect((await job(deck.id)).tradieId).toBeNull();
  });
});

describe("a job not on the menu, when the owner is not sure of the trade", () => {
  it("goes to our team's queue, not to handymen, with the call-out held", async () => {
    const { owner, property } = await member();
    const handyman = await makeTradie(t.db, { trades: ["handyman"], licence: "none", slot: 1 });
    const notSure = await logJob(t.db, property, { menuItemId: null, offMenuTrade: "other", offMenuTitle: "Strange smell in the laundry" });
    expect(notSure).toMatchObject({ status: "unfilled", trade: "other", licenceRequired: false, offMenu: true, ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect((await holds(notSure.id)).map((hold) => hold.amount_cents)).toEqual([22500]);
    expect(await offersFor(t.db, notSure.id)).toHaveLength(0);
    expect(await textsTo(t.db, handyman.phone)).toHaveLength(0);
    expect(await openExceptions(t.db, notSure.id)).toEqual(["trade_needed"]);
    const item = (await listExceptions(t.db)).find((candidate) => candidate.jobId === notSure.id)!;
    expect(item.summary).toContain("the owner was not sure which trade \"Strange smell in the laundry\"");
    // The owner is not texted that nobody took it: the page says our team is arranging a tradie.
    expect(await textsTo(t.db, owner.user.phone!, "still_arranging")).toHaveLength(0);
    expect(await auditActions(t.db, notSure.id)).toEqual(["job.created", "hold.placed", "job.dispatched", "job.trade_needed", "exception.raised"]);
  });

  it("is \"Not sure\" when no trade, or one we do not know, is given", async () => {
    const { property } = await member();
    const none = await logJob(t.db, property, { menuItemId: null, offMenuTitle: "Something rattling in the roof" });
    const unknown = await logJob(t.db, await makeProperty(t.db, property.ownerId), { menuItemId: null, offMenuTrade: "astronaut", offMenuTitle: "Satellite dish fell off" });
    expect([(await job(none.id)).trade, (await job(unknown.id)).trade]).toEqual(["other", "other"]);
  });

  it("goes out to the trade our team picks with one tap, with that trade's licence rule, at the same price", async () => {
    const { property } = await member();
    const plumber = await makeTradie(t.db, { slot: 1 });
    const notSure = await logJob(t.db, property, { menuItemId: null, offMenuTitle: "Water under the house" });
    const chosen = await t.db.tx((tx) => chooseTrade(tx, notSure.id, "plumber", "staff:test"));
    expect(chosen).toEqual({ ok: true, outcome: "offered" });
    expect(await job(notSure.id)).toMatchObject({ status: "offering", trade: "plumber", licenceRequired: true, ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect((await offersFor(t.db, notSure.id)).map((offer) => [offer.tradie_id, offer.stage, offer.round])).toEqual([[plumber.tradieId, 1, 2]]);
    expect(await openExceptions(t.db, notSure.id)).toEqual([]);
    expect(await auditActions(t.db, notSure.id)).toContain("job.trade_chosen");
  });

  it("cannot be sent to \"Not sure\" again or to a trade we do not know, and is left alone once a tradie has it", async () => {
    const { property } = await member();
    const cleaner = await makeTradie(t.db, { trades: ["cleaner"], licence: "none", slot: 1 });
    const notSure = await logJob(t.db, property, { menuItemId: null, offMenuTitle: "Mud through the whole house" });
    expect(await t.db.tx((tx) => chooseTrade(tx, notSure.id, "other", "staff:test"))).toEqual({ ok: false, message: "Choose one of the trades." });
    expect(await t.db.tx((tx) => chooseTrade(tx, notSure.id, "astronaut", "staff:test"))).toEqual({ ok: false, message: "Choose one of the trades." });
    await t.db.tx((tx) => chooseTrade(tx, notSure.id, "cleaner", "staff:test"));
    const [offer] = await offersFor(t.db, notSure.id);
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("accepted");
    expect(await t.db.tx((tx) => chooseTrade(tx, notSure.id, "handyman", "staff:test"))).toEqual({ ok: false, message: "This job is not waiting for a tradie any more." });
    expect((await job(notSure.id)).tradieId).toBe(cleaner.tradieId);
  });

  it("starting the offers again asks our team again, and cancelling clears the queue item", async () => {
    const { property } = await member();
    const notSure = await logJob(t.db, property, { menuItemId: null, offMenuTitle: "Door to the deck will not open" });
    expect(await t.db.tx((tx) => reoffer(tx, notSure.id, "staff:test"))).toBe("unfilled");
    expect(await openExceptions(t.db, notSure.id)).toEqual(["trade_needed"]);
    expect((await cancelJob(t.db, notSure.id, { actor: "staff:test", staff: true }, "Owner sorted it")).ok).toBe(true);
    expect(await openExceptions(t.db, notSure.id)).toEqual([]);
  });

  it("a trade the owner picks still goes straight out to that trade", async () => {
    const { property } = await member();
    const handyman = await makeTradie(t.db, { trades: ["handyman"], licence: "none", slot: 1 });
    const picked = await logJob(t.db, property, { menuItemId: null, offMenuTrade: "handyman", offMenuTitle: "Gate hinge snapped" });
    expect(picked).toMatchObject({ status: "offering", trade: "handyman" });
    expect((await offersFor(t.db, picked.id)).map((offer) => offer.tradie_id)).toEqual([handyman.tradieId]);
  });

  it("the form lists every trade, then \"Not sure\"", async () => {
    const { property } = await member();
    const data = (await reportFormData(t.db, property, "owner"))!;
    const keys = data.offMenuTrades.map((trade) => trade.key);
    expect(keys).toHaveLength(18);
    expect(keys.at(-1)).toBe("other");
    expect(data.offMenuTrades.at(-1)!.label).toBe("Not sure");
    expect(keys).toEqual(expect.arrayContaining(["cleaner", "window_cleaner", "gardener", "builder", "painter", "roofer", "pest_control", "carpet_cleaner", "pool_spa", "drainage_septic"]));
    // No two choices read the same.
    expect(new Set(data.offMenuTrades.map((trade) => trade.label)).size).toBe(18);
  });
});

describe("a trade nobody in the market does yet", () => {
  it("goes to the queue at once, saying so, instead of being offered to anyone else", async () => {
    const { property } = await member();
    const plumber = await makeTradie(t.db, { slot: 1 });
    const gutters = await logJob(t.db, property, { code: "RF-01" });
    expect(gutters).toMatchObject({ status: "unfilled", trade: "roofer" });
    expect(await offersFor(t.db, gutters.id)).toHaveLength(0);
    expect(await textsTo(t.db, plumber.phone)).toHaveLength(0);
    expect(await openExceptions(t.db, gutters.id)).toEqual(["nobody_accepted"]);
    const item = (await listExceptions(t.db)).find((candidate) => candidate.jobId === gutters.id)!;
    expect(item.summary).toContain("no approved tradie in Queenstown is down for \"Roofing and gutters\" yet");
    // Our team can send it to a trade that has someone: the gutters to the handyman, say.
    const handyman = await makeTradie(t.db, { trades: ["handyman"], licence: "none", slot: 1 });
    expect(await t.db.tx((tx) => chooseTrade(tx, gutters.id, "handyman", "staff:test"))).toEqual({ ok: true, outcome: "offered" });
    expect((await offersFor(t.db, gutters.id)).map((offer) => offer.tradie_id)).toEqual([handyman.tradieId]);
    expect(await openExceptions(t.db, gutters.id)).toEqual([]);
  });
});
