import { NextResponse, type NextRequest } from "next/server";
import { offerFromLink } from "@/lib/access/links";
import { currentStaff, currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getFileStore } from "@/lib/files/store";
import { checkFile, MAX_UPLOAD_BYTES, newStorageKey, recordUpload, type UploadKind } from "@/lib/files/uploads";
import { findPropertyByReportToken } from "@/lib/properties/service";
import { withinRateLimit } from "@/lib/rate-limit";
import { ipKey } from "@/lib/request";

/**
 * RECEIVES ONE PHOTO. The phone shrinks it first, so it arrives small. The
 * server then checks who is sending it, that it really is a photo, and stores
 * it. The photo is not attached to anything until the form it belongs to is
 * sent, and only the person who uploaded it can attach it.
 */

const KINDS: UploadKind[] = ["property", "report", "completion", "quote", "receipt", "licence", "insurance", "dispute"];
const OWNER_KINDS: UploadKind[] = ["property", "report", "dispute"];
const TRADIE_KINDS: UploadKind[] = ["completion", "quote", "receipt", "licence", "insurance"];

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  // Only this site's own pages may post here.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return refuse(403, "Not allowed.");

  const visitor = ipKey(request.headers) ?? "unknown";
  if (!(await withinRateLimit(`upload:${visitor}`, 60 * 60, 80))) return refuse(429, "Too many photos at once. Please wait a little and try again.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse(400, "That photo did not arrive. Please try again.");
  }
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || typeof kind !== "string" || !KINDS.includes(kind as UploadKind)) return refuse(400, "That photo did not arrive. Please try again.");
  if (file.size > MAX_UPLOAD_BYTES) return refuse(413, "That photo is too big. The limit is 4 MB.");

  const db = await getDb();
  const wanted = kind as UploadKind;

  // Work out who is sending it. A link from a text or a QR code counts, as
  // long as it is allowed to send this kind of photo.
  let uploadedBy: string | null = null;
  const token = form.get("token");
  const offerCode = form.get("offer");
  if (typeof token === "string" && token !== "") {
    const found = await findPropertyByReportToken(db, token);
    if (found && wanted === "report") uploadedBy = `report:${found.property.id}`;
  } else if (typeof offerCode === "string" && offerCode !== "") {
    const offer = await offerFromLink(db, offerCode);
    if (offer && offer.status === "accepted" && TRADIE_KINDS.includes(wanted)) uploadedBy = `tradie:${offer.tradieId}`;
  } else {
    const viewer = await currentViewer();
    if (viewer?.tradieId && TRADIE_KINDS.includes(wanted)) uploadedBy = `tradie:${viewer.tradieId}`;
    else if (viewer?.ownerId && OWNER_KINDS.includes(wanted)) uploadedBy = `owner:${viewer.ownerId}`;
    else {
      const staff = await currentStaff();
      if (staff) uploadedBy = staff.actor;
    }
  }
  if (!uploadedBy) return refuse(403, "You need to be signed in to add photos here.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkFile(wanted, file.type, bytes);
  if (!checked.ok) return refuse(400, checked.reason);

  const store = getFileStore();
  if (!store) return refuse(503, "Photos cannot be saved yet. Photo storage has not been set up.");
  const key = newStorageKey(wanted, checked.ext);
  try {
    await store.put(key, bytes, file.type);
  } catch (error) {
    console.error("[uploads] storing a photo failed:", error instanceof Error ? error.message : error);
    return refuse(502, "That photo could not be saved. Please try again.");
  }
  const upload = await recordUpload(db, { kind: wanted, storageKey: key, contentType: file.type, bytes: bytes.byteLength, uploadedBy });
  return NextResponse.json({ id: upload.id, url: `/files/${upload.id}` });
}
