import type { Market } from "@config/markets";

/**
 * JOB MONEY MATHS. Pure sums, no database, so every rule can be tested.
 *
 * A job is a list of lines. Each line says what the owner pays and what the
 * tradie gets. What is left is the platform's. All amounts are whole cents and
 * include tax.
 *
 * The rules (from the brief):
 *  - Menu job: the owner pays the menu price, the tradie gets the menu payout.
 *  - Urgent and after-hours surcharges carry the platform fee, the same as
 *    every other dollar: the tradie gets the surcharge less the fee, on top of
 *    their menu share (DECISIONS.md, 2026-11-18). Never discounted further.
 *  - A tier that includes urgent response means the owner is not charged the
 *    urgent surcharge. The tradie still gets their share, so the platform pays it.
 *  - Off-menu: a fixed diagnosis fee, then a quote. The platform keeps its fee
 *    percentage of the quoted work.
 *  - A quote above the limit needs the owner's approval before work starts.
 *  - Parts (DECISIONS.md, 2026-11-20), on any job: small parts up to the
 *    market's included amount (NZ$30) are in the price. A part on the price
 *    list is charged at its fixed price; the tradie gets it less 3%, and the
 *    3% covers the card fee. Anything else is charged at the merchant's price
 *    on the receipt plus 20% for sourcing it; the platform fee (15%) is taken
 *    from the 20% only, so the tradie gets the receipt amount plus 17%. Above
 *    the no-ask limit the owner says yes first. (Until 20 November 2026 parts
 *    were passed on at cost with no fee; parts added before then keep that.)
 */

export type LineKind = "menu" | "diagnosis" | "urgent" | "after_hours" | "quote" | "parts" | "no_access" | "adjustment";

export type Line = {
  kind: LineKind;
  label: string;
  /** What the owner pays for this line. */
  ownerCents: number;
  /** What the tradie gets for this line. */
  tradieCents: number;
};

export type Totals = {
  ownerCents: number;
  tradieCents: number;
  /** What the platform keeps. Can be negative when it is paying a surcharge the owner's tier includes. */
  platformCents: number;
};

type PricingMarket = Pick<
  Market,
  | "platformFeeBps"
  | "urgentSurchargeCents"
  | "afterHoursSurchargeCents"
  | "diagnosisFeeCents"
  | "diagnosisPayoutCents"
  | "approvalThresholdCents"
  | "partsIncludedCents"
  | "partsApprovalCents"
>;

function whole(cents: number, what: string): number {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`${what} must be a whole number of cents, zero or more. Got ${cents}.`);
  return cents;
}

export function totals(lines: Line[]): Totals {
  let ownerCents = 0;
  let tradieCents = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.ownerCents) || !Number.isInteger(line.tradieCents)) {
      throw new Error(`Line "${line.label}" is not in whole cents.`);
    }
    ownerCents += line.ownerCents;
    tradieCents += line.tradieCents;
  }
  return { ownerCents, tradieCents, platformCents: ownerCents - tradieCents };
}

/** The platform's fee on an amount, rounded to the nearest cent. 1500 basis points is 15%. */
export function platformFee(cents: number, feeBps: number): number {
  whole(cents, "Amount");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) throw new Error(`Fee must be between 0 and 5000 basis points. Got ${feeBps}.`);
  return Math.round((cents * feeBps) / 10_000);
}

/** The payout the menu editor suggests for an owner price: the price less the platform fee. */
export function suggestedPayout(ownerPriceCents: number, feeBps: number): number {
  return ownerPriceCents - platformFee(ownerPriceCents, feeBps);
}

/**
 * The tradie's share of an urgent or after-hours surcharge: the surcharge less
 * the platform fee, the same 15% as on every other dollar. NZ$50 urgent pays
 * the tradie NZ$42.50; NZ$140 after hours pays NZ$119.
 */
export function surchargeShare(surchargeCents: number, feeBps: number): number {
  return whole(surchargeCents, "Surcharge") - platformFee(surchargeCents, feeBps);
}

/**
 * The tax inside a tax-inclusive amount. NZ$230 at 15% GST contains NZ$30 of
 * GST. Returns 0 when the rate is 0.
 */
export function taxPortion(inclusiveCents: number, taxRate: number): number {
  if (!Number.isInteger(inclusiveCents)) throw new Error("Amount must be whole cents.");
  if (!(taxRate >= 0 && taxRate < 1)) throw new Error(`Tax rate must be a fraction such as 0.15. Got ${taxRate}.`);
  const rateBps = Math.round(taxRate * 10_000);
  if (rateBps === 0) return 0;
  return Math.round((inclusiveCents * rateBps) / (10_000 + rateBps));
}

