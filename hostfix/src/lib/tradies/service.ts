import { isUuid } from "@/lib/uuid";
import { findTrade, needsLbp, trades as tradeList } from "@config/trades";
import { audit } from "@/lib/audit";
import { createUser, type User } from "@/lib/auth/users";
import { now } from "@/lib/clock";
import { dateKey } from "@/lib/time";
import type { Db } from "@/lib/db/types";
import type { Provider } from "@/lib/payments/gateway";

/**
 * TRADIES: who they are, what they are licensed for, and who holds the
 * first-choice and backup slot for each trade in each market.
 *
 * The licence rule lives here, in one query: a job that needs a licence is
 * only ever offered to a tradie whose licence for that trade has a number on
 * file and an expiry date that has not passed. The insurance rule sits in the
 * same query: no tradie is offered anything without public liability
 * insurance on file (insurer, policy number, an expiry date that has not
 * passed, and the certificate uploaded), DECISIONS.md 2026-11-17.
 *
 * Only staff approve a tradie (setTradieStatus, called from the admin's
 * tradie page). A tradie can never change their own status except to pause
 * and come back once approved (setTradiePaused).
 */

export type TradieStatus = "applied" | "approved" | "paused" | "removed";

export type Tradie = {
  id: string;
  createdAt: Date;
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  market: string;
  businessName: string;
  trades: string[];
  status: TradieStatus;
  approvedAt: Date | null;
  daysAvailable: string[];
  afterHours: boolean;
  gstRegistered: boolean;
  gstNumber: string | null;
  /** Public liability insurance: who insures them, the policy number and when it runs out ("2027-03-31"). */
  insurer: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiresOn: string | null;
  /** The version of the tradie agreement they agreed to in the app, and when (DECISIONS.md, 2026-11-20). */
  agreementVersion: string | null;
  agreedAt: Date | null;
  /** The newest public liability certificate uploaded (the current one), or null if none is on file. */
  insuranceCertificateId: string | null;
  /** Licensed Building Practitioner number. Optional, shown to staff, nothing depends on it. */
  lbpNumber: string | null;
  payoutProvider: Provider | null;
  payoutAccountId: string | null;
  payoutsEnabled: boolean;
  notes: string;
  /** A person on the team has seen their Ministry of Justice record check: who and when (DECISIONS.md, 2026-11-24, fourth entry). */
  recordCheckSeenAt: Date | null;
  recordCheckSeenBy: string | null;
};

export type Licence = {
  id: string;
  tradieId: string;
  trade: string;
  licenceNumber: string;
  /** "2027-03-31" */
  expiresOn: string;
  verifiedAt: Date | null;
  verifiedBy: string | null;
};

type TradieRow = {
  id: string; created_at: Date; user_id: string; name: string; phone: string | null; email: string | null; market: string;
  business_name: string; trades: string[]; status: TradieStatus; approved_at: Date | null; days_available: string[];
  after_hours: boolean; gst_registered: boolean; gst_number: string | null; insurance_expires_on: string | null;
  insurer: string | null; insurance_policy_number: string | null; insurance_certificate_id: string | null; lbp_number: string | null;
  payout_provider: Provider | null; payout_account_id: string | null; payouts_enabled: boolean; notes: string;
  agreement_version?: string | null; agreed_at?: Date | null; record_check_seen_at?: Date | null; record_check_seen_by?: string | null;
};

const TRADIE_SELECT = `select t.id, t.created_at, t.user_id, u.name, u.phone, u.email, t.market, t.business_name, t.trades, t.status,
                              t.approved_at, t.days_available, t.after_hours, t.gst_registered, t.gst_number, t.insurance_expires_on,
                              t.insurer, t.insurance_policy_number, t.lbp_number, t.payout_provider, t.payout_account_id, t.payouts_enabled, t.notes,
                              t.agreement_version, t.agreed_at, t.record_check_seen_at, t.record_check_seen_by,
                              (select x.id from public.uploads x
                                where x.tradie_id = t.id and x.kind = 'insurance_certificate' and x.attached
                                order by x.created_at desc, x.id desc limit 1) as insurance_certificate_id
                         from public.tradies t join public.users u on u.id = t.user_id`;

