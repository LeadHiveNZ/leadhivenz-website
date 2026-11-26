import { findTrade, NOT_SURE_TRADE } from "@config/trades";
import { audit } from "@/lib/audit";
import { placeHold, releaseJobHolds } from "@/lib/billing/card-holds";
import { openSettlement, type GatewayFor } from "@/lib/billing/settle";
import { notePatterns } from "@/lib/ops/patterns";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { advanceCascade, startDispatch } from "@/lib/dispatch/cascade";
import { attachUploads } from "@/lib/files/uploads";
import { getMarket, getMenuItem, getTier, type Tier } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { raiseException, resolveExceptionsFor } from "@/lib/ops/exceptions";
import { cardProblem, cardProblemWords } from "@/lib/owners/service";
import { baseUrl } from "@/lib/env";
import type { Property } from "@/lib/properties/service";
import { isAfterHours } from "@/lib/time";
import { urgentIsIncluded } from "./included";
import { loadContext, ownerJobUrl } from "./context";
import { cancelledOnSiteLines, initialLines, isRush, urgencyOf, type Line, type Urgency } from "./pricing";
import { insertLines, listLines, lockJob, recalcTotals, rowToJob, type JobRow } from "./store";
import type { Job, ReportedBy } from "./types";

/**
 * LOGGING A JOB, and the two things that can happen before a tradie is
 * booked: the owner's go-ahead on a guest's report, and cancelling.
 */

export type NewJob = {
  property: Property;
  reportedBy: ReportedBy;
  reporterName: string | null;
  reporterPhone: string | null;
  /** A menu item, or null for off-menu work. */
  menuItemId: string | null;
  /** Off-menu only: which trade, and a few words for what is wrong. */
  offMenuTrade?: string | null;
  offMenuTitle?: string | null;
  description: string;
  urgent: boolean;
  /** Within the hour (DECISIONS.md, 2026-11-26, second entry). Wins over `urgent`. */
  emergency?: boolean;
  uploadIds: string[];
  /** Who sent the photos, as recorded when they were uploaded. */
  uploader: string;
  /** Who is logging the job, for the audit log. */
  actor: string;
  /** A report from a cleaner's or co-host's own team link: which owner's team member they are. */
  teamMemberId?: string | null;
  /** That owner's setting for them: ask the owner before anyone is sent. */
  askOwnerFirst?: boolean;
  /**
   * Is a guest staying at the time (DECISIONS.md, 2026-11-20, second entry)? Asked when the
   * owner, a manager or a team member logs a job. A guest's own report always means yes.
   */
  guestStaying?: GuestStaying | null;
  /** The staying guest, for this job's texts only: their first name and mobile. */
  guestName?: string | null;
  guestPhone?: string | null;
  /** "If nobody answers, the tradie may let themselves in." Defaults to yes with no guest, no with one. */
  mayLetIn?: boolean | null;
};

export type GuestStaying = "yes" | "no" | "not_sure";

/** The default answer to "may the tradie let themselves in?": yes with nobody staying, no when a guest is or might be. */
export function defaultMayLetIn(guest: GuestStaying | null | undefined): boolean {
  return guest !== "yes" && guest !== "not_sure";
}

export type NewJobResult =
  | { ok: true; job: Job; needsOwner: boolean }
  | { ok: false; reason: "not_member" | "market_closed" | "unknown_item" | "duplicate" | "invalid" | "card"; message: string; existingJobId?: string };

export { urgentIsIncluded };

export type PricePreview = {
  lines: Line[]; ownerCents: number; tradieCents: number; afterHours: boolean; urgentIncluded: boolean; responseHours: number;
  /** An emergency's promise in minutes (60). Null for standard and urgent, which are promised in hours. */
  responseMinutes: number | null;
};

/** The promise in whole hours, as kept on the job: an emergency's 60 minutes is 1 (the exact minutes are on the market). */
export function promiseHours(urgency: Urgency, tier: Pick<Tier, "responseHours" | "urgentResponseHours"> | null, emergencyMinutes: number): number {
  if (urgency === "emergency") return Math.max(1, Math.ceil(emergencyMinutes / 60));
  return urgency === "urgent" ? (tier?.urgentResponseHours ?? 4) : (tier?.responseHours ?? 24);
}

