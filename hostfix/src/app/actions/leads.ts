"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { createLeadToken, LEAD_COOKIE, LEAD_COOKIE_SECONDS } from "@/lib/auth/lead-token";
import { appSecret, baseUrl } from "@/lib/env";
import { HONEYPOT_FIELD, type LeadFormState } from "@/lib/leads/form-state";
import { submitLead } from "@/lib/leads/service";
import { sendMetaEvent } from "@/lib/meta/capi";
import { leadAlertContent, sendAlert } from "@/lib/notify/alerts";
import { clientIp, ipKey } from "@/lib/request";
import { getStore } from "@/lib/store";
import type { Lead, LeadType } from "@/lib/store/types";

/**
 * What runs on the server when a landing page form is submitted.
 * The rules themselves live in src/lib/leads/service.ts.
 */

const THANKS_PAGE: Record<LeadType, string> = { owner: "/owners/thanks", tradie: "/tradies/thanks" };
const FORM_PAGE: Record<LeadType, string> = { owner: "/owners", tradie: "/tradies" };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function contactLine(): string {
  const email = brand.contact.email;
  return email.includes("[EDIT") ? "" : ` or email ${email}`;
}

async function handle(leadType: LeadType, formData: FormData): Promise<LeadFormState> {
  const headerList = await headers();
  const cookieStore = await cookies();

  const fields: Record<string, string | string[]> =
    leadType === "owner"
      ? {
          name: text(formData, "name"),
          phone: text(formData, "phone"),
          email: text(formData, "email"),
          propertyCount: text(formData, "propertyCount"),
          managedBy: text(formData, "managedBy"),
          ownerLocation: text(formData, "ownerLocation"),
        }
      : {
          name: text(formData, "name"),
          phone: text(formData, "phone"),
          trade: text(formData, "trade"),
          licenceNumber: text(formData, "licenceNumber"),
          daysAvailable: formData.getAll("daysAvailable").filter((v): v is string => typeof v === "string"),
        };

  const result = await submitLead(
    leadType,
    {
      fields,
      attribution: formData.get("attribution"),
      honeypot: formData.get(HONEYPOT_FIELD),
      startedAt: formData.get("startedAt"),
    },
    { market: launchMarket, ipKey: ipKey(headerList) },
    {
      getStore,
      sendLeadAlert: (lead, options, store) => sendAlert(leadAlertContent(lead, options), { store }),
      defer: after,
    },
  );

  switch (result.status) {
    case "invalid":
      return { fieldErrors: result.fieldErrors, values: fields, message: "Please check the highlighted fields below." };
    case "rate_limited":
      return {
        values: fields,
        message: "You've sent this form a few times in a row. Please wait a few minutes and try again.",
      };
    case "failed":
      return {
        values: fields,
        message: `Sorry, something went wrong on our side and your details were not saved. Please try again in a minute${contactLine()}.`,
      };
    case "spam":
      // Robots get the same thank-you page as everyone else, and nothing is saved.
      return redirect(THANKS_PAGE[leadType]);
    case "ok": {
      const lead = result.lead;
      const secret = appSecret();
      if (secret && result.saved) {
        cookieStore.set(LEAD_COOKIE, createLeadToken(secret, lead.id), {
          httpOnly: true,
          secure: baseUrl().startsWith("https://"),
          sameSite: "lax",
          path: "/",
          maxAge: LEAD_COOKIE_SECONDS,
        });
      }
      if (!result.duplicate) trackLeadWithMeta(lead, headerList, cookieStore);
      return redirect(THANKS_PAGE[leadType]);
    }
  }
}

/** Tells Meta about the lead from the server, after the visitor has their answer. */
function trackLeadWithMeta(
  lead: Lead,
  headerList: { get(name: string): string | null },
  cookieStore: { get(name: string): { value: string } | undefined },
) {
  const event = {
    name: lead.leadType === "owner" ? ("Lead" as const) : ("SubmitApplication" as const),
    eventId: lead.id,
    sourceUrl: `${baseUrl()}${FORM_PAGE[lead.leadType]}`,
    userAgent: headerList.get("user-agent"),
    ip: clientIp(headerList),
    email: lead.email,
    phone: lead.phone,
    fbp: cookieStore.get("_fbp")?.value ?? null,
    fbc: cookieStore.get("_fbc")?.value ?? null,
    fbclid: lead.fbclid,
  };
  after(async () => {
    const outcome = await sendMetaEvent(event);
    if (outcome.status === "failed") console.error("[meta]", outcome.detail);
  });
}

export async function submitOwnerLead(_previous: LeadFormState, formData: FormData): Promise<LeadFormState> {
  return handle("owner", formData);
}

export async function submitTradieLead(_previous: LeadFormState, formData: FormData): Promise<LeadFormState> {
  return handle("tradie", formData);
}
