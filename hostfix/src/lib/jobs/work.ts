import { audit } from "@/lib/audit";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { attachUploads, countUploads } from "@/lib/files/uploads";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { FLAG_DAYS, flagsNeedReview, recentFlags } from "@/lib/tradies/reliability";
import { formatClock, formatDate } from "@/lib/time";
import { openSettlement, type GatewayFor } from "@/lib/billing/settle";
import { getBilling } from "@/lib/owners/service";
import type { DebitResult } from "@/lib/payments/gateway";
import { baseUrl } from "@/lib/env";
import { addMinutes } from "@/lib/clock";
import { releaseIfClear } from "@/lib/billing/holds";
import { loadContext, offerUrl, ownerJobUrl } from "./context";
import { arrivedOnTime, linesToDrop, surchargeVerdict } from "./arrival";
import { receiptsAtJobDone } from "./parts";
import { checkTap, chooseReference, jobFlags, minutesOnSite, photoIsStale, pointFrom, tooQuick } from "./checks";
import { callOutPayout, DEPOSIT_ABOVE_CENTS, depositFor, hourlyLabour, noAccessLines, quoteAmounts, withFee } from "./pricing";
import { HOURLY_LIMIT_CENTS, hourlyRate } from "./rates";
import { noteQuoteRate } from "@/lib/tradies/quote-rate";
import { formatMoney } from "@/lib/money";
import { getQuote, insertLines, listLines, lockJob, recalcTotals, rowToQuote } from "./store";
import type { Job, Quote } from "./types";

/**
 * WHAT THE TRADIE DOES ON A JOB: on the way, arrived, quote for more work,
 * done. And the owner's answer to a quote.
 *
 * Every tradie step checks that the job is theirs. A step taken twice (a
 * double tap, a retry on a bad connection) does nothing the second time.
 */

export type StepResult = { ok: true; job: Job } | { ok: false; message: string };

async function theirs(db: Db, jobId: string, tradieId: string): Promise<Job | null> {
  const job = await lockJob(db, jobId);
  return job && job.tradieId === tradieId ? job : null;
}

const NOT_YOURS = "That job is not one of yours.";

