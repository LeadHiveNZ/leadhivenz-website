"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendQueued } from "@/lib/after";
import { getDb } from "@/lib/db";
import { list, problem, text, ticked, type FormState } from "@/lib/forms";
import { createJob } from "@/lib/jobs/create";
import { getMarket } from "@/lib/markets/store";
import { normalisePhone } from "@/lib/phone";
import { findPropertyByReportToken } from "@/lib/properties/service";
import { withinRateLimit } from "@/lib/rate-limit";
import { ipKey } from "@/lib/request";

/**
 * A REPORT FROM A LINK OR A QR CODE. The person has no account. The link
 * itself says which property it is for and whether they are the owner's team
 * (a tradie is sent straight away) or a guest (the owner is asked first,
 * unless they have chosen otherwise).
 */
export async function sendReport(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  const visitor = ipKey(await headers()) ?? "unknown";
  if (!(await withinRateLimit(`report:${visitor}`, 60 * 60, 12))) {
    return problem(formData, "That is a lot of reports in a short time. Please wait a little, or contact your host directly.");
  }

  const db = await getDb();
  const found = await findPropertyByReportToken(db, token);
  if (!found) return problem(formData, "This link does not work any more. Please ask your host for a new one.");
  const { property, via } = found;
  if (!(await withinRateLimit(`report-property:${property.id}`, 24 * 60 * 60, 30))) {
    return problem(formData, "A lot has been reported for this property today. Please contact your host directly.");
  }

  const market = await getMarket(db, property.market);
  const name = text(formData, "reporterName");
  const typedPhone = text(formData, "reporterPhone");
  const phone = typedPhone ? normalisePhone(typedPhone, market?.country ?? "NZ") : null;
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.reporterName = "Enter your name.";
  if (typedPhone && !phone) errors.reporterPhone = "That does not look like a mobile number. From overseas, start with + and your country code. Or leave it empty.";
  const choice = text(formData, "menuItemId");
  if (Object.keys(errors).length > 0) return problem(formData, "Please check the highlighted fields.", errors);
  if (!choice) return problem(formData, "Choose what needs fixing.");

  const result = await createJob(db, {
    property,
    reportedBy: via,
    reporterName: name,
    reporterPhone: phone?.e164 ?? null,
    menuItemId: choice === "off-menu" ? null : choice,
    offMenuTrade: text(formData, "offMenuTrade"),
    offMenuTitle: text(formData, "offMenuTitle"),
    description: text(formData, "description"),
    urgent: ticked(formData, "urgent"),
    uploadIds: list(formData, "uploadIds"),
    uploader: `report:${property.id}`,
    actor: `${via}:${name.slice(0, 40)}`,
  });
  await sendQueued(db);
  if (!result.ok) {
    if (result.reason === "duplicate") redirect(`/r/${token}/sent?w=dup`);
    return problem(formData, result.message);
  }
  redirect(`/r/${token}/sent?w=${result.needsOwner ? "owner" : "go"}&n=${result.job.number}${phone ? "&t=1" : ""}`);
}
