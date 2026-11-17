import "server-only";
import type Stripe from "stripe";
import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { raiseException } from "@/lib/ops/exceptions";
import { findOwnerByCustomer, saveBilling } from "@/lib/owners/service";
import { activatePortfolio } from "@/lib/properties/portfolio";
import { activateFreeMembership, activateMembership, endMembership, recordMembershipPaymentFailed, recordRenewal } from "@/lib/properties/service";
import type { StripeMessage } from "./deposit";
import { stripeClient, type StripeAccount } from "./stripe";
import { cardFromSetupCheckout, defaultCard, invoiceSubscriptionId, invoiceSummary, membershipFromCheckout } from "./stripe-gateway";

/**
 * WHAT STRIPE TELLS US ABOUT MEMBERSHIPS AND JOB PAYMENTS.
 *
 * Stripe sends a signed message whenever something happens to money: a
 * membership starts, a monthly payment goes through or fails, an owner
 * cancels or changes their card, a bank reverses a payment. This file acts on
 * each one. Every step is safe to repeat, because Stripe sometimes sends the
 * same message twice.
 *
 * A message that is not about a membership or a job is handed back (null),
 * and the founding-deposit code looks at it instead.
 */

export type ProductOutcome = { handled: true; outcome: string } | null;

type Fetchers = {
  invoice: (id: string) => Promise<Stripe.Invoice>;
  subscription: (id: string) => Promise<Stripe.Subscription>;
  dispute: (id: string) => Promise<Stripe.Dispute>;
  charge: (id: string) => Promise<Stripe.Charge>;
  session: (id: string) => Promise<Stripe.Checkout.Session>;
  refundsFor: (paymentIntentId: string) => Promise<Stripe.Refund[]>;
};

export type ProductDeps = {
  /** Replaced in tests. */
  fetch?: Partial<Fetchers>;
  membershipFromCheckout?: typeof membershipFromCheckout;
  cardFromSetupCheckout?: typeof cardFromSetupCheckout;
  defaultCard?: typeof defaultCard;
};

function fetchers(account: StripeAccount, overrides: Partial<Fetchers> = {}): Fetchers {
  const stripe = () => stripeClient(account);
  return {
    invoice: overrides.invoice ?? ((id) => stripe().invoices.retrieve(id)),
    subscription: overrides.subscription ?? ((id) => stripe().subscriptions.retrieve(id)),
    dispute: overrides.dispute ?? ((id) => stripe().disputes.retrieve(id)),
    charge: overrides.charge ?? ((id) => stripe().charges.retrieve(id)),
    session: overrides.session ?? ((id) => stripe().checkout.sessions.retrieve(id)),
    refundsFor: overrides.refundsFor ?? (async (paymentIntentId) => (await stripe().refunds.list({ payment_intent: paymentIntentId, limit: 100 })).data),
  };
}

const idOf = (value: string | { id?: string } | null | undefined): string | null => (typeof value === "string" ? value : (value?.id ?? null));

/** The kind of message and the record it is about, whichever of Stripe's two shapes it arrived in. */
async function unpack(message: StripeMessage, get: Fetchers): Promise<{ type: string; id: string; object: unknown } | null> {
  if (message.kind === "snapshot") return { type: message.event.type, id: message.event.id, object: message.event.data.object };
  const type = message.type.replace(/^v1\./, "");
  const related = message.relatedObjectId;
  if (!related) return null;
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return { type, id: message.id, object: await get.session(related) };
    case "invoice.paid":
    case "invoice.payment_failed":
      return { type, id: message.id, object: await get.invoice(related) };
    case "customer.subscription.deleted":
    case "customer.subscription.updated":
      return { type, id: message.id, object: await get.subscription(related) };
    case "charge.dispute.created":
      return { type, id: message.id, object: await get.dispute(related) };
    case "charge.refunded":
      return { type, id: message.id, object: await get.charge(related) };
    case "customer.updated":
      return { type, id: message.id, object: { id: related } };
    default:
      return null;
  }
}

