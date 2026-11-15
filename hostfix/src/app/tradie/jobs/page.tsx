import type { Metadata } from "next";
import { JobRow } from "@/components/jobs/JobRow";
import { EmptyState, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { requireTradie } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listJobsForTradie } from "@/lib/jobs/store";
import { isOpen } from "@/lib/jobs/types";
import { listMarkets } from "@/lib/markets/store";

export const metadata: Metadata = { title: "My jobs" };

export default async function TradieJobsPage() {
  const viewer = await requireTradie("/tradie/jobs");
  const db = await getDb();
  const jobs = await listJobsForTradie(db, viewer.tradieId, { limit: 200 });
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));
  const zone = (slug: string) => markets.get(slug)?.timezone ?? "Pacific/Auckland";
  const at = now();
  const open = jobs.filter((job) => isOpen(job.status));
  const closed = jobs.filter((job) => !isOpen(job.status));

  return (
    <div>
      <PageTitle title="My jobs" />
      {jobs.length === 0 ? (
        <EmptyState icon="jobs" title="No jobs yet">
          Jobs you accept show up here, with the address, the steps and what you are paid.
        </EmptyState>
      ) : (
        <div className="space-y-7">
          {open.length > 0 && (
            <section>
              <SectionTitle>To do</SectionTitle>
              <div className="space-y-2.5">
                {open.map((job) => (
                  <JobRow key={job.id} job={job} href={`/tradie/jobs/${job.id}`} audience="tradie" now={at} timeZone={zone(job.market)} />
                ))}
              </div>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <SectionTitle>Finished</SectionTitle>
              <div className="space-y-2.5">
                {closed.map((job) => (
                  <JobRow key={job.id} job={job} href={`/tradie/jobs/${job.id}`} audience="tradie" now={at} timeZone={zone(job.market)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
