import { isUuid } from "@/lib/uuid";
import type { Db } from "@/lib/db/types";
import type { Line, LineKind } from "./pricing";
import { taxPortion, totals } from "./pricing";
import type { Job, JobLine, JobOutcome, JobStatus, Offer, OfferStatus, Quote, QuoteStatus, ReportedBy } from "./types";

/**
 * READING AND WRITING JOBS.
 *
 * Reads for owners take the owner's id and reads for tradies take the tradie's
 * id, and both go into the query itself. A job that is not theirs comes back
 * as "not found", never as someone else's data. Staff reads say so in their
 * name.
 */

export type JobRow = {
  id: string; number: number; created_at: Date; property_id: string; owner_id: string; market: string;
  menu_item_id: string | null; off_menu: boolean; trade: string; licence_required: boolean; title: string; description: string;
  urgency: "standard" | "urgent"; after_hours: boolean; reported_by: ReportedBy; reporter_name: string | null;
  reporter_phone: string | null; status: JobStatus; stage: number; offer_round: number; tradie_id: string | null;
  tier_key: string | null; response_hours: number; dispatched_at: Date | null; respond_by: Date | null;
  accepted_at: Date | null; en_route_at: Date | null; arrived_at: Date | null; completed_at: Date | null;
  cancelled_at: Date | null; cancelled_by: string | null; cancel_reason: string | null; window_missed_at: Date | null;
  outcome: JobOutcome | null; completion_note: string | null; currency: string; owner_total_cents: number;
  tradie_total_cents: number; tax_cents: number;
};

const d = (value: Date | null) => (value ? new Date(value) : null);

export function rowToJob(row: JobRow): Job {
  return {
    id: row.id, number: Number(row.number), createdAt: new Date(row.created_at), propertyId: row.property_id, ownerId: row.owner_id,
    market: row.market, menuItemId: row.menu_item_id, offMenu: row.off_menu, trade: row.trade, licenceRequired: row.licence_required,
    title: row.title, description: row.description, urgency: row.urgency, afterHours: row.after_hours, reportedBy: row.reported_by,
    reporterName: row.reporter_name, reporterPhone: row.reporter_phone, status: row.status, stage: row.stage, offerRound: row.offer_round,
    tradieId: row.tradie_id, tierKey: row.tier_key, responseHours: row.response_hours, dispatchedAt: d(row.dispatched_at),
    respondBy: d(row.respond_by), acceptedAt: d(row.accepted_at), enRouteAt: d(row.en_route_at), arrivedAt: d(row.arrived_at),
    completedAt: d(row.completed_at), cancelledAt: d(row.cancelled_at), cancelledBy: row.cancelled_by, cancelReason: row.cancel_reason,
    windowMissedAt: d(row.window_missed_at), outcome: row.outcome, completionNote: row.completion_note, currency: row.currency,
    ownerTotalCents: row.owner_total_cents, tradieTotalCents: row.tradie_total_cents, taxCents: row.tax_cents,
  };
}

/** Locks the job for the rest of this database step, so two people cannot change it at once. */
export async function lockJob(db: Db, jobId: string): Promise<Job | null> {
  if (!isUuid(jobId)) return null;
  const rows = await db.query<JobRow>("select * from public.jobs where id = $1::uuid for update", [jobId]);
  return rows[0] ? rowToJob(rows[0]) : null;
}

export async function getJobForStaff(db: Db, jobId: string): Promise<Job | null> {
  if (!isUuid(jobId)) return null;
  const rows = await db.query<JobRow>("select * from public.jobs where id = $1::uuid", [jobId]);
  return rows[0] ? rowToJob(rows[0]) : null;
}

export async function getJobByNumber(db: Db, number: number): Promise<Job | null> {
  const rows = await db.query<JobRow>("select * from public.jobs where number = $1", [number]);
  return rows[0] ? rowToJob(rows[0]) : null;
}

/** One of this owner's jobs, or null. Never another owner's. */
export async function getJobForOwner(db: Db, ownerId: string, jobId: string): Promise<Job | null> {
  if (!isUuid(jobId)) return null;
  const rows = await db.query<JobRow>("select * from public.jobs where id = $1::uuid and owner_id = $2::uuid", [jobId, ownerId]);
  return rows[0] ? rowToJob(rows[0]) : null;
}

/** A job this tradie has accepted, or null. A job they were only offered is not theirs to open. */
export async function getJobForTradie(db: Db, tradieId: string, jobId: string): Promise<Job | null> {
  if (!isUuid(jobId)) return null;
  const rows = await db.query<JobRow>("select * from public.jobs where id = $1::uuid and tradie_id = $2::uuid", [jobId, tradieId]);
  return rows[0] ? rowToJob(rows[0]) : null;
}

