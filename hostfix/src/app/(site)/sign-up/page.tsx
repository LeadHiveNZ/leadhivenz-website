import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { startOwnerSignUp } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Notice } from "@/components/ui/Bits";
import { publicMarketsNow } from "@/lib/markets/public";
import { bookingOpen, inPreLaunch, marketNames, ownersCanJoin } from "@/lib/markets/stage";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Join", description: `Create your ${brand.name} account and add your first property.` };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
      <h1 className="display text-4xl text-ink">Join {brand.name}</h1>
      {/* Whether anyone can join is read on each visit: it changes the moment the team opens an area. */}
      <Suspense fallback={<p className="mt-2 text-muted">One moment...</p>}>
        <Join searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * The form, worked out on each visit from the markets as they are this instant. An account can be made when at
 * least one area is live, or on the waiting list with pre-launch on (DECISIONS.md, 2026-11-27, second entry). The
 * words follow the area in the link (`?market=`), or every area when the link names none.
 */
async function Join({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const slug = typeof params.market === "string" ? params.market.slice(0, 40) : "";
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 12) : "";
  const joinable = (await publicMarketsNow()).map((entry) => entry.market).filter(ownersCanJoin);

  if (joinable.length === 0) {
    return (
      <div className="mt-5 space-y-4">
        <Notice tone="info" title="We are not open for new members yet">
          Leave your details and you will be first to hear when we open in your area.
        </Notice>
        <Link href="/owners" className="font-semibold text-brand underline underline-offset-2">
          Get early access
        </Link>
      </div>
    );
  }

  const chosen = joinable.find((market) => market.slug === slug) ?? null;
  const open = joinable.filter(bookingOpen);
  const early = joinable.filter(inPreLaunch);
  // Pre-launch words when the area in the link is not open yet, or when nowhere is.
  const preLaunch = chosen ? inPreLaunch(chosen) : open.length === 0;
  const cheapest = open.flatMap((market) => market.tiers.map((tier) => ({ cents: tier.monthlyPriceCents, currency: market.currency }))).sort((a, b) => a.cents - b.cents)[0];

  return (
    <>
      {preLaunch ? (
        <div className="mt-3 space-y-3">
          <p className="text-muted">
            Set up your account and properties now, so you&rsquo;re ready on day one in {marketNames(chosen ? [chosen] : early)}.
          </p>
          <Notice tone="info" title="Free, and no card needed yet">
            Bookings are not open yet. Add your properties and we&rsquo;ll email you the day they open. You add a card then, and it&rsquo;s only charged when a job is done.
          </Notice>
        </div>
      ) : (
        <p className="mt-2 text-muted">
          Create your account, then add your property.{" "}
          {cheapest && cheapest.cents > 0
            ? `Membership is from ${formatMoney(cheapest.cents, cheapest.currency)} a month per property. Nothing is charged until you choose a membership.`
            : "It is free to join. You add a card, and it is only charged the fixed price when a job is done."}
          {!chosen && early.length > 0 ? ` In ${marketNames(early)} bookings are not open yet: you can set up now, and no card is needed there until they are.` : ""}
        </p>
      )}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <ActionForm action={startOwnerSignUp}>
          {slug && <input type="hidden" name="market" value={slug} />}
          {ref && <input type="hidden" name="ref" value={ref} />}
          <Field label="Your name" name="name" autoComplete="name" required maxLength={80} />
          <Field label="Email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} hint="We send your sign-in code here." />
          <Field
            label="Mobile number"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={30}
            hint={preLaunch ? "Once bookings open, we text you when a tradie is booked and when the job is done." : "We text you when a tradie is booked and when the job is done."}
          />
          <Field label="Where do you live?" name="homeLocation" maxLength={80} placeholder="Town or city (optional)" />
          <SubmitButton pendingLabel="Sending your code..." className="w-full">
            Continue
          </SubmitButton>
          <p className="text-center text-sm text-muted">
            By continuing you agree to the{" "}
            <Link href="/legal/terms" className="underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline">
              privacy policy
            </Link>
            .
          </p>
        </ActionForm>
      </div>
      <p className="mt-6 text-muted">
        Already a member?{" "}
        <Link href="/sign-in" className="font-semibold text-brand underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}
