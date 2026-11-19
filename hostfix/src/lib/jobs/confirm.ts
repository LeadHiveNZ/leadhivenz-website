import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { FLAG_DAYS, TRUSTED_FINISHED_JOBS, tradieTrust } from "@/lib/tradies/reliability";
import { flagWords, type CheckFlag } from "./checks";
import { loadContext } from "./context";
import { lockJob } from "./store";
import type { ConfirmStatus, Job } from "./types";

/**
 * WHO CHECKS A FLAGGED JOB (DECISIONS.md, 2026-11-19). Not the founder, for
 * every job.
 *
 *   no flags          paid automatically, as always.
 *   flagged           the tradie's payment is held, and the owner is asked
 *                     first: the "job done" text links to the job page, which
 *                     shows the before and after photos with two buttons.
 *   "Yes, it's fixed" the payment is released as normal.
 *   "Something's      the dispute path (billing/settle.ts raiseDispute): the
 *    wrong"           payment is paused and the dispatcher is asked.
 *   no answer in      a trusted tradie (10 or more finished jobs, no other flag
 *   48 hours          in 90 days) is paid and the flag is only logged. Anyone
 *                     else goes to the dispatcher's queue to Approve or Hold.
 *
 * Released means the payment is due at its usual time (the market's hold
 * after the job) or now, whichever is later, and only once the owner's card
 * has been charged. Each step changes the job and the payment and writes the
 * audit entry in one database step, and doing it twice changes nothing.
 */

/** The checks still waiting for someone. */
export const PENDING: ConfirmStatus[] = ["waiting", "staff_queue", "staff_held"];

export type ConfirmResult = { ok: true; job: Job } | { ok: false; message: string };

/** Moves a held payment on: due at its usual time or now, once the card has been charged. Returns the amount released. */
async function releaseHeldPayout(db: Db, jobId: string): Promise<number> {
  const at = now();
  const paid = await db.query<{ status: string }>("select status from public.payments where job_id = $1::uuid", [jobId]);
  const ready = !paid[0] || ["succeeded", "part_refunded"].includes(paid[0].status);
  const rows = await db.query<{ amount_cents: number }>(
    `update public.payouts set status = $2, release_at = greatest(release_at, $3::timestamptz)
      where job_id = $1::uuid and status = 'held' returning amount_cents`,
    [jobId, ready ? "scheduled" : "waiting", at.toISOString()],
  );
  return rows[0] ? Number(rows[0].amount_cents) : 0;
}

async function decide(db: Db, job: Job, status: ConfirmStatus, actor: string): Promise<void> {
  await db.query(
    "update public.jobs set confirm_status = $2, confirm_decided_at = $3::timestamptz, confirm_decided_by = $4 where id = $1::uuid",
    [job.id, status, now().toISOString(), actor],
  );
}

/**
 * The owner presses "Yes, it's fixed". The job must be theirs: the owner's
 * own id is checked against the job here, whichever way they opened the page.
 */
export async function confirmFixed(db: Db, jobId: string, ownerId: string, actor: string): Promise<ConfirmResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.ownerId !== ownerId) return { ok: false, message: "We could not find that job." };
    if (job.status !== "completed" || !job.confirmStatus) return { ok: false, message: "There is nothing to confirm on this job." };
    if (job.confirmStatus === "owner_problem") return { ok: false, message: "You have told us something is wrong with this job, and our team is looking into it." };
    if (!PENDING.includes(job.confirmStatus)) return { ok: true, job };
    await decide(tx, job, "owner_confirmed", actor);
    const released = await releaseHeldPayout(tx, job.id);
    await resolveExceptionsFor(tx, job.id, ["job_check"], "The owner confirmed it is fixed");
    await audit(tx, {
      actor, action: "job.owner_confirmed", entity: "job", entityId: job.id, amount: released || null, currency: released ? job.currency : null,
      detail: { flags: job.checkFlags, was: job.confirmStatus, payout_released: released },
    });
    return { ok: true, job: (await lockJob(tx, job.id))! };
  });
}

