import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { secondaryButtonClass } from "@/components/forms/styles";
import { sourceLabel } from "@/lib/attribution";
import { requireAdmin } from "@/lib/auth/admin";
import { depositLabel, formatWhen, leadSummary, leadTimezone } from "@/lib/leads/display";
import { formatMoney } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { setupStatus, type StatusItem } from "@/lib/status";
import { getStore, storeKind } from "@/lib/store";
import type { Lead, LeadCounts, LeadType, StoredNotification } from "@/lib/store/types";
import { TestAlertButton } from "./TestAlertButton";

export const metadata: Metadata = { title: "Leads" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 100;
const MAX_SHOWN = 2000;

export default function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <Suspense fallback={<p className="py-10 text-center text-muted">Loading leads...</p>}>
        <LeadsDashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LeadsDashboard({ searchParams }: { searchParams: SearchParams }) {
  // Wait for a real visit, then the lock. Nothing below runs for someone who is not signed in.
  await connection();
  await requireAdmin();

  const params = await searchParams;
  const filter: LeadType | undefined = params.type === "owner" || params.type === "tradie" ? params.type : undefined;
  const requested = Number(typeof params.show === "string" ? params.show : PAGE_SIZE);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), PAGE_SIZE), MAX_SHOWN) : PAGE_SIZE;

  let leads: Lead[] = [];
  let counts: LeadCounts | null = null;
  let notifications: StoredNotification[] = [];
  let loadProblem: string | null = null;
  try {
    const store = getStore();
    [leads, counts] = await Promise.all([store.listLeads({ leadType: filter, limit }), store.countLeads()]);
    notifications = await store.listNotifications(leads.map((lead) => lead.id));
  } catch (error) {
    loadProblem = error instanceof Error ? error.message : "The leads could not be loaded.";
  }
  const status = await setupStatus();

  const alertsByLead = new Map<string, StoredNotification[]>();
  for (const notification of notifications) {
    if (!notification.leadId || notification.template !== "lead_alert") continue;
    alertsByLead.set(notification.leadId, [...(alertsByLead.get(notification.leadId) ?? []), notification]);
  }

  const depositTotal = counts?.depositTotals.map((total) => formatMoney(total.cents, total.currency)).join(" + ") ?? "";
  const filterHref = (type?: LeadType) => (type ? `/admin/leads?type=${type}` : "/admin/leads");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Leads</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/admin/leads/export" className={secondaryButtonClass} download>
            Download spreadsheet
          </a>
          <form action={signOut}>
            <SubmitButton variant="secondary" pendingLabel="Signing out...">
              Sign out
            </SubmitButton>
          </form>
        </div>
      </div>

      {storeKind() === "demo" && (
        <p className="rounded-xl border border-accent bg-surface px-4 py-3 text-sm font-medium text-ink">
          Demo mode. These leads are saved in a file on this computer only, and alerts are not really sent.
        </p>
      )}
      {loadProblem && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          The leads could not be loaded. {loadProblem}
        </p>
      )}

      {counts && (
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Owners" value={String(counts.owners)} />
          <Stat label="Tradies" value={String(counts.tradies)} />
          <Stat label="Deposits paid" value={String(counts.depositsPaid)} note={depositTotal} />
        </dl>
      )}

      <nav aria-label="Filter leads" className="flex gap-2">
        <FilterLink href={filterHref()} active={!filter}>
          All
        </FilterLink>
        <FilterLink href={filterHref("owner")} active={filter === "owner"}>
          Owners
        </FilterLink>
        <FilterLink href={filterHref("tradie")} active={filter === "tradie"}>
          Tradies
        </FilterLink>
      </nav>

      {!loadProblem && leads.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">
          No leads yet. When someone fills in a form, they will appear here and you will get a text and an email.
        </p>
      )}

      {leads.length > 0 && (
        <>
          {/* Phones: one card per lead. */}
          <ul className="space-y-3 md:hidden">
            {leads.map((lead) => (
              <li key={lead.id} className="rounded-2xl border border-line bg-surface p-4" data-lead-id={lead.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <TypeBadge type={lead.leadType} />
                    <p className="mt-1.5 text-lg font-semibold text-ink">{lead.name}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted">{formatWhen(lead.createdAt, leadTimezone(lead))}</p>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base">
                  <a href={`tel:${lead.phone}`} className="font-medium text-brand underline">
                    {displayPhone(lead.phone)}
                  </a>
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="[overflow-wrap:anywhere] font-medium text-brand underline">
                      {lead.email}
                    </a>
                  )}
                </p>
                <p className="mt-2 text-sm text-ink">{leadSummary(lead)}</p>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-ink">Source:</span> <SourceText lead={lead} />
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <DepositBadge lead={lead} />
                  <AlertText alerts={alertsByLead.get(lead.id) ?? []} />
                </div>
              </li>
            ))}
          </ul>

          {/* Bigger screens: a table. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-tint text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Who
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Details
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Deposit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map((lead) => (
                  <tr key={lead.id} className="align-top" data-lead-id={lead.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatWhen(lead.createdAt, leadTimezone(lead))}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{lead.name}</p>
                      <div className="mt-1">
                        <TypeBadge type={lead.leadType} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`tel:${lead.phone}`} className="whitespace-nowrap font-medium text-brand underline">
                        {displayPhone(lead.phone)}
                      </a>
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="mt-1 block [overflow-wrap:anywhere] text-brand underline">
                          {lead.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{leadSummary(lead)}</td>
                    <td className="px-4 py-3 text-muted">
                      <SourceText lead={lead} />
                      <div className="mt-1">
                        <AlertText alerts={alertsByLead.get(lead.id) ?? []} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <DepositBadge lead={lead} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leads.length >= limit && limit < MAX_SHOWN && (
            <p className="text-center">
              <Link
                href={`/admin/leads?${filter ? `type=${filter}&` : ""}show=${limit + PAGE_SIZE}`}
                className="font-medium text-brand underline"
              >
                Show more
              </Link>
            </p>
          )}
        </>
      )}

      <SetupChecklist items={status} />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted sm:text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{value}</dd>
      {note && <dd className="text-sm text-muted">{note}</dd>}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
        active ? "bg-ink text-white" : "border border-line bg-surface text-ink hover:bg-tint"
      }`}
    >
      {children}
    </Link>
  );
}

function TypeBadge({ type }: { type: LeadType }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        type === "owner" ? "bg-brand text-white" : "bg-ink text-white"
      }`}
    >
      {type === "owner" ? "Owner" : "Tradie"}
    </span>
  );
}

function SourceText({ lead }: { lead: Lead }) {
  const extra = [lead.utmCampaign, lead.utmContent, lead.refCode ? `referred by ${lead.refCode}` : null].filter(Boolean).join(" · ");
  return (
    <>
      {sourceLabel(lead.source)}
      {extra && <span className="block text-xs">{extra}</span>}
    </>
  );
}

function DepositBadge({ lead }: { lead: Lead }) {
  const label = depositLabel(lead);
  if (!label) return lead.leadType === "owner" ? <span className="text-muted">No deposit</span> : null;
  const tone =
    lead.depositStatus === "paid"
      ? "bg-brand text-white"
      : lead.depositStatus === "refunded"
        ? "bg-line text-ink"
        : "bg-yellow-200 text-ink";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

/** Whether the alert text and email for this lead were sent. */
function AlertText({ alerts }: { alerts: StoredNotification[] }) {
  if (alerts.length === 0) return null;
  const describe = (channel: "sms" | "email", word: string) => {
    const forChannel = alerts.filter((alert) => alert.channel === channel);
    if (forChannel.length === 0) return null;
    return forChannel.some((alert) => alert.status === "sent") ? `${word} sent` : `${word} FAILED`;
  };
  const parts = [describe("sms", "Text"), describe("email", "Email")].filter(Boolean);
  if (parts.length === 0) return null;
  const failed = parts.some((part) => part?.includes("FAILED"));
  return <span className={`text-xs ${failed ? "font-semibold text-red-700" : "text-muted"}`}>{parts.join(" · ")}</span>;
}

const STATE_STYLE: Record<StatusItem["state"], { dot: string; word: string }> = {
  ok: { dot: "bg-brand", word: "Ready" },
  todo: { dot: "bg-accent", word: "To do" },
  problem: { dot: "bg-red-600", word: "Needs fixing" },
};

function SetupChecklist({ items }: { items: StatusItem[] }) {
  const done = items.filter((item) => item.state === "ok").length;
  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-lg font-semibold text-ink">
            Setup checklist
          </h2>
          <p className="text-sm text-muted">
            {done} of {items.length} ready. SETUP.md has the steps for each one.
          </p>
        </div>
        <TestAlertButton />
      </div>
      <ul className="mt-4 divide-y divide-line">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3 py-3" data-status={item.state} data-status-key={item.key}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATE_STYLE[item.state].dot}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {item.label} <span className="font-normal text-muted">· {STATE_STYLE[item.state].word}</span>
              </p>
              <p className="text-sm text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
