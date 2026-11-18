import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, smallButtonClass } from "@/components/forms/styles";
import { Chip, EmptyState, Notice, PageTitle, RowLink } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
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
  const covered = properties.filter((property) => property.status === "active").length;
  const imported = typeof query.imported === "string" && /^\d{1,3}$/.test(query.imported) ? Number(query.imported) : 0;
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));

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
          Add the place you host, choose a membership, and it is covered.
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {imported > 0 && (
            <Notice tone="good" title={`${imported} ${imported === 1 ? "property" : "properties"} added`}>
              Any marked Finish setting up need a card on file before they are covered.
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
            {covered > 1 && (
              <RowLink
                href="/app/properties/cards"
                title="Print every QR card"
                subtitle={`${covered} cards, one to a page`}
                leading={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                    <Icon name="door" />
                  </span>
                }
              />
            )}
          </div>
          {properties.map((property) => {
            const membership = membershipLabel(property, markets.get(property.market)?.timezone ?? "Pacific/Auckland");
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
                right={<Chip tone={membership.tone}>{membership.label}</Chip>}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
