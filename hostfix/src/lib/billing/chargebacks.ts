import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { loadContext } from "@/lib/jobs/context";
import { getJobForStaff } from "@/lib/jobs/store";
import { formatMoney } from "@/lib/money";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";

/**
 * CHARGEBACKS AND DIRECT-DEBIT DISPUTES (DECISIONS.md, 2026-11-20, second entry).
 *
 *   opened    Stripe's charge.dispute.created: the tradie's payment is paused if it
 *             has not gone, the team is alerted, and the job page has an evidence
 *             pack (photos, times, locations, receipts, messages) to answer it.
 *   closed    Stripe's charge.dispute.closed: won (or an inquiry closed, or
 *             prevented): the payment goes on as normal. Lost: the team decides,
 *             with one tap, whose fault it was.
 *   tradie's  bad work or a no-show: a payment not yet sent is cancelled; one
 *   fault     already sent becomes a balance the tradie owes, taken from their
 *             later payments, never more than half of any one (releasePayout,
 *             billing/settle.ts). The tradie is texted.
 *   not the   HostFix carries the loss; the tradie is paid as normal.
 *   tradie's
 *
 * From Stripe's API reference (read November 2026): a dispute's status is one of
 * warning_needs_response, warning_under_review, warning_closed, needs_response,
 * under_review, appeal_needs_response, appeal_under_review, won, lost or
 * prevented; charge.dispute.closed "occurs when a dispute is closed and the
 * dispute status changes to lost, warning_closed, or won".
 */

export type Chargeback = {
  id: string; createdAt: Date; disputeId: string; jobId: string | null; amountCents: number; currency: string; reason: string;
  status: "open" | "won" | "lost"; closedAt: Date | null; fault: "tradie" | "not_tradie" | null; decidedAt: Date | null; decidedBy: string | null;
};

type Row = {
  id: string; created_at: Date; dispute_id: string; job_id: string | null; amount_cents: number; currency: string; reason: string;
  status: Chargeback["status"]; closed_at: Date | null; fault: Chargeback["fault"]; decided_at: Date | null; decided_by: string | null;
};

const toChargeback = (row: Row): Chargeback => ({
  id: row.id, createdAt: new Date(row.created_at), disputeId: row.dispute_id, jobId: row.job_id, amountCents: Number(row.amount_cents), currency: row.currency,
  reason: row.reason, status: row.status, closedAt: row.closed_at ? new Date(row.closed_at) : null, fault: row.fault,
  decidedAt: row.decided_at ? new Date(row.decided_at) : null, decidedBy: row.decided_by,
});

export async function chargebacksForJob(db: Db, jobId: string): Promise<Chargeback[]> {
  const rows = await db.query<Row>("select * from public.chargebacks where job_id = $1::uuid order by created_at", [jobId]);
  return rows.map(toChargeback);
}

/** Writes down a new chargeback. Safe to call twice. */
export async function recordChargeback(db: Db, input: { disputeId: string; jobId: string | null; amountCents: number; currency: string; reason: string }): Promise<void> {
  await db.query(
    `insert into public.chargebacks (created_at, dispute_id, job_id, amount_cents, currency, reason) values ($1::timestamptz, $2, $3::uuid, $4, $5, $6)
     on conflict (dispute_id) do nothing`,
    [now().toISOString(), input.disputeId, input.jobId, input.amountCents, input.currency.toUpperCase(), input.reason],
  );
}

/** Stripe says the dispute is over. `status` is Stripe's own word for it. */
export async function closeChargeback(db: Db, disputeId: string, status: string): Promise<"won" | "lost" | "unknown" | "already"> {
  return db.tx(async (tx) => {
    const rows = await tx.query<Row>("select * from public.chargebacks where dispute_id = $1 for update", [disputeId]);
    const chargeback = rows[0] ? toChargeback(rows[0]) : null;
    if (!chargeback) return "unknown";
    if (chargeback.status !== "open") return "already";
    const outcome = status === "lost" ? "lost" : "won";
    await tx.query("update public.chargebacks set status = $2, closed_at = $3::timestamptz where id = $1::uuid", [chargeback.id, outcome, now().toISOString()]);
    await audit(tx, { actor: "stripe", action: `chargeback.${outcome}`, entity: "job", entityId: chargeback.jobId ?? chargeback.disputeId, amount: chargeback.amountCents, currency: chargeback.currency, detail: { dispute: disputeId, stripe_status: status } });
    if (!chargeback.jobId) return outcome;
    await resolveExceptionsFor(tx, chargeback.jobId, ["chargeback"], outcome === "won" ? "Won: the payment stands" : "Lost: decide whose fault");
    if (outcome === "won") {
      await resumePaused(tx, chargeback.jobId);
      return outcome;
    }
    const job = await getJobForStaff(tx, chargeback.jobId);
    await raiseException(tx, {
      kind: "chargeback_lost", market: job?.market ?? null, jobId: chargeback.jobId, tradieId: job?.tradieId ?? null,
      summary: `Job ${job?.number ?? ""}: the owner's bank kept the ${formatMoney(chargeback.amountCents, chargeback.currency)} (${chargeback.reason.replace(/_/g, " ")}). Decide on the job page: the tradie's fault (bad work, a no-show) or not.`,
      dedupeKey: `chargeback_lost:${chargeback.id}`,
    });
    return outcome;
  });
}

