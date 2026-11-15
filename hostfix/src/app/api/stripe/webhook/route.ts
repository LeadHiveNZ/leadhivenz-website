import { after } from "next/server";
import { sendQueued } from "@/lib/after";
import { getDb } from "@/lib/db";
import { handleStripeMessage, verifyStripeWebhook } from "@/lib/payments/deposit";
import { handleProductMessage } from "@/lib/payments/product-events";
import { configuredStripeAccounts } from "@/lib/payments/stripe";
import { getStore } from "@/lib/store";

/**
 * STRIPE WEBHOOK
 * Stripe calls this address when something happens to money: a founding
 * deposit, a membership starting or renewing, a failed payment, a card
 * change, a refund, a bank reversing a payment. It is the dependable way we
 * learn about money: it works even if the owner closes their browser straight
 * after paying.
 *
 * Every message is checked against the signing secret before anything is
 * done. A message that fails the check is refused.
 *
 * If something goes wrong on our side we answer with an error, and Stripe
 * tries again later (for up to three days).
 */
export async function POST(request: Request) {
  const accounts = configuredStripeAccounts().filter((account) => account.webhookSecret);
  if (accounts.length === 0) {
    return Response.json({ error: "Stripe webhooks are not set up on this site yet." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  // The signature covers the exact bytes Stripe sent, so read the raw text.
  const rawBody = await request.text();
  const verified = verifyStripeWebhook(rawBody, signature, accounts);
  if (!verified) return Response.json({ error: "Signature check failed." }, { status: 400 });

  const { message } = verified;
  const label = message.kind === "snapshot" ? `${message.event.type} (${message.event.id})` : `${message.type} (${message.id})`;
  try {
    // Memberships and job payments first. Anything else falls through to the founding deposit.
    const db = await getDb();
    const product = await handleProductMessage(db, message, verified.account);
    if (product) {
      after(() => sendQueued(db));
      return Response.json({ received: true, outcome: product.outcome });
    }
    const result = await handleStripeMessage(message, verified.account, { store: getStore(), defer: after });
    return Response.json({ received: true, outcome: result.outcome });
  } catch (error) {
    console.error(`[stripe] could not process ${label}:`, error instanceof Error ? error.message : error);
    return Response.json({ error: "Could not process this event. Please retry." }, { status: 500 });
  }
}
