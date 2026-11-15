import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerLanding } from "@/components/landing/pages";
import { loadLanding } from "@/lib/content";
import { publicMarket } from "@/lib/markets/public";

// The words on this page live in content/landing-owner.md.

export async function generateMetadata(): Promise<Metadata> {
  const data = await publicMarket();
  if (!data) return {};
  const content = loadLanding("owner", data.market);
  return { title: content.headlineText, description: content.summaryText, alternates: { canonical: "/owners" } };
}

export default async function OwnersPage() {
  const data = await publicMarket();
  if (!data) notFound();
  return <OwnerLanding data={data} />;
}
