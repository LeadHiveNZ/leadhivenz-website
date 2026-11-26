import type { Metadata } from "next";
import Link from "next/link";
import { acceptJob, passJob, setPaused } from "@/app/actions/tradie";
import { ActionForm, Select } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { JobRow } from "@/components/jobs/JobRow";
import { Countdown } from "@/components/jobs/TradieClient";
import { Card, Chip, EmptyState, Notice, SectionTitle, Stat } from "@/components/ui/Bits";
import { findTrade } from "@config/trades";
import { requireTradie } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { appSecret } from "@/lib/env";
import { listJobsForTradie, listLiveOffersForTradie } from "@/lib/jobs/store";
import { isOpen } from "@/lib/jobs/types";
import { offerLinkCode } from "@/lib/links";
import { getMarket } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { MIN_ARRIVALS, NO_SHOW_DAYS, ON_TIME_TARGET, recentNoShows } from "@/lib/tradies/reliability";
import { SCORE_DAYS, scorecards } from "@/lib/tradies/scorecard";
import { windowsForAccepting } from "@/lib/dispatch/cascade";
import { windowLabel } from "@/lib/jobs/arrival";
import { getTradie, listLicences } from "@/lib/tradies/service";
import { AgreementCard } from "@/components/jobs/AgreementCard";
import { Notifications } from "@/components/ui/Notifications";
import { dateKey, formatDeadline } from "@/lib/time";
import { urgencyName } from "@/lib/jobs/pricing";

