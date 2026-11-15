import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, smallButtonClass } from "@/components/forms/styles";
import { Chip, EmptyState, PageTitle, RowLink } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listMarkets } from "@/lib/markets/store";
import { membershipLabel } from "@/lib/properties/display";
import { addressLine, listProperties } from "@/lib/properties/service";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const viewer = await requireOwner("/app/properties");
  const db = await getDb();
  const properties = await listProperties(db, viewer.ownerId);
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
