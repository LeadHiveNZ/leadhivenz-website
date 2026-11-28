import type { Metadata } from "next";
import { addBankAccount } from "@/app/actions/owner";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Notice, PageTitle } from "@/components/ui/Bits";
import { requireOwner } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getJobForOwner } from "@/lib/jobs/store";
import { DEPOSIT_ABOVE_CENTS } from "@/lib/jobs/pricing";
import { cardsOpenSoon } from "@/lib/markets/launch";
import { inPreLaunch, marketNames, preLaunchWords } from "@/lib/markets/stage";
import { listMarkets } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { getBilling } from "@/lib/owners/service";
import { listProperties } from "@/lib/properties/service";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Bank account" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Adding the owner's NZ bank account for work over NZ$1,000 (DECISIONS.md, 2026-11-23, second entry). The account and
 * the Direct Debit Authority go on Stripe's own page; bank details never touch this app.
 */
export default async function BankAccountPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireOwner("/app/billing/bank");
  const query = await searchParams;
  const db = await getDb();
  const jobId = typeof query.job === "string" && isUuid(query.job) ? query.job : null;
  const job = jobId ? await getJobForOwner(db, viewer.ownerId, jobId) : null;
  const properties = await listProperties(db, viewer.ownerId);
  const allMarkets = await listMarkets(db);
  const markets = allMarkets.filter((market) => market.country === "NZ" && (job ? market.slug === job.market : properties.some((property) => property.market === market.slug)));
  // An area that is open for bookings first, so an owner who is also waiting on another one is never stopped here.
  const market = markets.find((candidate) => !inPreLaunch(candidate)) ?? markets[0] ?? null;
  // Pre-launch (DECISIONS.md, 2026-11-27, second entry): no bank account is taken until bookings open. The action refuses it too.
  const soon = cardsOpenSoon(properties, allMarkets, "NZ");
  const billing = market ? await getBilling(db, viewer.ownerId, "NZ") : null;
  const big = formatMoney(DEPOSIT_ABOVE_CENTS, market?.currency ?? "NZD");

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageTitle title="Bank account" back={job ? { href: `/app/jobs/${job.id}`, label: "Job" } : { href: "/app/billing", label: "Billing" }} />
      {billing?.bankPaymentMethodId && (
        <Notice tone="good" title="Your bank account is saved">
          {billing.bankName ?? "Bank account"}
          {billing.bankLast4 ? ` ending ${billing.bankLast4}` : ""}. Adding another replaces it.
        </Notice>
      )}
      <Card className="sm:p-6">
        <h1 className="display text-2xl text-ink">Pay big work from your bank</h1>
        <p className="mt-3 text-ink">
          When you approve work that takes a job over {big}, half is taken as a deposit when you approve it and the rest when the tradie taps Job done.
          Paying from your bank account has no card fees, so it is what we recommend.
        </p>
        <p className="mt-3 text-sm text-muted">
          You add your account once, on Stripe&apos;s secure page, and agree to the direct debit there. Nothing is taken now. Stripe emails you before each debit. A
          debit usually takes 3-4 working days to clear, and the tradie starts the work once the deposit has. For urgent work you can pay by card instead.
        </p>
        {soon.length > 0 ? (
          <div className="mt-5">
            <Notice tone="info" title="Opens soon">
              {preLaunchWords.title(marketNames(soon))}. You can add your bank account from the day we go live. Nothing is needed from you until then.
            </Notice>
          </div>
        ) : market ? (
          <ActionForm action={addBankAccount} className="mt-5">
            <input type="hidden" name="market" value={market.slug} />
            {job && <input type="hidden" name="job" value={job.id} />}
            <SubmitButton pendingLabel="Opening..." className="w-full">
              Add my bank account
            </SubmitButton>
          </ActionForm>
        ) : (
          <p className="mt-5 text-muted">Paying from a bank account is for New Zealand properties.</p>
        )}
      </Card>
    </div>
  );
}
