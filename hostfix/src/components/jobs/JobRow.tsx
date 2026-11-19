import Link from "next/link";
import { cardClass } from "@/components/forms/styles";
import { Chip } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import type { JobListItem } from "@/lib/jobs/store";
import { isOpen } from "@/lib/jobs/types";
import type { Audience } from "@/lib/jobs/view";
import { formatDate } from "@/lib/time";
import { Deadline, JobStatus } from "./JobParts";

/** One job in a list: what it is, where, what state it is in, and the clock if it is still running. */
export function JobRow({ job, href, audience, now, timeZone }: { job: JobListItem; href: string; audience: Audience; now: Date; timeZone: string }) {
  const where = audience === "tradie" ? job.suburb : job.propertyName;
  return (
    <Link href={href} className={`${cardClass} block p-4 transition hover:border-brand/40 hover:shadow-sm`}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-bold text-ink">{job.title}</span>
          <span className="block truncate text-sm text-muted">
            {where} · Job {job.number} · {formatDate(job.createdAt, timeZone)}
          </span>
        </span>
        <Icon name="arrow" size={18} className="mt-1 text-muted" />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <JobStatus job={job} audience={audience} />
        {job.urgency === "urgent" && isOpen(job.status) && <Chip tone="alert">Urgent</Chip>}
        {job.status === "completed" && audience !== "tradie" && (job.confirmStatus === "waiting" || job.confirmStatus === "staff_queue" || job.confirmStatus === "staff_held") && (
          <Chip tone="waiting">{audience === "owner" ? "Please check the photos" : "Flagged: waiting for a check"}</Chip>
        )}
        {isOpen(job.status) && job.status !== "awaiting_owner" && <Deadline job={job} now={now} timeZone={timeZone} />}
      </span>
    </Link>
  );
}