/** Who to text about the tradie coming, when a guest is staying: the guest the owner named, or the guest who reported it. */
export function guestPhoneFor(job: Pick<Job, "guestPhone" | "reportedBy" | "reporterPhone">): string | null {
  return job.guestPhone ?? (job.reportedBy === "guest" ? job.reporterPhone : null);
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The tradie finds a hazard at the property (DECISIONS.md, 2026-11-20, second
 * entry): it is added to the property's safety notes for the next tradie, and
 * the owner is told.
 */
export async function reportHazard(db: Db, jobId: string, tradieId: string, words: string): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (!["accepted", "on_site", "awaiting_approval", "completed"].includes(job.status)) return { ok: false, message: "This job is closed." };
    const hazard = words.replace(/\s+/g, " ").trim().slice(0, 400);
    if (hazard.length < 5) return { ok: false, message: "Say in a few words what the hazard is, for example: rotten deck boards by the back door." };
    const context = await loadContext(tx, job);
    const { market, property, owner, tradie } = context;
    const line = `${formatDate(now(), market.timezone)}, noted by ${tradie?.businessName ?? "a tradie"}: ${hazard}`;
    await tx.query(
      "update public.properties set hazards = left(case when hazards = '' then $2 else hazards || E'\\n' || $2 end, 3000) where id = $1::uuid",
      [property.id, line],
    );
    await audit(tx, { actor: `tradie:${tradieId}`, action: "property.hazard_added", entity: "property", entityId: property.id, detail: { job: jobId, hazard } });
    await audit(tx, { actor: `tradie:${tradieId}`, action: "job.hazard_reported", entity: "job", entityId: jobId, detail: { hazard } });
    if (owner.phone && tradie) {
      await enqueue(tx, {
        channel: "sms", to: owner.phone, template: "hazard_added", audience: "owner", jobId, userId: owner.userId,
        body: texts.hazardAdded({ tradie: tradie.businessName, property: property.name, hazard, link: ownerJobUrl(job) }), dedupeKey: `hazard_added:${jobId}:${hazard.slice(0, 40)}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

async function acceptedOfferFor(db: Db, job: Job): Promise<{ id: string; number: number } | null> {
  const rows = await db.query<{ id: string; number: number }>(
    "select id, number from public.offers where job_id = $1::uuid and tradie_id = $2::uuid and status = 'accepted' order by responded_at desc limit 1",
    [job.id, job.tradieId],
  );
  return rows[0] ? { id: rows[0].id, number: Number(rows[0].number) } : null;
}

export async function markEnRoute(db: Db, jobId: string, tradieId: string): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status !== "accepted") return { ok: true, job };
    if (!job.enRouteAt) {
      await tx.query("update public.jobs set en_route_at = $2::timestamptz where id = $1::uuid", [jobId, now().toISOString()]);
      await audit(tx, { actor: `tradie:${tradieId}`, action: "job.en_route", entity: "job", entityId: jobId });
      // A guest staying in the house is told again when the tradie sets off (DECISIONS.md, 2026-11-20, second entry).
      const guest = guestPhoneFor(job);
      if (guest) {
        const context = await loadContext(tx, job);
        await enqueue(tx, {
          channel: "sms", to: guest, template: "guest_on_the_way", audience: "reporter", jobId,
          body: texts.guestOnTheWay({ tradie: firstName(context.tradie?.name ?? "Your tradie"), title: job.title }), dedupeKey: `guest_on_the_way:${jobId}`,
        });
      }
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/**
 * The tradie is at the property. This is the moment the response promise is
 * measured against, and the moment the surcharges are settled (DECISIONS.md,
 * 2026-11-18), so the owner sees the final lines on their job page before the
 * card is charged at the end:
 *
 *   urgent, after the deadline   the urgent line comes off: 0 for the owner,
 *                                0 for the tradie, 0 for us
 *   emergency, after the hour    the emergency line comes off the same way
 *   after hours, but the tap is  the after-hours line comes off, the same way
 *   inside working hours
 *
 * Everything else on the job is charged and paid as normal.
 *
 * At least one "before" photo, taken in the app, is needed (DECISIONS.md,
 * 2026-11-19). The tap's location is compared with the property's map pin, or
 * with where trusted arrivals at the property were when it has none, and the
 * distance is recorded. A tap with no location, or over 300 m away, is never
 * refused (phones get it wrong): it is one of the job's flags when the job is
 * finished, and a flagged job's payment waits for the owner to confirm. It no
 * longer goes to the dispatcher's queue on its own.
 */
export async function markArrived(
  db: Db, jobId: string, tradieId: string, input: { lat?: number | null; lng?: number | null; uploadIds?: string[] } = {},
): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status !== "accepted") return job.arrivedAt ? { ok: true, job } : { ok: false, message: "This job cannot be marked as arrived right now." };
    await attachUploads(tx, input.uploadIds ?? [], { kind: "before", uploadedBy: `tradie:${tradieId}`, jobId });
    const beforePhotos = await countUploads(tx, jobId, "before");
    if (beforePhotos === 0) return { ok: false, message: "Take at least one \"before\" photo of the problem first, then tap I have arrived." };
    const at = now();
    const point = pointFrom(input);
    const context = await loadContext(tx, job);
    const { market, property, owner, tradie } = context;

    const reference = chooseReference(property.pin, await earlierTrustedTaps(tx, job));
    const trust = checkTap(point, reference);

    await tx.query(
      `update public.jobs set status = 'on_site', arrived_at = $2::timestamptz, arrived_lat = $3, arrived_lng = $4, arrival_check = $5, arrival_distance_m = $6,
              check_reference = $7
        where id = $1::uuid`,
      [jobId, at.toISOString(), point?.lat ?? null, point?.lng ?? null, trust.check, trust.distanceM, reference.kind],
    );
    const onTime = arrivedOnTime(job, at);
    await resolveExceptionsFor(tx, jobId, ["at_risk", "no_show"], "Tradie arrived");
    await audit(tx, {
      actor: `tradie:${tradieId}`, action: "job.arrived", entity: "job", entityId: jobId,
      detail: {
        on_time: onTime, located: point !== null, location: trust.check, distance_m: trust.distanceM, reference: reference.kind,
        before_photos: beforePhotos,
        window_end: job.arrivalWindowEnd?.toISOString() ?? null,
        minutes_from_dispatch: job.dispatchedAt ? Math.round((at.getTime() - job.dispatchedAt.getTime()) / 60_000) : null,
      },
    });

    // The surcharges follow what actually happened.
    const verdict = surchargeVerdict(job, at, market);
    const dropped = linesToDrop((await listLines(tx, jobId)).filter((line) => line.status === "active"), verdict);
    if (dropped.length > 0) {
      await tx.query("update public.job_lines set status = 'void' where id = any($1::uuid[])", [dropped.map((line) => line.id)]);
      const sum = await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
      await audit(tx, {
        actor: "system", action: "job.surcharge_dropped", entity: "job", entityId: jobId,
        amount: dropped.reduce((total, line) => total + line.ownerCents, 0), currency: job.currency,
        detail: {
          urgent: dropped.some((line) => line.kind === "urgent"), emergency: dropped.some((line) => line.kind === "emergency"),
          after_hours: dropped.some((line) => line.kind === "after_hours"),
          owner_off: dropped.reduce((total, line) => total + line.ownerCents, 0), tradie_off: dropped.reduce((total, line) => total + line.tradieCents, 0),
          owner_now: sum.ownerCents, tradie_now: sum.tradieCents,
          deadline: job.respondBy?.toISOString() ?? null,
        },
      });
    }

    if (owner.phone && tradie) {
      await enqueue(tx, {
        channel: "sms", to: owner.phone, template: "tradie_arrived", audience: "owner", jobId, userId: owner.userId,
        body: texts.tradieArrived({ tradie: tradie.businessName, property: property.name, link: ownerJobUrl(job) }), dedupeKey: `tradie_arrived:${jobId}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/**
 * Where tradies were when they arrived at this house before: the fallback
 * reference for a property with no map pin. Taps that were flagged, or that
 * the owner disputed, are left out.
 */
async function earlierTrustedTaps(db: Db, job: Job): Promise<{ lat: number; lng: number }[]> {
  const rows = await db.query<{ arrived_lat: string | number; arrived_lng: string | number }>(
    `select arrived_lat, arrived_lng from public.jobs
      where property_id = $1::uuid and id <> $2::uuid and arrived_lat is not null and arrived_lng is not null
        and arrival_check in ('ok', 'no_reference') and owner_says_absent_at is null
        and coalesce(confirm_status, '') not in ('owner_problem', 'staff_held')
      order by arrived_at desc limit 25`,
    [job.propertyId, job.id],
  );
  return rows.map((row) => ({ lat: Number(row.arrived_lat), lng: Number(row.arrived_lng) }));
}


/**
 * The owner presses "The tradie isn't here" on their job page. Puts it in
 * front of the dispatcher straight away (and on the founder's phone). Safe to
 * press twice: the second press changes nothing.
 */
export async function reportTradieAbsent(db: Db, jobId: string, actor: string): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    if (!job.arrivedAt || !["on_site", "awaiting_approval"].includes(job.status)) {
      return { ok: false, message: "This button is for when the app says the tradie has arrived. For anything else, contact us." };
    }
    if (job.ownerSaysAbsentAt) return { ok: true, job };
    const at = now();
    await tx.query("update public.jobs set owner_says_absent_at = $2::timestamptz where id = $1::uuid", [jobId, at.toISOString()]);
    const { property, tradie, market } = await loadContext(tx, job);
    await audit(tx, { actor, action: "job.owner_says_absent", entity: "job", entityId: jobId, detail: { tradie: tradie?.businessName ?? null } });
    await raiseException(tx, {
      kind: "owner_says_absent", market: job.market, jobId, tradieId: job.tradieId,
      summary: `Job ${job.number}: the owner says ${tradie?.businessName ?? "the tradie"} is not at ${property.name}, although they tapped Arrived at ${formatClock(job.arrivedAt, market.timezone)}. Ring the tradie${tradie?.phone ? ` on ${tradie.phone}` : ""}, then the owner.`,
      dedupeKey: `owner_says_absent:${jobId}`,
    });
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/** Extra work, priced by the tradie. Parts are added on their own (src/lib/jobs/parts.ts). */
export type QuoteInput = {
  description: string;
  /** Work up to HOURLY_LIMIT_CENTS: hours (quarter hours) at the market's fixed rate for the trade. */
  hours?: number | null;
  /** Bigger work, or a trade with no fixed rate: the tradie's own price for the work. */
  labourCents?: number | null;
  uploadIds: string[];
  /**
   * "Not the job described" (menu jobs only, DECISIONS.md, 2026-11-20, third entry): the one-line reason. At
   * least one photo is needed. The menu price comes off; the call-out goes on, paid once the owner approves the
   * quote or does not object in time.
   */
  notDescribed?: { reason: string } | null;
};
export type QuoteResult = { ok: true; job: Job; quote: Quote } | { ok: false; message: string };

/**
 * The tradie prices extra or off-menu work. On a menu job a quote is for work
 * beyond the job described: the described job is still done at the menu
 * price. Under the limit it goes ahead and the owner is told. Over it, nothing
 * starts until the owner says yes. Work up to NZ$1,000 is quoted in hours at
 * the market's fixed rate. Parts are added separately, on any job (addParts,
 * src/lib/jobs/parts.ts). A return visit goes in the quote: there is never a
 * second call-out on the same job.
 */
export async function submitQuote(db: Db, jobId: string, tradieId: string, input: QuoteInput): Promise<QuoteResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status === "awaiting_approval") return { ok: false, message: "There is already a quote waiting for the owner's answer." };
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then add the quote." };
    const description = input.description.replace(/\s+/g, " ").trim();
    if (description.length < 3) return { ok: false, message: "Say in a few words what the work is." };

    const context = await loadContext(tx, job);
    const { market, property, owner, tradie } = context;
    const rate = await hourlyRate(tx, market.slug, job.trade);
    let labourCents: number;
    let hours: number | null = null;
    if (input.hours !== undefined && input.hours !== null) {
      if (rate === null) return { ok: false, message: "There is no fixed hourly rate for this trade yet. Enter your price for the work instead." };
      try {
        labourCents = hourlyLabour(input.hours, rate);
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
      if (labourCents > HOURLY_LIMIT_CENTS) {
        return { ok: false, message: `That comes to more than ${formatMoney(HOURLY_LIMIT_CENTS, job.currency)} of work. Over that, enter your own price for the whole job instead of hours.` };
      }
      hours = input.hours;
    } else {
      if (!Number.isInteger(input.labourCents) || (input.labourCents ?? 0) <= 0) {
        return { ok: false, message: rate === null ? "Enter your price for the work. Parts are added with \"Add parts\"." : "Enter the hours the work will take. Parts are added with \"Add parts\"." };
      }
      labourCents = input.labourCents!;
      if (rate !== null && labourCents <= HOURLY_LIMIT_CENTS) {
        return { ok: false, message: `Work up to ${formatMoney(HOURLY_LIMIT_CENTS, job.currency)} is quoted in hours at the fixed rate of ${formatMoney(rate, job.currency)} an hour.` };
      }
    }
    if (labourCents > 2_000_000) return { ok: false, message: "That is more than can be quoted here. Contact us about this job." };

    // "Not the job described": menu jobs only, once, with a reason and at least one photo.
    const notDescribed = input.notDescribed ?? null;
    let reason: string | null = null;
    if (notDescribed) {
      if (job.offMenu) return { ok: false, message: "This is already a look-and-price job. Send a quote for the work." };
      if (job.notDescribedAt) return { ok: false, message: "You have already said this is not the job described." };
      reason = notDescribed.reason.replace(/\s+/g, " ").trim();
      if (reason.length < 5) return { ok: false, message: "Say in one line why it is not the job described, for example: the tap is fine, the pipe behind the wall has burst." };
      if (reason.length > 160) return { ok: false, message: "Keep the reason to one line (160 characters)." };
      if (input.uploadIds.length === 0) return { ok: false, message: "Add at least one photo of what you found." };
    }

    const lines = await listLines(tx, jobId);
    const approved = await tx.query<{ total: number }>(
      "select coalesce(sum(owner_total_cents), 0) as total from public.quotes where job_id = $1::uuid and status in ('approved', 'auto_approved')",
      [jobId],
    );
    // The call-out credit: an off-menu job's call-out comes off its first quote the owner approves (or that is within their limit).
    const diagnosis = lines.find((line) => line.kind === "diagnosis" && line.status === "active");
    const credited = await tx.query("select 1 from public.quotes where job_id = $1::uuid and credit_cents > 0 and status in ('pending', 'approved', 'auto_approved')", [jobId]);
    const creditCents = job.offMenu && !job.notDescribedAt && diagnosis && credited.length === 0 ? diagnosis.ownerCents : 0;
    // At the job's own fee: 5% on a job between an own-client pair (DECISIONS.md, 2026-11-23), otherwise the market's.
    const amounts = quoteAmounts(withFee(market, job.platformFeeBps), {
      description, labourCents, creditCents,
      limitCents: property.spendLimitCents, alreadyApprovedCents: Number(approved[0]?.total ?? 0),
    });
    // A quote sent with "Not the job described" always waits for the owner. So does work that takes the job's total
    // over NZ$1,000: approving it takes a 50% deposit first, by bank debit or card (DECISIONS.md, 2026-11-23, second entry).
    const activeLines = lines.filter((line) => line.status === "active");
    const jobNowCents = activeLines.reduce((sum, line) => sum + line.ownerCents, 0)
      - (notDescribed ? activeLines.filter((line) => line.kind === "menu").reduce((sum, line) => sum + line.ownerCents, 0) - market.diagnosisFeeCents : 0);
    const deposit = jobNowCents + amounts.ownerTotalCents > DEPOSIT_ABOVE_CENTS;
    const needsApproval = amounts.needsApproval || notDescribed !== null || deposit;
    const at = now();
    const rows = await tx.query<Parameters<typeof rowToQuote>[0]>(
      `insert into public.quotes
         (created_at, job_id, tradie_id, description, labour_cents, parts_cents, owner_total_cents, tradie_total_cents, needs_approval, status, decided_at, decided_by,
          hours, rate_cents, credit_cents, not_described, deposit)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12, $13, $14, $15, $16, $17)
       returning *`,
      [
        at.toISOString(), jobId, tradieId, description, labourCents, 0, amounts.ownerTotalCents, amounts.tradieTotalCents,
        needsApproval, needsApproval ? "pending" : "auto_approved", needsApproval ? null : at.toISOString(), needsApproval ? null : "system",
        hours, hours === null ? null : rate, creditCents > 0 ? Math.min(creditCents, labourCents) : 0, notDescribed !== null, deposit,
      ],
    );
    const quote = rowToQuote(rows[0]!);

    if (notDescribed) {
      // The menu price comes off; the call-out goes on. Paid once the owner approves the quote, or does not object in time.
      await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and kind = 'menu' and status = 'active'", [jobId]);
      await insertLines(tx, jobId, [{ kind: "diagnosis", label: "Call-out (not the job described)", ownerCents: market.diagnosisFeeCents, tradieCents: callOutPayout(market, job.platformFeeBps) }], { at });
      await tx.query(
        "update public.jobs set not_described_at = $2::timestamptz, not_described_reason = $3, not_described_status = 'waiting', not_described_by = $4::timestamptz where id = $1::uuid",
        [jobId, at.toISOString(), reason, addHours(at, market.notDescribedHours).toISOString()],
      );
      await audit(tx, {
        actor: `tradie:${tradieId}`, action: "job.not_described", entity: "job", entityId: jobId, amount: market.diagnosisFeeCents, currency: job.currency,
        detail: { reason, callout_payout: callOutPayout(market, job.platformFeeBps), owner_can_object_until: addHours(at, market.notDescribedHours).toISOString() },
      });
    }
    await insertLines(tx, jobId, amounts.lines, { at: new Date(at.getTime() + 10), status: needsApproval ? "pending" : "active", quoteId: quote.id });
    await attachUploads(tx, input.uploadIds, { kind: "quote", uploadedBy: `tradie:${tradieId}`, jobId });
    if (notDescribed && (await countUploads(tx, jobId, "quote")) === 0) throw new Error("A photo is needed with \"Not the job described\".");
    await audit(tx, {
      actor: `tradie:${tradieId}`, action: "quote.submitted", entity: "job", entityId: jobId, amount: amounts.ownerTotalCents, currency: job.currency,
      detail: { quote: quote.id, description, needs_approval: needsApproval, reason: amounts.approvalReason, hours, rate: hours === null ? null : rate, credit: quote.creditCents, not_described: notDescribed !== null },
    });

    if (needsApproval) {
      await tx.query("update public.jobs set status = 'awaiting_approval' where id = $1::uuid", [jobId]);
    }
    await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
    if (owner.phone && tradie) {
      const link = ownerJobUrl(job);
      const body = notDescribed
        ? texts.notDescribed({ tradie: tradie.businessName, property: property.name, amountCents: amounts.ownerTotalCents, currency: job.currency, link })
        : (needsApproval ? texts.quoteNeedsApproval : texts.quoteGoingAhead)({ tradie: tradie.businessName, amountCents: amounts.ownerTotalCents, currency: job.currency, property: property.name, link });
      await enqueue(tx, {
        channel: "sms", to: owner.phone, template: notDescribed ? "not_described" : needsApproval ? "quote_needs_approval" : "quote_going_ahead", audience: "owner", jobId, userId: owner.userId,
        body, dedupeKey: `quote:${quote.id}`,
      });
    }
    await noteQuoteRate(tx, job, tradieId);
    return { ok: true, job: (await lockJob(tx, jobId))!, quote };
  });
}

/** How big work's deposit is paid (DECISIONS.md, 2026-11-23, second entry): the owner's bank (the default) or their card. */
export type DepositMethod = "bank" | "card";

/** Half of the approved amount the hold on the card does not already cover (depositFor), for a quote waiting on the owner. */
export async function depositNeeded(db: Db, quote: Pick<Quote, "jobId" | "ownerTotalCents">, jobTotalCents: number): Promise<number> {
  const hold = await db.query<{ amount_cents: number }>(
    "select amount_cents from public.card_holds where job_id = $1::uuid and status = 'held' order by seq desc limit 1",
    [quote.jobId],
  );
  return depositFor({ quoteCents: Math.max(0, quote.ownerTotalCents), holdCents: Number(hold[0]?.amount_cents ?? 0), jobTotalCents });
}

type PrepaymentRow = { id: string; status: string; attempts: number; claimed_until: Date | null; method: DepositMethod; amount_cents: number; approved_by: string | null };

/**
 * The owner (or the team, on their behalf) answers a quote. Work that takes the job over NZ$1,000 (`quote.deposit`)
 * takes a 50% deposit when it is approved (DECISIONS.md, 2026-11-23, second entry):
 *  - by bank debit (the default, no card fees): the debit is made and the quote waits while it clears (usually 3 to 4
 *    working days). The tradie is told "approved, deposit clearing" and must not start. Once it clears (Stripe's
 *    message, or the timer asking: src/lib/billing/debits.ts) the quote is approved and the tradie told to go ahead.
 *  - by card (for urgent big work): charged at once; the quote is approved as soon as it goes through.
 * The other half comes with the rest of the job at Job done, the same way. A deposit that fails leaves the quote
 * unapproved: the owner is asked to sort it and the tradie told not to start. Claimed first, then asked for with a
 * key that makes a repeat harmless, then written down.
 */
export async function answerQuote(db: Db, gatewayFor: GatewayFor, quoteId: string, approve: boolean, actor: string, options: { method?: DepositMethod } = {}): Promise<QuoteResult> {
  const quote = await getQuote(db, quoteId);
  if (!quote) return { ok: false, message: "We could not find that quote." };
  if (quote.status === "pending") {
    const clearing = await db.query("select 1 from public.job_prepayments where quote_id = $1::uuid and status = 'processing'", [quoteId]);
    if (clearing.length > 0) {
      return { ok: false, message: "The deposit for this work is on its way from the bank, so there is nothing to answer now. If you no longer want the work, ring us." };
    }
  }
  if (!approve || !quote.deposit || quote.status !== "pending") return decideQuote(db, quoteId, approve, actor);

  const claim = await db.tx(async (tx) => {
    const job = await lockJob(tx, quote.jobId);
    if (!job) return { error: "We could not find that job." };
    const fresh = (await getQuote(tx, quoteId))!;
    if (fresh.status !== "pending") return { done: true as const };
    const at = now();
    const existing = (await tx.query<PrepaymentRow>(
      "select id, status, attempts, claimed_until, method, amount_cents, approved_by from public.job_prepayments where quote_id = $1::uuid for update",
      [quoteId],
    ))[0];
    if (existing?.status === "succeeded") return { paid: true as const };
    if (existing?.status === "processing") return { error: "The deposit for this work is on its way from the bank. We text you both once it clears." };
    if (existing?.status === "charging" && existing.claimed_until && new Date(existing.claimed_until).getTime() > at.getTime()) return { error: "The deposit for this work is going through now. Refresh in a minute." };
    const context = await loadContext(tx, job);
    const billing = await getBilling(tx, job.ownerId, context.market.country);
    // A try that was cut off half-way keeps its method, amount and key, so a repeat is the same request.
    const resume = existing?.status === "charging";
    const method: DepositMethod = resume ? existing.method : (options.method ?? (billing?.bankPaymentMethodId ? "bank" : "card"));
    if (method === "bank" && !billing?.bankPaymentMethodId) return { error: "Add your bank account first, or pay the deposit by card instead." };
    const amount = resume ? Number(existing.amount_cents) : await depositNeeded(tx, fresh, job.ownerTotalCents);
    // The hold on the card already covers the work: nothing to take now.
    if (amount <= 0) return { free: true as const };
    let id = existing?.id;
    let attempt = 1;
    if (!existing) {
      const inserted = await tx.query<{ id: string }>(
        `insert into public.job_prepayments (created_at, job_id, quote_id, owner_id, amount_cents, currency, status, attempts, claimed_until, method, approved_by)
         values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, $5, $6, 'charging', 1, $7::timestamptz, $8, $9) returning id`,
        [at.toISOString(), job.id, quoteId, job.ownerId, amount, job.currency, addMinutes(at, 2).toISOString(), method, actor],
      );
      id = inserted[0]!.id;
    } else {
      // A try that ended in a definite "no" moves to the next key; one that was cut off keeps its key.
      attempt = existing.status === "failed" ? Number(existing.attempts) + 1 : Number(existing.attempts);
      await tx.query(
        "update public.job_prepayments set status = 'charging', attempts = $2, claimed_until = $3::timestamptz, method = $4, amount_cents = $5, approved_by = $6, last_error = null where id = $1::uuid",
        [existing.id, attempt, addMinutes(at, 2).toISOString(), method, amount, actor],
      );
    }
    return { id: id!, attempt, job, context, billing, amount, method };
  });
  if ("error" in claim) return { ok: false, message: claim.error! };
  if ("done" in claim || "free" in claim) return decideQuote(db, quoteId, approve, actor, { depositChecked: true });
  if ("paid" in claim) return decideQuote(db, quoteId, true, actor);

  const { id, attempt, job, context, billing, amount, method } = claim;
  const gateway = gatewayFor(context.market.country);
  const description = `Job ${job.number}: 50% deposit for approved work at ${context.property.name}`.slice(0, 200);
  let result: DebitResult;
  if (!gateway) result = { status: "failed", reason: "Payments are not set up for this country.", code: "not_configured", paymentIntentId: null };
  else if (!billing || billing.provider !== gateway.provider) result = { status: "failed", reason: "The owner has no card or bank account on file.", code: "no_card", paymentIntentId: null };
  else if (method === "bank") {
    try {
      result = await gateway.debitBank({
        customerId: billing.customerId, paymentMethodId: billing.bankPaymentMethodId!, amountCents: amount, currency: job.currency, description,
        jobNumber: job.number, purpose: "deposit", idempotencyKey: `hostfix-quote-${quoteId}-deposit-${attempt}`,
      });
    } catch (error) {
      // Unknown whether the debit was made: the claim is let go and the next try asks again with the same key.
      const reason = error instanceof Error ? error.message : String(error);
      await db.tx(async (tx) => {
        await tx.query("update public.job_prepayments set claimed_until = null, last_error = $2 where id = $1::uuid and status = 'charging'", [id, reason.slice(0, 500)]);
        await audit(tx, { actor: "system", action: "quote.deposit_unclear", entity: "job", entityId: job.id, amount, currency: job.currency, detail: { quote: quoteId, reason, attempt } });
      });
      return { ok: false, message: "We could not reach the bank just now. Nothing has been approved yet. Try again in a minute." };
    }
  } else {
    result = await gateway.chargeJob({
      customerId: billing.customerId, paymentMethodId: billing.paymentMethodId, amountCents: amount, currency: job.currency, description,
      jobNumber: job.number, receiptEmail: context.owner.email, idempotencyKey: `hostfix-quote-${quoteId}-deposit-${attempt}`,
    });
  }

  if (result.status === "succeeded") {
    const paid = result;
    await db.tx(async (tx) => {
      await tx.query(
        "update public.job_prepayments set status = 'succeeded', payment_intent_id = $2, charge_id = $3, provider = $4, paid_at = $5::timestamptz, claimed_until = null, last_error = null where id = $1::uuid",
        [id, paid.paymentIntentId, paid.chargeId, gateway!.provider, now().toISOString()],
      );
      await audit(tx, {
        actor: gateway!.provider, action: "quote.deposit_paid", entity: "job", entityId: job.id, amount, currency: job.currency,
        detail: { quote: quoteId, payment_intent: paid.paymentIntentId, attempt, method }, dedupeKey: `quote.deposit_paid:${quoteId}`,
      });
    });
    return decideQuote(db, quoteId, true, actor);
  }

  if (result.status === "processing") {
    const clearing = result;
    await db.tx(async (tx) => {
      await tx.query(
        "update public.job_prepayments set status = 'processing', payment_intent_id = $2, charge_id = $3, provider = $4, claimed_until = null, last_error = null, checked_at = $5::timestamptz where id = $1::uuid",
        [id, clearing.paymentIntentId, clearing.chargeId, gateway!.provider, now().toISOString()],
      );
      await audit(tx, {
        actor: gateway!.provider, action: "quote.deposit_clearing", entity: "job", entityId: job.id, amount, currency: job.currency,
        detail: { quote: quoteId, payment_intent: clearing.paymentIntentId, attempt, approved_by: actor }, dedupeKey: `quote.deposit_clearing:${quoteId}:${attempt}`,
      });
      // The owner has answered; the work waits for the bank, not for them.
      await resolveExceptionsFor(tx, job.id, ["quote_waiting"], "Owner approved: the deposit is clearing");
      const offer = await acceptedOfferFor(tx, job);
      if (context.tradie?.phone && offer) {
        await enqueue(tx, {
          channel: "sms", to: context.tradie.phone, template: "deposit_clearing", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
          body: texts.depositClearing({ number: job.number, link: offerUrl(offer) }), dedupeKey: `deposit_clearing:${quoteId}:${attempt}`,
        });
      }
    });
    return { ok: true, job: (await lockJob(db, job.id))!, quote: (await getQuote(db, quoteId))! };
  }

  const reason = result.reason;
  const failedIntent = result.paymentIntentId;
  await db.tx(async (tx) => {
    await tx.query("update public.job_prepayments set status = 'failed', payment_intent_id = coalesce($2, payment_intent_id), claimed_until = null, last_error = $3 where id = $1::uuid", [
      id, failedIntent, reason.slice(0, 500),
    ]);
    await audit(tx, { actor: gateway?.provider ?? "system", action: "quote.payment_failed", entity: "job", entityId: job.id, amount, currency: job.currency, detail: { quote: quoteId, reason, attempt, method }, dedupeKey: `quote.payment_failed:${quoteId}:${attempt}` });
    const offer = await acceptedOfferFor(tx, job);
    if (context.tradie?.phone && offer) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "quote_cannot_start", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
        body: (method === "bank" ? texts.depositFailedTradie : texts.quoteCannotStart)({ number: job.number, link: offerUrl(offer) }), dedupeKey: `quote_cannot_start:${quoteId}:${attempt}`,
      });
    }
    if (context.owner.phone && !actor.startsWith("owner:")) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "quote_payment_failed", audience: "owner", jobId: job.id, userId: context.owner.userId,
        body: (method === "bank" ? texts.depositFailedOwner : texts.quotePaymentFailed)({ number: job.number, amountCents: amount, currency: job.currency, link: method === "bank" ? ownerJobUrl(job) : `${baseUrl()}/app/billing` }),
        dedupeKey: `quote_payment_failed:${quoteId}:${attempt}`,
      });
    }
    if (method === "bank") {
      await raiseException(tx, {
        kind: "deposit_failed", market: job.market, jobId: job.id, tradieId: job.tradieId,
        summary: `Job ${job.number}: the bank did not accept the ${formatMoney(amount, job.currency)} deposit (${reason}). The work is not approved and the tradie has been told not to start. The owner can approve it again by card, or after updating their bank account.`,
        dedupeKey: `deposit_failed:${quoteId}:${attempt}`,
      });
    }
  });
  return {
    ok: false,
    message: method === "bank"
      ? `Your bank did not accept the ${formatMoney(amount, job.currency)} deposit (${reason}), so the work is not approved yet. Pay it by card instead, or update your bank account on the Billing page, then approve it again.`
      : `Your card was declined for the ${formatMoney(amount, job.currency)} deposit, so the work is not approved yet and cannot start. Update your card on the Billing page, then approve it again.`,
  };
}

