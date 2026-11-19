import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer, advanceCascade, assignTradie, expireDueOffers, passOffer, reoffer } from "@/lib/dispatch/cascade";
import { approveGuestReport, cancelJob, createJob } from "@/lib/jobs/create";
import { getJobForStaff } from "@/lib/jobs/store";
import { listExceptions, raiseException } from "@/lib/ops/exceptions";
import { testDb } from "./db";
import { auditActions, liveMarket, logJob, makeOwner, makeProperty, makeTradie, menuItem, MONDAY_10AM, MONDAY_9PM, offersFor, openExceptions, textsTo } from "./factory";

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

/** An owner with one member property, the starting point for nearly every test here. */
async function member(tier: "essential" | "priority" = "essential") {
  await liveMarket(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId, { tier });
  return { owner, property };
}

const status = async (jobId: string) => (await getJobForStaff(t.db, jobId))!;

describe("the offer cascade", () => {
  it("offers the job to the first-choice tradie only, by text, with the pay and a one-tap link", async () => {
    const { property } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    const backup = await makeTradie(t.db, { slot: 2 });
    const other = await makeTradie(t.db);

    const job = await logJob(t.db, property, { code: "PL-01" });
    expect(job.status).toBe("offering");
    expect(job.stage).toBe(1);

    const offers = await offersFor(t.db, job.id);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ tradie_id: first.tradieId, stage: 1, status: "pending" });
    expect(new Date(offers[0]!.expires_at).getTime()).toBe(addMinutes(MONDAY_10AM, 15).getTime());

    const sent = await textsTo(t.db, first.phone, "offer");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toContain("Unblock a toilet");
    expect(sent[0]!.body).toContain("Frankton");
    expect(sent[0]!.body).toContain("Pays NZ$187");
    expect(sent[0]!.body).toContain("Yours for 15 min");
    expect(sent[0]!.body).toMatch(/\/o\/\d+\.[A-Za-z0-9]{12}/);
    // The street address stays private until someone accepts.
    expect(sent[0]!.body).not.toContain("Lake Esplanade");
    expect(await textsTo(t.db, backup.phone)).toHaveLength(0);
    expect(await textsTo(t.db, other.phone)).toHaveLength(0);
  });

  it("promises a tradie on site within 24 hours of the job being logged", async () => {
    const { property } = await member();
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    expect(job.respondBy?.getTime()).toBe(MONDAY_10AM.getTime() + 24 * 60 * 60 * 1000);
    expect(job.dispatchedAt?.getTime()).toBe(MONDAY_10AM.getTime());
  });

  it("NO REPLY: after 15 minutes the job rolls to the backup", async () => {
    const { property } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    const backup = await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);

    // 14 minutes in: still with the first choice.
    setTestNow(addMinutes(MONDAY_10AM, 14));
    expect(await expireDueOffers(t.db)).toBe(0);
    expect(await textsTo(t.db, backup.phone)).toHaveLength(0);

    // 15 minutes in: it moves on.
    setTestNow(addMinutes(MONDAY_10AM, 15));
    expect(await expireDueOffers(t.db)).toBe(1);
    const offers = await offersFor(t.db, job.id);
    expect(offers.map((o) => [o.tradie_id, o.stage, o.status])).toEqual([
      [first.tradieId, 1, "expired"],
      [backup.tradieId, 2, "pending"],
    ]);
    expect(await textsTo(t.db, backup.phone, "offer")).toHaveLength(1);
    expect((await status(job.id)).stage).toBe(2);
  });

  it("PASS: the job rolls to the backup straight away", async () => {
    const { property } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    const backup = await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);

    setTestNow(addMinutes(MONDAY_10AM, 2));
    expect(await t.db.tx((tx) => passOffer(tx, offer!.id, "link"))).toBe("passed");

    const offers = await offersFor(t.db, job.id);
    expect(offers.map((o) => [o.tradie_id, o.status])).toEqual([
      [first.tradieId, "passed"],
      [backup.tradieId, "pending"],
    ]);
    // The backup's 15 minutes start from the pass, not from the original offer.
    expect(new Date(offers[1]!.expires_at).getTime()).toBe(addMinutes(MONDAY_10AM, 17).getTime());
  });

  it("then goes to every other approved tradie in the trade at once, and the first to accept gets it", async () => {
    const { property, owner } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    const backup = await makeTradie(t.db, { slot: 2 });
    const a = await makeTradie(t.db);
    const b = await makeTradie(t.db);
    const electrician = await makeTradie(t.db, { trades: ["electrician"] });
    const job = await logJob(t.db, property);

    setTestNow(addMinutes(MONDAY_10AM, 15));
    await expireDueOffers(t.db);
    setTestNow(addMinutes(MONDAY_10AM, 30));
    await expireDueOffers(t.db);

    const offers = await offersFor(t.db, job.id);
    expect(offers.filter((o) => o.stage === 3).map((o) => o.tradie_id).sort()).toEqual([a.tradieId, b.tradieId].sort());
    expect((await textsTo(t.db, a.phone, "offer"))[0]!.body).toContain("First to accept gets it");
    expect(await textsTo(t.db, electrician.phone)).toHaveLength(0);

    const offerA = offers.find((o) => o.tradie_id === a.tradieId)!;
    const offerB = offers.find((o) => o.tradie_id === b.tradieId)!;
    const won = await t.db.tx((tx) => acceptOffer(tx, offerA.id, "link"));
    expect(won.result).toBe("accepted");
    const lost = await t.db.tx((tx) => acceptOffer(tx, offerB.id, "link"));
    expect(lost.result).toBe("taken");

    const done = await status(job.id);
    expect(done).toMatchObject({ status: "accepted", tradieId: a.tradieId });
    // The two network offers go out at the same moment, so their row order is not fixed: check each by tradie.
    const after = await offersFor(t.db, job.id);
    expect(after.filter((o) => o.stage < 3).map((o) => o.status)).toEqual(["expired", "expired"]);
    expect(after.find((o) => o.tradie_id === a.tradieId)!.status).toBe("accepted");
    expect(after.find((o) => o.tradie_id === b.tradieId)!.status).toBe("superseded");
    expect(after).toHaveLength(4);
    expect(await textsTo(t.db, owner.user.phone!, "job_booked")).toHaveLength(1);
    expect(first.tradieId).not.toBe(backup.tradieId);
  });

  it("NOBODY AVAILABLE: with no tradie in the trade the job goes straight to the dispatcher", async () => {
    const { property, owner } = await member();
    await makeTradie(t.db, { trades: ["electrician"], slot: 1 });
    const job = await logJob(t.db, property, { code: "PL-01" });

    expect(job).toMatchObject({ status: "unfilled", stage: 4 });
    expect(await offersFor(t.db, job.id)).toHaveLength(0);
    expect(await openExceptions(t.db, job.id)).toEqual(["nobody_accepted"]);
    // The owner is told we are on it. They are never told "nobody wants your job".
    const told = await textsTo(t.db, owner.user.phone!, "still_arranging");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain("Our team is on it");
    expect(await auditActions(t.db, job.id)).toEqual(["job.created", "job.dispatched", "job.unfilled", "exception.raised"]);
  });

  it("NOBODY ACCEPTS: once everyone has passed or run out of time it goes to the dispatcher", async () => {
    const { property } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    await makeTradie(t.db, { slot: 2 });
    await makeTradie(t.db);
    const job = await logJob(t.db, property);

    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => passOffer(tx, offer!.id, "link"));
    setTestNow(addMinutes(MONDAY_10AM, 15));
    await expireDueOffers(t.db);
    expect((await status(job.id)).stage).toBe(3);
    setTestNow(addMinutes(MONDAY_10AM, 30));
    await expireDueOffers(t.db);

    expect(await status(job.id)).toMatchObject({ status: "unfilled", stage: 4, tradieId: null });
    expect(await openExceptions(t.db, job.id)).toEqual(["nobody_accepted"]);
    expect((await offersFor(t.db, job.id)).map((o) => o.status)).toEqual(["passed", "expired", "expired"]);
    expect(first.tradieId).toBeTruthy();
  });

  it("skips a stage that has nobody in it instead of waiting 15 minutes for no one", async () => {
    const { property } = await member();
    const backup = await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    const offers = await offersFor(t.db, job.id);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ tradie_id: backup.tradieId, stage: 2 });
  });

  it("never offers the same tradie twice in one round", async () => {
    const { property } = await member();
    const only = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    setTestNow(addMinutes(MONDAY_10AM, 15));
    await expireDueOffers(t.db);
    expect(await status(job.id)).toMatchObject({ status: "unfilled" });
    expect(await textsTo(t.db, only.phone, "offer")).toHaveLength(1);
  });

  it("does nothing while an offer is still live, however often the timer runs", async () => {
    const { property } = await member();
    await makeTradie(t.db, { slot: 1 });
    await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    for (let i = 0; i < 3; i += 1) {
      expect(await t.db.tx((tx) => advanceCascade(tx, job.id))).toBe("waiting");
    }
    expect(await offersFor(t.db, job.id)).toHaveLength(1);
  });
});

