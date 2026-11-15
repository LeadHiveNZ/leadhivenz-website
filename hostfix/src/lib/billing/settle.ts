import type { CountryCode, Market } from "@config/markets";
import { audit } from "@/lib/audit";
import { addHours, addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { loadContext, ownerJobUrl } from "@/lib/jobs/context";
import { refundSplit } from "@/lib/jobs/pricing";
import { getJobForStaff, lockJob } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { getMarket } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { getBilling } from "@/lib/owners/service";
import type { PaymentsGateway, Provider } from "@/lib/payments/gateway";
import { formatDeadline, monthKey, monthLabel } from "@/lib/time";

/**
 * EVERY MONEY MOVEMENT ON A JOB.
 *
 *   job done      the owner's card is charged the total straight away
 *   24 hours on   the tradie's share is sent, unless the owner has raised a problem
 *   a problem     pauses the tradie's money and puts the job in front of the dispatcher
 *   a refund      comes off the platform's share and the tradie's share in proportion
 *   missed promise  the month's membership is credited, once per property per month
 *
 * Each function follows the same three beats so that a crash or a repeat can
 * never charge or pay twice:
 *   1. In one database step, claim the work and count the attempt.
 *   2. Ask the payment company, with a key that makes a repeat a no-op.
 *   3. In one database step, write down what happened and the audit entry.
 */

export type GatewayFor = (country: CountryCode) => PaymentsGateway | null;

export const MAX_CHARGE_ATTEMPTS = 4;
export const MAX_PAYOUT_ATTEMPTS = 3;
const RETRY_HOURS = 24;

type PaymentRow = {
  id: string; job_id: string; owner_id: string; amount_cents: number; tax_cents: number; currency: string; status: string;
  provider: Provider; payment_intent_id: string | null; charge_id: string | null; attempts: number; refunded_cents: number;
};

type PayoutRow = {
  id: string; job_id: string; tradie_id: string; amount_cents: number; currency: string; status: string; release_at: Date;
  transfer_id: string | null; attempts: number; provider: Provider | null;
};

/**
 * Called in the same database step that marks a job done: writes down what
 * the owner owes and what the tradie is owed. Nothing is charged yet.
 */
export async function openSettlement(db: Db, job: Job, market: Market): Promise<void> {
  const at = job.completedAt ?? now();
  const billing = await getBilling(db, job.ownerId, market.country);
  if (job.ownerTotalCents > 0) {
    await db.query(
      `insert into public.payments (created_at, job_id, owner_id, amount_cents, tax_cents, currency, status, provider)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, 'pending', $7)
       on conflict (job_id) do nothing`,
      [at.toISOString(), job.id, job.ownerId, job.ownerTotalCents, job.taxCents, job.currency, billing?.provider ?? "stripe"],
    );
  }
  if (job.tradieTotalCents > 0 && job.tradieId) {
    await db.query(
      `insert into public.payouts (created_at, job_id, tradie_id, amount_cents, currency, status, release_at)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7::timestamptz)
       on conflict (job_id) do nothing`,
      [
        at.toISOString(), job.id, job.tradieId, job.tradieTotalCents, job.currency,
        // With nothing to charge the owner there is nothing to wait for.
        job.ownerTotalCents > 0 ? "waiting" : "scheduled", addHours(at, market.payoutHoldHours).toISOString(),
      ],
    );
  }
}

export type ChargeOutcome = "succeeded" | "failed" | "skipped";

/** Charges the owner's saved card for a finished job. Safe to call again: a job is never charged twice. */
export async function chargeJob(db: Db, gatewayFor: GatewayFor, jobId: string, options: { force?: boolean } = {}): Promise<ChargeOutcome> {
  const claim = await db.tx(async (tx) => {
    const at = now();
    const rows = await tx.query<PaymentRow & { claimed_until: Date | null }>("select * from public.payments where job_id = $1::uuid for update", [jobId]);
    const payment = rows[0];
    if (!payment || !["pending", "failed"].includes(payment.status)) return null;
    // The automatic tries stop after four. A person on the team can still try again, for example once the owner has changed their card.
    if (payment.attempts >= MAX_CHARGE_ATTEMPTS && !options.force) return null;
    // Another server is in the middle of this charge.
    if (payment.claimed_until && new Date(payment.claimed_until).getTime() > at.getTime()) return null;
    const job = await getJobForStaff(tx, jobId);
    if (!job) return null;
    const context = await loadContext(tx, job);
    const billing = await getBilling(tx, job.ownerId, context.market.country);
    await tx.query("update public.payments set claimed_until = $2::timestamptz, next_retry_at = null where id = $1::uuid", [payment.id, addMinutes(at, 2).toISOString()]);
    // The try number only goes up when a try ends in a definite "no". If this
    // server dies half-way, the next try uses the same number and so the same
    // key, and the payment company treats it as the same charge.
    return { payment: { ...payment, attempts: payment.attempts + 1 }, job, context, billing };
  });
  if (!claim) return "skipped";
  const { payment, job, context, billing } = claim;

  const gateway = gatewayFor(context.market.country);
  let result: Awaited<ReturnType<PaymentsGateway["chargeJob"]>>;
  if (!gateway) {
    result = { status: "failed", reason: "Card payments are not set up for this country.", code: "not_configured", paymentIntentId: null };
  } else if (!billing || billing.provider !== gateway.provider) {
    result = { status: "failed", reason: "The owner has no card on file.", code: "no_card", paymentIntentId: null };
  } else {
    try {
      result = await gateway.chargeJob({
        customerId: billing.customerId, paymentMethodId: billing.paymentMethodId, amountCents: payment.amount_cents, currency: payment.currency,
        description: `Job ${job.number}: ${job.title} at ${context.property.name}`.slice(0, 200), jobNumber: job.number,
        receiptEmail: context.owner.email, idempotencyKey: `hostfix-job-${jobId}-charge-${payment.attempts}`,
      });
    } catch (error) {
      result = { status: "failed", reason: error instanceof Error ? error.message : String(error), code: "error", paymentIntentId: null };
    }
  }

  return db.tx(async (tx) => {
    const at = now();
    if (result.status === "succeeded") {
      await tx.query(
        `update public.payments set status = 'succeeded', paid_at = $2::timestamptz, payment_intent_id = $3, charge_id = $4, provider = $5,
                last_error = null, attempts = $6, claimed_until = null
          where id = $1::uuid`,
        [payment.id, at.toISOString(), result.paymentIntentId, result.chargeId, gateway!.provider, payment.attempts],
      );
      const dispute = await tx.query("select 1 from public.disputes where job_id = $1::uuid and status = 'open'", [jobId]);
      await tx.query("update public.payouts set status = $2 where job_id = $1::uuid and status = 'waiting'", [jobId, dispute.length > 0 ? "paused" : "scheduled"]);
      await resolveExceptionsFor(tx, jobId, ["payment_failed"], "Card charged");
      await audit(tx, {
        actor: gateway!.provider, action: "payment.succeeded", entity: "job", entityId: jobId, amount: payment.amount_cents, currency: payment.currency,
        detail: { payment_intent: result.paymentIntentId, attempt: payment.attempts, tax: payment.tax_cents }, dedupeKey: `payment.succeeded:${jobId}`,
      });
      if (context.owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "job_done", audience: "owner", jobId, userId: context.owner.userId,
          body: texts.jobDone({ title: job.title, property: context.property.name, totalCents: payment.amount_cents, currency: payment.currency, link: ownerJobUrl(job) }),
          dedupeKey: `job_done:${jobId}`,
        });
      }
      if (job.reporterPhone && job.reportedBy !== "owner" && job.reporterPhone !== context.owner.phone && job.outcome !== "no_access") {
        await enqueue(tx, {
          channel: "sms", to: job.reporterPhone, template: "reporter_done", audience: "reporter", jobId,
          body: texts.reporterDone({ property: context.property.name }), dedupeKey: `reporter_done:${jobId}`,
        });
      }
      return "succeeded";
    }

    const retry = payment.attempts < MAX_CHARGE_ATTEMPTS;
    await tx.query(
      `update public.payments set status = 'failed', last_error = $2, next_retry_at = $3::timestamptz,
              payment_intent_id = coalesce($4, payment_intent_id), attempts = $5, claimed_until = null
        where id = $1::uuid`,
      [payment.id, result.reason.slice(0, 500), retry ? addHours(at, RETRY_HOURS).toISOString() : null, result.paymentIntentId, payment.attempts],
    );
    await audit(tx, {
      actor: gateway?.provider ?? "system", action: "payment.failed", entity: "job", entityId: jobId, amount: payment.amount_cents, currency: payment.currency,
      detail: { reason: result.reason, code: result.code, attempt: payment.attempts, will_retry: retry }, dedupeKey: `payment.failed:${jobId}:${payment.attempts}`,
    });
    await raiseException(tx, {
      kind: "payment_failed", market: job.market, jobId,
      summary: `Job ${job.number}: the owner's card was not charged (${result.reason}). ${retry ? "It will be tried again tomorrow." : "It has been tried four times. The tradie has not been paid."}`,
      dedupeKey: `payment_failed:${jobId}`,
    });
    if (context.owner.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "payment_failed", audience: "owner", jobId, userId: context.owner.userId,
        body: texts.paymentFailed({ amountCents: payment.amount_cents, currency: payment.currency, number: job.number, link: `${baseUrl()}/app/billing` }),
        dedupeKey: `payment_failed:${jobId}`,
      });
    }
    return "failed";
  });
}

