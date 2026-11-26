import { feeWords, tierLineWords } from "@/lib/markets/display";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  staffAssign, staffCancel, staffRequestReceipt, staffChargebackFault, staffNotDescribed, staffChargeBoughtParts, staffCheckJob, staffCheckReceipt, staffGoAhead, staffGoodwill, staffQuote, staffReoffer, staffResolveDispute, staffRetryCharge, staffRetryPayout,
} from "@/app/actions/staff";
import { ActionForm, Area, Field, RadioCards, Select, Tick } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { BeforeAfter, CostLines, Deadline, History, JobStatus, Panel, PhotoGrid } from "@/components/jobs/JobParts";
import { flagWords, type CheckFlag } from "@/lib/jobs/checks";
import { receiptFlagWords } from "@/lib/jobs/parts";
import { Card, Chip, Facts, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { findTrade, needsLbp, NOT_SURE_TRADE } from "@config/trades";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { centsToDollars } from "@/lib/forms";
import { windowBetween } from "@/lib/jobs/arrival";
import { getJobForStaff } from "@/lib/jobs/store";
import { isOpen, type StatusTone } from "@/lib/jobs/types";
import { loadJobView } from "@/lib/jobs/view";
import { formatMoney } from "@/lib/money";
import { chargebacksForJob } from "@/lib/billing/chargebacks";
import { cardProblemWords } from "@/lib/owners/service";
import { GuestNote, HazardNote } from "@/components/jobs/SafetyNotes";
import { TradeButtons } from "@/components/jobs/TradeButtons";
import { PropertyAreaForm } from "@/components/properties/PropertyAreaForm";
import { areaName } from "@/lib/markets/areas";
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
  waiting: "Waiting for money in the HostFix Stripe balance (tried again every minute)",
  scheduled: "Will be sent on",
  paused: "On hold (owner raised a problem)",
  held: "Held until the flagged job is confirmed",
  sent: "Sent",
  failed: "Could not be sent",
  cancelled: "Cancelled",
  reversed: "Taken back after a refund",
};

const PART_RECEIPT: Record<string, string> = {
  not_needed: "not needed",
  requested: "asked for by the team (a spot check): the payment waits for it, and the part is refunded to the owner after 7 days without it",
  needed: "not sent yet",
  attached: "sent",
  to_follow: "to follow (promised at Job done; refunded to the owner after 7 days without it)",
  refunding: "being refunded",
  refunded: "never came, so the part was refunded to the owner",
};

const CONFIRM_WORDS: Record<string, string> = {
  waiting: "waiting for the owner to confirm",
  owner_confirmed: "the owner confirmed it is fixed",
  owner_problem: "the owner says something is wrong (see the dispute)",
  released_trusted: "no answer from the owner; paid because the tradie is trusted",
  staff_queue: "no answer from the owner; in the queue for you",
  staff_approved: "approved by the team",
  staff_held: "payment held by the team",
};

function tapWords(check: string | null, metres: number | null, reference: string | null): string {
  const from = reference === "pin" ? "the property's pin" : reference === "own_arrival" ? "where they tapped Arrived" : "where tradies have been at this house before";
  switch (check) {
    case "ok":
      return `${metres ?? 0} m from ${from}.`;
    case "far":
      return `${metres} m from ${from}.`;
    case "no_location":
      return "the phone gave no location.";
    case "no_reference":
      return "location recorded, nothing to compare it with yet (no pin, no earlier visits).";
    default:
      return "recorded before location checks.";
  }
}

function MapLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noreferrer" className="font-normal underline underline-offset-2">
      See on a map
    </a>
  );
}

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
  parts_charged: "Charged at the receipt's cost. The owner has been texted.",
  chargeback_tradie: "Recorded as the tradie's fault. What they were paid is now a balance taken from their later payments (never more than half of any one), and they have been texted.",
  callout_paid: "Call-out paid. The tradie has been texted.",
  no_callout: "No call-out. Nothing is charged for the visit, and the tradie has been texted.",
  chargeback_us: "Recorded as not the tradie's fault. HostFix carries the loss and the tradie is paid as normal.",
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
  const chargebacks = await chargebacksForJob(db, job.id);
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
      if (needsLbp(job.trade) && (tradie.lbpNumber ?? "").length < 2) note += " (no LBP number: cannot be assigned)";
      if (!tradie.payoutsEnabled) note += " (no bank details yet)";
      candidates.push({ key: tradie.id, label: `${tradie.businessName}, ${tradie.phone ? displayPhone(tradie.phone) : "no mobile"}${note}` });
    }
    candidates = candidates.slice(0, 60);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle
        title={job.title}
        back={{ href: "/admin/jobs", label: "Jobs" }}
        action={
          <Link href={`/admin/jobs/${job.id}/evidence`} className="text-sm font-semibold text-brand underline underline-offset-2">
            Evidence pack
          </Link>
        }
      />
      {confirmation && <Notice tone="good" title={confirmation} />}

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatus job={job} audience="staff" />
          {job.urgency === "urgent" && <Chip tone="alert">Urgent</Chip>}
          {job.afterHours && <Chip tone="brand">After hours</Chip>}
          {job.offMenu && <Chip tone="brand">Off menu</Chip>}
          {job.licenceRequired && <Chip tone="brand">Licence needed</Chip>}
          {needsLbp(job.trade) && <Chip tone="brand">LBP needed</Chip>}
          {job.trade === NOT_SURE_TRADE && <Chip tone="alert">Trade not chosen yet</Chip>}
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
            The promised time was missed{job.noShowAt ? ": the tradie had accepted and was not there (a no-show)" : ""}.{" "}
            {money.credit ? `${fmt(money.credit.amountCents)} was credited to the owner (a credit made before missed promises stopped being credited).` : "Nothing is credited for a missed promise."}
          </p>
        )}
        {job.arrivedAt && (
          <div className={`mt-3 space-y-1 rounded-xl px-4 py-3 text-sm font-semibold ${job.checkFlags.length > 0 || job.arrivalCheck === "far" || job.arrivalCheck === "no_location" ? "bg-alert-soft text-alert" : "bg-tint text-ink"}`}>
            <p>
              Arrived tap: {tapWords(job.arrivalCheck, job.arrivalDistanceM, job.checkReference)}{" "}
              {job.arrivedLat !== null && job.arrivedLng !== null && <MapLink lat={job.arrivedLat} lng={job.arrivedLng} />}
            </p>
            {job.completedAt && (
              <p>
                Job done tap: {tapWords(job.finishCheck, job.finishDistanceM, job.checkReference)}{" "}
                {job.finishedLat !== null && job.finishedLng !== null && <MapLink lat={job.finishedLat} lng={job.finishedLng} />}
              </p>
            )}
            {job.minutesOnSite !== null && <p>On site {job.minutesOnSite} minutes (flagged under {market.minMinutesOnSite}, except diagnosis, look-and-price and could-not-get-in).</p>}
            {property.pin ? (
              <p className="font-normal">
                The property&apos;s pin: {property.pinSource === "owner_moved" ? "placed by the owner" : "looked up from the address"}{property.pinConfirmedAt ? ", confirmed by the owner" : ", not confirmed by the owner yet"}.{" "}
                <MapLink lat={property.pin.lat} lng={property.pin.lng} />
              </p>
            ) : (
              <p className="font-normal">The property has no map pin yet, so taps are compared with earlier trusted visits.</p>
            )}
          </div>
        )}
        {job.checkFlags.length > 0 && (
          <div className="mt-3 rounded-xl bg-wait-soft px-4 py-3 text-sm text-ink">
            <p className="font-bold">Flagged at Job done: {CONFIRM_WORDS[job.confirmStatus ?? "waiting"] ?? job.confirmStatus}</p>
            <ul className="mt-1 list-disc pl-5">
              {(job.checkFlags as CheckFlag[]).map((flag) => (
                <li key={flag}>{flagWords(flag, { arrivalM: job.arrivalDistanceM, finishM: job.finishDistanceM, minutes: job.minutesOnSite, minMinutes: market.minMinutesOnSite })}</li>
              ))}
            </ul>
            {job.confirmStatus === "waiting" && job.confirmBy && <p className="mt-1">The owner has until {formatDateTime(job.confirmBy, market.timezone)} to answer. You do not need to do anything yet.</p>}
            {job.confirmStatus && ["waiting", "staff_queue", "staff_held"].includes(job.confirmStatus) && (
              <ActionForm action={staffCheckJob} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="jobId" value={job.id} />
                <SubmitButton name="decision" value="approve" pendingLabel="Paying...">
                  Approve: pay the tradie
                </SubmitButton>
                {job.confirmStatus !== "staff_held" && (
                  <SubmitButton name="decision" value="hold" variant="secondary" pendingLabel="Holding...">
                    Hold the payment
                  </SubmitButton>
                )}
              </ActionForm>
            )}
          </div>
        )}
        {job.ownerSaysAbsentAt && (
          <p className="mt-3 rounded-xl bg-alert-soft px-4 py-3 text-sm font-semibold text-alert">
            The owner said the tradie was not there, {formatDateTime(job.ownerSaysAbsentAt, market.timezone)}.
          </p>
        )}
        {view.laterTime && (
          <p className="mt-3 rounded-xl bg-wait-soft px-4 py-3 text-sm font-semibold text-wait">
            {view.laterTime.tradieName} can&apos;t make the promised time and suggested {windowBetween({ start: view.laterTime.start, end: view.laterTime.end }, at, market.timezone)}. Waiting for the owner until{" "}
            {formatDateTime(view.laterTime.answerBy, market.timezone)}, then it goes to the next tradies.
          </p>
        )}
      </Card>

      {/* WHAT NEEDS DOING */}
      {job.status === "awaiting_owner" && job.cardHold === "placing" && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>Placing the hold on the owner&apos;s card</SectionTitle>
          <p className="text-muted">It goes to tradies as soon as the hold is in place. If this stays here for more than a couple of minutes, the timer asks Stripe again by itself.</p>
        </Card>
      )}

      {job.status === "awaiting_owner" && job.cardHold && job.cardHold !== "placing" && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>Held: the owner&apos;s card needs updating</SectionTitle>
          <p className="text-muted">
            {cardProblemWords(job.cardHold)} The owner has been texted a link. It goes out to tradies by itself within a minute of the card being sorted. Ring them on <Tel phone={view.owner.phone} /> if it is urgent.
          </p>
        </Card>
      )}

      {job.status === "awaiting_owner" && !job.cardHold && (
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

      {needsTradie && job.trade === NOT_SURE_TRADE && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>Pick the trade</SectionTitle>
          <p className="text-muted">The owner was not sure which trade this needs. Read what they wrote and look at the photos, then tap the trade. It goes out to those tradies straight away.</p>
          <TradeButtons jobId={job.id} />
        </Card>
      )}

      {needsTradie && job.trade !== NOT_SURE_TRADE && (
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
          {job.status === "unfilled" && (
            <div className="mt-3">
              <Reveal label="Wrong trade? Send it to another">
                <TradeButtons jobId={job.id} current={job.trade} />
              </Reveal>
            </div>
          )}
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
            {money.payment.lastError ?? "The card was declined."} Tried {money.payment.attempts} {money.payment.attempts === 1 ? "time" : "times"}. The tradie is paid at the usual time anyway: HostFix carries it, and the owner owes it. The owner cannot send new jobs until it is paid. Ask them
            to update their card (Billing in their app): a new card is tried straight away. Or try again here.
          </p>
          <ActionForm action={staffRetryCharge} className="mt-4">
            <input type="hidden" name="jobId" value={job.id} />
            <SubmitButton pendingLabel="Charging...">Try the card again now</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {job.notDescribedAt && (
        <Card className={`${job.notDescribedStatus === "owner_objects" ? "border-alert/40" : ""} sm:p-6`}>
          <SectionTitle>Not the job described</SectionTitle>
          <p className="text-ink">The tradie: &ldquo;{job.notDescribedReason}&rdquo;</p>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(job.notDescribedAt, market.timezone)}. The menu price came off and the call-out went on.{" "}
            {job.notDescribedStatus === "waiting"
              ? `Paid once the owner approves the quote, or if they have not objected by ${job.notDescribedBy ? formatDateTime(job.notDescribedBy, market.timezone) : "then"}.`
              : job.notDescribedStatus === "owner_objects"
                ? "The owner says it was the job they described. Look at the photos (with the quote, below) and decide."
                : job.notDescribedStatus === "approved"
                  ? "The owner approved the quote: the call-out is paid."
                  : job.notDescribedStatus === "no_objection"
                    ? "The owner did not object in time: the call-out is paid."
                    : job.notDescribedStatus === "staff_paid"
                      ? "The team decided: call-out paid."
                      : "The team decided: no call-out."}
          </p>
          {(job.notDescribedStatus === "owner_objects" || job.notDescribedStatus === "waiting") && (
            <ActionForm action={staffNotDescribed} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="jobId" value={job.id} />
              <SubmitButton name="decision" value="pay" pendingLabel="Saving...">
                Pay call-out
              </SubmitButton>
              <SubmitButton name="decision" value="none" variant="secondary" pendingLabel="Saving...">
                No call-out
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      {chargebacks.map((chargeback) => (
        <Card key={chargeback.id} className={`${chargeback.status === "won" || chargeback.fault ? "" : "border-alert/40"} sm:p-6`}>
          <SectionTitle action={<Chip tone={chargeback.status === "open" ? "alert" : chargeback.status === "won" ? "done" : chargeback.fault ? "quiet" : "alert"}>{chargeback.status === "open" ? "Open" : chargeback.status === "won" ? "Won" : "Lost"}</Chip>}>
            The owner&apos;s bank disputed the charge
          </SectionTitle>
          <p className="text-ink">
            {fmt(chargeback.amountCents)}, reason &ldquo;{chargeback.reason.replace(/_/g, " ") || "not given"}&rdquo;, opened {formatDateTime(chargeback.createdAt, market.timezone)}
            {chargeback.closedAt ? `, closed ${formatDateTime(chargeback.closedAt, market.timezone)}` : ""}.
          </p>
          {chargeback.status === "open" && (
            <p className="mt-1 text-muted">
              Answer it in Stripe with the{" "}
              <Link href={`/admin/jobs/${job.id}/evidence`} className="font-semibold text-brand underline underline-offset-2">
                evidence pack
              </Link>{" "}
              (photos, times, locations, receipts, messages). Print it or save it as a PDF and upload it there. The tradie&apos;s payment is on hold if it has not gone.
            </p>
          )}
          {chargeback.status === "lost" && !chargeback.fault && (
            <ActionForm action={staffChargebackFault} className="mt-4 space-y-3">
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="chargebackId" value={chargeback.id} />
              <p className="text-muted">The bank kept the money. Was it the tradie&apos;s fault?</p>
              <div className="flex flex-wrap gap-2">
                <SubmitButton name="fault" value="tradie" variant="danger" pendingLabel="Saving...">
                  Tradie&apos;s fault (bad work, no-show)
                </SubmitButton>
                <SubmitButton name="fault" value="not_tradie" variant="secondary" pendingLabel="Saving...">
                  Not the tradie&apos;s fault
                </SubmitButton>
              </div>
              <p className="text-sm text-muted">
                Tradie&apos;s fault: a payment not sent yet is cancelled; one already sent becomes a balance they owe, taken from their later payments, never more than half of any one, and they are texted. Not their fault: HostFix carries it.
              </p>
            </ActionForm>
          )}
          {chargeback.fault && (
            <p className="mt-1 text-muted">
              Decided {chargeback.decidedAt ? formatDateTime(chargeback.decidedAt, market.timezone) : ""}: {chargeback.fault === "tradie" ? "the tradie's fault" : "not the tradie's fault, HostFix carries it"}.
            </p>
          )}
        </Card>
      ))}

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
          {market.areas.length > 0 && (property.area ? (
            <p className="text-sm text-muted">Area: {areaName(market.areas, property.area)}</p>
          ) : (
            <div className="mt-3 rounded-xl bg-alert-soft px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-ink">No area set, so this property&apos;s jobs go to every tradie, wherever they work. Set its area:</p>
              <PropertyAreaForm propertyId={property.id} area={null} areas={market.areas} jobId={job.id} />
            </div>
          ))}
          {property.accessNotes && (
            <div className="mt-3 rounded-xl bg-tint px-4 py-3">
              <p className="text-sm font-bold tracking-wide text-brand uppercase">How to get in</p>
              <p className="mt-1 whitespace-pre-line text-ink">{property.accessNotes}</p>
            </div>
          )}
          <div className="mt-3 space-y-3">
            <GuestNote job={job} />
            {job.guestPhone && (
              <p className="text-sm text-muted">
                Guest{job.guestName ? `: ${job.guestName}` : ""}, <Tel phone={job.guestPhone} />. Texted the arrival time and when the tradie is on the way. Used for this job only.
              </p>
            )}
            <HazardNote hazards={property.hazards} />
          </div>
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

      {view.parts.length > 0 && (
        <Panel title="Parts">
          <ul className="divide-y divide-line">
            {view.parts.map((part) => {
              const receipt = view.receipts.find((upload) => upload.id === part.receiptUploadId);
              return (
                <li key={part.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className={`font-semibold ${part.status === "void" ? "text-muted line-through" : "text-ink"}`}>
                      {part.description}
                      {part.quantity > 1 ? ` × ${part.quantity}` : ""}
                    </span>
                    <span className="tabular text-sm text-muted">
                      owner {fmt(part.ownerCents)} · tradie {fmt(part.tradieCents)} · we keep {fmt(part.ownerCents - part.tradieCents)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {part.kind === "priced"
                      ? `The tradie's price, ${fmt(part.unitCents ?? 0)} each including GST, less 3% to them.${part.listPriceCents !== null ? ` Picked from the price list at ${fmt(part.listPriceCents)}.` : ""} Receipt: ${PART_RECEIPT[part.receiptStatus] ?? part.receiptStatus}.`
                      : part.kind === "list"
                        ? `Price list (added before 23 Nov 2026), ${fmt(part.unitCents ?? 0)} each. No receipt needed.`
                        : `Off the list (added before 23 Nov 2026): ${fmt(part.amountCents)} of a ${fmt(part.receiptTotalCents ?? 0)} receipt${part.receiptDate ? ` dated ${part.receiptDate}` : ""}, plus 20%. Receipt: ${PART_RECEIPT[part.receiptStatus] ?? part.receiptStatus}.`}
                    {part.status === "pending" ? " Waiting for the owner's yes." : ""}
                  </p>
                  {part.status === "active" && part.receiptStatus === "not_needed" && (
                    <ActionForm action={staffRequestReceipt} className="mt-2">
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="partId" value={part.id} />
                      <SubmitButton variant="secondary" pendingLabel="Asking...">
                        Request the receipt (spot check)
                      </SubmitButton>
                      {money.payout?.status === "sent" && <p className="mt-1 text-sm text-muted">The tradie has already been paid, so nothing is held: a refund after 7 days would come from HostFix.</p>}
                    </ActionForm>
                  )}
                  {receipt && (
                    <a href={`/files/${receipt.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-brand underline underline-offset-2">
                      Open the receipt ({receipt.contentType === "application/pdf" ? "PDF" : "photo"}, sent {formatDateTime(receipt.createdAt, market.timezone)})
                    </a>
                  )}
                  {part.receiptFlags.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-sm text-alert">
                      {part.receiptFlags.map((flag) => (
                        <li key={flag}>{receiptFlagWords(flag)}</li>
                      ))}
                    </ul>
                  )}
                  {part.checkStatus && <p className="mt-1 text-sm font-semibold text-ink">Check: {part.checkStatus === "flagged" ? "waiting for you" : part.checkStatus === "approved" ? "approved" : "payment held by the team"}</p>}
                </li>
              );
            })}
          </ul>
          {view.parts.some((part) => part.status === "active" && (part.checkStatus === "flagged" || part.checkStatus === "held")) && (
            <ActionForm action={staffCheckReceipt} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="jobId" value={job.id} />
              <SubmitButton name="decision" value="approve" pendingLabel="Approving...">
                Approve the receipt
              </SubmitButton>
              {view.parts.some((part) => part.checkStatus === "flagged") && (
                <SubmitButton name="decision" value="hold" variant="secondary" pendingLabel="Holding...">
                  Hold the payment
                </SubmitButton>
              )}
            </ActionForm>
          )}
        </Panel>
      )}

      {job.status === "cancelled" && job.tradieId && !money.payment && view.quotes.some((quote) => quote.status === "approved" || quote.status === "auto_approved") && (
        <Reveal label="Charge parts bought before it was cancelled">
          <ActionForm action={staffChargeBoughtParts} className="space-y-3">
            <input type="hidden" name="jobId" value={job.id} />
            <p className="text-muted">
              Only parts the tradie had already bought for this job and cannot return. They are charged at the receipt&apos;s cost with nothing added, and all of it goes to the tradie. Check the receipt
              first. This charges the owner&apos;s card straight away.
            </p>
            <Field label="Which parts (as on the receipt)" name="boughtDescription" required maxLength={160} />
            <Field label={`Receipt cost, including GST (${job.currency})`} name="boughtAmount" required inputMode="decimal" maxLength={10} />
            <SubmitButton variant="danger" pendingLabel="Charging...">
              Charge the owner for these parts
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}

      {(view.beforePhotos.length > 0 || view.afterPhotos.length > 0) && (
        <Panel title="Before and after">
          <BeforeAfter before={view.beforePhotos} after={view.afterPhotos} timeZone={market.timezone} reference={property.pin ?? (job.arrivedLat !== null && job.arrivedLng !== null ? { lat: job.arrivedLat, lng: job.arrivedLng } : null)} />
        </Panel>
      )}

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
            <CostLines lines={view.lines} currency={job.currency} side="tradie" totalLabel="Tradie total" tierReliefCents={job.tierReliefCents} feeWords={tierLineWords(market)} />
          </div>
        </div>
        <div className="mt-4">
          <Facts
            rows={[
              { label: "We keep", value: `${fmt(job.ownerTotalCents - job.tradieTotalCents)} (${feeWords(market, job.platformFeeBps)}; parts 3%)` },
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
            {job.status === "on_site" || job.status === "awaiting_approval" ? (
              <>
                <Tick name="chargeCallOut" label="The owner asked to cancel: charge them the call-out and pay the tradie theirs" hint="As if the owner cancelled in the app after the tradie arrived. Leave it unticked to charge nothing (for example to charge only parts already bought)." defaultChecked />
              </>
            ) : (
              <p className="text-sm text-muted">The tradie has not tapped Arrived, so nothing is charged, the hold on the owner&apos;s card is let go, and the tradie is not paid (the travel is theirs).</p>
            )}
            <SubmitButton variant="danger" pendingLabel="Cancelling...">
              Cancel the job
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}
    </div>
  );
}
