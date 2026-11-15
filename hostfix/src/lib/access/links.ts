import type { Db } from "@/lib/db/types";
import { appSecret } from "@/lib/env";
import { getJobByNumber, getOfferByNumber } from "@/lib/jobs/store";
import type { Job, Offer } from "@/lib/jobs/types";
import { offerLinkMatches, ownerJobLinkMatches, parseLinkCode } from "@/lib/links";

/**
 * Opening a one-tap link from a text. The code in the link is checked against
 * the app's secret before anything is looked at. A code that does not check
 * out gets exactly the same answer as one for a job that does not exist.
 */

/** The offer a tradie's link is for, or null. */
export async function offerFromLink(db: Db, code: string): Promise<Offer | null> {
  const secret = appSecret();
  const parsed = parseLinkCode(code);
  if (!secret || !parsed) return null;
  const offer = await getOfferByNumber(db, parsed.number);
  if (!offer || !offerLinkMatches(secret, offer, parsed.signature)) return null;
  return offer;
}

/** The job an owner's link is for, or null. */
export async function jobFromOwnerLink(db: Db, code: string): Promise<Job | null> {
  const secret = appSecret();
  const parsed = parseLinkCode(code);
  if (!secret || !parsed) return null;
  const job = await getJobByNumber(db, parsed.number);
  if (!job || !ownerJobLinkMatches(secret, job, parsed.signature)) return null;
  return job;
}
