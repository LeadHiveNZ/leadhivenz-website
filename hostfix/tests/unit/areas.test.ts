import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findMarket } from "@config/markets";
import { setTestNow } from "@/lib/clock";
import { acceptOffer, assignTradie } from "@/lib/dispatch/cascade";
import { allAreaKeys, areaForSuburb, foldPlace } from "@/lib/markets/areas";
import { getMarket } from "@/lib/markets/store";
import { createProperty, getPropertyForStaff, PropertyError, setPropertyAreaForStaff, updateProperty } from "@/lib/properties/service";
import { listTiers } from "@/lib/markets/store";
import { areaCoverage, canStillTake, eligibleTradies, getTradie, setTradieAreas, TradieError } from "@/lib/tradies/service";
import { testDb } from "./db";
import { liveMarket, logJob, makeOwner, makeProperty, makeTradie, MONDAY_10AM, offersFor, openExceptions } from "./factory";

/**
 * SERVICE AREAS (DECISIONS.md, 2026-11-26): no travel charge. Each tradie
 * chooses the areas they cover, and a job is only offered to tradies who cover
 * its property's area. A property with no area is offered to everyone.
 */

const t = testDb();

beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const queenstown = findMarket("queenstown")!;
const wanaka = findMarket("wanaka")!;

describe("the area from the suburb typed", () => {
  it("ignores case, macrons, apostrophes and extra spaces", () => {
    expect(foldPlace("  Lake  Hāwea ")).toBe("lake hawea");
    expect(areaForSuburb(queenstown.areas, "FRANKTON")).toBe("frankton");
    expect(areaForSuburb(queenstown.areas, "quail rise")).toBe("frankton");
    expect(areaForSuburb(queenstown.areas, "Fernhill")).toBe("queenstown-central");
    expect(areaForSuburb(queenstown.areas, "Jacks Point")).toBe("jacks-point");
    expect(areaForSuburb(queenstown.areas, "Hanley’s Farm")).toBe("jacks-point");
    expect(areaForSuburb(queenstown.areas, "Lower Shotover")).toBe("lake-hayes");
    expect(areaForSuburb(queenstown.areas, "Kinloch")).toBe("glenorchy");
    expect(areaForSuburb(wanaka.areas, "wanaka")).toBe("wanaka-town");
    expect(areaForSuburb(wanaka.areas, "Lake Hawea")).toBe("hawea");
    expect(areaForSuburb(wanaka.areas, "Cardrona")).toBe("cardrona");
  });

  it("tries each part of a suburb with commas, and gives null when nothing matches", () => {
    expect(areaForSuburb(queenstown.areas, "Frankton, Queenstown")).toBe("frankton");
    expect(areaForSuburb(queenstown.areas, "Cromwell")).toBeNull();
    expect(areaForSuburb(queenstown.areas, "")).toBeNull();
    // Wānaka's suburbs are not Queenstown's areas.
    expect(areaForSuburb(queenstown.areas, "Cardrona")).toBeNull();
  });

  it("has the same areas in config/markets.ts and in the migration for an existing database", () => {
    const sql = readFileSync(path.join(__dirname, "../../supabase/migrations/20261207000000_service_areas.sql"), "utf8");
    for (const market of [queenstown, wanaka]) {
      const found = sql.match(new RegExp(`\\$${market.slug}\\$([\\s\\S]*?)\\$${market.slug}\\$`));
      expect(found, market.slug).not.toBeNull();
      expect(JSON.parse(found![1]!)).toEqual(market.areas);
    }
  });

  it("is loaded into the database for the starting market", async () => {
    expect((await getMarket(t.db, "queenstown"))!.areas).toEqual(queenstown.areas);
  });
});

describe("a property's area", () => {
  it("comes from the suburb when the owner picks none, and stays null when nothing matches", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const frankton = await makeProperty(t.db, owner.ownerId);
    expect(frankton.area).toBe("frankton");
    const tier = (await listTiers(t.db, "queenstown")).find((candidate) => candidate.key === "essential")!;
    const base = { market: "queenstown", name: "Out of town", addressLine1: "1 Main Road", postcode: "9371", accessNotes: "Key under the mat.", tierId: tier.id };
    expect((await createProperty(t.db, owner.ownerId, { ...base, suburb: "Cromwell" })).area).toBeNull();
    // The owner's pick wins over the suburb; a pick the market does not have is ignored.
    expect((await createProperty(t.db, owner.ownerId, { ...base, suburb: "Frankton", area: "kelvin-heights" })).area).toBe("kelvin-heights");
    expect((await createProperty(t.db, owner.ownerId, { ...base, suburb: "Arrowtown", area: "mars" })).area).toBe("arrowtown");
  });

  it("follows a new suburb on edit unless one is picked, and staff can set or clear it", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    expect((await updateProperty(t.db, owner.ownerId, property.id, { suburb: "Glenorchy" }))!.area).toBe("glenorchy");
    expect((await updateProperty(t.db, owner.ownerId, property.id, { name: "Renamed" }))!.area).toBe("glenorchy");
    expect((await updateProperty(t.db, owner.ownerId, property.id, { area: "gibbston" }))!.area).toBe("gibbston");
    expect((await setPropertyAreaForStaff(t.db, property.id, null, "staff:test"))!.area).toBeNull();
    expect((await setPropertyAreaForStaff(t.db, property.id, "arrowtown", "staff:test"))!.area).toBe("arrowtown");
    await expect(setPropertyAreaForStaff(t.db, property.id, "cardrona", "staff:test")).rejects.toBeInstanceOf(PropertyError);
  });

  it("is filled in from the suburb by the migration for properties that have none", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    await t.db.query("update public.properties set suburb = '  ARROWTOWN ', area = null where id = $1::uuid", [property.id]);
    await t.db.exec(readFileSync(path.join(__dirname, "../../supabase/migrations/20261207000000_service_areas.sql"), "utf8"));
    expect((await getPropertyForStaff(t.db, property.id))!.area).toBe("arrowtown");
  });
});