describe("accepting", () => {
  it("books the tradie, tells them the address, tells the owner, and clears the dispatcher's queue", async () => {
    const { property, owner } = await member();
    const tradie = await makeTradie(t.db, { slot: 1, name: "Wakatipu Plumbing" });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);

    setTestNow(addMinutes(MONDAY_10AM, 4));
    const result = await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    expect(result.result).toBe("accepted");

    const booked = await status(job.id);
    expect(booked).toMatchObject({ status: "accepted", tradieId: tradie.tradieId });
    expect(booked.acceptedAt?.getTime()).toBe(addMinutes(MONDAY_10AM, 4).getTime());

    const yours = await textsTo(t.db, tradie.phone, "job_yours");
    expect(yours).toHaveLength(1);
    expect(yours[0]!.body).toContain("Lake Esplanade");
    const told = await textsTo(t.db, owner.user.phone!, "job_booked");
    expect(told[0]!.body).toContain("Wakatipu Plumbing is booked");
    expect(told[0]!.body).toContain("10am tomorrow");
    expect(await auditActions(t.db, job.id)).toEqual(["job.created", "job.dispatched", "job.offered", "job.accepted"]);
  });

  it("tapping Accept twice is harmless", async () => {
    const { property, owner } = await member();
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("accepted");
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("already_yours");
    expect(await textsTo(t.db, owner.user.phone!, "job_booked")).toHaveLength(1);
  });

  it("a tradie whose 15 minutes ran out can still take the job if nobody else has", async () => {
    const { property } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    const [firstOffer] = await offersFor(t.db, job.id);
    setTestNow(addMinutes(MONDAY_10AM, 16));
    await expireDueOffers(t.db);

    const late = await t.db.tx((tx) => acceptOffer(tx, firstOffer!.id, "link"));
    expect(late.result).toBe("accepted");
    expect(await status(job.id)).toMatchObject({ tradieId: first.tradieId });
    // The backup's live offer is withdrawn.
    expect((await offersFor(t.db, job.id)).map((o) => o.status)).toEqual(["accepted", "superseded"]);
  });

  it("a tradie who passed cannot change their mind", async () => {
    const { property } = await member();
    await makeTradie(t.db, { slot: 1 });
    await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => passOffer(tx, offer!.id, "link"));
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("passed");
  });

  it("a cancelled job cannot be accepted, and the tradie's offer is withdrawn", async () => {
    const { property, owner } = await member();
    await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);
    expect((await cancelJob(t.db, job.id, { actor: `owner:${owner.ownerId}` }, "Fixed it myself")).ok).toBe(true);
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("gone");
    expect((await offersFor(t.db, job.id))[0]!.status).toBe("superseded");
    expect(await openExceptions(t.db, job.id)).toEqual([]);
  });

  it("an accept from the queue clears the 'nobody accepted' flag", async () => {
    const { property } = await member();
    const only = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);
    setTestNow(addMinutes(MONDAY_10AM, 15));
    await expireDueOffers(t.db);
    expect(await openExceptions(t.db, job.id)).toEqual(["nobody_accepted"]);

    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("accepted");
    expect(await status(job.id)).toMatchObject({ status: "accepted", tradieId: only.tradieId });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
  });
});