function rowToTradie(row: TradieRow): Tradie {
  return {
    id: row.id, createdAt: new Date(row.created_at), userId: row.user_id, name: row.name, phone: row.phone, email: row.email,
    market: row.market, businessName: row.business_name, trades: row.trades, status: row.status,
    approvedAt: row.approved_at ? new Date(row.approved_at) : null, daysAvailable: row.days_available, afterHours: row.after_hours,
    gstRegistered: row.gst_registered, gstNumber: row.gst_number,
    insurer: row.insurer ?? null, insurancePolicyNumber: row.insurance_policy_number ?? null,
    insuranceExpiresOn: row.insurance_expires_on ? String(row.insurance_expires_on).slice(0, 10) : null,
    insuranceCertificateId: row.insurance_certificate_id ?? null, lbpNumber: row.lbp_number ?? null,
    payoutProvider: row.payout_provider, payoutAccountId: row.payout_account_id, payoutsEnabled: row.payouts_enabled, notes: row.notes,
    agreementVersion: row.agreement_version ?? null, agreedAt: row.agreed_at ? new Date(row.agreed_at) : null,
    recordCheckSeenAt: row.record_check_seen_at ? new Date(row.record_check_seen_at) : null, recordCheckSeenBy: row.record_check_seen_by ?? null,
  };
}

export class TradieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradieError";
  }
}

export function validTrades(keys: string[]): string[] {
  const known = new Set(tradeList.map((trade) => trade.key));
  return [...new Set(keys.filter((key) => known.has(key)))];
}

export type TradieApplication = {
  name: string;
  phone: string;
  email: string | null;
  market: string;
  businessName: string;
  trades: string[];
  daysAvailable: string[];
  afterHours: boolean;
  gstRegistered: boolean;
  gstNumber?: string | null;
  /** Licensed Building Practitioner number, optional. Taken from the lead when there is one and this is not given. */
  lbpNumber?: string | null;
  licences: { trade: string; licenceNumber: string; expiresOn: string }[];
  leadId?: string | null;
};

/** Creates the person and their tradie record. They are "applied" until a person approves them. */
export async function createTradie(db: Db, input: TradieApplication): Promise<{ user: User; tradieId: string }> {
  const chosen = validTrades(input.trades);
  if (chosen.length === 0) throw new TradieError("Choose at least one trade.");
  return db.tx(async (tx) => {
    const user = await createUser(tx, { name: input.name, email: input.email, phone: input.phone });
    const rows = await tx.query<{ id: string }>(
      `insert into public.tradies
         (created_at, user_id, market, business_name, trades, days_available, after_hours, gst_registered, gst_number, lead_id, lbp_number)
       values ($1::timestamptz, $2::uuid, $3, $4, $5::text[], $6::text[], $7, $8, $9, $10::uuid,
               coalesce($11::text, (select l.lbp_number from public.leads l where l.id = $10::uuid)))
       returning id`,
      [
        now().toISOString(), user.id, input.market, input.businessName.trim() || input.name.trim(), chosen, input.daysAvailable,
        input.afterHours, input.gstRegistered, input.gstNumber?.trim() || null, input.leadId ?? null, cleanLbp(input.lbpNumber),
      ],
    );
    const tradieId = rows[0]!.id;
    // A certificate sent with the sign-up form moves from the lead to the tradie.
    if (input.leadId) {
      const moved = await tx.query<{ id: string }>(
        `update public.uploads set tradie_id = $2::uuid
          where lead_id = $1::uuid and kind = 'insurance_certificate' and tradie_id is null returning id`,
        [input.leadId, tradieId],
      );
      if (moved.length > 0) {
        await audit(tx, { actor: `tradie:${tradieId}`, action: "tradie.insurance_certificate_from_lead", entity: "tradie", entityId: tradieId, detail: { leadId: input.leadId, uploads: moved.map((row) => row.id) } });
      }
    }
    for (const licence of input.licences) {
      if (!chosen.includes(licence.trade) || !licence.licenceNumber.trim()) continue;
      await saveLicence(tx, tradieId, licence, `tradie:${tradieId}`);
    }
    if (input.leadId) await tx.query("update public.leads set converted_at = $2::timestamptz where id = $1::uuid", [input.leadId, now().toISOString()]);
    await audit(tx, { actor: `tradie:${tradieId}`, action: "tradie.applied", entity: "tradie", entityId: tradieId, detail: { market: input.market, trades: chosen } });
    return { user, tradieId };
  });
}

