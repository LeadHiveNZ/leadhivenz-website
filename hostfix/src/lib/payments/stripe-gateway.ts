import Stripe from "stripe";
import { brand } from "@config/brand";
import type { Market } from "@config/markets";
import { formatMoney } from "@/lib/money";
import type { CardSummary, ChargeResult, InvoiceSummary, MembershipStart, PaymentsGateway, TierForBilling } from "./gateway";
import { stripeClient, type StripeAccount } from "./stripe";

/**
 * REAL MONEY, THROUGH STRIPE.
 *
 * Facts this relies on (Stripe docs and the Stripe library's own definitions,
 * read Nov 2026):
 *  - Memberships are Stripe subscriptions, one per property, started on
 *    Stripe's hosted card page (Checkout in "subscription" mode). That page
 *    saves the card. Later properties use the saved card with no card page.
 *  - Jobs are charged to the saved card with the customer not present
 *    (off_session + confirm). A declined card comes back as an error, not a
 *    crash, and is reported as "failed".
 *  - Tradies are paid by "separate charges and transfers": the charge lands in
 *    the platform's balance and the tradie's share is transferred later. This
 *    is supported in New Zealand and Australia, same country only. Naming the
 *    original charge (source_transaction) lets the transfer be created before
 *    the charge's money has settled.
 *  - A tradie's payout account is a connected account with the Express
 *    dashboard, where the platform pays Stripe's fees and carries losses.
 *    Stripe's own hosted pages collect their bank and identity details.
 *  - A credit is a negative "customer balance transaction": Stripe takes it
 *    off the owner's next invoice by itself.
 *  - Every call that moves money carries an idempotency key, so a repeat of
 *    the same call can never charge or pay twice.
 *
 * NOT YET RUN AGAINST A REAL STRIPE ACCOUNT. The shapes are checked against
 * Stripe's library by the compiler, and the rules around them are tested with
 * pretend money. Work through docs/STRIPE-TEST-CHECKLIST.md in Stripe's test
 * mode before taking real payments.
 */

function unix(seconds: number | null | undefined): Date {
  return new Date((seconds ?? Math.floor(Date.now() / 1000)) * 1000);
}

function cardOf(method: Stripe.PaymentMethod | string | null | undefined): CardSummary | null {
  if (!method || typeof method === "string") return null;
  return {
    paymentMethodId: method.id,
    brand: method.card?.brand ?? null,
    last4: method.card?.last4 ?? null,
    expMonth: method.card?.exp_month ?? null,
    expYear: method.card?.exp_year ?? null,
  };
}

/** Turns a Stripe invoice into the few facts the app keeps. */
export function invoiceSummary(invoice: Stripe.Invoice): InvoiceSummary {
  const line = invoice.lines?.data?.[0];
  return {
    invoiceId: invoice.id ?? `in_unknown_${invoice.created}`,
    amountCents: invoice.amount_paid ?? 0,
    currency: (invoice.currency ?? "nzd").toUpperCase(),
    periodStart: unix(line?.period?.start ?? invoice.period_start),
    periodEnd: unix(line?.period?.end ?? invoice.period_end),
    paidAt: unix(invoice.status_transitions?.paid_at ?? invoice.created),
  };
}

