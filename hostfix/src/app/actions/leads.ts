"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { brand } from "@config/brand";
import { launchMarket } from "@config/markets";
import { createLeadToken, LEAD_COOKIE, LEAD_COOKIE_SECONDS } from "@/lib/auth/lead-token";
import { getDb } from "@/lib/db";
import { getFileStore } from "@/lib/files/store";
import { checkFile } from "@/lib/files/uploads";
import { appSecret, baseUrl } from "@/lib/env";
import { currentMarket, foundingSpotsTaken, spotsLeft } from "@/lib/leads/founding";
import { HONEYPOT_FIELD, type LeadFormState } from "@/lib/leads/form-state";
import { sendPriceList } from "@/lib/leads/send-price-list";
import { submitLead } from "@/lib/leads/service";
import { sendMetaEvent, type MetaEventName } from "@/lib/meta/capi";
import { leadAlertContent, sendAlert } from "@/lib/notify/alerts";
import { DepositNotAllowedError, startDepositCheckout } from "@/lib/payments/deposit";
import { clientIp, ipKey } from "@/lib/request";
import { getStore } from "@/lib/store";
import { fileFromForm, saveInsuranceCertificate } from "@/lib/tradies/certificate";
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
          // Which button they pressed: "deposit" (take a founding spot) or "pricelist".
          intent: text(formData, "intent"),
        }
      : {
          name: text(formData, "name"),
          phone: text(formData, "phone"),
          trade: text(formData, "trade"),
          licenceNumber: text(formData, "licenceNumber"),
          lbpNumber: text(formData, "lbpNumber"),
          daysAvailable: formData.getAll("daysAvailable").filter((v): v is string => typeof v === "string"),
        };

  // The insurance certificate, if one was chosen. Checked before anything is
  // saved, so a wrong file can be fixed. It is stored once the lead is saved.
  const certificate = leadType === "tradie" ? await fileFromForm(formData, "certificate") : null;
  if (certificate) {
    const checked = checkFile("insurance_certificate", certificate.contentType, certificate.bytes);
    if (!checked.ok) return { fieldErrors: { certificate: checked.reason }, values: fields, message: "Please check the certificate. Choose the file again." };
  }

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
      if (certificate && result.saved) {
        // Kept with the lead until staff turn it into a tradie. A failure here
        // never loses the lead: they can add the certificate from their profile.
        try {
          const saved = await saveInsuranceCertificate(await getDb(), getFileStore(), { leadId: lead.id }, {
            ...certificate, uploadedBy: `lead:${lead.id}`, actor: `lead:${lead.id}`,
          });
          if (!saved.ok) console.error("[certificate] a sign-up certificate was not kept:", saved.reason);
        } catch (error) {
          console.error("[certificate] a sign-up certificate was not kept:", error instanceof Error ? error.message : error);
        }
      }
      if (leadType === "owner" && result.saved) {
        if (lead.intent === "deposit") return redirect(await depositDestination(lead, headerList, cookieStore));
        if (lead.intent === "pricelist" && !result.duplicate) {
          after(async () => {
            const outcome = await sendPriceList(lead, { store: getStore(), open: getDb });
            if (outcome.status === "failed") console.error("[price list]", outcome.detail);
          });
        }
      }
      return redirect(THANKS_PAGE[leadType]);
    }
  }
}

/**
 * An owner pressed "take a founding spot": straight to the card page, with no
 * second button to press. If the deposit cannot be taken right now, they land
 * on the thank-you page, which says why and shows the price list.
 */
async function depositDestination(
  lead: Lead,
  headerList: { get(name: string): string | null },
  cookieStore: { get(name: string): { value: string } | undefined },
): Promise<string> {
  if (lead.depositStatus === "paid" || lead.depositStatus === "credited") return "/owners/founding-member";
  try {
    const market = await currentMarket(getDb, lead.market);
    const left = spotsLeft(market, await foundingSpotsTaken(await getDb(), market.slug));
    if (left === 0) return "/owners/thanks?deposit=full";
    const checkout = await startDepositCheckout(lead, market, baseUrl(), { store: getStore(), spotsLeft: left });
    trackWithMeta("InitiateCheckout", lead, headerList, cookieStore, { eventId: `${lead.id}-checkout`, valueCents: market.foundingDeposit.amountCents, currency: market.currency });
    return checkout.url;
  } catch (error) {
    if (!(error instanceof DepositNotAllowedError)) {
      console.error("[deposit] could not start the card payment:", error instanceof Error ? error.message : error);
    }
    return "/owners/thanks?deposit=unavailable";
  }
}

/** Tells Meta about the lead from the server, after the visitor has their answer. */
function trackLeadWithMeta(
  lead: Lead,
  headerList: { get(name: string): string | null },
  cookieStore: { get(name: string): { value: string } | undefined },
) {
  trackWithMeta(lead.leadType === "owner" ? "Lead" : "SubmitApplication", lead, headerList, cookieStore, { eventId: lead.id });
}

function trackWithMeta(
  name: MetaEventName,
  lead: Lead,
  headerList: { get(name: string): string | null },
  cookieStore: { get(name: string): { value: string } | undefined },
  extra: { eventId: string; valueCents?: number; currency?: string },
) {
  const event = {
    name,
    eventId: extra.eventId,
    ...(extra.valueCents !== undefined && extra.currency ? { valueCents: extra.valueCents, currency: extra.currency } : {}),
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