/** What the dispatcher decides on a flagged job: pay the tradie, or keep holding the payment. */
export async function staffDecideCheck(db: Db, jobId: string, approve: boolean, actor: string, note = ""): Promise<ConfirmResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    if (!job.confirmStatus || !PENDING.includes(job.confirmStatus)) {
      return job.confirmStatus === "owner_problem"
        ? { ok: false, message: "The owner has raised a problem on this job. Settle it in the dispute box instead." }
        : { ok: true, job };
    }
    if (!approve && job.confirmStatus === "staff_held") return { ok: true, job };
    const context = await loadContext(tx, job);
    await decide(tx, job, approve ? "staff_approved" : "staff_held", actor);
    const released = approve ? await releaseHeldPayout(tx, job.id) : 0;
    await resolveExceptionsFor(tx, job.id, ["job_check"], approve ? "Approved: tradie paid" : `Held: ${note.trim() || "the payment stays on hold"}`);
    await audit(tx, {
      actor, action: approve ? "job.check_approved" : "job.check_held", entity: "job", entityId: job.id,
      amount: approve && released ? released : null, currency: approve && released ? job.currency : null,
      detail: { flags: job.checkFlags, note: note.trim() || null, payout_released: released },
    });
    if (!approve && context.tradie?.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "payout_check_held", audience: "tradie", jobId: job.id, userId: context.tradie.userId,
        body: texts.payoutCheckHeld({ number: job.number }), dedupeKey: `payout_check_held:${job.id}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, job.id))! };
  });
}

/**
 * Run by the timer: flagged jobs whose owner has not answered in time.
 * A trusted tradie is paid and the flag is only logged; anyone else goes to
 * the dispatcher's queue for one tap, Approve or Hold.
 */
export async function settleUnansweredChecks(db: Db): Promise<{ released: number; toQueue: number }> {
  const at = now();
  const due = await db.query<{ id: string }>(
    "select id from public.jobs where confirm_status = 'waiting' and confirm_by <= $1::timestamptz order by confirm_by limit 100",
    [at.toISOString()],
  );
  const result = { released: 0, toQueue: 0 };
  for (const row of due) {
    await db.tx(async (tx) => {
      const job = await lockJob(tx, row.id);
      if (!job || job.confirmStatus !== "waiting" || !job.confirmBy || job.confirmBy.getTime() > at.getTime() || !job.tradieId) return;
      const trust = await tradieTrust(tx, job.tradieId, job.id, at);
      const context = await loadContext(tx, job);
      if (trust.trusted) {
        await decide(tx, job, "released_trusted", "system");
        const released = await releaseHeldPayout(tx, job.id);
        await audit(tx, {
          actor: "system", action: "job.check_released", entity: "job", entityId: job.id, amount: released || null, currency: released ? job.currency : null,
          detail: { flags: job.checkFlags, finished_jobs: trust.finishedJobs, other_flags: trust.otherFlags, payout_released: released },
        });
        result.released += 1;
        return;
      }
      await decide(tx, job, "staff_queue", "system");
      const why = (job.checkFlags as CheckFlag[]).map((flag) => flagWords(flag, {
        arrivalM: job.arrivalDistanceM, finishM: job.finishDistanceM, minutes: job.minutesOnSite, minMinutes: context.market.minMinutesOnSite,
      })).join(" ");
      const record = trust.finishedJobs < TRUSTED_FINISHED_JOBS
        ? `${trust.finishedJobs} finished ${trust.finishedJobs === 1 ? "job" : "jobs"} so far, under the ${TRUSTED_FINISHED_JOBS} that makes a tradie trusted`
        : `${trust.otherFlags} other flagged ${trust.otherFlags === 1 ? "job" : "jobs"} in the last ${FLAG_DAYS} days`;
      await audit(tx, {
        actor: "system", action: "job.check_to_staff", entity: "job", entityId: job.id,
        detail: { flags: job.checkFlags, finished_jobs: trust.finishedJobs, other_flags: trust.otherFlags },
      });
      await raiseException(tx, {
        kind: "job_check", market: job.market, jobId: job.id, tradieId: job.tradieId,
        summary: `Job ${job.number} at ${context.property.name}: ${why} The owner did not answer within ${context.market.ownerConfirmHours} hours, and ${context.tradie?.businessName ?? "the tradie"} has ${record}. Look at the photos, then Approve or Hold the payment.`,
        dedupeKey: `job_check:${job.id}`,
      });
      result.toQueue += 1;
    });
  }
  return result;
}
