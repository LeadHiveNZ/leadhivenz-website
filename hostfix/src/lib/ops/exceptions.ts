import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { alertEmailRecipients, alertSmsRecipients } from "@/lib/notify/alerts";
import { emails } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";

/**
 * THE DISPATCHER'S QUEUE. Anything that needs a person becomes one row here:
 * a job nobody accepted, a late job, a dispute, a failed payment. The
 * dispatcher sees only these. The goal is an empty list.
 */

export type ExceptionKind =
  | "nobody_accepted"
  | "at_risk"
  | "missed_window"
  | "dispute"
  | "payment_failed"
  | "payout_failed"
  | "quote_waiting"
  | "licence_expiring"
  /** A tradie's public liability insurance runs out within 30 days, or has run out. */
  | "insurance_expiring"
  | "message_failed"
  | "referral_due"
  | "chargeback"
  | "credit_failed"
  | "needs_review"
  /** A Portfolio's band needs a person: fewer than 10 properties, 100 and more, or a price that could not be changed. */
  | "portfolio_band";

/** The ones worth a text to the founder as well as an email. */
const URGENT: ExceptionKind[] = ["nobody_accepted", "missed_window", "dispute", "chargeback"];

export type ExceptionInput = {
  kind: ExceptionKind;
  summary: string;
  market?: string | null;
  jobId?: string | null;
  tradieId?: string | null;
  propertyId?: string | null;
  /** The same problem is only ever in the queue once. */
  dedupeKey: string;
};

export type StaffContacts = {
  /** Where "this needs you" emails and texts go, on top of every active staff member's email. */
  alertEmails: string[];
  alertPhones: string[];
  queueUrl: string;
};

/** Where alerts go unless told otherwise: the founder's alert addresses from the settings. */
function settingsContacts(): StaffContacts {
  return { alertEmails: alertEmailRecipients(), alertPhones: alertSmsRecipients(), queueUrl: `${baseUrl()}/admin/queue` };
}

let contacts: () => StaffContacts = settingsContacts;
/** For tests: choose who is alerted, or pass null to go back to the settings. */
export function setStaffContacts(provider: (() => StaffContacts) | null): void {
  contacts = provider ?? settingsContacts;
}

/**
 * Puts a problem in the queue. If the same problem was raised and resolved
 * before, it is re-opened. Returns true when it is newly open.
 */
export async function raiseException(db: Db, input: ExceptionInput): Promise<boolean> {
  const at = now();
  const rows = await db.query<{ id: string }>(
    `insert into public.exceptions (created_at, market, kind, job_id, tradie_id, property_id, summary, dedupe_key)
     values ($1::timestamptz, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7, $8)
     on conflict (dedupe_key) do update
       set status = 'open', created_at = excluded.created_at, summary = excluded.summary,
           resolved_at = null, resolved_by = null, resolution_note = null
       where public.exceptions.status = 'resolved'
     returning id`,
    [at.toISOString(), input.market ?? null, input.kind, input.jobId ?? null, input.tradieId ?? null, input.propertyId ?? null, input.summary, input.dedupeKey],
  );
  const id = rows[0]?.id;
  if (!id) return false;

  await audit(db, { actor: "system", action: "exception.raised", entity: input.jobId ? "job" : "exception", entityId: input.jobId ?? id, detail: { kind: input.kind, summary: input.summary } });

  const target = contacts();
  const staff = await db.query<{ email: string | null }>(
    `select u.email from public.staff s join public.users u on u.id = s.user_id
      where s.disabled_at is null and u.disabled_at is null and u.email is not null`,
  );
  const recipients = new Set<string>([...target.alertEmails, ...staff.map((row) => row.email!).filter(Boolean)]);
  const mail = emails.exception({ summary: input.summary, link: target.queueUrl });
  const stamp = at.getTime();
  for (const to of recipients) {
    await enqueue(db, { channel: "email", to, template: "exception", subject: mail.subject, body: mail.body, audience: "staff", jobId: input.jobId ?? null, dedupeKey: `exc:${id}:${stamp}:email:${to}` });
  }
  if (URGENT.includes(input.kind)) {
    for (const to of target.alertPhones) {
      await enqueue(db, { channel: "sms", to, template: "exception", body: `HostFix needs you: ${input.summary}`.slice(0, 300), audience: "staff", jobId: input.jobId ?? null, dedupeKey: `exc:${id}:${stamp}:sms:${to}` });
    }
  }
  return true;
}

export async function resolveException(db: Db, id: string, by: string, note: string | null): Promise<boolean> {
  const rows = await db.query(
    `update public.exceptions set status = 'resolved', resolved_at = $2::timestamptz, resolved_by = $3, resolution_note = $4
      where id = $1::uuid and status = 'open' returning id`,
    [id, now().toISOString(), by, note],
  );
  if (rows.length === 0) return false;
  await audit(db, { actor: by, action: "exception.resolved", entity: "exception", entityId: id, detail: { note } });
  return true;
}

/** Closes open problems of these kinds for a job, because the thing they were waiting for has happened. */
export async function resolveExceptionsFor(db: Db, jobId: string, kinds: ExceptionKind[], note: string): Promise<number> {
  const rows = await db.query(
    `update public.exceptions set status = 'resolved', resolved_at = $3::timestamptz, resolved_by = 'system', resolution_note = $4
      where job_id = $1::uuid and kind = any($2::text[]) and status = 'open' returning id`,
    [jobId, kinds, now().toISOString(), note],
  );
  return rows.length;
}

