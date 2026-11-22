import { audit } from "@/lib/audit";
import { addHours, addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { loadContext } from "@/lib/jobs/context";
import { lockJob } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { getMarket } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException } from "@/lib/ops/exceptions";
import { getBilling } from "@/lib/owners/service";
import type { CountryCode } from "@config/markets";
import type { PaymentsGateway, Provider } from "@/lib/payments/gateway";

/**
 * A HOLD ON THE OWNER'S CARD (DECISIONS.md, 2026-11-23).
 *
 *   sending a job out   a hold for the job's known price goes on the owner's
 *                       saved card: the menu price with GST and any surcharge
 *                       known then, or for off-menu work the call-out. Nothing
 *                       is charged. A declined hold is a card problem: the job
 *                       is not sent out (src/lib/jobs/create.ts).
 *   keeping it alive    a card network lets a hold go after about 7 days (4
 *                       days 18 hours for a Visa payment the merchant starts).
 *                       Before that, on a job still open, a fresh hold is placed
 *                       and the old one let go. A visit further away than a
 *                       hold can last gets its hold a day before the visit.
 *   cancelled before    the hold is let go: the owner pays nothing.
 *     Arrived
 *   settled             the job's charge is taken from the hold, up to the
 *                       held amount; anything beyond it is a second, separate
 *                       charge (chargeJob, src/lib/billing/settle.ts).
 *
 * Like every money step: claim it in one database step, ask the payment
 * company with a key that makes a repeat harmless, write down what happened.
 */

/** The shortest a hold lasts: a Visa payment the merchant starts, 4 days 18 hours. Used when the card company does not say. */
export const HOLD_VALID_HOURS = 4 * 24 + 18;
/** A hold due to run out within this many hours, on a job still open, is replaced. */
export const HOLD_REFRESH_HOURS = 12;
/** A visit further away than a fresh hold would last gets its hold this many hours before it. */
export const HOLD_LEAD_HOURS = 24;

const OPEN = ["offering", "unfilled", "accepted", "on_site", "awaiting_approval"];

export type HoldStatus = "placing" | "held" | "declined" | "cancel_due" | "cancelled" | "captured" | "expired";

export type CardHold = {
  id: string;
  createdAt: Date;
  jobId: string;
  seq: number;
  reason: "booking" | "refresh" | "scheduled";
  amountCents: number;
  currency: string;
  status: HoldStatus;
  provider: Provider | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  captureBefore: Date | null;
  capturedCents: number;
  lastError: string | null;
};

type HoldRow = {
  id: string; created_at: Date; job_id: string; seq: number; reason: CardHold["reason"]; amount_cents: number; currency: string; status: HoldStatus;
  provider: Provider | null; payment_intent_id: string | null; charge_id: string | null; capture_before: Date | null; captured_cents: number;
  claimed_until: Date | null; last_error: string | null;
};

const rowToHold = (row: HoldRow): CardHold => ({
  id: row.id, createdAt: new Date(row.created_at), jobId: row.job_id, seq: Number(row.seq), reason: row.reason, amountCents: Number(row.amount_cents),
  currency: row.currency, status: row.status, provider: row.provider, paymentIntentId: row.payment_intent_id, chargeId: row.charge_id,
  captureBefore: row.capture_before ? new Date(row.capture_before) : null, capturedCents: Number(row.captured_cents), lastError: row.last_error,
});

type GatewayFor = (country: CountryCode) => PaymentsGateway | null;

export async function listHolds(db: Db, jobId: string): Promise<CardHold[]> {
  const rows = await db.query<HoldRow>("select * from public.card_holds where job_id = $1::uuid order by seq", [jobId]);
  return rows.map(rowToHold);
}

/** The hold on the card for this job now, if there is one. */
export async function liveHold(db: Db, jobId: string): Promise<CardHold | null> {
  const rows = await db.query<HoldRow>("select * from public.card_holds where job_id = $1::uuid and status = 'held' order by seq desc limit 1", [jobId]);
  return rows[0] ? rowToHold(rows[0]) : null;
}

