import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@config/brand";
import { OwnerPhone } from "@/components/landing/PhoneMock";
import { Icon, type IconName } from "@/components/ui/Icon";
import { publicMarkets } from "@/lib/markets/public";

export const metadata: Metadata = {
  title: { absolute: `${brand.name} | ${brand.tagline}` },
  description: brand.description,
};

const choices: { href: string; title: string; text: string; icon: IconName; cta: string }[] = [
  { href: "/owners", title: "I own a holiday home", text: "Things fixed fast at a fixed price, without the phone calls.", icon: "door", cta: "See how it works" },
  { href: "/tradies", title: "I'm a tradie", text: "Fixed-price jobs sent to your phone, paid automatically.", icon: "tradie", cta: "Get jobs by text" },
];

const points: { icon: IconName; title: string; text: string }[] = [
  { icon: "menu", title: "Fixed prices", text: "The common jobs are on a menu. You see the price before anyone is sent. No quotes, no invoices." },
  { icon: "bolt", title: "Offered in minutes", text: "Each job goes straight to an approved local tradie. If they cannot take it, it moves to the next one." },
  { icon: "shield", title: "Pay for what you got", text: "Urgent and the tradie is late? The urgent fee is not charged. Nobody has taken it in 3 hours? We ring round, and you pay nothing unless a tradie does the job." },
];

export default async function HomePage() {
  const all = await publicMarkets();
  const main = all[0];
  const item = main?.menu.find((entry) => entry.code === "PL-01") ?? main?.menu[0];
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-accent/35 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-20">
          <div>
            {main && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-white">
                <Icon name="market" size={16} className="text-accent" />
                {all.length > 1 ? all.map((entry) => entry.market.name).join(" · ") : `${main.market.name}, ${main.market.countryName}`}
              </p>
            )}
            <h1 className="display mt-4 text-[2.6rem] text-ink sm:text-6xl lg:text-[4.2rem]">{brand.tagline}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{brand.description}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {choices.map((choice) => (
                <Link key={choice.href} href={choice.href} className="group rounded-3xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand hover:shadow-lg sm:p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tint text-brand transition group-hover:bg-accent group-hover:text-brand-dark">
                    <Icon name={choice.icon} size={22} />
                  </span>
                  <span className="mt-4 block text-xl font-bold text-ink">{choice.title}</span>
                  <span className="mt-1 block text-muted">{choice.text}</span>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-bold text-brand">
                    {choice.cta} <Icon name="arrow" size={18} className="transition group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
          {main && (
            <div className="relative hidden lg:block">
              <div aria-hidden="true" className="absolute inset-x-4 top-10 bottom-10 rounded-[3rem] bg-tint" />
              <div className="relative py-4">
                <OwnerPhone
                  example={{
                    jobName: item?.name ?? "Unblock a toilet",
                    ownerCents: item?.ownerPriceCents ?? 22000,
                    payoutCents: item?.tradiePayoutCents ?? 18700,
                    currency: main.market.currency,
                    suburb: main.market.name,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-3">
          {points.map((point) => (
            <div key={point.title} className="rounded-3xl border border-line bg-sand/60 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-brand-dark">
                <Icon name={point.icon} size={22} />
              </span>
              <h2 className="display mt-4 text-2xl text-ink">{point.title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{point.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
