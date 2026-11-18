import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  staffAssign, staffCancel, staffGoAhead, staffGoodwill, staffQuote, staffReoffer, staffResolveDispute, staffRetryCharge, staffRetryPayout,
} from "@/app/actions/staff";
import { ActionForm, Area, Field, RadioCards, Select } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { CostLines, Deadline, History, JobStatus, Panel, PhotoGrid } from "@/components/jobs/JobParts";
import { Card, Chip, Facts, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { findTrade } from "@config/trades";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { centsToDollars } from "@/lib/forms";
import { getJobForStaff } from "@/lib/jobs/store";
import { isOpen, type StatusTone } from "@/lib/jobs/types";
import { loadJobView } from "@/lib/jobs/view";
import { formatMoney } from "@/lib/money";
import { listMessages } from "@/lib/notify/outbox";
import { displayPhone } from "@/lib/phone";
import { addressLine } from "@/lib/properties/service";
import { listLicences, listTradies } from "@/lib/tradies/service";
import { dateKey, formatClock, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Job" };

const OFFER_LOOK: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting for an answer", tone: "waiting" },
  accepted: { label: "Accepted", tone: "done" },
  passed: { label: "Passed", tone: "quiet" },
  expired: { label: "Ran out", tone: "alert" },
  superseded: { label: "Closed", tone: "quiet" },
};
const STAGES = ["", "First choice", "Backup", "Everyone else", "Given by the team"];

const PAYOUT_WORDS: Record<string, string> = {
  waiting: "Waiting for the owner's card to be charged",
  scheduled: "Will be sent on",
  paused: "On hold (owner raised a problem)",
  sent: "Sent",
  failed: "Could not be sent",
  cancelled: "Cancelled",
  reversed: "Taken back after a refund",
};

function Tel({ phone }: { phone: string | null }) {
  if (!phone) return <span className="text-muted">No number</span>;
  return (
    <a href={`tel:${phone}`} className="font-semibold text-brand underline underline-offset-2">
      {displayPhone(phone)}
    </a>
  );
}

const DID: Record<string, string> = {
  assigned: "Assigned. The tradie and the owner have both been texted.",
  sent_out: "Sent out to tradies.",
  cancelled: "Cancelled. Nothing is charged. The owner and the tradie have been texted.",
  quote_answered: "Recorded. The tradie has been texted the owner's answer.",
  refunded: "Refunded. The tradie's payment and our fee have come down to match.",
  work_stands: "Settled. The tradie will be paid in full.",
  tradie_paid: "Paid. The tradie has been texted.",
  charged: "The card was charged. The tradie's payment is now on its way.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StaffJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  await requireStaff();
  const did = (await searchParams).did;
  const confirmation = typeof did === "string" ? DID[did] : undefined;
  const db = await getDb();
  const job = await getJobForStaff(db, id);
  if (!job) notFound();
  const view = await loadJobView(db, job, "staff");
  const { market, property, money } = view;
  const at = now();
  const fmt = (cents: number) => formatMoney(cents, job.currency);
  const messages = await listMessages(db, { jobId: job.id, limit: 60 });
  const pendingQuote = view.quotes.find((quote) => quote.status === "pending") ?? null;
  const needsTradie = job.status === "offering" || job.status === "unfilled";

  // Who could be given this job: approved, in this market, does this trade. The licence rule is checked again when assigning.
  let candidates: { key: string; label: string }[] = [];
  if (needsTradie) {
    const today = dateKey(at, market.timezone);
    const approved = (await listTradies(db, { market: job.market, status: "approved" })).filter((tradie) => tradie.trades.includes(job.trade));
    for (const tradie of approved) {
      let note = "";
      if (job.licenceRequired) {
        const licence = (await listLicences(db, tradie.id)).find((candidate) => candidate.trade === job.trade);
        note = licence && licence.expiresOn >= today ? "" : " (no current licence: cannot be assigned)";
      }
      if (!tradie.payoutsEnabled) note += " (no bank details yet)";
      candidates.push({ key: tradie.id, label: `${tradie.businessName}, ${tradie.phone ? displayPhone(tradie.phone) : "no mobile"}${note}` });
    }
    candidates = candidates.slice(0, 60);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title={job.title} back={{ href: "/admin/jobs", label: "Jobs" }} />
      {confirmation && <Notice tone="good" title={confirmation} />}

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatus job={job} audience="staff" />
          {job.urgency === "urgent" && <Chip tone="alert">Urgent</Chip>}
          {job.afterHours && <Chip tone="brand">After hours</Chip>}
          {job.offMenu && <Chip tone="brand">Off menu</Chip>}
          {job.licenceRequired && <Chip tone="brand">Licence needed</Chip>}
          <span className="tabular text-sm text-muted">
            Job {job.number} · {market.name} · {findTrade(job.trade)?.label ?? job.trade}
          </span>
        </div>
        <div className="mt-3">
          <Deadline job={job} now={at} timeZone={market.timezone} />
        </div>
        <p className="mt-2 text-sm text-muted">
          Logged {formatDateTime(job.createdAt, market.timezone)}
          {job.tierKey ? ` · ${job.tierKey} member, ${job.responseHours}-hour promise` : ""}
          {job.status === "cancelled" && job.cancelReason ? ` · Cancelled: ${job.cancelReason}` : ""}
        </p>
        {job.windowMissedAt && (
          <p className="mt-3 rounded-xl bg-alert-soft px-4 py-3 text-sm font-semibold text-alert">
            The promised time was missed. {money.credit ? `${fmt(money.credit.amountCents)} was credited to the owner automatically.` : "No credit was given: this property was already credited this month."}
          </p>
        )}
      </Card>

      {/* WHAT NEEDS DOING */}
      {job.status === "awaiting_owner" && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>Waiting for the owner&apos;s go-ahead</SectionTitle>
          <p className="text-muted">{job.reportedBy === "team" ? `${job.reporterName ?? "The owner's team"} reported this, and the owner asked to say yes first.` : "A guest reported this."} The owner has been texted. If they tell you yes by phone, send it out for them here.</p>
          <ActionForm action={staffGoAhead} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="jobId" value={job.id} />
            <SubmitButton name="how" value="standard" pendingLabel="Sending...">
              Owner said yes: send a tradie
            </SubmitButton>
            <SubmitButton name="how" value="urgent" variant="secondary" pendingLabel="Sending...">
              Owner said yes, urgent
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      {needsTradie && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>{job.status === "unfilled" ? "Nobody accepted. Find a tradie" : "Being offered now"}</SectionTitle>
          <p className="text-muted">
            {job.status === "unfilled"
              ? "Every tradie who could take this was offered it. Ring one. If they say yes, give them the job here: they and the owner are texted straight away."
              : "You can leave the offers to run, or ring a tradie and give them the job now."}
          </p>
          {candidates.length === 0 ? (
            <div className="mt-3">
              <Notice tone="error" title="There is no approved tradie for this trade in this market">
                Add or approve one under Tradies, then assign them here.
              </Notice>
            </div>
          ) : (
            <ActionForm action={staffAssign} className="mt-4 space-y-3">
              <input type="hidden" name="jobId" value={job.id} />
              <Select label="Give the job to" name="tradieId" options={candidates} placeholder="Choose a tradie" required />
              <SubmitButton pendingLabel="Assigning...">Assign this tradie</SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={staffReoffer} className="mt-3">
            <input type="hidden" name="jobId" value={job.id} />
            <SubmitButton variant="secondary" pendingLabel="Sending...">
              Start the offers again from the top
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      {pendingQuote && job.status === "awaiting_approval" && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>A quote is waiting for the owner</SectionTitle>
          <p className="text-ink">
            {pendingQuote.description}: <strong>{fmt(pendingQuote.ownerTotalCents)}</strong> (work {fmt(pendingQuote.labourCents)}, parts {fmt(pendingQuote.partsCents)}). The tradie is waiting on site.
          </p>
          <p className="mt-1 text-muted">Ring the owner on <Tel phone={view.owner.phone} />. Record their answer only if they have given it to you.</p>
          <ActionForm action={staffQuote} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="quoteId" value={pendingQuote.id} />
            <SubmitButton name="answer" value="yes" pendingLabel="Saving...">
              Owner said yes
            </SubmitButton>
            <SubmitButton name="answer" value="no" variant="secondary" pendingLabel="Saving...">
              Owner said no
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      {money.dispute?.status === "open" && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>The owner raised a problem</SectionTitle>
          <p className="text-ink">&ldquo;{money.dispute.reason}&rdquo;</p>
          <p className="mt-1 text-sm text-muted">
            Raised {formatDateTime(money.dispute.createdAt, market.timezone)}. {money.payout?.status === "paused" ? "The tradie's payment is on hold until you settle this." : "The tradie had already been paid when this was raised."}
          </p>
          <ActionForm action={staffResolveDispute} className="mt-4 space-y-4">
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="disputeId" value={money.dispute.id} />
            <RadioCards
              name="outcome"
              legend="What is fair?"
              options={[
                { value: "pay_tradie", title: "The work stands", detail: "The tradie is paid in full. Nothing is refunded." },
                { value: "refund", title: "Refund the owner", detail: "All or part. The tradie's payment and our fee both come down in proportion." },
              ]}
            />
            <Field
              label={`Refund amount (${job.currency}), if refunding`}
              name="refund"
              inputMode="decimal"
              maxLength={10}
              placeholder={centsToDollars(money.payment?.amountCents ?? job.ownerTotalCents)}
              hint={`The owner was charged ${fmt(money.payment?.amountCents ?? job.ownerTotalCents)}. Enter that for a full refund.`}
            />
            <Area label="What was decided and why" name="disputeNote" rows={3} required maxLength={600} hint="The owner sees this on their job page." />
            <SubmitButton pendingLabel="Settling...">Settle it</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {money.payment?.status === "failed" && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>The owner&apos;s card was not charged</SectionTitle>
          <p className="text-muted">
            {money.payment.lastError ?? "The card was declined."} Tried {money.payment.attempts} {money.payment.attempts === 1 ? "time" : "times"}. The tradie is paid only once the card goes through. Ask the owner to update their card
            (Billing in their app), then try again.
          </p>
          <ActionForm action={staffRetryCharge} className="mt-4">
            <input type="hidden" name="jobId" value={job.id} />
            <SubmitButton pendingLabel="Charging...">Try the card again now</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {money.payout?.status === "failed" && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>The tradie could not be paid</SectionTitle>
          <p className="text-muted">{money.payout.lastError ?? "The payment did not go through."} Ask them to check their bank details in their profile, then try again.</p>
          <ActionForm action={staffRetryPayout} className="mt-4">
            <input type="hidden" name="jobId" value={job.id} />
            <SubmitButton pendingLabel="Paying...">Try paying the tradie again</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {/* PEOPLE AND PLACE */}
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="People">
          <Facts
            rows={[
              {
                label: "Owner",
                value: (
                  <>
                    <Link href={`/admin/owners/${job.ownerId}`} className="text-brand underline underline-offset-2">
                      {view.owner.name}
                    </Link>
                    <br />
                    <Tel phone={view.owner.phone} />
                  </>
                ),
              },
              {
                label: "Tradie",
                value: view.tradie ? (
                  <>
                    <Link href={`/admin/tradies/${view.tradie.id}`} className="text-brand underline underline-offset-2">
                      {view.tradie.businessName}
                    </Link>
                    <br />
                    <Tel phone={view.tradie.phone} />
                  </>
                ) : (
                  <span className="text-muted">None yet</span>
                ),
              },
              ...(job.reportedBy !== "owner"
                ? [
                    {
                      label: `Reported by (${job.reportedBy === "guest" ? "guest" : job.reportedBy === "team" ? "cleaner or co-host" : "our team"})`,
                      value: (
                        <>
                          {job.reporterName ?? "No name"}
                          <br />
                          <Tel phone={job.reporterPhone} />
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Panel>
        <Panel title="Property">
          <p className="font-semibold text-ink">{property.name}</p>
          <p className="text-muted">{addressLine(property)}</p>
          {property.accessNotes && (
            <div className="mt-3 rounded-xl bg-tint px-4 py-3">
              <p className="text-sm font-bold tracking-wide text-brand uppercase">How to get in</p>
              <p className="mt-1 whitespace-pre-line text-ink">{property.accessNotes}</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="The problem">
        {job.description ? <p className="whitespace-pre-line text-ink">{job.description}</p> : <p className="text-muted">No extra details were given.</p>}
        {view.reportPhotos.length > 0 && (
          <div className="mt-3">
            <PhotoGrid photos={view.reportPhotos} />
          </div>
        )}
      </Panel>

      {(job.completionNote || view.workPhotos.length > 0) && (
        <Panel title="What the tradie did">
          {job.completionNote && <p className="whitespace-pre-line text-ink">{job.completionNote}</p>}
          {view.workPhotos.length > 0 && (
            <div className="mt-3">
              <PhotoGrid photos={view.workPhotos} />
            </div>
          )}
        </Panel>
      )}

      {/* MONEY */}
      <Panel title="Money">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-bold tracking-wide text-muted uppercase">Owner pays</p>
            <CostLines lines={view.lines} currency={job.currency} side="owner" totalLabel="Owner total" />
          </div>
          <div>
            <p className="mb-1 text-sm font-bold tracking-wide text-muted uppercase">Tradie gets</p>
            <CostLines lines={view.lines} currency={job.currency} side="tradie" totalLabel="Tradie total" />
          </div>
        </div>
        <div className="mt-4">
          <Facts
            rows={[
              { label: "We keep", value: fmt(job.ownerTotalCents - job.tradieTotalCents) },
              ...(market.taxRegistered ? [{ label: `${market.taxName} inside the owner's total`, value: fmt(job.taxCents) }] : []),
              {
                label: "Owner's card",
                value: !money.payment
                  ? "Not due yet"
                  : money.payment.status === "succeeded"
                    ? `Charged ${fmt(money.payment.amountCents)}${money.payment.paidAt ? ` on ${formatDateTime(money.payment.paidAt, market.timezone)}` : ""}`
                    : money.payment.status === "failed"
                      ? `Failed (${money.payment.attempts} tries)`
                      : money.payment.status === "pending"
                        ? "About to be charged"
                        : `Refunded ${fmt(money.payment.refundedCents)} of ${fmt(money.payment.amountCents)}`,
              },
              {
                label: "Tradie's payment",
                value: !money.payout
                  ? "Not due yet"
                  : `${fmt(money.payout.amountCents)}: ${PAYOUT_WORDS[money.payout.status] ?? money.payout.status}${
                      money.payout.status === "scheduled" ? ` ${formatDateTime(money.payout.releaseAt, market.timezone)}` : money.payout.status === "sent" && money.payout.sentAt ? ` ${formatDateTime(money.payout.sentAt, market.timezone)}` : ""
                    }`,
              },
            ]}
          />
        </div>
        {money.dispute && money.dispute.status !== "open" && (
          <p className="mt-3 rounded-xl bg-tint px-4 py-3 text-sm text-ink">
            <span className="font-bold">Problem settled: </span>
            {money.dispute.refundCents ? `${fmt(money.dispute.refundCents)} refunded. ` : "The work stands. "}
            {money.dispute.resolutionNote}
          </p>
        )}
      </Panel>

      {view.offers.length > 0 && (
        <Panel title="Who was offered it">
          <ul className="divide-y divide-line">
            {view.offers.map((offer) => {
              const look = OFFER_LOOK[offer.status] ?? { label: offer.status, tone: "quiet" as StatusTone };
              return (
                <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <Link href={`/admin/tradies/${offer.tradieId}`} className="font-semibold text-brand underline underline-offset-2">
                      {offer.tradieName}
                    </Link>
                    <span className="block text-sm text-muted">
                      {STAGES[offer.stage] ?? `Stage ${offer.stage}`}
                      {offer.round > 1 ? `, round ${offer.round}` : ""} · sent {formatClock(offer.sentAt, market.timezone)}
                      {offer.respondedAt ? ` · answered ${formatClock(offer.respondedAt, market.timezone)}${offer.respondedVia ? ` by ${offer.respondedVia}` : ""}` : ""}
                    </span>
                  </span>
                  <Chip tone={look.tone}>{look.label}</Chip>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {messages.length > 0 && (
        <Reveal label={`Texts and emails sent about this job (${messages.length})`}>
          <ul className="divide-y divide-line">
            {messages.map((message) => (
              <li key={message.id} className="py-2.5">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-ink">
                    {message.channel === "sms" ? "Text" : "Email"} to {message.audience ?? "someone"} ({message.channel === "sms" ? displayPhone(message.recipient) : message.recipient})
                  </span>
                  <Chip tone={message.status === "sent" ? "done" : message.status === "failed" ? "alert" : message.status === "demo" ? "quiet" : "waiting"}>
                    {message.status === "demo" ? "Demo: not really sent" : message.status}
                  </Chip>
                  <span className="tabular text-muted">{formatDateTime(message.createdAt, market.timezone)}</span>
                </p>
                {message.body && <p className="mt-1 text-sm whitespace-pre-line text-muted">{message.body}</p>}
                {message.error && <p className="mt-1 text-sm font-semibold text-alert">{message.error}</p>}
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      <History view={view} />

      <Reveal label="Give the owner a credit (to say sorry)">
        <ActionForm action={staffGoodwill} className="space-y-3">
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="back" value={`/admin/jobs/${job.id}`} />
          <Field label={`Amount (${job.currency})`} name="creditAmount" inputMode="decimal" maxLength={8} placeholder="50" />
          <Field label="What is it for?" name="creditNote" maxLength={200} placeholder="Tradie arrived late on job 1042" />
          <p className="text-sm text-muted">It comes off their next membership payment for {property.name}. It is not a refund to their card.</p>
          <SubmitButton variant="secondary" pendingLabel="Adding...">
            Add credit
          </SubmitButton>
        </ActionForm>
      </Reveal>

      {isOpen(job.status) && (
        <Reveal label="Cancel this job" tone="alert">
          <ActionForm action={staffCancel} className="space-y-3">
            <input type="hidden" name="jobId" value={job.id} />
            <Field label="Why?" name="cancelReason" required maxLength={200} placeholder="Owner rang: the guest fixed it themselves." />
            <p className="text-sm text-muted">Nothing is charged and the tradie is not paid. If a tradie has already been out, do not cancel: let them finish, or use &ldquo;could not get in&rdquo; on their side so they are paid the call-out.</p>
            <SubmitButton variant="danger" pendingLabel="Cancelling...">
              Cancel the job
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}
    </div>
  );
}
