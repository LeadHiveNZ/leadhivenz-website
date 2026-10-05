/* LeadHive Partner Portal — app
   Static, no build step. Data + logins via Supabase (supabase/schema.sql), server bits via Netlify functions.
   ?demo in the URL (or an empty config.js) runs on local demo data for sales calls. */
(function () {
"use strict";

/* ═══════════════════════════ config + mode ═══════════════════════════ */
const CFG = window.LEADHIVE_CONFIG || {};
const PARAMS = new URLSearchParams(location.search);
const CONFIGURED = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const DEMO = PARAMS.has("demo") || !CONFIGURED;
if (!DEMO && !window.supabase) { // the Supabase library didn't load: never fall back to demo data on the live site
  document.getElementById("app").innerHTML = '<div class="shell" style="padding-top:60px"><div class="card"><b>Couldn\'t load the portal</b><p class="lede" style="margin-top:8px">The connection dropped while loading. Check your signal and pull down to refresh.</p><button class="btn navy" style="margin-top:16px" onclick="location.reload()">Refresh</button></div></div>';
  throw new Error("supabase-js not loaded");
}
// Links in login messages, reset emails and the webhook address use the address the portal is open on,
// unless config.js pins one (portalUrl).
const PORTAL_URL = (CFG.portalUrl || location.origin).replace(/\/$/, "");
const JOE = Object.assign({ name: "Joe", phone: "", whatsapp: "", email: "hello@leadhivenz.com" }, CFG.joe || {});
const ADMIN_EMAIL = (CFG.adminEmail || "hello@leadhivenz.com").toLowerCase();
const LOGO = CFG.logo || "/logo.png", LOGO_SMALL = CFG.logoSmall || "/logo-small.png", LOGO_BEE = CFG.logoBee || "/logo-bee.png";
const emptyState = (title, body) => `<div class="empty"><img src="${LOGO_BEE}" alt=""><b>${title}</b>${body}</div>`;

/* ═══════════════════════════ utilities ═══════════════════════════ */
const $ = (id) => document.getElementById(id);
const NET_RE = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;
// Swap the browser's raw network error for plain words, but keep whatever came before it
// ("Saved · login not created: …") so the real step that failed stays visible.
const netMsg = (m) => {
  m = String(m || "Something went wrong");
  if (!NET_RE.test(m)) return m;
  const rest = m.replace(/(TypeError:\s*)?(failed to fetch|networkerror[^.]*|load failed|network request failed|fetch failed)\.?/gi, "").replace(/[\s:·-]+$/, "").trim();
  const tip = location.protocol === "http:" && !/^(localhost|127\.)/.test(location.hostname) ? " Open the https:// address and try again." : " Check your signal and try again.";
  return rest ? `${rest}: couldn't reach the server.${tip}` : `Can't reach the portal right now.${tip}`;
};
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const money = (n, dp = 0) => "$" + Number(n || 0).toLocaleString("en-NZ", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const dur = (s) => { s = Math.round(s || 0); const m = Math.floor(s / 60), r = s % 60; return m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`; };
const durShort = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const ymLabel = (ym, long = true) => { const [y, m] = String(ym).split("-").map(Number); return `${(long ? MONTHS : MON)[m - 1]} ${y}`; };
const ymAdd = (ym, n) => { let [y, m] = String(ym).split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; };
const daysIn = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// time zone aware formatting (TZ = the partner being viewed)
let TZ = "Pacific/Auckland";
const TZ_FOR = { NZ: "Pacific/Auckland", AU: "Australia/Sydney" };
const TZ_OPTIONS = ["Pacific/Auckland", "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth"];
function tzParts(d, tz = TZ) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const o = {}; for (const p of f.formatToParts(new Date(d))) if (p.type !== "literal") o[p.type] = p.value; if (o.hour === "24") o.hour = "00"; return o;
}
function tzOffsetMs(utcMs, tz) { const p = tzParts(utcMs, tz); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs; }
function zonedToUtc(y, m, d, hh, mi, ss, tz = TZ) { const guess = Date.UTC(y, m - 1, d, hh, mi, ss || 0); let utc = guess - tzOffsetMs(guess, tz); const off2 = tzOffsetMs(utc, tz); if (guess - off2 !== utc) utc = guess - off2; return new Date(utc); }
const ymOf = (d, tz = TZ) => { const p = tzParts(d, tz); return `${p.year}-${p.month}`; };
const ymdOf = (d, tz = TZ) => { const p = tzParts(d, tz); return `${p.year}-${p.month}-${p.day}`; };
const dayOf = (d) => +tzParts(d).day;
const weekOf = (d) => Math.min(5, Math.floor((dayOf(d) - 1) / 7) + 1);
const CUR_YM = () => ymOf(new Date());
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-NZ", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).toLowerCase().replace(/\s/g, "");
const fmtDay = (d) => { const t = new Date(); const td = ymdOf(t), yd = ymdOf(new Date(t.getTime() - 864e5)), x = ymdOf(d); if (x === td) return "Today"; if (x === yd) return "Yesterday"; return new Date(d).toLocaleDateString("en-NZ", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }); };
const fmtDT = (d) => `${fmtDay(d)}, ${fmtTime(d)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-NZ", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
// Calendar dates (YYYY-MM-DD: start date, last day) have no time of day, so never shift them into a timezone.
const fmtCal = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d || "")) ? new Date(String(d).slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-NZ", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "–");
function toast(m, bad) { const t = $("toast"); t.textContent = bad ? netMsg(m) : m; t.className = "toast on" + (bad ? " bad" : ""); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), bad ? 4000 : 2200); }
const copyText = (txt, okMsg) => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(okMsg || "Copied"), () => {
  try { const ta = document.createElement("textarea"); ta.value = txt; ta.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); toast(ok ? (okMsg || "Copied") : "Couldn't copy on this device", !ok); } catch (e) { toast("Couldn't copy on this device", true); }
});
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

const ICON = {
  phone: '<svg class="ico" viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.6.58 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.6 1 1 0 01-.25 1z"/></svg>',
  missed: '<svg class="ico" viewBox="0 0 24 24"><path d="M3.5 4.9l15.6 15.6 1.4-1.4-3.2-3.2 1.2-1.2a1 1 0 00.3-.7v-2.1a1 1 0 00-.9-1 13.6 13.6 0 00-4.2-.3L10.2 7.1a13.6 13.6 0 00-.3-2.2 1 1 0 00-1-.9H6.8a1 1 0 00-.7.3L4.9 5.5 3.5 4.9zm-1 3.2a15.4 15.4 0 0012.8 12.8l1.4-1.4A13.6 13.6 0 014 6.7L2.5 8.1z"/></svg>',
  form: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm2 4v2h12V7H6zm0 4v2h12v-2H6zm0 4v2h8v-2H6z"/></svg>',
  play: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>',
  pause: '<svg class="ico" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
  chev: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z"/></svg>',
  back: '<svg class="ico" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7 1.4-1.4L10.8 12l5.6-5.6z"/></svg>',
  home: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg>',
  leads: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z"/></svg>',
  report: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 20V10h3v10zm5.5 0V4h3v16zM16 20v-7h3v7z"/></svg>',
  cash: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 6h18v12H3zm2 2v8h14V8zm7 1.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/></svg>',
  grid: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
  user: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z"/></svg>',
  star: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2l3 6.3 7 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7-1z"/></svg>',
  quote: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 4h14a1 1 0 011 1v11a1 1 0 01-1 1H9l-5 4V5a1 1 0 011-1z"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24"><path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7l1.4-1.4L12 10.6l6.3-6.3z"/></svg>',
  ban: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 016.3 12.9L7.1 5.7A8 8 0 0112 4zm-6.3 3.1l11.2 11.2A8 8 0 015.7 7.1z"/></svg>',
  dot: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>',
  up: '<svg class="ico" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M12 5l7 7-1.4 1.4L13 8.8V19h-2V8.8l-4.6 4.6L5 12z"/></svg>',
  dn: '<svg class="ico" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M12 19l-7-7 1.4-1.4L11 15.2V5h2v10.2l4.6-4.6L19 12z"/></svg>',
  mark: '<svg viewBox="0 0 48 48" class="mk" aria-hidden="true"><path d="M24 3l18 10.5v21L24 45 6 34.5v-21z" fill="#EFA41E"/><path d="M24 11l11 6.5v13L24 37l-11-6.5v-13z" fill="#0F1A2E"/><path d="M24 18l5.5 3.25v6.5L24 31l-5.5-3.25v-6.5z" fill="#EFA41E"/></svg>',
  upload: '<svg class="ico" viewBox="0 0 24 24"><path d="M11 15V7.8L8.4 10.4 7 9l5-5 5 5-1.4 1.4L13 7.8V15zM5 18h14v2H5z"/></svg>',
  cog: '<svg class="ico" viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 000-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 00-1.7-1l-.4-2.7h-4l-.4 2.7a7.4 7.4 0 00-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 000 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 001.7 1l.4 2.7h4l.4-2.7a7.4 7.4 0 001.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>',
  out: '<svg class="ico" viewBox="0 0 24 24"><path d="M10 17l1.4-1.4L8.8 13H20v-2H8.8l2.6-2.6L10 7l-5 5zM4 3h8v2H6v14h6v2H4a1 1 0 01-1-1V4a1 1 0 011-1z"/></svg>',
  copy: '<svg class="ico" viewBox="0 0 24 24"><path d="M8 2h11a1 1 0 011 1v13h-2V4H8zM4 6h11a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm1 2v12h9V8z"/></svg>',
  dl: '<svg class="ico" viewBox="0 0 24 24"><path d="M11 3h2v9.2l2.6-2.6L17 11l-5 5-5-5 1.4-1.4L11 12.2zM5 18h14v2H5z"/></svg>',
};

/* ═══════════════════════════ demo audio (stand-in recording) ═══════════════════════════ */
let AUDIO_URL = null;
function demoRecording() {
  if (AUDIO_URL) return AUDIO_URL;
  const sr = 8000, secs = 12, n = sr * secs, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let s0 = 7; const r = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; }; let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; let s = 0;
    if (t < 2.4) { s = (t % 1.2) < 0.4 ? Math.sin(2 * Math.PI * 425 * t) * 0.35 : 0; }
    else { const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.9 * t + Math.sin(t * 3)); const f = 140 + 40 * Math.sin(t * 2.1); ph += (2 * Math.PI * f) / sr; s = (Math.sin(ph) * 0.5 + Math.sin(ph * 2) * 0.25 + (r() - 0.5) * 0.35) * env * 0.4; if (Math.floor(t * 2) % 3 === 2) s *= 0.15; }
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true); }
  AUDIO_URL = URL.createObjectURL(new Blob([buf], { type: "audio/wav" })); return AUDIO_URL;
}

/* ═══════════════════════════ API: Supabase ═══════════════════════════ */
function makeSupabaseApi() {
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message || String(error)); return data; };
  const num = (x) => (x == null ? 0 : Number(x));
  async function fn(name, body) {
    const { data } = await sb.auth.getSession();
    const r = await fetch("/api/" + name, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (data.session ? data.session.access_token : "") }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  }
  return {
    kind: "supabase",
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    onAuth(cb) { sb.auth.onAuthStateChange((ev, session) => cb(ev, session)); },
    async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signUp(email, password) { const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: PORTAL_URL } }); if (error) throw error; return data; },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: PORTAL_URL + "/?reset=1" }); if (error) throw error; },
    async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; },
    async me() {
      const { data } = await sb.auth.getUser(); const user = data && data.user; if (!user) return null;
      const p = await q(sb.from("profiles").select("id,email,role,client_id").eq("id", user.id).maybeSingle());
      return p || { id: user.id, email: user.email, role: "client", client_id: null };
    },
    async loadClients() { return q(sb.from("clients").select("*").order("business_name")); },
    async touchSeen() { try { await sb.rpc("touch_seen"); } catch (e) {} },
    async loadLastSeen() { const rows = await q(sb.from("profiles").select("client_id,last_seen_at").not("client_id", "is", null)); const m = {}; rows.forEach((r) => { if (r.last_seen_at && (!m[r.client_id] || r.last_seen_at > m[r.client_id])) m[r.client_id] = r.last_seen_at; }); return m; },
    async reactivateClient(cid) { await q(sb.from("clients").update({ active: true, churned_on: null, churn_reason: null, churn_note: "" }).eq("id", cid)); },
    async loadCounts() { const rows = await q(sb.from("v_lead_counts").select("*")); return rows.map((r) => ({ ...r, calls: num(r.calls), answered: num(r.answered), enquiries: num(r.enquiries), leads: num(r.leads), won: num(r.won), won_value: num(r.won_value) })); },
    async loadMonths(cid) {
      let mq = sb.from("months").select("*").order("ym"); let aq = sb.from("v_month_ad_spend").select("month_id, ad_spend");
      if (cid) { mq = mq.eq("client_id", cid); aq = aq.eq("client_id", cid); }
      const [months, ads] = await Promise.all([q(mq), q(aq)]);
      const adMap = {}; ads.forEach((a) => (adMap[a.month_id] = num(a.ad_spend)));
      return months.map((m) => ({ ...m, points: Array.isArray(m.points) ? m.points : [], ad_spend: adMap[m.id] }));
    },
    async loadClientData(cid) {
      const [months, calls, enquiries] = await Promise.all([
        this.loadMonths(cid),
        q(sb.from("calls").select("*").eq("client_id", cid).order("called_at", { ascending: false }).limit(3000)),
        q(sb.from("enquiries").select("*").eq("client_id", cid).order("received_at", { ascending: false }).limit(3000)),
      ]);
      return { months, calls: calls.map((c) => ({ ...c, job_value: num(c.job_value), duration_sec: num(c.duration_sec) })), enquiries: enquiries.map((e) => ({ ...e, job_value: num(e.job_value) })) };
    },
    async updateLead(kind, id, patch) { await q(sb.from(kind === "call" ? "calls" : "enquiries").update(patch).eq("id", id)); },
    async upsertClient(c) { const row = { ...c }; if (!row.id) delete row.id; return q(sb.from("clients").upsert(row).select().single()); },
    async updateClient(cid, patch) { return q(sb.from("clients").update(patch).eq("id", cid).select().single()); },
    async deleteClient(cid) {
      for (const bucket of ["recordings", "reports"]) { // best effort: their files live under <client id>/
        try { const { data } = await sb.storage.from(bucket).list(cid, { limit: 1000 }); const paths = (data || []).map((f) => `${cid}/${f.name}`); if (paths.length) await sb.storage.from(bucket).remove(paths); } catch (e) { console.warn("file cleanup", bucket, e); }
      }
      const rows = await q(sb.from("clients").delete().eq("id", cid).select("id"));
      if (!rows || !rows.length) throw new Error("Nothing was deleted. Are you logged in as the admin?");
    },
    async deactivateClient(cid, reason, note, day) { await q(sb.from("clients").update({ active: false, churned_on: day || new Date().toISOString().slice(0, 10), churn_reason: reason || null, churn_note: note || "" }).eq("id", cid)); },
    async getWebhookKey(cid) { const r = await q(sb.from("client_secrets").select("webhook_key").eq("client_id", cid).maybeSingle()); return r ? r.webhook_key : ""; },
    async regionHistory(cid) { const rows = await q(sb.rpc("region_history", { p_client: cid })); return (rows || []).map((r) => ({ ym: r.ym, leads: num(r.leads), calls: num(r.calls), answered: num(r.answered), enquiries: num(r.enquiries), est_value: num(r.est_value) })); },
    async transferWebhook(fromId, toId) { // the new partner takes the old partner's key, so the landing page keeps working untouched
      const old = await q(sb.from("client_secrets").select("webhook_key").eq("client_id", fromId).maybeSingle()); if (!old) return;
      await q(sb.from("client_secrets").delete().eq("client_id", toId));
      await q(sb.from("client_secrets").update({ client_id: toId }).eq("client_id", fromId));
      await q(sb.from("client_secrets").insert({ client_id: fromId })); // old partner gets a fresh, unused key
    },
    async upsertMonth(m) { return q(sb.from("months").upsert(m, { onConflict: "client_id,ym" }).select().single()); },
    async setAdSpend(month_id, ad_spend) { await q(sb.from("month_private").upsert({ month_id, ad_spend })); },
    async loadBilling() {
      const all = async (mk) => { const out = []; for (let from = 0; from < 200000; from += 1000) { const rows = await q(mk().range(from, from + 999)); out.push(...rows); if (rows.length < 1000) break; } return out; };
      const [payments, extensions, slots, days] = await Promise.all([q(sb.from("payments").select("*").order("month_no")), q(sb.from("extensions").select("*").order("created_at")), q(sb.from("slots").select("*").order("created_at")), all(() => sb.from("v_lead_days").select("client_id,day,leads").order("client_id").order("day"))]);
      return { payments: payments.map((x) => ({ ...x, amount: num(x.amount), month_no: num(x.month_no) })), extensions: extensions.map((x) => ({ ...x, days: num(x.days), month_no: num(x.month_no) })), slots, leadDays: days.map((d) => ({ ...d, leads: num(d.leads) })) };
    },
    async loadMyExtensions(cid) { return (await q(sb.from("extensions").select("*").eq("client_id", cid))).map((x) => ({ ...x, days: num(x.days), month_no: num(x.month_no) })); },
    async savePayments(rows) { return q(sb.from("payments").upsert(rows, { onConflict: "client_id,month_no" }).select()); },
    async deletePayment(id) { await q(sb.from("payments").delete().eq("id", id)); },
    async addExtension(x) { return q(sb.from("extensions").insert(x).select().single()); },
    async deleteExtension(id) { await q(sb.from("extensions").delete().eq("id", id)); },
    async saveSlot(x) { return q(sb.from("slots").upsert(x, { onConflict: "region,trade,country" }).select().single()); },
    async replaceMonthCalls(cid, ym, rows) { const n = await q(sb.rpc("replace_month_calls", { p_client: cid, p_ym: ym, p_rows: rows })); return { inserted: Number(n) || 0, updated: 0, replaced: true }; },
    async mergeMonthCalls(cid, ym, rows) { const r = await q(sb.rpc("merge_month_calls", { p_client: cid, p_ym: ym, p_rows: rows })); return { inserted: Number(r && r.inserted) || 0, updated: Number(r && r.updated) || 0 }; },
    async mergeEnquiries(cid, rows) { const r = await q(sb.rpc("merge_enquiries", { p_client: cid, p_rows: rows })); return { inserted: Number(r && r.inserted) || 0, updated: Number(r && r.updated) || 0 }; },
    async uploadPdf(cid, ym, file) { const path = `${cid}/${ym}.pdf`; const { error } = await sb.storage.from("reports").upload(path, file, { upsert: true, contentType: "application/pdf" }); if (error) throw error; return path; },
    async uploadRecording(cid, callId, file) { const ext = (file.name.split(".").pop() || "mp3").toLowerCase(); const path = `${cid}/${callId}.${ext}`; const { error } = await sb.storage.from("recordings").upload(path, file, { upsert: true, contentType: file.type || "audio/mpeg" }); if (error) throw error; return path; },
    async signedUrl(bucket, path) { const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600); if (error) throw error; return data.signedUrl; },
    createLogin: (client_id, email, password) => fn("create-login", { client_id, email, password }),
    publishEmail: (payload) => fn("publish-email", payload),
  };
}

/* ═══════════════════════════ API: demo (local data) ═══════════════════════════ */
function makeDemoApi() {
  const KEY = "lh-portal-demo-v2";
  let D = null; try { D = JSON.parse(lsGet(KEY)); } catch (e) {}
  if (!D || !D.clients) { D = window.LEADHIVE_DEMO.build(new Date()); persist(); }
  function persist() { lsSet(KEY, JSON.stringify(D)); }
  let session = null; try { session = JSON.parse(lsGet(KEY + ":s")); } catch (e) {}
  const listeners = [];
  const meSync = () => { if (!session) return null; const u = D.users.find((x) => x.id === session.user.id); return u ? { id: u.id, email: u.email, role: u.role, client_id: u.client_id } : null; };
  const visibleMonth = (me, m) => me.role === "admin" || (m.client_id === me.client_id && m.status === "published");
  return {
    kind: "demo",
    async session() { return session; },
    onAuth(cb) { listeners.push(cb); },
    async signIn(email, password) { await sleep(250); const u = D.users.find((x) => x.email === email.toLowerCase() && x.password === password); if (!u) throw new Error("Invalid login credentials"); session = { user: { id: u.id, email: u.email } }; lsSet(KEY + ":s", JSON.stringify(session)); },
    async signUp() { throw new Error("Sign-up is switched off in demo mode. Use the demo logins below."); },
    async signOut() { session = null; lsDel(KEY + ":s"); listeners.forEach((cb) => cb("SIGNED_OUT")); },
    async resetPassword() { await sleep(200); },
    async updatePassword() { await sleep(200); },
    async me() { return meSync(); },
    async loadClients() { const me = meSync(); return D.clients.filter((c) => me.role === "admin" || c.id === me.client_id).map((c) => ({ ...c })); },
    async loadCounts() {
      const me = meSync(); const map = {};
      const add = (x, kind) => { if (me.role !== "admin" && x.client_id !== me.client_id) return; const k = x.client_id + "|" + x.ym; const o = (map[k] ||= { client_id: x.client_id, ym: x.ym, calls: 0, answered: 0, enquiries: 0, leads: 0, won: 0, won_value: 0 }); if (kind === "call") { o.calls++; if (x.outcome === "answered") o.answered++; } else o.enquiries++; if (x.client_status !== "spam") o.leads++; if (x.client_status === "won") { o.won++; o.won_value += Number(x.job_value) || 0; } };
      D.calls.forEach((c) => add(c, "call")); D.enquiries.forEach((e) => add(e, "enq")); return Object.values(map);
    },
    async loadMonths(cid) { const me = meSync(); return D.months.filter((m) => (!cid || m.client_id === cid) && visibleMonth(me, m)).map((m) => { const c = D.clients.find((x) => x.id === m.client_id); return { ...m, points: m.points || [], ad_spend: me.role === "admin" || (c && c.show_ad_spend) ? m.ad_spend : undefined }; }); },
    async loadClientData(cid) { await sleep(120); const me = meSync(); if (me.role !== "admin" && cid !== me.client_id) throw new Error("Not allowed"); return { months: await this.loadMonths(cid), calls: D.calls.filter((c) => c.client_id === cid).map((c) => ({ ...c })).sort((a, b) => (a.called_at < b.called_at ? 1 : -1)), enquiries: D.enquiries.filter((e) => e.client_id === cid).map((e) => ({ ...e })).sort((a, b) => (a.received_at < b.received_at ? 1 : -1)) }; },
    async updateLead(kind, id, patch) { const x = (kind === "call" ? D.calls : D.enquiries).find((r) => r.id === id); if (!x) throw new Error("Lead not found"); const me = meSync(); if (me.role !== "admin") { const allowed = ["client_status", "job_value", "client_note"]; for (const k of Object.keys(patch)) if (!allowed.includes(k)) throw new Error("Partners can only change the lead outcome, job value and note"); if (["not_lead", "spam"].includes(patch.client_status) && patch.client_status !== x.client_status) throw new Error("Only LeadHive can mark a lead as not a lead or spam"); } Object.assign(x, patch); persist(); },
    async updateClient(cid, patch) { const row = D.clients.find((x) => x.id === cid); if (!row) throw new Error("Partner not found"); Object.assign(row, patch); persist(); return { ...row }; },
    async deleteClient(cid) { await sleep(200); const mids = D.months.filter((m) => m.client_id === cid).map((m) => m.id); D.clients = D.clients.filter((c) => c.id !== cid); D.calls = D.calls.filter((x) => x.client_id !== cid); D.enquiries = D.enquiries.filter((x) => x.client_id !== cid); D.months = D.months.filter((m) => !mids.includes(m.id)); delete D.secrets[cid]; D.clients.forEach((c) => { if (c.predecessor_id === cid) c.predecessor_id = null; }); D.users.forEach((u) => { if (u.client_id === cid) u.client_id = null; }); persist(); },
    async upsertClient(c) { let row = D.clients.find((x) => x.id === c.id); if (!row) { row = { active: true, ...c, id: c.id || uid() }; D.clients.push(row); D.secrets[row.id] = "lh_demo_" + (row.initials || "xx").toLowerCase() + "_" + uid().replace(/-/g, "").slice(0, 16); } else Object.assign(row, c); persist(); return { ...row }; },
    async deactivateClient(cid, reason, note, day) { const c = D.clients.find((x) => x.id === cid); if (c) { c.active = false; c.churned_on = day || new Date().toISOString().slice(0, 10); c.churn_reason = reason || null; c.churn_note = note || ""; } persist(); },
    async reactivateClient(cid) { const c = D.clients.find((x) => x.id === cid); if (c) { c.active = true; c.churned_on = null; c.churn_reason = null; c.churn_note = ""; } persist(); },
    async touchSeen() { const me = meSync(); if (me && me.client_id) { D.seen = D.seen || {}; D.seen[me.client_id] = new Date().toISOString(); persist(); } },
    async loadLastSeen() { const m = { ...(D.seen || {}) }; const days = (n) => new Date(Date.now() - n * 864e5).toISOString(); if (!m[D.clients[0].id]) m[D.clients[0].id] = days(2); if (D.clients[1] && !m[D.clients[1].id]) m[D.clients[1].id] = days(19); return m; },
    async getWebhookKey(cid) { return D.secrets[cid] || ""; },
    async transferWebhook(fromId, toId) { if (!D.secrets[fromId]) return; D.secrets[toId] = D.secrets[fromId]; D.secrets[fromId] = "lh_demo_" + uid().replace(/-/g, "").slice(0, 20); persist(); },
    async regionHistory(cid) {
      const me = meSync(); if (me.role !== "admin" && cid !== me.client_id) throw new Error("Not allowed");
      const preds = []; let cur = D.clients.find((c) => c.id === cid); let guard = 0;
      while (cur && cur.predecessor_id && guard++ < 6) { preds.push(cur.predecessor_id); cur = D.clients.find((c) => c.id === cur.predecessor_id); }
      if (!preds.length) return [];
      const map = {}; const cl = (id) => D.clients.find((c) => c.id === id) || {};
      const add = (x, kind) => { if (!preds.includes(x.client_id) || !x.ym) return; const o = (map[x.ym] ||= { ym: x.ym, leads: 0, calls: 0, answered: 0, enquiries: 0, est_value: 0 }); if (x.client_status !== "spam") o.leads++; if (kind === "call") { o.calls++; if (x.outcome === "answered") o.answered++; } else o.enquiries++; if (!["spam", "not_lead"].includes(x.client_status)) o.est_value += x.estimated_value != null ? Number(x.estimated_value) : Number(cl(x.client_id).avg_job_value) || 0; };
      D.calls.forEach((c) => add(c, "call")); D.enquiries.forEach((e) => add(e, "enq"));
      return Object.values(map).sort((a, b) => (a.ym < b.ym ? -1 : 1));
    },
    async upsertMonth(m) { let row = D.months.find((x) => x.client_id === m.client_id && x.ym === m.ym); if (!row) { row = { id: uid(), ad_spend: 0, pdf_path: null, published_at: null, ...m }; D.months.push(row); } else Object.assign(row, m); persist(); return { ...row }; },
    async setAdSpend(month_id, ad_spend) { const m = D.months.find((x) => x.id === month_id); if (m) m.ad_spend = ad_spend; persist(); },
    async loadBilling() {
      if (meSync().role !== "admin") throw new Error("admin only"); D.payments ||= []; D.extensions ||= []; D.slots ||= []; const days = {};
      const add = (cid, iso, spam) => { const c = D.clients.find((x) => x.id === cid); const k = cid + "|" + ymdOf(new Date(iso), (c && c.timezone) || "Pacific/Auckland"); days[k] = (days[k] || 0) + (spam ? 0 : 1); };
      D.calls.forEach((x) => add(x.client_id, x.called_at, x.client_status === "spam")); D.enquiries.forEach((x) => add(x.client_id, x.received_at, x.client_status === "spam"));
      return { payments: D.payments.map((x) => ({ ...x })), extensions: D.extensions.map((x) => ({ ...x })), slots: D.slots.map((x) => ({ ...x })), leadDays: Object.entries(days).map(([k, leads]) => { const [client_id, day] = k.split("|"); return { client_id, day, leads }; }) };
    },
    async loadMyExtensions(cid) { return (D.extensions || []).filter((x) => x.client_id === cid).map((x) => ({ ...x })); },
    async savePayments(rows) { D.payments ||= []; const out = rows.map((r) => { let x = D.payments.find((y) => y.client_id === r.client_id && y.month_no === r.month_no); if (!x) { x = { id: uid(), note: "", created_at: new Date().toISOString(), ...r }; D.payments.push(x); } else Object.assign(x, r); return { ...x }; }); persist(); return out; },
    async deletePayment(id) { D.payments = (D.payments || []).filter((x) => x.id !== id); persist(); },
    async addExtension(x) { D.extensions ||= []; const row = { id: uid(), reason: "", created_at: new Date().toISOString(), ...x }; D.extensions.push(row); persist(); return { ...row }; },
    async deleteExtension(id) { D.extensions = (D.extensions || []).filter((x) => x.id !== id); persist(); },
    async saveSlot(x) { D.slots ||= []; let row = D.slots.find((y) => y.region === x.region && y.trade === x.trade && y.country === x.country); if (!row) { row = { id: uid(), note: "", active: true, created_at: new Date().toISOString(), ...x }; D.slots.push(row); } else Object.assign(row, x); persist(); return { ...row }; },
    async replaceMonthCalls(cid, ym, rows) {
      const old = D.calls.filter((c) => c.client_id === cid && c.ym === ym); const digits = (s) => String(s || "").replace(/\D/g, "");
      D.calls = D.calls.filter((c) => !(c.client_id === cid && c.ym === ym));
      for (const r of rows) {
        const o = old.find((x) => (r.nimbata_call_id && x.nimbata_call_id === r.nimbata_call_id) || (Math.abs(new Date(x.called_at) - new Date(r.called_at)) < 120000 && digits(x.caller_number) === digits(r.caller_number)));
        D.calls.push({ id: uid(), client_id: cid, ym, recording_path: null, admin_note: "", estimated_value: null, ...r, client_status: o ? o.client_status : "new", job_value: o ? o.job_value : 0, client_note: o ? o.client_note : "" });
      }
      persist(); return { inserted: rows.length, updated: 0, replaced: true };
    },
    async mergeMonthCalls(cid, ym, rows) {
      const digits = (s) => String(s || "").replace(/\D/g, ""); let inserted = 0, updated = 0;
      for (const r of rows) {
        const o = D.calls.find((x) => x.client_id === cid && x.ym === ym && ((r.nimbata_call_id && x.nimbata_call_id === r.nimbata_call_id) || (Math.abs(new Date(x.called_at) - new Date(r.called_at)) < 120000 && digits(x.caller_number) === digits(r.caller_number))));
        if (o) { Object.assign(o, { duration_sec: r.duration_sec, outcome: r.outcome, keyword: r.keyword || o.keyword, campaign: r.campaign || o.campaign, city: r.city || o.city, recording_url: r.recording_url || o.recording_url, nimbata_call_id: o.nimbata_call_id || r.nimbata_call_id, admin_note: r.admin_note || o.admin_note, summary: r.summary || o.summary, estimated_value: r.estimated_value != null ? r.estimated_value : o.estimated_value }); updated++; }
        else { D.calls.push({ id: uid(), client_id: cid, ym, recording_path: null, admin_note: "", estimated_value: null, ...r, client_status: "new", job_value: 0, client_note: "" }); inserted++; }
      }
      persist(); return { inserted, updated };
    },
    async mergeEnquiries(cid, rows) {
      const digits = (s) => String(s || "").replace(/\D/g, ""); let inserted = 0, updated = 0; const c = D.clients.find((x) => x.id === cid);
      for (const r of rows) {
        const o = D.enquiries.find((x) => x.client_id === cid && digits(x.phone) === digits(r.phone) && Math.abs(new Date(x.received_at) - new Date(r.received_at)) < 600000);
        if (o) { Object.assign(o, { name: r.name || o.name, suburb: r.suburb || o.suburb, message: r.message || o.message, is_urgent: r.is_urgent || o.is_urgent, page: r.page || o.page }); updated++; }
        else { const p = window.LEADHIVE_DEMO.tzParts(new Date(r.received_at).getTime(), (c && c.timezone) || "Pacific/Auckland"); D.enquiries.push({ id: uid(), client_id: cid, ym: `${p.year}-${p.month}`, received_at: r.received_at, name: r.name || "", phone: r.phone || "", suburb: r.suburb || "", message: r.message || "", is_urgent: !!r.is_urgent, page: r.page || null, source: r.source || "website", estimated_value: r.estimated_value ?? null, client_status: "new", job_value: 0, client_note: "" }); inserted++; }
      }
      persist(); return { inserted, updated };
    },
    async uploadPdf(cid, ym) { await sleep(300); return `${cid}/${ym}.pdf`; },
    async uploadRecording(cid, callId) { await sleep(300); return `${cid}/${callId}.mp3`; },
    async signedUrl(bucket) { return bucket === "recordings" ? demoRecording() : "data:application/pdf;base64,JVBERi0xLjQKJSBkZW1vCg=="; },
    async createLogin(client_id, email, password) { await sleep(300); let u = D.users.find((x) => x.email === email.toLowerCase()); if (u) { if (password) u.password = password; u.client_id = client_id; } else { if (!password) throw new Error("A password is needed to create a new login"); D.users.push({ id: uid(), email: email.toLowerCase(), password, role: "client", client_id }); } persist(); return { ok: true }; },
    async publishEmail() { await sleep(300); return { ok: true, demo: true }; },
    resetDemo() { lsDel(KEY); D = window.LEADHIVE_DEMO.build(new Date()); persist(); },
  };
}