export async function getTradie(db: Db, tradieId: string): Promise<Tradie | null> {
  if (!isUuid(tradieId)) return null;
  const rows = await db.query<TradieRow>(`${TRADIE_SELECT} where t.id = $1::uuid`, [tradieId]);
  return rows[0] ? rowToTradie(rows[0]) : null;
}

export async function listTradies(db: Db, filter: { market?: string | null; status?: TradieStatus | null } = {}): Promise<Tradie[]> {
  const rows = await db.query<TradieRow>(
    `${TRADIE_SELECT}
      where ($1::text is null or t.market = $1) and ($2::text is null or t.status = $2)
      order by (t.status = 'applied') desc, t.business_name`,
    [filter.market ?? null, filter.status ?? null],
  );
  return rows.map(rowToTradie);
}

export type TradiePatch = {
  businessName?: string;
  trades?: string[];
  daysAvailable?: string[];
  afterHours?: boolean;
  gstRegistered?: boolean;
  gstNumber?: string | null;
  insurer?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiresOn?: string | null;
  lbpNumber?: string | null;
};

/** An LBP number as typed, tidied: trimmed, at most 40 characters, null when blank. */
function cleanLbp(value: string | null | undefined): string | null {
  return value?.trim().slice(0, 40) || null;
}

/**
 * Why this tradie cannot be approved or offered work for want of insurance,
 * in plain words, or null when their public liability insurance is on file
 * and current. "today" is the market's own date, "2026-11-17".
 */
export function insuranceProblem(
  tradie: Pick<Tradie, "insurer" | "insurancePolicyNumber" | "insuranceExpiresOn" | "insuranceCertificateId">,
  today: string,
): string | null {
  const missing = [
    !tradie.insurer?.trim() && "the insurer",
    !tradie.insurancePolicyNumber?.trim() && "the policy number",
    !tradie.insuranceExpiresOn && "the expiry date",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    return `Their public liability insurance is not complete: add ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")} on their page first. We can't offer them jobs without it.`;
  }
  if (!tradie.insuranceCertificateId) {
    return "Their public liability certificate is not uploaded. They add it on their profile, or you add it on their page. We can't offer them jobs without it.";
  }
  if (tradie.insuranceExpiresOn! < today) return "Their public liability insurance has run out. Add the renewed policy and its new expiry date on their page first.";
  return null;
}