export type JobListItem = Job & { propertyName: string; suburb: string; tradieName: string | null; photoCount: number };

type JobListRow = JobRow & { property_name: string; suburb: string; tradie_name: string | null; photo_count: number };

const LIST_SELECT = `select j.*, p.name as property_name, p.suburb, t.business_name as tradie_name,
                            (select count(*) from public.uploads u where u.job_id = j.id and u.attached) as photo_count
                       from public.jobs j
                       join public.properties p on p.id = j.property_id
                       left join public.tradies t on t.id = j.tradie_id`;

function rowToListItem(row: JobListRow): JobListItem {
  return { ...rowToJob(row), propertyName: row.property_name, suburb: row.suburb, tradieName: row.tradie_name, photoCount: Number(row.photo_count) };
}

export async function listJobsForOwner(db: Db, ownerId: string, filter: { propertyId?: string; limit?: number } = {}): Promise<JobListItem[]> {
  const rows = await db.query<JobListRow>(
    `${LIST_SELECT}
      where j.owner_id = $1::uuid and ($2::uuid is null or j.property_id = $2::uuid)
      order by (j.status in ('completed', 'cancelled')), j.created_at desc limit $3`,
    [ownerId, filter.propertyId ?? null, filter.limit ?? 100],
  );
  return rows.map(rowToListItem);
}

export async function listJobsForTradie(db: Db, tradieId: string, filter: { limit?: number } = {}): Promise<JobListItem[]> {
  const rows = await db.query<JobListRow>(
    `${LIST_SELECT}
      where j.tradie_id = $1::uuid
      order by (j.status in ('completed', 'cancelled')), coalesce(j.respond_by, j.created_at) asc, j.created_at desc limit $2`,
    [tradieId, filter.limit ?? 100],
  );
  return rows.map(rowToListItem);
}

export async function listJobsForStaff(
  db: Db, filter: { market?: string | null; status?: JobStatus | "open" | null; limit?: number } = {},
): Promise<JobListItem[]> {
  const rows = await db.query<JobListRow>(
    `${LIST_SELECT}
      where ($1::text is null or j.market = $1)
        and ($2::text is null
             or ($2 = 'open' and j.status not in ('completed', 'cancelled'))
             or j.status = $2)
      order by (j.status in ('completed', 'cancelled')), coalesce(j.respond_by, j.created_at) asc, j.created_at desc limit $3`,
    [filter.market ?? null, filter.status ?? null, filter.limit ?? 200],
  );
  return rows.map(rowToListItem);
}

// ---------------------------------------------------------------------------
// LINES
// ---------------------------------------------------------------------------

type LineRow = { id: string; job_id: string; kind: LineKind; label: string; owner_cents: number; tradie_cents: number; status: "active" | "pending" | "void"; quote_id: string | null };

function rowToLine(row: LineRow): JobLine {
  return { id: row.id, jobId: row.job_id, kind: row.kind, label: row.label, ownerCents: row.owner_cents, tradieCents: row.tradie_cents, status: row.status, quoteId: row.quote_id };
}

export async function listLines(db: Db, jobId: string): Promise<JobLine[]> {
  const rows = await db.query<LineRow>("select * from public.job_lines where job_id = $1::uuid order by created_at, id", [jobId]);
  return rows.map(rowToLine);
}

export async function insertLines(db: Db, jobId: string, lines: Line[], options: { status?: "active" | "pending"; quoteId?: string | null; at: Date }): Promise<void> {
  let offset = 0;
  for (const line of lines) {
    // A millisecond apart, so they always read back in the order they were written.
    const createdAt = new Date(options.at.getTime() + offset);
    offset += 1;
    await db.query(
      `insert into public.job_lines (created_at, job_id, kind, label, owner_cents, tradie_cents, status, quote_id)
       values ($1::timestamptz, $2::uuid, $3, $4, $5, $6, $7, $8::uuid)`,
      [createdAt.toISOString(), jobId, line.kind, line.label, line.ownerCents, line.tradieCents, options.status ?? "active", options.quoteId ?? null],
    );
  }
}

/** Adds up the job's active lines and stores the totals on the job. Returns them. */
export async function recalcTotals(db: Db, jobId: string, taxRate: number, taxRegistered: boolean): Promise<{ ownerCents: number; tradieCents: number; taxCents: number }> {
  const active = (await listLines(db, jobId)).filter((line) => line.status === "active");
  const sum = totals(active);
  const ownerCents = Math.max(0, sum.ownerCents);
  const tradieCents = Math.max(0, sum.tradieCents);
  const taxCents = taxRegistered ? taxPortion(ownerCents, taxRate) : 0;
  await db.query("update public.jobs set owner_total_cents = $2, tradie_total_cents = $3, tax_cents = $4 where id = $1::uuid", [jobId, ownerCents, tradieCents, taxCents]);
  return { ownerCents, tradieCents, taxCents };
}

