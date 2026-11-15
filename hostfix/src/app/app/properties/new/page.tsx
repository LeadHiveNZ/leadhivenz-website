import type { Metadata } from "next";
import Link from "next/link";
import { addProperty } from "@/app/actions/owner";
import { ActionForm, Area, Field, RadioCards } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice, PageTitle } from "@/components/ui/Bits";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { tierLine } from "@/lib/markets/display";
import { listMarkets, listTiers } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Add a property" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewPropertyPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOwner("/app/properties/new");
  const params = await searchParams;
  const db = await getDb();
  const live = (await listMarkets(db)).filter((market) => market.stage === "live");
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 12) : "";

  if (live.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Add a property" back={{ href: "/app", label: "Home" }} />
        <Notice tone="info" title="We are not open in your area yet">
          We are signing up tradies first so that every job gets a fast answer. We will email you the day we open.{" "}
          <Link href="/owners" className="font-semibold underline underline-offset-2">
            See where we are launching
          </Link>
        </Notice>
      </div>
    );
  }

  const market = live.find((candidate) => candidate.slug === params.market) ?? live[0]!;
  const tiers = (await listTiers(db, market.slug)).filter((tier) => tier.active);
  const preferred = tiers.find((tier) => tier.id === params.tier) ?? tiers[0];

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Add a property" back={{ href: "/app/properties", label: "Properties" }} intro="Two minutes. You can change any of this later." />

      {live.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-muted">Where is it?</span>
          {live.map((candidate) => (
            <Link
              key={candidate.slug}
              href={`/app/properties/new?market=${candidate.slug}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`}
              aria-current={candidate.slug === market.slug ? "true" : undefined}
              className={`rounded-full border px-3.5 py-1.5 font-semibold ${candidate.slug === market.slug ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      )}

      <Card className="sm:p-7">
        <ActionForm action={addProperty} className="space-y-5">
          <input type="hidden" name="market" value={market.slug} />
          <input type="hidden" name="ref" value={ref} />
          <Field label="What do you call this place?" name="name" required maxLength={80} placeholder="Lakeview Apartment" hint="Just for you, to tell your properties apart." />
          <Field label="Street address" name="addressLine1" required maxLength={120} autoComplete="address-line1" placeholder="14B Lake Esplanade" />
          <Field label="Unit, floor or building (optional)" name="addressLine2" maxLength={120} autoComplete="address-line2" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Suburb or town" name="suburb" required maxLength={60} autoComplete="address-level2" placeholder={market.name} />
            <Field label="Postcode" name="postcode" maxLength={10} inputMode="numeric" autoComplete="postal-code" />
          </div>
          <Area
            label="How does a tradie get in?"
            name="accessNotes"
            rows={4}
            maxLength={1500}
            placeholder="Lockbox by the front door, code 4821. Park on the street. Water shut-off is under the kitchen sink."
            hint="Only shown to the tradie who takes a job, never before."
          />
          <RadioCards
            name="tierId"
            legend="Choose a membership"
            defaultValue={preferred?.id}
            options={tiers.map((tier, index) => ({
              value: tier.id,
              title: tier.name,
              detail: tierLine(tier, market),
              right: `${formatMoney(tier.monthlyPriceCents, market.currency)} a month`,
              badge: index === 1 ? "Most cover" : undefined,
            }))}
          />
          <p className="text-sm text-muted">
            Nothing is charged yet. On the next screen you start the membership and add your card. Jobs are charged at the fixed price when they are done.
          </p>
          <SubmitButton pendingLabel="Saving..." className="w-full">
            Save and continue
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
