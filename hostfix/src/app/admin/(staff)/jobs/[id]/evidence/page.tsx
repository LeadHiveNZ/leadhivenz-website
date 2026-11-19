import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BeforeAfter, CostLines, History, Panel, PhotoGrid } from "@/components/jobs/JobParts";
import { Facts, Notice, PageTitle } from "@/components/ui/Bits";
import { PrintButton } from "@/components/ui/Buttons";
import { findTrade } from "@config/trades";
import { requireStaff } from "@/lib/auth/current";
import { chargebacksForJob } from "@/lib/billing/chargebacks";
import { getDb } from "@/lib/db";
import { flagWords, type CheckFlag } from "@/lib/jobs/checks";
import { receiptFlagWords } from "@/lib/jobs/parts";
import { getJobForStaff } from "@/lib/jobs/store";
import { loadJobView } from "@/lib/jobs/view";
import { formatMoney } from "@/lib/money";
import { listMessages } from "@/lib/notify/outbox";
import { displayPhone } from "@/lib/phone";
import { addressLine } from "@/lib/properties/service";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Evidence pack" };

const RECEIPT: Record<string, string> = {
  not_needed: "not needed (price list)",
  needed: "not sent",
  attached: "sent",
  to_follow: "promised, not sent yet",
  refunding: "never came: being refunded",
  refunded: "never came: refunded to the owner",
};

const CHECK: Record<string, string> = {
  flagged: "flagged, waiting for the team",
  approved: "checked and approved by the team",
  held: "held by the team",
};

const CONFIRM: Record<string, string> = {
  waiting: "waiting for the owner",
  owner_confirmed: "the owner confirmed it is fixed",
  owner_problem: "the owner said something is wrong",
  released_trusted: "no answer from the owner; paid as a trusted tradie",
  staff_queue: "no answer from the owner; with the team",
  staff_approved: "approved by the team",
  staff_held: "payment held by the team",
};

function where(check: string | null, metres: number | null, lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return check === "no_location" ? "the phone gave no location" : "no location recorded";
  const at = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (metres === null) return `${at} (nothing to compare it with yet)`;
  return `${at}, ${metres} m from the property${check === "far" ? " (flagged as far)" : ""}`;
}

/**
 * Everything the app recorded about one job, on one page, to answer a
 * chargeback or a direct-debit dispute (DECISIONS.md, 2026-11-20): what was
 * asked for, the times and places of each tap, the before and after photos,
 * the receipts and how they were checked, what the owner said, and every text
 * and email sent. Staff only. Print it or save it as a PDF to upload to Stripe.
 */
