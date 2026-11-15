import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { createEmbeddedDb } from "../src/lib/db/embedded";
import { applyMigrations, migrationsDir } from "../src/lib/db/migrate-core";
import { postgresSettings } from "../src/lib/db/postgres";
import { seedMarkets } from "../src/lib/db/seed-core";

/**
 * Runs once before all the tests. It builds one database with every table and
 * the starting market in it, and saves a snapshot. Each test file then starts
 * from a copy of that snapshot, which is much faster than rebuilding it.
 *
 * Normally the database is the copy of Postgres inside the app. Set
 * TEST_DATABASE_URL to a throwaway Postgres server to run the same tests
 * against the real thing ("npm run test:db" does this).
 */

declare module "vitest" {
  export interface ProvidedContext {
    testDatabase:
      | { mode: "embedded"; snapshotFile: string }
      | { mode: "postgres"; adminUrl: string; template: string };
  }
}

const root = path.resolve(__dirname, "..");

export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL?.trim();

  if (adminUrl) {
    const parsed = postgresSettings(adminUrl);
    if ("problem" in parsed) throw new Error(`TEST_DATABASE_URL: ${parsed.problem}`);
    const template = `hostfix_tpl_${process.pid}`;
    const admin = new pg.Client({ ...parsed.settings });
    await admin.connect();
    await admin.query(`drop database if exists ${template}`);
    await admin.query(`create database ${template}`);
    const client = new pg.Client({ ...parsed.settings, database: template });
    await client.connect();
    const target = {
      exec: async (sql: string) => {
        await client.query(sql);
      },
      query: async (sql: string, params?: unknown[]) => (await client.query(sql, params)).rows as Record<string, unknown>[],
    };
    await applyMigrations(target, migrationsDir(root));
    await seedMarkets(target, path.join(root, "seed"));
    await client.end();
    project.provide("testDatabase", { mode: "postgres", adminUrl, template });
    return async () => {
      await admin.query(`drop database if exists ${template}`).catch(() => {});
      await admin.end();
    };
  }

  const folder = await mkdtemp(path.join(os.tmpdir(), "hostfix-tests-"));
  const snapshotFile = path.join(folder, "snapshot.bin");
  const db = await createEmbeddedDb();
  await applyMigrations(db, migrationsDir(root));
  await seedMarkets(db, path.join(root, "seed"));
  const snapshot = await db.snapshot();
  await writeFile(snapshotFile, Buffer.from(await snapshot.arrayBuffer()));
  await db.close();
  project.provide("testDatabase", { mode: "embedded", snapshotFile });
  return async () => {
    await rm(folder, { recursive: true, force: true });
  };
}
