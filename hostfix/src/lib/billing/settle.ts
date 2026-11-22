import type { CountryCode, Market } from "@config/markets";
import { audit } from "@/lib/audit";
import { addHours, addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { loadContext, ownerJobUrl } from "@/lib/jobs/context";
import { payoutWaits, refundSplit, taxPortion } from "@/lib/jobs/pricing";
import { getJobForStaff, lockJob } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { getMarket } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { getBilling } from "@/lib/owners/service";
import { holdReasons } from "./holds";
import { releaseJobHolds } from "./card-holds";
import { PlatformBalanceTooLow, TransferRefused, type PaymentsGateway, type Provider } from "@/lib/payments/gateway";
import { formatDeadline, monthKey, monthLabel } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { NO_SHOW_DAYS, needsReview, recentNoShows } from "@/lib/tradies/reliability";
import { notePatterns } from "@/lib/ops/patterns";

/**
 * EVERY MONEY MOVEMENT ON A JOB.
 *
 *   job done      the owner's card is charged the total straight away: taken
 *                 from the hold placed when the job went out, up to the held
 *                 amount, and anything beyond it as a second, separate charge
 *                 (DECISIONS.md, 2026-11-23; src/lib/billing/card-holds.ts)
 *   24 hours on   the tradie's share is sent, unless the owner has raised a problem.
 *                 It never waits for the owner's card for the first NZ$1,000
 *                 of the job's price not yet collected (the payout guarantee);
 *                 the tradie's share of anything above that waits until the
 *                 card pays, and then goes as a second transfer
 *   a flagged job the tradie's share is held until the owner confirms, or the
 *                 timer or the team decides (src/lib/jobs/confirm.ts)
 *   a problem     pauses the tradie's money and puts the job in front of the dispatcher
 *   a refund      comes off the platform's share and the tradie's share in proportion
 *   missed promise  nothing is credited any more (DECISIONS.md, 2026-11-18).
 *                   A missed-promise credit created before then still comes
 *                   off its own job's charge.
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
  hold_captured_cents?: number; extra_payment_intent_id?: string | null; extra_charge_id?: string | null;
};

type HoldClaim = { id: string; amount_cents: number; currency: string; payment_intent_id: string | null; charge_id: string | null; provider: Provider | null };

type PayoutRow = {
  id: string; job_id: string; tradie_id: string; amount_cents: number; currency: string; status: string; release_at: Date;
  transfer_id: string | null; attempts: number; provider: Provider | null; deducted_cents?: number; balance_waits?: number; refusals?: number;
  waits_cents?: number; rest_status?: string | null;
};

/**
 * Refunds part of a job's charge, which may be two payments: what was taken from the hold first, then the separate
 * charge for anything beyond it (DECISIONS.md, 2026-11-23). Refunds come off the first payment until it is used up,
 * then off the second, so how much each has given back always follows from the total refunded so far. Returns the
 * first refund's id.
 */
async function refundAcross(gateway: PaymentsGateway, payment: PaymentRow, refundCents: number, idempotencyKey: string): Promise<{ refundId: string }> {
  const held = Number(payment.hold_captured_cents ?? 0);
  const firstAmount = held > 0 && payment.extra_payment_intent_id ? held : payment.amount_cents;
  const firstLeft = Math.max(0, firstAmount - Math.min(payment.refunded_cents, firstAmount));
  const fromFirst = Math.min(refundCents, firstLeft);
  const fromSecond = refundCents - fromFirst;
  let refundId: string | null = null;
  if (fromFirst > 0) refundId = (await gateway.refund({ paymentIntentId: payment.payment_intent_id!, amountCents: fromFirst, idempotencyKey })).refundId;
  if (fromSecond > 0 && payment.extra_payment_intent_id) {
    const second = await gateway.refund({ paymentIntentId: payment.extra_payment_intent_id, amountCents: fromSecond, idempotencyKey: `${idempotencyKey}-x` });
    refundId ??= second.refundId;
  }
  if (!refundId) throw new Error("There is nothing left of this charge to refund.");
  return { refundId };
}

export { refundAcross };

/**
 * What the owner has paid for a job so far (DECISIONS.md, 2026-11-23): the charge if it went through, otherwise
 * what was taken from the hold, plus any quote paid when it was approved. With nothing to charge, all of it.
 */
export async function collectedCents(db: Db, jobId: string, ownerTotalCents: number): Promise<number> {
  const payment = (await db.query<{ status: string; amount_cents: number; hold_captured_cents: number }>(
    "select status, amount_cents, hold_captured_cents from public.payments where job_id = $1::uuid",
    [jobId],
  ))[0];
  const prepaid = await db.query<{ total: number }>("select coalesce(sum(amount_cents), 0) as total from public.job_prepayments where job_id = $1::uuid and status = 'succeeded'", [jobId]);
  const fromPrepaid = Number(prepaid[0]?.total ?? 0);
  if (!payment) return Math.max(ownerTotalCents, fromPrepaid);
  const fromCharge = ["succeeded", "part_refunded", "refunded"].includes(payment.status) ? Number(payment.amount_cents) : Number(payment.hold_captured_cents ?? 0);
  return fromCharge + fromPrepaid;
}

/**
 * Called in the same database step that marks a job done: writes down what
 * the owner owes and what the tradie is owed. Nothing is charged yet.
 */
export async function openSettlement(db: Db, job: Job, market: Market): Promise<void> {
  const at = job.completedAt ?? now();
  const billing = await getBilling(db, job.ownerId, market.country);

  // A missed-promise credit created before 18 November 2026, when such credits
  // stopped (DECISIONS.md, 2026-11-18), still comes off this charge: it was
  // promised. No new ones are made. The tradie is still paid in full below.
  let chargeCents = job.ownerTotalCents;
  const credit = (await db.query<{ id: string; amount_cents: number }>(
    "select id, amount_cents from public.credits where job_id = $1::uuid and reason = 'missed_window' and status = 'pending' for update",
    [job.id],
  ))[0];
  if (credit && chargeCents > 0) {
    const off = Math.min(Number(credit.amount_cents), chargeCents);
    chargeCents -= off;
    await db.query(
      "update public.credits set status = 'applied', provider_ref = $2, note = $3 where id = $1::uuid and status = 'pending'",
      [credit.id, `job:${job.id}`, `Taken off job ${job.number}`],
    );
    await audit(db, {
      actor: "system", action: "credit.applied", entity: "job", entityId: job.id, amount: off, currency: job.currency,
      detail: { reason: "missed_window", credit: credit.id, charged: chargeCents }, dedupeKey: `credit.applied:${credit.id}`,
    });
  }
  // A quote over NZ$1,000 was charged when the owner approved it (DECISIONS.md, 2026-11-23): it is not charged again.
  // One whose work did not go ahead (its lines are no longer on the job) is refunded instead (refundDuePrepayments).
  const prepaid = await db.query<{ id: string; amount_cents: number; quote_id: string }>(
    "select id, amount_cents, quote_id from public.job_prepayments where job_id = $1::uuid and status = 'succeeded' for update",
    [job.id],
  );
  for (const row of prepaid) {
    const going = await db.query("select 1 from public.job_lines where quote_id = $1::uuid and status = 'active' limit 1", [row.quote_id]);
    if (going.length === 0) {
      await db.query("update public.job_prepayments set status = 'refund_due' where id = $1::uuid and status = 'succeeded'", [row.id]);
      continue;
    }
    chargeCents -= Math.min(Number(row.amount_cents), chargeCents);
  }
  const taxCents = chargeCents === job.ownerTotalCents ? job.taxCents : job.taxCents > 0 ? taxPortion(chargeCents, market.taxRate) : 0;

  if (chargeCents > 0) {
    await db.query(
      `insert into public.payments (created_at, job_id, owner_id, amount_cents, tax_cents, currency, status, provider)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, 'pending', $7)
       on conflict (job_id) do nothing`,
      [at.toISOString(), job.id, job.ownerId, chargeCents, taxCents, job.currency, billing?.provider ?? "stripe"],
    );
  }
  if (job.tradieTotalCents > 0 && job.tradieId) {
    const held = (await holdReasons(db, job.id)).length > 0;
    await db.query(
      `insert into public.payouts (created_at, job_id, tradie_id, amount_cents, currency, status, release_at)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7::timestamptz)
       on conflict (job_id) do nothing`,
      [
        at.toISOString(), job.id, job.tradieId, job.tradieTotalCents, job.currency,
        // Held while the owner is asked to confirm a flagged job (DECISIONS.md, 2026-11-19), or a receipt is to
        // follow or being checked (2026-11-20). Otherwise: with nothing to charge the owner there is nothing to wait for.
        // The tradie no longer waits for the owner's card (DECISIONS.md, 2026-11-20, second entry): paid at the usual time whatever it does.
        held ? "held" : "scheduled", addHours(at, market.payoutHoldHours).toISOString(),
      ],
    );
  }
}

export type ChargeOutcome = "succeeded" | "failed" | "skipped";

/**
 * Charges the owner for a finished job. Safe to call again: a job is never charged twice.
 *
 * With a hold on the card (DECISIONS.md, 2026-11-23), the charge is taken from it first, up to the held amount (a
 * partial capture lets the rest of the hold go). Anything beyond the hold is a second, separate charge on the saved
 * card, made the way every charge was before holds. A hold that has run out is skipped: the whole amount is charged
 * the usual way. Each Stripe call has its own key (the capture's names the hold, the charge's names the try), so a
 * repeat after a crash is handed back by Stripe, never made twice.
 */
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
    // A "not the job described" call-out is not charged until the owner has had their say (DECISIONS.md, 2026-11-20, third entry).
    if (job.notDescribedStatus === "waiting" || job.notDescribedStatus === "owner_objects") return null;
    const context = await loadContext(tx, job);
    const billing = await getBilling(tx, job.ownerId, context.market.country);
    await tx.query("update public.payments set claimed_until = $2::timestamptz, next_retry_at = null, last_attempt_at = $3::timestamptz where id = $1::uuid", [payment.id, addMinutes(at, 2).toISOString(), at.toISOString()]);
    // The hold on the card, if the charge has not been taken from one yet.
    const hold = Number(payment.hold_captured_cents ?? 0) > 0
      ? null
      : ((await tx.query<HoldClaim>(
          "select id, amount_cents, currency, payment_intent_id, charge_id, provider from public.card_holds where job_id = $1::uuid and status = 'held' order by seq desc limit 1 for update",
          [jobId],
        ))[0] ?? null);
    // The try number only goes up when a try ends in a definite "no". If this
    // server dies half-way, the next try uses the same number and so the same
    // key, and the payment company treats it as the same charge.
    return { payment: { ...payment, attempts: payment.attempts + 1 }, job, context, billing, hold };
  });
  if (!claim) return "skipped";
  const { payment, job, context, billing, hold } = claim;

  const gateway = gatewayFor(context.market.country);
  // 1. From the hold, up to the held amount.
  let captured: { holdId: string; amountCents: number; paymentIntentId: string; chargeId: string | null } | null = null;
  let holdGone: { holdId: string; reason: string } | null = null;
  let captureError: string | null = null;
  if (hold && gateway && hold.payment_intent_id && (!hold.provider || hold.provider === gateway.provider)) {
    const take = Math.min(Number(hold.amount_cents), payment.amount_cents);
    try {
      const taken = await gateway.captureHold({ paymentIntentId: hold.payment_intent_id, amountCents: take, idempotencyKey: `hostfix-hold-${hold.id}-capture` });
      if (taken.status === "captured") captured = { holdId: hold.id, amountCents: Math.min(taken.amountCents, take), paymentIntentId: hold.payment_intent_id, chargeId: taken.chargeId ?? hold.charge_id };
      else holdGone = { holdId: hold.id, reason: taken.reason };
    } catch (error) {
      // Unknown whether it was taken: nothing more is asked for now, and the next try uses the same key.
      captureError = error instanceof Error ? error.message : String(error);
    }
  }
  const alreadyFromHold = Number(payment.hold_captured_cents ?? 0) + (captured?.amountCents ?? 0);
  const remaining = payment.amount_cents - alreadyFromHold;

  // 2. Anything beyond the hold: a separate charge on the saved card.
  let result: Awaited<ReturnType<PaymentsGateway["chargeJob"]>>;
  if (captureError) {
    result = { status: "failed", reason: `Taking the charge from the hold on the card did not finish: ${captureError}`, code: "error", paymentIntentId: null };
  } else if (remaining <= 0) {
    result = { status: "succeeded", paymentIntentId: captured?.paymentIntentId ?? payment.payment_intent_id ?? "", chargeId: captured?.chargeId ?? payment.charge_id };
  } else if (!gateway) {
    result = { status: "failed", reason: "Card payments are not set up for this country.", code: "not_configured", paymentIntentId: null };
  } else if (!billing || billing.provider !== gateway.provider) {
    result = { status: "failed", reason: "The owner has no card on file.", code: "no_card", paymentIntentId: null };
  } else {
    try {
      result = await gateway.chargeJob({
        customerId: billing.customerId, paymentMethodId: billing.paymentMethodId, amountCents: remaining, currency: payment.currency,
        description: `Job ${job.number}: ${job.title} at ${context.property.name}${alreadyFromHold > 0 ? " (beyond the hold)" : ""}`.slice(0, 200), jobNumber: job.number,
        receiptEmail: context.owner.email, idempotencyKey: `hostfix-job-${jobId}-charge-${payment.attempts}`,
      });
    } catch (error) {
      result = { status: "failed", reason: error instanceof Error ? error.message : String(error), code: "error", paymentIntentId: null };
    }
  }
  const twoPayments = alreadyFromHold > 0 && remaining > 0;

  return db.tx(async (tx) => {
    const at = now();
    if (captured) {
      await tx.query("update public.card_holds set status = 'captured', captured_cents = $2, captured_at = $3::timestamptz, claimed_until = null where id = $1::uuid", [captured.holdId, captured.amountCents, at.toISOString()]);
      await tx.query("update public.payments set hold_id = $2::uuid, hold_captured_cents = $3, payment_intent_id = $4, charge_id = $5, provider = $6 where id = $1::uuid", [
        payment.id, captured.holdId, alreadyFromHold, captured.paymentIntentId, captured.chargeId, gateway!.provider,
      ]);
      await audit(tx, {
        actor: gateway!.provider, action: "hold.captured", entity: "job", entityId: jobId, amount: captured.amountCents, currency: payment.currency,
        detail: { hold: captured.holdId, held: Number(hold!.amount_cents), payment_intent: captured.paymentIntentId, beyond_hold: Math.max(0, remaining) },
        dedupeKey: `hold.captured:${captured.holdId}`,
      });
      // Any other hold on the job is let go.
      await releaseJobHolds(tx, jobId, "The job's charge was taken from another hold.");
    } else if (holdGone) {
      await tx.query("update public.card_holds set status = 'expired', claimed_until = null, last_error = $2 where id = $1::uuid", [holdGone.holdId, holdGone.reason.slice(0, 500)]);
      await audit(tx, { actor: gateway?.provider ?? "system", action: "hold.expired", entity: "job", entityId: jobId, detail: { hold: holdGone.holdId, reason: holdGone.reason } });
    } else if (hold && captureError) {
      await tx.query("update public.card_holds set claimed_until = null, last_error = $2 where id = $1::uuid", [hold.id, captureError.slice(0, 500)]);
    }
    if (result.status === "succeeded") {
      if (twoPayments) {
        await tx.query(
          `update public.payments set status = 'succeeded', paid_at = $2::timestamptz, extra_payment_intent_id = $3, extra_charge_id = $4, provider = $5,
                  last_error = null, attempts = $6, claimed_until = null
            where id = $1::uuid`,
          [payment.id, at.toISOString(), result.paymentIntentId, result.chargeId, gateway!.provider, payment.attempts],
        );
      } else {
        await tx.query(
          `update public.payments set status = 'succeeded', paid_at = $2::timestamptz, payment_intent_id = $3, charge_id = $4, provider = $5,
                  last_error = null, attempts = $6, claimed_until = null
            where id = $1::uuid`,
          [payment.id, at.toISOString(), result.paymentIntentId || payment.payment_intent_id, result.chargeId, gateway?.provider ?? payment.provider, payment.attempts],
        );
      }
      await releaseJobHolds(tx, jobId, "The job is charged.");
      const dispute = await tx.query("select 1 from public.disputes where job_id = $1::uuid and status = 'open'", [jobId]);
      await tx.query("update public.payouts set status = $2 where job_id = $1::uuid and status = 'waiting'", [jobId, dispute.length > 0 ? "paused" : "scheduled"]);
      // The part of a big job's payout that waited for the card can go now (DECISIONS.md, 2026-11-23).
      await tx.query("update public.payouts set rest_status = 'due' where job_id = $1::uuid and rest_status = 'waiting' and status = 'sent'", [jobId]);
      await tx.query("update public.payouts set release_at = $2::timestamptz, rest_status = null where job_id = $1::uuid and rest_status = 'waiting' and status = 'scheduled'", [jobId, at.toISOString()]);
      await resolveExceptionsFor(tx, jobId, ["payment_failed", "owner_owes"], "Card charged");
      await audit(tx, {
        actor: gateway?.provider ?? payment.provider, action: "payment.succeeded", entity: "job", entityId: jobId, amount: payment.amount_cents, currency: payment.currency,
        detail: { payment_intent: result.paymentIntentId, attempt: payment.attempts, tax: payment.tax_cents, from_hold: alreadyFromHold, beyond_hold: Math.max(0, remaining) }, dedupeKey: `payment.succeeded:${jobId}`,
      });
      if (context.owner.phone) {
        // A flagged job: the same text asks the owner to look at the photos and confirm, on the job page (DECISIONS.md, 2026-11-19).
        const check = job.confirmStatus === "waiting";
        // A cancelled job is charged only the call-out (cancelled after the tradie arrived, DECISIONS.md, 2026-11-23),
        // or parts bought for it that could not go back (DECISIONS.md, 2026-11-20).
        const cancelled = job.status === "cancelled";
        const boughtParts = cancelled && (await tx.query("select 1 from public.job_lines where job_id = $1::uuid and status = 'active' and kind = 'adjustment' and label like 'Parts bought before%' limit 1", [jobId])).length > 0;
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: cancelled ? (boughtParts ? "bought_parts_charged" : "call_out_charged") : check ? "job_check" : "job_done", audience: "owner", jobId, userId: context.owner.userId,
          body: cancelled
            ? boughtParts
              ? texts.boughtPartsCharged({ number: job.number, property: context.property.name, totalCents: payment.amount_cents, currency: payment.currency, link: ownerJobUrl(job) })
              : texts.callOutCharged({ number: job.number, totalCents: payment.amount_cents, currency: payment.currency, link: ownerJobUrl(job) })
            : check
              ? texts.jobCheck({ title: job.title, property: context.property.name, totalCents: payment.amount_cents, currency: payment.currency, flags: job.checkFlags, link: ownerJobUrl(job) })
              : texts.jobDone({ title: job.title, property: context.property.name, totalCents: payment.amount_cents, currency: payment.currency, link: ownerJobUrl(job) }),
          dedupeKey: `job_done:${jobId}`,
        });
      }
      if (job.status === "completed" && job.reporterPhone && job.reportedBy !== "owner" && job.reporterPhone !== context.owner.phone && job.outcome !== "no_access") {
        await enqueue(tx, {
          channel: "sms", to: job.reporterPhone, template: "reporter_done", audience: "reporter", jobId,
          body: texts.reporterDone({ property: context.property.name }), dedupeKey: `reporter_done:${jobId}`,
        });
      }
      return "succeeded";
    }

    const owed = Math.max(0, payment.amount_cents - alreadyFromHold);
    const retry = payment.attempts < MAX_CHARGE_ATTEMPTS;
    await tx.query(
      `update public.payments set status = 'failed', last_error = $2, next_retry_at = $3::timestamptz,
              ${alreadyFromHold > 0 ? "extra_payment_intent_id = coalesce($4, extra_payment_intent_id)" : "payment_intent_id = coalesce($4, payment_intent_id)"}, attempts = $5, claimed_until = null
        where id = $1::uuid`,
      [payment.id, result.reason.slice(0, 500), retry ? addHours(at, RETRY_HOURS).toISOString() : null, result.paymentIntentId, payment.attempts],
    );
    await audit(tx, {
      actor: gateway?.provider ?? "system", action: "payment.failed", entity: "job", entityId: jobId, amount: owed, currency: payment.currency,
      detail: { reason: result.reason, code: result.code, attempt: payment.attempts, will_retry: retry, from_hold: alreadyFromHold }, dedupeKey: `payment.failed:${jobId}:${payment.attempts}`,
    });
    const fromHoldWords = alreadyFromHold > 0 ? ` ${formatMoney(alreadyFromHold, payment.currency)} was taken from the hold on the card; ${formatMoney(owed, payment.currency)} beyond it was not.` : "";
    await raiseException(tx, {
      kind: "payment_failed", market: job.market, jobId,
      summary: `Job ${job.number}: the owner's card was not charged (${result.reason}).${fromHoldWords} ${retry ? "It will be tried again tomorrow." : "It has been tried four times."} The tradie is paid at the usual time anyway, up to the payout guarantee: chasing the owner is ours.`,
      dedupeKey: `payment_failed:${jobId}`,
    });
    if (!retry) {
      // All the tries have failed (DECISIONS.md, 2026-11-20, second entry): HostFix carries the debt, the owner owes it,
      // and no new jobs go out for them until it is paid (cardProblem, src/lib/owners/service.ts).
      await raiseException(tx, {
        kind: "owner_owes", market: job.market, jobId,
        summary: `${context.owner.name} owes ${formatMoney(owed, payment.currency)} for job ${job.number} at ${context.property.name}: the card was tried four times. The tradie is paid by us anyway, up to the payout guarantee. Ring the owner${context.owner.phone ? ` on ${context.owner.phone}` : ""}.`,
        dedupeKey: `owner_owes:${jobId}`,
      });
    }
    if (context.owner.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "payment_failed", audience: "owner", jobId, userId: context.owner.userId,
        body: texts.paymentFailed({ amountCents: owed, currency: payment.currency, number: job.number, link: `${baseUrl()}/app/billing` }),
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
  // An owner who saved a new card since the last try is tried again at once, even after the four automatic tries.
  const newCard = await db.query<{ job_id: string }>(
    `select p.job_id from public.payments p
       join public.jobs j on j.id = p.job_id
       join public.markets m on m.slug = j.market
       join public.owner_billing b on b.owner_id = p.owner_id and b.country = m.country
      where p.status = 'failed' and b.updated_at > coalesce(p.last_attempt_at, p.created_at)
      order by p.created_at limit 50`,
  );
  for (const row of newCard) {
    if ((await chargeJob(db, gatewayFor, row.job_id, { force: true })) !== "skipped") done += 1;
  }
  return done;
}

