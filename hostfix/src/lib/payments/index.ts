import "server-only";
import type { CountryCode } from "@config/markets";
import type { Db } from "@/lib/db/types";
import { demoModeAllowed } from "@/lib/env";
import { createDemoGateway } from "./demo-gateway";
import type { PaymentsGateway } from "./gateway";
import { stripeAccount } from "./stripe";
import { createStripeGateway } from "./stripe-gateway";

export type { PaymentsGateway } from "./gateway";

/**
 * Which payment company handles a country's money: Stripe when its key for
 * that country is set, pretend money in demo mode, otherwise nothing (and the
 * screens say that payments are not set up yet).
 */
export function paymentsFor(db: Db, country: CountryCode): PaymentsGateway | null {
  const stripe = stripeAccount(country);
  if ("account" in stripe) return createStripeGateway(stripe.account);
  if (demoModeAllowed()) return createDemoGateway(db, country);
  return null;
}

export function paymentsProblem(country: CountryCode): string | null {
  const stripe = stripeAccount(country);
  if ("account" in stripe || demoModeAllowed()) return null;
  return stripe.problem;
}
