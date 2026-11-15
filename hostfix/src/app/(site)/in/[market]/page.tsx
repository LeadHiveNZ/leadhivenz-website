import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markets } from "@config/markets";
import { OwnerLanding } from "@/components/landing/pages";
import { loadLanding } from "@/lib/content";
import { publicMarket } from "@/lib/markets/public";

/**
 * The owner landing page for one named market, for example /in/wanaka.
 * Use these addresses in ads for each town. The copy is the same file as the
 * main owner page, with the town's name and prices filled in.
 */

type Params = Promise<{ market: string }>;

// The markets known when the site is built. A market added later on the admin
// screen still works: its page is made the first time someone visits it.
export function generateStaticParams() {
  return markets.map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await publicMarket((await params).market);
  if (!data) return {};
  const content = loadLanding("owner", data.market);
  return { title: content.headlineText, description: content.summaryText, alternates: { canonical: `/in/${data.market.slug}` } };
}

export default async function MarketOwnersPage({ params }: { params: Params }) {
  const data = await publicMarket((await params).market);
  if (!data) notFound();
  return <OwnerLanding data={data} />;
}
