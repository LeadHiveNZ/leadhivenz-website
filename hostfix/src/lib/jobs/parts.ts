import { audit } from "@/lib/audit";
import { holdPayout, releaseIfClear } from "@/lib/billing/holds";
import { openSettlement } from "@/lib/billing/settle";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { attachUploads } from "@/lib/files/uploads";
import { formatMoney } from "@/lib/money";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import type { PaymentsGateway, Provider } from "@/lib/payments/gateway";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { loadContext, offerUrl, ownerJobUrl } from "./context";
import { baseUrl } from "@/lib/env";
import { partsApproval, pricedPartLine, taxPortion, type Line } from "./pricing";
import { refundAcross } from "@/lib/billing/settle";
import { getJobForStaff, insertLines, lockJob, recalcTotals, rowToQuote } from "./store";
import type { Job, Quote } from "./types";

/**
 * PARTS ON A JOB (DECISIONS.md, 2026-11-23). On any job, menu jobs included.
 *
 *   small parts      up to the market's included amount (NZ$20): in the
 *                    price, never added. A part costing that or less (its
 *                    price times how many) is refused.
 *   the tradie's     every other part: what it is, how many, and the tradie's
 *   price            own price for one, including GST (their cost plus their
 *                    own usual markup). The owner pays that; the tradie gets
 *                    it less 3% (the card fee), which HostFix keeps. No
 *                    receipt is needed.
 *   the price list   the market's list (price_list_items) is a set of quick
 *                    picks that fill in a name and a price, which the tradie
 *                    can change. A part picked from it but priced over 1.5
 *                    times its list price goes to the queue for a look.
 *                    Nothing is held for that.
 *   asking first     up to the market's parts limit (NZ$150) for the job, and
 *                    inside the property's overall limit, parts are added
 *                    straight away and the owner is texted. Above that the
 *                    owner says yes in the app before the tradie buys them:
 *                    the same quote approval as extra work.
 *   a spot check     our team can ask for the receipt for any part, from the
 *                    job page. The tradie is texted; their payment for the job
 *                    waits for it. No receipt in 7 days: the part is refunded
 *                    to the owner out of that payment, and the tradie is told.
 *                    A receipt sent is checked: a date more than 90 days before
 *                    the job, or the same file used on another job, holds the
 *                    payment for the team to Approve or Hold.
 *
 * Parts added before 23 November 2026 keep their terms (DECISIONS.md,
 * 2026-11-20): a price-list part at its list price, an off-list part from its
 * receipt plus 20%, "receipt to follow" at Job done, and the receipt checks
 * (dated over 90 days before the job, an amount over the receipt, the same
 * receipt over-used). Those rows still work as they did.
 */

export const RECEIPT_TO_FOLLOW_DAYS = 7;
export const OLD_RECEIPT_DAYS = 90;
export const MAX_QUANTITY = 50;
/** How many part rows the Add parts form has. */
export const PART_ROWS = 4;
/** A part picked from the price list but priced over this many times its list price goes to the queue for a look. */
export const PART_PRICE_FLAG_MULTIPLE = 1.5;

export type ReceiptFlag = "old_receipt" | "over_receipt" | "reused_receipt";

export type PriceListItem = { id: string; market: string; code: string; name: string; priceCents: number; active: boolean; sort: number; source: string };

type PriceRow = { id: string; market: string; code: string; name: string; price_cents: number; active: boolean; sort: number; source: string };
const rowToItem = (row: PriceRow): PriceListItem => ({
  id: row.id, market: row.market, code: row.code, name: row.name, priceCents: Number(row.price_cents), active: row.active, sort: Number(row.sort), source: row.source,
});

export async function listPriceList(db: Db, market: string, options: { includeInactive?: boolean } = {}): Promise<PriceListItem[]> {
  const rows = await db.query<PriceRow>(
    "select * from public.price_list_items where market = $1 and ($2::boolean or active) order by sort, name",
    [market, options.includeInactive ?? false],
  );
  return rows.map(rowToItem);
}

