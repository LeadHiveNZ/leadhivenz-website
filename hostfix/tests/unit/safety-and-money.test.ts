import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { balanceOwed, closeChargeback, decideChargebackFault, recordChargeback } from "@/lib/billing/chargebacks";
import { chargeDuePayments, chargeJob, MAX_CHARGE_ATTEMPTS, releaseDuePayouts } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { approveGuestReport, createJob, defaultMayLetIn, releaseCardHolds, type NewJob } from "@/lib/jobs/create";
import { getJobForStaff, getJobForTradie } from "@/lib/jobs/store";
import { loadJobView } from "@/lib/jobs/view";
import { completeJob, markEnRoute, reportHazard } from "@/lib/jobs/work";
import { applyScheduledFees, FEE_NOTICE_DAYS, updateMarket } from "@/lib/markets/admin";
import { getMarket } from "@/lib/markets/store";
import { cardProblem, saveBilling, setOwnerAccess } from "@/lib/owners/service";
import { DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import { getProperty, type Property } from "@/lib/properties/service";
import { agreeToAgreement, getTradie, TRADIE_AGREEMENT_VERSION } from "@/lib/tradies/service";
import { testDb } from "./db";
import { arrive, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, menuItem, MONDAY_10AM, offersFor, openExceptions, photo, textsTo, messagesTo } from "./factory";

/**
 * TRADIES PAID WHATEVER THE CARD DOES, CHARGEBACKS BY FAULT, GUESTS IN THE
 * HOUSE, HAZARDS, THE AGREEMENT IN THE APP (DECISIONS.md, 2026-11-20, second entry).
 *
 * The money here is worked out by hand from seed/menu-queenstown.json:
 *   PL-01 (the default job): owner 22500, tradie 19000. PL-03: owner 23500, tradie 20000.
 * The payout hold is the market's 24 hours. Half of a 19000 payout is 9500; of 20000, 10000.
 * MONDAY_10AM is Monday 16 November 2026, 10:00am in Queenstown.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function setup(options: { card?: "ok" | "declines" | "none" } = {}) {
  await liveMarket(t.db, { min_minutes_on_site: 0 });
  const owner = await makeOwner(t.db, { card: options.card ?? "ok" });
  const property = await makeProperty(t.db, owner.ownerId, { name: "Lakeview" });
  const tradie = await makeTradie(t.db, { slot: 1, name: "Dave Smith" });
  return { owner, property, tradie };
}
type Setup = Awaited<ReturnType<typeof setup>>;

const payment = async (jobId: string) =>
  (await t.db.query<{ status: string; attempts: number; next_retry_at: Date | null; tradie_paid_ahead_at: Date | null }>("select * from public.payments where job_id = $1::uuid", [jobId]))[0];
const payout = async (jobId: string) =>
  (await t.db.query<{ id: string; status: string; amount_cents: number; deducted_cents: number }>("select * from public.payouts where job_id = $1::uuid", [jobId]))[0];

/** Logs a job, has the tradie take it, arrive and finish it now. */
async function doneJob(s: Setup, overrides: Partial<NewJob> & { code?: string } = {}) {
  const job = await logJob(t.db, s.property, overrides);
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  await markEnRoute(t.db, job.id, s.tradie.tradieId);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  const done = await completeJob(t.db, job.id, s.tradie.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
  if (!done.ok) throw new Error(done.message);
  return done.job;
}

async function staffJob(property: Property, code = "PL-01") {
  const item = await menuItem(t.db, code);
  return createJob(t.db, {
    property, reportedBy: "staff", reporterName: null, reporterPhone: null, menuItemId: item.id, description: "", urgent: false,
    uploadIds: [], uploader: "staff:test", actor: "staff:test",
  });
}

describe("a usable card before a job goes out", () => {
  it("refuses an owner with no card, and tells the team", async () => {
    const s = await setup({ card: "none" });
    const item = await menuItem(t.db, "PL-01");
    const result = await createJob(t.db, {
      property: s.property, reportedBy: "owner", reporterName: null, reporterPhone: null, menuItemId: item.id, description: "", urgent: false,
      uploadIds: [], uploader: `owner:${s.owner.ownerId}`, actor: `owner:${s.owner.ownerId}`,
    });
    expect(result).toMatchObject({ ok: false, reason: "card", message: "There is no card saved yet. Add one on the Billing page and we send a tradie straight away." });
    expect(await t.db.query("select 1 from public.jobs")).toHaveLength(0);
    const raised = await t.db.query<{ kind: string; property_id: string }>("select kind, property_id from public.exceptions where status = 'open'");
    expect(raised).toEqual([{ kind: "card_needed", property_id: s.property.id }]);
  });

  it("counts a card good to the end of its expiry month, in the market's time", async () => {
    const s = await setup();
    const market = (await getMarket(t.db, "queenstown"))!;
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_x", card: { ...DEMO_CARD_OK, expMonth: 11, expYear: 2026 } });
    // Monday 16 November 2026: a card that runs to the end of November is still good.
    expect(await cardProblem(t.db, s.owner.ownerId, "NZ", MONDAY_10AM, market.timezone)).toBeNull();
    // 1 December 2026, 12:30am in Queenstown (30 November 11:30am UTC): it has expired, though it is still November in UTC.
    expect(await cardProblem(t.db, s.owner.ownerId, "NZ", new Date("2026-11-30T11:30:00.000Z"), market.timezone)).toBe("expired");
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_x", card: { ...DEMO_CARD_OK, expMonth: 10, expYear: 2026 } });
    expect(await cardProblem(t.db, s.owner.ownerId, "NZ", MONDAY_10AM, market.timezone)).toBe("expired");
    await expect(logJob(t.db, s.property)).rejects.toThrow("Your saved card has expired.");
  });

  it("holds a job someone else logs until the owner sorts the card, then sends it out by itself", async () => {
    const s = await setup({ card: "none" });
    const result = await staffJob(s.property);
    if (!result.ok) throw new Error(result.message);
    expect(result.job).toMatchObject({ status: "awaiting_owner", cardHold: "no_card" });
    expect(await offersFor(t.db, result.job.id)).toHaveLength(0);
    expect(await openExceptions(t.db, result.job.id)).toEqual(["card_needed"]);
    const asked = await textsTo(t.db, s.owner.user.phone!, "card_needed");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.body).toContain("no card saved. Update it:");
    expect(asked[0]!.body).toContain("/app/billing");

    // Nothing changes until the card is there.
    expect(await releaseCardHolds(t.db)).toBe(0);
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_new", card: DEMO_CARD_OK });
    expect(await releaseCardHolds(t.db)).toBe(1);
    expect(await getJobForStaff(t.db, result.job.id)).toMatchObject({ status: "offering", cardHold: null });
    expect((await offersFor(t.db, result.job.id)).map((offer) => offer.tradie_id)).toEqual([s.tradie.tradieId]);
    expect(await openExceptions(t.db, result.job.id)).toEqual([]);
    expect(await releaseCardHolds(t.db)).toBe(0);
  });

  it("checks a guest's report when the owner says yes, not before", async () => {
    const s = await setup({ card: "none" });
    const item = await menuItem(t.db, "PL-01");
    const guest = await createJob(t.db, {
      property: s.property, reportedBy: "guest", reporterName: "Ana", reporterPhone: "+64215550001", menuItemId: item.id, description: "", urgent: false,
      uploadIds: [], uploader: "guest", actor: "guest",
    });
    if (!guest.ok) throw new Error(guest.message);
    expect(guest.job).toMatchObject({ status: "awaiting_owner", cardHold: null, guestStaying: "yes" });
    const answer = await approveGuestReport(t.db, guest.job.id, { urgent: false }, `owner:${s.owner.ownerId}`);
    expect(answer).toEqual({ ok: false, message: "There is no card saved yet. Add one on the Billing page and we send a tradie straight away." });
    expect(await offersFor(t.db, guest.job.id)).toHaveLength(0);
  });

  it("stops an owner whose access our team removed, from every way in, until it is given back", async () => {
    const s = await setup();
    expect(await setOwnerAccess(t.db, s.owner.ownerId, false, "", "staff:test")).toEqual({ ok: false, message: "Say why, for the record." });
    expect(await setOwnerAccess(t.db, s.owner.ownerId, false, "Said Something's wrong on four finished jobs", "staff:test")).toEqual({ ok: true });
    await expect(logJob(t.db, s.property)).rejects.toThrow("This account is closed.");
    expect(await staffJob(s.property)).toMatchObject({ ok: false, message: "This account is closed. Contact us if you think this is a mistake." });
    await setOwnerAccess(t.db, s.owner.ownerId, true, "", "staff:test");
    expect((await logJob(t.db, s.property)).status).toBe("offering");
  });
});

describe("a declined card never stops the tradie being paid", () => {
  it("pays the tradie at the usual 24 hours, records what the owner owes, blocks their new jobs, and charges a new card at once", async () => {
    const s = await setup({ card: "declines" });
    const job = await doneJob(s);
    // Monday 10:00: the first try fails. The tradie's 19000 is scheduled for Tuesday 10:00 regardless.
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("failed");
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });

    // Tuesday 10:00: the second try fails; the tradie is paid all the same, ahead of the owner.
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await chargeDuePayments(t.db, gatewayFor(t.db))).toBe(1); // one try made

    expect(await payment(job.id)).toMatchObject({ status: "failed", attempts: 2 });
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(job.id)).toMatchObject({ status: "sent", amount_cents: 19000, deducted_cents: 0 });
    expect((await payment(job.id))!.tradie_paid_ahead_at).not.toBeNull();
    expect((await messagesTo(t.db, s.tradie.phone, "payout_sent"))[0]!.body).toContain("NZ$190 for job");
    const sent = await t.db.query<{ amount: number; detail: { owner_charged: boolean } }>("select amount, detail from public.audit_log where entity_id = $1 and action = 'payout.sent'", [job.id]);
    expect(sent).toEqual([{ amount: 19000, detail: expect.objectContaining({ owner_charged: false, deducted: 0 }) }]);

    // Wednesday and Thursday 10:00: tries 3 and 4 fail. After the last, the owner owes it: in the queue for chasing.
    for (const day of [2, 3]) {
      setTestNow(addHours(MONDAY_10AM, 24 * day));
      await chargeDuePayments(t.db, gatewayFor(t.db));
    }
    expect(await payment(job.id)).toMatchObject({ status: "failed", attempts: MAX_CHARGE_ATTEMPTS, next_retry_at: null });
    expect(await openExceptions(t.db, job.id)).toEqual(["payment_failed", "owner_owes"]);

    // Until it is paid, no new job goes out: the owner is told why and where to fix it.
    await expect(logJob(t.db, s.property, { code: "PL-03" })).rejects.toThrow("An earlier job's card payment has not gone through");

    // Friday 9:00: a new card. The next timer run tries it at once, not on a schedule.
    setTestNow(addHours(MONDAY_10AM, 24 * 4 - 1));
    await saveBilling(t.db, { ownerId: s.owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_fixed", card: DEMO_CARD_OK });
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24 * 4 - 1), 1));
    expect(await chargeDuePayments(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", attempts: 5 });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    // Paid once: the tradie is not paid twice.
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    expect((await logJob(t.db, s.property, { code: "PL-03" })).status).toBe("offering");
  });
});