/** What a job would cost if logged right now. Used to show the price before the person commits. */
export async function previewPrice(
  db: Db, property: Property, input: { menuItemId: string | null; urgent: boolean; emergency?: boolean },
): Promise<PricePreview | null> {
  const market = await getMarket(db, property.market);
  if (!market) return null;
  const tier = property.tierId ? await getTier(db, property.tierId) : null;
  const item = input.menuItemId ? await getMenuItem(db, input.menuItemId) : null;
  if (input.menuItemId && (!item || item.market !== market.slug || !item.active)) return null;
  const at = now();
  const urgency = urgencyOf(input);
  const afterHours = isRush(urgency) && isAfterHours(at, market);
  const urgentIncluded = urgency === "urgent" && (await urgentIsIncluded(db, property, tier, market.timezone, at));
  const lines = initialLines(market, {
    item: item ? { name: item.name, ownerPriceCents: item.ownerPriceCents, tradiePayoutCents: item.tradiePayoutCents } : null,
    urgent: urgency === "urgent", emergency: urgency === "emergency", afterHours, urgentIncluded,
  });
  return {
    lines, afterHours, urgentIncluded,
    ownerCents: lines.reduce((sum, line) => sum + line.ownerCents, 0),
    tradieCents: lines.reduce((sum, line) => sum + line.tradieCents, 0),
    responseHours: promiseHours(urgency, tier, market.emergencyResponseMinutes),
    responseMinutes: urgency === "emergency" ? market.emergencyResponseMinutes : null,
  };
}

export type SendOutResult = "sent" | "declined" | "pending";

/**
 * Sends a job out once the hold on the owner's card is in place (DECISIONS.md, 2026-11-23). The job waits as
 * `awaiting_owner` with `card_hold = 'placing'` while the hold is asked for (outside any database step, as every
 * call to the payment company is). Held, or nothing to hold: it goes to tradies. Declined: it is a card problem,
 * like a card that has expired. The owner logging it themselves (`ownerLogging`) is refused and the job is
 * cancelled at no cost; anyone else's report waits (`card_hold = 'declined'`), the owner is texted, the team sees
 * it, and it goes out by itself once a new card is saved. An unclear answer leaves it waiting for the timer, which
 * asks again with the same key.
 */
export async function sendOut(db: Db, gatewayFor: GatewayFor, jobId: string, actor: string, options: { ownerLogging?: boolean } = {}): Promise<{ result: SendOutResult; reason?: string }> {
  const placed = await placeHold(db, gatewayFor, jobId, "booking");
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.status !== "awaiting_owner" || job.cardHold !== "placing") return { result: "pending" as const };
    if (placed.outcome === "pending") return { result: "pending" as const, reason: placed.reason };
    const context = await loadContext(tx, job);
    const { property } = context;
    const at = now();
    if (placed.outcome === "declined") {
      await audit(tx, { actor: "system", action: "job.hold_declined", entity: "job", entityId: job.id, amount: job.ownerTotalCents, currency: job.currency, detail: { reason: placed.reason, owner_logging: Boolean(options.ownerLogging) } });
      if (options.ownerLogging) {
        // The owner is on the screen: they are told to update the card, and nothing is left waiting.
        await tx.query(
          "update public.jobs set status = 'cancelled', card_hold = null, cancelled_at = $2::timestamptz, cancelled_by = 'system', cancel_reason = $3 where id = $1::uuid",
          [job.id, at.toISOString(), "The owner's card declined the hold, so the job was not sent"],
        );
        await raiseException(tx, {
          kind: "card_needed", market: job.market, propertyId: property.id,
          summary: `The owner of ${property.name} tried to log a job but their card declined the hold on its price (${placed.reason}). They have been asked to update it on the Billing page.`,
          dedupeKey: `card_needed:owner:${job.ownerId}:declined`,
        });
        return { result: "declined" as const, reason: placed.reason };
      }
      await tx.query("update public.jobs set card_hold = 'declined' where id = $1::uuid", [job.id]);
      await raiseException(tx, {
        kind: "card_needed", market: job.market, jobId: job.id,
        summary: `Job ${job.number} at ${property.name} is waiting before it goes to tradies: the owner's card declined the hold on its price (${placed.reason}). The owner has been texted to update it.`,
        dedupeKey: `card_needed:${job.id}`,
      });
      if (context.owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "card_needed", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.cardNeeded({ property: property.name, title: job.title, problem: "declined", link: `${baseUrl()}/app/billing` }), dedupeKey: `card_needed:${job.id}:declined`,
        });
      }
      return { result: "declined" as const, reason: placed.reason };
    }
    await tx.query("update public.jobs set card_hold = null where id = $1::uuid", [job.id]);
    await resolveExceptionsFor(tx, job.id, ["card_needed"], "Sent out");
    await startDispatch(tx, job.id, actor);
    return { result: "sent" as const };
  });
}

