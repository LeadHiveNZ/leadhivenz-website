import type { ReactNode } from "react";
import { addPartsAction, addReceiptAction } from "@/app/actions/tradie";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { PhotoUploader } from "@/components/forms/PhotoUploader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Chip } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import type { Market } from "@config/markets";
import type { JobPart, PriceListItem } from "@/lib/jobs/parts";
import { LIST_PART_FEE_BPS, listPartLine, receiptPartLine } from "@/lib/jobs/pricing";
import { formatMoney } from "@/lib/money";

/**
 * PARTS ON A JOB, for the tradie (DECISIONS.md, 2026-11-20): the price list
 * at its fixed prices, anything else from a receipt plus 20%, and the
 * receipts still to come.
 */

type Shared = { which: ReactNode; code?: string; currency: string };

export function AddPartsForm({ which, code, currency, priceList, market, limitCents }: Shared & { priceList: PriceListItem[]; market: Pick<Market, "partsIncludedCents" | "partsApprovalCents" | "platformFeeBps">; limitCents: number }) {
  const fmt = (cents: number) => formatMoney(cents, currency);
  // What the tradie gets on NZ$100 of receipt, worked from the same sums as the job (receipt + 17%).
  const onHundred = receiptPartLine(market, "example", 10_000).tradieCents;
  return (
    <Reveal label="Add parts">
      <ActionForm action={addPartsAction} className="space-y-4">
        {which}
        <p className="text-sm text-muted">
          Small parts up to {fmt(market.partsIncludedCents)} are in the job&rsquo;s price: do not add them. Parts on the list are charged at the list price and you get it
          less {LIST_PART_FEE_BPS / 100}%. Anything else is charged at what you paid plus 20%, and you get what you paid plus {Math.round((onHundred - 10_000) / 100)}%.
        </p>
        {priceList.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink">From the price list: how many?</legend>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {priceList.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <label htmlFor={`qty-${item.id}`} className="min-w-0 flex-1 text-ink">
                    {item.name}
                    <span className="block text-sm text-muted">
                      {fmt(item.priceCents)} each · you get {fmt(listPartLine(item.name, item.priceCents, 1).tradieCents)}
                    </span>
                  </label>
                  <input
                    id={`qty-${item.id}`}
                    name={`qty-${item.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={50}
                    defaultValue={0}
                    className="w-16 rounded-lg border border-line px-2 py-1.5 text-right"
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold text-ink">A part not on the list (optional)</legend>
          <Field label="What is it?" name="partDescription" maxLength={160} placeholder="15 mm copper elbows and 2 m of pipe" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Receipt total, including GST (${currency})`} name="receiptTotal" inputMode="decimal" maxLength={10} placeholder="64.90" />
            <Field label={`Amount of it for this job (${currency})`} name="partAmount" inputMode="decimal" maxLength={10} placeholder="45" hint="Less than the total if some is left for other jobs, like a pack or van stock." />
          </div>
          <Field label="Date on the receipt (optional)" name="receiptDate" type="date" />
          <PhotoUploader kind="receipt" name="receiptUploadIds" label="The receipt (a photo, a screenshot or the PDF)" offer={code} max={1} documents hint="Only our team sees it. The owner sees the part and its price. No receipt yet? Add it later, or at Job done." />
        </fieldset>
        <p className="text-sm text-muted">
          Up to {fmt(market.partsApprovalCents)} of parts on this job (and {fmt(limitCents)} of extras in all) are added straight away and the owner is texted. Above that, the owner is
          asked first: do not buy them until they say yes.
        </p>
        <SubmitButton variant="secondary" pendingLabel="Adding...">
          Add parts
        </SubmitButton>
      </ActionForm>
    </Reveal>
  );
}

function receiptWords(part: JobPart): { text: string; tone: "done" | "waiting" | "alert" | "quiet" } {
  if (part.kind === "list") return { text: "Price list", tone: "quiet" };
  switch (part.receiptStatus) {
    case "attached":
      return part.checkStatus === "flagged" || part.checkStatus === "held" ? { text: "Receipt being checked", tone: "alert" } : { text: "Receipt added", tone: "done" };
    case "to_follow":
      return { text: "Receipt to follow", tone: "waiting" };
    case "refunded":
    case "refunding":
      return { text: "Refunded: no receipt", tone: "alert" };
    default:
      return { text: "Receipt needed", tone: "waiting" };
  }
}

/** The tradie's parts on this job, and a way to add a receipt that is still to come. */
export function TradieParts({ which, code, currency, parts, canAddReceipts }: Shared & { parts: JobPart[]; canAddReceipts: boolean }) {
  const shown = parts.filter((part) => part.status !== "void" || part.receiptStatus === "refunded");
  if (shown.length === 0) return null;
  const fmt = (cents: number) => formatMoney(cents, currency);
  return (
    <ul className="space-y-3">
      {shown.map((part) => {
        const words = receiptWords(part);
        const needsReceipt = canAddReceipts && part.kind === "receipt" && part.status === "active" && (part.receiptStatus === "needed" || part.receiptStatus === "to_follow");
        return (
          <li key={part.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">
                {part.description}
                {part.quantity > 1 ? ` × ${part.quantity}` : ""}
              </span>
              <span className="flex items-center gap-2">
                {part.status === "pending" && <Chip tone="waiting">Waiting for the owner</Chip>}
                <Chip tone={words.tone}>{words.text}</Chip>
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">You get {fmt(part.tradieCents)}{part.kind === "receipt" ? ` (receipt ${fmt(part.amountCents)} plus your share of the 20%)` : ""}.</p>
            {needsReceipt && (
              <div className="mt-3">
                <ActionForm action={addReceiptAction} className="space-y-3">
                  {which}
                  <input type="hidden" name="partId" value={part.id} />
                  <PhotoUploader kind="receipt" name="receiptUploadIds" label="The receipt (a photo, a screenshot or the PDF)" offer={code} max={1} documents />
                  <Field label="Date on the receipt (optional)" name="receiptDate" type="date" defaultValue={part.receiptDate ?? ""} />
                  <SubmitButton variant="secondary" pendingLabel="Sending...">
                    Add the receipt
                  </SubmitButton>
                </ActionForm>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
