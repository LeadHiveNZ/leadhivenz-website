import type { ServiceArea } from "@config/markets";

/**
 * SERVICE AREAS (DECISIONS.md, 2026-11-26).
 *
 * Each market is split into areas. A tradie ticks the areas they cover, and a
 * job is only offered to tradies who cover its property's area. There is no
 * travel charge. A property with no area (its suburb matched none) can be
 * offered to everyone, and staff are nudged to set it.
 *
 * Plain functions with no database, so the property form can use them in the
 * browser to pre-select the area from the suburb typed.
 */

/** A place name made comparable: lower case, no macrons or apostrophes, single spaces. "Wānaka " and "wanaka" match. */
export function foldPlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The area a typed suburb belongs to, or null. The whole suburb is tried first,
 * then each part of it split at commas ("Frankton, Queenstown" finds Frankton).
 */
export function areaForSuburb(areas: readonly ServiceArea[], suburb: string | null | undefined): string | null {
  if (!suburb) return null;
  const tries = [suburb, ...suburb.split(",")].map(foldPlace).filter(Boolean);
  for (const typed of tries) {
    const found = areas.find((area) => area.suburbs.some((name) => foldPlace(name) === typed) || foldPlace(area.name) === typed);
    if (found) return found.key;
  }
  return null;
}

/** The area's name for people, or the key itself if the market no longer has it. */
export function areaName(areas: readonly ServiceArea[], key: string | null | undefined): string | null {
  if (!key) return null;
  return areas.find((area) => area.key === key)?.name ?? key;
}

/** Only the keys this market has, each once, in the market's order. */
export function cleanAreaKeys(areas: readonly ServiceArea[], keys: readonly string[]): string[] {
  const chosen = new Set(keys);
  return areas.filter((area) => chosen.has(area.key)).map((area) => area.key);
}

/** Every area of the market: what a new tradie covers until they change it. */
export function allAreaKeys(areas: readonly ServiceArea[]): string[] {
  return areas.map((area) => area.key);
}
