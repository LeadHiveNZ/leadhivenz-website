/**
 * THE APP'S CLOCK.
 *
 * Everything that depends on the time (the 15-minute offer window, the
 * response promise, when a tradie is paid) asks this file what time it is,
 * rather than the computer. That lets the demo "skip ahead 15 minutes" and
 * lets the tests choose the time.
 *
 * On the live site the clock is always the real time.
 */

let offsetMs = 0;
let fixed: number | null = null;

export function now(): Date {
  return new Date(fixed ?? Date.now() + offsetMs);
}

/** Demo mode only: how far ahead of real time the app's clock is running. */
export function clockOffsetMs(): number {
  return offsetMs;
}

export function setClockOffsetMs(ms: number): void {
  offsetMs = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
}

/** Tests only: freeze the clock at a moment, or pass null to unfreeze it. */
export function setTestNow(moment: Date | null): void {
  fixed = moment ? moment.getTime() : null;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR);
}
