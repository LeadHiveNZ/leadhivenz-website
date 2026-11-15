import type { Metadata } from "next";
import Link from "next/link";
import { Chip, EmptyState, PageTitle } from "@/components/ui/Bits";
import { requireStaff } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listMarkets } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { listOwnersForStaff } from "@/lib/owners/service";
import { displayPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Owners" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OwnersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const markets = await listMarkets(db);
  const market = markets.find((candidate) => candidate.slug === query.market) ?? null;
  const owners = await listOwnersForStaff(db, { market: market?.slug ?? null });
  const zone = market?.timezone ?? markets[0]?.timezone ?? "Pacific/Auckland";
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div className="space-y-5">
      <PageTitle title="Owners" back={{ href: "/admin/more", label: "More" }} intro="Everyone with an account. Open an owner to see their properties and jobs, give a credit, or log a job they have phoned in." />
      {markets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/owners" className={pill(!market)}>
            Every market
          </Link>
          {markets.map((candidate) => (
            <Link key={candidate.slug} href={`/admin/owners?market=${candidate.slug}`} className={pill(candidate.slug === market?.slug)}>
              {candidate.name}
            </Link>
          ))}
        </div>
      )}
      {owners.length === 0 ? (
        <EmptyState icon="people" title="No owners yet">
          Owners appear here when they create an account.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-line bg-tint/60 text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">Owner</th>
                <th className="px-4 py-3 font-bold">Properties</th>
                <th className="px-4 py-3 text-right font-bold">Pays each month</th>
                <th className="px-4 py-3 font-bold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {owners.map((owner) => (
                <tr key={owner.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/owners/${owner.id}`} className="font-bold text-brand underline underline-offset-2">
                      {owner.name}
                    </Link>
                    <span className="block text-muted">
                      {owner.phone ? displayPhone(owner.phone) : "no mobile"} · {owner.email ?? "no email"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">
                      {owner.members} member{owner.members === 1 ? "" : "s"}
                    </span>
                    {owner.properties > owner.members && <span className="text-muted"> of {owner.properties}</span>}
                    {owner.openJobs > 0 && (
                      <span className="mt-1 block">
                        <Chip tone="active">{owner.openJobs} open {owner.openJobs === 1 ? "job" : "jobs"}</Chip>
                      </span>
                    )}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold text-ink">{owner.currency && owner.monthlyCents > 0 ? formatMoney(owner.monthlyCents, owner.currency) : "-"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(owner.createdAt, zone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
