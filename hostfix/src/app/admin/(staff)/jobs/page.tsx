import type { Metadata } from "next";
import Link from "next/link";
import { JobRow } from "@/components/jobs/JobRow";
import { EmptyState, PageTitle } from "@/components/ui/Bits";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listJobsForStaff } from "@/lib/jobs/store";
import type { JobStatus } from "@/lib/jobs/types";
import { listMarkets } from "@/lib/markets/store";

export const metadata: Metadata = { title: "Jobs" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS: { key: string; label: string; status: JobStatus | "open" | null }[] = [
  { key: "open", label: "Open", status: "open" },
  { key: "offering", label: "Finding a tradie", status: "offering" },
  { key: "unfilled", label: "Nobody accepted", status: "unfilled" },
  { key: "awaiting_approval", label: "Quote waiting", status: "awaiting_approval" },
  { key: "completed", label: "Done", status: "completed" },
  { key: "all", label: "All", status: null },
];

export default async function StaffJobsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const markets = await listMarkets(db);
  const market = markets.find((candidate) => candidate.slug === query.market) ?? null;
  const filter = FILTERS.find((candidate) => candidate.key === query.show) ?? FILTERS[0]!;
  const jobs = await listJobsForStaff(db, { market: market?.slug ?? null, status: filter.status, limit: 300 });
  const zone = (slug: string) => markets.find((candidate) => candidate.slug === slug)?.timezone ?? "Pacific/Auckland";
  const at = now();
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;
  const href = (show: string, slug: string | null) => `/admin/jobs?show=${show}${slug ? `&market=${slug}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Jobs" intro="Soonest promised time first." />
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((candidate) => (
          <Link key={candidate.key} href={href(candidate.key, market?.slug ?? null)} className={pill(candidate.key === filter.key)}>
            {candidate.label}
          </Link>
        ))}
      </div>
      {markets.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href={href(filter.key, null)} className={pill(!market)}>
            Every market
          </Link>
          {markets.map((candidate) => (
            <Link key={candidate.slug} href={href(filter.key, candidate.slug)} className={pill(market?.slug === candidate.slug)}>
              {candidate.name}
            </Link>
          ))}
        </div>
      )}
      {jobs.length === 0 ? (
        <EmptyState icon="jobs" title="No jobs here">
          Nothing matches this filter.
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} href={`/admin/jobs/${job.id}`} audience="staff" now={at} timeZone={zone(job.market)} />
          ))}
        </div>
      )}
    </div>
  );
}
