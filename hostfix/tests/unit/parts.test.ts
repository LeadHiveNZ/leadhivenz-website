import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargeJob, releaseDuePayouts } from "@/lib/billing/settle";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { runTick } from "@/lib/dispatch/tick";
import { canView, getUpload } from "@/lib/files/uploads";
import { cancelJob } from "@/lib/jobs/create";
import { addParts, attachReceipt, chargeBoughtParts, listParts, listPriceList, overListPrice, refundMissingReceipts, requestReceipt, staffDecideReceipts } from "@/lib/jobs/parts";
import { listPartLine, partsApproval, pricedPartLine, receiptPartLine } from "@/lib/jobs/pricing";
import { getJobForStaff, insertLines, listQuotes, recalcTotals } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { loadJobView } from "@/lib/jobs/view";
import { completeJob, decideQuote, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { getMarket } from "@/lib/markets/store";
import { testDb } from "./db";
import { arrive, auditActions, gatewayFor, HOUSE, liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, openExceptions, photo, textsTo, messagesTo } from "./factory";

/**
 * PARTS (DECISIONS.md, 2026-11-23). Every amount is worked out by hand, never
 * copied from what the code returns.
 *
 *   PL-01 Toilet seat or cistern parts: owner 22500, tradie 19000 (seed/menu-queenstown.json).
 *   A part from 23 Nov 2026: the tradie's own price including GST. The owner pays it; the tradie gets it less 3%
 *   (rounded to the cent); HostFix keeps the 3%.
 *     4500: 3% is 135, tradie 4365.     3500: 3% is 105, tradie 3395.
 *     36000: 3% is 1080, tradie 34920.  2001: 3% is 60.03 -> 60, tradie 1941.
 *     4 x 1300 = 5200: 3% is 156, tradie 5044.  2 x 11700 = 23400.
 *   Small parts up to 2000 (NZ$20) are in the price: a part costing that or less (price times how many) is refused.
 *   No-ask parts limit 15000; overall limit 60000.
 *   The price list is quick picks only. PTP-02 mixer cartridge is listed at 3141: 1.5 times that is 4711.5, so a
 *   price of 4712 (x 2 = 9424 > 3 x 3141 = 9423) goes to the queue for a look, and 4711 (9422) does not.
 *
 *   Parts added before 23 Nov 2026 keep their terms (DECISIONS.md, 2026-11-20): off the list, the receipt plus 20%,
 *   HostFix keeping 15% of the 20%. 10000: owner 12000, tradie 11700. 4550: 20% is 910; 15% of 910 is 136.5 -> 137;
 *   owner 5460, tradie 5323. Those rows are written here the way the 20 Nov code wrote them.
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

async function onSite(s: Setup, overrides: Parameters<typeof logJob>[2] = {}, property = s.property): Promise<Job> {
  const job = await logJob(t.db, property, { code: "PL-01", ...overrides });
  const [offer] = await offersFor(t.db, job.id);
  await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
  setTestNow(MONDAY_10AM);
  const arrived = await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
  if (!arrived.ok) throw new Error(arrived.message);
  setTestNow(addMinutes(MONDAY_10AM, 5));
  return arrived.job;
}

async function finish(s: Setup, jobId: string, options: { receiptsToFollow?: boolean } = {}) {
  setTestNow(TEN_THIRTY);
  return completeJob(t.db, jobId, s.tradie.tradieId, { note: "Done.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE, ...options });
}

const part = (name: string, unitCents: number, quantity = 1, priceListItemId: string | null = null) => ({ name, unitCents, quantity, priceListItemId });
const receipt = (s: Setup, sha256?: string) => photo(t.db, `tradie:${s.tradie.tradieId}`, "receipt", sha256 ? { sha256 } : {});
const payout = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number; release_at: Date }>("select status, amount_cents, release_at from public.payouts where job_id = $1::uuid", [jobId]))[0]!;
const payment = async (jobId: string) => (await t.db.query<{ status: string; amount_cents: number; refunded_cents: number }>("select status, amount_cents, refunded_cents from public.payments where job_id = $1::uuid", [jobId]))[0]!;

/**
 * An off-list part added before 23 November 2026 (DECISIONS.md, 2026-11-20), written the way that code wrote it: a
 * receipt part at the receipt amount plus 20%, with no receipt yet. Its terms stay.
 */
async function legacyReceiptPart(s: Setup, job: Job, input: { description: string; receiptTotalCents: number; amountCents: number; receiptDate?: string | null }) {
  const market = (await getMarket(t.db, "queenstown"))!;
  const line = receiptPartLine(market, input.description, input.amountCents);
  const at = new Date("2026-11-16T21:05:00.000Z");
  const quote = await t.db.query<{ id: string }>(
    `insert into public.quotes (created_at, job_id, tradie_id, description, labour_cents, parts_cents, owner_total_cents, tradie_total_cents, needs_approval, status, decided_at, decided_by)
     values ($1::timestamptz, $2::uuid, $3::uuid, $4, 0, $5, $6, $7, false, 'auto_approved', $1::timestamptz, 'system') returning id`,
    [at.toISOString(), job.id, s.tradie.tradieId, `Parts: ${input.description}`, input.amountCents, line.ownerCents, line.tradieCents],
  );
  const rows = await t.db.query<{ id: string }>(
    `insert into public.job_parts (created_at, job_id, tradie_id, quote_id, kind, description, quantity, receipt_total_cents, amount_cents, owner_cents, tradie_cents, status, receipt_status, receipt_date)
     values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, 'receipt', $5, 1, $6, $7, $8, $9, 'active', 'needed', $10::date) returning id`,
    [at.toISOString(), job.id, s.tradie.tradieId, quote[0]!.id, input.description, input.receiptTotalCents, input.amountCents, line.ownerCents, line.tradieCents, input.receiptDate ?? null],
  );
  await insertLines(t.db, job.id, [line], { at, quoteId: quote[0]!.id, partId: rows[0]!.id });
  await recalcTotals(t.db, job.id, market.taxRate, market.taxRegistered);
  return rows[0]!.id;
}

describe("the sums", () => {
  it("a part at the tradie's own price: that price to the owner, less 3% to the tradie", () => {
    expect(pricedPartLine("Mixer tap cartridge (40 mm)", 4500, 1)).toEqual({ kind: "parts", label: "Mixer tap cartridge (40 mm)", ownerCents: 4500, tradieCents: 4365 });
    expect(pricedPartLine("GU10 LED downlight bulb", 1300, 4)).toEqual({ kind: "parts", label: "GU10 LED downlight bulb x 4", ownerCents: 5200, tradieCents: 5044 });
    expect(pricedPartLine("Flexible hose", 2001, 1)).toMatchObject({ ownerCents: 2001, tradieCents: 1941 });
    expect(() => pricedPartLine("x", 1300, 0)).toThrow();
  });

  it("parts added before 23 Nov 2026 keep their sums: the list price less 3%, or the receipt plus 20% (NZ$300: owner 360, tradie 351)", () => {
    expect(listPartLine("Mixer tap cartridge (40 mm)", 3141, 1)).toEqual({ kind: "parts", label: "Mixer tap cartridge (40 mm)", ownerCents: 3141, tradieCents: 3047 });
    expect(receiptPartLine({ platformFeeBps: 1500 }, "Cylinder element", 30000)).toMatchObject({ ownerCents: 36000, tradieCents: 35100 });
  });

  it("asks first above NZ$150 of parts on the job, or above the property's overall limit", () => {
    const market = { partsApprovalCents: 15000, approvalThresholdCents: 60000 };
    expect(partsApproval(market, { newPartsCents: 15000, partsSoFarCents: 0, extrasSoFarCents: 0 }).needsApproval).toBe(false);
    expect(partsApproval(market, { newPartsCents: 15001, partsSoFarCents: 0, extrasSoFarCents: 0 }).needsApproval).toBe(true);
    expect(partsApproval(market, { newPartsCents: 10000, partsSoFarCents: 5200, extrasSoFarCents: 5200 }).needsApproval).toBe(true);
    expect(partsApproval(market, { newPartsCents: 5000, partsSoFarCents: 0, extrasSoFarCents: 56000 }).needsApproval).toBe(true);
    expect(partsApproval(market, { newPartsCents: 5000, partsSoFarCents: 0, extrasSoFarCents: 0, limitCents: 4000 }).reason).toContain("pre-approved limit");
  });

  it("a part picked from the list is looked at above 1.5 times its list price: 4712 against 3141 is, 4711 is not", () => {
    expect(overListPrice(4712, 3141)).toBe(true);
    expect(overListPrice(4711, 3141)).toBe(false);
    expect(overListPrice(3000, 2000)).toBe(false);
    expect(overListPrice(3001, 2000)).toBe(true);
  });
});

describe("the price list", () => {
  it("is loaded from seed/parts-queenstown.json at the researched prices, in cents, as quick picks", async () => {
    const list = await listPriceList(t.db, "queenstown");
    expect(Object.fromEntries(list.map((item) => [item.code, item.priceCents]))).toEqual({
      "PSA-01": 3998, "PTP-01": 1173, "PTP-02": 3141, "PTL-01": 2624, "PTL-02": 6575, "PTL-03": 7561,
      "PSH-01": 11700, "PLT-01": 1593, "PLT-02": 1300, "PEL-01": 1513, "PEL-02": 1444,
    });
    expect(list.every((item) => /bunnings\.co\.nz|mitre10\.co\.nz/.test(item.source) && item.source.includes("19 Nov 2026"))).toBe(true);
  });
});

describe("parts on a menu job", () => {
  it("inside the NZ$150 no-ask limit are added straight away and the owner is texted: 22500 + 4500 + 3500 = 30500 charged", async () => {
    const s = await setup();
    const job = await onSite(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Mixer tap cartridge (40 mm)", 4500), part("Cistern inlet valve", 3500)] });
    expect(added).toMatchObject({ ok: true, needsApproval: false, quote: { status: "auto_approved", labourCents: 0, ownerTotalCents: 8000, tradieTotalCents: 4365 + 3395 } });
    // Owner 22500 + 4500 + 3500 = 30500. Tradie 19000 + 4365 + 3395 = 26760.
    expect(added.ok && added.job).toMatchObject({ status: "on_site", ownerTotalCents: 30500, tradieTotalCents: 26760 });
    expect((await listParts(t.db, job.id)).map((p) => ({ kind: p.kind, receipt: p.receiptStatus }))).toEqual([{ kind: "priced", receipt: "not_needed" }, { kind: "priced", receipt: "not_needed" }]);
    const [text] = await textsTo(t.db, s.owner.user.phone!, "parts_added");
    expect(text!.body).toContain("Wakatipu Plumbing needs Mixer tap cartridge..., NZ$80, within your NZ$150 limit.");
    // No receipt needed: Job done goes through without one.
    const done = await finish(s, job.id);
    expect(done).toMatchObject({ ok: true, job: { ownerTotalCents: 30500, tradieTotalCents: 26760, checkFlags: [] } });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 30500 });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 26760 });
    // HostFix keeps 3500 on the job and 135 + 105 on the parts.
    expect(30500 - 26760).toBe(3500 + 135 + 105);
  });

  it("above the limit wait for the owner's yes in the app before anything is bought, through the same approval as a quote", async () => {
    const s = await setup();
    const job = await onSite(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Hot water cylinder element", 36000)] });
    expect(added).toMatchObject({ ok: true, needsApproval: true, quote: { status: "pending", ownerTotalCents: 36000 } });
    expect(added.ok && added.job).toMatchObject({ status: "awaiting_approval", ownerTotalCents: 22500 });
    expect((await textsTo(t.db, s.owner.user.phone!, "parts_need_approval"))[0]!.body).toContain("needs Hot water cylinder..., NZ$360. Yes or no:");
    expect(await finish(s, job.id)).toMatchObject({ ok: false });
    const approved = await decideQuote(t.db, added.ok ? added.quote.id : "", true, `owner:${s.owner.ownerId}`);
    // Owner 22500 + 36000 = 58500. Tradie 19000 + 34920 = 53920.
    expect(approved).toMatchObject({ ok: true, job: { status: "on_site", ownerTotalCents: 58500, tradieTotalCents: 53920 } });
    expect((await listParts(t.db, job.id)).map((p) => p.status)).toEqual(["active"]);
  });

  it("declined by the owner, they are never charged", async () => {
    const s = await setup();
    const job = await onSite(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Shower head, fixed", 11700, 2, s.items.get("PSH-01")!.id)] });
    // Two shower heads: 2 x 11700 = 23400, over 15000.
    expect(added).toMatchObject({ ok: true, needsApproval: true, quote: { ownerTotalCents: 23400 } });
    const declined = await decideQuote(t.db, added.ok ? added.quote.id : "", false, `owner:${s.owner.ownerId}`);
    expect(declined).toMatchObject({ ok: true, job: { ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    expect((await listParts(t.db, job.id)).map((p) => p.status)).toEqual(["void"]);
  });

  it("cannot be stacked past the limit: 5200 of bulbs goes ahead, a 11700 shower head after it (16900) waits", async () => {
    const s = await setup();
    const job = await onSite(s);
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("GU10 LED downlight bulb", 1300, 4)] })).toMatchObject({ ok: true, needsApproval: false });
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Shower head", 11700)] })).toMatchObject({ ok: true, needsApproval: true });
  });

  it("follow the owner's own overall limit: NZ$50 set, so a NZ$65.75 flush valve waits", async () => {
    const s = await setup();
    await t.db.query("update public.properties set spend_limit_cents = 5000 where id = $1::uuid", [s.property.id]);
    const job = await onSite(s);
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Flush valve and button", 6575)] })).toMatchObject({ ok: true, needsApproval: true });
  });

  it("small parts up to NZ$20 are in the price: NZ$20.00 (or 2 at NZ$10) is refused, NZ$20.01 is charged 2001", async () => {
    const s = await setup();
    expect((await getMarket(t.db, "queenstown"))!.partsIncludedCents).toBe(2000);
    const job = await onSite(s);
    const refused = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Washers and tape", 2000)] });
    expect(!refused.ok && refused.message).toContain("part of the job's price");
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Two washers", 1000, 2)] })).toMatchObject({ ok: false });
    // A single list bulb at NZ$13 is a small part now too: the list only fills in a price.
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("GU10 LED downlight bulb", 1300, 1, s.items.get("PLT-02")!.id)] })).toMatchObject({ ok: false });
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Flexible hose", 2001)] });
    expect(added).toMatchObject({ ok: true, quote: { ownerTotalCents: 2001, tradieTotalCents: 1941 } });
  });

  it("are refused before Arrived, from another tradie, and without a name or a price", async () => {
    const s = await setup();
    const job = await logJob(t.db, s.property, { code: "PL-01" });
    const [offer] = await offersFor(t.db, job.id);
    await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Mixer tap cartridge", 4500)] })).toMatchObject({ ok: false });
    const other = await makeTradie(t.db, { name: "Someone Else" });
    await arrive(t.db, job.id, s.tradie.tradieId, HOUSE);
    expect(await addParts(t.db, job.id, other.tradieId, { parts: [part("Mixer tap cartridge", 4500)] })).toMatchObject({ ok: false, message: "That job is not one of yours." });
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("x", 4500)] })).toMatchObject({ ok: false });
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Mixer tap cartridge", 0)] })).toMatchObject({ ok: false });
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [] })).toMatchObject({ ok: false });
  });
});