export type InitialJob = {
  /** The menu item, or null for off-menu work. */
  item: { name: string; ownerPriceCents: number; tradiePayoutCents: number } | null;
  urgent: boolean;
  afterHours: boolean;
  /** True when the property's tier covers the urgent surcharge for this job. */
  urgentIncluded: boolean;
};

/** The lines a job starts with, before any quote or parts. */
export function initialLines(market: PricingMarket, job: InitialJob): Line[] {
  const lines: Line[] = [];
  if (job.item) {
    if (job.item.tradiePayoutCents > job.item.ownerPriceCents) {
      throw new Error("A menu item cannot pay the tradie more than the owner is charged.");
    }
    lines.push({
      kind: "menu",
      label: job.item.name,
      ownerCents: whole(job.item.ownerPriceCents, "Menu price"),
      tradieCents: whole(job.item.tradiePayoutCents, "Menu payout"),
    });
  } else {
    lines.push({
      kind: "diagnosis",
      label: "Call-out and diagnosis",
      ownerCents: market.diagnosisFeeCents,
      tradieCents: market.diagnosisPayoutCents,
    });
  }
  if (job.urgent) {
    const surcharge = market.urgentSurchargeCents;
    lines.push({
      kind: "urgent",
      label: job.urgentIncluded ? "Urgent response (included in your membership)" : "Urgent response",
      ownerCents: job.urgentIncluded ? 0 : surcharge,
      tradieCents: surchargeShare(surcharge, market.platformFeeBps),
    });
  }
  if (job.afterHours) {
    const surcharge = market.afterHoursSurchargeCents;
    lines.push({
      kind: "after_hours",
      label: "After-hours call-out",
      ownerCents: surcharge,
      tradieCents: surchargeShare(surcharge, market.platformFeeBps),
    });
  }
  return lines;
}

export type QuoteAmounts = {
  ownerTotalCents: number;
  tradieTotalCents: number;
  platformCents: number;
  /** True when the owner must say yes before work starts. */
  needsApproval: boolean;
  /** In plain words, why approval is needed. Null when it is not. */
  approvalReason: string | null;
  lines: Line[];
};

/**
 * Works out a quote for extra or off-menu work. `labourCents` is the tradie's
 * price for the work as the owner will see it. Parts are not part of a quote
 * any more: they are added on their own (partLines, partsApproval below).
 * `alreadyApprovedCents` is what has been quoted, approved or added in parts
 * on this job so far, so several small amounts cannot add up past the limit
 * unnoticed.
 */
export function quoteAmounts(
  market: PricingMarket,
  input: { description: string; labourCents: number; limitCents?: number | null; alreadyApprovedCents?: number; creditCents?: number },
): QuoteAmounts {
  const labour = whole(input.labourCents, "Labour");
  if (labour <= 0) throw new Error("A quote needs a price for the work.");

  const fee = platformFee(labour, market.platformFeeBps);
  const lines: Line[] = [{ kind: "quote", label: input.description, ownerCents: labour, tradieCents: labour - fee }];
  // The call-out credit (DECISIONS.md, 2026-11-20, third entry): an off-menu job's call-out comes off its first
  // approved quote. It comes out of the quoted work for both sides, so the tradie is paid their share of
  // (quote - credit), on top of the call-out payout they keep. NZ$500 quote, NZ$225 credit: the owner pays
  // 50000 - 22500 = 27500 more; the tradie gets 27500 - 15% (4125) = 23375 more.
  const credit = Math.min(whole(input.creditCents ?? 0, "Credit"), labour);
  if (credit > 0) {
    const net = labour - credit;
    const tradieNet = net - platformFee(net, market.platformFeeBps);
    lines.push({ kind: "adjustment", label: "Call-out credit", ownerCents: -credit, tradieCents: tradieNet - (labour - fee) });
  }

  const limit = input.limitCents ?? market.approvalThresholdCents;
  const running = (input.alreadyApprovedCents ?? 0) + labour - credit;
  const approvalReason = running > limit ? "The quote is over the pre-approved limit." : null;

  const sum = totals(lines);
  return {
    ownerTotalCents: sum.ownerCents,
    tradieTotalCents: sum.tradieCents,
    platformCents: sum.platformCents,
    needsApproval: approvalReason !== null,
    approvalReason,
    lines,
  };
}

/**
 * Labour quoted by the hour at the market's fixed rate for the trade
 * (DECISIONS.md, 2026-11-20, third entry). Hours go in quarter hours. 1.5 hours
 * at NZ$160 is 24000; 0.25 hours at NZ$110 is 2750.
 */
export function hourlyLabour(hours: number, rateCents: number): number {
  whole(rateCents, "Rate");
  const quarters = Math.round(hours * 4);
  if (!(hours > 0) || Math.abs(quarters - hours * 4) > 1e-9 || quarters > 4 * 40) {
    throw new Error("Hours go in quarter hours: 0.25, 0.5, 0.75, 1 and so on, up to 40.");
  }
  return Math.round((quarters * rateCents) / 4);
}

