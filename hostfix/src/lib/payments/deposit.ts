import "server-only";
import type Stripe from "stripe";
import { brand } from "@config/brand";
import type { Market } from "@config/markets";
import {
  depositAlertContent,
  duplicateDepositAlertContent,
  orphanDepositAlertContent,
  sendAlert,
} from "@/lib/notify/alerts";
import type { Lead, LeadStore } from "@/lib/store/types";
import { stripeClient, type StripeAccount } from "./stripe";

/**
 * THE FOUNDING MEMBER DEPOSIT
 *
 * How the money moves:
 *   1. An owner presses "reserve my spot". We ask Stripe for a card page and
 *      send them to it. The lead is marked "started".
 *   2. They pay on Stripe's page. Card details never touch this app.
 *   3. Stripe tells us in two ways: a signed message to our webhook, and the
 *      owner's browser coming back. Both call fulfilDepositSession().
 *   4. The first call records the payment and writes the audit entry. Every
 *      later call for the same payment changes nothing.
 *
 * Refunds are made by you in the Stripe dashboard. Stripe then tells the
 * webhook and the lead is marked refunded.
 *
 * NO LONGER OFFERED (DECISIONS.md, 2026-11-17, "Free to join"). HostFix is
 * free to join, so no new deposit is ever taken: depositAvailability always
 * says no, and the form only offers the price list. The rest of this file
 * stays, because deposits already paid are refunded and Stripe's messages
 * about them (paid, refunded) must still be recorded. RUNBOOK.md says how.
 */

export const DEPOSIT_PURPOSE = "founding_deposit";

type Log = Pick<Console, "error" | "warn" | "info">;

export type DepositDeps = {
  store: LeadStore;
  /** Runs work after the reply has gone out. */
  defer: (work: () => Promise<void>) => void;
  /** Replaced in tests. */
  alert?: typeof sendAlert;
  log?: Log;
};

export function depositAvailability(
  market: Market,
): { available: true; account: StripeAccount } | { available: false; reason: string } {
  // Free to join: a deposit is never offered or started, whatever the market's settings say.
  void market;
  return { available: false, reason: `Deposits are no longer taken: ${brand.name} is free to join.` };
}

/** Exactly what we ask Stripe to charge. Kept separate so it can be tested. */
export function buildDepositSessionParams(lead: Lead, market: Market, base: string): Stripe.Checkout.SessionCreateParams {
  if (lead.leadType !== "owner") throw new Error("Only an owner can pay a founding member deposit.");
  if (!lead.email) throw new Error("This lead has no email address for the receipt.");

  const metadata = { lead_id: lead.id, market: market.slug, purpose: DEPOSIT_PURPOSE };
  return {
    mode: "payment",
    // "Taken by card": only cards (which includes Apple Pay and Google Pay).
    allowed_payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: market.currency.toLowerCase(),
          unit_amount: market.foundingDeposit.amountCents,
          product_data: {
            name: `${brand.name} founding member deposit`,
            description: `Founding member spot in ${market.name}.`,
          },
        },
      },
    ],
    client_reference_id: lead.id,
    customer_email: lead.email,
    customer_creation: "always",
    submit_type: "pay",
    metadata,
    payment_intent_data: {
      description: `${brand.name} founding member deposit (${market.name})`,
      metadata,
      // Stripe emails a receipt to this address for every live payment.
      receipt_email: lead.email,
    },
    ...(market.foundingDeposit.terms.length > 0
      ? { custom_text: { submit: { message: `${market.foundingDeposit.terms.join(". ")}.` } } }
      : {}),
    success_url: `${base}/owners/deposit/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/owners/thanks?deposit=cancelled`,
  };
}

export class DepositNotAllowedError extends Error {}

/** Creates the card page for this lead and returns its address. */
export async function startDepositCheckout(
  lead: Lead,
  market: Market,
  base: string,
  deps: { store: LeadStore; stripe?: Stripe; now?: () => number; spotsLeft?: number | null },
): Promise<{ url: string; sessionId: string }> {
  if (lead.depositStatus === "paid" || lead.depositStatus === "refunded" || lead.depositStatus === "credited") {
    throw new DepositNotAllowedError("This deposit has already been paid.");
  }
  if (deps.spotsLeft === 0) throw new DepositNotAllowedError(`All the founding spots in ${market.name} have been taken.`);
  const availability = depositAvailability(market);
  if (!availability.available) throw new DepositNotAllowedError(availability.reason);

  const stripe = deps.stripe ?? stripeClient(availability.account);
  const params = buildDepositSessionParams(lead, market, base);
  // Two quick taps on the button get the same card page, not two.
  const minute = Math.floor((deps.now ?? Date.now)() / 60_000);
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `hostfix-deposit-${lead.id}-${minute}`,
  });
  if (!session.url) throw new Error("Stripe did not return a card page address.");

  await deps.store.markDepositStarted({
    leadId: lead.id,
    stripeAccount: availability.account.country,
    checkoutSessionId: session.id,
    amount: market.foundingDeposit.amountCents,
    currency: market.currency,
  });
  return { url: session.url, sessionId: session.id };
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type FulfilOutcome =
  | "recorded"
  | "already_recorded"
  | "duplicate_payment"
  | "unknown_lead"
  | "not_paid"
  | "not_a_deposit";

