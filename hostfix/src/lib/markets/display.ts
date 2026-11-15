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