/** The amount a job's hold is for: the price known when it goes out (menu price and surcharges, or the call-out). */
export function holdAmount(job: Pick<Job, "ownerTotalCents">): number {
  return Math.max(0, job.ownerTotalCents);
}

export type PlaceOutcome =
  | { outcome: "held"; hold: CardHold }
  | { outcome: "declined"; reason: string }
  /** Nothing to hold: the job costs the owner nothing, or it is closed. */
  | { outcome: "not_needed" }
  /** Card payments are not set up for this country, so there is nothing to hold with (the job goes out as before). */
  | { outcome: "no_payments" }
  /** Another server is placing this hold right now, or the payment company's answer was unclear: tried again later with the same key. */
  | { outcome: "pending"; reason: string };

/**
 * Places a hold for the job's known price on the owner's saved card. Safe to call twice: a booking hold already on
 * the card is returned as it is, and a hold being placed is never placed twice (the same key every try).
 */
export async function placeHold(db: Db, gatewayFor: GatewayFor, jobId: string, reason: CardHold["reason"]): Promise<PlaceOutcome> {
  const claim = await db.tx(async (tx) => {
    const at = now();
    const job = await lockJob(tx, jobId);
    if (!job || job.status === "completed" || job.status === "cancelled") return { done: { outcome: "not_needed" } as PlaceOutcome };
    const amount = holdAmount(job);
    if (amount <= 0) return { done: { outcome: "not_needed" } as PlaceOutcome };
    const market = await getMarket(tx, job.market);
    if (!market) return { done: { outcome: "not_needed" } as PlaceOutcome };
    const holds = (await tx.query<HoldRow>("select * from public.card_holds where job_id = $1::uuid order by seq for update", [jobId])).map((row, i, all) => ({ hold: rowToHold(row), claimedUntil: all[i]!.claimed_until }));
    const placing = holds.find((entry) => entry.hold.status === "placing");
    if (placing && placing.claimedUntil && new Date(placing.claimedUntil).getTime() > at.getTime()) {
      return { done: { outcome: "pending", reason: "The hold is being placed right now." } as PlaceOutcome };
    }
    const held = holds.filter((entry) => entry.hold.status === "held").at(-1);
    if (reason === "booking" && held && !placing) return { done: { outcome: "held", hold: held.hold } as PlaceOutcome };
    const gateway = gatewayFor(market.country);
    if (!gateway) {
      if (placing) await tx.query("delete from public.card_holds where id = $1::uuid and status = 'placing'", [placing.hold.id]);
      return { done: { outcome: "no_payments" } as PlaceOutcome };
    }
    let hold: CardHold;
    if (placing) {
      // A try that was cut off: the same row, the same amount and the same key, so the payment company hands back the same hold.
      hold = placing.hold;
    } else {
      const seq = (holds.at(-1)?.hold.seq ?? 0) + 1;
      const rows = await tx.query<HoldRow>(
        `insert into public.card_holds (created_at, job_id, owner_id, seq, reason, amount_cents, currency, status, provider)
         values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5, $6, $7, 'placing', $8) returning *`,
        [at.toISOString(), jobId, job.ownerId, seq, reason, amount, job.currency, gateway.provider],
      );
      hold = rowToHold(rows[0]!);
    }
    await tx.query("update public.card_holds set claimed_until = $2::timestamptz where id = $1::uuid", [hold.id, addMinutes(at, 2).toISOString()]);
    const billing = await getBilling(tx, job.ownerId, market.country);
    const context = await loadContext(tx, job);
    return { hold, job, billing, gateway, property: context.property.name };
  });
  if ("done" in claim) return claim.done!;
  const { hold, job, billing, gateway, property } = claim;

  let result: Awaited<ReturnType<PaymentsGateway["placeHold"]>> | null = null;
  let unclear: string | null = null;
  if (!billing || billing.provider !== gateway.provider) {
    result = { status: "declined", reason: "The owner has no card on file.", code: "no_card", paymentIntentId: null };
  } else {
    try {
      result = await gateway.placeHold({
        customerId: billing.customerId, paymentMethodId: billing.paymentMethodId, amountCents: hold.amountCents, currency: hold.currency,
        description: `Hold for job ${job.number}: ${job.title} at ${property}`.slice(0, 200), jobNumber: job.number,
        idempotencyKey: `hostfix-job-${jobId}-hold-${hold.seq}`,
      });
    } catch (error) {
      unclear = error instanceof Error ? error.message : String(error);
    }
  }

  return db.tx(async (tx) => {
    const at = now();
    if (!result) {
      // The answer was unclear (a timeout, a server error): the hold may exist. It stays "placing" and is asked for again with the same key.
      await tx.query("update public.card_holds set claimed_until = null, last_error = $2 where id = $1::uuid and status = 'placing'", [hold.id, (unclear ?? "").slice(0, 500)]);
      return { outcome: "pending", reason: unclear ?? "No answer from the payment company." };
    }
    if (result.status === "held") {
      const fresh = await lockJob(tx, jobId);
      // Cancelled while the hold was being placed: let it go at once.
      const closed = !fresh || fresh.status === "cancelled" || fresh.status === "completed";
      await tx.query(
        `update public.card_holds set status = $2, payment_intent_id = $3, charge_id = $4, capture_before = $5::timestamptz, claimed_until = null, last_error = null
          where id = $1::uuid`,
        [hold.id, closed ? "cancel_due" : "held", result.paymentIntentId, result.chargeId, (result.captureBefore ?? addHours(at, HOLD_VALID_HOURS)).toISOString()],
      );
      await audit(tx, {
        actor: gateway.provider, action: "hold.placed", entity: "job", entityId: jobId, amount: hold.amountCents, currency: hold.currency,
        detail: { hold: hold.id, seq: hold.seq, reason: hold.reason, payment_intent: result.paymentIntentId, capture_before: (result.captureBefore ?? addHours(at, HOLD_VALID_HOURS)).toISOString() },
        dedupeKey: `hold.placed:${hold.id}`,
      });
      const saved = (await tx.query<HoldRow>("select * from public.card_holds where id = $1::uuid", [hold.id]))[0]!;
      return { outcome: "held", hold: rowToHold(saved) };
    }
    await tx.query("update public.card_holds set status = 'declined', payment_intent_id = $2, claimed_until = null, last_error = $3 where id = $1::uuid", [
      hold.id, result.paymentIntentId, result.reason.slice(0, 500),
    ]);
    await audit(tx, {
      actor: gateway.provider, action: "hold.declined", entity: "job", entityId: jobId, amount: hold.amountCents, currency: hold.currency,
      detail: { hold: hold.id, seq: hold.seq, reason: result.reason, code: result.code }, dedupeKey: `hold.declined:${hold.id}`,
    });
    return { outcome: "declined", reason: result.reason };
  });
}

