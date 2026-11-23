"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { jobFromOwnerLink } from "@/lib/access/links";
import { gatewayFor, sendQueued, settleCancel } from "@/lib/after";
import { raiseDispute } from "@/lib/billing/settle";
import { currentViewer, requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { attachUploads } from "@/lib/files/uploads";
import { dollarsToCents, list, problem, text, ticked, type FormState } from "@/lib/forms";
import { approveGuestReport, cancelJob, createJob } from "@/lib/jobs/create";
import { getJobForOwner, getQuote } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { answerLaterTime } from "@/lib/dispatch/cascade";
import { ownerObjects } from "@/lib/jobs/not-described";
import { answerQuote as answerQuoteWithCharge, reportTradieAbsent } from "@/lib/jobs/work";
import { confirmFixed } from "@/lib/jobs/confirm";
import { guestFromForm } from "@/lib/jobs/guest-form";
import { getMarket } from "@/lib/markets/store";
import { getBilling, updateOwnerContact } from "@/lib/owners/service";
import { paymentsFor } from "@/lib/payments";
import { normalisePhone } from "@/lib/phone";
import { isUuid } from "@/lib/uuid";
import { IMPORT_MAX_ROWS, parsePropertyRows } from "@/lib/properties/import";
import { geocoder } from "@/lib/maps/geocode";
import { confirmPin, fillMissingPins, lookUpPin } from "@/lib/properties/pin";
import { cancelPortfolio, choosePortfolio, getPortfolio, PortfolioError, startPortfolio } from "@/lib/properties/portfolio";
import { activateFreeMembership, changeTier, createProperty, getProperty, PropertyError, requestCancel, rotateReportLink, startMembership, updateProperty } from "@/lib/properties/service";

/**
 * EVERYTHING AN OWNER CAN DO. Each action starts by working out who is
 * asking, and every lookup after that carries their id, so nobody can act on
 * a property or job that is not theirs.
 */

const OFF_MENU = "off-menu";

function propertyFields(formData: FormData) {
  const fields = {
    name: text(formData, "name"),
    addressLine1: text(formData, "addressLine1"),
    addressLine2: text(formData, "addressLine2") || null,
    suburb: text(formData, "suburb"),
    postcode: text(formData, "postcode"),
    accessNotes: text(formData, "accessNotes"),
    hazards: text(formData, "hazards"),
  };
  const errors: Record<string, string> = {};
  if (fields.name.length < 1) errors.name = "Give the property a name you will recognise, like Lakeview Apartment.";
  if (fields.addressLine1.length < 3) errors.addressLine1 = "Enter the street address.";
  if (fields.suburb.length < 2) errors.suburb = "Enter the suburb or town.";
  return { fields, errors };
}

export async function addProperty(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/properties/new");
  const { fields, errors } = propertyFields(formData);
  const market = text(formData, "market");
  const tierId = text(formData, "tierId");
  if (!tierId) errors.tierId = "Choose a membership.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);

  const db = await getDb();
  let property;
  try {
    const where = await getMarket(db, market);
    // The gateway lets a property joining a Portfolio change the retainer's band straight away.
    property = await createProperty(db, viewer.ownerId, { ...fields, market, tierId, referralCode: text(formData, "ref") || null }, where ? paymentsFor(db, where.country) : null);
  } catch (error) {
    if (error instanceof PropertyError) return problem(formData, error.message);
    throw error;
  }
  // Put the pin where the address is, for the owner to check on the next page (DECISIONS.md, 2026-11-19).
  await lookUpPin(db, geocoder(), property.id);
  redirect(`/app/properties/${property.id}?added=1`);
}

/** The owner picks Portfolio for their whole account in one area. */
export async function choosePortfolioAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/billing");
  try {
    await choosePortfolio(await getDb(), viewer.ownerId, text(formData, "market"));
  } catch (error) {
    if (error instanceof PortfolioError) return { message: error.message };
    throw error;
  }
  revalidatePath("/app/billing");
  redirect("/app/billing?portfolio=1");
}