export async function updateTradie(db: Db, tradieId: string, patch: TradiePatch, actor: string): Promise<Tradie | null> {
  const current = await getTradie(db, tradieId);
  if (!current) return null;
  const chosen = patch.trades ? validTrades(patch.trades) : current.trades;
  if (chosen.length === 0) throw new TradieError("Choose at least one trade.");
  const lbpNumber = patch.lbpNumber === undefined ? current.lbpNumber : cleanLbp(patch.lbpNumber);
  return db.tx(async (tx) => {
    await tx.query(
      `update public.tradies set business_name = $2, trades = $3::text[], days_available = $4::text[], after_hours = $5,
              gst_registered = $6, gst_number = $7, insurance_expires_on = $8::date, insurer = $9, insurance_policy_number = $10,
              lbp_number = $11
        where id = $1::uuid`,
      [
        tradieId, patch.businessName?.trim() || current.businessName, chosen, patch.daysAvailable ?? current.daysAvailable,
        patch.afterHours ?? current.afterHours, patch.gstRegistered ?? current.gstRegistered,
        patch.gstNumber === undefined ? current.gstNumber : patch.gstNumber?.trim() || null,
        patch.insuranceExpiresOn === undefined ? current.insuranceExpiresOn : patch.insuranceExpiresOn || null,
        patch.insurer === undefined ? current.insurer : patch.insurer?.trim().slice(0, 120) || null,
        patch.insurancePolicyNumber === undefined ? current.insurancePolicyNumber : patch.insurancePolicyNumber?.trim().slice(0, 80) || null,
        lbpNumber,
      ],
    );
    // A slot for a trade they no longer do is given up.
    await tx.query("delete from public.tradie_slots where tradie_id = $1::uuid and not (trade = any($2::text[]))", [tradieId, chosen]);
    await audit(tx, { actor, action: "tradie.updated", entity: "tradie", entityId: tradieId, detail: { fields: Object.keys(patch) } });
    if (lbpNumber !== current.lbpNumber) {
      await audit(tx, { actor, action: "tradie.lbp_saved", entity: "tradie", entityId: tradieId, detail: { lbpNumber, before: current.lbpNumber } });
    }
    return getTradie(tx, tradieId);
  });
}

/**
 * Staff decisions about a tradie. Removing or pausing takes them out of every
 * slot's rotation at once. Approving needs current public liability insurance
 * on file: insurer, policy number, an expiry date that has not passed and the
 * certificate uploaded. Only staff actions call this.
 */
export async function setTradieStatus(db: Db, tradieId: string, status: TradieStatus, actor: string): Promise<Tradie | null> {
  if (status === "approved") {
    const tradie = await getTradie(db, tradieId);
    if (!tradie) return null;
    const zone = (await db.query<{ timezone: string }>("select timezone from public.markets where slug = $1", [tradie.market]))[0]?.timezone ?? "UTC";
    const problem = insuranceProblem(tradie, dateKey(now(), zone));
    if (problem) throw new TradieError(`Not approved. ${problem}`);
    // The first approval needs their criminal record check seen (DECISIONS.md, 2026-11-24, fourth entry).
    if (!tradie.approvedAt && !tradie.recordCheckSeenAt) {
      throw new TradieError("Not approved. Their criminal record check has not been marked as seen. Look at it, then press \"I've seen their record check\".");
    }
  }
  const at = now().toISOString();
  const rows = await db.query(
    `update public.tradies set status = $2,
            approved_at = case when $2 = 'approved' then coalesce(approved_at, $3::timestamptz) else approved_at end,
            approved_by = case when $2 = 'approved' then coalesce(approved_by, $4) else approved_by end
      where id = $1::uuid returning id`,
    [tradieId, status, at, actor],
  );
  if (rows.length === 0) return null;
  if (status === "removed") await db.query("delete from public.tradie_slots where tradie_id = $1::uuid", [tradieId]);
  await audit(db, { actor, action: `tradie.${status}`, entity: "tradie", entityId: tradieId });
  return getTradie(db, tradieId);
}

/** A tradie taking a break, or coming back. They can only switch between approved and paused. */
export async function setTradiePaused(db: Db, tradieId: string, paused: boolean): Promise<Tradie | null> {
  const rows = await db.query(
    `update public.tradies set status = $2 where id = $1::uuid and status = $3 and approved_at is not null returning id`,
    [tradieId, paused ? "paused" : "approved", paused ? "approved" : "paused"],
  );
  if (rows.length > 0) await audit(db, { actor: `tradie:${tradieId}`, action: paused ? "tradie.paused_self" : "tradie.resumed_self", entity: "tradie", entityId: tradieId });
  return getTradie(db, tradieId);
}

