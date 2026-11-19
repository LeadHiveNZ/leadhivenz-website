"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { offerFromLink } from "@/lib/access/links";
import { sendQueued, settleNow } from "@/lib/after";
import { currentViewer, requireTradie } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { acceptOffer, passOffer, suggestLaterTime, windowsForAccepting } from "@/lib/dispatch/cascade";
import { baseUrl } from "@/lib/env";
import { getFileStore } from "@/lib/files/store";
import { checkFile } from "@/lib/files/uploads";
import { dollarsToCents, list, problem, text, ticked, type FormState } from "@/lib/forms";
import { isUuid } from "@/lib/ids";
import { getJobForStaff, getJobForTradie, getOffer } from "@/lib/jobs/store";
import type { Job, Offer } from "@/lib/jobs/types";
import { completeJob, markArrived, markEnRoute, reportHazard, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { addParts, attachReceipt } from "@/lib/jobs/parts";
import { getMarket } from "@/lib/markets/store";
import { now } from "@/lib/clock";
import { paymentsFor } from "@/lib/payments";
import { fileFromForm, saveInsuranceCertificate } from "@/lib/tradies/certificate";
import { agreeToAgreement, getTradie, saveLicence, savePayoutAccount, setTradiePaused, TradieError, updateTradie } from "@/lib/tradies/service";

/**
 * EVERYTHING A TRADIE CAN DO. A tradie is known either by the link in the
 * text we sent them (no sign-in needed) or by being signed in. Either way,
 * every lookup carries their id, so they can only touch their own jobs.
 */

type Who = { tradieId: string; job: Job; back: string };

async function whoAndJob(db: Db, formData: FormData): Promise<Who | null> {
  const code = text(formData, "code");
  if (code) {
    const offer = await offerFromLink(db, code);
    if (!offer || offer.status !== "accepted") return null;
    const job = await getJobForTradie(db, offer.tradieId, offer.jobId);
    return job ? { tradieId: offer.tradieId, job, back: `/o/${code}` } : null;
  }
  const viewer = await currentViewer();
  if (!viewer?.tradieId) return null;
  const jobId = text(formData, "jobId");
  const job = isUuid(jobId) ? await getJobForTradie(db, viewer.tradieId, jobId) : null;
  return job ? { tradieId: viewer.tradieId, job, back: `/tradie/jobs/${job.id}` } : null;
}

async function offerBeingAnswered(db: Db, formData: FormData): Promise<{ offer: Offer; code: string | null; via: "link" | "app" } | null> {
  const code = text(formData, "code");
  if (code) {
    const offer = await offerFromLink(db, code);
    return offer ? { offer, code, via: "link" } : null;
  }
  const viewer = await currentViewer();
  const offerId = text(formData, "offerId");
  if (!viewer?.tradieId || !isUuid(offerId)) return null;
  const offer = await getOffer(db, offerId);
  return offer && offer.tradieId === viewer.tradieId ? { offer, code: null, via: "app" } : null;
}

const NO_JOB = "We could not find that job. Open the link in your text again, or sign in.";
const NO_OFFER = "We could not find that offer. Open the link in your text again.";

export async function acceptJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await offerBeingAnswered(db, formData);
  if (!found) return { message: NO_OFFER };
  // A normal job: the tradie picks when they will be there (DECISIONS.md, 2026-11-18). An urgent one has its deadline.
  const windowEnd = text(formData, "window");
  // The offer is this tradie's own (checked above), so reading its job here shows them nothing new.
  const offered = await getJobForStaff(db, found.offer.jobId);
  const offeredMarket = offered ? await getMarket(db, offered.market) : null;
  if (offered && offeredMarket && !windowEnd && windowsForAccepting(offered, offeredMarket, now()).length > 0) {
    return { message: "Choose when you will be there, then the job is yours." };
  }
  const result = await db.tx((tx) => acceptOffer(tx, found.offer.id, found.via, undefined, { windowEnd: windowEnd || null }));
  await sendQueued(db);
  switch (result.result) {
    case "accepted":
    case "already_yours":
      redirect(found.code ? `/o/${found.code}?yours=1` : `/tradie/jobs/${result.job.id}?yours=1`);
    case "taken":
      return { message: "Another tradie took this job a moment ago." };
    case "gone":
      return { message: "This job is no longer available." };
    case "passed":
      return { message: "You passed on this one, so it went to someone else." };
    case "window_gone":
      return { message: "That time is no longer on the list. Choose another time." };
    case "not_eligible":
      return { message: "This job cannot be given to you right now. Check that your licence for this trade is on file and in date, and that you are not paused." };
    default:
      return { message: NO_OFFER };
  }
}

