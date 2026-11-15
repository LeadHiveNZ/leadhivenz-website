"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { checkCode, issueCode } from "@/lib/auth/codes";
import { homeFor, safeNext, setSessionCookie } from "@/lib/auth/current";
import { openPending, PENDING_COOKIE, PENDING_MINUTES, sealPending, type Pending } from "@/lib/auth/pending";
import { createSession, deleteSession, SESSION_COOKIE } from "@/lib/auth/sessions";
import { AccountExistsError, findUserByIdentifier, normaliseEmail, parseIdentifier, viewerFor, type Identifier } from "@/lib/auth/users";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { appSecret, baseUrl, demoModeAllowed } from "@/lib/env";
import { problem, text, type FormState } from "@/lib/forms";
import { publicMarket } from "@/lib/markets/public";
import { emailSettings } from "@/lib/notify/email";
import { emails, texts } from "@/lib/notify/messages";
import { enqueue, flushOutbox } from "@/lib/notify/outbox";
import { smsSettings } from "@/lib/notify/sms";
import { createOwnerAccount } from "@/lib/owners/service";
import { normalisePhone } from "@/lib/phone";
import { withinRateLimit } from "@/lib/rate-limit";
import { ipKey } from "@/lib/request";

/**
 * SIGNING IN. There are no passwords. You type your email or mobile, a
 * six-digit code is sent there, and typing it signs you in on this device for
 * 30 days.
 */

const NOT_READY = "Sign-in is not set up yet. Please try again later.";

async function tooManyTries(what: string, max: number): Promise<boolean> {
  const visitor = ipKey(await headers()) ?? "unknown";
  return !(await withinRateLimit(`${what}:${visitor}`, 15 * 60, max));
}

async function setPending(secret: string, pending: Pending): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_COOKIE, sealPending(secret, pending), {
    httpOnly: true,
    secure: baseUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MINUTES * 60,
  });
}

/** Makes a code and sends it. Returns a message if it could not be sent. */
async function sendCode(db: Db, secret: string, identifier: Identifier, rest: Omit<Pending, "identifier" | "expiresAt" | "demoCode">): Promise<string | null> {
  const issued = await issueCode(db, secret, identifier);
  if (!issued.ok) return "We have sent several codes already. Please wait 15 minutes before asking for another.";

  if (identifier.kind === "email") {
    const mail = emails.signInCode(issued.code);
    await enqueue(db, { channel: "email", to: identifier.value, template: "sign_in_code", subject: mail.subject, body: mail.body });
  } else {
    await enqueue(db, { channel: "sms", to: identifier.value, template: "sign_in_code", body: texts.signInCode(issued.code) });
  }
  await flushOutbox(db);

  // In demo mode with no text or email service connected, nothing can be
  // delivered, so the code is shown on the next screen instead.
  const connected = identifier.kind === "email" ? "settings" in emailSettings() : "settings" in smsSettings();
  await setPending(secret, {
    ...rest,
    identifier,
    expiresAt: Date.now() + PENDING_MINUTES * 60_000,
    ...(demoModeAllowed() && !connected ? { demoCode: issued.code } : {}),
  });
  return null;
}

export async function startSignIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const secret = appSecret();
  if (!secret) return problem(formData, NOT_READY);
  if (await tooManyTries("signin-start", 20)) return problem(formData, "Too many tries. Please wait 15 minutes and try again.");

  const country = (await publicMarket())?.market.country ?? "NZ";
  const identifier = parseIdentifier(text(formData, "identifier"), country);
  if (!identifier) return problem(formData, "Please check what you typed.", { identifier: "Enter your email address or your mobile number." });

  const db = await getDb();
  const user = await findUserByIdentifier(db, identifier);
  if (!user || user.disabled) {
    return problem(formData, "We cannot find an account for that. Check it is the one you joined with, or join below.", {
      identifier: identifier.kind === "email" ? "No account uses this email address." : "No account uses this mobile number.",
    });
  }
  const failed = await sendCode(db, secret, identifier, { purpose: "sign_in", next: safeNext(text(formData, "next"), "") || null });
  if (failed) return problem(formData, failed);
  redirect("/sign-in/code");
}

