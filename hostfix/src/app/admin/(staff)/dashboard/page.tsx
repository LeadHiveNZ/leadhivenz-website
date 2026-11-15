import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle, SectionTitle, Stat } from "@/components/ui/Bits";
import { marketNumbers, PERIOD_DAYS } from "@/lib/admin/metrics";
import { requireAdminRole } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { listMarkets } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Numbers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pct = (rate: number | null) => (rate === null ? "No history" : `${Math.round(rate * 100)}%`);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminRole();
  const query = await searchParams;
  const db = await getDb();
  const markets = await listMarkets(db);
  const market = markets.find((candidate) => candidate.slug === query.market) ?? markets.find((candidate) => candidate.stage === "live") ?? markets[0];
  if (!market) return <EmptyState icon="chart" title="No markets yet">Add a market first, under More.</EmptyState>;
  const n = await marketNumbers(db, market.slug);
  const money = (cents: number) => formatMoney(cents, n.currency);
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;
  const feeShare = n.jobValueCents > 0 ? Math.round((n.platformCents / n.jobValueCents) * 100) : null;

  return (
    <div className="space-y-7">
      <PageTitle title="Numbers" intro={`${market.name}. Memberships are as of now. Everything else is the last ${PERIOD_DAYS} days.`} />
      {markets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {markets.map((candidate) => (
            <Link key={candidate.slug} href={`/admin/dashboard?market=${candidate.slug}`} className={pill(candidate.slug === market.slug)}>
              {candidate.name}
            </Link>
          ))}
        </div>
      )}

      <section>
        <SectionTitle>Memberships</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Member properties" value={n.properties} note={n.propertiesPastDue > 0 ? `${n.propertiesPastDue} more with a card problem` : n.propertiesSetup > 0 ? `${n.propertiesSetup} added but not started` : undefined} />
          <Stat label="Monthly membership income" value={money(n.mrrCents)} note="What members pay each month" tone="good" />
          <Stat label="New members" value={n.newMembers} />
          <Stat label="Cancelled" value={n.cancelled} note={n.churnRate === null ? undefined : `${Math.round(n.churnRate * 100)}% of members a month ago`} tone={n.churnRate !== null && n.churnRate > 0.05 ? "alert" : undefined} />
        </div>
      </section>

      <section>
        <SectionTitle>Jobs</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Logged" value={n.jobsLogged} note={`${n.jobsOpen} open right now`} />
          <Stat label="Completed" value={n.jobsCompleted} note={n.jobsCancelled > 0 ? `${n.jobsCancelled} cancelled` : undefined} />
          <Stat label="Average job" value={n.averageJobCents === null ? "No jobs yet" : money(n.averageJobCents)} note="What the owner paid" />
          <Stat label="Charged to owners for jobs" value={money(n.jobValueCents)} />
          <Stat label="We kept on jobs" value={money(n.platformCents)} note={feeShare === null ? undefined : `${feeShare}% of what owners paid`} tone="good" />
          <Stat
            label="Urgent surcharges we covered"
            value={money(n.urgentAbsorbedCents)}
            note="For members whose plan includes urgent"
            tone={n.urgentAbsorbedCents > n.platformCents && n.urgentAbsorbedCents > 0 ? "alert" : undefined}
          />
          <Stat label="Refunded" value={money(n.refundsCents)} />
          <Stat label="Card payments failing" value={n.failedPayments} tone={n.failedPayments > 0 ? "alert" : undefined} note="Right now" />
        </div>
      </section>

      <section>
        <SectionTitle>Speed and the promise</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Usual time to a yes" value={n.medianMinutesToAccept === null ? "No history" : `${n.medianMinutesToAccept} min`} note="From sent out to accepted (middle value)" />
          <Stat label="Usual time to on site" value={n.medianHoursToArrive === null ? "No history" : `${n.medianHoursToArrive} h`} note="From sent out to arrived (middle value)" />
          <Stat label="On site inside the promise" value={pct(n.onTimeRate)} tone={n.onTimeRate !== null && n.onTimeRate < 0.9 ? "alert" : n.onTimeRate !== null ? "good" : undefined} />
          <Stat label="Promises missed" value={n.misses} note={n.creditsCents > 0 ? `${money(n.creditsCents)} credited to owners` : undefined} tone={n.misses > 0 ? "alert" : undefined} />
        </div>
      </section>

      <section>
        <SectionTitle>The network</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Approved tradies" value={n.tradiesApproved} />
          <Stat label="Waiting for approval" value={n.tradiesWaiting} tone={n.tradiesWaiting > 0 ? "alert" : undefined} />
          <Stat label="In the queue" value={n.openExceptions} note="Needing a person" tone={n.openExceptions > 0 ? "alert" : undefined} />
        </div>
        <p className="mt-3 text-sm text-muted">
          Scorecards and who has first pick of each trade are under{" "}
          <Link href={`/admin/tradies?market=${market.slug}`} className="font-semibold text-brand underline underline-offset-2">
            Tradies
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
