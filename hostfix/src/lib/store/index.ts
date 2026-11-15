import "server-only";
import { databaseKind, getDb } from "@/lib/db";
import { SqlLeadStore } from "./sql";
import { StoreNotConfiguredError, type LeadStore } from "./types";

export type { Lead, LeadStore, LeadType, NewLead } from "./types";
export { StoreNotConfiguredError } from "./types";

/**
 * The place leads are saved: the real database when it is set up, the in-app
 * demo database when trying things on a computer with no accounts, otherwise
 * an error, so a live site can never quietly lose leads.
 */
export function getStore(): LeadStore {
  const kind = databaseKind();
  if (kind === "none") throw new StoreNotConfiguredError();
  return new SqlLeadStore(getDb, kind === "postgres" ? "postgres" : "demo");
}

/** Which store is in use, without opening it. */
export function storeKind(): "postgres" | "demo" | "none" {
  const kind = databaseKind();
  return kind === "embedded" ? "demo" : kind;
}