export async function savePayoutAccount(
  db: Db, tradieId: string, input: { provider: Provider; accountId: string; payoutsEnabled: boolean },
): Promise<void> {
  await db.query(
    `update public.tradies set payout_provider = $2, payout_account_id = $3, payouts_enabled = $4, payout_checked_at = $5::timestamptz
      where id = $1::uuid`,
    [tradieId, input.provider, input.accountId, input.payoutsEnabled, now().toISOString()],
  );
}

// ---------------------------------------------------------------------------
// LICENCES
// ---------------------------------------------------------------------------

function rowToLicence(row: { id: string; tradie_id: string; trade: string; licence_number: string; expires_on: string; verified_at: Date | null; verified_by: string | null }): Licence {
  return {
    id: row.id, tradieId: row.tradie_id, trade: row.trade, licenceNumber: row.licence_number, expiresOn: String(row.expires_on).slice(0, 10),
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null, verifiedBy: row.verified_by,
  };
}

export async function listLicences(db: Db, tradieId: string): Promise<Licence[]> {
  const rows = await db.query<Parameters<typeof rowToLicence>[0]>(
    "select id, tradie_id, trade, licence_number, expires_on, verified_at, verified_by from public.tradie_licences where tradie_id = $1::uuid order by trade",
    [tradieId],
  );
  return rows.map(rowToLicence);
}

/** Adds or replaces the licence for one trade. Changing the number or date clears the "checked by a person" mark. */
export async function saveLicence(
  db: Db, tradieId: string, input: { trade: string; licenceNumber: string; expiresOn: string }, actor: string,
): Promise<void> {
  if (!findTrade(input.trade)) throw new TradieError("That is not a trade we know.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn) || Number.isNaN(Date.parse(`${input.expiresOn}T00:00:00Z`))) {
    throw new TradieError("Enter the licence expiry as a date.");
  }
  const number = input.licenceNumber.trim();
  if (number.length < 2) throw new TradieError("Enter the licence number.");
  await db.query(
    `insert into public.tradie_licences (created_at, tradie_id, trade, licence_number, expires_on)
     values ($1::timestamptz, $2::uuid, $3, $4, $5::date)
     on conflict (tradie_id, trade) do update set
       licence_number = excluded.licence_number, expires_on = excluded.expires_on,
       verified_at = case when public.tradie_licences.licence_number = excluded.licence_number
                           and public.tradie_licences.expires_on = excluded.expires_on
                          then public.tradie_licences.verified_at else null end,
       verified_by = case when public.tradie_licences.licence_number = excluded.licence_number
                           and public.tradie_licences.expires_on = excluded.expires_on
                          then public.tradie_licences.verified_by else null end`,
    [now().toISOString(), tradieId, input.trade, number, input.expiresOn],
  );
  await audit(db, { actor, action: "licence.saved", entity: "tradie", entityId: tradieId, detail: { trade: input.trade, expires: input.expiresOn } });
}

/** A person on the team has seen the tradie's criminal record check. Only the note is kept, never the record. */
export async function markRecordCheckSeen(db: Db, tradieId: string, actor: string): Promise<void> {
  const rows = await db.query(
    "update public.tradies set record_check_seen_at = $2::timestamptz, record_check_seen_by = $3 where id = $1::uuid and record_check_seen_at is null returning id",
    [tradieId, now().toISOString(), actor],
  );
  if (rows.length > 0) await audit(db, { actor, action: "tradie.record_check_seen", entity: "tradie", entityId: tradieId });
}

export async function markLicenceVerified(db: Db, licenceId: string, actor: string): Promise<void> {
  const rows = await db.query<{ tradie_id: string; trade: string }>(
    "update public.tradie_licences set verified_at = $2::timestamptz, verified_by = $3 where id = $1::uuid returning tradie_id, trade",
    [licenceId, now().toISOString(), actor],
  );
  if (rows[0]) await audit(db, { actor, action: "licence.verified", entity: "tradie", entityId: rows[0].tradie_id, detail: { trade: rows[0].trade } });
}

