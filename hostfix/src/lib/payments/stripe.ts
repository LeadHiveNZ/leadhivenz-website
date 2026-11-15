import "server-only";
import Stripe from "stripe";
import type { CountryCode } from "@config/markets";
import { demoModeAllowed, env } from "@/lib/env";

/**
 * STRIPE ACCOUNTS
 * Stripe cannot pay tradies across the Tasman from one account, so the design
 * is one Stripe account per country. Each market uses the account for its
 * country. Settings are named STRIPE_NZ_SECRET_KEY, STRIPE_AU_SECRET_KEY, etc.
 */

export type StripeAccount = {
  country: CountryCode;
  secretKey: string;
  webhookSecret: string | null;
  /** "test" keys move no real money. */
  mode: "test" | "live";
};

const COUNTRIES: CountryCode[] = ["NZ", "AU"];

export function stripeAccount(country: CountryCode): { account: StripeAccount } | { problem: string } {
  const name = `STRIPE_${country}_SECRET_KEY`;
  const secretKey = env(name);
  if (!secretKey) return { problem: `${name} is not set.` };
  if (secretKey.startsWith("pk_")) {
    return { problem: `${name} holds the publishable key (pk_...). Use the secret key instead (sk_...).` };
  }
  if (!/^(sk|rk)_(test|live)_/.test(secretKey)) {
    return { problem: `${name} does not look like a Stripe secret key. It should start with sk_test_ or sk_live_.` };
  }
  const webhookSecret = env(`STRIPE_${country}_WEBHOOK_SECRET`) ?? null;
  if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
    return { problem: `STRIPE_${country}_WEBHOOK_SECRET should start with whsec_.` };
  }
  return {
    account: { country, secretKey, webhookSecret, mode: secretKey.includes("_test_") ? "test" : "live" },
  };
}

export function configuredStripeAccounts(): StripeAccount[] {
  const accounts: StripeAccount[] = [];
  for (const country of COUNTRIES) {
    const result = stripeAccount(country);
    if ("account" in result) accounts.push(result.account);
  }
  return accounts;
}

const clients = new Map<string, Stripe>();

/**
 * For automated tests only: lets the app talk to a stand-in Stripe server on
 * this computer instead of the real one. Ignored on the live site (it only
 * works where demo mode is allowed, which is never on Vercel).
 */
function testServer(): { host: string; port: number; protocol: "http" } | null {
  const address = env("STRIPE_TEST_SERVER");
  if (!address || !demoModeAllowed()) return null;
  const match = /^http:\/\/(localhost|127\.0\.0\.1):(\d{2,5})$/.exec(address);
  if (!match) return null;
  return { host: match[1]!, port: Number(match[2]), protocol: "http" };
}

export function stripeClient(account: StripeAccount): Stripe {
  let client = clients.get(account.secretKey);
  if (!client) {
    const standIn = testServer();
    client = new Stripe(account.secretKey, {
      maxNetworkRetries: standIn ? 0 : 2,
      timeout: 15_000,
      appInfo: { name: "HostFix" },
      ...(standIn ?? {}),
    });
    clients.set(account.secretKey, client);
  }
  return client;
}
