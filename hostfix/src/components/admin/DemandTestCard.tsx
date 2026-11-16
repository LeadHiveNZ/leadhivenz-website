import { startDemandTestAction } from "@/app/actions/staff-admin";
import { ActionForm } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Reveal } from "@/components/ui/Reveal";
import { TARGETS, TEST_DAYS, type DemandNumbers, type DemandTest, type Verdict } from "@/lib/leads/demand-test";
import { formatDate } from "@/lib/time";

const TRADE_WORDS: Record<string, [string, string]> = { handyman: ["handyman", "handymen"], plumber: ["plumber", "plumbers"], electrician: ["electrician", "electricians"] };

function percent(part: number, whole: number): string {
  return whole === 0 ? "-" : `${Math.round((part / whole) * 100)}%`;
}

/**
 * The demand test at a glance, on top of the leads list: day of fourteen,
 * deposits against the pass mark, and which button and which ad owners chose.
 */
export function DemandTestCard({
  test, numbers, verdict, marketName, marketSlug, timezone,
}: {
  test: DemandTest | null;
  numbers: DemandNumbers | null;
  verdict: Verdict | null;
  marketName: string;
  marketSlug: string;
  timezone: string;
}) {
  if (!test || !numbers || !verdict) {
    return (
      <section aria-labelledby="demand-title" className="rounded-2xl border-2 border-brand/30 bg-surface p-5 sm:p-6">
        <h2 id="demand-title" className="display text-2xl text-ink">
          The demand test
        </h2>
        <p className="mt-2 text-muted">
          {TEST_DAYS} days of ads to the {marketName} owner page. It passes if {TARGETS.deposits} owners put a card down for a founding spot. Start the clock the day your ads go live, and this
          card counts everything from then.
        </p>
        <ActionForm action={startDemandTestAction} className="mt-4">
          <input type="hidden" name="market" value={marketSlug} />
          <SubmitButton pendingLabel="Starting...">Start the {TEST_DAYS} days today</SubmitButton>
        </ActionForm>
      </section>
    );
  }

  const tone = verdict.passed ? "border-done/50" : verdict.finished ? "border-alert/50" : "border-brand/30";
  const owners = numbers.ownerLeads;
  return (
    <section aria-labelledby="demand-title" className={`rounded-2xl border-2 bg-surface p-5 sm:p-6 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demand-title" className="display text-2xl text-ink">
          The demand test
        </h2>
        <p className="text-sm font-semibold text-muted">
          {verdict.finished ? "Finished" : `Day ${verdict.day} of ${TEST_DAYS}`} · {formatDate(test.startedAt, timezone)} to {formatDate(new Date(test.endsAt.getTime() - 1), timezone)}
        </p>
      </div>
      <p className={`mt-2 text-lg font-bold ${verdict.passed ? "text-done" : verdict.finished ? "text-alert" : "text-ink"}`}>{verdict.headline}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Number label="Cards down" value={`${numbers.paid} of ${TARGETS.deposits}`} note={numbers.refunded > 0 ? `${numbers.refunded} refunded since` : "The pass mark"} strong />
        <Number label="Owner leads" value={String(owners)} note={`Aim: ${TARGETS.ownerLeads} or more`} />
        <Number label="Went for a spot" value={String(numbers.wantedSpot)} note={`${percent(numbers.wantedSpot, owners)} of owners. ${numbers.reachedCardPage} reached the card page`} />
        <Number label="Took the price list" value={String(numbers.priceList)} note={`${percent(numbers.priceList, owners)} of owners`} />
      </dl>

      <p className="mt-4 text-sm text-muted">
        <span className="font-semibold text-ink">Tradie leads: </span>
        {Object.entries(TARGETS.tradies)
          .map(([trade, target]) => {
            const count = numbers.tradieLeads[trade] ?? 0;
            const [one, many] = TRADE_WORDS[trade] ?? [trade, trade];
            return `${count} ${count === 1 ? one : many} (want ${target})`;
          })
          .join(" · ")}
        . A lead is not a yes: ring them to confirm.
      </p>

      {numbers.byAd.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-1.5 text-left text-xs font-bold tracking-wide text-muted uppercase">By ad (from the link&apos;s utm_content)</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-1.5 pr-4 font-semibold">Ad</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-semibold">Owners</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-semibold">Went for a spot</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Cards down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {numbers.byAd.map((line) => (
                <tr key={line.ad}>
                  <td className="py-1.5 pr-4 text-ink">{line.ad}</td>
                  <td className="tabular py-1.5 pr-4 text-right">{line.leads}</td>
                  <td className="tabular py-1.5 pr-4 text-right">{line.spotsWanted}</td>
                  <td className="tabular py-1.5 text-right font-semibold text-ink">{line.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        Ad spend and clicks are in Meta and Google Ads, not here. Ring every owner the same day and ask what happened the last time something broke with a guest in the house: those calls tell you
        more than these numbers.
      </p>
      <div className="mt-3">
        <Reveal label="Start the 14 days again">
          <ActionForm action={startDemandTestAction} className="space-y-3">
            <input type="hidden" name="market" value={test.market} />
            <p className="text-sm text-muted">The count starts again from today. Leads already in stay in the list, and the old start is kept in the audit log.</p>
            <SubmitButton variant="secondary" pendingLabel="Starting...">
              Start again from today
            </SubmitButton>
          </ActionForm>
        </Reveal>
      </div>
    </section>
  );
}

function Number({ label, value, note, strong = false }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3.5 ${strong ? "bg-brand text-white" : "bg-tint"}`}>
      <dt className={`text-xs font-semibold tracking-wide uppercase ${strong ? "text-white/80" : "text-muted"}`}>{label}</dt>
      <dd className={`tabular mt-0.5 text-2xl font-bold ${strong ? "text-white" : "text-ink"}`}>{value}</dd>
      {note && <dd className={`text-xs ${strong ? "text-white/80" : "text-muted"}`}>{note}</dd>}
    </div>
  );
}
