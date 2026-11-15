import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";

export const metadata: Metadata = {
  title: { absolute: `${brand.name} | ${brand.tagline}` },
  description: brand.description,
};

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-brand transition group-hover:translate-x-1" fill="none" aria-hidden="true">
      <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const choices = [
  {
    href: "/owners",
    title: "I own a holiday home",
    text: "Get things fixed fast at a fixed price, without the phone calls.",
  },
  {
    href: "/tradies",
    title: "I'm a tradie",
    text: "Get fixed-price jobs sent to your phone and be paid within 48 hours.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 bg-tint">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="inline-flex rounded-full border border-brand/20 bg-surface px-3 py-1 text-sm font-semibold text-brand-dark">
          {launchMarket.name}, {launchMarket.countryName}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{brand.tagline}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{brand.description}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {choices.map((choice) => (
            <Link
              key={choice.href}
              href={choice.href}
              className="group rounded-2xl border border-line bg-surface p-6 shadow-sm transition hover:border-brand hover:shadow-md"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xl font-semibold text-ink">{choice.title}</span>
                <Arrow />
              </span>
              <span className="mt-2 block text-muted">{choice.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
