import "server-only";
import { chargeJob } from "@/lib/billing/settle";
import type { Db } from "@/lib/db/types";
import { flushOutbox } from "@/lib/notify/outbox";
import { raiseException } from "@/lib/ops/exceptions";
import { paymentsFor } from "@/lib/payments";

/**
 * What happens straight after someone presses a button: the texts and emails
 * that the change queued are sent, and a job that was just finished is
 * charged. If either fails here, the timer picks it up within a minute.
 */

export const gatewayFor = (db: Db) => (country: "NZ" | "AU") => paymentsFor(db, country);

/** Sends anything waiting in the outbox. A message that fails for good goes in front of the dispatcher. */
export async function sendQueued(db: Db): Promise<void> {
  try {
    await flushOutbox(db, {
      onGiveUp: async (inner, message) => {
        await raiseException(inner, {
          kind: "message_failed", jobId: message.jobId,
          summary: `A ${message.channel === "sms" ? "text" : "email"} to ${message.recipient} did not send (${message.template.replace(/_/g, " ")}): ${message.error}`,
          dedupeKey: `message_failed:${message.id}`,
        });
      },
    });
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