/** The subscription an invoice belongs to, wherever this version of Stripe's API puts it. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details) return null;
  return typeof details.subscription === "string" ? details.subscription : (details.subscription?.id ?? null);
}

function periodEnd(subscription: Stripe.Subscription): Date {
  return unix(subscription.items?.data?.[0]?.current_period_end);
}

function plainReason(error: unknown): { reason: string; code: string | null; paymentIntentId: string | null } {
  if (error instanceof Stripe.errors.StripeCardError) {
    const intent = (error as unknown as { payment_intent?: { id?: string } }).payment_intent;
    const code = error.code ?? null;
    const reason =
      code === "authentication_required"
        ? "The owner's bank wants them to approve this payment themselves."
        : code === "expired_card"
          ? "The card has expired."
          : code === "insufficient_funds"
            ? "The card was declined (not enough funds)."
            : `The card was declined${error.message ? `: ${error.message}` : "."}`;
    return { reason, code, paymentIntentId: intent?.id ?? null };
  }
  return { reason: error instanceof Error ? error.message : String(error), code: "error", paymentIntentId: null };
}

export type StripeMembership = {
  propertyId: string;
  ownerId: string | null;
  subscriptionId: string;
  customerId: string;
  periodEnd: Date;
  invoice: InvoiceSummary | null;
  card: CardSummary | null;
};

/**
 * Reads a finished membership card page. Called when the owner comes back to
 * the site and again when Stripe tells us in the background, whichever is
 * first. Returns null unless the page was paid and is one of ours.
 */
export async function membershipFromCheckout(account: StripeAccount, sessionId: string): Promise<StripeMembership | null> {
  const stripe = stripeClient(account);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription.default_payment_method", "subscription.latest_invoice"],
  });
  if (session.mode !== "subscription" || session.metadata?.hostfix_purpose !== "membership") return null;
  if (session.status !== "complete" || !session.subscription || typeof session.subscription === "string") return null;
  const subscription = session.subscription;
  const propertyId = session.metadata?.hostfix_property ?? session.client_reference_id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!propertyId || !customerId) return null;

  const card = cardOf(subscription.default_payment_method as Stripe.PaymentMethod | string | null);
  if (card) {
    // Stripe saves the card on the subscription only. Make it the owner's
    // default too, so finished jobs can be charged to it.
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: card.paymentMethodId } });
  }
  const invoice = subscription.latest_invoice && typeof subscription.latest_invoice !== "string" ? subscription.latest_invoice : null;
  return {
    propertyId,
    ownerId: session.metadata?.hostfix_owner ?? null,
    subscriptionId: subscription.id,
    customerId,
    periodEnd: periodEnd(subscription),
    invoice: invoice && invoice.status === "paid" ? invoiceSummary(invoice) : null,
    card,
  };
}

/** The card an owner has chosen as their default, for after they change it on Stripe's page. */
export async function defaultCard(account: StripeAccount, customerId: string): Promise<CardSummary | null> {
  const stripe = stripeClient(account);
  const customer = await stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] });
  if (customer.deleted) return null;
  return cardOf(customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | string | null);
}

