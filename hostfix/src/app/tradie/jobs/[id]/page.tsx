import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradieJob } from "@/components/jobs/TradieJob";
import { listPriceList } from "@/lib/jobs/parts";
import { PageTitle } from "@/components/ui/Bits";
import { requireTradie } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listUploads } from "@/lib/files/uploads";
import { isUuid } from "@/lib/ids";
import { getJobForTradie } from "@/lib/jobs/store";
import { loadJobView } from "@/lib/jobs/view";

export const metadata: Metadata = { title: "Job" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TradieJobPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const viewer = await requireTradie(`/tradie/jobs/${id}`);
  const query = await searchParams;
  const db = await getDb();
  const job = isUuid(id) ? await getJobForTradie(db, viewer.tradieId, id) : null;
  if (!job) notFound();
  const view = await loadJobView(db, job, "tradie");
  const propertyPhotos = await listUploads(db, { propertyId: job.propertyId, kinds: ["property"] });
  const quoted = query.quoted === "wait" || query.quoted === "go" ? query.quoted : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={`Job ${job.number}`} back={{ href: "/tradie/jobs", label: "My jobs" }} />
      <TradieJob view={view} now={now()} propertyPhotos={propertyPhotos} priceList={await listPriceList(db, view.market.slug)} flash={{ yours: Boolean(query.yours), here: Boolean(query.here), quoted, done: Boolean(query.done), parts: query.parts === "wait" || query.parts === "go" ? query.parts : null }} />
    </div>
  );
}
