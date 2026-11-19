import type { Job } from "@/lib/jobs/types";

/** The words for a tradie when a guest is (or may be) in the house (DECISIONS.md, 2026-11-20). */
export const GUEST_KNOCK = "Guest staying: knock and wait. Don't let yourself in unless nobody answers after 5 minutes and the owner said that's OK.";

/** Whether the tradie should expect someone in the house. A guest's own report means a guest is there. */
export function guestThere(job: Pick<Job, "guestStaying" | "reportedBy">): boolean {
  return job.reportedBy === "guest" || job.guestStaying === "yes" || job.guestStaying === "not_sure";
}

export function letInWords(job: Pick<Job, "mayLetIn">): string {
  return job.mayLetIn
    ? "The owner said: if nobody answers, you may let yourself in."
    : "The owner said: don't let yourself in. If nobody answers, tap Could not get in.";
}

/** For the tradie: the guest note and the owner's answer on letting yourself in. */
export function GuestNote({ job }: { job: Pick<Job, "guestStaying" | "reportedBy" | "mayLetIn" | "guestName"> }) {
  const there = guestThere(job);
  return (
    <div className={`rounded-xl px-4 py-3 ${there ? "bg-wait-soft" : "bg-tint"}`}>
      {there ? (
        <>
          <p className="font-bold text-ink">{GUEST_KNOCK}</p>
          <p className="mt-1 text-sm text-ink">
            {job.guestStaying === "not_sure" ? "The owner is not sure whether a guest is staying. " : job.guestName ? `The guest is ${job.guestName}. ` : ""}
            {letInWords(job)}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink">No guest staying. {letInWords(job)}</p>
      )}
    </div>
  );
}

/** "Anything a tradie should know to stay safe?", from the owner and earlier tradies. */
export function HazardNote({ hazards }: { hazards: string }) {
  if (!hazards.trim()) return null;
  return (
    <div className="rounded-xl border border-alert/30 bg-alert-soft px-4 py-3">
      <p className="text-sm font-bold tracking-wide text-alert uppercase">Stay safe: known hazards</p>
      <p className="mt-1 whitespace-pre-line text-ink">{hazards}</p>
    </div>
  );
}
