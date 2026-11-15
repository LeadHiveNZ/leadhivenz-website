import { safeEqual, sign } from "@/lib/auth/signing";

/**
 * ONE-TAP LINKS. The links in texts let a tradie accept a job, or an owner
 * approve a quote, without signing in. Each link names one offer or one job
 * and carries a signature made with the app's secret, so it cannot be guessed
 * or changed to point at someone else's job.
 *
 *   /o/1042.k3Xb9aQ2LmPq   an offer, for the tradie it was sent to
 *   /j/1042.Zx81mQpL0aBc   a job, for its owner
 *
 * Nothing secret is stored: the signature is worked out again each time.
 */

const SIGNATURE_LENGTH = 12;

function signature(secret: string, purpose: "offer" | "owner-job", id: string): string {
  return sign(secret, `link|${purpose}|${id}`).replace(/[-_]/g, "x").slice(0, SIGNATURE_LENGTH);
}

export function offerLinkCode(secret: string, offer: { number: number; id: string }): string {
  return `${offer.number}.${signature(secret, "offer", offer.id)}`;
}

export function ownerJobLinkCode(secret: string, job: { number: number; id: string }): string {
  return `${job.number}.${signature(secret, "owner-job", job.id)}`;
}

/** Splits "1042.k3Xb9aQ2LmPq" into its number and signature, or null if it is not shaped like a link code. */
export function parseLinkCode(code: string): { number: number; signature: string } | null {
  const match = /^(\d{1,12})\.([A-Za-z0-9]{12})$/.exec(code);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) ? { number, signature: match[2]! } : null;
}

export function offerLinkMatches(secret: string, offer: { number: number; id: string }, signatureGiven: string): boolean {
  return safeEqual(signature(secret, "offer", offer.id), signatureGiven);
}

export function ownerJobLinkMatches(secret: string, job: { number: number; id: string }, signatureGiven: string): boolean {
  return safeEqual(signature(secret, "owner-job", job.id), signatureGiven);
}