const api = DEMO ? makeDemoApi() : makeSupabaseApi();

/* ═══════════════════════════ cache + loaders ═══════════════════════════ */
const emptyBilling = () => ({ payments: [], extensions: [], slots: [], leadDays: [] });
const DB = { me: null, clients: [], months: [], calls: [], enquiries: [], counts: [], loaded: {}, keys: {}, seen: {}, history: {}, billing: emptyBilling(), billingErr: "" };
function resetDB() { DB.me = null; DB.clients = []; DB.months = []; DB.calls = []; DB.enquiries = []; DB.counts = []; DB.loaded = {}; DB.keys = {}; DB.seen = {}; DB.history = {}; DB.billing = emptyBilling(); DB.billingErr = ""; }
// payments, extensions, slots and leads per day; if the billing tables aren't in Supabase yet, the rest of the portal carries on
async function loadBilling() { try { DB.billing = await api.loadBilling(); DB.billingErr = ""; } catch (e) { DB.billing = emptyBilling(); DB.billingErr = (e && e.message) || String(e); } }
async function loadBase() {
  DB.me = await api.me();
  if (!DB.me) return;
  DB.clients = await api.loadClients();
  if (DB.me.role === "admin") { const [counts, months, seen] = await Promise.all([api.loadCounts(), api.loadMonths(), api.loadLastSeen().catch(() => ({})), loadBilling()]); DB.counts = counts; DB.months = months; DB.seen = seen; }
  else if (DB.me.client_id) { api.touchSeen(); DB.billing.extensions = await api.loadMyExtensions(DB.me.client_id).catch(() => []); }
}
async function ensureClient(cid, force) {
  if (!force && DB.loaded[cid]) return;
  const d = await api.loadClientData(cid);
  DB.months = DB.months.filter((m) => m.client_id !== cid).concat(d.months);
  DB.calls = DB.calls.filter((x) => x.client_id !== cid).concat(d.calls);
  DB.enquiries = DB.enquiries.filter((x) => x.client_id !== cid).concat(d.enquiries);
  const c = client(cid); DB.history[cid] = c && c.predecessor_id ? await api.regionHistory(cid).catch(() => []) : [];
  DB.loaded[cid] = true;
}
async function refreshAdmin() { if (DB.me && DB.me.role === "admin") { const [counts, months] = await Promise.all([api.loadCounts(), api.loadMonths(), loadBilling()]); DB.counts = counts; DB.months = months; } }
const client = (id) => DB.clients.find((c) => c.id === id);
const monthRec = (cid, ym) => DB.months.find((m) => m.client_id === cid && m.ym === ym);
const tzOf = (c) => (c && (c.timezone || TZ_FOR[c.country])) || "Pacific/Auckland";

/* ═══════════════════════════ stats ═══════════════════════════ */
function leadsFor(cid, ym) {
  const items = [...DB.calls.filter((x) => x.client_id === cid).map((x) => ({ ...x, kind: "call", at: x.called_at })), ...DB.enquiries.filter((x) => x.client_id === cid).map((x) => ({ ...x, kind: "enquiry", at: x.received_at }))];
  return items.filter((x) => !ym || x.ym === ym).sort((a, b) => (a.at < b.at ? 1 : -1));
}
const estimateFor = (x, c) => (x.estimated_value != null && x.estimated_value !== "" ? Number(x.estimated_value) : Number((c || {}).avg_job_value) || 0);
function findLead(id) { const c = DB.calls.find((x) => x.id === id); if (c) return { ...c, kind: "call", at: c.called_at }; const e = DB.enquiries.find((x) => x.id === id); return e ? { ...e, kind: "enquiry", at: e.received_at } : null; }
// A plain-English summary written from the month's numbers, used for backfilled reports.
// Facts the partner can act on; never ad spend or cost per lead.
// A report summary the portal wrote from the numbers (not by Joe) can be rewritten when the data changes.
const isAutoSummary = (t) => /^(No leads came through in [A-Z][a-z]+\.$|\d+ leads? in [A-Z][a-z]+: \d+ calls?\b)/.test(String(t || "").trim());
const keepReport = (m) => !!m && ((m.summary && !isAutoSummary(m.summary)) || (!m.summary && m.status === "published"));
function autoSummary(c, ym) {
  const st = monthStats(c, ym); const mon = MONTHS[+String(ym).split("-")[1] - 1]; const s = [];
  if (!st.leads) return `No leads came through in ${mon}.`;
  s.push(`${st.leads} lead${st.leads === 1 ? "" : "s"} in ${mon}: ${st.calls} call${st.calls === 1 ? "" : "s"}${st.enq ? ` and ${st.enq} web enquir${st.enq === 1 ? "y" : "ies"}` : ""}.`);
  if (st.calls) s.push(st.missed ? `${pct(st.answered, st.calls)}% of calls were answered. ${st.missed} went to voicemail or were missed, and calling those back fast is the easiest extra work there is.` : "Every call was answered, which is what turns leads into jobs.");
  const top = Math.max(0, ...(st.weeks || [])); if (top > 0 && st.weeks.filter((w) => w === top).length === 1) s.push(`The busiest week was week ${st.weeks.indexOf(top) + 1} with ${top} lead${top === 1 ? "" : "s"}.`);
  if (st.estTotal) s.push(`At your average job, that's about ${money(st.estTotal)} of work in these leads.`);
  return s.join(" ");
}
function monthStats(c, ym) {
  const cid = c.id;
  const calls = DB.calls.filter((x) => x.client_id === cid && x.ym === ym);
  const enq = DB.enquiries.filter((x) => x.client_id === cid && x.ym === ym);
  const all = [...calls, ...enq];
  const spam = all.filter((x) => x.client_status === "spam").length;
  const answered = calls.filter((x) => x.outcome === "answered");
  const missed = calls.filter((x) => x.outcome !== "answered");
  const leads = all.length - spam;
  const won = all.filter((x) => x.client_status === "won");
  const wonValue = won.reduce((a, x) => a + (Number(x.job_value) || 0), 0);
  const quoted = all.filter((x) => x.client_status === "quoted" || x.client_status === "ongoing").length; // "ongoing" in the UI
  const lost = all.filter((x) => x.client_status === "lost").length;
  const untagged = all.filter((x) => x.client_status === "new").length;
  const estTotal = all.filter((x) => x.client_status !== "spam" && x.client_status !== "not_lead").reduce((a, x) => a + estimateFor(x, c), 0);
  const nWeeks = Math.ceil(daysIn(ym) / 7); const weeks = new Array(nWeeks).fill(0);
  for (const x of all) if (x.client_status !== "spam") weeks[Math.min(nWeeks, weekOf(x.called_at || x.received_at)) - 1]++;
  const avgDur = answered.length ? answered.reduce((a, x) => a + (Number(x.duration_sec) || 0), 0) / answered.length : 0;
  const m = monthRec(cid, ym);
  const fee = Number(c.monthly_fee) || 0;
  return { ym, calls: calls.length, enq: enq.length, answered: answered.length, missed: missed.length, missedRate: pct(missed.length, calls.length), leads, won: won.length, wonValue, quoted, lost, untagged, estTotal, weeks, avgDur, spam,
    cplFee: leads ? fee / leads : 0, adSpend: m && m.ad_spend != null ? Number(m.ad_spend) : null, cplAd: m && m.ad_spend && leads ? Number(m.ad_spend) / leads : 0, month: m,
    target: leads >= c.lead_target_min ? (leads > c.lead_target_max ? "above" : "on") : "below" };
}
function clientMonths(cid) { // every month the partner has data for (published notes or not), newest first
  const set = new Set(DB.months.filter((m) => m.client_id === cid && m.status === "published").map((m) => m.ym));
  for (const x of DB.calls) if (x.client_id === cid && x.ym) set.add(x.ym); for (const x of DB.enquiries) if (x.client_id === cid && x.ym) set.add(x.ym);
  return [...set].sort().reverse();
}
const countFor = (cid, ym) => DB.counts.find((r) => r.client_id === cid && r.ym === ym) || { calls: 0, answered: 0, enquiries: 0, leads: 0, won: 0, won_value: 0 };

/* ═══════════════════════════ CSV import (Nimbata export) ═══════════════════════════ */
function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false; text = String(text).replace(/^﻿/, "");
  const sep = text.split("\n")[0].includes("\t") && !text.split("\n")[0].includes(",") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) { const ch = text[i], nx = text[i + 1];
    if (q) { if (ch === '"' && nx === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && nx === "\n") i++; row.push(cur); cur = ""; if (row.some((v) => v !== "")) rows.push(row); row = []; }
    else cur += ch; }
  row.push(cur); if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const COLS = {
  datetime: ["datetime", "calldatetime", "starttime", "callstart", "timestamp", "started", "date"],
  time: ["time", "calltime"],
  caller: ["caller", "callerid", "callernumber", "callerphone", "from", "fromnumber", "phone", "phonenumber", "customernumber"],
  duration: ["duration", "callduration", "talktime", "durationsec", "durationseconds", "length", "calllength"],
  outcome: ["outcome", "status", "callstatus", "disposition", "answered", "result", "callresult"],
  recording: ["recording", "recordingurl", "recordurl", "recordinglink", "audio", "audiourl", "recorded"],
  source: ["source", "sourcetype", "medium", "channel", "trafficsource"],
  campaign: ["campaign", "campaignname", "adcampaign"],
  keyword: ["keyword", "searchterm", "term", "searchkeyword"],
  city: ["city", "callercity", "location", "town"],
  callId: ["callid", "id", "uuid", "calluuid", "sid"],
  summary: ["summary", "aisummary", "callsummary", "aicallsummary", "conversationsummary", "transcriptsummary", "ainotes", "aidescription", "description"],
  notes: ["notes", "note", "comment", "comments", "agentnotes", "joesnote"],
  tracking: ["trackingnumber", "tracking", "dialednumber", "tonumber", "number"],
  value: ["value", "leadvalue", "estimatedvalue", "estimate", "jobvalue", "revenue", "amount"],
  direction: ["direction", "calldirection"],
  destName: ["destinationname", "forwardedtoname"],
  destination: ["destination", "destinationformatted", "destinationnumber", "forwardedto", "forwardto"],
};
function mapColumns(headers) {
  const nh = headers.map(norm); const map = {}; const used = new Set();
  for (const [field, aliases] of Object.entries(COLS)) {
    for (const a of aliases) { const ix = nh.findIndex((x, i) => x === a && !used.has(i)); if (ix >= 0) { map[field] = ix; used.add(ix); break; } }
    if (map[field] === undefined) for (const a of aliases) { const ix = nh.findIndex((x, i) => x.includes(a) && !used.has(i)); if (ix >= 0) { map[field] = ix; used.add(ix); break; } }
  }
  return map;
}
function parseDate(d, t) { // returns {date (UTC Date), ym} interpreting wall time in TZ
  d = String(d || "").trim(); t = String(t || "").trim(); if (!d) return null;
  const s = d + (t ? " " + t : "");
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ ,T]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap]m)?)?/i);
  if (m) { let [, dd, mm, yy, hh = "0", mi = "0", ss = "0", ap] = m; yy = yy.length === 2 ? "20" + yy : yy; hh = +hh; if (ap) { ap = ap.toLowerCase(); if (ap === "pm" && hh < 12) hh += 12; if (ap === "am" && hh === 12) hh = 0; }
    const date = zonedToUtc(+yy, +mm, +dd, hh, +mi, +ss); return isNaN(date) ? null : { date, ym: `${yy}-${pad(+mm)}` }; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?/);
  if (m) { const [, yy, mm, dd, hh = "0", mi = "0", ss = "0", zone] = m; const date = zone ? new Date(s) : zonedToUtc(+yy, +mm, +dd, +hh, +mi, +ss); return isNaN(date) ? null : { date, ym: zone ? ymOf(date) : `${yy}-${mm}` }; }
  const date = new Date(s); return isNaN(date) ? null : { date, ym: ymOf(date) };
}
function parseDuration(v) {
  v = String(v || "").trim().toLowerCase(); if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(+v);
  const hms = v.split(":").map(Number); if (hms.length >= 2 && hms.every((n) => !isNaN(n))) return hms.reduce((a, n) => a * 60 + n, 0);
  let s = 0; const mh = v.match(/(\d+)\s*h/), mm = v.match(/(\d+)\s*m/), ms = v.match(/(\d+)\s*s/); if (mh) s += +mh[1] * 3600; if (mm) s += +mm[1] * 60; if (ms) s += +ms[1]; return s;
}
function parseOutcome(v, durSec) {
  v = String(v || "").trim().toLowerCase().replace(/[_-]+/g, " "); // Nimbata writes NOT_ANSWERED
  if (/voicemail|\bvm\b/.test(v)) return "voicemail";
  if (/missed|no answer|noanswer|unanswered|busy|failed|abandon|not answered|ringout|no-answer/.test(v)) return "missed";
  if (/answer|complete|connect|success|yes|true/.test(v)) return "answered";
  return durSec >= 20 ? "answered" : "missed";
}
const ENQ_COLS = {
  datetime: ["datetime", "receivedat", "received", "date", "timestamp", "sent", "submitted"],
  time: ["time"],
  name: ["name", "fullname", "customer", "contact"],
  phone: ["phone", "mobile", "number", "tel", "telephone"],
  suburb: ["suburb", "area", "location", "city", "town"],
  message: ["message", "issue", "job", "details", "enquiry", "description", "notes"],
  urgent: ["urgent", "isurgent", "timing", "urgency", "priority"],
  page: ["page", "url", "source page", "landingpage"],
  value: ["value", "estimate", "estimatedvalue", "jobvalue"],
};
function mapEnqColumns(headers) {
  const nh = headers.map(norm); const map = {}; const used = new Set();
  for (const [field, aliases] of Object.entries(ENQ_COLS)) {
    for (const a of aliases) { const ix = nh.findIndex((x, i) => x === norm(a) && !used.has(i)); if (ix >= 0) { map[field] = ix; used.add(ix); break; } }
    if (map[field] === undefined) for (const a of aliases) { const ix = nh.findIndex((x, i) => x.includes(norm(a)) && !used.has(i)); if (ix >= 0) { map[field] = ix; used.add(ix); break; } }
  }
  return map;
}
function rowsToEnquiries(rows, map) {
  const out = []; const skipped = [];
  for (let i = 1; i < rows.length; i++) { const r = rows[i]; const g = (f) => (map[f] === undefined ? "" : String(r[map[f]] ?? "").trim());
    const dt = parseDate(g("datetime"), map.time !== undefined && map.time !== map.datetime ? g("time") : ""); if (!dt) { skipped.push(i + 1); continue; }
    const urg = g("urgent").toLowerCase(); const v = parseFloat(String(g("value")).replace(/[^0-9.]/g, ""));
    out.push({ received_at: dt.date.toISOString(), ym: dt.ym, name: g("name"), phone: g("phone"), suburb: g("suburb"), message: g("message").slice(0, 3000), is_urgent: /yes|true|1|urgent|asap|soon as possible|today/.test(urg), page: g("page") || null, source: "website", estimated_value: isFinite(v) && v > 0 ? v : null });
  }
  return { enquiries: out, skipped };
}
// Rows that aren't leads: Nimbata's blocked spam numbers, outbound calls, test calls from Joe's own phone,
// and calls that never rang through to anyone (no destination and not answered).
const blankish = (v) => !String(v ?? "").trim() || /^[-–—\s]+$/.test(String(v));
const JOE_DIGITS = String(JOE.phone || "").replace(/\D/g, "").slice(-9);
function callSkip(r, map) {
  const g = (f) => (map[f] === undefined ? "" : String(r[map[f]] ?? "").trim());
  if (/block|spam|reject/i.test(g("outcome"))) return "blocked";
  if (/^out/i.test(g("direction"))) return "outbound";
  if (JOE_DIGITS.length >= 8 && g("caller").replace(/\D/g, "").endsWith(JOE_DIGITS)) return "test";
  if ((map.destination !== undefined || map.destName !== undefined) && blankish(g("destination")) && blankish(g("destName")) && parseOutcome(g("outcome"), parseDuration(g("duration"))) !== "answered") return "noring";
  return "";
}
const SKIP_WORDS = { blocked: ["blocked spam call", "blocked spam calls"], outbound: ["outbound call", "outbound calls"], test: ["test call from you", "test calls from you"], noring: ["call that never rang through", "calls that never rang through"] };
const skipText = (left) => Object.entries(left || {}).filter(([, n]) => n).map(([k, n]) => `${n} ${SKIP_WORDS[k][n === 1 ? 0 : 1]}`).join(", ");
// Nimbata exports times in UTC (its busiest hour reads 22:00, which is 11am in NZ). Decide per file by asking which
// reading puts more calls in working hours; a Nimbata file is UTC unless its times clearly read as local already.
function timesLookUtc(rows, map, tz = TZ) {
  const isNimbata = (rows[0] || []).some((hd) => /^(trackingname|trackingnumformatted|destinationname|destinationformatted|timescalled|whohungup)$/.test(norm(hd)));
  const keep = TZ; let n = 0, asLocal = 0, asUtc = 0; const biz = (x) => x >= 7 && x <= 20;
  TZ = "UTC";
  try {
    for (let i = 1; i < rows.length && n < 500; i++) { const r = rows[i]; const g = (f) => (map[f] === undefined ? "" : String(r[map[f]] ?? "").trim());
      if (callSkip(r, map)) continue; if (/(Z|[+-]\d{2}:?\d{2})$/.test(g("datetime"))) return false;
      const dt = parseDate(g("datetime"), map.time !== undefined && map.time !== map.datetime ? g("time") : ""); if (!dt) continue;
      n++; if (biz(dt.date.getUTCHours())) asLocal++; if (biz(+tzParts(dt.date, tz).hour)) asUtc++; }
  } finally { TZ = keep; }
  return n >= 8 ? asUtc - asLocal > n * 0.15 || (isNimbata && asUtc >= asLocal) : isNimbata;
}
function rowsToCalls(rows, map, opts = {}) {
  const headers = rows[0]; const out = []; const skipped = []; const left = {}; const local = TZ;
  for (let i = 1; i < rows.length; i++) { const r = rows[i]; const g = (f) => (map[f] === undefined ? "" : String(r[map[f]] ?? "").trim());
    const why = callSkip(r, map); if (why) { left[why] = (left[why] || 0) + 1; continue; }
    const when = [g("datetime"), map.time !== undefined && map.time !== map.datetime ? g("time") : ""];
    let dt; if (opts.utc) { TZ = "UTC"; try { dt = parseDate(...when); } finally { TZ = local; } if (dt) dt = { date: dt.date, ym: ymOf(dt.date, local) }; } else dt = parseDate(...when);
    if (!dt) { skipped.push(i + 1); continue; }
    const duration_sec = parseDuration(g("duration")); const rec = g("recording");
    const raw = {}; headers.forEach((hd, ix) => { if (hd && r[ix] !== undefined && r[ix] !== "") raw[hd] = r[ix]; }); raw._tz = opts.utc ? "utc" : "local";
    out.push({ called_at: dt.date.toISOString(), ym: dt.ym, caller_number: g("caller") || "Unknown", duration_sec, outcome: parseOutcome(g("outcome"), duration_sec), tracking_number: g("tracking") || null, source: g("source") || "Google Ads", campaign: g("campaign") || null, keyword: g("keyword") || null, city: g("city") || null, recording_url: /^https?:/i.test(rec) ? rec : null, nimbata_call_id: g("callId") || null, admin_note: g("notes") || "", summary: g("summary").replace(/\s+/g, " ").slice(0, 700), estimated_value: (() => { const v = parseFloat(String(g("value")).replace(/[^0-9.]/g, "")); return isFinite(v) && v > 0 ? v : null; })(), raw });
  }
  return { calls: out, skipped, left };
}
function importSummary(calls) {
  const ans = calls.filter((c) => c.outcome === "answered"); const byYm = {}; for (const c of calls) byYm[c.ym] = (byYm[c.ym] || 0) + 1;
  return { n: calls.length, answered: ans.length, missed: calls.length - ans.length, avg: ans.length ? ans.reduce((a, c) => a + c.duration_sec, 0) / ans.length : 0, recordings: calls.filter((c) => c.recording_url).length, byYm };
}
const SAMPLE_CSV = `Date,Time,Caller,Call Duration,Outcome,Tracking Number,Source,Campaign,Keyword,City,Recording,Call ID,Value,Summary
01/{M}/{Y},08:14 AM,021 555 3391,2:41,Answered,09 801 2201,Google Ads,AKL Plumber · Search,emergency plumber auckland,Mt Eden,https://app.nimbata.com/rec/abc123,c-1001,350,"Caller has a blocked kitchen drain, water backing up into the sink. Wants someone today. Agreed to a visit this afternoon, callout fee explained."
01/{M}/{Y},12:52 PM,027 112 9087,0:00,Missed,09 801 2201,Google Ads,AKL Plumber · Search,plumber near me,Howick,,c-1002,,
02/{M}/{Y},09:05 AM,022 440 1178,4:12,Answered,09 801 2201,Google Ads,AKL Plumber · Search,hot water cylinder repair,Takapuna,https://app.nimbata.com/rec/abc124,c-1003,1800,"Hot water cylinder leaking from the base, no hot water since this morning. Landlord calling for a tenant. Asked for a replacement quote, booked an inspection tomorrow 9am."
03/{M}/{Y},16:30,021 760 0042,1:08,Answered,09 801 2201,Google Ads,AKL Plumber · Search,leaking tap repair,Remuera,,c-1004,180,"Dripping kitchen mixer tap. Not urgent, happy to wait for next week. Address and best time taken."
04/{M}/{Y},13:10,027 555 2210,0:00,No answer,09 801 2201,Google Ads,AKL Plumber · Search,burst pipe plumber,Papakura,,c-1005,,`;