describe("the areas a tradie covers", () => {
  it("are every area of their market to start with", async () => {
    await liveMarket(t.db);
    const tradie = await makeTradie(t.db);
    expect((await getTradie(t.db, tradie.tradieId))!.areas).toEqual(allAreaKeys(queenstown.areas));
  });

  it("can be changed, kept to the market's own, and never left empty", async () => {
    await liveMarket(t.db);
    const tradie = await makeTradie(t.db);
    expect((await setTradieAreas(t.db, tradie.tradieId, ["glenorchy", "frankton", "cardrona"], "test"))!.areas).toEqual(["frankton", "glenorchy"]);
    await expect(setTradieAreas(t.db, tradie.tradieId, ["cardrona"], "test")).rejects.toBeInstanceOf(TradieError);
  });
});

describe("who is offered a job, by area", () => {
  const criteria = { market: "queenstown", trade: "plumber", licenceRequired: true, afterHours: false, urgent: false, today: "2026-11-16", weekday: "mon" };
  const today = { market: "queenstown", trade: "plumber", licenceRequired: true, today: "2026-11-16" };

  async function twoTradies() {
    await liveMarket(t.db);
    const town = await makeTradie(t.db, { name: "Town Plumbing" });
    const lake = await makeTradie(t.db, { name: "Lake Plumbing" });
    await setTradieAreas(t.db, town.tradieId, ["queenstown-central", "frankton"], "test");
    await setTradieAreas(t.db, lake.tradieId, ["glenorchy"], "test");
    return { town, lake };
  }

  it("only offers a job to tradies who cover the property's area, checked again at accept", async () => {
    const { town, lake } = await twoTradies();
    expect((await eligibleTradies(t.db, { ...criteria, area: "glenorchy" })).map((c) => c.tradieId)).toEqual([lake.tradieId]);
    expect((await eligibleTradies(t.db, { ...criteria, area: "frankton" })).map((c) => c.tradieId)).toEqual([town.tradieId]);
    expect(await canStillTake(t.db, town.tradieId, { ...today, area: "glenorchy" })).toBe(false);
    expect(await canStillTake(t.db, lake.tradieId, { ...today, area: "glenorchy" })).toBe(true);
  });

  it("offers a property with no area to everyone", async () => {
    const { town, lake } = await twoTradies();
    expect((await eligibleTradies(t.db, { ...criteria, area: null })).map((c) => c.tradieId).sort()).toEqual([town.tradieId, lake.tradieId].sort());
    expect((await eligibleTradies(t.db, criteria)).length).toBe(2);
    expect(await canStillTake(t.db, town.tradieId, today)).toBe(true);
  });

  it("sends a job in the property's area through the cascade to those tradies only", async () => {
    const { town, lake } = await twoTradies();
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    await updateProperty(t.db, owner.ownerId, property.id, { suburb: "Kinloch" });
    const job = await logJob(t.db, (await getPropertyForStaff(t.db, property.id))!, { code: "PL-01" });
    const offers = await offersFor(t.db, job.id);
    expect(offers.map((offer) => offer.tradie_id)).toEqual([lake.tradieId]);
    expect((await t.db.tx((tx) => acceptOffer(tx, offers[0]!.id, "link"))).result).toBe("accepted");
    void town;
  });

  it("goes to the queue saying no tradie covers the area when nobody does, and staff can still give it to someone", async () => {
    const { town } = await twoTradies();
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    await updateProperty(t.db, owner.ownerId, property.id, { suburb: "Gibbston" });
    const job = await logJob(t.db, (await getPropertyForStaff(t.db, property.id))!, { code: "PL-01" });
    expect(await offersFor(t.db, job.id)).toEqual([]);
    expect(await openExceptions(t.db, job.id)).toEqual(["nobody_accepted"]);
    const summary = (await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid", [job.id]))[0]!.summary;
    expect(summary).toContain("no tradie covers Gibbston");
    // The team rang a tradie who agreed to go: the area rule is for offers, not for the team.
    expect((await t.db.tx((tx) => assignTradie(tx, job.id, town.tradieId, "staff:test"))).result).toBe("accepted");
  });

  it("counts approved tradies per area and trade for the market page", async () => {
    await twoTradies();
    const rows = await areaCoverage(t.db, "queenstown");
    const count = (area: string) => rows.find((row) => row.area === area && row.trade === "plumber")?.tradies ?? 0;
    expect(count("frankton")).toBe(1);
    expect(count("glenorchy")).toBe(1);
    expect(count("gibbston")).toBe(0);
  });
});