/**
 * "waiting": the tradie is paid ahead of the owner's card, and HostFix's own Stripe balance is too low
 * to cover it just now. It is tried again on the next timer run (DECISIONS.md, 2026-11-21).
 */
export type PayoutOutcome = "sent" | "failed" | "retry" | "waiting" | "skipped";

/**
 * The idempotency key for a payout. It moves on (-w1, -w2, ...) only after Stripe definitely refused the last
 * try and that refusal was saved: "not enough balance" (balance_waits) or any other refusal (refusals). Both
 * only ever go up, so every key is used for one try's worth of calls and never comes back. A try whose outcome
 * is unknown (timeout, network, Stripe server error) or that never got saved (the server stopped mid-call)
 * keeps the same key, so a transfer that did go through is replayed, never sent twice.
 */
export function payoutKey(jobId: string, refusedTries: number): string {
  return refusedTries > 0 ? `hostfix-job-${jobId}-payout-w${refusedTries}` : `hostfix-job-${jobId}-payout`;
}

/**
 * Sends one tradie's share, if it is due. A payout is never sent twice.
 *
 * A payout tied to the owner's charge (source_transaction) is never more than what is left of that charge
 * after refunds: Stripe refuses it otherwise. Every refund made before the payout goes has already taken the
 * tradie's share off it (refundSplit), so this only matters for a payout that is bigger than its charge for
 * another reason (an old missed-promise credit came off the charge, not the payout): that one is sent from
 * HostFix's own balance instead, like a tradie paid ahead of the card.
 */