describe("chargebacks", () => {
  async function chargedAndPaid(s: Setup, code?: string) {
    const job = await doneJob(s, code ? { code } : {});
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    return job;
  }

  it("lost and the tradie's fault: what they were paid becomes a balance, taken back never more than half of any one payout", async () => {
    const s = await setup();
    const first = await chargedAndPaid(s);
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);

    // Two weeks on, the owner's bank disputes the NZ$225 and keeps it.
    setTestNow(addHours(MONDAY_10AM, 24 * 14));
    await recordChargeback(t.db, { disputeId: "dp_1", jobId: first.id, amountCents: 22500, currency: "nzd", reason: "product_not_received" });
    await recordChargeback(t.db, { disputeId: "dp_1", jobId: first.id, amountCents: 22500, currency: "nzd", reason: "product_not_received" });
    expect(await t.db.query("select 1 from public.chargebacks")).toHaveLength(1);
    expect(await closeChargeback(t.db, "dp_1", "lost")).toBe("lost");
    expect(await closeChargeback(t.db, "dp_1", "lost")).toBe("already");
    expect(await openExceptions(t.db, first.id)).toEqual(["chargeback_lost"]);
    const [chargeback] = await t.db.query<{ id: string }>("select id from public.chargebacks where dispute_id = 'dp_1'");

    // The team taps "Tradie's fault". They were paid 19000 for the job; the bank took 22500. They owe 19000, the smaller.
    expect(await decideChargebackFault(t.db, chargeback!.id, "tradie", "staff:test")).toEqual({ ok: true, owedCents: 19000, cancelledCents: 0 });
    expect(await decideChargebackFault(t.db, chargeback!.id, "tradie", "staff:test")).toEqual({ ok: true, owedCents: 0, cancelledCents: 0 });
    expect(await balanceOwed(t.db, s.tradie.tradieId)).toBe(19000);
    expect(await openExceptions(t.db, first.id)).toEqual([]);
    const told = await messagesTo(t.db, s.tradie.phone, "balance_owed");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain("NZ$190 comes off later pay, max half of each.");

    // The next job pays 20000 (PL-03): half is 10000, so 10000 comes off and 10000 is sent. 9000 still owed.
    const second = await chargedAndPaid(s, "PL-03");
    setTestNow(addHours(MONDAY_10AM, 24 * 15));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(second.id)).toMatchObject({ status: "sent", amount_cents: 20000, deducted_cents: 10000 });
    expect(await balanceOwed(t.db, s.tradie.tradieId)).toBe(9000);
    const secondText = (await messagesTo(t.db, s.tradie.phone, "payout_sent")).find((message) => message.body?.includes(`job ${second.number}`));
    expect(secondText!.body).toBe(`HostFix: NZ$100 for job ${second.number} is on its way to your bank. NZ$100 came off towards what you owe us.`);

    // The one after pays 19000 (PL-01): half is 9500, more than the 9000 left, so 9000 comes off and 10000 is sent.
    const third = await chargedAndPaid(s);
    setTestNow(addHours(MONDAY_10AM, 24 * 16));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(third.id)).toMatchObject({ status: "sent", amount_cents: 19000, deducted_cents: 9000 });
    expect(await balanceOwed(t.db, s.tradie.tradieId)).toBe(0);
    expect(await t.db.query<{ status: string; recovered_cents: number }>("select status, recovered_cents from public.tradie_balances")).toEqual([{ status: "recovered", recovered_cents: 19000 }]);
    const recoveries = await t.db.query<{ amount_cents: number }>("select amount_cents from public.balance_recoveries order by created_at");
    expect(recoveries.map((row) => row.amount_cents)).toEqual([10000, 9000]);

    // And then nothing more comes off.
    const fourth = await chargedAndPaid(s, "PL-03");
    setTestNow(addHours(MONDAY_10AM, 24 * 17));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payout(fourth.id)).toMatchObject({ status: "sent", deducted_cents: 0 });
  });

  it("lost and the tradie's fault before they were paid: the payout is cancelled, nothing is owed", async () => {
    const s = await setup();
    const job = await chargedAndPaid(s);
    await recordChargeback(t.db, { disputeId: "dp_2", jobId: job.id, amountCents: 22500, currency: "NZD", reason: "fraudulent" });
    await closeChargeback(t.db, "dp_2", "lost");
    const [chargeback] = await t.db.query<{ id: string }>("select id from public.chargebacks");
    expect(await decideChargebackFault(t.db, chargeback!.id, "tradie", "staff:test")).toEqual({ ok: true, owedCents: 0, cancelledCents: 19000 });
    expect(await payout(job.id)).toMatchObject({ status: "cancelled" });
    expect(await balanceOwed(t.db, s.tradie.tradieId)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
  });

  it("lost and not the tradie's fault, or won: HostFix carries it and the paused payout goes on", async () => {
    const s = await setup();
    const lost = await chargedAndPaid(s);
    // charge.dispute.created pauses an unsent payout (payments/product-events.ts).
    await t.db.query("update public.payouts set status = 'paused' where job_id = $1::uuid", [lost.id]);
    await recordChargeback(t.db, { disputeId: "dp_3", jobId: lost.id, amountCents: 22500, currency: "NZD", reason: "general" });
    // Only decided once lost.
    const [open] = await t.db.query<{ id: string }>("select id from public.chargebacks where dispute_id = 'dp_3'");
    expect(await decideChargebackFault(t.db, open!.id, "not_tradie", "staff:test")).toEqual({ ok: false, message: "This is only decided once the chargeback is lost." });
    await closeChargeback(t.db, "dp_3", "lost");
    expect(await decideChargebackFault(t.db, open!.id, "not_tradie", "staff:test")).toEqual({ ok: true, owedCents: 0, cancelledCents: 0 });
    expect(await payout(lost.id)).toMatchObject({ status: "scheduled" });
    expect(await balanceOwed(t.db, s.tradie.tradieId)).toBe(0);

    const won = await chargedAndPaid(s, "PL-03");
    await t.db.query("update public.payouts set status = 'paused' where job_id = $1::uuid", [won.id]);
    await recordChargeback(t.db, { disputeId: "dp_4", jobId: won.id, amountCents: 23500, currency: "NZD", reason: "general" });
    // Stripe's warning_closed (an inquiry that never became a chargeback) counts as won: no money was lost.
    expect(await closeChargeback(t.db, "dp_4", "warning_closed")).toBe("won");
    expect(await payout(won.id)).toMatchObject({ status: "scheduled" });
    expect(await openExceptions(t.db, won.id)).toEqual([]);
  });
});

