import { randomBytes, randomInt } from "node:crypto";
import { sha256Hex } from "@/lib/auth/signing";

/**
 * Random codes and links. A link's code is only ever stored as a fingerprint,
 * so a copy of the database cannot be used to open anyone's link.
 */

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random code for links. 12 characters is about 70 bits: not guessable. */
export function randomToken(length: number = 12): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** A long random value for sign-in cookies. */
export function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return sha256Hex(`hostfix-token|${token}`);
}

/** Six digits, for sign-in codes. */
export function randomDigits(length: number = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String(randomInt(10));
  return out;
}

/** Upper-case letters and digits with the confusing ones left out, for referral codes. */
export function randomCode(length: number = 7): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += letters[randomInt(letters.length)];
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
