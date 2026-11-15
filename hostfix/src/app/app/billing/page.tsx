import type { Metadata } from "next";
import Link from "next/link";
import { changeCard } from "@/app/actions/owner";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { smallButtonClass } from "@/components/forms/styles";
import { Card, EmptyState, Facts, PageTitle, SectionTitle } from "@/components/ui/Bits";
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

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageTitle title="Billing" back={{ href: "/app/account", label: "Account" }} />
      </div>

      <div className="no-print grid gap-5 md:grid-cols-2">
        {cards.map(({ country, billing }) => (
          <Card key={country}>
            <SectionTitle>Card on file{countries.length > 1 ? ` (${country === "NZ" ? "New Zealand" : "Australia"})` : ""}</SectionTitle>
            {billing?.cardLast4 ? (
              <>
                <p className="flex items-center gap-3 text-lg font-semibold text-ink">
                  <Icon name="card" className="text-brand" />
                  <span className="capitalize">{billing.cardBrand ?? "Card"}</span> ending {billing.cardLast4}
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
                <li key={property.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <Link href={`/app/properties/${property.id}`} className="min-w-0 truncate font-semibold text-brand underline underline-offset-2">
                    {property.name}
                  </Link>
                  <span className="shrink-0 text-right text-sm text-muted">
                    {property.status === "active" && tier
                      ? `${tier.name}, ${formatMoney(tier.monthlyPriceCents, allMarkets.find((candidate) => candidate.slug === property.market)?.currency ?? market.currency)} a month`
                      : label.label}
                    {property.status === "active" && property.currentPeriodEnd && !property.cancelAtPeriodEnd ? `. Next ${formatDate(property.currentPeriodEnd, zone)}` : ""}
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
