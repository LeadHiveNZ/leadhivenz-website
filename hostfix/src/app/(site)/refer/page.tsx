import type { Metadata } from "next";
import { brand } from "@config/brand";
import { joinReferrals } from "@/app/actions/refer";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { publicMarket } from "@/lib/markets/public";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Refer an owner",
  description: `Clean or co-host a holiday home? Send the owner to ${brand.name} and earn a reward when they stay.`,
};

/** For cleaners and co-hosts: get a link to pass on to the owners you work for. */
export default async function ReferPage() {
  const data = await publicMarket();
  const market = data?.market;
  const reward = market ? formatMoney(market.referralRewardCents, market.currency) : "a reward";
  const months = market?.referralPaidMonths ?? 3;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div>
          <p className="text-sm font-bold tracking-wide text-brand uppercase">For cleaners and co-hosts</p>
          <h1 className="display mt-2 text-4xl text-ink sm:text-5xl">You find the broken tap. Get {reward} for the owner you bring.</h1>
          <p className="mt-4 text-lg text-muted">
            You are the one who finds what is broken and then chases the owner about it. With {brand.name} you report it from your phone in a minute and a tradie is sent. Bring an owner on board and we pay you for it.
          </p>
          <ol className="mt-7 space-y-3">
            {[
              ["Get your link", "Fill in the form. Your own link arrives by text straight away."],
              ["Send it to the owners you work for", "They join from your link and add their property."],
              [`Get ${reward} per property`, `Once a property has been a paying member for ${months} months, we pay you by bank transfer. There is no limit on how many.`],
            ].map(([title, detail], index) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-accent">{index + 1}</span>
                <span>
                  <span className="block font-bold text-ink">{title}</span>
                  <span className="block text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="display text-2xl text-ink">Get my link</h2>
          <ActionForm action={joinReferrals} className="mt-4 space-y-4">
            <Field label="Your name" name="name" required maxLength={80} autoComplete="name" />
            <Field label="Mobile number" name="phone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" hint="We text your link here, and tell you when a reward is on its way." />
            <Field label="Email (optional)" name="email" type="email" inputMode="email" maxLength={254} autoComplete="email" />
            <SubmitButton pendingLabel="Making your link..." className="w-full">
              Get my link
            </SubmitButton>
            <p className="text-center text-sm text-muted">We only use your details to pay you and to tell you about your rewards.</p>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
