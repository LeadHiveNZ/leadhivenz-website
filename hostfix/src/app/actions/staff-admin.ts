"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { CountryCode, MarketStage, RetainerBand } from "@config/markets";
import { sendQueued } from "@/lib/after";
import { requireAdminRole } from "@/lib/auth/current";
import { addStaff, removeStaff, StaffError } from "@/lib/auth/staff";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { dollarsToCents, list, problem, text, ticked, type FormState } from "@/lib/forms";
import { AdminInputError, createMarket, saveMenuItem, savePriceListItem, saveTier, updateMarket, type MarketPatch } from "@/lib/markets/admin";
import { MARKETS_TAG } from "@/lib/markets/public";
import { emails } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { markReferralPaid } from "@/lib/owners/referrers";
import { getMarket } from "@/lib/markets/store";
import { paymentsFor } from "@/lib/payments";
import { getPortfolioForStaff, PortfolioError, setAgreedRetainer } from "@/lib/properties/portfolio";
import { getStore } from "@/lib/store";
import { startDemandTest } from "@/lib/leads/demand-test";
import { launchMarket } from "@config/markets";
import { AccountExistsError } from "@/lib/auth/users";
import { findTrade, trades } from "@config/trades";
import { clearHourlyRate, hourlyRates, saveHourlyRate } from "@/lib/jobs/rates";
import { createTradie, TradieError } from "@/lib/tradies/service";

/**
 * WHAT ONLY AN ADMIN CAN DO: change a market's prices and rules, edit the
 * menu, add a market, manage staff, and pay referral rewards. A dispatcher
 * who tries is sent back to their queue.
 */

function refreshMarkets(slug?: string) {
  // The public pages keep a copy of prices for up to an hour. This throws the
  // copies away at once, including a "not found" kept for a market's page from
  // before it was opened to the public.
  updateTag(MARKETS_TAG);
  for (const path of ["/", "/owners", "/tradies", "/sign-up", "/refer", "/admin/markets"]) revalidatePath(path);
  if (slug) {
    for (const path of [`/admin/markets/${slug}`, `/in/${slug}`, `/in/${slug}/tradies`]) revalidatePath(path);
  }
}

function amount(formData: FormData, name: string, errors: Record<string, string>): number | undefined {
  const cents = dollarsToCents(text(formData, name));
  if (cents === null) {
    errors[name] = "Enter an amount, for example 80.";
    return undefined;
  }
  return cents;
}

function whole(formData: FormData, name: string, errors: Record<string, string>): number | undefined {
  const raw = text(formData, name);
  if (!/^\d{1,4}$/.test(raw)) {
    errors[name] = "Enter a whole number.";
    return undefined;
  }
  return Number(raw);
}

function percent(formData: FormData, name: string, errors: Record<string, string>): number | undefined {
  const raw = text(formData, name).replace("%", "");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(raw)) {
    errors[name] = "Enter a percentage, for example 15.";
    return undefined;
  }
  return Number(raw);
}

/** A time of day on the hour or half hour: "7", "16:30" or "4:30pm". 16.5 means 4:30pm. */
function hourOfDay(formData: FormData, name: string, errors: Record<string, string>): number | undefined {
  const raw = text(formData, name).toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?::(00|30))?(am|pm)?$/.exec(raw);
  if (!match) {
    errors[name] = "Enter a time on the hour or half hour, for example 7 or 16:30.";
    return undefined;
  }
  let hour = Number(match[1]);
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  const value = hour + (match[2] === "30" ? 0.5 : 0);
  if (value > 24) {
    errors[name] = "Enter a time between 0 and 24.";
    return undefined;
  }
  return value;
}

/** A whole number, or nothing at all for "no limit". */
function spots(formData: FormData, name: string, errors: Record<string, string>): number | null | undefined {
  const raw = text(formData, name);
  if (raw === "") return null;
  if (!/^\d{1,4}$/.test(raw)) {
    errors[name] = "Enter a whole number, or leave it empty for no limit.";
    return undefined;
  }
  return Number(raw);
}