describe("a part priced well over the price list", () => {
  it("goes to the queue for a look and holds nothing: 4712 against the 3141 list price; 4711 does not", async () => {
    const s = await setup();
    const job = await onSite(s);
    const cartridge = s.items.get("PTP-02")!;
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part(cartridge.name, 4711, 1, cartridge.id)] })).toMatchObject({ ok: true });
    expect(await openExceptions(t.db, job.id)).toEqual([]);
    expect(await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part(cartridge.name, 4712, 1, cartridge.id)] })).toMatchObject({ ok: true });
    expect(await openExceptions(t.db, job.id)).toEqual(["part_price"]);
    const flag = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'part_price'", [job.id]);
    expect(flag[0]!.summary).toContain("priced \"Mixer tap cartridge (40 mm)\" at NZ$47.12 each, more than 1.5 times its price-list price of NZ$31.41");
    expect(flag[0]!.summary).toContain("Nothing is held");
    expect(flag[0]!.summary).not.toMatch(/overcharg|fraud|suspicious/i);
    expect((await listParts(t.db, job.id)).map((p) => p.listPriceCents)).toEqual([3141, 3141]);
    // Owner 22500 + 4711 + 4712 = 31923; the payout is scheduled as normal.
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    expect(await payment(job.id)).toMatchObject({ amount_cents: 31923 });
    expect((await payout(job.id)).status).toBe("scheduled");
  });
});

