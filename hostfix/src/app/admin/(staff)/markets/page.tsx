import type { Metadata } from "next";
import { addMarket } from "@/app/actions/staff-admin";
import { ActionForm, Field, Select } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, PageTitle, RowLink, SectionTitle } from "@/components/ui/Bits";
import { requireAdminRole } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import type { StatusTone } from "@/lib/jobs/types";
import { listMarkets } from "@/lib/markets/store";

export const metadata: Metadata = { title: "Markets" };

const STAGE: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft: hidden", tone: "quiet" },
  waitlist: { label: "Waiting list", tone: "waiting" },
  live: { label: "Live", tone: "done" },
  paused: { label: "Paused", tone: "alert" },
};

const TIMEZONES = [
  { key: "Pacific/Auckland", label: "New Zealand (Pacific/Auckland)" },
  { key: "Australia/Brisbane", label: "Queensland (Australia/Brisbane)" },
  { key: "Australia/Sydney", label: "New South Wales, ACT (Australia/Sydney)" },
  { key: "Australia/Melbourne", label: "Victoria (Australia/Melbourne)" },
  { key: "Australia/Hobart", label: "Tasmania (Australia/Hobart)" },
  { key: "Australia/Adelaide", label: "South Australia (Australia/Adelaide)" },
  { key: "Australia/Darwin", label: "Northern Territory (Australia/Darwin)" },
  { key: "Australia/Perth", label: "Western Australia (Australia/Perth)" },
];

export default async function MarketsPage() {
  await requireAdminRole();
  const db = await getDb();
  const markets = await listMarkets(db);
  const counts = await db.query<{ market: string; members: number; tradies: number }>(
    `select m.slug as market,
            (select count(*) from public.properties p where p.market = m.slug and p.status in ('active', 'past_due')) as members,
            (select count(*) from public.tradies t where t.market = m.slug and t.status = 'approved') as tradies
       from public.markets m`,
  );
  const count = new Map(counts.map((row) => [row.market, row]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Markets" back={{ href: "/admin/more", label: "More" }} intro="A market is one town or region. Each has its own currency, tax, prices, menu, hours and tradies. Nothing is shared between them unless you copy it." />

      <div className="space-y-2.5">
        {markets.map((market) => {
          const stage = STAGE[market.stage] ?? STAGE.draft!;
          const row = count.get(market.slug);
          return (
            <RowLink
              key={market.slug}
              href={`/admin/markets/${market.slug}`}
              title={market.name}
              subtitle={`${market.countryName} · ${market.currency} · ${Number(row?.members ?? 0)} member properties · ${Number(row?.tradies ?? 0)} approved tradies`}
              right={<Chip tone={stage.tone}>{stage.label}</Chip>}
            />
          );
        })}
      </div>

      <Card className="sm:p-6">
        <SectionTitle>Add a market</SectionTitle>
        <ol className="mb-5 list-decimal space-y-1 pl-5 text-muted">
          <li>Add it here. The memberships and menu are copied from a market you choose, as a starting point.</li>
          <li>Check every price. They are copied as numbers, so a NZ$180 job becomes A$180 in an Australian market.</li>
          <li>Add tradies and choose a first choice and backup for each trade.</li>
          <li>Move it to &ldquo;Waiting list&rdquo; to collect interest, then to &ldquo;Live&rdquo; when the tradies are ready.</li>
        </ol>
        <ActionForm action={addMarket} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="newName" required maxLength={60} placeholder="Wanaka" />
            <Field label="Short code" name="newSlug" required maxLength={40} placeholder="wanaka" hint="Lower-case, no spaces. Used in links: /in/wanaka. Cannot be changed later." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Country" name="country" required placeholder="Choose" options={[{ key: "NZ", label: "New Zealand (NZD, 15% GST)" }, { key: "AU", label: "Australia (AUD, 10% GST)" }]} />
            <Select label="Timezone" name="newTimezone" required placeholder="Choose" options={TIMEZONES} />
          </div>
          <Select label="Copy memberships and menu from" name="copyFrom" placeholder="Choose" required options={markets.map((market) => ({ key: market.slug, label: market.name }))} defaultValue={markets[0]?.slug} />
          <SubmitButton pendingLabel="Adding...">Add market</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