export async function saveMarketSettings(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const slug = text(formData, "slug");
  const errors: Record<string, string> = {};
  const fee = percent(formData, "platformFee", errors);
  const tax = percent(formData, "taxRate", errors);
  const patch: MarketPatch = {
    name: text(formData, "name"),
    stage: text(formData, "stage") as MarketStage,
    timezone: text(formData, "timezone"),
    taxName: text(formData, "taxName") || "GST",
    taxRegistered: ticked(formData, "taxRegistered"),
    taxNumber: text(formData, "taxNumber") || null,
    platformFeeBps: fee === undefined ? undefined : Math.round(fee * 100),
    taxRate: tax === undefined ? undefined : Math.round(tax * 100) / 10000,
    urgentSurchargeCents: amount(formData, "urgentSurcharge", errors),
    afterHoursSurchargeCents: amount(formData, "afterHoursSurcharge", errors),
    emergencySurchargeCents: amount(formData, "emergencySurcharge", errors),
    emergencyResponseMinutes: whole(formData, "emergencyResponseMinutes", errors),
    emergencyStepDownMinutes: whole(formData, "emergencyStepDownMinutes", errors),
    diagnosisFeeCents: amount(formData, "diagnosisFee", errors),
    diagnosisPayoutCents: amount(formData, "diagnosisPayout", errors),
    approvalThresholdCents: amount(formData, "approvalThreshold", errors),
    partsIncludedCents: amount(formData, "partsIncluded", errors),
    partsApprovalCents: amount(formData, "partsApproval", errors),
    payoutGuaranteeCents: amount(formData, "payoutGuarantee", errors),
    referralRewardCents: amount(formData, "referralReward", errors),
    offerMinutes: whole(formData, "offerMinutes", errors),
    hoursStart: hourOfDay(formData, "hoursStart", errors),
    hoursEnd: hourOfDay(formData, "hoursEnd", errors),
    payoutHoldHours: whole(formData, "payoutHoldHours", errors),
    unacceptedAlertHours: whole(formData, "unacceptedAlertHours", errors),
    counterOfferHours: whole(formData, "counterOfferHours", errors),
    minMinutesOnSite: whole(formData, "minMinutesOnSite", errors),
    ownerConfirmHours: whole(formData, "ownerConfirmHours", errors),
    notDescribedHours: whole(formData, "notDescribedHours", errors),
    offerPushSmsMinutes: whole(formData, "offerPushSmsMinutes", errors),
    referralPaidMonths: whole(formData, "referralPaidMonths", errors),
    workDays: list(formData, "workDays"),
    replyByText: ticked(formData, "replyByText"),
    depositEnabled: ticked(formData, "depositEnabled"),
    depositCents: amount(formData, "deposit", errors),
    depositSpots: spots(formData, "depositSpots", errors),
    depositTerms: text(formData, "depositTerms").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
  // Hourly rates for extra work, per trade (DECISIONS.md, 2026-11-20, third entry; confirmed 2026-11-24, second entry).
  // A box left empty takes away a rate saved here: the trade goes back to its default, or to the tradie's own price.
  const rates: { trade: string; cents: number }[] = [];
  const noRate: string[] = [];
  for (const trade of trades) {
    const name = `rate-${trade.key}`;
    const raw = text(formData, name);
    if (!raw) {
      noRate.push(trade.key);
      continue;
    }
    const cents = dollarsToCents(raw);
    if (cents === null || cents < 1000 || cents > 100_000) errors[name] = "An hourly rate from 10 to 1000, or leave it empty.";
    else rates.push({ trade: trade.key, cents });
  }
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields. Nothing was saved.", errors);
  try {
    const db = await getDb();
    const current = await hourlyRates(db, slug);
    for (const rate of rates) if (current[rate.trade] !== rate.cents) await saveHourlyRate(db, slug, rate.trade, rate.cents, staff.actor);
    for (const trade of noRate) if (current[trade] !== undefined) await clearHourlyRate(db, slug, trade, staff.actor);
    await updateMarket(db, slug, patch, staff.actor);
  } catch (error) {
    if (error instanceof AdminInputError) return problem(formData, `${error.message} Nothing was saved.`);
    throw error;
  }
  refreshMarkets(slug);
  return { done: "Saved. New prices apply to jobs logged from now on. Jobs already logged keep the price they were logged at." };
}

/** How many band rows the tier form shows. */
const BAND_ROWS = 6;

/** Reads the band rows of the tier form. A row left completely empty is skipped. */
function bandRows(formData: FormData, suffix: string, errors: Record<string, string>): RetainerBand[] {
  const bands: RetainerBand[] = [];
  for (let index = 0; index < BAND_ROWS; index += 1) {
    const fromName = `bandFrom-${suffix}-${index}`;
    const toName = `bandTo-${suffix}-${index}`;
    const priceName = `bandPrice-${suffix}-${index}`;
    const from = text(formData, fromName);
    const to = text(formData, toName);
    const price = text(formData, priceName);
    if (!from && !to && !price) continue;
    if (!/^\d{1,4}$/.test(from)) errors[fromName] = "Enter the smallest number of properties for this band.";
    if (to && !/^\d{1,4}$/.test(to)) errors[toName] = "A whole number, or leave it empty for \"and up\".";
    const cents = price ? dollarsToCents(price) : null;
    if (price && cents === null) errors[priceName] = "Enter an amount, for example 600, or leave it empty for \"by arrangement\".";
    bands.push({ from: Number(from), to: to ? Number(to) : null, cents });
  }
  return bands;
}

export async function saveTierAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const slug = text(formData, "slug");
  const id = text(formData, "tierId");
  const suffix = id || "new";
  const errors: Record<string, string> = {};
  const basis = text(formData, `basis-${suffix}`) === "per_account" ? "per_account" : "per_property";
  // A retainer's price comes from its lowest band, so the per-property price box is only read for per-property memberships.
  const price = basis === "per_property" ? amount(formData, `price-${suffix}`, errors) : 0;
  const bands = basis === "per_account" ? bandRows(formData, suffix, errors) : [];
  const responseHours = whole(formData, `responseHours-${suffix}`, errors);
  const urgentHours = whole(formData, `urgentHours-${suffix}`, errors);
  const perMonthRaw = text(formData, `urgentPerMonth-${suffix}`);
  if (perMonthRaw !== "" && !/^\d{1,2}$/.test(perMonthRaw)) errors[`urgentPerMonth-${suffix}`] = "A whole number, or leave it empty for no limit.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields. Nothing was saved.", errors);
  try {
    await saveTier(await getDb(), slug, {
      id: id || null,
      key: text(formData, `key-${suffix}`).toLowerCase(),
      name: text(formData, `name-${suffix}`),
      priceCents: price!, responseHours: responseHours!, urgentResponseHours: urgentHours!,
      urgentIncluded: ticked(formData, "urgentIncluded"),
      urgentIncludedPerMonth: perMonthRaw === "" ? null : Number(perMonthRaw),
      quarterlyCheck: ticked(formData, "quarterlyCheck"),
      blurb: text(formData, `blurb-${suffix}`),
      active: ticked(formData, "active"),
      billingBasis: basis,
      bands,
    }, staff.actor);
  } catch (error) {
    if (error instanceof AdminInputError) return problem(formData, `${error.message} Nothing was saved.`);
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") return problem(formData, "Another tier in this market already uses that short code.");
    throw error;
  }
  refreshMarkets(slug);
  return { done: id ? "Saved." : "Membership added." };
}

