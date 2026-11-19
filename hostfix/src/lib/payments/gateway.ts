import type { CountryCode, Market } from "@config/markets";

/**
 * THE PAYMENT COMPANY, as the rest of the app sees it.
 *
 * Two things sit behind this shape:
 *   - stripe-gateway.ts  real money, through Stripe
 *   - demo-gateway.ts    pretend money, for demo mode and the automated tests
 *
 * The rest of the app never talks to Stripe directly. That keeps every rule
 * about money (who is charged, when the tradie is paid, what a refund does)
 * in one tested place, and makes the rules run the same in the demo.
 */

export type Provider = "stripe" | "demo";

export type CardSummary = {
  paymentMethodId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export type InvoiceSummary = {
  invoiceId: string;
  /** What was actually charged, after any credit. */
  amountCents: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date;
};

export type MembershipStart =
  | { kind: "redirect"; url: string }
  | { kind: "active"; subscriptionId: string; periodEnd: Date; invoice: InvoiceSummary; card: CardSummary | null };

export type ChargeResult =
  | { status: "succeeded"; paymentIntentId: string; chargeId: string | null }
  | {
      status: "failed";
      /** In plain words, for the dispatcher. */
      reason: string;
      code: string | null;
      paymentIntentId: string | null;
    };

/**
 * Thrown by transfer() when the payment company says the platform's own
 * available balance is too low to send it. Nothing was sent, so it is safe to
 * try again (with a new key) once there is money there. Only a transfer that
 * is not tied to a successful charge (a tradie paid ahead of the owner's
 * card) needs that balance: one tied to a charge is sent from the charge.
 */
export class PlatformBalanceTooLow extends Error {
  constructor(message = "The HostFix Stripe balance is too low to send this payment.") {
    super(message);
    this.name = "PlatformBalanceTooLow";
  }
}

export type TierForBilling = { id: string; key: string; name: string; priceCents: number; providerProductId: string | null };

export interface PaymentsGateway {
  readonly provider: Provider;
  readonly country: CountryCode;

  /** Makes sure the owner exists in the payment company's system. Returns their id there. */
  ensureCustomer(input: { ownerId: string; name: string; email: string | null; phone: string | null; existingCustomerId: string | null }): Promise<string>;

  /**
   * Starts the monthly membership for one property, or the one retainer for a
   * Portfolio account (portfolioId set, propertyId null). With no card on file
   * the owner is sent to a card page. With one, it starts at once.
   */
  startMembership(input: {
    customerId: string;
    paymentMethodId: string | null;
    ownerId: string;
    propertyId: string | null;
    /** Set for a Portfolio retainer: one payment for the whole account. */
    portfolioId?: string | null;
    /** The property's name, or for a Portfolio a line like "Portfolio, 12 properties". */
    propertyName: string;
    tier: TierForBilling;
    market: Market;
    /** Taken off the first month, for example a founding deposit already paid. */
    discountCents: number;
    discountLabel: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<MembershipStart & { providerProductId?: string | null }>;

  /**
   * For a free membership: sends the owner to the payment company's own page
   * to save a card, with nothing charged. They come back to successUrl, and
   * the property is covered once the card is saved.
   */
  startCardSetup(input: {
    customerId: string;
    ownerId: string;
    propertyId: string;
    propertyName: string;
    market: Market;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;

  /** Stops the membership at the end of the month already paid for. */
  cancelMembership(subscriptionId: string): Promise<{ endsAt: Date | null }>;
  /** Moves a membership to another tier from the next payment. */
  changeMembershipTier(input: { subscriptionId: string; tier: TierForBilling; market: Market }): Promise<{ providerProductId?: string | null }>;
  /**
   * Changes what a Portfolio retainer charges, from the next monthly payment.
   * Never a part-month charge or refund. The key makes a repeat of the same
   * change harmless.
   */
  changeMembershipPrice(input: { subscriptionId: string; tier: TierForBilling; market: Market; idempotencyKey: string }): Promise<void>;

  /** Charges the owner's saved card for a finished job. Never throws for a declined card. */
  chargeJob(input: {
    customerId: string;
    paymentMethodId: string | null;
    amountCents: number;
    currency: string;
    description: string;
    jobNumber: number;
    receiptEmail: string | null;
    /** The same key always produces the same charge, never two. */
    idempotencyKey: string;
  }): Promise<ChargeResult>;

  refund(input: { paymentIntentId: string; amountCents: number; idempotencyKey: string }): Promise<{ refundId: string }>;

  /** Gives the owner credit that comes off their next membership payment. */
  creditCustomer(input: { customerId: string; amountCents: number; currency: string; description: string; idempotencyKey: string }): Promise<{ ref: string }>;

  /** A page where the owner can change their card or see their payments. */
  billingPortalUrl(input: { customerId: string; ownerId: string; returnUrl: string }): Promise<string>;

  /** Tradie payouts. */
  /** Trades are the tradie's trade keys (config/trades.ts), used to fill in what the business does. */
  createPayoutAccount(input: { tradieId: string; businessName: string; email: string | null; trades: string[] }): Promise<{ accountId: string }>;
  payoutOnboardingUrl(input: { accountId: string; tradieId: string; returnUrl: string; refreshUrl: string }): Promise<string>;
  payoutAccountStatus(accountId: string): Promise<{ payoutsEnabled: boolean; detailsSubmitted: boolean }>;
  payoutDashboardUrl(accountId: string): Promise<string | null>;

  /**
   * Moves the tradie's share to their account. The same key never pays twice.
   * Throws PlatformBalanceTooLow when the platform's available balance cannot cover it.
   */
  transfer(input: { accountId: string; amountCents: number; currency: string; chargeId: string | null; jobNumber: number; idempotencyKey: string }): Promise<{ transferId: string }>;
  reverseTransfer(input: { transferId: string; amountCents: number; idempotencyKey: string }): Promise<void>;
}

/** Adds whole calendar months, keeping the day where possible (31 Jan + 1 month = 28 Feb). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
