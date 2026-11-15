import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { createLeadToken, LEAD_COOKIE, LEAD_COOKIE_SECONDS } from "@/lib/auth/lead-token";
import { appSecret, baseUrl } from "@/lib/env";
import { findCheckoutSession, fulfilDepositSession } from "@/lib/payments/deposit";
import { configuredStripeAccounts } from "@/lib/payments/stripe";
import { getStore } from "@/lib/store";

/**
 * Where Stripe sends the owner's browser after they pay. It double-checks the
 * payment with Stripe, records it (the webhook may already have), and moves on
 * to the confirmation page. The Stripe reference never stays in the address
 * bar, so it is not passed on to analytics or ad tracking.
 */
export async function GET(request: Request) {
  const done = new URL("/owners/founding-member", baseUrl());
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return NextResponse.redirect(done);

  try {
    const found = await findCheckoutSession(sessionId, configuredStripeAccounts());
    if (found) {
      const result = await fulfilDepositSession(found.session, found.account, { store: getStore(), defer: after });
      const secret = appSecret();
      if (result.lead && secret) {
        // Make sure the confirmation page knows who this is, even on a new device.
        const cookieStore = await cookies();
        cookieStore.set(LEAD_COOKIE, createLeadToken(secret, result.lead.id), {
          httpOnly: true,
          secure: baseUrl().startsWith("https://"),
          sameSite: "lax",
          path: "/",
          maxAge: LEAD_COOKIE_SECONDS,
        });
      }
    }
  } catch (error) {
    // The webhook is the safety net: if this fails, Stripe still tells us there.
    console.error("[deposit] could not confirm a returning payment:", error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(done);
}
