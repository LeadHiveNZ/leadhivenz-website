import Link from "next/link";
import { answerLater, answerQuote, cancelOwnerJob, confirmJob, goAhead, reportProblem, tradieNotHere } from "@/app/actions/owner";
import { ActionForm, Area } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { secondaryButtonClass } from "@/components/forms/styles";
import { Card, Chip, Facts, Notice, SectionTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import type { PricePreview } from "@/lib/jobs/create";
import type { JobView } from "@/lib/jobs/view";
import type { JobPart } from "@/lib/jobs/parts";
import { partsWords } from "@/lib/markets/display";
import { cardProblemWords } from "@/lib/owners/service";
import { formatMoney } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { addressLine } from "@/lib/properties/service";
import { windowBetween } from "@/lib/jobs/arrival";
import { brand } from "@config/brand";
import { formatDateTime, formatDeadline, formatHourOfDay } from "@/lib/time";
import { ownerCheckWords, type CheckFlag } from "@/lib/jobs/checks";
import { BeforeAfter, CostLines, Deadline, History, JobStatus, Panel, PhotoGrid } from "./JobParts";

export type OwnerJobFlash = { sent?: boolean; already?: boolean; cancelled?: boolean; answered?: boolean; told?: boolean; waiting?: boolean; absent?: boolean; confirmed?: boolean };

type Props = {
  view: JobView;
  now: Date;
  /** Set when the owner opened this from a text, without signing in. */
  code?: string;
  flash?: OwnerJobFlash;
  /** What it would cost to send a tradie now, for a guest's report that is waiting for a yes. */
  prices?: { standard: PricePreview | null; urgent: PricePreview | null };
};

function explain(view: JobView): string {
  const { job, tradie } = view;
  switch (job.status) {
    case "awaiting_owner":
      if (job.cardHold) return "This is ready to go to a tradie as soon as your card can be charged.";
      return job.reportedBy === "team" ? `${job.reporterName ?? "Your team"} reported this. Nobody has been sent yet.` : "A guest reported this. Nobody has been sent yet.";
    case "offering":
      return view.laterTime
        ? `${view.laterTime.tradieName} can't make it in time and has suggested a later time. Your answer is below.`
        : "We are offering this job to our tradies now. You will get a text when one takes it.";
    case "unfilled":
      return "Our team is arranging a tradie for you. You will get a text when one is booked.";
    case "accepted":
      return `${tradie?.businessName ?? "A tradie"} has taken the job${job.enRouteAt ? " and is on the way." : "."}`;
    case "on_site":
      return `${tradie?.businessName ?? "The tradie"} is at the property.`;
    case "awaiting_approval":
      return "The tradie has found more to do and needs your answer before starting.";
    case "completed":
      if (job.outcome === "no_access") return "The tradie could not get into the property, so only the call-out is charged.";
      if (job.outcome === "diagnosis_only") return "The tradie came and looked. The extra work did not go ahead, so only the call-out is charged.";
      return "Finished.";
    case "cancelled":
      return "This job was cancelled.";
  }
}

/** What the owner is told about one part: never the receipt itself. */
function ownerPartWords(part: JobPart): string {
  if (part.receiptStatus === "refunded") return "Refunded: we did not get the receipt";
  if (part.status === "pending") return "Waiting for your yes";
  if (part.kind === "list") return "Price list";
  if (part.receiptStatus === "attached") return part.checkStatus === "flagged" || part.checkStatus === "held" ? "Receipt received: HostFix is checking it" : "Receipt checked by HostFix";
  if (part.receiptStatus === "to_follow") return "Receipt to follow";
  return "Merchant's price plus 20%";
}

/** One job, as its owner sees it. Used inside the app and on the one-tap page opened from a text. */
export function OwnerJob({ view, now, code, flash = {}, prices }: Props) {
  const { job, market, property, tradie, money } = view;
  const which = code ? <input type="hidden" name="code" value={code} /> : <input type="hidden" name="jobId" value={job.id} />;
  const photoQuery = code ? `?j=${encodeURIComponent(code)}` : "";
  const fmt = (cents: number) => formatMoney(cents, job.currency);
  const pendingQuote = view.quotes.find((quote) => quote.status === "pending") ?? null;
  const canCancel = ["awaiting_owner", "offering", "unfilled", "accepted"].includes(job.status);
  const billingHref = code ? `/sign-in?next=${encodeURIComponent("/app/billing")}` : "/app/billing";
  const activeTotal = view.lines.filter((line) => line.status === "active").reduce((sum, line) => sum + line.ownerCents, 0);
  const quotePhotos = view.workPhotos.filter((photo) => photo.kind === "quote");
  // A flagged job waiting for the owner's answer (DECISIONS.md, 2026-11-19). Never worded as the tradie's fault.
  const askToCheck = job.status === "completed" && !money.dispute && (job.confirmStatus === "waiting" || job.confirmStatus === "staff_queue" || job.confirmStatus === "staff_held");
  const otherWork = view.workPhotos.filter((photo) => photo.kind !== "completion");
  const visibleParts = view.parts.filter((part) => part.status !== "void" || part.receiptStatus === "refunded");

  return (
    <div className="space-y-5">
      {flash.sent && (
        <Notice tone="good" title="Sent">
          We are finding a tradie now. We will text you when one is booked.
        </Notice>
      )}
      {flash.already && (
        <Notice tone="info" title="This was already reported">
          So a second tradie has not been sent. This is the job that is already under way.
        </Notice>
      )}
      {flash.cancelled && (
        <Notice tone="good" title="Cancelled">
          Nothing has been charged.
        </Notice>
      )}
      {flash.answered && (
        <Notice tone="good" title="Thanks, the tradie has been told" />
      )}
      {flash.waiting && (
        <Notice tone="good" title="Done: they will come at the time they suggested">
          We have told them. You are charged only when the job is done.
        </Notice>
      )}
      {flash.absent && (
        <Notice tone="good" title="Thanks. We are ringing the tradie now">
          A person on our team will call you back. You are not charged for anything that was not done.
        </Notice>
      )}
      {flash.confirmed && (
        <Notice tone="good" title="Thanks for confirming">
          The tradie will be paid as normal.
        </Notice>
      )}
      {flash.told && (
        <Notice tone="good" title="Thanks for telling us">
          A person on our team will look into it and come back to you.
        </Notice>
      )}

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatus job={job} audience="owner" />
          {job.urgency === "urgent" && <Chip tone="alert">Urgent</Chip>}
          <span className="tabular text-sm text-muted">Job {job.number}</span>
        </div>
        <p className="mt-3 text-lg text-ink">{explain(view)}</p>
        {job.status !== "awaiting_owner" && (
          <div className="mt-2">
            <Deadline job={job} now={now} timeZone={market.timezone} />
          </div>
        )}
        {money.credit && (
          <p className="mt-3 rounded-xl bg-done-soft px-4 py-3 text-sm font-semibold text-done">
            We missed the time we promised, so {fmt(money.credit.amountCents)} of this job is on us. {money.credit.status === "applied" ? "It has come off the bill." : "It comes off the bill when the job is done."}
          </p>
        )}
      </Card>

      {askToCheck && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>Can you check this job?</SectionTitle>
          <p className="text-lg text-ink">{ownerCheckWords(job.checkFlags as CheckFlag[])}</p>
          <div className="mt-4">
            <BeforeAfter before={view.beforePhotos} after={view.afterPhotos} query={photoQuery} timeZone={market.timezone} />
          </div>
          {job.completionNote && <p className="mt-3 whitespace-pre-line text-muted">&ldquo;{job.completionNote}&rdquo;</p>}
          <ActionForm action={confirmJob} className="mt-4 space-y-2.5">
            {which}
            <SubmitButton pendingLabel="Sending..." className="w-full">
              Yes, it&rsquo;s fixed
            </SubmitButton>
          </ActionForm>
          <div className="mt-2.5">
            <Reveal label="Something's wrong" tone="alert">
              <ActionForm action={reportProblem} className="space-y-3">
                {which}
                <Area label="What is wrong?" name="reason" rows={3} required maxLength={1500} placeholder="The tap is still dripping." hint="A person on our team looks at every one of these. The tradie's payment stays on hold until it is sorted." />
                <SubmitButton variant="danger" pendingLabel="Sending...">
                  Tell the team
                </SubmitButton>
              </ActionForm>
            </Reveal>
          </div>
          {job.confirmStatus === "waiting" && job.confirmBy && (
            <p className="mt-3 text-center text-sm text-muted">If we have not heard from you by {formatDeadline(job.confirmBy, now, market.timezone)}, our team takes it from there. You do not have to do anything else.</p>
          )}
        </Card>
      )}

      {job.status === "awaiting_owner" && job.cardHold && (
        <Card className="border-alert/40 sm:p-6">
          <SectionTitle>Update your card and we send a tradie</SectionTitle>
          <p className="text-muted">{cardProblemWords(job.cardHold)}</p>
          <Link href={billingHref} className={`${secondaryButtonClass} mt-4`}>
            Update my card
          </Link>
          <p className="mt-2 text-sm text-muted">Once it is sorted the job goes out by itself within a minute. Nothing is charged until the job is done.</p>
        </Card>
      )}

      {job.status === "awaiting_owner" && !job.cardHold && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>Send a tradie?</SectionTitle>
          <p className="text-muted">
            {job.reportedBy === "team" ? `${job.reporterName ?? "Your team"} reported this from their team link` : `${job.reporterName ?? "A guest"} reported this from the QR card`}{job.reporterPhone ? ` (${displayPhone(job.reporterPhone)})` : ""}. Nobody is sent, and nothing is charged, until you say yes.
          </p>
          <ActionForm action={goAhead} className="mt-4 space-y-2.5">
            {which}
            <SubmitButton name="how" value="standard" pendingLabel="Sending..." className="w-full">
              Yes, send a tradie{prices?.standard ? ` · ${fmt(prices.standard.ownerCents)}` : ""}
            </SubmitButton>
            <p className="text-center text-sm text-muted">On site within {prices?.standard?.responseHours ?? job.responseHours} hours.</p>
            <SubmitButton name="how" value="urgent" variant="secondary" pendingLabel="Sending..." className="w-full">
              Yes, and it is urgent{prices?.urgent ? ` · ${fmt(prices.urgent.ownerCents)}` : ""}
            </SubmitButton>
            <p className="text-center text-sm text-muted">
              On site within {prices?.urgent?.responseHours ?? 4} hours. If the tradie is later than that, the urgent fee is not charged.
              {prices?.urgent?.afterHours ? ` The after-hours call-out is charged only if they arrive before ${formatHourOfDay(market.hoursStart)}, after ${formatHourOfDay(market.hoursEnd)} or on a non-working day.` : ""}
            </p>
          </ActionForm>
        </Card>
      )}

      {view.laterTime && job.status === "offering" && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>{view.laterTime.tradieName} can&rsquo;t make it within {job.responseHours} hours</SectionTitle>
          <p className="text-lg text-ink">
            They can come {windowBetween({ start: view.laterTime.start, end: view.laterTime.end }, now, market.timezone)}.
          </p>
          <ActionForm action={answerLater} className="mt-4 space-y-2.5">
            {which}
            <input type="hidden" name="proposalId" value={view.laterTime.id} />
            <SubmitButton name="answer" value="wait" pendingLabel="Sending..." className="w-full">
              Wait for {view.laterTime.tradieName}
            </SubmitButton>
            <SubmitButton name="answer" value="send" variant="secondary" pendingLabel="Sending..." className="w-full">
              Send it to another {brand.name} tradie now
            </SubmitButton>
            <p className="text-center text-sm text-muted">
              {job.urgency === "urgent" ? "If you wait, the job is no longer urgent and the urgent fee is not charged. " : ""}
              If you have not answered by {formatDeadline(view.laterTime.answerBy, now, market.timezone)}, we send it to another tradie.
            </p>
          </ActionForm>
        </Card>
      )}

      {pendingQuote && job.status === "awaiting_approval" && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>A quote needs your answer</SectionTitle>
          <p className="text-lg text-ink">{pendingQuote.labourCents > 0 ? pendingQuote.description : "Parts the tradie needs to buy"}</p>
          <div className="mt-2">
            <Facts
              rows={[
                ...view.lines
                  .filter((line) => line.quoteId === pendingQuote.id && line.status === "pending")
                  .map((line) => ({ label: line.kind === "parts" ? `Part: ${line.label}` : "Work", value: fmt(line.ownerCents) })),
                { label: pendingQuote.labourCents > 0 ? "This quote" : "These parts", value: <span className="text-xl">{fmt(pendingQuote.ownerTotalCents)}</span> },
              ]}
            />
          </div>
          {pendingQuote.labourCents === 0 && <p className="mt-2 text-sm text-muted">{partsWords(market)} Nothing is bought until you say yes.</p>}
          {quotePhotos.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-sm font-semibold text-muted">What the tradie found</p>
              <PhotoGrid photos={quotePhotos} query={photoQuery} />
            </div>
          )}
          <ActionForm action={answerQuote} className="mt-4 space-y-2.5">
            {which}
            <input type="hidden" name="quoteId" value={pendingQuote.id} />
            <SubmitButton name="answer" value="yes" pendingLabel="Sending..." className="w-full">
              Yes, go ahead · {fmt(pendingQuote.ownerTotalCents)}
            </SubmitButton>
            <SubmitButton name="answer" value="no" variant="secondary" pendingLabel="Sending..." className="w-full">
              No thanks
            </SubmitButton>
            <p className="text-center text-sm text-muted">If you say no, you pay only for what has been done so far: {fmt(activeTotal)}.</p>
          </ActionForm>
        </Card>
      )}

      {tradie && job.status !== "cancelled" && (
        <Panel title="Your tradie">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
              <Icon name="tradie" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">{tradie.businessName}</span>
              <span className="block text-sm text-muted">{tradie.name}</span>
            </span>
            {tradie.phone && job.status !== "completed" && (
              <a href={`tel:${tradie.phone}`} className={secondaryButtonClass}>
                <Icon name="phone" size={16} /> Call
              </a>
            )}
          </div>
          {(job.status === "on_site" || job.status === "awaiting_approval") && !job.ownerSaysAbsentAt && (
            <ActionForm action={tradieNotHere} className="mt-4 space-y-2 border-t border-line pt-4">
              {which}
              <p className="text-sm text-muted">The app says {tradie.businessName} has arrived. If nobody is there, tell us and we ring them straight away.</p>
              <SubmitButton variant="secondary" pendingLabel="Telling the team..." className="w-full">
                The tradie isn&rsquo;t here
              </SubmitButton>
            </ActionForm>
          )}
          {job.ownerSaysAbsentAt && job.status !== "completed" && (
            <p className="mt-3 text-sm font-semibold text-wait">You told us the tradie isn&rsquo;t there. Our team is on it.</p>
          )}
        </Panel>
      )}

      <Panel title="The problem">
        <p className="text-lg font-semibold text-ink">{job.title}</p>
        {job.description && <p className="mt-1 whitespace-pre-line text-muted">{job.description}</p>}
        {job.reportedBy !== "owner" && (
          <p className="mt-2 text-sm text-muted">
            Reported by {job.reporterName ?? (job.reportedBy === "guest" ? "a guest" : "your team")}
            {job.reporterPhone ? `, ${displayPhone(job.reporterPhone)}` : ""} on {formatDateTime(job.createdAt, market.timezone)}.
          </p>
        )}
        {view.reportPhotos.length > 0 && (
          <div className="mt-3">
            <PhotoGrid photos={view.reportPhotos} query={photoQuery} />
          </div>
        )}
        {job.reportedBy !== "guest" && job.guestStaying && (
          <p className="mt-2 text-sm text-muted">
            {job.guestStaying === "no" ? "No guest staying." : job.guestStaying === "yes" ? `A guest is staying${job.guestName ? `: ${job.guestName}` : ""}.` : "You were not sure whether a guest is staying."}
            {job.guestPhone ? " We text them the arrival time and when the tradie is on the way. The tradie knocks first." : job.guestStaying === "no" ? "" : " The tradie knocks first."}
            {job.mayLetIn ? " If nobody answers, the tradie may let themselves in." : " The tradie won't let themselves in."}
          </p>
        )}
        <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
          At{" "}
          {code ? (
            <span className="font-semibold text-ink">{property.name}</span>
          ) : (
            <Link href={`/app/properties/${property.id}`} className="font-semibold text-brand underline underline-offset-2">
              {property.name}
            </Link>
          )}
          , {addressLine(property)}
        </p>
      </Panel>

      {job.status === "completed" && !askToCheck && (job.completionNote || view.workPhotos.length > 0 || view.beforePhotos.length > 0) && (
        <Panel title="What was done">
          {job.completionNote && <p className="whitespace-pre-line text-ink">{job.completionNote}</p>}
          {(view.beforePhotos.length > 0 || view.afterPhotos.length > 0) && (
            <div className="mt-3">
              <BeforeAfter before={view.beforePhotos} after={view.afterPhotos} query={photoQuery} timeZone={market.timezone} />
            </div>
          )}
          {otherWork.length > 0 && (
            <div className="mt-3">
              <PhotoGrid photos={otherWork} query={photoQuery} />
            </div>
          )}
        </Panel>
      )}

      {job.status !== "cancelled" && view.lines.length > 0 && (
        <Panel title="The cost">
          <CostLines lines={view.lines} currency={job.currency} side="owner" totalLabel={job.status === "completed" ? "Total" : "Total so far"} />
          <p className="mt-3 text-sm text-muted">
            {market.taxRegistered && job.taxCents > 0 ? `Includes ${market.taxName} of ${fmt(job.taxCents)}. ` : ""}
            {job.status === "completed"
              ? money.payment?.status === "succeeded" || money.payment?.status === "part_refunded" || money.payment?.status === "refunded"
                ? `Charged to your card${money.payment.paidAt ? ` on ${formatDateTime(money.payment.paidAt, market.timezone)}` : ""}.${money.payment.refundedCents > 0 ? ` ${fmt(money.payment.refundedCents)} has been refunded.` : ""}`
                : money.payment?.status === "failed"
                  ? ""
                  : "Your card will be charged shortly."
              : "Charged to your card when the job is done. Nothing before."}
          </p>
          {job.status === "completed" && money.payment?.status === "failed" && (
            <div className="mt-3">
              <Notice tone="error" title="We could not charge your card">
                We will try again.{" "}
                <Link href={billingHref} className="font-semibold underline underline-offset-2">
                  Check or change your card
                </Link>
              </Notice>
            </div>
          )}
        </Panel>
      )}

      {visibleParts.length > 0 && (
        <Panel title="Parts">
          <ul className="divide-y divide-line">
            {visibleParts.map((part) => (
              <li key={part.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className={part.status === "void" ? "text-muted line-through" : "text-ink"}>
                    {part.description}
                    {part.quantity > 1 ? ` × ${part.quantity}` : ""}
                  </span>
                  <span className="block text-sm text-muted">{ownerPartWords(part)}</span>
                </span>
                <span className={`tabular shrink-0 font-semibold ${part.status === "void" ? "text-muted line-through" : "text-ink"}`}>{fmt(part.ownerCents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{partsWords(market)}</p>
        </Panel>
      )}

      {money.dispute ? (
        <Notice tone={money.dispute.status === "open" ? "warn" : "good"} title={money.dispute.status === "open" ? "We are looking into the problem you raised" : "The problem you raised has been dealt with"}>
          <p>&ldquo;{money.dispute.reason}&rdquo;</p>
          {money.dispute.status !== "open" && (
            <p className="mt-1">
              {money.dispute.refundCents ? `${fmt(money.dispute.refundCents)} has been refunded to your card. ` : ""}
              {money.dispute.resolutionNote ?? ""}
            </p>
          )}
        </Notice>
      ) : (
        job.status === "completed" && !askToCheck && (
          <Reveal label="Something not right with this job?">
            <ActionForm action={reportProblem} className="space-y-3">
              {which}
              <Area label="What is wrong?" name="reason" rows={3} required maxLength={1500} placeholder="The tap is still dripping." hint="A person on our team looks at every one of these. If the tradie has not been paid yet, their payment is held until it is sorted." />
              <SubmitButton variant="danger" pendingLabel="Sending...">
                Tell the team
              </SubmitButton>
            </ActionForm>
          </Reveal>
        )
      )}

      {canCancel && (
        <Reveal label={job.status === "awaiting_owner" ? "No, do not send anyone" : "Cancel this job"} tone="alert">
          <ActionForm action={cancelOwnerJob} className="space-y-3">
            {which}
            <p className="text-muted">{job.status === "awaiting_owner" ? "The report is closed and nothing is charged." : "Free to cancel until the tradie arrives. Nothing is charged."}</p>
            <SubmitButton variant="danger" pendingLabel="Cancelling...">
              {job.status === "awaiting_owner" ? "Close this report" : "Yes, cancel the job"}
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}

      <History view={view} />
    </div>
  );
}