/**
 * Logs a job. A report from the owner or their team goes straight to tradies,
 * once the hold on the owner's card is in place (sendOut). A report from a
 * guest waits for the owner's go-ahead, unless the owner has switched that off
 * for the property.
 */
export async function createJob(db: Db, input: NewJob, gatewayFor: GatewayFor): Promise<NewJobResult> {
  const created = await createJobRecord(db, input);
  if (!created.ok || !created.goesOut) return created;
  const sent = await sendOut(db, gatewayFor, created.job.id, input.actor, { ownerLogging: input.reportedBy === "owner" });
  if (sent.result === "declined" && input.reportedBy === "owner") return { ok: false, reason: "card", message: cardProblemWords("declined") };
  const job = (await lockJob(db, created.job.id))!;
  return { ok: true, job, needsOwner: job.status === "awaiting_owner" && job.cardHold !== "placing" };
}

async function createJobRecord(db: Db, input: NewJob): Promise<(NewJobResult & { goesOut?: boolean })> {
  return db.tx(async (tx) => {
    const { property } = input;
    const market = await getMarket(tx, property.market);
    if (!market) return { ok: false, reason: "market_closed", message: "This property's area is not set up." };
    if (market.stage !== "live" && input.reportedBy !== "staff") {
      return { ok: false, reason: "market_closed", message: `We are not taking jobs in ${market.name} right now.` };
    }
    // An owner whose access our team removed (owner terms, section 8) cannot have jobs sent at their cost.
    const closed = await tx.query("select 1 from public.owners o join public.users u on u.id = o.user_id where o.id = $1::uuid and u.disabled_at is not null", [property.ownerId]);
    if (closed.length > 0) return { ok: false, reason: "not_member", message: "This account is closed. Contact us if you think this is a mistake." };
    if (property.status !== "active") {
      return {
        ok: false, reason: "not_member",
        message: property.status === "past_due"
          ? "The membership payment for this property did not go through, so new jobs are on hold until the card is updated."
          : "This property does not have an active membership.",
      };
    }
    const tier = property.tierId ? await getTier(tx, property.tierId) : null;
    const at = now();

    let title: string;
    let trade: string;
    let licenceRequired: boolean;
    let item: { name: string; ownerPriceCents: number; tradiePayoutCents: number } | null = null;

    if (input.menuItemId) {
      const found = await getMenuItem(tx, input.menuItemId);
      if (!found || found.market !== market.slug || !found.active) {
        return { ok: false, reason: "unknown_item", message: "That job is not on the menu any more. Please choose again." };
      }
      if (input.reportedBy === "guest" && !found.guestVisible) {
        return { ok: false, reason: "unknown_item", message: "That job is not on the menu any more. Please choose again." };
      }
      title = found.name;
      trade = found.trade;
      licenceRequired = found.licenceRequired;
      item = { name: found.name, ownerPriceCents: found.ownerPriceCents, tradiePayoutCents: found.tradiePayoutCents };
    } else {
      // Not on the menu. The owner picks the trade, or "Not sure" (DECISIONS.md, 2026-11-24): a "Not sure" job, or
      // one with no trade we know, keeps the trade "other" and goes to our team to pick, never to handymen by default.
      const chosen = findTrade(input.offMenuTrade ?? "") ?? findTrade(NOT_SURE_TRADE)!;
      const words = (input.offMenuTitle ?? "").replace(/\s+/g, " ").trim();
      if (words.length < 3) return { ok: false, reason: "invalid", message: "Tell us in a few words what is wrong." };
      title = words.slice(0, 110);
      trade = chosen.key;
      licenceRequired = chosen.licenceRequired;
    }

    // The same problem logged twice (cleaner and guest both report the blocked toilet) is one job.
    const duplicate = await tx.query<{ id: string }>(
      `select id from public.jobs
        where property_id = $1::uuid and status not in ('completed', 'cancelled') and created_at > $2::timestamptz
          and (($3::uuid is not null and menu_item_id = $3::uuid) or ($3::uuid is null and off_menu and lower(title) = lower($4)))
        order by created_at desc limit 1`,
      [property.id, addHours(at, -12).toISOString(), input.menuItemId, title],
    );
    if (duplicate[0]) {
      return { ok: false, reason: "duplicate", message: "That has already been reported and is being dealt with.", existingJobId: duplicate[0].id };
    }

    // A team member whose owner asked to say yes first waits for the owner, like a guest (DECISIONS.md, 2026-11-18).
    const teamAsks = input.reportedBy === "team" && Boolean(input.askOwnerFirst);
    const asksOwner = (input.reportedBy === "guest" && !property.guestAutoDispatch) || teamAsks;
    // Nothing goes out to tradies until the owner can be charged (DECISIONS.md, 2026-11-20, second entry): a saved
    // card that has not expired, and no failed charge still unpaid. An owner logging the job is told what to do;
    // anyone else's report waits for the owner, who is asked to update the card, and the team sees it.
    const problem = asksOwner ? null : await cardProblem(tx, property.ownerId, market.country, at, market.timezone);
    if (problem && input.reportedBy === "owner") {
      await raiseException(tx, {
        kind: "card_needed", market: market.slug, propertyId: property.id,
        summary: `The owner of ${property.name} tried to log a job but ${problem === "unpaid" ? "an earlier charge is unpaid" : problem === "expired" ? "their card has expired" : "has no card saved"}. They have been asked to update it on the Billing page.`,
        dedupeKey: `card_needed:owner:${property.ownerId}:${problem}`,
      });
      return { ok: false, reason: "card", message: cardProblemWords(problem) };
    }
    const needsOwner = asksOwner || problem !== null;
    // Guests in the house (DECISIONS.md, 2026-11-20, second entry). A guest's own report means one is staying.
    const guestStaying: GuestStaying | null = input.reportedBy === "guest" ? "yes" : (input.guestStaying ?? null);
    const guestPhone = guestStaying === "yes" || guestStaying === "not_sure" ? (input.guestPhone?.trim() || null) : null;
    const guestName = guestPhone || input.guestName ? (guestStaying === "yes" || guestStaying === "not_sure" ? (input.guestName?.trim().split(/\s+/)[0]?.slice(0, 40) || null) : null) : null;
    const mayLetIn = input.mayLetIn ?? defaultMayLetIn(guestStaying);
    // A guest, or a team member waiting on the owner, cannot commit the owner to a surcharge.
    // Their job starts as standard and the owner chooses when they give the go-ahead.
    const asked = urgencyOf(input);
    const urgency: Urgency = input.reportedBy === "guest" || teamAsks ? "standard" : asked;
    const urgent = isRush(urgency);
    const afterHours = urgent && isAfterHours(at, market);
    const urgentIncluded = urgency === "urgent" && (await urgentIsIncluded(tx, property, tier, market.timezone, at));
    const lines = initialLines(market, { item, urgent: urgency === "urgent", emergency: urgency === "emergency", afterHours, urgentIncluded });
    const responseHours = promiseHours(urgency, tier, market.emergencyResponseMinutes);
    const what = asked === "emergency" ? "an emergency" : "urgent";
    const urgentNote = input.reportedBy === "guest" ? `Guest says this is ${what}.` : `${input.reporterName?.trim() || "Your team"} says this is ${what}.`;
    const description = ((input.reportedBy === "guest" || teamAsks) && isRush(asked) ? `${urgentNote} ${input.description}` : input.description).trim().slice(0, 2000);

    const rows = await tx.query<JobRow>(
      `insert into public.jobs
         (created_at, property_id, owner_id, market, menu_item_id, off_menu, trade, licence_required, title, description,
          urgency, after_hours, reported_by, reporter_name, reporter_phone, status, tier_key, response_hours, currency, team_member_id,
          card_hold, guest_staying, guest_name, guest_phone, may_let_in)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::uuid,
               $21, $22, $23, $24, $25)
       returning *`,
      [
        at.toISOString(), property.id, property.ownerId, market.slug, input.menuItemId, !input.menuItemId, trade, licenceRequired, title,
        description, urgency, afterHours, input.reportedBy, input.reporterName?.trim().slice(0, 80) || null,
        // Every job waits here first: for the owner, for their card, or (going straight out) for the hold on the card.
        input.reporterPhone, "awaiting_owner", tier?.key ?? null, responseHours, market.currency,
        input.reportedBy === "team" ? (input.teamMemberId ?? null) : null,
        problem ?? (needsOwner ? null : "placing"), guestStaying, guestName, guestPhone, mayLetIn,
      ],
    );
    const job = rowToJob(rows[0]!);
    await insertLines(tx, job.id, lines, { at });
    const sum = await recalcTotals(tx, job.id, market.taxRate, market.taxRegistered);
    await attachUploads(tx, input.uploadIds, { kind: "report", uploadedBy: input.uploader, jobId: job.id, propertyId: property.id });
    await audit(tx, {
      actor: input.actor, action: "job.created", entity: "job", entityId: job.id, amount: sum.ownerCents, currency: market.currency,
      detail: {
        number: job.number, title, reported_by: input.reportedBy, urgent, ...(urgency === "emergency" ? { emergency: true } : {}), after_hours: afterHours, needs_owner: needsOwner,
        ...(input.reportedBy === "team" && input.teamMemberId ? { team_member: input.teamMemberId, reporter: input.reporterName ?? null } : {}),
      },
    });

    const context = await loadContext(tx, { ...job, ownerTotalCents: sum.ownerCents, tradieTotalCents: sum.tradieCents });
    const who = input.reporterName?.trim() || (input.reportedBy === "guest" ? "A guest" : "Your team");
    if (problem) {
      // Held for the card. The owner is asked to update it; the team sees it; the timer sends it out once it is sorted.
      await raiseException(tx, {
        kind: "card_needed", market: market.slug, jobId: job.id,
        summary: `Job ${job.number} at ${property.name} is waiting before it goes to tradies: ${problem === "unpaid" ? "an earlier charge is unpaid" : problem === "expired" ? "the owner's card has expired" : "the owner has no card saved"}. The owner has been texted to update it.`,
        dedupeKey: `card_needed:${job.id}`,
      });
      if (context.owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "card_needed", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.cardNeeded({ property: property.name, title, problem, link: `${baseUrl()}/app/billing` }), dedupeKey: `card_needed:${job.id}`,
        });
      }
    } else if (context.owner.phone) {
      if (needsOwner && teamAsks) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "team_report", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.teamReport({ reporter: who, property: property.name, title, link: ownerJobUrl(job) }), dedupeKey: `team_report:${job.id}`,
        });
      } else if (needsOwner) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "guest_report", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.guestReport({ property: property.name, title, link: ownerJobUrl(job) }), dedupeKey: `guest_report:${job.id}`,
        });
      } else if (input.reportedBy === "team" || input.reportedBy === "guest") {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "job_logged", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.jobLogged({ reporter: who, property: property.name, title, totalCents: sum.ownerCents, currency: market.currency, link: ownerJobUrl(job) }),
          dedupeKey: `job_logged:${job.id}`,
        });
      }
    }

    const saved = (await lockJob(tx, job.id))!;
    return { ok: true, job: saved, needsOwner, goesOut: !needsOwner };
  });
}

