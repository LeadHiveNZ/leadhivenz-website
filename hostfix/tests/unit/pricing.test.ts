import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { initialLines, noAccessLines, platformFee, quoteAmounts, refundSplit, suggestedPayout, surchargeShare, taxPortion, totals } from "@/lib/jobs/pricing";

const market = launchMarket;

/**
 * THE NUMBERS THESE TESTS ARE BUILT ON, worked out by hand from
 * seed/menu-queenstown.json and config/markets.ts:
 *   PL-03 Dripping tap or tap washer: owner 23500, tradie 20000, so we keep 3500
 *   PL-05 Shower head or mixer replace: the same, owner 23500, tradie 20000
 *   urgent surcharge 5000, after-hours surcharge 14000 (DECISIONS.md, 2026-11-18)
 *   both surcharges carry the same 15% fee as everything else:
 *     urgent:      15% of 5000  = 750,  so the tradie gets 5000 - 750   = 4250
 *     after hours: 15% of 14000 = 2100, so the tradie gets 14000 - 2100 = 11900
 *   call-out for off-menu work, or when the tradie cannot get in: owner 22500, tradie 19000
 *   quotes above 60000 need the owner's yes, and so do parts above 15000
 * If any of those change, work the expected totals out again. Do not copy the code's answers.
 */
const tap = { name: "Dripping tap or tap washer", ownerPriceCents: 23500, tradiePayoutCents: 20000 };
const mixer = { name: "Shower head or mixer replace", ownerPriceCents: 23500, tradiePayoutCents: 20000 };

describe("a menu job", () => {
  it("charges the menu price and pays the menu payout", () => {
    const lines = initialLines(market, { item: mixer, urgent: false, afterHours: false, urgentIncluded: false });
    expect(lines).toEqual([{ kind: "menu", label: "Shower head or mixer replace", ownerCents: 23500, tradieCents: 20000 }]);
    expect(totals(lines)).toEqual({ ownerCents: 23500, tradieCents: 20000, platformCents: 3500 });
  });

  it("urgent: the owner pays NZ$50 more, the tradie gets it less our 15%", () => {
    const lines = initialLines(market, { item: tap, urgent: true, afterHours: false, urgentIncluded: false });
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 5000, tradieCents: 4250 });
    // Owner 23500 + 5000 = 28500. Tradie 20000 + 4250 = 24250. We keep 3500 + 750 = 4250.
    expect(totals(lines)).toEqual({ ownerCents: 28500, tradieCents: 24250, platformCents: 4250 });
  });

  it("after hours: the owner pays NZ$140 more, the tradie gets it less our 15%", () => {
    const lines = initialLines(market, { item: tap, urgent: false, afterHours: true, urgentIncluded: false });
    expect(lines[1]).toMatchObject({ kind: "after_hours", ownerCents: 14000, tradieCents: 11900 });
    // Owner 23500 + 14000 = 37500. Tradie 20000 + 11900 = 31900. We keep 3500 + 2100 = 5600.
    expect(totals(lines)).toEqual({ ownerCents: 37500, tradieCents: 31900, platformCents: 5600 });
  });

  it("urgent and after hours together: both carry the fee", () => {
    const lines = initialLines(market, { item: tap, urgent: true, afterHours: true, urgentIncluded: false });
    expect(lines.map((l) => l.kind)).toEqual(["menu", "urgent", "after_hours"]);
    // Owner 23500 + 5000 + 14000 = 42500. Tradie 20000 + 4250 + 11900 = 36150. We keep 3500 + 750 + 2100 = 6350.
    expect(totals(lines)).toEqual({ ownerCents: 42500, tradieCents: 36150, platformCents: 6350 });
  });

  it("does not charge the owner for urgent when the tier includes it, but still pays the tradie their share", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: false, urgentIncluded: true });
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 0, tradieCents: 4250 });
    // The owner pays 23500, the tradie is still due 20000 + 4250 = 24250. We are 750 out of pocket:
    // the 4250 we cover, less the 3500 we kept. This is why no membership includes urgent call-outs today (DECISIONS.md).
    expect(totals(lines)).toEqual({ ownerCents: 23500, tradieCents: 24250, platformCents: -750 });
  });

  it("still charges after-hours when urgent is included", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: true, urgentIncluded: true });
    expect(totals(lines).ownerCents).toBe(23500 + 14000);
  });

  it("refuses a menu item that pays out more than it charges", () => {
    expect(() =>
      initialLines(market, { item: { name: "x", ownerPriceCents: 100, tradiePayoutCents: 101 }, urgent: false, afterHours: false, urgentIncluded: false }),
    ).toThrow();
  });
});