export async function passJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await offerBeingAnswered(db, formData);
  if (!found) return { message: NO_OFFER };
  await db.tx((tx) => passOffer(tx, found.offer.id, found.via));
  await sendQueued(db);
  redirect(found.code ? `/o/${found.code}?passed=1` : "/tradie?passed=1");
}

/** The owner's chosen tradie can't make the promised time and suggests a later one. Never counts against them. */
export async function suggestLater(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const found = await offerBeingAnswered(db, formData);
  if (!found) return { message: NO_OFFER };
  const windowEnd = text(formData, "laterWindow");
  if (!windowEnd) return problem(formData, "Choose the time you can come.", { laterWindow: "Choose the time you can come." });
  const result = await db.tx((tx) => suggestLaterTime(tx, found.offer.id, windowEnd, found.via));
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(found.code ? `/o/${found.code}?asked=1` : "/tradie?asked=1");
}

export async function onMyWay(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return { message: NO_JOB };
  const result = await markEnRoute(db, who.job.id, who.tradieId);
  if (!result.ok) return { message: result.message };
  revalidatePath(who.back);
  redirect(who.back);
}

/** The phone's location sent with a button press, if it gave one. */
function where(formData: FormData): { lat: number | null; lng: number | null } {
  const lat = Number(text(formData, "lat"));
  const lng = Number(text(formData, "lng"));
  return {
    lat: text(formData, "lat") !== "" && Number.isFinite(lat) ? lat : null,
    lng: text(formData, "lng") !== "" && Number.isFinite(lng) ? lng : null,
  };
}

export async function arrived(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return { message: NO_JOB };
  // At least one "before" photo, taken in the app (DECISIONS.md, 2026-11-19).
  const result = await markArrived(db, who.job.id, who.tradieId, { ...where(formData), uploadIds: list(formData, "beforeUploadIds") });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  redirect(`${who.back}?here=1`);
}

/** Reads the price of the work: hours at the fixed rate, or the tradie's own price (DECISIONS.md, 2026-11-20, third entry). */
function quotePrice(formData: FormData): { hours: number | null; labourCents: number | null; error: Record<string, string> | null } {
  const hoursText = text(formData, "hours");
  const labourText = text(formData, "labour");
  if (hoursText) {
    const hours = Number(hoursText);
    if (!Number.isFinite(hours) || hours <= 0) return { hours: null, labourCents: null, error: { hours: "Hours in quarter hours, for example 1.5." } };
    return { hours, labourCents: null, error: null };
  }
  const labourCents = labourText ? dollarsToCents(labourText) : null;
  if (labourCents === null || labourCents <= 0) return { hours: null, labourCents: null, error: { hours: "Enter the hours, or your price for work over NZ$1,000." } };
  return { hours: null, labourCents, error: null };
}

export async function sendQuote(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const price = quotePrice(formData);
  if (price.error) return problem(formData, "Please check the price.", price.error);
  const result = await submitQuote(db, who.job.id, who.tradieId, {
    description: text(formData, "quoteDescription"), hours: price.hours, labourCents: price.labourCents, uploadIds: list(formData, "quoteUploadIds"),
  });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  redirect(`${who.back}?quoted=${result.quote.needsApproval ? "wait" : "go"}`);
}

/** "Not the job described" on a menu job: a reason, photos and a quote (DECISIONS.md, 2026-11-20, third entry). */
export async function sendNotDescribed(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const price = quotePrice(formData);
  if (price.error) return problem(formData, "Please check the price.", price.error);
  const result = await submitQuote(db, who.job.id, who.tradieId, {
    description: text(formData, "quoteDescription"), hours: price.hours, labourCents: price.labourCents, uploadIds: list(formData, "quoteUploadIds"),
    notDescribed: { reason: text(formData, "notDescribedReason") },
  });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  redirect(`${who.back}?quoted=wait`);
}

/**
 * Parts, on any job (DECISIONS.md, 2026-11-20): from the price list (a
 * number for each) and, optionally, one off the list with its receipt.
 */