/** Starts the one Portfolio retainer. Sends the owner to the card page the first time. */
export async function beginPortfolio(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/billing");
  const db = await getDb();
  const portfolio = await getPortfolio(db, viewer.ownerId, text(formData, "portfolioId"));
  if (!portfolio) return { message: "We could not find your Portfolio." };
  const market = await getMarket(db, portfolio.market);
  const gateway = market ? paymentsFor(db, market.country) : null;
  if (!gateway) return { message: "Card payments are not switched on yet, so the retainer cannot start. Please try again soon." };
  let result;
  try {
    result = await startPortfolio(db, gateway, {
      ownerId: viewer.ownerId, portfolioId: portfolio.id,
      successUrl: `${baseUrl()}/app/membership/return?portfolio=${portfolio.id}`,
      cancelUrl: `${baseUrl()}/app/billing`,
    });
  } catch (error) {
    console.error("[portfolio] starting the retainer failed:", error instanceof Error ? error.message : error);
    return { message: "The retainer could not be started just now. Nothing has been charged. Please try again." };
  }
  await sendQueued(db);
  if (result.kind === "error") return { message: result.message };
  if (result.kind === "redirect") redirect(result.url);
  redirect("/app/billing?member=1");
}

export async function endPortfolio(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/billing");
  const db = await getDb();
  const portfolio = await getPortfolio(db, viewer.ownerId, text(formData, "portfolioId"));
  if (!portfolio) return { message: "We could not find your Portfolio." };
  const market = await getMarket(db, portfolio.market);
  try {
    await cancelPortfolio(db, market ? paymentsFor(db, market.country) : null, viewer.ownerId, portfolio.id);
  } catch (error) {
    console.error("[portfolio] cancelling failed:", error instanceof Error ? error.message : error);
    return { message: "The retainer could not be cancelled just now. Please try again, or contact us." };
  }
  revalidatePath("/app/billing");
  return { done: portfolio.status === "setup" ? "Portfolio removed. Choose a membership for each property instead." : "Cancelled. Your properties stay covered until the month you paid for ends." };
}

export async function saveProperty(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const { fields, errors } = propertyFields(formData);
  let spendLimitCents: number | null | undefined;
  const limit = text(formData, "spendLimit");
  if (limit !== "") {
    const cents = dollarsToCents(limit);
    if (cents === null) errors.spendLimit = "Enter an amount, for example 400.";
    else spendLimitCents = cents;
  } else spendLimitCents = null;
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);

  const db = await getDb();
  const before = await getProperty(db, viewer.ownerId, propertyId);
  const saved = await updateProperty(db, viewer.ownerId, propertyId, { ...fields, guestAutoDispatch: ticked(formData, "guestAutoDispatch"), spendLimitCents });
  if (!saved || !before) return problem(formData, "We could not find that property.");
  // A new address clears the old pin (updateProperty): look the new one up, for the owner to check.
  const moved = before.addressLine1 !== saved.addressLine1 || before.suburb !== saved.suburb || before.postcode !== saved.postcode;
  if (moved) await lookUpPin(db, geocoder(), propertyId);
  revalidatePath(`/app/properties/${propertyId}`);
  return { done: moved ? "Saved. The address changed, so check the map pin at the top of this page." : "Saved." };
}

/** The owner confirms or moves the property's map pin (DECISIONS.md, 2026-11-19). */
export async function savePin(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const lat = Number(text(formData, "pinLat"));
  const lng = Number(text(formData, "pinLng"));
  const result = await confirmPin(await getDb(), viewer.ownerId, propertyId, {
    lat: text(formData, "pinLat") === "" ? Number.NaN : lat, lng: text(formData, "pinLng") === "" ? Number.NaN : lng, moved: text(formData, "pinMoved") === "1",
  });
  if (!result.ok) return { message: result.message };
  revalidatePath(`/app/properties/${propertyId}`);
  revalidatePath("/app/properties");
  redirect(`/app/properties/${propertyId}?pinned=1`);
}

/** Starts the membership: for a free one, the card on file (or the card page); for a paid one, the monthly payment. */
export async function beginMembership(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, propertyId);
  if (!property) return { message: "We could not find that property." };
  const tierId = text(formData, "tierId");
  if (tierId && tierId !== property.tierId) {
    try {
      await changeTier(db, null, viewer.ownerId, propertyId, tierId);
    } catch (error) {
      if (error instanceof PropertyError) return { message: error.message };
      throw error;
    }
  }
  const market = await getMarket(db, property.market);
  const gateway = market ? paymentsFor(db, market.country) : null;
  if (!gateway) return { message: "Card payments are not switched on yet, so memberships cannot start. Please try again soon." };

  let result;
  try {
    result = await startMembership(db, gateway, {
      ownerId: viewer.ownerId, propertyId,
      successUrl: `${baseUrl()}/app/membership/return?property=${propertyId}`,
      cancelUrl: `${baseUrl()}/app/properties/${propertyId}`,
    });
  } catch (error) {
    console.error("[membership] starting a membership failed:", error instanceof Error ? error.message : error);
    return { message: "The membership could not be started just now. Nothing has been charged. Please try again." };
  }
  if (result.kind === "error") return { message: result.message };
  if (result.kind === "redirect") redirect(result.url);
  redirect(`/app/properties/${propertyId}?member=1`);
}

