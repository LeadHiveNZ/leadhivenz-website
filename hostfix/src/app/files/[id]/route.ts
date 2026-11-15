import type { NextRequest } from "next/server";
import { jobFromOwnerLink, offerFromLink } from "@/lib/access/links";
import { currentStaff, currentViewer } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { getFileStore } from "@/lib/files/store";
import { canView, getUpload } from "@/lib/files/uploads";
import { findPropertyByReportToken } from "@/lib/properties/service";

/**
 * SHOWS ONE PHOTO, but only to someone allowed to see it: the job's owner,
 * the tradie on the job, staff, or whoever just uploaded it. Photos have no
 * public address. Anyone else gets "not found", the same as for a photo that
 * does not exist.
 */

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const upload = await getUpload(db, id);
  if (!upload) return notFound();

  const query = request.nextUrl.searchParams;
  let allowed = false;

  const jobCode = query.get("j");
  const offerCode = query.get("o");
  const token = query.get("t");
  if (jobCode) {
    const job = await jobFromOwnerLink(db, jobCode);
    allowed = Boolean(job && upload.jobId === job.id);
  } else if (offerCode) {
    const offer = await offerFromLink(db, offerCode);
    allowed = Boolean(offer && offer.status === "accepted" && (await canView(db, upload, { tradieId: offer.tradieId, uploader: `tradie:${offer.tradieId}` })));
  } else if (token) {
    const found = await findPropertyByReportToken(db, token);
    // Someone on a report link sees only what was sent from that link and not yet filed.
    allowed = Boolean(found && !upload.attached && upload.uploadedBy === `report:${found.property.id}`);
  }
  if (!allowed) {
    const viewer = await currentViewer();
    if (viewer) {
      allowed = await canView(db, upload, {
        ownerId: viewer.ownerId, tradieId: viewer.tradieId,
        uploader: viewer.tradieId ? `tradie:${viewer.tradieId}` : viewer.ownerId ? `owner:${viewer.ownerId}` : null,
      });
    }
    if (!allowed && (await currentStaff())) allowed = true;
  }
  if (!allowed) return notFound();

  const bytes = await getFileStore()?.get(upload.storageKey);
  if (!bytes) return notFound();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": upload.contentType,
      "Content-Length": String(bytes.byteLength),
      // Never guess the type, never run it, never share it between people.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