export type FulfilResult = { outcome: FulfilOutcome; lead: Lead | null };

/**
 * Records a paid deposit. Safe to call any number of times, from the webhook
 * and from the returning browser, in any order, even at the same moment.
 */
export async function fulfilDepositSession(
  session: Stripe.Checkout.Session,
  account: StripeAccount,
  deps: DepositDeps,
): Promise<FulfilResult> {
  const log = deps.log ?? console;
  const alert = deps.alert ?? sendAlert;

  if (session.metadata?.purpose !== DEPOSIT_PURPOSE) return { outcome: "not_a_deposit", lead: null };
  const leadId = session.client_reference_id ?? session.metadata?.lead_id ?? null;
  if (!leadId) return { outcome: "not_a_deposit", lead: null };
  if (session.payment_status !== "paid" || session.amount_total === null || !session.currency) {
    return { outcome: "not_paid", lead: null };
  }

  const amount = session.amount_total;
  const currency = session.currency.toUpperCase();

  const recorded = await deps.store.recordDepositPaid({
    leadId,
    stripeAccount: account.country,
    checkoutSessionId: session.id,
    paymentIntentId: idOf(session.payment_intent),
    customerId: idOf(session.customer),
    amount,
    currency,
  });

  if (recorded) {
    deps.defer(async () => {
      try {
        await alert(depositAlertContent(recorded), { store: deps.store });
      } catch (error) {
        log.error("[deposit] alert failed:", reason(error));
      }
    });
    return { outcome: "recorded", lead: recorded };
  }

  // Nothing changed. Work out why.
  const existing = await deps.store.getLead(leadId);

  if (!existing) {
    const firstTime = await deps.store.audit({
      actor: "stripe",
      action: "deposit.paid_without_lead",
      entity: "lead",
      entityId: leadId,
      amount,
      currency,
      detail: { stripe_account: account.country, checkout_session: session.id },
      dedupeKey: `orphan:${session.id}`,
    });
    if (firstTime) {
      log.error(`[deposit] a deposit was paid for a lead that does not exist (session ${session.id})`);
      deps.defer(async () => {
        try {
          await alert(orphanDepositAlertContent(session.id, amount, currency), { store: deps.store });
        } catch (error) {
          log.error("[deposit] alert failed:", reason(error));
        }
      });
    }
    return { outcome: "unknown_lead", lead: null };
  }

  if (existing.stripeCheckoutSessionId === session.id) {
    return { outcome: "already_recorded", lead: existing };
  }

  // A different, second payment for someone who has already paid.
  const firstTime = await deps.store.audit({
    actor: "stripe",
    action: "deposit.duplicate_payment",
    entity: "lead",
    entityId: existing.id,
    amount,
    currency,
    detail: { stripe_account: account.country, checkout_session: session.id, payment_intent: idOf(session.payment_intent) },
    dedupeKey: `duplicate:${session.id}`,
  });
  if (firstTime) {
    log.warn(`[deposit] lead ${existing.id} paid a second deposit (session ${session.id})`);
    deps.defer(async () => {
      try {
        await alert(duplicateDepositAlertContent(existing, session.id), { store: deps.store });
      } catch (error) {
        log.error("[deposit] alert failed:", reason(error));
      }
    });
  }
  return { outcome: "duplicate_payment", lead: existing };
}

export type WebhookResult = { handled: boolean; outcome: string };

/** Acts on one message from Stripe. Unknown message types are ignored. */
export async function handleStripeEvent(
  event: Stripe.Event,
  account: StripeAccount,
  deps: DepositDeps,
): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const result = await fulfilDepositSession(event.data.object, account, deps);
      return { handled: true, outcome: result.outcome };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return { handled: false, outcome: "no_payment_intent" };
      const lead = await deps.store.recordDepositRefunded({
        paymentIntentId,
        amountRefunded: charge.amount_refunded,
        fullyRefunded: charge.refunded === true,
        eventId: event.id,
      });
      if (!lead) return { handled: true, outcome: "nothing_to_change" };
      return { handled: true, outcome: charge.refunded ? "refunded" : "part_refunded" };
    }
    default:
      return { handled: false, outcome: "ignored" };
  }
}

