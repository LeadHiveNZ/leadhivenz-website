/**
 * Turns a calendar event (or a seed CSV row) into a job.
 *
 * Event title format:  "[Van 2] Karen - Blocked kitchen drain"
 * Description lines:   Address: ..., Suburb: ..., Phone: ..., Job: ..., Notes: ..., Gas: yes/no,
 *                      Quoted hours: 2.5, Zone: 2
 *
 * The CSV seed (docs/08-jobs-calendar.csv) has columns date,start,end,who,customer,address,
 * suburb,job,notes, and is converted into the same shape before parsing so both paths share
 * one set of rules. Anything that fails returns a reason, which the office board shows as an
 * unparsed event instead of failing silently.
 */
import { brand } from "@/config/brand";
import { zonedDateTimeToIso } from "@/lib/time";
import type { AppUser } from "@/lib/types";

export interface CalendarEventLike {
  id: string;
  title: string;
  description: string;
  startIso: string;
  endIso: string;
}

export interface ParsedJob {
  calendar_event_id: string;
  date: string;
  start_at: string;
  end_at: string;
  van: number;
  assigned_to: string[];
  customer_first_name: string;
  customer_phone: string | null;
  address: string;
  suburb: string | null;
  travel_zone: "1" | "2" | "3" | "beyond";
  job_type: string;
  description: string | null;
  access_notes: string | null;
  is_gas: boolean;
  quoted_hours: number | null;
}

export type ParseResult = { ok: true; job: ParsedJob } | { ok: false; reason: string };

/** Minimal crew directory the parser needs to resolve names to users and vans. */
export type CrewDirectory = Pick<AppUser, "id" | "name" | "van" | "can_do_gas">[];

function fields(description: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of description.split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z ]+?)\s*:\s*(.*)$/);
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

function parseZone(s: string | undefined): ParsedJob["travel_zone"] {
  const v = (s ?? "").trim().toLowerCase().replace(/^zone\s*/, "");
  if (v === "2" || v === "3" || v === "beyond") return v;
  return "1";
}

function ymdInZone(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: brand.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

export function parseCalendarEvent(ev: CalendarEventLike, crew: CrewDirectory): ParseResult {
  const title = (ev.title ?? "").trim();
  const t = title.match(/^\[([^\]]+)\]\s*(.+?)\s*-\s*(.+)$/);
  if (!t) return { ok: false, reason: `Title must look like "[Van 2] Customer - Job type", got "${title}"` };
  const vanText = t[1].trim();
  const customer = t[2].trim();
  const jobType = t[3].trim();

  const van = brand.vans.find(
    (v) => v.label.toLowerCase() === vanText.toLowerCase() || String(v.id) === vanText.replace(/\D/g, ""),
  );
  if (!van) return { ok: false, reason: `Unknown van "${vanText}"` };

  const f = fields(ev.description ?? "");
  const address = f["address"];
  if (!address) return { ok: false, reason: "Missing Address: line" };

  const who = (f["who"] ?? "")
    .split(/[,+&/]| and /i)
    .map((s) => s.trim())
    .filter(Boolean);
  const assigned: string[] = [];
  for (const name of who) {
    const u = crew.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!u) return { ok: false, reason: `Unknown crew member "${name}"` };
    assigned.push(u.id);
  }
  // Nobody named: default to everyone who rides in that van.
  if (assigned.length === 0) {
    for (const c of crew) if (c.van === van.id) assigned.push(c.id);
  }

  const isGas = /^(y|yes|true)$/i.test(f["gas"] ?? "");
  if (isGas) {
    const blocked = crew.find((c) => assigned.includes(c.id) && !c.can_do_gas);
    if (blocked) return { ok: false, reason: `Gas job assigned to ${blocked.name}, who cannot do gas work` };
  }

  const quoted = f["quoted hours"] ? Number(f["quoted hours"]) : null;
  if (quoted !== null && !Number.isFinite(quoted)) return { ok: false, reason: `Quoted hours "${f["quoted hours"]}" is not a number` };

  if (!ev.startIso || !ev.endIso || Number.isNaN(Date.parse(ev.startIso)) || Number.isNaN(Date.parse(ev.endIso))) {
    return { ok: false, reason: "Event has no start/end time (all-day events are not jobs)" };
  }

  return {
    ok: true,
    job: {
      calendar_event_id: ev.id,
      date: ymdInZone(ev.startIso),
      start_at: ev.startIso,
      end_at: ev.endIso,
      van: van.id,
      assigned_to: assigned,
      customer_first_name: customer,
      customer_phone: f["phone"] || null,
      address,
      suburb: f["suburb"] || null,
      travel_zone: parseZone(f["zone"]),
      job_type: jobType,
      description: f["job"] || jobType,
      access_notes: f["notes"] || null,
      is_gas: isGas,
      quoted_hours: quoted,
    },
  };
}

// ---------------- CSV seed ----------------

export interface CsvRow {
  date: string;
  start: string;
  end: string;
  who: string;
  customer: string;
  address: string;
  suburb: string;
  job: string;
  notes: string;
}

/** Tiny RFC-4180-ish CSV parser (handles quoted fields with commas). */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => (o[k] = (r[i] ?? "").trim()));
    return o as unknown as CsvRow;
  });
}

/**
 * The seed CSV has no van column: the van comes from who is on the job. Mike is Van 1;
 * Jono and Tama are Van 2. A `Gas: yes` or `Quoted hours: n` inside notes is lifted into
 * the proper description lines so the same parser applies.
 */
export function csvRowToEvent(row: CsvRow, index: number, crew: CrewDirectory): CalendarEventLike {
  const names = row.who
    .split(/[,+&/]| and /i)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = crew.find((c) => c.name.toLowerCase() === names[0]?.toLowerCase());
  const vanId = first?.van ?? brand.vans[0].id;
  const van = brand.vans.find((v) => v.id === vanId) ?? brand.vans[0];

  const lines: string[] = [];
  let notes = row.notes ?? "";
  const gas = notes.match(/Gas:\s*(yes|no)\.?/i);
  if (gas) {
    lines.push(`Gas: ${gas[1]}`);
    notes = notes.replace(gas[0], "").trim();
  }
  const quoted = notes.match(/Quoted hours:\s*(\d+(?:\.\d+)?)\.?/i);
  if (quoted) {
    lines.push(`Quoted hours: ${quoted[1]}`);
    notes = notes.replace(quoted[0], "").trim();
  }
  const phone = notes.match(/Phone:\s*(\+?[\d][\d\s]*\d)\.?/i);
  if (phone) {
    lines.push(`Phone: ${phone[1].trim()}`);
    notes = notes.replace(phone[0], "").trim();
  }
  const zone = notes.match(/Zone:\s*(\w+)\.?/i);
  if (zone) {
    lines.push(`Zone: ${zone[1]}`);
    notes = notes.replace(zone[0], "").trim();
  }
  notes = notes.replace(/^[.\s]+/, "").trim();

  const description = [
    `Who: ${row.who}`,
    `Address: ${row.address}`,
    `Suburb: ${row.suburb}`,
    `Job: ${row.job}`,
    notes ? `Notes: ${notes}` : "",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `seed-${index + 1}`,
    title: `[${van.label}] ${row.customer} - ${row.job}`,
    description,
    startIso: row.date && row.start ? zonedDateTimeToIso(row.date, row.start) : "",
    endIso: row.date && row.end ? zonedDateTimeToIso(row.date, row.end) : "",
  };
}