export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const db = await getDb();
  const job = await getJobForStaff(db, id);
  if (!job) notFound();
  const view = await loadJobView(db, job, "staff");
  const { market, property, money } = view;
  const zone = market.timezone;
  const fmt = (cents: number) => formatMoney(cents, job.currency);
  const when = (date: Date | null) => (date ? formatDateTime(date, zone) : "not recorded");
  const messages = await listMessages(db, { jobId: job.id, limit: 200 });
  const chargebacks = await chargebacksForJob(db, job.id);
  const accepted = view.offers.find((offer) => offer.status === "accepted");

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none">
      <PageTitle
        title={`Evidence pack: job ${job.number}`}
        back={{ href: `/admin/jobs/${job.id}`, label: "Back to the job" }}
        intro="Everything the app recorded about this job. Print it, or save it as a PDF, and upload it to Stripe with your answer."
        action={<PrintButton>Print or save as PDF</PrintButton>}
      />
      {chargebacks.length > 0 && (
        <Notice tone={chargebacks.some((chargeback) => chargeback.status === "open") ? "warn" : "info"} title="Disputed by the owner's bank">
          {chargebacks.map((chargeback) => `${fmt(chargeback.amountCents)} on ${formatDateTime(chargeback.createdAt, zone)}, reason "${chargeback.reason.replace(/_/g, " ") || "not given"}", ${chargeback.status}.`).join(" ")}
        </Notice>
      )}

      <Panel title="The job">
        <Facts
          rows={[
            { label: "Job", value: `${job.number}: ${job.title} (${findTrade(job.trade)?.label ?? job.trade})` },
            { label: "Property", value: `${property.name}, ${addressLine(property)}` },
            { label: "Owner", value: `${view.owner.name}${view.owner.phone ? `, ${displayPhone(view.owner.phone)}` : ""}` },
            { label: "Tradie", value: view.tradie ? `${view.tradie.businessName} (${view.tradie.name})` : "None" },
            { label: "Asked for", value: job.description || "No extra details were given." },
            { label: "Charged", value: money.payment ? `${fmt(money.payment.amountCents)}, ${money.payment.status}${money.payment.paidAt ? ` on ${formatDateTime(money.payment.paidAt, zone)}` : ""}` : "Not charged" },
            { label: "What the tradie wrote at Job done", value: job.completionNote || "Nothing" },
          ]}
        />
      </Panel>

      <Panel title="Times and places">
        <Facts
          rows={[
            { label: "Logged", value: `${when(job.createdAt)}, by ${job.reportedBy === "owner" ? "the owner" : job.reportedBy === "guest" ? "a guest" : job.reportedBy === "team" ? "the owner's team" : "our team"}` },
            { label: "Accepted", value: `${when(job.acceptedAt)}${accepted?.respondedVia ? `, by ${accepted.respondedVia}` : ""}` },
            { label: "On my way", value: when(job.enRouteAt) },
            { label: "Arrived", value: `${when(job.arrivedAt)}${job.arrivedAt ? `, at ${where(job.arrivalCheck, job.arrivalDistanceM, job.arrivedLat, job.arrivedLng)}` : ""}` },
            { label: "Job done", value: `${when(job.completedAt)}${job.completedAt ? `, at ${where(job.finishCheck, job.finishDistanceM, job.finishedLat, job.finishedLng)}` : ""}` },
            { label: "Time on site", value: job.minutesOnSite === null ? "not recorded" : `${job.minutesOnSite} minutes` },
            { label: "Property's map pin", value: property.pin ? `${property.pin.lat.toFixed(5)}, ${property.pin.lng.toFixed(5)}${property.pinConfirmedAt ? ", confirmed by the owner" : ""}` : "none" },
            { label: "Owner's confirmation", value: job.confirmStatus ? (CONFIRM[job.confirmStatus] ?? job.confirmStatus) : "not asked" },
          ]}
        />
        {job.checkFlags.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-ink">
            {(job.checkFlags as CheckFlag[]).map((flag) => (
              <li key={flag}>{flagWords(flag, { arrivalM: job.arrivalDistanceM, finishM: job.finishDistanceM, minutes: job.minutesOnSite, minMinutes: market.minMinutesOnSite })}</li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Photos">
        <BeforeAfter before={view.beforePhotos} after={view.afterPhotos} timeZone={zone} reference={property.pin} />
        {view.reportPhotos.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">From the report</p>
            <PhotoGrid photos={view.reportPhotos} />
          </div>
        )}
      </Panel>

      <Panel title="What was charged, line by line">
        <CostLines lines={view.lines} currency={job.currency} side="owner" totalLabel="The owner paid" />
      </Panel>

      {view.parts.length > 0 && (
        <Panel title="Parts and receipts">
          <ul className="divide-y divide-line">
            {view.parts.map((part) => (
              <li key={part.id} className="py-2.5 text-sm">
                <p className="font-semibold text-ink">
                  {part.quantity} x {part.description}: {fmt(part.ownerCents)} {part.status === "void" ? "(taken off)" : ""}
                </p>
                <p className="text-muted">
                  Receipt {RECEIPT[part.receiptStatus] ?? part.receiptStatus}
                  {part.receiptDate ? `, dated ${part.receiptDate}` : ""}
                  {part.receiptTotalCents !== null ? `, for ${fmt(part.receiptTotalCents)}` : ""}
                  {part.checkStatus ? `; ${CHECK[part.checkStatus] ?? part.checkStatus}` : ""}
                  {part.receiptFlags.length > 0 ? `; flagged: ${part.receiptFlags.map((flag) => receiptFlagWords(flag)).join("; ")}` : ""}.
                </p>
              </li>
            ))}
          </ul>
          {view.receipts.length > 0 && (
            <div className="mt-3">
              <PhotoGrid photos={view.receipts} />
            </div>
          )}
        </Panel>
      )}

      <Panel title={`Texts and emails (${messages.length})`}>
        {messages.length === 0 ? (
          <p className="text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-line">
            {messages.map((message) => (
              <li key={message.id} className="py-2.5 text-sm">
                <p className="font-semibold text-ink">
                  {formatDateTime(message.createdAt, zone)}: {message.channel === "sms" ? "text" : "email"} to the {message.audience ?? "recipient"}, {message.status}
                </p>
                {message.body && <p className="whitespace-pre-line text-muted">{message.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <History view={view} />
    </div>
  );
}
