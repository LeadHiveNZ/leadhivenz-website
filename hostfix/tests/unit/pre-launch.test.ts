import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { brand } from "@config/brand";
import { defineMarket, markets as configured, type Market, type MarketStage } from "@config/markets";
import { setTestNow } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { createJob, type NewJob } from "@/lib/jobs/create";
import { updateMarket } from "@/lib/markets/admin";
import { announceGoLive, cardRefusal, cardsOpenSoon, joinableMarkets, lastGoLive, setUpCounts, signUpRefusal, waitingMarkets } from "@/lib/markets/launch";
import { bookingOpen, inPreLaunch, marketNames, ownersCanJoin, preLaunchWords } from "@/lib/markets/stage";
import { getMarket, listMarkets, listMenu, listTiers } from "@/lib/markets/store";
import { emails } from "@/lib/notify/messages";
import { listMessages } from "@/lib/notify/outbox";
import { openBankPage, openCardPage } from "@/lib/owners/card-pages";
import { getBilling, saveBilling } from "@/lib/owners/service";
import { createDemoGateway, DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import type { PaymentsGateway } from "@/lib/payments/gateway";
import { confirmPin } from "@/lib/properties/pin";
import { choosePortfolio, openPortfolio, PortfolioError, startPortfolio } from "@/lib/properties/portfolio";
import {
  activateFreeMembership, createProperties, createProperty, findPropertyByReportToken, getProperty, listProperties, PropertyError, startMembership,
  updateProperty, type Property,
} from "@/lib/properties/service";
import { addTeamMember, createGroup, housesForLink, waitingForLink } from "@/lib/team/service";
import { testDb } from "./db";
import { addPaidTier, auditActions, makeOwner, makePortfolio, MONDAY_10AM } from "./factory";

/**
 * PRE-LAUNCH MODE (DECISIONS.md, 2026-11-27, second entry).
 *
 * A market on the waiting list with "pre-launch" on lets owners make their
 * account and add every property. No card is taken and no job can be booked
 * until the market is live. The day it goes live, each of those owners gets
 * one email, however many times the stage is flipped.
 *
 * The test database starts the way production does after the migration:
 * Queenstown and Wānaka on the waiting list with pre-launch on.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const urls = { successUrl: "http://localhost:3000/app/membership/return", cancelUrl: "http://localhost:3000/app" };

async function setStage(slug: string, stage: MarketStage, preLaunch: boolean): Promise<Market> {
  await t.db.query("update public.markets set stage = $2, pre_launch = $3 where slug = $1", [slug, stage, preLaunch]);
  return (await getMarket(t.db, slug))!;
}

async function tierId(market: string, key = "essential"): Promise<string> {
  return (await listTiers(t.db, market)).find((tier) => tier.key === key)!.id;
}

let houses = 0;
async function addHouse(ownerId: string, market = "queenstown", overrides: Partial<Parameters<typeof createProperty>[2]> = {}): Promise<Property> {
  houses += 1;
  return createProperty(t.db, ownerId, {
    market, name: `Bach ${houses}`, addressLine1: `${houses} Lake Esplanade`, suburb: market === "wanaka" ? "Albert Town" : "Frankton", postcode: "9300",
    accessNotes: "Lockbox by the door, code 2468.", tierId: await tierId(market), ...overrides,
  });
}

/** The stand-in payment company, with the name of every call it is asked to make written down. */
function watched(): { gateway: PaymentsGateway; calls: string[] } {
  return watchedOn(t.db);
}

function watchedOn(db: Db): { gateway: PaymentsGateway; calls: string[] } {
  const base = createDemoGateway(db, "NZ");
  const calls: string[] = [];
  const gateway = new Proxy(base, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        return (value as (...inner: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as PaymentsGateway;
  return { gateway, calls };
}

const billingRows = async (ownerId: string) => t.db.query("select 1 from public.owner_billing where owner_id = $1::uuid", [ownerId]);
const liveEmails = async (to: string) => (await listMessages(t.db, { recipient: to, limit: 200 })).filter((message) => message.template === "market_live");
const wentLiveEntries = async (slug: string) => t.db.query<{ detail: { owners: number; properties: number; told: number } }>("select detail from public.audit_log where action = 'market.went_live' and entity_id = $1 order by id", [slug]);

function jobInput(property: Property, menuItemId: string, by: NewJob["reportedBy"]): NewJob {
  return {
    property, reportedBy: by, reporterName: by === "owner" ? null : "Mele", reporterPhone: by === "owner" ? null : "+64211239001", menuItemId, description: "",
    urgent: false, uploadIds: [], uploader: `${by}:test`, actor: by === "staff" ? "staff:test" : `${by}:test`,
  };
}

// ---------------------------------------------------------------------------

describe("the three questions every screen asks", () => {
  const cases: [MarketStage, boolean, { join: boolean; book: boolean; early: boolean }][] = [
    ["draft", false, { join: false, book: false, early: false }],
    ["draft", true, { join: false, book: false, early: false }],
    ["waitlist", false, { join: false, book: false, early: false }],
    ["waitlist", true, { join: true, book: false, early: true }],
    ["live", false, { join: true, book: true, early: false }],
    ["live", true, { join: true, book: true, early: false }],
    ["paused", false, { join: false, book: false, early: false }],
    ["paused", true, { join: false, book: false, early: false }],
  ];
  it.each(cases)("stage %s with pre-launch %s", (stage, preLaunch, expected) => {
    const market = { stage, preLaunch };
    expect(ownersCanJoin(market)).toBe(expected.join);
    expect(bookingOpen(market)).toBe(expected.book);
    expect(inPreLaunch(market)).toBe(expected.early);
  });

  it("a market written in a few lines starts with pre-launch off", () => {
    expect(defineMarket({ slug: "cromwell", name: "Cromwell", country: "NZ", timezone: "Pacific/Auckland", tiers: [] }).preLaunch).toBe(false);
  });

  it("names one, two or three areas the way a person would", () => {
    expect(marketNames([{ name: "Queenstown" }])).toBe("Queenstown");
    expect(marketNames([{ name: "Queenstown" }, { name: "Wānaka" }])).toBe("Queenstown and Wānaka");
    expect(marketNames([{ name: "Queenstown" }, { name: "Wānaka" }, { name: "Cromwell" }, { name: "Wānaka" }])).toBe("Queenstown, Wānaka and Cromwell");
    expect(marketNames([])).toBe("your area");
  });

  it("the words an owner reads say what the app does: an email on the day, a card then, charged per job", () => {
    expect(preLaunchWords.setUp("Wānaka")).toBe("You're set up. Bookings open soon in Wānaka. We'll email you the day we go live. You'll add a card then, and it's only charged when a job is done.");
    expect(preLaunchWords.notOpen("Wānaka")).toBe(`${brand.name} isn't open in Wānaka yet`);
  });
});

describe("Queenstown and Wānaka start in pre-launch", () => {
  it("in config/markets.ts, in the migration for a database that already has them, and in a fresh database", async () => {
    expect(configured.filter((market) => market.preLaunch).map((market) => market.slug).sort()).toEqual(["queenstown", "wanaka"]);
    const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261209000000_pre_launch.sql"), "utf8");
    expect(migration).toContain("add column if not exists pre_launch boolean not null default false");
    expect(migration).toContain("update public.markets set pre_launch = true where slug in ('queenstown', 'wanaka');");
    const seeded = await listMarkets(t.db);
    expect(seeded.map((market) => [market.slug, market.stage, market.preLaunch])).toEqual([["queenstown", "waitlist", true], ["wanaka", "waitlist", true]]);
  });

  it("the tick on Admin > Markets is saved, read back and written to the audit log", async () => {
    await updateMarket(t.db, "wanaka", { preLaunch: false }, "admin");
    expect((await getMarket(t.db, "wanaka"))!.preLaunch).toBe(false);
    await updateMarket(t.db, "wanaka", { preLaunch: true }, "admin");
    expect((await getMarket(t.db, "wanaka"))!.preLaunch).toBe(true);
    const entries = await t.db.query<{ detail: { changed: Record<string, unknown> } }>("select detail from public.audit_log where action = 'market.updated' and entity_id = 'wanaka' order by id");
    expect(entries.map((entry) => entry.detail.changed)).toEqual([{ preLaunch: false }, { preLaunch: true }]);
  });
});

describe("signing up", () => {
  it("is open while any area is live or in pre-launch, and closed otherwise", async () => {
    // As seeded: both on the waiting list with pre-launch on.
    expect(await signUpRefusal(t.db)).toBeNull();
    // Pre-launch off everywhere: a plain waiting list. Nobody can join.
    await setStage("queenstown", "waitlist", false);
    await setStage("wanaka", "waitlist", false);
    expect(await signUpRefusal(t.db)).toContain("We are not open for new members yet.");
    // One area in pre-launch is enough.
    await setStage("wanaka", "waitlist", true);
    expect(await signUpRefusal(t.db)).toBeNull();
    // The flag means nothing at draft or paused.
    await setStage("wanaka", "draft", true);
    await setStage("queenstown", "paused", true);
    expect(await signUpRefusal(t.db)).toContain("We are not open for new members yet.");
    // A live area opens it, flag or no flag.
    await setStage("queenstown", "live", false);
    expect(await signUpRefusal(t.db)).toBeNull();
  });

  it("offers the areas that are open for bookings first, then the ones in pre-launch, and never a closed one", async () => {
    expect((await joinableMarkets(t.db)).map((market) => market.slug)).toEqual(["queenstown", "wanaka"]);
    await setStage("wanaka", "live", false);
    expect((await joinableMarkets(t.db)).map((market) => market.slug)).toEqual(["wanaka", "queenstown"]);
    await setStage("queenstown", "paused", true);
    expect((await joinableMarkets(t.db)).map((market) => market.slug)).toEqual(["wanaka"]);
  });

  it("the welcome email in pre-launch promises no booking yet, and the usual one is unchanged", () => {
    const early = emails.welcomeOwner({ name: "Nina New", link: "https://hostfix.co.nz/app", opensSoonIn: "Wānaka" }).body;
    expect(early).toContain("Bookings are not open in Wānaka yet.");
    expect(early).toContain("no card is needed yet");
    expect(early).toContain("Once you have added a property, we will email you the day bookings open there.");
    expect(early).not.toContain("choose a membership");
    expect(emails.welcomeOwner({ name: "Nina New", link: "https://hostfix.co.nz/app" }).body).toContain("Add your first property and choose a membership here:");
  });
});

describe("adding properties before launch", () => {
  it("saves the property with its area, access notes and hazards, not covered, with no card asked for", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId, "wanaka", { name: "Hāwea Hideaway", suburb: "lake hawea", hazards: "Steep drive." });
    expect(property).toMatchObject({ market: "wanaka", status: "setup", memberSince: null, area: "hawea", hazards: "Steep drive.", portfolioId: null });
    expect(await auditActions(t.db, property.id)).toEqual(["property.created"]);
    expect(await billingRows(owner.ownerId)).toHaveLength(0);
    expect(await setUpCounts(t.db, "wanaka")).toEqual({ owners: 1, properties: 1 });
  });

  it("lets the owner finish everything that is only set-up: details, the map pin, guest settings, their team and groups", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const first = await addHouse(owner.ownerId);
    const second = await addHouse(owner.ownerId);
    const edited = await updateProperty(t.db, owner.ownerId, first.id, { accessNotes: "Key safe 1357.", guestAutoDispatch: true, spendLimitCents: 40000 });
    expect(edited).toMatchObject({ accessNotes: "Key safe 1357.", guestAutoDispatch: true, spendLimitCents: 40000, status: "setup" });
    const pinned = await confirmPin(t.db, owner.ownerId, first.id, { lat: -45.03, lng: 168.66, moved: true });
    expect(pinned.ok).toBe(true);
    const group = await createGroup(t.db, owner.ownerId, { name: "Frankton", propertyIds: [first.id, second.id] });
    const { member } = await addTeamMember(t.db, owner.ownerId, "+64211239001", { name: "Mele", dispatch: "ask", propertyIds: [], groupIds: [group.id] });
    expect(member.name).toBe("Mele");
    expect((await listProperties(t.db, owner.ownerId)).map((property) => property.status)).toEqual(["setup", "setup"]);
  });

  it("is refused where owners cannot join: a plain waiting list, a draft, or a paused market, whatever the flag says", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    for (const [stage, flag] of [["waitlist", false], ["draft", true], ["paused", true]] as const) {
      await setStage("queenstown", stage, flag);
      await expect(addHouse(owner.ownerId)).rejects.toThrow(new PropertyError("We are not taking new properties in that area yet."));
    }
    expect(await listProperties(t.db, owner.ownerId)).toHaveLength(0);
  });

  it("a pasted spreadsheet is saved the same way: every row set up, none covered, and the payment company is never asked", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const { gateway, calls } = watched();
    const rows = [1, 2, 3].map((n) => ({ name: `Unit ${n}`, addressLine1: `${n} Hallenstein Street`, suburb: "Queenstown", postcode: "9300", accessNotes: "" }));
    const saved = await createProperties(t.db, owner.ownerId, { market: "queenstown", tierId: await tierId("queenstown"), rows }, () => gateway);
    expect(saved.map((property) => [property.name, property.status, property.area])).toEqual([["Unit 1", "setup", "queenstown-central"], ["Unit 2", "setup", "queenstown-central"], ["Unit 3", "setup", "queenstown-central"]]);
    expect(calls).toEqual([]);
    expect(await billingRows(owner.ownerId)).toHaveLength(0);
  });

  it("a paste into a pre-launch area covers nothing even when the owner's card is on file from an area that is live", async () => {
    await setStage("queenstown", "live", false);
    const owner = await makeOwner(t.db); // card on file
    const { gateway, calls } = watched();
    const rows = [{ name: "Albert Town Cottage", addressLine1: "5 Gunn Road", suburb: "Albert Town", postcode: "9305", accessNotes: "" }];
    const early = await createProperties(t.db, owner.ownerId, { market: "wanaka", tierId: await tierId("wanaka"), rows }, () => gateway);
    expect(early.map((property) => property.status)).toEqual(["setup"]);
    expect(calls).toEqual([]);
    // The same paste where bookings are open is covered straight away, as before.
    const live = await createProperties(t.db, owner.ownerId, { market: "queenstown", tierId: await tierId("queenstown"), rows: [{ ...rows[0]!, name: "Gorge Road Flat" }] }, () => gateway);
    expect(live.map((property) => property.status)).toEqual(["active"]);
  });

  it("a paste where bookings are open still joins a paying Portfolio and re-checks its band, in the same step", async () => {
    await setStage("queenstown", "live", false);
    const manager = await makeOwner(t.db);
    const { portfolio } = await makePortfolio(t.db, manager.ownerId, 24);
    expect(portfolio).toMatchObject({ status: "active", bandCents: 60000 });
    let calls: string[] = [];
    const rows = [1, 2].map((n) => ({ name: `Pasted ${n}`, addressLine1: `${n} Shotover Street`, suburb: "Queenstown", postcode: "9300", accessNotes: "" }));
    // The gateway is made for the step the rows are saved in, as the app does it.
    const saved = await createProperties(t.db, manager.ownerId, { market: "queenstown", tierId: portfolio.tierId, rows }, (inner) => {
      const made = watchedOn(inner);
      calls = made.calls;
      return made.gateway;
    });
    expect(saved.map((property) => [property.status, property.portfolioId])).toEqual([["active", portfolio.id], ["active", portfolio.id]]);
    // 24 properties were NZ$600 a month (the 10-24 band). 26 is the 25-49 band, NZ$900, from the next payment: DECISIONS.md, 2026-11-17.
    expect(await openPortfolio(t.db, manager.ownerId, "queenstown")).toMatchObject({ bandCents: 90000, propertyCountBilled: 26 });
    expect(calls.filter((name) => name === "changeMembershipPrice")).toHaveLength(1);
  });

  it("a paste is all or nothing, and refused where owners cannot join", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const rows = [{ name: "Good", addressLine1: "1 Main Road", suburb: "Luggate", postcode: "", accessNotes: "" }];
    await expect(createProperties(t.db, owner.ownerId, { market: "wanaka", tierId: await tierId("queenstown"), rows }, () => null)).rejects.toBeInstanceOf(PropertyError);
    await setStage("wanaka", "waitlist", false);
    await expect(createProperties(t.db, owner.ownerId, { market: "wanaka", tierId: await tierId("wanaka"), rows }, () => null)).rejects.toThrow("We are not taking new properties in that area yet.");
    expect(await listProperties(t.db, owner.ownerId)).toHaveLength(0);
  });
});