/**
 * A deposit debit from the owner's bank has cleared or failed (DECISIONS.md, 2026-11-23, second entry): Stripe's
 * message, or the timer asking (src/lib/billing/debits.ts). Safe to call twice: only a deposit still processing moves.
 *  - cleared: the quote is approved in the name of whoever approved it, and the tradie is told to go ahead. If the
 *    work is no longer going ahead (the job was cancelled, the quote withdrawn), the deposit is refunded instead.
 *  - failed (or came back): the quote stays unapproved, the owner is asked to sort it, the tradie told not to start,
 *    and the team has it in the queue.
 */
export async function depositOutcome(db: Db, prepaymentId: string, result: DebitResult): Promise<"approved" | "refund_due" | "failed" | "nothing"> {
  if (result.status === "processing") {
    await db.query("update public.job_prepayments set checked_at = $2::timestamptz where id = $1::uuid and status = 'processing'", [prepaymentId, now().toISOString()]);
    return "nothing";
  }
  const step = await db.tx(async (tx) => {
    const row = (await tx.query<PrepaymentRow & { job_id: string; quote_id: string; currency: string; provider: string | null }>(
      "select * from public.job_prepayments where id = $1::uuid and status = 'processing' for update",
      [prepaymentId],
    ))[0];
    if (!row) return null;
    const job = await lockJob(tx, row.job_id);
    if (!job) return null;
    const quote = await getQuote(tx, row.quote_id);
    const context = await loadContext(tx, job);
    const at = now();
    if (result.status === "succeeded") {
      const going = quote?.status === "pending" && job.status === "awaiting_approval";
      await tx.query(
        "update public.job_prepayments set status = $2, charge_id = coalesce($3, charge_id), paid_at = $4::timestamptz, last_error = null where id = $1::uuid",
        [row.id, going ? "succeeded" : "refund_due", result.chargeId, at.toISOString()],
      );
      await audit(tx, {
        actor: row.provider ?? "stripe", action: "quote.deposit_paid", entity: "job", entityId: job.id, amount: Number(row.amount_cents), currency: row.currency,
        detail: { quote: row.quote_id, method: "bank", going_ahead: going }, dedupeKey: `quote.deposit_paid:${row.quote_id}`,
      });
      return { kind: going ? ("approve" as const) : ("refund" as const), row };
    }
    await tx.query("update public.job_prepayments set status = 'failed', last_error = $2 where id = $1::uuid", [row.id, result.reason.slice(0, 500)]);
    await audit(tx, {
      actor: row.provider ?? "stripe", action: "quote.payment_failed", entity: "job", entityId: job.id, amount: Number(row.amount_cents), currency: row.currency,
      detail: { quote: row.quote_id, reason: result.reason, code: result.code, method: "bank" }, dedupeKey: `quote.deposit_failed:${row.quote_id}:${row.attempts}`,
    });
    if (quote?.status === "pending" && job.status === "awaiting_approval") {
      const offer = await acceptedOfferFor(tx, job);
      if (context.tradie?.phone && offer) {
        await enqueue(tx, {
          channel: "sms", to: context.tradie.phone, template: "quote_cannot_start", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
          body: texts.depositFailedTradie({ number: job.number, link: offerUrl(offer) }), dedupeKey: `deposit_failed_tradie:${row.quote_id}:${row.attempts}`,
        });
      }
      if (context.owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "quote_payment_failed", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.depositFailedOwner({ number: job.number, amountCents: Number(row.amount_cents), currency: row.currency, link: ownerJobUrl(job) }),
          dedupeKey: `deposit_failed_owner:${row.quote_id}:${row.attempts}`,
        });
      }
      await raiseException(tx, {
        kind: "deposit_failed", market: job.market, jobId: job.id, tradieId: job.tradieId,
        summary: `Job ${job.number}: the ${formatMoney(Number(row.amount_cents), row.currency)} deposit from ${context.owner.name}'s bank did not go through (${result.reason}). The work is not approved and the tradie has been told not to start. Ring the owner: they can approve it again from the job page, by bank or card.`,
        dedupeKey: `deposit_failed:${row.quote_id}:${row.attempts}`,
      });
    }
    return { kind: "failed" as const, row };
  });
  if (!step) return "nothing";
  if (step.kind === "refund") return "refund_due";
  if (step.kind === "failed") return "failed";
  const decided = await decideQuote(db, step.row.quote_id, true, step.row.approved_by ?? "system", { cleared: true });
  return decided.ok ? "approved" : "nothing";
}

