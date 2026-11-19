"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gatewayFor, sendQueued, settleNow } from "@/lib/after";
import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/current";
import { AccountExistsError } from "@/lib/auth/users";
import { addGoodwillCredit, chargeJob, resolveDispute, retryPayout } from "@/lib/billing/settle";
import { decideChargebackFault } from "@/lib/billing/chargebacks";
import { staffDecideNotDescribed } from "@/lib/jobs/not-described";
import { getDb } from "@/lib/db";
import { assignTradie, reoffer } from "@/lib/dispatch/cascade";
import { baseUrl } from "@/lib/env";
import { dollarsToCents, list, problem, text, ticked, type FormState } from "@/lib/forms";
import { approveGuestReport, cancelJob, createJob } from "@/lib/jobs/create";
import { getQuote } from "@/lib/jobs/store";
import { decideQuote } from "@/lib/jobs/work";
import { staffDecideCheck } from "@/lib/jobs/confirm";
import { guestFromForm } from "@/lib/jobs/guest-form";
import { chargeBoughtParts, staffDecideReceipts } from "@/lib/jobs/parts";
import { getMarket } from "@/lib/markets/store";
import { setOwnerAccess } from "@/lib/owners/service";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { resolveException } from "@/lib/ops/exceptions";
import { normalisePhone } from "@/lib/phone";
import { getPropertyForStaff } from "@/lib/properties/service";
import {
  createTradie, getTradie, markLicenceVerified, saveLicence, setSlot, setTradieStatus, swapSlots, TradieError, updateTradie, type TradieStatus,
} from "@/lib/tradies/service";
import { isUuid } from "@/lib/uuid";
import { getFileStore } from "@/lib/files/store";
import { fileFromForm, saveInsuranceCertificate } from "@/lib/tradies/certificate";

/**
 * WHAT THE DISPATCHER AND ADMIN CAN DO to jobs, tradies and owners. Every
 * action checks the person is staff first, and writes who did it to the
 * audit log.
 */

const jobPath = (id: string) => `/admin/jobs/${id}`;

// ---------------------------------------------------------------------------
// THE QUEUE
// ---------------------------------------------------------------------------

export async function resolveItem(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const done = await resolveException(await getDb(), text(formData, "exceptionId"), staff.actor, text(formData, "note") || null);
  revalidatePath("/admin/queue");
  return done ? { done: "Marked as dealt with." } : { message: "That item was already dealt with." };
}

/**
 * A flagged job the owner did not answer about (DECISIONS.md, 2026-11-19):
 * one tap to pay the tradie, or to keep holding the payment. From the queue
 * or the job page.
 */
export async function staffCheckJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const approve = text(formData, "decision") === "approve";
  const db = await getDb();
  const result = await staffDecideCheck(db, jobId, approve, staff.actor, text(formData, "note"));
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  revalidatePath("/admin/queue");
  revalidatePath(jobPath(jobId));
  return { done: approve ? "Approved. The tradie's payment is on its way." : "Held. The tradie has been told their payment is on hold while we check." };
}

/** A flagged parts receipt (DECISIONS.md, 2026-11-20): one tap to pay the tradie, or to keep holding the payment. */
export async function staffCheckReceipt(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const approve = text(formData, "decision") === "approve";
  const db = await getDb();
  const result = await staffDecideReceipts(db, jobId, approve, staff.actor, text(formData, "note"));
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  revalidatePath("/admin/queue");
  revalidatePath(jobPath(jobId));
  return { done: approve ? "Receipt approved. The tradie's payment goes as soon as nothing else holds it." : "Held. The tradie has been told their payment is on hold while we check." };
}

/**
 * A job cancelled after the owner approved work: parts already bought that
 * cannot go back are charged at the receipt's cost, nothing added, all to the
 * tradie (DECISIONS.md, 2026-11-20).
 */
