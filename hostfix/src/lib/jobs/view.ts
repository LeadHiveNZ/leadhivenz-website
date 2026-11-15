import type { Market } from "@config/markets";
import { auditTrail, type AuditRow } from "@/lib/audit";
import type { Db } from "@/lib/db/types";
import { listUploads, type Upload } from "@/lib/files/uploads";
import { formatMoney } from "@/lib/money";
import type { Property } from "@/lib/properties/service";
import { formatDeadline } from "@/lib/time";
import { loadContext } from "./context";
import { listLines, listOffers, listQuotes, type OfferWithTradie } from "./store";
import type { Job, JobLine, Quote, StatusTone } from "./types";

/**
 * EVERYTHING ABOUT ONE JOB, gathered for a screen: who, what, the money lines,
 * the photos, and a plain-words history of what happened.
 *
 * The history is built from the audit log, so the screen can never tell a
 * different story from the record. What each kind of person sees is decided
 * here: an owner is never shown who passed on their job, and a tradie is
 * never shown what the owner was charged.
 */

export type Audience = "owner" | "tradie" | "staff";

export type HistoryEntry = { at: Date; title: string; detail: string | null; tone: StatusTone };

export type JobMoney = {
  payment: { status: string; amountCents: number; refundedCents: number; paidAt: Date | null; lastError: string | null; attempts: number } | null;
  payout: { status: string; amountCents: number; releaseAt: Date; sentAt: Date | null; lastError: string | null } | null;
  dispute: { id: string; status: string; reason: string; createdAt: Date; refundCents: number | null; resolutionNote: string | null } | null;
  credit: { amountCents: number; status: string } | null;
};