describe("licensed work", () => {
  it("is never offered to a tradie with no licence on file, or one that has expired", async () => {
    const { property } = await member();
    const noLicence = await makeTradie(t.db, { slot: 1, licence: "none" });
    const expired = await makeTradie(t.db, { slot: 2, licence: "expired" });
    const licensed = await makeTradie(t.db);
    const job = await logJob(t.db, property, { code: "PL-01" });

    const offers = await offersFor(t.db, job.id);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ tradie_id: licensed.tradieId, stage: 3 });
    expect(await textsTo(t.db, noLicence.phone)).toHaveLength(0);
    expect(await textsTo(t.db, expired.phone)).toHaveLength(0);
  });

  it("counts a licence that runs out today as valid, and one that ran out yesterday as not", async () => {
    const { property } = await member();
    const today = await makeTradie(t.db, { slot: 1, licence: "none" });
    const yesterday = await makeTradie(t.db, { slot: 2, licence: "none" });
    await t.db.query("insert into public.tradie_licences (tradie_id, trade, licence_number, expires_on) values ($1::uuid, 'plumber', 'A1', '2026-11-16')", [today.tradieId]);
    await t.db.query("insert into public.tradie_licences (tradie_id, trade, licence_number, expires_on) values ($1::uuid, 'plumber', 'B2', '2026-11-15')", [yesterday.tradieId]);
    const job = await logJob(t.db, property, { code: "PL-01" });
    const offers = await offersFor(t.db, job.id);
    expect(offers.map((o) => o.tradie_id)).toEqual([today.tradieId]);
  });

  it("needs a licence for that trade, not just any licence", async () => {
    const { property } = await member();
    const both = await makeTradie(t.db, { trades: ["electrician", "plumber"], licence: "valid" });
    const job = await logJob(t.db, property, { code: "PL-01" });
    // Their licence on file is for electrical work (the first trade listed), so plumbing is not offered.
    expect(await offersFor(t.db, job.id)).toHaveLength(0);
    expect(job.status).toBe("unfilled");
    expect(both.tradieId).toBeTruthy();
  });

  it("does not apply to work that needs no licence", async () => {
    const { property } = await member();
    const handyman = await makeTradie(t.db, { trades: ["handyman"], licence: "none", slot: 1 });
    const job = await logJob(t.db, property, { code: "HM-01" });
    expect((await offersFor(t.db, job.id)).map((o) => o.tradie_id)).toEqual([handyman.tradieId]);
  });

  it("is checked again at the moment of accepting", async () => {
    const { property } = await member();
    const tradie = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.query("update public.tradie_licences set expires_on = '2026-11-01' where tradie_id = $1::uuid", [tradie.tradieId]);
    expect((await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"))).result).toBe("not_eligible");
    expect((await status(job.id)).tradieId).toBeNull();
  });

  it("cannot be overridden by the dispatcher", async () => {
    const { property } = await member();
    const unlicensed = await makeTradie(t.db, { licence: "none" });
    const job = await logJob(t.db, property, { code: "PL-01" });
    const result = await t.db.tx((tx) => assignTradie(tx, job.id, unlicensed.tradieId, "staff:test"));
    expect(result.result).toBe("not_eligible");
    expect((await status(job.id)).tradieId).toBeNull();
  });
});

