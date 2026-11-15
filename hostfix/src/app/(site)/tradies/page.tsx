import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradieLanding } from "@/components/landing/pages";
import { loadLanding } from "@/lib/content";
import { publicMarket } from "@/lib/markets/public";

// The words on this page live in content/landing-tradie.md.

export async function generateMetadata(): Promise<Metadata> {
  const data = await publicMarket();
  if (!data) return {};
  const content = loadLanding("tradie", data.market);
  return { title: content.headlineText, description: content.summaryText, alternates: { canonical: "/tradies" } };
}

export default async function TradiesPage() {
  const data = await publicMarket();
  if (!data) notFound();
  return <TradieLanding data={data} />;
}
