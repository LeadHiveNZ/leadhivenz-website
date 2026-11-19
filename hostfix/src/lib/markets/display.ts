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
 * the price list email (DECISIONS.md, 2026-11-20). Never "retail" or "about
 * retail": the price list is a fixed price, and anything else is the
 * merchant's price on the receipt plus 20%.
 */
export function partsWords(market: Pick<Market, "partsIncludedCents" | "currency">): string {
  return `Small parts up to ${formatMoney(market.partsIncludedCents, market.currency)} are in the price. Common parts are on the price list at a fixed price. Anything else is charged at the merchant's price plus 20% for sourcing it. Prices include GST.`;
}
