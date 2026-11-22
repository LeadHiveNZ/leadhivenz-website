import type { ReactNode } from "react";
import { addPartsAction, addReceiptAction } from "@/app/actions/tradie";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { PhotoUploader } from "@/components/forms/PhotoUploader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Chip } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import type { Market } from "@config/markets";
import { PART_ROWS, type JobPart, type PriceListItem } from "@/lib/jobs/parts";
import { PART_FEE_BPS } from "@/lib/jobs/pricing";
import { centsToDollars } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { PartPicker } from "./PartPicker";

/**
 * PARTS ON A JOB, for the tradie (DECISIONS.md, 2026-11-23): each part's name,
 * how many, and their own price including GST. The price list is a set of
 * quick picks that fill the name and price in. No receipt is needed unless
 * our team asks for one.
 */

type Shared = { which: ReactNode; code?: string; currency: string };

export function AddPartsForm({ which, currency, priceList, market, limitCents }: Shared & { priceList: PriceListItem[]; market: Pick<Market, "partsIncludedCents" | "partsApprovalCents" | "platformFeeBps">; limitCents: number }) {
  const fmt = (cents: number) => formatMoney(cents, currency);
  const picks = priceList.map((item) => ({ id: item.id, name: item.name, price: centsToDollars(item.priceCents), label: `${item.name}, ${fmt(item.priceCents)}` }));
  return (
    <Reveal label="Add parts">
      <ActionForm action={addPartsAction} className="space-y-4">
        {which}
        <p className="text-sm text-muted">
          Enter each part and your own price for one, including GST: your cost plus your usual markup. The owner pays that price; you get it less {PART_FEE_BPS / 100}%, which covers
          the card fee. Small parts up to {fmt(market.partsIncludedCents)} are in the job&rsquo;s price: do not add them. No receipt is needed, but keep it: our team sometimes asks for one.
        </p>
        {Array.from({ length: PART_ROWS }, (_, row) => (
          <fieldset key={row} className="space-y-3 rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-ink">{row === 0 ? "Part" : `Another part (optional)`}</legend>
            <PartPicker row={row} items={picks} />
            <Field id={`part-${row}-name`} label="What is it?" name={`part-${row}-name`} maxLength={160} placeholder="Mixer tap cartridge (40 mm)" />
            <div className="grid grid-cols-2 gap-3">
              <Field id={`part-${row}-qty`} label="How many" name={`part-${row}-qty`} inputMode="numeric" maxLength={2} defaultValue="1" />
              <Field id={`part-${row}-price`} label={`Your price for one, incl. GST (${currency})`} name={`part-${row}-price`} inputMode="decimal" maxLength={10} placeholder="45.00" />
            </div>
          </fieldset>
        ))}
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
    case "not_needed":
      return { text: "Your price", tone: "quiet" };
    case "requested":
      return { text: "Receipt asked for", tone: "waiting" };
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
        const needsReceipt = canAddReceipts && part.status === "active" && (part.receiptStatus === "requested" || (part.kind === "receipt" && (part.receiptStatus === "needed" || part.receiptStatus === "to_follow")));
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
            <p className="mt-1 text-sm text-muted">
              You get {fmt(part.tradieCents)}
              {part.kind === "receipt" ? ` (receipt ${fmt(part.amountCents)} plus your share of the 20%)` : part.kind === "priced" ? ` (your ${fmt(part.ownerCents)} less ${PART_FEE_BPS / 100}%)` : ""}.
              {part.receiptStatus === "requested" ? " Our team has asked for the receipt (a spot check). Your payment for this job waits for it; without it in 7 days, the part is refunded to the owner out of your payment." : ""}
            </p>
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
