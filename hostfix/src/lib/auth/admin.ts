import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, readAdminSettings, verifyAdminToken, type AdminSettings } from "./admin-session";

/** The sign-in settings from the environment, or the reasons sign-in cannot work yet. */
export function adminSettings(): { settings: AdminSettings } | { problems: string[] } {
  return readAdminSettings(process.env);
}

export async function isAdminSignedIn(): Promise<boolean> {
  // Read the cookie FIRST, before any early return, so a page that calls this
  // is always worked out per visitor and never frozen at build time.
  const cookieStore = await cookies();
  const result = adminSettings();
  if (!("settings" in result)) return false;
  return verifyAdminToken(result.settings, cookieStore.get(ADMIN_COOKIE)?.value);
}

/**
 * Call at the top of every admin page, action and download. This check, not
 * the page layout, is what keeps the leads private.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSignedIn())) redirect("/admin");
}
