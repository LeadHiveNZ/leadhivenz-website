import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerJob } from "@/components/jobs/OwnerJob";
import { PageTitle } from "@/components/ui/Bits";
import { requireOwner } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { previewPrice } from "@/lib/jobs/create";
import { getJobForOwner } from "@/lib/jobs/store";
import { loadJobView } from "@/lib/jobs/view";

export const metadata: Metadata = { title: "Job" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OwnerJobPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const viewer = await requireOwner(`/app/jobs/${id}`);
  const query = await searchParams;
  const db = await getDb();
  const job = await getJobForOwner(db, viewer.ownerId, id);
  if (!job) notFound();
  const view = await loadJobView(db, job, "owner");
  const prices =
    job.status === "awaiting_owner"
      ? {
          standard: await previewPrice(db, view.property, { menuItemId: job.menuItemId, urgent: false }),
          urgent: await previewPrice(db, view.property, { menuItemId: job.menuItemId, urgent: true }),
        }
      : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={job.title} back={{ href: "/app/jobs", label: "Jobs" }} />
      <OwnerJob
        view={view}
        now={now()}
        prices={prices}
        flash={{ sent: Boolean(query.sent), already: Boolean(query.already), cancelled: Boolean(query.cancelled), answered: Boolean(query.answered), told: Boolean(query.told) }}
      />
    </div>
  );
}
