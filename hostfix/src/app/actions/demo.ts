"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { runTimer, sendQueued } from "@/lib/after";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { currentViewer, setSessionCookie } from "@/lib/auth/current";
import { createSession } from "@/lib/auth/sessions";
import { getDb } from "@/lib/db";
import { demoPeople, skipAhead } from "@/lib/demo/state";
import { appSecret, baseUrl, demoModeAllowed } from "@/lib/env";
import { text, type FormState } from "@/lib/forms";
import { handleInboundSms } from "@/lib/notify/inbound";
import { saveBilling } from "@/lib/owners/service";
import { completeDemoCardSetup, completeDemoCheckout, DEMO_CARD_DECLINES, DEMO_CARD_OK, getDemoCheckout } from "@/lib/payments/demo-gateway";
import { activatePortfolio } from "@/lib/properties/portfolio";
import { sealTeamDevice, TEAM_DEVICE_COOKIE, TEAM_DEVICE_DAYS } from "@/lib/team/device";
import { activateFreeMembership, activateMembership } from "@/lib/properties/service";
import { getTradie, savePayoutAccount } from "@/lib/tradies/service";

/**
 * THE DEMO'S OWN BUTTONS: sign in as one of the sample people, skip the
 * clock ahead, pay on the pretend card page. Every one of them refuses to run
 * unless the app is in demo mode, which can never be the case on the live
 * site.
 */

function demoOnly(): void {
  if (!demoModeAllowed()) notFound();
}

/** Signs in as one of the sample people, with no code. */
export async function becomePerson(formData: FormData): Promise<void> {
  demoOnly();
  const db = await getDb();
  const person = (await demoPeople(db)).find((candidate) => candidate.key === text(formData, "who"));
  if (!person?.userId) redirect("/demo");
  if (person.role === "cleaner") {
    // A cleaner has no sign-in: they have their own team link. In the demo this phone skips the
    // six-digit code that a real phone types once (DECISIONS.md, 2026-11-18).
    const link = (await db.query<{ id: string; link_token: string }>("select id, link_token from public.team_links where user_id = $1::uuid", [person.userId]))[0];
    const secret = appSecret();
    if (!link || !secret) redirect("/demo");
    (await cookies()).set(TEAM_DEVICE_COOKIE, sealTeamDevice(secret, { id: link.id, token: link.link_token }), {
      httpOnly: true, secure: baseUrl().startsWith("https://"), sameSite: "lax", path: "/", maxAge: TEAM_DEVICE_DAYS * 24 * 60 * 60,
    });
    redirect(`/r/${link.link_token}`);
  }
  const session = await createSession(db, person.userId, (await headers()).get("user-agent"));
  await setSessionCookie(session.token);
  (await cookies()).delete(ADMIN_COOKIE);
  redirect(person.role === "owner" ? "/app" : person.role === "tradie" ? "/tradie" : person.role === "admin" ? "/admin/dashboard" : "/admin/queue");
}

export async function skipTime(formData: FormData): Promise<void> {
  demoOnly();
  const minutes = Number(text(formData, "minutes"));
  if (![15, 60, 240, 1440].includes(minutes)) redirect("/demo");
  await skipAhead(await getDb(), minutes);
  revalidatePath("/", "layout");
  redirect(`/demo?skipped=${minutes}`);
}

export async function runTimerNow(): Promise<void> {
  demoOnly();
  await runTimer(await getDb());
  revalidatePath("/", "layout");
  redirect("/demo?ran=1");
}

