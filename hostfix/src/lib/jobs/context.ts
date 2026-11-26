import type { Market } from "@config/markets";
import type { Db } from "@/lib/db/types";
import { appSecret, baseUrl } from "@/lib/env";
import { offerLinkCode, ownerJobLinkCode } from "@/lib/links";
import { getMarket, listTiers, type Tier } from "@/lib/markets/store";
import { getPropertyForStaff, type Property } from "@/lib/properties/service";
import { dateKey, localParts } from "@/lib/time";
import type { Job, Offer } from "./types";

/** The people and settings around a job, loaded together because nearly every step needs them. */
export type JobContext = {
  job: Job;
  market: Market;
  property: Property;
  tier: Tier | null;
  owner: { id: string; userId: string; name: string; phone: string | null; email: string | null };
  tradie: { id: string; userId: string; name: string; businessName: string; phone: string | null } | null;
};

export async function loadContext(db: Db, job: Job): Promise<JobContext> {
  const market = await getMarket(db, job.market);
  const property = await getPropertyForStaff(db, job.propertyId);
  if (!market || !property) throw new Error(`Job ${job.number} has lost its market or property.`);
  const tiers = await listTiers(db, market.slug);
  const tier = tiers.find((candidate) => candidate.id === property.tierId) ?? tiers.find((candidate) => candidate.key === job.tierKey) ?? null;

  const owners = await db.query<{ id: string; user_id: string; name: string; phone: string | null; email: string | null }>(
    "select o.id, o.user_id, u.name, u.phone, u.email from public.owners o join public.users u on u.id = o.user_id where o.id = $1::uuid",
    [job.ownerId],
  );
  if (!owners[0]) throw new Error(`Job ${job.number} has lost its owner.`);
  const owner = { id: owners[0].id, userId: owners[0].user_id, name: owners[0].name, phone: owners[0].phone, email: owners[0].email };

  let tradie: JobContext["tradie"] = null;
  if (job.tradieId) {
    const rows = await db.query<{ id: string; user_id: string; name: string; business_name: string; phone: string | null }>(
      "select t.id, t.user_id, u.name, t.business_name, u.phone from public.tradies t join public.users u on u.id = t.user_id where t.id = $1::uuid",
      [job.tradieId],
    );
    if (rows[0]) tradie = { id: rows[0].id, userId: rows[0].user_id, name: rows[0].name, businessName: rows[0].business_name, phone: rows[0].phone };
  }
  return { job, market, property, tier, owner, tradie };
}

function secret(): string {
  const value = appSecret();
  if (!value) throw new Error("APP_SECRET is not set, so one-tap links cannot be made.");
  return value;
}

/** The link in a tradie's text for one offer. After they accept, the same link is their job page. */
export function offerUrl(offer: Pick<Offer, "number" | "id">): string {
  return `${baseUrl()}/o/${offerLinkCode(secret(), offer)}`;
}

/** The link in an owner's text for one job. */
export function ownerJobUrl(job: Pick<Job, "number" | "id">): string {
  return `${baseUrl()}/j/${ownerJobLinkCode(secret(), job)}`;
}

/** Today's date and weekday on the wall in the market. */
export function marketToday(market: Pick<Market, "timezone">, at: Date): { today: string; weekday: string; hour: number } {
  const parts = localParts(at, market.timezone);
  return { today: dateKey(at, market.timezone), weekday: parts.weekday, hour: parts.hour + parts.minute / 60 };
}
