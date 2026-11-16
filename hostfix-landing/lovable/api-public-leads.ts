import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/leads
 * Saves a lead from the landing page form, then emails it to Joe.
 * The lead is saved first: if the email fails, the lead is still in the leads table.
 * Lovable path: src/routes/api/public/leads.ts
 */
const LEAD_EMAIL_TO = "hello@leadhivenz.com";
// Resend's shared sender: it can only deliver to the address that owns the Resend account.
// Once a domain is verified in Resend, change this to an address on that domain.
const LEAD_EMAIL_FROM = "HostFix Leads <onboarding@resend.dev>";

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

function nzTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" }).format(date);
}

export const Route = createFileRoute("/api/public/leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require an exact same-origin browser submission; this is not bot authentication.
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
        // Limit bytes while reading, rather than buffering an unlimited request first.
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
        const properties = typeof body["properties"] === "number" || typeof body["properties"] === "string" ? Number(body["properties"]) : NaN;
        if (
          name === null || name.length < 2 ||
          phone === null || phone.replace(/\D/g, "").length < 8 || !/^[0-9+()\s-]+$/.test(phone) ||
          email === null || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          !Number.isInteger(properties) || properties < 1 || properties > 500
        ) return Response.json({ error: "Please check the form" }, { status: 400 });

        const lead = {
          name, phone, email, properties,
          suburb: text(body["suburb"], 100),
          utm_source: text(body["utm_source"], 255),
          utm_campaign: text(body["utm_campaign"], 255),
          utm_content: text(body["utm_content"], 255),
          fbclid: text(body["fbclid"], 500),
        };

        let saved: { id: string; created_at: string };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.from("leads").insert(lead).select("id, created_at").single();
          if (error || !data) {
            console.error("Lead could not be saved", error?.code);
            return Response.json({ error: "Could not save" }, { status: 500 });
          }
          saved = data;
        } catch {
          console.error("Lead could not be saved");
          return Response.json({ error: "Could not save" }, { status: 500 });
        }

        // Every failure after saving returns success, including missing secrets and timeouts.
        try {
          const key = process.env["RESEND_API_KEY"];
          if (!key) {
            console.error("RESEND_API_KEY is not set, so no lead email was sent");
            return Response.json({ ok: true, emailed: false });
          }
          const source = [lead.utm_source, lead.utm_campaign, lead.utm_content].filter(Boolean).join(" / ") || "direct";
          const lines = [
            `New HostFix lead. Call within the hour.`,
            ``,
            `Name: ${lead.name}`,
            `Mobile: ${lead.phone}`,
            `Email: ${lead.email}`,
            `Properties: ${lead.properties}`,
            `Suburb: ${lead.suburb ?? "not given"}`,
            ``,
            `Came from: ${source}`,
            `When: ${nzTime(new Date(saved.created_at))} (NZ time)`,
            ``,
            `Ask them: what happened the last time something broke with a guest in the house?`,
          ];
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `hostfix-lead-${saved.id}` },
            body: JSON.stringify({
              from: LEAD_EMAIL_FROM,
              to: [LEAD_EMAIL_TO],
              reply_to: lead.email,
              subject: `New HostFix lead: ${lead.name}, ${lead.properties} ${lead.properties === 1 ? "property" : "properties"}${lead.suburb ? ` (${lead.suburb})` : ""}`,
              text: lines.join("\n"),
            }),
          });
          if (!response.ok) {
            // Do not log provider bodies: they may contain credentials or submitted details.
            console.error(`Lead email failed [${response.status}]`);
            return Response.json({ ok: true, emailed: false });
          }
          return Response.json({ ok: true, emailed: true });
        } catch {
          console.error("Lead email failed");
          return Response.json({ ok: true, emailed: false });
        }
      },
    },
  },
});
