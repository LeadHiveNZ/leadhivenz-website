import "server-only";
import path from "node:path";
import { demoModeAllowed, env, isVercel } from "@/lib/env";
import { createEmbeddedDb } from "./embedded";
import { applyMigrations, migrationsDir } from "./migrate-core";
import { createPostgresDb, postgresSettings, type PostgresSettings } from "./postgres";
import { seedMarkets } from "./seed-core";
import { DatabaseNotConfiguredError, type Db } from "./types";

export type { Db, Row } from "./types";
export { DatabaseNotConfiguredError, isUniqueViolation, must, one } from "./types";

/**
 * WHICH DATABASE THE APP USES
 *  - DATABASE_URL set          the live Postgres database (Supabase)
 *  - demo mode, nothing set    a copy of Postgres inside the app, kept in the
 *                              .data folder on this computer
 *  - otherwise                 an error, so a live site can never quietly
 *                              lose what people type into it
 */

export function databaseSettings(): { settings: PostgresSettings } | { problem: string } {
  return postgresSettings(env("DATABASE_URL"), { caCert: env("DATABASE_CA_CERT"), poolMax: env("DATABASE_POOL_MAX") });
}

export function databaseKind(): "postgres" | "embedded" | "none" {
  if (env("DATABASE_URL")) return "postgres";
  return demoModeAllowed() ? "embedded" : "none";
}

export function dataDir(): string {
  return env("HOSTFIX_DATA_DIR") ?? path.join(process.cwd(), ".data");
}

type Holder = { key: string; db: Promise<Db> };
// Kept on globalThis so that reloading code in development does not open the
// same database twice.
const holder = globalThis as typeof globalThis & { __hostfixDb?: Holder };

async function openEmbedded(): Promise<Db> {
  const db = await createEmbeddedDb({ dataDir: path.join(dataDir(), "pg") });
  await applyMigrations(db, migrationsDir());
  await seedMarkets(db, path.join(process.cwd(), "seed"));
  // Demo mode only: sample data (unless HOSTFIX_SAMPLE_DATA=0), the skip-ahead
  // clock and the timer. Loaded here, on demand, so the live site never carries it.
  const { prepareDemo } = await import("@/lib/demo/state");
  await prepareDemo(db, { sampleData: env("HOSTFIX_SAMPLE_DATA") !== "0" });
  return db;
}

function openPostgres(settings: PostgresSettings): Db {
  const db = createPostgresDb(settings);
  if (isVercel()) {
    // Lets Vercel close idle connections before it pauses the server.
    void import("@vercel/functions").then((m) => m.attachDatabasePool(db.pool)).catch(() => {});
  }
  return db;
}

export function getDb(): Promise<Db> {
  const kind = databaseKind();
  if (kind === "none") return Promise.reject(new DatabaseNotConfiguredError());

  if (kind === "postgres") {
    const result = databaseSettings();
    if ("problem" in result) return Promise.reject(new Error(result.problem));
    const key = `postgres:${env("DATABASE_URL")}`;
    if (holder.__hostfixDb?.key !== key) holder.__hostfixDb = { key, db: Promise.resolve(openPostgres(result.settings)) };
    return holder.__hostfixDb.db;
  }

  const key = `embedded:${dataDir()}`;
  if (holder.__hostfixDb?.key !== key) {
    const opening = openEmbedded();
    holder.__hostfixDb = { key, db: opening };
    // If opening fails, forget it so the next request tries again.
    opening.catch(() => {
      if (holder.__hostfixDb?.db === opening) holder.__hostfixDb = undefined;
    });
  }
  return holder.__hostfixDb.db;
}

/** For tests: use this database instead of working one out from the settings. */
export function setDbForTests(db: Db | null): void {
  holder.__hostfixDb = db ? { key: "test", db: Promise.resolve(db) } : undefined;
}
