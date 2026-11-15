import { DAY, HOUR, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { randomSecret, tokenHash } from "@/lib/ids";
import { viewerFor, type Viewer } from "./users";

/**
 * SIGNED-IN BROWSERS. After a correct code the browser is given a long random
 * value in a cookie. The database keeps only its fingerprint, with who it
 * belongs to and when it runs out. Signing out deletes it, which works at
 * once on every server.
 */

export const SESSION_COOKIE = "hf_session";
export const SESSION_DAYS = 30;
/** The expiry is pushed out again when a session is used and this much has passed. */
const REFRESH_AFTER_MS = 6 * HOUR;

export async function createSession(db: Db, userId: string, userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
  const at = now();
  const token = randomSecret();
  const expiresAt = new Date(at.getTime() + SESSION_DAYS * DAY);
  await db.query(
    `insert into public.sessions (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent)
     values ($1, $2::uuid, $3::timestamptz, $3::timestamptz, $4::timestamptz, $5)`,
    [tokenHash(token), userId, at.toISOString(), expiresAt.toISOString(), userAgent ? userAgent.slice(0, 300) : null],
  );
  await db.query("update public.users set last_sign_in_at = $2::timestamptz where id = $1::uuid", [userId, at.toISOString()]);
  return { token, expiresAt };
}

/** Who this cookie belongs to, or null if it is unknown, expired or the person is switched off. */
export async function findSession(db: Db, token: string | undefined): Promise<Viewer | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const at = now();
  const rows = await db.query<{
    user_id: string; name: string; email: string | null; phone: string | null; disabled_at: Date | null;
    last_seen_at: Date; expires_at: Date;
  }>(
    `select s.user_id, u.name, u.email, u.phone, u.disabled_at, s.last_seen_at, s.expires_at
       from public.sessions s join public.users u on u.id = s.user_id
      where s.token_hash = $1`,
    [tokenHash(token)],
  );
  const row = rows[0];
  if (!row || row.disabled_at !== null) return null;
  if (new Date(row.expires_at).getTime() <= at.getTime()) return null;

  if (at.getTime() - new Date(row.last_seen_at).getTime() > REFRESH_AFTER_MS) {
    await db.query("update public.sessions set last_seen_at = $2::timestamptz, expires_at = $3::timestamptz where token_hash = $1", [
      tokenHash(token),
      at.toISOString(),
      new Date(at.getTime() + SESSION_DAYS * DAY).toISOString(),
    ]);
  }
  return viewerFor(db, { id: row.user_id, name: row.name, email: row.email, phone: row.phone, disabled: false });
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.query("delete from public.sessions where token_hash = $1", [tokenHash(token)]);
}

/** Signs a person out everywhere, for example when staff access is removed. */
export async function deleteSessionsFor(db: Db, userId: string): Promise<void> {
  await db.query("delete from public.sessions where user_id = $1::uuid", [userId]);
}

export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db.query("delete from public.sessions where expires_at < $1::timestamptz", [now().toISOString()]);
}
