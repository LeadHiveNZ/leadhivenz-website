import { createFileRoute } from "@tanstack/react-router";
import { AGREEMENT_TEXT, AGREEMENT_VERSION, TRADES, checkFile, nzToday, validateSignup } from "@/lib/tradie-signup";

/**
 * POST /api/public/tradie-signups
 * Saves a tradie who signed the agreement on /tradies/join (documents to the private tradie-docs bucket,
 * then the tradie_signups row), then emails Joe. If the email fails, the signup is still saved.
 */
const LEAD_EMAIL_TO = "hello@leadhivenz.com";
const LEAD_EMAIL_FROM = "HostFix Leads <onboarding@resend.dev>";
const BUCKET = "tradie-docs";
const MAX_BODY = 21 * 1024 * 1024 + 50_000;
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function nzTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** First bytes must look like the claimed type, so a renamed file is refused. */
function looksLike(ext: string, bytes: Uint8Array): boolean {
  if (ext === "pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (ext === "png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function asFile(value: FormDataEntryValue | null): File | null {
  return value && typeof value !== "string" && value.size > 0 ? value : null;
}

export const Route = createFileRoute("/api/public/tradie-signups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
        const fetchSite = request.headers.get("sec-fetch-site");
        if (fetchSite && fetchSite !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.split(";")[0]?.trim().toLowerCase() !== "multipart/form-data") {
          return Response.json({ error: "Invalid content type" }, { status: 415 });
        }
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_BODY) return Response.json({ error: "Too large" }, { status: 413 });

        const reader = request.body?.getReader();
        if (!reader) return Response.json({ error: "Invalid form" }, { status: 400 });
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > MAX_BODY) {
              await reader.cancel();
              return Response.json({ error: "Too large" }, { status: 413 });
            }
            chunks.push(value);
          }
        } catch {
          return Response.json({ error: "Invalid form" }, { status: 400 });
        } finally {
          reader.releaseLock();
        }
        let form: FormData;
        try {
          const bytes = new Uint8Array(length);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
        } catch {
          return Response.json({ error: "Invalid form" }, { status: 400 });
        }

        const insuranceFile = asFile(form.get("insurance_file"));
        const recordFile = asFile(form.get("record_file"));
        const result = validateSignup(form, { insurance: insuranceFile, record: recordFile }, nzToday());
        if (!result.ok) return Response.json({ error: "Please check the form", fields: Object.keys(result.errors) }, { status: 400 });
        const data = result.data;

        const uploads: { kind: "insurance" | "record"; file: File; ext: string; bytes: Uint8Array }[] = [];
        for (const [kind, file] of [["insurance", insuranceFile], ["record", recordFile]] as const) {
          if (!file) continue;
          const ext = checkFile(file)!;
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!looksLike(ext, bytes)) return Response.json({ error: "Please check the form", fields: [`${kind}_file`] }, { status: 400 });
          uploads.push({ kind, file, ext, bytes });
        }

        const id = crypto.randomUUID();
        const paths: Record<string, string> = {};
        let supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin;
        try {
          ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
          for (const up of uploads) {
            const path = `signups/${id}/${up.kind}.${up.ext}`;
            const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, up.bytes, { contentType: up.file.type, upsert: false });
            if (error) throw new Error("upload");
            paths[up.kind] = path;
          }
          const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
          const row = {
            id,
            ...data,
            insurance_file_path: paths["insurance"]!,
            record_file_path: paths["record"] ?? null,
            agreement_version: AGREEMENT_VERSION,
            agreement_sha256: await sha256Hex(AGREEMENT_TEXT),
            signed_at: new Date().toISOString(),
            signer_ip: (request.headers.get("cf-connecting-ip") ?? forwarded ?? request.headers.get("x-real-ip"))?.slice(0, 64) ?? null,
            signer_user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          };
          const { error } = await supabaseAdmin.from("tradie_signups").insert(row);
          if (error) throw new Error("insert");
        } catch {
          console.error("Tradie signup could not be saved");
          const saved = Object.values(paths);
          if (saved.length > 0) {
            try {
              const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
              await admin.storage.from(BUCKET).remove(saved);
            } catch {
              /* nothing more to do */
            }
          }
          return Response.json({ error: "Could not save" }, { status: 500 });
        }

        try {
          const key = process.env["RESEND_API_KEY"];
          if (!key) {
            console.error("RESEND_API_KEY is not set, so no tradie signup email was sent");
            return Response.json({ ok: true, emailed: false });
          }
          const link = async (path: string | undefined) => {
            if (!path) return null;
            const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
            return signed?.signedUrl ?? "(link could not be made, file is in tradie-docs)";
          };
          const insuranceUrl = await link(paths["insurance"]);
          const recordUrl = await link(paths["record"]);
          const tradeNames = data.trades.map((t) => TRADES.find(([k]) => k === t)?.[1] ?? t).join(", ");
          const source = [data.utm_source, data.utm_campaign, data.utm_content].filter(Boolean).join(" / ") || "direct";
          const lines = [
            `A tradie signed the HostFix tradie agreement (${AGREEMENT_VERSION}).`,
            ``,
            `Full name: ${data.full_name}`,
            `Business name: ${data.business_name ?? "not given"}`,
            `Mobile: ${data.phone}`,
            `Email: ${data.email}`,
            `NZBN: ${data.nzbn ?? "not given"}`,
            `GST registered: ${data.gst_registered ? `yes, ${data.gst_number}` : "no"}`,
            ``,
            `Trades: ${tradeNames}`,
            `Towns: ${data.towns}`,
            `Days: ${data.work_days.join(", ") || "not given"}`,
            ``,
            ...(data.licences.length ? data.licences.map((l) => `Licence (${l.trade}): ${l.number}, expires ${l.expiry}`) : ["Licences: none needed for the trades picked"]),
            `LBP number: ${data.lbp_number ?? "not given"}`,
            ``,
            `Insurer: ${data.insurer}`,
            `Policy number: ${data.policy_number}`,
            `Insurance expiry: ${data.insurance_expiry}`,
            `Certificate of currency (link works for 7 days): ${insuranceUrl}`,
            ``,
            `Criminal record: ${recordUrl ? `uploaded (link works for 7 days): ${recordUrl}` : "REQUESTED, will send before first job"}`,
            ``,
            `Existing clients: ${data.existing_clients ?? "none listed"}`,
            ``,
            `Signature: ${data.signature_name}`,
            `Signed: ${nzTime(new Date())} (NZ time)`,
            `Came from: ${source}`,
          ];
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `hostfix-tradie-signup-${id}` },
            body: JSON.stringify({
              from: LEAD_EMAIL_FROM,
              to: [LEAD_EMAIL_TO],
              reply_to: data.email,
              subject: `Tradie signed: ${data.full_name}, ${tradeNames} (${data.towns})`,
              text: lines.join("\n"),
            }),
          });
          if (!response.ok) {
            console.error(`Tradie signup email failed [${response.status}]`);
            return Response.json({ ok: true, emailed: false });
          }
          return Response.json({ ok: true, emailed: true });
        } catch {
          console.error("Tradie signup email failed");
          return Response.json({ ok: true, emailed: false });
        }
      },
    },
  },
});
