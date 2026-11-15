import type { Metadata } from "next";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { OwnerLeadForm } from "@/components/forms/OwnerLeadForm";
import { LandingPage } from "@/components/LandingPage";
import { loadLanding } from "@/lib/content";

// The words on this page live in content/landing-owner.md.
const market = launchMarket;
const CTA = "Get early access";

export function generateMetadata(): Metadata {
  const content = loadLanding("owner", market);
  return {
    title: content.headlineText,
    description: content.summaryText,
    alternates: { canonical: "/owners" },
  };
}

export default function OwnersPage() {
  const content = loadLanding("owner", market);
  return (
    <LandingPage
      content={content}
      eyebrow={`${market.name}, ${market.countryName}`}
      formTitle="Get early access"
      formNote="Takes about a minute. No payment needed to join the list."
      form={<OwnerLeadForm marketName={market.name} brandName={brand.name} buttonLabel={CTA} />}
      ctaLabel={CTA}
      closingTitle={`Be first in line in ${market.name}`}
      closingNote="Leave your details and we'll be in touch before we launch."
    />
  );
}
