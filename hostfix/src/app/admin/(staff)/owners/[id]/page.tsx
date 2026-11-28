import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { staffGoodwill, staffOwnerAccess } from "@/app/actions/staff";
import { setPortfolioRetainer } from "@/app/actions/staff-admin";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { smallButtonClass } from "@/components/forms/styles";
import { JobRow } from "@/components/jobs/JobRow";
import { PropertyAreaForm } from "@/components/properties/PropertyAreaForm";
import { Card, Chip, Facts, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listJobsForOwner } from "@/lib/jobs/store";
import { inPreLaunch } from "@/lib/markets/stage";
import { listMarkets, listTiers } from "@/lib/markets/store";
import { tierPriceLabel } from "@/lib/markets/display";
import { formatMoney } from "@/lib/money";
import { getOwner, listCredits, ownerAccessRemoved } from "@/lib/owners/service";
import { displayPhone } from "@/lib/phone";
import { membershipLabel } from "@/lib/properties/display";
import { centsToDollars } from "@/lib/forms";
import { bandFor } from "@/lib/markets/bands";
import { countPortfolioProperties, listPortfolios } from "@/lib/properties/portfolio";
import { addressLine, listProperties } from "@/lib/properties/service";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Owner" };

const CREDIT_WORDS: Record<string, string> = { missed_window: "Missed time (given before 18 Nov 2026, when these stopped)", goodwill: "Goodwill", founding_deposit: "Founding deposit" };

