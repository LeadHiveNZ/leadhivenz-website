"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { StatusChip } from "@/components/StatusChip";
import { TopBar } from "@/components/TopBar";
import { UserMenu } from "@/components/UserMenu";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDays, fmtDateShort, fmtTime, todayYmd } from "@/lib/time";
import type { Job } from "@/lib/types";
import { useCrew } from "../../../(crew)/CrewContext";
import { OfficeNav } from "../OfficeNav";

function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

export function WeekScreen() {
  const { user } = useCrew();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayYmd()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Job[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().from("jobs").select("*").gte("date", weekStart).lte("date", addDays(weekStart, 6)).order("start_at");
      setJobs((data ?? []) as Job[]);
    })();
  }, [weekStart]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const safe = term.replace(/[%,().]/g, " ").trim();
      const { data } = await supabaseBrowser()
        .from("jobs")
        .select("*")
        .or(`suburb.ilike.%${safe}%,customer_first_name.ilike.%${safe}%,address.ilike.%${safe}%`)
        .order("date", { ascending: false })
        .limit(50);
      setResults((data ?? []) as Job[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayYmd();

  return (
    <div className="min-h-dvh pb-10">
      <TopBar title="Week & search" right={<UserMenu user={user} />} home="/office" />
      <OfficeNav active="week" />
      <main className="mx-auto max-w-6xl space-y-4 px-3 pt-3">
        <input className="input" placeholder="Search past jobs by suburb, customer first name or street" value={q} onChange={(e) => setQ(e.target.value)} />

        {results !== null && (
          <section className="card p-4">
            <h2 className="text-xl">
              {searching ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {results.map((j) => (
                <JobRow key={j.id} job={j} showDate />
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center justify-between">
          <button className="btn btn-ghost w-14 text-3xl" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <h2 className="whitespace-nowrap text-2xl">Week of {fmtDateShort(weekStart)}</h2>
          <button className="btn btn-ghost w-14 text-3xl" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {days.map((d) => {
            const dayJobs = jobs.filter((j) => j.date === d);
            return (
              <section key={d} className={`card p-3 ${d === today ? "border-accent" : ""}`}>
                <h3 className="flex items-baseline justify-between text-lg">
                  <Link href={`/office?d=${d}`} className="underline-offset-2 hover:underline">
                    {fmtDateShort(d)}
                  </Link>
                  <span className="text-sm font-normal text-muted" style={{ fontFamily: "var(--font-body)", textTransform: "none" }}>
                    {dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <ul className="mt-1 divide-y divide-line">
                  {dayJobs.map((j) => (
                    <JobRow key={j.id} job={j} />
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

function JobRow({ job, showDate = false }: { job: Job; showDate?: boolean }) {
  const van = brand.vans.find((v) => v.id === job.van)?.shortLabel ?? `V${job.van}`;
  return (
    <li>
      <Link href={`/office/jobs/${job.id}`} className="flex items-center gap-3 py-2 hover:bg-page">
        <span className="w-16 shrink-0 text-sm font-semibold text-muted">{showDate ? fmtDateShort(job.date) : fmtTime(job.start_at)}</span>
        <span className="w-8 shrink-0 text-sm font-bold">{van}</span>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">{job.customer_first_name}</span>
          {job.suburb && <span className="text-muted"> · {job.suburb}</span>}
          <span className="text-muted"> · {job.job_type}</span>
        </span>
        <StatusChip status={job.status} className="!px-2 !text-xs" />
      </Link>
    </li>
  );
}
