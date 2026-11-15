import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPropertyPhotos, beginMembership, changeCard, endMembership, removePropertyPhoto, replaceLink, saveProperty, switchTier,
} from "@/app/actions/owner";
import { ActionForm, Area, Field, RadioCards, Tick } from "@/components/forms/ActionForm";
import { PhotoUploader } from "@/components/forms/PhotoUploader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { buttonClass, secondaryButtonClass } from "@/components/forms/styles";
import { JobRow } from "@/components/jobs/JobRow";
import { Card, Chip, Facts, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { CopyButton, ShareButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { brand } from "@config/brand";
import { requireOwner } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { listUploads } from "@/lib/files/uploads";
import { centsToDollars } from "@/lib/forms";
import { listJobsForOwner } from "@/lib/jobs/store";
import { tierLine } from "@/lib/markets/display";
import { getMarket, listTiers } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { getBilling, unusedDeposit } from "@/lib/owners/service";
import { paymentsProblem } from "@/lib/payments";
import { membershipLabel } from "@/lib/properties/display";
import { addressLine, getProperty } from "@/lib/properties/service";
import { qrSvg } from "@/lib/qr";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Property" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PropertyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const viewer = await requireOwner(`/app/properties/${id}`);
  const query = await searchParams;
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, id);
  if (!property) notFound();
  const market = await getMarket(db, property.market);
  if (!market) notFound();

  const tiers = (await listTiers(db, market.slug)).filter((tier) => tier.active || tier.id === property.tierId);
  const tier = tiers.find((candidate) => candidate.id === property.tierId) ?? null;
  const billing = await getBilling(db, viewer.ownerId, market.country);
  const deposit = property.status === "setup" || property.status === "cancelled" ? await unusedDeposit(db, viewer.ownerId, market.currency) : null;
  const jobs = await listJobsForOwner(db, viewer.ownerId, { propertyId: property.id, limit: 6 });
  const photos = await listUploads(db, { propertyId: property.id, kinds: ["property"] });
  const membership = membershipLabel(property, market.timezone);
  const member = property.status === "active" || property.status === "past_due";
  const teamUrl = `${baseUrl()}/r/${property.teamToken}`;
  const guestUrl = `${baseUrl()}/r/${property.guestToken}`;
  const qr = member ? await qrSvg(guestUrl, { dark: brand.colours.brandDark }) : "";
  const money = (cents: number) => formatMoney(cents, market.currency);
  const cardLine = billing?.cardLast4 ? `${(billing.cardBrand ?? "Card").replace(/^./, (letter) => letter.toUpperCase())} ending ${billing.cardLast4}` : null;
  const notReady = paymentsProblem(market.country);

  return (
    <div className="space-y-5">
      <PageTitle title={property.name} back={{ href: "/app/properties", label: "Properties" }} intro={addressLine(property)} action={<Chip tone={membership.tone}>{membership.label}</Chip>} />

      {query.added && property.status === "setup" && (
        <Notice tone="good" title="Saved. One step left">
          Start the membership below and this property is covered.
        </Notice>
      )}
      {query.member && member && (
        <Notice tone="good" title="You are covered">
          Next: print the QR card for the property, and send the team link to your cleaner. Both are just below.
        </Notice>
      )}
      {query.pending && !member && (
        <Notice tone="info" title="We are confirming your payment">
          This usually takes under a minute. Refresh this page shortly.
        </Notice>
      )}

      {/* MEMBERSHIP */}
      {!member ? (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>{property.status === "cancelled" ? "Start the membership again" : "Start the membership"}</SectionTitle>
          {notReady ? (
            <Notice tone="warn" title="Card payments are not switched on yet">
              Memberships cannot start until they are. Nothing has been charged.
            </Notice>
          ) : (
            <ActionForm action={beginMembership} className="space-y-4">
              <input type="hidden" name="propertyId" value={property.id} />
              <RadioCards
                name="tierId"
                legend="Membership"
                defaultValue={property.tierId ?? tiers[0]?.id}
                options={tiers.filter((candidate) => candidate.active).map((candidate) => ({
                  value: candidate.id,
                  title: candidate.name,
                  detail: tierLine(candidate, market),
                  right: `${money(candidate.monthlyPriceCents)} a month`,
                }))}
              />
              {deposit && (
                <p className="rounded-xl bg-done-soft px-4 py-3 text-sm font-semibold text-done">
                  Your {money(deposit.amountCents)} founding member deposit comes off the first month.
                </p>
              )}
              <p className="text-sm text-muted">
                {cardLine
                  ? `Charged to your ${cardLine} today, then monthly. Cancel any time and stay covered until the month you paid for ends.`
                  : "You add your card on the next page. Charged today, then monthly. Cancel any time and stay covered until the month you paid for ends."}
              </p>
              <SubmitButton pendingLabel="Starting..." className="w-full">
                {cardLine ? "Start membership" : "Continue to payment"}
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      ) : (
        <Card>
          <SectionTitle>Membership</SectionTitle>
          {property.status === "past_due" && (
            <div className="mb-4 space-y-3">
              <Notice tone="error" title="Your last payment did not go through">
                Tradies cannot be sent here until the card is fixed.
              </Notice>
              <ActionForm action={changeCard}>
                <input type="hidden" name="country" value={market.country} />
                <SubmitButton pendingLabel="Opening...">Update my card</SubmitButton>
              </ActionForm>
            </div>
          )}
          <Facts
            rows={[
              { label: "Plan", value: tier ? `${tier.name}, ${money(tier.monthlyPriceCents)} a month` : "None" },
              ...(tier ? [{ label: "What you get", value: <span className="block max-w-[16rem] text-sm font-normal text-muted">{tierLine(tier, market)}</span> }] : []),
              {
                label: property.cancelAtPeriodEnd ? "Covered until" : "Next payment",
                value: property.currentPeriodEnd ? formatDate(property.currentPeriodEnd, market.timezone) : "Soon",
              },
              ...(cardLine ? [{ label: "Card", value: cardLine }] : []),
            ]}
          />
          {!property.cancelAtPeriodEnd && (
            <div className="mt-4 space-y-2.5">
              {tiers.filter((candidate) => candidate.active && candidate.id !== property.tierId).length > 0 && (
                <Reveal label="Change plan">
                  <ActionForm action={switchTier} className="space-y-4">
                    <input type="hidden" name="propertyId" value={property.id} />
                    <RadioCards
                      name="tierId"
                      legend="Move to"
                      options={tiers.filter((candidate) => candidate.active && candidate.id !== property.tierId).map((candidate) => ({
                        value: candidate.id,
                        title: candidate.name,
                        detail: tierLine(candidate, market),
                        right: `${money(candidate.monthlyPriceCents)} a month`,
                      }))}
                    />
                    <p className="text-sm text-muted">The new price starts with your next monthly payment.</p>
                    <SubmitButton variant="secondary" pendingLabel="Changing...">
                      Change plan
                    </SubmitButton>
                  </ActionForm>
                </Reveal>
              )}
              <Reveal label="Cancel membership" tone="alert">
                <ActionForm action={endMembership} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <p className="text-muted">
                    The property stays covered until {property.currentPeriodEnd ? formatDate(property.currentPeriodEnd, market.timezone) : "the end of the month you paid for"}. After that no tradies can be sent here and the report links
                    stop working. No further payments are taken.
                  </p>
                  <SubmitButton variant="danger" pendingLabel="Cancelling...">
                    Yes, cancel the membership
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          )}
        </Card>
      )}

      {/* REPORT LINKS */}
      {member && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <SectionTitle>For guests: the QR card</SectionTitle>
            <div className="flex items-start gap-4">
              <div className="h-28 w-28 shrink-0 rounded-xl border border-line bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="text-muted">
                Print this and leave it in the property. A guest scans it and tells us what is wrong.{" "}
                <span className="text-ink">{property.guestAutoDispatch ? "A tradie is sent straight away." : "You get a text to say yes before anyone is sent."}</span>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/app/properties/${property.id}/card`} className={buttonClass}>
                Print the QR card
              </Link>
              <CopyButton text={guestUrl} label="Copy the link" />
            </div>
            <div className="mt-3">
              <Reveal label="Make a new guest link">
                <ActionForm action={replaceLink} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="which" value="guest" />
                  <p className="text-muted">Use this if the link has been shared where it should not be. The printed QR card stops working and needs printing again.</p>
                  <SubmitButton variant="danger" pendingLabel="Replacing...">
                    Replace the guest link
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          </Card>

          <Card>
            <SectionTitle>For your cleaner or co-host</SectionTitle>
            <p className="text-muted">
              Send them this link once. They save it and report problems from it. <span className="text-ink">A tradie is sent straight away, without asking you first.</span> You get a text each time.
            </p>
            <p className="mt-3 rounded-xl bg-tint px-3 py-2 font-mono text-sm break-all text-ink">{teamUrl}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ShareButton className={buttonClass} label="Send to my cleaner" url={teamUrl} text={`Use this link to report anything that needs fixing at ${property.name}. A tradie is sent straight away:`} />
              <CopyButton text={teamUrl} label="Copy the link" />
            </div>
            <div className="mt-3">
              <Reveal label="Make a new team link">
                <ActionForm action={replaceLink} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="which" value="team" />
                  <p className="text-muted">Use this when a cleaner leaves. The old link stops working, so send the new one to whoever still needs it.</p>
                  <SubmitButton variant="danger" pendingLabel="Replacing...">
                    Replace the team link
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          </Card>
        </div>
      )}

      {/* JOBS */}
      {member && (
        <section>
          <SectionTitle
            action={
              jobs.length > 0 ? (
                <Link href={`/app/jobs?property=${property.id}`} className="text-sm font-semibold text-brand underline underline-offset-2">
                  All jobs here
                </Link>
              ) : undefined
            }
          >
            Jobs at this property
          </SectionTitle>
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} href={`/app/jobs/${job.id}`} audience="owner" now={now()} timeZone={market.timezone} />
            ))}
            {property.status === "active" && (
              <Link href={`/app/jobs/new?property=${property.id}`} className={`${secondaryButtonClass} w-full`}>
                <Icon name="plus" size={18} /> Report a problem here
              </Link>
            )}
          </div>
        </section>
      )}

      {/* DETAILS */}
      <Reveal label="Address, access notes and guest reports" open={Boolean(query.edit)}>
        <ActionForm action={saveProperty} className="space-y-4">
          <input type="hidden" name="propertyId" value={property.id} />
          <Field label="Name" name="name" required maxLength={80} defaultValue={property.name} />
          <Field label="Street address" name="addressLine1" required maxLength={120} defaultValue={property.addressLine1} />
          <Field label="Unit, floor or building (optional)" name="addressLine2" maxLength={120} defaultValue={property.addressLine2 ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Suburb or town" name="suburb" required maxLength={60} defaultValue={property.suburb} />
            <Field label="Postcode" name="postcode" maxLength={10} defaultValue={property.postcode} />
          </div>
          <Area label="How does a tradie get in?" name="accessNotes" rows={4} maxLength={1500} defaultValue={property.accessNotes} hint="Only shown to the tradie who takes a job, never before." />
          <Tick
            name="guestAutoDispatch"
            label="Send a tradie for guest reports without asking me first"
            hint="Leave this off and we text you for a yes before anyone is sent for something a guest reports."
            defaultChecked={property.guestAutoDispatch}
          />
          <Field
            label={`Extra work a tradie can do without asking you (${market.currency})`}
            name="spendLimit"
            inputMode="decimal"
            maxLength={10}
            defaultValue={property.spendLimitCents === null ? "" : centsToDollars(property.spendLimitCents)}
            placeholder={centsToDollars(market.approvalThresholdCents)}
            hint={`When a tradie finds more to do, a quote up to this amount goes ahead and you are told. Above it we wait for your yes. Leave empty for the standard ${money(market.approvalThresholdCents)}.`}
          />
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save changes
          </SubmitButton>
        </ActionForm>
      </Reveal>

      {/* PHOTOS */}
      <Reveal label={`Photos for tradies${photos.length > 0 ? ` (${photos.length})` : ""}`}>
        <p className="mb-3 text-muted">The lockbox, the switchboard, the water shut-off, where to park. Shown only to the tradie who takes a job here.</p>
        {photos.length > 0 && (
          <ul className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="space-y-1.5">
                <a href={`/files/${photo.id}`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-line bg-tint">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private photo served by this site */}
                  <img src={`/files/${photo.id}`} alt="Property photo. Opens larger in a new tab." loading="lazy" className="h-full w-full object-cover" />
                </a>
                <ActionForm action={removePropertyPhoto} className="">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="uploadId" value={photo.id} />
                  <SubmitButton variant="small" pendingLabel="..." className="w-full">
                    Remove
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addPropertyPhotos} className="space-y-3">
          <input type="hidden" name="propertyId" value={property.id} />
          <PhotoUploader key={photos.length} kind="property" label="Add photos" max={8} />
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save photos
          </SubmitButton>
        </ActionForm>
      </Reveal>
    </div>
  );
}
