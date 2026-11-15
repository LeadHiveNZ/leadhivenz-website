import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { randomCode } from "@/lib/ids";

/**
 * REFERRALS. A cleaner or co-host who brings in a property earns a one-off
 * reward once that property has paid for a set number of months. They have no
 * account: they give their name and mobile and get a personal link to share.
 *
 * Paying the reward is a job for a person (a bank transfer), recorded here.
 */

export type Referrer = { id: string; name: string; phone: string; email: string | null; code: string };

/** Signs someone up as a referrer, or finds them again by their mobile. */
export async function registerReferrer(db: Db, input: { name: string; phone: string; email: string | null }): Promise<Referrer> {
  const existing = await db.query<Referrer>("select id, name, phone, email, code from public.referrers where phone = $1", [input.phone]);
  if (existing[0]) return existing[0];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode(7);
    const rows = await db.query<Referrer>(
      `insert into public.referrers (created_at, name, phone, email, code) values ($1::timestamptz, $2, $3, $4, $5)
       on conflict do nothing returning id, name, phone, email, code`,
      [now().toISOString(), input.name.trim(), input.phone, input.email, code],
    );
    if (rows[0]) {
      await audit(db, { actor: "system", action: "referrer.registered", entity: "referrer", entityId: rows[0].id });
      return rows[0];
    }
    const again = await db.query<Referrer>("select id, name, phone, email, code from public.referrers where phone = $1", [input.phone]);
    if (again[0]) return again[0];
  }
  throw new Error("Could not create a referral code. Please try again.");
}

export type ReferralRow = {
  id: string;
  status: "pending" | "due" | "paid" | "void";
  rewardCents: number;
  currency: string;
  referrerName: string;
  referrerPhone: string;
  propertyName: string;
  market: string;
  paidMonths: number;
  createdAt: Date;
  dueAt: Date | null;
  paidAt: Date | null;
  paidNote: string | null;
};

export async function listReferrals(db: Db, market?: string | null): Promise<ReferralRow[]> {
  const rows = await db.query<{
    id: string; status: ReferralRow["status"]; reward_cents: number; currency: string; referrer_name: string; referrer_phone: string;
    property_name: string; market: string; paid_months: number; created_at: Date; due_at: Date | null; paid_at: Date | null; paid_note: string | null;
  }>(
    `select r.id, r.status, r.reward_cents, r.currency, f.name as referrer_name, f.phone as referrer_phone, p.name as property_name, p.market,
            (select count(*) from public.membership_invoices i where i.property_id = p.id and i.status = 'paid') as paid_months,
            r.created_at, r.due_at, r.paid_at, r.paid_note
       from public.referrals r join public.referrers f on f.id = r.referrer_id join public.properties p on p.id = r.property_id
      where ($1::text is null or p.market = $1)
      order by (r.status = 'due') desc, r.created_at desc limit 200`,
    [market ?? null],
  );
  return rows.map((row) => ({
    id: row.id, status: row.status, rewardCents: row.reward_cents, currency: row.currency, referrerName: row.referrer_name,
    referrerPhone: row.referrer_phone, propertyName: row.property_name, market: row.market, paidMonths: Number(row.paid_months),
    createdAt: new Date(row.created_at), dueAt: row.due_at ? new Date(row.due_at) : null, paidAt: row.paid_at ? new Date(row.paid_at) : null, paidNote: row.paid_note,
  }));
}

/** Records that the reward has been paid (by bank transfer, outside the app). */
export async function markReferralPaid(db: Db, referralId: string, note: string, actor: string): Promise<boolean> {
  const rows = await db.query<{ reward_cents: number; currency: string }>(
    `update public.referrals set status = 'paid', paid_at = $2::timestamptz, paid_by = $3, paid_note = $4
      where id = $1::uuid and status = 'due' returning reward_cents, currency`,
    [referralId, now().toISOString(), actor, note.trim().slice(0, 300) || null],
  );
  if (!rows[0]) return false;
  await audit(db, { actor, action: "referral.paid", entity: "referral", entityId: referralId, amount: rows[0].reward_cents, currency: rows[0].currency, detail: { note }, dedupeKey: `referral.paid:${referralId}` });
  await db.query("update public.exceptions set status = 'resolved', resolved_at = $2::timestamptz, resolved_by = $3, resolution_note = 'Reward paid' where dedupe_key = $1 and status = 'open'", [
    `referral_due:${referralId}`, now().toISOString(), actor,
  ]);
  return true;
}
