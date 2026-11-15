import { isUuid } from "@/lib/uuid";
import type { CountryCode } from "@config/markets";
import { audit } from "@/lib/audit";
import { createUser, type User } from "@/lib/auth/users";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import type { CardSummary, Provider } from "@/lib/payments/gateway";

/**
 * OWNERS: the people who pay. An owner is a user with one or more properties
 * and a card on file (one per country, because each country has its own
 * payment account).
 */

export type Owner = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  homeLocation: string | null;
  leadId: string | null;
  createdAt: Date;
};

export type Billing = {
  ownerId: string;
  country: CountryCode;
  provider: Provider;
  customerId: string;
  paymentMethodId: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
};

type OwnerRow = {
  id: string; user_id: string; name: string; email: string | null; phone: string | null;
  home_location: string | null; lead_id: string | null; created_at: Date;
};

const OWNER_SELECT = `select o.id, o.user_id, u.name, u.email, u.phone, o.home_location, o.lead_id, o.created_at
                        from public.owners o join public.users u on u.id = o.user_id`;

function rowToOwner(row: OwnerRow): Owner {
  return {
    id: row.id, userId: row.user_id, name: row.name, email: row.email, phone: row.phone,
    homeLocation: row.home_location, leadId: row.lead_id, createdAt: new Date(row.created_at),
  };
}

export async function getOwner(db: Db, ownerId: string): Promise<Owner | null> {
  if (!isUuid(ownerId)) return null;
  const rows = await db.query<OwnerRow>(`${OWNER_SELECT} where o.id = $1::uuid`, [ownerId]);
  return rows[0] ? rowToOwner(rows[0]) : null;
}

/**
 * Creates the person and their owner record together. If they filled in the
 * landing page form earlier, the two are linked, so a founding deposit they
 * paid follows them.
 */
export async function createOwnerAccount(
  db: Db,
  input: { name: string; email: string; phone: string | null; homeLocation?: string | null },
): Promise<{ user: User; ownerId: string }> {
  return db.tx(async (tx) => {
    const user = await createUser(tx, { name: input.name, email: input.email, phone: input.phone });
    const lead = await tx.query<{ id: string }>(
      `select id from public.leads
        where lead_type = 'owner' and (email = $1 or ($2::text is not null and phone = $2))
        order by (deposit_status = 'paid') desc, created_at desc limit 1`,
      [input.email, input.phone],
    );
    const leadId = lead[0]?.id ?? null;
    const rows = await tx.query<{ id: string }>(
      `insert into public.owners (created_at, user_id, lead_id, home_location) values ($1::timestamptz, $2::uuid, $3::uuid, $4) returning id`,
      [now().toISOString(), user.id, leadId, input.homeLocation ?? null],
    );
    const ownerId = rows[0]!.id;
    if (leadId) await tx.query("update public.leads set converted_at = $2::timestamptz where id = $1::uuid", [leadId, now().toISOString()]);
    await audit(tx, { actor: `owner:${ownerId}`, action: "owner.created", entity: "owner", entityId: ownerId, detail: { from_lead: leadId } });
    return { user, ownerId };
  });
}

export async function updateOwnerContact(db: Db, ownerId: string, patch: { name: string; phone: string | null }): Promise<void> {
  await db.query(
    `update public.users u set name = $2, phone = $3
       from public.owners o where o.user_id = u.id and o.id = $1::uuid`,
    [ownerId, patch.name.trim(), patch.phone],
  );
}

export async function getBilling(db: Db, ownerId: string, country: CountryCode): Promise<Billing | null> {
  const rows = await db.query<{
    owner_id: string; country: CountryCode; provider: Provider; customer_id: string; payment_method_id: string | null;
    card_brand: string | null; card_last4: string | null; card_exp_month: number | null; card_exp_year: number | null;
  }>("select * from public.owner_billing where owner_id = $1::uuid and country = $2", [ownerId, country]);
  const row = rows[0];
  if (!row) return null;
  return {
    ownerId: row.owner_id, country: row.country, provider: row.provider, customerId: row.customer_id,
    paymentMethodId: row.payment_method_id, cardBrand: row.card_brand, cardLast4: row.card_last4,
    cardExpMonth: row.card_exp_month, cardExpYear: row.card_exp_year,
  };
}

/** Saves who the owner is at the payment company, and their card if we know it. A card is never wiped by saving without one. */
export async function saveBilling(
  db: Db,
  input: { ownerId: string; country: CountryCode; provider: Provider; customerId: string; card?: CardSummary | null },
): Promise<void> {
  const card = input.card ?? null;
  await db.query(
    `insert into public.owner_billing
       (owner_id, country, provider, customer_id, payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, updated_at)
     values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
     on conflict (owner_id, country) do update set
       provider = excluded.provider,
       customer_id = excluded.customer_id,
       payment_method_id = coalesce(excluded.payment_method_id, public.owner_billing.payment_method_id),
       card_brand = coalesce(excluded.card_brand, public.owner_billing.card_brand),
       card_last4 = coalesce(excluded.card_last4, public.owner_billing.card_last4),
       card_exp_month = coalesce(excluded.card_exp_month, public.owner_billing.card_exp_month),
       card_exp_year = coalesce(excluded.card_exp_year, public.owner_billing.card_exp_year),
       updated_at = excluded.updated_at`,
    [
      input.ownerId, input.country, input.provider, input.customerId, card?.paymentMethodId ?? null, card?.brand ?? null,
      card?.last4 ?? null, card?.expMonth ?? null, card?.expYear ?? null, now().toISOString(),
    ],
  );
}

export async function findOwnerByCustomer(db: Db, provider: Provider, customerId: string): Promise<{ ownerId: string; country: CountryCode } | null> {
  const rows = await db.query<{ owner_id: string; country: CountryCode }>(
    "select owner_id, country from public.owner_billing where provider = $1 and customer_id = $2",
    [provider, customerId],
  );
  return rows[0] ? { ownerId: rows[0].owner_id, country: rows[0].country } : null;
}

/**
 * A founding deposit this owner paid on the landing page and has not yet had
 * taken off a membership. It comes off the first month.
 */
export async function unusedDeposit(db: Db, ownerId: string, currency: string): Promise<{ leadId: string; amountCents: number } | null> {
  const rows = await db.query<{ id: string; deposit_amount: number }>(
    `select l.id, l.deposit_amount
       from public.owners o join public.leads l on l.id = o.lead_id
      where o.id = $1::uuid and l.deposit_status = 'paid' and upper(l.deposit_currency) = upper($2) and l.deposit_amount > 0`,
    [ownerId, currency],
  );
  return rows[0] ? { leadId: rows[0].id, amountCents: rows[0].deposit_amount } : null;
}
