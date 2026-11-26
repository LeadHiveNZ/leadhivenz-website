import { brand } from "@config/brand";
import { findTrade, NOT_SURE_TRADE } from "@config/trades";
import { audit } from "@/lib/audit";
import { addHours, addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { loadContext, marketToday, offerUrl, ownerJobUrl, type JobContext } from "@/lib/jobs/context";
import { arrivalWindows, bookedWhen, laterWindows, pickWindow, windowBetween, type Window } from "@/lib/jobs/arrival";
import { getOffer, insertLines, listLines, lockJob, recalcTotals, rowToOffer, type OfferRow } from "@/lib/jobs/store";
import type { Job, Offer } from "@/lib/jobs/types";
import { texts } from "@/lib/notify/messages";
import { formatMoney } from "@/lib/money";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { laterWave, onTimeRecords } from "@/lib/tradies/reliability";
import { canStillTake, eligibleTradies, getTradie, type Candidate } from "@/lib/tradies/service";
import { addTextingHours, formatDeadline, isQuietHours, nextTextingTime } from "@/lib/time";
import { activePair, applyOwnClientFee, pairedTradieIds } from "@/lib/clients/own-clients";
import { isRush, ownClientLines, stepDownSaving, urgentLine } from "@/lib/jobs/pricing";
import { urgentIsIncluded } from "@/lib/jobs/included";

/**
 * THE OFFER CASCADE.
 *
 *   stage 1  the first-choice tradie for the trade gets the job for 15 minutes
 *   stage 2  then the backup, for 15 minutes
 *   stage 3  then every other approved tradie in that trade and market at
 *            once: first to accept gets it. A tradie whose on-time record
 *            has slipped (fewer than 90% of their last 20 arrivals on time,
 *            once they have 10) is offered it in a second wave, after the
 *            others have had their 15 minutes (DECISIONS.md, 2026-11-18).
 *   stage 4  then it goes to the dispatcher
 *
 * Two jobs go to the dispatcher before anyone is offered them (DECISIONS.md,
 * 2026-11-24): a job whose owner chose "Not sure" for the trade (trade
 * "other"), for our team to pick the trade with one tap (chooseTrade); and a
 * job in a trade no approved tradie in the market does at all, which says so.
 * Nothing is ever sent to handymen just because nobody else matched.
 *
 * Passing, or letting an offer run out, never counts against anyone. Only
 * arriving late at jobs a tradie accepted moves them in the order, and never
 * out of a first-choice or backup slot.
 *
 * The first choice and backup (the tradies chosen for the trade) may also
 * say "can't make that time" and suggest a later one, up to 7 days ahead.
 * The owner chooses: wait for them, or send it on now. No answer within the
 * market's hours (2 by default) sends it on.
 *
 * An emergency (within the hour, DECISIONS.md, 2026-11-26, second entry)
 * skips the first choice and backup: it goes to every eligible tradie at once,
 * first choice and backup included, in one wave, and the first to accept has
 * it. Nobody accepting in the market's step-down minutes (10) offers the owner
 * "within 4 hours instead", for less (stepDownEmergencies, switchToUrgent).
 *
 * Every offer, of every kind, goes only to tradies inside their own hours right
 * now, on one of their days (eligibleTradies). A standard job with nobody
 * inside their hours waits (jobs.waiting_for_hours_at) and the timer offers it
 * as soon as someone's hours begin (offerWaitingJobs). Urgent and emergency
 * jobs never wait: nobody in their hours sends them to the dispatcher.
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

async function offerTo(db: Db, context: JobContext, candidates: Candidate[], stage: number, at: Date, paired: Set<string> = new Set()): Promise<Offer[]> {
  const { job, market, property } = context;
  const expiresAt = addMinutes(at, market.offerMinutes);
  const created: Offer[] = [];
  const active = (await listLines(db, job.id)).filter((line) => line.status === "active");
  // An urgent (or emergency) job's share of that surcharge is only paid if the tradie is on site by the deadline. The offer says so.
  const rushKind = job.urgency === "emergency" ? "emergency" : "urgent";
  const rushLine = isRush(job.urgency) ? active.find((line) => line.kind === rushKind) : undefined;
  // The tradie of an own-client pair is offered the job at the own-client fee (DECISIONS.md, 2026-11-23).
  const ownLines = ownClientLines(market, active);
  const ownPayout = Math.max(0, ownLines.reduce((sum, line) => sum + line.tradieCents, 0));
  const ownUrgent = isRush(job.urgency) ? ownLines.find((line) => line.kind === rushKind) : undefined;
  for (const candidate of candidates) {
    const own = paired.has(candidate.tradieId);
    const rows = await db.query<OfferRow>(
      `insert into public.offers (job_id, tradie_id, stage, round, sent_at, expires_at, payout_cents, own_client)
       values ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8)
       returning *`,
      [job.id, candidate.tradieId, stage, job.offerRound, at.toISOString(), expiresAt.toISOString(), own ? ownPayout : job.tradieTotalCents, own],
    );
    const offer = rowToOffer(rows[0]!);
    created.push(offer);
    const words = stage >= 3 ? texts.offerOpen : texts.offer;
    await enqueue(db, {
      channel: "sms", to: candidate.phone, template: "offer", audience: "tradie", jobId: job.id, userId: candidate.userId,
      body: words({
        title: job.title, suburb: property.suburb, payoutCents: own ? ownPayout : job.tradieTotalCents, currency: job.currency,
        deadline: job.respondBy ? formatDeadline(job.respondBy, at, market.timezone) : "as soon as you can",
        minutes: market.offerMinutes, urgent: job.urgency === "urgent", emergency: job.urgency === "emergency",
        urgentShareCents: (own ? ownUrgent : rushLine)?.tradieCents ?? null, link: offerUrl(offer),
      }),
      dedupeKey: `offer:${offer.id}`,
      // With app notifications on, the offer goes by notification first; the text follows only if it is still unopened.
      offer: { id: offer.id, textAfterMinutes: market.offerPushSmsMinutes },
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
  // The owner is choosing whether to wait for their chosen tradie's later time.
  const asking = await db.query("select 1 from public.arrival_proposals where job_id = $1::uuid and status = 'waiting' limit 1", [jobId]);
  if (asking.length > 0) return "waiting";

  const context = await loadContext(db, job);
  const { market, owner, property } = context;
  // "Not sure" (DECISIONS.md, 2026-11-24): a person picks the trade first. The owner sees "our team is arranging a tradie".
  if (job.trade === NOT_SURE_TRADE) {
    await db.query("update public.jobs set status = 'unfilled', stage = 4 where id = $1::uuid", [jobId]);
    await audit(db, { actor: "system", action: "job.trade_needed", entity: "job", entityId: jobId, detail: { round: job.offerRound } });
    await raiseException(db, {
      kind: "trade_needed", market: job.market, jobId,
      summary: `Job ${job.number}: the owner was not sure which trade "${job.title}" at ${property.name} needs. Read it, pick the trade, and it goes out to tradies${job.respondBy ? `. Promised on site by ${formatDeadline(job.respondBy, at, market.timezone)}` : ""}.`,
      dedupeKey: `trade_needed:${jobId}`,
    });
    return "unfilled";
  }
  // Only tradies inside their own hours right now (DECISIONS.md, 2026-11-26, second entry).
  const all = await eligibleTradies(db, { market: job.market, trade: job.trade, licenceRequired: job.licenceRequired, ...marketToday(market, at) });
  const already = new Set(
    (await db.query<{ tradie_id: string }>("select tradie_id from public.offers where job_id = $1::uuid and round = $2", [jobId, job.offerRound])).map((row) => row.tradie_id),
  );
  // The tradie of an own-client pair is the first choice for this property in their trades (DECISIONS.md,
  // 2026-11-23). The market's first choice moves to the backup stage for this property.
  const paired = await pairedTradieIds(db, job.propertyId);
  const ranked = paired.size === 0 || !all.some((candidate) => paired.has(candidate.tradieId))
    ? all
    : all.map((candidate): Candidate => (paired.has(candidate.tradieId) ? { ...candidate, slotRank: 1 } : candidate.slotRank === 1 ? { ...candidate, slotRank: 2 } : candidate));
  const fresh = ranked.filter((candidate) => !already.has(candidate.tradieId));
  // Everyone else is one stage, in two waves: those on time first, then those whose record has slipped.
  const records = await onTimeRecords(db, fresh.filter((candidate) => candidate.slotRank === null).map((candidate) => candidate.tradieId));
  const slipped = (candidate: Candidate) => candidate.slotRank === null && laterWave(records.get(candidate.tradieId));

  // Stage 3 can run again: its second wave, or someone who has become able to take it since.
  // An emergency goes to everyone at once, first choice and backup included, in one wave: the fastest to accept has it.
  const emergency = job.urgency === "emergency";
  for (let stage = emergency ? 3 : Math.min(job.stage + 1, 3); stage <= 3; stage += 1) {
    let candidates = stage === 3 ? fresh : fresh.filter((candidate) => candidate.slotRank === stage);
    if (stage === 3 && !emergency) {
      const first = candidates.filter((candidate) => !slipped(candidate));
      if (first.length > 0) candidates = first;
    }
    if (candidates.length === 0) continue;
    const offers = await offerTo(db, context, candidates, stage, at, paired);
    await db.query("update public.jobs set stage = $2, waiting_for_hours_at = null where id = $1::uuid", [jobId, stage]);
    await audit(db, {
      actor: "system", action: "job.offered", entity: "job", entityId: jobId,
      detail: {
        stage, round: job.offerRound, tradies: candidates.map((c) => c.businessName), expires: offers[0]?.expiresAt.toISOString(),
        ...(stage === 3 && candidates.some(slipped) ? { later_wave: true } : {}),
      },
    });
    return "offered";
  }

  // A standard job with nobody inside their hours right now, but someone who could take it later: it waits, and the
  // timer offers it when their hours begin (offerWaitingJobs). The 3-hour "not taken yet" alert still applies.
  if (job.urgency === "standard") {
    const later = (await eligibleTradies(db, { market: job.market, trade: job.trade, licenceRequired: job.licenceRequired, ...marketToday(market, at), hour: null }))
      .filter((candidate) => !already.has(candidate.tradieId));
    if (later.length > 0) {
      if (!job.waitingForHoursAt) {
        await db.query("update public.jobs set waiting_for_hours_at = $2::timestamptz where id = $1::uuid", [jobId, at.toISOString()]);
        await audit(db, { actor: "system", action: "job.waiting_for_hours", entity: "job", entityId: jobId, detail: { round: job.offerRound, tradies: later.map((c) => c.businessName) } });
      }
      return "waiting";
    }
  }

  // Nobody left to offer it to. A trade nobody in the market does at all is said plainly, so the team can pick another trade.
  await db.query("update public.jobs set status = 'unfilled', stage = 4, waiting_for_hours_at = null where id = $1::uuid", [jobId]);
  const anyone = already.size > 0 || (await db.query(
    "select 1 from public.tradies where market = $1 and status = 'approved' and $2 = any(trades) limit 1", [job.market, job.trade],
  )).length > 0;
  await audit(db, { actor: "system", action: "job.unfilled", entity: "job", entityId: jobId, detail: { round: job.offerRound, offered_to: already.size, ...(anyone ? {} : { no_tradie_in_trade: true }) } });
  const promised = job.respondBy ? `. Promised on site by ${formatDeadline(job.respondBy, at, market.timezone)}` : "";
  await raiseException(db, {
    kind: "nobody_accepted", market: job.market, jobId,
    summary: anyone
      ? `Job ${job.number}: nobody accepted "${job.title}" at ${property.name}${promised}.`
      : `Job ${job.number}: no approved tradie in ${market.name} is down for "${findTrade(job.trade)?.label ?? job.trade}" yet, so "${job.title}" at ${property.name} was not offered to anyone. Find one, or pick another trade on the job page${promised}.`,
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
  // An emergency's promise is in minutes (the market's 60), every other job's in hours.
  const emergencyMinutes = job.urgency === "emergency" ? (await loadContext(db, job)).market.emergencyResponseMinutes : null;
  const respondBy = new Date(at.getTime() + (emergencyMinutes ?? job.responseHours * 60) * 60 * 1000);
  await db.query(
    "update public.jobs set status = 'offering', stage = 0, dispatched_at = $2::timestamptz, respond_by = $3::timestamptz where id = $1::uuid",
    [jobId, at.toISOString(), respondBy.toISOString()],
  );
  await audit(db, { actor, action: "job.dispatched", entity: "job", entityId: jobId, detail: { respond_by: respondBy.toISOString(), hours: job.responseHours, ...(emergencyMinutes ? { minutes: emergencyMinutes } : {}) } });
  return advanceCascade(db, jobId);
}

export type AcceptResult =
  | { result: "accepted" | "already_yours"; job: Job; offer: Offer }
  | { result: "taken" | "gone" | "passed" | "not_eligible" | "unknown" | "window_gone"; job: Job | null };

export type AcceptChoice = {
  /** A normal job: the end of the arrival window the tradie picked (an ISO time). Left out, the promise is the deadline. */
  windowEnd?: string | null;
  /** Internal: the window an owner agreed to wait for (laterTime). */
  agreed?: Window;
};

