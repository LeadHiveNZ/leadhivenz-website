import type { Metadata } from "next";
import Link from "next/link";
import { JobRow } from "@/components/jobs/JobRow";
import { buttonClass } from "@/components/forms/styles";
import { Chip, EmptyState, Notice, RowLink, SectionTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Notifications } from "@/components/ui/Notifications";
import { requireOwner } from "@/lib/auth/current";
import { DAY, now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listJobsForOwner } from "@/lib/jobs/store";
import { listMarkets } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { unpaidJobs } from "@/lib/owners/service";
import { isCovered, membershipLabel } from "@/lib/properties/display";
import { addressLine, listProperties } from "@/lib/properties/service";

export const metadata: Metadata = { title: "Home" };

export default async function OwnerHome() {
  const viewer = await requireOwner("/app");
  const db = await getDb();
  const properties = await listProperties(db, viewer.ownerId);
  const jobs = await listJobsForOwner(db, viewer.ownerId, { limit: 80 });
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));
  const zone = (slug: string) => markets.get(slug)?.timezone ?? "Pacific/Auckland";
  const at = now();
  const firstName = viewer.user.name.split(" ")[0] || viewer.user.name;

  if (properties.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="display text-4xl text-ink">Welcome, {firstName}</h1>
        <p className="mt-2 text-muted">Three steps and your property is covered.</p>
        <ol className="mt-6 space-y-3">
          {[
            ["Add your property", "The address and how a tradie gets in."],
            ["Add a card", "Free to join. Nothing is charged until a job is done."],
            ["Put the QR card in the property", "Your cleaner and your guests can report a problem in under a minute."],
          ].map(([title, detail], index) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
              <span className="display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-accent">{index + 1}</span>
              <span>
                <span className="block font-bold text-ink">{title}</span>
                <span className="block text-muted">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link href="/app/properties/new" className={`${buttonClass} mt-6 w-full`}>
          Add my first property
        </Link>
      </div>
    );
  }

  // A finished job the app could not confirm asks the owner to check its photos (DECISIONS.md, 2026-11-19).
  const toCheck = (job: (typeof jobs)[number]) => job.status === "completed" && (job.confirmStatus === "waiting" || job.confirmStatus === "staff_queue" || job.confirmStatus === "staff_held");
  const needsYou = jobs.filter((job) => job.status === "awaiting_owner" || job.status === "awaiting_approval" || toCheck(job));
  const unpinned = properties.filter((property) => property.status !== "cancelled" && !property.pinConfirmedAt);
  const underWay = jobs.filter((job) => ["offering", "unfilled", "accepted", "on_site"].includes(job.status));
  const recent = jobs.filter((job) => job.status === "completed" && !toCheck(job) && job.completedAt && at.getTime() - job.completedAt.getTime() < 14 * DAY).slice(0, 4);
  const notStarted = properties.filter((property) => property.status === "setup");
  const cardProblems = properties.filter((property) => property.status === "past_due");
  const unpaid = await unpaidJobs(db, viewer.ownerId);
  const covered = properties.filter(isCovered);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="display text-[1.75rem] text-ink sm:text-4xl">Hello, {firstName}</h1>
        <p className="mt-1 text-muted">
          {underWay.length + needsYou.length === 0 ? "Nothing needs fixing right now." : `${underWay.length + needsYou.length} ${underWay.length + needsYou.length === 1 ? "job" : "jobs"} under way.`}
        </p>
      </div>

      <Notifications audience="owner" />

      {unpaid.map((job) => (
        <Notice key={job.jobId} tone="error" title={`We could not charge your card for job ${job.number}`}>
          {formatMoney(job.amountCents, job.currency)} for &ldquo;{job.title}&rdquo;. We will try again, but please{" "}
          <Link href="/app/billing" className="font-semibold underline underline-offset-2">
            check or change your card
          </Link>
          . Your tradie is paid once it goes through.
        </Notice>
      ))}
      {cardProblems.map((property) => (
        <Notice key={property.id} tone="error" title={`Your card did not go through for ${property.name}`}>
          Tradies cannot be sent to this property until it is fixed.{" "}
          <Link href="/app/billing" className="font-semibold underline underline-offset-2">
            Update your card
          </Link>
        </Notice>
      ))}
      {notStarted.map((property) => (
        <Notice key={property.id} tone="warn" title={`${property.name} is not covered yet`}>
          Add a card to be able to send tradies there.{" "}
          <Link href={`/app/properties/${property.id}`} className="font-semibold underline underline-offset-2">
            Finish setting up
          </Link>
        </Notice>
      ))}

      {unpinned.length > 0 && (
        <Notice tone="info" title={unpinned.length === 1 ? `Check where ${unpinned[0]!.name} is on the map` : `Check where ${unpinned.length} of your houses are on the map`}>
          We check a tradie is at the house when they tap Arrived and Job done.{" "}
          <Link href={`/app/properties/${unpinned[0]!.id}`} className="font-semibold underline underline-offset-2">
            Check the pin
          </Link>
        </Notice>
      )}

      {covered.length > 0 && (
        <Link href="/app/jobs/new" className="on-dark flex items-center gap-4 rounded-3xl bg-brand p-5 text-white shadow-sm transition hover:bg-brand-dark">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-brand-dark">
            <Icon name="plus" size={26} />
          </span>
          <span className="flex-1">
            <span className="display block text-2xl">Something broken?</span>
            <span className="block text-white/75">Report it and we send a tradie. Fixed prices, no ringing around.</span>
          </span>
          <Icon name="arrow" className="text-accent" />
        </Link>
      )}

      {needsYou.length > 0 && (
        <section>
          <SectionTitle>Needs your answer</SectionTitle>
          <div className="space-y-2.5">
            {needsYou.map((job) => (
              <JobRow key={job.id} job={job} href={`/app/jobs/${job.id}`} audience="owner" now={at} timeZone={zone(job.market)} />
            ))}
          </div>
        </section>
      )}

      {underWay.length > 0 && (
        <section>
          <SectionTitle>Under way</SectionTitle>
          <div className="space-y-2.5">
            {underWay.map((job) => (
              <JobRow key={job.id} job={job} href={`/app/jobs/${job.id}`} audience="owner" now={at} timeZone={zone(job.market)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          action={
            <Link href="/app/properties/new" className="text-sm font-semibold text-brand underline underline-offset-2">
              Add a property
            </Link>
          }
        >
          Your properties
        </SectionTitle>
        <div className="space-y-2.5">
          {properties.map((property) => {
            const membership = membershipLabel(property, zone(property.market));
            return (
              <RowLink
                key={property.id}
                href={`/app/properties/${property.id}`}
                title={property.name}
                subtitle={addressLine(property)}
                leading={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                    <Icon name="property" />
                  </span>
                }
                right={<Chip tone={membership.tone}>{membership.label}</Chip>}
              />
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link href="/app/jobs" className="text-sm font-semibold text-brand underline underline-offset-2">
                All jobs
              </Link>
            }
          >
            Recently finished
          </SectionTitle>
          <div className="space-y-2.5">
            {recent.map((job) => (
              <JobRow key={job.id} job={job} href={`/app/jobs/${job.id}`} audience="owner" now={at} timeZone={zone(job.market)} />
            ))}
          </div>
        </section>
      )}

      {jobs.length === 0 && covered.length > 0 && (
        <EmptyState icon="shield" title="You are covered">
          When something breaks, report it here, or let your cleaner and guests do it from the link and QR card on each property.
        </EmptyState>
      )}
    </div>
  );
}
