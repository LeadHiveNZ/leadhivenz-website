import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import type { StatusTone } from "@/lib/jobs/types";
import { cardClass } from "../forms/styles";
import { Icon, type IconName } from "./Icon";

/** Small shared pieces used on every signed-in screen, so they all look and read the same. */

const TONES: Record<StatusTone | "brand", string> = {
  waiting: "bg-wait-soft text-wait",
  active: "bg-go-soft text-go",
  done: "bg-done-soft text-done",
  quiet: "bg-quiet-soft text-quiet",
  alert: "bg-alert-soft text-alert",
  brand: "bg-tint text-brand",
};

/** A status label. The colour says what kind of state it is: waiting, under way, done, closed, needs you. */
export function Chip({ tone, children }: { tone: StatusTone | "brand"; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide whitespace-nowrap uppercase ${TONES[tone]}`}>{children}</span>;
}

export function Money({ cents, currency, className = "" }: { cents: number; currency: string; className?: string }) {
  return <span className={`tabular ${className}`}>{formatMoney(cents, currency)}</span>;
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" | "article" }) {
  return <Tag className={`${cardClass} p-4 sm:p-5 ${className}`}>{children}</Tag>;
}

export function PageTitle({ title, intro, back, action }: { title: string; intro?: ReactNode; back?: { href: string; label: string }; action?: ReactNode }) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <Icon name="back" size={16} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-[1.75rem] text-ink sm:text-4xl">{title}</h1>
        {action}
      </div>
      {intro && <p className="mt-2 max-w-2xl text-muted">{intro}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

const NOTICE: Record<"info" | "warn" | "error" | "good", { box: string; icon: IconName }> = {
  info: { box: "border-line bg-tint text-ink", icon: "clock" },
  warn: { box: "border-wait/30 bg-wait-soft text-ink", icon: "queue" },
  error: { box: "border-alert/30 bg-alert-soft text-ink", icon: "queue" },
  good: { box: "border-done/30 bg-done-soft text-ink", icon: "check" },
};

/** A boxed message. Says what happened and, where it matters, what to do next. */
export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error" | "good"; title?: string; children?: ReactNode }) {
  const look = NOTICE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border px-4 py-3 text-[0.95rem] ${look.box}`}>
      <Icon name={look.icon} className="mt-0.5" />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-ink/80" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-5 py-9 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tint text-brand">
        <Icon name={icon} size={24} />
      </span>
      <p className="mt-3 text-lg font-bold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** One number with a label, for dashboards. */
export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "alert" | "good" }) {
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold tracking-tight ${tone === "alert" ? "text-alert" : tone === "good" ? "text-done" : "text-ink"}`}>{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}

/** Label and value pairs, one per row. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="text-right font-semibold text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type TimelineEntry = { at: Date; title: string; detail?: string | null; tone?: StatusTone };

/** What happened on a job, oldest first, in plain words. */
export function Timeline({ entries, format }: { entries: TimelineEntry[]; format: (date: Date) => string }) {
  const dot: Record<StatusTone, string> = { waiting: "bg-wait", active: "bg-go", done: "bg-done", quiet: "bg-quiet", alert: "bg-alert" };
  return (
    <ol className="relative ml-1.5 space-y-4 border-l-2 border-line pl-5">
      {entries.map((entry, index) => (
        <li key={`${entry.at.getTime()}-${index}`} className="relative">
          <span className={`absolute top-1.5 -left-[1.72rem] h-3 w-3 rounded-full ring-4 ring-surface ${dot[entry.tone ?? "quiet"]}`} />
          <p className="font-semibold text-ink">{entry.title}</p>
          {entry.detail && <p className="text-sm text-muted">{entry.detail}</p>}
          <p className="tabular text-sm text-muted">{format(entry.at)}</p>
        </li>
      ))}
    </ol>
  );
}

/** A row that is a link: a title, a line under it, and something on the right. */
export function RowLink({ href, title, subtitle, right, leading }: { href: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; leading?: ReactNode }) {
  return (
    <Link href={href} className={`${cardClass} flex items-center gap-3 p-4 transition hover:border-brand/40 hover:shadow-sm`}>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-ink">{title}</span>
        {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {right}
      <Icon name="arrow" size={18} className="text-muted" />
    </Link>
  );
}
