import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { isAdminSignedIn } from "./admin";
import { findSession, SESSION_COOKIE, SESSION_DAYS } from "./sessions";
import type { StaffRole, Viewer } from "./users";

/**
 * WHO IS LOOKING AT THIS PAGE.
 *
 * Every private page, action and download starts with one of the require...
 * functions below. They are the lock. The proxy that runs before a page only
 * tidies up where people land.
 *
 * Each one reads the cookie FIRST, before anything else, so the page is always
 * worked out per visitor and never frozen at build time.
 */

export async function currentViewer(): Promise<Viewer | null> {
  // Wait for a real visit. A private page is never prepared ahead of time, not even partly.
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await findSession(await getDb(), token);
  } catch {
    return null;
  }
}

function signInPath(next: string): string {
  return `/sign-in?next=${encodeURIComponent(next)}`;
}

export type OwnerViewer = Viewer & { ownerId: string };
export type TradieViewer = Viewer & { tradieId: string };

/** The signed-in owner, or a redirect to sign in. `next` is where to come back to. */
export async function requireOwner(next: string = "/app"): Promise<OwnerViewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect(signInPath(next));
  if (!viewer.ownerId) redirect("/start");
  return viewer as OwnerViewer;
}

/**
 * The signed-in tradie, or a redirect to sign in.
 *
 * A tradie still waiting for approval ("applied") has their own account but
 * may only use their profile: insurance, certificate, licences and bank
 * details. Every other tradie page sends them back to it. Only the profile
 * page and its actions pass `whileWaiting: true`.
 */
export async function requireTradie(next: string = "/tradie", options: { whileWaiting?: boolean } = {}): Promise<TradieViewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect(signInPath(next));
  if (!viewer.tradieId) redirect("/start");
  if (!options.whileWaiting) {
    const rows = await (await getDb()).query<{ status: string }>("select status from public.tradies where id = $1::uuid", [viewer.tradieId]);
    if (rows[0]?.status === "applied") redirect("/tradie/profile");
  }
  return viewer as TradieViewer;
}

export type StaffViewer = {
  role: StaffRole;
  /** What is written in the audit log for things this person does. */
  actor: string;
  name: string;
  viewer: Viewer | null;
};

/** Staff, by their own sign-in or by the founder's admin password. Null if neither. */
export async function currentStaff(): Promise<StaffViewer | null> {
  await connection();
  // The admin password check reads its cookie first, which also marks the page as per-visitor.
  if (await isAdminSignedIn()) return { role: "admin", actor: "admin", name: "Admin", viewer: null };
  const viewer = await currentViewer();
  if (viewer?.staffRole) return { role: viewer.staffRole, actor: `staff:${viewer.user.id}`, name: viewer.user.name, viewer };
  return null;
}

/** Staff of any kind (dispatcher or admin), or a redirect to the admin sign-in page. */
export async function requireStaff(): Promise<StaffViewer> {
  const staff = await currentStaff();
  if (!staff) redirect("/admin");
  return staff;
}

/** An admin only. A dispatcher is sent back to their queue. */
export async function requireAdminRole(): Promise<StaffViewer> {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/admin/queue");
  return staff;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: baseUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** Only ever send people to a page on this site after signing in. */
export function safeNext(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.length > 300) return fallback;
  return value;
}

/** Where someone belongs after signing in, from what they are. */
export function homeFor(viewer: Viewer): string {
  if (viewer.staffRole) return "/admin/queue";
  if (viewer.tradieId && !viewer.ownerId) return "/tradie";
  if (viewer.ownerId) return "/app";
  return "/start";
}