export async function staffChargeBoughtParts(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const amountCents = dollarsToCents(text(formData, "boughtAmount"));
  if (amountCents === null || amountCents <= 0) return problem(formData, "Enter the receipt cost.", { boughtAmount: "Enter the receipt cost, for example 86.50." });
  const db = await getDb();
  const result = await chargeBoughtParts(db, jobId, { description: text(formData, "boughtDescription"), amountCents }, staff.actor);
  if (!result.ok) return problem(formData, result.message);
  await settleNow(db, jobId);
  redirect(`${jobPath(jobId)}?did=parts_charged`);
}

// ---------------------------------------------------------------------------
// JOBS
// ---------------------------------------------------------------------------

/** The dispatcher has rung a tradie and they said yes: give them the job. */
export async function staffAssign(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const tradieId = text(formData, "tradieId");
  if (!isUuid(tradieId)) return problem(formData, "Choose a tradie.");
  const db = await getDb();
  const result = await db.tx((tx) => assignTradie(tx, jobId, tradieId, staff.actor));
  await sendQueued(db);
  switch (result.result) {
    case "accepted":
    case "already_yours":
      redirect(`${jobPath(jobId)}?did=assigned`);
    case "not_eligible":
      return { message: "That tradie cannot be given this job. Check they are approved, do this trade, and have a current licence if the job needs one." };
    case "taken":
      return { message: "This job already has a tradie." };
    default:
      return { message: "This job is not waiting for a tradie any more." };
  }
}

/** The owner said yes by phone to a guest's report: send it out for them. */
export async function staffGoAhead(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const db = await getDb();
  const approved = await approveGuestReport(db, jobId, { urgent: text(formData, "how") === "urgent" }, `${staff.actor} for the owner`);
  await sendQueued(db);
  if (!approved.ok) return { message: approved.message };
  redirect(`${jobPath(jobId)}?did=sent_out`);
}

export async function staffReoffer(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const db = await getDb();
  const outcome = await db.tx((tx) => reoffer(tx, jobId, staff.actor));
  await sendQueued(db);
  revalidatePath(jobPath(jobId));
  if (outcome === "not_offering") return { message: "This job is not waiting for a tradie any more." };
  return outcome === "unfilled" ? { message: "There is still nobody who can be offered this job. Ring a tradie and assign them, or add another tradie to this trade." } : { done: "Offers have gone out again, starting with the first choice." };
}

export async function staffCancel(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const reason = text(formData, "cancelReason");
  if (reason.length < 3) return problem(formData, "Say why it is being cancelled.", { cancelReason: "A few words for the record." });
  const db = await getDb();
  const result = await cancelJob(db, jobId, { actor: staff.actor, staff: true }, reason);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${jobPath(jobId)}?did=cancelled`);
}

/** Answers a quote for an owner who said yes or no by phone. */
export async function staffQuote(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const db = await getDb();
  const quote = await getQuote(db, text(formData, "quoteId"));
  if (!quote) return { message: "We could not find that quote." };
  const result = await decideQuote(db, quote.id, text(formData, "answer") === "yes", `${staff.actor} for the owner`);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${jobPath(quote.jobId)}?did=quote_answered`);
}

export async function staffResolveDispute(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const outcome = text(formData, "outcome");
  const note = text(formData, "disputeNote");
  if (note.length < 3) return problem(formData, "Write a line on what was decided and why. The owner sees it.", { disputeNote: "Needed." });
  const db = await getDb();
  let result;
  if (outcome === "refund") {
    const cents = dollarsToCents(text(formData, "refund"));
    if (cents === null || cents <= 0) return problem(formData, "Enter how much to refund.", { refund: "An amount, for example 80." });
    result = await resolveDispute(db, gatewayFor(db), text(formData, "disputeId"), { outcome: "refund", refundCents: cents }, note, staff.actor);
  } else if (outcome === "pay_tradie") {
    result = await resolveDispute(db, gatewayFor(db), text(formData, "disputeId"), { outcome: "pay_tradie" }, note, staff.actor);
  } else {
    return problem(formData, "Choose what to do.");
  }
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  redirect(`${jobPath(jobId)}?did=${outcome === "refund" ? "refunded" : "work_stands"}`);
}