// ---------------------------------------------------------------------------
// OFFERS AND QUOTES
// ---------------------------------------------------------------------------

export type OfferRow = {
  id: string; number: number; job_id: string; tradie_id: string; stage: number; round: number; status: OfferStatus;
  sent_at: Date; expires_at: Date; responded_at: Date | null; responded_via: Offer["respondedVia"]; payout_cents: number;
};

export function rowToOffer(row: OfferRow): Offer {
  return {
    id: row.id, number: Number(row.number), jobId: row.job_id, tradieId: row.tradie_id, stage: row.stage, round: row.round, status: row.status,
    sentAt: new Date(row.sent_at), expiresAt: new Date(row.expires_at), respondedAt: d(row.responded_at), respondedVia: row.responded_via,
    payoutCents: row.payout_cents,
  };
}

export async function getOffer(db: Db, offerId: string): Promise<Offer | null> {
  if (!isUuid(offerId)) return null;
  const rows = await db.query<OfferRow>("select * from public.offers where id = $1::uuid", [offerId]);
  return rows[0] ? rowToOffer(rows[0]) : null;
}

export async function getOfferByNumber(db: Db, number: number): Promise<Offer | null> {
  const rows = await db.query<OfferRow>("select * from public.offers where number = $1", [number]);
  return rows[0] ? rowToOffer(rows[0]) : null;
}

export type OfferWithTradie = Offer & { tradieName: string };

export async function listOffers(db: Db, jobId: string): Promise<OfferWithTradie[]> {
  const rows = await db.query<OfferRow & { tradie_name: string }>(
    `select o.*, t.business_name as tradie_name from public.offers o join public.tradies t on t.id = o.tradie_id
      where o.job_id = $1::uuid order by o.sent_at, o.number`,
    [jobId],
  );
  return rows.map((row) => ({ ...rowToOffer(row), tradieName: row.tradie_name }));
}

export type OfferForTradie = Offer & { jobNumber: number; title: string; suburb: string; urgency: "standard" | "urgent"; respondBy: Date | null; jobStatus: JobStatus };

/** Offers waiting for this tradie's answer, soonest to run out first. */
export async function listLiveOffersForTradie(db: Db, tradieId: string, at: Date): Promise<OfferForTradie[]> {
  const rows = await db.query<OfferRow & { job_number: number; title: string; suburb: string; urgency: "standard" | "urgent"; respond_by: Date | null; job_status: JobStatus }>(
    `select o.*, j.number as job_number, j.title, p.suburb, j.urgency, j.respond_by, j.status as job_status
       from public.offers o
       join public.jobs j on j.id = o.job_id
       join public.properties p on p.id = j.property_id
      where o.tradie_id = $1::uuid and o.status = 'pending' and o.expires_at > $2::timestamptz and j.status = 'offering'
      order by o.expires_at`,
    [tradieId, at.toISOString()],
  );
  return rows.map((row) => ({
    ...rowToOffer(row), jobNumber: Number(row.job_number), title: row.title, suburb: row.suburb, urgency: row.urgency,
    respondBy: d(row.respond_by), jobStatus: row.job_status,
  }));
}

type QuoteRow = {
  id: string; created_at: Date; job_id: string; tradie_id: string; description: string; labour_cents: number; parts_cents: number;
  owner_total_cents: number; tradie_total_cents: number; needs_approval: boolean; status: QuoteStatus; decided_at: Date | null; decided_by: string | null;
};

export function rowToQuote(row: QuoteRow): Quote {
  return {
    id: row.id, createdAt: new Date(row.created_at), jobId: row.job_id, tradieId: row.tradie_id, description: row.description,
    labourCents: row.labour_cents, partsCents: row.parts_cents, ownerTotalCents: row.owner_total_cents, tradieTotalCents: row.tradie_total_cents,
    needsApproval: row.needs_approval, status: row.status, decidedAt: d(row.decided_at), decidedBy: row.decided_by,
  };
}

export async function listQuotes(db: Db, jobId: string): Promise<Quote[]> {
  const rows = await db.query<QuoteRow>("select * from public.quotes where job_id = $1::uuid order by created_at", [jobId]);
  return rows.map(rowToQuote);
}

export async function getQuote(db: Db, quoteId: string): Promise<Quote | null> {
  if (!isUuid(quoteId)) return null;
  const rows = await db.query<QuoteRow>("select * from public.quotes where id = $1::uuid", [quoteId]);
  return rows[0] ? rowToQuote(rows[0]) : null;
}
