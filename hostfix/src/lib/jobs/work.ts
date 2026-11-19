import { audit } from "@/lib/audit";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { attachUploads, countUploads } from "@/lib/files/uploads";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { FLAG_DAYS, flagsNeedReview, recentFlags } from "@/lib/tradies/reliability";
import { formatClock, formatDate } from "@/lib/time";
import { openSettlement } from "@/lib/billing/settle";
import { loadContext, offerUrl, ownerJobUrl } from "./context";
import { arrivedOnTime, linesToDrop, surchargeVerdict } from "./arrival";
import { receiptsAtJobDone } from "./parts";
import { checkTap, chooseReference, jobFlags, minutesOnSite, photoIsStale, pointFrom, tooQuick } from "./checks";
import { noAccessLines, quoteAmounts } from "./pricing";
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
          urgent: dropped.some((line) => line.kind === "urgent"), after_hours: dropped.some((line) => line.kind === "after_hours"),
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
export type QuoteInput = { description: string; labourCents: number; uploadIds: string[] };
export type QuoteResult = { ok: true; job: Job; quote: Quote } | { ok: false; message: string };

/**
 * The tradie prices extra or off-menu work. Under the limit it goes ahead and
 * the owner is told. Over it, nothing starts until the owner says yes. Parts
 * are added separately, on any job (addParts, src/lib/jobs/parts.ts).
 */
export async function submitQuote(db: Db, jobId: string, tradieId: string, input: QuoteInput): Promise<QuoteResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status === "awaiting_approval") return { ok: false, message: "There is already a quote waiting for the owner's answer." };
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then add the quote." };
    const description = input.description.replace(/\s+/g, " ").trim();
    if (description.length < 3) return { ok: false, message: "Say in a few words what the extra work is." };
    if (!Number.isInteger(input.labourCents) || input.labourCents <= 0) {
      return { ok: false, message: "Enter your price for the work. Parts are added with \"Add parts\"." };
    }
    if (input.labourCents > 2_000_000) return { ok: false, message: "That is more than can be quoted here. Contact us about this job." };

    const context = await loadContext(tx, job);
    const { market, property, owner, tradie } = context;
    const approved = await tx.query<{ total: number }>(
      "select coalesce(sum(owner_total_cents), 0) as total from public.quotes where job_id = $1::uuid and status in ('approved', 'auto_approved')",
      [jobId],
    );
    const amounts = quoteAmounts(market, {
      description, labourCents: input.labourCents,
      limitCents: property.spendLimitCents, alreadyApprovedCents: Number(approved[0]?.total ?? 0),
    });
    const at = now();
    const rows = await tx.query<Parameters<typeof rowToQuote>[0]>(
      `insert into public.quotes
         (created_at, job_id, tradie_id, description, labour_cents, parts_cents, owner_total_cents, tradie_total_cents, needs_approval, status, decided_at, decided_by)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12)
       returning *`,
      [
        at.toISOString(), jobId, tradieId, description, input.labourCents, 0, amounts.ownerTotalCents, amounts.tradieTotalCents,
        amounts.needsApproval, amounts.needsApproval ? "pending" : "auto_approved", amounts.needsApproval ? null : at.toISOString(),
        amounts.needsApproval ? null : "system",
      ],
    );
    const quote = rowToQuote(rows[0]!);
    await insertLines(tx, jobId, amounts.lines, { at, status: amounts.needsApproval ? "pending" : "active", quoteId: quote.id });
    await attachUploads(tx, input.uploadIds, { kind: "quote", uploadedBy: `tradie:${tradieId}`, jobId });
    await audit(tx, {
      actor: `tradie:${tradieId}`, action: "quote.submitted", entity: "job", entityId: jobId, amount: amounts.ownerTotalCents, currency: job.currency,
      detail: { quote: quote.id, description, needs_approval: amounts.needsApproval, reason: amounts.approvalReason },
    });

    if (amounts.needsApproval) {
      await tx.query("update public.jobs set status = 'awaiting_approval' where id = $1::uuid", [jobId]);
    } else {
      await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
    }
    if (owner.phone && tradie) {
      const words = amounts.needsApproval ? texts.quoteNeedsApproval : texts.quoteGoingAhead;
      await enqueue(tx, {
        channel: "sms", to: owner.phone, template: amounts.needsApproval ? "quote_needs_approval" : "quote_going_ahead", audience: "owner", jobId, userId: owner.userId,
        body: words({ tradie: tradie.businessName, amountCents: amounts.ownerTotalCents, currency: job.currency, property: property.name, link: ownerJobUrl(job) }),
        dedupeKey: `quote:${quote.id}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))!, quote };
  });
}

/** The owner (or the team, on their behalf) answers a quote. */
export async function decideQuote(db: Db, quoteId: string, approve: boolean, actor: string): Promise<QuoteResult> {
  return db.tx(async (tx) => {
    const found = await getQuote(tx, quoteId);
    if (!found) return { ok: false, message: "We could not find that quote." };
    const job = await lockJob(tx, found.jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    const quote = (await getQuote(tx, quoteId))!;
    if (quote.status !== "pending") return { ok: true, job, quote };
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
    await audit(tx, {
      actor, action: approve ? "quote.approved" : "quote.declined", entity: "job", entityId: job.id,
      amount: quote.ownerTotalCents, currency: job.currency, detail: { quote: quoteId },
    });

    const offer = await acceptedOfferFor(tx, job);
    if (context.tradie?.phone && offer) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: approve ? "quote_approved" : "quote_declined", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
        body: approve
          ? texts.quoteApproved({ number: job.number, amountCents: quote.ownerTotalCents, currency: job.currency, link: offerUrl(offer) })
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
    if (job.status === "awaiting_approval") return { ok: false, message: "The owner has not answered your quote yet. Wait for their answer before finishing." };
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then finish the job." };
    // An off-list part needs its receipt, or the tradie's word that it will follow (DECISIONS.md, 2026-11-20).
    const receipts = await receiptsAtJobDone(tx, jobId, input.receiptsToFollow ?? false);
    if (!receipts.ok) return { ok: false, message: receipts.message };
    // Off-menu work with no approved quote is a call-out and diagnosis only.
    const lines = await listLines(tx, jobId);
    const didWork = !job.offMenu || lines.some((line) => line.kind === "quote" && line.status === "active");
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
    await insertLines(tx, jobId, noAccessLines(context.market, active), { at });
    return finish(tx, job, tradieId, "no_access", input);
  });
}