/** A payout paused for the chargeback goes on as normal, unless an owner's problem is still open on the job. */
async function resumePaused(db: Db, jobId: string): Promise<void> {
  const open = await db.query("select 1 from public.disputes where job_id = $1::uuid and status = 'open'", [jobId]);
  if (open.length > 0) return;
  await db.query("update public.payouts set status = 'scheduled', release_at = greatest(release_at, $2::timestamptz) where job_id = $1::uuid and status = 'paused'", [jobId, now().toISOString()]);
}

export type FaultResult = { ok: true; owedCents: number; cancelledCents: number } | { ok: false; message: string };

/** The team's one tap on a lost chargeback. */
export async function decideChargebackFault(db: Db, chargebackId: string, fault: "tradie" | "not_tradie", actor: string): Promise<FaultResult> {
  return db.tx(async (tx) => {
    const rows = await tx.query<Row>("select * from public.chargebacks where id = $1::uuid for update", [chargebackId]);
    const chargeback = rows[0] ? toChargeback(rows[0]) : null;
    if (!chargeback || !chargeback.jobId) return { ok: false, message: "We could not find that chargeback." };
    if (chargeback.status !== "lost") return { ok: false, message: "This is only decided once the chargeback is lost." };
    if (chargeback.fault) return { ok: true, owedCents: 0, cancelledCents: 0 };
    const job = await getJobForStaff(tx, chargeback.jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    const at = now();
    await tx.query("update public.chargebacks set fault = $2, decided_at = $3::timestamptz, decided_by = $4 where id = $1::uuid", [chargeback.id, fault, at.toISOString(), actor]);
    let owedCents = 0;
    let cancelledCents = 0;
    const payout = (await tx.query<{ id: string; status: string; amount_cents: number; deducted_cents: number; tradie_id: string }>(
      "select id, status, amount_cents, deducted_cents, tradie_id from public.payouts where job_id = $1::uuid for update",
      [job.id],
    ))[0];
    if (fault === "tradie" && payout) {
      if (payout.status === "sent") {
        // What the tradie actually received for this job, and never more than the bank took back.
        owedCents = Math.min(payout.amount_cents - Number(payout.deducted_cents ?? 0), chargeback.amountCents);
        if (owedCents > 0) {
          await tx.query(
            `insert into public.tradie_balances (created_at, tradie_id, job_id, chargeback_id, reason, amount_cents, currency) values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7)`,
            [at.toISOString(), payout.tradie_id, job.id, chargeback.id, `Chargeback lost on job ${job.number}: the tradie's fault`, owedCents, job.currency],
          );
        }
      } else if (["paused", "held", "scheduled", "waiting"].includes(payout.status)) {
        cancelledCents = payout.amount_cents;
        await tx.query("update public.payouts set status = 'cancelled' where id = $1::uuid", [payout.id]);
      }
    } else if (fault === "not_tradie") {
      await resumePaused(tx, job.id);
    }
    await resolveExceptionsFor(tx, job.id, ["chargeback_lost"], fault === "tradie" ? "The tradie's fault" : "Not the tradie's fault: HostFix carries it");
    await audit(tx, {
      actor, action: "chargeback.fault_decided", entity: "job", entityId: job.id, amount: owedCents || cancelledCents || chargeback.amountCents, currency: job.currency,
      detail: { fault, owed: owedCents, payout_cancelled: cancelledCents, carried_by_hostfix: fault === "not_tradie" ? chargeback.amountCents : 0 },
    });
    if (fault === "tradie" && owedCents > 0) {
      const context = await loadContext(tx, job);
      if (context.tradie?.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.tradie.phone, template: "balance_owed", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
          body: texts.balanceOwed({ number: job.number, amountCents: owedCents, currency: job.currency }), dedupeKey: `balance_owed:${chargeback.id}`,
        });
      }
    }
    return { ok: true, owedCents, cancelledCents };
  });
}

/** What a tradie still owes, for their Pay page and the admin. */
export async function balanceOwed(db: Db, tradieId: string): Promise<number> {
  const rows = await db.query<{ owed: number }>("select coalesce(sum(amount_cents - recovered_cents), 0) as owed from public.tradie_balances where tradie_id = $1::uuid and status = 'open'", [tradieId]);
  return Number(rows[0]?.owed ?? 0);
}
