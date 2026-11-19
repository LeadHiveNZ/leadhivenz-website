import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/lib/clock";
import { runTick } from "@/lib/dispatch/tick";
import { exifTakenAt, exifToDate } from "@/lib/files/exif";
import { addressFilter, geocoder, linzGeocoder, lookupUrl, pickAddress, setGeocoder, type Geocoder } from "@/lib/maps/geocode";
import { mapTiles } from "@/lib/maps/tiles";
import { confirmPin, fillMissingPins, lookUpPin, propertiesNeedingPin } from "@/lib/properties/pin";
import { getProperty, updateProperty } from "@/lib/properties/service";
import { testDb } from "./db";
import { gatewayFor, liveMarket, makeOwner, makeProperty, MONDAY_10AM } from "./factory";
import { fakeFetch, jsonReply } from "./helpers";

/**
 * EVERY PROPERTY'S MAP PIN (DECISIONS.md, 2026-11-19), the address lookup
 * against a stand-in for LINZ, the map pictures, and reading a photo's date.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => {
  setTestNow(null);
  setGeocoder(undefined);
  delete process.env.LINZ_DATA_KEY;
  delete process.env.LINZ_BASEMAPS_KEY;
  delete process.env.MAP_TILES;
});

const LAKEVIEW = { lat: -45.0336, lng: 168.6551 };
const feature = (full: string, lat: number, lng: number) => ({ properties: { full_address: full, gd2000_xcoord: lng, gd2000_ycoord: lat }, geometry: { type: "Point", coordinates: [lng, lat] } });

describe("looking up an address in the LINZ address list", () => {
  it("asks for every address that starts with the street address, with quotes and wildcards taken out", () => {
    expect(addressFilter("14B  Lake Esplanade ")).toBe("full_address ILIKE '14B Lake Esplanade,%'");
    expect(addressFilter("1' OR '1'='1")).toBe("full_address ILIKE '1 OR 1 = 1,%'");
    expect(addressFilter("Lake Esplanade")).toBeNull(); // no number: too vague to be sure
    const url = new URL(lookupUrl("abc123", "14B Lake Esplanade")!);
    expect(url.origin + url.pathname).toBe("https://data.linz.govt.nz/services;key=abc123/wfs");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "layer-105689", count: "20", outputFormat: "json",
      cql_filter: "full_address ILIKE '14B Lake Esplanade,%'",
    });
  });

  it("chooses the one in the right suburb, then town, and refuses to guess between several", () => {
    const two = [feature("14B Lake Esplanade, Queenstown", -45.0336, 168.6551), feature("14B Lake Esplanade, Te Anau", -45.41, 167.72)];
    expect(pickAddress(two, { addressLine1: "14B Lake Esplanade", suburb: "Queenstown" })).toEqual(LAKEVIEW);
    expect(pickAddress(two, { addressLine1: "14B Lake Esplanade", suburb: "Frankton", town: "Te Anau" })).toEqual({ lat: -45.41, lng: 167.72 });
    expect(pickAddress(two, { addressLine1: "14B Lake Esplanade", suburb: "Wanaka", town: "Cromwell" })).toBeNull();
    expect(pickAddress([two[0]!], { addressLine1: "14B Lake Esplanade", suburb: "Wanaka" })).toEqual(LAKEVIEW);
    expect(pickAddress([], { addressLine1: "14B Lake Esplanade", suburb: "Queenstown" })).toBeNull();
    // Only the shape: latitude first or second, the New Zealand sign decides.
    expect(pickAddress([{ properties: { full_address: "1 A Road, Queenstown" }, geometry: { coordinates: [-45.03, 168.66] } }], { addressLine1: "1 A Road", suburb: "Queenstown" })).toEqual({ lat: -45.03, lng: 168.66 });
  });

  it("calls LINZ with the key, and gives up quietly when LINZ says no", async () => {
    const good = fakeFetch([jsonReply({ type: "FeatureCollection", features: [feature("14B Lake Esplanade, Queenstown", -45.0336, 168.6551)] })]);
    expect(await linzGeocoder("abc123", good.fetch).lookUp({ addressLine1: "14B Lake Esplanade", suburb: "Queenstown" })).toEqual(LAKEVIEW);
    expect(good.requests[0]!.url).toContain("services;key=abc123/wfs");
    const refused = fakeFetch([new Response("bad key", { status: 403 })]);
    expect(await linzGeocoder("wrong", refused.fetch).lookUp({ addressLine1: "14B Lake Esplanade", suburb: "Queenstown" })).toBeNull();
    const broken = fakeFetch(() => Promise.reject(new Error("offline")));
    expect(await linzGeocoder("abc123", broken.fetch).lookUp({ addressLine1: "14B Lake Esplanade", suburb: "Queenstown" })).toBeNull();
  });

  it("is off without LINZ_DATA_KEY, on with it", () => {
    expect(geocoder()).toBeNull();
    process.env.LINZ_DATA_KEY = "abc123";
    expect(geocoder()).not.toBeNull();
  });
});

describe("the map pictures", () => {
  it("are LINZ aerial photos with a Basemaps key, OpenStreetMap without one, and none when switched off; always credited", () => {
    process.env.LINZ_BASEMAPS_KEY = "k1";
    expect(mapTiles()).toMatchObject({ kind: "aerial", url: "https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api=k1" });
    expect(mapTiles()!.attribution).toContain("LINZ CC BY 4.0");
    delete process.env.LINZ_BASEMAPS_KEY;
    expect(mapTiles()).toMatchObject({ kind: "streets", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" });
    expect(mapTiles()!.attribution).toContain("OpenStreetMap");
    process.env.MAP_TILES = "off";
    expect(mapTiles()).toBeNull();
  });
});

describe("a property's pin", () => {
  const stub = (point: { lat: number; lng: number } | null): Geocoder & { asked: string[] } => {
    const asked: string[] = [];
    return { asked, lookUp: async (address) => (asked.push(`${address.addressLine1}, ${address.suburb}, ${address.town}`), point) };
  };

  it("is looked up from the address, then confirmed by the owner, moved or not", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    expect(property).toMatchObject({ pin: null, pinSource: "none", pinConfirmedAt: null });
    const linz = stub(LAKEVIEW);
    expect(await lookUpPin(t.db, linz, property.id)).toEqual(LAKEVIEW);
    expect(linz.asked).toEqual([`${property.addressLine1}, Frankton, Queenstown`]);
    expect(await getProperty(t.db, owner.ownerId, property.id)).toMatchObject({ pin: LAKEVIEW, pinSource: "looked_up", pinConfirmedAt: null });
    expect((await propertiesNeedingPin(t.db, owner.ownerId)).map((row) => row.id)).toEqual([property.id]);

    // Confirmed where it is: still "looked up".
    expect(await confirmPin(t.db, owner.ownerId, property.id, { ...LAKEVIEW, moved: false })).toMatchObject({ ok: true, property: { pinSource: "looked_up" } });
    expect((await getProperty(t.db, owner.ownerId, property.id))!.pinConfirmedAt!.toISOString()).toBe(MONDAY_10AM.toISOString());
    expect(await propertiesNeedingPin(t.db, owner.ownerId)).toEqual([]);
    // Dragged 20 m: "owner moved", and a later lookup never moves it back.
    expect(await confirmPin(t.db, owner.ownerId, property.id, { lat: -45.03378, lng: 168.6551, moved: true })).toMatchObject({ ok: true, property: { pinSource: "owner_moved", pin: { lat: -45.03378, lng: 168.6551 } } });
    expect(await lookUpPin(t.db, stub({ lat: -45.5, lng: 169 }), property.id)).toBeNull();
    expect((await getProperty(t.db, owner.ownerId, property.id))!.pin).toEqual({ lat: -45.03378, lng: 168.6551 });
  });

  it("can only be set by the property's own owner, and only to a real place", async () => {
    await liveMarket(t.db);
    const alice = await makeOwner(t.db);
    const bob = await makeOwner(t.db);
    const home = await makeProperty(t.db, alice.ownerId);
    expect(await confirmPin(t.db, bob.ownerId, home.id, { ...LAKEVIEW, moved: true })).toEqual({ ok: false, message: "We could not find that property." });
    expect(await confirmPin(t.db, alice.ownerId, home.id, { lat: Number.NaN, lng: 168, moved: true })).toMatchObject({ ok: false });
    expect(await confirmPin(t.db, alice.ownerId, home.id, { lat: 0, lng: 0, moved: true })).toMatchObject({ ok: false });
    expect((await getProperty(t.db, alice.ownerId, home.id))!.pin).toBeNull();
  });

  it("is cleared when the street address changes, so the new address is looked up and checked again", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const property = await makeProperty(t.db, owner.ownerId);
    await confirmPin(t.db, owner.ownerId, property.id, { ...LAKEVIEW, moved: true });
    await updateProperty(t.db, owner.ownerId, property.id, { accessNotes: "New lockbox code 1234." });
    expect((await getProperty(t.db, owner.ownerId, property.id))!).toMatchObject({ pin: LAKEVIEW, pinSource: "owner_moved" });
    await updateProperty(t.db, owner.ownerId, property.id, { addressLine1: "27 Atley Road", suburb: "Arthurs Point" });
    expect((await getProperty(t.db, owner.ownerId, property.id))!).toMatchObject({ pin: null, pinSource: "none", pinConfirmedAt: null, pinLookupAt: null });
  });

  it("is filled in by the timer for pasted properties, a few at a time, and an address not found is not asked twice", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const found = await makeProperty(t.db, owner.ownerId);
    const lost = await makeProperty(t.db, owner.ownerId);
    const linz: Geocoder = { lookUp: async (address) => (address.addressLine1 === found.addressLine1 ? LAKEVIEW : null) };
    // No key: nothing is asked.
    expect(await fillMissingPins(t.db, null)).toBe(0);
    const report = await runTick(t.db, { gatewayFor: gatewayFor(t.db), geocoder: linz, log: { error: () => {} } });
    expect(report.pins_found).toBe(1);
    expect((await getProperty(t.db, owner.ownerId, found.id))!.pinSource).toBe("looked_up");
    expect((await getProperty(t.db, owner.ownerId, lost.id))!).toMatchObject({ pinSource: "none", pinLookupAt: MONDAY_10AM });
    let asked = 0;
    expect(await fillMissingPins(t.db, { lookUp: async () => (asked++, null) })).toBe(0);
    expect(asked).toBe(0);
  });
});

/** The smallest JPEG with an EXIF block: IFD0 points to the camera's list, which holds DateTimeOriginal (and optionally its time zone). */
function jpegWithExif(taken: string, offset?: string, little = true): Uint8Array {
  const out: number[] = [];
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) => (little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0)).concat([0]);
  const tags = offset ? 2 : 1;
  const ifd0 = 8;
  const camera = ifd0 + 2 + 12 + 4;
  const valueAt = camera + 2 + tags * 12 + 4;
  const tiff = [
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0),
    ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(camera), ...u32(0),
    ...u16(tags), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(valueAt),
    ...(offset ? [...u16(0x9011), ...u16(2), ...u32(7), ...u32(valueAt + 20)] : []), ...u32(0),
    ...ascii(taken), ...(offset ? ascii(offset) : []),
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  out.push(0xff, 0xd8, 0xff, 0xe1, ((app1.length + 2) >> 8) & 0xff, (app1.length + 2) & 0xff, ...app1, 0xff, 0xd9);
  return new Uint8Array(out);
}

describe("the date inside a photo", () => {
  it("is read from the camera's own record, in either byte order, with its time zone when it has one", () => {
    expect(exifTakenAt(jpegWithExif("2026:11:15 09:00:00"))).toEqual({ local: "2026-11-15T09:00:00", offset: null });
    expect(exifTakenAt(jpegWithExif("2026:11:16 10:05:09", "+13:00", false))).toEqual({ local: "2026-11-16T10:05:09", offset: "+13:00" });
    // 10:05:09am at +13:00 is 21:05:09 the day before in UTC.
    expect(exifToDate({ local: "2026-11-16T10:05:09", offset: "+13:00" })!.toISOString()).toBe("2026-11-15T21:05:09.000Z");
  });

  it("is nothing for a PNG, a JPEG without a date, or rubbish", () => {
    expect(exifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(exifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
    expect(exifTakenAt(jpegWithExif("0000:00:00 00:00:00"))).toBeNull();
    expect(exifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0]))).toBeNull();
  });
});
