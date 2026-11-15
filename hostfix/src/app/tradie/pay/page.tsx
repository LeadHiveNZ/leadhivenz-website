import type { Metadata } from "next";
import Link from "next/link";
import { openPayoutAccount } from "@/app/actions/tradie";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { smallButtonClass } from "@/components/forms/styles";
import { Card, Chip, Notice, PageTitle, Stat } from "@/components/ui/Bits";
import { PrintButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { requireTradie } from "@/lib/auth/current";
import { tradieStatement } from "@/lib/billing/statements";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import type { StatusTone } from "@/lib/jobs/types";
import { getMarket } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { isMonthKey, shiftMonth } from "@/lib/months";
import { getTradie } from "@/lib/tradies/service";
import { formatDate, monthKey, monthLabel } from "@/lib/time";
import { payTiming } from "@/lib/markets/display";

export const metadata: Metadata = { title: "Pay" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  sent: { label: "Paid", tone: "done" },
  scheduled: { label: "On its way", tone: "active" },
  waiting: { label: "Waiting on the owner's card", tone: "waiting" },
  paused: { label: "On hold", tone: "alert" },
  failed: { label: "Could not be sent", tone: "alert" },
};

export default async function TradiePayPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireTradie("/tradie/pay");
  const query = await searchParams;
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  const market = tradie ? await getMarket(db, tradie.market) : null;
  if (!tradie || !market) return <Notice tone="error" title="We could not find your tradie profile" />;

  const thisMonth = monthKey(now(), market.timezone);
  const month = isMonthKey(query.month) && query.month <= thisMonth ? query.month : thisMonth;
  const statement = await tradieStatement(db, tradie, market, month);
  const money = (cents: number) => formatMoney(cents, statement.currency);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageTitle title="Pay" intro={payTiming(market).line} />
      </div>

      {!tradie.payoutsEnabled ? (
        <div className="no-print">
          <Notice tone="error" title="Your bank details are not set up">
            We cannot pay you, so we cannot offer you jobs.{" "}
            <Link href="/tradie/profile#bank" className="font-semibold underline underline-offset-2">
              Add bank details
            </Link>
          </Notice>
        </div>
      ) : (
        tradie.payoutProvider === "stripe" && (
          <div className="no-print">
            <ActionForm action={openPayoutAccount}>
              <SubmitButton variant="secondary" pendingLabel="Opening...">
                See my payouts or change my bank account
              </SubmitButton>
            </ActionForm>
          </div>
        )
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label={`Paid in ${monthLabel(month)}`} value={money(statement.paidCents)} tone="good" note={statement.taxCents !== null ? `Includes ${market.taxName} of ${money(statement.taxCents)}` : undefined} />
        <Stat label="Still to come" value={money(statement.pendingCents)} />
      </div>

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Payout statement</p>
            <h2 className="display text-2xl text-ink">{monthLabel(month)}</h2>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Link href={`/tradie/pay?month=${shiftMonth(month, -1)}`} className={smallButtonClass}>
              <Icon name="back" size={16} /> Earlier
            </Link>
            {month < thisMonth && (
              <Link href={`/tradie/pay?month=${shiftMonth(month, 1)}`} className={smallButtonClass}>
                Later <Icon name="arrow" size={16} />
              </Link>
            )}
            <PrintButton>Print or save</PrintButton>
          </div>
        </div>
        {statement.lines.length === 0 ? (
          <p className="mt-5 text-muted">No jobs were paid in {monthLabel(month)}.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {statement.lines.map((line) => {
              const status = STATUS[line.status] ?? { label: line.status, tone: "quiet" as StatusTone };
              return (
                <li key={`${line.number}-${line.status}`} className="flex items-center justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      Job {line.number}: {line.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      {formatDate(line.date, market.timezone)} · {line.suburb} <Chip tone={status.tone}>{status.label}</Chip>
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-semibold text-ink">{money(line.amountCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">
          {tradie.businessName}
          {tradie.gstRegistered && tradie.gstNumber ? `, ${market.taxName} number ${tradie.gstNumber}` : ""}. Amounts are what was paid to you after the platform fee.
        </p>
      </Card>
    </div>
  );
}
