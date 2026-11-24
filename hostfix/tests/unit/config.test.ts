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
      // Essential is free to join (DECISIONS.md, 2026-11-17). A retainer for a whole account always has a price.
      expect(tier.monthlyPriceCents).toBeGreaterThanOrEqual(tier.billingBasis === "per_account" ? 1 : 0);
      expect(tier.urgentIncluded).toBe(false);
      expect(tier.quarterlyCheck).toBe(false);
    }
    expect(Number.isInteger(market.foundingDeposit.amountCents)).toBe(true);
    // A deposit on offer has a real amount. Wānaka never had one (the deposit ended 2026-11-17, before it existed).
    if (market.foundingDeposit.enabled) expect(market.foundingDeposit.amountCents).toBeGreaterThanOrEqual(100);
  });

  it("the launch market is Queenstown: Essential free to join, Portfolio from NZ$600, on site in 24 hours, 4 hours when urgent", () => {
    expect(launchMarket).toMatchObject({ slug: "queenstown", country: "NZ", currency: "NZD", taxRate: 0.15 });
    expect(launchMarket.tiers.map((t) => [t.key, t.monthlyPriceCents, t.responseHours, t.urgentResponseHours])).toEqual([["essential", 0, 24, 4], ["portfolio", 60000, 24, 4]]);
    expect(launchMarket.tiers[0]!.blurb).toBe("Free to join. Fixed prices, charged only when something is fixed. A tradie on site within 24 hours, or 4 when it's urgent.");
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

  it("plumbing, gas, electrical and drainlaying work always needs a licence", () => {
    for (const key of ["plumber", "gasfitter", "electrician", "drainage_septic"]) {
      expect(findTrade(key)?.licenceRequired).toBe(true);
    }
    expect(findTrade("handyman")?.licenceRequired).toBe(false);
  });

  it("has the trades the founder added on 24 Nov 2026, with the keys the public sign-up form uses", () => {
    // DECISIONS.md, 2026-11-24. The keys are shared with the separate sign-up form: never rename one.
    expect(Object.fromEntries(trades.map((trade) => [trade.key, trade.label]))).toMatchObject({
      handyman: "Handyman", plumber: "Plumber", electrician: "Electrician", gasfitter: "Gasfitter", appliance_tech: "Appliance repair",
      heat_pump_tech: "Heat pump or air conditioning", locksmith: "Locksmith", other: "Something else",
      cleaner: "Cleaner", window_cleaner: "Window cleaner", gardener: "Gardener or landscaper", builder: "Builder (LBP)", painter: "Painter",
      roofer: "Roofing and gutters", pest_control: "Pest control", carpet_cleaner: "Carpet and upholstery cleaning", pool_spa: "Pool and spa",
      drainage_septic: "Drainage and septic",
    });
    expect(trades).toHaveLength(18);
    // Building work only goes to a tradie with an LBP number on file; no other trade asks for one.
    expect(trades.filter((trade) => trade.lbpRequired).map((trade) => trade.key)).toEqual(["builder"]);
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

  it("holds real prices, not placeholders: 110 researched jobs with unique codes", () => {
    // Nothing may be shown to an owner as a price unless this is false (DECISIONS.md).
    // 60 researched on 16 Nov 2026, 32 for the new trades on 24 Nov 2026 (DECISIONS.md, 2026-11-24), and 18 sizes
    // and one-room cleans the same day (DECISIONS.md, 2026-11-24, second entry: 10 cleans, 3 window cleans, 5 garden jobs).
    expect(menu.placeholderPrices).toBe(false);
    expect(items).toHaveLength(110);
    const codes = items.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(items)("$code is priced so that we keep 15%: the owner pays the payout divided by 0.85, to the nearest $5", (item) => {
    expect(item.ownerPriceDollars).toBe(5 * Math.round(item.tradiePayoutDollars / 0.85 / 5));
  });

  it("loads the jobs priced without a local figure, and the add-ons, switched off", () => {
    // Ring a local and confirm each price before an owner can book one. An add-on cannot be booked by itself.
    // The first five from 16 Nov 2026 (PV-04 is now SP-02), ten of the first 24 Nov 2026 jobs (DECISIONS.md, 2026-11-24),
    // and the two-storey window cleans and the two window add-ons (second entry). WC-03 is now single storey and on.
    const needQuote = items.filter((item) => item.needsLocalQuote).map((item) => item.code);
    expect(needQuote.sort()).toEqual([
      "CC-02", "CC-03", "CC-04", "DS-02", "DS-03", "GD-01", "OD-03", "PC-01", "PC-02", "PC-03", "PV-01", "PV-02", "SP-02", "SP-03", "WC-02", "WC-04", "WC-05", "WC-06",
    ]);
    const addOns = items.filter((item) => item.isAddOn).map((item) => item.code);
    expect(addOns.sort()).toEqual(["HP-01", "PV-03", "WC-05", "WC-06"]);
    const off = items.filter((item) => !startsOnTheMenu(item)).map((item) => item.code);
    expect(off.sort()).toEqual([...new Set([...needQuote, ...addOns])].sort());
    // 18 waiting on a local quote, and HP-01 and PV-03 (the two window add-ons are in both lists): 110 - 18 - 2 = 90.
    expect(items.filter(startsOnTheMenu)).toHaveLength(110 - 18 - 2);
  });

  it("keeps jobs an owner arranges off the form a guest sees", () => {
    const guest = items.filter((item) => startsOnTheMenu(item) && item.guestVisible !== false).map((item) => item.name);
    // What a guest in the house would report.
    expect(guest).toEqual(expect.arrayContaining(["Blocked toilet, sink or shower drain", "No hot water, first-hour diagnosis", "Lockout, business hours", "Wi-Fi router reset and smart TV setup"]));
    // What only an owner would book.
    for (const name of ["Lawn mow and edges, small (up to 200 square metres)", "Bathroom clean, one bathroom", "Gutter clean, single storey", "Lockbox or smart lock install", "Switchboard and RCD safety test"]) expect(guest).not.toContain(name);
  });

  it("records where each price for the new trades came from", () => {
    // DECISIONS.md, 2026-11-24: every job added or moved that day carries its source.
    const sourced = items.filter((item) => ["CL", "WC", "CC", "RF", "BL", "PT", "PC", "DS"].includes(item.code.split("-")[0]!) || ["SP-01", "SP-02", "SP-03", "OD-01", "OD-02", "OD-07", "OD-08", "OD-09", "OD-10", "OD-11", "OD-12", "OD-13"].includes(item.code));
    // 39 from the first 24 Nov 2026 entry, and 13 more from the second (10 cleans, WC-04 to WC-06; OD-09 to OD-13).
    expect(sourced).toHaveLength(39 + 18);
    for (const item of sourced) expect(((item as { source?: string }).source ?? "").length, item.code).toBeGreaterThan(30);
  });

  it("puts cleaning on the menu by the size of the house, and the new trades' jobs on their own trades", () => {
    const pick = (code: string) => items.find((item) => item.code === code)!;
    expect([pick("CL-01"), pick("CL-02"), pick("CL-03")].map((item) => [item.trade, item.ownerPriceDollars, item.tradiePayoutDollars])).toEqual([
      ["cleaner", 165, 140], ["cleaner", 270, 230], ["cleaner", 410, 350],
    ]);
    // Moved off the handyman: lawns and the garden, windows, carpets, gutters, the spa.
    expect(["OD-01", "OD-02", "WC-01", "CC-01", "RF-01", "SP-01", "SP-02"].map((code) => pick(code).trade)).toEqual([
      "gardener", "gardener", "window_cleaner", "carpet_cleaner", "roofer", "pool_spa", "pool_spa",
    ]);
    for (const old of ["HM-15", "OD-05", "GD-03", "PV-04"]) expect(items.find((item) => item.code === old)).toBeUndefined();
    // Drainlaying is licensed work.
    for (const item of items.filter((candidate) => candidate.trade === "drainage_septic")) expect(item.licenceRequired).toBe(true);
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
    // DECISIONS.md, 16 November 2026: after hours 140, call-out 225 (190 to the tradie), approval above 600.
    // Urgent dropped from 90 to 50 on 18 November 2026.
    expect(menu.surcharges).toEqual({ urgentDollars: 50, afterHoursDollars: 140 });
    expect(menu.offMenu).toEqual({ diagnosisFeeDollars: 225, diagnosisTradiePayoutDollars: 190, ownerApprovalAboveDollars: 600 });
    // The call-out follows the same 15% rule as every job on the menu.
    expect(menu.offMenu.diagnosisFeeDollars).toBe(5 * Math.round(menu.offMenu.diagnosisTradiePayoutDollars / 0.85 / 5));
    // The limit sits above every job on the menu, so being asked means something unusual was found.
    expect(Math.max(...items.map((item) => item.ownerPriceDollars))).toBeLessThan(menu.offMenu.ownerApprovalAboveDollars);
  });
});

describe("Wānaka", () => {
  it("loads Queenstown's menu and parts list, so the two start at the same prices (DECISIONS.md, 2026-11-24, third entry)", async () => {
    const path = await import("node:path");
    const { readMenuSeed, readPartsSeed } = await import("@/lib/db/seed-core");
    const dir = path.join(process.cwd(), "seed");
    expect(readMenuSeed(dir, "wanaka")).toEqual(readMenuSeed(dir, "queenstown"));
    expect(readMenuSeed(dir, "wanaka")!.items.length).toBe(110);
    expect(readPartsSeed(dir, "wanaka")).toEqual(readPartsSeed(dir, "queenstown"));
    const wanaka = markets.find((m) => m.slug === "wanaka")!;
    const queenstown = markets.find((m) => m.slug === "queenstown")!;
    expect(wanaka.stage).toBe("waitlist");
    const { slug: _a, name: _b, mapCentre: _c, foundingDeposit: _d, ...w } = wanaka;
    const { slug: _e, name: _f, mapCentre: _g, foundingDeposit: _h, ...q } = queenstown;
    expect(w).toEqual(q);
  });
});
