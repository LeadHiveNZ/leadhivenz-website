import "server-only";
import { brand } from "@config/brand";
import { env } from "@/lib/env";

/**
 * EMAIL, sent through Resend.
 *
 * Facts this code relies on (Resend API reference, Nov 2026):
 *  - POST https://api.resend.com/emails with "Authorization: Bearer <key>".
 *  - A User-Agent header is required or the request is rejected.
 *  - Body fields: from, to, subject, html, text, reply_to.
 *  - Success is HTTP 200 with { id }.
 *  - The test sender onboarding@resend.dev can only deliver to the email
 *    address that owns the Resend account. That is enough for alerts to you.
 *    To email anyone else, verify your own domain in Resend first.
 */

export type EmailMessage = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /** Stops the same email going twice if a request is retried. */
  idempotencyKey?: string;
};

export type EmailSettings = { apiKey: string; from: string };
export type EmailResult = { provider: "resend"; messageId: string | null };
type FetchLike = typeof fetch;

const TIMEOUT_MS = 10_000;

export function emailSettings(): { settings: EmailSettings } | { problem: string } {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return { problem: "RESEND_API_KEY is not set." };
  const from = env("EMAIL_FROM") ?? `${brand.name} <onboarding@resend.dev>`;
  return { settings: { apiKey, from } };
}

export function usingResendTestSender(settings: EmailSettings): boolean {
  return /@resend\.dev>?\s*$/i.test(settings.from);
}

export async function sendEmail(settings: EmailSettings, message: EmailMessage, fetchImpl: FetchLike = fetch): Promise<EmailResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${settings.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "hostfix/1.0",
  };
  if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);

  const body: Record<string, unknown> = {
    from: settings.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.replyTo) body.reply_to = message.replyTo;

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { message: text.slice(0, 300) };
  }

  if (!response.ok) {
    const reason = typeof json.message === "string" ? json.message : "no details given";
    if (response.status === 401) throw new Error("Resend rejected the API key.");
    if (response.status === 403 && /own email address|testing emails/i.test(reason)) {
      throw new Error(
        "Resend's test sender can only email the address that owns the Resend account. Set ALERT_EMAIL_TO to that address, or verify your domain in Resend and set EMAIL_FROM.",
      );
    }
    throw new Error(`Resend refused the email (HTTP ${response.status}): ${reason}`);
  }
  return { provider: "resend", messageId: typeof json.id === "string" ? json.id : null };
}
