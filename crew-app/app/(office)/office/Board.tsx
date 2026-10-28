"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { StatusChip } from "@/components/StatusChip";
import { TopBar } from "@/components/TopBar";
import { UserMenu } from "@/components/UserMenu";
import { loadJobsForDate, photoUrl } from "@/lib/data";
import { getBlob } from "@/lib/offline/db";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDays, fmtDateLong, fmtHours, fmtTime, todayYmd } from "@/lib/time";
import type { JobBundle, SyncIssue } from "@/lib/types";
import { useCrew } from "../../(crew)/CrewContext";
import { OfficeNav } from "./OfficeNav";

export function Board({ initialDate }: { initialDate: string | null }) {
  const { user, crew } = useCrew();
  const [date, setDate] = useState(initialDate ?? todayYmd());
  const [jobs, setJobs] = useState<JobBundle[] | null>(null);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const r = await loadJobsForDate(date, null);
    setJobs(r.data);
    const { data } = await supabaseBrowser().from("calendar_sync_issues").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(20);
    setIssues((data ?? []) as SyncIssue[]);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates from the vans.
  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel("office-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "job_photos" }, () => void load())
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    const t = setInterval(() => void load(), 60_000); // belt and braces
    return () => {
      clearInterval(t);
      sb.removeChannel(channel);
    };
  }, [load]);

  const isToday = date === todayYmd();

  return (
    <div className="min-h-dvh pb-10">
      <TopBar title="Office board" right={<UserMenu user={user} />} home="/office" />
      <OfficeNav active="board" />
      <main className="mx-auto max-w-6xl px-3">
        <div className="flex items-center justify-between py-3">
          <button className="btn btn-ghost w-14 text-3xl" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <div className="text-center">
            <h2 className="text-2xl leading-none">{isToday ? "Today" : fmtDateLong(date)}</h2>
            <p className="text-sm text-muted">
              {isToday && fmtDateLong(date)} {live ? "· live" : "· refreshing every minute"}
            </p>
          </div>
          <button className="btn btn-ghost w-14 text-3xl" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
            ›
          </button>
        </div>

        {issues.length > 0 && (
          <div className="card mb-4 border-danger/40 bg-danger/5 p-4">
            <h3 className="text-lg text-danger">Calendar events that didn&apos;t parse ({issues.length})</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {issues.map((i) => (
                <li key={i.id}>
                  <span className="font-semibold">{i.title || i.calendar_event_id}</span> — {i.reason}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">Fix the event in Google Calendar (title &quot;[Van 2] Customer - Job&quot;, lines Address:, Suburb:, Phone:, Job:, Notes:, Gas:, Quoted hours:) and it will come through on the next sync.</p>
          </div>
        )}

        {jobs === null && <p className="py-10 text-center text-muted">Loading…</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {brand.vans.map((van) => {
            const vanJobs = (jobs ?? []).filter((b) => b.job.van === van.id);
            const people = crew.filter((c) => c.van === van.id).map((c) => c.name);
            return (
              <section key={van.id}>
                <h3 className="mb-2 flex items-baseline justify-between text-xl">
                  <span>{van.label}</span>
                  <span className="text-sm font-normal normal-case tracking-normal text-muted" style={{ fontFamily: "var(--font-body)" }}>
                    {people.join(" + ") || "Unassigned"} · {vanJobs.length} job{vanJobs.length === 1 ? "" : "s"}
                  </span>
                </h3>
                {jobs && vanJobs.length === 0 && <p className="card p-4 text-muted">Nothing booked.</p>}
                <ul className="space-y-2">
                  {vanJobs.map((b) => (
                    <BoardCard key={b.job.id} bundle={b} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function BoardCard({ bundle }: { bundle: JobBundle }) {
  const { job } = bundle;
  const minutes = bundle.time.reduce((s, t) => s + t.minutes, 0);
  const quotedMin = job.quoted_hours != null ? Math.round(job.quoted_hours * 60) : null;
  const over = quotedMin != null && minutes > quotedMin;
  const last = bundle.photos[bundle.photos.length - 1];
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (last) photoUrl(last.storage_path, getBlob).then((u) => alive && setThumb(u));
    else setThumb(null);
    return () => {
      alive = false;
    };
  }, [last]);

  return (
    <li>
      <Link href={`/office/jobs/${job.id}`} className="card flex gap-3 p-3 hover:bg-page">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-page">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-muted">No photo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">
              {fmtTime(job.start_at)} – {fmtTime(job.end_at)}
            </p>
            <StatusChip status={job.status} />
          </div>
          <p className="truncate text-xl leading-tight">
            <span className="heading">{job.customer_first_name}</span>
            {job.suburb && <span className="text-muted"> · {job.suburb}</span>}
          </p>
          <p className="truncate text-muted">
            {job.job_type}
            {job.is_gas && <span className="ml-2 rounded bg-accent/15 px-1.5 text-xs font-bold text-accent">GAS</span>}
          </p>
          <p className={`mt-1 text-sm font-semibold ${over ? "text-danger" : "text-muted"}`}>
            {minutes > 0 ? fmtHours(minutes) : "0 h"} logged{quotedMin != null && ` / ${job.quoted_hours} h quoted`}
            {over && " — OVER"}
            {bundle.photos.length > 0 && ` · ${bundle.photos.length} photo${bundle.photos.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </Link>
    </li>
  );
}
