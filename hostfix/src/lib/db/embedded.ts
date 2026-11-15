import fs from "node:fs";
import path from "node:path";
import type { Db } from "./types";

/**
 * A COPY OF POSTGRES THAT RUNS INSIDE THE APP (PGlite).
 *
 * Used for two things only: demo mode on a computer with no accounts, and the
 * automated tests. It runs the same SQL as the live database, so there is one
 * set of rules, not two. It is never used on the live site.
 */

type PGliteModule = typeof import("@electric-sql/pglite");
type PGliteInstance = import("@electric-sql/pglite").PGlite;
type PGliteTransaction = import("@electric-sql/pglite").Transaction;

export type EmbeddedDb = Db & {
  close(): Promise<void>;
  /** A snapshot of the whole database, used to start each test from the same point. */
  snapshot(): Promise<Blob>;
};

export type EmbeddedOptions = {
  /** Folder to keep the data in. Leave out to keep it in memory only. */
  dataDir?: string;
  /** Start from a snapshot instead of an empty database. */
  from?: Blob;
};

function clean(params: unknown[] | undefined): unknown[] | undefined {
  return params?.map((value) => (value === undefined ? null : value));
}

function bound(tx: PGliteTransaction): Db {
  let savepoints = 0;
  const db: Db = {
    kind: "embedded",
    async query<T>(sql: string, params?: unknown[]) {
      return (await tx.query<T>(sql, clean(params))).rows;
    },
    async exec(sql: string) {
      await tx.exec(sql);
    },
    // Already inside a step. A savepoint lets this inner part be undone on
    // its own if it fails, without undoing what came before it.
    async tx<T>(fn: (inner: Db) => Promise<T>): Promise<T> {
      const name = `sp_${++savepoints}`;
      await tx.exec(`savepoint ${name}`);
      try {
        const result = await fn(db);
        await tx.exec(`release savepoint ${name}`);
        return result;
      } catch (error) {
        await tx.exec(`rollback to savepoint ${name}`).catch(() => {});
        throw error;
      }
    },
  };
  return db;
}

export async function createEmbeddedDb(options: EmbeddedOptions = {}): Promise<EmbeddedDb> {
  // Loaded only when needed, so the live site never pays for it.
  const { PGlite, types }: PGliteModule = await import("@electric-sql/pglite");

  if (options.dataDir) fs.mkdirSync(path.dirname(options.dataDir), { recursive: true });

  const instance: PGliteInstance = await PGlite.create({
    ...(options.dataDir ? { dataDir: options.dataDir } : {}),
    ...(options.from ? { loadDataDir: options.from } : {}),
    // Match what the live driver returns (see postgres.ts).
    parsers: {
      [types.INT8]: (value: string) => Number(value),
      [types.NUMERIC]: (value: string) => Number(value),
      [types.DATE]: (value: string) => value,
    },
  });

  return {
    kind: "embedded",
    async query<T>(sql: string, params?: unknown[]) {
      return (await instance.query<T>(sql, clean(params))).rows;
    },
    async exec(sql: string) {
      await instance.exec(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
      return (await instance.transaction(async (tx) => fn(bound(tx)))) as T;
    },
    close: () => instance.close(),
    async snapshot() {
      return (await instance.dumpDataDir("none")) as Blob;
    },
  };
}
