import { brand } from "@config/brand";
import { sendQueued } from "@/lib/after";
import { safeEqual } from "@/lib/auth/signing";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/notify/outbox";
import { handleInboundSms, readClickSend, replyText } from "@/lib/notify/inbound";
import { normalisePhone } from "@/lib/phone";

/**
 * A TEXT REPLY, BY CLICKSEND. When a tradie replies YES or NO to an offer,
 * ClickSend posts the reply here.
 *
 * ClickSend's published docs did not let us confirm exactly what it posts, or
 * a way to check its signature. So:
 *  - the address must carry a secret only you and ClickSend know:
 *      https://YOUR-SITE/api/sms/inbound/clicksend?key=YOUR_SMS_INBOUND_SECRET
 *  - the reply is read tolerantly, whichever field names it uses, and a copy
 *    of exactly what arrived is kept (the sms_inbound table) so the first
 *    real reply can be checked. SETUP.md has the steps.
 */
export async function POST(request: Request) {
  const secret = env("SMS_INBOUND_SECRET");
  if (!secret || secret.length < 16) return new Response("Text replies are not set up.", { status: 503 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!safeEqual(key, secret)) return new Response("Not allowed.", { status: 403 });

  let payload: Record<string, unknown> = {};
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const parsed: unknown = await request.json();
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } else {
      const form = await request.formData();
      for (const [name, value] of form.entries()) if (typeof value === "string") payload[name] = value;
    }
  } catch {
    return new Response("Bad request.", { status: 400 });
  }

  try {
    const db = await getDb();
    const read = readClickSend(payload);
    if (!read) {
      // Keep what arrived so the field names can be checked, and answer OK so ClickSend does not keep retrying.
      await db.query("insert into public.sms_inbound (provider, body, raw, outcome) values ('clicksend', null, $1::jsonb, 'not_understood')", [JSON.stringify(payload).slice(0, 8000)]);
      return Response.json({ received: true, understood: false });
    }
    const outcome = await handleInboundSms(db, { provider: "clicksend", from: read.from, body: read.body, raw: payload });
    const reply = replyText(outcome, brand.name);
    const to = normalisePhone(read.from, "NZ")?.e164;
    if (reply && to) await enqueue(db, { channel: "sms", to, template: "reply_answer", body: reply, audience: "tradie" });
    await sendQueued(db);
    return Response.json({ received: true, understood: true });
  } catch (error) {
    console.error("[sms] handling a ClickSend reply failed:", error instanceof Error ? error.message : error);
    return new Response("Could not process this reply.", { status: 500 });
  }
}