/* ═══════════════════════════ charts ═══════════════════════════ */
function columnChart({ labels, values, highlight = -1, gold = [], faint = [], height = 150, valueFmt = (v) => v, tipFmt }) {
  const W = 360, H = height, padL = 6, padR = 6, padT = 18, padB = 24; const n = values.length || 1; const max = Math.max(1, ...values);
  const niceMax = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10; return s * p; })();
  const slot = (W - padL - padR) / n; const bw = Math.min(24, slot * 0.6); const y = (v) => padT + (H - padT - padB) * (1 - v / niceMax);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Column chart">`;
  for (const g of [0, 0.5, 1]) { const yy = y(niceMax * g); s += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>`; if (g > 0) s += `<text class="t" x="${W - padR}" y="${(yy - 3).toFixed(1)}" text-anchor="end">${valueFmt(niceMax * g)}</text>`; }
  values.forEach((v, i) => { const x = padL + slot * i + (slot - bw) / 2; const top = y(v); const hgt = Math.max(0, H - padB - top);
    const fill = gold.includes(i) ? "var(--gold)" : i === highlight ? "var(--blue)" : faint.includes(i) ? "#E6EBF1" : "#C7D3DF"; const tipText = tipFmt ? tipFmt(i) : `${labels[i]}: ${valueFmt(v)}`;
    s += `<rect class="hit" x="${(padL + slot * i).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${H - padT - padB}" data-tip="${h(tipText)}" tabindex="0"/>`;
    if (hgt > 0) s += `<path d="M${x.toFixed(1)},${(H - padB).toFixed(1)} v${(-hgt + 4).toFixed(1)} a4,4 0 0 1 4,-4 h${(bw - 8).toFixed(1)} a4,4 0 0 1 4,4 v${(hgt - 4).toFixed(1)} z" style="fill:${fill};pointer-events:none"/>`;
    if (i === highlight || gold.includes(i) || n <= 6) s += `<text class="v" x="${(x + bw / 2).toFixed(1)}" y="${(top - 5).toFixed(1)}" text-anchor="middle">${valueFmt(v)}</text>`;
    s += `<text class="t" x="${(x + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle">${h(labels[i])}</text>`; });
  return s + "</svg>";
}
function bindTips(root) {
  const tip = $("tip");
  root.querySelectorAll(".hit").forEach((el) => {
    const show = () => { tip.textContent = el.dataset.tip; tip.classList.remove("hidden"); const r = el.getBoundingClientRect(); tip.style.left = r.left + r.width / 2 + "px"; tip.style.top = r.top + 8 + "px"; };
    const hide = () => tip.classList.add("hidden");
    el.addEventListener("pointerenter", show); el.addEventListener("pointermove", show); el.addEventListener("pointerleave", hide); el.addEventListener("focus", show); el.addEventListener("blur", hide);
  });
}

/* ═══════════════════════════ router ═══════════════════════════ */
function go(path) { location.hash = "#" + path; }
let routeToken = 0;
const app = () => $("app");
function skeleton() { app().innerHTML = `<div class="shell" style="padding-top:40px"><div class="skel" style="height:58px"></div><div class="skel" style="height:220px;margin-top:16px"></div><div class="skel" style="height:120px;margin-top:12px"></div></div>`; }
function hideTabs() { document.body.classList.remove("has-tabs"); $("tabs").classList.add("hidden"); }
function topBar({ title, sub, back, right, brand }) {
  const demo = DEMO ? `<div class="banner">Demo data${CONFIGURED ? "" : " · add your Supabase keys to config.js to go live"}${DEMO && CONFIGURED ? ` · <a href="${h(location.pathname)}">leave demo</a>` : ""}</div>` : "";
  return `<div class="top"><div class="top-in">${back ? `<a class="back" href="#${back}" aria-label="Back">${ICON.back}</a>` : ""}${brand ? `<div class="brand"><img class="logo" src="${LOGO_BEE}" alt=""><span class="nm">Lead<span>Hive</span></span></div>` : `<div class="ttl">${title}${sub ? `<small>${sub}</small>` : ""}</div>`}${right || ""}</div>${demo}</div>`;
}
async function route() {
  const token = ++routeToken;
  const hash = location.hash.replace(/^#/, "") || "/";
  if (/access_token=|refresh_token=|error_description=/.test(hash)) { skeleton(); return; } // Supabase is consuming a magic/recovery link
  const parts = hash.split("/").filter(Boolean);
  window.scrollTo(0, 0);
  try {
    const session = await api.session();
    if (token !== routeToken) return;
    if (!session) { hideTabs(); resetDB(); if (parts[0] === "signup") return renderSignup(); if (parts[0] === "reset") return renderLogin("Open the reset link from your email first, then set your new password."); return renderLogin(); }
    if (parts[0] === "reset") { hideTabs(); return renderReset(); }
    if (!DB.me) { skeleton(); await loadBase(); if (token !== routeToken) return; }
    if (!DB.me) { hideTabs(); return renderLogin("Couldn't load your account. Try again."); }
    const isAdmin = DB.me.role === "admin";
    const seg = parts[0] || (isAdmin ? "admin" : "home");
    let cid = DB.me.client_id, page, args;
    if (seg === "admin") { if (!isAdmin) return go("/home"); page = parts[1] || "admin"; args = parts.slice(2); }
    else if (seg === "as" && isAdmin) { cid = parts[1]; page = parts[2] || "home"; args = parts.slice(3); }
    else { page = seg; args = parts.slice(1); }
    const ctx = { user: DB.me, cid, isAdmin, viewAs: seg === "as", args, base: seg === "as" ? `/as/${cid}` : "" };
    const adminPages = { admin: renderAdmin, client: renderAdminClient, upload: renderUpload, settings: renderSettings, newclient: renderSettings, bulk: renderBulk, import: renderImport, billing: renderBilling, slots: renderSlots };
    const clientPages = { home: renderHome, leads: renderLeads, lead: renderLead, reports: renderReports, report: renderReport, account: renderAccount };
    if (seg === "admin") { renderTabs(ctx, page); const fn = adminPages[page] || renderAdmin; if (page === "client" || page === "upload" || page === "settings") { const target = args[0]; if (target && client(target)) { skeleton(); await ensureClient(target); if (token !== routeToken) return; } } return fn(ctx); }
    if (!cid || !client(cid)) { hideTabs(); if (isAdmin) return go("/admin"); return renderNoPortal(); }
    ctx.client = client(cid); TZ = tzOf(ctx.client);
    if (!ctx.client.active && !isAdmin) { hideTabs(); return renderPaused(ctx.client); }
    if (!DB.loaded[cid]) { skeleton(); await ensureClient(cid); if (token !== routeToken) return; }
    renderTabs(ctx, page);
    return (clientPages[page] || renderHome)(ctx);
  } catch (e) {
    console.error(e); hideTabs();
    app().innerHTML = `<div class="shell" style="padding-top:60px"><div class="card"><b>Something went wrong</b><p class="lede mt8">${h(netMsg(e && e.message ? e.message : e))}</p><button class="btn navy mt16" id="retry">Try again</button><button class="btn ghost mt12" id="out">Log out</button></div></div>`;
    $("retry").onclick = () => route(); $("out").onclick = async () => { await api.signOut(); resetDB(); go("/"); route(); };
  }
}
function renderTabs(ctx, page) {
  const t = $("tabs"), inn = $("tabs-in"); document.body.classList.add("has-tabs"); t.classList.remove("hidden");
  if (!ctx.cid || ["admin", "client", "upload", "settings", "newclient", "billing", "slots", "bulk", "import"].includes(page) && !ctx.viewAs) {
    inn.innerHTML = `<a href="#/admin" class="${page === "admin" || page === "client" ? "on" : ""}">${ICON.user}Partners</a><a href="#/admin/billing" class="${page === "billing" ? "on" : ""}">${ICON.cash}Billing</a><a href="#/admin/slots" class="${page === "slots" ? "on" : ""}">${ICON.grid}Slots</a><a href="#/admin/upload" class="${page === "upload" ? "on" : ""}">${ICON.upload}Upload</a><a href="#" data-logout>${ICON.out}Log out</a>`;
  } else {
    const b = ctx.base; const unread = leadsFor(ctx.cid, CUR_YM()).filter((x) => x.client_status === "new").length;
    inn.innerHTML = `<a href="#${b}/home" class="${page === "home" ? "on" : ""}">${ICON.home}Home</a><a href="#${b}/leads" class="${page === "leads" || page === "lead" ? "on" : ""}">${ICON.leads}Leads${unread ? `<span class="bdg">${unread}</span>` : ""}</a><a href="#${b}/reports" class="${page === "reports" || page === "report" ? "on" : ""}">${ICON.report}Reports</a><a href="#${b}/account" class="${page === "account" ? "on" : ""}">${ICON.user}${ctx.viewAs ? "Admin" : "Account"}</a>`;
  }
  inn.querySelectorAll("[data-logout]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); await api.signOut(); resetDB(); go("/"); route(); }));
}

/* ═══════════════════════════ screens: auth ═══════════════════════════ */
function loginShell(inner) {
  return `<div class="login"><div class="hd"><img class="logo" src="${LOGO}" alt="LeadHive"><p>Partner portal</p></div><div class="pane"><div>${inner}</div></div></div>`;
}
function renderLogin(notice) {
  app().innerHTML = loginShell(`<h2>Log in</h2><p class="lede mt8">Your leads, calls, recordings and monthly results, all in one place.</p>
    ${notice ? `<p class="ok">${h(notice)}</p>` : ""}
    <form id="login-f"><label class="fld"><span>Email</span><input id="l-email" type="email" autocomplete="username" inputmode="email" required></label>
    <label class="fld"><span>Password</span><input id="l-pass" type="password" autocomplete="current-password" required></label>
    <div class="err hidden" id="l-err"></div>
    <button class="btn primary mt20" type="submit" id="l-btn">Log in</button>
    <p class="small muted mt12 center">Forgot your password? <a href="#" id="l-forgot" class="lnk">Send me a reset link</a></p>
    <p class="small muted mt8 center">First time here? <a href="#/signup" class="lnk">Set up your login</a></p></form>
    ${DEMO ? `<div class="demo"><b>Demo logins</b><br>Partner: <code>mike@mikesplumbing.co.nz</code> / <code>demo</code><br>Admin: <code>hello@leadhivenz.com</code> / <code>admin</code></div>` : `<div class="demo">Trouble logging in? Text ${h(JOE.name)}${JOE.phone ? ` on <a href="tel:${h(JOE.phone.replace(/\s/g, ""))}" class="lnk">${h(JOE.phone)}</a>` : ""}.</div>`}`);
  const err = $("l-err");
  $("login-f").onsubmit = async (e) => { e.preventDefault(); err.classList.add("hidden"); $("l-btn").setAttribute("disabled", ""); $("l-btn").textContent = "Logging in…";
    try { await api.signIn($("l-email").value.trim().toLowerCase(), $("l-pass").value); resetDB(); go("/"); await route(); }
    catch (ex) { err.textContent = /invalid/i.test(ex.message) ? "That email or password isn't right." : netMsg(ex.message); err.classList.remove("hidden"); $("l-btn").removeAttribute("disabled"); $("l-btn").textContent = "Log in"; } };
  $("l-forgot").onclick = async (e) => { e.preventDefault(); const em = $("l-email").value.trim().toLowerCase(); if (!em) { err.textContent = "Type your email first, then tap the reset link."; err.classList.remove("hidden"); $("l-email").focus(); return; }
    try { await api.resetPassword(em); toast("Reset link sent. Check your email."); } catch (ex) { toast(ex.message, true); } };
}
function renderSignup() {
  app().innerHTML = loginShell(`<h2>Set up your login</h2><p class="lede mt8">Use the email ${h(JOE.name)} has for your business. If it matches, your portal is waiting.</p>
    <form id="su-f"><label class="fld"><span>Email</span><input id="su-email" type="email" autocomplete="username" inputmode="email" required></label>
    <label class="fld"><span>Choose a password</span><input id="su-pass" type="password" autocomplete="new-password" minlength="6" required></label>
    <label class="fld"><span>Password again</span><input id="su-pass2" type="password" autocomplete="new-password" minlength="6" required></label>
    <div class="err hidden" id="su-err"></div>
    <button class="btn primary mt20" type="submit" id="su-btn">Create login</button>
    <p class="small muted mt12 center"><a href="#/" class="lnk">Back to log in</a></p></form>`);
  const err = $("su-err");
  $("su-f").onsubmit = async (e) => { e.preventDefault(); err.classList.add("hidden"); const p1 = $("su-pass").value, p2 = $("su-pass2").value; if (p1 !== p2) { err.textContent = "Those passwords don't match."; err.classList.remove("hidden"); return; }
    $("su-btn").setAttribute("disabled", "");
    try { const data = await api.signUp($("su-email").value.trim().toLowerCase(), p1); if (data && data.session) { resetDB(); go("/"); await route(); } else { app().innerHTML = loginShell(`<h2>Check your email</h2><p class="lede mt8">We sent a confirmation link. Tap it, then come back and log in.</p><a class="btn navy mt20" href="#/">Back to log in</a>`); } }
    catch (ex) { err.textContent = netMsg(ex.message); err.classList.remove("hidden"); $("su-btn").removeAttribute("disabled"); } };
}
function renderReset() {
  app().innerHTML = loginShell(`<h2>Set a new password</h2>
    <form id="rs-f"><label class="fld"><span>New password</span><input id="rs-pass" type="password" autocomplete="new-password" minlength="6" required></label>
    <label class="fld"><span>Again</span><input id="rs-pass2" type="password" autocomplete="new-password" minlength="6" required></label>
    <div class="err hidden" id="rs-err"></div><button class="btn primary mt20" type="submit">Save password</button></form>`);
  $("rs-f").onsubmit = async (e) => { e.preventDefault(); const err = $("rs-err"); err.classList.add("hidden"); if ($("rs-pass").value !== $("rs-pass2").value) { err.textContent = "Those passwords don't match."; err.classList.remove("hidden"); return; }
    try { await api.updatePassword($("rs-pass").value); toast("Password saved"); resetDB(); go("/"); await route(); } catch (ex) { err.textContent = netMsg(ex.message); err.classList.remove("hidden"); } };
}
function renderPaused(c) {
  app().innerHTML = loginShell(`<h2>Your portal is paused</h2><p class="lede mt8">${h(c.business_name)} isn't running with LeadHive right now, so the portal is switched off. Your calls, recordings and results are all kept, and it's one message to ${h(JOE.name)} to switch it back on.</p>
    ${JOE.phone ? `<a class="btn navy mt20" href="sms:${h(JOE.phone.replace(/\s/g, ""))}">Text ${h(JOE.name)}</a>` : ""}<button class="btn ghost mt12" id="np-out">Log out</button>`);
  $("np-out").onclick = async () => { await api.signOut(); resetDB(); go("/"); route(); };
}
function renderNoPortal() {
  app().innerHTML = loginShell(`<h2>No portal set up for this email yet</h2><p class="lede mt8">You're logged in as <b>${h(DB.me.email)}</b>, but there's no LeadHive partner linked to it. Text ${h(JOE.name)} and he'll sort it in a minute.</p>
    ${JOE.phone ? `<a class="btn navy mt20" href="sms:${h(JOE.phone.replace(/\s/g, ""))}">Text ${h(JOE.name)}</a>` : ""}<button class="btn ghost mt12" id="np-out">Log out</button>`);
  $("np-out").onclick = async () => { await api.signOut(); resetDB(); go("/"); route(); };
}

/* ═══════════════════════════ screens: partner ═══════════════════════════ */
const targetChip = (st) => st.target === "on" ? `<span class="chip good"><i></i>On target</span>` : st.target === "above" ? `<span class="chip good"><i></i>Above target</span>` : `<span class="chip warn"><i></i>Below target</span>`;
function statusChip(x) { const m = { won: ["good", "Job won"], lost: ["", "Lost"], ongoing: ["blue", "Ongoing"], quoted: ["blue", "Ongoing"], not_lead: ["", "Not a lead"], spam: ["", "Spam"] }; if (!m[x.client_status]) return ""; const [cls, l] = m[x.client_status]; return `<span class="chip ${cls}">${l}${x.client_status === "won" && x.job_value ? ` · ${money(x.job_value)}` : ""}</span>`; }
function leadRow(x, base, c) {
  const isCall = x.kind === "call"; const missed = isCall && x.outcome !== "answered"; const ic = isCall ? (missed ? "miss" : "") : "form";
  const isOngoing = x.client_status === "ongoing" || x.client_status === "quoted";
  const canTag = c && (x.client_status === "new" || isOngoing);
  const est = c ? estimateFor(x, c) : 0;
  const t1 = isCall ? x.caller_number : x.name || x.phone;
  const t2 = isCall ? (missed ? `${x.outcome === "voicemail" ? "Voicemail" : "Missed call"} · ${x.keyword || x.city || "Google Ads"}` : x.summary || x.admin_note || x.keyword || x.city || "Google Ads call") : `${x.is_urgent ? "Urgent · " : ""}${x.suburb ? x.suburb + " · " : ""}${x.message}`;
  const hasRec = isCall && (x.recording_url || x.recording_path);
  const row = `<a class="li" href="#${base}/lead/${x.id}"><div class="ic ${ic}">${isCall ? (missed ? ICON.missed : ICON.phone) : ICON.form}</div><div class="grow"><div class="t1"><span>${h(t1)}</span></div><div class="t2">${x.client_status !== "new" ? statusChip(x) : ""}<span class="tx">${h(t2)}</span></div></div><div class="meta"><div class="tm">${fmtTime(x.at)}</div><div class="du">${isCall ? (missed ? "" : durShort(x.duration_sec)) : "Web form"}</div></div>${hasRec ? `<span class="play">${ICON.play}</span>` : `<span class="chev">${ICON.chev}</span>`}</a>`;
  if (!canTag) return `<div class="lw">${row}</div>`;
  return `<div class="lw">${row}<div class="tagstrip" data-id="${x.id}" data-kind="${x.kind}" data-est="${est}"><span class="est">${est ? `Est. ${money(est)}` : "Did you get it?"}</span><button class="tg won" data-act="won">Won</button><button class="tg lost" data-act="lost">Lost</button>${isOngoing ? "" : `<button class="tg ongoing" data-act="ongoing">Ongoing</button>`}
    <div class="valrow hidden"><span class="cur">$</span><input type="number" inputmode="decimal" min="0" step="10" value="${est || ""}" aria-label="Job value" placeholder="job value"><button class="tg save" data-act="save">Save</button><button class="tg cancel" data-act="cancel" aria-label="Cancel">${ICON.x}</button><span class="hint">Your real number, ex GST. Rough is fine.</span></div></div></div>`;
}
// one handler per list: Won → value box (prefilled with the estimate) → Save; Lost saves straight away
function bindTagStrips(root, afterSave) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return; const strip = btn.closest(".tagstrip"); if (!strip) return;
    e.preventDefault(); const act = btn.dataset.act; const val = strip.querySelector(".valrow"); const input = strip.querySelector("input");
    const mainBtns = strip.querySelectorAll(".tg.won, .tg.lost, .tg.ongoing");
    if (act === "won") { val.classList.remove("hidden"); mainBtns.forEach((b) => b.classList.add("hidden")); input.focus(); input.select(); return; }
    if (act === "cancel") { val.classList.add("hidden"); mainBtns.forEach((b) => b.classList.remove("hidden")); return; }
    const kind = strip.dataset.kind, id = strip.dataset.id;
    const patch = act === "save" ? { client_status: "won", job_value: Math.max(0, Number(input.value) || 0) } : act === "ongoing" ? { client_status: "ongoing", job_value: 0 } : { client_status: "lost", job_value: 0 };
    strip.querySelectorAll("button").forEach((b) => b.setAttribute("disabled", ""));
    try { await api.updateLead(kind, id, patch); const rec = kind === "call" ? DB.calls.find((r) => r.id === id) : DB.enquiries.find((r) => r.id === id); if (rec) Object.assign(rec, patch);
      toast(act === "save" ? `Nice one. ${money(patch.job_value)} won.` : act === "ongoing" ? "Marked ongoing. Come back when it lands." : "Tagged as lost"); afterSave && afterSave(); }
    catch (ex) { toast(ex.message, true); strip.querySelectorAll("button").forEach((b) => b.removeAttribute("disabled")); }
  });
}
async function rerenderKeepScroll() { const y = window.scrollY; await route(); window.scrollTo(0, y); }
function monthSelect(id, months, ym, live) { const cur = CUR_YM(); return `<select id="${id}" aria-label="Month">${months.map((m) => `<option value="${m}" ${m === ym ? "selected" : ""}>${ymLabel(m, false)}${m === cur && live ? " (so far)" : ""}</option>`).join("")}</select>`; }
function renderHome(ctx) {
  const c = ctx.client; const months = clientMonths(c.id); const cur = CUR_YM();
  const lastPub = months.find((m) => m !== cur);
  const defYm = dayOf(new Date()) >= 8 || !lastPub ? months[0] || cur : lastPub;
  const ym = ctx.args[0] && months.includes(ctx.args[0]) ? ctx.args[0] : defYm;
  const st = monthStats(c, ym); const prev = monthStats(c, ymAdd(ym, -1));
  const live = ym === cur && !(st.month && st.month.status === "published");
  const hist = DB.history[c.id] || []; const histMap = {}; hist.forEach((r) => (histMap[r.ym] = r));
  const startYm = String(c.started_on || "").slice(0, 7) || ymAdd(cur, -5); const own = new Set(months); const allMonths = []; for (let i = 5; i >= 0; i--) { const y = ymAdd(ym, -i); if (y >= startYm || histMap[y] || own.has(y)) allMonths.push(y); }
  if (!allMonths.length) allMonths.push(ym);
  const isHist = (y) => y < startYm && !!histMap[y] && !own.has(y);
  const series = allMonths.map((y) => (isHist(y) ? histMap[y].leads : monthStats(c, y).leads));
  const histAvg = hist.length ? Math.round(hist.reduce((a, r) => a + r.leads, 0) / hist.length) : 0;
  const prevLab = MON[+ymAdd(ym, -1).split("-")[1] - 1];
  const delta = (a, b, goodUp = true, unit = "") => { if (live || !b) return ""; const d = a - b; if (!d) return `<div class="d flat">— vs ${prevLab}</div>`; const up = d > 0; const good = goodUp ? up : !up; return `<div class="d ${good ? "up" : "dn"}">${up ? ICON.up : ICON.dn}${Math.abs(d)}${unit} vs ${prevLab}</div>`; };
  const fill = Math.min(100, (st.leads / c.lead_target_max) * 100); const minTick = (c.lead_target_min / c.lead_target_max) * 100;
  const latestPub = DB.months.filter((m) => m.client_id === c.id && m.status === "published").sort((a, b) => (a.ym < b.ym ? 1 : -1))[0];
  const recent = leadsFor(c.id, ym).slice(0, 3);
  app().innerHTML = topBar({ brand: true, right: `${ctx.viewAs ? `<a class="pill-admin" href="#/admin/client/${c.id}" style="text-decoration:none">VIEWING AS · BACK</a>` : ""}<div class="avatar">${h(c.initials || "")}</div>` }) + `<div class="shell">
  <div class="row" style="margin:18px 0 12px"><div class="grow"><h1 style="font-size:22px;font-weight:600">Kia ora ${h(c.contact_name)}</h1><div class="small muted">${h(c.business_name)} · ${h(c.region)}</div></div>
  <select id="ym-sel" aria-label="Month" style="font:inherit;font-size:14px;font-weight:600;padding:9px 12px;border-radius:11px;border:1px solid var(--rule);background:var(--card);color:var(--ink)">${months.map((m) => `<option value="${m}" ${m === ym ? "selected" : ""}>${ymLabel(m, false)}${m === cur && live ? " (so far)" : ""}</option>`).join("") || `<option>${ymLabel(ym, false)}</option>`}</select></div>
  <div class="hero"><div class="k">${live ? "This month so far" : ymLabel(ym)}</div><div class="n">${st.leads}<small>leads</small></div><div class="sub">${h(c.package_name)} plan · ${c.lead_target_min} to ${c.lead_target_max} leads a month${live ? " · calls update at month end" : ""}</div>
  <div class="meter"><div class="fill ${st.target !== "below" ? "good" : ""}" style="width:${fill}%"></div><div class="tick" style="left:${minTick}%"></div></div><div class="meter-l"><span>0</span><span>${c.lead_target_min} = target</span><span>${c.lead_target_max}</span></div>
  <div class="mt12">${live ? `<span class="chip white"><i></i>Month in progress</span>` : targetChip(st)}${st.untagged && !live ? ` <span class="chip white">${st.untagged} to tag</span>` : ""}</div>
  ${st.leads ? `<div class="stat"><div><small>Est. value of leads</small><b>${money(st.estTotal)}</b></div><div><small>Confirmed won</small><b>${st.wonValue ? money(st.wonValue) : "–"}</b></div><div><small>Your return</small><b>${st.wonValue ? (st.wonValue / (Number(c.monthly_fee) || 1)).toFixed(1) + "x" : "–"}</b></div></div>` : ""}</div>
  <div class="kpis">
    <div class="kpi"><div class="l">Phone calls</div><div class="v">${st.calls}</div>${delta(st.calls, prev.calls)}</div>
    <div class="kpi"><div class="l">Web enquiries</div><div class="v">${st.enq}</div>${delta(st.enq, prev.enq)}</div>
    <div class="kpi"><div class="l">Answered</div><div class="v">${st.answered}<small>${st.calls ? pct(st.answered, st.calls) + "%" : ""}</small></div>${delta(pct(st.answered, st.calls), prev.calls ? pct(prev.answered, prev.calls) : 0, true, " pts")}</div>
    <div class="kpi"><div class="l">Missed calls</div><div class="v">${st.missed}<small>${st.calls ? st.missedRate + "%" : ""}</small></div>${delta(st.missed, prev.missed, false)}</div>
    <div class="kpi"><div class="l">Average call</div><div class="v">${st.avgDur ? dur(st.avgDur) : "–"}</div></div>
    <div class="kpi"><div class="l">Jobs won</div><div class="v">${st.won}${st.wonValue ? `<small>${money(st.wonValue)}</small>` : ""}</div><div class="d flat">${live ? "tagged so far" : "tagged by you"}</div></div>
  </div>
  ${latestPub ? `<div class="sec"><div class="sec-h"><h2>Note from ${h(JOE.name)}</h2><a href="#${ctx.base}/report/${latestPub.ym}">Full report</a></div><div class="card note"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)} · LeadHive</b><small>${ymLabel(latestPub.ym)} results · published ${fmtDate(latestPub.published_at)}</small></div></div><p>${h(latestPub.summary)}</p></div></div>`
    : `<div class="sec"><div class="card note"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)} · LeadHive</b><small>Welcome aboard</small></div></div><p>Your campaign is live. Calls and web enquiries will show up here as they come in, and your first full report lands at the end of the month.</p></div></div>`}
  <div class="sec"><div class="sec-h"><h2>Leads by month</h2><span class="small muted">calls + web enquiries</span></div><div class="card chart">${columnChart({ labels: allMonths.map((y) => MON[+y.split("-")[1] - 1]), values: series, highlight: allMonths.length - 1, faint: allMonths.map((y, i) => (isHist(y) ? i : -1)).filter((i) => i >= 0), tipFmt: (i) => `${ymLabel(allMonths[i])}: ${series[i]} leads${isHist(allMonths[i]) ? " (previous partner)" : ""}` })}${hist.length ? `<p class="small muted mt8" style="line-height:1.45">Lighter bars are ${h(c.region)} before you joined: the previous partner averaged <b>${histAvg} leads a month</b> on this campaign. Their calls and details stay private to them.</p>` : ""}</div></div>
  <div class="sec"><div class="sec-h"><h2>${live ? "This month" : ymLabel(ym, false)} by week</h2></div><div class="card chart">${columnChart({ labels: st.weeks.map((_, i) => "Wk " + (i + 1)), values: st.weeks, gold: st.leads ? [st.weeks.indexOf(Math.max(...st.weeks))] : [], height: 130, tipFmt: (i) => `Week ${i + 1}: ${st.weeks[i]} leads` })}</div></div>
  <div class="sec"><div class="sec-h"><h2>Latest leads</h2><a href="#${ctx.base}/leads/${ym}">See all ${st.leads}</a></div><div class="list" id="recent-list">${recent.length ? recent.map((x) => leadRow(x, ctx.base, c)).join("") : emptyState(live ? "Your campaign is live" : "Nothing logged this month", live ? "The first calls and web enquiries land here." : "")}</div>${st.untagged ? `<p class="small muted mt8">${st.untagged} lead${st.untagged === 1 ? "" : "s"} still to tag · <a class="lnk" href="#${ctx.base}/leads/${ym}/untagged">tag them</a></p>` : ""}</div>
  <p class="small muted center" style="margin:22px 0 8px">Numbers come from your call tracking line and your website form.</p></div>`;
  $("ym-sel").onchange = (e) => go(`${ctx.base}/home/${e.target.value}`);
  bindTips(app()); bindTagStrips($("recent-list"), rerenderKeepScroll);
}
function renderLeads(ctx) {
  const c = ctx.client; const months = clientMonths(c.id); const cur = CUR_YM();
  const ym = ctx.args[0] && months.includes(ctx.args[0]) ? ctx.args[0] : months[0] || cur; const filter = ctx.args[1] || "all";
  let items = leadsFor(c.id, ym);
  const isUntagged = (x) => x.client_status === "new"; const isOngoing = (x) => x.client_status === "ongoing" || x.client_status === "quoted";
  const counts = { all: items.length, missed: items.filter((x) => x.kind === "call" && x.outcome !== "answered").length, web: items.filter((x) => x.kind === "enquiry").length, rec: items.filter((x) => x.recording_url || x.recording_path).length, untagged: items.filter(isUntagged).length, ongoing: items.filter(isOngoing).length, won: items.filter((x) => x.client_status === "won").length, lost: items.filter((x) => x.client_status === "lost").length };
  if (filter === "missed") items = items.filter((x) => x.kind === "call" && x.outcome !== "answered"); else if (filter === "web") items = items.filter((x) => x.kind === "enquiry"); else if (filter === "rec") items = items.filter((x) => x.recording_url || x.recording_path); else if (filter === "untagged") items = items.filter(isUntagged); else if (filter === "ongoing") items = items.filter(isOngoing); else if (filter === "won") items = items.filter((x) => x.client_status === "won"); else if (filter === "lost") items = items.filter((x) => x.client_status === "lost");
  const wonSum = leadsFor(c.id, ym).filter((x) => x.client_status === "won").reduce((a, x) => a + (Number(x.job_value) || 0), 0);
  const groups = []; for (const x of items) { const d = fmtDay(x.at); const g = groups[groups.length - 1]; if (g && g.d === d) g.items.push(x); else groups.push({ d, items: [x] }); }
  const chip = (k, l) => `<a class="f ${filter === k ? "on" : ""}" href="#${ctx.base}/leads/${ym}/${k}">${l} ${counts[k]}</a>`;
  app().innerHTML = topBar({ title: "Leads", sub: h(c.business_name), right: monthSelect("ym-sel", months.length ? months : [ym], ym, ym === cur) }) + `<div class="shell">
  <div class="chips mt12">${chip("all", "All")}${chip("untagged", "To tag")}${chip("ongoing", "Ongoing")}${chip("won", "Won")}${chip("lost", "Lost")}${chip("missed", "Missed")}${chip("web", "Web forms")}${chip("rec", "Recorded")}</div>
  ${counts.untagged && filter === "all" ? `<div class="card" style="padding:12px 14px;margin-top:4px;background:var(--gold-bg);border-color:#F3DDA8"><div class="row"><div class="grow"><b style="font-size:14px">Did you get the job? Tap Won, Lost or Ongoing on each lead.</b><div class="small" style="color:var(--gold-ink);margin-top:2px">Won shows our estimate. Put your real number in and it works out your actual return.</div></div><a class="btn sm navy" href="#${ctx.base}/leads/${ym}/untagged">Start</a></div></div>` : ""}
  ${filter === "won" && wonSum ? `<div class="card mt12" style="padding:12px 14px;background:var(--good-bg);border-color:#BFE5CF"><b style="color:#0F6B3D">${money(wonSum)} confirmed won in ${ymLabel(ym, false)}</b><div class="small" style="color:#1F5A3C;margin-top:2px">From ${counts.won} job${counts.won === 1 ? "" : "s"} on a ${money(c.monthly_fee)} plan.</div></div>` : ""}
  <div class="list mt12" id="lead-list">${groups.length ? groups.map((g) => `<div class="day">${h(g.d)}</div>${g.items.map((x) => leadRow(x, ctx.base, c)).join("")}`).join("") : emptyState(filter === "all" ? `Nothing here for ${ymLabel(ym, false)} yet` : "Nothing in this filter", filter === "all" ? "Calls and web enquiries show up here as they come in." : "")}</div>
  <p class="small muted center" style="margin:18px 0 8px">Tap a lead to hear the call, read ${h(JOE.name)}'s note or change a tag.</p></div>`;
  $("ym-sel").onchange = (e) => go(`${ctx.base}/leads/${e.target.value}/${filter}`);
  bindTagStrips($("lead-list"), rerenderKeepScroll);
}
async function renderLead(ctx) {
  const x = findLead(ctx.args[0]); if (!x || x.client_id !== ctx.cid) return go(`${ctx.base}/leads`);
  const isCall = x.kind === "call"; const missed = isCall && x.outcome !== "answered";
  const tel = (isCall ? x.caller_number : x.phone || "").replace(/\s/g, "");
  if (x.client_status === "quoted") x.client_status = "ongoing"; // legacy value shows as Ongoing
  const segBtn = (k, l, ic) => `<button data-st="${k}" class="${x.client_status === k ? "on " + k : ""}">${ic}${l}</button>`;
  const hasRec = isCall && (x.recording_url || x.recording_path);
  const c = ctx.client; const est = estimateFor(x, c);
  app().innerHTML = topBar({ title: isCall ? (missed ? "Missed call" : "Phone call") : "Web enquiry", sub: fmtDT(x.at), back: `${ctx.base}/leads/${x.ym}` }) + `<div class="shell">
  <div class="card mt16"><div class="row"><div class="grow"><div class="small muted">${isCall ? "Caller" : "From"}</div><div class="big-num">${h(isCall ? x.caller_number : x.name || x.phone)}</div>${!isCall && x.name ? `<div class="mt8 b" style="font-size:16px">${h(x.phone)}</div>` : ""}</div>${missed ? `<span class="chip bad"><i></i>${x.outcome === "voicemail" ? "Voicemail" : "Not answered"}</span>` : isCall ? `<span class="chip good"><i></i>Answered</span>` : x.is_urgent ? `<span class="chip warn"><i></i>Urgent</span>` : `<span class="chip blue">Planned</span>`}</div>
  ${tel ? `<div class="btn-row mt16"><a class="btn navy" href="tel:${h(tel)}">${ICON.phone}Call back</a><a class="btn ghost" href="sms:${h(tel)}">Text</a></div>` : ""}
  <div class="facts">${isCall ? `<div><small>Duration</small>${x.duration_sec ? dur(x.duration_sec) : "–"}</div><div><small>Source</small>${h(x.source || "Google Ads")}</div><div><small>Search</small>${h(x.keyword || "–")}</div><div><small>Caller location</small>${h(x.city || "–")}</div>` : `<div><small>Suburb</small>${h(x.suburb || "–")}</div><div><small>Timing</small>${x.is_urgent ? "As soon as possible" : "Planned job"}</div><div><small>Source</small>Website form</div><div><small>Page</small>${h(x.page || "/")}</div>`}</div></div>
  ${!isCall ? `<div class="card mt12"><div class="small muted b">Their message</div><p class="mt8" style="font-size:15.5px;line-height:1.5;white-space:pre-line">${h(x.message)}</p></div>` : ""}
  ${hasRec ? `<div class="card mt12" id="rec-card"><div class="row"><div class="grow"><b style="font-size:15px">Call recording</b><div class="small muted">Recorded on your tracking line</div></div><a class="small lnk" id="rec-dl" href="#" target="_blank" rel="noopener">Download</a></div>
    <div class="player"><button class="play" id="pl-btn" aria-label="Play">${ICON.play}</button><div class="track" id="pl-track"><i id="pl-fill"></i></div><div class="tm" id="pl-tm">0:00 / ${durShort(x.duration_sec)}</div></div>
    <audio id="pl-audio" preload="metadata"></audio><p class="small muted mt8 hidden" id="rec-msg"></p></div>` : ""}
  ${isCall && missed ? `<div class="card mt12" style="background:var(--bad-bg);border-color:#F2C9C9"><b style="font-size:14.5px;color:var(--bad)">This one rang out.</b><p class="small mt8" style="color:#7A2E2E;line-height:1.45">Most people searching for an emergency tradie call the next result if nobody answers. A call back inside 10 minutes recovers a good share of these.</p></div>` : ""}
  ${x.summary ? `<div class="card mt12"><div class="small muted b">Call summary</div><p class="mt8" style="font-size:15px;line-height:1.5">${h(x.summary)}</p></div>` : ""}
  ${x.admin_note ? `<div class="card note mt12"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)}'s note</b><small>From the call review</small></div></div><p>${h(x.admin_note)}</p></div>` : ""}
  <div class="sec"><div class="sec-h"><h2>What happened with this lead?</h2></div><div class="card">
    <div class="seg four">${segBtn("new", "New", ICON.dot)}${segBtn("ongoing", "Ongoing", ICON.quote)}${segBtn("won", "Won", ICON.star)}${segBtn("lost", "Lost", ICON.dn)}</div>
    ${x.client_status === "not_lead" || x.client_status === "spam" ? `<p class="small muted mt8">${h(JOE.name)} has marked this one as ${x.client_status === "spam" ? "spam" : "not a lead"}, so it doesn't count toward your leads.</p>` : ""}
    ${est ? `<div class="est-line"><span>${h(JOE.name)}'s estimate for this job</span><b>${money(est)}</b></div>` : ""}
    <div id="won-box" class="${x.client_status === "won" ? "" : "hidden"}"><label class="fld"><span>What it was actually worth (ex GST, rough is fine)</span><input id="jv" type="number" inputmode="decimal" placeholder="e.g. ${est || 450}" value="${x.job_value || ""}"></label></div>
    <label class="fld"><span>Your note (optional)</span><textarea id="cn" placeholder="e.g. Booked for Tuesday, quoted $420">${h(x.client_note || "")}</textarea></label>
    <button class="btn primary mt16" id="save-lead">Save</button>
    <p class="small muted mt12" style="line-height:1.45">Tagging takes a second and it's how we work out your real return. Think a lead was dodgy? Text ${h(JOE.name)} and he'll sort it.</p></div></div>
  ${ctx.isAdmin ? `<div class="sec"><div class="sec-h"><h2>Admin</h2></div><div class="card"><label class="fld" style="margin-top:0"><span>${h(JOE.name)}'s note (shown to the partner)</span><textarea id="an" placeholder="What the call was about">${h(x.admin_note || "")}</textarea></label>
    <label class="fld"><span>Estimated job value ($)</span><input id="ev" type="number" inputmode="decimal" value="${x.estimated_value != null ? x.estimated_value : ""}" placeholder="blank = partner's average ${money(c.avg_job_value)}"></label>
    <label class="fld"><span>LeadHive flag (only you can set these)</span><select id="af"><option value="">None, counts as a lead</option><option value="not_lead" ${x.client_status === "not_lead" ? "selected" : ""}>Not a lead (wrong number, supplier, job seeker)</option><option value="spam" ${x.client_status === "spam" ? "selected" : ""}>Spam (left out of their lead count)</option></select></label>
    ${isCall ? `<label class="fld"><span>Attach a recording (mp3/m4a/wav)</span><input id="rec-file" type="file" accept="audio/*"><div class="hint">Use this when the Nimbata link needs a login. The file is private to this partner.</div></label>` : ""}
    <button class="btn navy mt12" id="save-admin">Save admin changes</button></div></div>` : ""}
  </div>`;
  let st = x.client_status;
  app().querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { st = b.dataset.st; app().querySelectorAll(".seg button").forEach((o) => (o.className = "")); b.className = "on " + st; $("won-box").classList.toggle("hidden", st !== "won"); if (st === "won" && !$("jv").value && est) $("jv").value = est; }));
  $("save-lead").onclick = async () => { const patch = { client_status: st, job_value: st === "won" ? Number($("jv").value) || 0 : 0, client_note: $("cn").value.trim() };
    try { $("save-lead").setAttribute("disabled", ""); await api.updateLead(x.kind, x.id, patch); Object.assign(x.kind === "call" ? DB.calls.find((r) => r.id === x.id) : DB.enquiries.find((r) => r.id === x.id), patch); toast(st === "won" ? "Nice one. Tagged as won." : "Saved"); setTimeout(() => go(`${ctx.base}/leads/${x.ym}`), 450); }
    catch (ex) { toast(ex.message, true); $("save-lead").removeAttribute("disabled"); } };
  const sa = $("save-admin"); if (sa) sa.onclick = async () => { try { sa.setAttribute("disabled", ""); const patch = { admin_note: $("an").value.trim(), estimated_value: $("ev").value === "" ? null : Number($("ev").value) || 0 }; const flag = $("af").value; if (flag) patch.client_status = flag; else if (x.client_status === "not_lead" || x.client_status === "spam") patch.client_status = "new"; const f = $("rec-file") && $("rec-file").files[0]; if (f) { patch.recording_path = await api.uploadRecording(x.client_id, x.id, f); } await api.updateLead(x.kind, x.id, patch); Object.assign(x.kind === "call" ? DB.calls.find((r) => r.id === x.id) : DB.enquiries.find((r) => r.id === x.id), patch); toast("Saved"); route(); } catch (ex) { toast(ex.message, true); sa.removeAttribute("disabled"); } };
  if (hasRec) {
    const au = $("pl-audio"), btn = $("pl-btn"), fill = $("pl-fill"), tm = $("pl-tm"), tr = $("pl-track"), dl = $("rec-dl"), msg = $("rec-msg");
    let src = null;
    try { src = x.recording_path ? await api.signedUrl("recordings", x.recording_path) : x.recording_url === "demo" ? demoRecording() : x.recording_url; } catch (e) { msg.textContent = "Couldn't load the recording: " + e.message; msg.classList.remove("hidden"); }
    if (src) { au.src = src; dl.href = src; if (!x.recording_path && x.recording_url !== "demo") { msg.textContent = "Plays from your call tracking provider. If it asks for a login, ask " + JOE.name + " to attach the file."; msg.classList.remove("hidden"); } if (x.recording_url === "demo") { msg.textContent = "Demo audio. In the live portal this is the real call recording."; msg.classList.remove("hidden"); } }
    const total = () => (isFinite(au.duration) && au.duration ? au.duration : x.duration_sec);
    btn.onclick = () => { if (!src) return; au.paused ? au.play().catch((e) => { msg.textContent = "Couldn't play this recording here. Use Download instead."; msg.classList.remove("hidden"); }) : au.pause(); };
    au.onplay = () => (btn.innerHTML = ICON.pause); au.onpause = () => (btn.innerHTML = ICON.play); au.onended = () => { btn.innerHTML = ICON.play; fill.style.width = "0"; };
    au.ontimeupdate = () => { fill.style.width = (au.currentTime / total()) * 100 + "%"; tm.textContent = `${durShort(au.currentTime)} / ${durShort(total())}`; };
    au.onloadedmetadata = () => (tm.textContent = `0:00 / ${durShort(total())}`);
    tr.onclick = (e) => { const r = tr.getBoundingClientRect(); au.currentTime = ((e.clientX - r.left) / r.width) * total(); };
  }
}
function renderReports(ctx) {
  const c = ctx.client; const ms = DB.months.filter((m) => m.client_id === c.id && m.status === "published").sort((a, b) => (a.ym < b.ym ? 1 : -1));
  app().innerHTML = topBar({ title: "Monthly reports", sub: h(c.business_name) }) + `<div class="shell">
  <p class="lede" style="margin:16px 0 12px">One report a month, written by ${h(JOE.name)}. What came in, what it was worth, and what's being changed next.</p>
  ${ms.length ? ms.map((m) => { const st = monthStats(c, m.ym); return `<a class="card" style="display:block;text-decoration:none;margin-top:10px" href="#${ctx.base}/report/${m.ym}"><div class="row"><div class="grow"><b style="font-size:16px;font-family:var(--head)">${ymLabel(m.ym)}</b><div class="small muted" style="margin-top:3px">${st.leads} leads · ${st.calls} calls · ${st.enq} web · ${st.missedRate}% missed${st.wonValue ? ` · ${money(st.wonValue)} won` : ""}</div></div>${targetChip(st)}<span class="chev">${ICON.chev}</span></div></a>`; }).join("") : `<div class="card" style="padding:0">${emptyState("Your first report is on its way", "It lands at the end of your first full month.")}</div>`}
  ${(DB.history[c.id] || []).length ? `<div class="sec"><div class="sec-h"><h2>${h(c.region)} before you</h2><span class="small muted">previous partner</span></div><div class="card">${[...DB.history[c.id]].reverse().map((r) => `<div class="rpt-k"><span>${ymLabel(r.ym, false)}</span><b>${r.leads} leads <span class="muted small">· ${r.calls} calls · ${r.enquiries} web · ${pct(r.answered, r.calls)}% answered</span></b></div>`).join("")}<p class="small muted mt8" style="line-height:1.45">The same campaign, number and landing page you're on now. Only the totals are shown; the previous partner's calls stay theirs.</p></div></div>` : ""}</div>`;
}
function renderReport(ctx) {
  const c = ctx.client; const ym = ctx.args[0]; const m = monthRec(c.id, ym); if (!m || m.status !== "published") return go(`${ctx.base}/reports`);
  const st = monthStats(c, ym); const prev = monthStats(c, ymAdd(ym, -1));
  const kv = (k, v) => `<div class="rpt-k"><span>${k}</span><b>${v}</b></div>`;
  app().innerHTML = topBar({ title: `${ymLabel(ym)} report`, sub: h(c.business_name), back: `${ctx.base}/reports` }) + `<div class="shell">
  <div class="hero" style="margin-top:16px"><div class="k">${ymLabel(ym)}${st.wonValue ? " · your return" : ""}</div>${st.wonValue ? `<div class="n ret">${(st.wonValue / (Number(c.monthly_fee) || 1)).toFixed(1)}x</div><div class="sub">${money(st.wonValue)} confirmed won from your ${money(c.monthly_fee)} plan · ${st.leads} leads</div>` : `<div class="n">${st.leads}<small>leads</small></div><div class="sub">${h(c.package_name)} plan · target ${c.lead_target_min} to ${c.lead_target_max}</div>`}<div class="mt12">${targetChip(st)}${prev.leads ? ` <span class="chip white">${st.leads >= prev.leads ? "+" : ""}${st.leads - prev.leads} leads vs ${ymLabel(ymAdd(ym, -1), false)}</span>` : ""}</div></div>
  <div class="card mt12">${kv("Phone calls", st.calls)}${kv("Answered", `${st.answered} <span class="muted small">(${pct(st.answered, st.calls)}%)</span>`)}${kv("Missed or voicemail", `${st.missed} <span class="muted small">(${st.missedRate}%)</span>`)}${kv("Web enquiries", st.enq)}${kv("Average call length", st.avgDur ? dur(st.avgDur) : "–")}${st.spam && ctx.isAdmin ? kv("Spam removed (admin only)", st.spam) : ""}${c.show_ad_spend && st.adSpend != null ? kv("Ad spend (Google)", money(st.adSpend)) : ""}${kv("Estimated value of leads", money(st.estTotal))}${st.won ? kv("Jobs you tagged won", `${st.won} · ${money(st.wonValue)}`) : ""}${st.lost ? kv("Tagged lost", st.lost) : ""}${st.quoted ? kv("Ongoing", st.quoted) : ""}${st.untagged ? kv("Still to tag", st.untagged) : ""}</div>
  ${st.wonValue ? `<div class="card mt12" style="background:var(--good-bg);border-color:#BFE5CF"><b style="font-size:15px;color:#0F6B3D">${money(st.wonValue)} confirmed won from a ${money(c.monthly_fee)} plan</b><p class="small mt8" style="color:#1F5A3C;line-height:1.45">That's ${(st.wonValue / (Number(c.monthly_fee) || 1)).toFixed(1)}x on your own numbers, from the ${st.won} job${st.won === 1 ? "" : "s"} you tagged won.${st.untagged ? ` ${st.untagged} lead${st.untagged === 1 ? " is" : "s are"} still untagged.` : ""}</p></div>` : `<div class="card mt12" style="background:var(--gold-bg);border-color:#F3DDA8"><b style="font-size:15px;color:var(--gold-ink)">${money(st.estTotal)} of estimated work in these leads</b><p class="small mt8" style="color:var(--gold-ink);line-height:1.45">Tap Won or Lost on each lead and put your real numbers in. The report then shows your actual return, not our estimate.</p></div>`}
  <div class="sec"><div class="sec-h"><h2>Leads by week</h2></div><div class="card chart">${columnChart({ labels: st.weeks.map((_, i) => "Wk " + (i + 1)), values: st.weeks, gold: st.leads ? [st.weeks.indexOf(Math.max(...st.weeks))] : [], height: 130, tipFmt: (i) => `Week ${i + 1}: ${st.weeks[i]} leads` })}</div></div>
  ${m.summary ? `<div class="sec"><div class="sec-h"><h2>${h(JOE.name)}'s summary</h2></div><div class="card note"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)} · LeadHive</b><small>Published ${fmtDate(m.published_at)}</small></div></div><p>${h(m.summary)}</p></div></div>` : ""}
  ${m.points && m.points.length ? `<div class="sec"><div class="sec-h"><h2>What I'm changing</h2></div><div class="card">${m.points.map((p, i) => `<div class="pt"><div class="ix">${i + 1}</div><div><b>${h(p.title)}</b><p>${h(p.body)}</p></div></div>`).join("")}</div></div>` : ""}
  ${m.pdf_path ? `<a class="btn ghost mt20" href="#" id="pdf">${ICON.dl}Download PDF report</a>` : ""}
  <a class="btn navy mt12" href="#${ctx.base}/leads/${ym}">See every lead from ${ymLabel(ym, false)}</a>
  <p class="small muted center" style="margin:18px 0 8px">Questions? Text ${h(JOE.name)}. Every reply gets read.</p></div>`;
  const p = $("pdf"); if (p) p.onclick = async (e) => { e.preventDefault(); try { const url = await api.signedUrl("reports", m.pdf_path); window.open(url, "_blank", "noopener"); } catch (ex) { toast(ex.message, true); } };
  bindTips(app());
}
function renderAccount(ctx) {
  const c = ctx.client; const user = ctx.user;
  const bp = billingPlan(c); const next = bp && bp.upcoming ? new Date(bp.upcoming.start + "T12:00:00Z") : null;
  const telJ = (JOE.phone || "").replace(/\s/g, "");
  app().innerHTML = topBar({ title: ctx.viewAs ? "Viewing as partner" : "Account", sub: h(c.business_name) }) + `<div class="shell">
  ${ctx.viewAs ? `<a class="btn navy" style="margin-top:16px" href="#/admin/client/${c.id}">${ICON.back}Back to admin</a>` : ""}
  <div class="card mt16"><div class="row"><div class="avatar" style="width:46px;height:46px;font-size:16px">${h(c.initials || "")}</div><div class="grow"><b style="font-size:16px;font-family:var(--head)">${h(c.business_name)}</b><div class="small muted">${h(c.contact_name)} · ${h(c.niche)} · ${h(c.region)}</div></div></div>
  <div class="facts"><div><small>Plan</small>${h(c.package_name)}</div><div><small>Monthly fee</small>${bp && bp.upcoming ? bp.upcoming.amtText : money(c.monthly_fee)}</div><div><small>Lead target</small>${c.lead_target_min} to ${c.lead_target_max} a month</div><div><small>Next invoice</small>${next ? next.toLocaleDateString("en-NZ", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "–"}</div><div><small>Partner since</small>${c.started_on ? new Date(c.started_on + "T12:00:00Z").toLocaleDateString("en-NZ", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "–"}</div><div><small>Login</small>${h(ctx.viewAs ? c.email : user.email)}</div></div></div>
  <div class="sec"><div class="sec-h"><h2>Talk to ${h(JOE.name)}</h2></div><div class="btn-row">${telJ ? `<a class="btn navy" href="tel:${h(telJ)}">${ICON.phone}Call</a>` : ""}${JOE.whatsapp ? `<a class="btn ghost" href="${h(JOE.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<a class="btn ghost" href="mailto:${h(JOE.email)}">Email</a></div></div>
  <div class="sec"><div class="sec-h"><h2>Put it on your home screen</h2></div><div class="card"><p class="lede">This portal works like an app. On iPhone tap <b>Share</b> then <b>Add to Home Screen</b>. On Android tap the <b>⋮ menu</b> then <b>Add to Home screen</b>. You'll get a LeadHive icon and it opens full-screen.</p></div></div>
  <div class="sec"><div class="sec-h"><h2>Your lead line</h2></div><div class="card"><p class="lede">Calls from your Google ads come through a LeadHive tracking number that forwards straight to <b>${h(c.phone || "your mobile")}</b>. That's how we count calls and record them. Web enquiries come from your LeadHive landing page and land here the moment they're sent.</p></div></div>
  ${ctx.viewAs ? "" : `<div class="sec"><div class="sec-h"><h2>Change your password</h2></div><div class="card"><label class="fld" style="margin-top:0"><span>New password (6 characters or more)</span><input id="np-pass" type="password" autocomplete="new-password"></label><button class="btn ghost mt12" type="button" id="np-save">Save new password</button></div></div>`}
  ${ctx.viewAs ? "" : `<button class="btn danger mt20" id="logout">${ICON.out}Log out</button>`}
  <p class="small muted center" style="margin:18px 0 8px">LeadHive ${c.country === "AU" ? "AU" : "NZ"} · Partner portal</p></div>`;
  const lo = $("logout"); if (lo) lo.onclick = async () => { await api.signOut(); resetDB(); go("/"); route(); };
  const ns = $("np-save"); if (ns) ns.onclick = async () => { const v = $("np-pass").value; if (v.length < 6) { toast("Use 6 characters or more", true); return; } ns.disabled = true; try { await api.updatePassword(v); $("np-pass").value = ""; toast("Password changed"); } catch (ex) { toast(ex.message, true); } ns.disabled = false; };
}

/* ═══════════════════════════ screens: admin ═══════════════════════════ */
function clientStatus(c) {
  const cur = CUR_YM(), prevYm = ymAdd(cur, -1); const started = String(c.started_on || "");
  const lastPub = DB.months.filter((m) => m.client_id === c.id && m.status === "published").map((m) => m.ym).sort().pop();
  const draft = DB.months.find((m) => m.client_id === c.id && m.ym === prevYm && m.status === "draft");
  if (started.slice(0, 7) >= cur || (started.slice(0, 7) === prevYm && +started.slice(8, 10) > 20)) return { cls: "blue", l: "New · first month running" };
  if (lastPub === prevYm) return { cls: "good", l: `${ymLabel(prevYm, false)} published` };
  if (draft) return { cls: "warn", l: `${ymLabel(prevYm, false)} draft, not published` };
  return { cls: "bad", l: `${ymLabel(prevYm, false)} report due` };
}
const CHURN_REASONS = { price: "Price", capacity: "No capacity for more work", quality: "Lead quality", in_house: "Doing it themselves", seasonal: "Seasonal / pausing", other: "Other" };
const agoText = (iso) => { if (!iso) return "never opened"; const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? "opened today" : d === 1 ? "opened yesterday" : `opened ${d} days ago`; };
function renderAdmin() {
  const cs = DB.clients.filter((c) => c.active); const inactive = DB.clients.filter((c) => !c.active); const cur = CUR_YM(), prevYm = ymAdd(cur, -1);
  const due = cs.filter((c) => ["bad", "warn"].includes(clientStatus(c).cls)).length;
  const live = DB.counts.filter((r) => r.ym === cur).reduce((a, r) => a + r.leads, 0);
  app().innerHTML = topBar({ brand: true, right: `<span class="pill-admin">ADMIN</span>` }) + `<div class="shell">
  <div class="row" style="margin:18px 0 12px"><div class="grow"><h1 style="font-size:22px;font-weight:600">Partners</h1><div class="small muted">${cs.length} active · ${due} report${due === 1 ? "" : "s"} due for ${ymLabel(prevYm, false)} · ${live} lead${live === 1 ? "" : "s"} logged so far in ${ymLabel(cur, false)}</div></div></div>
  <div class="btn-row"><a class="btn primary" href="#/admin/upload">${ICON.upload}Upload month</a><a class="btn ghost" href="#/admin/newclient">+ New partner</a></div>
  <div class="btn-row" style="margin-top:10px"><a class="small" href="#/admin/bulk" style="flex:1;text-align:center;color:var(--blue);font-weight:600">Add several partners at once</a><a class="small" href="#/admin/import" style="flex:1;text-align:center;color:var(--blue);font-weight:600">Upload data for every partner</a></div>
  ${(() => { const ps = DB.clients.map((c) => [c, billingPlan(c)]).filter(([, p]) => p); const late = ps.filter(([, p]) => p.late.length); const soon = ps.filter(([c, p]) => c.active && ((p.unpaid.length && !p.late.length) || (p.upcoming && daysFrom(p.today, p.upcoming.start) <= 7))); const open = slotLines().filter((L) => !L.hidden && !L.cur.length).length; const tile = "text-decoration:none;color:inherit"; const pending = !DB.billingErr && billingSetupList().length; const dueOn = (p) => (p.unpaid.length && !p.late.length ? p.unpaid[0].start : p.upcoming.start);
    return `<div class="kpis"><a class="kpi" href="#/admin/billing" style="${tile}"><div class="l">Overdue</div>${pending || DB.billingErr ? `<div class="v" style="font-size:18px">Set up billing</div><div class="d flat">${DB.billingErr ? "one-off Supabase update" : "tick off old invoices first"}</div>` : `<div class="v" style="color:${late.length ? "var(--bad)" : "inherit"}">${amt(late.reduce((a, [, p]) => a + p.lateAmt, 0))}</div><div class="d flat">${late.length ? late.map(([c]) => h(c.business_name)).slice(0, 2).join(", ") + (late.length > 2 ? " +" + (late.length - 2) : "") : "nobody"}</div>`}</a><a class="kpi" href="#/admin/billing" style="${tile}"><div class="l">Invoices due in 7 days</div><div class="v">${soon.length}</div><div class="d flat">${soon.length ? soon.map(([c, p]) => `${h(c.business_name.split(" ")[0])} ${fmtCal(dueOn(p)).replace(/ \d{4}$/, "")}`).slice(0, 2).join(", ") : "none"}</div></a><a class="kpi" href="#/admin/slots" style="${tile}"><div class="l">Open slots</div><div class="v">${open}</div><div class="d flat">see every region</div></a></div>`; })()}
  <div class="list mt16">${cs.length ? cs.map((c) => { const s = clientStatus(c); const k = countFor(c.id, prevYm); return `<a class="li client-li" href="#/admin/client/${c.id}"><div class="ic">${h(c.initials || "")}</div><div class="grow"><div class="t1"><span>${h(c.business_name)}</span></div><div class="t2"><span class="tx">${h(c.niche)} · ${h(c.region)} ${h(c.country)} · ${h(c.package_name)} ${money(c.monthly_fee)}</span></div><div style="margin-top:5px"><span class="chip ${s.cls}"><i></i>${s.l}</span> ${(() => { const seen = DB.seen[c.id]; const d = seen ? Math.floor((Date.now() - new Date(seen)) / 864e5) : null; return `<span class="chip ${d == null || d >= 14 ? "warn" : ""}">${agoText(seen)}</span>`; })()}</div></div><div class="meta"><div class="tm">${k.leads ? k.leads + (k.leads === 1 ? " lead" : " leads") : ""}</div><div class="du muted">${k.leads ? ymLabel(prevYm, false) : ""}</div></div><span class="chev">${ICON.chev}</span></a>`; }).join("") : `<div class="empty">No partners yet. Add your first one.</div>`}</div>
  <div class="sec"><div class="sec-h"><h2>Month-end routine</h2></div><div class="card"><div class="pt"><div class="ix">1</div><div><b>Export from Nimbata, as often as you like</b><p>Call log → filter the partner's project and the month → Export CSV. Fortnightly is fine: uploads add new calls and refresh existing ones, nothing gets wiped.</p></div></div><div class="pt"><div class="ix">2</div><div><b>Send the stats to Claude for the notes</b><p>Upload step 2 has a "Copy summary" button. Paste it to Claude with the Google Ads spend and you get the summary and three "what I'm changing" points back.</p></div></div><div class="pt"><div class="ix">3</div><div><b>Paste, attach the PDF, publish</b><p>The partner gets an email saying their results are in, and it's in their portal the moment you hit publish.</p></div></div></div></div>
  ${inactive.length ? `<div class="sec"><div class="sec-h"><h2>Past partners</h2><span class="small muted">${inactive.length}</span></div><div class="list">${inactive.map((c) => `<a class="li client-li" href="#/admin/client/${c.id}" style="opacity:.75"><div class="ic" style="background:var(--ink-3)">${h(c.initials || "")}</div><div class="grow"><div class="t1"><span>${h(c.business_name)}</span></div><div class="t2"><span class="tx">${h(c.region)} · left ${c.churned_on ? fmtCal(c.churned_on) : "–"}${c.churn_reason ? " · " + h(CHURN_REASONS[c.churn_reason] || c.churn_reason) : ""}</span></div></div><span class="chev">${ICON.chev}</span></a>`).join("")}</div><p class="small muted mt8">Their data and recordings are kept. Open one to reactivate.</p></div>` : ""}
  ${DEMO ? `<button class="btn ghost mt20" id="reset" style="color:var(--ink-3)">Reset demo data</button>` : ""}</div>`;
  const r = $("reset"); if (r) r.onclick = () => { if (confirm("Reset the demo data to the starting state?")) { api.resetDemo(); resetDB(); route(); toast("Demo reset"); } };
}
function renderAdminClient(ctx) {
  const c = client(ctx.args[0]); if (!c) return go("/admin");
  TZ = tzOf(c);
  const s = clientStatus(c); const cur = CUR_YM();
  const noteYms = new Set(DB.months.filter((m) => m.client_id === c.id).map((m) => m.ym)); const dataYms = new Set([...DB.calls, ...DB.enquiries].filter((x) => x.client_id === c.id && x.ym && x.ym !== cur).map((x) => x.ym));
  const ms = [...new Set([...noteYms, ...dataYms])].sort().reverse().map((ym) => DB.months.find((m) => m.client_id === c.id && m.ym === ym) || { ym, client_id: c.id, status: "none", ad_spend: null });
  const live = leadsFor(c.id, cur);
  app().innerHTML = topBar({ title: h(c.business_name), sub: `${h(c.contact_name)} · ${h(c.package_name)} · ${money(c.monthly_fee)}/mo`, back: "/admin" }) + `<div class="shell">
  ${c.active ? "" : `<div class="card mt16" style="background:var(--bad-bg);border-color:#F2C9C9"><b style="color:var(--bad)">Past partner · left ${c.churned_on ? fmtCal(c.churned_on) : "–"}${c.churn_reason ? " · " + h(CHURN_REASONS[c.churn_reason] || c.churn_reason) : ""}</b>${c.churn_note ? `<p class="small mt8" style="color:#7A2E2E">${h(c.churn_note)}</p>` : ""}<p class="small mt8" style="color:#7A2E2E">Their login is paused and their webhook is off. Everything is kept for a win-back.</p><button class="btn navy mt12" id="react">Reactivate partner</button></div>`}
  <div class="mt16"><span class="chip ${s.cls}"><i></i>${s.l}</span> <span class="chip">${c.lead_target_min}–${c.lead_target_max} leads</span> <span class="chip">${h(c.country)}</span>${c.predecessor_id && client(c.predecessor_id) ? ` <span class="chip blue">Took over from ${h(client(c.predecessor_id).business_name)}</span>` : ""} <span class="chip ${DB.seen[c.id] && (Date.now() - new Date(DB.seen[c.id])) / 864e5 < 14 ? "" : "warn"}">${agoText(DB.seen[c.id])}</span></div>
  <div class="btn-row mt12"><a class="btn primary" href="#/admin/upload/${c.id}">${ICON.upload}Upload month</a><a class="btn ghost" href="#/as/${c.id}/home">View as ${h(c.contact_name || "partner")}</a></div>
  <div class="btn-row" style="margin-top:8px"><a class="btn ghost sm" style="flex:1" href="#/admin/settings/${c.id}">${ICON.cog}Settings &amp; login</a><button class="btn ghost sm" style="flex:1" id="copy-hook">${ICON.copy}Enquiry webhook</button></div>
  <div class="sec"><div class="sec-h"><h2>Billing</h2><a href="#/admin/billing">All partners</a></div>${DB.billingErr ? billSetupNote() : `<div id="bill-root">${billCard(c, billingPlan(c), true)}</div>`}</div>
  <div class="sec"><div class="sec-h"><h2>Months</h2></div><div class="list">${ms.length ? ms.map((m) => { const st = monthStats(c, m.ym); return `<a class="li" href="#/admin/upload/${c.id}/${m.ym}"><div class="grow"><div class="t1"><span>${ymLabel(m.ym)}</span>${m.status === "published" ? `<span class="chip good">Published</span>` : m.status === "draft" ? `<span class="chip warn">Draft</span>` : `<span class="chip">Calls only · add notes</span>`}</div><div class="t2"><span class="tx">${st.leads} leads · ${st.calls} calls · ${st.missedRate}% missed · ${st.enq} web${st.adSpend ? ` · ads ${money(st.adSpend)}${st.leads ? ` (${money(st.cplAd)}/lead)` : ""}` : ""}</span></div></div><span class="chev">${ICON.chev}</span></a>`; }).join("") : `<div class="empty">No months uploaded yet.</div>`}</div></div>
  <div class="sec"><div class="sec-h"><h2>${ymLabel(cur, false)} so far</h2><a href="#/as/${c.id}/leads/${cur}">${live.length} lead${live.length === 1 ? "" : "s"}</a></div><div class="list">${live.length ? live.slice(0, 4).map((x) => leadRow(x, `/as/${c.id}`, null)).join("") : `<div class="empty">Nothing logged yet this month. Web enquiries land here live once the webhook is on the landing page; calls arrive with the CSV.</div>`}</div></div>
  <div class="sec"><div class="sec-h"><h2>Margin (admin only)</h2></div><div class="card">${ms.filter((m) => m.status === "published" && m.ad_spend != null).slice(0, 3).map((m) => { const ad = Number(m.ad_spend) || 0; const fee = Number(c.monthly_fee) || 0; return `<div class="rpt-k"><span>${ymLabel(m.ym, false)}</span><b>${money(fee - ad)} <span class="muted small">of ${money(fee)} · ${pct(fee - ad, fee)}%</span></b></div>`; }).join("") || `<div class="muted small">Nothing published yet.</div>`}<p class="small muted mt8">Partners never see ad spend unless you switch it on in Settings.</p></div></div></div>`;
  const br = $("bill-root"); if (br) bindBilling(br, () => rerenderKeepScroll());
  $("copy-hook").onclick = async () => { try { const key = DB.keys[c.id] || (DB.keys[c.id] = await api.getWebhookKey(c.id)); copyText(`POST ${PORTAL_URL}/api/enquiry\nx-leadhive-key: ${key}\n{ "name", "phone", "suburb", "issue", "isUrgent", "page" }`, "Webhook details copied"); } catch (e) { toast(e.message, true); } };
  const ra = $("react"); if (ra) ra.onclick = async () => { try { ra.setAttribute("disabled", ""); await api.reactivateClient(c.id); Object.assign(c, { active: true, churned_on: null, churn_reason: null, churn_note: "" }); toast(`${c.business_name} is back`); route(); } catch (e) { toast(e.message, true); ra.removeAttribute("disabled"); } };
}
function renderUpload(ctx) {
  const pre = ctx.args[0] ? client(ctx.args[0]) : null; const cur = CUR_YM(); const preYm = ctx.args[1] || ymAdd(cur, -1);
  if (pre) TZ = tzOf(pre);
  const existing = pre ? monthRec(pre.id, preYm) : null;
  const state = { cid: pre ? pre.id : (DB.clients.find((c) => c.active) || {}).id || "", ym: preYm, calls: [], map: {}, headers: [], skipped: [], fileName: "", pdf: null, enquiries: [], enqSkipped: [], enqFile: "" };
  const ymOpts = []; for (let i = 0; i < 12; i++) ymOpts.push(ymAdd(cur, -i));
  const pts = existing && existing.points ? existing.points : [];
  app().innerHTML = topBar({ title: "Upload a month", sub: pre ? h(pre.business_name) : "Pick a partner", back: pre ? `/admin/client/${pre.id}` : "/admin" }) + `<div class="shell">
  <div class="steps"><i class="on"></i><i id="s2"></i><i id="s3"></i></div>
  <div class="card"><div class="two"><label class="fld" style="margin-top:0"><span>Partner</span><select id="u-cid">${DB.clients.filter((c) => c.active || c.id === state.cid).map((c) => `<option value="${c.id}" ${state.cid === c.id ? "selected" : ""}>${h(c.business_name)}${c.active ? "" : " (past partner)"}</option>`).join("")}</select></label><label class="fld" style="margin-top:0"><span>Month (for the notes below)</span><select id="u-ym">${ymOpts.map((y) => `<option value="${y}" ${y === state.ym ? "selected" : ""}>${ymLabel(y)}</option>`).join("")}</select></label></div>
  ${client(state.cid) ? (client(state.cid).active ? `<label class="fld"><span>Start date (their first day of leads)</span><input id="u-start" type="date" value="${h(client(state.cid).started_on || "")}"><div class="hint">Saved as you change it. Anything before this date is left out on upload.</div></label>` : `<div class="two"><label class="fld"><span>Start date</span><input id="u-start" type="date" value="${h(client(state.cid).started_on || "")}"></label><label class="fld"><span>Last day</span><input id="u-end" type="date" value="${h(client(state.cid).churned_on || "")}"></label></div><div class="hint">Past partner. Saved as you change them. Only leads between these dates are imported, so the next partner's calls stay off this record.</div>`) : ""}
  ${existing ? `<p class="small mt12" style="color:var(--ink-2)">${ymLabel(existing.ym)} already has data (${existing.status}). Upload as often as you like: new calls are added, calls already here are refreshed, and the partner's tags are kept. Notes below are pre-filled.</p>` : ""}</div>
  <div class="sec"><div class="sec-h"><h2>1 · Nimbata call export</h2><button id="u-sample">Use sample CSV</button></div>
  <label class="drop" id="drop"><b>Drop the CSV here or tap to choose</b>Nimbata → Call log → Export. Columns are matched automatically (date, caller, duration, outcome, recording, AI summary, value, keyword…).<input type="file" id="u-file" accept=".csv,text/csv,.txt,.tsv"></label>
  <details class="mt8"><summary>Or paste the CSV text</summary><textarea id="u-paste" class="mt8" style="width:100%;min-height:90px;font:12px ui-monospace,Menlo,monospace;padding:10px;border:1px solid var(--rule);border-radius:10px;background:var(--card)" placeholder="Date,Time,Caller,Call Duration,Outcome,..."></textarea><button class="btn ghost sm mt8" id="u-parse">Parse pasted text</button></details>
  <div id="u-preview"></div>
  <label class="switch hidden" id="u-allwrap" style="margin-top:10px;border-top:0;padding:8px 0 0"><div><b style="font-size:13.5px">Import every month in this file</b><small id="u-allhint">The file covers more than one month. Each call goes to its own month automatically.</small></div><button type="button" class="tog on" id="u-all" aria-label="toggle"></button></label>
  <label class="switch" style="margin-top:10px;border-top:0;padding:8px 0 0"><div><b style="font-size:13.5px">Replace instead of adding</b><small>Only tick this if the file is complete and you want calls that aren't in it removed. Tags are still kept on matching calls.</small></div><button type="button" class="tog" id="u-replace" aria-label="toggle"></button></label>
  <div class="sec-h" style="margin-top:16px"><h2 style="font-size:14.5px">Web enquiries CSV (optional)</h2></div>
  <label class="drop" id="drop-enq" style="padding:14px 16px"><b style="font-size:14px">Drop an enquiries file here</b>For enquiries that came in by email before the landing page was connected. Columns: Date, Name, Phone, Suburb, Message, Urgent, Page. Every month in the file is imported.<input type="file" id="u-enqfile" accept=".csv,text/csv,.txt,.tsv"></label>
  <div id="u-enqpreview"></div>
  <div id="u-startnote"></div>
  <div id="u-backfill"></div>
  <p class="small muted mt8">No CSV? You can still publish the notes on their own, or just save the ad spend.</p></div>
  <div class="sec"><div class="sec-h"><h2>2 · Notes for the partner</h2><button id="u-copy">${ICON.copy} Copy summary for Claude</button></div>
  <div class="card"><label class="fld" style="margin-top:0"><span>Summary (plain English, like a text to a mate)</span><textarea id="u-sum" placeholder="A steady month. 22 leads, inside the plan. The one thing to work on is...">${h(existing ? existing.summary : "")}</textarea></label>
  ${[0, 1, 2].map((i) => `<label class="fld"><span>What I'm changing · ${i + 1}</span><input id="u-pt${i}" placeholder="Title, e.g. Missed call follow-up" value="${h(pts[i] ? pts[i].title : "")}"><textarea id="u-pb${i}" class="mt8" style="min-height:64px" placeholder="One or two sentences.">${h(pts[i] ? pts[i].body : "")}</textarea></label>`).join("")}
  <div class="two mt12"><label class="fld" style="margin-top:0"><span>Google Ads spend (admin only)</span><input id="u-ad" type="number" inputmode="decimal" placeholder="e.g. 702" value="${existing && existing.ad_spend != null ? existing.ad_spend : ""}"><div class="hint">Never shown to the partner unless their toggle is on.</div></label><label class="fld" style="margin-top:0"><span>PDF report (optional)</span><input id="u-pdf" type="file" accept="application/pdf"><div class="hint">${existing && existing.pdf_path ? "A PDF is already attached; choose a file to replace it." : "From the lead-report skill."}</div></label></div></div></div>
  <div class="sec"><div class="sec-h"><h2>3 · Publish</h2></div><div class="card"><div class="switch"><div><b>Email the partner when published</b><small>"Your ${ymLabel(state.ym, false)} results are in" with a login link.</small></div><button class="tog on" id="u-mail" aria-label="toggle"></button></div>
  <div class="btn-row mt12"><button class="btn ghost" id="u-draft">${existing && existing.status === "published" ? "Save (no email)" : "Save draft"}</button><button class="btn primary" id="u-pub">${existing && existing.status === "published" ? "Publish again" : "Publish to partner"}</button></div><p class="small muted mt12" id="u-msg">${existing && existing.status === "published" ? "This month is already live for the partner. Save keeps it live and skips the email; Publish again re-sends it." : ""}</p></div></div></div>`;
  const prev = $("u-preview");
  if (client(state.cid) && !client(state.cid).active) [$("u-sum"), $("u-pub")].forEach((x) => x && x.closest(".sec").classList.add("hidden"));
  const renderPreview = () => {
    if (!state.headers.length) { prev.innerHTML = ""; $("s2").classList.remove("on"); return; }
    const sm = importSummary(state.calls); const other = Object.keys(sm.byYm).filter((y) => y !== state.ym); const inMonth = state.calls.filter((c) => c.ym === state.ym).length;
    const fields = [["datetime", "Date / time"], ["time", "Time"], ["caller", "Caller"], ["duration", "Duration"], ["outcome", "Outcome"], ["recording", "Recording"], ["summary", "AI summary"], ["value", "Estimate"], ["keyword", "Keyword"], ["campaign", "Campaign"], ["city", "City"], ["notes", "Notes"], ["callId", "Call ID"], ["source", "Source"]];
    const months = Object.keys(sm.byYm).sort();
    $("u-allwrap").classList.toggle("hidden", months.length < 2);
    if (months.length >= 2) $("u-allhint").textContent = `${months.length} months in this file: ${months.map((y) => `${ymLabel(y, false)} (${sm.byYm[y]})`).join(", ")}. Each call goes to its own month. Notes below are for ${ymLabel(state.ym, false)} only.`;
    prev.innerHTML = `<div class="card mt12"><div class="row"><div class="grow"><b style="font-size:15px">${h(state.fileName || "Pasted CSV")}</b><div class="small muted">${state.headers.length} columns · ${state.calls.length} calls parsed${state.skipped.length ? ` · ${state.skipped.length} rows skipped (no date)` : ""}${state.utc ? " · times converted from UTC" : ""}${skipText(state.left) ? ` · left out: ${skipText(state.left)}` : ""}</div></div><span class="chip ${months.length > 1 ? "blue" : "good"}">${months.length > 1 ? `${months.length} months` : "Looks good"}</span></div>
    ${other.length ? `<p class="small mt8" style="color:var(--ink-2)">${months.map((y) => `${ymLabel(y, false)}: ${sm.byYm[y]}`).join(" · ")}. With "Import every month" on, all of them load; off, only the ${inMonth} ${ymLabel(state.ym, false)} rows do.</p>` : ""}
    <div class="kpis" style="margin-top:12px"><div class="kpi"><div class="l">Calls</div><div class="v">${sm.n}</div></div><div class="kpi"><div class="l">Missed</div><div class="v">${sm.missed}<small>${pct(sm.missed, sm.n)}%</small></div></div><div class="kpi"><div class="l">Avg answered</div><div class="v">${dur(sm.avg)}</div></div><div class="kpi"><div class="l">Recordings</div><div class="v">${sm.recordings}</div></div></div>
    <details class="mt12"><summary>Column mapping</summary><div class="map mt8">${fields.map(([f, l]) => `<div class="${state.map[f] !== undefined ? "ok" : ""}"><span>${l}</span><span>${state.map[f] !== undefined ? h(state.headers[state.map[f]]) : "not found"}</span></div>`).join("")}</div></details>
    <details class="mt8"><summary>First rows</summary><div class="tbl-wrap mt8"><table class="tbl"><tr><th>When</th><th>Caller</th><th class="r">Dur</th><th>Outcome</th><th>Rec</th></tr>${state.calls.slice(0, 6).map((c) => `<tr><td>${fmtDate(c.called_at)} ${fmtTime(c.called_at)}</td><td>${h(c.caller_number)}</td><td class="r">${durShort(c.duration_sec)}</td><td>${c.outcome}</td><td>${c.recording_url ? "✓" : ""}</td></tr>`).join("")}</table></div></details></div>`;
    $("s2").classList.add("on");
  };
  // ---- start date: what's in range, the note, and the one-tap fix ----
  const startMs = () => { const c = client(state.cid); const sd = String((c && c.started_on) || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return null; const [y, m, d] = sd.split("-").map(Number); return zonedToUtc(y, m, d, 0, 0, 0, tzOf(c)); };
  const leaveOutPre = () => !!($("u-pre") && $("u-pre").classList.contains("on"));
  const endMs = () => { const c = client(state.cid); if (!c || c.active) return null; const sd = String(c.churned_on || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return null; const [y, m, d] = sd.split("-").map(Number); return zonedToUtc(y, m, d + 1, 0, 0, 0, tzOf(c)); };
  const inRange = (iso) => { if (!leaveOutPre()) return true; const t = new Date(iso).getTime(); const s0 = startMs(), e0 = endMs(); return (s0 == null || t >= s0) && (e0 == null || t < e0); };
  const useCalls = () => state.calls.filter((x) => inRange(x.called_at));
  const useEnq = () => state.enquiries.filter((x) => inRange(x.received_at));
  const setEnd = async (day) => { const c = client(state.cid); if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return; if (c.started_on && day < c.started_on) { toast("The last day is before the start date", true); return; } try { const saved = await api.updateClient(c.id, { churned_on: day }); c.churned_on = (saved && saved.churned_on) || day; if ($("u-end")) $("u-end").value = c.churned_on; toast(`Last day set to ${fmtCal(c.churned_on)}`); renderStartNote(); } catch (ex) { toast(ex.message, true); } };
  const setStart = async (day) => { const c = client(state.cid); if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return; if (!c.active && c.churned_on && day > c.churned_on) { toast("The start date is after their last day", true); return; } try { const saved = await api.updateClient(c.id, { started_on: day }); c.started_on = (saved && saved.started_on) || day; if ($("u-start")) $("u-start").value = c.started_on; toast(`Start date set to ${fmtCal(c.started_on)}`); renderStartNote(); } catch (ex) { toast(ex.message, true); } };
  const renderStartNote = () => {
    const el = $("u-startnote"); const c = client(state.cid); if (!el) return;
    const s0 = startMs(), e0 = endMs();
    const times = [...state.calls.map((x) => x.called_at), ...state.enquiries.map((x) => x.received_at)].map((x) => new Date(x).getTime()).sort((a, b) => a - b);
    const pre = s0 == null ? 0 : times.filter((x) => x < s0).length; const post = e0 == null ? 0 : times.filter((x) => x >= e0).length; const out = pre + post;
    if (!c || !out) { el.innerHTML = ""; renderBackfill(); return; }
    const allOut = out === times.length; const tz = tzOf(c); const firstDay = ymdOf(new Date(times[0]), tz); const lastDay = ymdOf(new Date(times[times.length - 1]), tz);
    const who = c.contact_name ? `${h(c.contact_name)}'s` : "their"; const past = e0 != null;
    const title = past ? (allOut ? `Everything uploaded is outside ${who} dates (${fmtCal(c.started_on)} to ${fmtCal(c.churned_on)})` : `${out} lead${out === 1 ? " falls" : "s fall"} outside ${who} dates (${fmtCal(c.started_on)} to ${fmtCal(c.churned_on)})`)
      : (allOut ? `Everything uploaded is from before ${who} start date (${fmtCal(c.started_on)})` : `${pre} lead${pre === 1 ? " is" : "s are"} from before ${who} start date (${fmtCal(c.started_on)})`);
    const parts = [pre ? `${pre} before the start date` : "", post ? `${post} after the last day` : ""].filter(Boolean).join(" and ");
    const body = allOut ? (past ? "If the dates are wrong, fix them and the months line up." : "If they started earlier, set the start date to their first lead and the months line up.") : `${past ? parts.charAt(0).toUpperCase() + parts.slice(1) + ". " : ""}Those are most likely another partner's, so they're left out. Switch it off to keep them.`;
    el.innerHTML = `<div class="card mt8" style="background:var(--gold-bg);border-color:#F3DDA8;padding:12px 14px"><b style="font-size:14px;color:var(--gold-ink)">${title}</b><p class="small mt8" style="color:var(--gold-ink);line-height:1.45">${body}</p>${allOut && pre ? `<button class="btn ghost sm mt8" type="button" id="u-fixstart">Start from ${fmtCal(firstDay)}, the first lead</button>` : ""}${allOut && post ? `<button class="btn ghost sm mt8" type="button" id="u-fixend">End on ${fmtCal(lastDay)}, the last lead</button>` : ""}<label class="switch" style="margin-top:8px;border-top:0;padding:6px 0 0"><div><b style="font-size:13px">${past ? "Leave out leads outside their dates" : "Leave out leads from before the start date"}</b></div><button type="button" class="tog ${allOut ? "" : "on"}" id="u-pre" aria-label="toggle"></button></label></div>`;
    $("u-pre").onclick = (e) => { e.currentTarget.classList.toggle("on"); renderBackfill(); };
    const fs = $("u-fixstart"); if (fs) fs.onclick = () => setStart(firstDay);
    const fe = $("u-fixend"); if (fe) fe.onclick = () => setEnd(lastDay);
    renderBackfill();
  };
  // ---- one button: import everything and publish a report for each finished month ----
  const renderBackfill = () => {
    const el = $("u-backfill"); const c = client(state.cid); if (!el) return; if (!c) { el.innerHTML = ""; return; }
    const curYm = CUR_YM(); const by = {}; useCalls().forEach((x) => (by[x.ym] = (by[x.ym] || 0) + 1)); useEnq().forEach((x) => (by[x.ym] = (by[x.ym] || 0) + 1));
    if (!c.active) {
      const all = Object.keys(by).sort(); const n = all.reduce((a, y) => a + by[y], 0); if (!n) { el.innerHTML = ""; return; }
      const succ = DB.clients.find((x) => x.predecessor_id === c.id);
      el.innerHTML = `<div class="card mt12" style="border:1.5px solid var(--blue);background:var(--card)"><b style="font-size:15px">Import ${h(c.business_name)}'s history</b><p class="small mt8" style="color:var(--ink-2);line-height:1.5">${all.map((y) => `${ymLabel(y, false)} (${by[y]} lead${by[y] === 1 ? "" : "s"})`).join(" · ")}.</p><p class="small mt8" style="color:var(--ink-2);line-height:1.5">${succ ? `${h(succ.contact_name || succ.business_name)} will see these months as "before you" totals: leads, calls, web enquiries and answer rate.` : `Link them from the current partner's Settings, Took over from, and that partner sees these months as "before you" totals.`} Callers, recordings and names stay on this record only. Nothing is sent to anyone.</p><button class="btn primary mt12" type="button" id="u-hist-go">Import ${n} lead${n === 1 ? "" : "s"}</button></div>`;
      $("u-hist-go").onclick = () => importHistory(); return;
    }
    const yms = Object.keys(by).filter((y) => y < curYm).sort();
    if (!(yms.length >= 2 || (yms.length === 1 && yms[0] !== state.ym))) { el.innerHTML = ""; return; }
    const done = yms.filter((y) => keepReport(monthRec(c.id, y))); const todo = yms.filter((y) => !done.includes(y));
    el.innerHTML = `<div class="card mt12" style="border:1.5px solid var(--blue);background:var(--card)"><b style="font-size:15px">Create a report for every month</b><p class="small mt8" style="color:var(--ink-2);line-height:1.5">${yms.map((y) => `${ymLabel(y, false)} (${by[y]} lead${by[y] === 1 ? "" : "s"})`).join(" · ")}.</p><p class="small mt8" style="color:var(--ink-2);line-height:1.5">Each month gets its own published report: leads, calls, web enquiries, a week-by-week split and a summary written from the numbers, so ${h(c.contact_name || "the partner")} can look back through them.${todo.includes(state.ym) ? ` ${ymLabel(state.ym, false)} uses your notes below if you've written them.` : ""}${done.length ? ` ${done.map((y) => ymLabel(y, false)).join(", ")} already ${done.length === 1 ? "has a report or notes" : "have reports or notes"} and won't change.` : ""} ${ymLabel(curYm, false)} stays as "this month so far". No emails are sent.</p><button class="btn primary mt12" type="button" id="u-backfill-go" ${todo.length ? "" : "disabled"}>${todo.length ? `Import and create ${todo.length} report${todo.length === 1 ? "" : "s"}` : "Every month already has a report"}</button></div>`;
    const b = $("u-backfill-go"); if (b) b.onclick = () => backfill(todo);
  };
  const ingest = (text, name) => { const rows = parseCSV(text); if (rows.length < 2) { toast("Couldn't read that file", true); return; } state.headers = rows[0]; state.map = mapColumns(rows[0]); state.utc = timesLookUtc(rows, state.map); const r = rowsToCalls(rows, state.map, { utc: state.utc }); state.calls = r.calls; state.skipped = r.skipped; state.left = r.left; state.fileName = name || ""; renderPreview(); renderStartNote(); toast(`${state.calls.length} calls parsed`); };
  $("u-cid").onchange = (e) => go(`/admin/upload/${e.target.value}/${state.ym}`);
  $("u-ym").onchange = (e) => go(`/admin/upload/${state.cid}/${e.target.value}`);
  $("u-file").onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => ingest(t, f.name)); };
  const enqPrev = $("u-enqpreview");
  const ingestEnq = (text, name) => { const rows = parseCSV(text); if (rows.length < 2) { toast("Couldn't read that file", true); return; } const map = mapEnqColumns(rows[0]); const r = rowsToEnquiries(rows, map); state.enquiries = r.enquiries; state.enqSkipped = r.skipped; state.enqFile = name || ""; const by = {}; r.enquiries.forEach((x) => (by[x.ym] = (by[x.ym] || 0) + 1));
    enqPrev.innerHTML = `<div class="card mt8" style="padding:12px 14px"><div class="row"><div class="grow"><b style="font-size:14px">${h(state.enqFile)}</b><div class="small muted">${r.enquiries.length} enquiries${r.skipped.length ? ` · ${r.skipped.length} rows skipped (no date)` : ""} · ${Object.keys(by).sort().map((y) => `${ymLabel(y, false)} ${by[y]}`).join(" · ")}</div></div><span class="chip ${map.phone !== undefined && map.datetime !== undefined ? "good" : "warn"}">${map.phone !== undefined && map.datetime !== undefined ? "Looks good" : "Check columns"}</span></div></div>`; renderStartNote(); toast(`${r.enquiries.length} enquiries parsed`); };
  $("u-enqfile").onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => ingestEnq(t, f.name)); };
  const dropE = $("drop-enq"); ["dragenter", "dragover"].forEach((ev) => dropE.addEventListener(ev, (e) => { e.preventDefault(); dropE.classList.add("on"); })); ["dragleave", "drop"].forEach((ev) => dropE.addEventListener(ev, (e) => { e.preventDefault(); dropE.classList.remove("on"); })); dropE.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => ingestEnq(t, f.name)); });
  const drop = $("drop"); ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("on"); })); ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("on"); })); drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => ingest(t, f.name)); });
  $("u-parse").onclick = () => ingest($("u-paste").value, "Pasted CSV");
  $("u-sample").onclick = () => { const [y, m] = state.ym.split("-"); const csv = SAMPLE_CSV.replace(/\{M\}/g, m).replace(/\{Y\}/g, y); $("u-paste").value = csv; $("u-paste").closest("details").open = true; ingest(csv, "nimbata-sample.csv"); };
  $("u-pdf").onchange = (e) => (state.pdf = e.target.files[0] || null);
  $("u-mail").onclick = (e) => e.currentTarget.classList.toggle("on");
  $("u-replace").onclick = (e) => e.currentTarget.classList.toggle("on");
  $("u-all").onclick = (e) => e.currentTarget.classList.toggle("on");
  const us = $("u-start"); if (us) us.onchange = (e) => setStart(e.target.value);
  const ue = $("u-end"); if (ue) ue.onchange = (e) => setEnd(e.target.value);
  $("u-copy").onclick = () => { const c = client(state.cid); const inMonth = state.calls.filter((x) => x.ym === state.ym); const sm = importSummary(inMonth.length ? inMonth : DB.calls.filter((x) => x.client_id === state.cid && x.ym === state.ym).map((x) => ({ ...x, recording_url: x.recording_url }))); const enq = DB.enquiries.filter((x) => x.client_id === state.cid && x.ym === state.ym).length; const ad = $("u-ad").value;
    const kws = [...new Set((inMonth.length ? inMonth : DB.calls.filter((x) => x.client_id === state.cid && x.ym === state.ym)).map((x) => x.keyword).filter(Boolean))].slice(0, 5);
    const src = inMonth.length ? inMonth : DB.calls.filter((x) => x.client_id === state.cid && x.ym === state.ym);
    const sums = src.filter((x) => x.summary).slice(0, 15).map((x) => `- ${fmtDate(x.called_at)}: ${String(x.summary).slice(0, 160)}`);
    copyText(`Lead report notes for ${c.business_name} (${c.contact_name}), ${c.niche}, ${c.region}. ${ymLabel(state.ym)}. Plan ${c.package_name} ${money(c.monthly_fee)}/mo, target ${c.lead_target_min}-${c.lead_target_max}.\nCalls ${sm.n}, missed ${sm.missed} (${pct(sm.missed, sm.n)}%), avg answered ${dur(sm.avg)}, web enquiries ${enq}, total leads ${sm.n + enq}${ad ? `, ad spend $${ad}` : ""}.\nTop keywords: ${kws.join(", ") || "n/a"}.${sums.length ? `\nCall summaries:\n${sums.join("\n")}` : ""}\nWrite the client summary (2-3 sentences, plain English, like a text to a mate) and three "what I'm changing" points with a title and one or two sentences each.`, "Copied. Paste it to Claude."); };
  const collect = () => ({ summary: $("u-sum").value.trim(), points: [0, 1, 2].map((i) => ({ title: $("u-pt" + i).value.trim(), body: $("u-pb" + i).value.trim() })).filter((p) => p.title || p.body), adSpend: $("u-ad").value === "" ? null : Number($("u-ad").value) || 0 });
  const importData = async (allMonths, msg) => {
    const calls = useCalls(); const enq = useEnq(); let note = "";
    const groups = {}; (allMonths ? calls : calls.filter((x) => x.ym === state.ym)).forEach((x) => { const { ym, ...r } = x; (groups[ym] ||= []).push(r); });
    const yms = Object.keys(groups).sort(); let tIns = 0, tUpd = 0;
    for (const y of yms) { msg.textContent = `Importing ${groups[y].length} calls for ${ymLabel(y, false)}…`; const r = $("u-replace").classList.contains("on") ? await api.replaceMonthCalls(state.cid, y, groups[y]) : await api.mergeMonthCalls(state.cid, y, groups[y]); tIns += r.inserted; tUpd += r.updated; }
    if (yms.length) note = yms.length > 1 ? ` · ${yms.length} months: ${tIns} calls new, ${tUpd} refreshed` : ` · ${tIns} new, ${tUpd} refreshed`;
    if (enq.length) { msg.textContent = `Importing ${enq.length} enquiries…`; const r = await api.mergeEnquiries(state.cid, enq.map(({ ym, ...e }) => e)); note += ` · ${r.inserted} enquiries new, ${r.updated} refreshed`; }
    const left = state.calls.length - calls.length + state.enquiries.length - enq.length; if (left) note += endMs() == null ? ` · ${left} from before the start date left out` : ` · ${left} outside their dates left out`;
    return note;
  };
  const importHistory = async () => { const b = $("u-hist-go"); b.disabled = true; try { const note = await importData(true, b); await ensureClient(state.cid, true); await refreshAdmin(); DB.history = {}; toast(`History imported${note}`); setTimeout(() => go(`/admin/client/${state.cid}`), 800); } catch (ex) { toast(ex.message, true); b.disabled = false; b.textContent = "Try again"; } };
  const backfill = async (todo) => {
    const c = client(state.cid); const msg = $("u-msg"); const n = collect(); const btns = ["u-backfill-go", "u-draft", "u-pub"].map((id) => $(id)).filter(Boolean);
    btns.forEach((b) => b.setAttribute("disabled", ""));
    try {
      const importNote = await importData(true, msg);
      await ensureClient(state.cid, true); await refreshAdmin();
      const made = [];
      for (const y of todo) {
        msg.textContent = `Creating the ${ymLabel(y)} report…`;
        const old = monthRec(c.id, y); const mine = y === state.ym && n.summary;
        const month = await api.upsertMonth({ client_id: c.id, ym: y, status: "published", summary: mine ? n.summary : autoSummary(c, y), points: mine ? n.points : (old && old.points) || [], published_at: new Date().toISOString() });
        if (y === state.ym && n.adSpend != null) await api.setAdSpend(month.id, n.adSpend);
        made.push(y);
      }
      await refreshAdmin(); $("s3").classList.add("on");
      toast(`${made.length} report${made.length === 1 ? "" : "s"} created: ${made.map((y) => MON[+y.split("-")[1] - 1]).join(", ")}${importNote}`);
      setTimeout(() => go(`/admin/client/${state.cid}`), 900);
    } catch (ex) { msg.textContent = ""; toast(ex.message, true); btns.forEach((b) => b.removeAttribute("disabled")); }
  };
  const commit = async (status) => {
    const c = client(state.cid); const n = collect(); const msg = $("u-msg");
    if (!c) { toast("Add a partner first", true); return; }
    if (status === "published" && !n.summary) { toast("Add a summary before publishing", true); $("u-sum").focus(); return; }
    const wasPublished = !!(existing && existing.status === "published"); const clicked = status;
    if (status === "draft" && wasPublished) status = "published"; // never unpublish by saving
    $("u-draft").setAttribute("disabled", ""); $("u-pub").setAttribute("disabled", ""); msg.textContent = "Saving…";
    try {
      const row = { client_id: state.cid, ym: state.ym, status, summary: n.summary, points: n.points };
      if (clicked === "published") row.published_at = new Date().toISOString();
      if (state.pdf) { msg.textContent = "Uploading PDF…"; row.pdf_path = await api.uploadPdf(state.cid, state.ym, state.pdf); }
      const month = await api.upsertMonth(row);
      if (n.adSpend != null) await api.setAdSpend(month.id, n.adSpend);
      const allMonths = !$("u-allwrap").classList.contains("hidden") && $("u-all").classList.contains("on");
      const importNote = await importData(allMonths, msg);
      await ensureClient(state.cid, true); await refreshAdmin();
      $("s3").classList.add("on");
      let mailNote = "";
      if (clicked === "published" && $("u-mail").classList.contains("on")) { msg.textContent = "Sending email…"; const st = monthStats(c, state.ym); try { const r = await api.publishEmail({ client_id: state.cid, ym: state.ym, leads: st.leads, calls: st.calls, enquiries: st.enq, missed_rate: st.missedRate, won_value: st.wonValue }); mailNote = r.demo ? " · email skipped (demo)" : " · email sent"; } catch (ex) { mailNote = " · email not sent: " + ex.message; } }
      toast(clicked === "published" ? `Published to ${c.contact_name}${importNote}${mailNote}` : `Saved${importNote}`, /not sent/.test(mailNote));
      setTimeout(() => go(`/admin/client/${state.cid}`), 700);
    } catch (ex) { msg.textContent = ""; toast(ex.message, true); $("u-draft").removeAttribute("disabled"); $("u-pub").removeAttribute("disabled"); }
  };
  $("u-draft").onclick = () => commit("draft"); $("u-pub").onclick = () => commit("published");
}
// ───────────────────────────── Billing + slots ─────────────────────────────
// Each partner is invoiced monthly from their billing start (blank = start date): Month 1 on that day,
// Month 2 a month later, and so on, each invoice due on its month's first day. Extending a month
// (lead target missed) makes that month longer and moves every later invoice back by the same days.
const GST_RATE = { NZ: 0.15, AU: 0.1 };
const GST_FROM = Object.assign({ NZ: null, AU: null }, CFG.gstFrom || {}); // registration day per country (config.js)
// What an invoice dated `day` comes to: fee + GST once registered; the fee as the whole amount on an old
// flat-price contract (GST included once registered) up to its last day; and no GST before registering.
function invoiceAmount(c, ex, day) {
  const from = GST_FROM[c.country]; const reg = !!from && day >= from; const flat = isYmd(c.flat_until) && day <= String(c.flat_until).slice(0, 10);
  if (flat) return { total: ex, text: `${amt(ex)} flat${reg ? " incl. GST" : ""}` };
  if (reg) { const total = Math.round(ex * (1 + (GST_RATE[c.country] ?? 0.15)) * 100) / 100; return { total, text: `${amt(ex)} + GST = ${amt(total)}` }; }
  return { total: ex, text: `${amt(ex)}, no GST` };
}
const BULK_PAID = /^(Paid before the portal|Marked paid in bulk)$/; // amounts on these were filled in, not typed
const isWaived = (pay) => !!pay && /^Waived/.test(pay.note || ""); // a month that isn't owed: notice given, extended, under-delivered
const flatReady = () => DEMO || DB.clients.some((c) => "flat_until" in c);
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || ""));
const ymdAddDays = (s, n) => { const d = new Date(String(s).slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ymdAddMonths = (s, n) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); const last = new Date(Date.UTC(y, m + n, 0, 12)).getUTCDate(); return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last), 12)).toISOString().slice(0, 10); };
const daysFrom = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T12:00:00Z") - new Date(String(a).slice(0, 10) + "T12:00:00Z")) / 864e5);
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const fmtShort = (s) => (isYmd(s) ? new Date(String(s).slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-NZ", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }) : "–");
const amt = (n) => money(n, Number(n) % 1 ? 2 : 0);
const dayWord = (n) => `${n} day${n === 1 ? "" : "s"}`;
const billingReady = () => DEMO || (!DB.billingErr && DB.clients.some((c) => "setup_fee" in c));
function billingPlan(c, B = DB.billing) {
  if (!c) return null;
  const anchor = isYmd(c.billing_start) ? String(c.billing_start).slice(0, 10) : isYmd(c.started_on) ? String(c.started_on).slice(0, 10) : "";
  if (!anchor) return null;
  const today = ymdOf(new Date(), tzOf(c));
  const exts = (B.extensions || []).filter((x) => x.client_id === c.id); const pays = (B.payments || []).filter((p) => p.client_id === c.id);
  const days = (B.leadDays || []).filter((d) => d.client_id === c.id);
  const lastDay = !c.active && isYmd(c.churned_on) ? String(c.churned_on).slice(0, 10) : "";
  const base = (Number(c.monthly_fee) || 0) + (Number(c.extra_fee) || 0);
  const months = []; let shift = 0;
  for (let no = 1; no <= 240; no++) {
    const start = ymdAddDays(ymdAddMonths(anchor, no - 1), shift);
    if (lastDay && start > lastDay) break;
    const mx = exts.filter((x) => Number(x.month_no) === no); const ext = mx.reduce((a, x) => a + (Number(x.days) || 0), 0);
    const next = ymdAddDays(ymdAddMonths(anchor, no), shift + ext); const ex = base + (no === 1 ? Number(c.setup_fee) || 0 : 0);
    months.push({ no, start, next, end: ymdAddDays(next, -1), ext, exts: mx, ex, inc: invoiceAmount(c, ex, start).total, amtText: invoiceAmount(c, ex, start).text, pay: pays.find((p) => Number(p.month_no) === no) || null,
      leads: days.filter((d) => d.day >= start && d.day < next).reduce((a, d) => a + (Number(d.leads) || 0), 0) });
    shift += ext;
    if (start > today) break; // stop after the first month that hasn't started
  }
  const unpaid = months.filter((m) => !m.pay && m.start <= today); const late = unpaid.filter((m) => m.start < today);
  return { anchor, today, months, unpaid, late, cur: months.find((m) => m.start <= today && today < m.next) || null, upcoming: months.find((m) => m.start > today) || null,
    owed: unpaid.reduce((a, m) => a + m.inc, 0), lateAmt: late.reduce((a, m) => a + m.inc, 0), lateDays: late.length ? daysFrom(late[0].start, today) : 0 };
}
function billStatus(c, p) {
  if (!p) return { cls: "", l: "No billing date" };
  if (p.late.length) return { cls: "bad", l: `${amt(p.lateAmt)} overdue · ${dayWord(p.lateDays)}` };
  if (p.unpaid.length) return { cls: "warn", l: `Month ${p.unpaid[0].no} due today` };
  if (c.active && p.upcoming) { const d = daysFrom(p.today, p.upcoming.start); return { cls: d <= 7 ? "warn" : "good", l: `Paid up · next in ${dayWord(d)}` }; }
  return { cls: "good", l: "Paid up" };
}
const billSetupNote = () => `<div class="card mt12" style="background:var(--warn-bg);border-color:#F3DDA8"><b style="color:var(--warn)">One-off update needed in Supabase</b><p class="small mt8" style="line-height:1.5">Open Supabase → SQL Editor, paste all of <b>app/supabase/add-billing.sql</b> from GitHub (Raw view) and press Run. Then reload this page.</p><p class="small muted mt8">${h(DB.billingErr || "")}</p></div>`;
function billCard(c, p, full) {
  const trade = nicheWord(c.niche); const min = Number(c.lead_target_min) || 0; const st = billStatus(c, p);
  if (!p) return `<div class="card mt12" data-bill="${c.id}"><b>${h(c.business_name)}</b><p class="small muted mt8">No start date, so no billing dates. Set one in Settings.</p></div>`;
  if (!p.months.length) return `<div class="card mt12" data-bill="${c.id}"><b>${h(c.business_name)}</b><p class="small muted mt8">Finished before their billing start (${fmtCal(p.anchor)}), so no invoices.</p></div>`;
  const { cur, upcoming: up } = p; const ref = up || cur || p.months[p.months.length - 1];
  const out = []; const row = (l, r, style = "") => `<div class="rpt-k" style="${style}"><span>${l}</span><b style="text-align:right">${r}</b></div>`;
  p.unpaid.forEach((m) => out.push(row(`Month ${m.no} · ${m.start < p.today ? `due ${fmtShort(m.start)}, ${dayWord(daysFrom(m.start, p.today))} late` : "due today"}`, `${amt(m.inc)}<br><button class="btn ghost sm" type="button" data-pay="${m.no}" style="margin-top:4px">Mark paid</button>`, "color:var(--bad)")));
  if (p.unpaid.length >= 2) { const upto = p.unpaid[p.unpaid.length - 2].no, many = upto > p.unpaid[0].no; out.push(`<div class="small mt8" style="line-height:1.45">${many ? `Months ${p.unpaid[0].no}–${upto} aren't` : `Month ${upto} isn't`} marked paid. Paid before the portal? <button class="btn ghost sm" type="button" data-payall="${upto}">Mark ${many ? "them" : "it"} paid</button></div>`); }
  if (c.active && up) out.push(row(`Next invoice · Month ${up.no}`, `${fmtShort(up.start)} <span class="muted small">in ${dayWord(daysFrom(p.today, up.start))}</span><br><span class="small">${up.amtText}</span>`));
  if (c.active && cur) { const left = daysFrom(p.today, cur.next), len = daysFrom(cur.start, cur.next); const behind = min && cur.leads < min * ((len - left) / len);
    out.push(row(`Month ${cur.no} so far<br><span class="small muted">${fmtCal(cur.start)} to ${fmtCal(cur.end)}${cur.ext ? ` · ${cur.ext} extra days` : ""}</span>`, `<span style="color:${behind ? "var(--warn)" : "inherit"}">${cur.leads}${min ? ` of ${min}` : ""} leads</span><br><span class="small muted">${dayWord(left)} left</span>`)); }
  const short = p.months.filter((m) => m.next <= p.today && min && m.leads < min && !m.ext).pop();
  if (c.active && short && (!cur || short.no === cur.no - 1)) out.push(`<div class="small mt8" style="color:var(--warn);line-height:1.45">Month ${short.no} finished on ${short.leads} of ${min} leads (uploaded so far). <button class="btn ghost sm" type="button" data-ext="${short.no}">Extend it</button></div>`);
  const exts = p.months.flatMap((m) => m.exts.map((x) => ({ ...x, no: m.no })));
  if (exts.length) out.push(`<div class="small mt8" style="line-height:1.6">${exts.map((x) => `<div>Month ${x.no} ran <b>${dayWord(Number(x.days))}</b> longer${x.reason ? ` · ${h(x.reason)}` : ""}${x.created_at ? ` <span class="muted">(${fmtDate(x.created_at)})</span>` : ""} <button class="btn ghost sm" type="button" data-unext="${x.id}" style="padding:2px 8px" aria-label="Remove extension">×</button></div>`).join("")}</div>`);
  const hist = full ? `<details class="mt12"><summary class="small" style="font-weight:600">Every month (${p.months.length})</summary>${p.months.slice().reverse().map((m) => row(`Month ${m.no}<br><span class="small muted">${fmtCal(m.start)} to ${fmtCal(m.end)}${m.ext ? ` · +${dayWord(m.ext)}` : ""} · ${m.leads} lead${m.leads === 1 ? "" : "s"}</span>`, `<span class="small">${amt(m.inc)}</span><br>${isWaived(m.pay) ? `<span class="small muted">Waived${m.pay.note.length > 6 ? ` (${h(m.pay.note.replace(/^Waived:?\s*/, ""))})` : ""}</span> <button class="btn ghost sm" type="button" data-unpay="${m.pay.id}" style="padding:2px 8px">Undo</button>` : m.pay ? `<span class="small" style="color:var(--good)">Paid${!BULK_PAID.test(m.pay.note || "") && Math.abs(Number(m.pay.amount) - m.inc) > 0.5 ? ` ${amt(m.pay.amount)}` : ""} ${fmtCal(m.pay.paid_on)}</span> <button class="btn ghost sm" type="button" data-unpay="${m.pay.id}" style="padding:2px 8px">Undo</button>` : m.start > p.today ? `<span class="small muted">Upcoming</span>` : `<span class="small" style="color:var(--bad)">Not paid</span>`}`)).join("")}</details>` : "";
  const extra = Number(c.extra_fee) ? ` · incl. ${h(c.extra_label || "extra")} ${money(c.extra_fee)}` : "";
  return `<div class="card mt12" data-bill="${c.id}"><div class="row"><div class="grow"><a href="#/admin/client/${c.id}" style="color:inherit;text-decoration:none"><b style="font-size:15px">${h(c.business_name)}</b></a><div class="small muted">${h(c.region)} ${h(trade)} · ${c.active ? (cur ? `Month ${cur.no}` : "starts " + fmtCal(p.anchor)) : "past partner"} · invoiced on the ${ordinal(+ref.start.slice(8, 10))}${extra}</div></div><span class="chip ${st.cls}"><i></i>${st.l}</span></div>
    ${out.join("")}
    ${c.active ? `<div class="btn-row mt12"><button class="btn ghost sm" type="button" data-ext="${cur ? cur.no : 1}" style="flex:1">Extend a month</button>${up && !p.unpaid.length ? `<button class="btn ghost sm" type="button" data-pay="${up.no}" style="flex:1">Month ${up.no} paid early</button>` : ""}</div>` : ""}
    <div data-form></div>${hist}</div>`;
}
const payForm = (m, p) => `<div class="card mt8" style="border-color:var(--blue)"><b style="font-size:14px">Month ${m.no} payment</b><div class="two"><label class="fld"><span>Paid on</span><input type="date" name="paid_on" value="${p.today}"></label><label class="fld"><span>Amount incl. GST</span><input type="number" name="amount" step="0.01" value="${m.inc}"></label></div><label class="fld"><span>Note (optional)</span><input name="note" placeholder="e.g. bank transfer, or why it's waived"></label><div class="btn-row mt12"><button class="btn ghost sm" type="button" data-cancel style="flex:1">Cancel</button><button class="btn primary sm" type="button" data-savepay="${m.no}" style="flex:1">Save payment</button></div><button class="btn ghost sm mt8" type="button" data-waive="${m.no}" style="width:100%">Not owed: waive Month ${m.no}</button><p class="small muted mt8" style="line-height:1.45">Waive a month they gave notice for, one you extended or cancelled, or one you under-delivered on. It stops showing as overdue and shows as waived.</p></div>`;
function extForm(c, p, no) {
  const min = Number(c.lead_target_min) || 0; const opts = p.months.filter((m) => m.start <= p.today).slice(-3); const m = opts.find((x) => x.no === no) || opts[opts.length - 1];
  if (!m) return `<p class="small muted mt8">Month 1 hasn't started yet.</p>`;
  return `<div class="card mt8" style="border-color:var(--blue)"><b style="font-size:14px">Extend a month</b><p class="small muted mt8" style="line-height:1.45">That month runs longer and every later invoice moves back by the same number of days.</p><div class="two"><label class="fld"><span>Month</span><select name="month">${opts.map((x) => `<option value="${x.no}" ${x.no === m.no ? "selected" : ""}>Month ${x.no} · ${x.leads}${min ? ` of ${min}` : ""} leads</option>`).join("")}</select></label><label class="fld"><span>Extra days</span><input type="number" name="days" min="1" max="120" value="7"></label></div><div class="btn-row" style="margin-top:8px">${[3, 7, 14].map((d) => `<button class="btn ghost sm" type="button" data-days="${d}" style="flex:1">${d} days</button>`).join("")}</div><label class="fld"><span>Reason</span><input name="reason" value="${h(min && m.leads < min ? `Under target: ${m.leads} of ${min} leads` : "")}" placeholder="e.g. under target, campaign paused"></label><div class="btn-row mt12"><button class="btn ghost sm" type="button" data-cancel style="flex:1">Cancel</button><button class="btn primary sm" type="button" data-saveext style="flex:1">Extend</button></div></div>`;
}
function bindBilling(root, after) {
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); const card = e.target.closest("[data-bill]"); if (!b || !card) return;
    const c = client(card.dataset.bill); const p = billingPlan(c); if (!c || !p) return; const box = card.querySelector("[data-form]"); const val = (n) => { const el = box.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ""; };
    const save = async (fn, msg) => { b.disabled = true; try { await fn(); await loadBilling(); toast(msg); after(); } catch (ex) { toast(ex.message, true); b.disabled = false; } };
    if (b.dataset.pay) { box.innerHTML = payForm(p.months.find((m) => m.no === +b.dataset.pay), p); return; }
    if (b.dataset.ext) { box.innerHTML = extForm(c, p, +b.dataset.ext); return; }
    if (b.hasAttribute("data-cancel")) { box.innerHTML = ""; return; }
    if (b.dataset.days) { box.querySelector('[name="days"]').value = b.dataset.days; return; }
    if (b.dataset.savepay) { const no = +b.dataset.savepay; return save(() => api.savePayments([{ client_id: c.id, month_no: no, amount: Number(val("amount")) || 0, paid_on: val("paid_on") || p.today, note: val("note") }]), `Month ${no} marked paid`); }
    if (b.dataset.waive) { const no = +b.dataset.waive; return save(() => api.savePayments([{ client_id: c.id, month_no: no, amount: 0, paid_on: p.today, note: "Waived" + (val("note") ? `: ${val("note")}` : "") }]), `Month ${no} waived`); }
    if (b.dataset.payall) { const ms = p.unpaid.filter((m) => m.no <= +b.dataset.payall); return save(() => api.savePayments(ms.map((m) => ({ client_id: c.id, month_no: m.no, amount: m.inc, paid_on: m.start, note: "Marked paid in bulk" }))), `${ms.length} month${ms.length === 1 ? "" : "s"} marked paid`); }
    if (b.hasAttribute("data-saveext")) { const no = +val("month"), days = Math.round(Number(val("days"))); if (!(days >= 1 && days <= 120)) { toast("Pick 1 to 120 days", true); return; } return save(() => api.addExtension({ client_id: c.id, month_no: no, days, reason: val("reason") }), `Month ${no} extended by ${dayWord(days)}`); }
    if (b.dataset.unext) { if (!confirm("Remove this extension? Later invoice dates move forward again.")) return; return save(() => api.deleteExtension(b.dataset.unext), "Extension removed"); }
    if (b.dataset.unpay) { if (!confirm("Mark this month as not paid?")) return; return save(() => api.deletePayment(b.dataset.unpay), "Payment removed"); }
  });
}
// First time on the Billing page nothing is marked paid. Partners with no payment recorded yet get one
// setup list: ticked partners have every invoice before their latest marked paid (past partners: all of them).
const hasPaid = (cid) => (DB.billing.payments || []).some((x) => x.client_id === cid);
const billingSetupList = () => DB.clients.map((c) => ({ c, p: billingPlan(c) })).filter(({ c, p }) => p && !hasPaid(c.id) && p.unpaid.length >= (c.active ? 2 : 1));
const setupMonths = ({ c, p }) => (c.active ? p.unpaid.slice(0, -1) : p.unpaid);
// Billing file: one row per invoice (Partner, Invoice date, Status Paid/Waived, Paid on, Amount, Note), e.g. one Claude
// builds from bank statements. Each row lands on the partner's billing month that starts nearest its invoice date, so
// it lines up with your own billing dates; a preview shows every row before anything is saved.
const BILL_COLS = { partner: ["partner", "business", "businessname", "client"], invoice: ["invoicedate", "invoice", "duedate", "due", "covers", "month"], status: ["status"], paid: ["paidon", "datepaid", "paid", "date"], amount: ["amount", "paidamount", "total"], note: ["note", "notes", "reason"] };
function readBillingFile(text) {
  const data = parseCSV(text); if (data.length < 2) throw new Error("Couldn't read that file");
  const hd = data[0].map(norm); const col = {}; const used = new Set();
  for (const [k, al] of Object.entries(BILL_COLS)) { const i = hd.findIndex((x, ix) => !used.has(ix) && al.includes(x)); if (i >= 0) { col[k] = i; used.add(i); } }
  if (col.partner === undefined || col.invoice === undefined) throw new Error("The file needs Partner and Invoice date columns");
  const g = (r, k) => (col[k] === undefined ? "" : String(r[col[k]] ?? "").trim());
  return data.slice(1).filter((r) => r.some((x) => String(x).trim())).map((r) => ({ partner: g(r, "partner"), invoice: isoDay(g(r, "invoice")), waived: /waiv|write|not owed/i.test(g(r, "status")), paidOn: isoDay(g(r, "paid")), amount: Number(g(r, "amount").replace(/[^0-9.-]/g, "")) || 0, note: g(r, "note") }));
}
const findPartner = (name) => { const n = norm(name); if (!n) return null; return DB.clients.find((c) => norm(c.business_name) === n) || DB.clients.find((c) => norm(c.business_name).includes(n) || n.includes(norm(c.business_name))) || null; };
function planBillingFile(rows, picks) {
  const out = rows.map((r) => { const c = r.partner in picks ? client(picks[r.partner]) : findPartner(r.partner); const p = c && billingPlan(c); let m = null, gap = Infinity;
    if (p && r.invoice) p.months.forEach((x) => { const d = Math.abs(daysFrom(x.start, r.invoice)); if (d < gap) { gap = d; m = x; } });
    const ok = !!m && gap <= 20; return { ...r, c, m: ok ? m : null, why: !c ? "partner not found" : !r.invoice ? "no invoice date" : !ok ? `no billing month near ${fmtCal(r.invoice)}` : "" }; });
  const seen = {}; out.forEach((r) => { if (!r.m) return; const k = r.c.id + "|" + r.m.no; if (seen[k]) { seen[k].why = `two rows land on Month ${r.m.no}; the later one is used`; seen[k].m = null; } seen[k] = r; });
  return out;
}
function bindBillingFile() {
  const inp = $("bf-file"), prev = $("bf-prev"); if (!inp) return; let rows = [], picks = {};
  const draw = () => { const plan = planBillingFile(rows, picks); const go = plan.filter((r) => r.m); const groups = {}; plan.forEach((r) => (groups[r.partner] ||= []).push(r));
    prev.innerHTML = `${Object.entries(groups).map(([name, rs]) => { const c = rs[0].c; return `<div style="border-top:1px solid var(--rule);padding:10px 0"><div class="row"><div class="grow"><b style="font-size:14px">${h(c ? c.business_name : name)}</b>${c && norm(c.business_name) !== norm(name) ? ` <span class="small muted">(file: ${h(name)})</span>` : ""}</div></div>
      ${!c || name in picks ? `<label class="fld" style="margin-top:4px"><span>${c ? "Matched to" : `"${h(name)}" isn't a partner. Pick one or skip`}</span><select data-pick="${h(name)}"><option value="">Skip these rows</option>${DB.clients.map((x) => `<option value="${x.id}" ${c && c.id === x.id ? "selected" : ""}>${h(x.business_name)}</option>`).join("")}</select></label>` : ""}
      ${rs.map((r) => `<div class="small mt8" style="display:flex;justify-content:space-between;gap:10px;${r.m ? "" : "color:var(--warn)"}"><span>${r.m ? `Month ${r.m.no} · ${fmtCal(r.m.start)}` : h(r.why)}</span><span style="text-align:right">${r.waived ? `Waived${r.note ? ` · ${h(r.note)}` : ""}` : `Paid ${r.paidOn ? fmtCal(r.paidOn) : ""} · ${amt(r.amount || (r.m ? r.m.inc : 0))}${r.note ? `<br><span class="muted">${h(r.note)}</span>` : ""}`}${r.m && r.m.pay ? `<br><span class="muted">replaces what's marked now</span>` : ""}</span></div>`).join("")}</div>`; }).join("")}
      <button class="btn primary mt12" type="button" id="bf-go" ${go.length ? "" : "disabled"}>Apply ${go.length} row${go.length === 1 ? "" : "s"}</button>${plan.length - go.length ? `<p class="small muted mt8">${plan.length - go.length} row${plan.length - go.length === 1 ? "" : "s"} will be skipped (shown in orange).</p>` : ""}`;
    prev.querySelectorAll("[data-pick]").forEach((sel) => (sel.onchange = () => { picks[sel.dataset.pick] = sel.value; draw(); }));
    $("bf-go").onclick = async (e) => { const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Saving…";
      try { await api.savePayments(go.map((r) => ({ client_id: r.c.id, month_no: r.m.no, amount: r.waived ? 0 : r.amount || r.m.inc, paid_on: r.paidOn || r.invoice || ymdOf(new Date()), note: r.waived ? "Waived" + (r.note ? `: ${r.note}` : "") : r.note || "From billing file" })));
        await loadBilling(); toast(`${go.length} invoices updated`); renderBilling(); } catch (ex) { toast(ex.message, true); btn.disabled = false; btn.textContent = `Apply ${go.length} rows`; } }; };
  const load = (f) => f && f.text().then((t) => { try { rows = readBillingFile(t); picks = {}; draw(); } catch (ex) { toast(ex.message, true); } });
  inp.onchange = () => load(inp.files[0]); const zone = inp.closest(".drop");
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("on"); })); ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("on"); })); zone.addEventListener("drop", (e) => load(e.dataTransfer.files[0]));
}
function renderBilling() {
  const rows = DB.clients.map((c) => ({ c, p: billingPlan(c) })).filter((x) => x.c.active || (x.p && x.p.unpaid.length));
  const rank = (x) => (!x.p ? 1e7 : x.p.late.length ? -1e6 - x.p.lateDays : x.p.unpaid.length ? -1e5 : x.c.active && x.p.upcoming ? daysFrom(x.p.today, x.p.upcoming.start) : 1e6);
  rows.sort((a, b) => rank(a) - rank(b) || a.c.business_name.localeCompare(b.c.business_name));
  const late = rows.filter((x) => x.p && x.p.late.length); const soon = rows.filter((x) => x.p && x.c.active && ((x.p.unpaid.length && !x.p.late.length) || (x.p.upcoming && daysFrom(x.p.today, x.p.upcoming.start) <= 7)));
  const soonAmt = soon.reduce((a, x) => a + (x.p.unpaid.length && !x.p.late.length ? x.p.unpaid[0].inc : x.p.upcoming.inc), 0);
  const monthly = rows.filter((x) => x.c.active).reduce((a, x) => a + (x.p && x.p.upcoming ? x.p.upcoming.inc : 0), 0);
  const setup = DB.billingErr ? [] : billingSetupList();
  app().innerHTML = topBar({ title: "Billing", sub: "Who's due, who's paid, extended months", back: "/admin" }) + `<div class="shell">
  ${DB.billingErr ? billSetupNote() : ""}
  <div class="kpis"><div class="kpi"><div class="l">Overdue</div><div class="v" style="color:${late.length ? "var(--bad)" : "inherit"}">${amt(late.reduce((a, x) => a + x.p.lateAmt, 0))}</div><div class="d flat">${late.length} partner${late.length === 1 ? "" : "s"}</div></div><div class="kpi"><div class="l">Due in the next 7 days</div><div class="v">${amt(soonAmt)}</div><div class="d flat">${soon.length} invoice${soon.length === 1 ? "" : "s"}</div></div><div class="kpi"><div class="l">Monthly invoicing</div><div class="v">${amt(monthly)}</div><div class="d flat">next invoices, all in · ${rows.filter((x) => x.c.active).length} partners</div></div></div>
  ${setup.length ? `<div class="card mt12" style="border:1.5px solid var(--blue)"><b style="font-size:15px">Set up billing (one time)</b><p class="small mt8" style="line-height:1.5">Nothing is marked paid yet, so old invoices look overdue. <b>Untick anyone who still owes you money.</b> Everyone ticked has their old invoices marked paid, dated the day each was due. Current partners keep their latest invoice open for you to tick off; past partners are cleared completely.</p>
    <div class="mt8">${setup.map((x) => { const ms = setupMonths(x); return `<label class="rpt-k" style="cursor:pointer;align-items:center"><span><input type="checkbox" data-setup="${x.c.id}" checked style="margin-right:8px;transform:scale(1.2)">${h(x.c.business_name)}${x.c.active ? "" : ` <span class="muted small">(past)</span>`}<br><span class="small muted" style="margin-left:26px">${ms.length === 1 ? `Month ${ms[0].no}` : `Months ${ms[0].no}–${ms[ms.length - 1].no}`} paid${x.c.active ? ` · Month ${x.p.unpaid[x.p.unpaid.length - 1].no} (${fmtCal(x.p.unpaid[x.p.unpaid.length - 1].start)}) left open` : ""}</span></span><b class="small">${amt(ms.reduce((a, m) => a + m.inc, 0))}</b></label>`; }).join("")}</div>
    <button class="btn primary mt12" type="button" id="b-setup">Mark the ticked ones paid</button></div>` : ""}
  <div id="bill-root">${rows.map((x) => billCard(x.c, x.p, false)).join("") || `<div class="empty mt12">No partners yet.</div>`}</div>
  ${DB.billingErr ? "" : `<div class="sec"><div class="sec-h"><h2>Upload a billing file</h2></div><div class="card"><p class="small" style="line-height:1.5">A CSV with one row per invoice: <b>Partner, Invoice date, Status</b> (Paid or Waived), <b>Paid on, Amount, Note</b>. Ask Claude to build one from your bank statements. Each row goes on the partner's month that starts nearest its invoice date, and you see every row before anything is saved.</p><label class="drop mt8"><b>Drop the billing file here, or tap to choose</b><input type="file" id="bf-file" accept=".csv,text/csv"></label><div id="bf-prev"></div></div></div>`}
  <p class="small muted mt16" style="line-height:1.5">Each month is invoiced on its first day. Billing starts on the partner's start date unless you set a different billing start in their Settings, where the setup fee and extra charges like a website live too. Lead counts come from the data you've uploaded.</p><div style="height:24px"></div></div>`;
  bindBilling($("bill-root"), () => renderBilling()); bindBillingFile();
  const sb = $("b-setup"); if (sb) sb.onclick = async () => { const on = new Set([...document.querySelectorAll("[data-setup]")].filter((x) => x.checked).map((x) => x.dataset.setup)); const rowsP = setup.filter((x) => on.has(x.c.id)).flatMap((x) => setupMonths(x).map((m) => ({ client_id: x.c.id, month_no: m.no, amount: m.inc, paid_on: m.start, note: "Paid before the portal" })));
    if (!rowsP.length) { toast("Nobody is ticked", true); return; } sb.disabled = true;
    try { await api.savePayments(rowsP); await loadBilling(); toast(`${rowsP.length} old invoices marked paid`); renderBilling(); } catch (ex) { toast(ex.message, true); sb.disabled = false; } };
}

// Slots: every region + trade line, filled or open. Lines that have had a partner appear by themselves;
// add new ones (a roofer line you're about to sell) or hide ones you've dropped.
const TRADE_GROUPS = [["Plumber", "Plumbers"], ["Electrician", "Electricians"], ["Handyman", "Handyman / builder"], ["Builder", "Handyman / builder"], ["Roofer", "Roofers"], ["Locksmith", "Locksmiths"], ["Drainlayer", "Drainlayers"]];
let PREFILL = null; // a slot's region + trade, carried into the new-partner form
function slotLines() {
  const map = new Map(); const key = (country, region, trade) => `${country || "NZ"}|${norm(region)}|${trade}`;
  const line = (country, region, trade) => { const k = key(country, region, trade); if (!map.has(k)) map.set(k, { key: k, region, trade, country: country || "NZ", partners: [], slot: null }); return map.get(k); };
  DB.clients.forEach((c) => line(c.country, c.region, nicheWord(c.niche) || "Other").partners.push(c));
  (DB.billing.slots || []).forEach((s) => (line(s.country, s.region, s.trade).slot = s));
  return [...map.values()].map((L) => { const cur = L.partners.filter((c) => c.active).sort((a, b) => String(b.started_on || "").localeCompare(String(a.started_on || ""))); const past = L.partners.filter((c) => !c.active).sort((a, b) => String(b.churned_on || "").localeCompare(String(a.churned_on || "")));
    return { ...L, cur, last: past[0] || null, hidden: !cur.length && !!L.slot && L.slot.active === false }; });
}
function avgLeads(cid) { const ms = DB.counts.filter((r) => r.client_id === cid).sort((a, b) => (a.ym < b.ym ? -1 : 1)); const full = ms.length > 2 ? ms.slice(1, -1) : ms; return full.length ? Math.round(full.reduce((a, r) => a + r.leads, 0) / full.length) : 0; }
function renderSlots() {
  const lines = slotLines(); const shown = lines.filter((L) => !L.hidden); const open = shown.filter((L) => !L.cur.length); const ready = billingReady() && !DB.billingErr;
  const groups = []; TRADE_GROUPS.forEach(([t, label]) => { let g = groups.find((x) => x.label === label); if (!g) groups.push((g = { label, trades: [] })); g.trades.push(t); });
  const known = TRADE_GROUPS.map(([t]) => t); const other = [...new Set(shown.map((L) => L.trade).filter((t) => !known.includes(t)))]; if (other.length) groups.push({ label: "Other", trades: other });
  const place = (L) => `${h(L.region)}${L.country === "AU" ? " <span class=\"chip\">AU</span>" : ""}`;
  const lineRow = (L) => { if (L.cur.length) return L.cur.map((c) => { const p = billingPlan(c); const st = billStatus(c, p); return `<div class="rpt-k"><span><b>${place(L)}</b><br><span class="small muted">${h(c.contact_name || "")}${c.contact_name ? " · " : ""}<a href="#/admin/client/${c.id}">${h(c.business_name)}</a></span></span><b class="small" style="text-align:right">since ${fmtCal(c.started_on)}${p && p.upcoming ? `<br>next invoice ${fmtShort(p.upcoming.start)}` : ""}${st.cls === "bad" ? `<br><span style="color:var(--bad)">${st.l}</span>` : ""}</b></div>`; }).join("");
    const since = L.last && isYmd(L.last.churned_on) ? ymdAddDays(L.last.churned_on, 1) : L.slot ? String(L.slot.created_at || "").slice(0, 10) : ""; const avg = L.last ? avgLeads(L.last.id) : 0;
    return `<div class="rpt-k"><span><b>${place(L)}</b> <span class="chip warn">Open</span><br><span class="small muted">${isYmd(since) ? `open ${dayWord(Math.max(0, daysFrom(since, ymdOf(new Date()))))}` : "never filled"}${L.last ? ` · ${h(L.last.business_name)} left ${fmtCal(L.last.churned_on)}${avg ? `, was getting ~${avg} leads a month` : ""}` : ""}</span></span><b style="text-align:right;white-space:nowrap"><button class="btn primary sm" type="button" data-fill="${h(L.key)}">Fill</button>${ready ? ` <button class="btn ghost sm" type="button" data-hide="${h(L.key)}">Hide</button>` : ""}</b></div>`; };
  const hidden = lines.filter((L) => L.hidden);
  app().innerHTML = topBar({ title: "Slots", sub: `${shown.length - open.length} filled · ${open.length} open`, back: "/admin" }) + `<div class="shell" id="slots-root">
  ${DB.billingErr ? billSetupNote() : ""}
  ${groups.map((g) => { const ls = shown.filter((L) => g.trades.includes(L.trade)).sort((a, b) => Number(!a.cur.length) - Number(!b.cur.length) || a.region.localeCompare(b.region)); if (!ls.length) return ""; const o = ls.filter((L) => !L.cur.length).length; return `<div class="sec"><div class="sec-h"><h2>${g.label}</h2><span class="small muted">${ls.length - o} filled${o ? ` · ${o} open` : ""}</span></div><div class="card">${ls.map(lineRow).join("")}</div></div>`; }).join("")}
  ${ready ? `<div class="sec"><div class="sec-h"><h2>Add a slot</h2></div><div class="card"><p class="small muted" style="line-height:1.45">A region and trade you sell that hasn't had a partner yet. It shows as open until someone takes it.</p><div class="two"><label class="fld"><span>Trade</span><select id="sl-trade">${["Plumber", "Electrician", "Handyman", "Builder", "Roofer", "Locksmith", "Drainlayer"].map((t) => `<option>${t}</option>`).join("")}</select></label><label class="fld"><span>Country</span><select id="sl-country"><option>NZ</option><option>AU</option></select></label></div><label class="fld"><span>Region</span><input id="sl-region" placeholder="e.g. Auckland"></label><button class="btn ghost mt12" type="button" id="sl-add">Add slot</button></div></div>` : ""}
  ${hidden.length ? `<details class="mt16"><summary class="small" style="font-weight:600">Hidden slots (${hidden.length})</summary><div class="card mt8">${hidden.map((L) => `<div class="rpt-k"><span>${place(L)} ${h(L.trade)}</span><b><button class="btn ghost sm" type="button" data-show="${h(L.key)}">Show again</button></b></div>`).join("")}</div></details>` : ""}
  <div style="height:24px"></div></div>`;
  const byKey = (k) => lines.find((L) => L.key === k);
  const saveSlot = async (b, s, msg) => { b.disabled = true; try { await api.saveSlot(s); await loadBilling(); toast(msg); renderSlots(); } catch (ex) { toast(ex.message, true); b.disabled = false; } };
  $("slots-root").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const L = byKey(b.dataset.fill || b.dataset.hide || b.dataset.show || "");
    if (b.dataset.fill && L) { PREFILL = { region: L.region, niche: portalNiche(L.trade), country: L.country, timezone: tzForRegion(L.region, L.country), predecessor: L.last ? L.last.id : "" }; go("/admin/newclient"); }
    else if (b.dataset.hide && L) saveSlot(b, { region: L.region, trade: L.trade, country: L.country, active: false }, `${L.region} ${L.trade} hidden`);
    else if (b.dataset.show && L) saveSlot(b, { region: L.region, trade: L.trade, country: L.country, active: true }, `${L.region} ${L.trade} is back`);
    else if (b.id === "sl-add") { const region = $("sl-region").value.trim(); if (!region) { toast("Add the region", true); return; } saveSlot(b, { region, trade: $("sl-trade").value, country: $("sl-country").value, active: true }, `${region} ${$("sl-trade").value} added`); } });
}

// ───────────────────────────── Bulk data import ─────────────────────────────
// Drop any number of Nimbata exports and web-enquiry files. Each file (or each tracking number /
// project / landing page inside it) is matched to a landing page (region + trade), and every call or
// enquiry goes to the partner who held that landing page on that date (their start date to last day).
const lineKeyOf = (region, niche) => norm(region) + "|" + nicheWord(niche);
function partnerLines() {
  const lines = {};
  DB.clients.forEach((c) => {
    const k = lineKeyOf(c.region, c.niche); const tz = tzOf(c);
    const day = (d, plus) => { const [y, m, dd] = String(d).split("-").map(Number); return zonedToUtc(y, m, dd + (plus || 0), 0, 0, 0, tz); };
    const s = /^\d{4}-\d{2}-\d{2}/.test(c.started_on || "") ? day(c.started_on) : -Infinity;
    const e = !c.active && /^\d{4}-\d{2}-\d{2}/.test(c.churned_on || "") ? day(c.churned_on, 1) : Infinity;
    (lines[k] ||= { key: k, region: c.region, niche: nicheWord(c.niche), tz, partners: [] }).partners.push({ c, s, e });
  });
  Object.values(lines).forEach((l) => { l.partners.sort((a, b) => a.s - b.s); l.label = `${l.region} · ${l.niche}`; l.who = l.partners.map((p) => `${p.c.business_name}${p.c.active ? "" : " (past)"}`).join(" → "); });
  return lines;
}
function renderImport() {
  const lines = partnerLines(); const lineList = Object.values(lines).sort((a, b) => a.label.localeCompare(b.label));
  const files = []; let done = false; let reports = true;
  const mainTz = (() => { const n = {}; lineList.forEach((l) => (n[l.tz] = (n[l.tz] || 0) + l.partners.length)); return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || "Pacific/Auckland"; })();
  const SPLIT_PRI = [/project/, /trackingnumbername|trackingname|numbername|campaignname/, /landingpage|^page$|website|site/, /campaign/, /trackingnumber|tracking|dialednumber|tonumber/, /destination|forward/];
  const words = (x) => String(x || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const PLAIN = new Set([..."electrical electrics electric electrician electricians plumbing plumber plumbers services service builders builds building build construction maintenance renovation renovations reno ltd limited nz co the and developments development solutions group trade trades handyman property south north east west".split(" "), ...lineList.flatMap((l) => words(l.region))]);
  // who = the text is a "Destination Name" (who answered), so a partner's distinctive business word or first name counts too.
  // A tie between landing pages is a guess, not a match, so it's left for Joe to pick.
  const guessLine = (text, who) => { const t = norm(text); const d = String(text || "").replace(/\D/g, ""); const tw = new Set(words(text)); let best = null, score = 0, tie = false;
    lineList.forEach((l) => { let sc = 0; const r = norm(l.region); if (r && t.includes(r)) sc += r.length; if (sc && t.includes(norm(l.niche))) sc += 5;
      l.partners.forEach((p) => { if (norm(p.c.business_name).length > 3 && t.includes(norm(p.c.business_name))) sc += 50; const ph = String(p.c.phone || "").replace(/\D/g, "").slice(-8); if (ph.length >= 7 && d.includes(ph)) sc += 50; if (p.c.email && String(text).toLowerCase().includes(p.c.email.toLowerCase())) sc += 50;
        if (who) { const bw = words(p.c.business_name).filter((w) => w.length >= 3 && !PLAIN.has(w)); if (bw.length && bw.every((w) => tw.has(w))) sc += 40; const fn = words(p.c.contact_name)[0]; if (fn && fn.length >= 3 && tw.has(fn)) sc += 20; } });
      if (sc > score) { score = sc; best = l; tie = false; } else if (sc && sc === score) tie = true; });
    return best && !tie ? best.key : ""; };
  const parseGroup = (f, g) => { const line = lines[g.line]; const keep = TZ; if (line) TZ = line.tz; try { const data = [f.headers, ...g.idx.map((i) => f.rows[i])];
      return f.kind === "calls" ? rowsToCalls(data, f.map, { utc: f.utc }).calls.map((x) => ({ ...x, t: new Date(x.called_at).getTime() })) : rowsToEnquiries(data, f.map).enquiries.map((x) => ({ ...x, t: new Date(x.received_at).getTime() })); } finally { TZ = keep; } };
  const gapOf = (line, t) => { const prev = line.partners.filter((x) => x.e <= t).sort((a, b) => b.e - a.e)[0]; const next = line.partners.filter((x) => x.s > t).sort((a, b) => a.s - b.s)[0];
    const label = prev && next ? `No partner between ${prev.c.business_name} (last day ${fmtCal(prev.c.churned_on)}) and ${next.c.business_name} (started ${fmtCal(next.c.started_on)})` : next ? `Before ${next.c.business_name} started (${fmtCal(next.c.started_on)})` : prev ? `After ${prev.c.business_name}'s last day (${fmtCal(prev.c.churned_on)}), no partner since` : "No partner";
    return { key: `${prev ? prev.c.id : "-"}|${next ? next.c.id : "-"}`, label }; };
  const assignGroup = (f, g) => { const line = lines[g.line]; const recs = parseGroup(f, g); const by = new Map(); const gaps = new Map(); let out = 0;
    recs.forEach((r) => { const p = line && line.partners.filter((x) => r.t >= x.s && r.t < x.e).sort((a, b) => b.s - a.s)[0];
      if (!p) { out++; if (line) { const gp = gapOf(line, r.t); if (!gaps.has(gp.key)) gaps.set(gp.key, { label: gp.label, n: 0, from: r.t, to: r.t }); const x = gaps.get(gp.key); x.n++; x.from = Math.min(x.from, r.t); x.to = Math.max(x.to, r.t); } return; }
      if (!by.has(p.c.id)) by.set(p.c.id, { c: p.c, recs: [] }); by.get(p.c.id).recs.push(r); });
    const ts = recs.map((r) => r.t).sort((a, b) => a - b); return { by, gaps, out, n: recs.length, from: ts[0], to: ts[ts.length - 1] }; };
  const addFile = (name, text) => { const data = parseCSV(text); if (data.length < 2) { toast(`Couldn't read ${name}`, true); return; } const headers = data[0]; const rows = data.slice(1).filter((r) => r.some((c) => String(c).trim()));
    const cm = mapColumns(headers); const em = mapEnqColumns(headers); const kind = cm.duration !== undefined || (cm.caller !== undefined && em.name === undefined) ? "calls" : "enquiries";
    const nh = headers.map(norm); const iReg = nh.indexOf("region"), iTr = nh.findIndex((h) => h === "trade" || h === "niche");
    let split = -1; if (iReg >= 0 && iTr >= 0) split = -2; else for (const re of SPLIT_PRI) { const i = nh.findIndex((h) => re.test(h)); if (i >= 0) { split = i; break; } }
    const map = kind === "calls" ? cm : em; const left = {}; const keep = [];
    rows.forEach((r, i) => { const why = kind === "calls" ? callSkip(r, map) : ""; if (why) left[why] = (left[why] || 0) + 1; else keep.push(i); });
    const f = { id: "f" + files.length, name, kind, headers, rows, keep, left, map, split, iReg, iTr, utc: kind === "calls" && timesLookUtc([headers, ...rows], map, mainTz), groups: [] }; regroup(f); files.push(f); renderAll(); };
  const regroup = (f) => { const val = (r) => f.split === -2 ? `${String(r[f.iReg] || "").trim()} ${String(r[f.iTr] || "").trim()}`.trim() : f.split >= 0 ? String(r[f.split] || "").trim() : "";
    const m = new Map(); f.keep.forEach((i) => { const v = val(f.rows[i]) || (f.split === -1 ? "Whole file" : "(blank)"); if (!m.has(v)) m.set(v, []); m.get(v).push(i); });
    f.groups = [...m.entries()].map(([value, idx]) => { const key = f.split === -2 ? lineKeyOf(f.rows[idx[0]][f.iReg], f.rows[idx[0]][f.iTr]) : ""; return { value, idx, line: key && lines[key] ? key : guessLine(`${value === "Whole file" || value === "(blank)" ? "" : value} ${f.name}`) }; });
    // One project can hold several partners' calls (early on, every region sat under "New Plymouth"). When the
    // Destination column shows calls going to partners on different landing pages, split the group by who answered.
    const iN = f.map.destName, iD = f.map.destination, iT = f.map.tracking;
    if (f.kind !== "calls" || (iN === undefined && iD === undefined) || f.split === iN || f.split === iD) return;
    const destOf = (r) => [iN, iD].map((ix) => (ix === undefined || blankish(r[ix]) ? "" : String(r[ix]).trim())).filter(Boolean).join(" · ");
    const trk = (r) => (iT === undefined ? "" : String(r[iT] || "").replace(/\D/g, ""));
    f.groups = f.groups.flatMap((g) => {
      const byT = new Map(); g.idx.forEach((i) => { const dv = destOf(f.rows[i]), tv = trk(f.rows[i]); if (dv && tv) { const x = byT.get(tv) || new Map(); x.set(dv, (x.get(dv) || 0) + 1); byT.set(tv, x); } });
      const top = (tv) => { const x = byT.get(tv); return x ? [...x.entries()].sort((a, b) => b[1] - a[1])[0][0] : ""; }; // no destination: whoever that tracking number usually rang
      const buckets = new Map(); g.idx.forEach((i) => { const k = destOf(f.rows[i]) || top(trk(f.rows[i])); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(i); });
      const guess = new Map([...buckets.keys()].map((k) => [k, k ? guessLine(k, true) : ""])); const distinct = new Set([...guess.values()].filter(Boolean));
      if (distinct.size < 2) { if (!g.line && distinct.size === 1) g.line = [...distinct][0]; return [g]; }
      return [...buckets.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, idx]) => ({ value: `${g.value} → ${k ? k.split(" · ")[0] : "no destination"}`, idx, line: guess.get(k) || g.line }));
    }); };
  const fmtD = (t) => (isFinite(t) ? new Date(t).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" }) : "–");

  app().innerHTML = topBar({ title: "Upload data for every partner", sub: "Nimbata exports and web enquiries, all at once", back: "/admin" }) + `<div class="shell">
  <p class="lede" style="margin:16px 0 4px">Each call and enquiry goes to whichever partner had that region and trade on that date, using the start dates and last days you set. Uploading the same files again won't create duplicates.</p>
  <div class="sec"><div class="sec-h"><h2>1 · Files</h2></div><label class="drop" id="i-drop"><b>Drop every file here, or tap to choose</b>Nimbata call exports (one per project or one big export) and web-enquiry files. Pick several at once.<input type="file" id="i-file" accept=".csv,text/csv,.txt,.tsv" multiple></label></div>
  <div id="i-files"></div><div id="i-sum"></div><div style="height:24px"></div></div>`;
  const filesEl = $("i-files"), sumEl = $("i-sum");
  const groupHtml = (f, g, gi) => { const a = assignGroup(f, g); const parts = [...a.by.values()].map((x) => `${h(x.c.business_name)} ${x.recs.length}`);
    return `<div style="border-top:1px solid var(--rule);padding:10px 0"><div class="row"><div class="grow"><b style="font-size:14px">${h(g.value)}</b><div class="small muted">${a.n} ${f.kind === "calls" ? (a.n === 1 ? "call" : "calls") : (a.n === 1 ? "enquiry" : "enquiries")} · ${a.from === a.to ? fmtD(a.from) : `${fmtD(a.from)} to ${fmtD(a.to)}`}</div></div></div>
      <label class="fld" style="margin-top:6px"><span>Landing page</span><select data-file="${f.id}" data-g="${gi}"><option value="">Skip these</option>${lineList.map((l) => `<option value="${l.key}" ${g.line === l.key ? "selected" : ""}>${h(l.label)}: ${h(l.who)}</option>`).join("")}</select></label>
      <div class="small mt8" style="color:${g.line ? "var(--ink-2)" : "var(--warn)"}">${g.line ? (parts.join(" · ") || "No partner had these dates") : "Pick the landing page, or leave it skipped."}</div>
      ${g.line ? [...a.gaps.values()].map((x) => `<div class="small mt8" style="color:var(--warn);line-height:1.45">${h(x.label)}: ${x.n} ${f.kind === "calls" ? "call" : "enquir"}${x.n === 1 ? (f.kind === "calls" ? "" : "y") : (f.kind === "calls" ? "s" : "ies")} (${x.from === x.to ? fmtD(x.from) : `${fmtD(x.from)} to ${fmtD(x.to)}`}), not given to anyone.</div>`).join("") : ""}</div>`; };
  const fileHtml = (f) => { const cols = f.headers.map((hd, i) => [i, hd]);
    return `<div class="card mt12"><div class="row"><div class="grow"><b style="font-size:15px">${h(f.name)}</b><div class="small muted">${f.keep.length} ${f.kind === "calls" ? "calls (Nimbata)" : "web enquiries"}</div></div><button class="btn ghost sm" type="button" data-rm="${f.id}">Remove</button></div>
      <label class="fld"><span>Split by</span><select data-split="${f.id}"><option value="-1" ${f.split === -1 ? "selected" : ""}>Whole file is one landing page</option>${f.iReg >= 0 && f.iTr >= 0 ? `<option value="-2" ${f.split === -2 ? "selected" : ""}>Region + Trade columns</option>` : ""}${cols.map(([i, hd]) => `<option value="${i}" ${f.split === i ? "selected" : ""}>${h(hd)}</option>`).join("")}</select></label>
      ${f.kind === "calls" ? `<label class="fld"><span>Times in this file</span><select data-utc="${f.id}"><option value="1" ${f.utc ? "selected" : ""}>UTC, convert to each partner's time (Nimbata exports)</option><option value="0" ${f.utc ? "" : "selected"}>Already local NZ / AU time</option></select></label>` : ""}
      ${skipText(f.left) ? `<p class="small muted mt8" style="line-height:1.45">Left out: ${skipText(f.left)}. They aren't leads.</p>` : ""}
      ${f.groups.map((g, gi) => groupHtml(f, g, gi)).join("")}</div>`; };
  const plan = () => { const per = new Map(); files.forEach((f) => f.groups.forEach((g) => { if (!g.line) return; const a = assignGroup(f, g); a.by.forEach((x, id) => { if (!per.has(id)) per.set(id, { c: x.c, calls: [], enq: [] }); per.get(id)[f.kind === "calls" ? "calls" : "enq"].push(...x.recs); }); })); return per; };
  const renderSum = () => { if (!files.length) { sumEl.innerHTML = ""; return; } const per = plan(); const list = [...per.values()].sort((a, b) => a.c.business_name.localeCompare(b.c.business_name));
    let gapN = 0; files.forEach((f) => f.groups.forEach((g) => { if (g.line) gapN += assignGroup(f, g).out; }));
    const nC = list.reduce((a, x) => a + x.calls.length, 0), nE = list.reduce((a, x) => a + x.enq.length, 0);
    sumEl.innerHTML = `<div class="sec"><div class="sec-h"><h2>2 · Check and import</h2></div><div class="card">
      ${list.map((x) => { const yms = [...new Set([...x.calls, ...x.enq].map((r) => ymOf(new Date(r.t), tzOf(x.c))))].sort(); return `<div class="rpt-k" data-p="${x.c.id}"><span>${h(x.c.business_name)}${x.c.active ? "" : ` <span class="muted small">(past)</span>`}<br><span class="small muted">${yms.length ? (yms.length === 1 ? ymLabel(yms[0], false) : `${ymLabel(yms[0], false)} to ${ymLabel(yms[yms.length - 1], false)}`) : ""}</span></span><b>${x.calls.length} call${x.calls.length === 1 ? "" : "s"} · ${x.enq.length} web<br><span class="small muted" data-pst>${x.status || ""}</span></b></div>`; }).join("") || `<p class="small muted">Nothing matched yet. Pick a landing page for each file above.</p>`}
      ${gapN ? `<p class="small mt12" style="color:var(--warn);line-height:1.45">${gapN} lead${gapN === 1 ? "" : "s"} fell in periods with no partner and won't be imported. Each gap is listed under its file above. If one is wrong, fix that partner's start date or last day in their Settings and drop the files in again.</p>` : ""}
      <label class="switch mt12" style="border-top:0;padding-top:0"><div><b style="font-size:13.5px">Create a report for every finished month</b><small>For current partners only. Reports the portal wrote are refreshed with the new numbers; anything you wrote yourself is left as it is. No emails are sent.</small></div><button type="button" class="tog ${reports ? "on" : ""}" id="i-rep"></button></label>
      <button class="btn primary mt16" type="button" id="i-go" ${!list.length || done ? "disabled" : ""}>${done ? "Done" : `Import ${nC} calls and ${nE} enquiries`}</button>${done ? `<a class="btn ghost mt12" href="#/admin">Back to partners</a>` : ""}</div></div>`;
    $("i-rep").onclick = (e) => { reports = !e.currentTarget.classList.contains("on"); e.currentTarget.classList.toggle("on", reports); };
    const go = $("i-go"); if (go) go.onclick = run; };
  const renderAll = () => { filesEl.innerHTML = files.length ? `<div class="sec"><div class="sec-h"><h2>${files.length} file${files.length === 1 ? "" : "s"}</h2></div>${files.map(fileHtml).join("")}</div>` : ""; renderSum(); };
  filesEl.addEventListener("change", (e) => { const t = e.target; const f = files.find((x) => x.id === (t.dataset.file || t.dataset.split || t.dataset.utc)); if (!f) return;
    if (t.dataset.split) { f.split = Number(t.value); regroup(f); } else if (t.dataset.utc) f.utc = t.value === "1"; else { f.groups[Number(t.dataset.g)].line = t.value; } renderAll(); });
  filesEl.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (!b) return; const i = files.findIndex((x) => x.id === b.dataset.rm); if (i >= 0) files.splice(i, 1); renderAll(); });
  const take = (list) => Promise.all([...list].map((f) => f.text().then((t) => [f.name, t]))).then((arr) => arr.forEach(([n, t]) => addFile(n, t)));
  $("i-file").onchange = (e) => take(e.target.files);
  const drop = $("i-drop"); ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("on"); })); ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("on"); })); drop.addEventListener("drop", (e) => take(e.dataTransfer.files));

  async function run() {
    const per = [...plan().values()]; const go = $("i-go"); go.disabled = true; go.textContent = "Importing…"; let ok = 0;
    const setSt = (x, txt) => { x.status = txt; const el = sumEl.querySelector(`[data-p="${x.c.id}"] [data-pst]`); if (el) el.textContent = txt; };
    for (const x of per) {
      try {
        const c = x.c; const tz = tzOf(c); const groups = {};
        x.calls.forEach(({ t, ym, ...r }) => { const y = ymOf(new Date(t), tz); (groups[y] ||= []).push(r); });
        let ins = 0, upd = 0;
        for (const y of Object.keys(groups).sort()) { setSt(x, `Calls for ${ymLabel(y, false)}…`); const r = await api.mergeMonthCalls(c.id, y, groups[y]); ins += r.inserted; upd += r.updated; }
        if (x.enq.length) { setSt(x, "Enquiries…"); const r = await api.mergeEnquiries(c.id, x.enq.map(({ t, ym, ...e }) => e)); ins += r.inserted; upd += r.updated; }
        let made = 0;
        if (reports && c.active) {
          await ensureClient(c.id, true); await refreshAdmin(); const keep = TZ; TZ = tz;
          try { const cur = CUR_YM(); const yms = [...new Set([...DB.calls, ...DB.enquiries].filter((r) => r.client_id === c.id && r.ym && r.ym < cur).map((r) => r.ym))].sort();
            for (const y of yms) { const m = monthRec(c.id, y); if (keepReport(m)) continue; setSt(x, `Report for ${ymLabel(y, false)}…`); await api.upsertMonth({ client_id: c.id, ym: y, status: "published", summary: autoSummary(c, y), points: (m && m.points) || [], published_at: (m && m.published_at) || new Date().toISOString() }); made++; } } finally { TZ = keep; }
        }
        setSt(x, `✓ ${ins} new, ${upd} refreshed${made ? ` · ${made} report${made === 1 ? "" : "s"}` : ""}`); ok++;
      } catch (ex) { setSt(x, `✗ ${netMsg(ex.message)}`); }
    }
    DB.loaded = {}; DB.history = {}; await refreshAdmin(); done = true; renderSum(); per.forEach((x) => setSt(x, x.status));
    toast(`${ok} of ${per.length} partners imported`, ok < per.length);
  }
}

// ───────────────────────────── Bulk add partners ─────────────────────────────
// Joe drops a partner list (CSV), types start dates / last days, and one button creates every
// partner and login. Safe to run again: rows matching an existing partner (email or business) update it.
function loginMessage(name, email, pw) {
  return `Hey ${name || "there"}, your LeadHive portal is live.\n\nLog in: ${PORTAL_URL}\nEmail: ${email || "(add their email)"}\nPassword: ${pw || "(set a password first)"}\n\nYou'll see every call and web enquiry, listen to recordings, and get my monthly notes there. Add it to your home screen and it works like an app, and you can change your password under Account. When a job lands, tap Won on that lead and put in what it was worth. Ongoing or Lost for the rest. Takes seconds and it shows your real return.\n\n${JOE.name}`;
}
const PLANS = { NZ: { Starter: [1500, 15, 25], Growth: [2000, 25, 35] }, AU: { Starter: [1500, 15, 20], Growth: [2200, 25, 35], Dominator: [3400, 40, 60] } };
const BULK_COLS = { business: ["business", "businessname", "company", "partner"], first: ["firstname", "first", "contactfirstname", "contactname", "contact"], last: ["lastname", "last", "surname"], initials: ["initials"], email: ["email", "emailaddress", "login"], phone: ["phone", "mobile", "cell", "phonenumber"], region: ["region", "area", "city", "location"], niche: ["niche", "trade"], country: ["country"], pkg: ["package", "plan"], fee: ["monthlyfee", "fee", "price"], start: ["startdate", "start", "started", "firstday"], end: ["lastday", "enddate", "end", "stopped", "finished"], why: ["whyfinished", "whystopped", "reason", "churnreason"], password: ["password"], startHint: ["starthint"], endHint: ["endhint"], listed: ["status"] };
const nicheWord = (n) => { const t = String(n || "").toLowerCase(); return /electric|sparky/.test(t) ? "Electrician" : /plumb|gas/.test(t) ? "Plumber" : /handy|maint/.test(t) ? "Handyman" : /build|reno/.test(t) ? "Builder" : /lock/.test(t) ? "Locksmith" : /roof/.test(t) ? "Roofer" : /drain/.test(t) ? "Drainlayer" : t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
const portalNiche = (w) => ({ Electrician: "Emergency electrician", Plumber: "Emergency plumber" }[w] || (["Handyman", "Locksmith", "Roofer", "Drainlayer", "Builder"].includes(w) ? w : "Other"));
const tzForRegion = (region, country) => { const r = String(region || "").toLowerCase(); if (country === "AU") { if (/gold coast|townsville|brisbane|cairns|sunshine|toowoomba|queensland|qld/.test(r)) return "Australia/Brisbane"; if (/melbourne|geelong|victoria/.test(r)) return "Australia/Melbourne"; if (/adelaide/.test(r)) return "Australia/Adelaide"; if (/perth/.test(r)) return "Australia/Perth"; return "Australia/Sydney"; } return TZ_FOR[country] || "Pacific/Auckland"; };
const reasonKey = (t) => { const x = String(t || "").toLowerCase(); return /price|cost|afford|money/.test(x) ? "price" : /capac|busy|too much work|full/.test(x) ? "capacity" : /quality|bad lead|leads? (were|was)/.test(x) ? "quality" : /in.?house|themselves/.test(x) ? "in_house" : /season|pause|winter|holiday/.test(x) ? "seasonal" : CHURN_REASONS[x] ? x : "other"; };
const isoDay = (v) => { const t = String(v || "").trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10); const m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (!m) return ""; const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; };
const autoInitials = (r) => ((r.first || r.business || "").trim().charAt(0) + ((r.last || "").trim().charAt(0) || nicheWord(r.niche).charAt(0))).toUpperCase();
const autoPassword = (r) => `${r.first || ""}${r.region || ""}${nicheWord(r.niche)}`.toLowerCase().replace(/[^a-z0-9]/g, "");
const BULK_KEY = "lh-bulk-draft";

function renderBulk() {
  let rows = []; let done = false;
  const today = ymdOf(new Date());
  const existingFor = (r) => DB.clients.find((c) => (r.email && c.email && c.email.toLowerCase() === r.email.toLowerCase()) || norm(c.business_name) === norm(r.business));
  const rowFrom = (o, i) => { const r = { key: "r" + i + "_" + Math.random().toString(36).slice(2, 7), include: true, business: "", first: "", last: "", initials: "", email: "", phone: "", region: "", niche: "", country: "NZ", pkg: "Starter", fee: "", start: "", end: "", why: "", password: "", startHint: "", endHint: "", listed: "", status: "", ...o };
    r.niche = nicheWord(r.niche); r.country = /^au/i.test(r.country) ? "AU" : "NZ"; r.pkg = ["Starter", "Growth", "Dominator", "Custom"].find((p) => p.toLowerCase() === String(r.pkg || "").trim().toLowerCase()) || "Starter";
    r.start = isoDay(r.start); r.end = isoDay(r.end); r.startHint = isoDay(r.startHint); r.endHint = isoDay(r.endHint); r.why = r.why ? reasonKey(r.why) : ""; return r; };
  const save = () => { try { localStorage.setItem(BULK_KEY, JSON.stringify(rows.map(({ password, status, ...r }) => r))); } catch (e) {} };
  const fee = (r) => (r.fee !== "" && r.fee != null ? Number(r.fee) : ((PLANS[r.country] || PLANS.NZ)[r.pkg] || [1500])[0]);
  const pw = (r) => r.password || autoPassword(r);
  const ini = (r) => r.initials || autoInitials(r);
  const isPast = (r) => !!r.end;
  const linkPlan = () => { const groups = {}; rows.filter((r) => r.include && r.start).forEach((r) => { const k = norm(r.region) + "|" + r.niche; (groups[k] ||= []).push(r); }); const links = []; // each partner's predecessor: the most recent one in the same region + trade that started before them and finished by the time they did
    Object.values(groups).forEach((g) => g.forEach((b) => { const c = g.filter((a) => a !== b && a.end && a.start < b.start && (!b.end || a.end <= b.end)).sort((x, y) => (x.end < y.end ? 1 : -1)); if (c.length) links.push([c[0], b]); })); return links; };
  const problems = (r) => { const p = []; if (!r.business) p.push("no business name"); if (!r.region) p.push("no region"); if (!r.niche) p.push("no trade"); if (r.end && r.start && r.end < r.start) p.push("last day is before the start date"); if (r.end && r.end > today) p.push("last day is in the future"); if (!r.start) p.push("no start date"); return p; };
  const warns = (r) => { const w = []; if (!isPast(r) && !r.email) w.push("no email, so no login"); if (!isPast(r) && r.email && pw(r).length < 6) w.push("password under 6 characters"); return w; };

  app().innerHTML = topBar({ title: "Add partners in bulk", sub: "Create every partner and login in one go", back: "/admin" }) + `<div class="shell">
  <div class="sec"><div class="sec-h"><h2>1 · Partner list</h2></div>
  <label class="drop" id="b-drop"><b>Drop the partner list (CSV) here or tap to choose</b>Columns: Business, First name, Last name, Email, Phone, Region, Niche, Country, Package, Monthly fee, Start date, Last day, Why finished. Optional: Initials, Password, Start hint, End hint.<input type="file" id="b-file" accept=".csv,text/csv,.txt"></label>
  <div id="b-restore"></div></div>
  <div id="b-list"></div><div id="b-sum"></div><div style="height:24px"></div></div>`;

  const list = $("b-list"), sum = $("b-sum");
  const card = (r) => { const ex = existingFor(r); const past = isPast(r); const pr = problems(r); const wr = warns(r);
    const chip = !r.include ? `<span class="chip">Skipped</span>` : r.status && r.status.startsWith("✓") ? `<span class="chip good">Saved</span>` : ex ? `<span class="chip blue">Update</span>` : past ? `<span class="chip warn">Past partner</span>` : `<span class="chip good">New</span>`;
    const st = r.status ? r.status : pr.length ? `<span style="color:var(--bad)">Fix: ${pr.join(", ")}</span>` : wr.length ? `<span style="color:var(--warn)">${wr.join(", ")}</span>` : past ? `No login · finished ${fmtCal(r.end)}` : `Login: ${h(r.email)} · ${h(pw(r))}`;
    const fld = (f, label, type = "text", extra = "") => `<label class="fld"><span>${label}</span><input data-f="${f}" type="${type}" value="${h(r[f] ?? "")}" ${extra}></label>`;
    const sel = (f, label, opts) => `<label class="fld"><span>${label}</span><select data-f="${f}">${opts.map(([v, l]) => `<option value="${h(v)}" ${String(r[f]) === String(v) ? "selected" : ""}>${h(l)}</option>`).join("")}</select></label>`;
    return `<div class="card mt12" data-k="${r.key}" style="${r.include ? "" : "opacity:.6"}"><div class="row"><div class="grow"><b style="font-size:15px">${h(r.business || "(no business name)")}</b><div class="small muted" data-meta>${h([r.first, r.last].filter(Boolean).join(" ") || "no contact")} · ${h(r.region || "no region")} ${h(r.niche)} · ${r.country} · ${h(ini(r))}</div></div>${chip}<button type="button" class="tog ${r.include ? "on" : ""}" data-f="include" aria-label="include"></button></div>
      <div class="two mt8"><label class="fld" style="margin-top:0"><span>Start date</span><input data-f="start" type="date" value="${h(r.start)}">${r.startHint ? `<div class="hint">First lead seen ${fmtCal(r.startHint)}</div>` : ""}</label><label class="fld" style="margin-top:0"><span>Last day</span><input data-f="end" type="date" value="${h(r.end)}" max="${today}"><div class="hint">${r.endHint ? `Last lead seen ${fmtCal(r.endHint)}. ` : ""}Blank if still with you.</div></label></div>
      ${past ? sel("why", "Why they finished", [["", "Pick a reason"], ...Object.entries(CHURN_REASONS)]) : ""}
      <div class="small mt8" data-st>${st}</div>
      <details class="mt8"><summary class="small">Details: name, login, phone, plan</summary>
        ${fld("business", "Business name")}<div class="two">${fld("first", "First name")}${fld("last", "Last name")}</div>
        <div class="two">${fld("email", "Email (their login)", "email")}${fld("phone", "Mobile", "tel")}</div>
        <div class="two">${fld("region", "Region")}${sel("niche", "Trade", ["Electrician", "Plumber", "Handyman", "Builder", "Locksmith", "Roofer", "Drainlayer"].map((x) => [x, x]))}</div>
        <div class="two">${sel("country", "Country", [["NZ", "NZ"], ["AU", "AU"]])}${sel("pkg", "Package", ["Starter", "Growth", "Dominator", "Custom"].map((x) => [x, x]))}</div>
        <div class="two">${fld("fee", "Monthly fee", "number", `placeholder="${fee({ ...r, fee: "" })}"`)}${fld("initials", "Initials", "text", `placeholder="${h(autoInitials(r))}" maxlength="3"`)}</div>
        ${fld("password", "Password", "text", `placeholder="${h(autoPassword(r))}" autocomplete="off"`)}
      </details></div>`; };
  const renderSummary = () => {
    const inc = rows.filter((r) => r.include); if (!rows.length) { sum.innerHTML = ""; return; }
    const bad = inc.filter((r) => problems(r).length); const links = linkPlan();
    const nNew = inc.filter((r) => !existingFor(r)).length, nUpd = inc.length - nNew, nPast = inc.filter(isPast).length, nLogin = inc.filter((r) => !isPast(r) && r.email && pw(r).length >= 6).length;
    const endable = (r, cut) => !r.end && r.endHint && !/^current/i.test(r.listed || "") && (/^past/i.test(r.listed || "") || r.endHint < cut);
    const hinted = rows.filter((r) => (!r.start && r.startHint) || endable(r, ymdOf(new Date(Date.now() - 21 * 864e5)))).length;
    sum.innerHTML = `<div class="sec"><div class="sec-h"><h2>2 · Check and create</h2></div><div class="card">
      ${hinted ? `<button class="btn ghost sm" type="button" id="b-hints" style="margin-bottom:12px">Fill empty dates from the hints (${hinted})</button><p class="small muted" style="margin:-4px 0 12px;line-height:1.45">Uses the first lead seen as the start date. Partners listed as past take their last lead seen as the last day; unlisted ones only when it's more than three weeks old; current ones never. Check each one afterwards.</p>` : ""}
      <div class="rpt-k"><span>New partners</span><b>${nNew}</b></div><div class="rpt-k"><span>Updates to existing partners</span><b>${nUpd}</b></div><div class="rpt-k"><span>Past partners (no login)</span><b>${nPast}</b></div><div class="rpt-k"><span>Logins created or reset</span><b>${nLogin}</b></div>
      ${links.length ? `<p class="small mt12" style="font-weight:600">Region history links</p>${links.map(([a, b]) => `<p class="small muted" style="margin-top:4px">${h(b.region)} ${h(b.niche)}: ${h(a.business)} → ${h(b.business)}</p>`).join("")}` : ""}
      ${bad.length ? `<p class="small mt12" style="color:var(--bad)">${bad.length} partner${bad.length === 1 ? " needs" : "s need"} fixing first: ${bad.map((r) => h(r.business || "unnamed")).join(", ")}.</p>` : ""}
      <button class="btn primary mt16" type="button" id="b-go" ${bad.length || !inc.length || done ? "disabled" : ""}>${done ? "Done" : `Create ${inc.length} partner${inc.length === 1 ? "" : "s"}`}</button>
      ${done ? `<button class="btn ghost mt12" type="button" id="b-msgs">Copy all login messages</button><a class="btn ghost mt12" href="#/admin">Back to partners</a>` : ""}</div></div>`;
    const hb = $("b-hints"); if (hb) hb.onclick = () => { const cut = ymdOf(new Date(Date.now() - 21 * 864e5)); rows.forEach((r) => { if (!r.start && r.startHint) r.start = r.startHint; if (endable(r, cut)) r.end = r.endHint; }); save(); renderAll(); toast("Dates filled from the hints. Check them before creating."); };
    const go = $("b-go"); if (go) go.onclick = run;
    const bm = $("b-msgs"); if (bm) bm.onclick = () => copyText(rows.filter((r) => r.include && !isPast(r) && r.email && r.status && r.status.includes("login ready")).map((r) => loginMessage(r.first, r.email, pw(r))).join("\n\n――――――――\n\n"), "All login messages copied");
  };
  const renderAll = () => { list.innerHTML = rows.length ? `<div class="sec"><div class="sec-h"><h2>${rows.length} partners</h2><span class="small muted">type the dates, tap a card's Details to edit</span></div>${rows.map(card).join("")}</div>` : ""; renderSummary(); };
  const refreshCard = (r) => { const el = list.querySelector(`[data-k="${r.key}"]`); if (!el) return; const open = el.querySelector("details").open; const fresh = document.createElement("div"); fresh.innerHTML = card(r); const nu = fresh.firstElementChild; nu.querySelector("details").open = open; if (!el.isConnected) return; try { el.replaceWith(nu); } catch (e) { /* the card was already redrawn by a blur */ } };
  list.addEventListener("click", (e) => { const t = e.target.closest('[data-f="include"]'); if (!t) return; const r = rows.find((x) => x.key === t.closest("[data-k]").dataset.k); r.include = !r.include; save(); refreshCard(r); renderSummary(); });
  list.addEventListener("change", (e) => { const t = e.target.closest("[data-f]"); if (!t || t.dataset.f === "include" || !t.isConnected) return; const host = t.closest("[data-k]"); const r = host && rows.find((x) => x.key === host.dataset.k); if (!r) return; r[t.dataset.f] = t.value.trim(); if (t.dataset.f === "end" && !r.end) r.why = ""; save(); setTimeout(() => { refreshCard(r); renderSummary(); }, 0); });

  const load = (text) => { const data = parseCSV(text); if (data.length < 2) { toast("Couldn't read that file", true); return; } const hd = data[0].map(norm); const map = {}; const used = new Set();
    for (const [f, al] of Object.entries(BULK_COLS)) { const i = hd.findIndex((x, ix) => !used.has(ix) && al.includes(x)); if (i >= 0) { map[f] = i; used.add(i); } }
    rows = data.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r, i) => { const o = {}; for (const [f, ix] of Object.entries(map)) o[f] = String(r[ix] ?? "").trim(); return rowFrom(o, i); });
    done = false; save(); renderAll(); toast(`${rows.length} partners loaded`); };
  $("b-file").onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then(load); };
  const drop = $("b-drop"); ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("on"); })); ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("on"); })); drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) f.text().then(load); });
  try { const d = JSON.parse(localStorage.getItem(BULK_KEY) || "null"); if (Array.isArray(d) && d.length) { $("b-restore").innerHTML = `<button class="btn ghost sm mt8" type="button" id="b-res">Carry on with your unsaved list (${d.length} partners)</button>`; $("b-res").onclick = () => { rows = d.map((o, i) => rowFrom(o, i)); $("b-restore").innerHTML = ""; renderAll(); }; } } catch (e) {}

  async function run() {
    const inc = rows.filter((r) => r.include && !problems(r).length); const go = $("b-go"); go.disabled = true;
    for (const r of inc) {
      r.status = "Saving…"; refreshCard(r);
      try {
        const ex = existingFor(r); const plan = (PLANS[r.country] || PLANS.NZ)[r.pkg]; const past = isPast(r);
        const row = { business_name: r.business, contact_name: r.first, initials: ini(r), phone: r.phone, email: r.email ? r.email.toLowerCase() : null, niche: portalNiche(r.niche), region: r.region, country: r.country, timezone: tzForRegion(r.region, r.country), started_on: r.start, package_name: r.pkg, monthly_fee: fee(r), billing_day: Math.min(28, Number(r.start.slice(8, 10)) || 1), active: !past, churned_on: past ? r.end : null, churn_reason: past ? r.why || "other" : null, churn_note: "" };
        if (plan) Object.assign(row, { lead_target_min: plan[1], lead_target_max: plan[2] }); else if (!ex) Object.assign(row, { lead_target_min: 15, lead_target_max: 25 });
        const saved = await api.upsertClient(ex ? { id: ex.id, ...row } : row);
        const ix = DB.clients.findIndex((c) => c.id === saved.id); if (ix >= 0) DB.clients[ix] = saved; else DB.clients.push(saved); r.id = saved.id;
        let note = past ? "past partner, no login" : "no login (no email)";
        if (!past && r.email && pw(r).length >= 6) { try { await api.createLogin(saved.id, r.email, pw(r)); note = "login ready"; } catch (ex2) { note = "login not created: " + netMsg(ex2.message); } }
        r.status = `${note.startsWith("login not") ? "⚠️" : "✓"} ${ex ? "Updated" : "Created"} · ${note}`;
      } catch (ex) { r.status = `✗ ${netMsg(ex.message)}`; }
      refreshCard(r);
    }
    for (const [a, b] of linkPlan()) { if (!a.id || !b.id) continue; try { const sc = await api.updateClient(b.id, { predecessor_id: a.id }); const ci = DB.clients.findIndex((c) => c.id === sc.id); if (ci >= 0) DB.clients[ci] = sc; } catch (e) { toast(`${b.business} wasn't linked to ${a.business}: ${netMsg(e.message)}`, true); } }
    DB.history = {}; await refreshAdmin(); done = true; try { localStorage.removeItem(BULK_KEY); } catch (e) {}
    const okN = inc.filter((r) => r.status.startsWith("✓")).length; renderSummary(); toast(`${okN} of ${inc.length} partners saved`, okN < inc.length);
  }
}

