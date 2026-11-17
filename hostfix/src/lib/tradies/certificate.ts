import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import type { FileStore } from "@/lib/files/store";
import { checkFile, listUploads, newStorageKey, type Upload } from "@/lib/files/uploads";

/**
 * THE PUBLIC LIABILITY CERTIFICATE (DECISIONS.md, 2026-11-17). A tradie must
 * upload the certificate of currency their insurer gives them, not just type
 * the details in. It may be a PDF, JPG or PNG, up to 4 MB.
 *
 * The newest certificate on file is the current one. Older ones are kept, so
 * there is a record of what was on file when. Only staff and the tradie it
 * belongs to can open one (canView in src/lib/files/uploads.ts).
 *
 * A certificate sent with the public sign-up form belongs to the lead until
 * staff turn the lead into a tradie (createTradie moves it across).
 */

export type CertificateFor = { tradieId: string } | { leadId: string };

type Recorded = { storageKey: string; contentType: string; bytes: number; uploadedBy: string; actor: string };

/** Writes the record of a stored certificate, attached, and its audit entry, in one database step. */
export async function recordInsuranceCertificate(db: Db, owner: CertificateFor, file: Recorded): Promise<string> {
  return db.tx(async (tx) => {
    const tradieId = "tradieId" in owner ? owner.tradieId : null;
    const leadId = "leadId" in owner ? owner.leadId : null;
    const rows = await tx.query<{ id: string }>(
      `insert into public.uploads (created_at, kind, storage_key, content_type, bytes, uploaded_by, tradie_id, lead_id, attached)
       values ($1::timestamptz, 'insurance_certificate', $2, $3, $4, $5, $6::uuid, $7::uuid, true) returning id`,
      [now().toISOString(), file.storageKey, file.contentType, file.bytes, file.uploadedBy, tradieId, leadId],
    );
    const id = rows[0]!.id;
    await audit(tx, {
      actor: file.actor,
      action: tradieId ? "tradie.insurance_certificate_uploaded" : "lead.insurance_certificate_uploaded",
      entity: tradieId ? "tradie" : "lead",
      entityId: tradieId ?? leadId,
      detail: { uploadId: id, contentType: file.contentType, bytes: file.bytes },
    });
    return id;
  });
}

/**
 * Checks the file, stores it and records it. Returns the reason in plain words
 * if it could not be kept. Nothing is recorded unless the file was stored.
 */
export async function saveInsuranceCertificate(
  db: Db,
  files: FileStore | null,
  owner: CertificateFor,
  input: { bytes: Uint8Array; contentType: string; uploadedBy: string; actor: string },
): Promise<{ ok: true; uploadId: string } | { ok: false; reason: string }> {
  if (!files) return { ok: false, reason: "Certificates cannot be saved yet because file storage has not been set up. Add it later from your profile." };
  const checked = checkFile("insurance_certificate", input.contentType, input.bytes);
  if (!checked.ok) return checked;
  const storageKey = newStorageKey("insurance_certificate", checked.ext);
  try {
    await files.put(storageKey, input.bytes, input.contentType);
  } catch (error) {
    console.error("[certificate] storing a certificate failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "The certificate could not be saved just now. Please try again." };
  }
  const uploadId = await recordInsuranceCertificate(db, owner, {
    storageKey, contentType: input.contentType, bytes: input.bytes.byteLength, uploadedBy: input.uploadedBy, actor: input.actor,
  });
  return { ok: true, uploadId };
}

/** Every certificate this tradie has had on file, newest (the current one) first. */
export async function listInsuranceCertificates(db: Db, tradieId: string): Promise<Upload[]> {
  return (await listUploads(db, { tradieId, kinds: ["insurance_certificate"] })).reverse();
}

/** The file from a form field, if one was chosen. */
export async function fileFromForm(formData: FormData, name: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const value = formData.get(name);
  if (!value || typeof value === "string" || typeof (value as Blob).arrayBuffer !== "function") return null;
  const file = value as File;
  // A file box left empty still sends an empty file (its name is not always blank): that means "none chosen".
  if (file.size === 0) return null;
  return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type };
}