export type QueueItem = {
  id: string;
  createdAt: Date;
  kind: ExceptionKind;
  market: string | null;
  summary: string;
  status: "open" | "resolved";
  jobId: string | null;
  jobNumber: number | null;
  jobTitle: string | null;
  respondBy: Date | null;
  propertyName: string | null;
  tradieId: string | null;
  tradieName: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
};

/** The kinds where a promised time is running, so the deadline is what matters. */
export const TIME_BOUND: ExceptionKind[] = ["nobody_accepted", "at_risk", "missed_window", "quote_waiting"];

/** The queue. Open items first, the ones closest to their deadline at the top. */
export async function listExceptions(db: Db, filter: { status?: "open" | "resolved"; market?: string | null; limit?: number } = {}): Promise<QueueItem[]> {
  const rows = await db.query<{
    id: string; created_at: Date; kind: ExceptionKind; market: string | null; summary: string; status: "open" | "resolved";
    job_id: string | null; job_number: number | null; job_title: string | null; respond_by: Date | null;
    property_name: string | null; tradie_id: string | null; tradie_name: string | null;
    resolved_at: Date | null; resolved_by: string | null; resolution_note: string | null;
  }>(
    `select e.id, e.created_at, e.kind, e.market, e.summary, e.status, e.job_id, j.number as job_number, j.title as job_title,
            j.respond_by, coalesce(p.name, jp.name) as property_name, e.tradie_id, t.business_name as tradie_name,
            e.resolved_at, e.resolved_by, e.resolution_note
       from public.exceptions e
       left join public.jobs j on j.id = e.job_id
       left join public.properties jp on jp.id = j.property_id
       left join public.properties p on p.id = e.property_id
       left join public.tradies t on t.id = e.tradie_id
      where ($1::text is null or e.status = $1) and ($2::text is null or e.market = $2 or e.market is null)
      order by (e.status = 'open') desc,
               -- Jobs with a promised time running come first, soonest first. Everything else follows, oldest first.
               (e.kind = any($4::text[]) and j.respond_by is not null) desc,
               case when e.kind = any($4::text[]) then coalesce(j.respond_by, e.created_at) else e.created_at end asc,
               e.created_at desc
      limit $3`,
    [filter.status ?? null, filter.market ?? null, filter.limit ?? 200, TIME_BOUND],
  );
  return rows.map((row) => ({
    id: row.id, createdAt: new Date(row.created_at), kind: row.kind, market: row.market, summary: row.summary, status: row.status,
    jobId: row.job_id, jobNumber: row.job_number === null ? null : Number(row.job_number), jobTitle: row.job_title,
    respondBy: row.respond_by ? new Date(row.respond_by) : null, propertyName: row.property_name,
    tradieId: row.tradie_id, tradieName: row.tradie_name,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null, resolvedBy: row.resolved_by, resolutionNote: row.resolution_note,
  }));
}

export async function countOpenExceptions(db: Db): Promise<number> {
  const rows = await db.query<{ count: number }>("select count(*) as count from public.exceptions where status = 'open'");
  return Number(rows[0]?.count ?? 0);
}

/** What each kind means, in the words shown on screen. The runbook explains what to do. */
export const EXCEPTION_LABELS: Record<ExceptionKind, string> = {
  nobody_accepted: "Nobody accepted",
  at_risk: "Running late",
  missed_window: "Missed the promise",
  dispute: "Owner raised a problem",
  payment_failed: "Card payment failed",
  payout_failed: "Could not pay the tradie",
  quote_waiting: "Quote waiting on the owner",
  licence_expiring: "Licence running out",
  insurance_expiring: "Insurance running out",
  message_failed: "A text or email did not send",
  referral_due: "Referral reward to pay",
  chargeback: "Bank dispute (chargeback)",
  credit_failed: "Credit could not be applied",
  needs_review: "Needs a look",
  portfolio_band: "Portfolio price needs a person",
};

/** One line on what to do about each kind. The runbook (RUNBOOK.md) has the longer version. */
export const EXCEPTION_ACTIONS: Record<ExceptionKind, string> = {
  nobody_accepted: "Ring a tradie who does this trade. If they say yes, assign them on the job page. Or start the offers again.",
  at_risk: "The promised time is close. Ring the tradie and check they are on their way.",
  missed_window: "On Essential the call-out portion of the job comes off the owner's bill by itself. On a Portfolio property nothing was credited: ask the admin what to credit. Ring the owner to say sorry, and make sure a tradie is going.",
  dispute: "Read what the owner said, look at the photos, ring both sides, then settle it on the job page.",
  payment_failed: "The owner's card was declined. It is tried again each day. Ask them to update their card, then try again on the job page.",
  payout_failed: "The tradie could not be paid. Ask them to check their bank details in their profile, then try again on the job page.",
  quote_waiting: "The owner has not answered a quote and the tradie is waiting. Ring the owner, then record their answer on the job page.",
  licence_expiring: "Ask the tradie for their renewed licence, check it on the public register, and update it on their page.",
  insurance_expiring: "Ask the tradie for their renewed public liability policy and add the insurer, policy number and new expiry date on their page. No jobs are offered once it runs out.",
  message_failed: "A text or email did not arrive. Check the number or address, and contact the person another way.",
  referral_due: "Pay the reward by bank transfer, then mark it as paid under More, Referrals.",
  chargeback: "The owner's bank has reversed a payment. Tell the admin today: the bank sets a deadline to answer.",
  credit_failed: "A credit could not be passed to the payment company. Tell the admin.",
  needs_review: "Something happened outside the app that the app cannot sort out by itself. Read the note and tell the admin.",
  portfolio_band: "A manager's Portfolio retainer needs a decision. Tell the admin: they agree the price with the manager and set it on the manager's page under Owners.",
};
