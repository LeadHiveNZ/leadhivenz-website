import { env } from "@/lib/env";

/**
 * FINDING A PROPERTY ON THE MAP FROM ITS ADDRESS (DECISIONS.md, 2026-11-19).
 *
 * New Zealand addresses are looked up in the government's own address list,
 * "NZ Addresses" (layer 105689), from Toitū Te Whenua Land Information New
 * Zealand (LINZ), through the LINZ Data Service. It is free: a LINZ Data
 * Service account and its API key cost nothing, and the data is licensed
 * CC BY 4.0 (credit: "Sourced from the LINZ Data Service, CC BY 4.0").
 *
 * What this code relies on, from the LINZ Data Service guides (read
 * November 2026, "WFS filtering by attribute or feature"):
 *  - GET https://data.linz.govt.nz/services;key=YOUR_API_KEY/wfs
 *      ?service=WFS&version=2.0.0&request=GetFeature&typeNames=layer-105689
 *      &cql_filter=full_address ILIKE '14B Lake Esplanade,%25'&outputFormat=json
 *  - ILIKE is the case-insensitive match; % is the wildcard (sent as %25).
 *  - Filters are case sensitive about the column names.
 *  - The layer's columns include full_address ("14B Lake Esplanade,
 *    Queenstown"), and gd2000_xcoord / gd2000_ycoord (longitude and latitude,
 *    NZGD2000, which is within a metre or so of the GPS on a phone).
 *
 * No key (LINZ_DATA_KEY unset): nothing is looked up. The owner places the
 * pin by tapping the map or with "I'm at the property now" instead.
 *
 * Not used, and why (the full comparison is in DECISIONS.md):
 *  - OpenStreetMap's Nominatim forbids autocomplete, caps everyone at one
 *    request a second and discourages bulk lookups like a spreadsheet import.
 *  - Google, Mapbox (storing a result needs its paid "permanent" geocoding)
 *    and Addressfinder all cost money once past a free allowance, and the
 *    founder approves any paid service first.
 */

export type GeoPoint = { lat: number; lng: number };
export type AddressQuery = { addressLine1: string; suburb: string; postcode?: string; town?: string | null };

export type Geocoder = {
  /** Where this address is, or null when it cannot be found for sure. Never throws. */
  lookUp(address: AddressQuery): Promise<GeoPoint | null>;
};

const TIMEOUT_MS = 6_000;
export const NZ_ADDRESSES_LAYER = "layer-105689";

/** True when a point is a real place on earth, not 0,0 or out of range. */
export function isPoint(point: { lat?: unknown; lng?: unknown } | null | undefined): point is GeoPoint {
  if (!point) return false;
  const { lat, lng } = point;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** "14B  Lake Esplanade " -> "14B Lake Esplanade", with quotes and wildcards taken out so the filter means only this. */
export function cleanStreet(line: string): string {
  return line.replace(/[%_*'"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** The filter sent to LINZ: every address that starts with this street address. */
export function addressFilter(addressLine1: string): string | null {
  const street = cleanStreet(addressLine1);
  if (street.length < 3 || !/\d/.test(street)) return null;
  return `full_address ILIKE '${street},%'`;
}

export function lookupUrl(key: string, addressLine1: string): string | null {
  const filter = addressFilter(addressLine1);
  if (!filter) return null;
  const params = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: NZ_ADDRESSES_LAYER, count: "20", outputFormat: "json", cql_filter: filter,
  });
  return `https://data.linz.govt.nz/services;key=${encodeURIComponent(key)}/wfs?${params.toString()}`;
}

type Feature = { properties?: Record<string, unknown> | null; geometry?: { type?: string; coordinates?: unknown } | null };

/** The point of one address in the reply: the two coordinate columns, or else the shape itself. */
function pointOf(feature: Feature): GeoPoint | null {
  const props = feature.properties ?? {};
  const x = Number(props.gd2000_xcoord);
  const y = Number(props.gd2000_ycoord);
  if (Number.isFinite(x) && Number.isFinite(y) && isPoint({ lat: y, lng: x })) return { lat: y, lng: x };
  const coords = feature.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    // Some services send latitude first. A New Zealand latitude is negative and a longitude is not.
    const [a, b] = coords as [number, number];
    const point = a < 0 && b > 0 ? { lat: a, lng: b } : { lat: b, lng: a };
    return isPoint(point) ? point : null;
  }
  return null;
}

/**
 * Chooses the address from what came back. One that names the suburb wins,
 * then one that names the town. If several match equally and none names the
 * suburb or town, nothing is chosen: a wrong pin is worse than no pin.
 */
export function pickAddress(features: Feature[], address: AddressQuery): GeoPoint | null {
  const candidates = features
    .map((feature) => ({ point: pointOf(feature), full: String(feature.properties?.full_address ?? "").toLowerCase() }))
    .filter((candidate): candidate is { point: GeoPoint; full: string } => candidate.point !== null);
  if (candidates.length === 0) return null;
  const words = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const suburb = words(address.suburb);
  const town = words(address.town);
  const named = (place: string) => (place.length >= 2 ? candidates.filter((candidate) => candidate.full.includes(`, ${place}`)) : []);
  const bySuburb = named(suburb);
  if (bySuburb.length >= 1) return bySuburb[0]!.point;
  const byTown = named(town);
  if (byTown.length === 1) return byTown[0]!.point;
  return candidates.length === 1 ? candidates[0]!.point : null;
}

/** The LINZ address list as a geocoder. */
export function linzGeocoder(key: string, fetchImpl: typeof fetch = fetch): Geocoder {
  return {
    async lookUp(address) {
      const url = lookupUrl(key, address.addressLine1);
      if (!url) return null;
      try {
        const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) {
          console.error(`[geocode] LINZ said ${response.status} for an address lookup.`);
          return null;
        }
        const body = (await response.json().catch(() => null)) as { features?: Feature[] } | null;
        return pickAddress(Array.isArray(body?.features) ? body!.features : [], address);
      } catch (error) {
        console.error("[geocode] the LINZ address lookup failed:", error instanceof Error ? error.message : error);
        return null;
      }
    },
  };
}

let override: Geocoder | null | undefined;

/** For tests: a stand-in geocoder, or null for "no key". Pass undefined to go back to the settings. */
export function setGeocoder(geocoder: Geocoder | null | undefined): void {
  override = geocoder;
}

/** The geocoder the settings allow, or null when no key is set. */
export function geocoder(): Geocoder | null {
  if (override !== undefined) return override;
  const key = env("LINZ_DATA_KEY");
  return key ? linzGeocoder(key) : null;
}
