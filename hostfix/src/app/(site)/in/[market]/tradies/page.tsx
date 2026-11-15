import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { markets } from "@config/markets";
import { TradieLanding } from "@/components/landing/pages";
import { loadLanding } from "@/lib/content";
import { publicMarket, publicMarketNow } from "@/lib/markets/public";

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

export default function MarketTradiesPage({ params }: { params: Params }) {
  // For a market added after the site was built, the page is put together on
  // the first visit. The placeholder shows for a moment while that happens.
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 text-muted sm:px-6">One moment...</main>}>
      <ForMarket params={params} />
    </Suspense>
  );
}

async function ForMarket({ params }: { params: Params }) {
  const slug = (await params).market;
  const kept = await publicMarket(slug);
  if (kept) return <TradieLanding data={kept} />;
  // Not in the kept copy. It may have been opened to the public a moment ago,
  // so look again, straight from the database, before saying it does not exist.
  await connection();
  const fresh = await publicMarketNow(slug);
  if (!fresh) notFound();
  return <TradieLanding data={fresh} />;
}
