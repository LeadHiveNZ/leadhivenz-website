/**
 * LOCAL TIME. Each market has its own timezone, and the rules that depend on
 * the clock on the wall there (after-hours, "this month") are worked out here.
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The date and time on the wall in that timezone at that moment. */
export function localParts(date: Date, timeZone: string): LocalParts {
  const found: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) found[part.type] = part.value;
  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    hour: Number(found.hour) % 24,
    minute: Number(found.minute),
    weekday: (found.weekday ?? "").toLowerCase().slice(0, 3) as Weekday,
  };
}

const two = (n: number) => String(n).padStart(2, "0");

/** "2026-11" in the market's own time. Used for once-a-month rules. */
export function monthKey(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.year}-${two(p.month)}`;
}

/** "2026-11-15" in the market's own time. */
export function dateKey(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

type Hours = { timezone: string; hoursStart: number; hoursEnd: number; workDays: string[] };

/**
 * True when that moment is outside the market's normal working hours. Hours
 * can be on the half hour: 16.5 is 4:30pm, so 4:29pm is inside and 4:30pm is not.
 */
export function isAfterHours(date: Date, market: Hours): boolean {
  const p = localParts(date, market.timezone);
  if (!market.workDays.includes(p.weekday)) return true;
  const hourOfDay = p.hour + p.minute / 60;
  return hourOfDay < market.hoursStart || hourOfDay >= market.hoursEnd;
}

/** A working-day hour as people say it: 7 is "7am", 16.5 is "4:30pm", 12 is "midday", 0 and 24 are "midnight". */
export function formatHourOfDay(value: number): string {
  if (value === 0 || value === 24) return "midnight";
  if (value === 12) return "midday";
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  const hour12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${hour12}${minutes ? `:${two(minutes)}` : ""}${whole < 12 ? "am" : "pm"}`;
}

function clock(p: LocalParts): string {
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const suffix = p.hour < 12 ? "am" : "pm";
  return p.minute === 0 ? `${hour12}${suffix}` : `${hour12}:${two(p.minute)}${suffix}`;
}

const DAY_NAMES: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "4:15pm" */
export function formatClock(date: Date, timeZone: string): string {
  return clock(localParts(date, timeZone));
}

