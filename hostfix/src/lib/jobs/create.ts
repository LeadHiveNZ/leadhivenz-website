import { findTrade } from "@config/trades";
import { audit } from "@/lib/audit";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { advanceCascade, startDispatch } from "@/lib/dispatch/cascade";
import { attachUploads } from "@/lib/files/uploads";
import { getMarket, getMenuItem, getTier, type Tier } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { resolveExceptionsFor } from "@/lib/ops/exceptions";
import type { Property } from "@/lib/properties/service";
import { isAfterHours, monthBounds, monthKey } from "@/lib/time";
import { loadContext, ownerJobUrl } from "./context";
import { initialLines, type Line } from "./pricing";
import { insertLines, lockJob, recalcTotals, rowToJob, type JobRow } from "./store";
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
  uploadIds: string[];
  /** Who sent the photos, as recorded when they were uploaded. */
  uploader: string;
  /** Who is logging the job, for the audit log. */
  actor: string;
};

export type NewJobResult =
  | { ok: true; job: Job; needsOwner: boolean }
  | { ok: false; reason: "not_member" | "market_closed" | "unknown_item" | "duplicate" | "invalid"; message: string; existingJobId?: string };

/** How many included urgent call-outs this property has already used this calendar month. */
async function includedUrgentUsed(db: Db, propertyId: string, month: string, timeZone: string): Promise<number> {
  const { start, end } = monthBounds(month, timeZone);
  const rows = await db.query<{ count: number }>(
    `select count(*) as count
       from public.jobs j
      where j.property_id = $1::uuid and j.status <> 'cancelled'
        and j.created_at >= $2::timestamptz and j.created_at < $3::timestamptz
        and exists (select 1 from public.job_lines l where l.job_id = j.id and l.kind = 'urgent' and l.owner_cents = 0 and l.status = 'active')`,
    [propertyId, start.toISOString(), end.toISOString()],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Whether the owner's tier covers the urgent surcharge for a job logged now. */
export async function urgentIsIncluded(db: Db, property: Property, tier: Tier | null, timeZone: string, at: Date): Promise<boolean> {
  if (!tier?.urgentIncluded) return false;
  if (tier.urgentIncludedPerMonth === null) return true;
  return (await includedUrgentUsed(db, property.id, monthKey(at, timeZone), timeZone)) < tier.urgentIncludedPerMonth;
}

export type PricePreview = { lines: Line[]; ownerCents: number; tradieCents: number; afterHours: boolean; urgentIncluded: boolean; responseHours: number };

/** What a job would cost if logged right now. Used to show the price before the person commits. */
export async function previewPrice(
  db: Db, property: Property, input: { menuItemId: string | null; urgent: boolean },
): Promise<PricePreview | null> {
  const market = await getMarket(db, property.market);
  if (!market) return null;
  const tier = property.tierId ? await getTier(db, property.tierId) : null;
  const item = input.menuItemId ? await getMenuItem(db, input.menuItemId) : null;
  if (input.menuItemId && (!item || item.market !== market.slug || !item.active)) return null;
  const at = now();
  const afterHours = input.urgent && isAfterHours(at, market);
  const urgentIncluded = input.urgent && (await urgentIsIncluded(db, property, tier, market.timezone, at));
  const lines = initialLines(market, {
    item: item ? { name: item.name, ownerPriceCents: item.ownerPriceCents, tradiePayoutCents: item.tradiePayoutCents } : null,
    urgent: input.urgent, afterHours, urgentIncluded,
  });
  return {
    lines, afterHours, urgentIncluded,
    ownerCents: lines.reduce((sum, line) => sum + line.ownerCents, 0),
    tradieCents: lines.reduce((sum, line) => sum + line.tradieCents, 0),
    responseHours: input.urgent ? (tier?.urgentResponseHours ?? 4) : (tier?.responseHours ?? 24),
  };
}

/**
 * Logs a job. A report from the owner or their team goes straight to tradies.
 * A report from a guest waits for the owner's go-ahead, unless the owner has
 * switched that off for the property.
 */
export async function createJob(db: Db, input: NewJob): Promise<NewJobResult> {
  return db.tx(async (tx) => {
    const { property } = input;
    const market = await getMarket(tx, property.market);
    if (!market) return { ok: false, reason: "market_closed", message: "This property's area is not set up." };
    if (market.stage !== "live" && input.reportedBy !== "staff") {
      return { ok: false, reason: "market_closed", message: `We are not taking jobs in ${market.name} right now.` };
    }
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
      const chosen = findTrade(input.offMenuTrade ?? "") ?? findTrade("handyman")!;
      const words = (input.offMenuTitle ?? "").replace(/\s+/g, " ").trim();
      if (words.length < 3) return { ok: false, reason: "invalid", message: "Tell us in a few words what is wrong." };
      title = words.slice(0, 110);
      trade = chosen.key === "other" ? "handyman" : chosen.key;
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

    const needsOwner = input.reportedBy === "guest" && !property.guestAutoDispatch;
    // A guest cannot commit the owner to a surcharge. Their job starts as
    // standard and the owner chooses when they give the go-ahead.
    const urgent = input.reportedBy === "guest" ? false : input.urgent;
    const afterHours = urgent && isAfterHours(at, market);
    const urgentIncluded = urgent && (await urgentIsIncluded(tx, property, tier, market.timezone, at));
    const lines = initialLines(market, { item, urgent, afterHours, urgentIncluded });
    const responseHours = urgent ? (tier?.urgentResponseHours ?? 4) : (tier?.responseHours ?? 24);
    const description = (input.reportedBy === "guest" && input.urgent ? `Guest says this is urgent. ${input.description}` : input.description).trim().slice(0, 2000);

    const rows = await tx.query<JobRow>(
      `insert into public.jobs
         (created_at, property_id, owner_id, market, menu_item_id, off_menu, trade, licence_required, title, description,
          urgency, after_hours, reported_by, reporter_name, reporter_phone, status, tier_key, response_hours, currency)
       values ($1::timestamptz, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       returning *`,
      [
        at.toISOString(), property.id, property.ownerId, market.slug, input.menuItemId, !input.menuItemId, trade, licenceRequired, title,
        description, urgent ? "urgent" : "standard", afterHours, input.reportedBy, input.reporterName?.trim().slice(0, 80) || null,
        input.reporterPhone, needsOwner ? "awaiting_owner" : "offering", tier?.key ?? null, responseHours, market.currency,
      ],
    );
    const job = rowToJob(rows[0]!);
    await insertLines(tx, job.id, lines, { at });
    const sum = await recalcTotals(tx, job.id, market.taxRate, market.taxRegistered);
    await attachUploads(tx, input.uploadIds, { kind: "report", uploadedBy: input.uploader, jobId: job.id, propertyId: property.id });
    await audit(tx, {
      actor: input.actor, action: "job.created", entity: "job", entityId: job.id, amount: sum.ownerCents, currency: market.currency,
      detail: { number: job.number, title, reported_by: input.reportedBy, urgent, after_hours: afterHours, needs_owner: needsOwner },
    });

    const context = await loadContext(tx, { ...job, ownerTotalCents: sum.ownerCents, tradieTotalCents: sum.tradieCents });
    const who = input.reporterName?.trim() || (input.reportedBy === "guest" ? "A guest" : "Your team");
    if (context.owner.phone) {
      if (needsOwner) {
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

    if (!needsOwner) await startDispatch(tx, job.id, input.actor);
    const saved = (await lockJob(tx, job.id))!;
    return { ok: true, job: saved, needsOwner };
  });
}

/** The owner says yes to a guest's report, choosing standard or urgent. The job then goes to tradies. */
export async function approveGuestReport(db: Db, jobId: string, choice: { urgent: boolean }, actor: string): Promise<Job | null> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.status !== "awaiting_owner") return null;
    const context = await loadContext(tx, job);
    const { market, property, tier } = context;
    const at = now();
    const item = job.menuItemId ? await getMenuItem(tx, job.menuItemId) : null;
    const afterHours = choice.urgent && isAfterHours(at, market);
    const urgentIncluded = choice.urgent && (await urgentIsIncluded(tx, property, tier, market.timezone, at));
    const lines = initialLines(market, {
      item: item ? { name: item.name, ownerPriceCents: item.ownerPriceCents, tradiePayoutCents: item.tradiePayoutCents } : null,
      urgent: choice.urgent, afterHours, urgentIncluded,
    });
    await tx.query("update public.job_lines set status = 'void' where job_id = $1::uuid and status = 'active'", [jobId]);
    await insertLines(tx, jobId, lines, { at });
    await tx.query("update public.jobs set urgency = $2, after_hours = $3, response_hours = $4 where id = $1::uuid", [
      jobId, choice.urgent ? "urgent" : "standard", afterHours, choice.urgent ? (tier?.urgentResponseHours ?? 4) : (tier?.responseHours ?? 24),
    ]);
    const sum = await recalcTotals(tx, jobId, market.taxRate, market.taxRegistered);
    await audit(tx, { actor, action: "job.approved_by_owner", entity: "job", entityId: jobId, amount: sum.ownerCents, currency: market.currency, detail: { urgent: choice.urgent, after_hours: afterHours } });
    await startDispatch(tx, jobId, actor);
    return lockJob(tx, jobId);
  });
}