export async function endMembership(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, propertyId);
  if (!property) return { message: "We could not find that property." };
  const market = await getMarket(db, property.market);
  try {
    await requestCancel(db, market ? paymentsFor(db, market.country) : null, viewer.ownerId, propertyId);
  } catch (error) {
    console.error("[membership] cancelling failed:", error instanceof Error ? error.message : error);
    return { message: "The membership could not be cancelled just now. Please try again, or contact us." };
  }
  redirect(`/app/properties/${propertyId}?cancelled=1`);
}

export async function switchTier(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, propertyId);
  if (!property) return { message: "We could not find that property." };
  const market = await getMarket(db, property.market);
  try {
    await changeTier(db, market ? paymentsFor(db, market.country) : null, viewer.ownerId, propertyId, text(formData, "tierId"));
  } catch (error) {
    if (error instanceof PropertyError) return { message: error.message };
    console.error("[membership] changing tier failed:", error instanceof Error ? error.message : error);
    return { message: "The membership could not be changed just now. Please try again." };
  }
  revalidatePath(`/app/properties/${propertyId}`);
  return { done: "Changed. The new price starts with your next monthly payment." };
}

export async function replaceLink(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const which = text(formData, "which") === "team" ? "team" : "guest";
  const saved = await rotateReportLink(await getDb(), viewer.ownerId, propertyId, which);
  if (!saved) return { message: "We could not find that property." };
  revalidatePath(`/app/properties/${propertyId}`);
  return { done: which === "guest" ? "New guest link made. Print the QR card again: the old one no longer works." : "New team link made. Send it to your cleaner again: the old one no longer works." };
}

/** The owner logs a job themselves. */
export async function logOwnerJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/jobs/new");
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, text(formData, "propertyId"));
  if (!property) return problem(formData, "Choose which property this is for.");
  const choice = text(formData, "menuItemId");
  if (!choice) return problem(formData, "Choose what needs fixing.");

  const guest = guestFromForm(formData, "NZ");
  if (!guest.ok) return problem(formData, guest.message, { guestPhone: guest.message });
  const result = await createJob(db, {
    ...guest.guest,
    property, reportedBy: "owner", reporterName: null, reporterPhone: null,
    menuItemId: choice === OFF_MENU ? null : choice, offMenuTrade: text(formData, "offMenuTrade"), offMenuTitle: text(formData, "offMenuTitle"),
    description: text(formData, "description"), urgent: ticked(formData, "urgent"), uploadIds: list(formData, "uploadIds"),
    uploader: `owner:${viewer.ownerId}`, actor: `owner:${viewer.ownerId}`,
  }, gatewayFor(db));
  await sendQueued(db);
  if (!result.ok) {
    if (result.reason === "duplicate" && result.existingJobId) redirect(`/app/jobs/${result.existingJobId}?already=1`);
    return problem(formData, result.message);
  }
  redirect(`/app/jobs/${result.job.id}?sent=1`);
}

/**
 * Finds the job an owner is acting on, either because they are signed in and
 * it is theirs, or because they opened the one-tap link we texted them.
 */
async function ownersJob(db: Db, formData: FormData): Promise<{ job: Job; actor: string; back: string } | null> {
  const code = text(formData, "code");
  if (code) {
    const job = await jobFromOwnerLink(db, code);
    return job ? { job, actor: `owner:${job.ownerId}`, back: `/j/${code}` } : null;
  }
  const viewer = await currentViewer();
  if (!viewer?.ownerId) return null;
  const job = await getJobForOwner(db, viewer.ownerId, text(formData, "jobId"));
  return job ? { job, actor: `owner:${viewer.ownerId}`, back: `/app/jobs/${job.id}` } : null;
}

const NOT_FOUND = "We could not find that job. If you opened this from a text, the link may have been cut short. Sign in to see your jobs.";

/** The owner says yes to a guest's report: standard or urgent. */
export async function goAhead(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const approved = await approveGuestReport(db, found.job.id, { urgent: text(formData, "how") === "urgent" }, found.actor, gatewayFor(db));
  await sendQueued(db);
  if (!approved.ok) return { message: approved.message };
  redirect(`${found.back}?sent=1`);
}

