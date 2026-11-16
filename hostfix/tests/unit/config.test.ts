import { describe, expect, it } from "vitest";
import { brand } from "@config/brand";
import { findMarket, launchMarket, markets } from "@config/markets";
import { findTrade, trades } from "@config/trades";
import { startsOnTheMenu, withMenuSettings, type MenuSeed, type MenuSeedItem } from "@/lib/db/seed-core";
import menu from "../../seed/menu-queenstown.json";

const CURRENCY_FOR_COUNTRY = { NZ: "NZD", AU: "AUD" } as const;
const items = menu.items as MenuSeedItem[];

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

  it.each(markets)("$name sells two tiers, Essential per property and Portfolio per account, priced in whole cents, with urgent never included", (market) => {
    // DECISIONS.md: two tiers, one fee. Urgent response is an add-on the owner pays for, because a
    // membership that included it cost more to deliver than it charged.
    expect(market.tiers.map((t) => [t.key, t.billingBasis])).toEqual([["essential", "per_property"], ["portfolio", "per_account"]]);
    for (const tier of market.tiers) {
      expect(Number.isInteger(tier.monthlyPriceCents)).toBe(true);
      expect(tier.monthlyPriceCents).toBeGreaterThan(0);
      expect(tier.urgentIncluded).toBe(false);
      expect(tier.quarterlyCheck).toBe(false);
    }
    expect(Number.isInteger(market.foundingDeposit.amountCents)).toBe(true);
    expect(market.foundingDeposit.amountCents).toBeGreaterThanOrEqual(100);
  });

  it("the launch market is Queenstown: Essential at NZ$99, Portfolio from NZ$600, on site in 24 hours, 4 hours when urgent", () => {
    expect(launchMarket).toMatchObject({ slug: "queenstown", country: "NZ", currency: "NZD", taxRate: 0.15 });
    expect(launchMarket.tiers.map((t) => [t.key, t.monthlyPriceCents, t.responseHours, t.urgentResponseHours])).toEqual([["essential", 9900, 24, 4], ["portfolio", 60000, 24, 4]]);
    // Portfolio's bands, from DECISIONS.md (2026-11-17): 10-24 $600, 25-49 $900, 50-99 $1,200, 100+ by arrangement.
    expect(launchMarket.tiers[1]!.bands).toEqual([
      { from: 10, to: 24, cents: 60000 },
      { from: 25, to: 49, cents: 90000 },
      { from: 50, to: 99, cents: 120000 },
      { from: 100, to: null, cents: null },
    ]);
    expect(findMarket("queenstown")).toBe(launchMarket);
    expect(findMarket("atlantis")).toBeUndefined();
  });

  it("a market added later starts from the same surcharges and limits as the Queenstown menu file", () => {
    // DECISIONS.md: the file wins for Queenstown either way, but the next market copies these.
    expect(launchMarket).toMatchObject({
      urgentSurchargeCents: menu.surcharges.urgentDollars * 100,
      afterHoursSurchargeCents: menu.surcharges.afterHoursDollars * 100,
      diagnosisFeeCents: menu.offMenu.diagnosisFeeDollars * 100,
      diagnosisPayoutCents: menu.offMenu.diagnosisTradiePayoutDollars * 100,
      approvalThresholdCents: menu.offMenu.ownerApprovalAboveDollars * 100,
    });
    expect(withMenuSettings(launchMarket, menu as MenuSeed)).toEqual(launchMarket);
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

  it("holds real prices, not placeholders: 59 researched jobs with unique codes", () => {
    // Nothing may be shown to an owner as a price unless this is false (DECISIONS.md).
    expect(menu.placeholderPrices).toBe(false);
    expect(items).toHaveLength(59);
    const codes = items.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(items)("$code is priced so that we keep 15%: the owner pays the payout divided by 0.85, to the nearest $5", (item) => {
    expect(item.ownerPriceDollars).toBe(5 * Math.round(item.tradiePayoutDollars / 0.85 / 5));
  });

  it("loads the five jobs priced from national averages, and the two add-ons, switched off", () => {
    // Ring a local and confirm each price before an owner can book one. An add-on cannot be booked by itself.
    const needQuote = items.filter((item) => item.needsLocalQuote).map((item) => item.code);
    expect(needQuote.sort()).toEqual(["GD-01", "OD-03", "PV-01", "PV-02", "PV-04"]);
    const addOns = items.filter((item) => item.isAddOn).map((item) => item.code);
    expect(addOns.sort()).toEqual(["HP-01", "PV-03"]);
    const off = items.filter((item) => !startsOnTheMenu(item)).map((item) => item.code);
    expect(off.sort()).toEqual([...needQuote, ...addOns].sort());
    expect(items.filter(startsOnTheMenu)).toHaveLength(59 - 7);
  });

  it("keeps jobs an owner arranges off the form a guest sees", () => {
    const guest = items.filter((item) => startsOnTheMenu(item) && item.guestVisible !== false).map((item) => item.name);
    // What a guest in the house would report.
    expect(guest).toEqual(expect.arrayContaining(["Blocked toilet, sink or shower drain", "No hot water, first-hour diagnosis", "Lockout, business hours", "Wi-Fi router reset and smart TV setup"]));
    // What only an owner would book.
    for (const name of ["Lawn mow and edges", "Gutter clean, single storey", "Lockbox or smart lock install", "Switchboard and RCD safety test"]) expect(guest).not.toContain(name);
  });

  it.each(items)("$code has a known trade and sensible whole-dollar prices", (item) => {
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

  it("carries the surcharges and the off-menu rules that were decided", () => {
    // DECISIONS.md, 16 November 2026: urgent 90, after hours 140, call-out 225 (190 to the tradie), approval above 600.
    expect(menu.surcharges).toEqual({ urgentDollars: 90, afterHoursDollars: 140 });
    expect(menu.offMenu).toEqual({ diagnosisFeeDollars: 225, diagnosisTradiePayoutDollars: 190, ownerApprovalAboveDollars: 600 });
    // The call-out follows the same 15% rule as every job on the menu.
    expect(menu.offMenu.diagnosisFeeDollars).toBe(5 * Math.round(menu.offMenu.diagnosisTradiePayoutDollars / 0.85 / 5));
    // The limit sits above every job on the menu, so being asked means something unusual was found.
    expect(Math.max(...items.map((item) => item.ownerPriceDollars))).toBeLessThan(menu.offMenu.ownerApprovalAboveDollars);
  });
});
