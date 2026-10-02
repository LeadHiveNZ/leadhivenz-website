// Shared helpers for the Netlify functions.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the Netlify site's environment variables.
// The service role key never leaves the server.
const { createClient } = require("@supabase/supabase-js");

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in Netlify");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Returns the calling admin's user object, or null if the request is not from a logged-in admin.
async function requireAdmin(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const sb = serviceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return profile && profile.role === "admin" ? data.user : null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function readJson(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (e) {
    return null;
  }
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function monthLabel(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

module.exports = { serviceClient, requireAdmin, json, readJson, monthLabel };