/** "Sun 15 Nov, 4:15pm" */
export function formatDateTime(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${DAY_NAMES[p.weekday]} ${p.day} ${MONTH_NAMES[p.month - 1]}, ${clock(p)}`;
}

/** "15 Nov 2026" */
export function formatDate(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.day} ${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

/**
 * A time people can act on: "4:15pm today", "9am tomorrow", "4:15pm Tue".
 * `from` is the moment it is being read.
 */
export function formatDeadline(date: Date, from: Date, timeZone: string): string {
  const target = localParts(date, timeZone);
  const today = dateKey(from, timeZone);
  const tomorrow = dateKey(new Date(from.getTime() + 24 * 60 * 60 * 1000), timeZone);
  const key = dateKey(date, timeZone);
  if (key === today) return `${clock(target)} today`;
  if (key === tomorrow) return `${clock(target)} tomorrow`;
  return `${clock(target)} ${DAY_NAMES[target.weekday]} ${target.day} ${MONTH_NAMES[target.month - 1]}`;
}

/** "45 min", "2 h 15 min", "3 days". Never negative. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  return `${Math.round(hours / 24)} days`;
}

/** "2026-11" becomes "November 2026". */
export function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** The first and last moment of a calendar month in that timezone, as real instants. */
export function monthBounds(key: string, timeZone: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Not a month: ${key}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = zonedMidnight(year, month, 1, timeZone);
  const end = month === 12 ? zonedMidnight(year + 1, 1, 1, timeZone) : zonedMidnight(year, month + 1, 1, timeZone);
  return { start, end };
}

/** The instant at which it is 00:00 on that date in that timezone. */
function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  return zonedInstant(year, month, day, 0, timeZone);
}

/**
 * The instant at which the wall clock in that timezone shows that date and
 * hour of day. Hours can be on the half hour: 16.5 is 4:30pm.
 */
export function zonedInstant(year: number, month: number, day: number, hourOfDay: number, timeZone: string): Date {
  const hour = Math.floor(hourOfDay);
  const minute = Math.round((hourOfDay - hour) * 60);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Start from the same wall time in UTC, then correct by the zone's offset
  // at that moment. Twice, in case the first guess straddles a clock change.
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const p = localParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    guess -= asUtc - target;
  }
  return new Date(guess);
}

/**
 * QUIET HOURS (DECISIONS.md, 2026-11-18). The texts about a normal job that
 * nobody has taken yet, and a tradie's suggested later time, are never sent
 * between 9pm and 7am on the wall in the market: they wait until 7am. The
 * clocks that decide when those texts are due (3 hours, 2 hours) also count
 * only the hours from 7am to 9pm, so they do not run out overnight. Urgent jobs
 * are not affected: they go out at any time.
 *
 * The market's working hours (7am to 4:30pm in Queenstown) are when tradies
 * work, which is a different question from when it is fine to text an owner,
 * so these are their own constants.
 */
export const TEXTING_STARTS = 7;
export const TEXTING_ENDS = 21;

function awakeBounds(date: Date, timeZone: string): { start: Date; end: Date; nextStart: Date } {
  const p = localParts(date, timeZone);
  const start = zonedInstant(p.year, p.month, p.day, TEXTING_STARTS, timeZone);
  const end = zonedInstant(p.year, p.month, p.day, TEXTING_ENDS, timeZone);
  const tomorrow = localParts(new Date(zonedInstant(p.year, p.month, p.day, 12, timeZone).getTime() + 24 * 60 * 60 * 1000), timeZone);
  return { start, end, nextStart: zonedInstant(tomorrow.year, tomorrow.month, tomorrow.day, TEXTING_STARTS, timeZone) };
}

/** True between 9pm and 7am on the wall in that timezone. */
export function isQuietHours(date: Date, timeZone: string): boolean {
  const { start, end } = awakeBounds(date, timeZone);
  return date.getTime() < start.getTime() || date.getTime() >= end.getTime();
}

/** The moment itself if it is between 7am and 9pm there, or else the next 7am. */
export function nextTextingTime(date: Date, timeZone: string): Date {
  const { start, end, nextStart } = awakeBounds(date, timeZone);
  if (date.getTime() < start.getTime()) return start;
  if (date.getTime() >= end.getTime()) return nextStart;
  return date;
}

/** Adds hours, counting only the time between 7am and 9pm there. Mon 7pm plus 3 hours is Tue 8am. */
export function addTextingHours(from: Date, hours: number, timeZone: string): Date {
  let remaining = hours * 60 * 60 * 1000;
  let cursor = nextTextingTime(from, timeZone);
  for (let day = 0; day < 400; day += 1) {
    const { end, nextStart } = awakeBounds(cursor, timeZone);
    const left = end.getTime() - cursor.getTime();
    if (remaining <= left) return new Date(cursor.getTime() + remaining);
    remaining -= left;
    cursor = nextStart;
  }
  return cursor;
}

/** Every half hour from midnight to midnight, for "Send me jobs from __ to __" (a tradie's own hours). */
export const HOUR_OPTIONS: { key: string; label: string }[] = Array.from({ length: 49 }, (_, index) => {
  const value = index / 2;
  return { key: String(value), label: value === 0 ? "midnight (start of the day)" : value === 24 ? "midnight (end of the day)" : formatHourOfDay(value) };
});

/** A tradie's hours as people say them: "7am to 4:30pm". */
export function hoursLabel(from: number, to: number): string {
  return `${formatHourOfDay(from)} to ${formatHourOfDay(to)}`;
}