export async function cancelOwnerJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const result = await cancelJob(db, found.job.id, { actor: found.actor }, text(formData, "reason") || "Cancelled by the owner");
  if (result.ok) await settleCancel(db, found.job.id);
  else await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${found.back}?cancelled=1`);
}

export async function answerQuote(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const quote = await getQuote(db, text(formData, "quoteId"));
  if (!quote || quote.jobId !== found.job.id) return { message: "We could not find that quote." };
  // Work that takes the job over NZ$1,000 takes a 50% deposit when it is approved: from the bank (the default) or
  // by card (DECISIONS.md, 2026-11-23, second entry).
  const answer = text(formData, "answer");
  const method = answer === "bank" ? "bank" : answer === "card" ? "card" : undefined;
  const result = await answerQuoteWithCharge(db, gatewayFor(db), quote.id, answer === "yes" || method !== undefined, found.actor, { method });
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${found.back}?answered=1`);
}

/** "This was the job I described" (DECISIONS.md, 2026-11-20, third entry): the team decides the call-out from the photos. */
export async function objectNotDescribed(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const result = await ownerObjects(db, found.job.id, found.actor);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${found.back}?told=1`);
}

export async function reportProblem(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const result = await raiseDispute(db, found.job.id, found.actor, text(formData, "reason"));
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message, { reason: result.message });
  redirect(`${found.back}?told=1`);
}

/** The owner's chosen tradie suggested a later time: wait for them, or send it to another tradie now. Buttons only, never a link. */
export async function answerLater(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const proposalId = text(formData, "proposalId");
  const owned = await db.query("select 1 from public.arrival_proposals where id = $1::uuid and job_id = $2::uuid", [isUuid(proposalId) ? proposalId : null, found.job.id]);
  if (owned.length === 0) return { message: "We could not find that choice. It may already have been answered." };
  const result = await db.tx((tx) => answerLaterTime(tx, proposalId, text(formData, "answer") === "wait", found.actor));
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${found.back}?${result.waited ? "waiting" : "sent"}=1`);
}

/**
 * "Yes, it's fixed" on a flagged job (DECISIONS.md, 2026-11-19). A button on
 * the job page, never the link in the text. The job must be the owner's own.
 */
export async function confirmJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const result = await confirmFixed(db, found.job.id, found.job.ownerId, found.actor);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${found.back}?confirmed=1`);
}

/** "The tradie isn't here": the app says they arrived, the owner says they did not. Goes to the team straight away. */
export async function tradieNotHere(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await ownersJob(db, formData);
  if (!found) return { message: NOT_FOUND };
  const result = await reportTradieAbsent(db, found.job.id, found.actor);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${found.back}?absent=1`);
}

export async function saveAccount(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/account");
  const name = text(formData, "name");
  const phone = normalisePhone(text(formData, "phone"), "NZ");
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name.";
  if (!phone) errors.phone = "Enter your mobile number.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);
  try {
    await updateOwnerContact(await getDb(), viewer.ownerId, { name, phone: phone!.e164 });
  } catch {
    return problem(formData, "That mobile number is already used by another account.", { phone: "Already in use." });
  }
  revalidatePath("/app/account");
  return { done: "Saved." };
}

/** Sends the owner to the payment company's page to change their card. */
export async function changeCard(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/billing");
  const db = await getDb();
  const country = text(formData, "country") === "AU" ? "AU" : "NZ";
  const gateway = paymentsFor(db, country);
  const billing = await getBilling(db, viewer.ownerId, country);
  if (!gateway || !billing || billing.provider !== gateway.provider) return { message: "There is no card on file yet. It is added when you start a membership." };
  let url: string;
  try {
    url = await gateway.billingPortalUrl({ customerId: billing.customerId, ownerId: viewer.ownerId, returnUrl: `${baseUrl()}/app/billing` });
  } catch (error) {
    console.error("[billing] opening the card page failed:", error instanceof Error ? error.message : error);
    return { message: "The card page could not be opened just now. Please try again." };
  }
  redirect(url);
}

/**
 * "Add your bank account" (DECISIONS.md, 2026-11-23, second entry): opens the payment company's own page, where the
 * owner adds their NZ bank account and agrees the Direct Debit Authority. Nothing is taken. Used for work that takes a
 * job over NZ$1,000: half when they approve it, the rest at Job done.
 */
