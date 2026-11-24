import type { Metadata } from "next";
import Link from "next/link";
import { addTradie, staffSetSlot, staffSwapSlots } from "@/app/actions/staff";
import { ActionForm, CheckList, Checks, Field, Select, Tick } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { Reveal } from "@/components/ui/Reveal";
import { trades } from "@config/trades";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import type { StatusTone } from "@/lib/jobs/types";
import { listMarkets } from "@/lib/markets/store";
import { displayPhone } from "@/lib/phone";
import { flagCounts, flagsNeedReview, needsReview, NO_SHOW_DAYS, noShowCounts } from "@/lib/tradies/reliability";
import { SCORE_DAYS, scorecards, swapPrompts, TARGET } from "@/lib/tradies/scorecard";
import { coverage, listSlots, listTradies, type TradieStatus } from "@/lib/tradies/service";
import { dateKey } from "@/lib/time";
import { WEEKDAY_OPTIONS } from "@/lib/weekdays";

export const metadata: Metadata = { title: "Tradies" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS: Record<TradieStatus, { label: string; tone: StatusTone }> = {
  applied: { label: "Waiting for approval", tone: "alert" },
  approved: { label: "Approved", tone: "done" },
  paused: { label: "Paused", tone: "waiting" },
  removed: { label: "Removed", tone: "quiet" },
};

const pct = (rate: number | null) => (rate === null ? "-" : `${Math.round(rate * 100)}%`);

export default async function TradiesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const markets = await listMarkets(db);
  const market = markets.find((candidate) => candidate.slug === query.market) ?? markets.find((candidate) => candidate.stage === "live") ?? markets[0];
  if (!market) return <EmptyState icon="market" title="No markets yet">Add a market first, under More.</EmptyState>;

  const tradies = await listTradies(db, { market: market.slug });
  const cards = new Map((await scorecards(db, market.slug)).map((card) => [card.tradieId, card]));
  const noShows = await noShowCounts(db, market.slug);
  const flags = await flagCounts(db, market.slug);
  const prompts = await swapPrompts(db, market.slug);
  const cover = await coverage(db, market.slug, dateKey(now(), market.timezone));
  const slots = await listSlots(db, market.slug);
  const approved = tradies.filter((tradie) => tradie.status === "approved");
  const shown = tradies.filter((tradie) => tradie.status !== "removed" || query.removed);
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div className="space-y-7">
      <PageTitle title="Tradies" intro={`Who is on the network in ${market.name}, who gets first pick of each trade, and how reliable they have been.`} />

      {markets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {markets.map((candidate) => (
            <Link key={candidate.slug} href={`/admin/tradies?market=${candidate.slug}`} className={pill(candidate.slug === market.slug)}>
              {candidate.name}
            </Link>
          ))}
        </div>
      )}

      {prompts.map((prompt) => (
        <Card key={prompt.trade} className="border-alert/40">
          <p className="font-bold text-ink">Consider swapping first choice and backup for {prompt.tradeLabel.toLowerCase()}</p>
          <p className="mt-1 text-muted">{prompt.reason}</p>
          {prompt.backup && (
            <ActionForm action={staffSwapSlots} className="mt-3">
              <input type="hidden" name="market" value={market.slug} />
              <input type="hidden" name="trade" value={prompt.trade} />
              <SubmitButton variant="secondary" pendingLabel="Swapping...">
                Make {prompt.backup.businessName} first choice
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      ))}

      <section>
        <SectionTitle>First choice and backup, by trade</SectionTitle>
        <p className="mb-3 text-muted">
          A new job is offered to the first choice for {market.offerMinutes} minutes, then the backup, then every other approved tradie in that trade at once. &ldquo;Ready&rdquo; counts tradies who could be offered a job today: approved,
          with bank details and, where needed, a current licence (or, for building work, an LBP number).
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {cover.map((row) => {
            const options = [{ key: "none", label: "Nobody" }, ...approved.filter((tradie) => tradie.trades.includes(row.trade)).map((tradie) => ({ key: tradie.id, label: tradie.businessName }))];
            const first = slots.find((slot) => slot.trade === row.trade && slot.rank === 1);
            const backup = slots.find((slot) => slot.trade === row.trade && slot.rank === 2);
            return (
              <Card key={row.trade} className={row.ready === 0 ? "border-alert/40" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-ink">
                    {row.label}
                    {row.licenceRequired && <span className="ml-2 text-sm font-normal text-muted">licence needed</span>}
                    {row.lbpRequired && <span className="ml-2 text-sm font-normal text-muted">LBP number needed</span>}
                  </p>
                  <Chip tone={row.ready === 0 ? "alert" : row.ready < 2 ? "waiting" : "done"}>{row.ready} ready</Chip>
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  First choice: <span className={row.firstChoice ? "font-semibold text-ink" : "font-semibold text-alert"}>{row.firstChoice ?? "nobody"}</span> · Backup:{" "}
                  <span className={row.backup ? "font-semibold text-ink" : "text-muted"}>{row.backup ?? "nobody"}</span>
                </p>
                {row.ready === 0 && <p className="mt-1.5 text-sm font-semibold text-alert">Any {row.label.toLowerCase()} job logged now would go straight to the queue: there is nobody to offer it to.</p>}
                {options.length > 1 && (
                  <div className="mt-3">
                    <Reveal label="Change who gets first pick">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {([1, 2] as const).map((rank) => (
                          <ActionForm key={rank} action={staffSetSlot} className="space-y-2">
                            <input type="hidden" name="market" value={market.slug} />
                            <input type="hidden" name="trade" value={row.trade} />
                            <input type="hidden" name="rank" value={rank} />
                            <Select
                              label={rank === 1 ? "First choice" : "Backup"}
                              name="tradieId"
                              options={options}
                              placeholder="Choose"
                              defaultValue={(rank === 1 ? first?.tradieId : backup?.tradieId) ?? "none"}
                            />
                            <SubmitButton variant="small" pendingLabel="Saving...">
                              Save {rank === 1 ? "first choice" : "backup"}
                            </SubmitButton>
                          </ActionForm>
                        ))}
                      </div>
                    </Reveal>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle>
          Everyone ({shown.length})
        </SectionTitle>
        {shown.length === 0 ? (
          <EmptyState icon="tradie" title="No tradies yet">
            Add the first one below, or turn a tradie lead into a tradie from More, Leads.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-tint/60 text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold">Tradie</th>
                  <th className="px-4 py-3 font-bold">Work</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold" title={`Accepted jobs with nobody there by the promised time, last ${NO_SHOW_DAYS} days`}>
                    No-shows
                  </th>
                  <th className="px-4 py-3 text-right font-bold" title={`Last ${SCORE_DAYS} days`}>
                    On time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((tradie) => {
                  const card = cards.get(tradie.id);
                  const status = STATUS[tradie.status];
                  return (
                    <tr key={tradie.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link href={`/admin/tradies/${tradie.id}`} className="font-bold text-brand underline underline-offset-2">
                          {tradie.businessName}
                        </Link>
                        <span className="block text-muted">
                          {tradie.name} · {tradie.phone ? displayPhone(tradie.phone) : "no mobile"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{tradie.trades.map((key) => trades.find((trade) => trade.key === key)?.label ?? key).join(", ")}</td>
                      <td className="px-4 py-3">
                        <Chip tone={status.tone}>{status.label}</Chip>
                        {tradie.status !== "removed" && !tradie.payoutsEnabled && <span className="mt-1 block text-xs font-semibold text-alert">No bank details</span>}
                      </td>
                      <td className={`tabular px-4 py-3 text-right font-semibold ${needsReview(noShows.get(tradie.id) ?? 0) ? "text-alert" : "text-ink"}`}>
                        {noShows.get(tradie.id) ?? 0}
                        {needsReview(noShows.get(tradie.id) ?? 0) && <span className="block text-xs font-normal text-alert">Talk to them</span>}
                        {flagsNeedReview(flags.get(tradie.id) ?? 0) && <span className="block text-xs font-normal text-alert">{flags.get(tradie.id)} flagged jobs</span>}
                      </td>
                      <td className={`tabular px-4 py-3 text-right font-semibold ${card && card.onTimeRate !== null && card.onTimeRate < TARGET && card.jobs >= 3 ? "text-alert" : "text-ink"}`}>
                        {pct(card?.onTimeRate ?? null)}
                        {card && card.jobs > 0 && <span className="block text-xs font-normal text-muted">{card.onTime} of {card.jobs}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          On time is for the last {SCORE_DAYS} days, on jobs they accepted. Under {Math.round(TARGET * 100)}% shows in red once there is enough history to be fair. No-shows are
          for the last {NO_SHOW_DAYS} days. Passing on offers is never counted against anyone. Only a person pauses or removes a tradie.{" "}
          {!query.removed && (
            <Link href={`/admin/tradies?market=${market.slug}&removed=1`} className="font-semibold text-brand underline underline-offset-2">
              Show removed tradies
            </Link>
          )}
        </p>
      </section>

      <Reveal label="Add a tradie">
        <ActionForm action={addTradie} className="space-y-4">
          <input type="hidden" name="market" value={market.slug} />
          <Notice tone="info">They start as &ldquo;waiting for approval&rdquo;. Add their licence, check it, then approve them: that texts them a link to sign in and add their bank details.</Notice>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Their name" name="name" required maxLength={80} />
            <Field label="Business name" name="businessName" maxLength={80} hint="Leave empty to use their name." />
            <Field label="Mobile" name="phone" type="tel" inputMode="tel" required maxLength={30} />
            <Field label="Email (optional)" name="email" type="email" maxLength={120} />
          </div>
          <CheckList name="trades" legend="Work they do" options={trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: trade.label, detail: trade.licenceRequired ? "Needs a licence on file" : trade.lbpRequired ? "Needs an LBP number on file" : undefined }))} />
          <Checks label="Days they work" name="daysAvailable" options={WEEKDAY_OPTIONS} defaultValues={["mon", "tue", "wed", "thu", "fri"]} />
          <Tick name="afterHours" label="Takes after-hours call-outs" />
          <Tick name="gstRegistered" label={`Registered for ${market.taxName}`} />
          <SubmitButton pendingLabel="Adding...">Add tradie</SubmitButton>
        </ActionForm>
      </Reveal>
    </div>
  );
}
