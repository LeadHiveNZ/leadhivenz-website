import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/tradie-leads
 * Saves a tradie who put their hand up on /tradies, then emails Joe.
 * The lead is saved first: if the email fails, the lead is still in the tradie_leads table.
 * Lovable path: src/routes/api/public/tradie-leads.ts
 */
const LEAD_EMAIL_TO = "hello@leadhivenz.com";
const LEAD_EMAIL_FROM = "HostFix Leads <onboarding@resend.dev>";
const TRADES = ["plumber", "electrician", "handyman", "gasfitter", "other"];

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

function nzTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" }).format(date);
}

export const Route = createFileRoute("/api/public/tradie-leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!origin || origin !== new URL(request.url).origin) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        const fetchSite = request.headers.get("sec-fetch-site");
        if (fetchSite && fetchSite !== "same-origin") {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
          return Response.json({ error: "Invalid content type" }, { status: 415 });
        }
        const reader = request.body?.getReader();
        if (!reader) return Response.json({ error: "Invalid JSON" }, { status: 400 });
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > 5000) {
              await reader.cancel();
              return Response.json({ error: "Too long" }, { status: 413 });
            }
            chunks.push(value);
          }
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          return Response.json({ error: "Please check the form" }, { status: 400 });
        }
        const body = parsed as Record<string, unknown>;
        const name = text(body["name"], 100);
        const phone = text(body["phone"], 30);
        const email = text(body["email"], 255);
        const trade = text(body["trade"], 20);
        const town = text(body["town"], 100);
        const insured = text(body["insured"], 10);
        if (
          name === null || name.length < 2 ||
          phone === null || phone.replace(/\D/g, "").length < 8 || !/^[0-9+()\s-]+$/.test(phone) ||
          email === null || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          trade === null || !TRADES.includes(trade) ||
          town === null || town.length < 2 ||
          (insured !== "yes" && insured !== "not_yet")
        ) return Response.json({ error: "Please check the form" }, { status: 400 });

        const lead = {
          name, phone, email, trade, town, insured,
          licence: text(body["licence"], 60),
          message: text(body["message"], 500),
          utm_source: text(body["utm_source"], 255),
          utm_campaign: text(body["utm_campaign"], 255),
          utm_content: text(body["utm_content"], 255),
        };

        let saved: { id: string; created_at: string };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.from("tradie_leads").insert(lead).select("id, created_at").single();
          if (error || !data) {
            console.error("Tradie lead could not be saved", error?.code);
            return Response.json({ error: "Could not save" }, { status: 500 });
          }
          saved = data;
        } catch {
          console.error("Tradie lead could not be saved");
          return Response.json({ error: "Could not save" }, { status: 500 });
        }

        try {
          const key = process.env["RESEND_API_KEY"];
          if (!key) {
            console.error("RESEND_API_KEY is not set, so no tradie lead email was sent");
            return Response.json({ ok: true, emailed: false });
          }
          const tradeName = ({ plumber: "Plumber", electrician: "Sparky", handyman: "Handyman", gasfitter: "Gasfitter", other: "Other trade" } as Record<string, string>)[lead.trade] ?? lead.trade;
          const source = [lead.utm_source, lead.utm_campaign, lead.utm_content].filter(Boolean).join(" / ") || "direct";
          const lines = [
            `A tradie put their hand up. Ring them within the day.`,
            ``,
            `Name: ${lead.name}`,
            `Trade: ${tradeName}`,
            `Town: ${lead.town}`,
            `Mobile: ${lead.phone}`,
            `Email: ${lead.email}`,
            `Public liability insurance: ${lead.insured === "yes" ? "yes, says they have it" : "NOT YET"}`,
            `Licence number: ${lead.licence ?? "not given"}`,
            `Message: ${lead.message ?? "none"}`,
            ``,
            `Came from: ${source}`,
            `When: ${nzTime(new Date(saved.created_at))} (NZ time)`,
            ``,
            `On the call: licence on the register, certificate photo, days they work, then the sign-in link.`,
          ];
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `hostfix-tradie-lead-${saved.id}` },
            body: JSON.stringify({
              from: LEAD_EMAIL_FROM,
              to: [LEAD_EMAIL_TO],
              reply_to: lead.email,
              subject: `Tradie hand up: ${lead.name}, ${tradeName} (${lead.town})${lead.insured === "yes" ? "" : " NO INSURANCE YET"}`,
              text: lines.join("\n"),
            }),
          });
          if (!response.ok) {
            console.error(`Tradie lead email failed [${response.status}]`);
            return Response.json({ ok: true, emailed: false });
          }
          return Response.json({ ok: true, emailed: true });
        } catch {
          console.error("Tradie lead email failed");
          return Response.json({ ok: true, emailed: false });
        }
      },
    },
  },
});