export async function handleProductMessage(db: Db, message: StripeMessage, account: StripeAccount, deps: ProductDeps = {}): Promise<ProductOutcome> {
  const get = fetchers(account, deps.fetch);
  const event = await unpack(message, get);
  if (!event) return null;

  switch (event.type) {
    // A membership card page was completed.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.object as Stripe.Checkout.Session;
      // A free membership: the page only saved a card, and the property is covered once it has.
      if (session.mode === "setup" && session.metadata?.hostfix_purpose === "card_setup") {
        const saved = await (deps.cardFromSetupCheckout ?? cardFromSetupCheckout)(account, session.id);
        if (!saved) return { handled: true, outcome: "card_not_saved" };
        const owner = await findOwnerByCustomer(db, "stripe", saved.customerId);
        if (!owner) return { handled: true, outcome: "property_missing" };
        const property = await activateFreeMembership(db, { propertyId: saved.propertyId, ownerId: owner.ownerId, provider: "stripe", customerId: saved.customerId, card: saved.card });
        return { handled: true, outcome: property ? "free_membership_started" : "property_missing" };
      }
      if (session.mode !== "subscription" || session.metadata?.hostfix_purpose !== "membership") return null;
      const membership = await (deps.membershipFromCheckout ?? membershipFromCheckout)(account, session.id);
      if (!membership) return { handled: true, outcome: "membership_not_paid" };
      if (membership.portfolioId) {
        const portfolio = await activatePortfolio(db, {
          portfolioId: membership.portfolioId, provider: "stripe", subscriptionId: membership.subscriptionId, periodEnd: membership.periodEnd,
          invoice: membership.invoice, card: membership.card, customerId: membership.customerId,
        });
        return { handled: true, outcome: portfolio ? "portfolio_started" : "portfolio_missing" };
      }
      if (!membership.propertyId) return { handled: true, outcome: "property_missing" };
      const property = await activateMembership(db, {
        propertyId: membership.propertyId, provider: "stripe", subscriptionId: membership.subscriptionId, periodEnd: membership.periodEnd,
        invoice: membership.invoice, card: membership.card, customerId: membership.customerId,
      });
      return { handled: true, outcome: property ? "membership_started" : "property_missing" };
    }

    // A monthly payment went through.
    case "invoice.paid": {
      const invoice = event.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return null;
      const fresh = await recordRenewal(db, { provider: "stripe", subscriptionId, invoice: invoiceSummary(invoice) });
      return { handled: true, outcome: fresh ? "membership_paid" : "nothing_to_change" };
    }

    // A monthly payment failed. New jobs are held until the card is fixed.
    case "invoice.payment_failed": {
      const invoice = event.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return null;
      const fresh = await recordMembershipPaymentFailed(db, {
        provider: "stripe", subscriptionId, invoice: invoiceSummary(invoice), updateCardUrl: `${baseUrl()}/app/billing`,
      });
      return { handled: true, outcome: fresh ? "membership_payment_failed" : "nothing_to_change" };
    }

    // The membership has ended: cancelled and run out, or given up on after failed payments.
    case "customer.subscription.deleted": {
      const subscription = event.object as Stripe.Subscription;
      const ended = await endMembership(db, { provider: "stripe", subscriptionId: subscription.id });
      return { handled: true, outcome: ended ? "membership_ended" : "nothing_to_change" };
    }

    // Something about the membership changed, for example the owner cancelled from Stripe's own page.
    case "customer.subscription.updated": {
      const subscription = event.object as Stripe.Subscription;
      const end = subscription.items?.data?.[0]?.current_period_end;
      const rows = await db.query(
        `update public.properties set cancel_at_period_end = $2,
                current_period_end = coalesce($3::timestamptz, current_period_end)
          where subscription_provider = 'stripe' and subscription_id = $1 and status <> 'cancelled'
            and (cancel_at_period_end is distinct from $2 or ($3::timestamptz is not null and current_period_end is distinct from $3::timestamptz))
          returning id`,
        [subscription.id, subscription.cancel_at_period_end === true || subscription.cancel_at != null, end ? new Date(end * 1000).toISOString() : null],
      );
      // The same for a Portfolio retainer, and the properties on it.
      const retainers = await db.query<{ id: string }>(
        `update public.portfolios set cancel_at_period_end = $2,
                current_period_end = coalesce($3::timestamptz, current_period_end)
          where subscription_provider = 'stripe' and subscription_id = $1 and status <> 'cancelled'
            and (cancel_at_period_end is distinct from $2 or ($3::timestamptz is not null and current_period_end is distinct from $3::timestamptz))
          returning id`,
        [subscription.id, subscription.cancel_at_period_end === true || subscription.cancel_at != null, end ? new Date(end * 1000).toISOString() : null],
      );
      for (const retainer of retainers) {
        await db.query(
          `update public.properties set cancel_at_period_end = p.cancel_at_period_end, current_period_end = p.current_period_end
             from public.portfolios p where p.id = $1::uuid and properties.portfolio_id = p.id and properties.status <> 'cancelled'`,
          [retainer.id],
        );
      }
      return { handled: true, outcome: rows.length + retainers.length > 0 ? "membership_updated" : "nothing_to_change" };
    }

    // The owner's bank has reversed a payment. This has a deadline, so it goes straight to the queue.
    case "charge.dispute.created": {
      const dispute = event.object as Stripe.Dispute;
      const paymentIntentId = idOf(dispute.payment_intent);
      const amount = formatMoney(dispute.amount, dispute.currency.toUpperCase());
      const found = paymentIntentId
        ? await db.query<{ job_id: string; number: number; market: string }>(
            "select p.job_id, j.number, j.market from public.payments p join public.jobs j on j.id = p.job_id where p.payment_intent_id = $1",
            [paymentIntentId],
          )
        : [];
      const job = found[0];
      if (job) {
        const paused = await db.query("update public.payouts set status = 'paused' where job_id = $1::uuid and status in ('waiting', 'scheduled') returning id", [job.job_id]);
        await audit(db, {
          actor: "stripe", action: "chargeback.opened", entity: "job", entityId: job.job_id, amount: dispute.amount, currency: dispute.currency.toUpperCase(),
          detail: { dispute: dispute.id, reason: dispute.reason, payout_paused: paused.length > 0 }, dedupeKey: `chargeback.opened:${dispute.id}`,
        });
        await raiseException(db, {
          kind: "chargeback", market: job.market, jobId: job.job_id,
          summary: `Job ${Number(job.number)}: the owner's bank has reversed the ${amount} payment (${dispute.reason.replace(/_/g, " ")}). ${paused.length > 0 ? "The tradie's payment is on hold." : "The tradie has already been paid."} Answer it in Stripe before the deadline shown there.`,
          dedupeKey: `chargeback:${dispute.id}`,
        });
        return { handled: true, outcome: "chargeback_on_job" };
      }
      await audit(db, {
        actor: "stripe", action: "chargeback.opened", entity: "payment", entityId: paymentIntentId, amount: dispute.amount, currency: dispute.currency.toUpperCase(),
        detail: { dispute: dispute.id, reason: dispute.reason }, dedupeKey: `chargeback.opened:${dispute.id}`,
      });
      await raiseException(db, {
        kind: "chargeback",
        summary: `A bank has reversed a ${amount} payment that is not for a job (most likely a membership or a founding deposit). Answer it in Stripe before the deadline shown there.`,
        dedupeKey: `chargeback:${dispute.id}`,
      });
      return { handled: true, outcome: "chargeback_other" };
    }

    // The owner changed their card on Stripe's page.
    case "customer.updated": {
      const customerId = idOf(event.object as { id?: string });
      if (!customerId) return null;
      const owner = await findOwnerByCustomer(db, "stripe", customerId);
      if (!owner) return null;
      const card = await (deps.defaultCard ?? defaultCard)(account, customerId);
      if (!card) return { handled: true, outcome: "no_card" };
      await saveBilling(db, { ownerId: owner.ownerId, country: owner.country, provider: "stripe", customerId, card });
      return { handled: true, outcome: "card_updated" };
    }

    // A refund. Refunds made on the job page are already in our books. One
    // made by hand in Stripe's dashboard is not, so it is recorded and flagged.
    case "charge.refunded": {
      const charge = event.object as Stripe.Charge;
      const paymentIntentId = idOf(charge.payment_intent);
      if (!paymentIntentId) return null;
      const found = await db.query<{ id: string; job_id: string; number: number; market: string; currency: string }>(
        "select p.id, p.job_id, j.number, j.market, p.currency from public.payments p join public.jobs j on j.id = p.job_id where p.payment_intent_id = $1",
        [paymentIntentId],
      );
      const payment = found[0];
      if (!payment) return null;
      let outside = 0;
      for (const refund of await get.refundsFor(paymentIntentId)) {
        if (refund.metadata?.hostfix_refund === "app" || refund.status === "failed" || refund.status === "canceled") continue;
        const first = await audit(db, {
          actor: "stripe", action: "refund.made_outside_app", entity: "job", entityId: payment.job_id, amount: refund.amount, currency: payment.currency,
          detail: { refund: refund.id }, dedupeKey: `refund.outside:${refund.id}`,
        });
        if (!first) continue;
        outside += refund.amount;
        await db.query(
          `update public.payments set refunded_cents = least(amount_cents, refunded_cents + $2),
                  status = case when least(amount_cents, refunded_cents + $2) >= amount_cents then 'refunded' else 'part_refunded' end
            where id = $1::uuid`,
          [payment.id, refund.amount],
        );
      }
      if (outside === 0) return { handled: true, outcome: "nothing_to_change" };
      await raiseException(db, {
        kind: "needs_review", market: payment.market, jobId: payment.job_id,
        summary: `Job ${Number(payment.number)}: ${formatMoney(outside, payment.currency)} was refunded in Stripe, not on the job page. The owner has their money, but the tradie's payment was not changed. Decide whether it should be. Next time, refund from the job page so both are done together.`,
        dedupeKey: `refund_outside:${paymentIntentId}:${outside}`,
      });
      return { handled: true, outcome: "refund_outside_app" };
    }

    default:
      return null;
  }
}
