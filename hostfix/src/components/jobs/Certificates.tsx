import { addCertificateAction } from "@/app/actions/tradie";
import { ActionForm, Select } from "@/components/forms/ActionForm";
import { PhotoUploader } from "@/components/forms/PhotoUploader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { Upload } from "@/lib/files/uploads";
import { CERTIFICATE_LABELS } from "@/lib/jobs/certificates";
import { formatDate } from "@/lib/time";
import { Panel } from "./JobParts";

/** The certificates on a job, each a link that opens the file (DECISIONS.md, 2026-11-26). */
export function CertificateList({ certificates, query = "", timeZone }: { certificates: Upload[]; query?: string; timeZone: string }) {
  if (certificates.length === 0) return null;
  return (
    <ul className="divide-y divide-line">
      {certificates.map((file) => (
        <li key={file.id} className="flex items-baseline justify-between gap-4 py-2.5">
          <a href={`/files/${file.id}${query}`} target="_blank" rel="noreferrer" className="min-w-0 font-semibold text-brand underline underline-offset-2">
            {file.label ?? "Certificate"}
          </a>
          <span className="shrink-0 text-sm text-muted">{formatDate(file.createdAt, timeZone)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The owner's view: what the tradie attached, to keep with the property's records. */
export function OwnerCertificates({ certificates, query, timeZone }: { certificates: Upload[]; query: string; timeZone: string }) {
  if (certificates.length === 0) return null;
  return (
    <Panel title="Certificates">
      <CertificateList certificates={certificates} query={query} timeZone={timeZone} />
      <p className="mt-3 text-sm text-muted">Added by the tradie who did the work. Keep them with the property&rsquo;s records.</p>
    </Panel>
  );
}

/** The tradie's form: attach a certificate (a PDF or a photo of it) and say what it is. */
export function TradieCertificates({ which, code, certificates, query, timeZone }: { which: React.ReactNode; code?: string | null; certificates: Upload[]; query: string; timeZone: string }) {
  return (
    <Panel title="Certificates">
      <CertificateList certificates={certificates} query={query} timeZone={timeZone} />
      <p className="mb-4 text-sm text-muted">
        Did this work need a Certificate of Compliance, an Electrical Safety Certificate or a gas certificate? Add it here and the owner gets it with the job.
      </p>
      <ActionForm action={addCertificateAction} className="space-y-4">
        {which}
        <Select label="What is it?" name="label" placeholder="Choose one" required options={CERTIFICATE_LABELS.map((label) => ({ key: label, label }))} />
        <PhotoUploader kind="certificate" name="certificateUploadIds" label="The certificate (a PDF, or a photo of it)" offer={code ?? undefined} max={3} documents />
        <SubmitButton pendingLabel="Adding...">Add certificate</SubmitButton>
      </ActionForm>
    </Panel>
  );
}
