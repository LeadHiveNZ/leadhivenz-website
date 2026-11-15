import { safeEqual, sha256Hex } from "@/lib/auth/signing";
import { addMinutes, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { randomDigits } from "@/lib/ids";
import type { Identifier } from "./users";

/**
 * SIGN-IN CODES. Nobody has a password. To sign in you type your email or
 * mobile, and a six-digit code is sent there. The code works once, for ten
 * minutes, and five wrong guesses kill it.
 *
 * Only a fingerprint of the code is stored, mixed with the app's secret, so
 * the database alone cannot be used to sign in as anyone.
 */

export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
/** At most this many codes to one address in the window below. */
export const CODES_PER_WINDOW = 5;
export const CODE_WINDOW_MINUTES = 15;

function fingerprint(secret: string, identifier: string, code: string): string {
  return sha256Hex(`signin|${secret}|${identifier}|${code}`);
}

export type CodeIssue =
  | { ok: true; code: string; expiresAt: Date }
  | { ok: false; reason: "too_many" };

/** Makes a new code for this email or mobile. Any earlier unused code stops working. */
export async function issueCode(db: Db, secret: string, identifier: Identifier): Promise<CodeIssue> {
  const at = now();
  return db.tx(async (tx) => {
    const recent = await tx.query<{ count: number }>(
      "select count(*) as count from public.sign_in_codes where identifier = $1 and created_at > $2::timestamptz",
      [identifier.value, addMinutes(at, -CODE_WINDOW_MINUTES).toISOString()],
    );
    if (Number(recent[0]?.count ?? 0) >= CODES_PER_WINDOW) return { ok: false, reason: "too_many" };

    await tx.query("update public.sign_in_codes set used_at = $2::timestamptz where identifier = $1 and used_at is null", [
      identifier.value,
      at.toISOString(),
    ]);
    const code = randomDigits(6);
    const expiresAt = addMinutes(at, CODE_MINUTES);
    await tx.query(
      `insert into public.sign_in_codes (created_at, identifier, channel, code_hash, expires_at)
       values ($1::timestamptz, $2, $3, $4, $5::timestamptz)`,
      [at.toISOString(), identifier.value, identifier.kind === "email" ? "email" : "sms", fingerprint(secret, identifier.value, code), expiresAt.toISOString()],
    );
    return { ok: true, code, expiresAt };
  });
}

export type CodeCheck = { ok: true } | { ok: false; reason: "wrong" | "expired" | "too_many" };

/** Checks a typed code. A correct code is used up. A wrong one counts against the limit. */
export async function checkCode(db: Db, secret: string, identifier: Identifier, typed: string): Promise<CodeCheck> {
  const code = typed.replace(/\D/g, "");
  const at = now();
  return db.tx(async (tx) => {
    const rows = await tx.query<{ id: string; code_hash: string; expires_at: Date; attempts: number }>(
      `select id, code_hash, expires_at, attempts from public.sign_in_codes
        where identifier = $1 and used_at is null
        order by created_at desc limit 1
        for update`,
      [identifier.value],
    );
    const row = rows[0];
    if (!row || new Date(row.expires_at).getTime() <= at.getTime()) return { ok: false, reason: "expired" };
    if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

    if (code.length !== 6 || !safeEqual(row.code_hash, fingerprint(secret, identifier.value, code))) {
      await tx.query("update public.sign_in_codes set attempts = attempts + 1 where id = $1::uuid", [row.id]);
      return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "too_many" : "wrong" };
    }
    await tx.query("update public.sign_in_codes set used_at = $2::timestamptz where id = $1::uuid", [row.id, at.toISOString()]);
    return { ok: true };
  });
}

/** Clears out codes that can no longer be used. Run by the timer. */
export async function purgeOldCodes(db: Db): Promise<void> {
  await db.query("delete from public.sign_in_codes where created_at < $1::timestamptz", [addMinutes(now(), -24 * 60).toISOString()]);
}
