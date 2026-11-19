import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { isPoint, type Geocoder, type GeoPoint } from "@/lib/maps/geocode";
import { getMarket } from "@/lib/markets/store";
import { getProperty, getPropertyForStaff, type Property } from "./service";

/**
 * EVERY PROPERTY'S MAP PIN (DECISIONS.md, 2026-11-19).
 *
 * When a property is added, changes address or is pasted in from a
 * spreadsheet, its address is looked up and the pin is put there
 * ("looked_up"). The owner sees it on a small map on the property page, can
 * drag it onto the house or use "I'm at the property now", and confirms it.
 * Placed or moved by the owner, it is "owner_moved".
 *
 * The pin is what a tradie's Arrived and Job done taps are measured against
 * (src/lib/jobs/checks.ts). A property with no pin falls back to where
 * earlier trusted arrivals were.
 *
 * Every function that takes an owner's id only touches that owner's property.
 */

/** Looks up the address and puts the pin there. Leaves a pin the owner placed alone. Returns the pin found, if any. */
export async function lookUpPin(db: Db, geocoder: Geocoder | null, propertyId: string): Promise<GeoPoint | null> {
  const property = await getPropertyForStaff(db, propertyId);
  if (!property || property.pinSource === "owner_moved" || !geocoder) return null;
  const market = await getMarket(db, property.market);
  const found = await geocoder.lookUp({ addressLine1: property.addressLine1, suburb: property.suburb, postcode: property.postcode, town: market?.name ?? null });
  const at = now().toISOString();
  if (!isPoint(found)) {
    await db.query("update public.properties set pin_lookup_at = $2::timestamptz where id = $1::uuid and pin_source <> 'owner_moved'", [propertyId, at]);
    return null;
  }
  const rows = await db.query(
    `update public.properties set pin_lat = $2, pin_lng = $3, pin_source = 'looked_up', pin_confirmed_at = null, pin_lookup_at = $4::timestamptz
      where id = $1::uuid and pin_source <> 'owner_moved' returning id`,
    [propertyId, round(found.lat), round(found.lng), at],
  );
  if (rows.length > 0) {
    await audit(db, { actor: "system", action: "property.pin_looked_up", entity: "property", entityId: propertyId, detail: { lat: round(found.lat), lng: round(found.lng) } });
  }
  return found;
}

/** Six decimal places is about 10 cm: plenty. */
function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export type PinResult = { ok: true; property: Property } | { ok: false; message: string };

/**
 * The owner confirms the pin, after dragging it or not. `moved` is true when
 * they dragged it, tapped the map or used their phone's location.
 */
export async function confirmPin(db: Db, ownerId: string, propertyId: string, input: { lat: number; lng: number; moved: boolean }): Promise<PinResult> {
  const point = { lat: input.lat, lng: input.lng };
  if (!isPoint(point)) return { ok: false, message: "Put the pin on the house first: tap the map where it is, or press \"I'm at the property now\"." };
  return db.tx(async (tx) => {
    const property = await getProperty(tx, ownerId, propertyId);
    if (!property) return { ok: false, message: "We could not find that property." };
    const source = input.moved || property.pinSource !== "looked_up" ? "owner_moved" : "looked_up";
    await tx.query(
      `update public.properties set pin_lat = $3, pin_lng = $4, pin_source = $5, pin_confirmed_at = $6::timestamptz
        where id = $1::uuid and owner_id = $2::uuid`,
      [propertyId, ownerId, round(point.lat), round(point.lng), source, now().toISOString()],
    );
    await audit(tx, {
      actor: `owner:${ownerId}`, action: "property.pin_confirmed", entity: "property", entityId: propertyId,
      detail: { lat: round(point.lat), lng: round(point.lng), source, was: property.pin },
    });
    return { ok: true, property: (await getProperty(tx, ownerId, propertyId))! };
  });
}

/** The owner's properties whose pin they have not confirmed yet, for the prompt on their properties page. */
export async function propertiesNeedingPin(db: Db, ownerId: string): Promise<{ id: string; name: string; pinSource: string }[]> {
  return db.query<{ id: string; name: string; pinSource: string }>(
    `select id, name, pin_source as "pinSource" from public.properties
      where owner_id = $1::uuid and status <> 'cancelled' and pin_confirmed_at is null
      order by created_at`,
    [ownerId],
  );
}

/**
 * Run by the timer: looks up a few properties that have never been looked up
 * (pasted in from a spreadsheet, or added before pins existed). Only while a
 * key is set. A few at a time, so a big import never floods the address service.
 */
export async function fillMissingPins(db: Db, geocoder: Geocoder | null, limit = 10): Promise<number> {
  if (!geocoder) return 0;
  const due = await db.query<{ id: string }>(
    "select id from public.properties where pin_source = 'none' and pin_lookup_at is null and status <> 'cancelled' order by created_at limit $1",
    [limit],
  );
  let found = 0;
  for (const row of due) {
    if (await lookUpPin(db, geocoder, row.id)) found += 1;
  }
  return found;
}