describe("nothing that takes a card works before launch, and the payment company hears nothing", () => {
  it("covering a property (the card step) is refused in friendly words", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId, "wanaka");
    const { gateway, calls } = watched();
    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    expect(started).toEqual({ kind: "error", message: "Bookings open soon in Wānaka. No card is needed yet: we'll email you the day we go live, and you add one then." });
    expect(calls).toEqual([]);
    expect(await billingRows(owner.ownerId)).toHaveLength(0);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");
  });

  it("a paid membership is refused the same way", async () => {
    const paid = await addPaidTier(t.db);
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId, "queenstown", { tierId: paid.id });
    const { gateway, calls } = watched();
    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    expect(started).toMatchObject({ kind: "error", message: preLaunchWords.noCardYet("Queenstown") });
    expect(calls).toEqual([]);
    expect(await t.db.query("select 1 from public.membership_invoices where property_id = $1::uuid", [property.id])).toHaveLength(0);
  });

  it("a card that somehow came back from the card page is not kept, and the property is not covered", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId);
    const covered = await activateFreeMembership(t.db, { propertyId: property.id, ownerId: owner.ownerId, provider: "demo", customerId: "demo_cus_early", card: DEMO_CARD_OK });
    expect(covered).toBeNull();
    expect(await billingRows(owner.ownerId)).toHaveLength(0);
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");
  });

  it("Portfolio can be chosen, but its retainer cannot start", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const portfolioTier = await tierId("queenstown", "portfolio");
    for (let n = 0; n < 10; n += 1) await addHouse(owner.ownerId, "queenstown", { tierId: portfolioTier });
    const portfolio = (await openPortfolio(t.db, owner.ownerId, "queenstown"))!;
    expect(portfolio.status).toBe("setup");
    const { gateway, calls } = watched();
    const started = await startPortfolio(t.db, gateway, { ownerId: owner.ownerId, portfolioId: portfolio.id, ...urls });
    expect(started).toEqual({ kind: "error", message: preLaunchWords.noCardYet("Queenstown") });
    expect(calls).toEqual([]);
    expect(await billingRows(owner.ownerId)).toHaveLength(0);
    expect((await listProperties(t.db, owner.ownerId)).every((property) => property.status === "setup")).toBe(true);
    // Choosing it from the Billing page works too, and is refused where owners cannot join at all.
    const other = await makeOwner(t.db, { card: "none" });
    expect((await choosePortfolio(t.db, other.ownerId, "wanaka")).status).toBe("setup");
    await setStage("wanaka", "waitlist", false);
    const third = await makeOwner(t.db, { card: "none" });
    await expect(choosePortfolio(t.db, third.ownerId, "wanaka")).rejects.toBeInstanceOf(PortfolioError);
  });

  it("the change-card page and the bank account page are refused before either is opened", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    await addHouse(owner.ownerId, "wanaka");
    const wanaka = (await getMarket(t.db, "wanaka"))!;
    const { gateway, calls } = watched();
    const words = "Bookings open soon in Wānaka. No card is needed yet: we'll email you the day we go live, and you add one then.";
    expect(await cardRefusal(t.db, owner.ownerId, "NZ")).toBe(words);
    expect(await openCardPage(t.db, gateway, { ownerId: owner.ownerId, country: "NZ", returnUrl: "http://localhost:3000/app/billing" })).toEqual({ ok: false, message: words });
    expect(await openBankPage(t.db, gateway, { ownerId: owner.ownerId, market: wanaka, ...urls })).toEqual({ ok: false, message: words });
    expect(calls).toEqual([]);
    // Even with a card row left over from somewhere, nothing is opened while everything of theirs is in pre-launch.
    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_left", card: DEMO_CARD_OK });
    expect((await openCardPage(t.db, gateway, { ownerId: owner.ownerId, country: "NZ", returnUrl: "x" })).ok).toBe(false);
    expect((await openBankPage(t.db, gateway, { ownerId: owner.ownerId, market: wanaka, ...urls })).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("an owner with nothing anywhere is told the usual thing, not pre-launch words", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const { gateway, calls } = watched();
    expect(await cardRefusal(t.db, owner.ownerId, "NZ")).toBeNull();
    expect(await openCardPage(t.db, gateway, { ownerId: owner.ownerId, country: "NZ", returnUrl: "x" })).toEqual({ ok: false, message: "There is no card on file yet. It is added when you start a membership." });
    expect(calls).toEqual([]);
  });
});