export async function saveMenuItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const slug = text(formData, "slug");
  const id = text(formData, "itemId");
  const suffix = id || "new";
  const errors: Record<string, string> = {};
  const ownerPrice = amount(formData, `ownerPrice-${suffix}`, errors);
  const payout = amount(formData, `payout-${suffix}`, errors);
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields. Nothing was saved.", errors);
  try {
    await saveMenuItem(await getDb(), slug, {
      id: id || null,
      code: text(formData, `code-${suffix}`),
      trade: text(formData, `trade-${suffix}`),
      name: text(formData, `name-${suffix}`),
      description: text(formData, `description-${suffix}`),
      tryFirst: text(formData, `tryFirst-${suffix}`),
      ownerPriceCents: ownerPrice!, tradiePayoutCents: payout!,
      licenceRequired: ticked(formData, "licenceRequired"),
      guestVisible: ticked(formData, "guestVisible"),
      active: ticked(formData, "active"),
    }, staff.actor);
  } catch (error) {
    if (error instanceof AdminInputError) return problem(formData, `${error.message} Nothing was saved.`);
    throw error;
  }
  refreshMarkets(slug);
  return { done: id ? "Saved. The new price applies to jobs logged from now on." : "Job added to the menu." };
}

/** A part on the market's price list (DECISIONS.md, 2026-11-20). Admins only. */
export async function savePriceListAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const slug = text(formData, "slug");
  const id = text(formData, "partItemId");
  const suffix = id || "new";
  const errors: Record<string, string> = {};
  const price = amount(formData, `partPrice-${suffix}`, errors);
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the price. Nothing was saved.", errors);
  try {
    await savePriceListItem(await getDb(), slug, {
      id: id || null, code: text(formData, `partCode-${suffix}`), name: text(formData, `partName-${suffix}`), priceCents: price!,
      active: ticked(formData, "partActive"), source: text(formData, `partSource-${suffix}`),
    }, staff.actor);
  } catch (error) {
    if (error instanceof AdminInputError) return problem(formData, `${error.message} Nothing was saved.`);
    throw error;
  }
  refreshMarkets(slug);
  return { done: id ? "Saved. The new price applies to parts added from now on." : "Part added to the price list." };
}

