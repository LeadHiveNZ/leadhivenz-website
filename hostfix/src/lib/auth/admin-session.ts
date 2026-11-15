import { randomBytes } from "node:crypto";
import { safeEqual, sha256Hex, sign } from "./signing";

/**
 * ADMIN SIGN-IN
 * The leads page is protected by one password (ADMIN_PASSWORD). After a correct
 * password the browser is given a signed pass that lasts 14 days. Changing the
 * password, or APP_SECRET, signs everyone out straight away.
 *
 * This file has no Next.js imports so the proxy can use it too.
 */

export const ADMIN_COOKIE = "hf_admin";
export const ADMIN_SESSION_SECONDS = 14 * 24 * 60 * 60;
export const MIN_PASSWORD_LENGTH = 10;
export const MIN_SECRET_LENGTH = 32;

export type AdminSettings = { password: string; secret: string };

/** The sign-in settings, or the plain-words reasons sign-in cannot work yet. */
export function readAdminSettings(
  source: Record<string, string | undefined>,
): { settings: AdminSettings } | { problems: string[] } {
  const password = source.ADMIN_PASSWORD?.trim() ?? "";
  const secret = source.APP_SECRET?.trim() ?? "";
  const problems: string[] = [];
  if (password === "") problems.push("ADMIN_PASSWORD is not set.");
  else if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`ADMIN_PASSWORD is too short. Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (secret === "") problems.push("APP_SECRET is not set.");
  else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`APP_SECRET is too short. It needs at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return problems.length > 0 ? { problems } : { settings: { password, secret } };
}

export function passwordMatches(settings: AdminSettings, candidate: string): boolean {
  return safeEqual(settings.password, candidate);
}

function payload(expiresAtMs: number, nonce: string, settings: AdminSettings): string {
  // The password's fingerprint is part of what is signed, so a new password
  // makes every old pass worthless.
  return `admin|v1|${expiresAtMs}|${nonce}|${sha256Hex(settings.password)}`;
}

export function createAdminToken(settings: AdminSettings, nowMs: number = Date.now()): string {
  const expiresAtMs = nowMs + ADMIN_SESSION_SECONDS * 1000;
  const nonce = randomBytes(12).toString("base64url");
  return `v1.${expiresAtMs}.${nonce}.${sign(settings.secret, payload(expiresAtMs, nonce, settings))}`;
}

export function verifyAdminToken(settings: AdminSettings, token: string | undefined, nowMs: number = Date.now()): boolean {
  if (!token || token.length > 300) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, expiresText, nonce, signature] = parts as [string, string, string, string];
  if (version !== "v1" || !/^\d{10,16}$/.test(expiresText)) return false;
  const expiresAtMs = Number(expiresText);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return false;
  return safeEqual(signature, sign(settings.secret, payload(expiresAtMs, nonce, settings)));
}