describe("the tradie's share of a surcharge", () => {
  it("is the surcharge less 15%, both exact for the Queenstown amounts", () => {
    // 15% of 5000 is 750; 15% of 14000 is 2100. No rounding.
    expect(surchargeShare(5000, 1500)).toBe(4250);
    expect(surchargeShare(14000, 1500)).toBe(11900);
  });

  it("rounds the fee to the nearest cent on a surcharge that does not divide evenly", () => {
    // 15% of 3333 is 499.95, which rounds to a fee of 500, so the tradie gets 3333 - 500 = 2833.
    expect(platformFee(3333, 1500)).toBe(500);
    expect(surchargeShare(3333, 1500)).toBe(2833);
    // 15% of 3330 is exactly 499.5: half a cent rounds up to a fee of 500, so the tradie gets 2830.
    expect(surchargeShare(3330, 1500)).toBe(2830);
    // Through a whole job: a market whose urgent surcharge is 3333. Owner 23500 + 3333 = 26833,
    // tradie 20000 + 2833 = 22833, we keep 3500 + 500 = 4000.
    const odd = { ...market, urgentSurchargeCents: 3333 };
    expect(totals(initialLines(odd, { item: tap, urgent: true, afterHours: false, urgentIncluded: false }))).toEqual({ ownerCents: 26833, tradieCents: 22833, platformCents: 4000 });
  });

  it("refuses a surcharge that is not whole cents", () => {
    expect(() => surchargeShare(50.5, 1500)).toThrow();
  });
});

describe("an off-menu job", () => {
  it("starts with the fixed diagnosis fee", () => {
    const lines = initialLines(market, { item: null, urgent: false, afterHours: false, urgentIncluded: false });
    expect(lines).toEqual([{ kind: "diagnosis", label: "Call-out and diagnosis", ownerCents: 22500, tradieCents: 19000 }]);
  });
});

describe("the platform fee", () => {
  it("is 15% by default, rounded to the nearest cent", () => {
    expect(platformFee(10000, 1500)).toBe(1500);
    expect(platformFee(9999, 1500)).toBe(1500);
    expect(platformFee(3333, 1500)).toBe(500);
    expect(platformFee(0, 1500)).toBe(0);
  });

  it("can be set per market", () => {
    expect(platformFee(10000, 1250)).toBe(1250);
    expect(platformFee(10000, 0)).toBe(0);
    expect(() => platformFee(10000, 6000)).toThrow();
  });

  it("suggests a payout of the price less the fee", () => {
    expect(suggestedPayout(22000, 1500)).toBe(18700);
    expect(suggestedPayout(11000, 1500)).toBe(9350);
  });

  it("never loses or invents a cent", () => {
    for (const price of [1, 99, 101, 12345, 99999]) {
      expect(platformFee(price, 1500) + suggestedPayout(price, 1500)).toBe(price);
    }
  });
});

describe("tax inside a price", () => {
  it("finds the GST in a GST-inclusive amount", () => {
    expect(taxPortion(23000, 0.15)).toBe(3000);
    expect(taxPortion(11000, 0.1)).toBe(1000);
    expect(taxPortion(26000, 0.15)).toBe(3391);
  });

  it("is zero when there is no tax", () => {
    expect(taxPortion(23000, 0)).toBe(0);
  });

  it("refuses a rate that is not a fraction", () => {
    expect(() => taxPortion(100, 15)).toThrow();
    expect(() => taxPortion(100.5, 0.15)).toThrow();
  });
});

