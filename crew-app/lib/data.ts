"use client";
/**
 * Reads for the crew screens. Online: fetch from Supabase and refresh the local cache.
 * Offline (or on error): serve the cache. Pending outbox changes are layered on top so what
 * the crew member just did is always visible, even before it has uploaded.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Job, JobBundle, JobMaterial, JobNote, JobPhoto, TimeEntry } from "@/lib/types";
import { cacheBundles, cachedBundle, cachedBundlesForDate, outboxForJob, outboxItems, type OutboxItem } from "./offline/db";
import { isOnline } from "./offline/sync";

export interface LoadResult<T> {
  data: T;
  fromCache: boolean;
  error?: string;
}

const JOB_COLUMNS =
  "id, calendar_event_id, date, start_at, end_at, van, assigned_to, customer_first_name, customer_phone, address, suburb, travel_zone, job_type, description, access_notes, is_gas, quoted_hours, status, completed_at, updated_at";

async function fetchBundles(jobs: Job[]): Promise<JobBundle[]> {
  if (jobs.length === 0) return [];
  const sb = supabaseBrowser();
  const ids = jobs.map((j) => j.id);
  const [photos, time, materials, notes] = await Promise.all([
    sb.from("job_photos").select("*").in("job_id", ids).order("taken_at"),
    sb.from("time_entries").select("*").in("job_id", ids).order("started_at"),
    sb.from("job_materials").select("*").in("job_id", ids).order("created_at"),
    sb.from("job_notes").select("*").in("job_id", ids).order("created_at"),
  ]);
  for (const r of [photos, time, materials, notes]) if (r.error) throw new Error(r.error.message);
  return jobs.map((job) => ({
    job,
    photos: ((photos.data ?? []) as JobPhoto[]).filter((p) => p.job_id === job.id),
    time: ((time.data ?? []) as TimeEntry[]).filter((t) => t.job_id === job.id),
    materials: ((materials.data ?? []) as JobMaterial[]).filter((m) => m.job_id === job.id),
    notes: ((notes.data ?? []) as JobNote[]).filter((n) => n.job_id === job.id),
  }));
}

export async function loadJobsForDate(date: string, van?: number | null): Promise<LoadResult<JobBundle[]>> {
  const pending = await outboxItems();
  if (isOnline()) {
    try {
      const sb = supabaseBrowser();
      let q = sb.from("jobs").select(JOB_COLUMNS).eq("date", date).order("start_at");
      if (van != null) q = q.eq("van", van);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const bundles = await fetchBundles((data ?? []) as Job[]);
      await cacheBundles(bundles);
      return { data: bundles.map((b) => overlay(b, pending)), fromCache: false };
    } catch (e) {
      const cached = await cachedBundlesForDate(date);
      return { data: sortBundles(cached.map((b) => overlay(b, pending))), fromCache: true, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const cached = await cachedBundlesForDate(date);
  return { data: sortBundles(cached.map((b) => overlay(b, pending))), fromCache: true };
}

export async function loadJob(jobId: string): Promise<LoadResult<JobBundle | null>> {
  const pending = await outboxForJob(jobId);
  if (isOnline()) {
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb.from("jobs").select(JOB_COLUMNS).eq("id", jobId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { data: null, fromCache: false };
      const [bundle] = await fetchBundles([data as Job]);
      await cacheBundles([bundle]);
      return { data: overlay(bundle, pending), fromCache: false };
    } catch (e) {
      const cached = await cachedBundle(jobId);
      return { data: cached ? overlay(cached, pending) : null, fromCache: true, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const cached = await cachedBundle(jobId);
  return { data: cached ? overlay(cached, pending) : null, fromCache: true };
}

function sortBundles(b: JobBundle[]) {
  return [...b].sort((x, y) => x.job.start_at.localeCompare(y.job.start_at));
}

/** Layer not-yet-uploaded changes over a bundle so the UI shows them immediately. */
export function overlay(bundle: JobBundle, pending: OutboxItem[]): JobBundle {
  const mine = pending.filter((p) => p.op.job_id === bundle.job.id);
  if (mine.length === 0) return bundle;
  const out: JobBundle = {
    job: { ...bundle.job },
    photos: [...bundle.photos],
    time: [...bundle.time],
    materials: [...bundle.materials],
    notes: [...bundle.notes],
  };
  for (const { op } of mine) {
    switch (op.kind) {
      case "set_status":
        out.job.status = op.status;
        out.job.completed_at = op.status === "done" ? op.at : null;
        break;
      case "add_time":
        if (!out.time.some((t) => t.id === op.id))
          out.time.push({ id: op.id, job_id: op.job_id, user_id: op.user_id, minutes: op.minutes, started_at: op.started_at, rate_band: op.rate_band });
        break;
      case "add_material":
        if (!out.materials.some((m) => m.id === op.id))
          out.materials.push({ id: op.id, job_id: op.job_id, description: op.description, qty: op.qty, added_by: op.added_by });
        break;
      case "add_note":
        if (!out.notes.some((n) => n.id === op.id))
          out.notes.push({ id: op.id, job_id: op.job_id, user_id: op.user_id, text: op.text, created_at: op.created_at });
        break;
      case "add_photo":
        if (!out.photos.some((p) => p.id === op.id))
          out.photos.push({ id: op.id, job_id: op.job_id, kind: op.photo_kind, storage_path: `local:${op.blob_key}`, taken_by: op.taken_by, taken_at: op.taken_at });
        break;
    }
  }
  return out;
}

/** Signed URL for a stored photo, or an object URL for one still waiting on the phone. */
export async function photoUrl(storagePath: string, localBlobLoader: (key: string) => Promise<Blob | undefined>): Promise<string | null> {
  if (storagePath.startsWith("local:")) {
    const blob = await localBlobLoader(storagePath.slice("local:".length));
    return blob ? URL.createObjectURL(blob) : null;
  }
  if (!isOnline()) return null;
  const { data } = await supabaseBrowser().storage.from("job-photos").createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}
