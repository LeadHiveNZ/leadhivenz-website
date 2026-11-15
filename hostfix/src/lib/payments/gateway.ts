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

export type TierForBilling = { id: string; key: string; name: string; priceCents: number; providerProductId: string | null };

export interface PaymentsGateway {
  readonly provider: Provider;
  readonly country: CountryCode;

  /** Makes sure the owner exists in the payment company's system. Returns their id there. */
  ensureCustomer(input: { ownerId: string; name: string; email: string | null; phone: string | null; existingCustomerId: string | null }): Promise<string>;

  /**
   * Starts the monthly membership for one property. With no card on file the
   * owner is sent to a card page. With one, the membership starts at once.
   */
  startMembership(input: {
    customerId: string;
    paymentMethodId: string | null;
    ownerId: string;
    propertyId: string;
    propertyName: string;
    tier: TierForBilling;
    market: Market;
    /** Taken off the first month, for example a founding deposit already paid. */
    discountCents: number;
    discountLabel: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<MembershipStart & { providerProductId?: string | null }>;

  /** Stops the membership at the end of the month already paid for. */
  cancelMembership(subscriptionId: string): Promise<{ endsAt: Date | null }>;
  /** Moves a membership to another tier from the next payment. */
  changeMembershipTier(input: { subscriptionId: string; tier: TierForBilling; market: Market }): Promise<{ providerProductId?: string | null }>;

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
  createPayoutAccount(input: { tradieId: string; businessName: string; email: string | null }): Promise<{ accountId: string }>;
  payoutOnboardingUrl(input: { accountId: string; tradieId: string; returnUrl: string; refreshUrl: string }): Promise<string>;
  payoutAccountStatus(accountId: string): Promise<{ payoutsEnabled: boolean; detailsSubmitted: boolean }>;
  payoutDashboardUrl(accountId: string): Promise<string | null>;

  /** Moves the tradie's share to their account. The same key never pays twice. */
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
