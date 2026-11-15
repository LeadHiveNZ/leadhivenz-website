import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markets } from "@config/markets";
import { TradieLanding } from "@/components/landing/pages";
import { loadLanding } from "@/lib/content";
import { publicMarket } from "@/lib/markets/public";

/** The tradie landing page for one named market, for example /in/wanaka/tradies. */

type Params = Promise<{ market: string }>;

export function generateStaticParams() {
  return markets.map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await publicMarket((await params).market);
  if (!data) return {};
  const content = loadLanding("tradie", data.market);
  return { title: content.headlineText, description: content.summaryText, alternates: { canonical: `/in/${data.market.slug}/tradies` } };
}

export default async function MarketTradiesPage({ params }: { params: Params }) {
  const data = await publicMarket((await params).market);
  if (!data) notFound();
  return <TradieLanding data={data} />;
}
