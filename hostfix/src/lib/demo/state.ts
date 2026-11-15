import "server-only";
import { runTimer } from "@/lib/after";
import { clockOffsetMs, MINUTE, setClockOffsetMs, setTestNow } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { getFileStore } from "@/lib/files/store";
import { buildSampleData, type DemoPerson } from "./sample";

/**
 * WHAT MAKES THE DEMO WORK. Three things, all only ever on a computer in
 * demo mode:
 *   1. sample data, made once, the first time the app starts
 *   2. a clock that can be skipped ahead, so you do not have to wait 15
 *      minutes to watch an offer move on to the next tradie
 *   3. a timer that runs every 20 seconds, doing the job Vercel's timer does
 *      on the live site
 */

const PEOPLE_KEY = "demo_people";
const CLOCK_KEY = "demo_clock";

async function remember(db: Db, key: string, value: unknown): Promise<void> {
  await db.query(
    `insert into public.app_state (key, value, updated_at) values ($1, $2::jsonb, $3::timestamptz)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

async function recall<T>(db: Db, key: string): Promise<T | null> {
  const rows = await db.query<{ value: T }>("select value from public.app_state where key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function demoPeople(db: Db): Promise<DemoPerson[]> {
  return (await recall<DemoPerson[]>(db, PEOPLE_KEY)) ?? [];
}

const globals = globalThis as typeof globalThis & { __hostfixDemoTimer?: ReturnType<typeof setInterval> };

/** Called once, when the in-app database is opened. */
export async function prepareDemo(db: Db, options: { sampleData: boolean }): Promise<void> {
  if (options.sampleData && (await recall(db, PEOPLE_KEY)) === null) {
    const existing = await db.query("select 1 from public.owners limit 1");
    if (existing.length === 0) {
      try {
        const people = await db.tx((tx) => buildSampleData(tx, getFileStore(), new Date()));
        await remember(db, PEOPLE_KEY, people);
      } catch (error) {
        // The app still works without sample data: it just starts empty.
        console.error("[demo] the sample data could not be made:", error instanceof Error ? error.message : error);
      } finally {
        setTestNow(null);
      }
    }
  }

  const clock = await recall<{ offsetMs: number }>(db, CLOCK_KEY);
  if (clock && Number.isFinite(clock.offsetMs)) setClockOffsetMs(clock.offsetMs);

  if (!globals.__hostfixDemoTimer) {
    const timer = setInterval(() => {
      void runTimer(db).catch((error: unknown) => console.error("[demo] the timer failed:", error instanceof Error ? error.message : error));
    }, 20_000);
    timer.unref?.();
    globals.__hostfixDemoTimer = timer;
  }
}

/**
 * Moves the demo's clock forward and runs the timer as it goes, in small
 * steps, so everything that would have happened in that time does happen:
 * offers run out and move on, payments are released, promises are missed.
 */
export async function skipAhead(db: Db, minutes: number): Promise<void> {
  const total = Math.max(1, Math.min(Math.trunc(minutes), 3 * 24 * 60));
  const step = total <= 60 ? 5 : total <= 6 * 60 ? 15 : 60;
  for (let done = 0; done < total; done += step) {
    setClockOffsetMs(clockOffsetMs() + Math.min(step, total - done) * MINUTE);
    await runTimer(db);
  }
  await remember(db, CLOCK_KEY, { offsetMs: clockOffsetMs() });
}
