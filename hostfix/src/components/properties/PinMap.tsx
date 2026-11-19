"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { secondaryButtonClass } from "../forms/styles";
import { Icon } from "../ui/Icon";

type Point = { lat: number; lng: number };
export type PinTiles = { url: string; attribution: string; maxZoom: number; kind: "aerial" | "streets" } | null;

type Props = {
  /** The pin as it is now (looked up, or placed before). */
  initial: Point | null;
  /** Where to open the map when there is no pin yet: the middle of town. */
  centre: Point | null;
  tiles: PinTiles;
};

/** The whole of New Zealand, for a market with no centre set. */
const COUNTRY = { lat: -41.2, lng: 172.5 };

const PIN_HTML =
  '<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0f5257;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)"></span>';

/**
 * THE PROPERTY'S MAP PIN (DECISIONS.md, 2026-11-19). A small map with the pin
 * where the address was found. Drag the pin, or tap the map, to put it on the
 * house; or stand at the property and press "I'm at the property now". The
 * pin's position goes with the form as hidden fields, and nothing is saved
 * until the owner presses the button below the map.
 *
 * Uses Leaflet (leafletjs.com, BSD licence), loaded only on this page. The map
 * pictures come from LINZ Basemaps or OpenStreetMap, credited in the corner
 * as each requires (src/lib/maps/tiles.ts).
 */
export function PinMap({ initial, centre, tiles }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const place = useRef<((point: Point, byOwner: boolean) => void) | null>(null);
  const [point, setPoint] = useState<Point | null>(initial);
  const [moved, setMoved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await import("leaflet");
      const L = ((loaded as unknown as { default?: typeof loaded }).default ?? loaded) as typeof loaded;
      if (cancelled || !box.current || map.current) return;
      const start = initial ?? centre ?? COUNTRY;
      const created = L.map(box.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], initial ? 18 : centre ? 14 : 5);
      if (tiles) {
        L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom }).addTo(created);
      } else {
        created.attributionControl.addAttribution("Map pictures are switched off");
      }
      const icon = L.divIcon({ className: "", html: PIN_HTML, iconSize: [26, 26], iconAnchor: [13, 30] });
      place.current = (next, byOwner) => {
        if (!marker.current) {
          marker.current = L.marker([next.lat, next.lng], { draggable: true, icon, keyboard: true, title: "The house" }).addTo(created);
          marker.current.on("dragend", () => {
            const at = marker.current!.getLatLng();
            setPoint({ lat: at.lat, lng: at.lng });
            setMoved(true);
          });
        } else {
          marker.current.setLatLng([next.lat, next.lng]);
        }
        setPoint(next);
        if (byOwner) setMoved(true);
      };
      if (initial) place.current(initial, false);
      created.on("click", (event) => place.current?.({ lat: event.latlng.lat, lng: event.latlng.lng }, true));
      map.current = created;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is made once; the pin then moves inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function here() {
    setProblem(null);
    if (!("geolocation" in navigator)) {
      setProblem("This phone will not say where it is. Tap the map where the house is instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (place.current) place.current(next, true);
        else {
          setPoint(next);
          setMoved(true);
        }
        map.current?.setView([next.lat, next.lng], 18);
      },
      () => {
        setLocating(false);
        setProblem("Your phone did not give its location. Check location is switched on for this browser, or tap the map where the house is.");
      },
      { timeout: 10_000, maximumAge: 0, enableHighAccuracy: true },
    );
  }

  return (
    <div>
      <div ref={box} className="relative z-0 h-64 w-full overflow-hidden rounded-xl border border-line bg-tint sm:h-80" role="application" aria-label="Map. Tap where the house is, or drag the pin." />
      <input type="hidden" name="pinLat" value={point ? String(point.lat) : ""} />
      <input type="hidden" name="pinLng" value={point ? String(point.lng) : ""} />
      <input type="hidden" name="pinMoved" value={moved ? "1" : ""} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={here} disabled={locating} aria-busy={locating} className={secondaryButtonClass}>
          <Icon name="market" size={16} /> {locating ? "Finding you..." : "I'm at the property now"}
        </button>
        <span className="text-sm text-muted">{point ? (moved ? "Pin moved. Save it below." : "Drag the pin if it is not on the house.") : "Tap the map where the house is."}</span>
      </div>
      {problem && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {problem}
        </p>
      )}
    </div>
  );
}
