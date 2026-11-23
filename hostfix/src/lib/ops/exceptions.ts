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
  | "portfolio_band"
  /** A normal job nobody has accepted after the market's hours (3 by default): ring round (DECISIONS.md, 2026-11-18). */
  | "not_taken_yet"
  /**
   * The tradie tapped Arrived with no location, or far from the property. Raised
   * until 19 November 2026; since then such a tap is one of the job's flags
   * instead, and the owner is asked first (DECISIONS.md, 2026-11-19).
   */
  | "arrival_unverified"
  /** The owner pressed "The tradie isn't here". */
  | "owner_says_absent"
  /** An accepted job reached its promised time with nobody on site: call the tradie. */
  | "no_show"
  /** A tradie has reached 3 no-shows in 90 days: talk to them. Never removed automatically. */
  | "tradie_review"
  /** A flagged job whose owner did not answer in 48 hours, by a tradie who is not yet trusted: Approve or Hold the payment. */
  | "job_check"
  /** A tradie has had 3 flagged jobs in 90 days: look at them and talk to the tradie. Never removed automatically. */
  | "tradie_flags"
  /** A parts receipt the checks flagged: old, for more than its total, or used twice. Holds the payment until Approve or Hold. */
  | "receipt_check"
  /** A job waiting before it goes out because the owner's card cannot be charged, or an owner refused for the same reason. */
  | "card_needed"
  /** All the card tries failed: HostFix paid the tradie, and the owner owes it. Chase the owner. */
  | "owner_owes"
  /** A chargeback was lost: decide whether it was the tradie's fault. */
  | "chargeback_lost"
  /** The owner says "This was the job I described" after the tradie said it was not: Pay call-out or No call-out. */
  | "not_described"
  /** A tradie turns far more menu jobs into quotes than others: talk to them. Never removed automatically. */
  | "quote_rate"
  /** A tradie replied STOP to our texts: offers go by app notification or email only. */
  | "sms_opted_out"
  /**
   * A tradie paid ahead (the owner's card has not paid) is waiting because the Stripe balance HostFix pays
   * from is too low. Tried again on every timer run (DECISIONS.md, 2026-11-21).
   */
  | "platform_balance"
  /** The same tradie and owner: 2 or more accepted jobs in 90 days that ended without Job done (DECISIONS.md, 2026-11-23). A look, never a removal. */
  | "pattern_pair"
  /** A tradie with 3 or more accepted jobs in 90 days cancelled after On my way (DECISIONS.md, 2026-11-23). A look, never a removal. */
  | "pattern_cancels"
  /** A part picked from the price list but priced well over it (more than 1.5 times). A look; nothing is held. */
  | "part_price"
  /** The owner's card declined when the hold on an open job was renewed. The job stays booked: ring the owner. */
  | "hold_failed"
  /** Big work's 50% deposit from the owner's bank did not go through (DECISIONS.md, 2026-11-23, second entry). */
  | "deposit_failed";

/** The ones worth a text to the founder as well as an email. */
const URGENT: ExceptionKind[] = ["nobody_accepted", "missed_window", "dispute", "chargeback", "not_taken_yet", "owner_says_absent", "no_show"];

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
export const TIME_BOUND: ExceptionKind[] = ["nobody_accepted", "at_risk", "missed_window", "quote_waiting", "not_taken_yet", "no_show"];

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
  not_taken_yet: "Nobody has taken it yet",
  arrival_unverified: "Arrival not confirmed",
  owner_says_absent: "Owner says the tradie isn't there",
  no_show: "Tradie not there: call them",
  tradie_review: "Tradie to talk to",
  job_check: "Check a job, then pay or hold",
  tradie_flags: "Tradie's jobs keep being flagged",
  receipt_check: "Check a parts receipt",
  card_needed: "Owner's card needs updating",
  owner_owes: "Owner owes us for a job",
  chargeback_lost: "Chargeback lost: whose fault?",
  not_described: "Owner says it was the job described",
  quote_rate: "Tradie quotes a lot of menu jobs",
  sms_opted_out: "Tradie stopped our texts",
  platform_balance: "Top up the Stripe balance",
  pattern_pair: "Worth a look: the same tradie and owner",
  pattern_cancels: "Worth a look: cancelled after On my way",
  part_price: "Worth a look: a part priced over the list",
  hold_failed: "Owner's card declined renewing a hold",
  deposit_failed: "Deposit for big work did not go through",
};

