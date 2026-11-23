import { payoutArrival, type Market, type MembershipTier } from "@config/markets";
import { formatMoney } from "@/lib/money";

/** What a membership gives, as short plain lines. Built from the tier's settings so it can never drift from them. */
export function tierPoints(tier: MembershipTier, market: Pick<Market, "currency" | "urgentSurchargeCents">): string[] {
  const points = [`A tradie on site within ${tier.responseHours} hours`];
  if (tier.urgentIncluded) {
    points.push(
      tier.urgentIncludedPerMonth === null
        ? `Urgent call-outs (within ${tier.urgentResponseHours} hours) at no extra cost`
        : `${tier.urgentIncludedPerMonth} urgent ${tier.urgentIncludedPerMonth === 1 ? "call-out" : "call-outs"} a month (within ${tier.urgentResponseHours} hours) at no extra cost`,
    );
  } else {
    points.push(`Urgent call-outs (within ${tier.urgentResponseHours} hours) for ${formatMoney(market.urgentSurchargeCents, market.currency)} extra`);
  }
  if (tier.quarterlyCheck) points.push("A property check every three months");
  return points;
}

/**
 * When a tradie's money is sent, and when it reaches their bank, in the same
 * words on every screen. "Sent" is ours to decide (the hold on the market's
 * settings). "In your bank" is not: see payoutArrival in config/markets.ts.
 */
export function payTiming(market: Pick<Market, "country" | "payoutHoldHours">): { sent: string; arrives: string; line: string } {
  const sent = market.payoutHoldHours <= 0 ? "as soon as the job is done" : `about ${market.payoutHoldHours} hours after the job is done`;
  const arrives = `about ${payoutArrival(market.country)} after the job`;
  return { sent, arrives, line: `Paid automatically: sent ${sent}, and in your bank ${arrives}.` };
}

export function tierLine(tier: MembershipTier, market: Pick<Market, "currency" | "urgentSurchargeCents">): string {
  return `${tierPoints(tier, market).join(". ")}.`;
}

/**
 * What a per-property membership costs, in the words shown beside it: "Free to
 * join" for a free one (DECISIONS.md, 2026-11-17), "NZ$99 a month" otherwise.
 */
export function tierPriceLabel(tier: Pick<MembershipTier, "monthlyPriceCents">, currency: string): string {
  return tier.monthlyPriceCents === 0 ? "Free to join" : `${formatMoney(tier.monthlyPriceCents, currency)} a month`;
}

/**
 * How parts are priced, in the same words on every owner page, the terms and
 * the price list email (DECISIONS.md, 2026-11-23). Never "retail" or "at
 * cost": a part is the tradie's own price, including GST, and the owner is
 * asked first above the no-ask limit.
 */
export function partsWords(market: Pick<Market, "partsIncludedCents" | "partsApprovalCents" | "currency">): string {
  return `Small parts up to ${formatMoney(market.partsIncludedCents, market.currency)} are in the price. Other parts are charged at the tradie's price, including GST, and above ${formatMoney(market.partsApprovalCents, market.currency)} of parts on a job you say yes first.`;
}

/**
 * The platform fee in one line, for the tradie (DECISIONS.md, 2026-11-23, second entry): the job's fee (15%, or 5% for
 * an own client) on the first NZ$1,000 of the job's price and 3% on the part above, parts aside. "15% of the first
 * NZ$1,000 of the job's price, 3% of the rest".
 */
export function feeWords(market: Pick<Market, "platformFeeBps" | "tierThresholdCents" | "aboveTierFeeBps" | "currency">, feeBps?: number | null): string {
  const below = (feeBps ?? market.platformFeeBps) / 100;
  return `${below}% of the first ${formatMoney(market.tierThresholdCents, market.currency)} of the job's price, ${market.aboveTierFeeBps / 100}% of the rest`;
}

/** The label of the line that gives the tradie the lower fee above the line. */
export function tierLineWords(market: Pick<Market, "tierThresholdCents" | "aboveTierFeeBps" | "currency">): string {
  return `Fee only ${market.aboveTierFeeBps / 100}% above ${formatMoney(market.tierThresholdCents, market.currency)} of the price`;
}
