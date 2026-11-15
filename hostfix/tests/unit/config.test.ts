import { describe, expect, it } from "vitest";
import { brand } from "@config/brand";
import { findMarket, launchMarket, markets } from "@config/markets";
import { findTrade, trades } from "@config/trades";
import menu from "../../seed/menu-queenstown.json";

const CURRENCY_FOR_COUNTRY = { NZ: "NZD", AU: "AUD" } as const;

describe("markets", () => {
  it("each has a unique, link-friendly code", () => {
    const slugs = markets.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(markets)("$name uses the right currency, a real timezone and a sensible tax rate", (market) => {
    expect(market.currency).toBe(CURRENCY_FOR_COUNTRY[market.country]);
    expect(() => new Intl.DateTimeFormat("en-NZ", { timeZone: market.timezone })).not.toThrow();
    expect(market.taxRate).toBeGreaterThanOrEqual(0);
    expect(market.taxRate).toBeLessThan(0.5);
  });

  it.each(markets)("$name prices are whole cents, with Priority above Essential", (market) => {
    const essential = market.tiers.find((t) => t.key === "essential");
    const priority = market.tiers.find((t) => t.key === "priority");
    expect(essential).toBeDefined();
    expect(priority).toBeDefined();
    for (const tier of market.tiers) {
      expect(Number.isInteger(tier.monthlyPriceCents)).toBe(true);
      expect(tier.monthlyPriceCents).toBeGreaterThan(0);
    }
    expect(priority!.monthlyPriceCents).toBeGreaterThan(essential!.monthlyPriceCents);
    expect(Number.isInteger(market.foundingDeposit.amountCents)).toBe(true);
    expect(market.foundingDeposit.amountCents).toBeGreaterThanOrEqual(100);
  });

  it("the launch market is Queenstown at the prices in the brief", () => {
    expect(launchMarket).toMatchObject({ slug: "queenstown", country: "NZ", currency: "NZD", taxRate: 0.15 });
    expect(launchMarket.tiers.map((t) => [t.key, t.monthlyPriceCents])).toEqual([
      ["essential", 9900],
      ["priority", 14900],
    ]);
    expect(findMarket("queenstown")).toBe(launchMarket);
    expect(findMarket("atlantis")).toBeUndefined();
  });
});

describe("trades", () => {
  it("each has a unique code and a label", () => {
    const keys = trades.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const trade of trades) expect(trade.label.length).toBeGreaterThan(2);
  });

  it("plumbing, gas and electrical work always needs a licence", () => {
    for (const key of ["plumber", "gasfitter", "electrician"]) {
      expect(findTrade(key)?.licenceRequired).toBe(true);
    }
    expect(findTrade("handyman")?.licenceRequired).toBe(false);
  });
});

describe("brand", () => {
  it("has a name and proper colour codes", () => {
    expect(brand.name.trim().length).toBeGreaterThan(0);
    for (const colour of Object.values(brand.colours)) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("the Queenstown menu file", () => {
  it("belongs to a real market and uses its currency", () => {
    const market = findMarket(menu.market);
    expect(market).toBeDefined();
    expect(menu.currency).toBe(market!.currency);
    expect(typeof menu.placeholderPrices).toBe("boolean");
  });

  it("has about 25 jobs with unique codes", () => {
    expect(menu.items.length).toBeGreaterThanOrEqual(20);
    expect(menu.items.length).toBeLessThanOrEqual(30);
    const codes = menu.items.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(menu.items)("$code has a known trade and sensible whole-dollar prices", (item) => {
    const trade = findTrade(item.trade);
    expect(trade, `unknown trade "${item.trade}"`).toBeDefined();
    expect(item.name.trim().length).toBeGreaterThan(5);
    expect(Number.isInteger(item.ownerPriceDollars)).toBe(true);
    expect(Number.isInteger(item.tradiePayoutDollars)).toBe(true);
    expect(item.tradiePayoutDollars).toBeGreaterThan(0);
    // The tradie is never paid more than the owner is charged.
    expect(item.tradiePayoutDollars).toBeLessThan(item.ownerPriceDollars);
    // A job in a licensed trade must itself be marked as needing a licence.
    if (trade!.licenceRequired) expect(item.licenceRequired).toBe(true);
  });

  it("carries the surcharges and the off-menu rules from the brief", () => {
    expect(menu.surcharges).toEqual({ urgentDollars: 80, afterHoursDollars: 120 });
    expect(menu.offMenu.ownerApprovalAboveDollars).toBe(400);
    expect(menu.offMenu.diagnosisTradiePayoutDollars).toBeLessThan(menu.offMenu.diagnosisFeeDollars);
  });
});