// ---------------------------------------------------------------------------
// PARTS (DECISIONS.md, 2026-11-20)
// ---------------------------------------------------------------------------

/** What HostFix keeps of a price-list part: 3%, which covers the card fee. */
export const LIST_PART_FEE_BPS = 300;
/** What an off-list part costs the owner on top of the receipt: 20%, for sourcing it. */
export const RECEIPT_MARKUP_BPS = 2000;

/**
 * A part on the price list, at its fixed price. Two GU10 bulbs at NZ$13.00:
 * the owner pays 2600, the tradie gets 2600 less 3% (78) = 2522, we keep 78.
 */
export function listPartLine(name: string, unitCents: number, quantity: number): Line {
  whole(unitCents, "Price");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new Error("The quantity must be a whole number from 1 to 50.");
  const ownerCents = unitCents * quantity;
  const fee = platformFee(ownerCents, LIST_PART_FEE_BPS);
  return { kind: "parts", label: quantity > 1 ? `${name} x ${quantity}` : name, ownerCents, tradieCents: ownerCents - fee };
}

/**
 * A part off the list, from a receipt. `amountCents` is the part of the
 * receipt (including GST) used on this job. The owner pays it plus 20%; the
 * platform fee is taken from the 20% only. NZ$300: owner 36000, tradie
 * 30000 + 6000 - 900 = 35100 (the receipt plus 17%), we keep 900 (3%).
 */
export function receiptPartLine(market: Pick<PricingMarket, "platformFeeBps">, description: string, amountCents: number): Line {
  const amount = whole(amountCents, "Parts amount");
  if (amount <= 0) throw new Error("The parts amount must be more than zero.");
  const markup = Math.round((amount * RECEIPT_MARKUP_BPS) / 10_000);
  const fee = platformFee(markup, market.platformFeeBps);
  return { kind: "parts", label: description, ownerCents: amount + markup, tradieCents: amount + markup - fee };
}

export type PartsApproval = { needsApproval: boolean; reason: string | null };

/**
 * Whether new parts need the owner's yes first. Without asking, the job's
 * parts may come to the market's parts limit (NZ$150), and everything extra on
 * the job (approved quotes and parts) to the property's overall limit.
 * Amounts are what the owner pays.
 */
export function partsApproval(
  market: Pick<PricingMarket, "partsApprovalCents" | "approvalThresholdCents">,
  input: { newPartsCents: number; partsSoFarCents: number; extrasSoFarCents: number; limitCents?: number | null },
): PartsApproval {
  const parts = input.partsSoFarCents + input.newPartsCents;
  const extras = input.extrasSoFarCents + input.newPartsCents;
  const limit = input.limitCents ?? market.approvalThresholdCents;
  if (parts > market.partsApprovalCents) return { needsApproval: true, reason: "The parts on this job would come to more than can be bought without asking." };
  if (extras > limit) return { needsApproval: true, reason: "The extra work and parts on this job would be over the pre-approved limit." };
  return { needsApproval: false, reason: null };
}

/**
 * The tradie got there and could not get in. The job's own price is replaced
 * by the call-out fee (never more than the job would have cost). Surcharges
 * stay, because the tradie still came out urgently or after hours.
 */
export function noAccessLines(market: PricingMarket, lines: Line[]): Line[] {
  const base = lines.find((line) => line.kind === "menu" || line.kind === "diagnosis");
  const kept = lines.filter((line) => line.kind === "urgent" || line.kind === "after_hours");
  const ownerCents = Math.min(market.diagnosisFeeCents, base?.ownerCents ?? market.diagnosisFeeCents);
  const tradieCents = Math.min(market.diagnosisPayoutCents, base?.tradieCents ?? market.diagnosisPayoutCents, ownerCents);
  return [{ kind: "no_access", label: "Call-out: could not get into the property", ownerCents, tradieCents }, ...kept];
}

/**
 * Splits a refund between the platform and the tradie in the same proportion
 * as the original job, so a half refund takes half of each share. The parts
 * never add up to more than was paid.
 */
export function refundSplit(job: { ownerCents: number; tradieCents: number }, refundCents: number): { fromTradieCents: number; fromPlatformCents: number } {
  whole(refundCents, "Refund");
  if (refundCents > job.ownerCents) throw new Error("A refund cannot be more than the owner paid.");
  if (job.ownerCents === 0) return { fromTradieCents: 0, fromPlatformCents: 0 };
  const fromTradieCents = Math.min(job.tradieCents, Math.round((refundCents * job.tradieCents) / job.ownerCents));
  return { fromTradieCents, fromPlatformCents: refundCents - fromTradieCents };
}
