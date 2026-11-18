import { safeEqual, sign } from "@/lib/auth/signing";

/**
 * A PHONE THAT HAS PROVED ITS NUMBER, for a cleaner's team link.
 *
 * The link alone opens nothing: a forwarded link shows only the "we text you
 * a code" screen. Once the six-digit code sent to the person's own mobile is
 * typed on a phone, that phone gets a cookie saying so, signed with the app's
 * secret and tied to the link, so it cannot be copied to another link or
 * made up. After that the link opens straight to their list of houses.
 *
 * No Next.js imports here, so the tests can use it directly.
 */

export const TEAM_DEVICE_COOKIE = "hf_team";
export const TEAM_PENDING_COOKIE = "hf_team_pending";
/** Browsers keep a cookie for at most about 400 days. The person proves the number again after that. */
export const TEAM_DEVICE_DAYS = 400;
export const TEAM_PENDING_MINUTES = 15;

/** The cookie for a phone that has proved the number for this link. */
export function sealTeamDevice(secret: string, link: { id: string; token: string }): string {
  return `${link.id}.${sign(secret, `team-device|${link.id}|${link.token}`)}`;
}

/** True when the cookie was made for this link, with this app's secret. */
export function teamDeviceMatches(secret: string | null, value: string | undefined, link: { id: string; token: string }): boolean {
  if (!secret || !value || value.length > 200) return false;
  const [id, signature] = value.split(".");
  if (!id || !signature || id !== link.id) return false;
  return safeEqual(signature, sign(secret, `team-device|${link.id}|${link.token}`));
}

/** Between asking for the code and typing it: which link, and in demo mode the code itself. */
export type TeamPending = { linkId: string; expiresAt: number; demoCode?: string };

export function sealTeamPending(secret: string, pending: TeamPending): string {
  const body = Buffer.from(JSON.stringify(pending), "utf8").toString("base64url");
  return `${body}.${sign(secret, `team-pending|${body}`)}`;
}

export function openTeamPending(secret: string | null, value: string | undefined, nowMs: number = Date.now()): TeamPending | null {
  if (!secret || !value || value.length > 2000) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature || !safeEqual(signature, sign(secret, `team-pending|${body}`))) return null;
  try {
    const pending = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TeamPending;
    if (typeof pending.linkId !== "string" || typeof pending.expiresAt !== "number" || pending.expiresAt <= nowMs) return null;
    return pending;
  } catch {
    return null;
  }
}

/** "021 *** 4521": enough for the person to recognise their own number, not enough to read it off a forwarded link. */
export function maskedPhone(display: string): string {
  const digits = display.replace(/\D/g, "");
  if (digits.length < 7) return display;
  const parts = display.split(" ");
  if (parts.length >= 3) return [parts[0], ...parts.slice(1, -1).map(() => "***"), parts[parts.length - 1]].join(" ");
  return `${display.slice(0, 3)} *** ${display.slice(-3)}`;
}
