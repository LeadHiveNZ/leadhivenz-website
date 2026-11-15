"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { offerFromLink } from "@/lib/access/links";
import { sendQueued, settleNow } from "@/lib/after";
import { currentViewer, requireTradie } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { acceptOffer, passOffer } from "@/lib/dispatch/cascade";
import { baseUrl } from "@/lib/env";
import { dollarsToCents, list, problem, text, ticked, type FormState } from "@/lib/forms";
import { isUuid } from "@/lib/ids";
import { getJobForTradie, getOffer } from "@/lib/jobs/store";
import type { Job, Offer } from "@/lib/jobs/types";
import { completeJob, markArrived, markEnRoute, reportNoAccess, submitQuote } from "@/lib/jobs/work";
import { getMarket } from "@/lib/markets/store";
import { paymentsFor } from "@/lib/payments";
import { getTradie, saveLicence, savePayoutAccount, setTradiePaused, TradieError, updateTradie } from "@/lib/tradies/service";

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
  const result = await db.tx((tx) => acceptOffer(tx, found.offer.id, found.via));
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

export async function onMyWay(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return { message: NO_JOB };
  const result = await markEnRoute(db, who.job.id, who.tradieId);
  if (!result.ok) return { message: result.message };
  revalidatePath(who.back);
  redirect(who.back);
}

export async function arrived(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return { message: NO_JOB };
  const lat = Number(text(formData, "lat"));
  const lng = Number(text(formData, "lng"));
  const result = await markArrived(db, who.job.id, who.tradieId, {
    lat: text(formData, "lat") !== "" && Number.isFinite(lat) ? lat : null,
    lng: text(formData, "lng") !== "" && Number.isFinite(lng) ? lng : null,
  });
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${who.back}?here=1`);
}

export async function sendQuote(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const labour = text(formData, "labour");
  const parts = text(formData, "parts");
  const labourCents = labour === "" ? 0 : dollarsToCents(labour);
  const partsCents = parts === "" ? 0 : dollarsToCents(parts);
  const errors: Record<string, string> = {};
  if (labourCents === null) errors.labour = "Enter an amount, for example 180.";
  if (partsCents === null) errors.parts = "Enter an amount, for example 45.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the amounts.", errors);
  const result = await submitQuote(db, who.job.id, who.tradieId, {
    description: text(formData, "quoteDescription"), labourCents: labourCents!, partsCents: partsCents!, uploadIds: list(formData, "quoteUploadIds"),
  });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  redirect(`${who.back}?quoted=${result.quote.needsApproval ? "wait" : "go"}`);
}

export async function finishJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const result = await completeJob(db, who.job.id, who.tradieId, { note: text(formData, "note"), uploadIds: list(formData, "uploadIds") });
  if (!result.ok) return problem(formData, result.message);
  await settleNow(db, who.job.id);
  redirect(`${who.back}?done=1`);
}

export async function noAccess(_previous: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const who = await whoAndJob(db, formData);
  if (!who) return problem(formData, NO_JOB);
  const result = await reportNoAccess(db, who.job.id, who.tradieId, { note: text(formData, "noAccessNote"), uploadIds: list(formData, "noAccessUploadIds") });
  if (!result.ok) return problem(formData, result.message);
  await settleNow(db, who.job.id);
  redirect(`${who.back}?done=1`);
}

// ---------------------------------------------------------------------------
// PROFILE (signed in only)
// ---------------------------------------------------------------------------

export async function saveTradieProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile");
  const insurance = text(formData, "insuranceExpiresOn");
  if (insurance !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(insurance)) return problem(formData, "Please check the insurance date.", { insuranceExpiresOn: "Choose a date." });
  try {
    await updateTradie(await getDb(), viewer.tradieId, {
      businessName: text(formData, "businessName"),
      trades: list(formData, "trades"),
      daysAvailable: list(formData, "daysAvailable"),
      afterHours: ticked(formData, "afterHours"),
      gstRegistered: ticked(formData, "gstRegistered"),
      gstNumber: text(formData, "gstNumber") || null,
      insuranceExpiresOn: insurance || null,
    }, `tradie:${viewer.tradieId}`);
  } catch (error) {
    if (error instanceof TradieError) return problem(formData, error.message);
    throw error;
  }
  revalidatePath("/tradie/profile");
  return { done: "Saved." };
}

export async function saveTradieLicence(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile");
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

export async function setPaused(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile");
  const pause = text(formData, "pause") === "yes";
  await setTradiePaused(await getDb(), viewer.tradieId, pause);
  revalidatePath("/tradie", "layout");
  return { done: pause ? "Paused. You will not be offered jobs until you switch back on." : "You are back on. Offers will come to you again." };
}

/** Sends the tradie to the payment company's page to enter their bank details. */
export async function setUpPayouts(_previous: FormState, _formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile");
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
