import type { StatusTone } from "@/lib/jobs/types";
import { formatDate } from "@/lib/time";
import type { Property } from "./service";

/**
 * What a property's membership is called on screen, and its colour. `opensSoon`: its market is in pre-launch
 * (DECISIONS.md, 2026-11-27, second entry), so there is nothing for the owner to finish yet.
 */
export function membershipLabel(property: Property, timeZone: string, opensSoon = false): { label: string; tone: StatusTone } {
  switch (property.status) {
    case "setup":
      return opensSoon ? { label: "Opens soon", tone: "quiet" } : { label: "Not a member yet", tone: "waiting" };
    case "past_due":
      return { label: "Card problem", tone: "alert" };
    case "cancelled":
      return { label: "Cancelled", tone: "quiet" };
    case "active":
      return property.cancelAtPeriodEnd && property.currentPeriodEnd
        ? { label: `Ends ${formatDate(property.currentPeriodEnd, timeZone)}`, tone: "waiting" }
        : { label: "Member", tone: "done" };
  }
}

/** True when jobs can be logged for the property right now. */
export function isCovered(property: Property): boolean {
  return property.status === "active";
}
