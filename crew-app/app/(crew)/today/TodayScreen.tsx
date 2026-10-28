"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { StatusChip } from "@/components/StatusChip";
import { TopBar } from "@/components/TopBar";
import { UserMenu } from "@/components/UserMenu";
import { loadJobsForDate } from "@/lib/data";
import { onOutboxChange } from "@/lib/offline/db";
import { onSyncDone } from "@/lib/offline/sync";
import { addDays, fmtDateLong, fmtTime, todayYmd } from "@/lib/time";
import type { JobBundle } from "@/lib/types";
import { useCrew } from "../CrewContext";

export function TodayScreen({ initialDate }: { initialDate: string | null }) {
  const { user } = useCrew();
  const [date, setDate] = useState(initialDate ?? todayYmd());
  const [jobs, setJobs] = useState<JobBundle[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pullStart = useRef<number | null>(null);

  const van = user.role === "admin" ? null : user.van;

  const load = useCallback(async () => {
    setRefreshing(true);
    const r = await loadJobsForDate(date, van);
    setJobs(r.data);
    setFromCache(r.fromCache);
    setRefreshing(false);
  }, [date, van]);

  useEffect(() => {
    setJobs(null);
    void load();
    const off1 = onSyncDone(() => void load());
    const off2 = onOutboxChange(() => void load());
    return () => {
      off1();
      off2();
    };
  }, [load]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (date === todayYmd()) url.searchParams.delete("d");
    else url.searchParams.set("d", date);
    window.history.replaceState(null, "", url.toString());
  }, [date]);

  // Swipe left/right to change day; pull down at the top to refresh.
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    pullStart.current = window.scrollY <= 0 ? t.clientY : null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) setDate((d) => addDays(d, dx < 0 ? 1 : -1));
    else if (pullStart.current != null && dy > 90 && Math.abs(dx) < 40) void load();
    touchStart.current = null;
  }

  const isToday = date === todayYmd();
  const heading = isToday ? "Today" : date === addDays(todayYmd(), 1) ? "Tomorrow" : date === addDays(todayYmd(), -1) ? "Yesterday" : fmtDateLong(date);

  return (
    <div className="min-h-dvh pb-24" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TopBar right={<UserMenu user={user} />} home="/today" />
      <main className="mx-auto max-w-2xl px-3">
        <div className="flex items-center justify-between py-3">
          <button className="btn btn-ghost w-14 text-3xl" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
            ‹
          </button>
          <div className="text-center">
            <h1 className="text-3xl leading-none">{heading}</h1>
            <p className="text-muted">{fmtDateLong(date)}</p>
          </div>
          <button className="btn btn-ghost w-14 text-3xl" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
            ›
          </button>
        </div>

        {!isToday && (
          <button className="btn btn-outline mb-3" onClick={() => setDate(todayYmd())}>
            Back to today
          </button>
        )}

        {fromCache && (
          <p className="mb-3 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            Showing what&apos;s saved on this phone{refreshing ? "…" : ". Pull down to try again."}
          </p>
        )}

        {jobs === null && <p className="py-10 text-center text-muted">Loading…</p>}
        {jobs && jobs.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-xl font-semibold">No jobs {isToday ? "today" : "this day"}.</p>
            <p className="mt-1 text-muted">Swipe to see another day, or call the office.</p>
          </div>
        )}

        <ul className="space-y-3">
          {jobs?.map((b) => (
            <li key={b.job.id}>
              <Link href={`/jobs/${b.job.id}`} className="card block p-4 active:bg-page">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">
                      {fmtTime(b.job.start_at)} – {fmtTime(b.job.end_at)}
                      {user.role === "admin" && <span className="ml-2 text-muted">{brand.vans.find((v) => v.id === b.job.van)?.shortLabel}</span>}
                    </p>
                    <p className="truncate text-2xl leading-tight">
                      <span className="heading">{b.job.customer_first_name}</span>
                      {b.job.suburb && <span className="text-muted"> · {b.job.suburb}</span>}
                    </p>
                    <p className="mt-1 truncate text-muted">
                      {b.job.job_type}
                      {b.job.is_gas && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-sm font-bold text-accent">GAS</span>}
                    </p>
                  </div>
                  <StatusChip status={b.job.status} />
                </div>
                {(b.photos.length > 0 || b.time.length > 0) && (
                  <p className="mt-2 text-sm text-muted">
                    {b.photos.length > 0 && `${b.photos.length} photo${b.photos.length === 1 ? "" : "s"}`}
                    {b.photos.length > 0 && b.time.length > 0 && " · "}
                    {b.time.length > 0 && `${(b.time.reduce((s, t) => s + t.minutes, 0) / 60).toFixed(2).replace(/\.?0+$/, "")} h logged`}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
