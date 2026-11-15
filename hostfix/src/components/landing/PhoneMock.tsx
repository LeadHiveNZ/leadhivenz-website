import type { ReactNode } from "react";
import { brand } from "@config/brand";
import { formatMoney } from "@/lib/money";
import { Chip } from "../ui/Bits";
import { Icon } from "../ui/Icon";

/**
 * Pictures of the product, built from the same pieces as the real screens
 * rather than from image files, so they always match the brand colours and
 * never go out of date.
 */

function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-[17.5rem] rounded-[2.4rem] border-[7px] border-brand-dark bg-sand p-3 shadow-2xl shadow-brand/25">
      <div aria-hidden="true" className="mx-auto mb-3 h-5 w-24 rounded-full bg-brand-dark" />
      <div aria-hidden="true" className="space-y-2.5 text-left">{children}</div>
    </div>
  );
}

type Example = { jobName: string; ownerCents: number; payoutCents: number; currency: string; suburb: string };

/** What an owner sees: one job from report to paid, with the time of each step. */
export function OwnerPhone({ example }: { example: Example }) {
  const steps = [
    { title: "Reported by Sam (cleaner)", time: "9:02am", tone: "bg-quiet" },
    { title: "Wakatipu Plumbing accepted", time: "9:09am", tone: "bg-go" },
    { title: "Tradie on site", time: "10:40am", tone: "bg-go" },
    { title: "Done. Photos added", time: "11:25am", tone: "bg-done" },
  ];
  return (
    <Phone label="Example: a job on the owner's phone, from reported to done in under three hours">
      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-start justify-between gap-2">
          <Chip tone="done">Done</Chip>
          <span className="tabular text-sm font-bold text-ink">{formatMoney(example.ownerCents, example.currency)}</span>
        </div>
        <p className="mt-2 leading-tight font-bold text-ink">{example.jobName}</p>
        <p className="text-sm text-muted">Lakeview Apartment, {example.suburb}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <ol className="space-y-2.5">
          {steps.map((step) => (
            <li key={step.title} className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${step.tone}`} />
              <span className="flex-1 text-[0.82rem] leading-tight font-semibold text-ink">{step.title}</span>
              <span className="tabular text-xs text-muted">{step.time}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-tint text-brand/50">
            <Icon name="camera" size={22} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-brand px-3.5 py-3 text-[0.82rem] leading-snug font-semibold text-white">
        {formatMoney(example.ownerCents, example.currency)} charged to your card. No quote. No invoice.
      </div>
    </Phone>
  );
}

/** What a tradie sees: the text, then one tap to accept. */
export function TradiePhone({ example }: { example: Example }) {
  return (
    <Phone label="Example: a job offer arriving by text on a tradie's phone, with Accept and Pass buttons">
      <div className="rounded-2xl rounded-bl-md bg-surface px-3.5 py-3 text-[0.82rem] leading-snug text-ink shadow-sm">
        <span className="font-bold">{brand.name}:</span> {example.jobName}, {example.suburb}. Pays {formatMoney(example.payoutCents, example.currency)}. On site by 4:15pm today. Yours for 15 min:{" "}
        <span className="font-semibold text-go underline">tap to open</span>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-center justify-between">
          <Chip tone="waiting">Yours for 14:32</Chip>
          <span className="tabular text-lg font-bold text-ink">{formatMoney(example.payoutCents, example.currency)}</span>
        </div>
        <p className="mt-2 leading-tight font-bold text-ink">{example.jobName}</p>
        <p className="text-sm text-muted">{example.suburb} · on site by 4:15pm</p>
        <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
          <span className="flex h-11 items-center justify-center rounded-full border border-line text-sm font-bold text-muted">Pass</span>
          <span className="flex h-11 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">Accept job</span>
        </div>
      </div>
      <div className="rounded-2xl bg-done-soft px-3.5 py-3 text-[0.82rem] leading-snug font-semibold text-done">
        Paid automatically after the photo. No invoice.
      </div>
    </Phone>
  );
}
