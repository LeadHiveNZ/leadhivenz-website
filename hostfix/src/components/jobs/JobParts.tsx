import type { ReactNode } from "react";
import { Card, Chip, Money, SectionTitle, Timeline } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import type { Upload } from "@/lib/files/uploads";
import { arrivedOnTime, onTimeDeadline, windowBetween } from "@/lib/jobs/arrival";
import type { JobLine } from "@/lib/jobs/types";
import { statusLabel, statusTone, type Job } from "@/lib/jobs/types";
import type { Audience, JobView } from "@/lib/jobs/view";
import { formatDateTime, formatDeadline, formatDuration } from "@/lib/time";

/** The pieces of a job screen, shared by the owner's, the tradie's and the team's views. */

export function JobStatus({ job, audience }: { job: Job; audience: Audience }) {
  return <Chip tone={statusTone(job.status, audience)}>{statusLabel(job.status, audience)}</Chip>;
}

/** The clock: how long until the promised time, or how it turned out. */
export function Deadline({ job, now, timeZone }: { job: Job; now: Date; timeZone: string }) {
  if (!job.respondBy || job.status === "cancelled") return null;
  // A normal job's tradie chose a window when they accepted: that is what on time means (DECISIONS.md, 2026-11-18).
  const windowed = job.urgency !== "urgent" && job.arrivalWindowStart && job.arrivalWindowEnd;
  if (job.arrivedAt) {
    const onTime = arrivedOnTime(job, job.arrivedAt);
    return (
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${onTime ? "text-done" : "text-alert"}`}>
        <Icon name={onTime ? "check" : "clock"} size={16} />
        On site {formatDeadline(job.arrivedAt, now, timeZone)}
        {onTime ? (windowed ? ", inside the time the tradie chose" : ", inside the promised time") : windowed ? ", after the time the tradie chose" : ", after the promised time"}
      </p>
    );
  }
  const deadline = onTimeDeadline(job) ?? job.respondBy;
  const left = deadline.getTime() - now.getTime();
  if (windowed) {
    const words = windowBetween({ start: job.arrivalWindowStart!, end: job.arrivalWindowEnd! }, now, timeZone);
    return (
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${left <= 0 ? "text-alert" : left < 60 * 60_000 ? "text-wait" : "text-muted"}`}>
        <Icon name="clock" size={16} />
        {left > 0 ? `On site ${words}` : `Was due ${words}`}
      </p>
    );
  }
  return (
    <p className={`flex items-center gap-1.5 text-sm font-semibold ${left <= 0 ? "text-alert" : left < 60 * 60_000 ? "text-wait" : "text-muted"}`}>
      <Icon name="clock" size={16} />
      {left > 0 ? `On site by ${formatDeadline(deadline, now, timeZone)} (${formatDuration(left)} to go)` : `Was promised by ${formatDeadline(deadline, now, timeZone)}`}
    </p>
  );
}

export function PhotoGrid({ photos, query = "", empty }: { photos: Upload[]; query?: string; empty?: string }) {
  if (photos.length === 0) return empty ? <p className="text-muted">{empty}</p> : null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo) => (
        <li key={photo.id}>
          <a href={`/files/${photo.id}${query}`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-line bg-tint">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private photo served by this site */}
            <img src={`/files/${photo.id}${query}`} alt="Job photo. Opens larger in a new tab." loading="lazy" className="h-full w-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The money on a job, line by line. Owners see what they pay; tradies see what they get. */
export function CostLines({ lines, currency, side, totalLabel }: { lines: JobLine[]; currency: string; side: "owner" | "tradie"; totalLabel: string }) {
  const shown = lines.filter((line) => line.status !== "void");
  const amount = (line: JobLine) => (side === "owner" ? line.ownerCents : line.tradieCents);
  const total = shown.filter((line) => line.status === "active").reduce((sum, line) => sum + amount(line), 0);
  return (
    <div>
      <ul className="divide-y divide-line">
        {shown.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className={line.status === "pending" ? "text-muted" : "text-ink"}>
              {line.label}
              {line.status === "pending" && <span className="ml-2 text-sm font-semibold text-wait">waiting for approval</span>}
            </span>
            <Money cents={amount(line)} currency={currency} className={`shrink-0 font-semibold ${line.status === "pending" ? "text-muted" : "text-ink"}`} />
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3">
        <span className="font-bold text-ink">{totalLabel}</span>
        <Money cents={total} currency={currency} className="text-xl font-bold text-ink" />
      </div>
    </div>
  );
}

export function History({ view }: { view: JobView }) {
  return (
    <Card>
      <SectionTitle>What has happened</SectionTitle>
      <Timeline entries={view.history} format={(date) => formatDateTime(date, view.market.timezone)} />
    </Card>
  );
}

/** A short block of facts with a heading, used for "the problem", "the property" and so on. */
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </Card>
  );
}
