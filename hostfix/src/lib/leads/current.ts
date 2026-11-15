import "server-only";
import { cookies } from "next/headers";
import { LEAD_COOKIE, readLeadToken } from "@/lib/auth/lead-token";
import { appSecret } from "@/lib/env";
import { getStore } from "@/lib/store";
import type { Lead } from "@/lib/store/types";

/**
 * The lead belonging to this visitor, if they filled in a form in the last
 * week. Works from a signed cookie, so nothing personal sits in the address.
 */
export async function currentLead(): Promise<Lead | null> {
  // Read the cookie FIRST. Anything that depends on the visitor must touch the
  // request before any early return, or the build could freeze the page as
  // fixed content.
  const cookieStore = await cookies();
  const secret = appSecret();
  if (!secret) return null;
  const leadId = readLeadToken(secret, cookieStore.get(LEAD_COOKIE)?.value);
  if (!leadId) return null;
  try {
    return await getStore().getLead(leadId);
  } catch (error) {
    console.error("[leads] could not load the visitor's lead:", error instanceof Error ? error.message : error);
    return null;
  }
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * True if the lead was created within the last hour. Used so a conversion is
 * reported to Meta once, when it happens, and not again on a later visit.
 */
export function isNewLead(lead: Lead): boolean {
  const created = Date.parse(lead.createdAt);
  return Number.isFinite(created) && Date.now() - created < ONE_HOUR_MS;
}

/** True if the deposit was paid within the last hour. */
export function wasPaidRecently(lead: Lead): boolean {
  if (!lead.depositPaidAt) return false;
  const paid = Date.parse(lead.depositPaidAt);
  return Number.isFinite(paid) && Date.now() - paid < ONE_HOUR_MS;
}