/**
 * The owner (or the team, on their behalf) answers a quote. Big work needs its deposit first (answerQuote);
 * `cleared` is the deposit from the bank having cleared, so the tradie is told to go ahead.
 */
export async function decideQuote(db: Db, quoteId: string, approve: boolean, actor: string, options: { depositChecked?: boolean; cleared?: boolean } = {}): Promise<QuoteResult> {
  return db.tx(async (tx) => {
    const found = await getQuote(tx, quoteId);
    if (!found) return { ok: false, message: "We could not find that quote." };
    const job = await lockJob(tx, found.jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    const quote = (await getQuote(tx, quoteId))!;
    if (quote.status !== "pending") return { ok: true, job, quote };
    if (approve && quote.deposit && !options.depositChecked) {
      const paid = await tx.query("select 1 from public.job_prepayments where quote_id = $1::uuid and status = 'succeeded'", [quoteId]);
      if (paid.length === 0) return { ok: false, message: "This work takes a 50% deposit when it is approved. Approve it from the job page so the deposit can be taken." };
    }
    const context = await loadContext(tx, job);
    const at = now();

    await tx.query("update public.quotes set status = $2, decided_at = $3::timestamptz, decided_by = $4 where id = $1::uuid", [
      quoteId, approve ? "approved" : "declined", at.toISOString(), actor,
    ]);
    await tx.query("update public.job_lines set status = $2 where quote_id = $1::uuid and status = 'pending'", [quoteId, approve ? "active" : "void"]);
    // Parts asked about first follow the answer (DECISIONS.md, 2026-11-20).
    await tx.query("update public.job_parts set status = $2 where quote_id = $1::uuid and status = 'pending'", [quoteId, approve ? "active" : "void"]);
    if (job.status === "awaiting_approval") await tx.query("update public.jobs set status = 'on_site' where id = $1::uuid", [job.id]);
    await recalcTotals(tx, job.id, context.market.taxRate, context.market.taxRegistered);
    await resolveExceptionsFor(tx, job.id, ["quote_waiting"], approve ? "Owner approved the quote" : "Owner declined the quote");
    // "Not the job described": approving the quote settles the call-out for the tradie (DECISIONS.md, 2026-11-20, third entry).
    if (approve && quote.notDescribed && job.notDescribedStatus === "waiting") {
      await tx.query("update public.jobs set not_described_status = 'approved' where id = $1::uuid", [job.id]);
      await releaseIfClear(tx, job.id);
    }
    await audit(tx, {
      actor, action: approve ? "quote.approved" : "quote.declined", entity: "job", entityId: job.id,
      amount: quote.ownerTotalCents, currency: job.currency, detail: { quote: quoteId },
    });

    const offer = await acceptedOfferFor(tx, job);
    if (context.tradie?.phone && offer) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: approve ? (options.cleared ? "deposit_cleared" : "quote_approved") : "quote_declined", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
        body: approve
          ? options.cleared
            ? texts.depositCleared({ number: job.number, link: offerUrl(offer) })
            : texts.quoteApproved({ number: job.number, amountCents: quote.ownerTotalCents, currency: job.currency, link: offerUrl(offer) })
          : texts.quoteDeclined({ number: job.number, link: offerUrl(offer) }),
        dedupeKey: `quote_decided:${quoteId}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, job.id))!, quote: (await getQuote(tx, quoteId))! };
  });
}

export type CompleteInput = {
  note: string;
  uploadIds: string[];
  /** Where the phone was when the tradie tapped Job done (or Could not get in). */
  lat?: number | null;
  lng?: number | null;
  /** "I will send the receipt later" for an off-list part with no receipt yet. */
  receiptsToFollow?: boolean;
};

async function finish(db: Db, job: Job, tradieId: string, outcome: "done" | "diagnosis_only" | "no_access", input: CompleteInput): Promise<StepResult> {
  const context = await loadContext(db, job);
  const { market, property, owner } = context;
  const at = now();
  await attachUploads(db, input.uploadIds, { kind: "completion", uploadedBy: `tradie:${tradieId}`, jobId: job.id });
  if ((await countUploads(db, job.id, "completion")) === 0) {
    return { ok: false, message: outcome === "no_access" ? "Add a photo showing you were at the property." : "Add at least one \"after\" photo of the finished work." };
  }

  // The checks (DECISIONS.md, 2026-11-19): where Job done was tapped, how long after Arrived, and whether the photos are fresh.
  const point = pointFrom(input);
  let reference = chooseReference(property.pin, await earlierTrustedTaps(db, job));
  if (!reference.point && job.arrivedLat !== null && job.arrivedLng !== null) reference = { point: { lat: job.arrivedLat, lng: job.arrivedLng }, kind: "own_arrival" };
  const finishTap = checkTap(point, reference);
  const minutes = job.arrivedAt ? minutesOnSite(job.arrivedAt, at) : 0;
  const quick = tooQuick(job, outcome, minutes, market.minMinutesOnSite);
  const photos = await db.query<{ taken_at: Date | null }>(
    "select taken_at from public.uploads where job_id = $1::uuid and kind in ('before', 'completion') and attached and taken_at is not null",
    [job.id],
  );
  const stalePhoto = photos.some((row) => photoIsStale(row.taken_at ? new Date(row.taken_at) : null, job.createdAt));
  const flags = jobFlags({ arrival: job.arrivalCheck, finish: finishTap.check, quick, stalePhoto });
  const confirmBy = flags.length > 0 ? addHours(at, market.ownerConfirmHours) : null;

  const sum = await recalcTotals(db, job.id, market.taxRate, market.taxRegistered);
  await db.query(
    `update public.jobs set status = 'completed', completed_at = $2::timestamptz, outcome = $3, completion_note = $4,
            finished_lat = $5, finished_lng = $6, finish_check = $7, finish_distance_m = $8, minutes_on_site = $9,
            check_flags = $10::text[], confirm_status = $11, confirm_by = $12::timestamptz,
            check_reference = case when $13::text = 'own_arrival' then 'own_arrival' else check_reference end
      where id = $1::uuid`,
    [
      job.id, at.toISOString(), outcome, input.note.trim().slice(0, 2000) || null,
      point?.lat ?? null, point?.lng ?? null, finishTap.check, finishTap.distanceM, job.arrivedAt ? minutes : null,
      flags, flags.length > 0 ? "waiting" : null, confirmBy?.toISOString() ?? null, reference.kind,
    ],
  );
  await resolveExceptionsFor(db, job.id, ["at_risk", "quote_waiting"], "Job completed");
  await audit(db, {
    actor: `tradie:${tradieId}`, action: "job.completed", entity: "job", entityId: job.id, amount: sum.ownerCents, currency: job.currency,
    detail: {
      outcome, tradie_gets: sum.tradieCents, platform_keeps: sum.ownerCents - sum.tradieCents,
      located: point !== null, location: finishTap.check, distance_m: finishTap.distanceM, reference: reference.kind, minutes_on_site: minutes,
    },
  });
  if (flags.length > 0) {
    await audit(db, {
      actor: "system", action: "job.flagged", entity: "job", entityId: job.id, amount: sum.tradieCents, currency: job.currency,
      detail: {
        flags, arrival_m: job.arrivalDistanceM, finish_m: finishTap.distanceM, minutes_on_site: minutes, min_minutes: market.minMinutesOnSite,
        reference: reference.kind, owner_confirm_by: confirmBy!.toISOString(), payout_held: sum.tradieCents,
      },
    });
    // 3 flagged jobs in 90 days: the team talks to the tradie. Nothing is changed on their account.
    const flagged = await recentFlags(db, tradieId, at);
    if (flagsNeedReview(flagged)) {
      await raiseException(db, {
        kind: "tradie_flags", market: job.market, tradieId,
        summary: `${context.tradie?.businessName ?? "A tradie"} has had ${flagged} jobs in the last ${FLAG_DAYS} days that the app could not confirm (location, photos or time on site). Look at them and talk to the tradie. Nothing has been changed on their account.`,
        dedupeKey: `tradie_flags:${tradieId}`,
      });
    }
  }
  const done = (await lockJob(db, job.id))!;
  await openSettlement(db, done, market);
  // Nothing to charge means no "job done" text from the charge, so the owner is asked here instead.
  if (flags.length > 0 && owner.phone) {
    const charge = await db.query("select 1 from public.payments where job_id = $1::uuid", [job.id]);
    if (charge.length === 0) {
      await enqueue(db, {
        channel: "sms", to: owner.phone, template: "job_check", audience: "owner", jobId: job.id, userId: owner.userId,
        body: texts.jobCheck({ title: job.title, property: property.name, flags, link: ownerJobUrl(job) }), dedupeKey: `job_done:${job.id}`,
      });
    }
  }
  return { ok: true, job: done };
}

/**
 * The work is finished. Needs at least one "after" photo. This records what
 * is owed and runs the checks (src/lib/jobs/checks.ts); charging the card
 * happens straight after (see billing/settle.ts). A flagged job's payment is
 * held for the owner to confirm (src/lib/jobs/confirm.ts).
 */
export async function completeJob(db: Db, jobId: string, tradieId: string, input: CompleteInput): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status === "completed") return { ok: true, job };
    if (job.status === "awaiting_approval" && !job.notDescribedAt) return { ok: false, message: "The owner has not answered your quote yet. Wait for their answer before finishing." };
    if (job.status === "awaiting_approval") {
      // "Not the job described" and the owner has not answered: the tradie can leave with the call-out. The quote is withdrawn.
      const pending = await tx.query<{ id: string }>("update public.quotes set status = 'withdrawn', decided_at = $2::timestamptz, decided_by = $3 where job_id = $1::uuid and status = 'pending' returning id", [jobId, now().toISOString(), `tradie:${tradieId}`]);
      for (const row of pending) await tx.query("update public.job_lines set status = 'void' where quote_id = $1::uuid and status = 'pending'", [row.id]);
      await tx.query("update public.job_parts set status = 'void' where job_id = $1::uuid and status = 'pending'", [jobId]);
      await tx.query("update public.jobs set status = 'on_site' where id = $1::uuid", [jobId]);
      job.status = "on_site";
    }
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then finish the job." };
    // An off-list part needs its receipt, or the tradie's word that it will follow (DECISIONS.md, 2026-11-20).
    const receipts = await receiptsAtJobDone(tx, jobId, input.receiptsToFollow ?? false);
    if (!receipts.ok) return { ok: false, message: receipts.message };
    // Off-menu work with no approved quote is a call-out and diagnosis only.
    const lines = await listLines(tx, jobId);
    // So is a menu job the tradie said was not the job described (DECISIONS.md, 2026-11-20, third entry).
    const didWork = (!job.offMenu && !job.notDescribedAt) || lines.some((line) => line.kind === "quote" && line.status === "active");
    return finish(tx, job, tradieId, didWork ? "done" : "diagnosis_only", input);
  });
}

/** The tradie got there and could not get in. The job's price is replaced by the call-out fee. */
export async function reportNoAccess(db: Db, jobId: string, tradieId: string, input: CompleteInput): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status === "completed") return { ok: true, job };
    if (job.status !== "on_site" && job.status !== "awaiting_approval") return { ok: false, message: "Tap Arrived first." };
    if (input.note.trim().length < 5) return { ok: false, message: "Say what happened: nobody home, wrong code, locked gate." };
    const context = await loadContext(tx, job);
    const at = now();
    const active = (await listLines(tx, jobId)).filter((line) => line.status === "active");
    await tx.query("update public.quotes set status = 'withdrawn' where job_id = $1::uuid and status = 'pending'", [jobId]);
    await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and status in ('active', 'pending')", [jobId]);
    await tx.query("update public.job_parts set status = 'void' where job_id = $1::uuid and status in ('active', 'pending')", [jobId]);
    await insertLines(tx, jobId, noAccessLines(context.market, active, job.platformFeeBps), { at });
    return finish(tx, job, tradieId, "no_access", input);
  });
}