describe("a receipt the team asks for (a spot check)", () => {
  async function checked(s: Setup) {
    const job = await onSite(s);
    const added = await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Mixer tap cartridge (40 mm)", 4500)] });
    if (!added.ok) throw new Error(added.message);
    await finish(s, job.id);
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    // Owner 22500 + 4500 = 27000: 22500 from the hold placed at booking, 4500 charged beyond it.
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 27000 });
    const [cartridge] = await listParts(t.db, job.id);
    setTestNow(addHours(TEN_THIRTY, 2));
    const asked = await requestReceipt(t.db, cartridge!.id, "staff:maria");
    expect(asked).toMatchObject({ ok: true, part: { receiptStatus: "requested" } });
    // The tradie's 19000 + 4365 = 23365 waits for it.
    expect(await payout(job.id)).toMatchObject({ status: "held", amount_cents: 23365 });
    const told = await messagesTo(t.db, s.tradie.phone, "receipt_requested");
    expect(told[0]!.body).toContain("spot check. Add the receipt for");
    expect(told[0]!.body).not.toMatch(/wrong|suspicious|fraud/i);
    return { job, part: cartridge! };
  }

  it("holds the payout until it arrives, then lets it go at its usual time (or now, if that has passed)", async () => {
    const s = await setup();
    const { job, part: cartridge } = await checked(s);
    setTestNow(addHours(TEN_THIRTY, 30));
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(0);
    const added = await attachReceipt(t.db, job.id, s.tradie.tradieId, cartridge.id, { uploadId: await receipt(s), receiptDate: "2026-11-15" });
    expect(added).toMatchObject({ ok: true, flags: [] });
    expect(await payout(job.id)).toMatchObject({ status: "scheduled", amount_cents: 23365 });
    expect(await releaseDuePayouts(t.db, gatewayFor(t.db))).toBe(1);
    // Asking twice changes nothing, and a part with a receipt cannot be asked for again.
    expect(await requestReceipt(t.db, cartridge.id, "staff:maria")).toMatchObject({ ok: false });
  });

  it("7 days without it: the part's 4500 is refunded to the owner, and the tradie is paid 23365 - 4365 = 19000", async () => {
    const s = await setup();
    const { job } = await checked(s);
    const asked = addHours(TEN_THIRTY, 2);
    setTestNow(addMinutes(addHours(asked, 7 * 24), -1));
    expect(await refundMissingReceipts(t.db, gatewayFor(t.db))).toBe(0);
    setTestNow(addHours(asked, 7 * 24));
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db), log: { error: () => {} } });
    expect(report.receipts_refunded).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "part_refunded", amount_cents: 27000, refunded_cents: 4500 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 19000 });
    expect((await getJobForStaff(t.db, job.id))!).toMatchObject({ ownerTotalCents: 22500, tradieTotalCents: 19000 });
    expect((await messagesTo(t.db, s.tradie.phone, "receipt_missing_refunded"))[0]!.body).toContain("NZ$43.65 came off your pay");
    expect((await messagesTo(t.db, s.owner.user.phone!, "receipt_missing_refunded"))[0]!.body).toContain("(NZ$45) was refunded to your card: no receipt came.");
    expect((await payout(job.id)).status).toBe("sent");
    expect(await refundMissingReceipts(t.db, gatewayFor(t.db))).toBe(0);
    expect((await auditActions(t.db, job.id)).filter((action) => action === "parts.refunded_no_receipt")).toHaveLength(1);
  });

  it("a receipt sent that is the same file as one on another job is flagged for the team", async () => {
    const s = await setup();
    const first = await checked(s);
    await attachReceipt(t.db, first.job.id, s.tradie.tradieId, first.part.id, { uploadId: await receipt(s, "one-receipt"), receiptDate: null });
    setTestNow(MONDAY_10AM);
    const second = await onSite(s, {}, await makeProperty(t.db, s.owner.ownerId));
    const added = await addParts(t.db, second.id, s.tradie.tradieId, { parts: [part("Mixer tap cartridge (40 mm)", 4500)] });
    if (!added.ok) throw new Error(added.message);
    const [cartridge] = await listParts(t.db, second.id);
    await requestReceipt(t.db, cartridge!.id, "staff:maria");
    const sent = await attachReceipt(t.db, second.id, s.tradie.tradieId, cartridge!.id, { uploadId: await receipt(s, "one-receipt"), receiptDate: null });
    expect(sent).toMatchObject({ ok: true, flags: ["reused_receipt"] });
    expect(await openExceptions(t.db, second.id)).toEqual(["receipt_check"]);
  });
});

