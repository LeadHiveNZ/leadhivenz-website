/**
 * BRINGS THE DATABASE UP TO DATE. Runs by itself at the start of every build
 * ("npm run build"), so you never paste SQL anywhere.
 *
 *  1. Applies any new file in supabase/migrations, once each.
 *  2. The first time only, copies the markets in config/markets.ts and their
 *     menus from /seed into the database.
 *
 * If DATABASE_URL is not set it does nothing, so the site can still be built
 * and tried in demo mode. If the database cannot be reached or a change
 * fails, the build stops: new code never runs against an old database.
 *
 * This file is run directly by Node, which strips the TypeScript types. It
 * may only import files that follow the same rule (see migrate-core.ts).
 */

import path from "node:path";
import process from "node:process";
import pg from "pg";
import { applyMigrations, migrationsDir } from "../src/lib/db/migrate-core.ts";
import { postgresSettings, sessionModeSettings } from "../src/lib/db/postgres.ts";
import { seedMarkets } from "../src/lib/db/seed-core.ts";

const root = path.resolve(import.meta.dirname, "..");
const log = (line: string) => console.log(`[database] ${line}`);

/** Any fixed number: it only has to be the same for every build. */
const LOCK_ID = 727274;

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    log("DATABASE_URL is not set, so no database changes were applied.");
    return 0;
  }
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "production" && process.env.MIGRATE_ON_PREVIEW !== "1") {
    log("This is a preview build, so the database was left alone.");
    return 0;
  }

  const parsed = postgresSettings(url, { caCert: process.env.DATABASE_CA_CERT });
  if ("problem" in parsed) {
    console.error(`[database] ${parsed.problem}`);
    return 1;
  }
  // Changing the database's shape needs a connection that is kept for the
  // whole visit, which is the pooler's other port.
  const settings = sessionModeSettings(parsed.settings);
  const client = new pg.Client({
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
    database: settings.database,
    ssl: settings.ssl,
    connectionTimeoutMillis: 20_000,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error(`[database] Could not connect: ${error instanceof Error ? error.message : String(error)}`);
    console.error("[database] Check DATABASE_URL and that the Supabase project is not paused.");
    return 1;
  }

  try {
    // Two builds at once must not both try to change the database.
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    const target = {
      exec: async (sql: string) => {
        await client.query(sql);
      },
      query: async (sql: string, params?: unknown[]) => (await client.query(sql, params)).rows as Record<string, unknown>[],
    };
    const applied = await applyMigrations(target, migrationsDir(root), log);
    const seeded = await seedMarkets(target, path.join(root, "seed"), log);
    log(
      applied.length === 0 && seeded.length === 0
        ? "Already up to date."
        : `Done. ${applied.length} change${applied.length === 1 ? "" : "s"} applied.`,
    );
    return 0;
  } catch (error) {
    console.error(`[database] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    await client.end().catch(() => {});
  }
}

process.exitCode = await main();
