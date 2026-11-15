import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("shows whole dollars without cents", () => {
    expect(formatMoney(4900, "NZD")).toBe("NZ$49");
    expect(formatMoney(9900, "NZD")).toBe("NZ$99");
    expect(formatMoney(14900, "AUD")).toBe("A$149");
  });

  it("shows cents when there are any", () => {
    expect(formatMoney(4950, "NZD")).toBe("NZ$49.50");
    expect(formatMoney(5, "NZD")).toBe("NZ$0.05");
    expect(formatMoney(100001, "AUD")).toBe("A$1,000.01");
  });

  it("adds thousands separators", () => {
    expect(formatMoney(123456700, "NZD")).toBe("NZ$1,234,567");
  });

  it("handles zero and negatives (refunds, credits)", () => {
    expect(formatMoney(0, "NZD")).toBe("NZ$0");
    expect(formatMoney(-4900, "NZD")).toBe("-NZ$49");
    expect(formatMoney(-150, "AUD")).toBe("-A$1.50");
  });

  it("accepts the lowercase codes Stripe uses", () => {
    expect(formatMoney(4900, "nzd")).toBe("NZ$49");
  });

  it("falls back to the code for a currency it has no symbol for", () => {
    expect(formatMoney(4900, "USD")).toBe("USD 49");
  });

  it("refuses fractions of a cent, so rounding mistakes are caught early", () => {
    expect(() => formatMoney(49.5, "NZD")).toThrow(/whole number of cents/);
    expect(() => formatMoney(Number.NaN, "NZD")).toThrow();
  });
});
