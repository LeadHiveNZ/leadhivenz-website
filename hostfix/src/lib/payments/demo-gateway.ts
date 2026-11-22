import type { CountryCode } from "@config/markets";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { randomToken } from "@/lib/ids";
import { addMonths, type CardSummary, type ChargeResult, type HoldResult, type InvoiceSummary, type PaymentsGateway } from "./gateway";

/**
 * PRETEND MONEY, for demo mode and the automated tests. It follows the same
 * steps as the real thing (a card page, a monthly charge, a transfer to the
 * tradie) but no money moves. It can never be used on the live site.
 *
 * Two switches make the unhappy paths easy to see:
 *  - a card whose id ends in "declines" is always declined
 *  - a payout account whose id ends in "broken" always fails
 *
 * Holds on the card (DECISIONS.md, 2026-11-23) behave as Stripe's do: a
 * declining card declines the hold too; a hold lasts 4 days 18 hours on the
 * app's clock (the shortest card window, a Visa payment the merchant starts);
 * taking from it never takes more than was held; letting it go costs nothing.
 */

/** How long a pretend hold lasts: 4 days 18 hours, like Stripe's shortest (Visa, merchant-initiated). */
export const DEMO_HOLD_HOURS = 4 * 24 + 18;

export const DEMO_CARD_OK: CardSummary = { paymentMethodId: "demo_pm_ok", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
export const DEMO_CARD_DECLINES: CardSummary = { paymentMethodId: "demo_pm_declines", brand: "visa", last4: "0002", expMonth: 12, expYear: 2030 };

export type DemoCheckout = {
  id: string;
  ownerId: string;
  /** Null for a Portfolio retainer, which is for the whole account. */
  propertyId: string | null;
  portfolioId?: string | null;
  propertyName: string;
  tierId: string;
  tierName: string;
  priceCents: number;
  discountCents: number;
  discountLabel: string | null;
  currency: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  completed: boolean;
  /** True for a free membership: the page only saves a card, and nothing is charged. */
  setupOnly?: boolean;
};

const checkoutKey = (id: string) => `demo_checkout:${id}`;

export async function getDemoCheckout(db: Db, id: string): Promise<DemoCheckout | null> {
  const rows = await db.query<{ value: DemoCheckout }>("select value from public.app_state where key = $1", [checkoutKey(id)]);
  return rows[0]?.value ?? null;
}

async function saveDemoCheckout(db: Db, checkout: DemoCheckout): Promise<void> {
  await db.query(
    `insert into public.app_state (key, value, updated_at) values ($1, $2::jsonb, $3::timestamptz)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [checkoutKey(checkout.id), JSON.stringify(checkout), now().toISOString()],
  );
}

function demoInvoice(amountCents: number, currency: string): InvoiceSummary {
  const at = now();
  return { invoiceId: `demo_in_${randomToken(14)}`, amountCents, currency, periodStart: at, periodEnd: addMonths(at, 1), paidAt: at };
}

/** The owner pressed "Pay" on the pretend card page. Returns what a real card page would have told us. */
export async function completeDemoCheckout(
  db: Db,
  id: string,
): Promise<{ checkout: DemoCheckout; subscriptionId: string; periodEnd: Date; invoice: InvoiceSummary; card: CardSummary } | null> {
  const checkout = await getDemoCheckout(db, id);
  if (!checkout || checkout.completed || checkout.setupOnly) return null;
  await saveDemoCheckout(db, { ...checkout, completed: true });
  const invoice = demoInvoice(Math.max(0, checkout.priceCents - checkout.discountCents), checkout.currency);
  return { checkout, subscriptionId: `demo_sub_${randomToken(14)}`, periodEnd: invoice.periodEnd, invoice, card: DEMO_CARD_OK };
}

/** The owner pressed "Save card" on the pretend card page for a free membership. Nothing is charged. */
export async function completeDemoCardSetup(db: Db, id: string): Promise<{ checkout: DemoCheckout; card: CardSummary } | null> {
  const checkout = await getDemoCheckout(db, id);
  if (!checkout || checkout.completed || !checkout.setupOnly) return null;
  await saveDemoCheckout(db, { ...checkout, completed: true });
  return { checkout, card: DEMO_CARD_OK };
}

export function createDemoGateway(db: Db, country: CountryCode): PaymentsGateway {
  return {
    provider: "demo",
    country,

    async ensureCustomer(input) {
      return input.existingCustomerId ?? `demo_cus_${input.ownerId.replace(/-/g, "").slice(0, 16)}`;
    },

    async startMembership(input) {
      if (!input.paymentMethodId) {
        const checkout: DemoCheckout = {
          id: randomToken(16),
          ownerId: input.ownerId,
          propertyId: input.propertyId,
          portfolioId: input.portfolioId ?? null,
          propertyName: input.propertyName,
          tierId: input.tier.id,
          tierName: input.tier.name,
          priceCents: input.tier.priceCents,
          discountCents: input.discountCents,
          discountLabel: input.discountLabel,
          currency: input.market.currency,
          customerId: input.customerId,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          completed: false,
        };
        await saveDemoCheckout(db, checkout);
        return { kind: "redirect", url: `/demo/checkout/${checkout.id}` };
      }
      if (input.paymentMethodId.endsWith("declines")) {
        // A real card page would let them try another card.
        return { kind: "redirect", url: `/demo/card/${input.ownerId}?declined=1` };
      }
      const invoice = demoInvoice(Math.max(0, input.tier.priceCents - input.discountCents), input.market.currency);
      return { kind: "active", subscriptionId: `demo_sub_${randomToken(14)}`, periodEnd: invoice.periodEnd, invoice, card: null };
    },

    async startCardSetup(input) {
      const checkout: DemoCheckout = {
        id: randomToken(16),
        ownerId: input.ownerId,
        propertyId: input.propertyId,
        portfolioId: null,
        propertyName: input.propertyName,
        tierId: "",
        tierName: "Free",
        priceCents: 0,
        discountCents: 0,
        discountLabel: null,
        currency: input.market.currency,
        customerId: input.customerId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        completed: false,
        setupOnly: true,
      };
      await saveDemoCheckout(db, checkout);
      return { url: `/demo/checkout/${checkout.id}` };
    },

    async cancelMembership() {
      return { endsAt: null };
    },

    async changeMembershipTier() {
      return {};
    },

    async changeMembershipPrice() {
      // Pretend money: the next demo renewal charges the portfolio's band from the database.
    },

    async chargeJob(input): Promise<ChargeResult> {
      if (!input.paymentMethodId) {
        return { status: "failed", reason: "There is no card on file.", code: "no_card", paymentIntentId: null };
      }
      if (input.paymentMethodId.endsWith("declines")) {
        return { status: "failed", reason: "The card was declined.", code: "card_declined", paymentIntentId: `demo_pi_${input.idempotencyKey.replace(/[^a-z0-9]/gi, "").slice(-18)}` };
      }
      const ref = input.idempotencyKey.replace(/[^a-z0-9]/gi, "").slice(-18);
      return { status: "succeeded", paymentIntentId: `demo_pi_${ref}`, chargeId: `demo_ch_${ref}` };
    },

    async placeHold(input): Promise<HoldResult> {
      if (!input.paymentMethodId) return { status: "declined", reason: "There is no card on file.", code: "no_card", paymentIntentId: null };
      const ref = input.idempotencyKey.replace(/[^a-z0-9]/gi, "").slice(-18);
      if (input.paymentMethodId.endsWith("declines")) {
        return { status: "declined", reason: "The card was declined.", code: "card_declined", paymentIntentId: `demo_pi_${ref}` };
      }
      return { status: "held", paymentIntentId: `demo_pi_${ref}`, chargeId: `demo_ch_${ref}`, captureBefore: new Date(now().getTime() + DEMO_HOLD_HOURS * 3_600_000) };
    },

    async captureHold(input) {
      // The app never asks for more than it held; a real hold would refuse it.
      return { status: "captured", amountCents: input.amountCents, chargeId: input.paymentIntentId.replace(/^demo_pi_/, "demo_ch_") };
    },

    async cancelHold() {
      // Nothing was charged, so there is nothing to give back.
    },

    async refund(input) {
      return { refundId: `demo_re_${input.idempotencyKey.replace(/[^a-z0-9]/gi, "").slice(-18)}` };
    },

    async creditCustomer(input) {
      return { ref: `demo_cbtxn_${input.idempotencyKey.replace(/[^a-z0-9]/gi, "").slice(-18)}` };
    },

    async billingPortalUrl(input) {
      return `/demo/card/${input.ownerId}`;
    },

    async createPayoutAccount(input) {
      return { accountId: `demo_acct_${input.tradieId.replace(/-/g, "").slice(0, 16)}` };
    },

    async payoutOnboardingUrl(input) {
      return `/demo/payout-setup/${input.tradieId}`;
    },

    async payoutAccountStatus(accountId) {
      const rows = await db.query<{ payouts_enabled: boolean }>("select payouts_enabled from public.tradies where payout_account_id = $1", [accountId]);
      const enabled = rows[0]?.payouts_enabled ?? false;
      return { payoutsEnabled: enabled, detailsSubmitted: enabled };
    },

    async payoutDashboardUrl() {
      return null;
    },

    async transfer(input) {
      if (input.accountId.endsWith("broken")) throw new Error("The tradie's payout account cannot receive money.");
      return { transferId: `demo_tr_${input.idempotencyKey.replace(/[^a-z0-9]/gi, "").slice(-18)}` };
    },

    async reverseTransfer() {
      // Nothing to pull back in the demo.
    },
  };
}