async function renderSettings(ctx) {
  const isNew = !ctx.args[0]; const cur = CUR_YM();
  const c = isNew ? { id: "", business_name: "", initials: "", contact_name: "", email: "", phone: "", niche: "Emergency plumber", region: "", country: "NZ", timezone: "Pacific/Auckland", package_name: "Starter", monthly_fee: 1500, lead_target_min: 15, lead_target_max: 25, started_on: ymdOf(new Date()), billing_day: 1, show_cost_per_lead: true, show_ad_spend: false, avg_job_value: 450, active: true } : client(ctx.args[0]);
  if (!c) return go("/admin");
  const pre = isNew ? PREFILL : null; PREFILL = null; if (pre) Object.assign(c, { region: pre.region, niche: pre.niche, country: pre.country, timezone: pre.timezone });
  const f = (id, l, v, type = "text", extra = "") => `<label class="fld"><span>${l}</span><input id="${id}" type="${type}" value="${h(v ?? "")}" ${extra}></label>`;
  app().innerHTML = topBar({ title: isNew ? "New partner" : "Settings", sub: isNew ? "Creates their login too" : h(c.business_name), back: isNew ? "/admin" : `/admin/client/${c.id}` }) + `<div class="shell">
  <div class="card mt16"><h2 style="font-size:16px;font-weight:600">Business</h2>${f("s-biz", "Business name", c.business_name)}<div class="two">${f("s-contact", "Contact first name", c.contact_name)}${f("s-init", "Initials (avatar)", c.initials)}</div><div class="two">${f("s-phone", "Mobile (number Nimbata forwards to)", c.phone, "tel")}${f("s-email", "Email (their login)", c.email, "email")}</div>
  <div class="two"><label class="fld"><span>Niche</span><select id="s-niche">${["Emergency plumber", "Emergency electrician", "Handyman", "Locksmith", "Roofer", "Drainlayer", "Builder", "Other"].map((n) => `<option ${c.niche === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>${f("s-region", "Region", c.region)}</div>
  <div class="two"><label class="fld"><span>Country</span><select id="s-country"><option ${c.country === "NZ" ? "selected" : ""}>NZ</option><option ${c.country === "AU" ? "selected" : ""}>AU</option></select></label><label class="fld"><span>Time zone</span><select id="s-tz">${TZ_OPTIONS.map((t) => `<option ${(c.timezone || TZ_FOR[c.country]) === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
  ${f("s-started", "Start date (their first day of leads)", c.started_on, "date")}<p class="small muted" style="margin-top:6px">Reports start from this month, and on upload anything before this date is left out, so a previous partner's calls never land here.</p>${!isNew && !c.active ? f("s-end2", "Last day with LeadHive", c.churned_on, "date") : ""}</div>
  <div class="card mt12"><h2 style="font-size:16px;font-weight:600">Plan</h2><div class="two"><label class="fld"><span>Package</span><select id="s-pkg">${["Starter", "Growth", "Dominator", "Starter (trial)", "Custom"].map((n) => `<option ${c.package_name === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>${f("s-fee", "Monthly fee (before GST)", c.monthly_fee, "number")}</div><div class="two">${f("s-tmin", "Lead target min", c.lead_target_min, "number")}${f("s-tmax", "Lead target max", c.lead_target_max, "number")}</div>${billingReady() ? `<div class="two">${f("s-bstart", "Billing start (Month 1 invoice)", c.billing_start || "", "date")}${f("s-avg", "Average job value (your estimate)", c.avg_job_value, "number")}</div><p class="small muted mt8">Leave billing start blank to bill from the start date. Set it if billing began on another day, e.g. after a free trial. Every month is invoiced on its first day; extended months move the dates back on the Billing page.</p><div class="two">${f("s-setup", "Setup fee (Month 1, ex GST)", c.setup_fee || 0, "number")}${f("s-extra", "Extra monthly charge (ex GST)", c.extra_fee || 0, "number")}</div>${f("s-extralabel", "What the extra charge is for", c.extra_label || "", "text", 'placeholder="e.g. Website"')}${flatReady() ? `${f("s-flat", "Old flat-price contract: last day", c.flat_until || "", "date")}<p class="small muted mt8">For partners still on a flat $ price. Invoices dated on or before this day are the monthly fee and nothing more (GST included once you're registered); after it, GST is added. Blank = GST added as normal.</p>` : `<p class="small muted mt8">To set an old flat-price contract, re-run add-billing.sql in Supabase.</p>`}` : `<div class="two">${f("s-bill", "Billing day of month", c.billing_day, "number", 'min="1" max="28"')}${f("s-avg", "Average job value (your estimate)", c.avg_job_value, "number")}</div>`}<p class="small muted mt8">Average job value shows as "Est." on every lead that has no estimate of its own. A CSV "Value" column sets per-lead estimates.</p>
  <div class="mt12"><div class="switch"><div><b>Show Google Ads spend</b><small>Off by default. Turning this on reveals your margin.</small></div><button class="tog ${c.show_ad_spend ? "on" : ""}" id="s-ads"></button></div></div></div>
  ${isNew ? `<div class="card mt12"><div class="switch" style="border-top:0;padding-top:0;margin-top:0"><div><b>Already finished with LeadHive</b><small>For adding a previous partner's history, e.g. whoever had the region before. No login is created.</small></div><button type="button" class="tog" id="s-past" aria-label="toggle"></button></div><div id="past-box" class="hidden"><div class="two"><label class="fld"><span>Last day with LeadHive</span><input id="s-end" type="date" max="${ymdOf(new Date())}"></label><label class="fld"><span>Why they finished</span><select id="s-endreason">${Object.entries(CHURN_REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div><label class="fld"><span>Replaced by (optional)</span><select id="s-succ"><option value="">Nobody yet</option>${DB.clients.filter((x) => x.active).map((x) => `<option value="${x.id}">${h(x.business_name)}${x.region ? " · " + h(x.region) : ""}</option>`).join("")}</select></label><p class="small muted mt8" style="line-height:1.45">Set the start date above to their first day. The partner picked here sees this one's monthly totals as "before you" history, never their callers or recordings.</p></div></div>` : ""}
  ${isNew && DB.clients.some((x) => !x.active) ? `<div class="card mt12" id="takeover-card"><h2 style="font-size:16px;font-weight:600">Replacing a past partner?</h2><p class="small muted mt8">Pick who they're taking over from and the landing page's enquiry connection moves to the new partner, so the page needs no change. Region, trade and plan are copied in to save typing.</p><label class="fld"><span>Takes over from</span><select id="s-takeover"><option value="">Nobody, brand new region</option>${DB.clients.filter((x) => !x.active).map((x) => `<option value="${x.id}">${h(x.business_name)} · ${h(x.region)}</option>`).join("")}</select></label></div>` : ""}
  ${isNew ? "" : (() => { const chainHas = (x, id) => { let k = 0; while (x && k++ < 8) { if (x.predecessor_id === id) return true; x = client(x.predecessor_id); } return false; }; const opts = DB.clients.filter((x) => x.id !== c.id && !chainHas(x, c.id)).sort((a, b) => Number(a.active) - Number(b.active) || a.business_name.localeCompare(b.business_name)); return `<div class="card mt12"><h2 style="font-size:16px;font-weight:600">Took over from</h2><p class="small muted mt8">Link the partner who had this region before. ${h(c.contact_name || "They")} then sees that partner's monthly totals (leads, calls, web enquiries, answer rate) as "before you" history. Never their callers, recordings or tags.</p><label class="fld"><span>Previous partner</span><select id="s-pred"><option value="">Nobody, brand new region</option>${opts.map((x) => `<option value="${x.id}" ${c.predecessor_id === x.id ? "selected" : ""}>${h(x.business_name)}${x.region ? " · " + h(x.region) : ""}${x.active ? "" : " (past partner)"}</option>`).join("")}</select></label></div>`; })()}
  <div class="card mt12" id="login-card"><h2 style="font-size:16px;font-weight:600">Login</h2><p class="small muted mt8">They log in with the email above. Set a password here and send it to them, or let them use "Set up your login" on the login screen with that email.</p>${f("s-pass", isNew ? "Password for their login" : "Set or reset their password", "", "text", 'placeholder="e.g. Plumbing2026" autocomplete="off"')}<div class="btn-row mt12"><button class="btn ghost sm" style="flex:1" id="s-sendlogin">${ICON.copy}Copy login message</button></div></div>
  ${isNew ? "" : `<div class="card mt12"><h2 style="font-size:16px;font-weight:600">Website enquiries</h2><p class="small muted mt8">Add this to the landing page's enquiry route and every form submission lands in their portal instantly.</p><pre class="code mt8" id="hook">loading…</pre></div>`}
  <button class="btn primary mt16" id="s-save">${isNew ? "Create partner + login" : "Save settings"}</button>
  ${isNew || !c.active ? "" : `<button class="btn danger mt12" id="s-off">Partner is leaving…</button>
  <div class="card mt12 hidden" id="off-box"><h2 style="font-size:16px;font-weight:600">Why are they leaving?</h2><p class="small muted mt8">One tap. You'll see this on the past partners list and it shapes what we fix.</p><label class="fld"><span>Reason</span><select id="off-reason">${Object.entries(CHURN_REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="fld"><span>Last day with LeadHive</span><input id="off-day" type="date" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}"></label><label class="fld"><span>Note (optional)</span><textarea id="off-note" placeholder="e.g. Hired a second plumber, wants to pause until March"></textarea></label><div class="btn-row mt12"><button class="btn ghost" id="off-cancel">Keep them</button><button class="btn danger" id="off-go">Pause their portal</button></div></div>`}
  ${isNew ? "" : `<details class="mt20" id="del-wrap"><summary class="small" style="color:var(--bad);font-weight:600">Delete this partner permanently…</summary><div class="card mt8" style="border-color:#F2C9C9"><p class="small" style="color:var(--ink-2);line-height:1.5">Removes ${h(c.business_name)} and everything on their record: calls, recordings, web enquiries, reports, tags and ad spend. It can't be undone. Their login stays but shows nothing, and it's re-linked if you set a password on a new partner with the same email.</p><p class="small muted mt8" style="line-height:1.5">For a partner who's leaving, use "Partner is leaving" instead: it keeps their history for a win-back and for the next partner's "before you" totals.</p><label class="fld"><span>Type <b>${h(c.business_name)}</b> to confirm</span><input id="del-name" autocomplete="off"></label><button class="btn danger mt12" id="del-go" disabled>Delete permanently</button></div></details>`}
  <div style="height:20px"></div></div>`;
  $("s-ads").onclick = (e) => e.currentTarget.classList.toggle("on");
  const sp = $("s-past"); if (sp) sp.onclick = (e) => { const on = e.currentTarget.classList.toggle("on"); $("past-box").classList.toggle("hidden", !on); ["login-card", "takeover-card"].forEach((id) => { const el = $(id); if (el) el.classList.toggle("hidden", on); }); $("s-save").textContent = on ? "Add past partner" : "Create partner + login"; };
  const dn = $("del-name"), dg = $("del-go");
  if (dn && dg) { dn.oninput = () => (dg.disabled = dn.value.trim() !== c.business_name.trim());
    dg.onclick = async () => { if (dn.value.trim() !== c.business_name.trim()) return; dg.disabled = true; dg.textContent = "Deleting…";
      try { await api.deleteClient(c.id); DB.clients = DB.clients.filter((x) => x.id !== c.id); DB.calls = DB.calls.filter((x) => x.client_id !== c.id); DB.enquiries = DB.enquiries.filter((x) => x.client_id !== c.id); DB.loaded = {}; DB.history = {}; DB.keys = {}; await refreshAdmin(); toast(`${c.business_name} deleted`); go("/admin"); }
      catch (ex) { toast(ex.message, true); dg.disabled = false; dg.textContent = "Delete permanently"; } }; }
  const tk = $("s-takeover"); if (tk && pre && pre.predecessor && [...tk.options].some((o) => o.value === pre.predecessor)) tk.value = pre.predecessor;
  if (tk) tk.onchange = (e) => { const o = client(e.target.value); if (!o) return; $("s-region").value = o.region || ""; $("s-niche").value = o.niche; $("s-country").value = o.country; $("s-tz").value = o.timezone || TZ_FOR[o.country]; $("s-pkg").value = o.package_name; $("s-fee").value = o.monthly_fee; $("s-tmin").value = o.lead_target_min; $("s-tmax").value = o.lead_target_max; $("s-avg").value = o.avg_job_value; toast(`Copied ${o.business_name}'s region and plan`); };
  $("s-country").onchange = (e) => { $("s-tz").value = TZ_FOR[e.target.value] || "Pacific/Auckland"; };
  const read = () => ({ business_name: $("s-biz").value.trim(), contact_name: $("s-contact").value.trim(), initials: ($("s-init").value.trim() || $("s-biz").value.trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2)).toUpperCase(), phone: $("s-phone").value.trim(), email: $("s-email").value.trim().toLowerCase() || null, niche: $("s-niche").value, region: $("s-region").value.trim(), country: $("s-country").value, timezone: $("s-tz").value, started_on: $("s-started").value || cur + "-01", package_name: $("s-pkg").value, monthly_fee: Number($("s-fee").value) || 0, lead_target_min: Number($("s-tmin").value) || 0, lead_target_max: Number($("s-tmax").value) || 0, ...(billingReady() ? { billing_start: $("s-bstart").value || null, setup_fee: Number($("s-setup").value) || 0, extra_fee: Number($("s-extra").value) || 0, extra_label: $("s-extralabel").value.trim(), billing_day: Math.min(28, Number(($("s-bstart").value || $("s-started").value || "").slice(8, 10)) || 1), ...(flatReady() ? { flat_until: $("s-flat").value || null } : {}) } : { billing_day: Math.min(28, Math.max(1, Number($("s-bill").value) || 1)) }), avg_job_value: Number($("s-avg").value) || 0, show_ad_spend: $("s-ads").classList.contains("on") });
  $("s-save").onclick = async () => { const v = read(); if (!v.business_name) { toast("Business name is needed", true); return; }
    const past = !!(isNew && $("s-past") && $("s-past").classList.contains("on"));
    if (past) { const end = $("s-end").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) { toast("Add their last day with LeadHive", true); $("s-end").focus(); return; } if (v.started_on && end < v.started_on) { toast("The last day is before the start date", true); return; } Object.assign(v, { active: false, churned_on: end, churn_reason: $("s-endreason").value, churn_note: "" }); }
    if (!isNew && !c.active && $("s-end2") && /^\d{4}-\d{2}-\d{2}$/.test($("s-end2").value)) { if (v.started_on && $("s-end2").value < v.started_on) { toast("The last day is before the start date", true); return; } v.churned_on = $("s-end2").value; }
    const btn = $("s-save"); btn.setAttribute("disabled", "");
    try { const takeover = $("s-takeover") && $("s-takeover").value; if (isNew && takeover && !past) v.predecessor_id = takeover;
      if (!isNew && $("s-pred")) v.predecessor_id = $("s-pred").value || null;
      const saved = await api.upsertClient(isNew ? v : { id: c.id, ...v });
      const ix = DB.clients.findIndex((x) => x.id === saved.id); if (ix >= 0) DB.clients[ix] = saved; else DB.clients.push(saved);
      if (past && $("s-succ").value) { try { const sc = await api.updateClient($("s-succ").value, { predecessor_id: saved.id }); const ci = DB.clients.findIndex((x) => x.id === sc.id); if (ci >= 0) DB.clients[ci] = { ...DB.clients[ci], ...sc }; } catch (ex) { toast("Saved, but the replacement partner wasn't linked: " + ex.message, true); } }
      const from = !past && $("s-takeover") && $("s-takeover").value; if (from) { try { await api.transferWebhook(from, saved.id); DB.keys = {}; } catch (ex) { toast("Partner saved, but the enquiry connection didn't move: " + ex.message, true); } }
      const pw = $("s-pass").value.trim(); let note = "";
      if (past) note = " · no login (past partner)";
      else if (pw || (isNew && v.email)) { if (!v.email) note = " · no email, so no login yet"; else if (!pw) note = " · no password set, they can use Set up your login"; else { try { await api.createLogin(saved.id, v.email, pw); note = " · login ready"; } catch (ex) { note = " · login not created: " + ex.message; } } }
      DB.history = {}; await refreshAdmin(); toast((past ? "Past partner added" : isNew ? "Partner created" : "Saved") + note + (isNew ? " · now drop in their data" : ""), /not created/.test(note)); setTimeout(() => go(isNew ? `/admin/upload/${saved.id}` : `/admin/client/${saved.id}`), 600); }
    catch (ex) { toast(ex.message, true); btn.removeAttribute("disabled"); } };
  $("s-sendlogin").onclick = () => { const v = read(); copyText(loginMessage(v.contact_name, v.email, $("s-pass").value.trim()), "Login message copied"); };
  const off = $("s-off"); if (off) off.onclick = () => { $("off-box").classList.toggle("hidden"); $("off-box").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const offC = $("off-cancel"); if (offC) offC.onclick = () => $("off-box").classList.add("hidden");
  const offG = $("off-go"); if (offG) offG.onclick = async () => { try { offG.setAttribute("disabled", ""); const day = /^\d{4}-\d{2}-\d{2}$/.test($("off-day").value) ? $("off-day").value : new Date().toISOString().slice(0, 10); await api.deactivateClient(c.id, $("off-reason").value, $("off-note").value.trim(), day); Object.assign(c, { active: false, churned_on: day, churn_reason: $("off-reason").value, churn_note: $("off-note").value.trim() }); toast(`${c.business_name} paused. Their data is kept.`); go(`/admin/client/${c.id}`); } catch (ex) { toast(ex.message, true); offG.removeAttribute("disabled"); } };
  if (!isNew) { try { const key = DB.keys[c.id] || (DB.keys[c.id] = await api.getWebhookKey(c.id)); $("hook").textContent = `POST ${PORTAL_URL}/api/enquiry\nx-leadhive-key: ${key}\n{ "name", "phone", "suburb", "issue", "isUrgent", "page" }`; } catch (e) { const el = $("hook"); if (el) el.textContent = "Couldn't load the key: " + e.message; } }
}

/* ═══════════════════════════ boot ═══════════════════════════ */
api.onAuth((ev) => {
  if (ev === "PASSWORD_RECOVERY") { go("/reset"); route(); }
  else if (ev === "SIGNED_OUT") { resetDB(); if (location.hash && location.hash !== "#/") go("/"); else route(); }
});
if (PARAMS.get("reset") === "1" && !location.hash) history.replaceState(null, "", location.pathname + "#/reset");
window.addEventListener("hashchange", route);
route();
})();