/** The arrival windows a tradie can choose from if they accept this normal job now. Urgent jobs have none: their window is the deadline. */
export function windowsForAccepting(job: Pick<Job, "urgency" | "respondBy">, market: Parameters<typeof arrivalWindows>[0], at: Date): Window[] {
  if (isRush(job.urgency) || !job.respondBy) return [];
  return arrivalWindows(market, at, job.respondBy);
}

/**
 * A tradie says yes. Whoever gets here first has the job. A tradie whose 15
 * minutes ran out can still take it if nobody else has.
 *
 * On a normal job the tradie picks when they will be there: a window that ends
 * inside the promise. That window is what the owner is told and what on time
 * is measured against. An urgent job's window is its deadline.
 */
export async function acceptOffer(db: Db, offerId: string, via: "link" | "text" | "app" | "staff", actor?: string, choice: AcceptChoice = {}): Promise<AcceptResult> {
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

  let window: Window | null = null;
  if (choice.agreed) window = choice.agreed;
  // An urgent job's window is simply its deadline, counted from when it was sent out.
  else if (isRush(job.urgency) && job.respondBy) window = { start: job.dispatchedAt ?? at, end: job.respondBy };
  else if (choice.windowEnd) {
    window = pickWindow(windowsForAccepting(job, market, at), choice.windowEnd);
    if (!window) return { result: "window_gone", job };
  }

  await db.query("update public.offers set status = 'accepted', responded_at = $2::timestamptz, responded_via = $3 where id = $1::uuid", [offerId, at.toISOString(), via]);
  await db.query("update public.offers set status = 'superseded' where job_id = $1::uuid and status = 'pending' and id <> $2::uuid", [job.id, offerId]);
  await db.query(
    "update public.jobs set status = 'accepted', tradie_id = $2::uuid, accepted_at = $3::timestamptz, arrival_window_start = $4::timestamptz, arrival_window_end = $5::timestamptz where id = $1::uuid",
    [job.id, current.tradieId, at.toISOString(), window?.start.toISOString() ?? null, window?.end.toISOString() ?? null],
  );
  // An own-client pair's job takes the 5% fee from here on (DECISIONS.md, 2026-11-23).
  await applyOwnClientFee(db, job.id, current.tradieId, job.propertyId, market);
  await resolveExceptionsFor(db, job.id, ["nobody_accepted", "not_taken_yet", "trade_needed"], `${tradie.businessName} accepted`);
  await audit(db, {
    actor: actor ?? `tradie:${current.tradieId}`, action: "job.accepted", entity: "job", entityId: job.id,
    detail: {
      tradie: tradie.businessName, via, stage: current.stage, late: current.status === "expired", minutes_to_accept: Math.round((at.getTime() - current.sentAt.getTime()) / 60_000),
      window_start: window?.start.toISOString() ?? null, window_end: window?.end.toISOString() ?? null,
    },
  });

  const booked = (await lockJob(db, job.id))!;
  const when = bookedWhen(booked, at, market.timezone);
  const accepted = { ...current, status: "accepted" as const, respondedAt: at, respondedVia: via };
  if (tradie.phone) {
    await enqueue(db, {
      channel: "sms", to: tradie.phone, template: choice.agreed ? "later_time_accepted" : "job_yours", audience: "tradie", jobId: job.id, userId: tradie.userId,
      body: choice.agreed
        ? texts.laterTimeAccepted({ number: job.number, when, link: offerUrl(accepted) })
        : texts.jobYours({ number: job.number, link: offerUrl(accepted) }),
      dedupeKey: `job_yours:${offerId}`,
    });
  }
  // An owner who has just pressed "wait for them" is on the page already, so is not texted again.
  if (owner.phone && !choice.agreed) {
    await enqueue(db, {
      channel: "sms", to: owner.phone, template: "job_booked", audience: "owner", jobId: job.id, userId: owner.userId,
      body: texts.jobBooked({ tradie: tradie.businessName, property: property.name, when, link: ownerJobUrl(job) }),
      dedupeKey: `job_booked:${job.id}:${offerId}`,
    });
  }
  if (job.reporterPhone && job.reportedBy !== "owner" && job.reporterPhone !== owner.phone) {
    // A guest who reported it is in the house: the tradie will knock first (DECISIONS.md, 2026-11-20, second entry).
    await enqueue(db, {
      channel: "sms", to: job.reporterPhone, template: "reporter_booked", audience: "reporter", jobId: job.id,
      body: texts.reporterBooked({ property: property.name, when, knock: job.reportedBy === "guest" }), dedupeKey: `reporter_booked:${job.id}:${offerId}`,
    });
  }
  // A guest the owner told us is staying gets the tradie's first name and the time.
  if (job.guestPhone && job.guestPhone !== owner.phone && job.guestPhone !== job.reporterPhone) {
    await enqueue(db, {
      channel: "sms", to: job.guestPhone, template: "guest_booked", audience: "reporter", jobId: job.id,
      body: texts.guestBooked({ tradie: tradie.name.trim().split(/\s+/)[0] ?? "Your tradie", title: job.title, when }), dedupeKey: `guest_booked:${job.id}:${offerId}`,
    });
  }

  return { result: "accepted", job: booked, offer: accepted };
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
  // Never counted against the tradie anywhere. The name is kept so the owner's page can say their chosen tradie is not available.
  const tradie = await getTradie(db, offer.tradieId);
  await audit(db, { actor: `tradie:${offer.tradieId}`, action: "job.passed", entity: "job", entityId: job.id, detail: { via, stage: offer.stage, tradie: tradie?.businessName ?? null } });
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
    const own = Boolean(await activePair(db, tradieId, job.propertyId));
    const rows = await db.query<OfferRow>(
      `insert into public.offers (job_id, tradie_id, stage, round, sent_at, expires_at, payout_cents, own_client)
       values ($1::uuid, $2::uuid, 4, $3, $4::timestamptz, $4::timestamptz, $5, $6) returning *`,
      [jobId, tradieId, job.offerRound, at.toISOString(), job.tradieTotalCents, own],
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

export type ChooseTradeResult = { ok: true; outcome: CascadeOutcome } | { ok: false; message: string };

/**
 * Our team picks the trade for a job (DECISIONS.md, 2026-11-24): one tap on the
 * queue or the job page, for a "Not sure" job or one nobody in its trade could
 * take. The job takes that trade (and its licence rule) and the offers start
 * again from the top, as "Start the offers again" does. The promised time and
 * the price stay as they were.
 */
export async function chooseTrade(db: Db, jobId: string, tradeKey: string, actor: string): Promise<ChooseTradeResult> {
  const trade = findTrade(tradeKey);
  if (!trade || trade.key === NOT_SURE_TRADE) return { ok: false, message: "Choose one of the trades." };
  const job = await lockJob(db, jobId);
  if (!job) return { ok: false, message: "We could not find that job." };
  if ((job.status !== "unfilled" && job.status !== "offering") || job.tradieId) return { ok: false, message: "This job is not waiting for a tradie any more." };
  // A job from the menu keeps its own licence rule; an off-menu job takes the trade's.
  const licenceRequired = job.offMenu ? trade.licenceRequired : job.licenceRequired || trade.licenceRequired;
  await db.query("update public.jobs set trade = $2, licence_required = $3 where id = $1::uuid", [jobId, trade.key, licenceRequired]);
  await audit(db, { actor, action: "job.trade_chosen", entity: "job", entityId: jobId, detail: { from: job.trade, to: trade.key } });
  await resolveExceptionsFor(db, jobId, ["trade_needed", "nobody_accepted"], `Sent to ${trade.label.toLowerCase()} tradies`);
  return { ok: true, outcome: await reoffer(db, jobId, actor) };
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

// ---------------------------------------------------------------------------
// "CAN'T MAKE THAT TIME, I CAN COME THEN" (DECISIONS.md, 2026-11-18)
// ---------------------------------------------------------------------------

export type LaterTime = { id: string; jobId: string; offerId: string; tradieId: string; tradieName: string; start: Date; end: Date; answerBy: Date; status: "waiting" | "accepted" | "declined" | "expired" };

type ProposalRow = { id: string; job_id: string; offer_id: string; tradie_id: string; business_name: string; window_start: Date; window_end: Date; answer_by: Date; status: LaterTime["status"] };

const toLaterTime = (row: ProposalRow): LaterTime => ({
  id: row.id, jobId: row.job_id, offerId: row.offer_id, tradieId: row.tradie_id, tradieName: row.business_name,
  start: new Date(row.window_start), end: new Date(row.window_end), answerBy: new Date(row.answer_by), status: row.status,
});

/** The later time waiting for the owner's answer on this job, if there is one. */
export async function waitingLaterTime(db: Db, jobId: string): Promise<LaterTime | null> {
  const rows = await db.query<ProposalRow>(
    `select p.*, t.business_name from public.arrival_proposals p join public.tradies t on t.id = p.tradie_id
      where p.job_id = $1::uuid and p.status = 'waiting' limit 1`,
    [jobId],
  );
  return rows[0] ? toLaterTime(rows[0]) : null;
}

/** The later time a tradie suggested on this offer, if any. */
export async function laterTimeForOffer(db: Db, offerId: string): Promise<LaterTime | null> {
  const rows = await db.query<ProposalRow>(
    `select p.*, t.business_name from public.arrival_proposals p join public.tradies t on t.id = p.tradie_id
      where p.offer_id = $1::uuid order by p.created_at desc limit 1`,
    [offerId],
  );
  return rows[0] ? toLaterTime(rows[0]) : null;
}

/** Whether this offer may suggest a later time: only the first choice or the backup, on a job still being offered. */
export function canSuggestLater(offer: Pick<Offer, "stage" | "status">, job: Pick<Job, "status" | "respondBy">): boolean {
  return offer.stage <= 2 && (offer.status === "pending" || offer.status === "expired") && job.status === "offering" && job.respondBy !== null;
}

export type SuggestResult = { ok: true; proposal: LaterTime } | { ok: false; message: string };

/**
 * The owner's chosen tradie (first choice or backup) cannot make the promised
 * time and suggests a later window. The job waits for the owner's answer.
 * This, like passing, never counts against the tradie.
 */
export async function suggestLaterTime(db: Db, offerId: string, windowEnd: string, via: "link" | "app"): Promise<SuggestResult> {
  const offer = await getOffer(db, offerId);
  if (!offer) return { ok: false, message: "We could not find that offer." };
  const job = await lockJob(db, offer.jobId);
  if (!job) return { ok: false, message: "We could not find that job." };
  const current = (await getOffer(db, offerId))!;
  if (!canSuggestLater(current, job)) return { ok: false, message: "This job can no longer wait for a later time." };
  if (await waitingLaterTime(db, job.id)) return { ok: false, message: "The owner is already choosing about this job." };
  const at = now();
  const context = await loadContext(db, job);
  const { market, owner } = context;
  const window = pickWindow(laterWindows(market, job.respondBy!, at), windowEnd);
  if (!window) return { ok: false, message: "That time is no longer on the list. Choose another." };
  const tradie = await getTradie(db, current.tradieId);
  if (!tradie) return { ok: false, message: "We could not find your details." };

  await db.query("update public.offers set status = 'superseded', responded_at = $2::timestamptz, responded_via = $3 where id = $1::uuid", [offerId, at.toISOString(), via]);
  // On a normal job the owner's answer clock counts only 7am to 9pm, and the text waits for 7am. Urgent jobs run on the plain clock, any time.
  const urgent = isRush(job.urgency);
  const answerBy = urgent ? addHours(at, market.counterOfferHours) : addTextingHours(at, market.counterOfferHours, market.timezone);
  const rows = await db.query<{ id: string }>(
    `insert into public.arrival_proposals (created_at, job_id, offer_id, tradie_id, window_start, window_end, answer_by)
     values ($1::timestamptz, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz, $7::timestamptz) returning id`,
    [at.toISOString(), job.id, offerId, current.tradieId, window.start.toISOString(), window.end.toISOString(), answerBy.toISOString()],
  );
  await audit(db, {
    actor: `tradie:${current.tradieId}`, action: "job.later_time_offered", entity: "job", entityId: job.id,
    detail: { tradie: tradie.businessName, stage: current.stage, window_start: window.start.toISOString(), window_end: window.end.toISOString(), answer_by: answerBy.toISOString(), hours: job.responseHours },
  });
  if (owner.phone) {
    await enqueue(db, {
      channel: "sms", to: owner.phone, template: "later_time_offered", audience: "owner", jobId: job.id, userId: owner.userId,
      body: texts.laterTimeOffered({ tradie: tradie.businessName, hours: job.responseHours, when: windowBetween(window, at, market.timezone), link: ownerJobUrl(job) }),
      dedupeKey: `later_time_offered:${rows[0]!.id}`, sendAfter: urgent ? at : nextTextingTime(at, market.timezone),
    });
  }
  return { ok: true, proposal: (await waitingLaterTime(db, job.id))! };
}

export type LaterAnswer = { ok: true; waited: boolean } | { ok: false; message: string };

/**
 * The owner answers: wait for their chosen tradie, or send it on now.
 *
 * Wait: the tradie has the job. The promise becomes the end of the tradie's
 * window, and on time and no-shows are judged against it. An urgent job stops
 * being urgent, and its urgent and after-hours lines come off for everyone:
 * nobody pays for speed that is not being delivered.
 *
 * Send now: the job goes on to the next tradies as normal, and the chosen
 * tradie is told, with no mark against them.
 */
export async function answerLaterTime(db: Db, proposalId: string, wait: boolean, actor: string): Promise<LaterAnswer> {
  const found = await db.query<{ job_id: string }>("select job_id from public.arrival_proposals where id = $1::uuid", [proposalId]);
  if (!found[0]) return { ok: false, message: "We could not find that choice." };
  const job = await lockJob(db, found[0].job_id);
  if (!job) return { ok: false, message: "We could not find that job." };
  const proposal = await waitingLaterTime(db, job.id);
  if (!proposal || proposal.id !== proposalId) return { ok: true, waited: false };
  const at = now();
  if (!wait) {
    await sendOn(db, job, proposal, "declined", actor);
    return { ok: true, waited: false };
  }
  const context = await loadContext(db, job);
  const { market } = context;
  await db.query("update public.arrival_proposals set status = 'accepted', decided_at = $2::timestamptz, decided_by = $3 where id = $1::uuid", [proposal.id, at.toISOString(), actor]);
  const wasUrgent = isRush(job.urgency);
  if (wasUrgent) {
    await db.query("update public.job_lines set status = 'void' where job_id = $1::uuid and kind in ('urgent', 'emergency', 'after_hours') and status = 'active'", [job.id]);
    await db.query("update public.jobs set urgency = 'standard', after_hours = false where id = $1::uuid", [job.id]);
    await recalcTotals(db, job.id, market.taxRate, market.taxRegistered);
  }
  await db.query("update public.jobs set respond_by = $2::timestamptz, at_risk_flagged_at = null where id = $1::uuid", [job.id, proposal.end.toISOString()]);
  const sum = await db.query<{ owner_total_cents: number }>("select owner_total_cents from public.jobs where id = $1::uuid", [job.id]);
  await audit(db, {
    actor, action: "job.later_time_accepted", entity: "job", entityId: job.id, amount: Number(sum[0]?.owner_total_cents ?? 0), currency: job.currency,
    detail: { tradie: proposal.tradieName, window_start: proposal.start.toISOString(), window_end: proposal.end.toISOString(), was_urgent: wasUrgent },
  });
  const accepted = await acceptOffer(db, proposal.offerId, "staff", actor, { agreed: { start: proposal.start, end: proposal.end } });
  if (accepted.result !== "accepted" && accepted.result !== "already_yours") {
    // The tradie can no longer take it (paused, insurance ran out): it goes on as if the owner had said send it now.
    await advanceCascade(db, job.id);
    return { ok: false, message: `${proposal.tradieName} can no longer take this job, so we have sent it to another ${brand.name} tradie.` };
  }
  return { ok: true, waited: true };
}

async function sendOn(db: Db, job: Job, proposal: LaterTime, status: "declined" | "expired", actor: string): Promise<void> {
  const at = now();
  await db.query("update public.arrival_proposals set status = $2, decided_at = $3::timestamptz, decided_by = $4 where id = $1::uuid", [proposal.id, status, at.toISOString(), actor]);
  await audit(db, { actor, action: status === "declined" ? "job.later_time_declined" : "job.later_time_expired", entity: "job", entityId: job.id, detail: { tradie: proposal.tradieName } });
  const tradie = await getTradie(db, proposal.tradieId);
  if (tradie?.phone) {
    await enqueue(db, {
      channel: "sms", to: tradie.phone, template: "later_time_sent_on", audience: "tradie", jobId: job.id, userId: tradie.userId,
      body: texts.laterTimeSentOn({ number: job.number }), dedupeKey: `later_time_sent_on:${proposal.id}`,
    });
  }
  await advanceCascade(db, job.id);
}

/** Run by the timer: a later time the owner has not answered in time goes on to the next tradies. */
export async function expireLaterTimes(db: Db): Promise<number> {
  const due = await db.query<{ id: string; job_id: string }>(
    "select id, job_id from public.arrival_proposals where status = 'waiting' and answer_by <= $1::timestamptz limit 100",
    [now().toISOString()],
  );
  let moved = 0;
  for (const row of due) {
    await db.tx(async (tx) => {
      const job = await lockJob(tx, row.job_id);
      const proposal = job ? await waitingLaterTime(tx, job.id) : null;
      if (!job || !proposal || proposal.id !== row.id || proposal.answerBy.getTime() > now().getTime()) return;
      await sendOn(tx, job, proposal, "expired", "system");
      moved += 1;
    });
  }
  return moved;
}

/**
 * Run by the timer: a normal job nobody has accepted within the market's hours
 * (3 by default, counting only 7am to 9pm) of being sent out. The owner is told we are ringing round and
 * that they pay nothing unless a tradie does the job, and the team is asked to
 * ring round (an alert to the founder's phone as well as the queue). Urgent
 * jobs keep their own, faster, alerts.
 */
export async function alertNotTakenYet(db: Db): Promise<number> {
  const at = now();
  const rows = await db.query<{ id: string }>(
    `select j.id from public.jobs j join public.markets m on m.slug = j.market
      where j.urgency = 'standard' and j.status in ('offering', 'unfilled') and j.unaccepted_alerted_at is null
        and j.dispatched_at is not null and j.dispatched_at + (m.unaccepted_alert_hours * interval '1 hour') <= $1::timestamptz
        and not exists (select 1 from public.arrival_proposals p where p.job_id = j.id and p.status = 'waiting')
      order by j.dispatched_at limit 100`,
    [at.toISOString()],
  );
  let alerted = 0;
  for (const row of rows) {
    await db.tx(async (tx) => {
      // The query found jobs past the hours on the plain clock. The 3 hours count only 7am to 9pm, so check that too.
      const due = (await lockJob(tx, row.id))!;
      const { market: dueMarket } = await loadContext(tx, due);
      if (!due.dispatchedAt || addTextingHours(due.dispatchedAt, dueMarket.unacceptedAlertHours, dueMarket.timezone).getTime() > at.getTime()) return;
      const claimed = await tx.query("update public.jobs set unaccepted_alerted_at = $2::timestamptz where id = $1::uuid and unaccepted_alerted_at is null and status in ('offering', 'unfilled') returning id", [row.id, at.toISOString()]);
      if (claimed.length === 0) return;
      const job = (await lockJob(tx, row.id))!;
      const { market, owner, property } = await loadContext(tx, job);
      await audit(tx, { actor: "system", action: "job.not_taken_yet", entity: "job", entityId: job.id, detail: { hours: market.unacceptedAlertHours } });
      if (owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: owner.phone, template: "not_taken_yet", audience: "owner", jobId: job.id, userId: owner.userId,
          body: texts.notTakenYet({ property: property.name, link: ownerJobUrl(job) }), dedupeKey: `not_taken_yet:${job.id}`,
          // Never between 9pm and 7am. The queue item below appears straight away.
          sendAfter: nextTextingTime(at, market.timezone),
        });
      }
      await raiseException(tx, {
        kind: "not_taken_yet", market: job.market, jobId: job.id,
        summary: `Job ${job.number}: nobody has taken "${job.title}" at ${property.name} in ${market.unacceptedAlertHours} hours (counting 7am to 9pm). Ring round${job.respondBy ? `: promised on site by ${formatDeadline(job.respondBy, at, market.timezone)}` : ""}. ${isQuietHours(at, market.timezone) ? "The owner will be texted at 7am." : "The owner has been told."}`,
        dedupeKey: `not_taken_yet:${job.id}`,
      });
      alerted += 1;
    });
  }
  return alerted;
}

// ---------------------------------------------------------------------------
// A STANDARD JOB WAITING FOR SOMEONE'S HOURS (DECISIONS.md, 2026-11-26, second entry)
// ---------------------------------------------------------------------------

/**
 * Run by the timer: a standard job that nobody inside their hours could be offered (advanceCascade left it waiting)
 * is tried again, so it goes out the minute a tradie's hours begin. Nothing changes while nobody's hours have begun.
 */
export async function offerWaitingJobs(db: Db): Promise<number> {
  const rows = await db.query<{ id: string }>(
    "select id from public.jobs where status = 'offering' and waiting_for_hours_at is not null order by waiting_for_hours_at limit 100",
  );
  let offered = 0;
  for (const row of rows) {
    const outcome = await db.tx((tx) => advanceCascade(tx, row.id));
    if (outcome === "offered") offered += 1;
  }
  return offered;
}

// ---------------------------------------------------------------------------
// EMERGENCY STEP-DOWN (DECISIONS.md, 2026-11-26, second entry)
// ---------------------------------------------------------------------------

/** True while the owner can still switch this emergency to urgent: nobody has taken it yet. */
export function canStepDown(job: Pick<Job, "urgency" | "status" | "tradieId">): boolean {
  return job.urgency === "emergency" && (job.status === "offering" || job.status === "unfilled") && job.tradieId === null;
}

/**
 * Run by the timer: an emergency nobody has accepted within the market's step-down minutes (10) of being sent out.
 * The owner is texted (and emailed) once, with a link to the job page, where one button makes it urgent for less.
 * Opening the link changes nothing. Without an answer the job keeps looking as an emergency, and the dispatcher's
 * "nobody accepted" alert still comes as it always did.
 */
export async function stepDownEmergencies(db: Db): Promise<number> {
  const at = now();
  const rows = await db.query<{ id: string }>(
    `select j.id from public.jobs j join public.markets m on m.slug = j.market
      where j.urgency = 'emergency' and j.status in ('offering', 'unfilled') and j.tradie_id is null and j.step_down_offered_at is null
        and j.dispatched_at is not null and j.dispatched_at + (m.emergency_step_down_minutes * interval '1 minute') <= $1::timestamptz
      order by j.dispatched_at limit 100`,
    [at.toISOString()],
  );
  let offered = 0;
  for (const row of rows) {
    await db.tx(async (tx) => {
      const job = await lockJob(tx, row.id);
      if (!job || !canStepDown(job) || job.stepDownOfferedAt) return;
      const { market, owner, property, tier } = await loadContext(tx, job);
      await tx.query("update public.jobs set step_down_offered_at = $2::timestamptz where id = $1::uuid", [job.id, at.toISOString()]);
      const hours = tier?.urgentResponseHours ?? 4;
      const saving = stepDownSaving(market);
      await audit(tx, { actor: "system", action: "job.step_down_offered", entity: "job", entityId: job.id, amount: saving, currency: job.currency, detail: { minutes: market.emergencyStepDownMinutes, hours } });
      const link = ownerJobUrl(job);
      if (owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: owner.phone, template: "emergency_step_down", audience: "owner", jobId: job.id, userId: owner.userId,
          body: texts.emergencyStepDown({ property: property.name, hours, savingCents: saving, currency: job.currency, link }), dedupeKey: `emergency_step_down:${job.id}`,
        });
      }
      if (owner.email) {
        await enqueue(tx, {
          channel: "email", to: owner.email, template: "emergency_step_down", audience: "owner", jobId: job.id, userId: owner.userId,
          subject: `${brand.name}: nobody is free within the hour`,
          body: `Hi ${owner.name.split(" ")[0]},\n\nNo one is free within the hour for "${job.title}" at ${property.name}. Switch to within ${hours} hours and we'll take ${formatMoney(saving, job.currency)} off?\n\nOne tap on the job page: ${link}\n\nIf you do nothing, we keep looking for someone within the hour.\n\n${brand.name}`,
          dedupeKey: `emergency_step_down_email:${job.id}`,
        });
      }
      offered += 1;
    });
  }
  return offered;
}

