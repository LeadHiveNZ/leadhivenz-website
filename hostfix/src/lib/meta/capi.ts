import "server-only";
import { env } from "@/lib/env";
import { sha256Hex } from "@/lib/auth/signing";

/**
 * META CONVERSIONS API
 * Tells Meta about a lead from the server as well as from the visitor's
 * browser. Ad blockers and iPhones stop a lot of browser tracking, so this is
 * what keeps your ad reporting and optimisation accurate.
 *
 * Facts this code relies on (Meta developer docs, Nov 2026):
 *  - POST https://graph.facebook.com/{version}/{pixel id}/events?access_token=...
 *  - Body: { data: [ { event_name, event_time, event_id, action_source,
 *    event_source_url, user_data, custom_data } ], test_event_code? }
 *  - Website events must include client_user_agent and event_source_url.
 *  - Email and phone are sent only as SHA-256 hashes. Email is lowercased and
 *    trimmed first. Phone is digits only, with the country code.
 *  - The browser pixel and the server event are counted once when they share
 *    the same event name and the same event id.
 */

export const DEFAULT_GRAPH_VERSION = "v27.0";

/** Lead: an owner filled in the form. InitiateCheckout: they went to the card page for the deposit. Purchase: they paid it. */
export type MetaEventName = "Lead" | "SubmitApplication" | "InitiateCheckout" | "Purchase";

export type MetaServerEvent = {
  name: MetaEventName;
  /** Must equal the eventID the browser pixel sends for the same event. */
  eventId: string;
  /** The page the event happened on. */
  sourceUrl: string;
  userAgent: string | null;
  ip: string | null;
  email?: string | null;
  /** International format, for example +64211234567. */
  phone?: string | null;
  /** The _fbp cookie, if the browser had one. */
  fbp?: string | null;
  /** The _fbc cookie, if the browser had one. */
  fbc?: string | null;
  /** The fbclid from the ad link, used when there is no _fbc cookie. */
  fbclid?: string | null;
  /** For purchases: the amount in cents and its currency. */
  valueCents?: number;
  currency?: string;
};

export type MetaSettings = { pixelId: string; accessToken: string; testEventCode: string | null; apiVersion: string };

export function metaPixelId(): string | null {
  const id = env("NEXT_PUBLIC_META_PIXEL_ID");
  return id && /^\d{5,20}$/.test(id) ? id : null;
}

export function metaSettings(): { settings: MetaSettings } | { problem: string } {
  const rawId = env("NEXT_PUBLIC_META_PIXEL_ID");
  if (!rawId) return { problem: "NEXT_PUBLIC_META_PIXEL_ID is not set." };
  const pixelId = metaPixelId();
  if (!pixelId) return { problem: "NEXT_PUBLIC_META_PIXEL_ID should be the Pixel ID: digits only." };
  const accessToken = env("META_CAPI_ACCESS_TOKEN");
  if (!accessToken) return { problem: "META_CAPI_ACCESS_TOKEN is not set." };
  const version = env("META_GRAPH_VERSION") ?? DEFAULT_GRAPH_VERSION;
  if (!/^v\d+\.\d+$/.test(version)) return { problem: "META_GRAPH_VERSION should look like v27.0." };
  return { settings: { pixelId, accessToken, testEventCode: env("META_TEST_EVENT_CODE") ?? null, apiVersion: version } };
}

export function buildMetaPayload(event: MetaServerEvent, settings: MetaSettings, nowMs: number): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  if (event.userAgent) userData.client_user_agent = event.userAgent;
  if (event.ip) userData.client_ip_address = event.ip;
  if (event.email) userData.em = [sha256Hex(event.email.trim().toLowerCase())];
  if (event.phone) {
    const digits = event.phone.replace(/\D/g, "").replace(/^0+/, "");
    if (digits) userData.ph = [sha256Hex(digits)];
  }
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;
  else if (event.fbclid) userData.fbc = `fb.1.${nowMs}.${event.fbclid}`;

  const entry: Record<string, unknown> = {
    event_name: event.name,
    event_time: Math.floor(nowMs / 1000),
    event_id: event.eventId,
    action_source: "website",
    event_source_url: event.sourceUrl,
    user_data: userData,
  };
  if (event.valueCents !== undefined && event.currency) {
    entry.custom_data = { value: event.valueCents / 100, currency: event.currency.toUpperCase() };
  }

  const payload: Record<string, unknown> = { data: [entry] };
  if (settings.testEventCode) payload.test_event_code = settings.testEventCode;
  return payload;
}

export type MetaSendResult = { status: "sent" | "skipped" | "failed"; detail: string };

/** Sends one event. Never throws: tracking must not break a lead. */
export async function sendMetaEvent(
  event: MetaServerEvent,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<MetaSendResult> {
  const config = metaSettings();
  if ("problem" in config) return { status: "skipped", detail: config.problem };
  if (!event.userAgent) return { status: "skipped", detail: "No browser details to send with the event." };

  const { settings } = config;
  const url =
    `https://graph.facebook.com/${settings.apiVersion}/${settings.pixelId}/events` +
    `?access_token=${encodeURIComponent(settings.accessToken)}`;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildMetaPayload(event, settings, nowMs)),
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) return { status: "sent", detail: `${event.name} sent to Meta.` };
    const text = await response.text();
    let message = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep the raw text
    }
    return { status: "failed", detail: `Meta refused the event (HTTP ${response.status}): ${message}` };
  } catch (error) {
    return { status: "failed", detail: `Could not reach Meta: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}
