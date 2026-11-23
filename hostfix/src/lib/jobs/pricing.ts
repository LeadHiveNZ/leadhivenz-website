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
 *  - Parts (DECISIONS.md, 2026-11-23), on any job: small parts up to the
 *    market's included amount (NZ$20) are in the price. Every other part is
 *    priced by the tradie, including GST (their cost plus their own usual
 *    markup). The owner pays that price; the tradie gets it less 3%, which
 *    covers the card fee. Above the no-ask limit the owner says yes first.
 *    Parts added before 23 November 2026 keep their terms: a price-list part
 *    at its list price less 3%, an off-list part at the receipt plus 20% with
 *    the tradie getting the receipt plus 17% (20 Nov 2026), and before 20 Nov
 *    2026 parts at cost with no fee.
 *  - Own clients (DECISIONS.md, 2026-11-23): a job between a tradie and a
 *    property they brought to HostFix themselves (an own-client pair) takes a
 *    5% platform fee instead of 15% on everything the 15% applies to: the
 *    menu share, the surcharges, the call-out, quotes and hourly work.
 *  - The tiered fee (DECISIONS.md, 2026-11-23, second entry): above NZ$1,000
 *    of a job's price (parts aside) the fee is 3%, not 15% (or 5%). Lines are
 *    priced as above; tierRelief gives the tradie the difference on the job.
 *  - Work that takes a job over NZ$1,000 takes a 50% deposit (depositFor).
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

/**
 * The platform fee on a job between an own-client pair (DECISIONS.md, 2026-11-23): 5%, which covers the card fees
 * (about 3%), the automatic texts and payment, and chasing late payers. Every other job pays the market's fee (15%).
 */
export const OWN_CLIENT_FEE_BPS = 500;

/**
 * The payout guarantee (DECISIONS.md, 2026-11-23). A finished job's payout never waits for the owner's card for the
 * first NZ$1,000 of the job's price. The market's own figure (payout_guarantee_cents, More > Markets) is what the
 * app uses; this is the starting value for a new market.
 */
export const PAYOUT_GUARANTEE_CENTS = 100_000;

/**
 * The tiered fee (DECISIONS.md, 2026-11-23, second entry). Of a job's price, parts aside, the first NZ$1,000 pays the
 * job's own fee (15%, or 5% between an own-client pair) and the part above it pays 3%. These are the starting values;
 * the market's own figures (markets.tier_threshold_cents, markets.above_tier_fee_bps) are what the app uses.
 */
export const TIER_THRESHOLD_CENTS = 100_000;
export const ABOVE_TIER_FEE_BPS = 300;

export type FeeTier = { thresholdCents: number; aboveBps: number };

/**
 * The fee on a job's price (parts aside) under the tier. NZ$15,000 at 15%: 15% of 100000 (15000) + 3% of 1400000
 * (42000) = 57000, so HostFix keeps NZ$570 and the tradie NZ$14,430. At 5% (an own client): 5000 + 42000 = 47000.
 * Up to the line it is the plain fee: NZ$800 at 15% is 12000.
 */
export function tieredFee(priceCents: number, feeBps: number, tier: FeeTier): number {
  whole(priceCents, "Price");
  const below = Math.min(priceCents, tier.thresholdCents);
  return platformFee(below, feeBps) + platformFee(priceCents - below, tier.aboveBps);
}

/**
 * What the tier adds to the tradie's share of a job (DECISIONS.md, 2026-11-23, second entry). Each line is priced as
 * it always was (a menu payout, a surcharge or a quote less 15%); once the job's price, parts aside, is over the line,
 * the fee on all of it becomes `tieredFee` instead, and the difference goes to the tradie. Never less than nothing: a
 * job whose lines already keep less than the tiered fee is left alone. Parts (their own 3%) and the "parts bought
 * before the job was cancelled" line (no fee) are left out of the price.
 * Worked: PL-01 (22500, tradie 19000) + 6.25 hours at NZ$160 (100000, tradie 85000): price 122500, fee kept by the
 * lines 3500 + 15000 = 18500, tiered fee 15000 + 3% of 22500 (675) = 15675, so the tradie gets 2825 more.
 */