/**
 * The owner says yes to a guest's report, choosing standard or urgent. The job then goes to tradies, once the hold
 * on the owner's card is in place (sendOut). A declined hold: the owner is told, and the job waits for their card.
 */
export async function approveGuestReport(db: Db, jobId: string, choice: { urgent: boolean; emergency?: boolean }, actor: string, gatewayFor: GatewayFor): Promise<{ ok: true; job: Job } | { ok: false; message: string }> {
  const approved = await approveGuestReportRecord(db, jobId, choice, actor);
  if (!approved.ok) return approved;
  const sent = await sendOut(db, gatewayFor, jobId, actor);
  if (sent.result === "declined") return { ok: false, message: cardProblemWords("declined") };
  return { ok: true, job: (await lockJob(db, jobId))! };
}

async function approveGuestReportRecord(db: Db, jobId: string, choice: { urgent: boolean; emergency?: boolean }, actor: string): Promise<{ ok: true; job: Job } | { ok: false; message: string }> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.status !== "awaiting_owner" || job.cardHold) return { ok: false, message: "This job has already been dealt with." };
    const context = await loadContext(tx, job);
    const { market, property, tier } = context;
    const at = now();
    // The owner's card must be usable before anything is sent (DECISIONS.md, 2026-11-20, second entry).
    const problem = await cardProblem(tx, job.ownerId, market.country, at, market.timezone);
    if (problem) return { ok: false, message: cardProblemWords(problem) };
    const item = job.menuItemId ? await getMenuItem(tx, job.menuItemId) : null;
    const urgency = urgencyOf(choice);
    const afterHours = isRush(urgency) && isAfterHours(at, market);
    const urgentIncluded = urgency === "urgent" && (await urgentIsIncluded(tx, property, tier, market.timezone, at));
    const lines = initialLines(market, {
      item: item ? { name: item.name, ownerPriceCents: item.ownerPriceCents, tradiePayoutCents: item.tradiePayoutCents } : null,
      urgent: urgency === "urgent", emergency: urgency === "emergency", afterHours, urgentIncluded,
    });
    await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and status = 'active'", [jobId]);
    await insertLines(tx, jobId, lines, { at });
    await tx.query("update public.jobs set urgency = $2, after_hours = $3, response_hours = $4 where id = $1::uuid", [
      jobId, urgency, afterHours, promiseHours(urgency, tier, market.emergencyResponseMinutes),
    ]);
    const sum = await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
    await audit(tx, {
      actor, action: "job.approved_by_owner", entity: "job", entityId: jobId, amount: sum.ownerCents, currency: market.currency,
      detail: { urgent: isRush(urgency), ...(urgency === "emergency" ? { emergency: true } : {}), after_hours: afterHours },
    });
    // Next: the hold on the card, then out to tradies (sendOut).
    await tx.query("update public.jobs set card_hold = 'placing' where id = $1::uuid", [jobId]);
    return { ok: true, job: (await lockJob(tx, jobId))! };
  });
}

