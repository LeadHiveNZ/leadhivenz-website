import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui/Bits";
import { auditTrail } from "@/lib/audit";
import { requireAdminRole } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listMarkets } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "job", label: "Jobs" },
  { key: "property", label: "Memberships" },
  { key: "tradie", label: "Tradies" },
  { key: "market", label: "Prices and settings" },
  { key: "lead", label: "Leads and deposits" },
];

function brief(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail)
    .filter(([, value]) => value !== null && value !== "" && typeof value !== "object")
    .slice(0, 6)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`);
  return parts.join(" · ").slice(0, 260);
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminRole();
  const query = await searchParams;
  const db = await getDb();
  const filter = FILTERS.find((candidate) => candidate.key === query.show) ?? FILTERS[0]!;
  const rows = await auditTrail(db, { entity: filter.key || undefined, limit: 400, newestFirst: true });
  const zone = (await listMarkets(db))[0]?.timezone ?? "Pacific/Auckland";
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div>
      <PageTitle
        title="Audit log"
        back={{ href: "/admin/more", label: "More" }}
        intro="Every change to a job and every movement of money, newest first. Nothing here can be edited or deleted, by anyone. The last 400 entries are shown."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((candidate) => (
          <Link key={candidate.key} href={candidate.key ? `/admin/audit?show=${candidate.key}` : "/admin/audit"} className={pill(candidate.key === filter.key)}>
            {candidate.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="log" title="Nothing recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-tint/60 text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">When</th>
                <th className="px-4 py-3 font-bold">What</th>
                <th className="px-4 py-3 font-bold">Who</th>
                <th className="px-4 py-3 text-right font-bold">Amount</th>
                <th className="px-4 py-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="tabular px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(row.at, zone)}</td>
                  <td className="px-4 py-2.5 font-semibold text-ink">
                    {row.entity === "job" && row.entityId ? (
                      <Link href={`/admin/jobs/${row.entityId}`} className="text-brand underline underline-offset-2">
                        {row.action}
                      </Link>
                    ) : (
                      row.action
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{row.actor.replace(/:[0-9a-f-]{36}$/, "")}</td>
                  <td className="tabular px-4 py-2.5 text-right font-semibold text-ink">{row.amount !== null && row.currency ? formatMoney(row.amount, row.currency) : ""}</td>
                  <td className="px-4 py-2.5 text-muted">{brief(row.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
