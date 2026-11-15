import pg from "pg";
import type { Db } from "./types";

/**
 * THE LIVE DATABASE: Postgres, hosted by Supabase.
 *
 * Facts this relies on (Supabase docs, read Nov 2026):
 *  - Vercel can only reach Supabase over the "Transaction pooler" address
 *    (port 6543). The "Direct connection" address is IPv6-only and will not work.
 *  - The transaction pooler does not support prepared statements. node-postgres
 *    only prepares a statement when given a name, and this code never does.
 *  - Connections must be encrypted. Supabase's certificate is signed by its own
 *    authority, so the server's identity is only checked when DATABASE_CA_CERT
 *    holds that certificate (optional hardening, see SETUP.md).
 */

// Numbers that Postgres returns as text by default. Every amount in this app
// is a whole number of cents and fits comfortably in a JavaScript number.
pg.types.setTypeParser(20, (value) => Number(value)); // bigint (counts, sums)
pg.types.setTypeParser(1700, (value) => Number(value)); // numeric (tax rates)
pg.types.setTypeParser(1082, (value) => value); // date stays "2026-11-15"

export type PostgresSettings = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  max: number;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Reads DATABASE_URL, or says in plain words what is wrong with it. */
export function postgresSettings(
  url: string | undefined,
  options: { caCert?: string; poolMax?: string } = {},
): { settings: PostgresSettings } | { problem: string } {
  if (!url) return { problem: "DATABASE_URL is not set." };
  if (/\[YOUR-PASSWORD\]|\[PASSWORD\]/i.test(url)) {
    return { problem: "DATABASE_URL still contains the placeholder [YOUR-PASSWORD]. Replace it with your database password." };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { problem: "DATABASE_URL is not a valid address. It should start with postgresql://" };
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    return { problem: "DATABASE_URL should start with postgresql://" };
  }
  const host = parsed.hostname;
  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) {
    return {
      problem:
        'DATABASE_URL is the "Direct connection" address, which Vercel cannot reach. In Supabase press Connect and copy the "Transaction pooler" address instead.',
    };
  }
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    return { problem: "DATABASE_URL has a password with a stray % sign. Special characters in the password must be percent-encoded." };
  }
  if (!user) return { problem: "DATABASE_URL has no user name in it." };

  const local = LOCAL_HOSTS.has(host);
  const ca = options.caCert?.includes("BEGIN CERTIFICATE") ? options.caCert.replace(/\\n/g, "\n") : undefined;
  const max = Number(options.poolMax ?? "");

  return {
    settings: {
      host,
      port: parsed.port ? Number(parsed.port) : 5432,
      user,
      password,
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
      ssl: local ? false : { rejectUnauthorized: Boolean(ca), ...(ca ? { ca } : {}) },
      max: Number.isInteger(max) && max >= 1 && max <= 20 ? max : 3,
    },
  };
}

/**
 * Supabase's pooler listens twice on the same host: port 6543 hands a
 * connection back after every statement ("transaction mode", right for the
 * site) and port 5432 keeps it for the whole visit ("session mode", needed to
 * change the database's shape). This returns the second from the first.
 */
export function sessionModeSettings(settings: PostgresSettings): PostgresSettings {
  const pooled = /\.pooler\.supabase\.com$/i.test(settings.host) && settings.port === 6543;
  return pooled ? { ...settings, port: 5432, max: 1 } : { ...settings, max: 1 };
}

type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> };

function clean(params: unknown[] | undefined): unknown[] | undefined {
  return params?.map((value) => (value === undefined ? null : value));
}

function bound(client: Queryable): Db {
  let savepoints = 0;
  const db: Db = {
    kind: "postgres",
    async query<T>(sql: string, params?: unknown[]) {
      const result = await client.query(sql, clean(params));
      return result.rows as T[];
    },
    async exec(sql: string) {
      await client.query(sql);
    },
    // Already inside a step. A savepoint lets this inner part be undone on
    // its own if it fails, without undoing what came before it.
    async tx<T>(fn: (inner: Db) => Promise<T>): Promise<T> {
      const name = `sp_${++savepoints}`;
      await client.query(`savepoint ${name}`);
      try {
        const result = await fn(db);
        await client.query(`release savepoint ${name}`);
        return result;
      } catch (error) {
        await client.query(`rollback to savepoint ${name}`).catch(() => {});
        throw error;
      }
    },
  };
  return db;
}

export type PostgresDb = Db & { close(): Promise<void>; pool: pg.Pool };

export function createPostgresDb(settings: PostgresSettings): PostgresDb {
  const pool = new pg.Pool({
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
    database: settings.database,
    ssl: settings.ssl,
    max: settings.max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // Give up on any one statement after this long rather than hang a page.
    query_timeout: 15_000,
  });
  // A dropped idle connection must not crash the server.
  pool.on("error", () => {});

  return {
    kind: "postgres",
    pool,
    async query<T>(sql: string, params?: unknown[]) {
      const result = await pool.query(sql, clean(params));
      return result.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      let broken: unknown;
      try {
        await client.query("begin");
        const result = await fn(bound(client));
        await client.query("commit");
        return result;
      } catch (error) {
        try {
          await client.query("rollback");
        } catch (rollbackError) {
          // The connection is unusable. Throw it away rather than reuse it.
          broken = rollbackError;
        }
        throw error;
      } finally {
        client.release(broken instanceof Error ? broken : undefined);
      }
    },
    close: () => pool.end(),
  };
}
