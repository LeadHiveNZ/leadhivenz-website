import { arrived, finishJob, noAccess, onMyWay, reportHazardAction, sendNotDescribed, sendQuote } from "@/app/actions/tradie";
import { HOURLY_LIMIT_CENTS } from "@/lib/jobs/rates";
import { GuestNote, HazardNote } from "./SafetyNotes";
import { ActionForm, Area, Field, Tick } from "@/components/forms/ActionForm";
import { RECEIPT_TO_FOLLOW_DAYS, type PriceListItem } from "@/lib/jobs/parts";
import { AddPartsForm, TradieParts } from "./PartsForms";
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
import { FAR_METRES } from "@/lib/jobs/arrival";
import { flagWords, type CheckFlag } from "@/lib/jobs/checks";
import { BeforeAfter, CostLines, Deadline, History, JobStatus, Panel, PhotoGrid } from "./JobParts";
import { ArrivedButton, LocatedButton } from "./TradieClient";

export type TradieJobFlash = { yours?: boolean; here?: boolean; quoted?: "wait" | "go" | null; done?: boolean; parts?: "wait" | "go" | null };

type Props = {
  view: JobView;
  now: Date;
  /** Set when the tradie opened this from a text, without signing in. */
  code?: string;
  flash?: TradieJobFlash;
  /** The owner's photos of the lockbox, switchboard and so on. */
  propertyPhotos: Upload[];
  /** The market's parts price list (DECISIONS.md, 2026-11-20). */
  priceList: PriceListItem[];
  /** The market's fixed hourly rate for this trade, or null when it has none (DECISIONS.md, 2026-11-20, third entry). */
  hourlyRateCents: number | null;
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
      // Paid ahead of the owner's card and waiting for HostFix's own Stripe balance (DECISIONS.md, 2026-11-21).
      return { text: `${amount} is owed to you and is being sent. It is a little late at our end, not yours: you do not need to do anything.`, tone: "info" };
    case "held":
      if (!view.job.confirmStatus || !["waiting", "staff_queue", "staff_held"].includes(view.job.confirmStatus)) {
        return view.parts.some((part) => part.status === "active" && (part.receiptStatus === "to_follow" || part.receiptStatus === "needed"))
          ? { text: `${amount} is waiting for the parts receipt. Add it under Parts below.`, tone: "info" }
          : { text: `${amount} is on hold while our team checks a parts receipt. We will be in touch.`, tone: "warn" };
      }
      return { text: `${amount} is waiting for the owner to confirm the job, because ${heldBecause(view)} If they have not answered within ${view.market.ownerConfirmHours} hours, it is paid if you are a trusted tradie, or our team looks at the photos.`, tone: "info" };
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

/** Why a payment is waiting, in plain words for the tradie. */
function heldBecause(view: JobView): string {
  const { job, market } = view;
  const words = (job.checkFlags as CheckFlag[]).map((flag) =>
    flagWords(flag, { arrivalM: job.arrivalDistanceM, finishM: job.finishDistanceM, minutes: job.minutesOnSite, minMinutes: market.minMinutesOnSite }).replace(/\.$/, "").toLowerCase(),
  );
  return words.length > 0 ? `${words.join("; ")}.` : "the app could not confirm everything.";
}

/** One job, as the tradie doing it sees it: where, what, the steps, and what they get. */
export function TradieJob({ view, now, code, flash = {}, propertyPhotos, priceList, hourlyRateCents }: Props) {
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
  const receiptsMissing = view.parts.some((part) => part.status === "active" && part.receiptStatus === "needed");

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
      {flash.parts === "wait" && (
        <Notice tone="warn" title="Parts sent to the owner to approve">
          Do not buy them until they say yes. We will text you their answer.
        </Notice>
      )}
      {flash.parts === "go" && (
        <Notice tone="good" title="Parts added">
          They are inside what the owner lets us add without asking, and the owner has been told.
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
            <ActionForm action={arrived} className="space-y-3">
              {which}
              <PhotoUploader kind="before" name="beforeUploadIds" label="Before photo: the problem as you found it (at least one)" offer={code} max={4} camera stamp />
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
          <p className="mt-3 text-sm text-muted">
            At the door, take a before photo, then tap &ldquo;I have arrived&rdquo; with your phone&rsquo;s location on. That is the time your arrival is measured against: the end of the window you chose, or the urgent deadline.
            Your location is checked against the property&rsquo;s pin at Arrived and again at Job done. If it is missing or over {FAR_METRES} m out, the tap still works, and your payment waits for the owner to confirm the job.
          </p>
        </Card>
      )}

      {job.status === "awaiting_approval" && pendingQuote && (
        <Notice tone="warn" title={pendingQuote.labourCents === 0 ? `Waiting for the owner's answer on the parts (${fmt(pendingQuote.ownerTotalCents)})` : `Waiting for the owner's answer on your quote of ${fmt(pendingQuote.ownerTotalCents)}`}>
          {pendingQuote.labourCents === 0 ? "Do not buy them yet." : "Do not start the extra work yet."} We have texted them and will text you the answer. If they say no, finish the job as it stands.
        </Notice>
      )}

      {job.status === "awaiting_approval" && job.notDescribedAt && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>Not the job described: you can leave with the call-out</SectionTitle>
          <p className="text-muted">
            The owner has your reason, photos and quote. If you cannot wait for their answer, finish here: the quote is withdrawn and you are paid the call-out once the owner
            has not objected within {market.notDescribedHours} hours (or our team decides it from your photos).
          </p>
          <ActionForm action={finishJob} className="mt-4 space-y-4">
            {which}
            <PhotoUploader kind="completion" label="A photo as you leave (at least one)" offer={code} max={4} camera stamp />
            <Area label="Anything to add?" name="note" rows={2} maxLength={1500} />
            <LocatedButton label="Leave with the call-out" busyLabel="Finishing..." icon="check" />
          </ActionForm>
        </Card>
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
              {!job.offMenu && (
                <p className="text-sm text-muted">
                  A quote here is for work <strong>beyond</strong> the job described. You still do the job described at its price. If what you found is not the job described at all, use &ldquo;Not the job described&rdquo; below.
                </p>
              )}
              <QuoteFields currency={job.currency} hourlyRateCents={hourlyRateCents} share={share} fmt={fmt} />
              <PhotoUploader kind="quote" name="quoteUploadIds" label="Photos of what you found (optional)" offer={code} max={4} />
              <p className="text-sm text-muted">
                Up to {fmt(limit)} of extra work (parts included) goes ahead straight away and the owner is told. Above that, the owner is asked first and you wait for their yes.
                {job.offMenu && !hasApprovedWork ? ` If the owner approves, the ${fmt(market.diagnosisFeeCents)} call-out comes off your quote for them, and you keep the call-out pay.` : ""}
              </p>
              <SubmitButton variant="secondary" pendingLabel="Sending...">
                Send quote
              </SubmitButton>
            </ActionForm>
          </Reveal>

          {!job.offMenu && !job.notDescribedAt && (
            <Reveal label="Not the job described?">
              <ActionForm action={sendNotDescribed} className="space-y-4">
                {which}
                <input type="hidden" name="notDescribed" value="yes" />
                <p className="text-sm text-muted">
                  Only when what you found is not the job the owner described (the dripping tap is a burst pipe in the wall). The menu price comes off and you are paid
                  the {fmt(market.diagnosisPayoutCents)} call-out once the owner approves your quote, or has not objected within {market.notDescribedHours} hours. If they say it was the job
                  they described, our team decides from your photos.
                </p>
                <Field label="Why, in one line" name="notDescribedReason" required maxLength={160} placeholder="The tap is fine. The pipe behind the wall has burst." />
                <PhotoUploader kind="quote" name="quoteUploadIds" label="Photos of what you found (at least one)" offer={code} max={4} camera />
                <Field label="What is the work?" name="quoteDescription" required maxLength={160} placeholder="Cut out and replace the burst section of pipe" />
                <QuoteFields currency={job.currency} hourlyRateCents={hourlyRateCents} share={share} fmt={fmt} />
                <SubmitButton variant="secondary" pendingLabel="Sending...">
                  Not the job described: send it
                </SubmitButton>
              </ActionForm>
            </Reveal>
          )}

          <AddPartsForm which={which} code={code} currency={job.currency} priceList={priceList} market={market} limitCents={limit} />

          <Card className="border-brand/30 sm:p-6">
            <SectionTitle>{job.offMenu && !hasApprovedWork ? "Finish (call-out only)" : "Finish the job"}</SectionTitle>
            <ActionForm action={finishJob} className="space-y-4">
              {which}
              <PhotoUploader kind="completion" label="After photos: the finished work (at least one)" offer={code} max={8} camera stamp />
              <Area label="What did you do?" name="note" rows={3} maxLength={1500} placeholder="Cleared the blockage in the kitchen waste. Ran the tap for five minutes, draining well." hint="The owner sees this with your before and after photos." />
              {receiptsMissing && (
                <Tick name="receiptsToFollow" label="I will send the receipt later" hint={`Your payment for this job waits for it. No receipt within ${RECEIPT_TO_FOLLOW_DAYS} days and the part is refunded to the owner out of your payment.`} />
              )}
              <LocatedButton label="Job done" busyLabel="Finishing..." icon="check" />
            </ActionForm>
          </Card>
        </>
      )}

      {(job.status === "on_site" || job.status === "awaiting_approval") && (
        <Reveal label="Could not get in?" tone="alert">
          <ActionForm action={noAccess} className="space-y-4">
            {which}
            <Area label="What happened?" name="noAccessNote" rows={3} required maxLength={1000} placeholder="Lockbox code did not work and nobody answered the door." />
            <PhotoUploader kind="completion" name="noAccessUploadIds" label="A photo showing you were at the property" offer={code} max={3} camera stamp />
            <p className="text-sm text-muted">Try calling the contact below first. If you still cannot get in, you are paid the call-out and the owner is charged it.</p>
            <LocatedButton label="I could not get in" busyLabel="Sending..." variant="danger" />
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
        {open && (
          <div className="mt-4 space-y-3">
            <GuestNote job={job} />
            <HazardNote hazards={property.hazards} />
          </div>
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

      {(open || job.status === "completed") && (
        <Reveal label="Found a hazard at this property?">
          <ActionForm action={reportHazardAction} className="space-y-3">
            {which}
            <Area
              label="What should the next tradie know to stay safe?"
              name="hazard"
              rows={3}
              required
              maxLength={500}
              placeholder="Rotten boards on the back deck by the steps. Roof is steep: harness needed."
              hint="It is saved to the property, shown to every tradie before they accept a job there, and the owner is texted."
            />
            <SubmitButton variant="secondary" pendingLabel="Saving...">
              Save the hazard
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}

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

      {view.parts.some((part) => part.status !== "void" || part.receiptStatus === "refunded") && (
        <Panel title="Parts">
          <TradieParts which={which} code={code} currency={job.currency} parts={view.parts} canAddReceipts={job.status === "on_site" || job.status === "completed"} />
        </Panel>
      )}

      {job.status !== "cancelled" && view.lines.length > 0 && (
        <Panel title="What you get">
          <CostLines lines={view.lines} currency={job.currency} side="tradie" totalLabel="You get" />
          <p className="mt-3 text-sm text-muted">{payTiming(market).line} Parts on the price list pay the list price less 3%; other parts pay what you paid plus 17%. Urgent and after-hours amounts are your share, after the platform fee. The urgent share is paid only if you tap Arrived by the urgent deadline, and the after-hours share only if you arrive outside working hours.</p>
        </Panel>
      )}

      {job.status === "completed" && (view.workPhotos.length > 0 || view.beforePhotos.length > 0) && (
        <Panel title="Your photos">
          {job.completionNote && <p className="mb-3 whitespace-pre-line text-ink">{job.completionNote}</p>}
          <BeforeAfter before={view.beforePhotos} after={view.afterPhotos} query={photoQuery} timeZone={market.timezone} />
          {view.workPhotos.some((photo) => photo.kind !== "completion") && (
            <div className="mt-3">
              <PhotoGrid photos={view.workPhotos.filter((photo) => photo.kind !== "completion")} query={photoQuery} />
            </div>
          )}
        </Panel>
      )}

      <History view={view} />
    </div>
  );
}

/**
 * The price of the work: hours at the market's fixed rate up to NZ$1,000, or
 * the tradie's own price above that (DECISIONS.md, 2026-11-20, third entry).
 */
function QuoteFields({ currency, hourlyRateCents, share, fmt }: { currency: string; hourlyRateCents: number | null; share: number; fmt: (cents: number) => string }) {
  const visit = "If you need to come back, include the extra visit in your quote. There is no second call-out on the same job.";
  if (hourlyRateCents === null) {
    return <Field label={`Your price for the work (${currency})`} name="labour" inputMode="decimal" maxLength={10} placeholder="180" hint={`You keep ${share}% of this. Parts go in "Add parts", below. ${visit}`} />;
  }
  return (
    <>
      <Field
        label="Hours of work"
        name="hours"
        inputMode="decimal"
        maxLength={5}
        placeholder="1.5"
        hint={`In quarter hours (0.25, 0.5, 0.75...). At the fixed ${fmt(hourlyRateCents)} an hour, the owner's price; you keep ${share}%. Parts go in "Add parts". ${visit}`}
      />
      <Field
        label={`Over ${fmt(HOURLY_LIMIT_CENTS)}? Your price for the whole job instead (${currency})`}
        name="labour"
        inputMode="decimal"
        maxLength={10}
        hint={`Only for work over ${fmt(HOURLY_LIMIT_CENTS)}. Leave hours empty.`}
      />
    </>
  );
}
