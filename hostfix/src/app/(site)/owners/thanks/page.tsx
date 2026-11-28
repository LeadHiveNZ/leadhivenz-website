import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { launchMarket, type Market } from "@config/markets";
import { PriceListTable } from "@/components/landing/PriceList";
import { NextSteps, ThanksShell } from "@/components/ThanksShell";
import { TrackEvent } from "@/components/tracking/TrackEvent";
import { getDb } from "@/lib/db";
import { currentLead, isNewLead } from "@/lib/leads/current";
import { currentMarket } from "@/lib/leads/founding";
import { priceListFor, priceListNotes, type PriceList } from "@/lib/leads/price-list";
import { inPreLaunch } from "@/lib/markets/stage";
import { formatMoney } from "@/lib/money";
import { emailSettings, usingResendTestSender } from "@/lib/notify/email";
import type { Lead } from "@/lib/store/types";

export const metadata: Metadata = {
  title: "You're on the list",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Where an owner lands after the form: the full price list. Also where they
 * come back to from the link in the price list email.
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
        <SetUpNow market={market} />
        <NextSteps steps={steps(market)} />
      </>
    );
  }

  let list: PriceList | null = null;
  try {
    const db = await getDb();
    list = await priceListFor(db, market.slug);
  } catch (error) {
    console.error("[thanks] could not load the price list:", error instanceof Error ? error.message : error);
  }

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
      {!owner.convertedAt && <SetUpNow market={market} />}
      <DepositNote owner={owner} market={market} />
      {list && list.count > 0 && (
        <section aria-labelledby="prices-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="prices-title" className="text-2xl font-semibold tracking-tight text-ink">
            The {market.name} price list
          </h2>
          <p className="mt-1 text-base">
            {list.count} jobs at a fixed price.{" "}
            {market.tiers[0] && market.tiers[0].monthlyPriceCents > 0
              ? `Membership ${formatMoney(market.tiers[0].monthlyPriceCents, market.currency)} a month per property.`
              : "Free to join: you only pay the fixed price when a job is done."}
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

/**
 * Pre-launch (DECISIONS.md, 2026-11-27, second entry): while the area is on the waiting list with pre-launch on, an
 * owner can make their account and add their properties straight away. One line and one link, read from the market
 * as it is now. Nothing is emailed about it.
 */
function SetUpNow({ market }: { market: Market }) {
  if (!inPreLaunch(market)) return null;
  return (
    <p className="rounded-2xl border border-brand/30 bg-surface p-5 text-base sm:p-6">
      <span className="font-semibold text-ink">Want to be ready on day one?</span>{" "}
      <Link href={`/sign-up?market=${market.slug}`} className="font-semibold text-brand underline underline-offset-2">
        Set up your account and properties now.
      </Link>{" "}
      It&apos;s free, and no card is needed until bookings open.
    </p>
  );
}

function steps(market: Market): string[] {
  return [
    "We'll call you to hear about your property and how it's looked after now.",
    `We open ${market.name} once our tradies are signed up. Joining is free, and you're set up first.`,
    "Your property gets its own link and QR card, so your cleaner and guests can report a problem in a minute.",
  ];
}

/**
 * HostFix is free to join (DECISIONS.md, 2026-11-17): no founding offer is made
 * here any more. An owner who already paid a founding deposit is told it is
 * being refunded in full (RUNBOOK.md, "Refunding the founding deposits").
 */
function DepositNote({ owner, market }: { owner: Lead; market: Market }) {
  if (owner.depositStatus !== "paid" && owner.depositStatus !== "credited") return null;
  const amount = owner.depositAmount ? formatMoney(owner.depositAmount, owner.depositCurrency ?? market.currency) : "your";
  return (
    <div role="status" className="rounded-2xl border border-brand/30 bg-surface p-5 text-base sm:p-6">
      <p className="font-semibold text-ink">Your founding deposit</p>
      <p className="mt-1">
        {brand.name} is now free to join, so we are refunding {amount === "your" ? "your founding deposit" : `your ${amount} founding deposit`} in full, to the card you paid with.
      </p>
    </div>
  );
}