/**
 * Marks every hold on a job to be let go (inside the caller's database step): the job was cancelled before the
 * tradie arrived, or its charge has been taken from another hold. The payment company is asked by
 * cancelDueHolds, straight after or on the next timer run.
 */
export async function releaseJobHolds(db: Db, jobId: string, why: string, actor = "system"): Promise<number> {
  const rows = await db.query<{ id: string; amount_cents: number; currency: string }>(
    "update public.card_holds set status = 'cancel_due' where job_id = $1::uuid and status = 'held' returning id, amount_cents, currency",
    [jobId],
  );
  await db.query("update public.jobs set hold_due_at = null where id = $1::uuid and hold_due_at is not null", [jobId]);
  for (const row of rows) {
    await audit(db, { actor, action: "hold.release_due", entity: "job", entityId: jobId, amount: Number(row.amount_cents), currency: row.currency, detail: { hold: row.id, why } });
  }
  return rows.length;
}

/** Lets go of holds marked to be let go. Nothing is charged, and it costs nothing. Run straight after a cancel, and by the timer. */
export async function cancelDueHolds(db: Db, gatewayFor: GatewayFor, jobId?: string): Promise<number> {
  const at = now();
  const due = await db.query<{ id: string }>(
    `select h.id from public.card_holds h
      where h.status = 'cancel_due' and (h.claimed_until is null or h.claimed_until <= $1::timestamptz) and ($2::uuid is null or h.job_id = $2::uuid)
      order by h.created_at limit 50`,
    [at.toISOString(), jobId ?? null],
  );
  let cancelled = 0;
  for (const row of due) {
    const claim = await db.tx(async (tx) => {
      const found = (await tx.query<HoldRow & { country: CountryCode }>(
        `select h.*, m.country from public.card_holds h join public.jobs j on j.id = h.job_id join public.markets m on m.slug = j.market
          where h.id = $1::uuid and h.status = 'cancel_due' for update of h`,
        [row.id],
      ))[0];
      if (!found || (found.claimed_until && new Date(found.claimed_until).getTime() > now().getTime())) return null;
      await tx.query("update public.card_holds set claimed_until = $2::timestamptz where id = $1::uuid", [row.id, addMinutes(now(), 2).toISOString()]);
      return found;
    });
    if (!claim) continue;
    const gateway = gatewayFor(claim.country);
    let failure: string | null = null;
    if (claim.payment_intent_id && gateway) {
      try {
        await gateway.cancelHold({ paymentIntentId: claim.payment_intent_id, idempotencyKey: `hostfix-hold-${claim.id}-cancel` });
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
    }
    await db.tx(async (tx) => {
      if (failure) {
        await tx.query("update public.card_holds set claimed_until = null, last_error = $2 where id = $1::uuid", [claim.id, failure.slice(0, 500)]);
        return;
      }
      await tx.query("update public.card_holds set status = 'cancelled', cancelled_at = $2::timestamptz, claimed_until = null where id = $1::uuid and status = 'cancel_due'", [claim.id, now().toISOString()]);
      await audit(tx, {
        actor: gateway?.provider ?? "system", action: "hold.cancelled", entity: "job", entityId: claim.job_id, amount: Number(claim.amount_cents), currency: claim.currency,
        detail: { hold: claim.id, payment_intent: claim.payment_intent_id }, dedupeKey: `hold.cancelled:${claim.id}`,
      });
    });
    if (!failure) cancelled += 1;
  }
  return cancelled;
}

/** The owner is told a hold on an open job could not be renewed, and the team is asked to ring them. The job stays booked. */
async function holdNotRenewed(db: Db, jobId: string, reason: string): Promise<void> {
  await db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return;
    const context = await loadContext(tx, job);
    const fresh = await raiseException(tx, {
      kind: "hold_failed", market: job.market, jobId,
      summary: `Job ${job.number} at ${context.property.name}: the owner's card was declined when we renewed the hold on it (${reason}). The job is still booked${context.tradie ? ` with ${context.tradie.businessName}` : ""}. Ask ${context.owner.name} to update their card${context.owner.phone ? ` (${context.owner.phone})` : ""}; a new card is tried by itself.`,
      dedupeKey: `hold_failed:${jobId}`,
    });
    if (fresh && context.owner.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "hold_failed", audience: "owner", jobId, userId: context.owner.userId,
        body: texts.holdRenewFailed({ number: job.number, link: `${baseUrl()}/app/billing` }), dedupeKey: `hold_failed:${jobId}:${now().getTime()}`,
      });
    }
  });
}