// ---------------------------------------------------------------------------
// WHO CAN BE OFFERED A JOB
// ---------------------------------------------------------------------------

export type Candidate = {
  tradieId: string;
  userId: string;
  name: string;
  businessName: string;
  phone: string;
  /** 1 first choice, 2 backup, null for everyone else. */
  slotRank: 1 | 2 | null;
};

export type OfferCriteria = {
  market: string;
  trade: string;
  licenceRequired: boolean;
  /** The job needs someone outside normal hours. */
  afterHours: boolean;
  /** The job needs someone today. */
  urgent: boolean;
  /** Today's date and weekday in the market's own time. */
  today: string;
  weekday: string;
};

/**
 * Every tradie who may be offered this job, first choice first. This one
 * query is the whole eligibility rule:
 *  - approved, in this market, does this trade, has a mobile, can be paid
 *  - public liability insurance on file (insurer, policy number, certificate uploaded) that has not expired
 *  - if the job needs a licence: has one for this trade that has not expired
 *  - if the trade is building work: has an LBP number on file (DECISIONS.md, 2026-11-24)
 *  - if it is after hours: has said they take after-hours work
 *  - if it is urgent: works today
 */
export async function eligibleTradies(db: Db, criteria: OfferCriteria): Promise<Candidate[]> {
  const rows = await db.query<{ id: string; user_id: string; name: string; business_name: string; phone: string; slot_rank: number | null }>(
    `select t.id, t.user_id, u.name, t.business_name, u.phone,
            (select s.rank from public.tradie_slots s where s.market = t.market and s.trade = $2 and s.tradie_id = t.id) as slot_rank
       from public.tradies t join public.users u on u.id = t.user_id
      where t.market = $1
        and t.status = 'approved'
        and $2 = any(t.trades)
        and u.disabled_at is null
        and u.phone is not null
        and t.payouts_enabled
        and t.agreement_version = $8
        and char_length(coalesce(t.insurer, '')) >= 1
        and char_length(coalesce(t.insurance_policy_number, '')) >= 1
        and t.insurance_expires_on >= $6::date
        and exists (select 1 from public.uploads c where c.tradie_id = t.id and c.kind = 'insurance_certificate' and c.attached)
        and (not $3::boolean or exists (
              select 1 from public.tradie_licences l
               where l.tradie_id = t.id and l.trade = $2
                 and char_length(l.licence_number) >= 2
                 and l.expires_on >= $6::date))
        and (not $9::boolean or char_length(coalesce(t.lbp_number, '')) >= 2)
        and (not $4::boolean or t.after_hours)
        and (not $5::boolean or $7 = any(t.days_available))
      order by slot_rank nulls last, t.created_at`,
    [criteria.market, criteria.trade, criteria.licenceRequired, criteria.afterHours, criteria.urgent, criteria.today, criteria.weekday, TRADIE_AGREEMENT_VERSION, needsLbp(criteria.trade)],
  );
  return rows.map((row) => ({
    tradieId: row.id, userId: row.user_id, name: row.name, businessName: row.business_name, phone: row.phone,
    slotRank: row.slot_rank === 1 ? 1 : row.slot_rank === 2 ? 2 : null,
  }));
}