/**
 * Run by the timer: jobs held because the owner's card could not be charged,
 * sent out once it can (a new card saved, or the unpaid charge paid), with the
 * hold on the card placed first. A declined hold is tried again only once the
 * owner has saved a card since. A hold whose placing was cut off (a server
 * stopped, or the payment company's answer was unclear) is asked for again.
 */
export async function releaseCardHolds(db: Db, gatewayFor: GatewayFor): Promise<number> {
  const held = await db.query<{ id: string }>("select id from public.jobs where status = 'awaiting_owner' and card_hold is not null order by created_at limit 50");
  let sent = 0;
  for (const row of held) {
    const ready = await db.tx(async (tx) => {
      const job = await lockJob(tx, row.id);
      if (!job || job.status !== "awaiting_owner" || !job.cardHold) return false;
      const market = await getMarket(tx, job.market);
      if (!market) return false;
      const at = now();
      if (job.cardHold === "placing") {
        // Only one that is not being placed right now.
        const busy = await tx.query("select 1 from public.card_holds where job_id = $1::uuid and status = 'placing' and claimed_until > $2::timestamptz", [job.id, at.toISOString()]);
        const fresh = job.createdAt.getTime() > at.getTime() - 2 * 60_000;
        return busy.length === 0 && !fresh;
      }
      if (await cardProblem(tx, job.ownerId, market.country, at, market.timezone)) return false;
      if (job.cardHold === "declined") {
        const since = await tx.query(
          `select 1 from public.owner_billing b
            where b.owner_id = $1::uuid and b.country = $2
              and b.updated_at > coalesce((select max(h.created_at) from public.card_holds h where h.job_id = $3::uuid and h.status = 'declined'), '-infinity'::timestamptz)`,
          [job.ownerId, market.country, job.id],
        );
        if (since.length === 0) return false;
      }
      await tx.query("update public.jobs set card_hold = 'placing' where id = $1::uuid", [job.id]);
      await audit(tx, { actor: "system", action: "job.card_cleared", entity: "job", entityId: job.id, detail: { was: job.cardHold } });
      return true;
    });
    if (!ready) continue;
    const outcome = await sendOut(db, gatewayFor, row.id, "system");
    if (outcome.result === "sent") sent += 1;
  }
  return sent;
}