/** Run by the timer: charges that were never attempted (a crash) and failed charges whose retry is due. */
export async function chargeDuePayments(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const at = now();
  const due = await db.query<{ job_id: string }>(
    `select job_id from public.payments
      where (status = 'failed' and next_retry_at is not null and next_retry_at <= $1::timestamptz)
         or (status = 'pending' and created_at <= $2::timestamptz)
      order by created_at limit 50`,
    [at.toISOString(), addMinutes(at, -2).toISOString()],
  );
  let done = 0;
  for (const row of due) {
    if ((await chargeJob(db, gatewayFor, row.job_id)) !== "skipped") done += 1;
  }
  return done;
}

export type PayoutOutcome = "sent" | "failed" | "retry" | "skipped";

/** Sends one tradie's share, if it is due. A payout is never sent twice. */
export async function releasePayout(db: Db, gatewayFor: GatewayFor, payoutId: string): Promise<PayoutOutcome> {
  const claim = await db.tx(async (tx) => {
    const at = now();
    const rows = await tx.query<PayoutRow>("select * from public.payouts where id = $1::uuid for update", [payoutId]);
    const payout = rows[0];
    if (!payout || payout.status !== "scheduled" || new Date(payout.release_at).getTime() > at.getTime()) return null;
    const dispute = await tx.query("select 1 from public.disputes where job_id = $1::uuid and status = 'open'", [payout.job_id]);
    if (dispute.length > 0) {
      await tx.query("update public.payouts set status = 'paused' where id = $1::uuid", [payoutId]);
      return null;
    }
    const paid = await tx.query<{ charge_id: string | null; status: string }>("select charge_id, status from public.payments where job_id = $1::uuid", [payout.job_id]);
    if (paid[0] && !["succeeded", "part_refunded"].includes(paid[0].status)) return null;
    const job = await getJobForStaff(tx, payout.job_id);
    const tradie = await tx.query<{ payout_account_id: string | null; payouts_enabled: boolean; business_name: string; phone: string | null; user_id: string }>(
      `select t.payout_account_id, t.payouts_enabled, t.business_name, u.phone, t.user_id
         from public.tradies t join public.users u on u.id = t.user_id where t.id = $1::uuid`,
      [payout.tradie_id],
    );
    const market = job ? await getMarket(tx, job.market) : null;
    if (!job || !market || !tradie[0]) return null;
    // Push the release time out so another server does not pick it up while we talk to the payment company.
    await tx.query("update public.payouts set attempts = attempts + 1, release_at = $2::timestamptz where id = $1::uuid", [payoutId, addMinutes(at, 10).toISOString()]);
    return { payout: { ...payout, attempts: payout.attempts + 1 }, job, market, tradie: tradie[0], chargeId: paid[0]?.charge_id ?? null };
  });
  if (!claim) return "skipped";
  const { payout, job, market, tradie, chargeId } = claim;

  const gateway = gatewayFor(market.country);
  let transferId: string | null = null;
  let failure: string | null = null;
  if (!gateway) failure = "Payments are not set up for this country.";
  else if (!tradie.payout_account_id) failure = `${tradie.business_name} has not added bank details yet.`;
  else {
    try {
      const sent = await gateway.transfer({
        accountId: tradie.payout_account_id, amountCents: payout.amount_cents, currency: payout.currency, chargeId, jobNumber: job.number,
        idempotencyKey: `hostfix-job-${job.id}-payout`,
      });
      transferId = sent.transferId;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  }

  return db.tx(async (tx) => {
    const at = now();
    if (transferId) {
      await tx.query("update public.payouts set status = 'sent', transfer_id = $2, sent_at = $3::timestamptz, provider = $4, last_error = null where id = $1::uuid", [
        payoutId, transferId, at.toISOString(), gateway!.provider,
      ]);
      await resolveExceptionsFor(tx, job.id, ["payout_failed"], "Tradie paid");
      await audit(tx, {
        actor: gateway!.provider, action: "payout.sent", entity: "job", entityId: job.id, amount: payout.amount_cents, currency: payout.currency,
        detail: { transfer: transferId, tradie: tradie.business_name, hours_after_completion: job.completedAt ? Math.round((at.getTime() - job.completedAt.getTime()) / 3_600_000) : null },
        dedupeKey: `payout.sent:${job.id}`,
      });
      if (tradie.phone) {
        await enqueue(tx, {
          channel: "sms", to: tradie.phone, template: "payout_sent", audience: "tradie", jobId: job.id, userId: tradie.user_id,
          body: texts.payoutSent({ number: job.number, amountCents: payout.amount_cents, currency: payout.currency }), dedupeKey: `payout_sent:${job.id}`,
        });
      }
      return "sent";
    }
    const giveUp = payout.attempts >= MAX_PAYOUT_ATTEMPTS || !gateway || !tradie.payout_account_id;
    await tx.query("update public.payouts set status = $2, last_error = $3 where id = $1::uuid", [payoutId, giveUp ? "failed" : "scheduled", failure!.slice(0, 500)]);
    if (giveUp) {
      await audit(tx, { actor: "system", action: "payout.failed", entity: "job", entityId: job.id, amount: payout.amount_cents, currency: payout.currency, detail: { reason: failure } });
      await raiseException(tx, {
        kind: "payout_failed", market: job.market, jobId: job.id, tradieId: payout.tradie_id,
        summary: `Job ${job.number}: ${tradie.business_name} could not be paid (${failure}).`, dedupeKey: `payout_failed:${job.id}`,
      });
      return "failed";
    }
    return "retry";
  });
}

export async function releaseDuePayouts(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const due = await db.query<{ id: string }>(
    "select id from public.payouts where status = 'scheduled' and release_at <= $1::timestamptz order by release_at limit 50",
    [now().toISOString()],
  );
  let sent = 0;
  for (const row of due) {
    if ((await releasePayout(db, gatewayFor, row.id)) === "sent") sent += 1;
  }
  return sent;
}

/** The dispatcher tries a failed payout again, for example after the tradie has added bank details. */
export async function retryPayout(db: Db, gatewayFor: GatewayFor, jobId: string, actor: string): Promise<PayoutOutcome> {
  const rows = await db.query<{ id: string }>(
    "update public.payouts set status = 'scheduled', attempts = 0, release_at = $2::timestamptz where job_id = $1::uuid and status = 'failed' returning id",
    [jobId, now().toISOString()],
  );
  if (!rows[0]) return "skipped";
  await audit(db, { actor, action: "payout.retried", entity: "job", entityId: jobId });
  return releasePayout(db, gatewayFor, rows[0].id);
}

// ---------------------------------------------------------------------------
// WHEN THE OWNER SAYS SOMETHING IS WRONG
// ---------------------------------------------------------------------------

export type DisputeResult = { ok: true; disputeId: string; payoutPaused: boolean } | { ok: false; message: string };

/** The owner's "something is wrong" button. Holds the tradie's money if it has not gone yet and calls in the dispatcher. */
export async function raiseDispute(db: Db, jobId: string, actor: string, reason: string): Promise<DisputeResult> {
  const words = reason.replace(/\s+/g, " ").trim();
  if (words.length < 3) return { ok: false, message: "Tell us in a few words what is wrong." };
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    if (job.status !== "completed") return { ok: false, message: "This button is for jobs that are finished. For a job still under way, contact us." };
    const existing = await tx.query<{ id: string }>("select id from public.disputes where job_id = $1::uuid", [jobId]);
    if (existing[0]) return { ok: true, disputeId: existing[0].id, payoutPaused: false };

    const at = now();
    const rows = await tx.query<{ id: string }>(
      "insert into public.disputes (created_at, job_id, raised_by, reason) values ($1::timestamptz, $2::uuid, $3, $4) returning id",
      [at.toISOString(), jobId, actor, words.slice(0, 2000)],
    );
    const paused = await tx.query("update public.payouts set status = 'paused' where job_id = $1::uuid and status in ('waiting', 'scheduled') returning id", [jobId]);
    const context = await loadContext(tx, job);
    await audit(tx, { actor, action: "dispute.opened", entity: "job", entityId: jobId, detail: { reason: words, payout_paused: paused.length > 0 } });
    await raiseException(tx, {
      kind: "dispute", market: job.market, jobId,
      summary: `Job ${job.number}: ${context.owner.name} says something is wrong at ${context.property.name}: "${words.slice(0, 140)}"${paused.length > 0 ? ". The tradie's payment is on hold." : ". The tradie has already been paid."}`,
      dedupeKey: `dispute:${jobId}`,
    });
    if (paused.length > 0 && context.tradie?.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "payout_on_hold", audience: "tradie", jobId, userId: context.tradie.userId,
        body: texts.payoutOnHold({ number: job.number }), dedupeKey: `payout_on_hold:${jobId}`,
      });
    }
    if (context.owner.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "dispute_received", audience: "owner", jobId, userId: context.owner.userId,
        body: texts.disputeReceived({ number: job.number }), dedupeKey: `dispute_received:${jobId}`,
      });
    }
    return { ok: true, disputeId: rows[0]!.id, payoutPaused: paused.length > 0 };
  });
}

