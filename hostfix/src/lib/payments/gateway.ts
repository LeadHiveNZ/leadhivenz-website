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
 * A hold on the owner's saved card (DECISIONS.md, 2026-11-23): the price is reserved, nothing is charged.
 * Stripe: a PaymentIntent with capture_method "manual", confirmed off-session on the saved card. It lasts until
 * `captureBefore` (the charge's payment_method_details.card.capture_before): about 7 days, and 4 days 18 hours
 * for a Visa payment the merchant starts (docs.stripe.com/payments/place-a-hold-on-a-payment-method, read 23 Nov 2026).
 */
export type HoldResult =
  | { status: "held"; paymentIntentId: string; chargeId: string | null; captureBefore: Date | null }
  | { status: "declined"; reason: string; code: string | null; paymentIntentId: string | null };

/**
 * The owner's NZ bank account, saved once with a Direct Debit Authority (DECISIONS.md, 2026-11-23, second entry).
 * Stripe: a PaymentMethod of type nz_bank_account saved by a SetupIntent, whose mandate is the authority
 * (docs.stripe.com/payments/nz-bank-account and /set-up-payment, read 23 Nov 2026).
 */
export type BankSummary = { paymentMethodId: string; bankName: string | null; last4: string | null; mandateId: string | null };

/**
 * A direct debit from the owner's bank account. Stripe confirms it at once and it sits at "processing" until the
 * bank pays (several working days) or says no ("requires_payment_method", with the reason in last_payment_error).
 * Failed here means definitely not taken: nothing will arrive.
 */
export type DebitResult =
  | { status: "processing"; paymentIntentId: string; chargeId: string | null }
  | { status: "succeeded"; paymentIntentId: string; chargeId: string | null }
  | { status: "failed"; reason: string; code: string | null; paymentIntentId: string | null };

/** Taking the charge from a hold: never more than was held. A partial capture lets the rest go. */
export type CaptureResult =
  | { status: "captured"; amountCents: number; chargeId: string | null }
  /** The hold can no longer be taken from (it ran out or was let go): charge the card the usual way instead. */
  | { status: "gone"; reason: string };

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

/**
 * The payment company answered and definitely refused the transfer: nothing was sent. Only then may the next
 * try use a new idempotency key (Stripe replays a saved error for the same key for 24 hours). A timeout, a
 * network error, a 409 or a 5xx leaves it unknown whether money moved, so those keep the same key
 * (docs.stripe.com/api/idempotent_requests, docs.stripe.com/error-low-level, read 19 Nov 2026).
 */
export class TransferRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferRefused";
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

  /**
   * Sends the owner to the payment company's own page to add their NZ bank account and agree the Direct Debit
   * Authority (DECISIONS.md, 2026-11-23, second entry). Nothing is taken. They come back to successUrl.
   */
  startBankSetup(input: { customerId: string; ownerId: string; market: Market; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;

  /**
   * A direct debit from the owner's saved bank account, customer not present. Never throws for a definite "no"
   * (that is "failed"); anything thrown means the outcome is unknown and the next try must use the same key.
   */
  debitBank(input: {
    customerId: string;
    paymentMethodId: string;
    amountCents: number;
    currency: string;
    description: string;
    jobNumber: number;
    /** deposit: half of big work, when the owner approves it. job: the rest of the job, at Job done. */
    purpose: "deposit" | "job";
    idempotencyKey: string;
  }): Promise<DebitResult>;

  /** Where a debit has got to. Asked by the timer, in case the payment company's message never arrived. */
  debitStatus(paymentIntentId: string): Promise<DebitResult>;

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

  /**
   * Places a hold for the job's known price on the owner's saved card, with the customer not present. Never throws
   * for a declined card. The same key always gives the same hold, never two.
   */
  placeHold(input: {
    customerId: string;
    paymentMethodId: string | null;
    amountCents: number;
    currency: string;
    description: string;
    jobNumber: number;
    idempotencyKey: string;
  }): Promise<HoldResult>;

  /** Takes up to the held amount from a hold. Never more: anything beyond it is a separate chargeJob. */
  captureHold(input: { paymentIntentId: string; amountCents: number; idempotencyKey: string }): Promise<CaptureResult>;

  /** Lets a hold go. Nothing is charged and there is no fee. Safe to call on one already let go. */
  cancelHold(input: { paymentIntentId: string; idempotencyKey: string }): Promise<void>;

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
   * Throws PlatformBalanceTooLow when the platform's available balance cannot cover it, and TransferRefused
   * for any other definite refusal (nothing sent). Anything else thrown means the outcome is unknown.
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