export async function startOwnerSignUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const secret = appSecret();
  if (!secret) return problem(formData, NOT_READY);
  if (await tooManyTries("signup-start", 10)) return problem(formData, "Too many tries. Please wait 15 minutes and try again.");

  const data = await publicMarket(text(formData, "market") || null);
  const country = data?.market.country ?? "NZ";
  const name = text(formData, "name");
  const email = normaliseEmail(text(formData, "email"));
  const phone = normalisePhone(text(formData, "phone"), country);
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name.";
  if (!email) errors.email = "Enter your email address.";
  if (!phone) errors.phone = "Enter your mobile number. We text you when a job is booked and when it is done.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);

  const db = await getDb();
  if (await findUserByIdentifier(db, { kind: "email", value: email! })) {
    return problem(formData, "That email address already has an account. Sign in instead.", { email: "Already has an account." });
  }
  if (await findUserByIdentifier(db, { kind: "phone", value: phone!.e164 })) {
    return problem(formData, "That mobile number already has an account. Sign in instead.", { phone: "Already has an account." });
  }
  const failed = await sendCode(db, secret, { kind: "email", value: email! }, {
    purpose: "owner_sign_up",
    next: null,
    signUp: { name, email: email!, phone: phone!.e164, homeLocation: text(formData, "homeLocation") || null, ref: text(formData, "ref").toUpperCase().slice(0, 12) || null },
  });
  if (failed) return problem(formData, failed);
  redirect("/sign-in/code");
}

export async function finishSignIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const secret = appSecret();
  if (!secret) return problem(formData, NOT_READY);
  if (await tooManyTries("signin-code", 30)) return problem(formData, "Too many tries. Please wait 15 minutes and try again.");

  const cookieStore = await cookies();
  const pending = openPending(secret, cookieStore.get(PENDING_COOKIE)?.value, Date.now());
  if (!pending) return { message: "That took too long. Go back and ask for a new code." };

  const db = await getDb();
  const result = await checkCode(db, secret, pending.identifier, text(formData, "code"));
  if (!result.ok) {
    if (result.reason === "wrong") return problem(formData, "That code is not right. Check it and try again.", { code: "Not the right code." });
    if (result.reason === "too_many") return { message: "Too many wrong tries. Ask for a new code." };
    return { message: "That code has run out. Ask for a new one." };
  }

  let user = await findUserByIdentifier(db, pending.identifier);
  let isNew = false;
  if (!user && pending.purpose === "owner_sign_up" && pending.signUp) {
    try {
      const created = await createOwnerAccount(db, pending.signUp);
      user = created.user;
      isNew = true;
      const mail = emails.welcomeOwner({ name: created.user.name, link: `${baseUrl()}/app` });
      await enqueue(db, { channel: "email", to: pending.signUp.email, template: "welcome_owner", subject: mail.subject, body: mail.body, userId: created.user.id });
      await flushOutbox(db);
    } catch (error) {
      if (!(error instanceof AccountExistsError)) throw error;
      user = await findUserByIdentifier(db, pending.identifier);
    }
  }
  if (!user || user.disabled) return { message: "We could not find that account. Please start again." };

  const headerList = await headers();
  const session = await createSession(db, user.id, headerList.get("user-agent"));
  await setSessionCookie(session.token);
  cookieStore.delete(PENDING_COOKIE);

  if (isNew) {
    const ref = pending.signUp?.ref;
    redirect(ref ? `/app/properties/new?ref=${encodeURIComponent(ref)}` : "/app/properties/new");
  }
  redirect(safeNext(pending.next, homeFor(await viewerFor(db, user))));
}

/** Sends a fresh code to the same place. */
export async function resendCode(_previous: FormState, _formData: FormData): Promise<FormState> {
  const secret = appSecret();
  if (!secret) return { message: NOT_READY };
  if (await tooManyTries("signin-resend", 10)) return { message: "Too many tries. Please wait 15 minutes and try again." };
  const cookieStore = await cookies();
  const pending = openPending(secret, cookieStore.get(PENDING_COOKIE)?.value, Date.now());
  if (!pending) return { message: "That took too long. Go back and start again." };
  const failed = await sendCode(await getDb(), secret, pending.identifier, { purpose: pending.purpose, next: pending.next, signUp: pending.signUp });
  return failed ? { message: failed } : { done: "A new code is on its way." };
}

export async function signOutUser(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await deleteSession(await getDb(), token);
    } catch {
      // The cookie is removed below either way.
    }
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/");
}
