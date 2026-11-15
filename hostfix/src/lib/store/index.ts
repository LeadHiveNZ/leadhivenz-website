import "server-only";
import { demoModeAllowed, env } from "@/lib/env";
import { DemoStore } from "./demo";
import { SupabaseStore, type SupabaseSettings } from "./supabase";
import { StoreNotConfiguredError, type LeadStore } from "./types";

export type { Lead, LeadStore, LeadType, NewLead } from "./types";
export { StoreNotConfiguredError } from "./types";

/** The Supabase settings, or a plain-words reason they cannot be used. */
export function supabaseSettings(): { settings: SupabaseSettings } | { problem: string } {
  const url = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");

  if (!url && !secretKey) return { problem: "SUPABASE_URL and SUPABASE_SECRET_KEY are not set." };
  if (!url) return { problem: "SUPABASE_URL is not set." };
  if (!secretKey) return { problem: "SUPABASE_SECRET_KEY is not set." };
  if (!/^https:\/\/[^\s/]+/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
    return { problem: "SUPABASE_URL should look like https://abcdefgh.supabase.co" };
  }
  if (secretKey.startsWith("sb_publishable_")) {
    return {
      problem:
        "SUPABASE_SECRET_KEY holds the publishable key. Use the secret key instead (it starts with sb_secret_).",
    };
  }
  return { settings: { url: url.replace(/\/+$/, ""), secretKey } };
}

let cached: { key: string; store: LeadStore } | null = null;

/**
 * The place leads are saved. The real database when it is set up; the demo
 * file when trying things on a computer with no accounts; otherwise an error,
 * so a live site can never quietly lose leads.
 */
export function getStore(): LeadStore {
  const supabase = supabaseSettings();
  if ("settings" in supabase) {
    const key = `supabase:${supabase.settings.url}:${supabase.settings.secretKey}`;
    if (cached?.key !== key) cached = { key, store: new SupabaseStore(supabase.settings) };
    return cached.store;
  }
  if (demoModeAllowed()) {
    if (cached?.key !== "demo") cached = { key: "demo", store: new DemoStore() };
    return cached.store;
  }
  throw new StoreNotConfiguredError();
}

/** Which store is in use, without creating it. */
export function storeKind(): "supabase" | "demo" | "none" {
  if ("settings" in supabaseSettings()) return "supabase";
  return demoModeAllowed() ? "demo" : "none";
}