export async function releasePayout(db: Db, gatewayFor: GatewayFor, payoutId: string): Promise<PayoutOutcome> {
  const claim = await db.tx(async (tx) => {
    const at = now();
    const rows = await tx.query<PayoutRow>("select * from public.payouts where id = $1::uuid for update", [payoutId]);
    const payout = rows[0];
    // "waiting": an earlier try found HostFix's Stripe balance too low. It is tried again like a scheduled one.
    if (!payout || !["scheduled", "waiting"].includes(payout.status) || new Date(payout.release_at).getTime() > at.getTime()) return null;
    const dispute = await tx.query("select 1 from public.disputes where job_id = $1::uuid and status = 'open'", [payout.job_id]);
    if (dispute.length > 0) {
      await tx.query("update public.payouts set status = 'paused' where id = $1::uuid", [payoutId]);
      return null;
    }
    // The tradie is paid at the usual time whatever the owner's card has done (DECISIONS.md, 2026-11-20, second entry).
    // Without a charge to pay from, the transfer comes out of HostFix's own balance.
    const paid = await tx.query<{ charge_id: string | null; status: string; amount_cents: number; refunded_cents: number; hold_captured_cents: number; extra_charge_id: string | null }>(
      "select charge_id, status, amount_cents, refunded_cents, hold_captured_cents, extra_charge_id from public.payments where job_id = $1::uuid",
      [payout.job_id],
    );
    const charged = !paid[0] || ["succeeded", "part_refunded"].includes(paid[0].status);
    // The charges a transfer may be tied to, each with what is left of it after refunds (the most a transfer tied to
    // it may be). The first payment (from the hold, or the whole charge); the second (beyond the hold); a quote paid
    // when it was approved (DECISIONS.md, 2026-11-23). Refunds come off the first payment first (refundAcross).
    const sources: { chargeId: string; left: number }[] = [];
    if (paid[0]) {
      const p = paid[0];
      const held = Number(p.hold_captured_cents ?? 0);
      const split = held > 0 && p.extra_charge_id;
      const firstAmount = split ? held : Number(p.amount_cents);
      const firstRefunded = Math.min(Number(p.refunded_cents), firstAmount);
      // Taken from the hold, that part has been paid even if the charge beyond it failed.
      if (p.charge_id && (charged || held > 0)) sources.push({ chargeId: p.charge_id, left: firstAmount - firstRefunded });
      if (split && charged) sources.push({ chargeId: p.extra_charge_id!, left: Number(p.amount_cents) - held - (Number(p.refunded_cents) - firstRefunded) });
    }
    for (const row of await tx.query<{ charge_id: string | null; amount_cents: number; refunded_cents: number }>(
      "select charge_id, amount_cents, refunded_cents from public.job_prepayments where job_id = $1::uuid and status = 'succeeded' and charge_id is not null order by created_at",
      [payout.job_id],
    )) {
      sources.push({ chargeId: row.charge_id!, left: Number(row.amount_cents) - Number(row.refunded_cents) });
    }
    // A balance the tradie owes (a lost chargeback that was their fault) comes off, never more than half of this payout.
    // Worked out once and kept, so a retried transfer always asks for the same amount.
    let deducted = Number(payout.deducted_cents ?? 0);
    if (deducted === 0 && payout.attempts === 0) {
      const owing = await tx.query<{ owed: number }>(
        `select coalesce(sum(amount_cents - recovered_cents), 0)
                - coalesce((select sum(o.deducted_cents) from public.payouts o where o.tradie_id = $1::uuid and o.status in ('scheduled', 'waiting', 'failed') and o.id <> $2::uuid), 0) as owed
           from public.tradie_balances where tradie_id = $1::uuid and status = 'open'`,
        [payout.tradie_id, payoutId],
      );
      deducted = Math.max(0, Math.min(Number(owing[0]?.owed ?? 0), Math.floor(payout.amount_cents / 2)));
      if (deducted > 0) await tx.query("update public.payouts set deducted_cents = $2 where id = $1::uuid", [payoutId, deducted]);
    }
    const job = await getJobForStaff(tx, payout.job_id);
    const jobMarket = job ? await getMarket(tx, job.market) : null;
    // The payout guarantee (DECISIONS.md, 2026-11-23): paid ahead of the owner's card for up to the market's NZ$1,000
    // of the job's price not yet collected. The tradie's share of anything above that waits for the card and goes as a
    // second transfer once it pays (releaseDueRests). Worked out once, on the first try, so every retry asks for the same.
    let waits = Number(payout.waits_cents ?? 0);
    if (job && jobMarket && payout.attempts === 0 && waits === 0) {
      waits = payoutWaits({
        ownerTotalCents: job.ownerTotalCents, collectedCents: await collectedCents(tx, job.id, job.ownerTotalCents),
        guaranteeCents: jobMarket.payoutGuaranteeCents, payoutCents: payout.amount_cents - deducted,
      });
      if (waits > 0 && waits >= payout.amount_cents - deducted) {
        // Everything waits for the card (a guarantee of nothing): checked again in a day, or as soon as the card pays.
        await tx.query("update public.payouts set rest_status = 'waiting', release_at = $2::timestamptz where id = $1::uuid", [payoutId, addHours(at, 24).toISOString()]);
        await audit(tx, { actor: "system", action: "payout.waits_for_charge", entity: "job", entityId: job.id, amount: waits, currency: payout.currency, detail: { all: true } });
        return null;
      }
      if (waits > 0) {
        await tx.query("update public.payouts set waits_cents = $2, rest_status = 'waiting' where id = $1::uuid", [payoutId, waits]);
        await audit(tx, {
          actor: "system", action: "payout.waits_for_charge", entity: "job", entityId: job.id, amount: waits, currency: payout.currency,
          detail: { owner_total: job.ownerTotalCents, guarantee: jobMarket.payoutGuaranteeCents, sent_now: payout.amount_cents - deducted - waits },
        });
      }
    }
    const tradie = await tx.query<{ payout_account_id: string | null; payouts_enabled: boolean; business_name: string; phone: string | null; user_id: string }>(
      `select t.payout_account_id, t.payouts_enabled, t.business_name, u.phone, t.user_id
         from public.tradies t join public.users u on u.id = t.user_id where t.id = $1::uuid`,
      [payout.tradie_id],
    );
    const market = job ? await getMarket(tx, job.market) : null;
    if (!job || !market || !tradie[0]) return null;
    // Push the release time out so another server does not pick it up while we talk to the payment company.
    await tx.query("update public.payouts set attempts = attempts + 1, release_at = $2::timestamptz where id = $1::uuid", [payoutId, addMinutes(at, 10).toISOString()]);
    const sendCents = payout.amount_cents - deducted - waits;
    // Tied to a charge only while that charge can cover it (see above).
    const chargeId = sources.find((source) => sendCents <= source.left)?.chargeId ?? null;
    return { payout: { ...payout, attempts: payout.attempts + 1 }, job, market, tradie: tradie[0], chargeId, charged, deducted, sendCents };
  });
  if (!claim) return "skipped";
  const { payout, job, market, tradie, chargeId, charged, deducted, sendCents } = claim;

  const gateway = gatewayFor(market.country);
  let transferId: string | null = null;
  let failure: string | null = null;
  let balanceTooLow = false;
  let refused = false;
  if (!gateway) failure = "Payments are not set up for this country.";
  else if (!tradie.payout_account_id) failure = `${tradie.business_name} has not added bank details yet.`;
  else {
    try {
      const sent = await gateway.transfer({
        accountId: tradie.payout_account_id, amountCents: sendCents, currency: payout.currency, chargeId, jobNumber: job.number,
        idempotencyKey: payoutKey(job.id, Number(payout.balance_waits ?? 0) + Number(payout.refusals ?? 0)),
      });
      transferId = sent.transferId;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      balanceTooLow = error instanceof PlatformBalanceTooLow;
      refused = error instanceof TransferRefused;
    }
  }

  return db.tx(async (tx) => {
    const at = now();
    if (balanceTooLow) {
      // Nothing was sent (a definite "no" from Stripe), so this try does not count towards giving up, the next
      // try uses a new key (Stripe replays a saved error for the same key for 24 hours), and the next timer run
      // tries again. The money is owed: it is never marked failed for this (DECISIONS.md, 2026-11-21).
      await tx.query(
        `update public.payouts set status = 'waiting', attempts = greatest(attempts - 1, 0), balance_waits = balance_waits + 1,
                release_at = $2::timestamptz, last_error = $3 where id = $1::uuid`,
        [payoutId, at.toISOString(), `Waiting for the HostFix Stripe balance: ${failure}`.slice(0, 500)],
      );
      await audit(tx, {
        actor: gateway!.provider, action: "payout.waiting_for_balance", entity: "job", entityId: job.id, amount: sendCents, currency: payout.currency,
        detail: { tradie: tradie.business_name, reason: failure, owner_charged: charged }, dedupeKey: `payout.waiting_for_balance:${job.id}`,
      });
      await raiseException(tx, {
        kind: "platform_balance", market: job.market, jobId: job.id, tradieId: payout.tradie_id,
        summary: `Top up the HostFix Stripe balance to pay ${tradie.business_name}: ${formatMoney(sendCents, payout.currency)} for job ${job.number} is waiting. The owner's card has not paid, so it comes from our own Stripe balance, and there is not enough available there yet. It goes by itself once there is.`,
        dedupeKey: `platform_balance:${job.id}`,
      });
      return "waiting";
    }
    if (transferId) {
      await tx.query("update public.payouts set status = 'sent', transfer_id = $2, sent_at = $3::timestamptz, provider = $4, last_error = null where id = $1::uuid", [
        payoutId, transferId, at.toISOString(), gateway!.provider,
      ]);
      await resolveExceptionsFor(tx, job.id, ["payout_failed", "platform_balance"], "Tradie paid");
      // What came off goes against the oldest balances first.
      let left = deducted;
      const balances = await tx.query<{ id: string; amount_cents: number; recovered_cents: number }>(
        "select id, amount_cents, recovered_cents from public.tradie_balances where tradie_id = $1::uuid and status = 'open' order by created_at for update",
        [payout.tradie_id],
      );
      for (const balance of balances) {
        if (left <= 0) break;
        const take = Math.min(left, balance.amount_cents - balance.recovered_cents);
        if (take <= 0) continue;
        left -= take;
        await tx.query("insert into public.balance_recoveries (created_at, balance_id, payout_id, amount_cents) values ($1::timestamptz, $2::uuid, $3::uuid, $4) on conflict do nothing", [at.toISOString(), balance.id, payoutId, take]);
        await tx.query("update public.tradie_balances set recovered_cents = recovered_cents + $2, status = case when recovered_cents + $2 >= amount_cents then 'recovered' else 'open' end where id = $1::uuid", [balance.id, take]);
      }
      if (!charged) await tx.query("update public.payments set tradie_paid_ahead_at = $2::timestamptz where job_id = $1::uuid and tradie_paid_ahead_at is null", [job.id, at.toISOString()]);
      await audit(tx, {
        actor: gateway!.provider, action: "payout.sent", entity: "job", entityId: job.id, amount: sendCents, currency: payout.currency,
        detail: {
          transfer: transferId, tradie: tradie.business_name, hours_after_completion: job.completedAt ? Math.round((at.getTime() - job.completedAt.getTime()) / 3_600_000) : null,
          deducted, owner_charged: charged, from_charge: Boolean(chargeId),
        },
        dedupeKey: `payout.sent:${job.id}`,
      });
      if (tradie.phone) {
        await enqueue(tx, {
          channel: "sms", to: tradie.phone, template: "payout_sent", audience: "tradie", jobId: job.id, userId: tradie.user_id,
          body: texts.payoutSent({ number: job.number, amountCents: sendCents + deducted, currency: payout.currency, deductedCents: deducted }), dedupeKey: `payout_sent:${job.id}`,
        });
      }
      return "sent";
    }
    const giveUp = payout.attempts >= MAX_PAYOUT_ATTEMPTS || !gateway || !tradie.payout_account_id;
    // A definite refusal moves the next try (here ten minutes on, or the dispatcher's retry) to a new key.
    await tx.query("update public.payouts set status = $2, last_error = $3, refusals = refusals + $4 where id = $1::uuid", [
      payoutId, giveUp ? "failed" : "scheduled", failure!.slice(0, 500), refused ? 1 : 0,
    ]);
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
    "select id from public.payouts where status in ('scheduled', 'waiting') and release_at <= $1::timestamptz order by release_at limit 50",
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

/**
 * Run by the timer: the part of a payout that waited for the owner's card, once the card has paid (DECISIONS.md,
 * 2026-11-23). Sent as its own transfer with its own key, tied to the charge beyond the hold when that can cover it.
 * A failed try stays due and is tried again on the next run, with the same key.
 */
export async function releaseDueRests(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const due = await db.query<{ id: string }>("select id from public.payouts where rest_status = 'due' and status = 'sent' and waits_cents > 0 order by created_at limit 50");
  let sent = 0;
  for (const row of due) {
    const claim = await db.tx(async (tx) => {
      const payout = (await tx.query<PayoutRow & { rest_transfer_id: string | null }>("select * from public.payouts where id = $1::uuid and rest_status = 'due' for update", [row.id]))[0];
      if (!payout) return null;
      const job = await getJobForStaff(tx, payout.job_id);
      const market = job ? await getMarket(tx, job.market) : null;
      const tradie = (await tx.query<{ payout_account_id: string | null; business_name: string; phone: string | null; user_id: string }>(
        "select t.payout_account_id, t.business_name, u.phone, t.user_id from public.tradies t join public.users u on u.id = t.user_id where t.id = $1::uuid",
        [payout.tradie_id],
      ))[0];
      const paid = (await tx.query<{ extra_charge_id: string | null; charge_id: string | null; amount_cents: number; refunded_cents: number; hold_captured_cents: number }>(
        "select extra_charge_id, charge_id, amount_cents, refunded_cents, hold_captured_cents from public.payments where job_id = $1::uuid",
        [payout.job_id],
      ))[0];
      if (!job || !market || !tradie) return null;
      const waits = Number(payout.waits_cents ?? 0);
      const extraLeft = paid?.extra_charge_id ? Number(paid.amount_cents) - Number(paid.hold_captured_cents) - Math.max(0, Number(paid.refunded_cents) - Number(paid.hold_captured_cents)) : 0;
      const chargeId = paid?.extra_charge_id && waits <= extraLeft ? paid.extra_charge_id : null;
      return { payout, job, market, tradie, waits, chargeId };
    });
    if (!claim) continue;
    const { payout, job, market, tradie, waits, chargeId } = claim;
    const gateway = gatewayFor(market.country);
    let transferId: string | null = null;
    let failure: string | null = null;
    if (!gateway) failure = "Payments are not set up for this country.";
    else if (!tradie.payout_account_id) failure = `${tradie.business_name} has not added bank details yet.`;
    else {
      try {
        transferId = (await gateway.transfer({ accountId: tradie.payout_account_id, amountCents: waits, currency: payout.currency, chargeId, jobNumber: job.number, idempotencyKey: `hostfix-job-${job.id}-payout-rest` })).transferId;
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
    }
    await db.tx(async (tx) => {
      const at = now();
      if (!transferId) {
        await tx.query("update public.payouts set rest_error = $2 where id = $1::uuid", [payout.id, (failure ?? "").slice(0, 500)]);
        await raiseException(tx, {
          kind: "payout_failed", market: job.market, jobId: job.id, tradieId: payout.tradie_id,
          summary: `Job ${job.number}: the rest of ${tradie.business_name}'s payment (${formatMoney(waits, payout.currency)}, which waited for the owner's card) could not be sent yet (${failure}). It is tried again every minute.`,
          dedupeKey: `payout_rest_failed:${job.id}`,
        });
        return;
      }
      await tx.query("update public.payouts set rest_status = 'sent', rest_transfer_id = $2, rest_sent_at = $3::timestamptz, rest_error = null where id = $1::uuid", [payout.id, transferId, at.toISOString()]);
      await resolveExceptionsFor(tx, job.id, ["payout_failed"], "The rest of the tradie's payment was sent");
      await audit(tx, {
        actor: gateway!.provider, action: "payout.rest_sent", entity: "job", entityId: job.id, amount: waits, currency: payout.currency,
        detail: { transfer: transferId, from_charge: Boolean(chargeId) }, dedupeKey: `payout.rest_sent:${job.id}`,
      });
      if (tradie.phone) {
        await enqueue(tx, {
          channel: "sms", to: tradie.phone, template: "payout_sent", audience: "tradie", jobId: job.id, userId: tradie.user_id,
          body: texts.payoutSent({ number: job.number, amountCents: waits, currency: payout.currency }), dedupeKey: `payout_rest_sent:${job.id}`,
        });
      }
    });
    if (transferId) sent += 1;
  }
  return sent;
}

/**
 * Run by the timer: a quote the owner paid when they approved it (DECISIONS.md, 2026-11-23) whose work then did
 * not happen (the job was cancelled, or the quote's lines came off the job) is refunded in full. Claimed first,
 * then refunded with a key that makes a repeat harmless, then written down.
 */
export async function refundDuePrepayments(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const due = await db.query<{ id: string }>("select id from public.job_prepayments where status = 'refund_due' order by created_at limit 50");
  let refunded = 0;
  for (const row of due) {
    const claim = await db.tx(async (tx) => {
      const found = (await tx.query<{ id: string; job_id: string; amount_cents: number; refunded_cents: number; currency: string; payment_intent_id: string | null; country: CountryCode; number: number; owner_phone: string | null; owner_user: string }>(
        `select pp.id, pp.job_id, pp.amount_cents, pp.refunded_cents, pp.currency, pp.payment_intent_id, m.country, j.number, u.phone as owner_phone, u.id as owner_user
           from public.job_prepayments pp join public.jobs j on j.id = pp.job_id join public.markets m on m.slug = j.market
           join public.owners o on o.id = pp.owner_id join public.users u on u.id = o.user_id
          where pp.id = $1::uuid and pp.status = 'refund_due' for update of pp`,
        [row.id],
      ))[0];
      if (!found) return null;
      await tx.query("update public.job_prepayments set status = 'refunding' where id = $1::uuid", [row.id]);
      return found;
    });
    if (!claim) continue;
    const gateway = gatewayFor(claim.country);
    const amount = Number(claim.amount_cents) - Number(claim.refunded_cents);
    let refundId: string | null = null;
    let failure: string | null = null;
    try {
      if (!gateway || !claim.payment_intent_id) throw new Error("Payments are not set up for this country.");
      refundId = (await gateway.refund({ paymentIntentId: claim.payment_intent_id, amountCents: amount, idempotencyKey: `hostfix-prepay-${claim.id}-refund` })).refundId;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    await db.tx(async (tx) => {
      if (!refundId) {
        await tx.query("update public.job_prepayments set status = 'refund_due', last_error = $2 where id = $1::uuid", [claim.id, (failure ?? "").slice(0, 500)]);
        await raiseException(tx, {
          kind: "needs_review", jobId: claim.job_id,
          summary: `Job ${Number(claim.number)}: the ${formatMoney(amount, claim.currency)} the owner paid for an approved quote should be refunded (the work did not go ahead), but the refund did not go through (${failure}). It is tried again every minute.`,
          dedupeKey: `prepay_refund_failed:${claim.id}`,
        });
        return;
      }
      await tx.query("update public.job_prepayments set status = 'refunded', refunded_cents = amount_cents, last_error = null where id = $1::uuid", [claim.id]);
      await audit(tx, {
        actor: gateway!.provider, action: "refund.issued", entity: "job", entityId: claim.job_id, amount, currency: claim.currency,
        detail: { refund: refundId, prepayment: claim.id, why: "The approved work did not go ahead." }, dedupeKey: `refund:prepay:${claim.id}`,
      });
      if (claim.owner_phone) {
        await enqueue(tx, {
          channel: "sms", to: claim.owner_phone, template: "quote_refunded", audience: "owner", jobId: claim.job_id, userId: claim.owner_user,
          body: texts.quoteRefunded({ number: Number(claim.number), amountCents: amount, currency: claim.currency }), dedupeKey: `quote_refunded:${claim.id}`,
        });
      }
    });
    if (refundId) refunded += 1;
  }
  return refunded;
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
    const paused = await tx.query("update public.payouts set status = 'paused' where job_id = $1::uuid and status in ('waiting', 'scheduled', 'held') returning id", [jobId]);
    // On a flagged job this is the owner's "Something's wrong" (DECISIONS.md, 2026-11-19).
    if (job.confirmStatus && job.confirmStatus !== "owner_problem") {
      await tx.query("update public.jobs set confirm_status = 'owner_problem', confirm_decided_at = $2::timestamptz, confirm_decided_by = $3 where id = $1::uuid", [jobId, at.toISOString(), actor]);
      await resolveExceptionsFor(tx, jobId, ["job_check"], "The owner raised a problem");
    }
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
      // Paid whatever the owner's card has done (DECISIONS.md, 2026-11-20, second entry).
      await tx.query("update public.payouts set status = $2, release_at = $3::timestamptz where job_id = $1::uuid and status = 'paused'", [
        job.id, "scheduled", at.toISOString(),
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
  // In proportion to the job's full price: when a missed-promise credit took the call-out off the charge, the
  // platform already wore that part, so the tradie's share of a refund is worked out from what the job was worth.
  const split = refundSplit({ ownerCents: Math.max(payment.amount_cents, job.ownerTotalCents), tradieCents: payout?.amount_cents ?? 0 }, refundCents);

  const gateway = gatewayFor(market.country);
  if (!gateway) return { ok: false, message: "Payments are not set up for this country." };
  let refundId: string;
  try {
    refundId = (await refundAcross(gateway, payment, refundCents, `hostfix-job-${job.id}-refund-${disputeId}`)).refundId;
  } catch (error) {
    return { ok: false, message: `The refund did not go through: ${error instanceof Error ? error.message : String(error)}` };
  }

  // If the tradie has already been paid, try to take their share of the refund back. A part of their payment still
  // waiting for the owner's card (DECISIONS.md, 2026-11-23) comes off first, as it has not gone.
  let clawback: "not_needed" | "done" | "failed" = "not_needed";
  const restOff = payout && payout.status === "sent" && ["waiting", "due"].includes(payout.rest_status ?? "") ? Math.min(Number(payout.waits_cents ?? 0), split.fromTradieCents) : 0;
  if (payout && payout.status === "sent" && payout.transfer_id && split.fromTradieCents - restOff > 0) {
    try {
      await gateway.reverseTransfer({ transferId: payout.transfer_id, amountCents: split.fromTradieCents - restOff, idempotencyKey: `hostfix-job-${job.id}-reverse-${disputeId}` });
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
    if (payout && restOff > 0) {
      const left = Number(payout.waits_cents ?? 0) - restOff;
      await tx.query("update public.payouts set waits_cents = $2, rest_status = case when $2 = 0 then 'cancelled' else rest_status end where id = $1::uuid", [payout.id, left]);
      await audit(tx, { actor, action: "payout.rest_reduced", entity: "job", entityId: job.id, amount: restOff, currency: payout.currency, detail: { still_waiting: left } });
    }
    if (payout) {
      const remaining = payout.amount_cents - split.fromTradieCents;
      if (["paused", "waiting", "scheduled", "held"].includes(payout.status)) {
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
// THE PROMISED TIME
// ---------------------------------------------------------------------------

/**
 * Run by the timer. For every job whose promised time has passed with no
 * tradie on site: mark the miss and put it in front of the dispatcher.
 *
 * Nothing is credited any more (DECISIONS.md, 2026-11-18): HostFix does not
 * lose its margin because a tradie is unreliable. What the owner pays follows
 * what happened instead: an urgent job reached late has no urgent line, and
 * nobody accepting means nothing is charged at all. Missed-promise credits
 * created before that decision still come off their job's charge
 * (openSettlement), because they were promised.
 *
 * An accepted job with nobody there is a no-show: the dispatcher is asked to
 * call the tradie, and a tradie with 3 no-shows in 90 days is put in front of
 * the team to talk to. Nobody is ever removed automatically.
 */
export async function markMissedWindows(db: Db): Promise<{ missed: number; noShows: number }> {
  const at = now();
  const due = await db.query<{ id: string }>(
    `select id from public.jobs
      where status in ('offering', 'unfilled', 'accepted') and arrived_at is null and window_missed_at is null
        and respond_by is not null and respond_by <= $1::timestamptz
      order by respond_by limit 100`,
    [at.toISOString()],
  );
  const result = { missed: 0, noShows: 0 };
  for (const row of due) {
    await db.tx(async (tx) => {
      const job = await lockJob(tx, row.id);
      if (!job || job.arrivedAt || job.windowMissedAt || !job.respondBy || job.respondBy.getTime() > at.getTime()) return;
      if (!["offering", "unfilled", "accepted"].includes(job.status)) return;
      const context = await loadContext(tx, job);
      const { market, property, tradie } = context;
      const noShow = job.status === "accepted" && Boolean(job.tradieId);
      await tx.query("update public.jobs set window_missed_at = $2::timestamptz, no_show_at = case when $3::boolean then $2::timestamptz else no_show_at end where id = $1::uuid", [
        job.id, at.toISOString(), noShow,
      ]);
      result.missed += 1;
      const promised = formatDeadline(job.respondBy, at, market.timezone);
      await audit(tx, {
        actor: "system", action: "job.window_missed", entity: "job", entityId: job.id,
        detail: { promised: job.respondBy.toISOString(), status: job.status, no_show: noShow, tradie: tradie?.businessName ?? null },
      });
      if (!noShow) {
        await raiseException(tx, {
          kind: "missed_window", market: job.market, jobId: job.id,
          summary: `Job ${job.number}: no tradie on site at ${property.name} by ${promised}, and nobody has taken it. Nothing is charged unless a tradie does the job.`,
          dedupeKey: `missed_window:${job.id}`,
        });
        return;
      }
      result.noShows += 1;
      await audit(tx, { actor: "system", action: "job.no_show", entity: "job", entityId: job.id, detail: { tradie: tradie?.businessName ?? null, promised: job.respondBy.toISOString() } });
      await raiseException(tx, {
        kind: "no_show", market: job.market, jobId: job.id, tradieId: job.tradieId,
        summary: `Job ${job.number}: ${tradie?.businessName ?? "the tradie"} accepted and is not on site at ${property.name} by ${promised}. Call the tradie${tradie?.phone ? ` on ${tradie.phone}` : ""}.`,
        dedupeKey: `no_show:${job.id}`,
      });
      // The same tradie and owner, or the same tradie, ending accepted jobs without Job done: a pattern to look at (DECISIONS.md, 2026-11-23).
      await notePatterns(tx, job, at);
      const count = await recentNoShows(tx, job.tradieId!, at);
      if (needsReview(count)) {
        await raiseException(tx, {
          kind: "tradie_review", market: job.market, tradieId: job.tradieId,
          summary: `${tradie?.businessName ?? "A tradie"} has not turned up for ${count} accepted jobs in the last ${NO_SHOW_DAYS} days. Talk to them. Nothing has been changed on their account.`,
          dedupeKey: `tradie_review:${job.tradieId}`,
        });
      }
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
        -- Measured from the start of the tradie's window when they chose one, so a job the owner agreed to wait days for is not flagged early.
        and $1::timestamptz >= coalesce(j.arrival_window_start, j.dispatched_at) + (j.respond_by - coalesce(j.arrival_window_start, j.dispatched_at)) * 0.75
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
      where c.status = 'pending'
        -- A missed-promise credit on a job comes off that job's own charge (openSettlement), never the next membership payment.
        and not (c.reason = 'missed_window' and c.job_id is not null)
      order by c.created_at limit 50`,
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
