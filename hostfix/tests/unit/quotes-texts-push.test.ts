import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargeJob, releaseDuePayouts } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer, assignTradie } from "@/lib/dispatch/cascade";
import { ownerObjects, settleNotDescribed, staffDecideNotDescribed } from "@/lib/jobs/not-described";
import { getJobForStaff, listLines } from "@/lib/jobs/store";
import { cancelJob } from "@/lib/jobs/create";
import { completeJob, decideQuote, markEnRoute, submitQuote } from "@/lib/jobs/work";
import { addParts } from "@/lib/jobs/parts";
import { handleInboundSms } from "@/lib/notify/inbound";
import { STOP_LINE, texts } from "@/lib/notify/messages";
import { enqueue, flushOutbox } from "@/lib/notify/outbox";
import { pushPayload, savePushSubscription } from "@/lib/notify/push";
import { marketQuoteRate, quoteRate, quoteRateFlagged } from "@/lib/tradies/quote-rate";
import { testDb } from "./db";
import { arrive, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, messagesTo, MONDAY_10AM, offersFor, openExceptions, photo, textsTo } from "./factory";

/**
 * "NOT THE JOB DESCRIBED", QUOTE RATES, STOP AND APP NOTIFICATIONS
 * (DECISIONS.md, 2026-11-20, third entry).
 *
 * Worked by hand from seed/menu-queenstown.json and the market's settings:
 *   PL-03: owner 23500, tradie 20000. The call-out: owner 22500, tradie 19000.
 *   The plumber's hourly rate: NZ$160 (16000). 2 hours = 32000; the tradie's 85% is 27200.
 * MONDAY_10AM is Monday 16 November 2026, 10:00am in Queenstown.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

async function setup() {
  await liveMarket(t.db, { min_minutes_on_site: 0 });
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId, { name: "Lakeview" });
  const tradie = await makeTradie(t.db, { slot: 1, name: "Dave Smith" });
  return { owner, property, tradie };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function onSite(s: Setup, code = "PL-03") {
  const job = await logJob(t.db, s.property, { code });
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  await markEnRoute(t.db, job.id, s.tradie.tradieId);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  return arrived.job;
}

const notDescribed = async (s: Setup, jobId: string, extra: { reason?: string; photos?: number } = {}) => {
  const uploadIds: string[] = [];
  for (let i = 0; i < (extra.photos ?? 1); i += 1) uploadIds.push(await photo(t.db, `tradie:${s.tradie.tradieId}`, "quote"));
  return submitQuote(t.db, jobId, s.tradie.tradieId, {
    description: "Cut out and replace the burst section of pipe", hours: 2, uploadIds, notDescribed: { reason: extra.reason ?? "The tap is fine. The pipe behind the wall has burst." },
  });
};
const finish = async (s: Setup, jobId: string) => completeJob(t.db, jobId, s.tradie.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
const payout = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number }>("select status, amount_cents from public.payouts where job_id = $1::uuid", [jobId]))[0];
const payment = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number }>("select status, amount_cents from public.payments where job_id = $1::uuid", [jobId]))[0];
const active = async (jobId: string) => (await listLines(t.db, jobId)).filter((line) => line.status === "active").map((line) => [line.kind, line.ownerCents, line.tradieCents]);

describe("not the job described (menu jobs only)", () => {
  it("needs a photo and a one-line reason, once, and never on a look-and-price job", async () => {
    const s = await setup();
    const job = await onSite(s);
    expect(await notDescribed(s, job.id, { photos: 0 })).toEqual({ ok: false, message: "Add at least one photo of what you found." });
    expect(await notDescribed(s, job.id, { reason: "no" })).toMatchObject({ ok: false });
    expect(await notDescribed(s, job.id, { reason: "x".repeat(161) })).toMatchObject({ ok: false, message: "Keep the reason to one line (160 characters)." });
    expect(await notDescribed(s, job.id)).toMatchObject({ ok: true });
    await decideQuote(t.db, (await t.db.query<{ id: string }>("select id from public.quotes where job_id = $1::uuid", [job.id]))[0]!.id, false, "owner");
    expect(await notDescribed(s, job.id)).toEqual({ ok: false, message: "You have already said this is not the job described." });

    const offMenu = await logJob(t.db, s.property, { menuItemId: null, offMenuTrade: "plumber", offMenuTitle: "Leak somewhere" });
    const [offer] = await offersFor(t.db, offMenu.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    await arrive(t.db, offMenu.id, s.tradie.tradieId, HOUSE);
    expect(await notDescribed(s, offMenu.id)).toEqual({ ok: false, message: "This is already a look-and-price job. Send a quote for the work." });
  });

  it("takes the menu price off, puts the call-out on, and waits for the owner; approving pays the call-out", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await notDescribed(s, job.id);
    if (!result.ok) throw new Error(result.message);
    // Always waits for the owner, even inside the limit. No call-out credit on this path: the call-out is the visit.
    expect(result.quote).toMatchObject({ status: "pending", needsApproval: true, notDescribed: true, hours: 2, labourCents: 32000, ownerTotalCents: 32000, tradieTotalCents: 27200, creditCents: 0 });
    expect(result.job).toMatchObject({ status: "awaiting_approval", notDescribedStatus: "waiting", notDescribedReason: "The tap is fine. The pipe behind the wall has burst.", ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect(result.job.notDescribedBy!.getTime()).toBe(addHours(MONDAY_10AM, 24).getTime());
    expect(await active(job.id)).toEqual([["diagnosis", 22500, 19000]]);
    const told = await textsTo(t.db, s.owner.user.phone!, "not_described");
    expect(told[0]!.body).toContain("Dave Smith says it is not the job described, and quoted NZ$320. See why:");

    const approved = await decideQuote(t.db, result.quote.id, true, `owner:${s.owner.ownerId}`);
    expect(approved).toMatchObject({ ok: true, job: { notDescribedStatus: "approved", ownerTotalCents: 22500 + 32000, tradieTotalCents: 19000 + 27200 } });
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ok: true, job: { outcome: "done", ownerTotalCents: 54500, tradieTotalCents: 46200 } });
    // Nothing holds the payment: paid at the usual 24 hours, and the owner is charged now.
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 46200 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
  });

  it("declined and no objection in 24 hours: the 22500 call-out is charged and the tradie's 19000 paid", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await notDescribed(s, job.id);
    await decideQuote(t.db, result.ok ? result.quote.id : "", false, `owner:${s.owner.ownerId}`);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ok: true, job: { outcome: "diagnosis_only", ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    // Held, and not charged, while the owner can still object.
    expect(await payout(job.id)).toMatchObject({ status: "held", amount_cents: 19000 });
    setTestNow(addMinutes(MONDAY_10AM, 10));
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("skipped");
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), -1));
    expect(await settleNotDescribed(t.db)).toBe(0);
    setTestNow(addHours(MONDAY_10AM, 24));
    expect(await settleNotDescribed(t.db)).toBe(1);
    expect((await getJobForStaff(t.db, job.id))!.notDescribedStatus).toBe("no_objection");
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 22500 });
    // Too late to object now.
    expect(await ownerObjects(t.db, job.id, "owner")).toMatchObject({ ok: false });
  });

  it("\"This was the job I described\" goes to the team; No call-out means nothing for the visit on either side", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await notDescribed(s, job.id);
    await decideQuote(t.db, result.ok ? result.quote.id : "", false, `owner:${s.owner.ownerId}`);
    await finish(s, job.id);
    setTestNow(addHours(MONDAY_10AM, 3));
    expect(await ownerObjects(t.db, job.id, `owner:${s.owner.ownerId}`)).toMatchObject({ ok: true, job: { notDescribedStatus: "owner_objects" } });
    expect(await openExceptions(t.db, job.id)).toEqual(["not_described"]);
    // Past the 24 hours nothing changes by itself: it is with the team.
    setTestNow(addHours(MONDAY_10AM, 30));
    expect(await settleNotDescribed(t.db)).toBe(0);
    expect(await staffDecideNotDescribed(t.db, job.id, false, "staff:maria")).toMatchObject({ ok: true, job: { notDescribedStatus: "staff_no_callout", ownerTotalCents: 0, tradieTotalCents: 0 } });
    expect(await payment(job.id)).toBeUndefined();
    expect(await payout(job.id)).toMatchObject({ status: "cancelled" });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    expect((await textsTo(t.db, s.tradie.phone, "callout_decided"))[0]!.body).toContain("found it was the job described, so no call-out is paid");
    expect(await staffDecideNotDescribed(t.db, job.id, true, "staff:maria")).toMatchObject({ ok: false });
  });

  it("Pay call-out after an objection releases the 19000", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await notDescribed(s, job.id);
    await decideQuote(t.db, result.ok ? result.quote.id : "", false, `owner:${s.owner.ownerId}`);
    await finish(s, job.id);
    await ownerObjects(t.db, job.id, `owner:${s.owner.ownerId}`);
    expect(await staffDecideNotDescribed(t.db, job.id, true, "staff:maria")).toMatchObject({ ok: true, job: { notDescribedStatus: "staff_paid" } });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 19000 });
    setTestNow(addHours(MONDAY_10AM, 25));
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
  });

  it("lets the tradie leave with the call-out while the owner has not answered: the quote is withdrawn", async () => {
    const s = await setup();
    const job = await onSite(s);
    await notDescribed(s, job.id);
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ok: true, job: { outcome: "diagnosis_only", ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    expect((await t.db.query<{ status: string }>("select status from public.quotes where job_id = $1::uuid", [job.id]))[0]!.status).toBe("withdrawn");
  });

  it("a normal quote on a menu job never takes the menu price off", async () => {
    const s = await setup();
    const job = await onSite(s);
    const result = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Also replace the shower head", hours: 0.5, uploadIds: [] });
    expect(result).toMatchObject({ ok: true, quote: { status: "auto_approved", labourCents: 8000, tradieTotalCents: 6800 } });
    // 23500 + 8000 = 31500 for the owner; 20000 + 6800 = 26800 for the tradie.
    expect(await active(job.id)).toEqual([["menu", 23500, 20000], ["quote", 8000, 6800]]);
  });
});

describe("quote rate (DECISIONS.md, 2026-11-20, third entry)", () => {
  it("flags only over 25% and over twice the market average", () => {
    expect(quoteRateFlagged(0.3, 0.1)).toBe(true);
    expect(quoteRateFlagged(0.2, 0.05)).toBe(false); // not over 25%
    expect(quoteRateFlagged(0.4, 0.2)).toBe(false); // exactly twice is not over
    expect(quoteRateFlagged(0.41, 0.2)).toBe(true);
    expect(quoteRateFlagged(null, 0.1)).toBe(false); // fewer than 10 jobs
  });

  it("counts the menu jobs a tradie took and arrived at, from 10, over the last 20, with quotes for work or \"not the job described\"; never declines or parts alone", async () => {
    const s = await setup();
    const other = await makeTradie(t.db, { slot: 2, name: "Mike Brown" });
    const quiet = await makeTradie(t.db, { name: "Ana Quiet" });
    const run = async (tradieId: string, quoted: "work" | "parts" | null) => {
      const job = await logJob(t.db, s.property, { code: "PL-03" });
      if (tradieId === s.tradie.tradieId) {
        const [offer] = await offersFor(t.db, job.id);
        await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
      } else {
        await t.db.tx((tx) => assignTradie(tx, job.id, tradieId, "staff:test"));
      }
      await arrive(t.db, job.id, tradieId, HOUSE);
      if (quoted === "work") await submitQuote(t.db, job.id, tradieId, { description: "More", hours: 0.25, uploadIds: [] });
      if (quoted === "parts") await addParts(t.db, job.id, tradieId, { list: [], offList: { description: "Valve", receiptTotalCents: 5000, amountCents: 5000, uploadId: await photo(t.db, `tradie:${tradieId}`, "receipt") } });
      const done = await completeJob(t.db, job.id, tradieId, { note: "", uploadIds: [await photo(t.db, `tradie:${tradieId}`)], receiptsToFollow: false, ...HOUSE });
      if (!done.ok) throw new Error(done.message);
    };
    // Dave: 9 jobs, 4 with quoted work and 1 with parts only. Not counted yet: under 10 jobs.
    for (const quoted of ["work", "work", "work", "work", "parts", null, null, null, null] as const) await run(s.tradie.tradieId, quoted);
    expect(await quoteRate(t.db, s.tradie.tradieId)).toEqual({ jobs: 9, quoted: 4, rate: null });
    await run(s.tradie.tradieId, null);
    expect(await quoteRate(t.db, s.tradie.tradieId)).toEqual({ jobs: 10, quoted: 4, rate: 0.4 });
    // Mike and Ana: 10 jobs each, none quoted. The market average: (40% + 0% + 0%) / 3 = 13.3%. Dave at 40% is over
    // 25% and over 26.7% (twice the average): flagged.
    for (let i = 0; i < 10; i += 1) await run(other.tradieId, null);
    for (let i = 0; i < 10; i += 1) await run(quiet.tradieId, null);
    const average = await marketQuoteRate(t.db, "queenstown");
    expect(average).toBeCloseTo(0.4 / 3, 10);
    expect(quoteRateFlagged(0.4, average ?? null)).toBe(true);
    // A job Dave was offered and let run out (a decline) never counts.
    const declined = await logJob(t.db, s.property, { code: "PL-04" });
    setTestNow(addMinutes(MONDAY_10AM, 20));
    expect((await offersFor(t.db, declined.id)).length).toBeGreaterThan(0);
    expect((await quoteRate(t.db, s.tradie.tradieId)).jobs).toBe(10);
    await cancelJob(t.db, declined.id, { actor: "staff:test", staff: true }, "Test");
    // The next quote he sends puts him in front of the team.
    setTestNow(MONDAY_10AM);
    await run(s.tradie.tradieId, "work");
    const raised = await t.db.query<{ kind: string; tradie_id: string }>("select kind, tradie_id from public.exceptions where kind = 'quote_rate' and status = 'open'");
    expect(raised).toEqual([{ kind: "quote_rate", tradie_id: s.tradie.tradieId }]);
  });
});

describe("STOP, START and the first text", () => {
  it("adds \"Reply STOP to opt out\" to every offer and to the first text a number gets, and to nothing after", async () => {
    const s = await setup();
    await logJob(t.db, s.property, { code: "PL-03" });
    const [offer] = await textsTo(t.db, s.tradie.phone, "offer");
    expect(offer!.body!.endsWith(` ${STOP_LINE}`)).toBe(true);
    await enqueue(t.db, { channel: "sms", to: "+64215550123", template: "reporter_done", body: texts.reporterDone({ property: "Lakeview" }) });
    await enqueue(t.db, { channel: "sms", to: "+64215550123", template: "reporter_done", body: texts.reporterDone({ property: "Lakeview 2" }) });
    const bodies = (await textsTo(t.db, "+64215550123")).map((message) => message.body!).sort();
    expect(bodies).toEqual([
      "HostFix: the problem you reported at Lakeview 2 has been fixed. Thank you.",
      `HostFix: the problem you reported at Lakeview has been fixed. Thank you. ${STOP_LINE}`,
    ]);
  });

  it("STOP stops every text to that number but a sign-in code; an offer then goes by email and the team is told; START turns texts back on", async () => {
    const s = await setup();
    const phone = s.tradie.phone;
    expect(await handleInboundSms(t.db, { provider: "demo", from: phone, body: "STOP", raw: {} })).toBe("opted_out");
    await t.db.query("update public.users set email = 'dave@example.com' where phone = $1", [phone]);
    const job = await logJob(t.db, s.property, { code: "PL-03" });
    expect(await textsTo(t.db, phone, "offer")).toHaveLength(0);
    const emailed = await messagesTo(t.db, phone, "offer");
    expect(emailed.map((message) => [message.channel, message.recipient])).toEqual([["email", "dave@example.com"]]);
    const raised = await t.db.query<{ kind: string }>("select kind from public.exceptions where kind = 'sms_opted_out' and status = 'open'");
    expect(raised).toHaveLength(1);
    expect(await offersFor(t.db, job.id)).toHaveLength(1);
    await enqueue(t.db, { channel: "sms", to: phone, template: "sign_in_code", body: texts.signInCode("123456") });
    expect(await textsTo(t.db, phone, "sign_in_code")).toHaveLength(1);

    expect(await handleInboundSms(t.db, { provider: "demo", from: phone, body: "start", raw: {} })).toBe("opted_in");
    await logJob(t.db, s.property, { code: "PL-01" });
    expect(await textsTo(t.db, phone, "offer")).toHaveLength(1);
  });

  it("a number that replied STOP with no email and no notifications gets nothing, and the team is told", async () => {
    const s = await setup();
    await handleInboundSms(t.db, { provider: "demo", from: s.tradie.phone, body: "Unsubscribe", raw: {} });
    await logJob(t.db, s.property, { code: "PL-03" });
    expect(await messagesTo(t.db, s.tradie.phone, "offer")).toHaveLength(0);
    const summary = await t.db.query<{ summary: string }>("select summary from public.exceptions where kind = 'sms_opted_out'");
    expect(summary[0]!.summary).toContain("nowhere: they have no app notifications or email");
  });
});

describe("who gets a text, an email or an app notification", () => {
  it("sends job done by email to an owner with an email address, and keeps booking texts as texts", async () => {
    const s = await setup();
    const job = await onSite(s);
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    expect(await textsTo(t.db, s.owner.user.phone!, "job_done")).toHaveLength(0);
    const [done] = await messagesTo(t.db, s.owner.user.phone!, "job_done");
    expect(done).toMatchObject({ channel: "email", subject: "HostFix: Your job is done" });
    expect(await textsTo(t.db, s.owner.user.phone!, "job_booked")).toHaveLength(1);
  });

  it("offers go by app notification first; the text follows after 3 minutes only if the offer is still unopened", async () => {
    const s = await setup();
    const userId = (await t.db.query<{ id: string }>("select id from public.users where phone = $1", [s.tradie.phone]))[0]!.id;
    expect(await savePushSubscription(t.db, userId, { endpoint: "https://push.example.com/send/abc123def456", keys: { p256dh: "key", auth: "auth" } })).toEqual({ ok: true });
    const pushed: string[] = [];
    const sendPush = async (_subscription: unknown, payload: string) => {
      pushed.push(payload);
      return { statusCode: 201 };
    };
    const opened = await logJob(t.db, s.property, { code: "PL-03" });
    const unopened = await logJob(t.db, s.property, { code: "PL-01" });
    await flushOutbox(t.db, { sendPush });
    expect(pushed).toHaveLength(2);
    const payload = JSON.parse(pushed[0]!) as { title: string; body: string; url: string };
    expect(payload.title).toBe("HostFix");
    expect(payload.url).toMatch(/^\/o\/\d+\.[A-Za-z0-9]{12}$/);
    expect(payload.body).not.toMatch(/https?:|Esplanade/);
    // No text yet.
    expect((await textsTo(t.db, s.tradie.phone, "offer")).filter((message) => message.status !== "queued")).toHaveLength(0);
    const [openedOffer] = await offersFor(t.db, opened.id);
    await t.db.query("update public.offers set opened_at = $2::timestamptz where id = $1::uuid", [openedOffer!.id, addMinutes(MONDAY_10AM, 1).toISOString()]);
    setTestNow(addMinutes(MONDAY_10AM, 3));
    await flushOutbox(t.db, { sendPush });
    const sms = await textsTo(t.db, s.tradie.phone, "offer");
    const byJob = new Map(sms.map((message) => [message.jobId, message.status]));
    expect(byJob.get(opened.id)).toBe("skipped");
    expect(byJob.get(unopened.id)).toBe("demo");
  });

  it("an owner with notifications on gets updates as notifications, and a device the push service says is gone is removed", async () => {
    const s = await setup();
    const userId = s.owner.user.id;
    await savePushSubscription(t.db, userId, { endpoint: "https://push.example.com/send/owner-phone-1", keys: { p256dh: "k", auth: "a" } });
    await onSite(s);
    const booked = await messagesTo(t.db, s.owner.user.phone!, "job_booked");
    expect(booked.map((message) => message.channel)).toEqual(["push"]);
    expect(booked[0]!.body).not.toContain("Lake Esplanade");
    await flushOutbox(t.db, { sendPush: async () => ({ statusCode: 410 }) });
    expect(await t.db.query("select 1 from public.push_subscriptions where user_id = $1::uuid", [userId])).toHaveLength(0);
  });

  it("app notification words drop the link and keep the page to open", () => {
    expect(pushPayload("HostFix: job 1042 is yours. The address and access notes are here: https://hostfix.co.nz/o/1042.k3Xb9aQ2LmPq")).toEqual({
      title: "HostFix", body: "job 1042 is yours. The address and access notes are here", url: "/o/1042.k3Xb9aQ2LmPq",
    });
    expect(pushPayload("HostFix URGENT Toilet seat, Frankton: NZ$232.50 (NZ$42.50 if there by 2pm today) https://hostfix.co.nz/o/1.abcdefabcdef").body).toBe(
      "URGENT: Toilet seat, Frankton: NZ$232.50 (NZ$42.50 if there by 2pm today)",
    );
  });

  it("refuses a subscription that is not an https push address", async () => {
    const s = await setup();
    expect(await savePushSubscription(t.db, s.owner.user.id, { endpoint: "http://evil", keys: { p256dh: "k", auth: "a" } })).toMatchObject({ ok: false });
  });
});
