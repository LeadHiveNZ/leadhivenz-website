import "server-only";
import { env } from "@/lib/env";

/**
 * TEXT MESSAGES
 * One small "send a text" function with two providers behind it. Swapping
 * provider is a settings change, not a rebuild:
 *   SMS_PROVIDER=clicksend (default)  or  SMS_PROVIDER=twilio
 *
 * ClickSend facts this code relies on (read from their API reference, Nov 2026):
 *  - POST https://rest.clicksend.com/v3/sms/send with HTTP Basic auth
 *    (username + API key) and a JSON body: { messages: [{ source, to, body }] }.
 *  - The top-level "SUCCESS" only means the request was accepted. Each message
 *    has its own status that must also be "SUCCESS".
 *  - New ClickSend accounts have texts containing links held back, so alert
 *    texts must never contain a web address.
 *
 * Twilio facts (their Messages API reference, Nov 2026):
 *  - POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *    with HTTP Basic auth and form fields To, From, Body.
 */

export type SmsProviderName = "clicksend" | "twilio";
export type SmsResult = { provider: SmsProviderName; messageId: string | null };
type FetchLike = typeof fetch;

const TIMEOUT_MS = 10_000;

type ClickSendSettings = { provider: "clicksend"; username: string; apiKey: string; from: string | null };
type TwilioSettings = { provider: "twilio"; accountSid: string; authToken: string; from: string };
export type SmsSettings = ClickSendSettings | TwilioSettings;

/** The SMS settings, or a plain-words reason texts cannot be sent yet. */
export function smsSettings(): { settings: SmsSettings } | { problem: string } {
  const wanted = (env("SMS_PROVIDER") ?? "").toLowerCase();
  const clicksendUser = env("CLICKSEND_USERNAME");
  const clicksendKey = env("CLICKSEND_API_KEY");
  const twilioSid = env("TWILIO_ACCOUNT_SID");
  const twilioToken = env("TWILIO_AUTH_TOKEN");
  const twilioFrom = env("TWILIO_FROM");

  const useTwilio = wanted === "twilio" || (wanted === "" && !clicksendUser && !clicksendKey && Boolean(twilioSid));

  if (useTwilio) {
    const missing = [
      !twilioSid && "TWILIO_ACCOUNT_SID",
      !twilioToken && "TWILIO_AUTH_TOKEN",
      !twilioFrom && "TWILIO_FROM",
    ].filter(Boolean);
    if (missing.length > 0) return { problem: `Twilio is selected but ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set.` };
    return { settings: { provider: "twilio", accountSid: twilioSid!, authToken: twilioToken!, from: twilioFrom! } };
  }

  if (wanted !== "" && wanted !== "clicksend") {
    return { problem: `SMS_PROVIDER is "${wanted}". It must be clicksend or twilio.` };
  }
  const missing = [!clicksendUser && "CLICKSEND_USERNAME", !clicksendKey && "CLICKSEND_API_KEY"].filter(Boolean);
  if (missing.length === 2) return { problem: "CLICKSEND_USERNAME and CLICKSEND_API_KEY are not set." };
  if (missing.length === 1) return { problem: `${missing[0]} is not set.` };
  return {
    settings: { provider: "clicksend", username: clicksendUser!, apiKey: clicksendKey!, from: env("SMS_FROM") ?? null },
  };
}

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

function pick(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

async function sendWithClickSend(s: ClickSendSettings, to: string, body: string, fetchImpl: FetchLike): Promise<SmsResult> {
  const message: Record<string, string> = { source: "hostfix", to, body };
  if (s.from) message.from = s.from;

  const response = await fetchImpl("https://rest.clicksend.com/v3/sms/send", {
    method: "POST",
    headers: { Authorization: basicAuth(s.username, s.apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [message] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await readJson(response);

  if (!response.ok) {
    const reason = pick(json, "response_msg") ?? pick(json, "raw") ?? "no details given";
    if (response.status === 401) throw new Error("ClickSend rejected the username or API key.");
    throw new Error(`ClickSend refused the text (HTTP ${response.status}): ${String(reason)}`);
  }
  if (pick(json, "response_code") !== "SUCCESS") {
    throw new Error(`ClickSend refused the text: ${String(pick(json, "response_msg") ?? pick(json, "response_code"))}`);
  }
  const messages = pick(pick(json, "data"), "messages");
  const first = Array.isArray(messages) ? messages[0] : undefined;
  const status = pick(first, "status");
  if (status !== "SUCCESS") {
    throw new Error(`ClickSend accepted the request but did not send the text. Status: ${String(status ?? "unknown")}.`);
  }
  const id = pick(first, "message_id");
  return { provider: "clicksend", messageId: typeof id === "string" ? id : null };
}

async function sendWithTwilio(s: TwilioSettings, to: string, body: string, fetchImpl: FetchLike): Promise<SmsResult> {
  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service ID starts with MG. Anything else is a sender number or name.
  if (s.from.startsWith("MG")) form.set("MessagingServiceSid", s.from);
  else form.set("From", s.from);

  const response = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(s.accountSid, s.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const json = await readJson(response);

  if (!response.ok) {
    if (response.status === 401) throw new Error("Twilio rejected the Account SID or Auth Token.");
    const reason = pick(json, "message") ?? pick(json, "raw") ?? "no details given";
    const code = pick(json, "code");
    throw new Error(`Twilio refused the text (HTTP ${response.status}${code ? `, code ${String(code)}` : ""}): ${String(reason)}`);
  }
  const status = pick(json, "status");
  if (status === "failed" || status === "undelivered") {
    throw new Error(`Twilio could not send the text (code ${String(pick(json, "error_code") ?? "unknown")}).`);
  }
  const sid = pick(json, "sid");
  return { provider: "twilio", messageId: typeof sid === "string" ? sid : null };
}

/**
 * Sends one text. Throws with a plain-words reason if it could not be sent.
 *
 * Alert texts to you never contain a link (see the note at the top). Texts
 * that are part of the product (job offers, status updates) must carry one,
 * so they pass allowLinks. ClickSend has to approve link texts on a new
 * account first: SETUP.md step 5.
 */
export async function sendSms(
  settings: SmsSettings,
  to: string,
  body: string,
  fetchImpl: FetchLike = fetch,
  options: { allowLinks?: boolean } = {},
): Promise<SmsResult> {
  if (!options.allowLinks && /https?:\/\/|www\./i.test(body)) {
    throw new Error("Alert texts must not contain web links.");
  }
  return settings.provider === "twilio"
    ? sendWithTwilio(settings, to, body, fetchImpl)
    : sendWithClickSend(settings, to, body, fetchImpl);
}
