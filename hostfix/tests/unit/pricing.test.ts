import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { initialLines, noAccessLines, platformFee, quoteAmounts, refundSplit, suggestedPayout, taxPortion, totals } from "@/lib/jobs/pricing";

const market = launchMarket;
const mixer = { name: "Replace shower mixer", ownerPriceCents: 18000, tradiePayoutCents: 13000 };

describe("a menu job", () => {
  it("charges the menu price and pays the menu payout", () => {
    const lines = initialLines(market, { item: mixer, urgent: false, afterHours: false, urgentIncluded: false });
    expect(lines).toEqual([{ kind: "menu", label: "Replace shower mixer", ownerCents: 18000, tradieCents: 13000 }]);
    expect(totals(lines)).toEqual({ ownerCents: 18000, tradieCents: 13000, platformCents: 5000 });
  });

  it("pays the urgent surcharge to the tradie in full (the worked example in the plan)", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: false, urgentIncluded: false });
    expect(totals(lines)).toEqual({ ownerCents: 26000, tradieCents: 21000, platformCents: 5000 });
  });

  it("pays the after-hours surcharge to the tradie in full, on top of urgent", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: true, urgentIncluded: false });
    expect(lines.map((l) => l.kind)).toEqual(["menu", "urgent", "after_hours"]);
    expect(totals(lines)).toEqual({ ownerCents: 38000, tradieCents: 33000, platformCents: 5000 });
  });

  it("does not charge the owner for urgent when the tier includes it, but still pays the tradie", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: false, urgentIncluded: true });
    expect(lines[1]).toMatchObject({ kind: "urgent", ownerCents: 0, tradieCents: 8000 });
    expect(totals(lines)).toEqual({ ownerCents: 18000, tradieCents: 21000, platformCents: -3000 });
  });

  it("still charges after-hours when urgent is included", () => {
    const lines = initialLines(market, { item: mixer, urgent: true, afterHours: true, urgentIncluded: true });
    expect(totals(lines).ownerCents).toBe(18000 + 12000);
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
    expect(lines).toEqual([{ kind: "diagnosis", label: "Call-out and diagnosis", ownerCents: 12000, tradieCents: 10200 }]);
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

  it("goes ahead without asking at or under NZ$400", () => {
    expect(quoteAmounts(market, { description: "x", labourCents: 40000, partsCents: 0 }).needsApproval).toBe(false);
    expect(quoteAmounts(market, { description: "x", labourCents: 30000, partsCents: 10000 }).needsApproval).toBe(false);
  });

  it("needs the owner's approval over NZ$400", () => {
    const quote = quoteAmounts(market, { description: "x", labourCents: 40001, partsCents: 0 });
    expect(quote.needsApproval).toBe(true);
    expect(quote.approvalReason).toContain("limit");
  });

  it("counts earlier approved quotes on the same job towards the limit", () => {
    const quote = quoteAmounts(market, { description: "x", labourCents: 15000, partsCents: 0, alreadyApprovedCents: 30000 });
    expect(quote.needsApproval).toBe(true);
  });

  it("uses the owner's own limit when they have set one", () => {
    expect(quoteAmounts(market, { description: "x", labourCents: 20000, partsCents: 0, limitCents: 15000 }).needsApproval).toBe(true);
    expect(quoteAmounts(market, { description: "x", labourCents: 60000, partsCents: 0, limitCents: 100000 }).needsApproval).toBe(false);
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
    expect(totals(result)).toEqual({ ownerCents: 12000 + 8000 + 12000, tradieCents: 10200 + 8000 + 12000, platformCents: 1800 });
  });

  it("never charges more than the job itself would have cost", () => {
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
