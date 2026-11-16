import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { launchMarket, type Market } from "@config/markets";
import { startDeposit } from "@/app/actions/deposit";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { PriceListTable } from "@/components/landing/PriceList";
import { NextSteps, ThanksShell } from "@/components/ThanksShell";
import { TrackEvent } from "@/components/tracking/TrackEvent";
import { getDb } from "@/lib/db";
import { currentLead, isNewLead } from "@/lib/leads/current";
import { currentMarket, foundingSpotsTaken, SHOW_SPOTS_LEFT_AT, spotsLeft } from "@/lib/leads/founding";
import { priceListFor, priceListNotes, type PriceList } from "@/lib/leads/price-list";
import { formatMoney } from "@/lib/money";
import { emailSettings, usingResendTestSender } from "@/lib/notify/email";
import { depositAvailability } from "@/lib/payments/deposit";
import type { Lead } from "@/lib/store/types";

export const metadata: Metadata = {
  title: "You're on the list",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Where an owner lands after the form: the full price list, and the founding
 * spot if they have not taken one. Also where they come back to if they leave
 * the card page without paying, or follow the link in the price list email.
 */
export default function OwnerThanksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <ThanksShell title="You're on the list.">
      {/* This part depends on who is looking, so it loads a moment after the rest. */}
      <Suspense fallback={<p>Thanks. We&apos;ve got your details.</p>}>
        <ForThisOwner searchParams={searchParams} />
      </Suspense>
    </ThanksShell>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-brand" fill="none" aria-hidden="true">
      <path d="m5 10.4 3.2 3.2L15 6.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function first(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

async function ForThisOwner({ searchParams }: { searchParams: SearchParams }) {
  // Wait for a real visit. This part must never be worked out ahead of time.
  await connection();
  const [params, lead] = await Promise.all([searchParams, currentLead()]);
  const owner = lead && lead.leadType === "owner" ? lead : null;
  const market = await currentMarket(getDb, owner?.market ?? launchMarket.slug);

  if (!owner) {
    return (
      <>
        <p>
          Thanks. We&apos;ve got your details and we&apos;ll be in touch before {brand.name} opens in {market.name}.
        </p>
        <NextSteps steps={steps(market)} />
      </>
    );
  }

  let list: PriceList | null = null;
  let left: number | null = null;
  try {
    const db = await getDb();
    list = await priceListFor(db, market.slug);
    left = spotsLeft(market, await foundingSpotsTaken(db, market.slug));
  } catch (error) {
    console.error("[thanks] could not load the price list:", error instanceof Error ? error.message : error);
  }

  const deposit = typeof params.deposit === "string" ? params.deposit : "";
  const tracking = isNewLead(owner) ? <TrackEvent name="Lead" eventId={owner.id} /> : null;
  const email = emailSettings();
  const emailing = owner.intent === "pricelist" && owner.email && !("problem" in email) && !usingResendTestSender(email.settings);

  return (
    <>
      {tracking}
      <p>
        {params.from === "email" ? `Welcome back, ${first(owner.name)}.` : `Thanks, ${first(owner.name)}.`}{" "}
        {list && list.count > 0
          ? `Here's the full ${market.name} price list${emailing ? ", and we're emailing you a copy" : ""}. We'll give you a call soon to answer any questions.`
          : "We'll give you a call soon to answer any questions."}
      </p>
      <FoundingOffer owner={owner} market={market} left={left} notice={deposit} />
      {list && list.count > 0 && (
        <section aria-labelledby="prices-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="prices-title" className="text-2xl font-semibold tracking-tight text-ink">
            The {market.name} price list
          </h2>
          <p className="mt-1 text-base">
            {list.count} jobs at a fixed price. {market.tiers[0] ? `Membership ${formatMoney(market.tiers[0].monthlyPriceCents, market.currency)} a month per property.` : ""}
          </p>
          <div className="mt-5">
            <PriceListTable list={list} currency={market.currency} notes={priceListNotes(market)} />
          </div>
        </section>
      )}
      <NextSteps steps={steps(market)} />
    </>
  );
}

function steps(market: Market): string[] {
  return [
    "We'll call you to hear about your property and how it's looked after now.",
    `We open ${market.name} once our founding tradies are signed up. Founding members are set up first.`,
    "Your property gets its own link and QR card, so your cleaner and guests can report a problem in a minute.",
  ];
}

function FoundingOffer({ owner, market, left, notice }: { owner: Lead; market: Market; left: number | null; notice: string }) {
  if (owner.depositStatus === "paid" || owner.depositStatus === "credited") {
    return (
      <div className="rounded-2xl border border-brand/30 bg-surface p-5 text-base sm:p-6">
        <p className="font-semibold text-ink">Your founding spot is confirmed.</p>
        <p className="mt-1">
          <Link href="/owners/founding-member" className="font-medium text-brand underline">
            See your confirmation
          </Link>
        </p>
      </div>
    );
  }
  if (owner.depositStatus === "refunded" || market.stage !== "waitlist" || !market.foundingDeposit.enabled) return null;

  if (left === 0 || notice === "full") {
    return (
      <p role="status" className="rounded-xl bg-surface px-4 py-3 text-base text-ink">
        All the founding spots in {market.name} have been taken, so no payment was taken. You&apos;re on the list, and we&apos;ll let you know when we open.
      </p>
    );
  }
  if (!depositAvailability(market).available) return null;

  const price = formatMoney(market.foundingDeposit.amountCents, market.currency);
  const spots = market.foundingDeposit.spots;
  return (
    <section aria-labelledby="founding-title" className="rounded-2xl border-2 border-brand bg-surface p-5 shadow-sm sm:p-6">
      <p className="text-sm font-semibold tracking-wide text-brand-dark uppercase">Founding member offer</p>
      <h2 id="founding-title" className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        Take a founding spot for {price}
      </h2>
      <p className="mt-2 text-base">
        {spots ? `We're opening ${market.name} with ${spots} founding properties.` : `We're opening ${market.name} with a small group of founding properties.`}
        {left !== null && left <= SHOW_SPOTS_LEFT_AT ? ` Only ${left} ${left === 1 ? "spot is" : "spots are"} left.` : ""}
      </p>
      {market.foundingDeposit.terms.length > 0 && (
        <ul className="mt-4 space-y-2 text-base text-ink">
          {market.foundingDeposit.terms.map((term) => (
            <li key={term} className="flex gap-2">
              <Tick />
              <span>{term}</span>
            </li>
          ))}
        </ul>
      )}

      {notice === "cancelled" && (
        <p role="status" className="mt-4 rounded-xl bg-tint px-4 py-3 text-base text-ink">
          No payment was taken. You can take your founding spot whenever you&apos;re ready.
        </p>
      )}
      {notice === "unavailable" && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
          Sorry, we couldn&apos;t open the card page just now. No payment was taken. Please try again in a minute.
        </p>
      )}

      <form action={startDeposit} className="mt-5">
        <SubmitButton className="w-full sm:w-auto" pendingLabel="Opening the card page...">
          Take a founding spot · {price}
        </SubmitButton>
      </form>
      <p className="mt-3 text-sm">You&apos;ll pay by card on a secure page run by Stripe. We never see your card number.</p>
    </section>
  );
}
