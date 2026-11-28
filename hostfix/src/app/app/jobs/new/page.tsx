import type { Metadata } from "next";
import Link from "next/link";
import { logOwnerJob } from "@/app/actions/owner";
import { buttonClass } from "@/components/forms/styles";
import { ReportForm } from "@/components/jobs/ReportForm";
import { EmptyState, Notice, PageTitle, RowLink } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { reportFormData } from "@/lib/jobs/report-data";
import { addressLine, listProperties } from "@/lib/properties/service";
import { waitingMarkets } from "@/lib/markets/launch";
import { marketNames, preLaunchWords } from "@/lib/markets/stage";
import { getMarket, listMarkets } from "@/lib/markets/store";
import { cardProblem, cardProblemWords } from "@/lib/owners/service";
import { now } from "@/lib/clock";

export const metadata: Metadata = { title: "Report a problem" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewJobPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/jobs/new");
  const query = await searchParams;
  const db = await getDb();
  const properties = await listProperties(db, viewer.ownerId);
  const covered = properties.filter((property) => property.status === "active");

  if (covered.length === 0) {
    // Pre-launch (DECISIONS.md, 2026-11-27, second entry): set up, but jobs cannot be booked in that area yet. A calm
    // "Opens soon", with no way to a card page. An owner who also has a property to finish somewhere open sees that instead.
    const early = waitingMarkets(properties, await listMarkets(db));
    const toFinish = properties.some((property) => (property.status === "setup" || property.status === "past_due") && !early.some((market) => market.slug === property.market));
    if (early.length > 0 && !toFinish) {
      return (
        <div className="mx-auto max-w-xl space-y-4">
          <PageTitle title="Report a problem" back={{ href: "/app", label: "Home" }} />
          <Notice tone="info" title={preLaunchWords.title(marketNames(early))}>
            Jobs can be booked from the day we go live. {preLaunchWords.body}
          </Notice>
          <Link href="/app/properties" className="font-semibold text-brand underline underline-offset-2">
            Your properties
          </Link>
        </div>
      );
    }
    const waiting = properties.find((property) => (property.status === "setup" || property.status === "past_due") && !early.some((market) => market.slug === property.market));
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Report a problem" back={{ href: "/app", label: "Home" }} />
        <EmptyState
          icon="shield"
          title={properties.length === 0 ? "Add a property first" : waiting?.status === "past_due" ? "Your card needs fixing first" : "Add a card to cover your property first"}
          action={
            <Link href={properties.length === 0 ? "/app/properties/new" : waiting?.status === "past_due" ? "/app/billing" : `/app/properties/${waiting?.id ?? properties[0]!.id}`} className={buttonClass}>
              {properties.length === 0 ? "Add a property" : waiting?.status === "past_due" ? "Update my card" : "Finish setting up"}
            </Link>
          }
        >
          Tradies are sent to covered properties. It is free to join: a property is covered once a card is on file.
        </EmptyState>
      </div>
    );
  }

  const property = covered.find((candidate) => candidate.id === query.property) ?? (covered.length === 1 ? covered[0]! : null);
  if (!property) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Which property?" back={{ href: "/app", label: "Home" }} />
        <div className="space-y-2.5">
          {covered.map((candidate) => (
            <RowLink
              key={candidate.id}
              href={`/app/jobs/new?property=${candidate.id}`}
              title={candidate.name}
              subtitle={addressLine(candidate)}
              leading={
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                  <Icon name="property" />
                </span>
              }
            />
          ))}
        </div>
      </div>
    );
  }

  const data = await reportFormData(db, property, "owner");
  const market = await getMarket(db, property.market);
  // Nothing is sent until the card can be charged (DECISIONS.md, 2026-11-20, second entry): say so before they fill the form in.
  const card = market ? await cardProblem(db, viewer.ownerId, market.country, now(), market.timezone) : null;
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle
        title="Report a problem"
        back={covered.length > 1 ? { href: "/app/jobs/new", label: "Choose another property" } : { href: "/app", label: "Home" }}
        intro={`At ${property.name}, ${addressLine(property)}`}
      />
      {card && (
        <div className="mb-5">
          <Notice tone="error" title={card === "unpaid" ? "An earlier payment needs sorting first" : "Your card needs updating first"}>
            {cardProblemWords(card)}{" "}
            <Link href="/app/billing" className="font-semibold underline underline-offset-2">
              Update my card
            </Link>
          </Notice>
        </div>
      )}
      {!data || data.items.length === 0 ? (
        <Notice tone="warn" title="Jobs cannot be logged for this property right now">
          Please contact us and we will sort it out.
        </Notice>
      ) : (
        <ReportForm
          action={logOwnerJob}
          hidden={{ propertyId: property.id }}
          audience="owner"
          items={data.items}
          offMenuTrades={data.offMenuTrades}
          currency={data.currency}
          diagnosisCents={data.diagnosisCents}
          standardHours={data.standardHours}
          urgentHours={data.urgentHours}
          urgentCents={data.urgentCents}
          urgentIncluded={data.urgentIncluded}
          afterHoursNow={data.afterHoursNow}
          afterHoursCents={data.afterHoursCents}
          emergencyMinutes={data.emergencyMinutes}
          emergencyCents={data.emergencyCents}
          cover={data.cover}
        />
      )}
    </div>
  );
}