describe("an owner in two areas, one live and one in pre-launch", () => {
  async function twoAreas() {
    await setStage("queenstown", "live", false);
    const owner = await makeOwner(t.db); // card on file, as after their first Queenstown property
    const open = await addHouse(owner.ownerId, "queenstown");
    const early = await addHouse(owner.ownerId, "wanaka");
    return { owner, open, early };
  }

  it("keeps their card pages, and covers the live property with the saved card", async () => {
    const { owner, open } = await twoAreas();
    const { gateway, calls } = watched();
    expect(await cardRefusal(t.db, owner.ownerId, "NZ")).toBeNull();
    expect((await openCardPage(t.db, gateway, { ownerId: owner.ownerId, country: "NZ", returnUrl: "http://localhost:3000/app/billing" })).ok).toBe(true);
    expect((await openBankPage(t.db, gateway, { ownerId: owner.ownerId, market: (await getMarket(t.db, "queenstown"))!, ...urls })).ok).toBe(true);
    expect(calls).toEqual(["billingPortalUrl", "startBankSetup"]);
    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: open.id, ...urls });
    expect(started.kind).toBe("active");
  });

  it("still cannot cover the pre-launch property, saved card or not", async () => {
    const { owner, early } = await twoAreas();
    const { gateway, calls } = watched();
    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: early.id, ...urls });
    expect(started).toEqual({ kind: "error", message: preLaunchWords.noCardYet("Wānaka") });
    expect(calls).toEqual([]);
    expect((await getProperty(t.db, owner.ownerId, early.id))!.status).toBe("setup");
  });

  it("is waiting on Wānaka only, on every screen that asks", async () => {
    const { owner } = await twoAreas();
    const properties = await listProperties(t.db, owner.ownerId);
    const all = await listMarkets(t.db);
    expect(waitingMarkets(properties, all).map((market) => market.slug)).toEqual(["wanaka"]);
    expect(cardsOpenSoon(properties, all, "NZ")).toEqual([]);
    // A cancelled property is nothing to wait for.
    await t.db.query("update public.properties set status = 'cancelled' where owner_id = $1::uuid and market = 'wanaka'", [owner.ownerId]);
    expect(waitingMarkets(await listProperties(t.db, owner.ownerId), all)).toEqual([]);
  });
});

