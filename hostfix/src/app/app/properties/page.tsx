import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, smallButtonClass } from "@/components/forms/styles";
import { Chip, EmptyState, Notice, PageTitle, RowLink } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { joinableMarkets, waitingMarkets } from "@/lib/markets/launch";
import { bookingOpen, marketNames, preLaunchWords } from "@/lib/markets/stage";
import { listMarkets } from "@/lib/markets/store";
import { membershipLabel } from "@/lib/properties/display";
import { addressLine, listProperties } from "@/lib/properties/service";
import { listTeam } from "@/lib/team/service";

export const metadata: Metadata = { title: "Properties" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PropertiesPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/properties");
  const query = await searchParams;
  const db = await getDb();
  const properties = await listProperties(db, viewer.ownerId);
  const team = await listTeam(db, viewer.ownerId);
  const imported = typeof query.imported === "string" && /^\d{1,3}$/.test(query.imported) ? Number(query.imported) : 0;
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));
  // Properties whose map pin the owner has not checked yet (DECISIONS.md, 2026-11-19).
  const unpinned = properties.filter((property) => property.status !== "cancelled" && !property.pinConfirmedAt);
  // Pre-launch (DECISIONS.md, 2026-11-27, second entry): set up, with bookings still to open in that area.
  const waiting = waitingMarkets(properties, [...markets.values()]);
  const opensSoon = (slug: string) => waiting.some((market) => market.slug === slug);
  const printable = properties.filter((property) => property.status === "active" || (property.status === "setup" && opensSoon(property.market))).length;
  const joinable = properties.length === 0 ? await joinableMarkets(db) : [];
  const early = joinable.length > 0 && !joinable.some(bookingOpen);

  return (
    <div>
      <PageTitle
        title="Properties"
        action={
          properties.length > 0 ? (
            <Link href="/app/properties/new" className={smallButtonClass}>
              <Icon name="plus" size={16} /> Add a property
            </Link>
          ) : undefined
        }
      />
      {properties.length === 0 ? (
        <EmptyState
          icon="property"
          title="No properties yet"
          action={
            <Link href="/app/properties/new" className={buttonClass}>
              Add my first property
            </Link>
          }
        >
          {early
            ? `Add the places you host now and you are ready the day bookings open in ${marketNames(joinable)}. It is free, and no card is needed yet.`
            : "Add the place you host, choose a membership, and it is covered."}
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {imported > 0 && (
            <Notice tone="good" title={`${imported} ${imported === 1 ? "property" : "properties"} added`}>
              {waiting.length > 0 ? preLaunchWords.setUp(marketNames(waiting)) : "Any marked Finish setting up need a card on file before they are covered."}
            </Notice>
          )}
          {imported === 0 && waiting.map((market) => (
            <Notice key={market.slug} tone="info" title={preLaunchWords.title(market.name)}>
              You&rsquo;re set up. {preLaunchWords.body}
            </Notice>
          ))}
          {unpinned.length > 0 && (
            <Notice tone="info" title={unpinned.length === 1 ? "Check where 1 house is on the map" : `Check where ${unpinned.length} houses are on the map`}>
              We check a tradie is at the house when they tap Arrived and Job done, so the pin needs to be on the house. It takes a few seconds each:{" "}
              <Link href={`/app/properties/${unpinned[0]!.id}`} className="font-semibold underline underline-offset-2">
                start with {unpinned[0]!.name}
              </Link>
              .
            </Notice>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <RowLink
              href="/app/team"
              title="Your team"
              subtitle={team.length === 0 ? "Add a cleaner or co-host" : `${team.length} ${team.length === 1 ? "person reports" : "people report"} for you`}
              leading={
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                  <Icon name="account" />
                </span>
              }
            />
            {printable > 1 && (
              <RowLink
                href="/app/properties/cards"
                title="Print every QR card"
                subtitle={`${printable} cards, one to a page`}
                leading={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                    <Icon name="door" />
                  </span>
                }
              />
            )}
          </div>
          {properties.map((property) => {
            const membership = membershipLabel(property, markets.get(property.market)?.timezone ?? "Pacific/Auckland", opensSoon(property.market));
            return (
              <RowLink
                key={property.id}
                href={`/app/properties/${property.id}`}
                title={property.name}
                subtitle={addressLine(property)}
                leading={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                    <Icon name="property" />
                  </span>
                }
                right={
                  <span className="flex flex-col items-end gap-1">
                    <Chip tone={membership.tone}>{membership.label}</Chip>
                    {property.status !== "cancelled" && !property.pinConfirmedAt && <span className="text-xs font-semibold text-wait">Check the map pin</span>}
                  </span>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
