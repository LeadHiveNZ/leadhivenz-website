import { MINUTE } from "@/lib/clock";
import { checkSubject } from "@/lib/notify/messages";
import { distanceMetres, FAR_METRES, referencePoint, type Point } from "./arrival";
import type { ArrivalCheck, Job } from "./types";

/**
 * IS THE JOB REALLY DONE? (DECISIONS.md, 2026-11-19)
 *
 * Every finished job is checked, without anyone having to look at it:
 *
 *   location   the Arrived tap and the Job done tap are each compared with the
 *              property's map pin (or, with no pin, the middle of where earlier
 *              trusted arrivals were). More than 300 m away, or no location
 *              from the phone, is a flag. The tap still works: phones get
 *              their position wrong, so nothing is ever blocked for it.
 *   photos     at least one "before" photo at Arrived and one "after" photo at
 *              Job done, taken in the app. A photo whose own file says it was
 *              taken before the job was even logged is a flag.
 *   time       Job done less than the market's minutes (10) after Arrived is
 *              a flag. Look-and-price jobs and "could not get in" are exempt.
 *
 * A job with no flags is paid as it always was. A flagged one holds the
 * tradie's payment and asks the owner first (src/lib/jobs/confirm.ts).
 *
 * Pure sums, no database, so each rule can be worked out by hand in a test.
 */

export type CheckFlag = "arrived_far" | "arrived_no_location" | "finished_far" | "finished_no_location" | "quick_finish" | "old_photo";

/** What a tap was compared with. */
export type ReferenceKind = "pin" | "earlier_taps" | "own_arrival" | "none";
export type Reference = { point: Point | null; kind: ReferenceKind };

/** A photo is "not fresh" when its own file says it was taken this long or more before the job was logged. */
export const STALE_PHOTO_MINUTES = 30;

/** The property's pin when it has one, otherwise the middle of earlier trusted arrivals there. */
export function chooseReference(pin: Point | null, earlier: Point[]): Reference {
  if (pin) return { point: pin, kind: "pin" };
  const middle = referencePoint(earlier);
  return middle ? { point: middle, kind: "earlier_taps" } : { point: null, kind: "none" };
}

export type TapCheck = { check: ArrivalCheck; distanceM: number | null };

/** One tap against the reference: ok, far, no location, or nothing to compare with yet. */
export function checkTap(where: Point | null, reference: Reference): TapCheck {
  if (!where) return { check: "no_location", distanceM: null };
  if (!reference.point) return { check: "no_reference", distanceM: null };
  const distanceM = distanceMetres(where, reference.point);
  return { check: distanceM > FAR_METRES ? "far" : "ok", distanceM };
}

/** A latitude and longitude from a form or a request, or null when either is missing or not a place. */
export function pointFrom(where: { lat?: number | null; lng?: number | null } | null | undefined): Point | null {
  const lat = where?.lat;
  const lng = where?.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/** Whole minutes between the two taps. */
export function minutesOnSite(arrivedAt: Date, finishedAt: Date): number {
  return Math.max(0, Math.floor((finishedAt.getTime() - arrivedAt.getTime()) / MINUTE));
}

/**
 * A job that is about finding out what is wrong: off-menu (the tradie comes
 * to look and price), or a menu "diagnosis" job such as "Heat pump fault
 * diagnosis" (the menu file marks these, and every one says so in its name).
 */
export function isDiagnosisJob(job: Pick<Job, "offMenu" | "title">): boolean {
  return job.offMenu || /\bdiagnosis\b/i.test(job.title);
}

/**
 * True when the job was finished too quickly to be believed. Diagnosis and
 * look-and-price jobs, and "could not get in", never are. A market setting of
 * 0 switches it off.
 */
export function tooQuick(job: Pick<Job, "offMenu" | "title">, outcome: "done" | "diagnosis_only" | "no_access", minutes: number, minMinutes: number): boolean {
  if (minMinutes <= 0 || outcome !== "done" || isDiagnosisJob(job)) return false;
  return minutes < minMinutes;
}

/** True when a photo's own date says it was taken well before the job existed. */
export function photoIsStale(takenAt: Date | null, jobCreatedAt: Date): boolean {
  if (!takenAt) return false;
  return takenAt.getTime() <= jobCreatedAt.getTime() - STALE_PHOTO_MINUTES * MINUTE;
}

/** Every flag a finished job carries, in a fixed order. */
export function jobFlags(input: { arrival: ArrivalCheck | null; finish: ArrivalCheck; quick: boolean; stalePhoto: boolean }): CheckFlag[] {
  const flags: CheckFlag[] = [];
  if (input.arrival === "far") flags.push("arrived_far");
  if (input.arrival === "no_location") flags.push("arrived_no_location");
  if (input.finish === "far") flags.push("finished_far");
  if (input.finish === "no_location") flags.push("finished_no_location");
  if (input.quick) flags.push("quick_finish");
  if (input.stalePhoto) flags.push("old_photo");
  return flags;
}

/** For the team and the tradie: what each flag means, plainly. */
export function flagWords(flag: CheckFlag, detail: { arrivalM?: number | null; finishM?: number | null; minutes?: number | null; minMinutes?: number } = {}): string {
  switch (flag) {
    case "arrived_far":
      return `Arrived was tapped ${detail.arrivalM ? formatMetres(detail.arrivalM) : "a long way"} from the property.`;
    case "arrived_no_location":
      return "The phone gave no location when Arrived was tapped.";
    case "finished_far":
      return `Job done was tapped ${detail.finishM ? formatMetres(detail.finishM) : "a long way"} from the property.`;
    case "finished_no_location":
      return "The phone gave no location when Job done was tapped.";
    case "quick_finish":
      return `Job done came ${detail.minutes ?? 0} minutes after Arrived, under the ${detail.minMinutes ?? 10} minutes we expect.`;
    case "old_photo":
      return "A photo's own date is from before the job was logged.";
  }
}

/**
 * What the owner is told, in neutral words: never that the tradie did
 * anything wrong, only what we could not confirm.
 */
export function ownerCheckWords(flags: CheckFlag[]): string {
  return `We couldn't confirm ${checkSubject(flags)} for this job. Can you check the photos and confirm it's fixed?`;
}

/** "350 m", "1.2 km". */
export function formatMetres(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`;
}
