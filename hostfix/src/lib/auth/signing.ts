import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small, dependency-free signing helpers. A signed value cannot be changed or
 * invented by anyone who does not hold the secret. No Next.js imports here, so
 * these work everywhere, including the proxy that runs before a page loads.
 */

export function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Compares two strings without leaking how much of them matched. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