export function tierRelief(lines: Pick<Line, "kind" | "label" | "ownerCents" | "tradieCents">[], feeBps: number, tier: FeeTier): number {
  let price = 0;
  let kept = 0;
  for (const line of lines) {
    if (line.kind === "parts") continue;
    if (line.kind === "adjustment" && line.ownerCents === line.tradieCents) continue;
    price += line.ownerCents;
    kept += line.ownerCents - line.tradieCents;
  }
  if (price <= tier.thresholdCents) return 0;
  return Math.max(0, kept - tieredFee(price, feeBps, tier));
}

/**
 * The deposit when approved work takes a job over NZ$1,000 (DECISIONS.md, 2026-11-23, second entry): half of the
 * approved amount the hold on the card does not already cover, taken when the owner approves. The other half is
 * taken at Job done with the rest of the job. A NZ$1,500 quote on PL-01 (22500 held, 22500 on the job): the hold
 * covers none of the quote, so 150000 / 2 = 75000. With 5000 of the hold spare (an urgent line that came off):
 * (150000 - 5000) / 2 = 72500. An odd cent goes in the deposit: 150001 gives 75001.
 */
export const DEPOSIT_BPS = 5000;
/** A quote that takes the job's total over this asks for the deposit. */
export const DEPOSIT_ABOVE_CENTS = 100_000;

export function depositFor(input: { quoteCents: number; holdCents: number; jobTotalCents: number }): number {
  const spare = Math.max(0, whole(input.holdCents, "Hold") - Math.max(0, input.jobTotalCents));
  const uncovered = Math.max(0, whole(input.quoteCents, "Quote") - spare);
  return uncovered - Math.floor((uncovered * (10_000 - DEPOSIT_BPS)) / 10_000);
}

/** The market's numbers with a job's own fee in place of the market's: the own-client rate when the job has one. */
export function withFee<T extends Pick<Market, "platformFeeBps">>(market: T, feeBps: number | null | undefined): T {
  return feeBps === null || feeBps === undefined ? market : { ...market, platformFeeBps: feeBps };
}

/**
 * What the tradie gets of the call-out. At the market's own fee it is the market's call-out payout (NZ$190 of
 * NZ$225). At another fee (an own-client job) it is the call-out less that fee: NZ$225 less 5% (1125) = 21375.
 */
export function callOutPayout(market: Pick<Market, "diagnosisFeeCents" | "diagnosisPayoutCents" | "platformFeeBps">, feeBps: number | null | undefined): number {
  if (feeBps === null || feeBps === undefined || feeBps === market.platformFeeBps) return market.diagnosisPayoutCents;
  return market.diagnosisFeeCents - platformFee(market.diagnosisFeeCents, feeBps);
}

/**
 * The lines a job starts with, priced again at the own-client fee once the tradie of an own-client pair takes it
 * (DECISIONS.md, 2026-11-23). The owner pays the same; only the tradie's share changes. The menu line: the price
 * less 5% (PL-03, NZ$235: 23500 - 1175 = 22325, instead of the menu's 20000). The call-out: 22500 - 1125 = 21375.
 * A surcharge: the market's surcharge less 5% (NZ$50 urgent: 4750), also when a membership covers it for the owner.
 * Any other line is left as it is.
 */
export function ownClientLines<T extends Pick<Line, "kind" | "ownerCents" | "tradieCents">>(
  market: Pick<Market, "urgentSurchargeCents" | "afterHoursSurchargeCents" | "diagnosisFeeCents">, lines: T[], feeBps: number = OWN_CLIENT_FEE_BPS,
): T[] {
  return lines.map((line) => {
    switch (line.kind) {
      case "menu":
      case "diagnosis":
        return { ...line, tradieCents: line.ownerCents - platformFee(line.ownerCents, feeBps) };
      case "urgent":
        return { ...line, tradieCents: surchargeShare(line.ownerCents > 0 ? line.ownerCents : market.urgentSurchargeCents, feeBps) };
      case "after_hours":
        return { ...line, tradieCents: surchargeShare(line.ownerCents > 0 ? line.ownerCents : market.afterHoursSurchargeCents, feeBps) };
      default:
        return line;
    }
  });
}