export async function staffRetryPayout(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const db = await getDb();
  const outcome = await retryPayout(db, gatewayFor(db), jobId, staff.actor);
  await sendQueued(db);
  if (outcome === "sent") redirect(`${jobPath(jobId)}?did=tradie_paid`);
  revalidatePath(jobPath(jobId));
  if (outcome === "skipped") return { message: "There is no failed payment to try again on this job." };
  return { message: "It still could not be sent. Check the tradie's bank details are set up, then try again." };
}

export async function staffRetryCharge(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const jobId = text(formData, "jobId");
  const db = await getDb();
  const outcome = await chargeJob(db, gatewayFor(db), jobId, { force: true });
  await sendQueued(db);
  if (outcome === "succeeded") redirect(`${jobPath(jobId)}?did=charged`);
  revalidatePath(jobPath(jobId));
  if (outcome === "skipped") return { message: "There is nothing to charge on this job right now." };
  return { message: "The card was declined again. Ask the owner to update their card (Billing in their app), then try again." };
}

/** One tap on a lost chargeback: the tradie's fault (bad work, a no-show) or not (DECISIONS.md, 2026-11-20). */
export async function staffChargebackFault(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const fault = text(formData, "fault");
  if (fault !== "tradie" && fault !== "not_tradie") return { message: "Choose whose fault it was." };
  const db = await getDb();
  const result = await decideChargebackFault(db, text(formData, "chargebackId"), fault, staff.actor);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${jobPath(jobId)}?did=${fault === "tradie" ? "chargeback_tradie" : "chargeback_us"}`);
}

/** Remove an owner's access, or give it back (owner terms, section 8). */
export async function staffOwnerAccess(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const ownerId = text(formData, "ownerId");
  const allowed = text(formData, "allowed") === "yes";
  const result = await setOwnerAccess(await getDb(), ownerId, allowed, text(formData, "reason") || "Given back by the team", staff.actor);
  if (!result.ok) return problem(formData, result.message);
  revalidatePath(`/admin/owners/${ownerId}`);
  return { done: allowed ? "Access given back." : "Access removed." };
}

/** One tap on "not the job described" the owner objected to: Pay call-out or No call-out (DECISIONS.md, 2026-11-20, third entry). */
export async function staffNotDescribed(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const jobId = text(formData, "jobId");
  const db = await getDb();
  const result = await staffDecideNotDescribed(db, jobId, text(formData, "decision") === "pay", staff.actor);
  await sendQueued(db);
  if (!result.ok) return { message: result.message };
  redirect(`${jobPath(jobId)}?did=${text(formData, "decision") === "pay" ? "callout_paid" : "no_callout"}`);
}

export async function staffGoodwill(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const cents = dollarsToCents(text(formData, "creditAmount"));
  if (cents === null || cents <= 0) return problem(formData, "Enter the amount of the credit.", { creditAmount: "An amount, for example 50." });
  const note = text(formData, "creditNote");
  if (note.length < 3) return problem(formData, "Say what the credit is for.", { creditNote: "Needed for the record." });
  const db = await getDb();
  const result = await addGoodwillCredit(db, gatewayFor(db), { propertyId: text(formData, "propertyId"), amountCents: cents, note }, staff.actor);
  if (!result.ok) return problem(formData, result.message);
  const back = text(formData, "back");
  if (back.startsWith("/admin/")) revalidatePath(back);
  return { done: "Credit added. It comes off the owner's next membership payment." };
}

/** Logs a job for an owner who phoned it in. */
export async function staffLogJob(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const db = await getDb();
  const property = await getPropertyForStaff(db, text(formData, "propertyId"));
  if (!property) return problem(formData, "We could not find that property.");
  const choice = text(formData, "menuItemId");
  if (!choice) return problem(formData, "Choose what needs fixing.");
  const guest = guestFromForm(formData, "NZ");
  if (!guest.ok) return problem(formData, guest.message, { guestPhone: guest.message });
  const result = await createJob(db, {
    ...guest.guest,
    property, reportedBy: "staff", reporterName: staff.name, reporterPhone: null,
    menuItemId: choice === "off-menu" ? null : choice, offMenuTrade: text(formData, "offMenuTrade"), offMenuTitle: text(formData, "offMenuTitle"),
    description: text(formData, "description"), urgent: ticked(formData, "urgent"), uploadIds: list(formData, "uploadIds"),
    uploader: staff.actor, actor: staff.actor,
  });
  await sendQueued(db);
  if (!result.ok) {
    if (result.reason === "duplicate" && result.existingJobId) redirect(jobPath(result.existingJobId));
    return problem(formData, result.message);
  }
  redirect(jobPath(result.job.id));
}

// ---------------------------------------------------------------------------
// TRADIES
// ---------------------------------------------------------------------------

export async function addTradie(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const db = await getDb();
  const market = await getMarket(db, text(formData, "market"));
  if (!market) return problem(formData, "Choose a market.");
  const name = text(formData, "name");
  const phone = normalisePhone(text(formData, "phone"), market.country);
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter their name.";
  if (!phone) errors.phone = "Enter their mobile number. Offers are sent to it by text.";
  if (list(formData, "trades").length === 0) errors.trades = "Choose at least one trade.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);

  let tradieId: string;
  try {
    const created = await createTradie(db, {
      name, phone: phone!.e164, email: text(formData, "email").toLowerCase() || null, market: market.slug,
      businessName: text(formData, "businessName") || name, trades: list(formData, "trades"),
      daysAvailable: list(formData, "daysAvailable"), afterHours: ticked(formData, "afterHours"), gstRegistered: ticked(formData, "gstRegistered"),
      licences: [], leadId: isUuid(text(formData, "leadId")) ? text(formData, "leadId") : null,
    });
    tradieId = created.tradieId;
  } catch (error) {
    if (error instanceof TradieError) return problem(formData, error.message);
    if (error instanceof AccountExistsError) return problem(formData, "Someone with that mobile or email already has an account. Find them in the tradie list, or use a different number.", { phone: "Already in use." });
    throw error;
  }
  await audit(db, { actor: staff.actor, action: "tradie.added_by_staff", entity: "tradie", entityId: tradieId, detail: { market: market.slug } });
  redirect(`/admin/tradies/${tradieId}?added=1`);
}

export async function staffSetTradieStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const tradieId = text(formData, "tradieId");
  const status = text(formData, "status") as TradieStatus;
  if (!["approved", "paused", "removed", "applied"].includes(status)) return { message: "Choose what to do." };
  const db = await getDb();
  const before = await getTradie(db, tradieId);
  if (!before) return { message: "We could not find that tradie." };
  let tradie;
  try {
    tradie = await setTradieStatus(db, tradieId, status, staff.actor);
  } catch (error) {
    // Approving needs current public liability insurance on file. The message says what is missing.
    if (error instanceof TradieError) return { message: error.message };
    throw error;
  }
  if (tradie && status === "approved" && before.status === "applied" && tradie.phone) {
    const market = await getMarket(db, tradie.market);
    await enqueue(db, {
      channel: "sms", to: tradie.phone, template: "tradie_approved", audience: "tradie", userId: tradie.userId,
      body: texts.tradieApproved({ market: market?.name ?? tradie.market, link: `${baseUrl()}/sign-in?next=/tradie/profile` }),
      dedupeKey: `tradie_approved:${tradie.id}`,
    });
    await sendQueued(db);
  }
  revalidatePath("/admin/tradies");
  redirect(`/admin/tradies/${tradieId}?did=${status === "approved" ? (before.status === "applied" ? "approved" : "back_on") : status}`);
}

/** Texts a tradie the link to sign in and finish their profile. */
export async function inviteTradie(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const db = await getDb();
  const tradie = await getTradie(db, text(formData, "tradieId"));
  if (!tradie?.phone) return { message: "This tradie has no mobile number on file." };
  await enqueue(db, {
    channel: "sms", to: tradie.phone, template: "tradie_invite", audience: "tradie", userId: tradie.userId,
    body: texts.tradieInvite({ name: tradie.name.split(" ")[0] ?? tradie.name, link: `${baseUrl()}/sign-in?next=/tradie/profile` }),
  });
  await sendQueued(db);
  return { done: "Texted. They sign in with their mobile number and a code." };
}

export async function staffSaveTradie(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const tradieId = text(formData, "tradieId");
  const insurance = text(formData, "insuranceExpiresOn");
  const db = await getDb();
  try {
    const saved = await updateTradie(db, tradieId, {
      businessName: text(formData, "businessName"), trades: list(formData, "trades"), daysAvailable: list(formData, "daysAvailable"),
      afterHours: ticked(formData, "afterHours"), gstRegistered: ticked(formData, "gstRegistered"), gstNumber: text(formData, "gstNumber") || null,
      insuranceExpiresOn: /^\d{4}-\d{2}-\d{2}$/.test(insurance) ? insurance : null,
      insurer: text(formData, "insurer") || null,
      insurancePolicyNumber: text(formData, "insurancePolicyNumber") || null,
      lbpNumber: text(formData, "lbpNumber") || null,
    }, staff.actor);
    if (!saved) return { message: "We could not find that tradie." };
  } catch (error) {
    if (error instanceof TradieError) return problem(formData, error.message);
    throw error;
  }
  await db.query("update public.tradies set notes = $2 where id = $1::uuid", [tradieId, text(formData, "notes").slice(0, 2000)]);
  revalidatePath(`/admin/tradies/${tradieId}`);
  return { done: "Saved." };
}

/** Staff add a tradie's public liability certificate for them, for example one they emailed in. */
export async function staffUploadCertificate(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const tradieId = text(formData, "tradieId");
  const db = await getDb();
  if (!(await getTradie(db, tradieId))) return { message: "We could not find that tradie." };
  const certificate = await fileFromForm(formData, "certificate");
  if (!certificate) return { message: "Choose the certificate file first.", fieldErrors: { certificate: "Choose a PDF, JPG or PNG." } };
  const saved = await saveInsuranceCertificate(db, getFileStore(), { tradieId }, { ...certificate, uploadedBy: staff.actor, actor: staff.actor });
  if (!saved.ok) return { message: saved.reason, fieldErrors: { certificate: saved.reason } };
  revalidatePath(`/admin/tradies/${tradieId}`);
  return { done: "Certificate added. Open it and check the insurer, policy number and expiry match what is typed in." };
}

export async function staffSaveLicence(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const tradieId = text(formData, "tradieId");
  const trade = text(formData, "trade");
  try {
    await saveLicence(await getDb(), tradieId, { trade, licenceNumber: text(formData, `licenceNumber-${trade}`), expiresOn: text(formData, `expiresOn-${trade}`) }, staff.actor);
  } catch (error) {
    if (error instanceof TradieError) return problem(formData, error.message);
    throw error;
  }
  revalidatePath(`/admin/tradies/${tradieId}`);
  return { done: "Licence saved. Check it against the public register, then mark it as checked." };
}

export async function verifyLicence(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  await markLicenceVerified(await getDb(), text(formData, "licenceId"), staff.actor);
  revalidatePath(`/admin/tradies/${text(formData, "tradieId")}`);
  return { done: "Marked as checked against the register." };
}

export async function staffSetSlot(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const rank = text(formData, "rank") === "2" ? 2 : 1;
  const tradieId = text(formData, "tradieId");
  try {
    await setSlot(await getDb(), { market: text(formData, "market"), trade: text(formData, "trade"), rank, tradieId: isUuid(tradieId) ? tradieId : null }, staff.actor);
  } catch (error) {
    if (error instanceof TradieError) return { message: error.message };
    throw error;
  }
  revalidatePath("/admin/tradies");
  return { done: isUuid(tradieId) ? `Saved as ${rank === 1 ? "first choice" : "backup"}.` : "Slot emptied." };
}

export async function staffSwapSlots(_previous: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const swapped = await swapSlots(await getDb(), text(formData, "market"), text(formData, "trade"), staff.actor);
  revalidatePath("/admin/tradies");
  return swapped ? { done: "Swapped. The backup is now first choice." } : { message: "There needs to be both a first choice and a backup to swap." };
}
