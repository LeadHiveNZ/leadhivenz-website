import type { Metadata } from "next";
import { payReferral } from "@/app/actions/staff-admin";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, EmptyState, PageTitle } from "@/components/ui/Bits";
import { requireAdminRole } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import type { StatusTone } from "@/lib/jobs/types";
import { listMarkets } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { listReferrals } from "@/lib/owners/referrers";
import { displayPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Referrals" };

const LOOK: Record<string, { label: string; tone: StatusTone }> = {
  due: { label: "Pay now", tone: "alert" },
  pending: { label: "Not due yet", tone: "waiting" },
  paid: { label: "Paid", tone: "done" },
  void: { label: "Cancelled", tone: "quiet" },
};

export default async function ReferralsPage() {
  await requireAdminRole();
  const db = await getDb();
  const referrals = await listReferrals(db);
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Referrals"
        back={{ href: "/admin/more", label: "More" }}
        intro="A cleaner or co-host who sends an owner earns a reward once that property has paid for the set number of months. Pay it by bank transfer, then record it here. The app does not move this money."
      />
      {referrals.length === 0 ? (
        <EmptyState icon="gift" title="No referrals yet">
          They appear when an owner joins using a cleaner&apos;s link from the Refer page.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {referrals.map((referral) => {
            const market = markets.get(referral.market);
            const look = LOOK[referral.status] ?? LOOK.pending!;
            const zone = market?.timezone ?? "Pacific/Auckland";
            return (
              <Card as="li" key={referral.id} className={referral.status === "due" ? "border-alert/40" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">
                      {referral.referrerName} · {formatMoney(referral.rewardCents, referral.currency)}
                    </p>
                    <p className="text-sm text-muted">
                      <a href={`tel:${referral.referrerPhone}`} className="text-brand underline underline-offset-2">
                        {displayPhone(referral.referrerPhone)}
                      </a>{" "}
                      · sent {referral.propertyName} ({market?.name ?? referral.market})
                    </p>
                  </div>
                  <Chip tone={look.tone}>{look.label}</Chip>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {referral.status === "pending" && `${referral.paidMonths} of ${market?.referralPaidMonths ?? 3} months paid so far.`}
                  {referral.status === "due" && `Due since ${referral.dueAt ? formatDate(referral.dueAt, zone) : "recently"}.`}
                  {referral.status === "paid" && `Paid ${referral.paidAt ? formatDate(referral.paidAt, zone) : ""}${referral.paidNote ? `: ${referral.paidNote}` : "."}`}
                  {referral.status === "void" && "The property cancelled before the reward was earned."}
                </p>
                {referral.status === "due" && (
                  <ActionForm action={payReferral} className="mt-3 space-y-3">
                    <input type="hidden" name="referralId" value={referral.id} />
                    <Field label="How was it paid? (for your records)" name="paidNote" maxLength={200} placeholder="Bank transfer 14 Nov, ref HOSTFIX-REF" />
                    <SubmitButton variant="secondary" pendingLabel="Saving...">
                      I have paid this
                    </SubmitButton>
                  </ActionForm>
                )}
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
