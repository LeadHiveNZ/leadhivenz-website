import { audit } from "@/lib/audit";
import { releaseIfClear } from "@/lib/billing/holds";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { loadContext } from "./context";
import { lockJob, recalcTotals } from "./store";
import type { Job } from "./types";

/**
 * "NOT THE JOB DESCRIBED" (DECISIONS.md, 2026-11-20, third entry).
 *
 * On a menu job, a quote is for work beyond the job described: the tradie
 * still does the described job at the menu price. When what they find is not
 * the job described at all, they say so (menu jobs only), with at least one
 * photo and a one-line reason, and a quote (submitQuote in work.ts). The menu
 * price comes off and the call-out goes on. The call-out:
 *
 *   is paid       when the owner approves the quote, or does not object within
 *                 the market's not_described_hours (24) of the tap
 *   is decided    by the team from the photos when the owner presses "This was
 *                 the job I described": Pay call-out or No call-out
 *
 * Until then the tradie's payment is held (billing/holds.ts) and the owner is
 * not charged (chargeJob, billing/settle.ts). Off-menu (diagnosis) jobs are
 * unchanged.
 */

export const UNSETTLED = ["waiting", "owner_objects"] as const;

export function notDescribedUnsettled(job: Pick<Job, "notDescribedStatus">): boolean {
  return job.notDescribedStatus === "waiting" || job.notDescribedStatus === "owner_objects";
}

export type NotDescribedResult = { ok: true; job: Job } | { ok: false; message: string };

/** The owner presses "This was the job I described". Only while the window is open. */
export async function ownerObjects(db: Db, jobId: string, actor: string): Promise<NotDescribedResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || !job.notDescribedAt) return { ok: false, message: "We could not find that job." };
    if (job.notDescribedStatus === "owner_objects") return { ok: true, job };
    if (job.notDescribedStatus !== "waiting" || (job.notDescribedBy && job.notDescribedBy.getTime() <= now().getTime())) {
      return { ok: false, message: "This has already been settled. If something is wrong, contact us." };
    }
    await tx.query("update public.jobs set not_described_status = 'owner_objects' where id = $1::uuid", [jobId]);
    await audit(tx, { actor, action: "job.not_described_objected", entity: "job", entityId: jobId, detail: { reason: job.notDescribedReason } });
    await raiseException(tx, {
      kind: "not_described", market: job.market, jobId, tradieId: job.tradieId,
      summary: `Job ${job.number}: the tradie said it was not the job described ("${job.notDescribedReason ?? ""}"). The owner says it was. Look at the photos and decide: Pay call-out or No call-out.`,
      dedupeKey: `not_described:${jobId}`,
    });
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/** The team's one tap, from the photos. */
export async function staffDecideNotDescribed(db: Db, jobId: string, pay: boolean, actor: string): Promise<NotDescribedResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || !job.notDescribedAt) return { ok: false, message: "We could not find that job." };
    if (!notDescribedUnsettled(job)) return { ok: false, message: "This has already been settled." };
    const context = await loadContext(tx, job);
    const { market } = context;
    await tx.query("update public.jobs set not_described_status = $2 where id = $1::uuid", [jobId, pay ? "staff_paid" : "staff_no_callout"]);
    const callout = (await tx.query<{ owner_cents: number; tradie_cents: number }>(
      "select owner_cents, tradie_cents from public.job_lines where job_id = $1::uuid and kind = 'diagnosis' and status = 'active' limit 1",
      [jobId],
    ))[0];
    if (!pay) {
      // No call-out: nothing for the visit, on either side. Whatever else was approved stays.
      await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and kind = 'diagnosis' and status = 'active'", [jobId]);
      const sum = await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
      if (job.status === "completed") {
        // Not charged yet (held for this decision), so the charge and the payment are simply made smaller.
        if (sum.ownerCents > 0) await tx.query("update public.payments set amount_cents = $2, tax_cents = $3 where job_id = $1::uuid and status = 'pending'", [jobId, sum.ownerCents, sum.taxCents]);
        else await tx.query("delete from public.payments where job_id = $1::uuid and status = 'pending'", [jobId]);
        if (sum.tradieCents > 0) await tx.query("update public.payouts set amount_cents = $2 where job_id = $1::uuid and status = 'held'", [jobId, sum.tradieCents]);
        else await tx.query("update public.payouts set status = 'cancelled' where job_id = $1::uuid and status = 'held'", [jobId]);
      }
    }
    await resolveExceptionsFor(tx, jobId, ["not_described"], pay ? "Call-out paid" : "No call-out");
    await audit(tx, {
      actor, action: pay ? "job.callout_paid" : "job.callout_refused", entity: "job", entityId: jobId,
      amount: Number(callout?.owner_cents ?? 0), currency: job.currency, detail: { tradie_cents: Number(callout?.tradie_cents ?? 0) },
    });
    await releaseIfClear(tx, jobId);
    if (context.tradie?.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "callout_decided", audience: "tradie", jobId, userId: context.tradie.userId,
        body: texts.calloutDecided({ number: job.number, paid: pay, amountCents: Number(callout?.tradie_cents ?? market.diagnosisPayoutCents), currency: job.currency }),
        dedupeKey: `callout_decided:${jobId}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/** For the timer: a call-out nobody objected to in time is paid. */
export async function settleNotDescribed(db: Db): Promise<number> {
  const due = await db.query<{ id: string }>(
    "select id from public.jobs where not_described_status = 'waiting' and not_described_by <= $1::timestamptz limit 100",
    [now().toISOString()],
  );
  let settled = 0;
  for (const row of due) {
    const done = await db.tx(async (tx) => {
      const updated = await tx.query("update public.jobs set not_described_status = 'no_objection' where id = $1::uuid and not_described_status = 'waiting' returning id", [row.id]);
      if (updated.length === 0) return false;
      await audit(tx, { actor: "system", action: "job.callout_no_objection", entity: "job", entityId: row.id, detail: {} });
      await releaseIfClear(tx, row.id);
      return true;
    });
    if (done) settled += 1;
  }
  return settled;
}
