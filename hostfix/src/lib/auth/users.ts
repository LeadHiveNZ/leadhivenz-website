import type { Db } from "@/lib/db/types";
import { normalisePhone } from "@/lib/phone";

/**
 * PEOPLE WHO SIGN IN. A user is one person, known by an email address, a
 * mobile number, or both. What they are allowed to do comes from whether they
 * are an owner, a tradie or staff (or more than one).
 */

export type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  disabled: boolean;
};

export type StaffRole = "dispatcher" | "admin";

/** Who is looking at the screen, and what they are. */
export type Viewer = {
  user: User;
  ownerId: string | null;
  tradieId: string | null;
  staffRole: StaffRole | null;
};

type UserRow = { id: string; name: string; email: string | null; phone: string | null; disabled_at: Date | null };

function rowToUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, disabled: row.disabled_at !== null };
}

export type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  return value.length <= 254 && EMAIL.test(value) ? value : null;
}

/** Reads what someone typed into "email or mobile" and works out which it is. */
export function parseIdentifier(input: string, country: "NZ" | "AU"): Identifier | null {
  const raw = input.trim();
  if (raw.includes("@")) {
    const email = normaliseEmail(raw);
    return email ? { kind: "email", value: email } : null;
  }
  const phone = normalisePhone(raw, country);
  return phone ? { kind: "phone", value: phone.e164 } : null;
}

export async function findUserByIdentifier(db: Db, identifier: Identifier): Promise<User | null> {
  const column = identifier.kind === "email" ? "email" : "phone";
  const rows = await db.query<UserRow>(`select id, name, email, phone, disabled_at from public.users where ${column} = $1`, [identifier.value]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUser(db: Db, id: string): Promise<User | null> {
  const rows = await db.query<UserRow>("select id, name, email, phone, disabled_at from public.users where id = $1::uuid", [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export class AccountExistsError extends Error {
  constructor(readonly field: "email" | "phone") {
    super(field === "email" ? "That email address already has an account." : "That mobile number already has an account.");
    this.name = "AccountExistsError";
  }
}

export async function createUser(db: Db, input: { name: string; email: string | null; phone: string | null }): Promise<User> {
  if (input.email) {
    const taken = await db.query("select 1 from public.users where email = $1", [input.email]);
    if (taken.length > 0) throw new AccountExistsError("email");
  }
  if (input.phone) {
    const taken = await db.query("select 1 from public.users where phone = $1", [input.phone]);
    if (taken.length > 0) throw new AccountExistsError("phone");
  }
  const rows = await db.query<UserRow>(
    `insert into public.users (name, email, phone) values ($1, $2, $3)
     returning id, name, email, phone, disabled_at`,
    [input.name.trim(), input.email, input.phone],
  );
  return rowToUser(rows[0]!);
}

/** Everything the app needs to know about what one user is. */
export async function viewerFor(db: Db, user: User): Promise<Viewer> {
  const rows = await db.query<{ owner_id: string | null; tradie_id: string | null; staff_role: StaffRole | null }>(
    `select (select o.id from public.owners o where o.user_id = $1::uuid) as owner_id,
            (select t.id from public.tradies t where t.user_id = $1::uuid and t.status <> 'removed') as tradie_id,
            (select s.role from public.staff s where s.user_id = $1::uuid and s.disabled_at is null) as staff_role`,
    [user.id],
  );
  const row = rows[0];
  return { user, ownerId: row?.owner_id ?? null, tradieId: row?.tradie_id ?? null, staffRole: row?.staff_role ?? null };
}

/** The label written into the audit log for something this person did. */
export function actorFor(viewer: Viewer, as: "owner" | "tradie" | "staff"): string {
  if (as === "owner" && viewer.ownerId) return `owner:${viewer.ownerId}`;
  if (as === "tradie" && viewer.tradieId) return `tradie:${viewer.tradieId}`;
  return `staff:${viewer.user.id}`;
}
