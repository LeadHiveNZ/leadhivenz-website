import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { acceptJob, passJob } from "@/app/actions/tradie";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { CostLines } from "@/components/jobs/JobParts";
import { Countdown } from "@/components/jobs/TradieClient";
import { TradieJob } from "@/components/jobs/TradieJob";
import { Card, Chip, Notice } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Loading } from "@/components/ui/Loading";
import { PlainShell } from "@/components/ui/PlainShell";
import { findTrade } from "@config/trades";
import { offerFromLink } from "@/lib/access/links";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { countUploads, listUploads } from "@/lib/files/uploads";
import { getJobForStaff, listLines } from "@/lib/jobs/store";
import { loadJobView } from "@/lib/jobs/view";
import { getMarket } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { getPropertyForStaff } from "@/lib/properties/service";
import { formatDeadline } from "@/lib/time";

export const metadata: Metadata = { title: "Job offer", robots: { index: false, follow: false } };

type Params = Promise<{ code: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * THE TRADIE'S ONE-TAP PAGE. The text we send with a job offer links here.
 * The link carries its own proof, so there is no signing in: open it, tap
 * Accept. Once accepted, the same link is the job page, with the address and
 * the steps.
 *
 * Opening the link never accepts by itself. Phones and messaging apps open
 * links on their own to show a preview, and a preview must not take a job.
 */
export default function OfferPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <PlainShell wide>
      <Suspense fallback={<Loading />}>
        <Opened params={params} searchParams={searchParams} />
      </Suspense>
    </PlainShell>
  );
}

function Closed({ title, children }: { title: string; children: string }) {
  return (
    <div className="space-y-4 pt-4">
      <h1 className="display text-4xl text-ink">{title}</h1>
      <p className="text-lg text-muted">{children}</p>
      <Link href="/sign-in?next=/tradie" className="inline-block font-semibold text-brand underline underline-offset-2">
        Sign in to see your jobs and offers
      </Link>
    </div>
  );
}

async function Opened({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { code } = await params;
  const query = await searchParams;
  const db = await getDb();
  const offer = await offerFromLink(db, code);
  const job = offer ? await getJobForStaff(db, offer.jobId) : null;
  const market = job ? await getMarket(db, job.market) : null;
  if (!offer || !job || !market) return <Closed title="That link did not open">It may have been cut short when it was copied. Open it again from the text we sent you.</Closed>;
  const at = now();

  // Accepted by this tradie: the link is now their job page.
  if (offer.status === "accepted" && job.tradieId === offer.tradieId) {
    const view = await loadJobView(db, job, "tradie");
    const propertyPhotos = await listUploads(db, { propertyId: job.propertyId, kinds: ["property"] });
    const quoted = query.quoted === "wait" || query.quoted === "go" ? query.quoted : null;
    return (
      <TradieJob view={view} now={at} code={code} propertyPhotos={propertyPhotos} flash={{ yours: Boolean(query.yours), here: Boolean(query.here), quoted, done: Boolean(query.done) }} />
    );
  }

  if (offer.status === "passed") return <Closed title="You passed on this job">It has been offered to someone else. Thanks for letting us know quickly.</Closed>;
  if (job.status === "cancelled") return <Closed title="This job was cancelled">The owner no longer needs it. Nothing for you to do.</Closed>;
  const canTake = (offer.status === "pending" || offer.status === "expired") && (job.status === "offering" || job.status === "unfilled");
  if (!canTake) return <Closed title="This job has gone">Another tradie took it. There will be more.</Closed>;

  const property = await getPropertyForStaff(db, job.propertyId);
  const lines = await listLines(db, job.id);
  const photos = await countUploads(db, job.id, "report");
  const trade = findTrade(job.trade);
  const late = offer.status === "expired" || offer.expiresAt.getTime() <= at.getTime();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold tracking-wide text-brand uppercase">Job offer</p>
        <h1 className="display mt-1 text-4xl text-ink">{job.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-lg text-muted">
          <Icon name="market" size={18} /> {property?.suburb ?? market.name}
          {job.urgency === "urgent" && <Chip tone="alert">Urgent</Chip>}
          {job.afterHours && <Chip tone="brand">After hours</Chip>}
        </p>
      </div>

      <Card className="border-brand/30 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">You get</p>
            <p className="display tabular text-5xl text-ink">{formatMoney(offer.payoutCents, job.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-muted">Be on site by</p>
            <p className="text-lg font-bold text-ink">{job.respondBy ? formatDeadline(job.respondBy, at, market.timezone) : "As soon as you can"}</p>
          </div>
        </div>

        <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${late ? "bg-wait-soft text-wait" : "bg-tint text-brand"}`}>
          {late ? (
            "Your time to answer ran out, but nobody else has taken it. It is still yours if you want it."
          ) : (
            <>
              Held for you for <Countdown until={offer.expiresAt.toISOString()} fallback={`${market.offerMinutes} minutes`} done="a moment longer" />. Then it is offered to the next tradie.
            </>
          )}
        </p>

        <div className="mt-4 space-y-2.5">
          <ActionForm action={acceptJob} className="space-y-2">
            <input type="hidden" name="code" value={code} />
            <SubmitButton pendingLabel="Accepting..." className="min-h-14 w-full text-lg">
              Accept job
            </SubmitButton>
          </ActionForm>
          <ActionForm action={passJob} className="space-y-2">
            <input type="hidden" name="code" value={code} />
            <SubmitButton variant="secondary" pendingLabel="Passing..." className="w-full">
              Pass
            </SubmitButton>
          </ActionForm>
        </div>
        <p className="mt-3 text-center text-sm text-muted">Accepting means you will be at the property by the time above. Can&apos;t make it? Pass, so it moves on quickly.</p>
      </Card>

      <Card>
        <p className="font-bold text-ink">About the job</p>
        {job.description ? <p className="mt-1 whitespace-pre-line text-muted">{job.description}</p> : <p className="mt-1 text-muted">No extra details were given.</p>}
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          {job.licenceRequired && (
            <li className="flex gap-2">
              <Icon name="shield" size={16} className="mt-0.5 text-brand" /> Needs your {trade?.label.toLowerCase() ?? job.trade} licence.
            </li>
          )}
          {photos > 0 && (
            <li className="flex gap-2">
              <Icon name="camera" size={16} className="mt-0.5 text-brand" /> {photos} {photos === 1 ? "photo" : "photos"}, shown once you accept.
            </li>
          )}
          <li className="flex gap-2">
            <Icon name="door" size={16} className="mt-0.5 text-brand" /> The address and how to get in are shown once you accept.
          </li>
          {job.offMenu && (
            <li className="flex gap-2">
              <Icon name="clock" size={16} className="mt-0.5 text-brand" /> A look-and-price job: you are paid this call-out to go and look, then you quote the work.
            </li>
          )}
        </ul>
      </Card>

      <Card>
        <p className="mb-1 font-bold text-ink">How the pay is made up</p>
        <CostLines lines={lines} currency={job.currency} side="tradie" totalLabel="You get" />
        <p className="mt-3 text-sm text-muted">Sent to your bank about {market.payoutHoldHours} hours after the job is done.</p>
      </Card>

      {query.passed && <Notice tone="info" title="Passed" />}
    </div>
  );
}