describe("who is offered a job", () => {
  it("leaves out tradies who are waiting for approval, paused, removed or cannot be paid yet", async () => {
    const { property } = await member();
    await makeTradie(t.db, { approved: false });
    await makeTradie(t.db, { payouts: false });
    const paused = await makeTradie(t.db);
    await t.db.query("update public.tradies set status = 'paused' where id = $1::uuid", [paused.tradieId]);
    const good = await makeTradie(t.db);
    const job = await logJob(t.db, property);
    expect((await offersFor(t.db, job.id)).map((o) => o.tradie_id)).toEqual([good.tradieId]);
  });

  it("offers an after-hours job only to tradies who take after-hours work", async () => {
    setTestNow(MONDAY_9PM);
    const { property } = await member();
    await makeTradie(t.db, { slot: 1, afterHours: false });
    const night = await makeTradie(t.db, { slot: 2, afterHours: true });
    const job = await logJob(t.db, property, { urgent: true });
    expect(job.afterHours).toBe(true);
    expect((await offersFor(t.db, job.id)).map((o) => o.tradie_id)).toEqual([night.tradieId]);
  });

  it("offers an urgent job only to tradies who work that day", async () => {
    const { property } = await member();
    await makeTradie(t.db, { slot: 1, days: ["tue", "wed"] });
    const monday = await makeTradie(t.db, { slot: 2, days: ["mon"] });
    const job = await logJob(t.db, property, { urgent: true });
    expect((await offersFor(t.db, job.id)).map((o) => o.tradie_id)).toEqual([monday.tradieId]);
  });

  it("offers a normal job whatever day it is, because it can be done tomorrow", async () => {
    const { property } = await member();
    const tuesdays = await makeTradie(t.db, { slot: 1, days: ["tue"] });
    const job = await logJob(t.db, property);
    expect((await offersFor(t.db, job.id)).map((o) => o.tradie_id)).toEqual([tuesdays.tradieId]);
  });
});

