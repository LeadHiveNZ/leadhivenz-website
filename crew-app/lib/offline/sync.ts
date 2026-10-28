"use client";
/**
 * Replays the outbox against Supabase, in order, whenever we're online.
 * Each op is idempotent (client-generated ids, upsert-style writes), so a retry after a
 * half-finished upload is safe.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import { deleteBlob, getBlob, markOutboxError, outboxItems, removeOutbox, type OutboxItem } from "./db";

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
const doneListeners = new Set<() => void>();

export function onSyncDone(fn: () => void) {
  doneListeners.add(fn);
  return () => {
    doneListeners.delete(fn);
  };
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Start background syncing: on load, when the network comes back, and every 30 s. */
export function startSyncLoop() {
  if (typeof window === "undefined" || timer) return;
  window.addEventListener("online", () => void flushOutbox());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushOutbox();
  });
  timer = setInterval(() => void flushOutbox(), 30_000);
  void flushOutbox();
}

export async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  if (running || !isOnline()) return { synced: 0, failed: 0 };
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    const items = await outboxItems();
    for (const item of items) {
      try {
        await apply(item);
        if (item.seq != null) await removeOutbox(item.seq);
        synced++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await markOutboxError(item, msg);
        failed++;
        // A network drop mid-way: stop and try again later, keeping order.
        if (!isOnline() || /fetch|network/i.test(msg)) break;
      }
    }
  } finally {
    running = false;
    if (synced > 0) doneListeners.forEach((fn) => fn());
  }
  return { synced, failed };
}

async function apply(item: OutboxItem) {
  const sb = supabaseBrowser();
  const op = item.op;
  switch (op.kind) {
    case "set_status": {
      const patch: Record<string, unknown> = { status: op.status };
      if (op.status === "done") patch.completed_at = op.at;
      const { error } = await sb.from("jobs").update(patch).eq("id", op.job_id);
      if (error) throw new Error(error.message);
      return;
    }
    case "add_time": {
      const { error } = await sb.from("time_entries").upsert(
        { id: op.id, job_id: op.job_id, user_id: op.user_id, minutes: op.minutes, started_at: op.started_at, rate_band: op.rate_band },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
      return;
    }
    case "add_material": {
      const { error } = await sb
        .from("job_materials")
        .upsert({ id: op.id, job_id: op.job_id, description: op.description, qty: op.qty, added_by: op.added_by }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      return;
    }
    case "add_note": {
      const { error } = await sb
        .from("job_notes")
        .upsert({ id: op.id, job_id: op.job_id, user_id: op.user_id, text: op.text, created_at: op.created_at }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      return;
    }
    case "add_photo": {
      const blob = await getBlob(op.blob_key);
      const path = `${op.job_id}/${op.id}.jpg`;
      if (blob) {
        const { error: upErr } = await sb.storage.from("job-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(upErr.message);
      }
      const { error } = await sb
        .from("job_photos")
        .upsert({ id: op.id, job_id: op.job_id, kind: op.photo_kind, storage_path: path, taken_by: op.taken_by, taken_at: op.taken_at }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      await deleteBlob(op.blob_key);
      return;
    }
  }
}