describe("parts added before 23 Nov 2026 keep their terms", () => {
  it("a receipt to follow holds the payout, and 7 days without it refunds 12000 and pays 30700 - 11700 = 19000", async () => {
    const s = await setup();
    const job = await onSite(s);
    await legacyReceiptPart(s, job, { description: "15 mm copper elbows", receiptTotalCents: 10000, amountCents: 10000 });
    expect(await finish(s, job.id)).toMatchObject({ ok: false, message: expect.stringContaining('tick "I will send the receipt later"') });
    const done = await finish(s, job.id, { receiptsToFollow: true });
    if (!done.ok) throw new Error(done.message);
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    // Owner 22500 + 12000 = 34500. The tradie's 19000 + 11700 = 30700 waits for the receipt.
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 34500 });
    expect(await payout(job.id)).toMatchObject({ status: "held", amount_cents: 30700 });
    setTestNow(addHours(TEN_THIRTY, 7 * 24));
    expect(await refundMissingReceipts(t.db, gatewayFor(t.db))).toBe(1);
    expect(await payment(job.id)).toMatchObject({ status: "part_refunded", refunded_cents: 12000 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 19000 });
  });

  it("a receipt dated 17 Aug, 91 days before the job, is flagged and holds the payout until the team approves", async () => {
    const s = await setup();
    const job = await onSite(s);
    const partId = await legacyReceiptPart(s, job, { description: "Copper fittings", receiptTotalCents: 4550, amountCents: 4550 });
    const added = await attachReceipt(t.db, job.id, s.tradie.tradieId, partId, { uploadId: await receipt(s), receiptDate: "2026-08-17" });
    expect(added).toMatchObject({ ok: true, flags: ["old_receipt"] });
    await finish(s, job.id);
    await chargeJob(t.db, gatewayFor(t.db), job.id);
    // 22500 + 5460 charged; 19000 + 5323 = 24323 held.
    expect(await payout(job.id)).toMatchObject({ status: "held", amount_cents: 24323 });
    expect(await staffDecideReceipts(t.db, job.id, false, "staff:maria", "Ringing the tradie")).toMatchObject({ ok: true, released: 0 });
    expect((await messagesTo(t.db, s.tradie.phone, "receipt_check_held"))[0]!.body).toContain("we are checking a receipt, so your payment is on hold");
    expect(await staffDecideReceipts(t.db, job.id, true, "staff:maria")).toMatchObject({ ok: true, released: 24323 });
  });
});

