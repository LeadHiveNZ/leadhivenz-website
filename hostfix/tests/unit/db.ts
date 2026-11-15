import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, afterEach, beforeEach, inject } from "vitest";
import { setDbForTests } from "@/lib/db";
import { createEmbeddedDb } from "@/lib/db/embedded";
import { createPostgresDb, postgresSettings } from "@/lib/db/postgres";
import type { Db } from "@/lib/db/types";

/**
 * A REAL DATABASE FOR TESTS.
 *
 * Every test that touches data runs against real Postgres (the copy inside the
 * app by default), starting from a snapshot with all tables and the starting
 * market already in it.
 *
 *   const t = testDb();            each test runs inside one step that is
 *                                     undone afterwards, so tests never see
 *                                     each other's data. Fast.
 *   const t = testDb("fresh");     each test gets its own brand new
 *                                     database. Slower. Needed when a test
 *                                     depends on the database's own clock.
 *
 * Inside a test, use t.db.
 */

type Closable = Db & { close(): Promise<void> };

let snapshot: Blob | null = null;

async function openFresh(): Promise<Closable> {
  const source = inject("testDatabase");
  if (source.mode === "postgres") {
    const parsed = postgresSettings(source.adminUrl);
    if ("problem" in parsed) throw new Error(parsed.problem);
    const name = `hostfix_t_${randomBytes(6).toString("hex")}`;
    const admin = new pg.Client({ ...parsed.settings });
    await admin.connect();
    await admin.query(`create database ${name} template ${source.template}`);
    const db = createPostgresDb({ ...parsed.settings, database: name, max: 4 });
    return {
      ...db,
      async close() {
        await db.close();
        await admin.query(`drop database if exists ${name} with (force)`).catch(() => {});
        await admin.end();
      },
    };
  }
  snapshot ??= new Blob([await readFile(source.snapshotFile)]);
  return createEmbeddedDb({ from: snapshot });
}

class Undo extends Error {}

/**
 * Makes a database that is inside one big step behave like a normal one: each
 * statement stands alone, so one that fails does not spoil the ones after it.
 * Work that the app starts at the same moment is done one piece after another,
 * because the test's single connection can only do one thing at a time. (On
 * the live site each piece gets its own connection.)
 */
function standalone(tx: Db): Db {
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work, work);
    queue = result.catch(() => {});
    return result;
  };
  return {
    kind: tx.kind,
    query: (sql, params) => inTurn(() => tx.tx((inner) => inner.query(sql, params))),
    exec: (sql) => inTurn(() => tx.tx((inner) => inner.exec(sql))),
    tx: (fn) => inTurn(() => tx.tx(fn)),
  };
}

export type TestDb = {
  /** The database for the test that is running now. */
  readonly db: Db;
  /** True when the tests are running against a real Postgres server. */
  readonly realPostgres: boolean;
};

export function testDb(mode: "undo" | "fresh" = "undo"): TestDb {
  let shared: Closable | null = null;
  let current: Db | null = null;
  let finish: (() => void) | null = null;
  let finished: Promise<void> | null = null;

  beforeEach(async () => {
    if (mode === "fresh") {
      shared = await openFresh();
      current = shared;
    } else {
      shared ??= await openFresh();
      let ready!: () => void;
      const started = new Promise<void>((resolve) => (ready = resolve));
      const ended = new Promise<void>((resolve) => (finish = resolve));
      finished = shared
        .tx(async (tx) => {
          current = standalone(tx);
          ready();
          await ended;
          throw new Undo();
        })
        .catch((error) => {
          if (!(error instanceof Undo)) throw error;
        });
      await started;
    }
    setDbForTests(current);
  });

  afterEach(async () => {
    setDbForTests(null);
    current = null;
    if (mode === "fresh") {
      await shared?.close();
      shared = null;
    } else {
      finish?.();
      await finished;
      finish = null;
      finished = null;
    }
  });

  afterAll(async () => {
    await shared?.close();
    shared = null;
  });

  return {
    get db() {
      if (!current) throw new Error("t.db is only available inside a test.");
      return current;
    },
    get realPostgres() {
      return inject("testDatabase").mode === "postgres";
    },
  };
}
