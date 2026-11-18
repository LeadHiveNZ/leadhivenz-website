import type { Metadata } from "next";
import { QrCard } from "@/components/properties/QrCard";
import { EmptyState, PageTitle } from "@/components/ui/Bits";
import { PrintButton } from "@/components/ui/Buttons";
import { brand } from "@config/brand";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { listProperties } from "@/lib/properties/service";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "Print every QR card" };

/** Every covered property's guest QR card, one per printed page, for a home printer. */
export default async function AllCardsPage() {
  const viewer = await requireOwner("/app/properties/cards");
  const properties = (await listProperties(await getDb(), viewer.ownerId)).filter((property) => property.status === "active");
  const cards = await Promise.all(
    properties.map(async (property) => {
      const url = `${baseUrl()}/r/${property.guestToken}`;
      return { id: property.id, name: property.name, url, qr: await qrSvg(url, { dark: brand.colours.brandDark }) };
    }),
  );

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print">
        <PageTitle
          title="Print every QR card"
          back={{ href: "/app/properties", label: "Properties" }}
          intro={`${cards.length} ${cards.length === 1 ? "card" : "cards"}, one to a page, with the property's name under each so you know which goes where.`}
        />
        {cards.length > 0 && (
          <div className="mb-5">
            <PrintButton>Print all the cards</PrintButton>
          </div>
        )}
      </div>
      {cards.length === 0 ? (
        <EmptyState icon="property" title="No covered properties yet">
          A property gets its card once it is covered.
        </EmptyState>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {cards.map((card) => (
            <section key={card.id} className="print-sheet">
              <QrCard url={card.url} qr={card.qr} propertyName={card.name} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
