// POST /api/publish-email  (admin only)
//   body: { client_id, ym, leads, calls, enquiries, missed_rate, won_value }
// Emails the partner "Your {Month} results are in" via Resend (RESEND_API_KEY in Netlify env).
const { serviceClient, requireAdmin, json, readJson, monthLabel } = require("./_shared/supabase");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const admin = await requireAdmin(event);
  if (!admin) return json(401, { error: "Admin login required" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json(503, { error: "RESEND_API_KEY is not set in Netlify, so no email was sent (the month is still published)." });

  const body = readJson(event);
  if (!body || !body.client_id || !body.ym) return json(400, { error: "client_id and ym are required" });

  const sb = serviceClient();
  const { data: c } = await sb.from("clients").select("business_name, contact_name, email").eq("id", body.client_id).maybeSingle();
  if (!c || !c.email) return json(404, { error: "Partner has no email on file" });

  // The address Joe is using right now (he publishes from the portal), else PORTAL_URL, else Netlify's own site URL.
  const origin = /^https:\/\/[a-z0-9.-]+$/i.test(event.headers.origin || "") ? event.headers.origin : "";
  const portal = (origin || process.env.PORTAL_URL || process.env.URL || "").replace(/\/$/, "");
  const month = monthLabel(body.ym);
  const leads = Number(body.leads || 0), calls = Number(body.calls || 0), enq = Number(body.enquiries || 0);
  const missed = body.missed_rate != null ? `${Number(body.missed_rate)}% of calls missed` : "";
  const won = Number(body.won_value || 0);

  const text = [
    `Hey ${c.contact_name || ""},`,
    ``,
    `Your ${month} results are in the portal.`,
    ``,
    `${leads} leads (${calls} calls, ${enq} web enquiries)${missed ? ` · ${missed}` : ""}${won ? ` · $${won.toLocaleString("en-NZ")} in jobs you tagged won` : ""}`,
    ``,
    `Log in to see every call, the recordings and what I'm changing next: ${portal}`,
    ``,
    `Joe · LeadHive`,
  ].join("\n");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0F1A2E;max-width:560px">
      <img src="${esc(portal)}/logo-email.png" alt="LeadHive" width="120" style="display:block;width:120px;height:auto;margin:0 0 14px">
      <p>Hey ${esc(c.contact_name)},</p>
      <p>Your <strong>${esc(month)}</strong> results are in the portal.</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0">
        <tr><td style="padding:10px 16px;background:#0F1A2E;color:#fff;border-radius:12px 0 0 12px"><div style="font-size:11px;letter-spacing:.3px;opacity:.75">LEADS</div><div style="font-size:30px;font-weight:700">${leads}</div></td>
            <td style="padding:10px 16px;background:#F4F6FA"><div style="font-size:11px;color:#8A96A3">CALLS</div><div style="font-size:22px;font-weight:700">${calls}</div></td>
            <td style="padding:10px 16px;background:#F4F6FA;border-radius:0 12px 12px 0"><div style="font-size:11px;color:#8A96A3">WEB</div><div style="font-size:22px;font-weight:700">${enq}</div></td></tr>
      </table>
      ${missed ? `<p style="color:#4A5668">${esc(missed)}.</p>` : ""}
      ${won ? `<p style="color:#158A4F"><strong>$${won.toLocaleString("en-NZ")}</strong> in jobs you tagged won.</p>` : ""}
      <p><a href="${esc(portal)}" style="display:inline-block;background:#EFA41E;color:#0F1A2E;font-weight:700;padding:12px 18px;border-radius:12px;text-decoration:none">Open your portal</a></p>
      <p style="color:#4A5668">Every call, the recordings and what I'm changing next are in there.</p>
      <p>Joe · LeadHive</p>
    </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "LeadHive <onboarding@resend.dev>",
      to: [c.email],
      reply_to: process.env.REPLY_TO_EMAIL || "hello@leadhivenz.com",
      subject: `Your ${month} results are in`,
      text, html,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("Resend failed", r.status, t);
    return json(502, { error: `Email not sent (Resend ${r.status})` });
  }
  return json(200, { ok: true });
};
