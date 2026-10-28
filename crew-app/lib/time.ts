import { brand } from "@/config/brand";
import type { RateBand } from "./types";

const TZ = brand.timeZone;

/** Parts of a Date in the brand time zone. */
export function zonedParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: weekdayIndex, // 0 = Sunday
    ymd: `${p.year}-${p.month}-${p.day}`,
  };
}

/** Today's date as YYYY-MM-DD in NZ. */
export function todayYmd(now = new Date()): string {
  return zonedParts(now).ymd;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Offset (minutes) of the brand time zone from UTC at a given instant. */
function tzOffsetMinutes(at: Date): number {
  const p = zonedParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Build an ISO instant from a local NZ date + HH:MM. Handles DST by iterating once. */
export function zonedDateTimeToIso(ymd: string, hhmm: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMinutes(new Date(guess));
    guess = Date.UTC(y, m - 1, d, hh, mm) - off * 60000;
  }
  return new Date(guess).toISOString();
}

export function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(brand.locale, {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(d)
    .replace(/\s/g, "")
    .toLowerCase();
}

export function fmtDateLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  // Noon UTC avoids the date rolling when formatted in NZ.
  return new Intl.DateTimeFormat(brand.locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function fmtDateShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat(brand.locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat(brand.locale, {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Labour rate band from the instant work starts.
 * Standard: configured weekdays and hours. Night / Sunday: configured night window or Sunday.
 * Everything else: after hours. Public holidays are not detected automatically (Mike can
 * change the band on the office screen in phase 2).
 */
export function rateBandFor(at: Date): RateBand {
  const p = zonedParts(at);
  const mins = p.hour * 60 + p.minute;
  const { standard, nightSunday } = brand.rateBands;
  const nightFrom = hhmmToMinutes(nightSunday.nightFrom);
  const nightTo = hhmmToMinutes(nightSunday.nightTo);
  if (p.weekday === 0 || mins >= nightFrom || mins < nightTo) return "night_sunday";
  const stdDays: readonly number[] = standard.days;
  if (stdDays.includes(p.weekday) && mins >= hhmmToMinutes(standard.from) && mins < hhmmToMinutes(standard.to)) {
    return "standard";
  }
  return "after_hours";
}

export const RATE_BAND_LABEL: Record<RateBand, string> = {
  standard: brand.rateBands.standard.label,
  after_hours: brand.rateBands.afterHours.label,
  night_sunday: brand.rateBands.nightSunday.label,
};