/** The "Pay" button on the pretend card page. Does what the real card page and the payment company's message do between them. */
export async function payDemoCheckout(_previous: FormState, formData: FormData): Promise<FormState> {
  demoOnly();
  const viewer = await currentViewer();
  const db = await getDb();
  const id = text(formData, "checkoutId");
  const checkout = await getDemoCheckout(db, id);
  if (!checkout || !viewer?.ownerId || viewer.ownerId !== checkout.ownerId) return { message: "That payment page is not yours, or has run out. Go back and start again." };
  const after = checkout.portfolioId || !checkout.propertyId ? "/app/billing?member=1" : `/app/properties/${checkout.propertyId}?member=1`;
  if (checkout.completed) redirect(after);
  if (checkout.setupOnly && checkout.propertyId) {
    // A free membership: the card is saved, nothing is charged, and the property is covered.
    const saved = await completeDemoCardSetup(db, id);
    if (!saved) return { message: "That card page has already been used." };
    await activateFreeMembership(db, { propertyId: checkout.propertyId, ownerId: checkout.ownerId, provider: "demo", customerId: checkout.customerId, card: saved.card });
    await sendQueued(db);
    redirect(after);
  }
  const paid = await completeDemoCheckout(db, id);
  if (!paid) return { message: "That payment page has already been used." };
  if (checkout.portfolioId || !checkout.propertyId) {
    await activatePortfolio(db, {
      portfolioId: checkout.portfolioId!, provider: "demo", subscriptionId: paid.subscriptionId, periodEnd: paid.periodEnd, invoice: paid.invoice,
      card: paid.card, customerId: checkout.customerId,
    });
    await sendQueued(db);
    redirect(after);
  }
  await activateMembership(db, {
    propertyId: checkout.propertyId, provider: "demo", subscriptionId: paid.subscriptionId, periodEnd: paid.periodEnd, invoice: paid.invoice,
    card: paid.card, customerId: checkout.customerId,
  });
  await sendQueued(db);
  // The real card page sends the owner's browser back to the site. Here we are already on it, so go straight to the property.
  redirect(`/app/properties/${checkout.propertyId}?member=1`);
}

/** Swaps the owner's pretend card for one that works, or one that is always declined. */
export async function chooseDemoCard(_previous: FormState, formData: FormData): Promise<FormState> {
  demoOnly();
  const viewer = await currentViewer();
  if (!viewer?.ownerId) return { message: "Sign in as an owner first." };
  const db = await getDb();
  const rows = await db.query<{ country: "NZ" | "AU"; customer_id: string }>("select country, customer_id from public.owner_billing where owner_id = $1::uuid and provider = 'demo'", [viewer.ownerId]);
  if (rows.length === 0) return { message: "There is no card to change yet. Start a membership first." };
  const card = text(formData, "card") === "declines" ? DEMO_CARD_DECLINES : DEMO_CARD_OK;
  for (const row of rows) await saveBilling(db, { ownerId: viewer.ownerId, country: row.country, provider: "demo", customerId: row.customer_id, card });
  revalidatePath("/app/billing");
  redirect("/app/billing");
}

/** The pretend version of a tradie entering their bank details. */
export async function finishDemoPayoutSetup(_previous: FormState, _formData: FormData): Promise<FormState> {
  demoOnly();
  const viewer = await currentViewer();
  if (!viewer?.tradieId) return { message: "Sign in as a tradie first." };
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  if (!tradie?.payoutAccountId) return { message: "Start from your profile: tap Add bank details." };
  await savePayoutAccount(db, tradie.id, { provider: "demo", accountId: tradie.payoutAccountId, payoutsEnabled: true });
  // The real page sends the tradie's browser back to the site. Here we are already on it.
  redirect("/tradie/profile?payouts=done");
}

/** Pretends a tradie replied to a text. */
export async function sendDemoReply(formData: FormData): Promise<void> {
  demoOnly();
  const db = await getDb();
  const who = text(formData, "who");
  const person = (await demoPeople(db)).find((candidate) => candidate.key === who);
  if (!person?.phone) redirect("/demo/phone");
  const outcome = await handleInboundSms(db, { provider: "demo", from: person.phone, body: text(formData, "reply"), raw: { demo: true } });
  await sendQueued(db);
  revalidatePath("/", "layout");
  redirect(`/demo/phone?who=${who}&replied=${outcome}`);
}