describe("who sees a receipt", () => {
  it("staff and the tradie who sent it. Never the owner, who sees the part, its price and who priced it", async () => {
    const s = await setup();
    const job = await onSite(s);
    await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Copper fittings", 4550)] });
    const [fittings] = await listParts(t.db, job.id);
    await requestReceipt(t.db, fittings!.id, "staff:maria");
    const receiptId = await receipt(s);
    await attachReceipt(t.db, job.id, s.tradie.tradieId, fittings!.id, { uploadId: receiptId, receiptDate: null });
    const upload = (await getUpload(t.db, receiptId))!;
    const other = await makeTradie(t.db, { name: "Someone Else" });
    expect(await canView(t.db, upload, { staff: true })).toBe(true);
    expect(await canView(t.db, upload, { tradieId: s.tradie.tradieId })).toBe(true);
    expect(await canView(t.db, upload, { ownerId: s.owner.ownerId })).toBe(false);
    expect(await canView(t.db, upload, { tradieId: other.tradieId })).toBe(false);
    const ownerView = await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "owner");
    expect(ownerView.receipts).toEqual([]);
    expect(ownerView.workPhotos.some((photo) => photo.kind === "receipt")).toBe(false);
    expect(ownerView.parts).toEqual([expect.objectContaining({ description: "Copper fittings", ownerCents: 4550, receiptUploadId: null, receiptTotalCents: null, amountCents: 0, tradieCents: 0 })]);
    const staffView = await loadJobView(t.db, (await getJobForStaff(t.db, job.id))!, "staff");
    expect(staffView.receipts.map((item) => item.id)).toEqual([receiptId]);
  });
});

