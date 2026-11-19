import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargeJob, releaseDuePayouts } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { canView, getUpload } from "@/lib/files/uploads";
import { cancelJob } from "@/lib/jobs/create";
import { addParts, attachReceipt, chargeBoughtParts, listParts, listPriceList, refundMissingReceipts, staffDecideReceipts } from "@/lib/jobs/parts";
import { listPartLine, partsApproval, receiptPartLine } from "@/lib/jobs/pricing";
import { getJobForStaff, listQuotes } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { loadJobView } from "@/lib/jobs/view";
import { completeJob, decideQuote, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { getMarket } from "@/lib/markets/store";
import { testDb } from "./db";
import { arrive, auditActions, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, openExceptions, photo, textsTo } from "./factory";

/**
 * PARTS (DECISIONS.md, 2026-11-20). Every amount is worked out by hand, never
 * copied from what the code returns.
 *
 *   PL-01 Toilet seat or cistern parts: owner 22500, tradie 19000 (seed/menu-queenstown.json).
 *   The price list (seed/parts-queenstown.json): mixer tap cartridge 31.41, cistern inlet
 *   valve 26.24, flush valve 65.75, shower head 117.00, GU10 bulb 13.00.
 *   A list part: the owner pays the price, the tradie gets it less 3% (rounded to the cent).
 *     3141: 3% is 94.23 -> 94, tradie 3047.   2624: 3% is 78.72 -> 79, tradie 2545.
 *     GU10 x 4 = 5200: 3% is 156, tradie 5044.
 *   Off the list: the owner pays the receipt amount plus 20%; HostFix keeps 15% of the 20%.
 *     30000: +6000 = 36000; 15% of 6000 is 900; tradie 35100 (the receipt plus 17%).
 *     10000: +2000 = 12000; 15% of 2000 is 300; tradie 11700.
 *     4550: 20% is 910; 15% of 910 is 136.5 -> 137; owner 5460, tradie 5323.
 *   Small parts up to 3000 are in the price. No-ask parts limit 15000; overall limit 60000.
 *
 *   Times, Pacific/Auckland: Mon 16 Nov 10:00am = MONDAY_10AM (2026-11-15T21:00Z). Arrived 10:00am,
 *   parts 10:05am, Job done 10:30am; the payout is due 24 hours later, Tue 10:30am.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const TEN_THIRTY = addMinutes(MONDAY_10AM, 30);

async function setup() {
  await liveMarket(t.db);
  const owner = await makeOwner(t.db);
  const property = await makeProperty(t.db, owner.ownerId);
  const tradie = await makeTradie(t.db, { slot: 1, name: "Wakatipu Plumbing" });
  const items = new Map((await listPriceList(t.db, "queenstown")).map((item) => [item.code, item]));
  return { owner, property, tradie, items };
}
type Setup = Awaited<ReturnType<typeof setup>>;

async function onSite(s: Setup, overrides: Parameters<typeof logJob>[2] = {}): Promise<Job> {
  const job = await logJob(t.db, s.property, { code: "PL-01", ...overrides });
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  setTestNow(addMinutes(MONDAY_10AM, 5));
  return arrived.job;
}

async function finish(s: Setup, jobId: string, options: { receiptsToFollow?: boolean } = {}) {
  setTestNow(TEN_THIRTY);
  return completeJob(t.db, jobId, s.tradie.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE, ...options });
}

const receipt = (s: Setup, sha256?: string) => photo(t.db, `tradie:${s.tradie.tradieId}`, "receipt", sha256 ? { sha256 } : {});
const payout = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number; release_at: Date }>("select status, amount_cents, release_at from public.payouts where job_id = $1::uuid", [jobId]))[0]!;
const payment = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number; refunded_cents: number }>("select status, amount_cents, refunded_cents from public.payments where job_id = $1::uuid", [jobId]))[0]!;

describe("the sums", () => {
  it("a price-list part: the list price to the owner, less 3% to the tradie", () => {
    expect(listPartLine("Mixer tap cartridge (40 mm)", 3141, 1)).toEqual({ kind: "parts", label: "Mixer tap cartridge (40 mm)", ownerCents: 3141, tradieCents: 3047 });
    expect(listPartLine("GU10 LED downlight bulb (each)", 1300, 4)).toEqual({ kind: "parts", label: "GU10 LED downlight bulb (each) x 4", ownerCents: 5200, tradieCents: 5044 });
    expect(() => listPartLine("x", 1300, 0)).toThrow();
  });

  it("off the list: the receipt plus 20%, HostFix keeping 15% of the 20%. NZ$300: owner 360, tradie 351, HostFix 9", () => {
    const market = { platformFeeBps: 1500 };
    expect(receiptPartLine(market, "Cylinder element", 30000)).toMatchObject({ ownerCents: 36000, tradieCents: 35100 });
    expect(36000 - 35100).toBe(900);
    expect(receiptPartLine(market, "Copper fittings", 4550)).toMatchObject({ ownerCents: 5460, tradieCents: 5323 });
  });

  it("asks first above NZ$150 of parts on the job, or above the property's overall limit", () => {
    const market = { partsApprovalCents: 15000, approvalThresholdCents: 60000 };
    expect(partsApproval(market, { newPartsCents: 15000, partsSoFarCents: 0, extrasSoFarCents: 0 }).needsApproval).toBe(false);
    expect(partsApproval(market, { newPartsCents: 15001, partsSoFarCents: 0, extrasSoFarCents: 0 }).needsApproval).toBe(true);
    expect(partsApproval(market, { newPartsCents: 10000, partsSoFarCents: 5200, extrasSoFarCents: 5200 }).needsApproval).toBe(true);
    expect(partsApproval(market, { newPartsCents: 5000, partsSoFarCents: 0, extrasSoFarCents: 56000 }).needsApproval).toBe(true);
    expect(partsApproval(market, { newPartsCents: 5000, partsSoFarCents: 0, extrasSoFarCents: 0, limitCents: 4000 }).reason).toContain("pre-approved limit");
  });
});

describe("the price list", () => {
  it("is loaded from seed/parts-queenstown.json at the researched prices, in cents", async () => {
    const list = await listPriceList(t.db, "queenstown");
    expect(Object.fromEntries(list.map((item) => [item.code, item.priceCents]))).toEqual({
      "PSA-01": 3998, "PTP-01": 1173, "PTP-02": 3141, "PTL-01": 2624, "PTL-02": 6575, "PTL-03": 7561,
      "PSH-01": 11700, "PLT-01": 1593, "PLT-02": 1300, "PEL-01": 1513, "PEL-02": 1444,
    });
    expect(list.every((item) => /bunnings\.co\.nz|mitre10\.co\.nz/.test(item.source) && item.source.includes("19 Nov 2026"))).toBe(true);
  });
});

describe("parts on a menu job", () => {
  it("inside the NZ$150 no-ask limit are added straight away and the owner is texted: 22500 + 3141 + 2624 = 28265 charged", async () => {
    const s = await setup();
    const job = await onSite(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PTP-02")!.id, quantity: 1 }, { itemId: s.items.get("PTL-01")!.id, quantity: 1 }] });
    expect(added).toMatchObject({ ok: true, needsApproval: false, quote: { status: "auto_approved", labourCents: 0, ownerTotalCents: 5765, tradieTotalCents: 3047 + 2545 } });
    // Owner 22500 + 3141 + 2624 = 28265. Tradie 19000 + 3047 + 2545 = 24592.
    expect(added.ok && added.job).toMatchObject({ status: "on_site", ownerTotalCents: 28265, tradieTotalCents: 24592 });
    const [text] = await textsTo(t.db, s.owner.user.phone!, "parts_added");
    expect(text!.body).toContain("Wakatipu Plumbing needs Mixer tap cartridge (40 mm), Toilet cistern inlet valve, NZ$57.65, within your NZ$150 no-ask limit.");
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ok: true, job: { ownerTotalCents: 28265, tradieTotalCents: 24592, checkFlags: [] } });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 28265 });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 24592 });
    // HostFix keeps 3500 on the job and 94 + 79 on the parts.
    expect(28265 - 24592).toBe(3500 + 94 + 79);
  });

  it("above the limit wait for the owner's yes in the app before anything is bought, through the same approval as a quote", async () => {
    const s = await setup();
    const job = await onSite(s);
    const receiptId = await receipt(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { list: [], offList: { description: "Hot water cylinder element", receiptTotalCents: 30000, amountCents: 30000, uploadId: receiptId } });
    expect(added).toMatchObject({ ok: true, needsApproval: true, quote: { status: "pending", ownerTotalCents: 36000 } });
    expect(added.ok && added.job).toMatchObject({ status: "awaiting_approval", ownerTotalCents: 22500 });
    expect((await textsTo(t.db, s.owner.user.phone!, "parts_need_approval"))[0]!.body).toContain("needs Hot water cylinder element, NZ$360. They will not buy it until you say yes:");
    expect(await finish(s, job.id)).toMatchObject({ ok: false });
    const approved = await decideQuote(t.db, added.ok ? added.quote.id : "", true, `owner:${s.owner.ownerId}`);
    // Owner 22500 + 36000 = 58500. Tradie 19000 + 35100 = 54100.
    expect(approved).toMatchObject({ ok: true, job: { status: "on_site", ownerTotalCents: 58500, tradieTotalCents: 54100 } });
    expect((await listParts(t.db, job.id)).map((part) => part.status)).toEqual(["active"]);
  });

  it("declined by the owner, they are never charged", async () => {
    const s = await setup();
    const job = await onSite(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PSH-01")!.id, quantity: 2 }] });
    // Two shower heads: 2 x 11700 = 23400, over 15000.
    expect(added).toMatchObject({ ok: true, needsApproval: true, quote: { ownerTotalCents: 23400 } });
    const declined = await decideQuote(t.db, added.ok ? added.quote.id : "", false, `owner:${s.owner.ownerId}`);
    expect(declined).toMatchObject({ ok: true, job: { ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    expect((await listParts(t.db, job.id)).map((part) => part.status)).toEqual(["void"]);
  });

  it("cannot be stacked past the limit: 5200 of bulbs goes ahead, a 11700 shower head after it (16900) waits", async () => {
    const s = await setup();
    const job = await onSite(s);
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PLT-02")!.id, quantity: 4 }] })).toMatchObject({ ok: true, needsApproval: false });
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PSH-01")!.id, quantity: 1 }] })).toMatchObject({ ok: true, needsApproval: true });
  });

  it("follow the owner's own overall limit: NZ$50 set, so a NZ$65.75 flush valve waits", async () => {
    const s = await setup();
    await t.db.query("update public.properties set spend_limit_cents = 5000 where id = $1::uuid", [s.property.id]);
    const job = await onSite(s);
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PTL-02")!.id, quantity: 1 }] })).toMatchObject({ ok: true, needsApproval: true });
  });

  it("small parts up to NZ$30 are in the price: an off-list NZ$30.00 is refused, NZ$30.01 is charged 3601", async () => {
    const s = await setup();
    const job = await onSite(s);
    const refused = await addParts(t.db, job.id, s.tradie.tradieId, { list: [], offList: { description: "Washers and tape", receiptTotalCents: 3000, amountCents: 3000 } });
    expect(!refused.ok && refused.message).toContain("part of the job's price");
    // 3001: 20% is 600.2 -> 600; 15% of 600 is 90. Owner 3601, tradie 3511.
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { list: [], offList: { description: "Flexible hose", receiptTotalCents: 3001, amountCents: 3001 } });
    expect(added).toMatchObject({ ok: true, quote: { ownerTotalCents: 3601, tradieTotalCents: 3511 } });
  });

  it("are refused before Arrived, and from another tradie", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PTP-02")!.id, quantity: 1 }] })).toMatchObject({ ok: false });
    const other = await makeTradie(t.db, { name: "Someone Else" });
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    expect(await addParts(t.db, job.id, other.tradieId, { list: [{ itemId: s.items.get("PTP-02")!.id, quantity: 1 }] })).toMatchObject({ ok: false, message: "That job is not one of yours." });
  });
});

describe("a receipt to follow", () => {
  async function promised(s: Setup) {
    const job = await onSite(s);
    // NZ$100 off the list: owner 12000, tradie 11700. Inside the no-ask limit.
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { list: [], offList: { description: "15 mm copper elbows", receiptTotalCents: 10000, amountCents: 10000 } });
    if (!added.ok) throw new Error(added.message);
    expect(await finish(s, job.id)).toMatchObject({ ok: false, message: expect.stringContaining('tick "I will send the receipt later"') });
    const done = await finish(s, job.id, { receiptsToFollow: true });
    if (!done.ok) throw new Error(done.message);
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    // Owner charged as normal: 22500 + 12000 = 34500. The tradie's 19000 + 11700 = 30700 waits for the receipt.
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 34500 });
    expect(await payout(job.id)).toMatchObject({ status: "held", amount_cents: 30700 });
    return { job, part: (await listParts(t.db, job.id))[0]! };
  }

  it("holds the payout until the receipt comes; on Thursday it is released and sent", async () => {
    const s = await setup();
    const { job, part } = await promised(s);
    setTestNow(addHours(TEN_THIRTY, 48));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    const added = await attachReceipt(t.db, job.id, s.tradie.tradieId, part.id, { uploadId: await receipt(s), receiptDate: "2026-11-16" });
    expect(added).toMatchObject({ ok: true, flags: [] });
    // Due at its usual time (Tuesday 10:30am) or now, whichever is later: now, Wednesday 10:30am.
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 30700 });
    expect(new Date((await payout(job.id)).release_at).toISOString()).toBe(addHours(TEN_THIRTY, 48).toISOString());
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
  });

  it("7 days without it: the part's 12000 is refunded to the owner, and the tradie is paid 30700 - 11700 = 19000", async () => {
    const s = await setup();
    const { job } = await promised(s);
    setTestNow(addMinutes(addHours(TEN_THIRTY, 7 * 24), -1));
    expect(await refundMissingReceipts(t.db, gatewayFor(t.db))).toBe(0);
    setTestNow(addHours(TEN_THIRTY, 7 * 24));
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(report.receipts_refunded).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "part_refunded", amount_cents: 34500, refunded_cents: 12000 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 19000 });
    expect((await getJobForStaff(t.db, job.id))!).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect((await textsTo(t.db, s.tradie.phone, "receipt_missing_refunded"))[0]!.body).toContain("NZ$117 comes off your payment");
    expect((await textsTo(t.db, s.owner.user.phone!, "receipt_missing_refunded"))[0]!.body).toContain("(NZ$120) has been refunded to your card, because we did not get its receipt.");
    // Released in the same run: it went out with the others.
    expect((await payout(job.id)).status).toBe("sent");
    // Running again changes nothing.
    expect(await refundMissingReceipts(t.db, gatewayFor(t.db))).toBe(0);
    expect((await auditActions(t.db, job.id)).filter((action) => action === "parts.refunded_no_receipt")).toHaveLength(1);
  });
});

describe("receipt checks go straight to the team", () => {
  async function withReceipt(s: Setup, offList: { receiptTotalCents: number; amountCents: number; receiptDate?: string | null }, sha256?: string, property = s.property) {
    const job = await logJob(t.db, property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    setTestNow(MONDAY_10AM);
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { list: [], offList: { description: "Copper fittings", ...offList, uploadId: await receipt(s, sha256) } });
    if (!added.ok) throw new Error(added.message);
    const done = await finish(s, job.id);
    if (!done.ok) throw new Error(done.message);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    return { job, part: (await listParts(t.db, job.id))[0]! };
  }

  it("a receipt dated 17 Aug, 91 days before the job, is flagged and holds the payout; 18 Aug (90 days) is not", async () => {
    const s = await setup();
    const old = await withReceipt(s, { receiptTotalCents: 4550, amountCents: 4550, receiptDate: "2026-08-17" });
    expect(old.part).toMatchObject({ receiptFlags: ["old_receipt"], checkStatus: "flagged" });
    expect(await openExceptions(t.db, old.job.id)).toEqual(["receipt_check"]);
    // 22500 + 5460 charged; 19000 + 5323 = 24323 held.
    expect(await payout(old.job.id)).toMatchObject({ status: "held", amount_cents: 24323 });

    const ok = await withReceipt(s, { receiptTotalCents: 4550, amountCents: 4550, receiptDate: "2026-08-18" }, undefined, await makeProperty(t.db, s.owner.ownerId));
    expect(ok.part).toMatchObject({ receiptFlags: [], checkStatus: null });
    expect(await payout(ok.job.id)).toMatchObject({ status: "scheduled" });

    // The team approves: the payout is released at its usual time.
    expect(await staffDecideReceipts(t.db, old.job.id, true, "staff:maria")).toMatchObject({ ok: true, released: 24323 });
    expect(await payout(old.job.id)).toMatchObject({ status: "scheduled" });
    expect(await openExceptions(t.db, old.job.id)).toEqual([]);
  });

  it("an amount for the job bigger than the receipt is flagged; Hold keeps the payout held and tells the tradie neutrally", async () => {
    const s = await setup();
    const { job, part } = await withReceipt(s, { receiptTotalCents: 4000, amountCents: 4550 });
    expect(part.receiptFlags).toEqual(["over_receipt"]);
    expect(await staffDecideReceipts(t.db, job.id, false, "staff:maria", "Ringing the tradie")).toMatchObject({ ok: true, released: 0 });
    expect(await payout(job.id)).toMatchObject({ status: "held" });
    expect((await textsTo(t.db, s.tradie.phone, "receipt_check_held"))[0]!.body).toContain("we are checking a receipt on this job");
  });

  it("the same receipt on two jobs claiming more than its total is flagged: by the same file, or by the same tradie, total and date", async () => {
    const s = await setup();
    // A 10000 receipt: 6000 on the first job is fine; another 6000 on a second job makes 12000.
    const first = await withReceipt(s, { receiptTotalCents: 10000, amountCents: 6000 }, "same-file");
    expect(first.part.receiptFlags).toEqual([]);
    const second = await withReceipt(s, { receiptTotalCents: 10000, amountCents: 6000 }, "same-file", await makeProperty(t.db, s.owner.ownerId));
    expect(second.part.receiptFlags).toEqual(["reused_receipt"]);
    // 4000 more on a third job, of a different-looking copy of the same receipt: 6000 + 6000 + 4000 > 10000, matched by tradie, total and date.
    const a = await withReceipt(s, { receiptTotalCents: 8000, amountCents: 5000, receiptDate: "2026-11-14" }, "photo-a", await makeProperty(t.db, s.owner.ownerId));
    const b = await withReceipt(s, { receiptTotalCents: 8000, amountCents: 4000, receiptDate: "2026-11-14" }, "photo-b", await makeProperty(t.db, s.owner.ownerId));
    expect(a.part.receiptFlags).toEqual([]);
    expect(b.part.receiptFlags).toEqual(["reused_receipt"]);
  });
});

describe("who sees a receipt", () => {
  it("staff and the tradie who sent it. Never the owner, who sees the part, its price and 'receipt checked by HostFix'", async () => {
    const s = await setup();
    const job = await onSite(s);
    const receiptId = await receipt(s);
    await addParts(t.db, job.id, s.tradie.tradieId, { list: [], offList: { description: "Copper fittings", receiptTotalCents: 4550, amountCents: 4550, uploadId: receiptId } });
    const upload = (await getUpload(t.db, receiptId))!;
    const other = await makeTradie(t.db, { name: "Someone Else" });
    expect(await canView(t.db, upload, { staff: true })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: s.tradie.tradieId })).toBe(true);
    expect(await canView(t.db, upload, { ownerId: s.owner.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { tradieId: other.tradieId })).toBe(false);
    const ownerView = await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "owner");
    expect(ownerView.receipts).toEqual([]);
    expect(ownerView.workPhotos.some((photo) => photo.kind === "receipt")).toBe(false);
    expect(ownerView.parts).toEqual([expect.objectContaining({ description: "Copper fittings", ownerCents: 5460, receiptUploadId: null, receiptTotalCents: null, amountCents: 0, tradieCents: 0 })]);
    expect(ownerView.history.map((entry) => entry.title)).toContain("Receipt checked by HostFix");
    const staffView = await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "staff");
    expect(staffView.receipts.map((item) => item.id)).toEqual([receiptId]);
  });
});

describe("a job cancelled after the owner approved work", () => {
  it("is charged only for parts already bought that cannot go back, at their cost: owner 8650, tradie 8650, HostFix 0", async () => {
    const s = await setup();
    const job = await onSite(s);
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace the cistern", labourCents: 90000, uploadIds: [] });
    await decideQuote(t.db, quoted.ok ? quoted.quote.id : "", true, `owner:${s.owner.ownerId}`);
    expect(await cancelJob(t.db, job.id, { actor: "staff:maria", staff: true }, "Owner is replacing the whole bathroom")).toMatchObject({ ok: true });
    expect(await chargeBoughtParts(t.db, job.id, { description: "Cistern kit, special order", amountCents: 8650 }, "staff:maria")).toMatchObject({ ok: true, job: { ownerTotalCents: 8650, tradieTotalCents: 8650 } });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 8650 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 8650 });
    expect((await textsTo(t.db, s.owner.user.phone!, "bought_parts_charged"))[0]!.body).toContain("NZ$86.50, their cost with nothing added");
    // Once only.
    expect(await chargeBoughtParts(t.db, job.id, { description: "Again", amountCents: 100 }, "staff:maria")).toMatchObject({ ok: false });
  });

  it("is refused when nothing had been approved", async () => {
    const s = await setup();
    const job = await onSite(s);
    await cancelJob(t.db, job.id, { actor: "staff:maria", staff: true }, "Changed plans");
    expect(await chargeBoughtParts(t.db, job.id, { description: "Anything", amountCents: 5000 }, "staff:maria")).toMatchObject({ ok: false });
  });
});

describe("could not get in", () => {
  it("takes every part off: only the call-out is charged", async () => {
    const s = await setup();
    const job = await onSite(s);
    await addParts(t.db, job.id, s.tradie.tradieId, { list: [{ itemId: s.items.get("PTP-02")!.id, quantity: 1 }] });
    setTestNow(TEN_THIRTY);
    const result = await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Lockbox code did not work.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
    expect(result).toMatchObject({ ok: true, job: { ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    expect((await listParts(t.db, job.id)).map((part) => part.status)).toEqual(["void"]);
    expect((await listQuotes(t.db, job.id)).length).toBe(1);
    expect((await getMarket(t.db, "queenstown"))!.partsIncludedCents).toBe(3000);
  });
});
