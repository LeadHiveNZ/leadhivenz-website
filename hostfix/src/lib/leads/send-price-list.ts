import "server-only";
import { createLeadToken, LEAD_LINK_SECONDS } from "@/lib/auth/lead-token";
import type { Db } from "@/lib/db/types";
import { appSecret, baseUrl } from "@/lib/env";
import { alertEmailRecipients } from "@/lib/notify/alerts";
import { emailSettings, sendEmail, usingResendTestSender, type EmailSettings } from "@/lib/notify/email";
import { depositAvailability } from "@/lib/payments/deposit";
import type { Lead, LeadStore } from "@/lib/store/types";
import { currentMarket, foundingSpotsTaken, spotsLeft } from "./founding";
import { priceListEmail, priceListFor } from "./price-list";
import { PRICE_LIST_TEMPLATE } from "./price-list-template";

/**
 * Emails an owner the price list they asked for, with a link back to take a
 * founding spot. The thank-you page shows them the same list straight away,
 * so the email is a copy to keep: if it cannot be sent, nothing is lost.
 *
 * What happened is recorded against the lead, so the leads page shows
 * "Price list: sent" or why it was not.
 */

export type PriceListOutcome = { status: "sent" | "skipped" | "failed"; detail: string };

type Deps = {
  store: LeadStore;
  open: () => Promise<Db>;
  /** Replaced in tests. */
  settings?: { settings: EmailSettings } | { problem: string };
  fetchImpl?: typeof fetch;
};


export async function sendPriceList(lead: Lead, deps: Deps): Promise<PriceListOutcome> {
  const record = async (outcome: PriceListOutcome, extra: { providerMessageId?: string | null } = {}) => {
    try {
      await deps.store.logNotification({
        channel: "email", template: PRICE_LIST_TEMPLATE, recipient: lead.email ?? "", status: outcome.status,
        provider: outcome.status === "skipped" ? null : "resend", providerMessageId: extra.providerMessageId ?? null,
        error: outcome.status === "sent" ? null : outcome.detail, leadId: lead.id,
      });
    } catch (error) {
      console.error("[price list] could not record the email:", error instanceof Error ? error.message : error);
    }
    return outcome;
  };

  if (lead.leadType !== "owner" || !lead.email) return { status: "skipped", detail: "Only owners with an email address are sent the price list." };

  const config = deps.settings ?? emailSettings();
  if ("problem" in config) return record({ status: "skipped", detail: config.problem });
  if (usingResendTestSender(config.settings)) {
    return record({ status: "skipped", detail: "Emails to owners need your own domain verified in Resend, and EMAIL_FROM set to an address on it." });
  }

  const db = await deps.open();
  const market = await currentMarket(deps.open, lead.market);
  const list = await priceListFor(db, market.slug);
  const left = spotsLeft(market, await foundingSpotsTaken(db, market.slug));
  const secret = appSecret();
  const canTakeSpot =
    secret !== null && market.stage === "waitlist" && depositAvailability(market).available && left !== 0 && (lead.depositStatus === "none" || lead.depositStatus === "started");
  const foundingUrl = canTakeSpot ? `${baseUrl()}/owners/founding/${createLeadToken(secret!, lead.id, Date.now(), LEAD_LINK_SECONDS)}` : null;

  const content = priceListEmail({ lead, market, list, foundingUrl, spotsLeft: left });
  try {
    const result = await sendEmail(
      config.settings,
      { to: [lead.email], ...content, replyTo: alertEmailRecipients()[0] ?? null, idempotencyKey: `hostfix-price-list-${lead.id}` },
      deps.fetchImpl,
    );
    return record({ status: "sent", detail: `Price list emailed to ${lead.email}.` }, { providerMessageId: result.messageId });
  } catch (error) {
    return record({ status: "failed", detail: error instanceof Error ? error.message : "The email could not be sent." });
  }
}
