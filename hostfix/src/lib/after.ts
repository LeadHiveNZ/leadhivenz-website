import "server-only";
import { chargeJob } from "@/lib/billing/settle";
import { cancelDueHolds } from "@/lib/billing/card-holds";
import type { Db } from "@/lib/db/types";
import { runTick, type TickReport } from "@/lib/dispatch/tick";
import { getFileStore } from "@/lib/files/store";
import { flushOutbox, type FlushDeps } from "@/lib/notify/outbox";
import { raiseException } from "@/lib/ops/exceptions";
import { paymentsFor } from "@/lib/payments";
import { geocoder } from "@/lib/maps/geocode";

/**
 * What happens straight after someone presses a button: the texts and emails
 * that the change queued are sent, and a job that was just finished is
 * charged. If either fails here, the timer picks it up within a minute.
 *
 * Also the one place the timer itself is started from, so the live site, the
 * demo and the "skip ahead" button all run exactly the same steps.
 */

export const gatewayFor = (db: Db) => (country: "NZ" | "AU") => paymentsFor(db, country);

/** A message that fails for good goes in front of the dispatcher. */
const flushDeps: FlushDeps = {
  onGiveUp: async (inner, message) => {
    await raiseException(inner, {
      kind: "message_failed", jobId: message.jobId,
      summary: `A ${message.channel === "sms" ? "text" : "email"} to ${message.recipient} did not send (${message.template.replace(/_/g, " ")}): ${message.error}`,
      dedupeKey: `message_failed:${message.id}`,
    });
  },
};

/** Sends anything waiting in the outbox. */
export async function sendQueued(db: Db): Promise<void> {
  try {
    await flushOutbox(db, flushDeps);
  } catch (error) {
    console.error("[after] sending queued messages failed:", error instanceof Error ? error.message : error);
  }
}

/** Charges a job that has just been finished, then sends the texts about it. */
export async function settleNow(db: Db, jobId: string): Promise<void> {
  try {
    await chargeJob(db, gatewayFor(db), jobId);
  } catch (error) {
    console.error("[after] charging a job failed:", error instanceof Error ? error.message : error);
  }
  await sendQueued(db);
}

/**
 * After a cancel (DECISIONS.md, 2026-11-23): the hold on the owner's card is let go at once, or, cancelled after the
 * tradie arrived, the call-out is taken from it. If either fails here, the timer does it within a minute.
 */
export async function settleCancel(db: Db, jobId: string): Promise<void> {
  try {
    await cancelDueHolds(db, gatewayFor(db), jobId);
    await chargeJob(db, gatewayFor(db), jobId);
  } catch (error) {
    console.error("[after] settling a cancelled job failed:", error instanceof Error ? error.message : error);
  }
  await sendQueued(db);
}

/** One turn of the timer: moves on offers, chases, credits, charges, pays and sends. */
export async function runTimer(db: Db): Promise<TickReport> {
  const files = getFileStore();
  return runTick(db, {
    gatewayFor: gatewayFor(db),
    flush: flushDeps,
    removeFiles: files ? (keys) => files.remove(keys) : undefined,
    geocoder: geocoder(),
  });
}
