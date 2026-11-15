import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { attachUploads, countUploads } from "@/lib/files/uploads";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { resolveExceptionsFor } from "@/lib/ops/exceptions";
import { openSettlement } from "@/lib/billing/settle";
import { loadContext, offerUrl, ownerJobUrl } from "./context";
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
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/** The tradie is at the property. This is the moment the response promise is measured against. */
export async function markArrived(db: Db, jobId: string, tradieId: string, where: { lat?: number | null; lng?: number | null } = {}): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status !== "accepted") return job.arrivedAt ? { ok: true, job } : { ok: false, message: "This job cannot be marked as arrived right now." };
    const at = now();
    const lat = typeof where.lat === "number" && Math.abs(where.lat) <= 90 ? where.lat : null;
    const lng = typeof where.lng === "number" && Math.abs(where.lng) <= 180 ? where.lng : null;
    await tx.query("update public.jobs set status = 'on_site', arrived_at = $2::timestamptz, arrived_lat = $3, arrived_lng = $4 where id = $1::uuid", [
      jobId, at.toISOString(), lat, lng,
    ]);
    const onTime = job.respondBy ? at.getTime() <= job.respondBy.getTime() : true;
    await resolveExceptionsFor(tx, jobId, ["at_risk"], "Tradie arrived");
    await audit(tx, {
      actor: `tradie:${tradieId}`, action: "job.arrived", entity: "job", entityId: jobId,
      detail: { on_time: onTime, located: lat !== null, minutes_from_dispatch: job.dispatchedAt ? Math.round((at.getTime() - job.dispatchedAt.getTime()) / 60_000) : null },
    });
    const context = await loadContext(tx, job);
    if (context.owner.phone && context.tradie) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "tradie_arrived", audience: "owner", jobId, userId: context.owner.userId,
        body: texts.tradieArrived({ tradie: context.tradie.businessName, property: context.property.name }), dedupeKey: `tradie_arrived:${jobId}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

export type QuoteInput = { description: string; labourCents: number; partsCents: number; uploadIds: string[] };
export type QuoteResult = { ok: true; job: Job; quote: Quote } | { ok: false; message: string };

/**
 * The tradie prices extra or off-menu work. Under the limit it goes ahead and
 * the owner is told. Over it, nothing starts until the owner says yes.
 */
export async function submitQuote(db: Db, jobId: string, tradieId: string, input: QuoteInput): Promise<QuoteResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status === "awaiting_approval") return { ok: false, message: "There is already a quote waiting for the owner's answer." };
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then add the quote." };
    const description = input.description.replace(/\s+/g, " ").trim();
    if (description.length < 3) return { ok: false, message: "Say in a few words what the extra work is." };
    if (!Number.isInteger(input.labourCents) || !Number.isInteger(input.partsCents) || input.labourCents < 0 || input.partsCents < 0 || input.labourCents + input.partsCents <= 0) {
      return { ok: false, message: "Enter a price for the work, for parts, or both." };
    }
    if (input.labourCents + input.partsCents > 2_000_000) return { ok: false, message: "That is more than can be quoted here. Contact us about this job." };

    const context = await loadContext(tx, job);
    const { market, property, owner, tradie } = context;
    const approved = await tx.query<{ total: number }>(
      "select coalesce(sum(owner_total_cents), 0) as total from public.quotes where job_id = $1::uuid and status in ('approved', 'auto_approved')",
      [jobId],
    );
    const amounts = quoteAmounts(market, {
      description, labourCents: input.labourCents, partsCents: input.partsCents,
      limitCents: property.spendLimitCents, alreadyApprovedCents: Number(approved[0]?.total ?? 0),
    });
    const at = now();
    const rows = await tx.query<Parameters<typeof rowToQuote>[0]>(
      `insert into public.quotes
         (created_at, job_id, tradie_id, description, labour_cents, parts_cents, owner_total_cents, tradie_total_cents, needs_approval, status, decided_at, decided_by)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12)
       returning *`,
      [
        at.toISOString(), jobId, tradieId, description, input.labourCents, input.partsCents, amounts.ownerTotalCents, amounts.tradieTotalCents,
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

export type CompleteInput = { note: string; uploadIds: string[] };

async function finish(db: Db, job: Job, tradieId: string, outcome: "done" | "diagnosis_only" | "no_access", input: CompleteInput): Promise<StepResult> {
  const context = await loadContext(db, job);
  const at = now();
  await attachUploads(db, input.uploadIds, { kind: "completion", uploadedBy: `tradie:${tradieId}`, jobId: job.id });
  if ((await countUploads(db, job.id, "completion")) === 0) {
    return { ok: false, message: outcome === "no_access" ? "Add a photo showing you were at the property." : "Add at least one photo of the finished work." };
  }
  const sum = await recalcTotals(db, job.id, context.market.taxRate, context.market.taxRegistered);
  await db.query("update public.jobs set status = 'completed', completed_at = $2::timestamptz, outcome = $3, completion_note = $4 where id = $1::uuid", [
    job.id, at.toISOString(), outcome, input.note.trim().slice(0, 2000) || null,
  ]);
  await resolveExceptionsFor(db, job.id, ["at_risk", "quote_waiting"], "Job completed");
  await audit(db, {
    actor: `tradie:${tradieId}`, action: "job.completed", entity: "job", entityId: job.id, amount: sum.ownerCents, currency: job.currency,
    detail: { outcome, tradie_gets: sum.tradieCents, platform_keeps: sum.ownerCents - sum.tradieCents },
  });
  const done = (await lockJob(db, job.id))!;
  await openSettlement(db, done, context.market);
  return { ok: true, job: done };
}

/**
 * The work is finished. Needs at least one photo. This records what is owed;
 * charging the card happens straight after (see billing/settle.ts).
 */
export async function completeJob(db: Db, jobId: string, tradieId: string, input: CompleteInput): Promise<StepResult> {
  return db.tx(async (tx) => {
    const job = await theirs(tx, jobId, tradieId);
    if (!job) return { ok: false, message: NOT_YOURS };
    if (job.status === "completed") return { ok: true, job };
    if (job.status === "awaiting_approval") return { ok: false, message: "The owner has not answered your quote yet. Wait for their answer before finishing." };
    if (job.status !== "on_site") return { ok: false, message: "Tap Arrived first, then finish the job." };
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
    await insertLines(tx, jobId, noAccessLines(context.market, active), { at });
    return finish(tx, job, tradieId, "no_access", input);
  });
}
