import { randomUUID } from "node:crypto";
import type { Market } from "@config/markets";
import type { GatewayFor } from "@/lib/billing/settle";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { recordUpload } from "@/lib/files/uploads";
import { createJob, type NewJob } from "@/lib/jobs/create";
import { markArrived, type StepResult } from "@/lib/jobs/work";
import type { Job } from "@/lib/jobs/types";
import { saveTier } from "@/lib/markets/admin";
import { getMarket, listMenu, listTiers, type MenuItem, type Tier } from "@/lib/markets/store";
import { listMessages, type LoggedMessage } from "@/lib/notify/outbox";
import { createOwnerAccount, saveBilling } from "@/lib/owners/service";
import { createDemoGateway, DEMO_CARD_DECLINES, DEMO_CARD_OK } from "@/lib/payments/demo-gateway";
import { addMonths, type PaymentsGateway } from "@/lib/payments/gateway";
import { openPortfolio, startPortfolio, type Portfolio } from "@/lib/properties/portfolio";
import { activateFreeMembership, activateMembership, createProperty, getProperty, type Property } from "@/lib/properties/service";
import { agreeToAgreement, createTradie, markRecordCheckSeen, saveLicence, savePayoutAccount, setSlot, setTradieStatus, updateTradie } from "@/lib/tradies/service";
import { recordInsuranceCertificate } from "@/lib/tradies/certificate";

/**
 * Quick ways to set up people, properties and jobs for tests. Everything is
 * created through the same functions the app uses, so a test never works on
 * data the real app could not have produced.
 */

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

/** 15 Nov 2026, 10am Monday... in fact a Sunday in New Zealand. Tests that care about the day set their own time. */
export const MONDAY_10AM = new Date("2026-11-15T21:00:00.000Z"); // Mon 16 Nov 2026, 10:00am in Queenstown
export const MONDAY_9PM = new Date("2026-11-16T08:00:00.000Z"); // Mon 16 Nov 2026, 9:00pm in Queenstown

export async function liveMarket(db: Db, patch: Record<string, unknown> = {}): Promise<Market> {
  await db.query("update public.markets set stage = 'live' where slug = 'queenstown'");
  for (const [column, value] of Object.entries(patch)) {
    await db.query(`update public.markets set ${column} = $1 where slug = 'queenstown'`, [value]);
  }
  return (await getMarket(db, "queenstown"))!;
}

export async function makeOwner(db: Db, options: { card?: "ok" | "declines" | "none"; phone?: string | null } = {}) {
  const n = next();
  const { user, ownerId } = await createOwnerAccount(db, {
    name: `Olive Owner ${n}`,
    email: `owner${n}@example.com`,
    phone: options.phone === undefined ? `+642110${String(10000 + n)}` : options.phone,
  });
  if (options.card !== "none") {
    await saveBilling(db, {
      ownerId, country: "NZ", provider: "demo", customerId: `demo_cus_${n}`,
      card: options.card === "declines" ? DEMO_CARD_DECLINES : DEMO_CARD_OK,
    });
  }
  return { user, ownerId };
}

/**
 * The business sells one membership, Essential, and it is free to join
 * (DECISIONS.md, 2026-11-17). The app can still hold a priced per-property
 * membership, for a paid tier later. Tests of the monthly-payment paths add one
 * here, the way an admin would on the Markets screen. "paid" costs NZ$99 a
 * month, the price Essential had before it was made free, and is otherwise
 * Essential: a 24-hour promise, urgent at a surcharge.
 */
export async function addPaidTier(db: Db, overrides: { priceCents?: number } = {}): Promise<Tier> {
  await saveTier(db, "queenstown", {
    id: null, key: "paid", name: "Paid", priceCents: overrides.priceCents ?? 9900, responseHours: 24, urgentResponseHours: 4,
    urgentIncluded: false, urgentIncludedPerMonth: null, quarterlyCheck: false, blurb: "A monthly membership.", active: true,
  }, "test");
  return (await listTiers(db, "queenstown")).find((tier) => tier.key === "paid")!;
}

/**
 * The app can also include urgent call-outs in a membership. Tests of those abilities add their own
 * second membership here, the way an admin would on the Markets screen.
 * "plus" costs NZ$149 a month and includes urgent call-outs.
 */