export type CancelResult = { ok: true; job: Job } | { ok: false; message: string };

/**
 * Cancels a job. Owners and reporters can cancel until the tradie has
 * arrived. After that it takes a person on the team, because someone has
 * turned up and money may be owed.
 */
export async function cancelJob(db: Db, jobId: string, by: { actor: string; staff?: boolean }, reason: string): Promise<CancelResult> {
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job) return { ok: false, message: "We could not find that job." };
    if (job.status === "cancelled") return { ok: true, job };
    if (job.status === "completed") return { ok: false, message: "That job is already done. If something is wrong, use the button to tell us." };
    if ((job.status === "on_site" || job.status === "awaiting_approval") && !by.staff) {
      return { ok: false, message: "The tradie is already there, so this cannot be cancelled here. Reply to our text or contact us and we will sort it out." };
    }
    const context = await loadContext(tx, job);
    const at = now();
    await tx.query("update public.offers set status = 'superseded' where job_id = $1::uuid and status = 'pending'", [jobId]);
    await tx.query("update public.quotes set status = 'withdrawn' where job_id = $1::uuid and status = 'pending'", [jobId]);
    await tx.query(
      "update public.jobs set status = 'cancelled', cancelled_at = $2::timestamptz, cancelled_by = $3, cancel_reason = $4 where id = $1::uuid",
      [jobId, at.toISOString(), by.actor, reason.slice(0, 300)],
    );
    await resolveExceptionsFor(tx, jobId, ["nobody_accepted", "at_risk", "quote_waiting"], "Job cancelled");
    await audit(tx, { actor: by.actor, action: "job.cancelled", entity: "job", entityId: jobId, detail: { reason, was: job.status } });

    if (context.tradie?.phone) {
      await enqueue(tx, {
        channel: "sms", to: context.tradie.phone, template: "job_cancelled", audience: "tradie", jobId, userId: context.tradie.userId,
        body: texts.jobCancelledTradie({ number: job.number, suburb: context.property.suburb }), dedupeKey: `job_cancelled_tradie:${jobId}`,
      });
    }
    if (context.owner.phone && !by.actor.startsWith("owner:")) {
      await enqueue(tx, {
        channel: "sms", to: context.owner.phone, template: "job_cancelled", audience: "owner", jobId, userId: context.owner.userId,
        body: texts.jobCancelledOwner({ title: job.title, property: context.property.name }), dedupeKey: `job_cancelled_owner:${jobId}`,
      });
    }
    return { ok: true, job: (await lockJob(tx, jobId))! };
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
    "select * from public.jobs where status = 'awaiting_owner' and owner_reminded_at is null and created_at <= $1::timestamptz limit 100",
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