export type JobPart = {
  id: string;
  createdAt: Date;
  jobId: string;
  tradieId: string;
  quoteId: string | null;
  /** priced: the tradie's own price (from 23 Nov 2026). list and receipt: added before then. */
  kind: "list" | "receipt" | "priced";
  description: string;
  quantity: number;
  unitCents: number | null;
  receiptTotalCents: number | null;
  amountCents: number;
  ownerCents: number;
  tradieCents: number;
  status: "pending" | "active" | "void";
  receiptStatus: "not_needed" | "needed" | "attached" | "to_follow" | "requested" | "refunding" | "refunded";
  receiptUploadId: string | null;
  receiptDate: string | null;
  receiptFlags: ReceiptFlag[];
  checkStatus: "flagged" | "approved" | "held" | null;
  /** A priced part picked from the price list: the list price it was compared with. */
  listPriceCents: number | null;
  /** When our team asked for the receipt (a spot check), if they did. */
  receiptRequestedAt: Date | null;
};

type PartRow = {
  id: string; created_at: Date; job_id: string; tradie_id: string; quote_id: string | null; kind: JobPart["kind"]; description: string;
  quantity: number; unit_cents: number | null; receipt_total_cents: number | null; amount_cents: number; owner_cents: number; tradie_cents: number;
  status: JobPart["status"]; receipt_status: JobPart["receiptStatus"]; receipt_upload_id: string | null; receipt_date: string | Date | null;
  receipt_flags: string[] | null; check_status: JobPart["checkStatus"]; list_price_cents?: number | null; receipt_requested_at?: Date | null;
};

const dateOnly = (value: string | Date | null): string | null => {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

function rowToPart(row: PartRow): JobPart {
  return {
    id: row.id, createdAt: new Date(row.created_at), jobId: row.job_id, tradieId: row.tradie_id, quoteId: row.quote_id, kind: row.kind,
    description: row.description, quantity: Number(row.quantity), unitCents: row.unit_cents === null ? null : Number(row.unit_cents),
    receiptTotalCents: row.receipt_total_cents === null ? null : Number(row.receipt_total_cents), amountCents: Number(row.amount_cents),
    ownerCents: Number(row.owner_cents), tradieCents: Number(row.tradie_cents), status: row.status, receiptStatus: row.receipt_status,
    receiptUploadId: row.receipt_upload_id, receiptDate: dateOnly(row.receipt_date), receiptFlags: (row.receipt_flags ?? []) as ReceiptFlag[],
    checkStatus: row.check_status,
    listPriceCents: row.list_price_cents === null || row.list_price_cents === undefined ? null : Number(row.list_price_cents),
    receiptRequestedAt: row.receipt_requested_at ? new Date(row.receipt_requested_at) : null,
  };
}

export async function listParts(db: Db, jobId: string): Promise<JobPart[]> {
  const rows = await db.query<PartRow>("select * from public.job_parts where job_id = $1::uuid order by created_at, id", [jobId]);
  return rows.map(rowToPart);
}

async function lockPart(db: Db, partId: string): Promise<JobPart | null> {
  if (!/^[0-9a-f-]{36}$/i.test(partId)) return null;
  const rows = await db.query<PartRow>("select * from public.job_parts where id = $1::uuid for update", [partId]);
  return rows[0] ? rowToPart(rows[0]) : null;
}

export type PartsInput = {
  /**
   * Each part: what it is, how many, and the tradie's own price for one including GST (DECISIONS.md, 2026-11-23).
   * `priceListItemId` when it was picked from the price list (which filled in the name and price, both editable).
   */
  parts: { name: string; quantity: number; unitCents: number; priceListItemId?: string | null }[];
};

export type AddPartsResult = { ok: true; job: Job; quote: Quote; needsApproval: boolean; parts: JobPart[] } | { ok: false; message: string };

const NOT_YOURS = "That job is not one of yours.";

/** A date typed as YYYY-MM-DD, or null. Anything else is refused by the caller. */
function cleanDate(value: string | null | undefined): string | null | "bad" {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) return "bad";
  return value;
}

/** True when a part picked from the price list is priced over 1.5 times its list price: a NZ$40 part listed at NZ$31.41 is not (8000 is not more than 9423); NZ$47.20 against NZ$31.41 is (9440 > 9423). */
export function overListPrice(unitCents: number, listCents: number): boolean {
  return unitCents * 2 > listCents * 3;
}

/**
 * The tradie adds parts at their own prices. Inside the no-ask limits they are
 * added straight away and the owner is texted; above them the owner is asked,
 * and nothing is bought until they say yes.
 */