/** True if this tradie may still take this job right now (checked again at the moment they accept). */
export async function canStillTake(db: Db, tradieId: string, job: { market: string; trade: string; licenceRequired: boolean; today: string }): Promise<boolean> {
  const rows = await db.query(
    `select 1 from public.tradies t join public.users u on u.id = t.user_id
      where t.id = $1::uuid and t.market = $2 and t.status = 'approved' and $3 = any(t.trades) and u.disabled_at is null
        and t.agreement_version = $6
        and char_length(coalesce(t.insurer, '')) >= 1 and char_length(coalesce(t.insurance_policy_number, '')) >= 1
        and t.insurance_expires_on >= $5::date
        and exists (select 1 from public.uploads c where c.tradie_id = t.id and c.kind = 'insurance_certificate' and c.attached)
        and (not $4::boolean or exists (
              select 1 from public.tradie_licences l
               where l.tradie_id = t.id and l.trade = $3 and char_length(l.licence_number) >= 2 and l.expires_on >= $5::date))
        and (not $7::boolean or char_length(coalesce(t.lbp_number, '')) >= 2)`,
    [tradieId, job.market, job.trade, job.licenceRequired, job.today, TRADIE_AGREEMENT_VERSION, needsLbp(job.trade)],
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// FIRST CHOICE AND BACKUP
// ---------------------------------------------------------------------------

export type Slot = { market: string; trade: string; rank: 1 | 2; tradieId: string; businessName: string; since: Date; feeCents: number; feeActive: boolean };

export async function listSlots(db: Db, market: string): Promise<Slot[]> {
  const rows = await db.query<{ market: string; trade: string; rank: number; tradie_id: string; business_name: string; since: Date; fee_cents: number; fee_active: boolean }>(
    `select s.market, s.trade, s.rank, s.tradie_id, t.business_name, s.since, s.fee_cents, s.fee_active
       from public.tradie_slots s join public.tradies t on t.id = s.tradie_id
      where s.market = $1 order by s.trade, s.rank`,
    [market],
  );
  return rows.map((row) => ({
    market: row.market, trade: row.trade, rank: row.rank === 1 ? 1 : 2, tradieId: row.tradie_id, businessName: row.business_name,
    since: new Date(row.since), feeCents: row.fee_cents, feeActive: row.fee_active,
  }));
}

/** Puts a tradie in the first-choice or backup slot for a trade, or empties it (tradieId null). */
export async function setSlot(db: Db, input: { market: string; trade: string; rank: 1 | 2; tradieId: string | null }, actor: string): Promise<void> {
  await db.tx(async (tx) => {
    if (input.tradieId === null) {
      await tx.query("delete from public.tradie_slots where market = $1 and trade = $2 and rank = $3", [input.market, input.trade, input.rank]);
    } else {
      const tradie = await getTradie(tx, input.tradieId);
      if (!tradie || tradie.market !== input.market || !tradie.trades.includes(input.trade) || tradie.status !== "approved") {
        throw new TradieError("Only an approved tradie who does this trade in this market can hold the slot.");
      }
      // One tradie cannot be both first choice and backup for the same trade.
      await tx.query("delete from public.tradie_slots where market = $1 and trade = $2 and (rank = $3 or tradie_id = $4::uuid)", [
        input.market, input.trade, input.rank, input.tradieId,
      ]);
      await tx.query("insert into public.tradie_slots (market, trade, rank, tradie_id, since) values ($1, $2, $3, $4::uuid, $5::timestamptz)", [
        input.market, input.trade, input.rank, input.tradieId, now().toISOString(),
      ]);
    }
    await audit(tx, { actor, action: "slot.set", entity: "market", entityId: input.market, detail: { trade: input.trade, rank: input.rank, tradie: input.tradieId } });
  });
}

/** Swaps first choice and backup for a trade. The move the scorecard suggests when first choice drops below 80%. */
export async function swapSlots(db: Db, market: string, trade: string, actor: string): Promise<boolean> {
  return db.tx(async (tx) => {
    const rows = await tx.query<{ rank: number; tradie_id: string }>(
      "select rank, tradie_id from public.tradie_slots where market = $1 and trade = $2 order by rank for update",
      [market, trade],
    );
    const first = rows.find((row) => row.rank === 1);
    const backup = rows.find((row) => row.rank === 2);
    if (!first || !backup) return false;
    await tx.query("delete from public.tradie_slots where market = $1 and trade = $2", [market, trade]);
    const at = now().toISOString();
    await tx.query(
      `insert into public.tradie_slots (market, trade, rank, tradie_id, since) values ($1, $2, 1, $3::uuid, $5::timestamptz), ($1, $2, 2, $4::uuid, $5::timestamptz)`,
      [market, trade, backup.tradie_id, first.tradie_id, at],
    );
    await audit(tx, { actor, action: "slot.swapped", entity: "market", entityId: market, detail: { trade, new_first: backup.tradie_id, new_backup: first.tradie_id } });
    return true;
  });
}

export type Coverage = {
  trade: string;
  label: string;
  licenceRequired: boolean;
  /** Only tradies with an LBP number on file (building work). */
  lbpRequired: boolean;
  firstChoice: string | null;
  backup: string | null;
  /** Approved tradies who could be offered a job in this trade today. */
  ready: number;
};

/** For each trade: is there a first choice, a backup, and how many tradies could take a job. Shows where the network is thin. */
export async function coverage(db: Db, market: string, today: string): Promise<Coverage[]> {
  const slots = await listSlots(db, market);
  const counts = await db.query<{ trade: string; ready: number }>(
    `select tr.trade, count(*) as ready
       from public.tradies t
       join public.users u on u.id = t.user_id
       cross join lateral unnest(t.trades) as tr(trade)
      where t.market = $1 and t.status = 'approved' and t.payouts_enabled and u.phone is not null and u.disabled_at is null
        and (not (tr.trade = any($3::text[])) or exists (
              select 1 from public.tradie_licences l where l.tradie_id = t.id and l.trade = tr.trade and l.expires_on >= $2::date))
        and (not (tr.trade = any($4::text[])) or char_length(coalesce(t.lbp_number, '')) >= 2)
      group by tr.trade`,
    [market, today, tradeList.filter((trade) => trade.licenceRequired).map((trade) => trade.key), tradeList.filter((trade) => trade.lbpRequired).map((trade) => trade.key)],
  );
  const ready = new Map(counts.map((row) => [row.trade, Number(row.ready)]));
  return tradeList
    .filter((trade) => trade.key !== "other")
    .map((trade) => ({
      trade: trade.key,
      label: trade.label,
      licenceRequired: trade.licenceRequired,
      lbpRequired: Boolean(trade.lbpRequired),
      firstChoice: slots.find((slot) => slot.trade === trade.key && slot.rank === 1)?.businessName ?? null,
      backup: slots.find((slot) => slot.trade === trade.key && slot.rank === 2)?.businessName ?? null,
      ready: ready.get(trade.key) ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// THE TRADIE AGREEMENT, AGREED IN THE APP (DECISIONS.md, 2026-11-20)
// ---------------------------------------------------------------------------

/**
 * The version of the tradie agreement in force: its "last updated" date. A
 * tradie agrees to it in the app; when it changes, they are asked again, and
 * no offer goes to them until they have (the offer queries above check it).
 * Change this when the agreement changes, and the page's date with it
 * (tests/unit/legal.test.ts).
 */
export const TRADIE_AGREEMENT_VERSION = "24 November 2026";

/*
 * The 12-month no-direct-dealing rule and its NZ$250 release (DECISIONS.md, 2026-11-20) were dropped on
 * 23 November 2026 (DECISIONS.md, 2026-11-23). In their place, one rule in the tradie agreement (section 10): a job
 * booked in the app is finished and paid through the app; finishing an app job outside it can lead to removal,
 * which a person decides. Owners HostFix introduces stay at the market's fee for jobs through the app, with no limit.
 */

/** The tradie presses "I agree". Recorded with the time, and in the audit log. Safe to press twice. */
export async function agreeToAgreement(db: Db, tradieId: string): Promise<void> {
  await db.tx(async (tx) => {
    const rows = await tx.query(
      "update public.tradies set agreement_version = $2, agreed_at = $3::timestamptz where id = $1::uuid and agreement_version is distinct from $2 returning id",
      [tradieId, TRADIE_AGREEMENT_VERSION, now().toISOString()],
    );
    if (rows.length > 0) await audit(tx, { actor: `tradie:${tradieId}`, action: "tradie.agreed", entity: "tradie", entityId: tradieId, detail: { version: TRADIE_AGREEMENT_VERSION } });
  });
}