export async function addPlusTier(db: Db, overrides: { urgentIncludedPerMonth?: number | null; priceCents?: number } = {}): Promise<Tier> {
  await saveTier(db, "queenstown", {
    id: null, key: "plus", name: "Plus", priceCents: overrides.priceCents ?? 14900, responseHours: 24, urgentResponseHours: 4,
    urgentIncluded: true, urgentIncludedPerMonth: overrides.urgentIncludedPerMonth ?? null, quarterlyCheck: false,
    blurb: "Urgent call-outs included.", active: true,
  }, "test");
  return (await listTiers(db, "queenstown")).find((tier) => tier.key === "plus")!;
}

export async function makeProperty(
  db: Db,
  ownerId: string,
  options: { tier?: "essential" | "plus" | "paid"; member?: boolean; name?: string; referralCode?: string } = {},
): Promise<Property> {
  const n = next();
  const tiers = await listTiers(db, "queenstown");
  const tier = tiers.find((candidate) => candidate.key === (options.tier ?? "essential"));
  if (!tier) throw new Error(`No "${options.tier}" membership. Call addPlusTier or addPaidTier first.`);
  const property = await createProperty(db, ownerId, {
    market: "queenstown", name: options.name ?? `Lakeview ${n}`, addressLine1: `${n} Lake Esplanade`, suburb: "Frankton", postcode: "9300",
    accessNotes: `Lockbox code ${1000 + n} by the front door.`, tierId: tier.id, referralCode: options.referralCode ?? null,
  });
  if (options.member === false) return property;
  if (tier.monthlyPriceCents === 0) {
    // Free to join: covered once a card is on file, with no subscription.
    const covered = await activateFreeMembership(db, { propertyId: property.id, ownerId, provider: "demo", customerId: `demo_cus_p${n}`, card: null });
    return covered!;
  }
  const at = now();
  const activated = await activateMembership(db, {
    propertyId: property.id, provider: "demo", subscriptionId: `demo_sub_${n}`, periodEnd: addMonths(at, 1), customerId: `demo_cus_p${n}`, card: null,
    invoice: { invoiceId: `demo_in_${n}_first`, amountCents: tier.monthlyPriceCents, currency: "NZD", periodStart: at, periodEnd: addMonths(at, 1), paidAt: at },
  });
  return activated!;
}

export type TradieOptions = {
  trades?: string[];
  /** Agreed to the tradie agreement in force (default yes). */
  agreed?: boolean;
  /** A licence for the first trade: "valid" (default for licensed trades), "expired" or "none". */
  licence?: "valid" | "expired" | "none";
  slot?: 1 | 2 | null;
  afterHours?: boolean;
  days?: string[];
  approved?: boolean;
  payouts?: boolean;
  name?: string;
  /** Public liability insurance: "valid" (default), "expired" or "none" (nothing on file). */
  insurance?: "valid" | "expired" | "none";
  /** Their public liability certificate uploaded (default true). Approval and offers need it. */
  certificate?: boolean;
};

export async function makeTradie(db: Db, options: TradieOptions = {}) {
  const n = next();
  const trades = options.trades ?? ["plumber"];
  const { user, tradieId } = await createTradie(db, {
    name: options.name ?? `Tane Tradie ${n}`, phone: `+642210${String(10000 + n)}`, email: null, market: "queenstown",
    businessName: options.name ?? `Tradie ${n} Ltd`, trades, daysAvailable: options.days ?? ["mon", "tue", "wed", "thu", "fri", "sat"],
    afterHours: options.afterHours ?? false, gstRegistered: true, licences: [],
  });
  const licence = options.licence ?? "valid";
  if (licence !== "none") {
    await saveLicence(db, tradieId, { trade: trades[0]!, licenceNumber: `LIC-${n}`, expiresOn: licence === "valid" ? "2030-12-31" : "2020-01-31" }, "test");
  }
  // Approval needs current insurance, so a tradie is approved with it on file and any "expired" or "none" applied after.
  const insurance = options.insurance ?? "valid";
  await updateTradie(db, tradieId, { insurer: "Test Insurance Ltd", insurancePolicyNumber: `PL-${n}`, insuranceExpiresOn: "2030-12-31" }, "test");
  await certificate(db, tradieId);
  if (options.payouts !== false) await savePayoutAccount(db, tradieId, { provider: "demo", accountId: `demo_acct_${n}`, payoutsEnabled: true });
  if (options.approved !== false) {
    await markRecordCheckSeen(db, tradieId, "test");
    await setTradieStatus(db, tradieId, "approved", "test");
  }
  if (options.agreed !== false) await agreeToAgreement(db, tradieId);
  if (insurance === "expired") await updateTradie(db, tradieId, { insuranceExpiresOn: "2020-01-31" }, "test");
  if (insurance === "none") await updateTradie(db, tradieId, { insurer: null, insurancePolicyNumber: null, insuranceExpiresOn: null }, "test");
  if (options.certificate === false) await db.query("delete from public.uploads where tradie_id = $1::uuid and kind = 'insurance_certificate'", [tradieId]);
  if (options.slot) await setSlot(db, { market: "queenstown", trade: trades[0]!, rank: options.slot, tradieId }, "test");
  return { user, tradieId, phone: user.phone! };
}

