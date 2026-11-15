import { safeEqual, sign } from "./signing";

/**
 * Between typing your email and typing the code, the site has to remember who
 * you said you were. That is kept in a short-lived signed cookie, so it cannot
 * be changed to point at someone else's account.
 */

export const PENDING_COOKIE = "hf_pending";
export const PENDING_MINUTES = 15;

export type Pending = {
  identifier: { kind: "email" | "phone"; value: string };
  /** sign_in: an existing account. owner_sign_up: make the account once the code is right. */
  purpose: "sign_in" | "owner_sign_up";
  next: string | null;
  signUp?: { name: string; email: string; phone: string | null; homeLocation: string | null; ref: string | null };
  /** Demo mode only, when no text or email service is connected: the code, so it can be shown on screen. */
  demoCode?: string;
  expiresAt: number;
};

export function sealPending(secret: string, pending: Pending): string {
  const body = Buffer.from(JSON.stringify(pending), "utf8").toString("base64url");
  return `${body}.${sign(secret, `pending|${body}`)}`;
}

export function openPending(secret: string, value: string | undefined, nowMs: number = Date.now()): Pending | null {
  if (!value || value.length > 4000) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature || !safeEqual(signature, sign(secret, `pending|${body}`))) return null;
  try {
    const pending = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Pending;
    if (typeof pending.expiresAt !== "number" || pending.expiresAt <= nowMs) return null;
    if (!pending.identifier?.value || (pending.identifier.kind !== "email" && pending.identifier.kind !== "phone")) return null;
    return pending;
  } catch {
    return null;
  }
}
