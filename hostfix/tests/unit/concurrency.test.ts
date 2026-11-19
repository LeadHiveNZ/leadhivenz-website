import { afterEach, beforeEach, describe, expect, inject, it } from "vitest";
import { chargeJob, releaseDuePayouts } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer, expireDueOffers } from "@/lib/dispatch/cascade";
import { getJobForStaff } from "@/lib/jobs/store";
import { completeJob } from "@/lib/jobs/work";
import { testDb } from "./db";
import { arrive, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, photo } from "./factory";

/**
 * THINGS HAPPENING AT THE SAME MOMENT.
 *
 * These need a real Postgres server with several connections, so they only
 * run under "npm run test:db". The copy of Postgres inside the app does one
 * thing at a time and cannot show a race.
 */
const real = inject("testDatabase").mode === "postgres";
const t = testDb("fresh");

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

describe.skipIf(!real)("at the same moment", () => {
  it("six tradies tap Accept together: exactly one gets the job", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    for (let i = 0; i < 6; i += 1) await makeTradie(t.db);
    const job = await logJob(t.db, property);
    const offers = await offersFor(t.db, job.id);
    expect(offers).toHaveLength(6);

    const results = await Promise.all(offers.map((offer) => t.db.tx((tx) => acceptOffer(tx, offer.id, "link"))));
    expect(results.filter((r) => r.result === "accepted")).toHaveLength(1);
    expect(results.filter((r) => r.result === "taken")).toHaveLength(5);

    const after = await offersFor(t.db, job.id);
    expect(after.filter((o) => o.status === "accepted")).toHaveLength(1);
    expect((await getJobForStaff(t.db, job.id))!.tradieId).toBe(after.find((o) => o.status === "accepted")!.tradie_id);
    const audit = await t.db.query("select 1 from public.audit_log where entity_id = $1 and action = 'job.accepted'", [job.id]);
    expect(audit).toHaveLength(1);
  });

  it("the timer and a tap arrive together: the job is not offered on and accepted at once", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const first = await makeTradie(t.db, { slot: 1 });
    await makeTradie(t.db, { slot: 2 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);
    setTestNow(new Date(MONDAY_10AM.getTime() + 15 * 60_000));

    await Promise.all([expireDueOffers(t.db), t.db.tx((tx) => acceptOffer(tx, offer!.id, "link")), expireDueOffers(t.db)]);
    const done = (await getJobForStaff(t.db, job.id))!;
    expect(done).toMatchObject({ status: "accepted", tradieId: first.tradieId });
    expect((await offersFor(t.db, job.id)).filter((o) => o.status === "pending")).toHaveLength(0);
  });

  it("four servers charge the same job and release the same payout together: one charge, one payout", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const tradie = await makeTradie(t.db, { slot: 1 });
    const job = await logJob(t.db, property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    await arrive(t.db, job.id, tradie.tradieId, HOUSE);
    // 30 minutes on site, so the job is not flagged and its payout is released as normal (DECISIONS.md, 2026-11-19).
    setTestNow(addMinutes(MONDAY_10AM, 30));
    await completeJob(t.db, job.id, tradie.tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${tradie.tradieId}`)], ...HOUSE });

    const charges = await Promise.all([1, 2, 3, 4].map(() => chargeJob(t.db, gatewayFor(t.db), job.id)));
    expect(charges.filter((outcome) => outcome === "succeeded")).toHaveLength(1);
    setTestNow(addHours(MONDAY_10AM, 25));
    const sent = await Promise.all([1, 2, 3, 4].map(() => releaseDuePayouts(t.db, gatewayFor(t.db))));
    expect(sent.reduce((sum, n) => sum + n, 0)).toBe(1);

    const log = await t.db.query<{ action: string }>("select action from public.audit_log where entity_id = $1 and action in ('payment.succeeded', 'payout.sent')", [job.id]);
    expect(log.map((row) => row.action).sort()).toEqual(["payment.succeeded", "payout.sent"]);
  });
});