export type CancelResult = { ok: true; job: Job; callOutCents?: number } | { ok: false; message: string };

/**
 * Cancels a job (DECISIONS.md, 2026-11-23).
 *   - Before the tradie taps Arrived (even after "On my way"): free for the owner. The hold on their card is let go
 *     and nothing is charged. The tradie bears their travel (the tradie agreement says so).
 *   - After Arrived: the owner (or our team, on their behalf, with `callOut`) can still cancel, and the call-out is
 *     charged instead of the job, taken from the hold; the tradie is paid their share of it as for a call-out.
 *   - Our team can also cancel after Arrived without a charge (for example to charge only parts already bought).
 * A cancel after "On my way" or Arrived is looked at for patterns (src/lib/ops/patterns.ts), never counted as a decline.
 */
export async function cancelJob(db: Db, jobId: string, by: { actor: string; staff?: boolean; callOut?: boolean }, reason: string): Promise<CancelResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    if (job.status === "cancelled") return { ok: true, job };
    if (job.status === "completed") return { ok: false, message: "That job is already done. If something is wrong, use the button to tell us." };
    const onSite = job.status === "on_site" || job.status === "awaiting_approval";
    // After Arrived the owner pays the call-out. Our team chooses: the call-out, or no charge (callOut false).
    const chargeCallOut = onSite && (!by.staff || Boolean(by.callOut));
    const context = await loadContext(tx, job);
    const at = now();
    await tx.query("update public.offers set status = 'superseded' where job_id = $1::uuid and status = 'pending'", [jobId]);
    await tx.query("update public.quotes set status = 'withdrawn' where job_id = $1::uuid and status = 'pending'", [jobId]);
    await tx.query("update public.job_parts set status = 'void' where job_id = $1::uuid and status = 'pending'", [jobId]);
    let callOutCents: number | undefined;
    if (chargeCallOut) {
      const active = (await listLines(tx, jobId)).filter((line) => line.status === "active");
      await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and status in ('active', 'pending')", [jobId]);
      await tx.query("update public.job_parts set status = 'void' where job_id = $1::uuid and status = 'active'", [jobId]);
      await insertLines(tx, jobId, cancelledOnSiteLines(context.market, active, job.platformFeeBps), { at });
      const sum = await recalcTotals(tx, jobId, context.market.taxRate, context.market.taxRegistered);
      callOutCents = sum.ownerCents;
    }
    await tx.query(
      "update public.jobs set status = 'cancelled', cancelled_at = $2::timestamptz, cancelled_by = $3, cancel_reason = $4, card_hold = null where id = $1::uuid",
      [jobId, at.toISOString(), by.actor, reason.slice(0, 300)],
    );
    await resolveExceptionsFor(tx, jobId, ["nobody_accepted", "at_risk", "quote_waiting", "card_needed", "hold_failed", "trade_needed"], "Job cancelled");
    await audit(tx, { actor: by.actor, action: "job.cancelled", entity: "job", entityId: jobId, amount: callOutCents ?? null, currency: callOutCents ? job.currency : null, detail: { reason, was: job.status, call_out: callOutCents ?? null } });
    // A quote paid when it was approved, for work that now will not happen, is refunded (the timer does it).
    await tx.query("update public.job_prepayments set status = 'refund_due' where job_id = $1::uuid and status = 'succeeded'", [jobId]);
    const cancelled = (await lockJob(tx, jobId))!;
    if (chargeCallOut) {
      // Charged like a finished job: from the hold, at once; the tradie is paid at the usual time.
      await openSettlement(tx, { ...cancelled, completedAt: at }, context.market);
    } else {
      await releaseJobHolds(tx, jobId, "Cancelled before the tradie arrived: the owner pays nothing.", by.actor);
    }
    if (job.tradieId && (job.enRouteAt || job.arrivedAt)) await notePatterns(tx, cancelled, at);

    if (context.tradie?.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "job_cancelled", audience: "tradie", jobId, userId: context.tradie.userId,
        body: chargeCallOut && callOutCents
          ? texts.jobCancelledOnSiteTradie({ number: job.number, payoutCents: cancelled.tradieTotalCents, currency: job.currency })
          : texts.jobCancelledTradie({ number: job.number, suburb: context.property.suburb }),
        dedupeKey: `job_cancelled_tradie:${jobId}`,
      });
    }
    if (context.owner.phone && !by.actor.startsWith("owner:")) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "job_cancelled", audience: "owner", jobId, userId: context.owner.userId,
        body: chargeCallOut && callOutCents
          ? texts.jobCancelledCallOut({ title: job.title, amountCents: callOutCents, currency: job.currency })
          : texts.jobCancelledOwner({ title: job.title, property: context.property.name }),
        dedupeKey: `job_cancelled_owner:${jobId}`,
      });
    }
    return { ok: true, job: cancelled, callOutCents };
  });
}

