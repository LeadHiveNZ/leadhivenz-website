import type { Metadata } from "next";
import Link from "next/link";
import { resolveItem } from "@/app/actions/staff";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { smallButtonClass } from "@/components/forms/styles";
import { Card, Chip, EmptyState, Notice, PageTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { requireStaff } from "@/lib/auth/current";
import { MINUTE, now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { lastTick } from "@/lib/dispatch/tick";
import { demoModeAllowed } from "@/lib/env";
import { listMarkets } from "@/lib/markets/store";
import { EXCEPTION_ACTIONS, EXCEPTION_LABELS, listExceptions, TIME_BOUND, type ExceptionKind } from "@/lib/ops/exceptions";
import { formatDateTime, formatDeadline, formatDuration } from "@/lib/time";

export const metadata: Metadata = { title: "Queue" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RED: ExceptionKind[] = ["nobody_accepted", "missed_window", "dispute", "chargeback", "payout_failed", "payment_failed"];

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const showDone = query.show === "done";
  const items = await listExceptions(db, { status: showDone ? "resolved" : "open", limit: 150 });
  const markets = new Map((await listMarkets(db)).map((market) => [market.slug, market]));
  const zone = (slug: string | null) => (slug ? markets.get(slug)?.timezone : undefined) ?? [...markets.values()][0]?.timezone ?? "Pacific/Auckland";
  const at = now();
  const tick = await lastTick(db);
  const stale = !tick || at.getTime() - tick.at.getTime() > 5 * MINUTE;
  const pill = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? "border-brand bg-tint text-brand" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Queue"
        intro={`Hello ${staff.name.split(" ")[0]}. Everything here needs a person. Work from the top: the most pressing is first. An empty queue means the system is handling everything itself.`}
      />

      {stale && !demoModeAllowed() && (
        <div className="mb-5">
          <Notice tone="error" title="The timer has stopped">
            {tick ? `It last ran ${formatDuration(at.getTime() - tick.at.getTime())} ago.` : "It has never run."} Offers will not move on to the next tradie and tradies will not be paid until it is running again. Tell the admin now.
          </Notice>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href="/admin/queue" className={pill(!showDone)}>
          Needs you
        </Link>
        <Link href="/admin/queue?show=done" className={pill(showDone)}>
          Dealt with
        </Link>
        {tick && (
          <span className="ml-auto text-sm text-muted">
            Timer last ran {formatDuration(Math.max(0, at.getTime() - tick.at.getTime()))} ago
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="check" title={showDone ? "Nothing has been dealt with yet" : "The queue is empty"}>
          {showDone ? "Items you mark as dealt with show here." : "Nothing needs you right now."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <Card as="li" key={item.id} className={item.status === "open" && RED.includes(item.kind) ? "border-alert/40" : ""}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={item.status === "resolved" ? "done" : RED.includes(item.kind) ? "alert" : "waiting"}>{EXCEPTION_LABELS[item.kind]}</Chip>
                {item.market && <span className="text-sm text-muted">{markets.get(item.market)?.name ?? item.market}</span>}
                <span className="tabular ml-auto text-sm text-muted">{formatDateTime(item.createdAt, zone(item.market))}</span>
              </div>
              <p className="mt-2.5 text-ink">{item.summary}</p>
              {item.status === "open" && item.respondBy && item.jobId && TIME_BOUND.includes(item.kind) && (
                <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-semibold ${item.respondBy.getTime() <= at.getTime() ? "text-alert" : "text-wait"}`}>
                  <Icon name="clock" size={16} />
                  {item.respondBy.getTime() <= at.getTime() ? "Was promised by" : "Promised on site by"} {formatDeadline(item.respondBy, at, zone(item.market))}
                </p>
              )}
              {item.status === "open" ? (
                <>
                  <p className="mt-3 rounded-xl bg-tint px-3.5 py-2.5 text-sm text-ink">
                    <span className="font-bold">What to do: </span>
                    {EXCEPTION_ACTIONS[item.kind]}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.jobId && (
                      <Link href={`/admin/jobs/${item.jobId}`} className={smallButtonClass}>
                        Open job {item.jobNumber}
                      </Link>
                    )}
                    {item.tradieId && (
                      <Link href={`/admin/tradies/${item.tradieId}`} className={smallButtonClass}>
                        Open {item.tradieName ?? "the tradie"}
                      </Link>
                    )}
                    {item.kind === "referral_due" && (
                      <Link href="/admin/referrals" className={smallButtonClass}>
                        Open referrals
                      </Link>
                    )}
                  </div>
                  <div className="mt-3">
                    <Reveal label="Mark as dealt with">
                      <ActionForm action={resolveItem} className="space-y-3">
                        <input type="hidden" name="exceptionId" value={item.id} />
                        <Field label="What did you do? (optional)" name="note" maxLength={300} placeholder="Rang the tradie, he is 10 minutes away." />
                        <SubmitButton variant="secondary" pendingLabel="Saving...">
                          Dealt with
                        </SubmitButton>
                      </ActionForm>
                    </Reveal>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Dealt with by {item.resolvedBy === "system" ? "the system" : (item.resolvedBy ?? "someone")}
                  {item.resolvedAt ? ` on ${formatDateTime(item.resolvedAt, zone(item.market))}` : ""}
                  {item.resolutionNote ? `: ${item.resolutionNote}` : "."}
                  {item.jobId && (
                    <>
                      {" "}
                      <Link href={`/admin/jobs/${item.jobId}`} className="font-semibold text-brand underline underline-offset-2">
                        Job {item.jobNumber}
                      </Link>
                    </>
                  )}
                </p>
              )}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
