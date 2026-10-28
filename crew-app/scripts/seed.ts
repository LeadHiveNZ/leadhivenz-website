/**
 * Seeds a dev Supabase project so the app can be tested without Google Calendar.
 *
 *   npm run seed
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Creates the three logins (auth users + profile rows) and loads docs/08-jobs-calendar.csv
 * through the same parser the live calendar sync uses. Rows that don't parse are written to
 * calendar_sync_issues so they show on the office board. Safe to run again: jobs are keyed
 * by calendar_event_id and are upserted.
 *
 * Set CREW_EMAIL_MIKE / CREW_EMAIL_JONO / CREW_EMAIL_TAMA to real inboxes you can open on the
 * phones you're testing with; magic links are emailed there.
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  // Import after env is loaded so NEXT_PUBLIC_* are available to the admin client.
  const { supabaseAdmin } = await import("../lib/supabase/admin");
  const { csvRowToEvent, parseCalendarEvent, parseCsv } = await import("../lib/calendar/parse");
  const sb = supabaseAdmin();

  const crewSpec = [
    { name: "Mike", email: process.env.CREW_EMAIL_MIKE ?? "mike@example.com", role: "admin", van: 1, can_do_gas: true },
    { name: "Jono", email: process.env.CREW_EMAIL_JONO ?? "jono@example.com", role: "qualified", van: 2, can_do_gas: true },
    { name: "Tama", email: process.env.CREW_EMAIL_TAMA ?? "tama@example.com", role: "apprentice", van: 2, can_do_gas: false },
  ] as const;

  // 1. Logins
  const { data: existing } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const crew: { id: string; name: string; van: number; can_do_gas: boolean }[] = [];
  for (const c of crewSpec) {
    let authUser = existing?.users.find((u) => u.email?.toLowerCase() === c.email.toLowerCase());
    if (!authUser) {
      const { data, error } = await sb.auth.admin.createUser({ email: c.email, email_confirm: true, user_metadata: { name: c.name } });
      if (error) throw error;
      authUser = data.user!;
      console.log(`created login ${c.email}`);
    }
    const { error } = await sb.from("users").upsert({ id: authUser.id, name: c.name, email: c.email, role: c.role, van: c.van, can_do_gas: c.can_do_gas }, { onConflict: "id" });
    if (error) throw error;
    crew.push({ id: authUser.id, name: c.name, van: c.van, can_do_gas: c.can_do_gas });
  }
  console.log(`crew ready: ${crew.map((c) => c.name).join(", ")}`);

  // 2. Jobs from the CSV
  const csvPath = path.join(process.cwd(), "docs", "08-jobs-calendar.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  let ok = 0;
  let flagged = 0;
  for (const [i, row] of rows.entries()) {
    const ev = csvRowToEvent(row, i, crew);
    const result = parseCalendarEvent(ev, crew);
    if (!result.ok) {
      flagged++;
      await sb.from("calendar_sync_issues").delete().eq("calendar_event_id", ev.id);
      const { error } = await sb.from("calendar_sync_issues").insert({ calendar_event_id: ev.id, title: ev.title, starts_at: ev.startIso || null, reason: result.reason, raw: row });
      if (error) throw error;
      console.log(`flagged row ${i + 2}: ${result.reason}`);
      continue;
    }
    const { error } = await sb.from("jobs").upsert(result.job, { onConflict: "calendar_event_id" });
    if (error) {
      // e.g. the database gas trigger said no
      flagged++;
      await sb.from("calendar_sync_issues").delete().eq("calendar_event_id", ev.id);
      await sb.from("calendar_sync_issues").insert({ calendar_event_id: ev.id, title: ev.title, starts_at: ev.startIso || null, reason: error.message, raw: row });
      console.log(`flagged row ${i + 2}: ${error.message}`);
      continue;
    }
    ok++;
  }
  console.log(`seeded ${ok} jobs, flagged ${flagged} for the office board`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
