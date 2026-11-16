import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { initialLines, noAccessLines, platformFee, quoteAmounts, refundSplit, suggestedPayout, taxPortion, totals } from "@/lib/jobs/pricing";

const market = launchMarket;

/**
 * THE NUMBERS THESE TESTS ARE BUILT ON, worked out by hand from
 * seed/menu-queenstown.json and config/markets.ts:
 *   PL-05 Shower head or mixer replace: owner 23500, tradie 20000, so we keep 3500
 *   urgent surcharge 9000, after-hours surcharge 14000 (the tradie gets all of both)
 *   call-out for off-menu work, or when the tradie cannot get in: owner 22500, tradie 19000
 *   quotes above 60000 need the owner's yes, and so do parts above 15000
 * If any of those change, work the expected totals out again. Do not copy the code's answers.
 */
const mixer = { name: "Shower head or mixer replace", ownerPriceCents: 23500, tradiePayoutCents: 20000 };

describe("a menu job", () => {
  it("charges the menu price and pays the menu payout", () => {
    const lines = initialLines(market, { item: mixer, urgent: false, afterHours: false, urgentIncluded: false });
    expect(lines).toEqual([{ kind: "menu", label: "Shower head or mixer replace", ownerCents: 23500, tradieCents: 20000 }]);
    expect(totals(lines)).toEqual({ ownerCents: 23500, tradieCents: 20000, platformCents: 3500 });
  });

  it("pays the urgent surcharge to the tradie in full", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: false, urgentIncluded: false });
    // 235 + 90 to the owner, 200 + 90 to the tradie. What we keep does not move.
    expect(totals(lines)).toEqual({ ownerCents: 32500, tradieCents: 29000, platformCents: 3500 });
  });

  it("pays the after-hours surcharge to the tradie in full, on top of urgent", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: true, urgentIncluded: false });
    expect(lines.map((l) => l.kind)).toEqual(["menu", "urgent", "after_hours"]);
    // 235 + 90 + 140 to the owner, 200 + 90 + 140 to the tradie.
    expect(totals(lines)).toEqual({ ownerCents: 46500, tradieCents: 43000, platformCents: 3500 });
  });

  it("does not charge the owner for urgent when the tier includes it, but still pays the tradie", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: false, urgentIncluded: true });
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 0, tradieCents: 9000 });
    // The owner pays 235, the tradie is still due 290. We are NZ$55 out of pocket: the 90 we cover, less the 35 we kept.
    // This is why no membership includes urgent call-outs today (DECISIONS.md).
    expect(totals(lines)).toEqual({ ownerCents: 23500, tradieCents: 29000, platformCents: -5500 });
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
  it("keeps the platform fee on the work and passes parts on at cost", () => {
    const quote = quoteAmounts(market, { description: "Replace cistern", labourCents: 20000, partsCents: 6000 });
    expect(quote.ownerTotalCents).toBe(26000);
    expect(quote.tradieTotalCents).toBe(17000 + 6000);
    expect(quote.platformCents).toBe(3000);
    expect(quote.lines.map((l) => l.kind)).toEqual(["quote", "parts"]);
  });

  it("goes ahead without asking at or under NZ$600", () => {
    expect(quoteAmounts(market, { description: "x", labourCents: 60000, partsCents: 0 }).needsApproval).toBe(false);
    expect(quoteAmounts(market, { description: "x", labourCents: 50000, partsCents: 10000 }).needsApproval).toBe(false);
  });

  it("needs the owner's approval over NZ$600", () => {
    const quote = quoteAmounts(market, { description: "x", labourCents: 60001, partsCents: 0 });
    expect(quote.needsApproval).toBe(true);
    expect(quote.approvalReason).toContain("limit");
  });

  it("counts earlier approved quotes on the same job towards the limit", () => {
    // NZ$400 already approved. Another NZ$200 lands exactly on the limit and goes ahead. NZ$250 goes over it.
    expect(quoteAmounts(market, { description: "x", labourCents: 20000, partsCents: 0, alreadyApprovedCents: 40000 }).needsApproval).toBe(false);
    const quote = quoteAmounts(market, { description: "x", labourCents: 25000, partsCents: 0, alreadyApprovedCents: 40000 });
    expect(quote.needsApproval).toBe(true);
  });

  it("uses the owner's own limit when they have set one", () => {
    expect(quoteAmounts(market, { description: "x", labourCents: 20000, partsCents: 0, limitCents: 15000 }).needsApproval).toBe(true);
    // An owner who has set NZ$1,000 lets through a quote the market's own NZ$600 would have stopped.
    expect(quoteAmounts(market, { description: "x", labourCents: 70000, partsCents: 0, limitCents: 100000 }).needsApproval).toBe(false);
  });

  it("needs approval for expensive parts even when the total is under the limit", () => {
    const quote = quoteAmounts(market, { description: "x", labourCents: 0, partsCents: 15001 });
    expect(quote.needsApproval).toBe(true);
    expect(quote.approvalReason).toContain("parts");
    expect(quoteAmounts(market, { description: "x", labourCents: 0, partsCents: 15000 }).needsApproval).toBe(false);
  });

  it("refuses an empty quote and anything that is not whole cents", () => {
    expect(() => quoteAmounts(market, { description: "x", labourCents: 0, partsCents: 0 })).toThrow();
    expect(() => quoteAmounts(market, { description: "x", labourCents: 10.5, partsCents: 0 })).toThrow();
    expect(() => quoteAmounts(market, { description: "x", labourCents: -1, partsCents: 0 })).toThrow();
  });
});

describe("when the tradie could not get in", () => {
  it("charges the call-out fee instead of the job, and keeps the surcharges", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: true, urgentIncluded: false });
    const result = noAccessLines(market, lines);
    expect(result.map((l) => l.kind)).toEqual(["no_access", "urgent", "after_hours"]);
    // The NZ$235 job becomes the NZ$225 call-out (NZ$190 to the tradie). Both surcharges stay.
    expect(totals(result)).toEqual({ ownerCents: 22500 + 9000 + 14000, tradieCents: 19000 + 9000 + 14000, platformCents: 3500 });
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

  it("refuses a refund bigger than the payment", () => {
    expect(() => refundSplit({ ownerCents: 100, tradieCents: 80 }, 101)).toThrow();
  });
});