export async function addMarket(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const slug = text(formData, "newSlug").toLowerCase();
  const country = (text(formData, "country") === "AU" ? "AU" : "NZ") as CountryCode;
  try {
    await createMarket(await getDb(), { slug, name: text(formData, "newName"), country, timezone: text(formData, "newTimezone"), copyFrom: text(formData, "copyFrom") || null }, staff.actor);
  } catch (error) {
    if (error instanceof AdminInputError) return problem(formData, error.message);
    throw error;
  }
  refreshMarkets(slug);
  redirect(`/admin/markets/${slug}?created=1`);
}

// ---------------------------------------------------------------------------
// STAFF
// ---------------------------------------------------------------------------

export async function addStaffMember(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const db = await getDb();
  try {
    await addStaff(db, {
      name: text(formData, "staffName"), email: text(formData, "staffEmail"), role: text(formData, "role") === "admin" ? "admin" : "dispatcher",
      signInUrl: `${baseUrl()}/sign-in?next=/admin/queue`,
    }, staff.actor);
  } catch (error) {
    if (error instanceof StaffError) return problem(formData, error.message);
    throw error;
  }
  await sendQueued(db);
  revalidatePath("/admin/staff");
  return { done: "Added. They have been emailed a link. They sign in with their email address and a code, no password." };
}

export async function removeStaffMember(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const userId = text(formData, "userId");
  if (staff.viewer?.user.id === userId) return { message: "You cannot remove your own access. Ask another admin, or use the admin password." };
  await removeStaff(await getDb(), userId, staff.actor);
  revalidatePath("/admin/staff");
  return { done: "Access removed. They have been signed out everywhere." };
}

// ---------------------------------------------------------------------------
// REFERRALS AND LEADS
// ---------------------------------------------------------------------------

export async function payReferral(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const paid = await markReferralPaid(await getDb(), text(formData, "referralId"), text(formData, "paidNote"), staff.actor);
  revalidatePath("/admin/referrals");
  return paid ? { done: "Recorded as paid." } : { message: "That reward is not due, or has already been recorded as paid." };
}

