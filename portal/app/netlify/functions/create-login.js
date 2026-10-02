// POST /api/create-login  (admin only)
//   body: { client_id, email, password }
// Creates the partner's login (or resets the password if the login exists) and links it to the client.
const { serviceClient, requireAdmin, json, readJson } = require("./_shared/supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const admin = await requireAdmin(event);
  if (!admin) return json(401, { error: "Admin login required" });

  const body = readJson(event);
  if (!body) return json(400, { error: "Bad JSON" });
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const clientId = String(body.client_id || "");
  if (!email || !clientId) return json(400, { error: "email and client_id are required" });
  if (password && password.length < 6) return json(400, { error: "Password needs at least 6 characters" });

  const sb = serviceClient();
  const { data: client } = await sb.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return json(404, { error: "Partner not found" });

  // existing login? (profiles mirrors auth.users)
  const { data: existing } = await sb.from("profiles").select("id, role").eq("email", email).maybeSingle();
  let userId;
  if (existing) {
    userId = existing.id;
    if (password) {
      const { error } = await sb.auth.admin.updateUserById(userId, { password });
      if (error) return json(500, { error: "Could not set password: " + error.message });
    }
  } else {
    if (!password) return json(400, { error: "A password is needed to create a new login" });
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return json(500, { error: "Could not create login: " + error.message });
    userId = data.user.id;
  }

  // link the profile to the partner (never downgrade the admin account)
  const { data: prof } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!prof || prof.role !== "admin") {
    const { error } = await sb.from("profiles").upsert({ id: userId, email, role: "client", client_id: clientId });
    if (error) return json(500, { error: "Login created but could not link it: " + error.message });
  }
  return json(200, { ok: true, user_id: userId, created: !existing });
};
