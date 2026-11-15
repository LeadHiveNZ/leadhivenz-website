"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminSettings, requireAdmin } from "@/lib/auth/admin";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminToken, passwordMatches } from "@/lib/auth/admin-session";
import { baseUrl } from "@/lib/env";
import { sendAlert, testAlertContent, type ChannelOutcome } from "@/lib/notify/alerts";
import { withinRateLimit } from "@/lib/rate-limit";
import { ipKey } from "@/lib/request";
import { getStore } from "@/lib/store";

export type SignInState = { message?: string };

const SIGN_IN_ATTEMPTS = 8;
const SIGN_IN_WINDOW_SECONDS = 15 * 60;

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const result = adminSettings();
  if (!("settings" in result)) {
    return { message: "Sign-in is not set up yet. See the note above." };
  }

  const headerList = await headers();
  const visitor = ipKey(headerList) ?? "unknown";
  if (!(await withinRateLimit(`signin:${visitor}`, SIGN_IN_WINDOW_SECONDS, SIGN_IN_ATTEMPTS))) {
    return { message: "Too many tries. Please wait 15 minutes and try again." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(result.settings, password)) {
    // The same pause for every wrong guess makes guessing slow.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { message: "That password isn't right." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createAdminToken(result.settings), {
    httpOnly: true,
    secure: baseUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect("/admin/leads");
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/admin");
}

export type TestAlertState = { sms?: ChannelOutcome; email?: ChannelOutcome };

/** Sends a test text and email to the alert addresses, and reports how each went. */
export async function sendTestAlert(): Promise<TestAlertState> {
  await requireAdmin();
  let store = null;
  try {
    store = getStore();
  } catch {
    // Alerts can be tested before the database is connected.
  }
  const outcome = await sendAlert(testAlertContent(), { store });
  return { sms: outcome.sms, email: outcome.email };
}