export async function addBankAccount(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/billing/bank");
  const db = await getDb();
  const jobId = text(formData, "job");
  const job = isUuid(jobId) ? await getJobForOwner(db, viewer.ownerId, jobId) : null;
  const market = await getMarket(db, job?.market ?? text(formData, "market"));
  if (!market || market.country !== "NZ") return { message: "Paying from a bank account is only for New Zealand properties for now." };
  const gateway = paymentsFor(db, market.country);
  const billing = await getBilling(db, viewer.ownerId, market.country);
  if (!gateway || !billing || billing.provider !== gateway.provider) return { message: "Add a card first: it is added when you cover your first property." };
  const back = job ? `${baseUrl()}/app/jobs/${job.id}` : `${baseUrl()}/app/billing`;
  let url: string;
  try {
    url = (await gateway.startBankSetup({
      customerId: billing.customerId, ownerId: viewer.ownerId, market,
      successUrl: `${baseUrl()}/app/billing/bank/return${job ? `?job=${job.id}` : ""}`, cancelUrl: back,
    })).url;
  } catch (error) {
    console.error("[billing] opening the bank account page failed:", error instanceof Error ? error.message : error);
    return { message: "The bank account page could not be opened just now. Please try again." };
  }
  redirect(url);
}

/** Photos that help a tradie find their way around: the lockbox, the switchboard, the water shut-off. */
export async function addPropertyPhotos(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, propertyId);
  if (!property) return { message: "We could not find that property." };
  const added = await attachUploads(db, list(formData, "uploadIds"), { kind: "property", uploadedBy: `owner:${viewer.ownerId}`, propertyId });
  if (added === 0) return { message: "Choose a photo first, then save." };
  revalidatePath(`/app/properties/${propertyId}`);
  return { done: added === 1 ? "Photo saved." : `${added} photos saved.` };
}

export async function removePropertyPhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const propertyId = text(formData, "propertyId");
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, propertyId);
  if (!property) return { message: "We could not find that property." };
  // Detached photos are cleared away by the nightly tidy-up.
  await db.query("update public.uploads set attached = false, property_id = null where id = $1::uuid and property_id = $2::uuid and kind = 'property'", [
    text(formData, "uploadId"),
    propertyId,
  ]);
  revalidatePath(`/app/properties/${propertyId}`);
  return { done: "Photo removed." };
}

/**
 * "Add many at once": every line pasted from a spreadsheet that has no
 * problems is saved, all in one step, each through the same path as adding
 * one property, so memberships and the audit log work as usual.
 */
export async function importProperties(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/properties/import");
  const pasted = text(formData, "rows");
  const { rows, tooMany } = parsePropertyRows(pasted);
  if (tooMany) return problem(formData, `That is more than ${IMPORT_MAX_ROWS} lines. Paste the first ${IMPORT_MAX_ROWS}, save them, then paste the rest.`);
  const good = rows.filter((row) => row.problems.length === 0);
  if (good.length === 0) return problem(formData, "There is nothing to save yet. Paste one property per line: name, street address, suburb, postcode, access notes.");

  const db = await getDb();
  const market = await getMarket(db, text(formData, "market"));
  if (!market || market.stage !== "live") return problem(formData, "We are not taking new properties in that area yet.");
  const tierId = text(formData, "tierId");
  if (!tierId) return problem(formData, "Choose a membership.");
  try {
    await db.tx(async (tx) => {
      const gateway = paymentsFor(tx, market.country);
      // Free to join (DECISIONS.md, 2026-11-17): with a card already on file each one is covered straight away,
      // exactly as pressing "Cover this property" would.
      const card = await getBilling(tx, viewer.ownerId, market.country);
      for (const row of good) {
        const created = await createProperty(tx, viewer.ownerId, {
          market: market.slug, name: row.name, addressLine1: row.addressLine1, suburb: row.suburb, postcode: row.postcode, accessNotes: row.accessNotes, tierId,
        }, gateway);
        if (created.status === "setup" && card?.paymentMethodId && gateway && card.provider === gateway.provider) {
          await activateFreeMembership(tx, { propertyId: created.id, ownerId: viewer.ownerId, provider: card.provider, customerId: card.customerId, card: null });
        }
      }
    });
  } catch (error) {
    if (error instanceof PropertyError) return problem(formData, `Nothing was saved. ${error.message}`);
    throw error;
  }
  // Each address is looked up for its map pin. A big paste is finished off by the timer, a few at a time.
  await fillMissingPins(db, geocoder(), 25);
  revalidatePath("/app/properties");
  redirect(`/app/properties?imported=${good.length}`);
}
