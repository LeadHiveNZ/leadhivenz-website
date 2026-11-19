import { env } from "@/lib/env";

/**
 * THE PICTURES UNDER THE MAP PIN (DECISIONS.md, 2026-11-19).
 *
 *  LINZ_BASEMAPS_KEY set   LINZ Basemaps aerial photos of New Zealand, sharp
 *                          enough in towns for the owner to put the pin on
 *                          their own roof. Free for both kinds of key. A "developer" key (asked
 *                          for from LINZ) never expires and has no limit; the
 *                          standard key from basemaps.linz.govt.nz runs out
 *                          after 90 days and allows 1,000 tiles a minute.
 *                          The credit must always be shown and link to LINZ's
 *                          attribution page (basemaps.linz.govt.nz/docs, "Data
 *                          attribution", read November 2026).
 *  no key                  OpenStreetMap's own street map, which allows light
 *                          use by a website with the credit "© OpenStreetMap
 *                          contributors" shown on the map (operations.osmfoundation.org/
 *                          policies/tiles, read November 2026). Pins are placed
 *                          a few times per property, which is light use.
 *  MAP_TILES=off           no pictures at all (the browser tests use this, so
 *                          they never ask OpenStreetMap for anything). The pin
 *                          still works on a blank map and with "I'm at the
 *                          property now".
 *
 * The Basemaps key is sent to the owner's browser inside the picture
 * addresses. That is how LINZ's keys are meant to be used: it is not a secret
 * that unlocks anything but the map pictures.
 */

export type MapTiles = { url: string; attribution: string; maxZoom: number; kind: "aerial" | "streets" } | null;

export function mapTiles(): MapTiles {
  const key = env("LINZ_BASEMAPS_KEY");
  if (key) {
    return {
      url: `https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api=${encodeURIComponent(key)}`,
      attribution: '<a href="https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution" target="_blank" rel="noreferrer">LINZ CC BY 4.0 © Imagery Basemap contributors</a>',
      maxZoom: 20,
      kind: "aerial",
    };
  }
  if ((env("MAP_TILES") ?? "").toLowerCase() === "off") return null;
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    kind: "streets",
  };
}