describe("a job cancelled after the owner approved work", () => {
  it("is charged only for parts already bought that cannot go back, at their cost: owner 8650, tradie 8650, HostFix 0", async () => {
    const s = await setup();
    const job = await onSite(s);
    const quoted = await submitQuote(t.db, job.id, s.tradie.tradieId, { description: "Replace the cistern", hours: 5.75, uploadIds: [] });
    await decideQuote(t.db, quoted.ok ? quoted.quote.id : "", true, `owner:${s.owner.ownerId}`);
    // Our team cancels without the call-out (the owner rang), so only the bought parts are charged.
    expect(await cancelJob(t.db, job.id, { actor: "staff:maria", staff: true }, "Owner is replacing the whole bathroom")).toMatchObject({ ok: true });
    expect(await chargeBoughtParts(t.db, job.id, { description: "Cistern kit, special order", amountCents: 8650 }, "staff:maria")).toMatchObject({ ok: true, job: { ownerTotalCents: 8650, tradieTotalCents: 8650 } });
    expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
    expect(await payment(job.id)).toMatchObject({ status: "succeeded", amount_cents: 8650 });
    expect(await payout(job.id)).toMatchObject({ amount_cents: 8650 });
    expect((await messagesTo(t.db, s.owner.user.phone!, "bought_parts_charged"))[0]!.body).toContain("NZ$86.50, their cost, is charged");
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
    await addParts(t.db, job.id, s.tradie.tradieId, { parts: [part("Mixer tap cartridge (40 mm)", 4500)] });
    setTestNow(TEN_THIRTY);
    const result = await reportNoAccess(t.db, job.id, s.tradie.tradieId, { note: "Lockbox code did not work.", uploadIds: [await photo(t.db, `tradie:${s.tradie.tradieId}`)], ...HOUSE });
    expect(result).toMatchObject({ ok: true, job: { ownerTotalCents: 22500, tradieTotalCents: 19000 } });
    expect((await listParts(t.db, job.id)).map((p) => p.status)).toEqual(["void"]);
    expect((await listQuotes(t.db, job.id)).length).toBe(1);
  });
});