/** True when the last hold tried on this job was declined and the owner has not saved a card since. Stops a retry every minute. */
async function declinedSinceCard(db: Db, jobId: string): Promise<boolean> {
  const rows = await db.query<{ status: string; created_at: Date; updated_at: Date | null }>(
    `select h.status, h.created_at, b.updated_at
       from public.card_holds h join public.jobs j on j.id = h.job_id join public.markets m on m.slug = j.market
       left join public.owner_billing b on b.owner_id = j.owner_id and b.country = m.country
      where h.job_id = $1::uuid order by h.seq desc limit 1`,
    [jobId],
  );
  const last = rows[0];
  if (!last || last.status !== "declined") return false;
  return !(last.updated_at && new Date(last.updated_at).getTime() > new Date(last.created_at).getTime());
}

/**
 * Run by the timer: keeps a hold on every open job until it is settled.
 *   - a hold whose time has passed is marked expired (the job's charge then goes to the card the usual way);
 *   - a hold running out within 12 hours is replaced by a fresh one, then let go; for a visit further off than a
 *     fresh hold would last, it is let go and a new one is placed a day before the visit;
 *   - a hold due a day before a far-off visit is placed;
 *   - holds marked to be let go are let go.
 */
export async function keepHoldsAlive(db: Db, gatewayFor: GatewayFor): Promise<{ renewed: number; scheduled: number; placed: number; expired: number; released: number }> {
  const at = now();
  const report = { renewed: 0, scheduled: 0, placed: 0, expired: 0, released: 0 };

  const expired = await db.query<{ id: string; job_id: string; amount_cents: number; currency: string }>(
    "update public.card_holds set status = 'expired' where status = 'held' and capture_before <= $1::timestamptz returning id, job_id, amount_cents, currency",
    [at.toISOString()],
  );
  for (const row of expired) {
    await audit(db, { actor: "system", action: "hold.expired", entity: "job", entityId: row.job_id, amount: Number(row.amount_cents), currency: row.currency, detail: { hold: row.id } });
  }
  report.expired = expired.length;

  const ending = await db.query<{ job_id: string }>(
    `select distinct h.job_id from public.card_holds h join public.jobs j on j.id = h.job_id
      where h.status = 'held' and h.capture_before <= $1::timestamptz and j.status = any($2::text[]) and j.hold_due_at is null
      limit 50`,
    [addHours(at, HOLD_REFRESH_HOURS).toISOString(), OPEN],
  );
  for (const row of ending) {
    if (await declinedSinceCard(db, row.job_id)) continue;
    const job = await lockJob(db, row.job_id);
    if (!job) continue;
    const visit = job.arrivalWindowStart ?? job.respondBy;
    if (visit && visit.getTime() > addHours(at, HOLD_VALID_HOURS - HOLD_REFRESH_HOURS).getTime()) {
      // A visit further away than a fresh hold would last: let this one go and hold again a day before the visit.
      const due = addHours(visit, -HOLD_LEAD_HOURS);
      await db.tx(async (tx) => {
        await releaseJobHolds(tx, job.id, "The visit is further away than a hold lasts: held again a day before it.");
        await tx.query("update public.jobs set hold_due_at = $2::timestamptz where id = $1::uuid", [job.id, due.toISOString()]);
        await audit(tx, { actor: "system", action: "hold.scheduled", entity: "job", entityId: job.id, detail: { hold_due_at: due.toISOString(), visit: visit.toISOString() } });
      });
      report.scheduled += 1;
      continue;
    }
    const old = await liveHold(db, job.id);
    const placed = await placeHold(db, gatewayFor, job.id, "refresh");
    if (placed.outcome === "held") {
      if (old && old.id !== placed.hold.id) {
        await db.tx(async (tx) => {
          await tx.query("update public.card_holds set status = 'cancel_due' where id = $1::uuid and status = 'held'", [old.id]);
          await audit(tx, { actor: "system", action: "hold.renewed", entity: "job", entityId: job.id, amount: placed.hold.amountCents, currency: placed.hold.currency, detail: { old: old.id, new: placed.hold.id } });
        });
      }
      report.renewed += 1;
    } else if (placed.outcome === "declined") {
      await holdNotRenewed(db, job.id, placed.reason);
    }
  }

  const scheduled = await db.query<{ id: string }>(
    `select j.id from public.jobs j
      where j.hold_due_at is not null and j.hold_due_at <= $1::timestamptz and j.status = any($2::text[])
        and not exists (select 1 from public.card_holds h where h.job_id = j.id and h.status in ('held', 'placing'))
      limit 50`,
    [at.toISOString(), OPEN],
  );
  for (const row of scheduled) {
    if (await declinedSinceCard(db, row.id)) continue;
    const placed = await placeHold(db, gatewayFor, row.id, "scheduled");
    if (placed.outcome === "held" || placed.outcome === "not_needed" || placed.outcome === "no_payments") {
      await db.query("update public.jobs set hold_due_at = null where id = $1::uuid", [row.id]);
      if (placed.outcome === "held") report.placed += 1;
    } else if (placed.outcome === "declined") {
      await holdNotRenewed(db, row.id, placed.reason);
    }
  }

  report.released = await cancelDueHolds(db, gatewayFor);
  return report;
}
