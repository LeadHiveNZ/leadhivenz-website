import "server-only";
import { brand } from "@config/brand";
import { findMarket } from "@config/markets";
import { findTrade } from "@config/trades";
import { sourceLabel } from "@/lib/attribution";
import { baseUrl, env, isProduction } from "@/lib/env";
import { daysLabel, managedByLabel } from "@/lib/leads/options";
import { formatMoney } from "@/lib/money";
import { displayPhone, normalisePhone } from "@/lib/phone";
import type { Lead, LeadStore } from "@/lib/store/types";
import { emailSettings, sendEmail } from "./email";
import { toGsm7 } from "./gsm";
import { sendSms, smsSettings } from "./sms";

/**
 * ALERTS TO THE FOUNDER
 * Builds the text and the email for each event and sends both. One channel
 * failing never stops the other, and nothing here can stop a lead being saved.
 */

export type ChannelOutcome = { status: "sent" | "failed" | "skipped"; detail: string };
export type AlertOutcome = { sms: ChannelOutcome; email: ChannelOutcome; anySent: boolean };

export type AlertDeps = {
  fetchImpl?: typeof fetch;
  /** Where to record what was sent. Pass null to skip recording. */
  store?: LeadStore | null;
};

type EmailContent = { subject: string; html: string; text: string; replyTo?: string | null };
type AlertContent = { template: string; sms: string; email: EmailContent; leadId: string | null };

// --- who gets the alerts ------------------------------------------------------

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function alertEmailRecipients(): string[] {
  return splitList(env("ALERT_EMAIL_TO")).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

/**
 * Alert phone numbers. They must be written the international way, starting
 * with + and the country code (+61412345678 or +64211234567). A local-style
 * number is refused on purpose: "021 123 4567" is a New Zealand mobile but is
 * also a valid Sydney landline, and guessing wrong would send your alerts to a
 * stranger.
 */
export function alertSmsNumbers(): { numbers: string[]; rejected: string[] } {
  const numbers: string[] = [];
  const rejected: string[] = [];
  for (const item of splitList(env("ALERT_SMS_TO"))) {
    const parsed = item.startsWith("+") ? normalisePhone(item, "AU") : null;
    if (!parsed) rejected.push(item);
    else if (!numbers.includes(parsed.e164)) numbers.push(parsed.e164);
  }
  return { numbers, rejected };
}

export function alertSmsRecipients(): string[] {
  return alertSmsNumbers().numbers;
}

export const ALERT_SMS_FORMAT_HELP =
  "ALERT_SMS_TO must start with + and the country code, for example +61412345678 or +64211234567.";

// --- wording -------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function marketName(lead: Lead): string {
  return findMarket(lead.market)?.name ?? lead.market;
}

function tradeLabel(lead: Lead): string {
  return (lead.trade && findTrade(lead.trade)?.label) || lead.trade || "Tradie";
}

/** Every detail of a lead as label and value pairs, in the order a person would read them. */
export function leadDetailRows(lead: Lead): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: lead.name },
    { label: "Phone", value: displayPhone(lead.phone) },
  ];
  if (lead.email) rows.push({ label: "Email", value: lead.email });

  if (lead.leadType === "owner") {
    rows.push({ label: "Properties", value: String(lead.propertyCount ?? "") });
    rows.push({ label: "Looked after by", value: managedByLabel(lead.managedBy) });
    rows.push({ label: "Lives in", value: lead.ownerLocation ?? "" });
    if (lead.intent) rows.push({ label: "Pressed", value: lead.intent === "deposit" ? "Take a founding spot (the deposit)" : "Send me the price list" });
  } else {
    rows.push({ label: "Trade", value: tradeLabel(lead) });
    rows.push({ label: "Licence number", value: lead.licenceNumber ?? "None given" });
    rows.push({ label: "Days available", value: daysLabel(lead.daysAvailable) });
  }

  rows.push({ label: "Market", value: marketName(lead) });
  rows.push({ label: "Source", value: sourceLabel(lead.source) });
  if (lead.utmCampaign) rows.push({ label: "Campaign", value: lead.utmCampaign });
  if (lead.utmContent) rows.push({ label: "Ad", value: lead.utmContent });
  if (lead.refCode) rows.push({ label: "Referred by", value: lead.refCode });
  if (lead.landingPath) rows.push({ label: "Landed on", value: lead.landingPath });
  return rows.filter((row) => row.value !== "");
}

function smsText(text: string): string {
  const clean = toGsm7(text).replace(/\s+/g, " ").trim();
  return clean.length > 300 ? `${clean.slice(0, 297)}...` : clean;
}

function adminLink(): string | null {
  const url = baseUrl();
  // In production only link to a real address, never to a developer's laptop.
  if (isProduction() && /\/\/(localhost|127\.0\.0\.1)/.test(url) && !env("APP_URL")) return null;
  return `${url}/admin/leads`;
}

