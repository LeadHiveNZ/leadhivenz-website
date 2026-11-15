import { brand } from "@config/brand";
import { sendQueued } from "@/lib/after";
import { getDb } from "@/lib/db";
import { baseUrl, env } from "@/lib/env";
import { handleInboundSms, replyText, twilioSignatureValid } from "@/lib/notify/inbound";

/**
 * A TEXT REPLY, BY TWILIO. When a tradie replies YES or NO to an offer,
 * Twilio posts the reply here. The request is checked against Twilio's
 * signature before anything is done with it.
 *
 * In Twilio, set the number's "A message comes in" webhook to exactly:
 *   https://YOUR-SITE/api/sms/inbound/twilio
 */

const xml = (inner: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { "Content-Type": "text/xml" } });
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: Request) {
  const token = env("TWILIO_AUTH_TOKEN");
  if (!token) return new Response("Text replies are not set up.", { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad request.", { status: 400 });
  }
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") params[key] = value;

  // Twilio signs the exact address it was given, so it must match the site's own address.
  if (!twilioSignatureValid(token, `${baseUrl()}/api/sms/inbound/twilio`, params, request.headers.get("x-twilio-signature"))) {
    return new Response("Signature check failed.", { status: 403 });
  }
  if (!params.From || typeof params.Body !== "string") return xml("");

  try {
    const db = await getDb();
    const outcome = await handleInboundSms(db, { provider: "twilio", from: params.From, body: params.Body, raw: params });
    await sendQueued(db);
    const reply = replyText(outcome, brand.name);
    return xml(reply ? `<Message>${escape(reply)}</Message>` : "");
  } catch (error) {
    console.error("[sms] handling a Twilio reply failed:", error instanceof Error ? error.message : error);
    return new Response("Could not process this reply.", { status: 500 });
  }
}