export const metadata: Metadata = { title: "Offers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pct = (rate: number | null) => (rate === null ? "No jobs yet" : `${Math.round(rate * 100)}%`);

export default async function TradieHome({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireTradie("/tradie");
  const query = await searchParams;
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  if (!tradie) return <Notice tone="error" title="We could not find your tradie profile" />;
  const market = await getMarket(db, tradie.market);
  const zone = market?.timezone ?? "Pacific/Auckland";
  const at = now();
  const offers = tradie.status === "approved" ? await listLiveOffersForTradie(db, tradie.id, at) : [];
  const jobs = (await listJobsForTradie(db, tradie.id, { limit: 40 })).filter((job) => isOpen(job.status));
  const card = market ? (await scorecards(db, market.slug)).find((candidate) => candidate.tradieId === tradie.id) : undefined;
  const licences = await listLicences(db, tradie.id);
  const today = dateKey(at, zone);
  const missing = tradie.trades.filter((key) => findTrade(key)?.licenceRequired && !licences.some((licence) => licence.trade === key && licence.expiresOn >= today));
  const lbpMissing = tradie.trades.some((key) => findTrade(key)?.lbpRequired) && (tradie.lbpNumber ?? "").length < 2;
  const secret = appSecret();
  const noShows = await recentNoShows(db, tradie.id, at);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="display text-[1.75rem] text-ink sm:text-4xl">{tradie.businessName}</h1>
        <p className="mt-1 text-muted">{market?.name ?? tradie.market}</p>
      </div>

      <AgreementCard tradie={tradie} />
      <Notifications audience="tradie" />
      {query.passed && <Notice tone="info" title="Passed. It has gone to the next tradie. Passing never counts against you." />}
      {query.asked && <Notice tone="info" title="We have asked the owner about your time. We will text you their answer." />}

      {/* A tradie waiting for approval never gets here: requireTradie sends them to their profile. */}
      {tradie.status === "paused" && (
        <Card className="border-wait/40 bg-wait-soft">
          <p className="font-bold text-ink">You are paused</p>
          <p className="mt-1 text-ink/80">No jobs are being offered to you.</p>
          <ActionForm action={setPaused} className="mt-3">
            <input type="hidden" name="pause" value="no" />
            <SubmitButton pendingLabel="Switching on...">Start getting offers again</SubmitButton>
          </ActionForm>
        </Card>
      )}
      {tradie.status === "removed" && <Notice tone="error" title="Your account is not active">Contact us if you think this is a mistake.</Notice>}
      {tradie.status !== "removed" && !tradie.payoutsEnabled && (
        <Notice tone="error" title="Add your bank details to get offers">
          We only offer jobs to tradies we can pay.{" "}
          <Link href="/tradie/profile#bank" className="font-semibold underline underline-offset-2">
            Add bank details
          </Link>
        </Notice>
      )}
      {lbpMissing && (
        <Notice tone="warn" title="Add your LBP number for building jobs">
          You will not be offered building jobs until your Licensed Building Practitioner number is on your profile.{" "}
          <Link href="/tradie/profile" className="font-semibold underline underline-offset-2">
            Add it
          </Link>
        </Notice>
      )}
      {missing.length > 0 && (
        <Notice tone="warn" title="A licence is missing or out of date">
          You will not be offered {missing.map((key) => findTrade(key)?.label.toLowerCase() ?? key).join(" or ")} jobs until a current licence is on file.{" "}
          <Link href="/tradie/profile#licences" className="font-semibold underline underline-offset-2">
            Add it
          </Link>
        </Notice>
      )}

      <section>
        <SectionTitle>Offers for you</SectionTitle>
        {offers.length === 0 ? (
          <EmptyState icon="offers" title="No offers right now">
            When a job comes up we text you. Tap the link in the text, or open it here, and accept.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <Card key={offer.id} className="border-brand/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-ink">{offer.title}</p>
                    <p className="text-sm text-muted">
                      {offer.suburb} · on site by {offer.respondBy ? formatDeadline(offer.respondBy, at, zone) : "as soon as you can"}
                    </p>
                  </div>
                  <p className="display tabular shrink-0 text-2xl text-ink">{formatMoney(offer.payoutCents, market?.currency ?? "NZD")}</p>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-brand">
                  {offer.urgency !== "standard" && <Chip tone="alert">{urgencyName(offer.urgency)}</Chip>}
                  <span>
                    Held for you for <Countdown until={offer.expiresAt.toISOString()} fallback="a few minutes" done="a moment longer" />
                  </span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ActionForm action={acceptJob} className="col-span-2 space-y-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    {market && windowsForAccepting(offer, market, at).length > 0 && (
                      <Select
                        label="When will you be there?"
                        name="window"
                        required
                        placeholder="Choose a time"
                        options={windowsForAccepting(offer, market, at).map((window) => ({ key: window.end.toISOString(), label: windowLabel(window, at, zone) }))}
                      />
                    )}
                    <SubmitButton pendingLabel="Accepting..." className="w-full">
                      Accept job
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={passJob} className="space-y-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <SubmitButton variant="secondary" pendingLabel="Passing..." className="w-full">
                      Pass
                    </SubmitButton>
                  </ActionForm>
                  {secret && (
                    <Link href={`/o/${offerLinkCode(secret, offer)}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-tint">
                      See details
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {jobs.length > 0 && (
        <section>
          <SectionTitle>Your jobs</SectionTitle>
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} href={`/tradie/jobs/${job.id}`} audience="tradie" now={at} timeZone={zone} />
            ))}
          </div>
        </section>
      )}

      {card && (
        <section>
          <SectionTitle>Your record</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={`On site in time, last ${SCORE_DAYS} days`}
              value={pct(card.onTimeRate)}
              note={card.jobs > 0 ? `${card.onTime} of ${card.jobs} jobs you accepted` : "No jobs yet"}
              tone={card.belowTarget ? "alert" : undefined}
            />
            <Stat label={`No-shows, last ${NO_SHOW_DAYS} days`} value={String(noShows)} note="Accepted, and not there by the promised time" tone={noShows > 0 ? "alert" : undefined} />
          </div>
          <p className="mt-2 text-sm text-muted">
            Only jobs you accept count. Passing on an offer, or letting one run out, never counts against you and never means fewer offers. Once you have arrived at {MIN_ARRIVALS} jobs, being on
            time for at least {Math.round(ON_TIME_TARGET * 100)}% of your last 20 keeps you in the first wave of network offers. Below that you still get them, a little later.
          </p>
        </section>
      )}
    </div>
  );
}