describe("the dispatcher's tools", () => {
  it("can give an unfilled job to a tradie they have phoned", async () => {
    const { property, owner } = await member();
    const tradie = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    setTestNow(addMinutes(MONDAY_10AM, 20));
    await expireDueOffers(t.db);
    expect((await status(job.id)).status).toBe("unfilled");

    const result = await t.db.tx((tx) => assignTradie(tx, job.id, tradie.tradieId, "staff:va"));
    expect(result.result).toBe("accepted");
    expect(await status(job.id)).toMatchObject({ status: "accepted", tradieId: tradie.tradieId });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    expect(await textsTo(t.db, owner.user.phone!, "job_booked")).toHaveLength(1);
    const accepted = await t.db.query<{ actor: string; detail: { via: string } }>("select actor, detail from public.audit_log where entity_id = $1 and action = 'job.accepted'", [job.id]);
    expect(accepted[0]).toMatchObject({ actor: "staff:va", detail: { via: "staff" } });
  });

  it("can start the offers again, which asks everyone afresh from the first choice", async () => {
    const { property } = await member();
    const first = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    setTestNow(addMinutes(MONDAY_10AM, 15));
    await expireDueOffers(t.db);
    expect((await status(job.id)).status).toBe("unfilled");

    setTestNow(addMinutes(MONDAY_10AM, 40));
    expect(await t.db.tx((tx) => reoffer(tx, job.id, "staff:va"))).toBe("offered");
    const offers = await offersFor(t.db, job.id);
    expect(offers.map((o) => [o.tradie_id, o.round, o.status])).toEqual([
      [first.tradieId, 1, "expired"],
      [first.tradieId, 2, "pending"],
    ]);
    expect(await status(job.id)).toMatchObject({ status: "offering", stage: 1, offerRound: 2 });
    expect(await textsTo(t.db, first.phone, "offer")).toHaveLength(2);
  });
});

