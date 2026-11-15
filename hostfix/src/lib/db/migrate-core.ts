/**
 * APPLIES DATABASE CHANGES ("migrations").
 *
 * Every file in supabase/migrations is one change to the database's shape.
 * They are applied in name order, once each, and the names of the ones already
 * applied are remembered in a small table. Nothing here ever deletes data.
 *
 * This file is also run by plain Node at build time (scripts/migrate.ts), so
 * it must not import anything from the app or use the "@/..." shortcuts.
 */

import fs from "node:fs";
import path from "node:path";

export type MigrationTarget = {
  /** Runs a script of several statements. */
  exec(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
};

export type MigrationFile = { version: string; file: string };

export function migrationsDir(root: string = process.cwd()): string {
  return path.join(root, "supabase", "migrations");
}

/** Migration files, oldest first. The part before the first "_" is the version. */
export function listMigrationFiles(dir: string): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => ({ version: name.slice(0, 14), file: path.join(dir, name) }));
}

/**
 * Supabase comes with three built-in roles that the migrations mention. On any
 * other Postgres (a developer's computer, the copy inside the app) they are
 * created here, with no ability to sign in, so the same files run everywhere.
 */
const ENSURE_ROLES = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  -- As on Supabase: the server's role is not held back by row level security.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;`;

const ENSURE_TABLE = `
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from anon, authenticated;`;

/** Applies every migration not yet applied. Returns the versions it applied. */
export async function applyMigrations(
  db: MigrationTarget,
  dir: string,
  log: (line: string) => void = () => {},
): Promise<string[]> {
  await db.exec(ENSURE_ROLES);
  await db.exec(ENSURE_TABLE);

  const done = new Set((await db.query("select version from public.schema_migrations")).map((row) => String(row.version)));
  const applied: string[] = [];

  for (const migration of listMigrationFiles(dir)) {
    if (done.has(migration.version)) continue;
    const sql = fs.readFileSync(migration.file, "utf8");
    log(`Applying ${path.basename(migration.file)}`);
    await db.exec("begin");
    try {
      await db.exec(sql);
      await db.query("insert into public.schema_migrations (version) values ($1)", [migration.version]);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback").catch(() => {});
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Database change ${path.basename(migration.file)} failed and was undone: ${reason}`);
    }
    applied.push(migration.version);
  }
  return applied;
}

/** The newest migration the code expects, and the newest the database has. */
export async function migrationStatus(
  db: Pick<MigrationTarget, "query">,
  dir: string,
): Promise<{ expected: string | null; applied: string | null; upToDate: boolean }> {
  const files = listMigrationFiles(dir);
  const expected = files.length > 0 ? files[files.length - 1]!.version : null;
  let applied: string | null = null;
  try {
    const rows = await db.query("select max(version) as version from public.schema_migrations");
    applied = rows[0]?.version ? String(rows[0].version) : null;
  } catch {
    applied = null;
  }
  return { expected, applied, upToDate: expected === null || (applied !== null && applied >= expected) };
}
