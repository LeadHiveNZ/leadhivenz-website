import { afterEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { buildSampleData } from "@/lib/demo/sample";
import { listExceptions } from "@/lib/ops/exceptions";
import { testDb } from "./db";

/**
 * The demo's sample business is made by running the real rules in order with
 * the clock wound back. This test builds it and checks that every job ended
 * up where the demo menu says it will. If a rule changes in a way that breaks
 * the story, this fails rather than the demo quietly starting empty.
 */

const t = testDb();
afterEach(() => setTestNow(null));

describe("the demo's sample data", () => {
  it("builds through the real rules and leaves each job at the right point", async () => {
    const people = await buildSampleData(t.db, null, new Date("2026-11-18T01:30:00.000Z")); // a Wednesday afternoon in Queenstown
    expect(people.map((person) => person.key)).toEqual(expect.arrayContaining(["sam", "dave", "maria", "admin", "emma"]));
    // Sam's cleaner is on his team with both of his houses, and the demo menu can be her (DECISIONS.md, 2026-11-18).
    expect(people.find((person) => person.key === "mele")).toMatchObject({ role: "cleaner", userId: expect.any(String) });
    const team = await t.db.query<{ name: string; houses: number }>(
      "select m.name, (select count(*) from public.team_access a where a.member_id = m.id) as houses from public.team_members m",
    );
    expect(team.map((row) => [row.name, Number(row.houses)])).toEqual([["Mele", 2]]);
    const signed = await t.db.query<{ reporter_name: string }>("select reporter_name from public.jobs where team_member_id is not null");
    expect(signed).toEqual([{ reporter_name: "Mele" }]);

    // Three owners on Essential and one property manager on Portfolio.
    expect(people.filter((person) => person.role === "owner")).toHaveLength(4);

    // The manager: one Portfolio, paying, ten properties on it, all covered, billed at the 10-24 band.
    // DECISIONS.md (2026-11-17): 10-24 properties is NZ$600 a month, so one retainer payment of 60000 cents.
    const portfolios = await t.db.query<{ status: string; band_cents: number; property_count_billed: number; id: string }>(
      "select id, status, band_cents, property_count_billed from public.portfolios",
    );
    expect(portfolios.map((row) => [row.status, Number(row.band_cents), Number(row.property_count_billed)])).toEqual([["active", 60000, 10]]);
    const covered = await t.db.query<{ status: string }>("select status from public.properties where portfolio_id = $1::uuid", [portfolios[0]!.id]);
    expect(covered.map((row) => row.status)).toEqual(Array(10).fill("active"));
    const retainerPayments = await t.db.query<{ amount_cents: number }>("select amount_cents from public.membership_invoices where portfolio_id is not null");
    expect(retainerPayments.map((row) => Number(row.amount_cents))).toEqual([60000]);

    const jobs = await t.db.query<{ number: number; title: string; status: string; outcome: string | null; window_missed_at: Date | null }>(
      "select number, title, status, outcome, window_missed_at from public.jobs order by number",
    );
    expect(jobs.map((job) => job.status)).toEqual([
      "completed", // 1 done and paid
      "completed", // 2 the tradie was not there in time (a no-show), then done
      "completed", // 3 done, then a problem raised
      "completed", // 4 done, card declined
      "awaiting_approval", // 5 quote waiting for the owner
      "accepted", // 6 urgent, tradie on the way
      "unfilled", // 7 nobody accepted
      "awaiting_owner", // 8 guest report
      "offering", // 9 on offer now
    ]);
    expect(jobs[1]!.window_missed_at).not.toBeNull();
    const noShow = await t.db.query<{ no_show_at: Date | null }>("select no_show_at from public.jobs where number = $1", [jobs[1]!.number]);
    expect(noShow[0]!.no_show_at).not.toBeNull();

    // Money: three charged, one declined; one payout sent, one held for the owner to confirm (job 2, whose
    // Job done tap gave no location: DECISIONS.md, 2026-11-19), one on hold for a problem, and the declined one
    // scheduled all the same: a tradie is paid whatever the card does (DECISIONS.md, 2026-11-20, second entry).
    const payments = await t.db.query<{ status: string }>("select p.status from public.payments p join public.jobs j on j.id = p.job_id order by j.number");
    expect(payments.map((row) => row.status)).toEqual(["succeeded", "succeeded", "succeeded", "failed"]);
    const payouts = await t.db.query<{ status: string }>("select p.status from public.payouts p join public.jobs j on j.id = p.job_id order by j.number");
    expect(payouts.map((row) => row.status)).toEqual(["sent", "held", "paused", "scheduled"]);
    const checks = await t.db.query<{ check_flags: string[]; confirm_status: string | null }>("select check_flags, confirm_status from public.jobs where status = 'completed' order by number");
    expect(checks.map((row) => [row.check_flags, row.confirm_status])).toEqual([[[], null], [["finished_no_location"], "waiting"], [[], null], [[], null]]);

    // A missed promise is no longer credited (DECISIONS.md, 2026-11-18): there are no credits at all.
    const credits = await t.db.query<{ reason: string; status: string }>("select reason, status from public.credits");
    expect(credits).toEqual([]);

    // The dispatcher's queue holds exactly the three things that need a person.
    const open = await listExceptions(t.db, { status: "open" });
    expect(open.map((item) => item.kind).sort()).toEqual(["dispute", "nobody_accepted", "payment_failed"]);

    // The live offer is with the first-choice plumber and has not run out.
    const offers = await t.db.query<{ business_name: string; status: string }>(
      `select t.business_name, o.status from public.offers o join public.tradies t on t.id = o.tradie_id join public.jobs j on j.id = o.job_id where j.number = $1`,
      [jobs[8]!.number],
    );
    expect(offers).toEqual([{ business_name: "Dave's Plumbing & Gas", status: "pending" }]);

    // Every text was kept for the demo phone, and none is still waiting to go.
    const waiting = await t.db.query("select 1 from public.notifications where status = 'queued'");
    expect(waiting).toHaveLength(0);
    const texts = await t.db.query<{ count: number }>("select count(*) as count from public.notifications where channel = 'sms'");
    expect(Number(texts[0]!.count)).toBeGreaterThan(25);

    // A referral is under way, and a tradie is waiting for approval.
    expect(await t.db.query("select 1 from public.referrals where status = 'pending'")).toHaveLength(1);
    expect(await t.db.query("select 1 from public.tradies where status = 'applied'")).toHaveLength(1);
  });
});
