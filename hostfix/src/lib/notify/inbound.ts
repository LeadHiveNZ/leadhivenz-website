import { createHmac } from "node:crypto";
import { audit } from "@/lib/audit";
import { safeEqual } from "@/lib/auth/signing";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { acceptOffer, passOffer } from "@/lib/dispatch/cascade";
import { normalisePhone } from "@/lib/phone";
import { setTradiePaused } from "@/lib/tradies/service";

/**
 * TEXT REPLIES. Where a market has a number tradies can reply to, "YES" takes
 * the job and "NO" passes it, exactly as the link in the text does.
 *
 * The one-tap link is the main way everywhere. Replying is an extra, switched
 * on per market, because New Zealand only allows replies on a registered
 * short code.
 *
 * Twilio facts (their webhook and security docs, read Nov 2026): replies are
 * posted as a form with From, To, Body and MessageSid. Each request carries
 * X-Twilio-Signature: Base64 of HMAC-SHA1, keyed with the account's Auth
 * Token, over the full webhook address followed by every posted field name and
 * value, in alphabetical order of name, with nothing between them. To send no
 * reply text, answer with an empty <Response></Response>.
 *
 * ClickSend: their published docs could not be read far enough to confirm the
 * shape of an inbound reply, so that route reads the field names tolerantly
 * and keeps a copy of exactly what arrived. Check one real reply before
 * relying on it (SETUP.md).
 */

export type InboundOutcome = "accepted" | "passed" | "taken" | "not_eligible" | "paused" | "no_offer" | "unknown_sender" | "not_understood";

const YES = /^(y|yes|yep|yeah|ok|okay|accept|accepted|take|1)\b/i;
const NO = /^(n|no|nah|nope|pass|decline|2)\b/i;
const STOP = /^(stop|unsubscribe|pause)\b/i;

export function readReply(body: string): "yes" | "no" | "stop" | null {
  const text = body.trim().replace(/^["'.\s]+/, "");
  if (STOP.test(text)) return "stop";
  if (YES.test(text)) return "yes";
  if (NO.test(text)) return "no";
  return null;
}

export type InboundMessage = { provider: "twilio" | "clicksend" | "demo"; from: string; body: string; raw: Record<string, unknown> };

/** Acts on a reply and records what was done with it. Returns what happened, for the reply text. */
export async function handleInboundSms(db: Db, message: InboundMessage): Promise<InboundOutcome> {
  const at = now();
  const phone = normalisePhone(message.from, "NZ")?.e164 ?? null;
  const reply = readReply(message.body);
  let outcome: InboundOutcome;
  let offerId: string | null = null;

  const tradies = phone
    ? await db.query<{ id: string }>(
        "select t.id from public.tradies t join public.users u on u.id = t.user_id where u.phone = $1 and t.status in ('approved', 'paused')",
        [phone],
      )
    : [];
  const tradie = tradies[0];

  if (!tradie) outcome = "unknown_sender";
  else if (reply === "stop") {
    await setTradiePaused(db, tradie.id, true);
    outcome = "paused";
  } else if (reply === null) outcome = "not_understood";
  else {
    // The most recent offer still waiting for this tradie's answer.
    const offers = await db.query<{ id: string }>(
      `select o.id from public.offers o join public.jobs j on j.id = o.job_id
        where o.tradie_id = $1::uuid and o.status = 'pending' and o.expires_at > $2::timestamptz and j.status = 'offering'
        order by o.sent_at desc limit 1`,
      [tradie.id, at.toISOString()],
    );
    offerId = offers[0]?.id ?? null;
    if (!offerId) outcome = "no_offer";
    else if (reply === "yes") {
      const result = await db.tx((tx) => acceptOffer(tx, offerId!, "text"));
      outcome = result.result === "accepted" || result.result === "already_yours" ? "accepted" : result.result === "not_eligible" ? "not_eligible" : "taken";
    } else {
      await db.tx((tx) => passOffer(tx, offerId!, "text"));
      outcome = "passed";
    }
  }

  await db.query(
    "insert into public.sms_inbound (created_at, provider, from_phone, body, raw, outcome, offer_id) values ($1::timestamptz, $2, $3, $4, $5::jsonb, $6, $7::uuid)",
    [at.toISOString(), message.provider, phone ?? message.from.slice(0, 40), message.body.slice(0, 500), JSON.stringify(message.raw).slice(0, 8000), outcome, offerId],
  );
  if (tradie) await audit(db, { actor: `tradie:${tradie.id}`, action: "sms.reply", entity: "tradie", entityId: tradie.id, detail: { outcome, provider: message.provider } });
  return outcome;
}

/** What to text back, or null to say nothing. Never includes a link. */
export function replyText(outcome: InboundOutcome, brandName: string): string | null {
  switch (outcome) {
    case "accepted":
      return `${brandName}: the job is yours. We have texted you the address and details.`;
    case "passed":
      return `${brandName}: no problem, we have passed it on.`;
    case "taken":
      return `${brandName}: sorry, that job has just been taken by someone else.`;
    case "not_eligible":
      return `${brandName}: we could not give you that job. Check your licence details in the app.`;
    case "paused":
      return `${brandName}: job offers are paused. Sign in and switch them back on when you are ready.`;
    case "no_offer":
      return `${brandName}: there is no job waiting for your answer right now.`;
    case "not_understood":
      return `${brandName}: reply YES to take the job or NO to pass.`;
    case "unknown_sender":
      return null;
  }
}

/** Checks that a request really came from Twilio. `url` must be the exact public address Twilio was given. */
export function twilioSignatureValid(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((text, key) => text + key + params[key], url);
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
  return safeEqual(expected, signature);
}

/** Pulls the sender and text out of whatever ClickSend posts, whichever of its field names it uses. */
export function readClickSend(payload: Record<string, unknown>): { from: string; body: string } | null {
  const pick = (...names: string[]) => {
    for (const name of names) {
      const value = payload[name];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return null;
  };
  const from = pick("from", "originalsenderid", "sender", "msisdn");
  const body = pick("body", "message", "text", "originalmessage");
  return from && body ? { from, body } : null;
}