describe("a quote", () => {
  it("keeps the platform fee on the work: NZ$200 of work pays the tradie NZ$170", () => {
    const quote = quoteAmounts(market, { description: "Replace cistern", labourCents: 20000 });
    expect(quote.ownerTotalCents).toBe(20000);
    expect(quote.tradieTotalCents).toBe(17000);
    expect(quote.platformCents).toBe(3000);
    expect(quote.lines.map((l) => l.kind)).toEqual(["quote"]);
  });

  it("goes ahead without asking at or under NZ$600", () => {
    expect(quoteAmounts(market, { description: "x", labourCents: 60000 }).needsApproval).toBe(false);
  });

  it("needs the owner's approval over NZ$600", () => {
    const quote = quoteAmounts(market, { description: "x", labourCents: 60001 });
    expect(quote.needsApproval).toBe(true);
    expect(quote.approvalReason).toContain("limit");
  });

  it("counts earlier approved quotes and parts on the same job towards the limit", () => {
    // NZ$400 already approved. Another NZ$200 lands exactly on the limit and goes ahead. NZ$250 goes over it.
    expect(quoteAmounts(market, { description: "x", labourCents: 20000, alreadyApprovedCents: 40000 }).needsApproval).toBe(false);
    const quote = quoteAmounts(market, { description: "x", labourCents: 25000, alreadyApprovedCents: 40000 });
    expect(quote.needsApproval).toBe(true);
  });

  it("uses the owner's own limit when they have set one", () => {
    expect(quoteAmounts(market, { description: "x", labourCents: 20000, limitCents: 15000 }).needsApproval).toBe(true);
    // An owner who has set NZ$1,000 lets through a quote the market's own NZ$600 would have stopped.
    expect(quoteAmounts(market, { description: "x", labourCents: 70000, limitCents: 100000 }).needsApproval).toBe(false);
  });

  it("refuses an empty quote and anything that is not whole cents", () => {
    expect(() => quoteAmounts(market, { description: "x", labourCents: 0 })).toThrow();
    expect(() => quoteAmounts(market, { description: "x", labourCents: 10.5 })).toThrow();
    expect(() => quoteAmounts(market, { description: "x", labourCents: -1 })).toThrow();
  });
});

describe("when the tradie could not get in", () => {
  it("charges the call-out fee instead of the job, and keeps the surcharges", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: true, urgentIncluded: false });
    const result = noAccessLines(market, lines);
    expect(result.map((l) => l.kind)).toEqual(["no_access", "urgent", "after_hours"]);
    // The NZ$235 job becomes the NZ$225 call-out (NZ$190 to the tradie). Both surcharges stay, with their fee:
    // owner 22500 + 5000 + 14000 = 41500, tradie 19000 + 4250 + 11900 = 35150, we keep 3500 + 750 + 2100 = 6350.
    expect(totals(result)).toEqual({ ownerCents: 41500, tradieCents: 35150, platformCents: 6350 });
  });

  it("never charges more than the job itself would have cost", () => {
    // HM-01, shelf hanging, is NZ$155 to the owner and NZ$130 to the tradie: less than the call-out, so it stays as it is.
    const shelf = initialLines(market, { item: { name: "Shelf, hook or mirror hanging", ownerPriceCents: 15500, tradiePayoutCents: 13000 }, urgent: false, afterHours: false, urgentIncluded: false });
    expect(totals(noAccessLines(market, shelf))).toEqual({ ownerCents: 15500, tradieCents: 13000, platformCents: 2500 });
    const cheap = initialLines(market, { item: { name: "Bulbs", ownerPriceCents: 9000, tradiePayoutCents: 7600 }, urgent: false, afterHours: false, urgentIncluded: false });
    expect(totals(noAccessLines(market, cheap))).toEqual({ ownerCents: 9000, tradieCents: 7600, platformCents: 1400 });
  });
});

describe("splitting a refund", () => {
  it("takes the same share from the tradie and the platform as the job gave them", () => {
    expect(refundSplit({ ownerCents: 26000, tradieCents: 21000 }, 13000)).toEqual({ fromTradieCents: 10500, fromPlatformCents: 2500 });
    expect(refundSplit({ ownerCents: 26000, tradieCents: 21000 }, 26000)).toEqual({ fromTradieCents: 21000, fromPlatformCents: 5000 });
  });

  it("on a full refund of a job where the platform was paying the urgent surcharge, nobody is out of pocket", () => {
    // Owner paid 180, tradie was due 210 (the platform was adding 30). A full
    // refund keeps all 210 back from the tradie and the platform saves its 30.
    expect(refundSplit({ ownerCents: 18000, tradieCents: 21000 }, 18000)).toEqual({ fromTradieCents: 21000, fromPlatformCents: -3000 });
  });

  it("splits a refund on an urgent job by the shares the job gave, surcharge fee included", () => {
    // Dripping tap, urgent: owner 28500, tradie 24250, we keep 4250.
    // Full refund: all 24250 back from the tradie, 4250 from us.
    expect(refundSplit({ ownerCents: 28500, tradieCents: 24250 }, 28500)).toEqual({ fromTradieCents: 24250, fromPlatformCents: 4250 });
    // Half refund, 14250: the tradie's half is 24250 / 2 = 12125, ours 14250 - 12125 = 2125.
    expect(refundSplit({ ownerCents: 28500, tradieCents: 24250 }, 14250)).toEqual({ fromTradieCents: 12125, fromPlatformCents: 2125 });
  });

  it("refuses a refund bigger than the payment", () => {
    expect(() => refundSplit({ ownerCents: 100, tradieCents: 80 }, 101)).toThrow();
  });
});
