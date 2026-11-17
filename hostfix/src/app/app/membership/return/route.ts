import { NextResponse, type NextRequest } from "next/server";
import { sendQueued } from "@/lib/after";
import { currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getMarket } from "@/lib/markets/store";
import { stripeAccount } from "@/lib/payments/stripe";
import { cardFromSetupCheckout, membershipFromCheckout } from "@/lib/payments/stripe-gateway";
import { activatePortfolio, getPortfolio } from "@/lib/properties/portfolio";
import { activateFreeMembership, activateMembership, getProperty } from "@/lib/properties/service";

/**
 * Where the card page sends an owner back to. If the payment went through
 * (or, for a free membership, the card was saved), the property becomes a
 * member here and now, rather than waiting for the payment company to tell us
 * in the background (which it also does).
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const propertyId = request.nextUrl.searchParams.get("property") ?? "";
  const sessionId = request.nextUrl.searchParams.get("session_id");

  const portfolioId = request.nextUrl.searchParams.get("portfolio");
  const viewer = await currentViewer();
  if (!viewer?.ownerId) return to(`/sign-in?next=${encodeURIComponent(portfolioId ? "/app/billing" : `/app/properties/${propertyId}`)}`);
  const db = await getDb();

  // A Portfolio retainer: one payment for the whole account.
  if (portfolioId) {
    const portfolio = await getPortfolio(db, viewer.ownerId, portfolioId);
    if (!portfolio) return to("/app/billing");
    if (portfolio.status === "active") return to("/app/billing?member=1");
    const market = await getMarket(db, portfolio.market);
    const stripe = market ? stripeAccount(market.country) : null;
    if (sessionId && stripe && "account" in stripe) {
      try {
        const membership = await membershipFromCheckout(stripe.account, sessionId);
        // Only this owner's own portfolio, whatever the link says.
        if (membership && membership.portfolioId === portfolio.id) {
          const activated = await activatePortfolio(db, {
            portfolioId: portfolio.id, provider: "stripe", subscriptionId: membership.subscriptionId, periodEnd: membership.periodEnd,
            invoice: membership.invoice, card: membership.card, customerId: membership.customerId,
          });
          await sendQueued(db);
          if (activated) return to("/app/billing?member=1");
        }
      } catch (error) {
        console.error("[membership] reading the finished Portfolio card page failed:", error instanceof Error ? error.message : error);
      }
    }
    return to("/app/billing?pending=1");
  }
  const property = await getProperty(db, viewer.ownerId, propertyId);
  if (!property) return to("/app");
  if (property.status === "active") return to(`/app/properties/${property.id}?member=1`);

  const market = await getMarket(db, property.market);
  const stripe = market ? stripeAccount(market.country) : null;
  if (sessionId && stripe && "account" in stripe) {
    try {
      // A free membership: the page only saved a card.
      const saved = await cardFromSetupCheckout(stripe.account, sessionId);
      if (saved) {
        // Only for this owner's own property, whatever the link says.
        if (saved.propertyId !== property.id) return to(`/app/properties/${property.id}?pending=1`);
        const covered = await activateFreeMembership(db, { propertyId: property.id, ownerId: viewer.ownerId, provider: "stripe", customerId: saved.customerId, card: saved.card });
        await sendQueued(db);
        return to(covered ? `/app/properties/${property.id}?member=1` : `/app/properties/${property.id}?pending=1`);
      }
      const membership = await membershipFromCheckout(stripe.account, sessionId);
      // Only for this owner's own property, whatever the link says.
      if (membership && membership.propertyId === property.id) {
        const activated = await activateMembership(db, {
          propertyId: property.id, provider: "stripe", subscriptionId: membership.subscriptionId, periodEnd: membership.periodEnd,
          invoice: membership.invoice, card: membership.card, customerId: membership.customerId,
        });
        await sendQueued(db);
        if (activated) return to(`/app/properties/${property.id}?member=1`);
      }
    } catch (error) {
      console.error("[membership] reading the finished card page failed:", error instanceof Error ? error.message : error);
    }
  }
  return to(`/app/properties/${property.id}?pending=1`);
}
