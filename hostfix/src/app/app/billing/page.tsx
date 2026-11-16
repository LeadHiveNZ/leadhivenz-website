import type { Metadata } from "next";
import Link from "next/link";
import { beginPortfolio, changeCard, choosePortfolioAction, endPortfolio } from "@/app/actions/owner";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { smallButtonClass } from "@/components/forms/styles";
import { Card, EmptyState, Facts, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { PrintButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/current";
import { ownerStatement } from "@/lib/billing/statements";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listMarkets, listTiers } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { isMonthKey, shiftMonth } from "@/lib/months";
import { getBilling } from "@/lib/owners/service";
import { membershipLabel } from "@/lib/properties/display";
import { minimumProperties } from "@/lib/markets/bands";
import { countPortfolioProperties, listPortfolios, retainerFor } from "@/lib/properties/portfolio";
import { listProperties } from "@/lib/properties/service";
import { formatDate, monthKey, monthLabel } from "@/lib/time";

export const metadata: Metadata = { title: "Billing" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/billing");
  const query = await searchParams;
  const db = await getDb();
  const properties = await listProperties(db, viewer.ownerId);
  const allMarkets = await listMarkets(db);
  const markets = allMarkets.filter((market) => properties.some((property) => property.market === market.slug));

  if (markets.length === 0) {
    return (
      <div>
        <PageTitle title="Billing" back={{ href: "/app/account", label: "Account" }} />
        <EmptyState icon="card" title="Nothing to show yet">
          Your card, monthly statements and any credits appear here once a property has a membership.
        </EmptyState>
      </div>
    );
  }

  const market = markets.find((candidate) => candidate.slug === query.market) ?? markets[0]!;
  const thisMonth = monthKey(now(), market.timezone);
  const month = isMonthKey(query.month) && query.month <= thisMonth ? query.month : thisMonth;
  const statement = await ownerStatement(db, viewer.ownerId, market, month);
  const tiers = new Map((await listTiers(db)).map((tier) => [tier.id, tier]));
  const countries = [...new Set(markets.map((candidate) => candidate.country))];
  const cards = [];
  for (const country of countries) cards.push({ country, billing: await getBilling(db, viewer.ownerId, country) });
  const money = (cents: number) => formatMoney(cents, statement.currency);
  const link = (target: string) => `/app/billing?market=${market.slug}&month=${target}`;

  // PORTFOLIO: one retainer for the whole account, in this market.
  const portfolio = (await listPortfolios(db, viewer.ownerId)).find((candidate) => candidate.market === market.slug && candidate.status !== "cancelled") ?? null;
  const portfolioTierOffered = [...tiers.values()].find((tier) => tier.market === market.slug && tier.active && tier.billingBasis === "per_account") ?? null;
  const portfolioTier = portfolio ? (tiers.get(portfolio.tierId) ?? null) : null;
  const portfolioCount = portfolio ? await countPortfolioProperties(db, portfolio.id) : 0;
  const portfolioPaying = portfolio?.status === "active" || portfolio?.status === "past_due";
  const portfolioPrice = portfolio && portfolioTier ? retainerFor(portfolioTier, portfolioPaying ? portfolio.propertyCountBilled : portfolioCount, portfolio.agreedCents) : null;
  const portfolioMinimum = portfolioTier ? minimumProperties(portfolioTier) : 10;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageTitle title="Billing" back={{ href: "/app/account", label: "Account" }} />
      </div>

      {query.member && portfolioPaying && (
        <Notice tone="good" title="Your Portfolio is covered">
          Every property on it is covered now. Properties you add from here join it with nothing more to pay on the day.
        </Notice>
      )}
      {query.pending && !portfolioPaying && (
        <Notice tone="info" title="We are confirming your payment">
          This usually takes under a minute. Refresh this page shortly.
        </Notice>
      )}

      {portfolio && portfolioTier && (
        <Card className="no-print sm:p-6">
          <SectionTitle>Portfolio{markets.length > 1 ? `, ${market.name}` : ""}</SectionTitle>
          <p className="text-muted">One monthly retainer for your whole account, set by how many properties are on it. Jobs are charged at the same fixed prices.</p>
          <div className="mt-3">
            <Facts
              rows={[
                { label: "Properties on it", value: String(portfolioCount) },
                {
                  label: portfolioPaying ? "Your retainer" : "Retainer when you start",
                  value: portfolioPaying && portfolio.bandCents
                    ? `${money(portfolio.bandCents)} a month${portfolioPrice ? ` (${portfolioPrice.label})` : ""}`
                    : portfolioPrice && portfolioPrice.needsPerson === null
                      ? `${money(portfolioPrice.cents)} a month (${portfolioPrice.label})`
                      : portfolioCount < portfolioMinimum ? `Starts at ${money(portfolioTier.monthlyPriceCents)} a month` : "Agreed with you",
                },
                ...(portfolioPaying && portfolio.currentPeriodEnd
                  ? [{ label: portfolio.cancelAtPeriodEnd ? "Covered until" : "Next payment", value: formatDate(portfolio.currentPeriodEnd, market.timezone) }]
                  : []),
              ]}
            />
          </div>
          {portfolioPaying && (
            <p className="mt-2 text-sm text-muted">Add or take off a property and the retainer follows from your next monthly payment, never part-way through a month.</p>
          )}
          {portfolio.status === "past_due" && (
            <div className="mt-4 space-y-3">
              <Notice tone="error" title="Your last payment did not go through">
                Tradies cannot be sent to your properties until the card is fixed.
              </Notice>
              <ActionForm action={changeCard}>
                <input type="hidden" name="country" value={market.country} />
                <SubmitButton pendingLabel="Opening...">Update my card</SubmitButton>
              </ActionForm>
            </div>
          )}
          {portfolio.status === "setup" && (
            <div className="mt-4 space-y-3">
              {portfolioCount < portfolioMinimum ? (
                <>
                  <p className="rounded-xl bg-tint px-4 py-3 text-ink">
                    Portfolio is for {portfolioMinimum} or more properties. You have {portfolioCount} so far: add {portfolioMinimum - portfolioCount} more, then start the retainer here.
                  </p>
                  <Link href={`/app/properties/new?market=${market.slug}`} className={smallButtonClass}>
                    Add a property
                  </Link>
                </>
              ) : (
                <ActionForm action={beginPortfolio} className="space-y-3">
                  <input type="hidden" name="portfolioId" value={portfolio.id} />
                  <p className="text-sm text-muted">Charged today, then monthly. Every property on your Portfolio is covered from today.</p>
                  <SubmitButton pendingLabel="Starting..." className="w-full sm:w-auto">
                    Start the retainer
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          )}
          {!portfolio.cancelAtPeriodEnd && (
            <div className="mt-4">
              <Reveal label={portfolio.status === "setup" ? "Do not use Portfolio" : "Cancel the retainer"} tone="alert">
                <ActionForm action={endPortfolio} className="space-y-3">
                  <input type="hidden" name="portfolioId" value={portfolio.id} />
                  <p className="text-muted">
                    {portfolio.status === "setup"
                      ? "Your properties go back to choosing a membership each. Nothing has been charged."
                      : `Every property on it stays covered until ${portfolio.currentPeriodEnd ? formatDate(portfolio.currentPeriodEnd, market.timezone) : "the end of the month you paid for"}. After that no tradies can be sent and no further payments are taken.`}
                  </p>
                  <SubmitButton variant="danger" pendingLabel="Cancelling...">
                    {portfolio.status === "setup" ? "Yes, do not use Portfolio" : "Yes, cancel the retainer"}
                  </SubmitButton>
                </ActionForm>
              </Reveal>
            </div>
          )}
        </Card>
      )}

      {!portfolio && portfolioTierOffered && market.stage === "live" && (
        <Card className="no-print">
          <SectionTitle>Managing 10 or more properties?</SectionTitle>
          <p className="text-muted">
            Portfolio is one monthly retainer for your whole account, from {money(portfolioTierOffered.monthlyPriceCents)}, banded by how many properties you have, plus the same fixed job prices.
            Properties that have not started a membership yet join it, and so does every property you add after.
          </p>
          <ActionForm action={choosePortfolioAction} className="mt-4">
            <input type="hidden" name="market" value={market.slug} />
            <SubmitButton variant="secondary" pendingLabel="Saving...">
              Use Portfolio for my account
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      <div className="no-print grid gap-5 md:grid-cols-2">
        {cards.map(({ country, billing }) => (
          <Card key={country}>
            <SectionTitle>Card on file{countries.length > 1 ? ` (${country === "NZ" ? "New Zealand" : "Australia"})` : ""}</SectionTitle>
            {billing?.cardLast4 ? (
              <>
                <p className="flex items-center gap-3 text-lg font-semibold text-ink">
                  <Icon name="card" className="text-brand" />
                  <span>
                    <span className="capitalize">{billing.cardBrand ?? "Card"}</span> ending {billing.cardLast4}
                  </span>
                </p>
                {billing.cardExpMonth && billing.cardExpYear && (
                  <p className="mt-1 text-sm text-muted">
                    Expires {String(billing.cardExpMonth).padStart(2, "0")}/{String(billing.cardExpYear).slice(-2)}
                  </p>
                )}
                <ActionForm action={changeCard} className="mt-4">
                  <input type="hidden" name="country" value={country} />
                  <SubmitButton variant="secondary" pendingLabel="Opening...">
                    Change card
                  </SubmitButton>
                </ActionForm>
              </>
            ) : (
              <p className="text-muted">No card yet. It is added when you start a membership.</p>
            )}
          </Card>
        ))}

        <Card>
          <SectionTitle>Memberships</SectionTitle>
          <ul className="divide-y divide-line">
            {properties.map((property) => {
              const tier = property.tierId ? tiers.get(property.tierId) : null;
              const zone = allMarkets.find((candidate) => candidate.slug === property.market)?.timezone ?? market.timezone;
              const label = membershipLabel(property, zone);
              return (
                <li key={property.id} className="py-2.5">
                  <Link href={`/app/properties/${property.id}`} className="font-semibold text-brand underline underline-offset-2">
                    {property.name}
                  </Link>
                  <span className="block text-sm text-muted">
                    {property.portfolioId
                      ? `On your Portfolio${property.status === "active" ? "" : `. ${label.label}`}`
                      : property.status === "active" && tier
                      ? `${tier.name}, ${formatMoney(tier.monthlyPriceCents, allMarkets.find((candidate) => candidate.slug === property.market)?.currency ?? market.currency)} a month`
                      : label.label}
                    {property.status === "active" && property.currentPeriodEnd && !property.portfolioId ? `. ${property.cancelAtPeriodEnd ? "Ends" : "Next payment"} ${formatDate(property.currentPeriodEnd, zone)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Statement{markets.length > 1 ? `, ${market.name}` : ""}</p>
            <h2 className="display text-2xl text-ink">{monthLabel(month)}</h2>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Link href={link(shiftMonth(month, -1))} className={smallButtonClass}>
              <Icon name="back" size={16} /> Earlier
            </Link>
            {month < thisMonth && (
              <Link href={link(shiftMonth(month, 1))} className={smallButtonClass}>
                Later <Icon name="arrow" size={16} />
              </Link>
            )}
            <PrintButton>Print or save</PrintButton>
          </div>
        </div>

        {markets.length > 1 && (
          <div className="no-print mt-3 flex flex-wrap gap-2">
            {markets.map((candidate) => (
              <Link
                key={candidate.slug}
                href={`/app/billing?market=${candidate.slug}&month=${month}`}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${candidate.slug === market.slug ? "border-brand bg-tint text-brand" : "border-line text-muted"}`}
              >
                {candidate.name}
              </Link>
            ))}
          </div>
        )}

        {statement.lines.length === 0 ? (
          <p className="mt-5 text-muted">Nothing was charged in {monthLabel(month)}.</p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-line">
              {statement.lines.map((line, index) => (
                <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{line.description}</span>
                    <span className="block text-sm text-muted">
                      {formatDate(line.date, market.timezone)}
                      {line.property ? ` · ${line.property}` : ""}
                    </span>
                  </span>
                  <span className={`tabular shrink-0 font-semibold ${line.amountCents < 0 ? "text-done" : "text-ink"}`}>
                    {line.amountCents < 0 ? `-${money(-line.amountCents)}` : money(line.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t-2 border-ink pt-3">
              <Facts
                rows={[
                  { label: "Memberships", value: money(statement.membershipCents) },
                  { label: "Jobs", value: money(statement.jobsCents) },
                  ...(statement.refundsCents !== 0 ? [{ label: "Refunds", value: `-${money(-statement.refundsCents)}` }] : []),
                  { label: "Total charged to your card", value: <span className="text-xl">{money(statement.totalCents)}</span> },
                  ...(market.taxRegistered ? [{ label: `Includes ${market.taxName}`, value: money(statement.taxCents) }] : []),
                  ...(statement.creditsCents !== 0 ? [{ label: "Credits to come off your next membership payment", value: money(-statement.creditsCents) }] : []),
                ]}
              />
            </div>
          </>
        )}
        <p className="mt-4 text-sm text-muted">
          {market.taxRegistered && market.taxNumber ? `${market.taxName} number ${market.taxNumber}. ` : ""}
          Prepared for {viewer.user.name}.
        </p>
      </Card>
    </div>
  );
}
