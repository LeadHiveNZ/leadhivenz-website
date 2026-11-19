import type { Market } from "@config/markets";
import { MINUTE } from "@/lib/clock";
import { formatClock, formatDeadline, isAfterHours, localParts, zonedInstant } from "@/lib/time";
import type { Line } from "./pricing";
import type { ArrivalCheck, Job } from "./types";

/**
 * WHEN THE TRADIE GETS THERE, AND WHAT THAT DECIDES (DECISIONS.md, 2026-11-18).
 *
 *   arrival window   a normal job: the tradie picks a two-hour window when they
 *                    accept, ending inside the promise. On time means arrived
 *                    by the end of it. An urgent job's window is its deadline.
 *   urgent           arrived after the urgent deadline: the urgent line is not
 *                    charged to anyone (owner pays 0, tradie gets 0, we keep 0).
 *   after hours      charged only if the Arrived tap is outside working hours.
 *   location         an Arrived tap with no location, or more than 300 m from
 *                    the property's map pin (or, with no pin, from where
 *                    trusted arrivals at the property were), is flagged
 *                    (DECISIONS.md, 2026-11-19: src/lib/jobs/checks.ts).
 *
 * Pure sums and checks, no database, so every rule can be tested by hand.
 */

export type Window = { start: Date; end: Date };

/** How long a window a tradie picks is. */
export const WINDOW_HOURS = 2;
/** A window has to leave at least this long to get there. */
const LEAD_MINUTES = 30;
/** How far ahead a chosen tradie may suggest a later time. */
export const PROPOSAL_DAYS = 7;
/**
 * An Arrived or Job done tap further than this from the property's pin (or
 * reference point) is flagged. 500 m until 19 November 2026, when properties
 * got their own map pin (DECISIONS.md, 2026-11-19).
 */
export const FAR_METRES = 300;

type Hours = Pick<Market, "timezone" | "hoursStart" | "hoursEnd" | "workDays">;

/** The time on-time is judged against: the window the tradie chose, or else the promise. */
export function onTimeDeadline(job: Pick<Job, "arrivalWindowEnd" | "respondBy">): Date | null {
  return job.arrivalWindowEnd ?? job.respondBy;
}

/** True when the tradie arrived by the end of their window (or the promise, with no window). */
export function arrivedOnTime(job: Pick<Job, "arrivalWindowEnd" | "respondBy">, arrivedAt: Date): boolean {
  const deadline = onTimeDeadline(job);
  return deadline === null || arrivedAt.getTime() <= deadline.getTime();
}

/**
 * The two-hour windows inside working hours (by the clock on the wall: 7am to
 * 4:30pm in Queenstown, the last one shorter) that end after `from` and no
 * later than `until`. A window already under way starts at `from`. Every day
 * of the week counts: a normal job carries no after-hours surcharge, so a
 * Saturday morning is a fine time to come.
 *
 * When no window fits (the promise ends in the middle of the night), the one
 * choice is "any time before the promise".
 */
export function arrivalWindows(market: Hours, from: Date, until: Date): Window[] {
  const windows: Window[] = [];
  if (until.getTime() <= from.getTime()) return windows;
  const earliestEnd = from.getTime() + LEAD_MINUTES * MINUTE;
  const startDay = localParts(from, market.timezone);
  for (let offset = 0; offset <= PROPOSAL_DAYS + 1; offset += 1) {
    const noon = zonedInstant(startDay.year, startDay.month, startDay.day, 12, market.timezone).getTime() + offset * 24 * 60 * MINUTE;
    const day = localParts(new Date(noon), market.timezone);
    for (let hour = market.hoursStart; hour < market.hoursEnd; hour += WINDOW_HOURS) {
      const start = zonedInstant(day.year, day.month, day.day, hour, market.timezone);
      const end = zonedInstant(day.year, day.month, day.day, Math.min(hour + WINDOW_HOURS, market.hoursEnd), market.timezone);
      if (end.getTime() > until.getTime()) return windows.length > 0 ? windows : [{ start: from, end: until }];
      if (end.getTime() < earliestEnd) continue;
      windows.push({ start: start.getTime() < from.getTime() ? from : start, end });
    }
  }
  return windows.length > 0 ? windows : [{ start: from, end: until }];
}

/** The windows a chosen tradie can suggest instead: after the promise, up to 7 days from now. */
export function laterWindows(market: Hours, promise: Date, at: Date): Window[] {
  const until = new Date(at.getTime() + PROPOSAL_DAYS * 24 * 60 * MINUTE);
  return arrivalWindows(market, promise.getTime() > at.getTime() ? promise : at, until).filter((window) => window.end.getTime() > promise.getTime());
}

