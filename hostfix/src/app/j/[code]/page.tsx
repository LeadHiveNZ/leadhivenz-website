import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OwnerJob } from "@/components/jobs/OwnerJob";
import { Loading } from "@/components/ui/Loading";
import { PlainShell } from "@/components/ui/PlainShell";
import { jobFromOwnerLink } from "@/lib/access/links";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { goAheadPrices } from "@/lib/jobs/report-data";
import { loadJobView } from "@/lib/jobs/view";

export const metadata: Metadata = { title: "Your job", robots: { index: false, follow: false } };

type Params = Promise<{ code: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * THE OWNER'S ONE-TAP PAGE. Every text we send an owner about a job links
 * here. The link carries its own proof, so they can say yes to a quote or a
 * guest's report from the text without signing in. It opens that one job and
 * nothing else.
 */
export default function OwnerLinkPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <PlainShell wide>
      <Suspense fallback={<Loading />}>
        <LinkedJob params={params} searchParams={searchParams} />
      </Suspense>
    </PlainShell>
  );
}

async function LinkedJob({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { code } = await params;
  await connection();
  const query = await searchParams;
  const db = await getDb();
  const job = await jobFromOwnerLink(db, code);
  if (!job) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">That link did not open</h1>
        <p className="text-lg text-muted">It may have been cut short when it was copied. Sign in to see your jobs.</p>
        <Link href="/sign-in?next=/app/jobs" className="font-semibold text-brand underline underline-offset-2">
          Sign in
        </Link>
      </div>
    );
  }
  const view = await loadJobView(db, job, "owner");
  const prices =
    job.status === "awaiting_owner"
      ? await goAheadPrices(db, view.property, job)
      : undefined;

  return (
    <div>
      <p className="text-sm font-semibold text-muted">{view.property.name}</p>
      <h1 className="display mb-5 text-[1.75rem] text-ink sm:text-4xl">{job.title}</h1>
      <OwnerJob
        view={view}
        now={now()}
        code={code}
        prices={prices}
        flash={{ sent: Boolean(query.sent), cancelled: Boolean(query.cancelled), answered: Boolean(query.answered), told: Boolean(query.told), waiting: Boolean(query.waiting), absent: Boolean(query.absent), confirmed: Boolean(query.confirmed), stepped: Boolean(query.stepped) }}
      />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/sign-in?next=/app" className="font-semibold text-brand underline underline-offset-2">
          Sign in
        </Link>{" "}
        to see all your jobs and properties.
      </p>
    </div>
  );
}
