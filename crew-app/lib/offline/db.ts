"use client";
/**
 * Local storage on the phone (IndexedDB). Two jobs:
 *  1. Cache jobs and their photos/hours/notes so the app opens with no signal.
 *  2. An outbox of changes made offline, replayed in order once back online.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { JobBundle, JobStatus, PhotoKind } from "@/lib/types";

export type OutboxOp =
  | { kind: "set_status"; job_id: string; status: JobStatus; at: string }
  | { kind: "add_time"; id: string; job_id: string; user_id: string; minutes: number; started_at: string; rate_band: "standard" | "after_hours" | "night_sunday" }
  | { kind: "add_material"; id: string; job_id: string; description: string; qty: number; added_by: string }
  | { kind: "add_note"; id: string; job_id: string; user_id: string; text: string; created_at: string }
  | { kind: "add_photo"; id: string; job_id: string; photo_kind: PhotoKind; taken_by: string; taken_at: string; blob_key: string };

export interface OutboxItem {
  seq?: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
  op: OutboxOp;
}

interface CrewDB extends DBSchema {
  jobs: { key: string; value: JobBundle & { cachedAt: number }; indexes: { byDate: string } };
  outbox: { key: number; value: OutboxItem; indexes: { byJob: string } };
  blobs: { key: string; value: { key: string; blob: Blob; type: string } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<CrewDB>> | null = null;

export function db() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB not available");
  if (!dbPromise) {
    dbPromise = openDB<CrewDB>("crew-app", 1, {
      upgrade(d) {
        const jobs = d.createObjectStore("jobs", { keyPath: "job.id" });
        jobs.createIndex("byDate", "job.date");
        const outbox = d.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        outbox.createIndex("byJob", "op.job_id");
        d.createObjectStore("blobs", { keyPath: "key" });
        d.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function cacheBundles(bundles: JobBundle[]) {
  const d = await db();
  const tx = d.transaction("jobs", "readwrite");
  const now = Date.now();
  await Promise.all([...bundles.map((b) => tx.store.put({ ...b, cachedAt: now })), tx.done]);
}

export async function cachedBundlesForDate(date: string): Promise<JobBundle[]> {
  const d = await db();
  return d.getAllFromIndex("jobs", "byDate", date);
}

export async function cachedBundle(jobId: string): Promise<JobBundle | undefined> {
  const d = await db();
  return d.get("jobs", jobId);
}

export async function putBundle(bundle: JobBundle) {
  const d = await db();
  await d.put("jobs", { ...bundle, cachedAt: Date.now() });
}

export async function enqueue(op: OutboxOp) {
  const d = await db();
  await d.add("outbox", { createdAt: Date.now(), attempts: 0, op });
  notifyOutbox();
}

export async function outboxItems(): Promise<OutboxItem[]> {
  const d = await db();
  return d.getAll("outbox");
}

export async function outboxCount(): Promise<number> {
  const d = await db();
  return d.count("outbox");
}

export async function outboxForJob(jobId: string): Promise<OutboxItem[]> {
  const d = await db();
  return d.getAllFromIndex("outbox", "byJob", jobId);
}

export async function removeOutbox(seq: number) {
  const d = await db();
  await d.delete("outbox", seq);
  notifyOutbox();
}

export async function markOutboxError(item: OutboxItem, error: string) {
  const d = await db();
  if (item.seq == null) return;
  await d.put("outbox", { ...item, attempts: item.attempts + 1, lastError: error });
  notifyOutbox();
}

export async function putBlob(key: string, blob: Blob) {
  const d = await db();
  await d.put("blobs", { key, blob, type: blob.type });
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const d = await db();
  return (await d.get("blobs", key))?.blob;
}

export async function deleteBlob(key: string) {
  const d = await db();
  await d.delete("blobs", key);
}

// Simple pub/sub so the "Saved on phone" badge updates everywhere.
const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function notifyOutbox() {
  listeners.forEach((fn) => fn());
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
