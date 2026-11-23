import "server-only";
import type Stripe from "stripe";
import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db/types";
import { baseUrl } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { refundSplit } from "@/lib/jobs/pricing";
import { closeChargeback, recordChargeback } from "@/lib/billing/chargebacks";
import { raiseException } from "@/lib/ops/exceptions";
import { settleDebit } from "@/lib/billing/debits";
import { findOwnerByCustomer, saveBank, saveBilling } from "@/lib/owners/service";
import { activatePortfolio } from "@/lib/properties/portfolio";
import { activateFreeMembership, activateMembership, endMembership, recordMembershipPaymentFailed, recordRenewal } from "@/lib/properties/service";
import type { StripeMessage } from "./deposit";
import { stripeClient, type StripeAccount } from "./stripe";
import { bankFromSetupCheckout, cardFromSetupCheckout, debitOf, defaultCard, invoiceSubscriptionId, invoiceSummary, membershipFromCheckout } from "./stripe-gateway";

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
  paymentIntent: (id: string) => Promise<Stripe.PaymentIntent>;
};

export type ProductDeps = {
  /** Replaced in tests. */
  fetch?: Partial<Fetchers>;
  membershipFromCheckout?: typeof membershipFromCheckout;
  cardFromSetupCheckout?: typeof cardFromSetupCheckout;
  bankFromSetupCheckout?: typeof bankFromSetupCheckout;
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
    paymentIntent: overrides.paymentIntent ?? ((id) => stripe().paymentIntents.retrieve(id)),
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
    case "charge.dispute.closed":
      return { type, id: message.id, object: await get.dispute(related) };
    case "charge.refunded":
      return { type, id: message.id, object: await get.charge(related) };
    case "customer.updated":
      return { type, id: message.id, object: { id: related } };
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
      return { type, id: message.id, object: await get.paymentIntent(related) };
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
      // The owner added their NZ bank account for big work's direct debits (DECISIONS.md, 2026-11-23, second entry).
      if (session.mode === "setup" && session.metadata?.hostfix_purpose === "bank_setup") {
        const saved = await (deps.bankFromSetupCheckout ?? bankFromSetupCheckout)(account, session.id);
        if (!saved) return { handled: true, outcome: "bank_not_saved" };
        const owner = await findOwnerByCustomer(db, "stripe", saved.customerId);
        if (!owner) return { handled: true, outcome: "owner_missing" };
        await saveBank(db, { ownerId: owner.ownerId, country: owner.country, provider: "stripe", customerId: saved.customerId, bank: saved.bank });
        return { handled: true, outcome: "bank_saved" };
      }
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
            // The job's charge (either payment), or big work's deposit (DECISIONS.md, 2026-11-23, second entry).
            `select p.job_id, j.number, j.market from public.payments p join public.jobs j on j.id = p.job_id where p.payment_intent_id = $1 or p.extra_payment_intent_id = $1
             union all
             select x.job_id, j.number, j.market from public.job_prepayments x join public.jobs j on j.id = x.job_id where x.payment_intent_id = $1`,
            [paymentIntentId],
          )
        : [];
      const job = found[0];
      // Every chargeback is written down, so the team can mark its outcome and whose fault it was (DECISIONS.md, 2026-11-20).
      await recordChargeback(db, { disputeId: dispute.id, jobId: job?.job_id ?? null, amountCents: dispute.amount, currency: dispute.currency, reason: dispute.reason });
      if (job) {
        const paused = await db.query("update public.payouts set status = 'paused' where job_id = $1::uuid and status in ('waiting', 'scheduled', 'held') returning id", [job.job_id]);
        await audit(db, {
          actor: "stripe", action: "chargeback.opened", entity: "job", entityId: job.job_id, amount: dispute.amount, currency: dispute.currency.toUpperCase(),
          detail: { dispute: dispute.id, reason: dispute.reason, payout_paused: paused.length > 0 }, dedupeKey: `chargeback.opened:${dispute.id}`,
        });
        await raiseException(db, {
          kind: "chargeback", market: job.market, jobId: job.job_id,
          summary: `Job ${Number(job.number)}: the owner's bank has reversed the ${amount} payment (${dispute.reason.replace(/_/g, " ")}). ${paused.length > 0 ? "The tradie's payment is on hold." : "The tradie has already been paid."} Open the job's evidence pack and answer it in Stripe before the deadline shown there.`,
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

    // The bank has decided. Won (or an inquiry closed, or prevented): the tradie's payment goes on. Lost: the team decides whose fault.
    case "charge.dispute.closed": {
      const dispute = event.object as Stripe.Dispute;
      const outcome = await closeChargeback(db, dispute.id, dispute.status);
      return { handled: true, outcome: outcome === "lost" ? "chargeback_lost" : outcome === "won" ? "chargeback_won" : "nothing_to_change" };
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
    // A tradie's payment that has not gone yet is cut by their share of it, as
    // a refund on the job page does (refundSplit), so the payout can never be
    // more than what is left of the charge (DECISIONS.md, 2026-11-21).
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
      let fromTradie = 0;
      let alreadyPaid = false;
      for (const refund of await get.refundsFor(paymentIntentId)) {
        if (refund.metadata?.hostfix_refund === "app" || refund.status === "failed" || refund.status === "canceled") continue;
        const result = await db.tx(async (tx) => {
          const first = await audit(tx, {
            actor: "stripe", action: "refund.made_outside_app", entity: "job", entityId: payment.job_id, amount: refund.amount, currency: payment.currency,
            detail: { refund: refund.id }, dedupeKey: `refund.outside:${refund.id}`,
          });
          if (!first) return null;
          const row = (await tx.query<{ amount_cents: number; refunded_cents: number; owner_total_cents: number }>(
            "select p.amount_cents, p.refunded_cents, j.owner_total_cents from public.payments p join public.jobs j on j.id = p.job_id where p.id = $1::uuid for update",
            [payment.id],
          ))[0]!;
          const counted = Math.max(0, Math.min(refund.amount, Number(row.amount_cents) - Number(row.refunded_cents)));
          await tx.query(
            `update public.payments set refunded_cents = least(amount_cents, refunded_cents + $2),
                    status = case when least(amount_cents, refunded_cents + $2) >= amount_cents then 'refunded' else 'part_refunded' end
              where id = $1::uuid`,
            [payment.id, refund.amount],
          );
          const payout = (await tx.query<{ id: string; amount_cents: number; status: string }>(
            "select id, amount_cents, status from public.payouts where job_id = $1::uuid for update",
            [payment.job_id],
          ))[0];
          if (!payout || counted === 0) return { amount: refund.amount, fromTradie: 0, sent: false };
          if (!["waiting", "scheduled", "held", "paused"].includes(payout.status)) return { amount: refund.amount, fromTradie: 0, sent: payout.status === "sent" };
          // In proportion to the job's full price, exactly as a refund on the job page (resolveDispute in settle.ts).
          const split = refundSplit({ ownerCents: Math.max(Number(row.amount_cents), Number(row.owner_total_cents)), tradieCents: Number(payout.amount_cents) }, counted);
          const remaining = Number(payout.amount_cents) - split.fromTradieCents;
          if (remaining <= 0) await tx.query("update public.payouts set status = 'cancelled' where id = $1::uuid", [payout.id]);
          else await tx.query("update public.payouts set amount_cents = $2, deducted_cents = least(deducted_cents, $2) where id = $1::uuid", [payout.id, remaining]);
          await audit(tx, {
            actor: "stripe", action: "payout.reduced", entity: "job", entityId: payment.job_id, amount: split.fromTradieCents, currency: payment.currency,
            detail: { now_pays: Math.max(0, remaining), refund: refund.id, from_platform: split.fromPlatformCents }, dedupeKey: `payout.reduced:${refund.id}`,
          });
          return { amount: refund.amount, fromTradie: split.fromTradieCents, sent: false };
        });
        if (!result) continue;
        outside += result.amount;
        fromTradie += result.fromTradie;
        alreadyPaid ||= result.sent;
      }
      if (outside === 0) return { handled: true, outcome: "nothing_to_change" };
      const tradieWords = alreadyPaid
        ? "The tradie had already been paid, so their payment was not changed. Decide whether some should come back."
        : fromTradie > 0
          ? `The tradie's payment, not sent yet, was cut by their share of it (${formatMoney(fromTradie, payment.currency)}), as a refund on the job page does.`
          : "The tradie's payment was not changed.";
      await raiseException(db, {
        kind: "needs_review", market: payment.market, jobId: payment.job_id,
        summary: `Job ${Number(payment.number)}: ${formatMoney(outside, payment.currency)} was refunded in Stripe, not on the job page. The owner has their money. ${tradieWords} Next time, refund from the job page so both are done together.`,
        dedupeKey: `refund_outside:${paymentIntentId}:${outside}`,
      });
      return { handled: true, outcome: "refund_outside_app" };
    }

    // A direct debit from an owner's bank (big work's deposit, or the rest of the job) cleared or failed
    // (DECISIONS.md, 2026-11-23, second entry). Any other payment is not ours to handle here.
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const intent = event.object as Stripe.PaymentIntent;
      if (!intent.metadata?.hostfix_debit) return null;
      const moved = await settleDebit(db, intent.id, debitOf(intent));
      return { handled: true, outcome: moved === "nothing" ? "nothing_to_change" : `debit_${moved}_${event.type === "payment_intent.succeeded" ? "cleared" : "failed"}` };
    }

    default:
      return null;
  }
}