export type JobView = {
  job: Job;
  market: Market;
  property: Property;
  owner: { name: string; phone: string | null };
  tradie: { id: string; name: string; businessName: string; phone: string | null } | null;
  lines: JobLine[];
  quotes: Quote[];
  offers: OfferWithTradie[];
  reportPhotos: Upload[];
  workPhotos: Upload[];
  history: HistoryEntry[];
  money: JobMoney;
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

function describe(row: AuditRow, audience: Audience, job: Job, market: Market): HistoryEntry | null {
  const d = row.detail;
  const amount = row.amount !== null && row.currency ? formatMoney(row.amount, row.currency) : "";
  const entry = (title: string, tone: StatusTone = "quiet", detail: string | null = null): HistoryEntry => ({ at: row.at, title, detail, tone });
  switch (row.action) {
    case "job.created": {
      const by = str(d.reported_by);
      const who = job.reporterName ?? (by === "guest" ? "a guest" : by === "team" ? "your team" : by === "staff" ? "the team" : audience === "owner" ? "you" : "the owner");
      return entry(`Reported by ${who}`, "quiet", d.needs_owner ? "Waiting for the owner's go-ahead before anyone is sent." : null);
    }
    case "job.approved_by_owner":
      return entry(audience === "owner" ? "You gave the go-ahead" : "The owner gave the go-ahead", "active", d.urgent ? "As an urgent job." : null);
    case "job.dispatched":
      return audience === "tradie" ? null : entry("Sent out to tradies", "waiting", d.respond_by ? `Promised on site by ${formatDeadline(new Date(str(d.respond_by)), row.at, market.timezone)}.` : null);
    case "job.offered":
      if (audience !== "staff") return null;
      return entry(`Offered to ${(Array.isArray(d.tradies) ? d.tradies : []).join(", ") || "tradies"}`, "waiting", `Stage ${String(d.stage)} of 3${Number(d.round) > 1 ? `, round ${String(d.round)}` : ""}.`);
    case "job.passed":
      return audience === "staff" ? entry("A tradie passed", "quiet", `By ${str(d.via) || "link"}.`) : null;
    case "job.unfilled":
      return audience === "staff" ? entry("Nobody accepted", "alert", "Sent to the dispatcher's queue.") : audience === "owner" ? entry("Our team is arranging a tradie", "waiting") : null;
    case "job.reoffered":
      return audience === "staff" ? entry("Offers started again", "waiting") : null;
    case "job.accepted":
      return entry(audience === "tradie" ? "You accepted the job" : `${str(d.tradie) || "A tradie"} accepted`, "active", audience === "staff" ? `By ${str(d.via)}${d.late ? ", after their 15 minutes" : ""}.` : null);
    case "job.en_route":
      return entry(audience === "tradie" ? "You set off" : "Tradie on the way", "active");
    case "job.arrived":
      return entry(audience === "tradie" ? "You arrived" : "Tradie on site", "active", d.on_time === false ? "After the promised time." : audience === "staff" ? "Inside the promised time." : null);
    case "quote.submitted":
      return entry(`Quote: ${amount}`, d.needs_approval ? "alert" : "active", `${str(d.description)}${d.needs_approval ? ". Waiting for the owner's answer." : ". Inside the pre-approved limit, so it went ahead."}`);
    case "quote.approved":
      return entry(audience === "owner" ? "You approved the quote" : "Quote approved", "active", amount);
    case "quote.declined":
      return entry(audience === "owner" ? "You declined the quote" : "Quote declined", "quiet", amount);
    case "job.completed":
      return entry(d.outcome === "no_access" ? "Tradie could not get in" : d.outcome === "diagnosis_only" ? "Call-out finished" : "Job done", "done", audience === "tradie" ? null : job.completionNote);
    case "payment.succeeded":
      return audience === "tradie" ? null : entry(`Card charged ${amount}`, "done");
    case "payment.failed":
      return audience === "tradie" ? null : entry("Card payment did not go through", "alert", audience === "staff" ? str(d.reason) : "We will try again. Please check your card.");
    case "payout.sent":
      return audience === "owner" ? null : entry(audience === "tradie" ? `${amount} sent to your bank` : `Tradie paid ${amount}`, "done");
    case "payout.failed":
      return audience === "staff" ? entry("Could not pay the tradie", "alert", str(d.reason)) : null;
    case "payout.reduced":
      return audience === "owner" ? null : entry(`Payment reduced by ${amount}`, "quiet", "Because part of the job was refunded.");
    case "payout.reversed":
      return audience === "staff" ? entry(`${amount} taken back from the tradie`, "quiet") : null;
    case "dispute.opened":
      return entry(audience === "owner" ? "You told us something was wrong" : "The owner raised a problem", "alert", audience === "tradie" ? "Your payment is on hold while we look into it." : str(d.reason));
    case "dispute.resolved":
      return entry("Problem resolved", "done", d.outcome === "refund" ? null : audience === "owner" ? "We looked into it and the work stands." : "Paid in full.");
    case "refund.issued":
      return audience === "tradie" ? null : entry(`Refunded ${amount}`, "done");
    case "job.window_missed":
      return audience === "tradie" ? null : entry("We missed the promised time", "alert", d.credited ? "The month's membership has been credited." : audience === "staff" ? "No credit: already credited this month." : null);
    case "job.cancelled":
      return entry("Cancelled", "quiet", audience === "staff" ? str(d.reason) : null);
    case "exception.raised":
      return audience === "staff" ? entry("Flagged for the dispatcher", "alert", str(d.summary)) : null;
    default:
      return null;
  }
}

export async function loadJobView(db: Db, job: Job, audience: Audience): Promise<JobView> {
  const context = await loadContext(db, job);
  const lines = await listLines(db, job.id);
  const quotes = await listQuotes(db, job.id);
  const offers = audience === "staff" ? await listOffers(db, job.id) : [];
  const uploads = await listUploads(db, { jobId: job.id });
  const trail = await auditTrail(db, { entity: "job", entityId: job.id, limit: 300 });
  const history = trail.map((row) => describe(row, audience, job, context.market)).filter((entry): entry is HistoryEntry => entry !== null);

  const payments = await db.query<{ status: string; amount_cents: number; refunded_cents: number; paid_at: Date | null; last_error: string | null; attempts: number }>(
    "select status, amount_cents, refunded_cents, paid_at, last_error, attempts from public.payments where job_id = $1::uuid",
    [job.id],
  );
  const payouts = await db.query<{ status: string; amount_cents: number; release_at: Date; sent_at: Date | null; last_error: string | null }>(
    "select status, amount_cents, release_at, sent_at, last_error from public.payouts where job_id = $1::uuid",
    [job.id],
  );
  const disputes = await db.query<{ id: string; status: string; reason: string; created_at: Date; refund_cents: number | null; resolution_note: string | null }>(
    "select id, status, reason, created_at, refund_cents, resolution_note from public.disputes where job_id = $1::uuid",
    [job.id],
  );
  const credits = await db.query<{ amount_cents: number; status: string }>("select amount_cents, status from public.credits where job_id = $1::uuid and reason = 'missed_window'", [job.id]);
  const p = payments[0];
  const o = payouts[0];
  const dsp = disputes[0];

  return {
    job,
    market: context.market,
    property: context.property,
    owner: { name: context.owner.name, phone: context.owner.phone },
    tradie: context.tradie ? { id: context.tradie.id, name: context.tradie.name, businessName: context.tradie.businessName, phone: context.tradie.phone } : null,
    lines,
    quotes,
    offers,
    reportPhotos: uploads.filter((upload) => upload.kind === "report"),
    workPhotos: uploads.filter((upload) => upload.kind === "completion" || upload.kind === "quote" || upload.kind === "receipt"),
    history,
    money: {
      payment: p ? { status: p.status, amountCents: p.amount_cents, refundedCents: p.refunded_cents, paidAt: p.paid_at ? new Date(p.paid_at) : null, lastError: p.last_error, attempts: p.attempts } : null,
      payout: o ? { status: o.status, amountCents: o.amount_cents, releaseAt: new Date(o.release_at), sentAt: o.sent_at ? new Date(o.sent_at) : null, lastError: o.last_error } : null,
      dispute: dsp ? { id: dsp.id, status: dsp.status, reason: dsp.reason, createdAt: new Date(dsp.created_at), refundCents: dsp.refund_cents, resolutionNote: dsp.resolution_note } : null,
      credit: credits[0] ? { amountCents: credits[0].amount_cents, status: credits[0].status } : null,
    },
  };
}
