"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendQueued } from "@/lib/after";
import { normaliseEmail } from "@/lib/auth/users";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { problem, text, type FormState } from "@/lib/forms";
import { publicMarket } from "@/lib/markets/public";
import { texts } from "@/lib/notify/messages";
import { enqueue } from "@/lib/notify/outbox";
import { registerReferrer } from "@/lib/owners/referrers";
import { normalisePhone } from "@/lib/phone";
import { withinRateLimit } from "@/lib/rate-limit";
import { ipKey } from "@/lib/request";

/** A cleaner or co-host asks for their own link to pass on to owners. */
export async function joinReferrals(_previous: FormState, formData: FormData): Promise<FormState> {
  const visitor = ipKey(await headers()) ?? "unknown";
  if (!(await withinRateLimit(`refer:${visitor}`, 60 * 60, 8))) return problem(formData, "Too many tries. Please wait a while and try again.");

  const country = (await publicMarket())?.market.country ?? "NZ";
  const name = text(formData, "name");
  const phone = normalisePhone(text(formData, "phone"), country);
  const typedEmail = text(formData, "email");
  const email = typedEmail ? normaliseEmail(typedEmail) : null;
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name.";
  if (!phone) errors.phone = "Enter your mobile number. We text you when you have earned a reward.";
  if (typedEmail && !email) errors.email = "That does not look like an email address. You can leave it empty.";
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);

  const db = await getDb();
  const referrer = await registerReferrer(db, { name, phone: phone!.e164, email });
  const link = `${baseUrl()}/sign-up?ref=${referrer.code}`;
  await enqueue(db, { channel: "sms", to: referrer.phone, template: "referral_thanks", body: texts.referralThanks({ name: referrer.name, link }), dedupeKey: `referral_thanks:${referrer.id}` });
  await sendQueued(db);
  redirect(`/refer/${referrer.code}`);
}
