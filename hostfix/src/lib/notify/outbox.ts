import { brand } from "@config/brand";
import { addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { demoModeAllowed } from "@/lib/env";
import { emailSettings, sendEmail } from "./email";
import { toGsm7 } from "./gsm";
import { sendSms, smsSettings } from "./sms";
import { STOP_LINE } from "./messages";
import { pushSettings, sendPush, type PushSender } from "./push";
import { raiseException } from "@/lib/ops/exceptions";

/**
 * THE OUTBOX. Every text and email the product sends is first written to the
 * notifications table, in the same database step as the change that caused
 * it. So a job can never change state without its message being queued, and a
 * message is never sent for a change that was undone.
 *
 * Sending happens straight afterwards (and again from the timer for anything
 * that failed). A message is tried up to three times.
 *
 * In demo mode nothing is really sent. The message is marked "demo" and shows
 * up on the demo phone screen instead.
 */

export type Audience = "owner" | "tradie" | "reporter" | "staff";

export type OutMessage = {
  channel: "sms" | "email" | "push";
  /** A mobile in international format, or an email address. */
  to: string;
  /** A short name for the kind of message, for the log. */
  template: string;
  body: string;
  /** Email only. */
  subject?: string;
  audience?: Audience;
  jobId?: string | null;
  userId?: string | null;
  leadId?: string | null;
  /** A message with the same key is only ever queued once. */
  dedupeKey?: string | null;
  sendAfter?: Date;
  /** A job offer: with app notifications on, its text waits this many minutes and goes only if the offer is still unopened. */
  offer?: { id: string; textAfterMinutes: number } | null;
  /** Internal: a text held back behind an offer's app notification. */
  unlessOfferOpened?: string | null;
};

export const MAX_SEND_ATTEMPTS = 3;
const RETRY_MINUTES = [1, 5, 15];

/**
 * WHO GETS WHAT, AND HOW (DECISIONS.md, 2026-11-20, third entry). Texts are
 * kept for what needs the person now: offers, "job yours", booking and arrival
 * times, on the way, arrived, not taken yet, a later time, quotes to approve,
 * sign-in codes and the guest's texts. These go by email instead when the
 * person has an email address: job done (with the photos), receipts, payment
 * and payout notices.
 */
export const EMAIL_INSTEAD: Record<string, string> = {
  job_done: "Your job is done",
  job_check: "Your job is done: can you check it?",
  bought_parts_charged: "Parts charged for a cancelled job",
  payment_failed: "We could not charge your card",
  membership_failed: "Your membership payment did not go through",
  dispute_received: "We have your message about a job",
  receipt_missing_refunded: "A part refunded: no receipt",
  payout_sent: "Your payment is on its way",
  payout_on_hold: "Your payment is on hold",
  payout_check_held: "Your payment is on hold",
  receipt_check_held: "Your payment is on hold",
  balance_owed: "What you owe after a chargeback",
};

/** Templates that are never held back by STOP: a person signing in asked for the code. */
const ALWAYS_TEXT = new Set(["sign_in_code", "reply_answer"]);

type Recipient = { email: string | null; push: boolean; tradieId: string | null; market: string | null };

async function recipient(db: Db, userId: string | null | undefined): Promise<Recipient | null> {
  if (!userId) return null;
  const rows = await db.query<{ email: string | null; push: boolean; tradie_id: string | null; market: string | null }>(
    `select u.email, exists (select 1 from public.push_subscriptions p where p.user_id = u.id) as push, t.id as tradie_id, t.market
       from public.users u left join public.tradies t on t.user_id = u.id where u.id = $1::uuid`,
    [userId],
  );
  const row = rows[0];
  return row ? { email: row.email, push: Boolean(row.push), tradieId: row.tradie_id, market: row.market } : null;
}

export async function smsOptedOut(db: Db, phone: string): Promise<boolean> {
  const rows = await db.query("select 1 from public.sms_opt_outs where phone = $1 and resumed_at is null", [phone]);
  return rows.length > 0;
}

/**
 * Queues a message, choosing how it goes. A text may become an email (see
 * EMAIL_INSTEAD), an app notification (an owner with notifications on; a job
 * offer goes by notification first and by text a few minutes later only if it
 * has not been opened), or nothing at all for a number that replied STOP (an
 * offer then goes by notification or email, and the team is told). Every job
 * offer, and the first text a number ever gets from us, ends "Reply STOP to
 * opt out". Returns false if a message with the same dedupe key was already
 * queued.
 */
export async function enqueue(db: Db, message: OutMessage): Promise<boolean> {
  if (message.channel !== "sms" || ALWAYS_TEXT.has(message.template)) return insertMessage(db, message);
  const person = await recipient(db, message.userId);
  const optedOut = await smsOptedOut(db, message.to);
  const isOffer = message.template === "offer";

  const subject = EMAIL_INSTEAD[message.template];
  if (subject && person?.email) return insertMessage(db, { ...message, channel: "email", to: person.email, subject: `${brand.name}: ${subject}` });

  if (isOffer && person?.push && message.userId) {
    const pushed = await insertMessage(db, { ...message, channel: "push", to: message.userId });
    if (!optedOut && pushed) {
      await insertMessage(db, {
        ...message, body: `${message.body} ${STOP_LINE}`, dedupeKey: message.dedupeKey ? `${message.dedupeKey}:text` : null,
        sendAfter: addMinutes(now(), message.offer?.textAfterMinutes ?? 3), unlessOfferOpened: message.offer?.id ?? null,
      });
    }
    return pushed;
  }
  if (message.audience === "owner" && person?.push && message.userId) return insertMessage(db, { ...message, channel: "push", to: message.userId });

  if (optedOut) {
    let queued = false;
    if (person?.push && message.userId) queued = await insertMessage(db, { ...message, channel: "push", to: message.userId });
    else if (person?.email) queued = await insertMessage(db, { ...message, channel: "email", to: person.email, subject: `${brand.name}: ${isOffer ? "a job offer" : "an update"}` });
    if (isOffer && person?.tradieId) {
      await raiseException(db, {
        kind: "sms_opted_out", market: person.market, tradieId: person.tradieId,
        summary: `A tradie whose mobile ${message.to} replied STOP was offered a job. It went ${person.push ? "by app notification" : person.email ? "by email" : "nowhere: they have no app notifications or email"}. Ring them.`,
        dedupeKey: `sms_opted_out:${person.tradieId}`,
      });
    }
    return queued;
  }

  const firstEver = (await db.query("select 1 from public.notifications where channel = 'sms' and recipient = $1 and status <> 'skipped' limit 1", [message.to])).length === 0;
  const body = isOffer || firstEver ? `${message.body} ${STOP_LINE}` : message.body;
  return insertMessage(db, { ...message, body });
}

async function insertMessage(db: Db, message: OutMessage): Promise<boolean> {


  const at = now();
  const body = message.channel === "sms" ? toGsm7(message.body).trim() : message.body.trim();
  if (!message.to || !body) return false;
  const rows = await db.query(
    `insert into public.notifications
       (created_at, channel, template, recipient, status, body, subject, audience, job_id, user_id, lead_id, dedupe_key, send_after, unless_offer_opened)
     values ($1::timestamptz, $2, $3, $4, 'queued', $5, $6, $7, $8::uuid, $9::uuid, $10::uuid, $11, $12::timestamptz, $13::uuid)
     on conflict (dedupe_key) where dedupe_key is not null do nothing
     returning id`,
    [
      at.toISOString(), message.channel, message.template, message.to, body, message.subject ?? null,
      message.audience ?? null, message.jobId ?? null, message.userId ?? null, message.leadId ?? null,
      message.dedupeKey ?? null, (message.sendAfter ?? at).toISOString(), message.unlessOfferOpened ?? null,
    ],
  );
  return rows.length > 0;
}

type Queued = {
  id: string; channel: "sms" | "email" | "push"; recipient: string; body: string; subject: string | null;
  template: string; attempts: number; job_id: string | null; unless_offer_opened: string | null;
};

export type FlushDeps = {
  fetchImpl?: typeof fetch;
  /** Called when a message has failed for good, so it can be put in front of a person. */
  onGiveUp?: (db: Db, message: { id: string; channel: string; recipient: string; template: string; jobId: string | null; error: string }) => Promise<void>;
  log?: Pick<Console, "error">;
  /** Sends app notifications. Left out: the real push service when its keys are set. */
  sendPush?: PushSender | null;
};

function emailHtml(body: string): string {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:${brand.colours.ink}">${linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px">${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
}

/** Hides the secret part of one-tap links once a message has gone, so the log cannot be used to open them. */
export function redactLinks(body: string): string {
  return body.replace(/(\/(?:o|j|q)\/)[A-Za-z0-9._-]+/g, "$1...");
}

/**
 * Sends everything that is due. Safe to call from anywhere, any number of
 * times: each message is claimed first, so two callers never send it twice.
 */
export async function flushOutbox(db: Db, deps: FlushDeps = {}): Promise<{ sent: number; failed: number; demo: number }> {
  const at = now();
  const result = { sent: 0, failed: 0, demo: 0 };

  // Claim a batch: bump the attempt count and push the next try into the
  // future. If this server dies mid-send, the message comes round again.
  const claimed = await db.query<Queued>(
    `update public.notifications n
        set attempts = n.attempts + 1,
            send_after = $2::timestamptz
      where n.id in (
        select id from public.notifications
         where status = 'queued' and send_after <= $1::timestamptz
         order by created_at
         limit 25
         for update skip locked)
      returning n.id, n.channel, n.recipient, n.body, n.subject, n.template, n.attempts, n.job_id, n.unless_offer_opened`,
    [at.toISOString(), addMinutes(at, RETRY_MINUTES[0]!).toISOString()],
  );
  if (claimed.length === 0) return result;

  const sms = smsSettings();
  const email = emailSettings();

  for (const message of claimed) {
    // A text held back behind an offer's app notification: not sent once the offer has been opened or has closed.
    if (message.unless_offer_opened) {
      const offer = await db.query<{ opened_at: Date | null; status: string }>("select opened_at, status from public.offers where id = $1::uuid", [message.unless_offer_opened]);
      if (!offer[0] || offer[0].opened_at || offer[0].status !== "pending") {
        await db.query("update public.notifications set status = 'skipped', error = $2 where id = $1::uuid", [message.id, "The offer was opened or closed first"]);
        continue;
      }
    }
    if (message.channel === "push") {
      const settings = pushSettings();
      if ("problem" in settings && !deps.sendPush) {
        await db.query("update public.notifications set status = $2, sent_at = $3::timestamptz where id = $1::uuid", [message.id, demoModeAllowed() ? "demo" : "skipped", at.toISOString()]);
        if (demoModeAllowed()) result.demo += 1;
        continue;
      }
      try {
        const sent = await sendPush(db, message.recipient, message.body, deps.sendPush ?? null);
        await db.query("update public.notifications set status = $2, sent_at = $3::timestamptz, provider = 'web-push', body = $4, error = $5 where id = $1::uuid", [
          message.id, sent.reached > 0 ? "sent" : "skipped", at.toISOString(), redactLinks(message.body), sent.reached > 0 ? null : "No device has notifications on any more",
        ]);
        if (sent.reached > 0) result.sent += 1;
      } catch (error) {
        const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        await db.query("update public.notifications set status = $2, error = $3 where id = $1::uuid", [message.id, message.attempts >= MAX_SEND_ATTEMPTS ? "failed" : "queued", reason]);
        if (message.attempts >= MAX_SEND_ATTEMPTS) result.failed += 1;
      }
      continue;
    }
    const settings = message.channel === "sms" ? sms : email;

    if ("problem" in settings) {
      if (demoModeAllowed()) {
        await db.query("update public.notifications set status = 'demo', sent_at = $2::timestamptz where id = $1::uuid", [message.id, at.toISOString()]);
        result.demo += 1;
      } else {
        const error = `${message.channel === "sms" ? "Texts" : "Emails"} are not set up: ${settings.problem}`;
        await db.query("update public.notifications set status = 'failed', error = $2 where id = $1::uuid", [message.id, error]);
        await deps.onGiveUp?.(db, { id: message.id, channel: message.channel, recipient: message.recipient, template: message.template, jobId: message.job_id, error });
        result.failed += 1;
      }
      continue;
    }

    try {
      const outcome =
        message.channel === "sms" && "settings" in sms
          ? await sendSms(sms.settings, message.recipient, message.body, deps.fetchImpl ?? fetch, { allowLinks: true })
          : "settings" in email
            ? await sendEmail(
                email.settings,
                {
                  to: [message.recipient],
                  subject: message.subject ?? brand.name,
                  text: message.body,
                  html: emailHtml(message.body),
                  idempotencyKey: `hostfix-${message.id}`,
                },
                deps.fetchImpl ?? fetch,
              )
            : null;
      await db.query(
        `update public.notifications
            set status = 'sent', sent_at = $2::timestamptz, provider = $3, provider_message_id = $4, body = $5, error = null
          where id = $1::uuid`,
        [message.id, at.toISOString(), outcome?.provider ?? null, outcome?.messageId ?? null, redactLinks(message.body)],
      );
      result.sent += 1;
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      (deps.log ?? console).error(`[outbox] ${message.channel} "${message.template}" failed (try ${message.attempts}): ${reason}`);
      if (message.attempts >= MAX_SEND_ATTEMPTS) {
        await db.query("update public.notifications set status = 'failed', error = $2 where id = $1::uuid", [message.id, reason]);
        await deps.onGiveUp?.(db, { id: message.id, channel: message.channel, recipient: message.recipient, template: message.template, jobId: message.job_id, error: reason });
        result.failed += 1;
      } else {
        const wait = RETRY_MINUTES[message.attempts] ?? 15;
        await db.query("update public.notifications set error = $2, send_after = $3::timestamptz where id = $1::uuid", [
          message.id,
          reason,
          addMinutes(at, wait).toISOString(),
        ]);
      }
    }
  }
  return result;
}

export type LoggedMessage = {
  id: string;
  createdAt: Date;
  channel: "sms" | "email" | "push";
  recipient: string;
  template: string;
  status: string;
  body: string | null;
  subject: string | null;
  audience: string | null;
  jobId: string | null;
  error: string | null;
};

/** The most recent messages, newest first. For the admin log and the demo phone. */
export async function listMessages(db: Db, filter: { jobId?: string; recipient?: string; limit?: number } = {}): Promise<LoggedMessage[]> {
  const rows = await db.query<{
    id: string; created_at: Date; channel: "sms" | "email" | "push"; recipient: string; template: string; status: string;
    body: string | null; subject: string | null; audience: string | null; job_id: string | null; error: string | null;
  }>(
    `select id, created_at, channel, recipient, template, status, body, subject, audience, job_id, error
       from public.notifications
      where ($1::uuid is null or job_id = $1::uuid) and ($2::text is null or recipient = $2)
      order by created_at desc, id desc limit $3`,
    [filter.jobId ?? null, filter.recipient ?? null, filter.limit ?? 100],
  );
  return rows.map((row) => ({
    id: row.id, createdAt: new Date(row.created_at), channel: row.channel, recipient: row.recipient, template: row.template,
    status: row.status, body: row.body, subject: row.subject, audience: row.audience, jobId: row.job_id, error: row.error,
  }));
}
