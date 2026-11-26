"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { gatewayFor, sendQueued } from "@/lib/after";
import { audit } from "@/lib/audit";
import { checkCode, issueCode } from "@/lib/auth/codes";
import { getDb } from "@/lib/db";
import { appSecret, baseUrl, demoModeAllowed } from "@/lib/env";
import { list, problem, text, urgencyChoice, type FormState } from "@/lib/forms";
import { rushRefusal } from "@/lib/tradies/cover";
import { now } from "@/lib/clock";
import { guestFromForm } from "@/lib/jobs/guest-form";
import { createJob } from "@/lib/jobs/create";
import { getMarket } from "@/lib/markets/store";
import { texts } from "@/lib/notify/messages";
import { enqueue, flushOutbox } from "@/lib/notify/outbox";
import { smsSettings } from "@/lib/notify/sms";
import { normalisePhone } from "@/lib/phone";
import { findPropertyByReportToken } from "@/lib/properties/service";
import { withinRateLimit } from "@/lib/rate-limit";
import { ipKey } from "@/lib/request";
import {
  openTeamPending, sealTeamDevice, sealTeamPending, TEAM_DEVICE_COOKIE, TEAM_DEVICE_DAYS, TEAM_PENDING_COOKIE, TEAM_PENDING_MINUTES, teamDeviceMatches,
} from "@/lib/team/device";
import { findTeamLink, houseForLink } from "@/lib/team/service";

/**
 * A REPORT FROM A LINK OR A QR CODE. The person has no account.
 *
 * Three kinds of link:
 *   - a cleaner's own team link (DECISIONS.md, 2026-11-18): one per person,
 *     listing every house they may report on. It only works on a phone that
 *     has proved the mobile with a six-digit code, once. The report is signed
 *     with the name the owner knows them by, and goes straight to tradies or
 *     waits for the owner, as that owner chose.
 *   - an older per-property team link: a tradie is sent straight away.
 *   - the guest QR card: the owner is asked first, unless they chose otherwise.
 */

async function visitorKey(): Promise<string> {
  return ipKey(await headers()) ?? "unknown";
}

