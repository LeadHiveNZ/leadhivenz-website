import webpush from "web-push";
import { brand } from "@config/brand";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { env } from "@/lib/env";

/**
 * APP NOTIFICATIONS (WEB PUSH), DECISIONS.md 2026-11-20 (third entry).
 *
 * A person who turns notifications on in the app (installed to the home screen
 * on an iPhone first) gets some messages as an app notification instead of a
 * text: job offers first (the text follows a few minutes later only if the
 * offer has not been opened), and an owner's updates. Never an address or a
 * door code: the body is the message's short words with the link taken out,
 * and the link only opens the page.
 *
 * From the web-push library's documentation (version 3.6.7, read November
 * 2026): sendNotification(subscription, payload, { vapidDetails: { subject,
 * publicKey, privateKey }, TTL, urgency }) resolves or rejects with the push
 * service's statusCode. A 404 or 410 means the subscription is gone and is
 * removed. Keys come from generateVAPIDKeys(); the subject is a mailto: or an
 * https: address.
 */

export type PushSettings = { subject: string; publicKey: string; privateKey: string };

export function pushSettings(): PushSettings | { problem: string } {
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  const subject = env("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return { problem: "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are not all set." };
  if (!/^(mailto:|https:\/\/)/.test(subject)) return { problem: "VAPID_SUBJECT must start with mailto: or https://." };
  return { subject, publicKey, privateKey };
}

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves a phone's or browser's subscription for the signed-in person. Safe to call twice. */
export async function savePushSubscription(db: Db, userId: string, input: PushSubscriptionInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  if (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || typeof input.keys?.p256dh !== "string" || typeof input.keys?.auth !== "string") {
    return { ok: false, message: "That notification sign-up did not look right. Try again." };
  }
  await db.query(
    `insert into public.push_subscriptions (created_at, user_id, endpoint, p256dh, auth) values ($1::timestamptz, $2::uuid, $3, $4, $5)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [now().toISOString(), userId, endpoint, input.keys.p256dh.slice(0, 200), input.keys.auth.slice(0, 100)],
  );
  return { ok: true };
}

/** Removes one subscription of the signed-in person (or all of theirs). */
export async function removePushSubscriptions(db: Db, userId: string, endpoint?: string): Promise<void> {
  await db.query("delete from public.push_subscriptions where user_id = $1::uuid and ($2::text is null or endpoint = $2)", [userId, endpoint ?? null]);
}

export async function hasPush(db: Db, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const rows = await db.query("select 1 from public.push_subscriptions where user_id = $1::uuid limit 1", [userId]);
  return rows.length > 0;
}

/** The words of an app notification: the text's own short words, without the link, and where tapping it goes. */
export function pushPayload(body: string): { title: string; body: string; url: string } {
  const link = /(https?:\/\/[^\s]+)/.exec(body)?.[1] ?? null;
  let path = "/start";
  if (link) {
    try {
      const parsed = new URL(link);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      path = "/start";
    }
  }
  const words = body
    .replace(/(https?:\/\/[^\s]+)/g, "")
    .replace(new RegExp(`^${brand.name}( URGENT| EMERGENCY)?:?\\s*`), (match) => (match.includes("EMERGENCY") ? "EMERGENCY: " : match.includes("URGENT") ? "URGENT: " : ""))
    .replace(/\s+([.:,])/g, "$1")
    .replace(/[:\s]+$/, "")
    .trim();
  return { title: brand.name, body: words, url: path };
}

export type PushSender = (subscription: PushSubscriptionInput, payload: string) => Promise<{ statusCode: number }>;

function realSender(settings: PushSettings): PushSender {
  return async (subscription, payload) => {
    try {
      const result = await webpush.sendNotification(subscription, payload, {
        vapidDetails: { subject: settings.subject, publicKey: settings.publicKey, privateKey: settings.privateKey },
        TTL: 60 * 30,
        urgency: "high",
      });
      return { statusCode: result.statusCode };
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) return { statusCode };
      throw error;
    }
  };
}

/**
 * Sends one app notification to every device the person has turned
 * notifications on for. Devices the push service says are gone are removed.
 * Returns how many devices it reached.
 */
export async function sendPush(db: Db, userId: string, body: string, sender?: PushSender | null): Promise<{ reached: number; removed: number }> {
  let send = sender ?? null;
  if (!send) {
    const settings = pushSettings();
    if ("problem" in settings) throw new Error(`App notifications are not set up: ${settings.problem}`);
    send = realSender(settings);
  }
  const subscriptions = await db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    "select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = $1::uuid",
    [userId],
  );
  const payload = JSON.stringify(pushPayload(body));
  let reached = 0;
  let removed = 0;
  for (const row of subscriptions) {
    const { statusCode } = await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
    if (statusCode === 404 || statusCode === 410) {
      await db.query("delete from public.push_subscriptions where id = $1::uuid", [row.id]);
      removed += 1;
    } else {
      await db.query("update public.push_subscriptions set last_used_at = $2::timestamptz where id = $1::uuid", [row.id, now().toISOString()]);
      reached += 1;
    }
  }
  return { reached, removed };
}