export function createStripeGateway(account: StripeAccount): PaymentsGateway {
  const stripe = stripeClient(account);

  async function ensureProduct(tier: TierForBilling, market: Market): Promise<string> {
    if (tier.providerProductId) return tier.providerProductId;
    const product = await stripe.products.create(
      { name: `${brand.name} ${tier.name} membership (${market.name})`, metadata: { hostfix_tier: tier.id, hostfix_market: market.slug } },
      { idempotencyKey: `hostfix-product-${tier.id}` },
    );
    return product.id;
  }

  const monthly = (tier: TierForBilling, market: Market, productId: string) => ({
    currency: market.currency.toLowerCase(),
    product: productId,
    recurring: { interval: "month" as const },
    unit_amount: tier.priceCents,
  });

  async function coupon(input: { propertyId: string; discountCents: number; discountLabel: string | null; market: Market }): Promise<string | null> {
    if (input.discountCents <= 0) return null;
    const created = await stripe.coupons.create(
      {
        amount_off: input.discountCents,
        currency: input.market.currency.toLowerCase(),
        duration: "once",
        max_redemptions: 1,
        name: (input.discountLabel ?? "Credit").slice(0, 40),
      },
      { idempotencyKey: `hostfix-coupon-${input.propertyId}-${input.discountCents}` },
    );
    return created.id;
  }

  return {
    provider: "stripe",
    country: account.country,

    async ensureCustomer(input) {
      if (input.existingCustomerId) return input.existingCustomerId;
      const customer = await stripe.customers.create(
        { name: input.name, email: input.email ?? undefined, phone: input.phone ?? undefined, metadata: { hostfix_owner: input.ownerId } },
        { idempotencyKey: `hostfix-customer-${input.ownerId}` },
      );
      return customer.id;
    },

    async startMembership(input): Promise<MembershipStart & { providerProductId?: string | null }> {
      const productId = await ensureProduct(input.tier, input.market);
      const couponId = await coupon(input);
      const metadata = { hostfix_purpose: "membership", hostfix_property: input.propertyId, hostfix_owner: input.ownerId, hostfix_tier: input.tier.id };
      const price = formatMoney(input.tier.priceCents, input.market.currency);

      const cardPage = async (): Promise<MembershipStart & { providerProductId: string }> => {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: input.customerId,
          client_reference_id: input.propertyId,
          line_items: [{ quantity: 1, price_data: monthly(input.tier, input.market, productId) }],
          subscription_data: { metadata, description: `${input.tier.name} membership: ${input.propertyName}`.slice(0, 500) },
          metadata,
          allowed_payment_method_types: ["card"],
          ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
          custom_text: {
            submit: {
              // What the saved card will be used for. Keep this in step with the terms your lawyer writes.
              message: `Your card is saved. It is charged ${price} a month for this property, and the fixed price of each job logged for it, when that job is finished.`,
            },
          },
          success_url: `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: input.cancelUrl,
        });
        if (!session.url) throw new Error("Stripe did not return a card page address.");
        return { kind: "redirect", url: session.url, providerProductId: productId };
      };

      if (!input.paymentMethodId) return cardPage();

      try {
        const subscription = await stripe.subscriptions.create(
          {
            customer: input.customerId,
            items: [{ price_data: monthly(input.tier, input.market, productId) }],
            default_payment_method: input.paymentMethodId,
            off_session: true,
            payment_behavior: "error_if_incomplete",
            metadata,
            description: `${input.tier.name} membership: ${input.propertyName}`.slice(0, 500),
            ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
            expand: ["latest_invoice"],
          },
          { idempotencyKey: `hostfix-sub-${input.propertyId}-${input.tier.id}-${new Date().toISOString().slice(0, 13)}` },
        );
        const invoice = subscription.latest_invoice && typeof subscription.latest_invoice !== "string" ? subscription.latest_invoice : null;
        if (subscription.status !== "active" || !invoice) return cardPage();
        return { kind: "active", subscriptionId: subscription.id, periodEnd: periodEnd(subscription), invoice: invoiceSummary(invoice), card: null, providerProductId: productId };
      } catch (error) {
        // The saved card did not work. Send the owner to the card page instead.
        if (error instanceof Stripe.errors.StripeCardError) return cardPage();
        throw error;
      }
    },

    async cancelMembership(subscriptionId) {
      const subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      return { endsAt: subscription.cancel_at ? unix(subscription.cancel_at) : periodEnd(subscription) };
    },

    async changeMembershipTier(input) {
      const productId = await ensureProduct(input.tier, input.market);
      const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
      const item = subscription.items.data[0];
      if (!item) throw new Error("That membership has nothing on it to change.");
      await stripe.subscriptions.update(input.subscriptionId, {
        items: [{ id: item.id, price_data: monthly(input.tier, input.market, productId) }],
        // No part-month charge or refund: the new price starts with the next payment.
        proration_behavior: "none",
        metadata: { ...subscription.metadata, hostfix_tier: input.tier.id },
      });
      return { providerProductId: productId };
    },

    async chargeJob(input): Promise<ChargeResult> {
      let paymentMethodId = input.paymentMethodId;
      try {
        if (!paymentMethodId) {
          const card = await defaultCard(account, input.customerId);
          paymentMethodId = card?.paymentMethodId ?? null;
        }
        if (!paymentMethodId) return { status: "failed", reason: "There is no card on file.", code: "no_card", paymentIntentId: null };

        const intent = await stripe.paymentIntents.create(
          {
            amount: input.amountCents,
            currency: input.currency.toLowerCase(),
            customer: input.customerId,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            description: input.description,
            metadata: { hostfix_job: String(input.jobNumber) },
            // Ties the later transfer to the tradie back to this charge.
            transfer_group: `hostfix-job-${input.jobNumber}`,
            ...(input.receiptEmail ? { receipt_email: input.receiptEmail } : {}),
            // Tells the card networks this is a one-off charge on a saved card, agreed to earlier.
            payment_method_options: { card: { stored_credential_usage: "unscheduled" } },
          },
          { idempotencyKey: input.idempotencyKey },
        );
        if (intent.status === "succeeded") {
          const charge = intent.latest_charge;
          return { status: "succeeded", paymentIntentId: intent.id, chargeId: typeof charge === "string" ? charge : (charge?.id ?? null) };
        }
        return { status: "failed", reason: `The payment did not complete (Stripe says "${intent.status}").`, code: intent.status, paymentIntentId: intent.id };
      } catch (error) {
        return { status: "failed", ...plainReason(error) };
      }
    },

    async refund(input) {
      const refund = await stripe.refunds.create(
        // The label lets the webhook tell this refund apart from one made by hand in Stripe's dashboard.
        { payment_intent: input.paymentIntentId, amount: input.amountCents, metadata: { hostfix_refund: "app" } },
        { idempotencyKey: input.idempotencyKey },
      );
      return { refundId: refund.id };
    },

    async creditCustomer(input) {
      const entry = await stripe.customers.createBalanceTransaction(
        input.customerId,
        { amount: -Math.abs(input.amountCents), currency: input.currency.toLowerCase(), description: input.description.slice(0, 350) },
        { idempotencyKey: input.idempotencyKey },
      );
      return { ref: entry.id };
    },

    async billingPortalUrl(input) {
      // Needs the customer portal switched on once in the Stripe dashboard (SETUP.md).
      const session = await stripe.billingPortal.sessions.create({ customer: input.customerId, return_url: input.returnUrl });
      return session.url;
    },

    async createPayoutAccount(input) {
      const created = await stripe.accounts.create(
        {
          country: account.country,
          ...(input.email ? { email: input.email } : {}),
          business_profile: { name: input.businessName.slice(0, 100) },
          controller: {
            stripe_dashboard: { type: "express" },
            fees: { payer: "application" },
            losses: { payments: "application" },
          },
          capabilities: { transfers: { requested: true } },
          metadata: { hostfix_tradie: input.tradieId },
        },
        { idempotencyKey: `hostfix-account-${input.tradieId}` },
      );
      return { accountId: created.id };
    },

    async payoutOnboardingUrl(input) {
      const link = await stripe.accountLinks.create({
        account: input.accountId,
        type: "account_onboarding",
        return_url: input.returnUrl,
        refresh_url: input.refreshUrl,
      });
      return link.url;
    },

    async payoutAccountStatus(accountId) {
      const found = await stripe.accounts.retrieve(accountId);
      return {
        payoutsEnabled: Boolean(found.payouts_enabled) && found.capabilities?.transfers === "active",
        detailsSubmitted: Boolean(found.details_submitted),
      };
    },

    async payoutDashboardUrl(accountId) {
      try {
        return (await stripe.accounts.createLoginLink(accountId)).url;
      } catch {
        return null;
      }
    },

    async transfer(input) {
      const sent = await stripe.transfers.create(
        {
          amount: input.amountCents,
          currency: input.currency.toLowerCase(),
          destination: input.accountId,
          transfer_group: `hostfix-job-${input.jobNumber}`,
          ...(input.chargeId ? { source_transaction: input.chargeId } : {}),
          metadata: { hostfix_job: String(input.jobNumber) },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { transferId: sent.id };
    },

    async reverseTransfer(input) {
      await stripe.transfers.createReversal(input.transferId, { amount: input.amountCents }, { idempotencyKey: input.idempotencyKey });
    },
  };
}