async function setCookie(name: string, value: string, maxAgeSeconds: number): Promise<void> {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: baseUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function sendReport(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  const visitor = await visitorKey();
  if (!(await withinRateLimit(`report:${visitor}`, 60 * 60, 12))) {
    return problem(formData, "That is a lot of reports in a short time. Please wait a little, or contact your host directly.");
  }

  const db = await getDb();
  const found = await findPropertyByReportToken(db, token);
  if (!found) return sendTeamReport(formData, token);
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

  // A guest's own report means a guest is staying; the owner's older team link asks, like the team.
  const guest = via === "guest" ? { ok: true as const, guest: {} } : guestFromForm(formData, market?.country ?? "NZ");
  if (!guest.ok) return problem(formData, guest.message, { guestPhone: guest.message });
  const result = await createJob(db, {
    ...guest.guest,
    property,
    reportedBy: via,
    reporterName: name,
    reporterPhone: phone?.e164 ?? null,
    menuItemId: choice === "off-menu" ? null : choice,
    offMenuTrade: text(formData, "offMenuTrade"),
    offMenuTitle: text(formData, "offMenuTitle"),
    description: text(formData, "description"),
    ...urgencyChoice(formData),
    uploadIds: list(formData, "uploadIds"),
    uploader: `report:${property.id}`,
    actor: `${via}:${name.slice(0, 40)}`,
  }, gatewayFor(db));
  await sendQueued(db);
  if (!result.ok) {
    if (result.reason === "duplicate") redirect(`/r/${token}/sent?w=dup`);
    return problem(formData, result.message);
  }
  redirect(`/r/${token}/sent?w=${result.needsOwner ? "owner" : "go"}&n=${result.job.number}${phone ? "&t=1" : ""}`);
}

/** A report from a cleaner's own team link, for one of the houses on their list. */
async function sendTeamReport(formData: FormData, token: string): Promise<FormState> {
  const db = await getDb();
  const link = await findTeamLink(db, token);
  if (!link) return problem(formData, "This link does not work any more. Please ask the owner to add you to their team again.");
  if (!teamDeviceMatches(appSecret(), (await cookies()).get(TEAM_DEVICE_COOKIE)?.value, link)) {
    return problem(formData, "This phone has not been checked yet. Open your link again and we will text you a code.");
  }
  const house = await houseForLink(db, link.id, text(formData, "propertyId"));
  if (!house) return problem(formData, "That house is not on your list any more. Ask the owner if it should be.");
  if (!(await withinRateLimit(`report-property:${house.property.id}`, 24 * 60 * 60, 30))) {
    return problem(formData, "A lot has been reported for this property today. Please contact the owner directly.");
  }
  const choice = text(formData, "menuItemId");
  if (!choice) return problem(formData, "Choose what needs fixing.");

  const guest = guestFromForm(formData, "NZ");
  if (!guest.ok) return problem(formData, guest.message, { guestPhone: guest.message });
  // Urgent and Emergency only when someone who could take it is inside their hours (DECISIONS.md, 2026-11-26, second entry).
  const how = urgencyChoice(formData);
  const refused = house.dispatch === "ask" ? null : await rushRefusal(db, house.property, { menuItemId: choice === "off-menu" ? null : choice, offMenuTrade: text(formData, "offMenuTrade"), ...how }, now());
  if (refused) return problem(formData, refused);
  const result = await createJob(db, {
    ...guest.guest,
    property: house.property,
    reportedBy: "team",
    reporterName: house.memberName,
    reporterPhone: link.phone,
    menuItemId: choice === "off-menu" ? null : choice,
    offMenuTrade: text(formData, "offMenuTrade"),
    offMenuTitle: text(formData, "offMenuTitle"),
    description: text(formData, "description"),
    ...how,
    uploadIds: list(formData, "uploadIds"),
    uploader: `team:${link.id}`,
    actor: `team:${house.memberId}`,
    teamMemberId: house.memberId,
    askOwnerFirst: house.dispatch === "ask",
  }, gatewayFor(db));
  await sendQueued(db);
  if (!result.ok) {
    if (result.reason === "duplicate") redirect(`/r/${token}/sent?w=dup&p=${house.property.id}`);
    return problem(formData, result.message);
  }
  redirect(`/r/${token}/sent?w=${result.needsOwner ? "owner" : "go"}&n=${result.job.number}&t=1&p=${house.property.id}`);
}

/**
 * The button on a team link opened on a new phone: text a six-digit code to
 * the mobile the owner added. Opening the link sends nothing by itself, so a
 * chat app previewing it does not set off a text.
 */
export async function sendTeamCode(_previous: FormState, formData: FormData): Promise<FormState> {
  const secret = appSecret();
  if (!secret) return { message: "Codes cannot be sent yet. Please try again later." };
  if (!(await withinRateLimit(`team-code:${await visitorKey()}`, 15 * 60, 10))) return { message: "Too many tries. Please wait 15 minutes and try again." };
  const token = text(formData, "token");
  const db = await getDb();
  const link = await findTeamLink(db, token);
  if (!link) return { message: "This link does not work any more. Please ask the owner to add you to their team again." };

  const issued = await issueCode(db, secret, { kind: "phone", value: link.phone });
  if (!issued.ok) return { message: "We have sent several codes already. Please wait 15 minutes before asking for another." };
  await enqueue(db, { channel: "sms", to: link.phone, template: "sign_in_code", audience: "reporter", userId: link.userId, body: texts.signInCode(issued.code) });
  await flushOutbox(db);
  // In demo mode with no text service connected, nothing can be delivered, so the code is shown on screen.
  const showCode = demoModeAllowed() && !("settings" in smsSettings());
  await setCookie(
    TEAM_PENDING_COOKIE,
    sealTeamPending(secret, { linkId: link.id, expiresAt: Date.now() + TEAM_PENDING_MINUTES * 60_000, ...(showCode ? { demoCode: issued.code } : {}) }),
    TEAM_PENDING_MINUTES * 60,
  );
  redirect(`/r/${token}?code=1`);
}

/** The six-digit code typed on the team link. Right, and this phone opens the list from now on. */
export async function checkTeamCode(_previous: FormState, formData: FormData): Promise<FormState> {
  const secret = appSecret();
  if (!secret) return { message: "Codes cannot be checked yet. Please try again later." };
  if (!(await withinRateLimit(`team-check:${await visitorKey()}`, 15 * 60, 30))) return { message: "Too many tries. Please wait 15 minutes and try again." };
  const token = text(formData, "token");
  const db = await getDb();
  const link = await findTeamLink(db, token);
  const cookieStore = await cookies();
  const pending = openTeamPending(secret, cookieStore.get(TEAM_PENDING_COOKIE)?.value);
  if (!link || !pending || pending.linkId !== link.id) return { message: "That took too long. Ask for a new code." };

  const result = await checkCode(db, secret, { kind: "phone", value: link.phone }, text(formData, "code"));
  if (!result.ok) {
    if (result.reason === "wrong") return problem(formData, "That code is not right. Check it and try again.", { code: "Not the right code." });
    if (result.reason === "too_many") return { message: "Too many wrong tries. Ask for a new code." };
    return { message: "That code has run out. Ask for a new one." };
  }
  await audit(db, { actor: `team_link:${link.id}`, action: "team.phone_confirmed", entity: "team_link", entityId: link.id, detail: { user_agent: ((await headers()).get("user-agent") ?? "").slice(0, 120) } });
  await setCookie(TEAM_DEVICE_COOKIE, sealTeamDevice(secret, link), TEAM_DEVICE_DAYS * 24 * 60 * 60);
  cookieStore.delete(TEAM_PENDING_COOKIE);
  redirect(`/r/${token}`);
}