/** One line on what to do about each kind. The runbook (RUNBOOK.md) has the longer version. */
export const EXCEPTION_ACTIONS: Record<ExceptionKind, string> = {
  nobody_accepted: "Ring a tradie who does this trade. If they say yes, assign them on the job page. Or start the offers again.",
  at_risk: "The promised time is close. Ring the tradie and check they are on their way.",
  missed_window: "Nobody was on site by the promised time. Nothing is credited automatically any more. Ring the owner to say sorry, and make sure a tradie is going.",
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
  not_taken_yet: "Nobody has accepted this job yet and the owner has been told we are ringing round. Ring tradies who do this trade and assign one on the job page.",
  arrival_unverified: "The Arrived tap had no location, or was far from where tradies usually are at this house. Ring the tradie and check they are really there. If not, ring the owner.",
  owner_says_absent: "The owner says the tradie is not at the property although the app says they arrived. Ring the tradie now, then ring the owner back.",
  no_show: "A tradie accepted this job and is not on site by the promised time. Call the tradie. If they are not coming, cancel and log the job again so it goes to someone else.",
  tradie_review: "This tradie has not turned up for 3 accepted jobs in 90 days. Talk to them before deciding anything. Only a person can pause or remove a tradie.",
  job_check: "The app could not confirm this job (location, photos or time on site) and the owner did not answer. Look at the before and after photos. If it looks done, press Approve. If not, press Hold and ring the owner and the tradie.",
  tradie_flags: "This tradie has had 3 or more jobs in 90 days the app could not confirm. Look at those jobs, then talk to them. Only a person can pause or remove a tradie.",
  receipt_check: "Open the job and the receipt. If the part and amount are right, press Approve. If not, press Hold and ring the tradie. The owner never sees the receipt.",
  card_needed: "Nothing goes to tradies until the owner's card can be charged. They have been texted. Ring them if it is urgent: the job goes out by itself a minute after the card is updated.",
  owner_owes: "The card was tried four times. The tradie has been paid by us anyway. Ring the owner, ask them to update their card on the Billing page (it is tried again straight away), and no new jobs go out for them until it is paid.",
  chargeback_lost: "The owner's bank sided with the owner. Open the job and decide: the tradie's fault (bad work, or not there) takes it back from their next payments, never more than half of one; not their fault, and HostFix carries it.",
  not_described: "The tradie said this was not the job described; the owner says it was. Look at the tradie's photos and reason on the job page, then press Pay call-out or No call-out.",
  quote_rate: "This tradie turns far more of their menu jobs into quotes, or \"not the job described\", than others in the market. Look at those jobs on their page, then talk to them. Only a person can pause or remove a tradie.",
  sms_opted_out: "This tradie replied STOP, so we cannot text them. Offers reach them only by app notification or email. Ring them and ask them to turn on app notifications, or to reply START.",
  platform_balance: "The owner's card has not paid, so HostFix pays the tradie from its own Stripe balance, and there is not enough there yet (card money takes a few days to arrive). Tell the admin to add money to the HostFix Stripe balance. The payment is tried again every minute and goes by itself once there is enough. Nothing to do on the job page.",
  pattern_pair: "This tradie and this owner have had 2 or more accepted jobs in 90 days that ended without Job done. It can be ordinary (a guest fixed it, plans changed). Look at the jobs, and if it keeps happening have a friendly word with each: a job booked in the app is finished and paid in the app. Never a removal by itself, and never counted as a decline.",
  pattern_cancels: "3 or more of this tradie's accepted jobs in 90 days were cancelled after they tapped On my way. Look at who cancelled and why. Talk to them if it keeps happening. Never a removal by itself, and never counted as a decline.",
  part_price: "A part picked from the price list was priced at more than 1.5 times its list price. Nothing is held. Look at it, and if it seems high, request the receipt on the job page or ring the tradie.",
  hold_failed: "The owner's card declined when the hold on this open job was renewed. The job is still booked and the tradie is still going. Ring the owner and ask them to update their card on the Billing page: it is tried again by itself.",
  deposit_failed: "The 50% deposit for work over NZ$1,000 did not come through from the owner's bank (or came back). The quote is not approved and the tradie has been told not to start. Ring the owner: they can approve it again on the job page, by bank or by card (card is charged at once). If the work is no longer wanted, decline the quote on the job page.",
};
