import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { findMarket, launchMarket } from "@config/markets";
import { startDeposit } from "@/app/actions/deposit";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { NextSteps, ThanksShell } from "@/components/ThanksShell";
import { TrackEvent } from "@/components/tracking/TrackEvent";
import { currentLead, isNewLead } from "@/lib/leads/current";
import { formatMoney } from "@/lib/money";
import { depositAvailability } from "@/lib/payments/deposit";

export const metadata: Metadata = {
  title: "You're on the list",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OwnerThanksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <ThanksShell title="You're on the list.">
      <p>
        Thanks. We&apos;ve got your details and we&apos;ll be in touch before {brand.name} launches in {launchMarket.name}.
      </p>
      {/* This part depends on who is looking, so it loads a moment after the rest. */}
      <Suspense fallback={null}>
        <FoundingOffer searchParams={searchParams} />
      </Suspense>
      <NextSteps
        steps={[
          "We'll call or email you to hear about your property and how it's looked after now.",
          "You'll get first access when we open, and you choose the membership that suits you.",
          "We set up your property with its own QR code for reporting jobs.",
        ]}
      />
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

async function FoundingOffer({ searchParams }: { searchParams: SearchParams }) {
  // Wait for a real visit. This part must never be worked out ahead of time.
  await connection();
  const [params, lead] = await Promise.all([searchParams, currentLead()]);
  if (!lead || lead.leadType !== "owner") return null;

  const depositParam = typeof params.deposit === "string" ? params.deposit : "";
  const tracking = isNewLead(lead) ? <TrackEvent name="Lead" eventId={lead.id} /> : null;

  if (lead.depositStatus === "paid") {
    return (
      <>
        {tracking}
        <div className="rounded-2xl border border-brand/30 bg-surface p-5 text-base sm:p-6">
          <p className="font-semibold text-ink">Your founding member deposit is confirmed.</p>
          <p className="mt-1">
            <Link href="/owners/founding-member" className="font-medium text-brand underline">
              See your confirmation
            </Link>
          </p>
        </div>
      </>
    );
  }

  const market = findMarket(lead.market) ?? launchMarket;
  const availability = depositAvailability(market);
  if (!availability.available || lead.depositStatus === "refunded") return tracking;

  const price = formatMoney(market.foundingDeposit.amountCents, market.currency);
  return (
    <>
      {tracking}
      <section aria-labelledby="founding-title" className="rounded-2xl border-2 border-brand bg-surface p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Founding member offer</p>
        <h2 id="founding-title" className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Lock in your spot for {price}
        </h2>
        <p className="mt-2 text-base">
          We&apos;re opening {market.name} to a small group of founding owners first. A deposit puts you at the front of the line.
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

        {depositParam === "cancelled" && (
          <p role="status" className="mt-4 rounded-xl bg-tint px-4 py-3 text-base text-ink">
            No payment was taken. You can reserve your spot whenever you&apos;re ready.
          </p>
        )}
        {depositParam === "unavailable" && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-800">
            Sorry, we couldn&apos;t open the card page just now. No payment was taken. Please try again in a minute.
          </p>
        )}

        <form action={startDeposit} className="mt-5">
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Opening the card page...">
            Reserve my founding spot for {price}
          </SubmitButton>
        </form>
        <p className="mt-3 text-sm">You&apos;ll pay by card on a secure page run by Stripe. We never see your card number.</p>
      </section>
    </>
  );
}
