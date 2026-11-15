import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { emails } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { deleteSessionsFor } from "./sessions";
import { createUser, findUserByIdentifier, normaliseEmail, type StaffRole } from "./users";

/**
 * STAFF: the dispatcher (a virtual assistant) and admins. They sign in with
 * their own email and a code, so the audit log shows who did what and one
 * person's access can be removed without changing anyone else's.
 *
 * The founder can always get in with ADMIN_PASSWORD as well.
 */

export type StaffMember = { userId: string; name: string; email: string | null; role: StaffRole; disabled: boolean; createdAt: Date; lastSignInAt: Date | null };

export async function listStaff(db: Db): Promise<StaffMember[]> {
  const rows = await db.query<{ user_id: string; name: string; email: string | null; role: StaffRole; disabled_at: Date | null; created_at: Date; last_sign_in_at: Date | null }>(
    `select s.user_id, u.name, u.email, s.role, s.disabled_at, s.created_at, u.last_sign_in_at
       from public.staff s join public.users u on u.id = s.user_id order by s.disabled_at nulls first, u.name`,
  );
  return rows.map((row) => ({
    userId: row.user_id, name: row.name, email: row.email, role: row.role, disabled: row.disabled_at !== null,
    createdAt: new Date(row.created_at), lastSignInAt: row.last_sign_in_at ? new Date(row.last_sign_in_at) : null,
  }));
}

export class StaffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffError";
  }
}

/** Gives someone staff access and emails them how to sign in. Works for a person who already has an account too. */
export async function addStaff(db: Db, input: { name: string; email: string; role: StaffRole; signInUrl: string }, actor: string): Promise<string> {
  const email = normaliseEmail(input.email);
  if (!email) throw new StaffError("Enter a real email address.");
  if (input.name.trim().length < 2) throw new StaffError("Enter their name.");
  if (input.role !== "dispatcher" && input.role !== "admin") throw new StaffError("Choose dispatcher or admin.");
  return db.tx(async (tx) => {
    const existing = await findUserByIdentifier(tx, { kind: "email", value: email });
    const user = existing ?? (await createUser(tx, { name: input.name, email, phone: null }));
    await tx.query(
      `insert into public.staff (user_id, created_at, role) values ($1::uuid, $2::timestamptz, $3)
       on conflict (user_id) do update set role = excluded.role, disabled_at = null`,
      [user.id, now().toISOString(), input.role],
    );
    await audit(tx, { actor, action: "staff.added", entity: "user", entityId: user.id, detail: { role: input.role, email } });
    const mail = emails.staffInvite({ name: input.name, role: input.role, link: input.signInUrl });
    await enqueue(tx, { channel: "email", to: email, template: "staff_invite", subject: mail.subject, body: mail.body, audience: "staff", userId: user.id });
    return user.id;
  });
}

/** Takes staff access away and signs the person out everywhere at once. */
export async function removeStaff(db: Db, userId: string, actor: string): Promise<void> {
  await db.tx(async (tx) => {
    const rows = await tx.query("update public.staff set disabled_at = $2::timestamptz where user_id = $1::uuid and disabled_at is null returning user_id", [userId, now().toISOString()]);
    if (rows.length === 0) return;
    await deleteSessionsFor(tx, userId);
    await audit(tx, { actor, action: "staff.removed", entity: "user", entityId: userId });
  });
}