describe("guests in the house", () => {
  it("lets the tradie in when nobody answers only if no guest is staying, unless the owner says otherwise", () => {
    expect(defaultMayLetIn(null)).toBe(true);
    expect(defaultMayLetIn("no")).toBe(true);
    expect(defaultMayLetIn("yes")).toBe(false);
    expect(defaultMayLetIn("not_sure")).toBe(false);
  });

  it("texts the staying guest the tradie's first name and time on accept, and again on the way, and never shows the tradie their number", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { guestStaying: "yes", guestName: "Sam Jones", guestPhone: "+64215550002" });
    expect(job).toMatchObject({ guestStaying: "yes", guestName: "Sam", guestPhone: "+64215550002", mayLetIn: false });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    const booked = await textsTo(t.db, "+64215550002", "guest_booked");
    expect(booked).toHaveLength(1);
    expect(booked[0]!.body).toMatch(/^HostFix: a HostFix tradie, Dave, is coming to fix .+\. They'll knock first\. Reply STOP to opt out$/);
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    await markEnRoute(t.db, job.id, s.tradie.tradieId);
    const onWay = await textsTo(t.db, "+64215550002", "guest_on_the_way");
    expect(onWay).toHaveLength(1);
    expect(onWay[0]!.body).toContain("Dave, the HostFix tradie, is on the way");

    // The tradie sees the first name, never the number; the team sees both.
    expect(await getJobForTradie(t.db, s.tradie.tradieId, job.id)).toMatchObject({ guestName: "Sam", guestPhone: null });
    const fresh = (await getJobForStaff(t.db, job.id))!;
    expect((await loadJobView(t.db, fresh, "tradie")).job.guestPhone).toBeNull();
    expect((await loadJobView(t.db, fresh, "staff")).job.guestPhone).toBe("+64215550002");
  });

  it("keeps no guest details when nobody is staying, and keeps the owner's choice on letting in", async () => {
    const s = await setup();
    const none = await logJob(t.db, s.property, { guestStaying: "no", guestName: "Sam", guestPhone: "+64215550002" });
    expect(none).toMatchObject({ guestStaying: "no", guestName: null, guestPhone: null, mayLetIn: true });
    const unsure = await logJob(t.db, s.property, { code: "PL-03", guestStaying: "not_sure", mayLetIn: true });
    expect(unsure).toMatchObject({ guestStaying: "not_sure", guestPhone: null, mayLetIn: true });
  });

  it("adds the knock to a guest reporter's texts, and texts them when the tradie is on the way", async () => {
    const s = await setup();
    await t.db.query("update public.properties set guest_auto_dispatch = true where id = $1::uuid", [s.property.id]);
    const property = (await getProperty(t.db, s.owner.ownerId, s.property.id))!;
    const item = await menuItem(t.db, "PL-01");
    const guest = await createJob(t.db, {
      property, reportedBy: "guest", reporterName: "Ana", reporterPhone: "+64215550001", menuItemId: item.id, description: "", urgent: false,
      uploadIds: [], uploader: "guest", actor: "guest",
    });
    if (!guest.ok) throw new Error(guest.message);
    expect(guest.job).toMatchObject({ status: "offering", guestStaying: "yes", mayLetIn: false });
    const [offer] = await offersFor(t.db, guest.job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    expect((await textsTo(t.db, "+64215550001", "reporter_booked"))[0]!.body).toMatch(/a tradie will be at .+\. They'll knock first\.( Reply STOP to opt out)?$/);
    expect(await textsTo(t.db, "+64215550001", "guest_booked")).toHaveLength(0);
    await markEnRoute(t.db, guest.job.id, s.tradie.tradieId);
    expect(await textsTo(t.db, "+64215550001", "guest_on_the_way")).toHaveLength(1);
  });
});

describe("hazards at a property", () => {
  it("are saved by the tradie on the job, dated and signed, the owner told; nobody else can add one", async () => {
    const s = await setup();
    const other = await makeTradie(t.db, { slot: 2, name: "Mike Brown" });
    const job = await logJob(t.db, s.property);
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    expect(await reportHazard(t.db, job.id, other.tradieId, "Loose roof tiles")).toEqual({ ok: false, message: "That job is not one of yours." });
    expect(await reportHazard(t.db, job.id, s.tradie.tradieId, "deck")).toMatchObject({ ok: false });
    expect(await reportHazard(t.db, job.id, s.tradie.tradieId, "  Rotten boards on the back   deck ")).toMatchObject({ ok: true });
    const property = (await getProperty(t.db, s.owner.ownerId, s.property.id))!;
    expect(property.hazards).toMatch(/^.*16.*Nov.*, noted by Dave Smith: Rotten boards on the back deck$/);
    const told = await textsTo(t.db, s.owner.user.phone!, "hazard_added");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain('Dave Smith noted a hazard at Lakeview: "Rotten boards on the back..."');
  });
});

describe("the tradie agreement, agreed in the app", () => {
  it("gets no offers to a tradie until they agree to the version in force", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    const notYet = await makeTradie(t.db, { slot: 1, agreed: false });
    const agreed = await makeTradie(t.db, { slot: 2 });
    expect((await getTradie(t.db, notYet.tradieId))!.agreementVersion).toBeNull();
    expect((await getTradie(t.db, agreed.tradieId))!.agreementVersion).toBe(TRADIE_AGREEMENT_VERSION);
    const first = await logJob(t.db, property);
    // The first choice has not agreed, so the backup is offered it first.
    expect((await offersFor(t.db, first.id)).map((offer) => offer.tradie_id)).toEqual([agreed.tradieId]);

    await agreeToAgreement(t.db, notYet.tradieId);
    await agreeToAgreement(t.db, notYet.tradieId);
    expect(await t.db.query("select 1 from public.audit_log where action = 'tradie.agreed' and entity_id = $1", [notYet.tradieId])).toHaveLength(1);
    const second = await logJob(t.db, property, { code: "PL-03" });
    expect((await offersFor(t.db, second.id)).map((offer) => offer.tradie_id)).toEqual([notYet.tradieId]);
  });
});