/** Finds the window whose end matches, so a choice made on a page a minute ago still counts. */
export function pickWindow(windows: Window[], endIso: string): Window | null {
  const end = Date.parse(endIso);
  if (!Number.isFinite(end)) return null;
  return windows.find((window) => window.end.getTime() === end) ?? null;
}

/** "9am to 11am today", "1pm to 3pm tomorrow", "9am to 11am Tue 17 Nov". */
export function windowLabel(window: Window, from: Date, timeZone: string): string {
  const sameDay = localParts(window.start, timeZone).day === localParts(window.end, timeZone).day;
  return sameDay
    ? `${formatClock(window.start, timeZone)} to ${formatDeadline(window.end, from, timeZone)}`
    : `${formatDeadline(window.start, from, timeZone)} to ${formatDeadline(window.end, from, timeZone)}`;
}

/** The same as words in a sentence: "between 9am and 11am tomorrow". */
export function windowBetween(window: Window, from: Date, timeZone: string): string {
  const sameDay = localParts(window.start, timeZone).day === localParts(window.end, timeZone).day;
  return sameDay
    ? `between ${formatClock(window.start, timeZone)} and ${formatDeadline(window.end, from, timeZone)}`
    : `between ${formatDeadline(window.start, from, timeZone)} and ${formatDeadline(window.end, from, timeZone)}`;
}

/** How a booked job's arrival time is said to the owner and the reporter: the window, or "by 4:15pm today". */
export function bookedWhen(job: Pick<Job, "arrivalWindowStart" | "arrivalWindowEnd" | "respondBy" | "urgency">, from: Date, timeZone: string): string {
  if (job.urgency !== "urgent" && job.arrivalWindowStart && job.arrivalWindowEnd) {
    return windowBetween({ start: job.arrivalWindowStart, end: job.arrivalWindowEnd }, from, timeZone);
  }
  return job.respondBy ? `by ${formatDeadline(job.respondBy, from, timeZone)}` : "soon";
}

export type SurchargeVerdict = {
  /** An urgent job reached after its deadline: the urgent line is dropped for everyone. */
  dropUrgent: boolean;
  /** The Arrived tap was inside working hours: the after-hours line is dropped for everyone. */
  dropAfterHours: boolean;
};

/** What the Arrived time decides about the surcharges. */
export function surchargeVerdict(job: Pick<Job, "urgency" | "respondBy">, arrivedAt: Date, market: Hours): SurchargeVerdict {
  return {
    dropUrgent: job.urgency === "urgent" && job.respondBy !== null && arrivedAt.getTime() > job.respondBy.getTime(),
    dropAfterHours: !isAfterHours(arrivedAt, market),
  };
}

/** The surcharge lines the verdict takes off the job. Every other line is charged and paid as normal. */
export function linesToDrop<T extends Pick<Line, "kind">>(lines: T[], verdict: SurchargeVerdict): T[] {
  return lines.filter((line) => (line.kind === "urgent" && verdict.dropUrgent) || (line.kind === "after_hours" && verdict.dropAfterHours));
}

// ---------------------------------------------------------------------------
// WHERE THE ARRIVED TAP CAME FROM
// ---------------------------------------------------------------------------

export type Point = { lat: number; lng: number };

/** The distance between two points on the earth, in metres (the haversine formula). */
export function distanceMetres(a: Point, b: Point): number {
  const radius = 6_371_000;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.min(1, Math.sqrt(h))));
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * For a property with no map pin yet (src/lib/properties/pin.ts), the
 * reference is the middle (median) of where earlier trusted Arrived taps at
 * the same property were. One bad tap cannot move a median far once there are
 * three or more.
 */
export function referencePoint(earlier: Point[]): Point | null {
  if (earlier.length === 0) return null;
  return { lat: median(earlier.map((point) => point.lat)), lng: median(earlier.map((point) => point.lng)) };
}

export type ArrivalTrust = { check: ArrivalCheck; distanceM: number | null; reference: Point | null };

/** Whether an Arrived tap can be trusted, against earlier taps only (the fallback when a property has no pin). */
export function checkArrival(where: Point | null, earlier: Point[]): ArrivalTrust {
  const reference = referencePoint(earlier);
  if (!where) return { check: "no_location", distanceM: null, reference };
  if (!reference) return { check: "no_reference", distanceM: null, reference: null };
  const distanceM = distanceMetres(where, reference);
  return { check: distanceM > FAR_METRES ? "far" : "ok", distanceM, reference };
}
