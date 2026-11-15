/**
 * THE DATABASE, in one small shape.
 *
 * There are two things behind it:
 *   - Postgres (Supabase) on the live site          src/lib/db/postgres.ts
 *   - a copy of Postgres that runs inside the app   src/lib/db/embedded.ts
 *     for demo mode and the automated tests
 *
 * Both run exactly the same SQL, so what the tests prove is what runs live.
 */

export type Row = Record<string, unknown>;

export interface Db {
  readonly kind: "postgres" | "embedded";

  /** Runs one statement. Values go in as $1, $2 ... and are never pasted into the SQL. */
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;

  /** Runs a script of several statements with no values. Used for migrations only. */
  exec(sql: string): Promise<void>;

  /**
   * Runs everything inside `fn` as one step: either all of it happens or none
   * of it does. Calling tx() again inside opens a part that can fail and be
   * undone on its own without undoing the rest.
   */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

/** The first row, or null. */
export async function one<T = Row>(db: Db, sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await db.query<T>(sql, params);
  return rows[0] ?? null;
}

/** The first row. Throws if there is none. */
export async function must<T = Row>(db: Db, sql: string, params?: unknown[]): Promise<T> {
  const row = await one<T>(db, sql, params);
  if (row === null) throw new Error("Expected a row from the database and got none.");
  return row;
}

/** Postgres error codes the app reacts to. */
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; constraint?: unknown; message?: unknown };
  if (e.code !== PG_UNIQUE_VIOLATION) return false;
  if (!constraint) return true;
  return e.constraint === constraint || (typeof e.message === "string" && e.message.includes(constraint));
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("The database is not connected yet. Add DATABASE_URL (see SETUP.md).");
    this.name = "DatabaseNotConfiguredError";
  }
}