describe("reports from guests and cleaners", () => {
  it("a cleaner's report goes straight to tradies and the owner is told the price", async () => {
    const { property, owner } = await member();
    await makeTradie(t.db, { slot: 1 });
    const item = await menuItem(t.db, "PL-01");
    const result = await createJob(t.db, {
      property, reportedBy: "team", reporterName: "Sam the cleaner", reporterPhone: "+64225550001", menuItemId: item.id, description: "Upstairs toilet",
      urgent: false, uploadIds: [], uploader: `report:${property.id}`, actor: `report:${property.id}`,
    });
    expect(result.ok && result.job.status).toBe("offering");
    const told = await textsTo(t.db, owner.user.phone!, "job_logged");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain("Sam the cleaner logged");
    expect(told[0]!.body).toContain("NZ$220");
  });

  it("a guest's report waits for the owner's go-ahead: nobody is offered anything and no clock is running", async () => {
    const { property, owner } = await member();
    const tradie = await makeTradie(t.db, { slot: 1 });
    const item = await menuItem(t.db, "PL-01");
    const result = await createJob(t.db, {
      property, reportedBy: "guest", reporterName: "Gina Guest", reporterPhone: null, menuItemId: item.id, description: "",
      urgent: true, uploadIds: [], uploader: `report:${property.id}`, actor: `report:${property.id}`,
    });
    if (!result.ok) throw new Error("expected a job");
    expect(result.needsOwner).toBe(true);
    expect(result.job).toMatchObject({ status: "awaiting_owner", urgency: "standard", respondBy: null, dispatchedAt: null });
    expect(result.job.description).toContain("Guest says this is urgent");
    expect(await offersFor(t.db, result.job.id)).toHaveLength(0);
    expect(await textsTo(t.db, tradie.phone)).toHaveLength(0);
    expect((await textsTo(t.db, owner.user.phone!, "guest_report"))[0]!.body).toMatch(/\/j\/\d+\.[A-Za-z0-9]{12}/);

    // The owner says yes, as urgent, an hour later. The promise runs from now.
    setTestNow(addMinutes(MONDAY_10AM, 60));
    const approved = await approveGuestReport(t.db, result.job.id, { urgent: true }, `owner:${owner.ownerId}`);
    expect(approved).toMatchObject({ status: "offering", urgency: "urgent", ownerTotalCents: 22000 + 8000 });
    expect(approved!.respondBy?.getTime()).toBe(addMinutes(MONDAY_10AM, 60 + 4 * 60).getTime());
    expect(await textsTo(t.db, tradie.phone, "offer")).toHaveLength(1);
  });

  it("a guest's report goes straight out when the owner has switched that on, but never as urgent", async () => {
    const { property } = await member();
    await makeTradie(t.db, { slot: 1 });
    await t.db.query("update public.properties set guest_auto_dispatch = true where id = $1::uuid", [property.id]);
    const item = await menuItem(t.db, "PL-01");
    const result = await createJob(t.db, {
      property: { ...property, guestAutoDispatch: true }, reportedBy: "guest", reporterName: null, reporterPhone: null, menuItemId: item.id, description: "",
      urgent: true, uploadIds: [], uploader: `report:${property.id}`, actor: `report:${property.id}`,
    });
    if (!result.ok) throw new Error("expected a job");
    expect(result.job).toMatchObject({ status: "offering", urgency: "standard", ownerTotalCents: 22000 });
  });

  it("the same problem reported twice is one job, not two call-outs", async () => {
    const { property } = await member();
    await makeTradie(t.db, { slot: 1 });
    const first = await logJob(t.db, property, { code: "PL-01" });
    const item = await menuItem(t.db, "PL-01");
    const again = await createJob(t.db, {
      property, reportedBy: "guest", reporterName: null, reporterPhone: null, menuItemId: item.id, description: "",
      urgent: false, uploadIds: [], uploader: `report:${property.id}`, actor: `report:${property.id}`,
    });
    expect(again).toMatchObject({ ok: false, reason: "duplicate", existingJobId: first.id });
    // A different problem at the same property is a new job.
    expect((await logJob(t.db, property, { code: "EL-01" })).id).not.toBe(first.id);
  });

  it("jobs cannot be logged for a property that is not a paying member", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const notYet = await makeProperty(t.db, owner.ownerId, { member: false });
    const item = await menuItem(t.db, "PL-01");
    const base = { reportedBy: "owner" as const, reporterName: null, reporterPhone: null, menuItemId: item.id, description: "", urgent: false, uploadIds: [], uploader: "x", actor: "x" };
    expect(await createJob(t.db, { ...base, property: notYet })).toMatchObject({ ok: false, reason: "not_member" });

    const lapsed = await makeProperty(t.db, owner.ownerId);
    await t.db.query("update public.properties set status = 'past_due' where id = $1::uuid", [lapsed.id]);
    const result = await createJob(t.db, { ...base, property: { ...lapsed, status: "past_due" } });
    expect(result).toMatchObject({ ok: false, reason: "not_member" });
    expect(!result.ok && result.message).toContain("did not go through");
  });
});

describe("the dispatcher's queue", () => {
  it("puts jobs with a promised time running first, soonest first, then everything else, oldest first", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    // Nobody can take either job, so both go straight to the queue with their promised times.
    const later = await logJob(t.db, property, { code: "PL-01" });
    setTestNow(addMinutes(MONDAY_10AM, 5));
    const sooner = await logJob(t.db, property, { code: "EL-01", urgent: true });
    setTestNow(addMinutes(MONDAY_10AM, 10));
    await raiseException(t.db, { kind: "referral_due", summary: "Pay a reward", dedupeKey: "test:referral" });
    setTestNow(addMinutes(MONDAY_10AM, 20));
    await raiseException(t.db, { kind: "payment_failed", summary: "A card was declined", jobId: later.id, dedupeKey: "test:payment" });

    const queue = await listExceptions(t.db, { status: "open" });
    expect(queue.map((item) => `${item.kind}:${item.jobId === sooner.id ? "urgent job" : item.jobId === later.id ? "standard job" : "no job"}`)).toEqual([
      "nobody_accepted:urgent job",
      "nobody_accepted:standard job",
      "referral_due:no job",
      "payment_failed:standard job",
    ]);
  });
});