export async function addParts(db: Db, jobId: string, tradieId: string, input: PartsInput): Promise<AddPartsResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.tradieId !== tradieId) return { ok: false, message: NOT_YOURS };
    if (job.status === "awaiting_approval") return { ok: false, message: "The owner has not answered your last request yet. Wait for their answer, then add these." };
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then add the parts." };
    const context = await loadContext(tx, job);
    const { market, property, owner, tradie } = context;

    const catalogue = new Map((await listPriceList(tx, market.slug)).map((item) => [item.id, item]));
    const lines: { line: Line; itemId: string | null; listCents: number | null; part: { description: string; quantity: number; unitCents: number } }[] = [];
    for (const entry of input.parts) {
      const name = entry.name.replace(/\s+/g, " ").trim();
      if (name.length < 3) return { ok: false, message: "Say what each part is, for example: 15 mm copper elbow." };
      if (name.length > 160) return { ok: false, message: "Keep each part's name short (160 characters)." };
      if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > MAX_QUANTITY) return { ok: false, message: `Enter how many of ${name}, from 1 to ${MAX_QUANTITY}.` };
      if (!Number.isInteger(entry.unitCents) || entry.unitCents <= 0) return { ok: false, message: `Enter your price for ${name}, including GST.` };
      if (entry.unitCents * entry.quantity > 2_000_000) return { ok: false, message: "That is more than can be added here. Contact us about this job." };
      // Small parts are in the job's price (DECISIONS.md, 2026-11-23: NZ$20). Price and quantity together.
      if (entry.unitCents * entry.quantity <= market.partsIncludedCents) {
        return { ok: false, message: `Parts up to ${formatMoney(market.partsIncludedCents, job.currency)} are part of the job's price, so there is nothing to add for ${name}.` };
      }
      const item = entry.priceListItemId ? catalogue.get(entry.priceListItemId) ?? null : null;
      lines.push({ line: pricedPartLine(name, entry.unitCents, entry.quantity), itemId: item?.id ?? null, listCents: item?.priceCents ?? null, part: { description: name, quantity: entry.quantity, unitCents: entry.unitCents } });
    }
    if (lines.length === 0) return { ok: false, message: "Add at least one part: what it is, how many and your price." };

    // Ask first? Parts on this job so far, and everything extra on it, against the limits.
    const sofar = await tx.query<{ parts: number }>("select coalesce(sum(owner_cents), 0) as parts from public.job_parts where job_id = $1::uuid and status in ('active', 'pending')", [jobId]);
    const extras = await tx.query<{ total: number }>(
      "select coalesce(sum(owner_total_cents), 0) as total from public.quotes where job_id = $1::uuid and status in ('approved', 'auto_approved')",
      [jobId],
    );
    const newPartsCents = lines.reduce((sum, entry) => sum + entry.line.ownerCents, 0);
    const newTradieCents = lines.reduce((sum, entry) => sum + entry.line.tradieCents, 0);
    const approval = partsApproval(market, {
      newPartsCents, partsSoFarCents: Number(sofar[0]?.parts ?? 0), extrasSoFarCents: Number(extras[0]?.total ?? 0), limitCents: property.spendLimitCents,
    });
    const at = now();
    const summary = lines.map((entry) => entry.line.label).join(", ").slice(0, 900);
    const quoteRows = await tx.query<Parameters<typeof rowToQuote>[0]>(
      `insert into public.quotes
         (created_at, job_id, tradie_id, description, labour_cents, parts_cents, owner_total_cents, tradie_total_cents, needs_approval, status, decided_at, decided_by)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, 0, $5, $6, $7, $8, $9, $10::timestamptz, $11)
       returning *`,
      [
        at.toISOString(), jobId, tradieId, `Parts: ${summary}`, newPartsCents, newPartsCents, newTradieCents,
        approval.needsApproval, approval.needsApproval ? "pending" : "auto_approved", approval.needsApproval ? null : at.toISOString(), approval.needsApproval ? null : "system",
      ],
    );
    const quote = rowToQuote(quoteRows[0]!);
    const status = approval.needsApproval ? "pending" : "active";
    let offset = 0;
    const flagged: { id: string; name: string; unitCents: number; listCents: number }[] = [];
    for (const entry of lines) {
      const created = new Date(at.getTime() + offset);
      offset += 1;
      const rows = await tx.query<{ id: string }>(
        `insert into public.job_parts
           (created_at, job_id, tradie_id, quote_id, kind, price_list_item_id, description, quantity, unit_cents, receipt_total_cents, amount_cents,
            owner_cents, tradie_cents, status, receipt_status, list_price_cents)
         values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, 'priced', $5::uuid, $6, $7, $8, null, $9, $10, $11, $12, 'not_needed', $13)
         returning id`,
        [
          created.toISOString(), jobId, tradieId, quote.id, entry.itemId, entry.part.description, entry.part.quantity, entry.part.unitCents,
          entry.line.ownerCents, entry.line.ownerCents, entry.line.tradieCents, status, entry.listCents,
        ],
      );
      await insertLines(tx, jobId, [entry.line], { at: created, status, quoteId: quote.id, partId: rows[0]!.id });
      if (entry.listCents !== null && overListPrice(entry.part.unitCents, entry.listCents)) {
        flagged.push({ id: rows[0]!.id, name: entry.part.description, unitCents: entry.part.unitCents, listCents: entry.listCents });
      }
    }
    await audit(tx, {
      actor: `tradie:${tradieId}`, action: "parts.added", entity: "job", entityId: jobId, amount: newPartsCents, currency: job.currency,
      detail: {
        quote: quote.id, parts: lines.map((entry) => ({ kind: "priced", label: entry.line.label, owner: entry.line.ownerCents, tradie: entry.line.tradieCents, list_price: entry.listCents })),
        needs_approval: approval.needsApproval, reason: approval.reason,
      },
    });
    // Priced well over the list: a look, never a hold (DECISIONS.md, 2026-11-23).
    for (const part of flagged) {
      await raiseException(tx, {
        kind: "part_price", market: job.market, jobId, tradieId,
        summary: `Job ${job.number}: ${tradie?.businessName ?? "the tradie"} priced "${part.name}" at ${formatMoney(part.unitCents, job.currency)} each, more than ${PART_PRICE_FLAG_MULTIPLE} times its price-list price of ${formatMoney(part.listCents, job.currency)}. There can be good reasons (a better part, a hard-to-get one). Nothing is held. If it seems high, request the receipt on the job page.`,
        dedupeKey: `part_price:${part.id}`,
      });
    }

    if (approval.needsApproval) {
      await tx.query("update public.jobs set status = 'awaiting_approval' where id = $1::uuid", [jobId]);
    } else {
      await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
    }
    if (owner.phone && tradie) {
      await enqueue(tx, {
        channel: "sms", to: owner.phone, template: approval.needsApproval ? "parts_need_approval" : "parts_added", audience: "owner", jobId, userId: owner.userId,
        body: approval.needsApproval
          ? texts.partsNeedApproval({ tradie: tradie.businessName, what: summary, amountCents: newPartsCents, currency: job.currency, link: ownerJobUrl(job) })
          : texts.partsAdded({ tradie: tradie.businessName, what: summary, amountCents: newPartsCents, currency: job.currency, limitCents: market.partsApprovalCents, link: ownerJobUrl(job) }),
        dedupeKey: `parts:${quote.id}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))!, quote, needsApproval: approval.needsApproval, parts: await listParts(tx, jobId) };
  });
}

/**
 * Our team asks for the receipt for a part (a spot check, DECISIONS.md, 2026-11-23), from the job page. The
 * tradie is texted, in neutral words. Their payment for the job waits for it (holds.ts); no receipt in 7 days and
 * the part is refunded to the owner out of that payment (refundMissingReceipts).
 */
export async function requestReceipt(db: Db, partId: string, actor: string): Promise<{ ok: true; part: JobPart } | { ok: false; message: string }> {
  return db.tx(async (tx) => {
    const found = await lockPart(tx, partId);
    if (!found) return { ok: false, message: "We could not find that part." };
    const job = await lockJob(tx, found.jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    const part = (await lockPart(tx, partId))!;
    if (part.status !== "active") return { ok: false, message: "That part is not on the job any more." };
    if (part.receiptStatus === "requested") return { ok: true, part };
    if (part.receiptStatus !== "not_needed") return { ok: false, message: "This part already has a receipt, or one is on its way." };
    const at = now();
    await tx.query("update public.job_parts set receipt_status = 'requested', receipt_requested_at = $2::timestamptz, receipt_requested_by = $3 where id = $1::uuid", [partId, at.toISOString(), actor]);
    const held = await holdPayout(tx, job.id);
    await audit(tx, { actor, action: "parts.receipt_requested", entity: "job", entityId: job.id, amount: part.ownerCents, currency: job.currency, detail: { part: part.id, description: part.description, payout_held: held } });
    const context = await loadContext(tx, job);
    if (context.tradie?.phone) {
      const offer = await tx.query<{ id: string; number: number }>("select id, number from public.offers where job_id = $1::uuid and tradie_id = $2::uuid and status = 'accepted' limit 1", [job.id, part.tradieId]);
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "receipt_requested", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
        body: texts.receiptRequested({ number: job.number, what: part.description, days: RECEIPT_TO_FOLLOW_DAYS, link: offer[0] ? offerUrl({ id: offer[0].id, number: Number(offer[0].number) }) : `${baseUrl()}/tradie` }),
        dedupeKey: `receipt_requested:${part.id}`,
      });
    }
    return { ok: true, part: (await lockPart(tx, partId))! };
  });
}

export type ReceiptResult = { ok: true; part: JobPart; flags: ReceiptFlag[] } | { ok: false; message: string };

/** The tradie adds a receipt to an off-list part: before Job done, or afterwards when it was "to follow". */
export async function attachReceipt(db: Db, jobId: string, tradieId: string, partId: string, input: { uploadId: string; receiptDate?: string | null }): Promise<ReceiptResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.tradieId !== tradieId) return { ok: false, message: NOT_YOURS };
    const part = await lockPart(tx, partId);
    // An off-list part from before 23 Nov 2026, or any part whose receipt our team asked for.
    if (!part || part.jobId !== jobId || part.status === "void" || (part.kind !== "receipt" && part.receiptStatus !== "requested" && part.receiptStatus !== "attached")) {
      return { ok: false, message: "We could not find that part on this job." };
    }
    const date = cleanDate(input.receiptDate);
    if (date === "bad") return { ok: false, message: "Enter the receipt's date as a date, or leave it empty." };
    const result = await attachReceiptInside(tx, job, tradieId, part, { uploadId: input.uploadId, receiptDate: date ?? part.receiptDate });
    if (result.ok && job.status === "completed") await releaseIfClear(tx, jobId);
    return result;
  });
}

async function attachReceiptInside(db: Db, job: Job, tradieId: string, part: JobPart, input: { uploadId: string; receiptDate: string | null }): Promise<ReceiptResult> {
  if (part.receiptStatus === "attached") return { ok: true, part, flags: part.receiptFlags };
  if (part.receiptStatus === "refunding" || part.receiptStatus === "refunded") return { ok: false, message: "This part was refunded to the owner because the receipt did not come in time. Contact us if you have it." };
  const attached = await attachUploads(db, [input.uploadId], { kind: "receipt", uploadedBy: `tradie:${tradieId}`, jobId: job.id });
  if (attached === 0) return { ok: false, message: "Add the receipt first: a photo, a screenshot or the PDF." };
  await db.query("update public.job_parts set receipt_status = 'attached', receipt_upload_id = $2::uuid, receipt_date = $3::date where id = $1::uuid", [part.id, input.uploadId, input.receiptDate]);
  const fresh = (await lockPart(db, part.id))!;
  const flags = await receiptFlags(db, fresh, job);
  await audit(db, { actor: `tradie:${tradieId}`, action: "parts.receipt_added", entity: "job", entityId: job.id, detail: { part: part.id, description: part.description, flags, was: part.receiptStatus } });
  if (flags.length > 0) {
    await db.query("update public.job_parts set receipt_flags = $2::text[], check_status = 'flagged' where id = $1::uuid", [part.id, flags]);
    await holdPayout(db, job.id);
    const context = await loadContext(db, job);
    await raiseException(db, {
      kind: "receipt_check", market: job.market, jobId: job.id, tradieId,
      summary: `Job ${job.number}: ${context.tradie?.businessName ?? "the tradie"}'s receipt for "${part.description}" needs a look: ${flags.map(receiptFlagWords).join(" ")} The tradie's payment is held. Open the receipt, then Approve or Hold.`,
      dedupeKey: `receipt_check:${part.id}`,
    });
  }
  return { ok: true, part: (await lockPart(db, part.id))!, flags };
}

/** What the team is told about each receipt flag. */
export function receiptFlagWords(flag: ReceiptFlag): string {
  switch (flag) {
    case "old_receipt":
      return `The receipt is dated more than ${OLD_RECEIPT_DAYS} days before the job.`;
    case "over_receipt":
      return "The amount for this job is more than the receipt's total.";
    case "reused_receipt":
      return "The same receipt is on other jobs (for a part from before 23 November 2026: and together they claim more than its total).";
  }
}

/** The checks on one receipt. */
export async function receiptFlags(db: Db, part: JobPart, job: Pick<Job, "createdAt">): Promise<ReceiptFlag[]> {
  const flags: ReceiptFlag[] = [];
  if (part.receiptDate) {
    const dated = Date.parse(`${part.receiptDate}T00:00:00Z`);
    if (dated < job.createdAt.getTime() - OLD_RECEIPT_DAYS * 24 * 3_600_000) flags.push("old_receipt");
  }
  if (part.receiptTotalCents !== null && part.amountCents > part.receiptTotalCents) flags.push("over_receipt");
  // The same receipt: the same file, or the same tradie, total and date.
  const same = await db.query<{ amount_cents: number }>(
    `select p.amount_cents from public.job_parts p
       left join public.uploads u on u.id = p.receipt_upload_id
      where p.id <> $1::uuid and p.kind = 'receipt' and p.status <> 'void'
        and ((u.sha256 is not null and u.sha256 = (select sha256 from public.uploads where id = $2::uuid))
          or ($5::date is not null and p.tradie_id = $3::uuid and p.receipt_total_cents = $4 and p.receipt_date = $5::date))`,
    [part.id, part.receiptUploadId, part.tradieId, part.receiptTotalCents, part.receiptDate],
  );
  if (same.length > 0 && part.receiptTotalCents !== null) {
    const claimed = same.reduce((sum, row) => sum + Number(row.amount_cents), part.amountCents);
    if (claimed > part.receiptTotalCents) flags.push("reused_receipt");
  }
  // A part at the tradie's own price has no receipt total to add up against (DECISIONS.md, 2026-11-23): the same
  // file already sent for a part on another job is enough to look at.
  if (part.receiptTotalCents === null && part.receiptUploadId) {
    const elsewhere = await db.query(
      `select 1 from public.job_parts p join public.uploads u on u.id = p.receipt_upload_id
        where p.id <> $1::uuid and p.job_id <> $3::uuid and p.status <> 'void' and u.sha256 is not null
          and u.sha256 = (select sha256 from public.uploads where id = $2::uuid) limit 1`,
      [part.id, part.receiptUploadId, part.jobId],
    );
    if (elsewhere.length > 0) flags.push("reused_receipt");
  }
  return flags;
}

/**
 * Job done with an off-list part that has no receipt yet. With "receipt to
 * follow" ticked, it is promised and the payment waits for it; without, Job
 * done is refused with what to do.
 */
export async function receiptsAtJobDone(db: Db, jobId: string, toFollow: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  const missing = (await listParts(db, jobId)).filter((part) => part.status === "active" && part.receiptStatus === "needed");
  if (missing.length === 0) return { ok: true };
  if (!toFollow) {
    return { ok: false, message: `Add the receipt for ${missing.map((part) => `"${part.description}"`).join(", ")}, or tick "I will send the receipt later".` };
  }
  await db.query("update public.job_parts set receipt_status = 'to_follow' where job_id = $1::uuid and status = 'active' and receipt_status = 'needed'", [jobId]);
  return { ok: true };
}

/** The team decides flagged receipts on a job: Approve lets the payment go (if nothing else holds it), Hold keeps it. */
export async function staffDecideReceipts(db: Db, jobId: string, approve: boolean, actor: string, note = ""): Promise<{ ok: true; released: number } | { ok: false; message: string }> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    const flagged = (await listParts(tx, jobId)).filter((part) => part.status === "active" && (part.checkStatus === "flagged" || part.checkStatus === "held"));
    if (flagged.length === 0) return { ok: true, released: 0 };
    const at = now().toISOString();
    for (const part of flagged) {
      if (!approve && part.checkStatus === "held") continue;
      await tx.query("update public.job_parts set check_status = $2, checked_at = $3::timestamptz, checked_by = $4 where id = $1::uuid", [part.id, approve ? "approved" : "held", at, actor]);
    }
    await resolveExceptionsFor(tx, jobId, ["receipt_check"], approve ? "Receipt approved" : `Held: ${note.trim() || "the payment stays on hold"}`);
    const released = approve ? await releaseIfClear(tx, jobId) : 0;
    await audit(tx, {
      actor, action: approve ? "parts.receipt_approved" : "parts.receipt_held", entity: "job", entityId: jobId,
      amount: released || null, currency: released ? job.currency : null, detail: { parts: flagged.map((part) => part.id), note: note.trim() || null, payout_released: released },
    });
    if (!approve) {
      const context = await loadContext(tx, job);
      if (context.tradie?.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.tradie.phone, template: "receipt_check_held", audience: "tradie", jobId, userId: context.tradie.userId,
          body: texts.receiptCheckHeld({ number: job.number }), dedupeKey: `receipt_check_held:${jobId}`,
        });
      }
    }
    return { ok: true, released };
  });
}

type GatewayFor = (country: "NZ" | "AU") => PaymentsGateway | null;

/**
 * Run by the timer: a receipt promised at Job done that has not come in 7
 * days. The part is refunded to the owner, the tradie's payment is reduced by
 * their share of it (it was held, so it has not gone), and both are texted.
 * Claimed first, then the payment company is asked with a key that makes a
 * repeat harmless, then it is written down.
 */
export async function refundMissingReceipts(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const at = now();
  // A receipt promised at Job done (parts from before 23 Nov 2026), or one our team asked for (a spot check), 7 days on.
  const due = await db.query<{ id: string }>(
    `select p.id from public.job_parts p join public.jobs j on j.id = p.job_id
      where p.status = 'active'
        and ((p.receipt_status = 'to_follow' and j.completed_at <= $1::timestamptz)
          or (p.receipt_status = 'requested' and p.receipt_requested_at <= $1::timestamptz))
      order by coalesce(p.receipt_requested_at, j.completed_at) limit 50`,
    [addHours(at, -24 * RECEIPT_TO_FOLLOW_DAYS).toISOString()],
  );
  let refunded = 0;
  for (const row of due) {
    const claim = await db.tx(async (tx) => {
      const part = await lockPart(tx, row.id);
      if (!part || (part.receiptStatus !== "to_follow" && part.receiptStatus !== "requested") || part.status !== "active") return null;
      const job = await getJobForStaff(tx, part.jobId);
      if (!job) return null;
      const context = await loadContext(tx, job);
      const payment = (await tx.query<Parameters<typeof refundAcross>[1] & { provider: Provider }>(
        "select * from public.payments where job_id = $1::uuid for update",
        [job.id],
      ))[0] ?? null;
      await tx.query("update public.job_parts set receipt_status = 'refunding' where id = $1::uuid", [part.id]);
      const charged = payment && ["succeeded", "part_refunded"].includes(payment.status) && payment.payment_intent_id;
      return { part, job, context, payment, charged: Boolean(charged) };
    });
    if (!claim) continue;
    const { part, job, context, payment, charged } = claim;

    let refundId: string | null = null;
    if (charged && payment) {
      const gateway = gatewayFor(context.market.country);
      try {
        if (!gateway) throw new Error("Payments are not set up for this country.");
        const refundCents = Math.min(part.ownerCents, payment.amount_cents - payment.refunded_cents);
        refundId = (await refundAcross(gateway, payment, refundCents, `hostfix-part-${part.id}-refund`)).refundId;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await db.tx(async (tx) => {
          await tx.query("update public.job_parts set receipt_status = $2 where id = $1::uuid and receipt_status = 'refunding'", [part.id, part.receiptStatus]);
          await raiseException(tx, {
            kind: "needs_review", market: job.market, jobId: job.id,
            summary: `Job ${job.number}: the receipt for "${part.description}" never came, but the ${formatMoney(part.ownerCents, job.currency)} refund to the owner did not go through (${reason}). It will be tried again; tell the admin if this stays.`,
            dedupeKey: `receipt_refund_failed:${part.id}`,
          });
        });
        continue;
      }
    }

    await db.tx(async (tx) => {
      const fresh = await lockPart(tx, part.id);
      if (!fresh || fresh.receiptStatus !== "refunding") return;
      if (payment) {
        if (refundId) {
          const refundCents = Math.min(part.ownerCents, payment.amount_cents - payment.refunded_cents);
          const fully = payment.refunded_cents + refundCents >= payment.amount_cents;
          await tx.query("update public.payments set refunded_cents = refunded_cents + $2, status = $3 where id = $1::uuid", [payment.id, refundCents, fully ? "refunded" : "part_refunded"]);
        } else {
          // Not charged yet (the card failed): the part simply comes off the charge.
          const left = payment.amount_cents - part.ownerCents;
          if (left > 0) {
            await tx.query("update public.payments set amount_cents = $2, tax_cents = $3 where id = $1::uuid", [payment.id, left, context.market.taxRegistered ? taxPortion(left, context.market.taxRate) : 0]);
          } else {
            await tx.query("update public.payments set status = 'refunded', refunded_cents = amount_cents, last_error = $2 where id = $1::uuid", [payment.id, "Nothing left to charge: the parts were taken off."]);
          }
        }
      }
      await tx.query("update public.job_parts set receipt_status = 'refunded', status = 'void' where id = $1::uuid", [part.id]);
      await tx.query("update public.job_lines set status = 'void' where part_id = $1::uuid", [part.id]);
      await recalcTotals(tx, job.id, context.market.taxRate, context.market.taxRegistered);
      const payout = (await tx.query<{ id: string; amount_cents: number; status: string }>("select id, amount_cents, status from public.payouts where job_id = $1::uuid for update", [job.id]))[0];
      let payoutNow: number | null = null;
      if (payout && ["held", "waiting", "scheduled", "paused"].includes(payout.status)) {
        const remaining = payout.amount_cents - part.tradieCents;
        payoutNow = Math.max(0, remaining);
        if (remaining <= 0) await tx.query("update public.payouts set status = 'cancelled' where id = $1::uuid", [payout.id]);
        else await tx.query("update public.payouts set amount_cents = $2 where id = $1::uuid", [payout.id, remaining]);
      }
      await audit(tx, {
        actor: "system", action: "parts.refunded_no_receipt", entity: "job", entityId: job.id, amount: part.ownerCents, currency: job.currency,
        detail: { part: part.id, description: part.description, refund: refundId, tradie_off: part.tradieCents, payout_now: payoutNow, charged },
        dedupeKey: `parts.refunded_no_receipt:${part.id}`,
      });
      if (context.tradie?.phone) {
        const offer = await tx.query<{ id: string; number: number }>("select id, number from public.offers where job_id = $1::uuid and tradie_id = $2::uuid and status = 'accepted' limit 1", [job.id, part.tradieId]);
        await enqueue(tx, {
          channel: "sms", to: context.tradie.phone, template: "receipt_missing_refunded", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
          body: texts.receiptMissingTradie({ number: job.number, what: part.description, amountCents: part.tradieCents, currency: job.currency, link: offer[0] ? offerUrl({ id: offer[0].id, number: Number(offer[0].number) }) : null }),
          dedupeKey: `receipt_missing_tradie:${part.id}`,
        });
      }
      if (context.owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "receipt_missing_refunded", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.receiptMissingOwner({ number: job.number, what: part.description, amountCents: part.ownerCents, currency: job.currency, charged }),
          dedupeKey: `receipt_missing_owner:${part.id}`,
        });
      }
      await releaseIfClear(tx, job.id);
    });
    refunded += 1;
  }
  return refunded;
}

/**
 * The team charges parts the tradie had already bought for a job that was
 * then cancelled, and that cannot go back to the shop: at the receipt's cost,
 * with no markup, all of it to the tradie (DECISIONS.md, 2026-11-20). The
 * job's other lines were never charged and are set aside. Once per job.
 */
export async function chargeBoughtParts(db: Db, jobId: string, input: { description: string; amountCents: number }, actor: string): Promise<{ ok: true; job: Job } | { ok: false; message: string }> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    if (job.status !== "cancelled" || !job.tradieId) return { ok: false, message: "This is only for a job that was cancelled after a tradie had it." };
    const approved = await tx.query("select 1 from public.quotes where job_id = $1::uuid and status in ('approved', 'auto_approved') limit 1", [jobId]);
    if (approved.length === 0) return { ok: false, message: "Nothing was approved on this job before it was cancelled, so no parts can be charged." };
    if ((await tx.query("select 1 from public.payments where job_id = $1::uuid", [jobId])).length > 0) return { ok: false, message: "This job has already been charged." };
    const description = input.description.replace(/\s+/g, " ").trim();
    if (description.length < 3) return { ok: false, message: "Say which parts, as on the receipt." };
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 2_000_000) return { ok: false, message: "Enter the receipt cost of the parts." };
    const context = await loadContext(tx, job);
    const at = now();
    await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and status in ('active', 'pending')", [jobId]);
    await insertLines(tx, jobId, [{ kind: "adjustment", label: `Parts bought before the job was cancelled: ${description}`, ownerCents: input.amountCents, tradieCents: input.amountCents }], { at });
    const sum = await recalcTotals(tx, jobId, context.market.taxRate, context.market.taxRegistered);
    await audit(tx, { actor, action: "parts.cancelled_charged", entity: "job", entityId: jobId, amount: sum.ownerCents, currency: job.currency, detail: { description, tradie_gets: sum.tradieCents } });
    const fresh = (await lockJob(tx, jobId))!;
    await openSettlement(tx, { ...fresh, completedAt: at }, context.market);
    return { ok: true, job: fresh };
  });
}
