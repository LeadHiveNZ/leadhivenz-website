import { arrived, finishJob, noAccess, onMyWay, sendQuote } from "@/app/actions/tradie";
import { ActionForm, Area, Field } from "@/components/forms/ActionForm";
import { PhotoUploader } from "@/components/forms/PhotoUploader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { secondaryButtonClass } from "@/components/forms/styles";
import { Card, Chip, Notice, SectionTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import type { Upload } from "@/lib/files/uploads";
import type { JobView } from "@/lib/jobs/view";
import { formatMoney } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { addressLine } from "@/lib/properties/service";
import { formatDate, formatDateTime } from "@/lib/time";
import { payTiming } from "@/lib/markets/display";
import { CostLines, Deadline, History, JobStatus, Panel, PhotoGrid } from "./JobParts";
import { ArrivedButton } from "./TradieClient";

export type TradieJobFlash = { yours?: boolean; here?: boolean; quoted?: "wait" | "go" | null; done?: boolean };

type Props = {
  view: JobView;
  now: Date;
  /** Set when the tradie opened this from a text, without signing in. */
  code?: string;
  flash?: TradieJobFlash;
  /** The owner's photos of the lockbox, switchboard and so on. */
  propertyPhotos: Upload[];
};

function payoutLine(view: JobView): { text: string; tone: "good" | "info" | "warn" | "error" } {
  const payout = view.money.payout;
  const zone = view.market.timezone;
  const amount = payout ? formatMoney(payout.amountCents, view.job.currency) : formatMoney(view.job.tradieTotalCents, view.job.currency);
  if (!payout) return { text: `You get ${amount}. It is being set up now.`, tone: "info" };
  switch (payout.status) {
    case "sent":
      return { text: `${amount} was sent${payout.sentAt ? ` on ${formatDate(payout.sentAt, zone)}` : ""}. It reaches your bank ${payTiming(view.market).arrives}.`, tone: "good" };
    case "scheduled":
      return { text: `${amount} will be sent on ${formatDateTime(payout.releaseAt, zone)}. It reaches your bank ${payTiming(view.market).arrives}.`, tone: "good" };
    case "waiting":
      return { text: `${amount} will be sent once the owner's card has been charged. If the card fails we chase it, not you.`, tone: "info" };
    case "paused":
      return { text: `${amount} is on hold while we look into a problem the owner raised. We will be in touch.`, tone: "warn" };
    case "failed":
      return { text: `We could not send ${amount} to your bank. Check your bank details in your profile, then we will try again.`, tone: "error" };
    case "reversed":
      return { text: "This payment was taken back after a refund to the owner.", tone: "warn" };
    default:
      return { text: "No payment is due for this job.", tone: "info" };
  }
}

/** One job, as the tradie doing it sees it: where, what, the steps, and what they get. */
export function TradieJob({ view, now, code, flash = {}, propertyPhotos }: Props) {
  const { job, market, property } = view;
  const which = code ? <input type="hidden" name="code" value={code} /> : <input type="hidden" name="jobId" value={job.id} />;
  const photoQuery = code ? `?o=${encodeURIComponent(code)}` : "";
  const fmt = (cents: number) => formatMoney(cents, job.currency);
  const address = addressLine(property);
  const pendingQuote = view.quotes.find((quote) => quote.status === "pending") ?? null;
  const hasApprovedWork = view.lines.some((line) => line.kind === "quote" && line.status === "active");
  const limit = property.spendLimitCents ?? market.approvalThresholdCents;
  const share = 100 - market.platformFeeBps / 100;
  const paid = payoutLine(view);
  const open = job.status === "accepted" || job.status === "on_site" || job.status === "awaiting_approval";

  return (
    <div className="space-y-5">
      {flash.yours && (
        <Notice tone="good" title="The job is yours">
          The address and how to get in are below.
        </Notice>
      )}
      {flash.here && (
        <Notice tone="good" title="Marked as arrived">
          The owner has been told you are there.
        </Notice>
      )}
      {flash.quoted === "wait" && (
        <Notice tone="warn" title="Quote sent to the owner">
          Do not start the extra work until they say yes. We will text you their answer.
        </Notice>
      )}
      {flash.quoted === "go" && (
        <Notice tone="good" title="Quote approved">
          It is inside what the owner has already agreed to, so go ahead.
        </Notice>
      )}
      {flash.done && job.status === "completed" && <Notice tone="good" title="Job finished. Thank you." />}

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatus job={job} audience="tradie" />
          {job.urgency === "urgent" && <Chip tone="alert">Urgent</Chip>}
          {job.afterHours && <Chip tone="brand">After hours</Chip>}
          <span className="tabular text-sm text-muted">Job {job.number}</span>
        </div>
        <p className="mt-3 text-xl font-bold text-ink">{job.title}</p>
        <div className="mt-1.5">
          <Deadline job={job} now={now} timeZone={market.timezone} />
        </div>
        {job.status === "completed" && (
          <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${paid.tone === "good" ? "bg-done-soft text-done" : paid.tone === "error" ? "bg-alert-soft text-alert" : paid.tone === "warn" ? "bg-wait-soft text-wait" : "bg-tint text-ink"}`}>
            {paid.text}
          </p>
        )}
        {job.status === "cancelled" && <p className="mt-3 text-muted">This job was cancelled. There is nothing more to do.</p>}
      </Card>

      {job.status === "accepted" && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>Next step</SectionTitle>
          <div className="space-y-2.5">
            <ActionForm action={arrived} className="space-y-2">
              {which}
              <ArrivedButton />
            </ActionForm>
            {!job.enRouteAt ? (
              <ActionForm action={onMyWay} className="space-y-2">
                {which}
                <SubmitButton variant="secondary" pendingLabel="Saving..." className="w-full">
                  I am on my way
                </SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-center text-sm text-muted">The owner can see you are on the way.</p>
            )}
          </div>
          <p className="mt-3 text-sm text-muted">Tap &ldquo;I have arrived&rdquo; at the door, with your phone&rsquo;s location on. That is the time your arrival is measured against: the end of the window you chose, or the urgent deadline.</p>
        </Card>
      )}

      {job.status === "awaiting_approval" && pendingQuote && (
        <Notice tone="warn" title={`Waiting for the owner's answer on your quote of ${fmt(pendingQuote.ownerTotalCents)}`}>
          Do not start the extra work yet. We have texted them and will text you the answer. If they say no, finish the job as it stands.
        </Notice>
      )}

      {job.status === "on_site" && (
        <>
          {job.offMenu && !hasApprovedWork && (
            <Notice tone="info" title="This is a look-and-price job">
              Have a look, then send a quote below. If the owner says no, or it cannot be fixed today, finish the job and you are paid the call-out.
            </Notice>
          )}
          <Reveal label={job.offMenu && !hasApprovedWork ? "Price the work (send a quote)" : "Found more to do? Send a quote"} open={job.offMenu && !hasApprovedWork}>
            <ActionForm action={sendQuote} className="space-y-4">
              {which}
              <Field label="What is the work?" name="quoteDescription" required maxLength={160} placeholder="Replace the hot water cylinder valve" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Your price for the work (${job.currency})`} name="labour" inputMode="decimal" maxLength={10} placeholder="180" hint={`You keep ${share}% of this.`} />
                <Field label={`Parts, at what they cost you (${job.currency})`} name="parts" inputMode="decimal" maxLength={10} placeholder="45" hint="Paid to you in full. Keep the receipt." />
              </div>
              <PhotoUploader kind="quote" name="quoteUploadIds" label="Photos of what you found (optional)" offer={code} max={4} />
              <p className="text-sm text-muted">
                Up to {fmt(limit)} of extra work goes ahead straight away and the owner is told. Above that, or with parts over {fmt(market.partsApprovalCents)}, the owner is asked first and you wait for their yes.
              </p>
              <SubmitButton variant="secondary" pendingLabel="Sending...">
                Send quote
              </SubmitButton>
            </ActionForm>
          </Reveal>

          <Card className="border-brand/30 sm:p-6">
            <SectionTitle>{job.offMenu && !hasApprovedWork ? "Finish (call-out only)" : "Finish the job"}</SectionTitle>
            <ActionForm action={finishJob} className="space-y-4">
              {which}
              <PhotoUploader kind="completion" label="Photos of the finished work (at least one)" offer={code} max={8} />
              <Area label="What did you do?" name="note" rows={3} maxLength={1500} placeholder="Cleared the blockage in the kitchen waste. Ran the tap for five minutes, draining well." hint="The owner sees this with your photos." />
              <SubmitButton pendingLabel="Finishing..." className="w-full">
                Job done
              </SubmitButton>
            </ActionForm>
          </Card>
        </>
      )}

      {(job.status === "on_site" || job.status === "awaiting_approval") && (
        <Reveal label="Could not get in?" tone="alert">
          <ActionForm action={noAccess} className="space-y-4">
            {which}
            <Area label="What happened?" name="noAccessNote" rows={3} required maxLength={1000} placeholder="Lockbox code did not work and nobody answered the door." />
            <PhotoUploader kind="completion" name="noAccessUploadIds" label="A photo showing you were at the property" offer={code} max={3} />
            <p className="text-sm text-muted">Try calling the contact below first. If you still cannot get in, you are paid the call-out and the owner is charged it.</p>
            <SubmitButton variant="danger" pendingLabel="Sending...">
              I could not get in
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}

      <Panel title="Where">
        <p className="text-lg font-semibold text-ink">{address}</p>
        <p className="text-sm text-muted">{property.name}</p>
        {open && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className={`${secondaryButtonClass} mt-3`}>
            <Icon name="market" size={16} /> Open in maps
          </a>
        )}
        {property.accessNotes && open && (
          <div className="mt-4 rounded-xl bg-tint px-4 py-3">
            <p className="text-sm font-bold tracking-wide text-brand uppercase">How to get in</p>
            <p className="mt-1 whitespace-pre-line text-ink">{property.accessNotes}</p>
          </div>
        )}
        {propertyPhotos.length > 0 && open && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-muted">Photos from the owner</p>
            <PhotoGrid photos={propertyPhotos} query={photoQuery} />
          </div>
        )}
      </Panel>

      <Panel title="The problem">
        {job.description ? <p className="whitespace-pre-line text-ink">{job.description}</p> : <p className="text-muted">No extra details were given.</p>}
        {view.reportPhotos.length > 0 && (
          <div className="mt-3">
            <PhotoGrid photos={view.reportPhotos} query={photoQuery} />
          </div>
        )}
        {open && (
          <ul className="mt-4 space-y-2 border-t border-line pt-3">
            {job.reporterPhone && (
              <li className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">
                  Reported by <span className="font-semibold text-ink">{job.reporterName ?? "someone at the property"}</span>
                  {job.reportedBy === "guest" ? " (guest)" : job.reportedBy === "team" ? " (cleaner or co-host)" : ""}
                </span>
                <a href={`tel:${job.reporterPhone}`} className={secondaryButtonClass}>
                  <Icon name="phone" size={16} /> {displayPhone(job.reporterPhone)}
                </a>
              </li>
            )}
            {view.owner.phone && (
              <li className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">
                  Owner: <span className="font-semibold text-ink">{view.owner.name}</span>
                </span>
                <a href={`tel:${view.owner.phone}`} className={secondaryButtonClass}>
                  <Icon name="phone" size={16} /> {displayPhone(view.owner.phone)}
                </a>
              </li>
            )}
          </ul>
        )}
      </Panel>

      {job.status !== "cancelled" && view.lines.length > 0 && (
        <Panel title="What you get">
          <CostLines lines={view.lines} currency={job.currency} side="tradie" totalLabel="You get" />
          <p className="mt-3 text-sm text-muted">{payTiming(market).line} Parts are paid back in full. Urgent and after-hours amounts are your share, after the platform fee. The urgent share is paid only if you tap Arrived by the urgent deadline, and the after-hours share only if you arrive outside working hours.</p>
        </Panel>
      )}

      {job.status === "completed" && view.workPhotos.length > 0 && (
        <Panel title="Your photos">
          {job.completionNote && <p className="mb-3 whitespace-pre-line text-ink">{job.completionNote}</p>}
          <PhotoGrid photos={view.workPhotos} query={photoQuery} />
        </Panel>
      )}

      <History view={view} />
    </div>
  );
}
