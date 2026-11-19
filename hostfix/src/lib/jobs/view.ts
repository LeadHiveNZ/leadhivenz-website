import type { Market } from "@config/markets";
import { auditTrail, type AuditRow } from "@/lib/audit";
import type { Db } from "@/lib/db/types";
import { listUploads, type Upload } from "@/lib/files/uploads";
import { formatMoney } from "@/lib/money";
import type { Property } from "@/lib/properties/service";
import { formatDeadline } from "@/lib/time";
import { waitingLaterTime, type LaterTime } from "@/lib/dispatch/cascade";
import { brand } from "@config/brand";
import { windowBetween } from "./arrival";
import { flagWords, ownerCheckWords, type CheckFlag } from "./checks";
import { loadContext } from "./context";
import { listLines, listOffers, listQuotes, type OfferWithTradie } from "./store";
import { listParts, type JobPart } from "./parts";
import type { Job, JobLine, Quote, StatusTone } from "./types";

/**
 * EVERYTHING ABOUT ONE JOB, gathered for a screen: who, what, the money lines,
 * the photos, and a plain-words history of what happened.
 *
 * The history is built from the audit log, so the screen can never tell a
 * different story from the record. What each kind of person sees is decided
 * here. An owner is never told a tradie "passed" or "declined": when their
 * chosen tradie (first choice or backup) cannot take it, they read "Name isn't
 * available for this one, so we've sent it to another HostFix tradie"
 * (DECISIONS.md, 2026-11-18). A tradie is never shown what the owner was charged.
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
  /** The tradie's photos, quotes and receipts. */
  workPhotos: Upload[];
  /** Taken at Arrived and at Job done, shown side by side (DECISIONS.md, 2026-11-19). */
  beforePhotos: Upload[];
  afterPhotos: Upload[];
  history: HistoryEntry[];
  money: JobMoney;
  /** The owner's chosen tradie has suggested a later time and is waiting for the owner's answer. */
  laterTime: LaterTime | null;
  /** Parts on the job (DECISIONS.md, 2026-11-20). For an owner, without the receipt itself. */
  parts: JobPart[];
  /** The parts receipts. Staff only: an owner never sees a receipt, and a tradie sees their own on the part. */
  receipts: Upload[];
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
      if (audience === "staff") return entry(`${str(d.tradie) || "A tradie"} passed`, "quiet", `By ${str(d.via) || "link"}. Passing never counts against a tradie.`);
      // Only the owner's chosen tradies (first choice and backup) are named, and never as "passed".
      if (audience === "owner" && Number(d.stage) <= 2) return entry(`${str(d.tradie) || "Your usual tradie"} isn't available for this one, so we've sent it to another ${brand.name} tradie.`, "waiting");
      return null;
    case "job.later_time_offered": {
      if (audience === "tradie") return entry("You suggested a later time", "waiting");
      const when = d.window_start && d.window_end ? windowBetween({ start: new Date(str(d.window_start)), end: new Date(str(d.window_end)) }, row.at, market.timezone) : "later";
      return entry(`${str(d.tradie) || "Your tradie"} can't make it within ${String(d.hours ?? job.responseHours)} hours`, "alert", `They can come ${when}.`);
    }
    case "job.later_time_accepted":
      return entry(audience === "owner" ? `You chose to wait for ${str(d.tradie) || "your tradie"}` : "The owner chose to wait", "active", d.was_urgent ? "It is no longer urgent, so the urgent fee is not charged." : null);
    case "job.later_time_declined":
      return entry(audience === "owner" ? `You asked us to send it to another ${brand.name} tradie` : "The owner asked for someone sooner", "waiting");
    case "job.later_time_expired":
      return entry(audience === "tradie" ? "The owner did not answer in time" : `No answer in time, so we've sent it to another ${brand.name} tradie`, "waiting");
    case "job.not_taken_yet":
      return audience === "tradie" ? null : entry(audience === "owner" ? "No tradie has taken it yet: our team is ringing round" : "Nobody has taken it yet: ring round", "alert", audience === "owner" ? "You pay nothing unless a tradie does the job." : null);
    case "job.surcharge_dropped": {
      const parts = [d.urgent ? "urgent" : null, d.after_hours ? "after-hours" : null].filter(Boolean).join(" and ");
      const why = d.urgent ? "the tradie arrived after the urgent deadline" : "the tradie arrived inside working hours";
      return entry(`No ${parts} fee`, "done", audience === "tradie" ? `Not paid, because ${why.replace("the tradie", "you")}.` : `Not charged, because ${why}.`);
    }
    case "job.owner_says_absent":
      return audience === "tradie" ? null : entry(audience === "owner" ? "You told us the tradie isn't there" : "The owner says the tradie isn't there", "alert");
    case "job.no_show":
      return audience === "staff" ? entry("No-show: the tradie was not there by the promised time", "alert") : null;
    case "job.unfilled":
      return audience === "staff" ? entry("Nobody accepted", "alert", "Sent to the dispatcher's queue.") : audience === "owner" ? entry("Our team is arranging a tradie", "waiting") : null;
    case "job.reoffered":
      return audience === "staff" ? entry("Offers started again", "waiting") : null;
    case "job.accepted": {
      const when = job.urgency !== "urgent" && d.window_start && d.window_end
        ? `On site ${windowBetween({ start: new Date(str(d.window_start)), end: new Date(str(d.window_end)) }, row.at, market.timezone)}.`
        : null;
      return entry(
        audience === "tradie" ? "You accepted the job" : `${str(d.tradie) || "A tradie"} accepted`, "active",
        audience === "staff" ? `By ${str(d.via)}${d.late ? ", after their 15 minutes" : ""}.${when ? ` ${when}` : ""}` : when,
      );
    }
    case "job.en_route":
      return entry(audience === "tradie" ? "You set off" : "Tradie on the way", "active");
    case "job.arrived": {
      const timing = d.on_time === false ? (d.window_end ? "After the time they chose." : "After the promised time.") : audience === "staff" ? "On time." : null;
      const place = audience !== "staff" ? null
        : d.location === "far" ? ` ${String(d.distance_m)} m from ${d.reference === "pin" ? "the property's pin" : "where tradies have been here before"}.`
        : d.location === "no_location" ? " The phone gave no location."
        : d.location === "no_reference" ? " Location recorded: no pin and no earlier visits to compare with."
        : d.location === "ok" ? (d.reference === "pin" ? ` ${String(d.distance_m)} m from the property's pin.` : " Location matches earlier visits.") : "";
      return entry(audience === "tradie" ? "You arrived" : "Tradie on site", "active", timing || place ? `${timing ?? ""}${place ?? ""}`.trim() : null);
    }
    case "job.flagged": {
      // The owner is asked in neutral words; the tradie is told plainly why; the team sees every reason.
      const flags = (Array.isArray(d.flags) ? d.flags : []) as CheckFlag[];
      if (audience === "owner") return entry("We asked you to check the photos", "alert", ownerCheckWords(flags));
      const words = flags.map((flag) => flagWords(flag, { arrivalM: d.arrival_m as number | null, finishM: d.finish_m as number | null, minutes: d.minutes_on_site as number | null, minMinutes: d.min_minutes as number | undefined })).join(" ");
      return entry(audience === "tradie" ? "Payment waiting for the owner to confirm the job" : "Flagged: the owner is asked to confirm", "alert", words || null);
    }
    case "job.owner_confirmed":
      return entry(audience === "owner" ? "You confirmed it is fixed" : "The owner confirmed it is fixed", "done", audience === "owner" ? null : "The payment is released as normal.");
    case "job.check_released":
      return audience === "owner" ? null : entry("No answer from the owner: paid, as a trusted tradie", "done", audience === "staff" ? "The flag stays on the record." : null);
    case "job.check_to_staff":
      return audience === "staff" ? entry("No answer from the owner: in the queue to approve or hold", "alert") : audience === "tradie" ? entry("Our team is looking at this job before paying it", "waiting") : null;
    case "job.check_approved":
      return audience === "owner" ? null : entry(audience === "tradie" ? "Checked: your payment is on its way" : "Approved by the team", "done");
    case "job.check_held":
      return audience === "owner" ? null : entry(audience === "tradie" ? "Your payment is on hold while we check this job" : "Payment held by the team", "alert", audience === "staff" ? str(d.note) || null : null);
    case "parts.added": {
      const parts = (Array.isArray(d.parts) ? d.parts : []) as { label?: string; owner?: number; tradie?: number }[];
      const words = parts.map((part) => `${part.label ?? "Part"} ${formatMoney(audience === "tradie" ? Number(part.tradie ?? 0) : Number(part.owner ?? 0), job.currency)}`).join(", ");
      return entry(d.needs_approval ? "Parts: waiting for the owner's yes" : "Parts added", d.needs_approval ? "alert" : "active", words || null);
    }
    case "parts.receipt_added":
      if (audience === "owner") return entry(Array.isArray(d.flags) && d.flags.length > 0 ? "Receipt received: HostFix is checking it" : "Receipt checked by HostFix", "done", str(d.description) || null);
      return entry("Receipt added", (Array.isArray(d.flags) && d.flags.length > 0) ? "alert" : "done", audience === "staff" && Array.isArray(d.flags) && d.flags.length > 0 ? `Flagged: ${(d.flags as string[]).join(", ")}.` : str(d.description) || null);
    case "parts.receipt_approved":
      return audience === "owner" ? null : entry("Receipt approved by the team", "done");
    case "parts.receipt_held":
      return audience === "owner" ? null : entry(audience === "tradie" ? "Your payment is on hold while we check a receipt" : "Receipt held by the team", "alert", audience === "staff" ? str(d.note) || null : null);
    case "parts.refunded_no_receipt":
      return entry(audience === "owner" ? `Refunded ${amount} for parts` : `No receipt: ${amount} refunded to the owner`, "quiet", `${str(d.description)}: the receipt did not come within 7 days.`);
    case "parts.cancelled_charged":
      return audience === "tradie" ? entry("Parts you bought before the cancellation are paid", "done", amount) : entry(`Parts bought before the cancellation: ${amount}`, "quiet", "At their cost, with nothing added.");
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
      // Older entries may say "credited": a credit made before 18 November 2026 still comes off the bill.
      return audience === "tradie" ? null : entry("Nobody on site by the promised time", "alert", d.credited ? "The call-out portion of this job is on us." : audience === "staff" ? (d.no_show ? "The tradie had accepted: a no-show." : "Nobody had taken it.") : null);
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
    // A staying guest's number is for that job's texts only; a tradie sees the first name (privacy page).
    job: audience === "tradie" ? { ...job, guestPhone: null } : job,
    market: context.market,
    property: context.property,
    owner: { name: context.owner.name, phone: context.owner.phone },
    tradie: context.tradie ? { id: context.tradie.id, name: context.tradie.name, businessName: context.tradie.businessName, phone: context.tradie.phone } : null,
    lines,
    quotes,
    offers,
    reportPhotos: uploads.filter((upload) => upload.kind === "report"),
    // Receipts are never shown with the work photos: only staff see them (DECISIONS.md, 2026-11-20).
    workPhotos: uploads.filter((upload) => upload.kind === "completion" || upload.kind === "quote"),
    beforePhotos: uploads.filter((upload) => upload.kind === "before"),
    afterPhotos: uploads.filter((upload) => upload.kind === "completion"),
    history,
    money: {
      payment: p ? { status: p.status, amountCents: p.amount_cents, refundedCents: p.refunded_cents, paidAt: p.paid_at ? new Date(p.paid_at) : null, lastError: p.last_error, attempts: p.attempts } : null,
      payout: o ? { status: o.status, amountCents: o.amount_cents, releaseAt: new Date(o.release_at), sentAt: o.sent_at ? new Date(o.sent_at) : null, lastError: o.last_error } : null,
      dispute: dsp ? { id: dsp.id, status: dsp.status, reason: dsp.reason, createdAt: new Date(dsp.created_at), refundCents: dsp.refund_cents, resolutionNote: dsp.resolution_note } : null,
      credit: credits[0] ? { amountCents: credits[0].amount_cents, status: credits[0].status } : null,
    },
    laterTime: audience === "tradie" ? null : await waitingLaterTime(db, job.id),
    parts: (await listParts(db, job.id)).map((part) => (audience === "owner" ? { ...part, receiptUploadId: null, receiptTotalCents: null, amountCents: 0, tradieCents: 0 } : part)),
    receipts: audience === "staff" ? uploads.filter((upload) => upload.kind === "receipt") : [],
  };
}