/**
 * Stripe can send its messages in two shapes, chosen when the webhook is set
 * up in the Stripe dashboard:
 *   - "snapshot": the message carries the whole payment record
 *   - "thin":     the message only names the record, and we look it up
 * Both are accepted, so the choice made in the dashboard cannot break anything.
 */
export type StripeMessage =
  | { kind: "snapshot"; event: Stripe.Event }
  | { kind: "thin"; id: string; type: string; relatedObjectId: string | null };

/**
 * Checks a webhook message really came from Stripe. Each Stripe account has
 * its own signing secret, so the secret that matches also tells us which
 * account sent it.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string,
  accounts: StripeAccount[],
): { message: StripeMessage; account: StripeAccount } | null {
  for (const account of accounts) {
    if (!account.webhookSecret) continue;
    try {
      // Checks the signature and that the message is no more than five minutes
      // old. Throws if either check fails.
      const signature = stripeClient(account).webhooks.signature;
      if (!signature) return null;
      signature.verifyHeader(rawBody, signatureHeader, account.webhookSecret);
    } catch {
      // Not signed with this account's secret. Try the next one.
      continue;
    }

    let raw: { object?: string; id?: string; type?: string; related_object?: { id?: string } | null };
    try {
      raw = JSON.parse(rawBody) as typeof raw;
    } catch {
      return null;
    }
    if (typeof raw !== "object" || raw === null) return null;

    if (raw.object === "v2.core.event") {
      return {
        account,
        message: {
          kind: "thin",
          id: String(raw.id ?? ""),
          type: String(raw.type ?? ""),
          relatedObjectId: typeof raw.related_object?.id === "string" ? raw.related_object.id : null,
        },
      };
    }
    return { account, message: { kind: "snapshot", event: raw as unknown as Stripe.Event } };
  }
  return null;
}

export type MessageDeps = DepositDeps & {
  /** Replaced in tests. Looks up the full record a thin message points to. */
  fetchSession?: (id: string, account: StripeAccount) => Promise<Stripe.Checkout.Session>;
  fetchCharge?: (id: string, account: StripeAccount) => Promise<Stripe.Charge>;
};

/** Acts on one verified message from Stripe, whichever shape it arrived in. */
export async function handleStripeMessage(
  message: StripeMessage,
  account: StripeAccount,
  deps: MessageDeps,
): Promise<WebhookResult> {
  if (message.kind === "snapshot") return handleStripeEvent(message.event, account, deps);

  const fetchSession = deps.fetchSession ?? ((id, acct) => stripeClient(acct).checkout.sessions.retrieve(id));
  const fetchCharge = deps.fetchCharge ?? ((id, acct) => stripeClient(acct).charges.retrieve(id));

  switch (message.type) {
    case "v1.checkout.session.completed":
    case "v1.checkout.session.async_payment_succeeded": {
      if (!message.relatedObjectId) return { handled: false, outcome: "ignored" };
      const session = await fetchSession(message.relatedObjectId, account);
      const result = await fulfilDepositSession(session, account, deps);
      return { handled: true, outcome: result.outcome };
    }
    case "v1.charge.refunded": {
      if (!message.relatedObjectId) return { handled: false, outcome: "ignored" };
      const charge = await fetchCharge(message.relatedObjectId, account);
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return { handled: false, outcome: "no_payment_intent" };
      const lead = await deps.store.recordDepositRefunded({
        paymentIntentId,
        amountRefunded: charge.amount_refunded,
        fullyRefunded: charge.refunded === true,
        eventId: message.id,
      });
      if (!lead) return { handled: true, outcome: "nothing_to_change" };
      return { handled: true, outcome: charge.refunded ? "refunded" : "part_refunded" };
    }
    default:
      return { handled: false, outcome: "ignored" };
  }
}

/** Finds a card page session by its ID, looking in each connected Stripe account. */
export async function findCheckoutSession(
  sessionId: string,
  accounts: StripeAccount[],
): Promise<{ session: Stripe.Checkout.Session; account: StripeAccount } | null> {
  for (const account of accounts) {
    try {
      const session = await stripeClient(account).checkout.sessions.retrieve(sessionId);
      return { session, account };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "resource_missing") continue;
      throw error;
    }
  }
  return null;
}
