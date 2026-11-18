import type { Metadata } from "next";
import Link from "next/link";
import { importProperties } from "@/app/actions/owner";
import { PasteImport } from "@/components/properties/PasteImport";
import { Card, Notice, PageTitle } from "@/components/ui/Bits";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listMarkets, listTiers } from "@/lib/markets/store";
import { openPortfolio } from "@/lib/properties/portfolio";

export const metadata: Metadata = { title: "Add many at once" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** "Add many at once": paste a spreadsheet of properties, check the preview, save them together. */
export default async function ImportPropertiesPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/properties/import");
  const params = await searchParams;
  const db = await getDb();
  const live = (await listMarkets(db)).filter((market) => market.stage === "live");
  if (live.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Add many at once" back={{ href: "/app/properties", label: "Properties" }} />
        <Notice tone="info" title="We are not open in your area yet">
          We will email you the day we open.
        </Notice>
      </div>
    );
  }
  const market = live.find((candidate) => candidate.slug === params.market) ?? live[0]!;
  const tiers = (await listTiers(db, market.slug)).filter((tier) => tier.active && tier.billingBasis === "per_property");
  const portfolio = await openPortfolio(db, viewer.ownerId, market.slug);
  // The same membership the Add a property form starts on. On a Portfolio they all join it.
  const tierId = portfolio?.tierId ?? tiers[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Add many at once"
        back={{ href: "/app/properties/new", label: "Add a property" }}
        intro={`Paste a list from a spreadsheet. We check every line before anything is saved.${live.length > 1 ? ` These are added in ${market.name}.` : ""}`}
      />
      {live.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-muted">Where are they?</span>
          {live.map((candidate) => (
            <Link
              key={candidate.slug}
              href={`/app/properties/import?market=${candidate.slug}`}
              aria-current={candidate.slug === market.slug ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 font-semibold ${candidate.slug === market.slug ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      )}
      <Card className="sm:p-7">
        <PasteImport action={importProperties} hidden={{ market: market.slug, tierId }} />
        <p className="mt-4 text-sm text-muted">
          {portfolio
            ? "They join your Portfolio: your one monthly retainer covers them."
            : "Nothing is charged now. Each property is covered once a card is on file, and jobs are charged at the fixed price when they are done."}
        </p>
      </Card>
    </div>
  );
}