/** Emails (or texts) someone on the waiting list the link to join now that their area is open. */
export async function inviteLead(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole();
  const db = await getDb();
  const lead = await getStore().getLead(text(formData, "leadId"));
  if (!lead) return { message: "We could not find that lead." };
  if (lead.convertedAt) return { message: "They have already joined." };
  const link = `${baseUrl()}/${lead.leadType === "owner" ? `sign-up?market=${lead.market}` : "sign-in?next=/tradie/profile"}`;
  if (lead.leadType === "tradie") return { message: "For a tradie, use Make a tradie instead. That creates their account and texts them." };
  const mail = emails.ownerInvite({ name: lead.name.split(" ")[0] ?? lead.name, link });
  if (lead.email) {
    await enqueue(db, { channel: "email", to: lead.email, template: "owner_invite", subject: mail.subject, body: mail.body, audience: "owner" });
  } else {
    await enqueue(db, { channel: "sms", to: lead.phone, template: "owner_invite", body: mail.text, audience: "owner" });
  }
  await db.query("update public.leads set invited_at = $2::timestamptz where id = $1::uuid", [lead.id, new Date().toISOString()]);
  await sendQueued(db);
  revalidatePath("/admin/leads");
  return { done: lead.email ? "Invitation emailed." : "Invitation texted." };
}

/** Turns a tradie who filled in the public form into a tradie on the network, waiting for approval. */
export async function tradieFromLead(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const db = await getDb();
  const lead = await getStore().getLead(text(formData, "leadId"));
  if (!lead || lead.leadType !== "tradie") return { message: "We could not find that tradie lead." };
  if (lead.convertedAt) return { message: "They are already on the tradie list." };
  const trade = findTrade(lead.trade ?? "");
  const tradeKey = !trade || trade.key === "other" ? "handyman" : trade.key;
  let tradieId: string;
  try {
    const created = await createTradie(db, {
      name: lead.name, phone: lead.phone, email: lead.email, market: lead.market, businessName: lead.name, trades: [tradeKey],
      daysAvailable: lead.daysAvailable ?? [], gstRegistered: false, licences: [], leadId: lead.id,
    });
    tradieId = created.tradieId;
  } catch (error) {
    if (error instanceof TradieError) return { message: error.message };
    if (error instanceof AccountExistsError) return { message: "Someone with that mobile or email already has an account. Look for them in the tradie list." };
    throw error;
  }
  const notes = [
    lead.licenceNumber ? `Licence number given on the form: ${lead.licenceNumber}. Add the expiry date and check it on the register.` : null,
    !trade || trade.key === "other" ? `On the form they chose "${lead.trade ?? "something else"}" as their trade. Check what work they do.` : null,
  ].filter(Boolean).join(" ");
  if (notes) await db.query("update public.tradies set notes = $2 where id = $1::uuid", [tradieId, notes]);
  void staff;
  revalidatePath("/admin/leads");
  redirect(`/admin/tradies/${tradieId}?added=1&edit=1`);
}

/** Starts the demand test's fourteen days from now, for the scorecard on the leads page. */
export async function startDemandTestAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const market = text(formData, "market") || launchMarket.slug;
  await startDemandTest(await getDb(), market, staff.actor);
  revalidatePath("/admin/leads");
  return { done: "Started. Day 1 of 14 is today." };
}

/**
 * Sets the retainer a person agreed with a Portfolio manager (100 and more
 * properties are by arrangement), or clears it to go back to the bands. It
 * takes effect from the manager's next monthly payment.
 */
export async function setPortfolioRetainer(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdminRole();
  const db = await getDb();
  const portfolio = await getPortfolioForStaff(db, text(formData, "portfolioId"));
  if (!portfolio) return { message: "That Portfolio does not exist." };
  const raw = text(formData, "agreedRetainer");
  const cents = raw === "" ? null : dollarsToCents(raw);
  if (raw !== "" && cents === null) return problem(formData, "Enter the agreed retainer, for example 1500, or leave it empty to go back to the bands.", { agreedRetainer: "Enter an amount." });
  const market = await getMarket(db, portfolio.market);
  try {
    await setAgreedRetainer(db, market ? paymentsFor(db, market.country) : null, portfolio.id, cents, staff.actor);
  } catch (error) {
    if (error instanceof PortfolioError) return problem(formData, error.message);
    console.error("[portfolio] setting the agreed retainer failed:", error instanceof Error ? error.message : error);
    return problem(formData, "The payment company could not be reached, so nothing was changed. Try again in a minute.");
  }
  await sendQueued(db);
  revalidatePath(`/admin/owners/${portfolio.ownerId}`);
  return { done: cents === null ? "Back on the bands. Any change starts with their next monthly payment." : "Saved. The agreed retainer starts with their next monthly payment." };
}