export type Resolution = { outcome: "pay_tradie" } | { outcome: "refund"; refundCents: number };
export type ResolveResult = { ok: true } | { ok: false; message: string };

/**
 * The dispatcher settles a dispute: pay the tradie in full, or refund the
 * owner some or all of it. A refund comes off the tradie's share and the
 * platform's share in the same proportion as the job.
 */
export async function resolveDispute(db: Db, gatewayFor: GatewayFor, disputeId: string, resolution: Resolution, note: string, actor: string): Promise<ResolveResult> {
  const found = await db.query<{ id: string; job_id: string; status: string }>("select id, job_id, status from public.disputes where id = $1::uuid", [disputeId]);
  const dispute = found[0];
  if (!dispute) return { ok: false, message: "We could not find that dispute." };
  if (dispute.status !== "open") return { ok: true };
  const job = await getJobForStaff(db, dispute.job_id);
  const market = job ? await getMarket(db, job.market) : null;
  if (!job || !market) return { ok: false, message: "We could not find that job." };

  if (resolution.outcome === "pay_tradie") {
    await db.tx(async (tx) => {
      const at = now();
      const updated = await tx.query("update public.disputes set status = 'resolved_paid', resolution_note = $2, resolved_at = $3::timestamptz, resolved_by = $4 where id = $1::uuid and status = 'open' returning id", [
        disputeId, note.trim() || null, at.toISOString(), actor,
      ]);
      if (updated.length === 0) return;
      const paid = await tx.query<{ status: string }>("select status from public.payments where job_id = $1::uuid", [job.id]);
      const ready = !paid[0] || ["succeeded", "part_refunded"].includes(paid[0].status);
      await tx.query("update public.payouts set status = $2, release_at = $3::timestamptz where job_id = $1::uuid and status = 'paused'", [
        job.id, ready ? "scheduled" : "waiting", at.toISOString(),
      ]);
      await resolveExceptionsFor(tx, job.id, ["dispute"], "Resolved: tradie paid in full");
      await audit(tx, { actor, action: "dispute.resolved", entity: "job", entityId: job.id, detail: { outcome: "pay_tradie", note } });
    });
    return { ok: true };
  }

  const payments = await db.query<PaymentRow>("select * from public.payments where job_id = $1::uuid", [job.id]);
  const payment = payments[0];
  if (!payment || !["succeeded", "part_refunded"].includes(payment.status) || !payment.payment_intent_id) {
    return { ok: false, message: "The owner has not been charged for this job, so there is nothing to refund. Close the dispute by cancelling the charge instead." };
  }
  const refundCents = resolution.refundCents;
  if (!Number.isInteger(refundCents) || refundCents <= 0 || refundCents > payment.amount_cents - payment.refunded_cents) {
    return { ok: false, message: "The refund must be more than zero and no more than the owner paid." };
  }
  const payouts = await db.query<PayoutRow>("select * from public.payouts where job_id = $1::uuid", [job.id]);
  const payout = payouts[0] ?? null;
  const split = refundSplit({ ownerCents: payment.amount_cents, tradieCents: payout?.amount_cents ?? 0 }, refundCents);

  const gateway = gatewayFor(market.country);
  if (!gateway) return { ok: false, message: "Payments are not set up for this country." };
  let refundId: string;
  try {
    refundId = (await gateway.refund({ paymentIntentId: payment.payment_intent_id, amountCents: refundCents, idempotencyKey: `hostfix-job-${job.id}-refund-${disputeId}` })).refundId;
  } catch (error) {
    return { ok: false, message: `The refund did not go through: ${error instanceof Error ? error.message : String(error)}` };
  }

  // If the tradie has already been paid, try to take their share of the refund back.
  let clawback: "not_needed" | "done" | "failed" = "not_needed";
  if (payout && payout.status === "sent" && payout.transfer_id && split.fromTradieCents > 0) {
    try {
      await gateway.reverseTransfer({ transferId: payout.transfer_id, amountCents: split.fromTradieCents, idempotencyKey: `hostfix-job-${job.id}-reverse-${disputeId}` });
      clawback = "done";
    } catch {
      clawback = "failed";
    }
  }

  await db.tx(async (tx) => {
    const at = now();
    const updated = await tx.query(
      "update public.disputes set status = 'resolved_refund', refund_cents = $2, resolution_note = $3, resolved_at = $4::timestamptz, resolved_by = $5 where id = $1::uuid and status = 'open' returning id",
      [disputeId, refundCents, note.trim() || null, at.toISOString(), actor],
    );
    if (updated.length === 0) return;
    const fully = payment.refunded_cents + refundCents >= payment.amount_cents;
    await tx.query("update public.payments set refunded_cents = refunded_cents + $2, status = $3 where id = $1::uuid", [payment.id, refundCents, fully ? "refunded" : "part_refunded"]);
    await audit(tx, {
      actor, action: "refund.issued", entity: "job", entityId: job.id, amount: refundCents, currency: payment.currency,
      detail: { refund: refundId, from_tradie: split.fromTradieCents, from_platform: split.fromPlatformCents, note }, dedupeKey: `refund:${disputeId}`,
    });
    if (payout) {
      const remaining = payout.amount_cents - split.fromTradieCents;
      if (["paused", "waiting", "scheduled"].includes(payout.status)) {
        if (remaining <= 0) {
          await tx.query("update public.payouts set status = 'cancelled' where id = $1::uuid", [payout.id]);
        } else {
          await tx.query("update public.payouts set amount_cents = $2, status = 'scheduled', release_at = $3::timestamptz where id = $1::uuid", [payout.id, remaining, at.toISOString()]);
        }
        await audit(tx, { actor, action: "payout.reduced", entity: "job", entityId: job.id, amount: split.fromTradieCents, currency: payout.currency, detail: { now_pays: Math.max(0, remaining) } });
      } else if (clawback === "done") {
        if (remaining <= 0) await tx.query("update public.payouts set status = 'reversed' where id = $1::uuid", [payout.id]);
        await audit(tx, { actor, action: "payout.reversed", entity: "job", entityId: job.id, amount: split.fromTradieCents, currency: payout.currency });
      } else if (clawback === "failed") {
        await raiseException(tx, {
          kind: "payout_failed", market: job.market, jobId: job.id, tradieId: payout.tradie_id,
          summary: `Job ${job.number}: the owner was refunded but the tradie's share could not be taken back automatically. Sort it out with the tradie directly.`,
          dedupeKey: `clawback_failed:${job.id}`,
        });
      }
    }
    await resolveExceptionsFor(tx, job.id, ["dispute"], "Resolved: owner refunded");
    await audit(tx, { actor, action: "dispute.resolved", entity: "job", entityId: job.id, detail: { outcome: "refund", refund_cents: refundCents, note } });
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// THE RESPONSE GUARANTEE
// ---------------------------------------------------------------------------

/**
 * Run by the timer. For every job whose promised time has passed with no
 * tradie on site: mark the miss, credit the owner that month's membership
 * (once per property per calendar month), tell them, and tell the dispatcher.
 */
export async function creditMissedWindows(db: Db): Promise<{ missed: number; credited: number }> {
  const at = now();
  const due = await db.query<{ id: string }>(
    `select id from public.jobs
      where status in ('offering', 'unfilled', 'accepted') and arrived_at is null and window_missed_at is null
        and respond_by is not null and respond_by <= $1::timestamptz
      order by respond_by limit 100`,
    [at.toISOString()],
  );
  const result = { missed: 0, credited: 0 };
  for (const row of due) {
    await db.tx(async (tx) => {
      const job = await lockJob(tx, row.id);
      if (!job || job.arrivedAt || job.windowMissedAt || !job.respondBy || job.respondBy.getTime() > at.getTime()) return;
      if (!["offering", "unfilled", "accepted"].includes(job.status)) return;
      const context = await loadContext(tx, job);
      const { market, property, tier, owner } = context;
      await tx.query("update public.jobs set window_missed_at = $2::timestamptz where id = $1::uuid", [job.id, at.toISOString()]);
      result.missed += 1;

      const month = monthKey(job.respondBy, market.timezone);
      let credited = false;
      if (tier && tier.monthlyPriceCents > 0) {
        const inserted = await tx.query(
          `insert into public.credits (created_at, owner_id, property_id, job_id, reason, amount_cents, currency, month, status, note, created_by)
           values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, 'missed_window', $5, $6, $7, 'pending', $8, 'system')
           on conflict do nothing returning id`,
          [at.toISOString(), job.ownerId, property.id, job.id, tier.monthlyPriceCents, market.currency, month, `Job ${job.number}: nobody on site by the promised time`],
        );
        credited = inserted.length > 0;
      }
      await audit(tx, {
        actor: "system", action: "job.window_missed", entity: "job", entityId: job.id,
        detail: { promised: job.respondBy.toISOString(), credited, capped: !credited && Boolean(tier), status: job.status },
      });
      if (credited && tier) {
        result.credited += 1;
        await audit(tx, { actor: "system", action: "credit.created", entity: "job", entityId: job.id, amount: tier.monthlyPriceCents, currency: market.currency, detail: { reason: "missed_window", month } });
        if (owner.phone) {
          await enqueue(tx, {
            channel: "sms", to: owner.phone, template: "window_missed", audience: "owner", jobId: job.id, userId: owner.userId,
            body: texts.windowMissed({ property: property.name, month: monthLabel(month).split(" ")[0]!, amountCents: tier.monthlyPriceCents, currency: market.currency }),
            dedupeKey: `window_missed:${job.id}`,
          });
        }
      }
      await raiseException(tx, {
        kind: "missed_window", market: job.market, jobId: job.id,
        summary: `Job ${job.number}: no tradie on site at ${property.name} by ${formatDeadline(job.respondBy, at, market.timezone)}. ${credited ? "The month's membership has been credited." : "No credit this time (one per property per month)."}`,
        dedupeKey: `missed_window:${job.id}`,
      });
    });
  }
  return result;
}

/** Run by the timer: jobs most of the way to their promised time with nobody on site go to the dispatcher. */
export async function flagAtRisk(db: Db): Promise<number> {
  const at = now();
  const rows = await db.query<{ id: string; number: number; title: string; status: string; respond_by: Date; property_name: string; market: string; timezone: string }>(
    `select j.id, j.number, j.title, j.status, j.respond_by, p.name as property_name, j.market, m.timezone
       from public.jobs j join public.properties p on p.id = j.property_id join public.markets m on m.slug = j.market
      where j.status in ('offering', 'unfilled', 'accepted') and j.arrived_at is null and j.window_missed_at is null
        and j.at_risk_flagged_at is null and j.dispatched_at is not null and j.respond_by is not null
        and $1::timestamptz >= j.dispatched_at + (j.respond_by - j.dispatched_at) * 0.75
        and $1::timestamptz < j.respond_by
      limit 100`,
    [at.toISOString()],
  );
  for (const row of rows) {
    await db.tx(async (tx) => {
      const claimed = await tx.query("update public.jobs set at_risk_flagged_at = $2::timestamptz where id = $1::uuid and at_risk_flagged_at is null returning id", [row.id, at.toISOString()]);
      if (claimed.length === 0) return;
      await raiseException(tx, {
        kind: "at_risk", market: row.market, jobId: row.id,
        summary: `Job ${Number(row.number)}: "${row.title}" at ${row.property_name} is promised by ${formatDeadline(new Date(row.respond_by), at, row.timezone)} and ${row.status === "accepted" ? "the tradie has not arrived yet" : "no tradie is booked yet"}.`,
        dedupeKey: `at_risk:${row.id}`,
      });
    });
  }
  return rows.length;
}

/** Passes recorded credits on to the payment company, so they come off the owner's next membership payment. */
export async function applyPendingCredits(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const pending = await db.query<{ id: string; owner_id: string; property_id: string | null; amount_cents: number; currency: string; reason: string; month: string; country: CountryCode; market: string; property_name: string | null }>(
    `select c.id, c.owner_id, c.property_id, c.amount_cents, c.currency, c.reason, c.month, m.country, m.slug as market, p.name as property_name
       from public.credits c
       left join public.properties p on p.id = c.property_id
       join public.markets m on m.slug = coalesce(p.market, (select slug from public.markets where currency = c.currency order by created_at limit 1))
      where c.status = 'pending' order by c.created_at limit 50`,
  );
  let applied = 0;
  for (const credit of pending) {
    const gateway = gatewayFor(credit.country);
    const billing = await getBilling(db, credit.owner_id, credit.country);
    let ref: string | null = null;
    let failure: string | null = null;
    if (!gateway) failure = "Payments are not set up for this country.";
    else if (!billing || billing.provider !== gateway.provider) failure = "The owner has no payment account to credit.";
    else {
      try {
        ref = (await gateway.creditCustomer({
          customerId: billing.customerId, amountCents: credit.amount_cents, currency: credit.currency,
          description: `${credit.reason === "missed_window" ? "Response guarantee credit" : "Credit"}${credit.property_name ? `: ${credit.property_name}` : ""} (${monthLabel(credit.month)})`,
          idempotencyKey: `hostfix-credit-${credit.id}`,
        })).ref;
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
    }
    await db.tx(async (tx) => {
      const updated = await tx.query("update public.credits set status = $2, provider_ref = $3 where id = $1::uuid and status = 'pending' returning id", [credit.id, ref ? "applied" : "failed", ref]);
      if (updated.length === 0) return;
      if (ref) {
        await audit(tx, { actor: gateway!.provider, action: "credit.applied", entity: "credit", entityId: credit.id, amount: credit.amount_cents, currency: credit.currency, detail: { reason: credit.reason, ref }, dedupeKey: `credit.applied:${credit.id}` });
      } else {
        await raiseException(tx, {
          kind: "credit_failed", market: credit.market, propertyId: credit.property_id,
          summary: `A credit of ${credit.amount_cents / 100} ${credit.currency} for ${credit.property_name ?? "an owner"} could not be applied (${failure}). Apply it by hand in the payment dashboard.`,
          dedupeKey: `credit_failed:${credit.id}`,
        });
      }
    });
    if (ref) applied += 1;
  }
  return applied;
}

/** A credit the team chooses to give, for example to say sorry. Comes off the next membership payment. */
export async function addGoodwillCredit(
  db: Db, gatewayFor: GatewayFor, input: { propertyId: string; amountCents: number; note: string }, actor: string,
): Promise<ResolveResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 100_000) {
    return { ok: false, message: "Enter an amount between 1 cent and 1,000." };
  }
  const rows = await db.query<{ owner_id: string; market: string; currency: string; timezone: string }>(
    "select p.owner_id, p.market, m.currency, m.timezone from public.properties p join public.markets m on m.slug = p.market where p.id = $1::uuid",
    [input.propertyId],
  );
  const property = rows[0];
  if (!property) return { ok: false, message: "We could not find that property." };
  const at = now();
  await db.tx(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `insert into public.credits (created_at, owner_id, property_id, reason, amount_cents, currency, month, status, note, created_by)
       values ($1::timestamptz, $2::uuid, $3::uuid, 'goodwill', $4, $5, $6, 'pending', $7, $8) returning id`,
      [at.toISOString(), property.owner_id, input.propertyId, input.amountCents, property.currency, monthKey(at, property.timezone), input.note.trim().slice(0, 300) || null, actor],
    );
    await audit(tx, { actor, action: "credit.created", entity: "credit", entityId: inserted[0]!.id, amount: input.amountCents, currency: property.currency, detail: { reason: "goodwill", note: input.note } });
  });
  await applyPendingCredits(db, gatewayFor);
  return { ok: true };
}