/** A public liability certificate on file for this tradie, as if they had uploaded it. Returns its id. */
export async function certificate(db: Db, tradieId: string): Promise<string> {
  return recordInsuranceCertificate(db, { tradieId }, {
    storageKey: `insurance_certificate/2026/11/${randomUUID()}.pdf`, contentType: "application/pdf", bytes: 2048, uploadedBy: `tradie:${tradieId}`, actor: `tradie:${tradieId}`,
  });
}

export async function menuItem(db: Db, code: string): Promise<MenuItem> {
  const item = (await listMenu(db, "queenstown")).find((candidate) => candidate.code === code);
  if (!item) throw new Error(`No menu item ${code}`);
  return item;
}

export async function logJob(db: Db, property: Property, overrides: Partial<NewJob> & { code?: string } = {}): Promise<Job> {
  const { code, ...rest } = overrides;
  const item = rest.menuItemId === null ? null : await menuItem(db, code ?? "PL-01");
  const result = await createJob(db, {
    property, reportedBy: "owner", reporterName: null, reporterPhone: null, menuItemId: item?.id ?? null, description: "",
    urgent: false, uploadIds: [], uploader: `owner:${property.ownerId}`, actor: `owner:${property.ownerId}`, ...rest,
  }, gatewayFor(db));
  if (!result.ok) throw new Error(`Job was not created: ${result.reason} ${result.message}`);
  return result.job;
}

/** A photo the tradie has uploaded, ready to attach when they arrive ("before") or finish ("completion", the after photo). */
export async function photo(
  db: Db, uploadedBy: string, kind: "before" | "completion" | "report" | "quote" | "receipt" | "certificate" = "completion",
  stamp: { lat?: number | null; lng?: number | null; takenAt?: Date | null; sha256?: string | null } = {},
): Promise<string> {
  const upload = await recordUpload(db, { kind, storageKey: `${kind}/test/${randomUUID()}.jpg`, contentType: "image/jpeg", bytes: 1234, uploadedBy, sha256: randomUUID().replace(/-/g, ""), ...stamp });
  return upload.id;
}

/** Where the test houses are: on Lake Esplanade, Queenstown. */
export const HOUSE = { lat: -45.03, lng: 168.66 };

/**
 * The tradie taps "I have arrived" with a before photo, as the app needs
 * (DECISIONS.md, 2026-11-19). `where` is the phone's location, or {} for none.
 */
export async function arrive(db: Db, jobId: string, tradieId: string, where: { lat?: number | null; lng?: number | null } | null = {}): Promise<StepResult> {
  return markArrived(db, jobId, tradieId, { ...(where ?? {}), uploadIds: [await photo(db, `tradie:${tradieId}`, "before")] });
}

export function gatewayFor(db: Db): GatewayFor {
  return () => createDemoGateway(db, "NZ");
}

/** Texts to a phone, by template. `messagesTo` also counts what went to the same person by email or app notification. */
export async function textsTo(db: Db, phone: string, template?: string): Promise<LoggedMessage[]> {
  return (await listMessages(db, { recipient: phone, limit: 200 })).filter((message) => !template || message.template === template);
}

/**
 * Everything sent to the person with this phone, however it went: a text, an
 * email (DECISIONS.md, 2026-11-20, third entry: job done, receipts, payment and
 * payout notices go by email to anyone with an email address) or an app notification.
 */
