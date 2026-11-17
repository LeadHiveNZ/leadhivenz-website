import { audit } from "@/lib/audit";
import { addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { loadContext, marketToday, offerUrl, ownerJobUrl, type JobContext } from "@/lib/jobs/context";
import { getOffer, lockJob, rowToOffer, type OfferRow } from "@/lib/jobs/store";
import type { Job, Offer } from "@/lib/jobs/types";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { addressLine } from "@/lib/properties/service";
import { canStillTake, eligibleTradies, getTradie, type Candidate } from "@/lib/tradies/service";
import { formatDeadline } from "@/lib/time";

/**
 * THE OFFER CASCADE.
 *
 *   stage 1  the first-choice tradie for the trade gets the job for 15 minutes
 *   stage 2  then the backup, for 15 minutes
 *   stage 3  then every other approved tradie in that trade and market at
 *            once: first to accept gets it
 *   stage 4  then it goes to the dispatcher
 *
 * A stage with nobody in it is skipped straight away. A pass moves on at once.
 * No reply moves on when the 15 minutes run out. Licensed work is only ever
 * offered to a tradie with a licence on file that has not expired.
 *
 * Every function here must be called inside a database step (db.tx). Each one
 * locks the job first, so two tradies tapping Accept in the same second, or
 * the timer and a tap arriving together, are dealt with one after the other.
 */

export type CascadeOutcome = "not_offering" | "waiting" | "offered" | "unfilled";

async function offerTo(db: Db, context: JobContext, candidates: Candidate[], stage: number, at: Date): Promise<Offer[]> {
  const { job, market, property } = context;
  const expiresAt = addMinutes(at, market.offerMinutes);
  const created: Offer[] = [];
  for (const candidate of candidates) {
    const rows = await db.query<OfferRow>(
      `insert into public.offers (job_id, tradie_id, stage, round, sent_at, expires_at, payout_cents)
       values ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz, $7)
       returning *`,
      [job.id, candidate.tradieId, stage, job.offerRound, at.toISOString(), expiresAt.toISOString(), job.tradieTotalCents],
    );
    const offer = rowToOffer(rows[0]!);
    created.push(offer);
    const words = stage >= 3 ? texts.offerOpen : texts.offer;
    await enqueue(db, {
      channel: "sms", to: candidate.phone, template: "offer", audience: "tradie", jobId: job.id, userId: candidate.userId,
      body: words({
        title: job.title, suburb: property.suburb, payoutCents: job.tradieTotalCents, currency: job.currency,
        deadline: job.respondBy ? formatDeadline(job.respondBy, at, market.timezone) : "as soon as you can",
        minutes: market.offerMinutes, urgent: job.urgency === "urgent", link: offerUrl(offer),
      }),
      dedupeKey: `offer:${offer.id}`,
    });
  }
  return created;
}

/**
 * Moves the job on if it is time to: expires offers that have run out and
 * offers the job to the next stage. Does nothing while an offer is still live.
 */
export async function advanceCascade(db: Db, jobId: string): Promise<CascadeOutcome> {
  const job = await lockJob(db, jobId);
  if (!job || job.status !== "offering") return "not_offering";
  const at = now();

  await db.query("update public.offers set status = 'expired' where job_id = $1::uuid and status = 'pending' and expires_at <= $2::timestamptz", [
    jobId,
    at.toISOString(),
  ]);
  const live = await db.query("select 1 from public.offers where job_id = $1::uuid and status = 'pending' limit 1", [jobId]);
  if (live.length > 0) return "waiting";

  const context = await loadContext(db, job);
  const { market, owner, property } = context;
  const all = await eligibleTradies(db, {
    market: job.market, trade: job.trade, licenceRequired: job.licenceRequired, afterHours: job.afterHours,
    urgent: job.urgency === "urgent", ...marketToday(market, at),
  });
  const already = new Set(
    (await db.query<{ tradie_id: string }>("select tradie_id from public.offers where job_id = $1::uuid and round = $2", [jobId, job.offerRound])).map((row) => row.tradie_id),
  );
  const fresh = all.filter((candidate) => !already.has(candidate.tradieId));

  for (let stage = job.stage + 1; stage <= 3; stage += 1) {
    const candidates = stage === 3 ? fresh : fresh.filter((candidate) => candidate.slotRank === stage);
    if (candidates.length === 0) continue;
    const offers = await offerTo(db, context, candidates, stage, at);
    await db.query("update public.jobs set stage = $2 where id = $1::uuid", [jobId, stage]);
    await audit(db, {
      actor: "system", action: "job.offered", entity: "job", entityId: jobId,
      detail: { stage, round: job.offerRound, tradies: candidates.map((c) => c.businessName), expires: offers[0]?.expiresAt.toISOString() },
    });
    return "offered";
  }

  // Nobody left to offer it to.
  await db.query("update public.jobs set status = 'unfilled', stage = 4 where id = $1::uuid", [jobId]);
  await audit(db, { actor: "system", action: "job.unfilled", entity: "job", entityId: jobId, detail: { round: job.offerRound, offered_to: already.size } });
  await raiseException(db, {
    kind: "nobody_accepted", market: job.market, jobId,
    summary: `Job ${job.number}: nobody accepted "${job.title}" at ${property.name}${job.respondBy ? `. Promised on site by ${formatDeadline(job.respondBy, at, market.timezone)}` : ""}.`,
    dedupeKey: `nobody_accepted:${jobId}`,
  });
  if (owner.phone) {
    await enqueue(db, {
      channel: "sms", to: owner.phone, template: "still_arranging", audience: "owner", jobId, userId: owner.userId,
      body: texts.stillArranging({ property: property.name }), dedupeKey: `still_arranging:${jobId}:${job.offerRound}`,
    });
  }
  return "unfilled";
}

/** Starts offering a job. Sets the promise: a tradie on site within the tier's hours from now. */
export async function startDispatch(db: Db, jobId: string, actor: string): Promise<CascadeOutcome> {
  const job = await lockJob(db, jobId);
  if (!job) return "not_offering";
  const at = now();
  const respondBy = new Date(at.getTime() + job.responseHours * 60 * 60 * 1000);
  await db.query(
    "update public.jobs set status = 'offering', stage = 0, dispatched_at = $2::timestamptz, respond_by = $3::timestamptz where id = $1::uuid",
    [jobId, at.toISOString(), respondBy.toISOString()],
  );
  await audit(db, { actor, action: "job.dispatched", entity: "job", entityId: jobId, detail: { respond_by: respondBy.toISOString(), hours: job.responseHours } });
  return advanceCascade(db, jobId);
}

export type AcceptResult =
  | { result: "accepted" | "already_yours"; job: Job; offer: Offer }
  | { result: "taken" | "gone" | "passed" | "not_eligible" | "unknown"; job: Job | null };

/**
 * A tradie says yes. Whoever gets here first has the job. A tradie whose 15
 * minutes ran out can still take it if nobody else has.
 */
export async function acceptOffer(db: Db, offerId: string, via: "link" | "text" | "app" | "staff", actor?: string): Promise<AcceptResult> {
  const offer = await getOffer(db, offerId);
  if (!offer) return { result: "unknown", job: null };
  const job = await lockJob(db, offer.jobId);
  if (!job) return { result: "unknown", job: null };

  // Read the offer again now that the job is locked: it may have changed while we waited.
  const current = (await getOffer(db, offerId))!;
  if (current.status === "accepted") return { result: "already_yours", job, offer: current };
  if (current.status === "passed") return { result: "passed", job };
  if (job.status !== "offering" && job.status !== "unfilled") return { result: job.tradieId ? "taken" : "gone", job };

  const at = now();
  const context = await loadContext(db, job);
  const { market, property, owner } = context;
  if (!(await canStillTake(db, current.tradieId, { market: job.market, trade: job.trade, licenceRequired: job.licenceRequired, today: marketToday(market, at).today }))) {
    return { result: "not_eligible", job };
  }
  const tradie = await getTradie(db, current.tradieId);
  if (!tradie) return { result: "not_eligible", job };

  await db.query("update public.offers set status = 'accepted', responded_at = $2::timestamptz, responded_via = $3 where id = $1::uuid", [offerId, at.toISOString(), via]);
  await db.query("update public.offers set status = 'superseded' where job_id = $1::uuid and status = 'pending' and id <> $2::uuid", [job.id, offerId]);
  await db.query("update public.jobs set status = 'accepted', tradie_id = $2::uuid, accepted_at = $3::timestamptz where id = $1::uuid", [
    job.id, current.tradieId, at.toISOString(),
  ]);
  await resolveExceptionsFor(db, job.id, ["nobody_accepted"], `${tradie.businessName} accepted`);
  await audit(db, {
    actor: actor ?? `tradie:${current.tradieId}`, action: "job.accepted", entity: "job", entityId: job.id,
    detail: { tradie: tradie.businessName, via, stage: current.stage, late: current.status === "expired", minutes_to_accept: Math.round((at.getTime() - current.sentAt.getTime()) / 60_000) },
  });

  const deadline = job.respondBy ? formatDeadline(job.respondBy, at, market.timezone) : "soon";
  const accepted = { ...current, status: "accepted" as const, respondedAt: at, respondedVia: via };
  if (tradie.phone) {
    await enqueue(db, {
      channel: "sms", to: tradie.phone, template: "job_yours", audience: "tradie", jobId: job.id, userId: tradie.userId,
      body: texts.jobYours({ number: job.number, address: addressLine(property), link: offerUrl(accepted) }), dedupeKey: `job_yours:${offerId}`,
    });
  }
  if (owner.phone) {
    await enqueue(db, {
      channel: "sms", to: owner.phone, template: "job_booked", audience: "owner", jobId: job.id, userId: owner.userId,
      body: texts.jobBooked({ tradie: tradie.businessName, property: property.name, deadline, link: ownerJobUrl(job) }),
      dedupeKey: `job_booked:${job.id}:${offerId}`,
    });
  }
  if (job.reporterPhone && job.reportedBy !== "owner" && job.reporterPhone !== owner.phone) {
    await enqueue(db, {
      channel: "sms", to: job.reporterPhone, template: "reporter_booked", audience: "reporter", jobId: job.id,
      body: texts.reporterBooked({ property: property.name, deadline }), dedupeKey: `reporter_booked:${job.id}:${offerId}`,
    });
  }

  const updated = (await lockJob(db, job.id))!;
  return { result: "accepted", job: updated, offer: accepted };
}

/** A tradie says no. The job moves on to the next stage at once. */
export async function passOffer(db: Db, offerId: string, via: "link" | "text" | "app" | "staff"): Promise<"passed" | "not_pending"> {
  const offer = await getOffer(db, offerId);
  if (!offer) return "not_pending";
  const job = await lockJob(db, offer.jobId);
  if (!job) return "not_pending";
  const rows = await db.query(
    "update public.offers set status = 'passed', responded_at = $2::timestamptz, responded_via = $3 where id = $1::uuid and status in ('pending', 'expired') returning id",
    [offerId, now().toISOString(), via],
  );
  if (rows.length === 0) return "not_pending";
  await audit(db, { actor: `tradie:${offer.tradieId}`, action: "job.passed", entity: "job", entityId: job.id, detail: { via, stage: offer.stage } });
  await advanceCascade(db, job.id);
  return "passed";
}

/**
 * The dispatcher gives the job to a tradie they have spoken to. The licence
 * rule still applies: nobody can be given licensed work without a licence.
 */
export async function assignTradie(db: Db, jobId: string, tradieId: string, actor: string): Promise<AcceptResult> {
  const job = await lockJob(db, jobId);
  if (!job) return { result: "unknown", job: null };
  if (job.status !== "offering" && job.status !== "unfilled") return { result: job.tradieId ? "taken" : "gone", job };
  const at = now();
  // Checked before anything is written, so a tradie who may not take it (waiting for approval,
  // paused, removed, uninsured, unlicensed) is left with no offer row at all. acceptOffer checks again.
  const { market } = await loadContext(db, job);
  if (!(await canStillTake(db, tradieId, { market: job.market, trade: job.trade, licenceRequired: job.licenceRequired, today: marketToday(market, at).today }))) {
    return { result: "not_eligible", job };
  }
  const existing = await db.query<OfferRow>(
    "select * from public.offers where job_id = $1::uuid and tradie_id = $2::uuid and status in ('pending', 'expired') order by sent_at desc limit 1",
    [jobId, tradieId],
  );
  let offerId = existing[0]?.id;
  if (!offerId) {
    const rows = await db.query<OfferRow>(
      `insert into public.offers (job_id, tradie_id, stage, round, sent_at, expires_at, payout_cents)
       values ($1::uuid, $2::uuid, 4, $3, $4::timestamptz, $4::timestamptz, $5) returning *`,
      [jobId, tradieId, job.offerRound, at.toISOString(), job.tradieTotalCents],
    );
    offerId = rows[0]!.id;
    // Offered and taken in the same breath, so it does not count for or against their scorecard.
    await db.query("update public.offers set status = 'expired' where id = $1::uuid", [offerId]);
  }
  return acceptOffer(db, offerId, "staff", actor);
}

/** The dispatcher starts the offers again from the top. Everyone eligible is asked afresh. */
export async function reoffer(db: Db, jobId: string, actor: string): Promise<CascadeOutcome> {
  const job = await lockJob(db, jobId);
  if (!job || (job.status !== "unfilled" && job.status !== "offering")) return "not_offering";
  await db.query("update public.offers set status = 'superseded' where job_id = $1::uuid and status = 'pending'", [jobId]);
  await db.query("update public.jobs set status = 'offering', stage = 0, offer_round = offer_round + 1 where id = $1::uuid", [jobId]);
  await audit(db, { actor, action: "job.reoffered", entity: "job", entityId: jobId, detail: { round: job.offerRound + 1 } });
  return advanceCascade(db, jobId);
}

/** Run by the timer: moves on every job whose live offer has run out. */
export async function expireDueOffers(db: Db): Promise<number> {
  const due = await db.query<{ job_id: string }>(
    "select distinct job_id from public.offers where status = 'pending' and expires_at <= $1::timestamptz limit 200",
    [now().toISOString()],
  );
  let moved = 0;
  for (const row of due) {
    await db.tx(async (tx) => {
      await advanceCascade(tx, row.job_id);
    });
    moved += 1;
  }
  return moved;
}