describe("no job can be booked before launch", () => {
  async function earlyHouse() {
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId);
    const item = (await listMenu(t.db, "queenstown")).find((candidate) => candidate.code === "PL-01")!;
    return { owner, property, item };
  }
  const NOT_OPEN = `${brand.name} isn't open in Queenstown yet. Jobs can be booked from the day we go live.`;

  it("by the owner, their team or a guest: each is told when, nothing is saved and nothing is held on a card", async () => {
    const { property, item } = await earlyHouse();
    const { gateway, calls } = watched();
    for (const by of ["owner", "team", "guest"] as const) {
      const result = await createJob(t.db, jobInput(property, item.id, by), () => gateway);
      expect(result).toEqual({ ok: false, reason: "market_closed", message: NOT_OPEN });
    }
    expect(await t.db.query("select 1 from public.jobs where property_id = $1::uuid", [property.id])).toHaveLength(0);
    expect(await t.db.query("select 1 from public.card_holds")).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it("even at a property the team has covered by hand, while staff can still log one there themselves", async () => {
    const { owner, property, item } = await earlyHouse();
    await saveBilling(t.db, { ownerId: owner.ownerId, country: "NZ", provider: "demo", customerId: "demo_cus_pilot", card: DEMO_CARD_OK });
    await t.db.query("update public.properties set status = 'active' where id = $1::uuid", [property.id]);
    const covered = (await getProperty(t.db, owner.ownerId, property.id))!;
    const { gateway } = watched();
    for (const by of ["owner", "team", "guest"] as const) {
      expect(await createJob(t.db, jobInput(covered, item.id, by), () => gateway)).toMatchObject({ ok: false, reason: "market_closed", message: NOT_OPEN });
    }
    const byStaff = await createJob(t.db, jobInput(covered, item.id, "staff"), () => gateway);
    expect(byStaff.ok).toBe(true);
    expect(await t.db.query("select 1 from public.jobs where property_id = $1::uuid", [property.id])).toHaveLength(1);
  });

  it("a plain waiting list or a paused market keeps the older words", async () => {
    const { property, item } = await earlyHouse();
    await setStage("queenstown", "paused", true);
    expect(await createJob(t.db, jobInput(property, item.id, "owner"), () => null)).toMatchObject({ ok: false, reason: "market_closed", message: "We are not taking jobs in Queenstown right now." });
  });

  it("a cleaner's link and the guest QR card open onto \"not open yet\", then onto the house once it is live and covered", async () => {
    const { owner, property } = await earlyHouse();
    const { member } = await addTeamMember(t.db, owner.ownerId, "+64211239001", { name: "Mele", dispatch: "straight", propertyIds: [property.id], groupIds: [] });
    expect(await housesForLink(t.db, member.linkId)).toEqual([]);
    expect(await waitingForLink(t.db, member.linkId)).toEqual({ markets: [{ slug: "queenstown", name: "Queenstown" }], houses: [{ propertyId: property.id, market: "queenstown" }] });
    // The guest's QR link finds the property; the page reads its market and shows "not open yet" (src/app/r/[token]/page.tsx).
    const found = await findPropertyByReportToken(t.db, property.guestToken);
    expect(found?.via).toBe("guest");
    expect(inPreLaunch((await getMarket(t.db, found!.property.market))!)).toBe(true);

    // Live, but no card yet: nothing to wait for any more, and still nothing to report on.
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    expect(await waitingForLink(t.db, member.linkId)).toEqual({ markets: [], houses: [] });
    expect(await housesForLink(t.db, member.linkId)).toEqual([]);
    // The owner adds their card: the house is on the cleaner's list.
    const gateway = createDemoGateway(t.db, "NZ");
    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    expect(started.kind).toBe("redirect");
    await activateFreeMembership(t.db, { propertyId: property.id, ownerId: owner.ownerId, provider: "demo", customerId: "demo_cus_live", card: DEMO_CARD_OK });
    expect((await housesForLink(t.db, member.linkId)).map((house) => house.property.id)).toEqual([property.id]);
  });
});

describe("going live", () => {
  async function threeOwners() {
    const ana = await makeOwner(t.db, { card: "none" });
    const ben = await makeOwner(t.db, { card: "none" });
    const cat = await makeOwner(t.db, { card: "none" });
    const anaHome = await addHouse(ana.ownerId);
    await addHouse(ben.ownerId);
    await addHouse(ben.ownerId);
    // Cat chose Portfolio.
    await addHouse(cat.ownerId, "queenstown", { tierId: await tierId("queenstown", "portfolio") });
    return { ana, ben, cat, anaHome };
  }

  it("emails each owner with a property there exactly once, with the link to where they add their card, and writes it down", async () => {
    const { ana, ben, cat, anaHome } = await threeOwners();
    // Not told: an owner whose only property there is cancelled, one whose account is closed, one who is only in Wānaka.
    const gone = await makeOwner(t.db, { card: "none" });
    const goneHome = await addHouse(gone.ownerId);
    await t.db.query("update public.properties set status = 'cancelled' where id = $1::uuid", [goneHome.id]);
    const closed = await makeOwner(t.db, { card: "none" });
    await addHouse(closed.ownerId);
    await t.db.query("update public.users set disabled_at = $2::timestamptz where id = $1::uuid", [closed.user.id, MONDAY_10AM.toISOString()]);
    const elsewhere = await makeOwner(t.db, { card: "none" });
    await addHouse(elsewhere.ownerId, "wanaka");

    expect(await setUpCounts(t.db, "queenstown")).toEqual({ owners: 4, properties: 5 });
    await updateMarket(t.db, "queenstown", { stage: "live" }, "staff:admin");

    const toAna = await liveEmails(ana.user.email!);
    expect(toAna).toHaveLength(1);
    expect(toAna[0]).toMatchObject({ channel: "email", subject: `${brand.name} is live in Queenstown. Add your card to be covered`, audience: "owner" });
    expect(toAna[0]!.body).toContain(`/app/properties/${anaHome.id}`);
    expect(toAna[0]!.body).toContain("Your property is set up and ready.");
    const toBen = await liveEmails(ben.user.email!);
    expect(toBen).toHaveLength(1);
    expect(toBen[0]!.body).toContain("Your 2 properties are set up and ready.");
    expect(toBen[0]!.body).toMatch(/\/app\/properties\n/);
    const toCat = await liveEmails(cat.user.email!);
    expect(toCat).toHaveLength(1);
    expect(toCat[0]!.body).toContain("/app/billing");
    for (const nobody of [gone, closed, elsewhere]) expect(await liveEmails(nobody.user.email!)).toHaveLength(0);

    const entries = await wentLiveEntries("queenstown");
    expect(entries.map((entry) => entry.detail)).toEqual([{ owners: 3, properties: 4, told: 3 }]);
    expect(await lastGoLive(t.db, "queenstown")).toMatchObject({ owners: 3, properties: 4, told: 3 });
    expect(await lastGoLive(t.db, "wanaka")).toBeNull();
  });

  it("never emails anyone twice: saved again, flipped back to the waiting list and live again, or paused and live again", async () => {
    const { ana, ben, cat } = await threeOwners();
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    // Saving the settings again while live.
    await updateMarket(t.db, "queenstown", { stage: "live", name: "Queenstown" }, "admin");
    // Paused, then live: not a launch.
    await updateMarket(t.db, "queenstown", { stage: "paused" }, "admin");
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    expect(await wentLiveEntries("queenstown")).toHaveLength(1);
    // While it is live, Eve joins and covers her property with a card: she was never part of a launch.
    const eve = await makeOwner(t.db);
    const eveHome = await addHouse(eve.ownerId);
    expect(await activateFreeMembership(t.db, { propertyId: eveHome.id, ownerId: eve.ownerId, provider: "demo", customerId: "demo_cus_eve", card: null })).toMatchObject({ status: "active" });
    // Back to the waiting list, a new owner sets up, and live a second time.
    await updateMarket(t.db, "queenstown", { stage: "waitlist" }, "admin");
    const dee = await makeOwner(t.db, { card: "none" });
    await addHouse(dee.ownerId);
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    for (const owner of [ana, ben, cat, dee]) expect(await liveEmails(owner.user.email!)).toHaveLength(1);
    // Eve is covered already, so she is never told to add a card.
    expect(await liveEmails(eve.user.email!)).toHaveLength(0);
    const entries = await wentLiveEntries("queenstown");
    expect(entries.map((entry) => entry.detail)).toEqual([{ owners: 3, properties: 4, told: 3 }, { owners: 4, properties: 5, told: 1 }]);
    // And calling the announcement by itself again changes nothing for them.
    expect(await announceGoLive(t.db, { slug: "queenstown", name: "Queenstown" }, "admin")).toMatchObject({ owners: 4, told: 0 });
    for (const owner of [ana, ben, cat, dee]) expect(await liveEmails(owner.user.email!)).toHaveLength(1);
  });

  it("tells an owner in two areas once for each, on the day each one opens", async () => {
    const both = await makeOwner(t.db, { card: "none" });
    const wanakaOnly = await makeOwner(t.db, { card: "none" });
    await addHouse(both.ownerId, "queenstown");
    const second = await addHouse(both.ownerId, "wanaka");
    await addHouse(wanakaOnly.ownerId, "wanaka");

    await updateMarket(t.db, "wanaka", { stage: "live" }, "admin");
    expect((await liveEmails(both.user.email!)).map((message) => message.subject)).toEqual([`${brand.name} is live in Wānaka. Add your card to be covered`]);
    expect((await liveEmails(both.user.email!))[0]!.body).toContain(`/app/properties/${second.id}`);
    expect(await liveEmails(wanakaOnly.user.email!)).toHaveLength(1);
    // Still waiting on Queenstown, but no longer stopped from adding a card: Wānaka is open.
    expect(await cardRefusal(t.db, both.ownerId, "NZ")).toBeNull();

    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    expect((await liveEmails(both.user.email!)).map((message) => message.subject).sort()).toEqual([
      `${brand.name} is live in Queenstown. Add your card to be covered`,
      `${brand.name} is live in Wānaka. Add your card to be covered`,
    ]);
    expect(await liveEmails(wanakaOnly.user.email!)).toHaveLength(1);
  });

  it("texts the rare owner with no email address, once", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    await addHouse(owner.ownerId);
    await t.db.query("update public.users set email = null where id = $1::uuid", [owner.user.id]);
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    await updateMarket(t.db, "queenstown", { stage: "waitlist" }, "admin");
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    const texts = (await listMessages(t.db, { recipient: owner.user.phone!, limit: 50 })).filter((message) => message.template === "market_live");
    expect(texts).toHaveLength(1);
    expect(texts[0]!.body).toContain(`${brand.name} is live in Queenstown. Add your card to be covered:`);
    expect(texts[0]!.body).toContain("/app/properties");
  });

  it("leaves the owner at the normal add-a-card step: not covered until the card is saved, then covered", async () => {
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId);
    await updateMarket(t.db, "queenstown", { stage: "live" }, "admin");
    expect((await getProperty(t.db, owner.ownerId, property.id))!.status).toBe("setup");
    expect(await getBilling(t.db, owner.ownerId, "NZ")).toBeNull();
    expect(await cardRefusal(t.db, owner.ownerId, "NZ")).toBeNull();
    const { gateway, calls } = watched();
    const started = await startMembership(t.db, gateway, { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    expect(started.kind).toBe("redirect");
    expect(calls).toEqual(["ensureCustomer", "startCardSetup"]);
    const covered = await activateFreeMembership(t.db, { propertyId: property.id, ownerId: owner.ownerId, provider: "demo", customerId: "demo_cus_day_one", card: DEMO_CARD_OK });
    expect(covered).toMatchObject({ status: "active" });
  });

  it("the flag left ticked on a live market changes nothing", async () => {
    await setStage("queenstown", "live", true);
    const owner = await makeOwner(t.db, { card: "none" });
    const property = await addHouse(owner.ownerId);
    expect(await cardRefusal(t.db, owner.ownerId, "NZ")).toBeNull();
    const started = await startMembership(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, propertyId: property.id, ...urls });
    expect(started.kind).toBe("redirect");
    expect(waitingMarkets(await listProperties(t.db, owner.ownerId), await listMarkets(t.db))).toEqual([]);
  });

  it("the email says only what happens: free, a card now, charged when a job is done", () => {
    const one = emails.marketLive({ name: "Ana Aroha", market: "Wānaka", link: "https://hostfix.co.nz/app/properties/x", properties: 1, portfolio: false });
    expect(one.subject).toBe(`${brand.name} is live in Wānaka. Add your card to be covered`);
    expect(one.body).toContain("Hi Ana,");
    expect(one.body).toContain("Add your card to be covered:\nhttps://hostfix.co.nz/app/properties/x");
    expect(one.body).toContain("It is free to join. Your card is only charged the fixed price of a job, when it is done.");
    const many = emails.marketLive({ name: "Ben", market: "Wānaka", link: "https://hostfix.co.nz/app/properties", properties: 4, portfolio: false });
    expect(many.body).toContain("Your 4 properties are set up and ready.");
    expect(many.body).toContain("You add the card once. Then open each of your other properties and press Cover this property.");
    const managed = emails.marketLive({ name: "Cat", market: "Wānaka", link: "https://hostfix.co.nz/app/billing", properties: 12, portfolio: true });
    expect(managed.body).toContain("Start your Portfolio retainer here and every property on it is covered:\nhttps://hostfix.co.nz/app/billing");
  });
});