export default async function StaffOwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const db = await getDb();
  const owner = await getOwner(db, id);
  if (!owner) notFound();
  const properties = await listProperties(db, owner.id);
  const jobs = await listJobsForOwner(db, owner.id, { limit: 30 });
  const credits = await listCredits(db, owner.id);
  const closed = await ownerAccessRemoved(db, owner.id);
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));
  const tiers = new Map((await listTiers(db)).map((tier) => [tier.id, tier]));
  const zone = (slug: string) => markets.get(slug)?.timezone ?? "Pacific/Auckland";
  const at = now();
  const portfolios = [];
  for (const portfolio of await listPortfolios(db, owner.id)) {
    if (portfolio.status !== "cancelled") portfolios.push({ portfolio, count: await countPortfolioProperties(db, portfolio.id) });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title={owner.name} back={{ href: "/admin/owners", label: "Owners" }} />

      <Card>
        <Facts
          rows={[
            {
              label: "Mobile",
              value: owner.phone ? (
                <a href={`tel:${owner.phone}`} className="text-brand underline underline-offset-2">
                  {displayPhone(owner.phone)}
                </a>
              ) : (
                "None"
              ),
            },
            { label: "Email", value: owner.email ?? "None" },
            ...(owner.homeLocation ? [{ label: "Lives in", value: owner.homeLocation }] : []),
            { label: "Joined", value: formatDate(owner.createdAt, zone(properties[0]?.market ?? "")) },
          ]}
        />
      </Card>

      {portfolios.map(({ portfolio, count }) => {
        const market = markets.get(portfolio.market);
        const tier = tiers.get(portfolio.tierId);
        const money = (cents: number) => formatMoney(cents, market?.currency ?? "NZD");
        const band = tier ? bandFor(tier, portfolio.propertyCountBilled) : null;
        return (
          <Card key={portfolio.id}>
            <SectionTitle>Portfolio{market ? `, ${market.name}` : ""}</SectionTitle>
            <Facts
              rows={[
                { label: "Status", value: portfolio.status === "setup" ? "Chosen, retainer not started" : portfolio.status === "past_due" ? "Card problem" : portfolio.cancelAtPeriodEnd ? "Ending" : "Paying" },
                { label: "Properties on it", value: String(count) },
                {
                  label: "Retainer from the next payment",
                  value: portfolio.bandCents === null
                    ? "Not started"
                    : `${money(portfolio.bandCents)} a month${portfolio.agreedCents !== null ? " (agreed price)" : band ? ` (${band.label})` : ""}, worked out from ${portfolio.propertyCountBilled} properties`,
                },
                ...(portfolio.currentPeriodEnd ? [{ label: portfolio.cancelAtPeriodEnd ? "Ends" : "Next payment", value: formatDate(portfolio.currentPeriodEnd, zone(portfolio.market)) }] : []),
                ...(portfolio.memberSince ? [{ label: "Paying since", value: formatDate(portfolio.memberSince, zone(portfolio.market)) }] : []),
              ]}
            />
            <div className="mt-3">
              <Reveal label="Set an agreed retainer (admin)">
                <ActionForm action={setPortfolioRetainer} className="space-y-3">
                  <input type="hidden" name="portfolioId" value={portfolio.id} />
                  <Field
                    label={`Agreed retainer each month (${market?.currency ?? "NZD"})`}
                    name="agreedRetainer"
                    inputMode="decimal"
                    maxLength={9}
                    defaultValue={portfolio.agreedCents === null ? "" : centsToDollars(portfolio.agreedCents)}
                    hint="For 100 or more properties, which are priced by arrangement. Leave empty to go back to the bands. It starts with their next monthly payment, never part-way through a month."
                  />
                  <SubmitButton variant="secondary" pendingLabel="Saving...">
                    Save retainer
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          </Card>
        );
      })}

      <section>
        <SectionTitle>Properties</SectionTitle>
        {properties.length === 0 ? (
          <p className="text-muted">They have not added a property yet.</p>
        ) : (
          <div className="space-y-3">
            {properties.map((property) => {
              const market = markets.get(property.market);
              const tier = property.tierId ? tiers.get(property.tierId) : null;
              // In pre-launch (DECISIONS.md, 2026-11-27, second entry) a property with no card is as it should be: "Opens soon".
              const label = membershipLabel(property, zone(property.market), Boolean(market && inPreLaunch(market)));
              return (
                <Card key={property.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">{property.name}</p>
                      <p className="text-sm text-muted">
                        {addressLine(property)} · {market?.name ?? property.market}
                      </p>
                    </div>
                    <Chip tone={label.tone}>{label.label}</Chip>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {property.portfolioId
                      ? "On their Portfolio (covered by the one retainer)"
                      : tier && market ? `${tier.name}: ${tierPriceLabel(tier, market.currency)}` : "No membership chosen"}
                    {property.memberSince ? ` · member since ${formatDate(property.memberSince, zone(property.market))}` : ""}
                    {property.currentPeriodEnd && property.status === "active" ? ` · ${property.cancelAtPeriodEnd ? "ends" : "next payment"} ${formatDate(property.currentPeriodEnd, zone(property.market))}` : ""}
                  </p>
                  {property.accessNotes && <p className="mt-2 rounded-xl bg-tint px-3.5 py-2.5 text-sm whitespace-pre-line text-ink">{property.accessNotes}</p>}
                  {market && market.areas.length > 0 && (
                    <div className="mt-3">
                      {!property.area && <p className="mb-2 text-sm font-semibold text-alert">No area set: &ldquo;{property.suburb}&rdquo; matched none, so its jobs go to every tradie. Set it below.</p>}
                      <PropertyAreaForm propertyId={property.id} area={property.area} areas={market.areas} />
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {property.status === "active" && (
                      <Link href={`/admin/jobs/new?property=${property.id}`} className={smallButtonClass}>
                        Log a job here
                      </Link>
                    )}
                  </div>
                  {market && (property.status === "active" || property.status === "past_due") && (
                    <div className="mt-3">
                      <Reveal label="Give a credit for this property">
                        <ActionForm action={staffGoodwill} className="space-y-3">
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="back" value={`/admin/owners/${owner.id}`} />
                          <Field label={`Amount (${market.currency})`} name="creditAmount" inputMode="decimal" maxLength={8} placeholder="50" />
                          <Field label="What is it for?" name="creditNote" maxLength={200} />
                          <p className="text-sm text-muted">It comes off their next membership payment. It is not a refund to their card.</p>
                          <SubmitButton variant="secondary" pendingLabel="Adding...">
                            Add credit
                          </SubmitButton>
                        </ActionForm>
                      </Reveal>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {jobs.length > 0 && (
        <section>
          <SectionTitle>Jobs</SectionTitle>
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} href={`/admin/jobs/${job.id}`} audience="staff" now={at} timeZone={zone(job.market)} />
            ))}
          </div>
        </section>
      )}

      {closed ? (
        <Card className="border-alert/40">
          <SectionTitle>Access removed</SectionTitle>
          <p className="text-muted">They cannot sign in, and nobody can send a tradie at their cost. The reason is in the record.</p>
          <ActionForm action={staffOwnerAccess} className="mt-3">
            <input type="hidden" name="ownerId" value={owner.id} />
            <input type="hidden" name="allowed" value="yes" />
            <SubmitButton variant="secondary" pendingLabel="Saving...">
              Give their access back
            </SubmitButton>
          </ActionForm>
        </Card>
      ) : (
        <Reveal label="Remove this owner's access" tone="alert">
          <ActionForm action={staffOwnerAccess} className="space-y-3">
            <input type="hidden" name="ownerId" value={owner.id} />
            <input type="hidden" name="allowed" value="no" />
            <p className="text-sm text-muted">
              For misuse, for example of &ldquo;Something&rsquo;s wrong&rdquo; on jobs that were done (owner terms, section 8). Their sign-in stops at once, and their team and guest links stop sending tradies. Jobs already under way are finished and charged.
            </p>
            <Field label="Why" name="reason" required maxLength={300} />
            <SubmitButton variant="danger" pendingLabel="Saving...">
              Remove their access
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}

      {credits.length > 0 && (
        <Card>
          <SectionTitle>Credits</SectionTitle>
          <ul className="divide-y divide-line">
            {credits.map((credit) => (
              <li key={credit.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <span>
                  <span className="font-semibold text-ink">{CREDIT_WORDS[credit.reason] ?? credit.reason}</span>
                  <span className="block text-sm text-muted">
                    {formatDate(credit.createdAt, zone(properties[0]?.market ?? ""))}
                    {credit.propertyName ? ` · ${credit.propertyName}` : ""}
                    {credit.note ? ` · ${credit.note}` : ""} · {credit.status === "applied" ? "passed to the payment company" : credit.status}
                  </span>
                </span>
                <span className="tabular shrink-0 font-semibold text-ink">{formatMoney(credit.amountCents, credit.currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
