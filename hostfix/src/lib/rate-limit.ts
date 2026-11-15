import "server-only";
import { getStore } from "@/lib/store";

/**
 * Counts attempts and says when someone has made too many. Uses the database
 * so the count is shared across the whole site, and falls back to this
 * server's own memory if the database is unavailable.
 */

const memory = new Map<string, { hits: number; resetAt: number }>();

function memoryHit(key: string, windowSeconds: number, maxHits: number, nowMs: number): boolean {
  const current = memory.get(key);
  if (!current || current.resetAt <= nowMs) {
    if (memory.size > 5000) memory.clear();
    memory.set(key, { hits: 1, resetAt: nowMs + windowSeconds * 1000 });
    return true;
  }
  current.hits += 1;
  return current.hits <= maxHits;
}

/** Returns true while the caller is inside the limit. */
export async function withinRateLimit(key: string, windowSeconds: number, maxHits: number): Promise<boolean> {
  const allowedHere = memoryHit(key, windowSeconds, maxHits, Date.now());
  try {
    const allowedEverywhere = await getStore().rateLimitHit(key, windowSeconds, maxHits);
    return allowedHere && allowedEverywhere;
  } catch {
    return allowedHere;
  }
}