/**
 * How much of a finished job's payout waits for the owner's card (DECISIONS.md, 2026-11-23). Of the job's price, the
 * part the owner has not paid yet is `ownerTotal - collected`. HostFix pays the tradie ahead of the card for up to
 * `guarantee` (NZ$1,000) of it. The tradie's share of anything above that waits until it is collected, in the
 * job's own proportion (tradie total / owner total). Worked by hand: a NZ$1,500 job, tradie 127500, the hold took
 * NZ$235 and the NZ$1,265 charge for the rest failed: not collected 126500, over the guarantee 26500, waits
 * 26500 x 127500 / 150000 = 22525, so 127500 - 22525 = 104975 goes at the usual time.
 */
export function payoutWaits(input: { ownerTotalCents: number; collectedCents: number; guaranteeCents: number; payoutCents: number }): number {
  const owner = whole(input.ownerTotalCents, "Owner total");
  if (owner === 0) return 0;
  const notCollected = Math.max(0, owner - whole(input.collectedCents, "Collected"));
  const over = Math.max(0, notCollected - whole(input.guaranteeCents, "Guarantee"));
  if (over === 0) return 0;
  return Math.min(whole(input.payoutCents, "Payout"), Math.round((over * input.payoutCents) / owner));
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
// PARTS (DECISIONS.md, 2026-11-23; parts added before then: 2026-11-20)
// ---------------------------------------------------------------------------

/** What HostFix keeps of a part: 3%, which covers the card fee. */
export const LIST_PART_FEE_BPS = 300;
/** The same 3%, by the name it has had since 23 November 2026, when every part became the tradie's own price. */
export const PART_FEE_BPS = LIST_PART_FEE_BPS;

/**
 * A part at the tradie's own price including GST (their cost plus their own usual markup), from 23 November 2026.
 * The owner pays it; the tradie gets it less 3%. A NZ$45 inlet valve: owner 4500, tradie 4500 - 135 = 4365, we
 * keep 135. Two at NZ$13.50: owner 2700, tradie 2700 - 81 = 2619.
 */
export function pricedPartLine(name: string, unitCents: number, quantity: number): Line {
  return listPartLine(name, unitCents, quantity);
}
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
export function noAccessLines(market: PricingMarket, lines: Line[], feeBps?: number | null): Line[] {
  const base = lines.find((line) => line.kind === "menu" || line.kind === "diagnosis");
  const kept = lines.filter((line) => line.kind === "urgent" || line.kind === "after_hours");
  const ownerCents = Math.min(market.diagnosisFeeCents, base?.ownerCents ?? market.diagnosisFeeCents);
  const payout = callOutPayout(market, feeBps);
  const tradieCents = Math.min(payout, base?.tradieCents ?? payout, ownerCents);
  return [{ kind: "no_access", label: "Call-out: could not get into the property", ownerCents, tradieCents }, ...kept];
}

/**
 * The owner cancels after the tradie tapped Arrived (DECISIONS.md, 2026-11-23): the call-out is charged instead of
 * the job (never more than the job would have cost), and the tradie is paid their share of it as for a call-out.
 * Surcharges stay, because the tradie still came out urgently or after hours, the same as "could not get in".
 * PL-03 (owner 23500, tradie 20000), cancelled after Arrived: owner 22500, tradie 19000.
 */
export function cancelledOnSiteLines(market: PricingMarket, lines: Line[], feeBps?: number | null): Line[] {
  const base = lines.find((line) => line.kind === "menu" || line.kind === "diagnosis");
  const kept = lines.filter((line) => line.kind === "urgent" || line.kind === "after_hours");
  const ownerCents = Math.min(market.diagnosisFeeCents, base?.ownerCents ?? market.diagnosisFeeCents);
  const payout = callOutPayout(market, feeBps);
  const tradieCents = Math.min(payout, ownerCents);
  return [{ kind: "diagnosis", label: "Call-out: cancelled after the tradie arrived", ownerCents, tradieCents }, ...kept];
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