export async function addPartsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const errors: Record<string, string> = {};
  const listed: { itemId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty-") || typeof value !== "string" || value.trim() === "") continue;
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 50) errors[key] = "A whole number from 0 to 50.";
    else if (quantity > 0) listed.push({ itemId: key.slice(4), quantity });
  }
  const description = text(formData, "partDescription");
  const total = text(formData, "receiptTotal");
  const amount = text(formData, "partAmount");
  let offList = null;
  if (description !== "" || total !== "" || amount !== "") {
    const receiptTotalCents = dollarsToCents(total);
    const amountCents = dollarsToCents(amount);
    if (receiptTotalCents === null) errors.receiptTotal = "Enter the receipt's total, for example 64.90.";
    if (amountCents === null) errors.partAmount = "Enter how much of it is for this job, for example 45.";
    if (description.length < 3) errors.partDescription = "Say what the part is.";
    offList = { description, receiptTotalCents: receiptTotalCents ?? 0, amountCents: amountCents ?? 0, receiptDate: text(formData, "receiptDate") || null, uploadId: list(formData, "receiptUploadIds")[0] ?? null };
  }
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the parts.", errors);
  const result = await addParts(db, who.job.id, who.tradieId, { list: listed, offList });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  redirect(`${who.back}?parts=${result.needsApproval ? "wait" : "go"}`);
}

/** The receipt for an off-list part, added later: before Job done, or within 7 days after it. */
export async function addReceiptAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const uploadId = list(formData, "receiptUploadIds")[0];
  if (!uploadId) return problem(formData, "Add the receipt first: a photo, a screenshot or the PDF.");
  const result = await attachReceipt(db, who.job.id, who.tradieId, text(formData, "partId"), { uploadId, receiptDate: text(formData, "receiptDate") || null });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  revalidatePath(who.back);
  return { done: result.flags.length > 0 ? "Receipt added. Our team will look at it before your payment goes." : "Receipt added. Thank you." };
}

export async function finishJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const result = await completeJob(db, who.job.id, who.tradieId, {
    note: text(formData, "note"), uploadIds: list(formData, "uploadIds"), ...where(formData), receiptsToFollow: ticked(formData, "receiptsToFollow"),
  });
  if (!result.ok) return problem(formData, result.message);
  await settleNow(db, who.job.id);
  redirect(`${who.back}?done=1`);
}

export async function noAccess(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const result = await reportNoAccess(db, who.job.id, who.tradieId, { note: text(formData, "noAccessNote"), uploadIds: list(formData, "noAccessUploadIds"), ...where(formData) });
  if (!result.ok) return problem(formData, result.message);
  await settleNow(db, who.job.id);
  redirect(`${who.back}?done=1`);
}

// ---------------------------------------------------------------------------
// PROFILE (signed in only)
// ---------------------------------------------------------------------------

export async function saveTradieProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile", { whileWaiting: true });
  const insurance = text(formData, "insuranceExpiresOn");
  if (insurance !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(insurance)) return problem(formData, "Please check the insurance date.", { insuranceExpiresOn: "Choose a date." });
  const certificate = await fileFromForm(formData, "certificate");
  if (certificate) {
    const checked = checkFile("insurance_certificate", certificate.contentType, certificate.bytes);
    if (!checked.ok) return problem(formData, "Nothing was saved. Please check the certificate.", { certificate: checked.reason });
  }
  const db = await getDb();
  try {
    await updateTradie(db, viewer.tradieId, {
      businessName: text(formData, "businessName"),
      trades: list(formData, "trades"),
      daysAvailable: list(formData, "daysAvailable"),
      afterHours: ticked(formData, "afterHours"),
      gstRegistered: ticked(formData, "gstRegistered"),
      gstNumber: text(formData, "gstNumber") || null,
      insuranceExpiresOn: insurance || null,
      insurer: text(formData, "insurer") || null,
      insurancePolicyNumber: text(formData, "insurancePolicyNumber") || null,
      lbpNumber: text(formData, "lbpNumber") || null,
    }, `tradie:${viewer.tradieId}`);
  } catch (error) {
    if (error instanceof TradieError) return problem(formData, error.message);
    throw error;
  }
  revalidatePath("/tradie/profile");
  if (certificate) {
    const saved = await saveInsuranceCertificate(db, getFileStore(), { tradieId: viewer.tradieId }, {
      ...certificate, uploadedBy: `tradie:${viewer.tradieId}`, actor: `tradie:${viewer.tradieId}`,
    });
    if (!saved.ok) return { message: `Your details were saved, but the certificate was not. ${saved.reason}`, fieldErrors: { certificate: saved.reason } };
    return { done: "Saved, with your certificate." };
  }
  return { done: "Saved." };
}

