import type { Upload } from "@/lib/files/uploads";
import { formatDate } from "@/lib/time";

/**
 * The public liability certificates on file, newest first. The newest is the
 * current one; older ones stay listed as a record. Each opens through
 * /files/[id], which only lets staff and the tradie themselves see it.
 */
export function CertificateList({ certificates, timeZone }: { certificates: Upload[]; timeZone: string }) {
  if (certificates.length === 0) return <p className="text-sm font-semibold text-alert">No certificate uploaded yet.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {certificates.map((certificate, index) => (
        <li key={certificate.id} className="flex flex-wrap items-center gap-x-2">
          <a href={`/files/${certificate.id}`} target="_blank" rel="noopener" className="font-semibold text-brand underline underline-offset-2">
            {index === 0 ? "Current certificate" : "Earlier certificate"}
          </a>
          <span className="text-muted">
            uploaded {formatDate(certificate.createdAt, timeZone)} · {certificate.contentType === "application/pdf" ? "PDF" : certificate.contentType === "image/png" ? "PNG" : "JPG"}
          </span>
        </li>
      ))}
    </ul>
  );
}