function emailShell(title: string, intro: string, rows: { label: string; value: string }[], warning?: string): { html: string; text: string } {
  const link = adminLink();
  const rowHtml = rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#55657a;vertical-align:top;white-space:nowrap">${escapeHtml(row.label)}</td>` +
        `<td style="padding:6px 0;color:#0b1f33;font-weight:600">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0b1f33;max-width:560px">` +
    `<h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1>` +
    (warning
      ? `<p style="margin:0 0 12px;padding:10px 12px;background:#fff4d6;border:1px solid #f5a524;border-radius:8px"><strong>${escapeHtml(warning)}</strong></p>`
      : "") +
    `<p style="margin:0 0 12px;color:#55657a">${escapeHtml(intro)}</p>` +
    `<table style="border-collapse:collapse" cellpadding="0" cellspacing="0">${rowHtml}</table>` +
    (link ? `<p style="margin:16px 0 0"><a href="${escapeHtml(link)}" style="color:#0e7c66">Open the leads list</a></p>` : "") +
    `</div>`;
  const text = [
    title,
    warning ? `\n${warning}` : "",
    `\n${intro}\n`,
    ...rows.map((row) => `${row.label}: ${row.value}`),
    link ? `\nLeads list: ${link}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
  return { html, text };
}

const NOT_SAVED_WARNING =
  "This lead was NOT saved to the database. This message is the only copy. Add it by hand and check the database connection.";

export function leadAlertContent(lead: Lead, options: { saved: boolean }): AlertContent {
  const phone = displayPhone(lead.phone);
  const source = sourceLabel(lead.source);
  const market = marketName(lead);
  const unsavedPrefix = options.saved ? "" : "NOT SAVED, keep this text. ";

  let sms: string;
  let subject: string;
  if (lead.leadType === "owner") {
    const count = lead.propertyCount ?? 1;
    sms =
      `${unsavedPrefix}${brand.name} lead: OWNER ${lead.name}, ${phone}. ` +
      `${count} ${count === 1 ? "property" : "properties"} in ${market}, lives in ${lead.ownerLocation ?? "?"}. Via ${source}.` +
      (lead.intent === "deposit" ? " Went for a founding spot." : lead.intent === "pricelist" ? " Asked for the price list." : "");
    subject = `New owner lead: ${lead.name} (${market})${lead.intent === "deposit" ? ", wants a founding spot" : ""}`;
  } else {
    sms =
      `${unsavedPrefix}${brand.name} lead: TRADIE ${lead.name}, ${phone}. ` +
      `${tradeLabel(lead)}${lead.licenceNumber ? `, licence ${lead.licenceNumber}` : ""}. Via ${source}.`;
    subject = `New tradie lead: ${lead.name}, ${tradeLabel(lead)} (${market})`;
  }

  const shell = emailShell(
    lead.leadType === "owner" ? "New owner lead" : "New tradie lead",
    lead.email ? "Reply to this email to write straight back to them." : "Call or text them on the number below.",
    leadDetailRows(lead),
    options.saved ? undefined : NOT_SAVED_WARNING,
  );

  return {
    template: "lead_alert",
    sms: smsText(sms),
    email: { subject: options.saved ? subject : `NOT SAVED: ${subject}`, ...shell, replyTo: lead.email },
    leadId: options.saved ? lead.id : null,
  };
}

export function depositAlertContent(lead: Lead): AlertContent {
  const money = formatMoney(lead.depositAmount ?? 0, lead.depositCurrency ?? "NZD");
  const shell = emailShell(
    `Deposit paid: ${money}`,
    "A founding member deposit just went through. It is refundable from your Stripe dashboard.",
    [{ label: "Deposit", value: money }, ...leadDetailRows(lead)],
  );
  return {
    template: "deposit_alert",
    sms: smsText(`${brand.name}: DEPOSIT PAID ${money} by ${lead.name}, ${displayPhone(lead.phone)}.`),
    email: { subject: `Deposit paid: ${money} from ${lead.name}`, ...shell, replyTo: lead.email },
    leadId: lead.id,
  };
}

export function duplicateDepositAlertContent(lead: Lead, checkoutSessionId: string): AlertContent {
  const shell = emailShell(
    "Check this: a second deposit payment",
    "This person already had a paid deposit and has now paid again. Find the extra payment in your Stripe dashboard and refund it.",
    [{ label: "Stripe checkout session", value: checkoutSessionId }, ...leadDetailRows(lead)],
    "Action needed: refund the extra payment in Stripe.",
  );
  return {
    template: "deposit_duplicate_alert",
    sms: smsText(`${brand.name}: ${lead.name} has paid the deposit TWICE. Refund one payment in Stripe. See your email.`),
    email: { subject: `Action needed: ${lead.name} paid the deposit twice`, ...shell, replyTo: lead.email },
    leadId: lead.id,
  };
}

export function orphanDepositAlertContent(checkoutSessionId: string, amount: number, currency: string): AlertContent {
  const money = formatMoney(amount, currency);
  const shell = emailShell(
    "Check this: a deposit with no matching lead",
    "A deposit was paid but the lead it belongs to could not be found. Look up the payment in your Stripe dashboard to see who paid.",
    [
      { label: "Deposit", value: money },
      { label: "Stripe checkout session", value: checkoutSessionId },
    ],
    "Action needed: match this payment to a person.",
  );
  return {
    template: "deposit_orphan_alert",
    sms: smsText(`${brand.name}: a ${money} deposit was paid but its lead was not found. See your email.`),
    email: { subject: `Action needed: ${money} deposit with no matching lead`, ...shell },
    leadId: null,
  };
}

export function testAlertContent(): AlertContent {
  const shell = emailShell(
    `Test alert from ${brand.name}`,
    "If you can read this, email alerts are working. A real lead alert looks like this, with the person's details in a table.",
    [{ label: "Sent to", value: alertEmailRecipients().join(", ") || "nobody yet" }],
  );
  return {
    template: "test_alert",
    sms: smsText(`${brand.name} test alert. If you can read this, text alerts are working.`),
    email: { subject: `Test alert from ${brand.name}`, ...shell },
    leadId: null,
  };
}

// --- sending -------------------------------------------------------------------

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function record(deps: AlertDeps, entry: Parameters<LeadStore["logNotification"]>[0]): Promise<void> {
  if (!deps.store) return;
  try {
    await deps.store.logNotification(entry);
  } catch (error) {
    console.error("[alerts] could not record an alert:", reason(error));
  }
}

async function deliverSms(content: AlertContent, deps: AlertDeps): Promise<ChannelOutcome> {
  const settings = smsSettings();
  const recipients = alertSmsRecipients();
  if ("problem" in settings) return { status: "skipped", detail: settings.problem };
  if (recipients.length === 0) {
    const { rejected } = alertSmsNumbers();
    return {
      status: "skipped",
      detail: rejected.length > 0 ? ALERT_SMS_FORMAT_HELP : "ALERT_SMS_TO is not set.",
    };
  }

  const results = await Promise.allSettled(
    recipients.map((to) => sendSms(settings.settings, to, content.sms, deps.fetchImpl)),
  );
  let failure: string | null = null;
  for (const [index, result] of results.entries()) {
    const to = recipients[index]!;
    if (result.status === "fulfilled") {
      await record(deps, {
        channel: "sms",
        template: content.template,
        recipient: to,
        status: "sent",
        provider: result.value.provider,
        providerMessageId: result.value.messageId,
        leadId: content.leadId,
      });
    } else {
      failure ??= reason(result.reason);
      await record(deps, {
        channel: "sms",
        template: content.template,
        recipient: to,
        status: "failed",
        provider: settings.settings.provider,
        error: reason(result.reason),
        leadId: content.leadId,
      });
    }
  }
  if (failure) return { status: "failed", detail: failure };
  return { status: "sent", detail: `Text sent to ${recipients.length === 1 ? recipients[0] : `${recipients.length} numbers`}.` };
}

async function deliverEmail(content: AlertContent, deps: AlertDeps): Promise<ChannelOutcome> {
  const settings = emailSettings();
  const recipients = alertEmailRecipients();
  if ("problem" in settings) return { status: "skipped", detail: settings.problem };
  if (recipients.length === 0) return { status: "skipped", detail: "ALERT_EMAIL_TO is not set." };

  try {
    const result = await sendEmail(
      settings.settings,
      { to: recipients, ...content.email },
      deps.fetchImpl,
    );
    await record(deps, {
      channel: "email",
      template: content.template,
      recipient: recipients.join(", "),
      status: "sent",
      provider: result.provider,
      providerMessageId: result.messageId,
      leadId: content.leadId,
    });
    return { status: "sent", detail: `Email sent to ${recipients.join(", ")}.` };
  } catch (error) {
    await record(deps, {
      channel: "email",
      template: content.template,
      recipient: recipients.join(", "),
      status: "failed",
      provider: "resend",
      error: reason(error),
      leadId: content.leadId,
    });
    return { status: "failed", detail: reason(error) };
  }
}

/** Sends the text and the email side by side and reports how each went. */
export async function sendAlert(content: AlertContent, deps: AlertDeps = {}): Promise<AlertOutcome> {
  const [sms, email] = await Promise.all([deliverSms(content, deps), deliverEmail(content, deps)]);

  if (!isProduction() && sms.status === "skipped" && email.status === "skipped") {
    console.info(`[alerts] (not sent, nothing is connected yet) ${content.email.subject}\n  ${content.sms}`);
  }
  if (sms.status === "failed") console.error("[alerts] text failed:", sms.detail);
  if (email.status === "failed") console.error("[alerts] email failed:", email.detail);

  return { sms, email, anySent: sms.status === "sent" || email.status === "sent" };
}
