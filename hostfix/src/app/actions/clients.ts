"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendQueued } from "@/lib/after";
import { currentViewer, requireOwner, requireTradie } from "@/lib/auth/current";
import { normaliseEmail } from "@/lib/auth/users";
import { acceptClientInvite, acceptOwnTradieInvite, inviteClient, inviteOwnTradie } from "@/lib/clients/own-clients";
import { getDb } from "@/lib/db";
import { problem, text, type FormState } from "@/lib/forms";
import { normalisePhone } from "@/lib/phone";
import { getProperty } from "@/lib/properties/service";
import { getTradie } from "@/lib/tradies/service";
import { findTrade } from "@config/trades";

/**
 * OWN CLIENTS (DECISIONS.md, 2026-11-23): the invite links, from either side,
 * and the button on the link's page that makes the pair. Opening the link
 * changes nothing; only these buttons do.
 */

/** A tradie invites a client they already work for. */
export async function inviteMyClient(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireTradie("/tradie/profile", { whileWaiting: true });
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  if (!tradie) return { message: "We could not find your profile." };
  const typedPhone = text(formData, "clientPhone");
  const typedEmail = text(formData, "clientEmail");
  const phone = typedPhone ? normalisePhone(typedPhone, "NZ") : null;
  const email = typedEmail ? normaliseEmail(typedEmail) : null;
  const errors: Record<string, string> = {};
  if (typedPhone && !phone) errors.clientPhone = "That does not look like a mobile number.";
  if (typedEmail && !email) errors.clientEmail = "That does not look like an email address.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);
  const result = await inviteClient(db, { tradieId: tradie.id, businessName: tradie.businessName, name: text(formData, "clientName"), phone: phone?.e164 ?? null, email });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  revalidatePath("/tradie/profile");
  return { done: "Sent. Once they join and pick their property, jobs between you there are 5%." };
}

/** An owner brings their own tradie to one of their properties. */
export async function inviteMyTradie(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner();
  const db = await getDb();
  const property = await getProperty(db, viewer.ownerId, text(formData, "propertyId"));
  if (!property) return { message: "We could not find that property." };
  const phone = normalisePhone(text(formData, "tradiePhone"), "NZ");
  if (!phone) return problem(formData, "Enter your tradie's mobile number, so we can text them the link.", { tradiePhone: "Their mobile number." });
  const trade = findTrade(text(formData, "trade"))?.key ?? null;
  const result = await inviteOwnTradie(db, { ownerId: viewer.ownerId, ownerName: viewer.user.name, property, name: text(formData, "tradieName"), phone: phone.e164, trade });
  await sendQueued(db);
  if (!result.ok) return problem(formData, result.message);
  revalidatePath(`/app/properties/${property.id}`);
  return { done: "Sent. Once they sign up and are approved, they are your first choice here, and their jobs are booked and paid through HostFix." };
}

/** The owner presses the button on their tradie's invite, for one of their properties. */
export async function acceptAsOwner(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  const viewer = await currentViewer();
  if (!viewer?.ownerId) redirect(`/sign-in?next=${encodeURIComponent(`/i/${token}`)}`);
  const db = await getDb();
  const result = await acceptClientInvite(db, token, viewer.ownerId, text(formData, "propertyId"));
  if (!result.ok) return { message: result.message };
  redirect(`/app/properties/${result.pair.propertyId}?own=1`);
}

/** The tradie presses the button on an owner's invite. */
export async function acceptAsTradie(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  const viewer = await currentViewer();
  if (!viewer?.tradieId) redirect(`/sign-in?next=${encodeURIComponent(`/i/${token}`)}`);
  const db = await getDb();
  const result = await acceptOwnTradieInvite(db, token, viewer.tradieId);
  if (!result.ok) return { message: result.message };
  redirect("/tradie/profile?own=1");
}
