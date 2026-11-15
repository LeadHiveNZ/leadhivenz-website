import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { dateKey, formatClock, formatDateTime, formatDeadline, formatDuration, isAfterHours, isValidTimeZone, localParts, monthBounds, monthKey, monthLabel } from "@/lib/time";

const NZ = "Pacific/Auckland";
const QLD = "Australia/Brisbane";

describe("local time", () => {
  it("reads the wall clock in the market's timezone", () => {
    // 15 Nov 2026 02:00 UTC is 3pm Sunday in New Zealand (daylight time, UTC+13).
    expect(localParts(new Date("2026-11-15T02:00:00Z"), NZ)).toEqual({ year: 2026, month: 11, day: 15, hour: 15, minute: 0, weekday: "sun" });
    // Queensland has no daylight saving: UTC+10 all year.
    expect(localParts(new Date("2026-11-15T02:00:00Z"), QLD)).toMatchObject({ hour: 12, weekday: "sun" });
    // In winter New Zealand is UTC+12.
    expect(localParts(new Date("2026-06-15T02:00:00Z"), NZ)).toMatchObject({ hour: 14, weekday: "mon" });
  });

  it("reads midnight as hour 0", () => {
    expect(localParts(new Date("2026-11-14T11:00:00Z"), NZ)).toMatchObject({ day: 15, hour: 0 });
  });

  it("works out the month and the date in local time, not UTC", () => {
    // 30 Nov 2026 11:30 UTC is already 1 December in New Zealand.
    const moment = new Date("2026-11-30T11:30:00Z");
    expect(monthKey(moment, NZ)).toBe("2026-12");
    expect(dateKey(moment, NZ)).toBe("2026-12-01");
    expect(monthKey(moment, QLD)).toBe("2026-11");
  });

  it("finds the real start and end of a local month", () => {
    const { start, end } = monthBounds("2026-11", NZ);
    expect(start.toISOString()).toBe("2026-10-31T11:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T11:00:00.000Z");
    // April: daylight saving ends on the 5th, so the month starts at +13 and ends at +12.
    const april = monthBounds("2026-04", NZ);
    expect(april.start.toISOString()).toBe("2026-03-31T11:00:00.000Z");
    expect(april.end.toISOString()).toBe("2026-04-30T12:00:00.000Z");
  });

  it("knows a real timezone from a made-up one", () => {
    expect(isValidTimeZone(NZ)).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("after-hours", () => {
  const at = (iso: string) => isAfterHours(new Date(iso), launchMarket);

  it("is false inside 7am to 6pm, Monday to Saturday", () => {
    expect(at("2026-11-16T20:00:00Z")).toBe(false); // Tue 9am
    expect(at("2026-11-13T18:00:00Z")).toBe(false); // Sat 7am exactly
    expect(at("2026-11-16T04:59:00Z")).toBe(false); // Mon 5:59pm
  });

  it("is true before 7am, from 6pm, and all day Sunday", () => {
    expect(at("2026-11-16T17:59:00Z")).toBe(true); // Tue 6:59am
    expect(at("2026-11-16T05:00:00Z")).toBe(true); // Mon 6pm exactly
    expect(at("2026-11-15T01:00:00Z")).toBe(true); // Sun 2pm
  });

  it("follows the market's own hours and days", () => {
    const sevenDay = { ...launchMarket, workDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], hoursStart: 8, hoursEnd: 20 };
    expect(isAfterHours(new Date("2026-11-15T01:00:00Z"), sevenDay)).toBe(false); // Sun 2pm
    expect(isAfterHours(new Date("2026-11-16T18:30:00Z"), sevenDay)).toBe(true); // Tue 7:30am
  });
});

describe("times people read", () => {
  it("writes clock times the way people say them", () => {
    expect(formatClock(new Date("2026-11-15T03:15:00Z"), NZ)).toBe("4:15pm");
    expect(formatClock(new Date("2026-11-14T20:00:00Z"), NZ)).toBe("9am");
    expect(formatClock(new Date("2026-11-14T11:05:00Z"), NZ)).toBe("12:05am");
    expect(formatClock(new Date("2026-11-14T23:00:00Z"), NZ)).toBe("12pm");
    expect(formatDateTime(new Date("2026-11-15T03:15:00Z"), NZ)).toBe("Sun 15 Nov, 4:15pm");
  });

  it("says today, tomorrow or the day", () => {
    const from = new Date("2026-11-15T02:00:00Z"); // Sun 3pm
    expect(formatDeadline(new Date("2026-11-15T06:00:00Z"), from, NZ)).toBe("7pm today");
    expect(formatDeadline(new Date("2026-11-16T02:00:00Z"), from, NZ)).toBe("3pm tomorrow");
    expect(formatDeadline(new Date("2026-11-18T02:30:00Z"), from, NZ)).toBe("3:30pm Wed 18 Nov");
  });

  it("writes lengths of time simply", () => {
    expect(formatDuration(14 * 60_000)).toBe("14 min");
    expect(formatDuration(135 * 60_000)).toBe("2 h 15 min");
    expect(formatDuration(4 * 3_600_000)).toBe("4 h");
    expect(formatDuration(72 * 3_600_000)).toBe("3 days");
    expect(formatDuration(-5)).toBe("0 min");
    expect(monthLabel("2026-11")).toBe("November 2026");
  });
});
