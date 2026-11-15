import type { Metadata } from "next";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { trades } from "@config/trades";
import { TradieLeadForm } from "@/components/forms/TradieLeadForm";
import { LandingPage } from "@/components/LandingPage";
import { loadLanding } from "@/lib/content";

// The words on this page live in content/landing-tradie.md.
const market = launchMarket;
const CTA = "Put my name down";
const tradeOptions = trades.map((trade) => ({ key: trade.key, label: trade.label }));

export function generateMetadata(): Metadata {
  const content = loadLanding("tradie", market);
  return {
    title: content.headlineText,
    description: content.summaryText,
    alternates: { canonical: "/tradies" },
  };
}

export default function TradiesPage() {
  const content = loadLanding("tradie", market);
  return (
    <LandingPage
      content={content}
      eyebrow={`For tradies in ${market.name}`}
      formTitle="Put your name down"
      formNote="Takes about a minute. It costs nothing to join the list."
      form={<TradieLeadForm brandName={brand.name} buttonLabel={CTA} trades={tradeOptions} />}
      ctaLabel={CTA}
      closingTitle={`Want the first jobs in ${market.name}?`}
      closingNote="Leave your details and we'll be in touch before we launch."
    />
  );
}
