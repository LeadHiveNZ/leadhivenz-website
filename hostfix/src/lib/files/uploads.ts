import { randomUUID } from "node:crypto";
import { addHours, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * PHOTOS AND FILES. The record of each file lives here; the file itself lives
 * in storage (src/lib/files/store.ts).
 *
 * A file is uploaded first, then attached when the form it belongs to is
 * sent. Files never attached are cleared out after a day. Only the person who
 * uploaded a file can attach it.
 */

/** "before" is the tradie's photo at Arrived; "completion" is the "after" photo at Job done (DECISIONS.md, 2026-11-19). */
export type UploadKind = "property" | "report" | "before" | "completion" | "quote" | "receipt" | "licence" | "insurance_certificate" | "dispute";

export type Upload = {
  id: string;
  createdAt: Date;
  kind: UploadKind;
  storageKey: string;
  contentType: string;
  bytes: number;
  propertyId: string | null;
  jobId: string | null;
  tradieId: string | null;
  /** A certificate sent with the public sign-up form, before the lead became a tradie. */
  leadId: string | null;
  uploadedBy: string;
  attached: boolean;
  /** Where the phone said it was when this photo was sent, if it said. The time is createdAt, from the server's clock. */
  lat: number | null;
  lng: number | null;
  /** The time the photo file itself says it was taken, when the phone put one in it. */
  takenAt: Date | null;
  /** A fingerprint of the file's bytes, so the same receipt is noticed if it is sent twice. */
  sha256: string | null;
};

type UploadRow = {
  id: string; created_at: Date; kind: UploadKind; storage_key: string; content_type: string; bytes: number;
  property_id: string | null; job_id: string | null; tradie_id: string | null; lead_id?: string | null; uploaded_by: string; attached: boolean;
  lat?: number | string | null; lng?: number | string | null; taken_at?: Date | null; sha256?: string | null;
};

function rowToUpload(row: UploadRow): Upload {
  return {
    id: row.id, createdAt: new Date(row.created_at), kind: row.kind, storageKey: row.storage_key, contentType: row.content_type,
    bytes: row.bytes, propertyId: row.property_id, jobId: row.job_id, tradieId: row.tradie_id, leadId: row.lead_id ?? null, uploadedBy: row.uploaded_by, attached: row.attached,
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat), lng: row.lng === null || row.lng === undefined ? null : Number(row.lng),
    takenAt: row.taken_at ? new Date(row.taken_at) : null,
    sha256: row.sha256 ?? null,
  };
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_FORM = 8;

const TYPES: Record<string, { ext: string; magic: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": { ext: "webp", magic: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  "application/pdf": { ext: "pdf", magic: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
};

/** Documents (a licence, an insurance certificate) may be a PDF. Everything else must be a photo. */
const PDF_ALLOWED: UploadKind[] = ["licence", "insurance_certificate", "receipt"];

/** The insurance certificate: a PDF, JPG or PNG, nothing else. */
const CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/**
 * Checks a file is what it claims to be, by looking at its first bytes, not
 * its name. Returns the reason in plain words if it is not acceptable.
 */
export function checkFile(kind: UploadKind, contentType: string, bytes: Uint8Array): { ok: true; ext: string } | { ok: false; reason: string } {
  const type = TYPES[contentType];
  if (kind === "insurance_certificate") {
    if (!type || !CERTIFICATE_TYPES.includes(contentType)) return { ok: false, reason: "Please send the certificate as a PDF, JPG or PNG file." };
    if (bytes.byteLength === 0) return { ok: false, reason: "That file is empty." };
    if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "That file is too big. The limit is 4 MB." };
    if (!type.magic(bytes)) return { ok: false, reason: "That file does not look like a real PDF, JPG or PNG. Try saving it again." };
    return { ok: true, ext: type.ext };
  }
  if (!type) return { ok: false, reason: "That kind of file cannot be used. Please send a photo (JPEG, PNG or WebP)." };
  if (contentType === "application/pdf" && !PDF_ALLOWED.includes(kind)) return { ok: false, reason: "Please send a photo, not a PDF." };
  if (bytes.byteLength === 0) return { ok: false, reason: "That file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "That file is too big. The limit is 4 MB." };
  if (!type.magic(bytes)) return { ok: false, reason: "That file does not look like a real photo. Try taking it again." };
  return { ok: true, ext: type.ext };
}

/** Where the file will live in storage: kind/year/month/random.ext. Nothing in it identifies a person or a property. */
export function newStorageKey(kind: UploadKind, ext: string, at: Date = now()): string {
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${kind}/${at.getUTCFullYear()}/${month}/${randomUUID()}.${ext}`;
}

export async function recordUpload(
  db: Db,
  input: {
    kind: UploadKind; storageKey: string; contentType: string; bytes: number; uploadedBy: string;
    /** Sent with a tradie's before and after photos (DECISIONS.md, 2026-11-19). */
    lat?: number | null; lng?: number | null; takenAt?: Date | null;
    /** The file's fingerprint (sha-256, hex). */
    sha256?: string | null;
  },
): Promise<Upload> {
  const located = typeof input.lat === "number" && typeof input.lng === "number" && Number.isFinite(input.lat) && Number.isFinite(input.lng)
    && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180;
  const takenAt = input.takenAt && Number.isFinite(input.takenAt.getTime()) ? input.takenAt.toISOString() : null;
  const rows = await db.query<UploadRow>(
    `insert into public.uploads (created_at, kind, storage_key, content_type, bytes, uploaded_by, lat, lng, taken_at, sha256)
     values ($1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10) returning *`,
    [now().toISOString(), input.kind, input.storageKey, input.contentType, input.bytes, input.uploadedBy, located ? input.lat : null, located ? input.lng : null, takenAt, input.sha256 ?? null],
  );
  return rowToUpload(rows[0]!);
}

/**
 * Ties uploaded files to a job, property or tradie. Only files of the right
 * kind, uploaded by this same person and not yet attached, are taken. Returns
 * how many were attached.
 */
export async function attachUploads(
  db: Db,
  ids: string[],
  target: { kind: UploadKind; uploadedBy: string; jobId?: string | null; propertyId?: string | null; tradieId?: string | null },
): Promise<number> {
  const wanted = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, MAX_FILES_PER_FORM);
  if (wanted.length === 0) return 0;
  const rows = await db.query(
    `update public.uploads set attached = true, job_id = $4::uuid, property_id = $5::uuid, tradie_id = $6::uuid
      where id = any($1::uuid[]) and kind = $2 and uploaded_by = $3 and attached = false
      returning id`,
    [wanted, target.kind, target.uploadedBy, target.jobId ?? null, target.propertyId ?? null, target.tradieId ?? null],
  );
  return rows.length;
}

export async function getUpload(db: Db, id: string): Promise<Upload | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db.query<UploadRow>("select * from public.uploads where id = $1::uuid", [id]);
  return rows[0] ? rowToUpload(rows[0]) : null;
}

export async function listUploads(db: Db, filter: { jobId?: string; propertyId?: string; tradieId?: string; kinds?: UploadKind[] }): Promise<Upload[]> {
  const rows = await db.query<UploadRow>(
    `select * from public.uploads
      where attached
        and ($1::uuid is null or job_id = $1::uuid)
        and ($2::uuid is null or property_id = $2::uuid)
        and ($3::uuid is null or tradie_id = $3::uuid)
        and ($4::text[] is null or kind = any($4::text[]))
      order by created_at, id`,
    [filter.jobId ?? null, filter.propertyId ?? null, filter.tradieId ?? null, filter.kinds ?? null],
  );
  return rows.map(rowToUpload);
}

export async function countUploads(db: Db, jobId: string, kind: UploadKind): Promise<number> {
  const rows = await db.query<{ count: number }>("select count(*) as count from public.uploads where job_id = $1::uuid and kind = $2 and attached", [jobId, kind]);
  return Number(rows[0]?.count ?? 0);
}

/** Removes the records of files that were uploaded but never attached. Returns their storage keys so the files can go too. */
export async function purgeUnattached(db: Db): Promise<string[]> {
  const rows = await db.query<{ storage_key: string }>(
    "delete from public.uploads where attached = false and created_at < $1::timestamptz returning storage_key",
    [addHours(now(), -24).toISOString()],
  );
  return rows.map((row) => row.storage_key);
}

/**
 * Who may look at a file:
 *  - staff: any file
 *  - an owner: files on their own properties and jobs
 *  - a tradie: files on a job they have accepted, their own documents, and the owner's
 *    property photos while they have a job under way there
 *  - an insurance certificate: only staff and the tradie it belongs to. Not an owner,
 *    not another tradie, not by any job link.
 *  - a parts receipt: only staff and the tradie who sent it. Never the owner, who sees
 *    the part, its price and "receipt checked by HostFix" instead (DECISIONS.md, 2026-11-20).
 *  - whoever uploaded it, until it is attached (so they can see their own thumbnail)
 */
export async function canView(
  db: Db,
  upload: Upload,
  viewer: { ownerId?: string | null; tradieId?: string | null; staff?: boolean; uploader?: string | null },
): Promise<boolean> {
  if (viewer.staff) return true;
  if (upload.kind === "insurance_certificate") return Boolean(viewer.tradieId && upload.tradieId === viewer.tradieId);
  if (upload.kind === "receipt") {
    return Boolean((viewer.tradieId && upload.uploadedBy === `tradie:${viewer.tradieId}`) || (viewer.uploader && viewer.uploader === upload.uploadedBy));
  }
  if (viewer.uploader && viewer.uploader === upload.uploadedBy) return true;
  if (viewer.ownerId) {
    if (upload.jobId) {
      const rows = await db.query("select 1 from public.jobs where id = $1::uuid and owner_id = $2::uuid", [upload.jobId, viewer.ownerId]);
      if (rows.length > 0) return true;
    }
    if (upload.propertyId) {
      const rows = await db.query("select 1 from public.properties where id = $1::uuid and owner_id = $2::uuid", [upload.propertyId, viewer.ownerId]);
      if (rows.length > 0) return true;
    }
  }
  if (viewer.tradieId) {
    if (upload.tradieId === viewer.tradieId) return true;
    if (upload.jobId) {
      const rows = await db.query("select 1 from public.jobs where id = $1::uuid and tradie_id = $2::uuid", [upload.jobId, viewer.tradieId]);
      if (rows.length > 0) return true;
    }
    // The owner's photos of the lockbox and so on: only while this tradie has a job under way at that property.
    if (upload.propertyId && upload.kind === "property") {
      const rows = await db.query(
        "select 1 from public.jobs where property_id = $1::uuid and tradie_id = $2::uuid and status in ('accepted', 'on_site', 'awaiting_approval') limit 1",
        [upload.propertyId, viewer.tradieId],
      );
      if (rows.length > 0) return true;
    }
  }
  return false;
}