export async function saveTradieLicence(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile", { whileWaiting: true });
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  const trade = text(formData, "trade");
  if (!tradie || !tradie.trades.includes(trade)) return problem(formData, "Add that trade to your profile first.");
  try {
    await saveLicence(db, viewer.tradieId, { trade, licenceNumber: text(formData, `licenceNumber-${trade}`), expiresOn: text(formData, `expiresOn-${trade}`) }, `tradie:${viewer.tradieId}`);
  } catch (error) {
    if (error instanceof TradieError) return problem(formData, error.message);
    throw error;
  }
  revalidatePath("/tradie/profile");
  return { done: "Saved. A person on our team will check it against the public register." };
}

/** "I have read it and I agree" to the tradie agreement in force (DECISIONS.md, 2026-11-20). */
export async function agreeAction(_previous: FormState, _formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile", { whileWaiting: true });
  await agreeToAgreement(await getDb(), viewer.tradieId);
  revalidatePath("/tradie", "layout");
  return { done: "Thank you. Your agreement is recorded." };
}

/** A hazard the tradie found at the property: saved to the property for the next tradie, and the owner told. */
export async function reportHazardAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const result = await reportHazard(db, who.job.id, who.tradieId, text(formData, "hazard"));
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  revalidatePath(who.back);
  return { done: "Thanks. It is on the property for the next tradie, and the owner has been told." };
}

export async function setPaused(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile");
  const pause = text(formData, "pause") === "yes";
  await setTradiePaused(await getDb(), viewer.tradieId, pause);
  revalidatePath("/tradie", "layout");
  return { done: pause ? "Paused. You will not be offered jobs until you switch back on." : "You are back on. Offers will come to you again." };
}

/** Sends the tradie to the payment company's page to enter their bank details. */
export async function setUpPayouts(_previous: FormState, _formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile", { whileWaiting: true });
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  const market = tradie ? await getMarket(db, tradie.market) : null;
  const gateway = market ? paymentsFor(db, market.country) : null;
  if (!tradie || !gateway) return { message: "Payouts are not switched on yet. We will text you when they are." };

  let url: string;
  try {
    let accountId = tradie.payoutProvider === gateway.provider ? tradie.payoutAccountId : null;
    if (!accountId) {
      const created = await gateway.createPayoutAccount({ tradieId: tradie.id, businessName: tradie.businessName, email: tradie.email });
      accountId = created.accountId;
      await savePayoutAccount(db, tradie.id, { provider: gateway.provider, accountId, payoutsEnabled: false });
    }
    url = await gateway.payoutOnboardingUrl({
      accountId, tradieId: tradie.id, returnUrl: `${baseUrl()}/tradie/payouts/return`, refreshUrl: `${baseUrl()}/tradie/profile?payouts=again`,
    });
  } catch (error) {
    console.error("[payouts] starting bank details set-up failed:", error instanceof Error ? error.message : error);
    return { message: "The bank details page could not be opened just now. Please try again." };
  }
  redirect(url);
}

/** Opens the tradie's own page at the payment company, where they can change their bank account. */
export async function openPayoutAccount(_previous: FormState, _formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/pay");
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  const market = tradie ? await getMarket(db, tradie.market) : null;
  const gateway = market ? paymentsFor(db, market.country) : null;
  if (!tradie?.payoutAccountId || !gateway || gateway.provider !== tradie.payoutProvider) return { message: "Your bank details are not set up yet." };
  let url: string | null;
  try {
    url = await gateway.payoutDashboardUrl(tradie.payoutAccountId);
  } catch (error) {
    console.error("[payouts] opening the payout account failed:", error instanceof Error ? error.message : error);
    return { message: "That page could not be opened just now. Please try again." };
  }
  if (!url) return { message: "There is nothing to change here in demo mode." };
  redirect(url);
}
