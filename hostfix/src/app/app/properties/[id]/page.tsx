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
import { tierLine, tierPriceLabel } from "@/lib/markets/display";
import { inPreLaunch, preLaunchWords } from "@/lib/markets/stage";
import { getMarket, listTiers } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { getBilling, unusedDeposit } from "@/lib/owners/service";
import { paymentsProblem } from "@/lib/payments";
import { membershipLabel } from "@/lib/properties/display";
import { getPortfolio, openPortfolio } from "@/lib/properties/portfolio";
import { addressLine, getProperty } from "@/lib/properties/service";
import { qrSvg } from "@/lib/qr";
import { mapTiles } from "@/lib/maps/tiles";
import { PinCard } from "@/components/properties/PinCard";
import { AreaPicker } from "@/components/properties/AreaPicker";
import { listGroups, listTeam } from "@/lib/team/service";
import { formatDate } from "@/lib/time";
import { BringYourOwnTradie } from "@/components/jobs/OwnClients";
import { invitesForProperty, pairsForProperty } from "@/lib/clients/own-clients";

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

  const allTiers = (await listTiers(db, market.slug)).filter((tier) => tier.active || tier.id === property.tierId);
  const tier = allTiers.find((candidate) => candidate.id === property.tierId) ?? null;
  // Only per-property memberships are chosen here. Portfolio is chosen once for the account, on the Billing page.
  const tiers = allTiers.filter((candidate) => candidate.billingBasis === "per_property");
  // The account's Portfolio, if the owner has one in this area: this property's cover comes from it.
  const portfolio = property.portfolioId ? await getPortfolio(db, viewer.ownerId, property.portfolioId) : await openPortfolio(db, viewer.ownerId, market.slug);
  const onPortfolio = Boolean(property.portfolioId);
  const billing = await getBilling(db, viewer.ownerId, market.country);
  // Free to join (DECISIONS.md, 2026-11-17): when every membership on offer here is free, the start step only asks for a card.
  const allFree = tiers.filter((candidate) => candidate.active).every((candidate) => candidate.monthlyPriceCents === 0);
  const deposit = property.status === "setup" || property.status === "cancelled" ? await unusedDeposit(db, viewer.ownerId, market.currency) : null;
  const jobs = await listJobsForOwner(db, viewer.ownerId, { propertyId: property.id, limit: 6 });
  const photos = await listUploads(db, { propertyId: property.id, kinds: ["property"] });
  const member = property.status === "active" || property.status === "past_due";
  // Pre-launch (DECISIONS.md, 2026-11-27, second entry): the property is set up, and nothing that needs a card or a
  // tradie is open yet. No card form, no membership button: a calm "Opens soon" instead.
  const waiting = inPreLaunch(market) && !member;
  const membership = membershipLabel(property, market.timezone, waiting);
  const teamUrl = `${baseUrl()}/r/${property.teamToken}`;
  // A cleaner is a person, not a link (DECISIONS.md, 2026-11-18): who on the owner's team has this house on their list.
  const [team, groups] = await Promise.all([listTeam(db, viewer.ownerId), listGroups(db, viewer.ownerId)]);
  const teamSize = team.length;
  const groupsHere = groups.filter((group) => group.propertyIds.includes(property.id)).map((group) => group.id);
  const onTeam = team.filter((member) => member.propertyIds.includes(property.id) || member.groupIds.some((id) => groupsHere.includes(id)));
  const guestUrl = `${baseUrl()}/r/${property.guestToken}`;
  const qr = member || waiting ? await qrSvg(guestUrl, { dark: brand.colours.brandDark }) : "";
  const money = (cents: number) => formatMoney(cents, market.currency);
  const cardLine = billing?.cardLast4 ? `${(billing.cardBrand ?? "Card").replace(/^./, (letter) => letter.toUpperCase())} ending ${billing.cardLast4}` : null;
  const notReady = paymentsProblem(market.country);

  return (
    <div className="space-y-5">
      <PageTitle title={property.name} back={{ href: "/app/properties", label: "Properties" }} intro={addressLine(property)} action={<Chip tone={membership.tone}>{membership.label}</Chip>} />

      {waiting && (
        <Notice tone={query.added ? "good" : "info"} title={query.added ? "You're set up" : preLaunchWords.title(market.name)}>
          {query.added ? `${preLaunchWords.title(market.name)}. ` : ""}
          {preLaunchWords.body}
          {portfolio ? " Your Portfolio retainer starts from the Billing page then." : ""}
        </Notice>
      )}
      {query.added && property.status === "setup" && !waiting && (
        <Notice tone="good" title="Saved. One step left">
          {portfolio
            ? "This property is on your Portfolio. Start the retainer on the Billing page and it is covered."
            : allFree
              ? "Add a card below and this property is covered. Nothing is charged until a job is done."
              : "Start the membership below and this property is covered."}
        </Notice>
      )}
      {jobs.some((job) => job.status === "completed" && job.completedAt && now().getTime() - job.completedAt.getTime() < 14 * 24 * 3_600_000) && property.accessNotes.trim() !== "" && (
        <Notice tone="info" title="A tradie has been in recently">
          If you gave them a door or lockbox code, you may want to change it now. Changing codes is up to you; update the access notes below when you do.
        </Notice>
      )}
      {query.pinned && property.pinConfirmedAt && (
        <Notice tone="good" title="Pin saved">
          Tradies&rsquo; Arrived and Job done taps are checked against it. You can move it any time under &ldquo;The map pin for this house&rdquo;.
        </Notice>
      )}
      {query.member && member && (
        <Notice tone="good" title="You are covered">
          Next: print the QR card for the property, and add your cleaner to your team. Both are just below.
        </Notice>
      )}
      {query.cancelled && property.portfolioId && (
        <Notice tone="good" title="Taken off your Portfolio">
          No tradies can be sent here now. Your retainer follows the new number of properties from the next monthly payment.
        </Notice>
      )}
      {query.cancelled && !property.portfolioId && (
        <Notice tone="good" title="Membership cancelled">
          {property.currentPeriodEnd && property.status === "active"
            ? `The property stays covered until ${formatDate(property.currentPeriodEnd, market.timezone)}. No further payments will be taken.`
            : "No further payments will be taken."}
        </Notice>
      )}
      {query.pending && !member && (
        <Notice tone="info" title="We are confirming your payment">
          This usually takes under a minute. Refresh this page shortly.
        </Notice>
      )}

      {/* THE MAP PIN: checked by the owner first, then kept one tap away (DECISIONS.md, 2026-11-19) */}
      {!property.pinConfirmedAt && property.status !== "cancelled" && <PinCard property={property} centre={market.mapCentre} tiles={mapTiles()} />}

      {/* ON A PORTFOLIO, NOT COVERED: the retainer covers it, nothing to pay here */}
      {!member && !waiting && portfolio && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>On your Portfolio</SectionTitle>
          {portfolio.status === "active" || portfolio.status === "past_due" ? (
            <ActionForm action={beginMembership} className="space-y-4">
              <input type="hidden" name="propertyId" value={property.id} />
              <p className="text-muted">
                {onPortfolio && property.status === "cancelled" ? "This property was taken off your Portfolio." : "Add this property to your Portfolio."} It is covered from today, with nothing to pay for it on its own. Your retainer
                follows the new number of properties from the next monthly payment.
              </p>
              <SubmitButton pendingLabel="Adding..." className="w-full">
                {onPortfolio && property.status === "cancelled" ? "Put it back on my Portfolio" : "Add it to my Portfolio"}
              </SubmitButton>
            </ActionForm>
          ) : (
            <div className="space-y-3">
              <p className="text-muted">There is nothing to pay for this property on its own. It is covered once you start your Portfolio retainer.</p>
              <Link href="/app/billing" className={buttonClass}>
                Go to Billing
              </Link>
            </div>
          )}
        </Card>
      )}

      {/* NOT A MEMBER YET: starting the membership comes first */}
      {!member && !waiting && !portfolio && (
        <Card className="border-brand/30 sm:p-6">
          <SectionTitle>{allFree ? (property.status === "cancelled" ? "Cover this property again" : "Cover this property") : property.status === "cancelled" ? "Start the membership again" : "Start the membership"}</SectionTitle>
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
                  right: tierPriceLabel(candidate, market.currency),
                }))}
              />
              {deposit && !allFree && (
                <p className="rounded-xl bg-done-soft px-4 py-3 text-sm font-semibold text-done">
                  Your {money(deposit.amountCents)} founding member deposit comes off the first month.
                </p>
              )}
              {allFree ? (
                <p className="text-sm text-muted">
                  {cardLine
                    ? `Free to join. Nothing is charged today. Your ${cardLine} is charged the fixed price of each job, when it is done. Leave any time.`
                    : "Free to join. You add a card on the next page and nothing is charged today. The card is charged the fixed price of each job, when it is done. Leave any time."}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {cardLine
                    ? `Charged to your ${cardLine} today, then monthly. Cancel any time and stay covered until the month you paid for ends.`
                    : "You add your card on the next page. Charged today, then monthly. Cancel any time and stay covered until the month you paid for ends."}
                </p>
              )}
              <SubmitButton pendingLabel="Starting..." className="w-full">
                {allFree ? (cardLine ? "Cover this property" : "Add a card") : cardLine ? "Start membership" : "Continue to payment"}
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      {/* REPORT LINKS: for a member, and in pre-launch as set-up that starts working the day bookings open */}
      {waiting && (
        <div>
          <SectionTitle>Get ready for day one</SectionTitle>
          <p className="text-muted">
            Print the QR card and add your cleaner now. Until bookings open in {market.name}, their pages say {brand.name} isn&rsquo;t open there yet.
          </p>
        </div>
      )}
      {(member || waiting) && (
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

          {query.own === "1" && <Notice tone="good" title="Done">Your tradie is now your first choice here, booked and paid through {brand.name}.</Notice>}
          <BringYourOwnTradie propertyId={property.id} pairs={await pairsForProperty(db, property.id)} invites={await invitesForProperty(db, viewer.ownerId, property.id)} timeZone={market?.timezone ?? "Pacific/Auckland"} />

          <Card>
            <SectionTitle>For your cleaner or co-host</SectionTitle>
            {onTeam.length > 0 ? (
              <p className="text-muted">
                {onTeam.map((member) => member.name).join(", ")} {onTeam.length === 1 ? "reports" : "report"} from {onTeam.length === 1 ? "their" : "their own"} link. Each report is signed with their name.
              </p>
            ) : (
              <p className="text-muted">
                Add them to your team by name and mobile. They get one link for every house you tick, and every report is signed with their name.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/app/team" className={buttonClass}>
                {teamSize > 0 ? "Your team" : "Add a cleaner"}
              </Link>
            </div>
            {/* The older link for this one property keeps working for anyone who has it. It is only offered until the owner has a team. */}
            {teamSize === 0 && (
              <div className="mt-3">
                <Reveal label="Or share this property's link">
                  <div className="space-y-3">
                    <p className="text-muted">
                      Anyone with this link can report a problem here. <span className="text-ink">A tradie is sent straight away, without asking you first.</span> Reports are signed with whatever name they type.
                    </p>
                    <p className="rounded-xl bg-tint px-3 py-2 font-mono text-sm break-all text-ink">{teamUrl}</p>
                    <div className="flex flex-wrap gap-2">
                      <ShareButton className={secondaryButtonClass} label="Share the link" url={teamUrl} text={`Use this link to report anything that needs fixing at ${property.name}. A tradie is sent straight away:`} />
                      <CopyButton text={teamUrl} label="Copy the link" />
                    </div>
                  </div>
                </Reveal>
              </div>
            )}
            <div className="mt-3">
              <Reveal label="Make a new team link for this property">
                <ActionForm action={replaceLink} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="which" value="team" />
                  <p className="text-muted">Use this if someone who should not still has this property&apos;s own link. The old link stops working. Your team&apos;s own links are not affected.</p>
                  <SubmitButton variant="danger" pendingLabel="Replacing...">
                    Replace this property&apos;s link
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

      {/* MEMBERSHIP */}
      {member && (
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
              {
                label: "Plan",
                value: onPortfolio
                  ? `${tier?.name ?? "Portfolio"}: covered by your one monthly retainer`
                  : tier ? `${tier.name}: ${tierPriceLabel(tier, market.currency)}` : "None",
              },
              ...(property.subscriptionId || onPortfolio
                ? [{
                    label: property.cancelAtPeriodEnd ? "Covered until" : "Next payment",
                    value: property.currentPeriodEnd ? formatDate(property.currentPeriodEnd, market.timezone) : "Soon",
                  }]
                : [{ label: "You pay", value: "The fixed price of each job, when it is done" }]),
              ...(cardLine ? [{ label: "Card", value: cardLine }] : []),
            ]}
          />
          {tier && !onPortfolio && <p className="mt-2 text-sm text-muted">{tierLine(tier, market)}</p>}
          {onPortfolio && (
            <p className="mt-2 text-sm text-muted">
              The retainer and the band you are on are on the{" "}
              <Link href="/app/billing" className="font-semibold text-brand underline underline-offset-2">
                Billing page
              </Link>
              .
            </p>
          )}
          {onPortfolio && !property.cancelAtPeriodEnd && (
            <div className="mt-4">
              <Reveal label="Take off my Portfolio" tone="alert">
                <ActionForm action={endMembership} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <p className="text-muted">
                    It stops being covered now: no tradies can be sent here and the report links stop working. Your retainer follows the new number of properties from the next monthly payment. There is no part-month refund.
                  </p>
                  <SubmitButton variant="danger" pendingLabel="Taking it off...">
                    Yes, take it off my Portfolio
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          )}
          {!onPortfolio && !property.cancelAtPeriodEnd && (
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
                        right: tierPriceLabel(candidate, market.currency),
                      }))}
                    />
                    <p className="text-sm text-muted">
                      {property.subscriptionId
                        ? "The new price starts with your next monthly payment."
                        : "A paid plan starts today on the card you have on file, then monthly."}
                    </p>
                    <SubmitButton variant="secondary" pendingLabel="Changing...">
                      Change plan
                    </SubmitButton>
                  </ActionForm>
                </Reveal>
              )}
              <Reveal label="Cancel membership" tone="alert">
                <ActionForm action={endMembership} className="space-y-3">
                  <input type="hidden" name="propertyId" value={property.id} />
                  {property.subscriptionId ? (
                    <p className="text-muted">
                      The property stays covered until {property.currentPeriodEnd ? formatDate(property.currentPeriodEnd, market.timezone) : "the end of the month you paid for"}. After that no tradies can be sent here and the report links
                      stop working. No further payments are taken.
                    </p>
                  ) : (
                    <p className="text-muted">It stops being covered now: no tradies can be sent here and the report links stop working. There is nothing to pay to leave.</p>
                  )}
                  <SubmitButton variant="danger" pendingLabel="Cancelling...">
                    Yes, cancel the membership
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          )}
        </Card>
      )}

      {/* DETAILS */}
      {property.pinConfirmedAt && <PinCard property={property} centre={market.mapCentre} tiles={mapTiles()} />}

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
          <AreaPicker areas={market.areas} defaultValue={property.area} />
          <Area label="How does a tradie get in?" name="accessNotes" rows={4} maxLength={1500} defaultValue={property.accessNotes} hint="Only shown to the tradie who takes a job, never before. If the tradie can't get in, the call-out is charged, so keep it right. Changing a code after a job is up to you." />
          <Area label="Anything a tradie should know to stay safe?" name="hazards" rows={3} maxLength={3000} defaultValue={property.hazards} placeholder="Steep drive, roof access, asbestos in an older home, a dog, a fragile deck..." hint="Shown to tradies before they accept, so they can come prepared. Under health and safety law we share the duty to warn them of hazards you know of. Hazards tradies find are added here too." />
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
