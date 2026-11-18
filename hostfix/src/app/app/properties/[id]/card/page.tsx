import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QrCard } from "@/components/properties/QrCard";
import { Notice, PageTitle } from "@/components/ui/Bits";
import { PrintButton } from "@/components/ui/Buttons";
import { brand } from "@config/brand";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { getProperty } from "@/lib/properties/service";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "QR card" };

/** The card that goes on the fridge or in the welcome folder. Made to be printed. */
export default async function QrCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireOwner(`/app/properties/${id}/card`);
  const property = await getProperty(await getDb(), viewer.ownerId, id);
  if (!property) notFound();
  const url = `${baseUrl()}/r/${property.guestToken}`;
  const qr = await qrSvg(url, { dark: brand.colours.brandDark });
  const member = property.status === "active" || property.status === "past_due";

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print">
        <PageTitle title="QR card" back={{ href: `/app/properties/${property.id}`, label: property.name }} intro="Print it and leave it where guests will see it: the fridge, the welcome folder, beside the heat pump remote." />
        {!member && (
          <div className="mb-4">
            <Notice tone="warn" title="This property is not a member yet">
              The card will only work once the membership has started.
            </Notice>
          </div>
        )}
        <div className="mb-5">
          <PrintButton>Print this card</PrintButton>
        </div>
      </div>

      <QrCard url={url} qr={qr} propertyName={property.name} />
    </div>
  );
}