/** Run by the timer: chases owners about guest reports, and gives up after a day. */
export async function chaseGuestReports(db: Db): Promise<{ reminded: number; expired: number }> {
  const at = now();
  const result = { reminded: 0, expired: 0 };

  const stale = await db.query<{ id: string }>(
    "select id from public.jobs where status = 'awaiting_owner' and created_at <= $1::timestamptz limit 100",
    [addHours(at, -24).toISOString()],
  );
  for (const row of stale) {
    const cancelled = await cancelJob(db, row.id, { actor: "system", staff: true }, "The owner did not answer within a day");
    if (cancelled.ok) result.expired += 1;
  }

  const waiting = await db.query<JobRow>(
    // A job waiting for the owner's card has its own text (card_needed): no "needs your yes" reminder for it.
    "select * from public.jobs where status = 'awaiting_owner' and card_hold is null and owner_reminded_at is null and created_at <= $1::timestamptz limit 100",
    [addHours(at, -1).toISOString()],
  );
  for (const row of waiting) {
    await db.tx(async (tx) => {
      const job = await lockJob(tx, row.id);
      if (!job || job.status !== "awaiting_owner") return;
      const context = await loadContext(tx, job);
      await tx.query("update public.jobs set owner_reminded_at = $2::timestamptz where id = $1::uuid", [job.id, at.toISOString()]);
      if (context.owner.phone) {
        await enqueue(tx, {
          channel: "sms", to: context.owner.phone, template: "guest_report_reminder", audience: "owner", jobId: job.id, userId: context.owner.userId,
          body: texts.guestReportReminder({ property: context.property.name, link: ownerJobUrl(job) }), dedupeKey: `guest_report_reminder:${job.id}`,
        });
      }
      result.reminded += 1;
    });
  }
  return result;
}

// advanceCascade is re-exported so callers that only deal with jobs need one import.
export { advanceCascade };
