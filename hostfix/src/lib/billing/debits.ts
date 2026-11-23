import type { CountryCode } from "@config/markets";
import { addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { depositOutcome } from "@/lib/jobs/work";
import type { DebitResult } from "@/lib/payments/gateway";
import { jobDebitOutcome, type GatewayFor } from "./settle";

/**
 * BANK DEBITS FINISHING (DECISIONS.md, 2026-11-23, second entry).
 *
 * Big work is paid by NZ BECS Direct Debit from the owner's bank account: a 50% deposit when the owner approves it,
 * and the rest of the job at Job done. A debit is "processing" for a few working days, then clears or fails. Stripe
 * says which with a message (payment_intent.succeeded, payment_intent.payment_failed: src/lib/payments/product-events.ts);
 * the timer also asks about any debit still processing, once an hour, in case a message never arrives (and it is the
 * only way the demo's pretend debits finish). Both end up here, and both are safe to repeat.
 */

/** How often the timer asks about a debit that is still processing. */
export const DEBIT_CHECK_MINUTES = 60;

/** A debit has an answer: the deposit or the job's payment it belongs to moves on. */
export async function settleDebit(db: Db, paymentIntentId: string, result: DebitResult): Promise<"deposit" | "job" | "nothing"> {
  const deposit = await db.query<{ id: string }>("select id from public.job_prepayments where payment_intent_id = $1 and status = 'processing'", [paymentIntentId]);
  if (deposit[0]) {
    await depositOutcome(db, deposit[0].id, result);
    return "deposit";
  }
  const payment = await db.query<{ id: string }>(
    "select id from public.payments where status = 'processing' and (payment_intent_id = $1 or extra_payment_intent_id = $1)",
    [paymentIntentId],
  );
  if (payment[0]) {
    await jobDebitOutcome(db, payment[0].id, result);
    return "job";
  }
  return "nothing";
}

/** Run by the timer: asks the payment company about every debit still processing that has not been asked about for an hour. */
export async function checkDebits(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const before = addMinutes(now(), -DEBIT_CHECK_MINUTES).toISOString();
  const rows = await db.query<{ intent: string; country: CountryCode }>(
    `select x.payment_intent_id as intent, m.country from public.job_prepayments x
       join public.jobs j on j.id = x.job_id join public.markets m on m.slug = j.market
      where x.status = 'processing' and x.payment_intent_id is not null and (x.checked_at is null or x.checked_at <= $1::timestamptz)
     union all
     select case when p.hold_captured_cents > 0 and p.extra_payment_intent_id is not null then p.extra_payment_intent_id else p.payment_intent_id end, m.country
       from public.payments p join public.jobs j on j.id = p.job_id join public.markets m on m.slug = j.market
      where p.status = 'processing' and (p.checked_at is null or p.checked_at <= $1::timestamptz)
      limit 50`,
    [before],
  );
  let moved = 0;
  for (const row of rows) {
    const gateway = gatewayFor(row.country);
    if (!gateway || !row.intent) continue;
    let result: DebitResult;
    try {
      result = await gateway.debitStatus(row.intent);
    } catch {
      // Could not ask just now: the next run tries again.
      continue;
    }
    if (result.status === "processing") {
      await db.query("update public.job_prepayments set checked_at = $2::timestamptz where payment_intent_id = $1 and status = 'processing'", [row.intent, now().toISOString()]);
      await db.query("update public.payments set checked_at = $2::timestamptz where status = 'processing' and (payment_intent_id = $1 or extra_payment_intent_id = $1)", [row.intent, now().toISOString()]);
      continue;
    }
    if ((await settleDebit(db, row.intent, result)) !== "nothing") moved += 1;
  }
  return moved;
}
