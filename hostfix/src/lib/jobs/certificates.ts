import { audit } from "@/lib/audit";
import type { Db } from "@/lib/db/types";
import { attachUploads, listUploads, type Upload } from "@/lib/files/uploads";
import { enqueue } from "@/lib/notify/outbox";
import { brand } from "@config/brand";
import { loadContext, ownerJobUrl } from "./context";
import { lockJob } from "./store";

/**
 * COMPLIANCE CERTIFICATES ON A JOB (DECISIONS.md, 2026-11-26).
 *
 * Prescribed electrical work needs a Certificate of Compliance (and often an
 * Electrical Safety Certificate) given to the owner; gas work and some
 * plumbing and building work have their own. The tradie who did the job
 * attaches them here, as a PDF, JPG or PNG, once they are on site or after
 * Job done. The owner sees and downloads them on the job page, and they stay
 * with the job. Who may open the file follows the usual rule for a job's
 * files (src/lib/files/uploads.ts, canView): staff, the owner, the tradie.
 */

export const CERTIFICATE_LABELS = [
  "Certificate of Compliance (electrical)",
  "Electrical Safety Certificate",
  "Gas Certificate of Compliance",
  "Gas Safety Certificate",
  "Plumbing or drainage certificate",
  "Producer statement or warranty",
  "Other certificate",
] as const;

/** A certificate can be added from Arrived, and for this many days after Job done. */
export const CERTIFICATE_DAYS_AFTER = 60;

type Result = { ok: true; added: number } | { ok: false; message: string };

export async function addCertificates(
  db: Db,
  jobId: string,
  tradieId: string,
  input: { uploadIds: string[]; label: string },
  at: Date,
): Promise<Result> {
  const label = CERTIFICATE_LABELS.find((choice) => choice === input.label);
  if (!label) return { ok: false, message: "Choose what kind of certificate it is." };
  if (input.uploadIds.length === 0) return { ok: false, message: "Add the certificate first: a PDF, or a photo of it." };
  return db.tx(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (!job || job.tradieId !== tradieId) return { ok: false, message: "This job is not yours." };
    const onTime = job.status === "on_site" || job.status === "awaiting_approval"
      || (job.status === "completed" && job.completedAt !== null && at.getTime() - job.completedAt.getTime() <= CERTIFICATE_DAYS_AFTER * 86_400_000);
    if (!onTime) return { ok: false, message: `Certificates can be added once you have arrived, and up to ${CERTIFICATE_DAYS_AFTER} days after the job is done. Email us if you need to add one later.` };
    const added = await attachUploads(tx, input.uploadIds, { kind: "certificate", uploadedBy: `tradie:${tradieId}`, jobId: job.id, propertyId: job.propertyId });
    if (added === 0) return { ok: false, message: "Add the certificate first: a PDF, or a photo of it." };
    await tx.query(
      "update public.uploads set label = $3 where id = any($1::uuid[]) and job_id = $2::uuid and kind = 'certificate' and label is null",
      [input.uploadIds, job.id, label],
    );
    await audit(tx, { actor: `tradie:${tradieId}`, action: "job.certificate_added", entity: "job", entityId: job.id, detail: { label, files: added } });
    const context = await loadContext(tx, job);
    if (context.owner.email) {
      await enqueue(tx, {
        channel: "email", to: context.owner.email, template: "certificate_added", audience: "owner", jobId: job.id, userId: context.owner.userId,
        subject: `${brand.name}: ${label} for job ${job.number}`,
        body: `Hi ${context.owner.name.split(" ")[0]},\n\nThe tradie on job ${job.number} (${job.title}, ${context.property.name}) has added a ${label}. Keep it with the property's records.\n\nSee and download it on the job page: ${ownerJobUrl(job)}\n\n${brand.name}`,
        dedupeKey: `certificate:${job.id}:${input.uploadIds.slice().sort().join(",")}`,
      });
    }
    return { ok: true, added };
  });
}

export async function jobCertificates(db: Db, jobId: string): Promise<Upload[]> {
  return listUploads(db, { jobId, kinds: ["certificate"] });
}
