import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import { startOwnerSignUp } from "@/app/actions/auth";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Notice } from "@/components/ui/Bits";
import { publicMarkets } from "@/lib/markets/public";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Join", description: `Create your ${brand.name} account and add your first property.` };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const live = (await publicMarkets()).filter((entry) => entry.market.stage === "live");
  const cheapest = live.flatMap((entry) => entry.market.tiers.map((tier) => ({ cents: tier.monthlyPriceCents, currency: entry.market.currency }))).sort((a, b) => a.cents - b.cents)[0];
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
      <h1 className="display text-4xl text-ink">Join {brand.name}</h1>
      {live.length === 0 ? (
        <div className="mt-5 space-y-4">
          <Notice tone="info" title="We are not open for new members yet">
            Leave your details and you will be first to hear when we open in your area.
          </Notice>
          <Link href="/owners" className="font-semibold text-brand underline underline-offset-2">
            Get early access
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-muted">
            Create your account, then add your property.{" "}
            {cheapest && cheapest.cents > 0
              ? `Membership is from ${formatMoney(cheapest.cents, cheapest.currency)} a month per property. Nothing is charged until you choose a membership.`
              : "It is free to join. You add a card, and it is only charged the fixed price when a job is done."}
          </p>
          <div className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
            <ActionForm action={startOwnerSignUp}>
              <Suspense fallback={null}>
                <Hidden searchParams={searchParams} />
              </Suspense>
              <Field label="Your name" name="name" autoComplete="name" required maxLength={80} />
              <Field label="Email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} hint="We send your sign-in code here." />
              <Field label="Mobile number" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} hint="We text you when a tradie is booked and when the job is done." />
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
      )}
    </main>
  );
}

/** Carries the market and any referral code from the link the person arrived by. */
async function Hidden({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const market = typeof params.market === "string" ? params.market.slice(0, 40) : "";
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 12) : "";
  return (
    <>
      {market && <input type="hidden" name="market" value={market} />}
      {ref && <input type="hidden" name="ref" value={ref} />}
    </>
  );
}
