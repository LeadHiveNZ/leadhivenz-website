import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
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

      <div className="mx-auto w-full max-w-sm rounded-3xl border-2 border-brand bg-white p-7 text-center print:border print:shadow-none">
        <div className="flex justify-center">
          <Logo size={30} />
        </div>
        <p className="display mt-5 text-3xl leading-tight text-ink">Something not working?</p>
        <p className="mt-2 text-lg text-muted">Point your phone camera here and tell us. It takes one minute.</p>
        <div className="mx-auto mt-5 w-56 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR code for reporting a problem" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-5 text-base font-semibold text-ink">No app. No account. We tell your host and send help.</p>
        <p className="mt-4 border-t border-line pt-3 text-xs break-all text-muted">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-1 text-xs text-muted">{property.name}</p>
      </div>
    </div>
  );
}
