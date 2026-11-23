import { NextResponse, type NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getBilling, saveBank } from "@/lib/owners/service";
import { stripeAccount } from "@/lib/payments/stripe";
import { bankFromSetupCheckout } from "@/lib/payments/stripe-gateway";
import { isUuid } from "@/lib/uuid";

/**
 * Where Stripe's "add your bank account" page sends an owner back to (DECISIONS.md, 2026-11-23, second entry). The
 * account is saved here and now, rather than waiting for Stripe to tell us in the background (which it also does).
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const jobId = request.nextUrl.searchParams.get("job");
  const back = jobId && isUuid(jobId) ? `/app/jobs/${jobId}` : "/app/billing";
  const viewer = await currentViewer();
  if (!viewer?.ownerId) return to(`/sign-in?next=${encodeURIComponent(back)}`);
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const stripe = stripeAccount("NZ");
  if (sessionId && "account" in stripe) {
    try {
      const db = await getDb();
      const saved = await bankFromSetupCheckout(stripe.account, sessionId);
      const billing = await getBilling(db, viewer.ownerId, "NZ");
      // Only this owner's own account, whatever the link says.
      if (saved && billing && billing.customerId === saved.customerId) {
        await saveBank(db, { ownerId: viewer.ownerId, country: "NZ", provider: "stripe", customerId: saved.customerId, bank: saved.bank });
      }
    } catch (error) {
      console.error("[billing] reading the finished bank account page failed:", error instanceof Error ? error.message : error);
    }
  }
  return to(back);
}
