import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dataDir } from "@/lib/db";
import { demoModeAllowed, env } from "@/lib/env";

/**
 * WHERE PHOTOS ARE KEPT.
 *   - live: a private bucket in Supabase Storage. Nothing in it has a public
 *     address. A photo is only ever served through the app, after checking
 *     the person asking is allowed to see it.
 *   - demo: a folder on this computer.
 *
 * Supabase facts (their storage docs, read Nov 2026): upload(path, body,
 * { contentType }) stores a file, download(path) returns it, remove([paths])
 * deletes. The secret key is not held back by storage access rules.
 */

export interface FileStore {
  readonly kind: "supabase" | "disk";
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(keys: string[]): Promise<void>;
}

const SAFE_KEY = /^[a-z_]+\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

function diskStore(root: string): FileStore {
  const file = (key: string) => {
    if (!SAFE_KEY.test(key)) throw new Error("That is not a file key.");
    return path.join(root, key);
  };
  return {
    kind: "disk",
    async put(key, bytes) {
      await fs.mkdir(path.dirname(file(key)), { recursive: true });
      await fs.writeFile(file(key), bytes);
    },
    async get(key) {
      try {
        return new Uint8Array(await fs.readFile(file(key)));
      } catch {
        return null;
      }
    },
    async remove(keys) {
      await Promise.all(keys.filter((key) => SAFE_KEY.test(key)).map((key) => fs.rm(file(key), { force: true })));
    },
  };
}

function supabaseStore(client: SupabaseClient, bucket: string): FileStore {
  let ready: Promise<void> | null = null;
  // Makes the private bucket the first time it is needed, so there is no extra set-up step.
  const ensureBucket = () => {
    ready ??= (async () => {
      const { error } = await client.storage.createBucket(bucket, { public: false, fileSizeLimit: 5 * 1024 * 1024 });
      if (error && !/already exists|duplicate/i.test(error.message)) {
        ready = null;
        throw new Error(`Photo storage is not ready: ${error.message}`);
      }
    })();
    return ready;
  };
  return {
    kind: "supabase",
    async put(key, bytes, contentType) {
      if (!SAFE_KEY.test(key)) throw new Error("That is not a file key.");
      await ensureBucket();
      const { error } = await client.storage.from(bucket).upload(key, bytes, { contentType, upsert: false });
      if (error) throw new Error(`The photo could not be saved: ${error.message}`);
    },
    async get(key) {
      if (!SAFE_KEY.test(key)) return null;
      const { data, error } = await client.storage.from(bucket).download(key);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(keys) {
      const safe = keys.filter((key) => SAFE_KEY.test(key));
      if (safe.length > 0) await client.storage.from(bucket).remove(safe);
    },
  };
}

export function storageSettings(): { url: string; secretKey: string; bucket: string } | { problem: string } {
  const url = env("SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY");
  if (!url && !secretKey) return { problem: "SUPABASE_URL and SUPABASE_SECRET_KEY are not set." };
  if (!url) return { problem: "SUPABASE_URL is not set." };
  if (!secretKey) return { problem: "SUPABASE_SECRET_KEY is not set." };
  if (!/^https:\/\/[^\s/]+/i.test(url)) return { problem: "SUPABASE_URL should look like https://abcdefgh.supabase.co" };
  if (secretKey.startsWith("sb_publishable_")) {
    return { problem: "SUPABASE_SECRET_KEY holds the publishable key. Use the secret key instead (it starts with sb_secret_)." };
  }
  return { url: url.replace(/\/+$/, ""), secretKey, bucket: env("SUPABASE_BUCKET") ?? "hostfix" };
}

let cached: { key: string; store: FileStore } | null = null;

/** The place photos go, or null when it has not been set up (the screens then say photos are unavailable). */
export function getFileStore(): FileStore | null {
  const settings = storageSettings();
  if (!("problem" in settings)) {
    const key = `supabase:${settings.url}:${settings.bucket}`;
    if (cached?.key !== key) {
      const client = createClient(settings.url, settings.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
      cached = { key, store: supabaseStore(client, settings.bucket) };
    }
    return cached.store;
  }
  if (demoModeAllowed()) {
    const root = path.join(dataDir(), "uploads");
    if (cached?.key !== `disk:${root}`) cached = { key: `disk:${root}`, store: diskStore(root) };
    return cached.store;
  }
  return null;
}

/** True when files can be saved, without opening the store. Screens use it to say "add it later" instead of offering an upload that would fail. */
export function fileStoreReady(): boolean {
  return !("problem" in storageSettings()) || demoModeAllowed();
}