export type StepDownResult = { ok: true; job: Job; savingCents: number } | { ok: false; message: string };

/**
 * The owner taps "Switch to within 4 hours" on an emergency nobody has taken (DECISIONS.md, 2026-11-26, second
 * entry). The emergency line comes off and the urgent line goes on (NZ$150 out, NZ$50 in: NZ$100 less), the promise
 * becomes 4 hours from now, and the job is offered again from the top as an urgent job, first choice first. The
 * after-hours line stays as it was (still charged only if the tradie arrives outside working hours). The hold on the
 * card stays at the old amount; only the lower price is taken from it when the job is done, and the rest let go.
 * Must be called inside a database step.
 */
export async function switchToUrgent(db: Db, jobId: string, actor: string): Promise<StepDownResult> {
  const job = await lockJob(db, jobId);
  if (!job) return { ok: false, message: "We could not find that job." };
  if (job.urgency !== "emergency" || job.steppedDownAt) return { ok: false, message: "This job is not an emergency any more." };
  if (!canStepDown(job)) return { ok: false, message: "A tradie has already taken this job, so it stays as it is." };
  const at = now();
  const { market, property, tier } = await loadContext(db, job);
  const before = job.ownerTotalCents;
  await db.query("update public.job_lines set status = 'void' where job_id = $1::uuid and kind = 'emergency' and status = 'active'", [job.id]);
  await insertLines(db, job.id, [urgentLine(market, await urgentIsIncluded(db, property, tier, market.timezone, at))], { at });
  const hours = tier?.urgentResponseHours ?? 4;
  await db.query(
    `update public.jobs set urgency = 'urgent', response_hours = $2, respond_by = $3::timestamptz, stepped_down_at = $4::timestamptz,
            at_risk_flagged_at = null where id = $1::uuid`,
    [job.id, hours, addHours(at, hours).toISOString(), at.toISOString()],
  );
  const sum = await recalcTotals(db, job.id, market.taxRate, market.taxRegistered);
  await audit(db, {
    actor, action: "job.stepped_down", entity: "job", entityId: job.id, amount: sum.ownerCents, currency: job.currency,
    detail: { from: "emergency", to: "urgent", hours, before_cents: before, after_cents: sum.ownerCents, saving_cents: before - sum.ownerCents },
  });
  await resolveExceptionsFor(db, job.id, ["nobody_accepted"], "Switched to urgent: offered again");
  await reoffer(db, job.id, actor);
  return { ok: true, job: (await lockJob(db, job.id))!, savingCents: before - sum.ownerCents };
}
