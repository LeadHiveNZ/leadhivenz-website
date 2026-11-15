import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/forms/styles";
import { JobRow } from "@/components/jobs/JobRow";
import { EmptyState, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { requireOwner } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { listJobsForOwner } from "@/lib/jobs/store";
import { isOpen } from "@/lib/jobs/types";
import { listMarkets } from "@/lib/markets/store";
import { listProperties } from "@/lib/properties/service";

export const metadata: Metadata = { title: "Jobs" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OwnerJobsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/jobs");
  const query = await searchParams;
  const db = await getDb();
  const properties = await listProperties(db, viewer.ownerId);
  const chosen = typeof query.property === "string" && isUuid(query.property) ? properties.find((property) => property.id === query.property) : undefined;
  const jobs = await listJobsForOwner(db, viewer.ownerId, { propertyId: chosen?.id, limit: 200 });
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));
  const zone = (slug: string) => markets.get(slug)?.timezone ?? "Pacific/Auckland";
  const at = now();
  const open = jobs.filter((job) => isOpen(job.status));
  const closed = jobs.filter((job) => !isOpen(job.status));
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div>
      <PageTitle title="Jobs" />
      {properties.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href="/app/jobs" className={pill(!chosen)}>
            All properties
          </Link>
          {properties.map((property) => (
            <Link key={property.id} href={`/app/jobs?property=${property.id}`} className={pill(chosen?.id === property.id)}>
              {property.name}
            </Link>
          ))}
        </div>
      )}
      {jobs.length === 0 ? (
        <EmptyState
          icon="jobs"
          title="No jobs yet"
          action={
            properties.some((property) => property.status === "active") ? (
              <Link href="/app/jobs/new" className={buttonClass}>
                Report a problem
              </Link>
            ) : undefined
          }
        >
          When something needs fixing, it shows up here with the tradie, the price and photos of the finished work.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {open.length > 0 && (
            <section>
              <SectionTitle>Open</SectionTitle>
              <div className="space-y-2.5">
                {open.map((job) => (
                  <JobRow key={job.id} job={job} href={`/app/jobs/${job.id}`} audience="owner" now={at} timeZone={zone(job.market)} />
                ))}
              </div>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <SectionTitle>Finished</SectionTitle>
              <div className="space-y-2.5">
                {closed.map((job) => (
                  <JobRow key={job.id} job={job} href={`/app/jobs/${job.id}`} audience="owner" now={at} timeZone={zone(job.market)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
