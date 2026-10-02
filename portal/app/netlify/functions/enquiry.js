// POST /api/enquiry  — website enquiry webhook.
// The partner's landing page posts the same payload it already emails:
//   headers: x-leadhive-key: <the partner's webhook key from Admin → Settings>
//   body:    { name, phone, suburb, issue, isUrgent, page }
// The enquiry lands in the partner's portal straight away.
const { serviceClient, json, readJson } = require("./_shared/supabase");

// best-effort rate limit per key (per function instance)
const hits = new Map();
function limited(key) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 30;
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const cors = (res) => ({ ...res, headers: { ...res.headers, "Access-Control-Allow-Origin": "*" } });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-leadhive-key", "Access-Control-Allow-Methods": "POST, OPTIONS" } };
  }
  if (event.httpMethod !== "POST") return cors(json(405, { error: "POST only" }));

  const key = clean(event.headers["x-leadhive-key"] || event.headers["X-Leadhive-Key"], 80);
  if (!key) return cors(json(401, { error: "Missing x-leadhive-key" }));
  if (limited(key)) return cors(json(429, { error: "Slow down" }));

  const body = readJson(event);
  if (!body) return cors(json(400, { error: "Bad JSON" }));
  const name = clean(body.name, 100), phone = clean(body.phone, 40), suburb = clean(body.suburb, 100), issue = clean(body.issue ?? body.message, 3000);
  if (!phone && !name) return cors(json(400, { error: "name or phone required" }));
  if (body.website) return cors(json(200, { ok: true })); // honeypot field from the landing pages

  const sb = serviceClient();
  const { data: secret } = await sb.from("client_secrets").select("client_id").eq("webhook_key", key).maybeSingle();
  if (!secret) return cors(json(401, { error: "Unknown key" }));

  const { data: client } = await sb.from("clients").select("id, active, timezone").eq("id", secret.client_id).maybeSingle();
  if (!client || !client.active) return cors(json(401, { error: "Partner inactive" }));

  const { error } = await sb.from("enquiries").insert({
    client_id: client.id,
    name, phone, suburb,
    message: issue,
    is_urgent: body.isUrgent === true || body.isUrgent === "true" || body.is_urgent === true,
    page: clean(body.page, 500) || null,
    source: "website",
  });
  if (error) {
    console.error("enquiry insert failed", error);
    return cors(json(500, { error: "Could not save enquiry" }));
  }
  return cors(json(200, { ok: true }));
};
