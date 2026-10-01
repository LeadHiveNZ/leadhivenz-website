// The Tipsy Tui — subscribable calendar feed (iCalendar / .ics)
// GET /calendar?token=YOUR_SECRET
// Subscribe to this URL from Google Calendar or iPhone Calendar and every
// confirmed job shows up on both phones automatically.
//
// Deploy:  supabase functions deploy calendar --no-verify-jwt
// Secrets: supabase secrets set CALENDAR_TOKEN=some-long-random-string

import { createClient } from "npm:@supabase/supabase-js@2";

const PACKAGE_LABEL: Record<string, string> = {
  dry_hire: "Dry Hire",
  byo: "BYO Bar",
  fully_catered: "Fully Catered",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expected = Deno.env.get("CALENDAR_TOKEN");
  if (!expected || token !== expected) return new Response("Not found", { status: 404 });

  // Service role: this feed is read by calendar apps, not by a logged-in user.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, booking_staff(staff(name))")
    .in("status", ["quoted", "confirmed", "completed"])
    .order("event_date");
  if (error) return new Response(error.message, { status: 500 });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Tipsy Tui//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:The Tipsy Tui",
    "X-WR-TIMEZONE:Pacific/Auckland",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...NZ_TIMEZONE,
  ];

  for (const b of bookings ?? []) {
    const setupHrs = Number(b.setup_hours ?? 1);
    const packHrs = Number(b.packdown_hours ?? 1);
    const start = b.start_time ? shiftTime(b.start_time, -setupHrs) : null;
    const finish = b.finish_time ? shiftTime(b.finish_time, packHrs) : null;
    const staff = (b.booking_staff ?? []).map((s: { staff: { name: string } }) => s.staff?.name).filter(Boolean);

    const summary = `${b.status === "quoted" ? "(Quoted) " : ""}${b.client_name} — ${PACKAGE_LABEL[b.package] ?? b.package}`;
    const description = [
      b.event_name,
      `${b.guest_count ?? "?"} guests · bar ${fmt12(b.start_time)}–${fmt12(b.finish_time)}`,
      `Setup from ${fmt12(start)} · pack-down done ${fmt12(finish)}`,
      b.travel_minutes ? `Travel: ${b.travel_minutes} min each way` : "Local job",
      staff.length ? `Crew: ${staff.join(", ")}` : "Crew: not rostered yet",
      b.total != null ? `Total $${Number(b.total).toFixed(0)} · deposit ${b.deposit_paid ? "paid" : "NOT paid"}` : "",
      b.notes ? `Notes: ${b.notes}` : "",
    ].filter(Boolean).join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${b.id}@thetipsytui`);
    lines.push(`DTSTAMP:${new Date(b.updated_at ?? b.created_at).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`);
    if (start && finish) {
      const endDate = finish < start ? nextDay(b.event_date) : b.event_date;
      lines.push(`DTSTART;TZID=Pacific/Auckland:${icsLocal(b.event_date, start)}`);
      lines.push(`DTEND;TZID=Pacific/Auckland:${icsLocal(endDate, finish)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${b.event_date.replace(/-/g, "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(b.event_date).replace(/-/g, "")}`);
    }
    lines.push(`SUMMARY:${esc(summary)}`);
    if (b.venue || b.address) lines.push(`LOCATION:${esc([b.venue, b.address].filter(Boolean).join(", "))}`);
    lines.push(`DESCRIPTION:${esc(description)}`);
    lines.push(`STATUS:${b.status === "quoted" ? "TENTATIVE" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return new Response(fold(lines).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tipsy-tui.ics"',
      "Cache-Control": "no-cache",
    },
  });
});

// ---- helpers ----
function shiftTime(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let mins = h * 60 + m + Math.round(hours * 60);
  mins = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
function nextDay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function icsLocal(date: string, hhmm: string): string {
  return `${date.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;
}
function fmt12(hhmm: string | null): string {
  if (!hhmm) return "TBC";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${suffix}` : `${hr}${suffix}`;
}
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
function fold(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    let s = line;
    while (s.length > 73) { out.push(s.slice(0, 73)); s = " " + s.slice(73); }
    out.push(s);
  }
  return out;
}

// New Zealand: NZDT (+13) from last Sunday in September, NZST (+12) from first Sunday in April.
const NZ_TIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Pacific/Auckland",
  "BEGIN:STANDARD",
  "DTSTART:20080406T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU",
  "TZOFFSETFROM:+1300",
  "TZOFFSETTO:+1200",
  "TZNAME:NZST",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:20070930T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=-1SU",
  "TZOFFSETFROM:+1200",
  "TZOFFSETTO:+1300",
  "TZNAME:NZDT",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];