export async function messagesTo(db: Db, phone: string, template?: string): Promise<LoggedMessage[]> {
  const users = await db.query<{ id: string; email: string | null }>("select id, email from public.users where phone = $1", [phone]);
  const recipients = [phone, ...users.flatMap((user) => [user.id, user.email ?? ""])].filter(Boolean);
  const all: LoggedMessage[] = [];
  for (const recipient of recipients) all.push(...(await listMessages(db, { recipient, limit: 200 })));
  return all.filter((message) => !template || message.template === template).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function auditActions(db: Db, entityId: string): Promise<string[]> {
  const rows = await db.query<{ action: string }>("select action from public.audit_log where entity_id = $1 order by id", [entityId]);
  return rows.map((row) => row.action);
}

export async function openExceptions(db: Db, jobId: string): Promise<string[]> {
  const rows = await db.query<{ kind: string }>("select kind from public.exceptions where job_id = $1::uuid and status = 'open' order by created_at", [jobId]);
  return rows.map((row) => row.kind);
}

export async function offersFor(db: Db, jobId: string) {
  return db.query<{ id: string; tradie_id: string; stage: number; round: number; status: string; expires_at: Date }>(
    "select id, tradie_id, stage, round, status, expires_at from public.offers where job_id = $1::uuid order by sent_at, number",
    [jobId],
  );
}

/**
 * A manager on Portfolio: picks the Portfolio membership with their first
 * property (which sets it up for the whole account), adds the rest, and, if
 * asked, starts the one retainer with the card already on file. Everything
 * goes through the same functions the owner's screens use.
 */
export async function makePortfolio(
  db: Db,
  ownerId: string,
  count: number,
  options: { start?: boolean; gateway?: PaymentsGateway } = {},
): Promise<{ portfolio: Portfolio; properties: Property[] }> {
  const tier = (await listTiers(db, "queenstown")).find((candidate) => candidate.key === "portfolio");
  if (!tier) throw new Error('No "portfolio" membership in Queenstown.');
  const properties: Property[] = [];
  for (let index = 0; index < count; index += 1) {
    const n = next();
    properties.push(
      await createProperty(db, ownerId, {
        market: "queenstown", name: `Managed unit ${n}`, addressLine1: `${n} Hallenstein Street`, suburb: "Queenstown", postcode: "9300",
        accessNotes: `Key safe code ${2000 + n}.`, tierId: tier.id,
      }, options.gateway ?? createDemoGateway(db, "NZ")),
    );
  }
  let portfolio = (await openPortfolio(db, ownerId, "queenstown"))!;
  if (options.start !== false) {
    const started = await startPortfolio(db, options.gateway ?? createDemoGateway(db, "NZ"), { ownerId, portfolioId: portfolio.id, successUrl: "/app/billing", cancelUrl: "/app/billing" });
    if (started.kind !== "active") throw new Error(`Portfolio did not start: ${started.kind === "error" ? started.message : "sent to the card page"}`);
    portfolio = started.portfolio;
  }
  // Read back: starting the retainer covered them all.
  const fresh = await Promise.all(properties.map(async (property) => (await getProperty(db, ownerId, property.id))!));
  return { portfolio, properties: fresh };
}

/**
 * The owner's card starts declining after their job went out (DECISIONS.md, 2026-11-23): the hold placed at
 * booking is still there, but any new charge or hold on the card is declined.
 */
export async function cardDeclinesFromNow(db: Db, ownerId: string): Promise<void> {
  const billing = await db.query<{ customer_id: string }>("select customer_id from public.owner_billing where owner_id = $1::uuid", [ownerId]);
  await saveBilling(db, { ownerId, country: "NZ", provider: "demo", customerId: billing[0]?.customer_id ?? "demo_cus_x", card: DEMO_CARD_DECLINES });
}

/** The hold on a job's card ran out (or the card network let it go), so the charge goes to the card the usual way. */
export async function holdRanOut(db: Db, jobId: string): Promise<void> {
  await db.query("update public.card_holds set status = 'expired' where job_id = $1::uuid and status = 'held'", [jobId]);
}

/** The holds placed for a job, oldest first. */
export async function holdsFor(db: Db, jobId: string) {
  return db.query<{ id: string; seq: number; status: string; amount_cents: number; captured_cents: number; reason: string; capture_before: Date | null; payment_intent_id: string | null }>(
    "select id, seq, status, amount_cents, captured_cents, reason, capture_before, payment_intent_id from public.card_holds where job_id = $1::uuid order by seq",
    [jobId],
  );
}
