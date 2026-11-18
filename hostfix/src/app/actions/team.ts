"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendQueued } from "@/lib/after";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { list, problem, text, type FormState } from "@/lib/forms";
import { listMarkets } from "@/lib/markets/store";
import { normalisePhone } from "@/lib/phone";
import { listProperties } from "@/lib/properties/service";
import { addTeamMember, createGroup, deleteGroup, removeTeamMember, TeamError, updateGroup, updateTeamMember, type Dispatch } from "@/lib/team/service";

/**
 * THE OWNER'S TEAM AND GROUPS (DECISIONS.md, 2026-11-18). Each action works
 * out who is asking first, and everything after that carries the owner's id.
 */

function dispatchFrom(formData: FormData): Dispatch {
  return text(formData, "dispatch") === "ask" ? "ask" : "straight";
}

function teamProblem(formData: FormData, error: unknown): FormState {
  if (error instanceof TeamError) return problem(formData, error.message, error.field ? { [error.field]: error.message } : {});
  throw error;
}

export async function addTeamMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/team");
  const db = await getDb();
  // Read the mobile the way a local in the owner's area writes it.
  const properties = await listProperties(db, viewer.ownerId);
  const markets = await listMarkets(db);
  const country = markets.find((market) => market.slug === properties[0]?.market)?.country ?? "NZ";
  const name = text(formData, "name");
  const phone = normalisePhone(text(formData, "phone"), country);
  const errors: Record<string, string> = {};
  if (name.length < 1) errors.name = "Enter their name, as you would say it.";
  if (!phone) errors.phone = "Enter their mobile number. We text them their link.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);

  let added;
  try {
    added = await addTeamMember(db, viewer.ownerId, phone!.e164, {
      name, dispatch: dispatchFrom(formData), propertyIds: list(formData, "propertyIds"), groupIds: list(formData, "groupIds"),
    });
  } catch (error) {
    return teamProblem(formData, error);
  }
  await sendQueued(db);
  redirect(`/app/team/${added.member.id}?added=1`);
}

export async function saveTeamMember(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/team");
  const memberId = text(formData, "memberId");
  let saved;
  try {
    saved = await updateTeamMember(await getDb(), viewer.ownerId, memberId, {
      name: text(formData, "name"), dispatch: dispatchFrom(formData), propertyIds: list(formData, "propertyIds"), groupIds: list(formData, "groupIds"),
    });
  } catch (error) {
    return teamProblem(formData, error);
  }
  if (!saved) return { message: "We could not find that person on your team." };
  revalidatePath(`/app/team/${memberId}`);
  revalidatePath("/app/team");
  return { done: "Saved. Their list of houses has changed already." };
}

export async function removeTeamMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/team");
  const removed = await removeTeamMember(await getDb(), viewer.ownerId, text(formData, "memberId"));
  if (!removed) return { message: "We could not find that person on your team." };
  redirect("/app/team?removed=1");
}

export async function createGroupAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/team");
  let group;
  try {
    group = await createGroup(await getDb(), viewer.ownerId, { name: text(formData, "name"), propertyIds: list(formData, "propertyIds") });
  } catch (error) {
    return teamProblem(formData, error);
  }
  redirect(`/app/team/groups/${group.id}?added=1`);
}

export async function saveGroup(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/team");
  const groupId = text(formData, "groupId");
  let saved;
  try {
    saved = await updateGroup(await getDb(), viewer.ownerId, groupId, { name: text(formData, "name"), propertyIds: list(formData, "propertyIds") });
  } catch (error) {
    return teamProblem(formData, error);
  }
  if (!saved) return { message: "We could not find that group." };
  revalidatePath(`/app/team/groups/${groupId}`);
  revalidatePath("/app/team");
  return { done: "Saved. Everyone assigned to this group sees these houses now." };
}

export async function deleteGroupAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireOwner("/app/team");
  const deleted = await deleteGroup(await getDb(), viewer.ownerId, text(formData, "groupId"));
  if (!deleted) return { message: "We could not find that group." };
  redirect("/app/team?group_deleted=1");
}
