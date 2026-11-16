import { safeEqual, sign } from "./signing";

/**
 * After someone fills in a form, their browser is given a signed note of which
 * lead they are. It lets the thank-you page offer the deposit to the right
 * person without putting anything personal in the web address.
 */

export const LEAD_COOKIE = "hf_lead";
export const LEAD_COOKIE_SECONDS = 7 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** How long the "take a founding spot" link in the price list email works. */
export const LEAD_LINK_SECONDS = 30 * 24 * 60 * 60;

export function createLeadToken(secret: string, leadId: string, nowMs: number = Date.now(), ttlSeconds: number = LEAD_COOKIE_SECONDS): string {
  if (!isUuid(leadId)) throw new Error("createLeadToken: not a lead id");
  const expiresAtMs = nowMs + ttlSeconds * 1000;
  return `v1.${leadId}.${expiresAtMs}.${sign(secret, `lead|v1|${leadId}|${expiresAtMs}`)}`;
}

/** Returns the lead id if the token is genuine and has not expired. */
export function readLeadToken(secret: string, token: string | undefined, nowMs: number = Date.now()): string | null {
  if (!token || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, leadId, expiresText, signature] = parts as [string, string, string, string];
  if (version !== "v1" || !isUuid(leadId) || !/^\d{10,16}$/.test(expiresText)) return null;
  const expiresAtMs = Number(expiresText);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return null;
  if (!safeEqual(signature, sign(secret, `lead|v1|${leadId}|${expiresAtMs}`))) return null;
  return leadId.toLowerCase();
}
