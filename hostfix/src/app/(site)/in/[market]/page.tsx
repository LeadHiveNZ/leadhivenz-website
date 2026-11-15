import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { markets } from "@config/markets";
import { OwnerLanding } from "@/components/landing/pages";
import { loadLanding } from "@/lib/content";
import { publicMarket, publicMarketNow } from "@/lib/markets/public";

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

export default function MarketOwnersPage({ params }: { params: Params }) {
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
  if (kept) return <OwnerLanding data={kept} />;
  // Not in the kept copy. It may have been opened to the public a moment ago,
  // so look again, straight from the database, before saying it does not exist.
  await connection();
  const fresh = await publicMarketNow(slug);
  if (!fresh) notFound();
  return <OwnerLanding data={fresh} />;
}