describe("a platform fee change waits 30 days", () => {
  it("is written down for 30 days on, texted to every tradie, started by the timer, and can be called off", async () => {
    const s = await setup();
    expect(FEE_NOTICE_DAYS).toBe(30);
    await updateMarket(t.db, "queenstown", { platformFeeBps: 1800 }, "admin:test");
    let market = (await getMarket(t.db, "queenstown"))!;
    expect(market.platformFeeBps).toBe(1500);
    // 30 days after Monday 16 November 2026, 10:00am is Wednesday 16 December 2026, 10:00am.
    expect(market.platformFeeNext).toEqual({ bps: 1800, from: addHours(MONDAY_10AM, 24 * 30) });
    const told = await textsTo(t.db, s.tradie.phone, "fee_change");
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toMatch(/^HostFix: from .*16 Dec.* the platform fee in Queenstown changes from 15% to 18%\./);

    // Saving the market again with the waiting figure changes nothing and texts nobody again.
    await updateMarket(t.db, "queenstown", { platformFeeBps: 1800, offerMinutes: 20 }, "admin:test");
    expect(await textsTo(t.db, s.tradie.phone, "fee_change")).toHaveLength(1);
    expect((await getMarket(t.db, "queenstown"))!.offerMinutes).toBe(20);

    setTestNow(addMinutes(addHours(MONDAY_10AM, 24 * 30), -1));
    expect(await applyScheduledFees(t.db)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 24 * 30));
    expect(await applyScheduledFees(t.db)).toBe(1);
    market = (await getMarket(t.db, "queenstown"))!;
    expect(market).toMatchObject({ platformFeeBps: 1800, platformFeeNext: null });
    expect(await applyScheduledFees(t.db)).toBe(0);

    // A change put back to the fee in force is called off.
    await updateMarket(t.db, "queenstown", { platformFeeBps: 2000 }, "admin:test");
    await updateMarket(t.db, "queenstown", { platformFeeBps: 1800 }, "admin:test");
    expect((await getMarket(t.db, "queenstown"))!).toMatchObject({ platformFeeBps: 1800, platformFeeNext: null });
  });

  it("changes at once in a market with no tradies yet", async () => {
    await liveMarket(t.db);
    await updateMarket(t.db, "queenstown", { platformFeeBps: 1800 }, "admin:test");
    expect((await getMarket(t.db, "queenstown"))!).toMatchObject({ platformFeeBps: 1800, platformFeeNext: null });
  });
});
