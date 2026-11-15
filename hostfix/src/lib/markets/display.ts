import type { Market, MembershipTier } from "@config/markets";
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

export function tierLine(tier: MembershipTier, market: Pick<Market, "currency" | "urgentSurchargeCents">): string {
  return `${tierPoints(tier, market).join(". ")}.`;
}
