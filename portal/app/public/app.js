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
const PORTAL_URL = CFG.portalUrl || location.origin;
const JOE = Object.assign({ name: "Joe", phone: "", whatsapp: "", email: "hello@leadhivenz.com" }, CFG.joe || {});
const ADMIN_EMAIL = (CFG.adminEmail || "hello@leadhivenz.com").toLowerCase();
const LOGO = CFG.logo || "/logo.png", LOGO_SMALL = CFG.logoSmall || "/logo-small.png", LOGO_BEE = CFG.logoBee || "/logo-bee.png";
const emptyState = (title, body) => `<div class="empty"><img src="${LOGO_BEE}" alt=""><b>${title}</b>${body}</div>`;

/* ═══════════════════════════ utilities ═══════════════════════════ */
const $ = (id) => document.getElementById(id);
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
function toast(m, bad) { const t = $("toast"); t.textContent = m; t.className = "toast on" + (bad ? " bad" : ""); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), bad ? 4000 : 2200); }
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
    async deactivateClient(cid, reason, note) { await q(sb.from("clients").update({ active: false, churned_on: new Date().toISOString().slice(0, 10), churn_reason: reason || null, churn_note: note || "" }).eq("id", cid)); },
    async getWebhookKey(cid) { const r = await q(sb.from("client_secrets").select("webhook_key").eq("client_id", cid).maybeSingle()); return r ? r.webhook_key : ""; },
    async upsertMonth(m) { return q(sb.from("months").upsert(m, { onConflict: "client_id,ym" }).select().single()); },
    async setAdSpend(month_id, ad_spend) { await q(sb.from("month_private").upsert({ month_id, ad_spend })); },
    async replaceMonthCalls(cid, ym, rows) { const n = await q(sb.rpc("replace_month_calls", { p_client: cid, p_ym: ym, p_rows: rows })); return { inserted: Number(n) || 0, updated: 0, replaced: true }; },
    async mergeMonthCalls(cid, ym, rows) { const r = await q(sb.rpc("merge_month_calls", { p_client: cid, p_ym: ym, p_rows: rows })); return { inserted: Number(r && r.inserted) || 0, updated: Number(r && r.updated) || 0 }; },
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
    async upsertClient(c) { let row = D.clients.find((x) => x.id === c.id); if (!row) { row = { ...c, id: c.id || uid(), active: true }; D.clients.push(row); D.secrets[row.id] = "lh_demo_" + (row.initials || "xx").toLowerCase() + "_" + uid().replace(/-/g, "").slice(0, 16); } else Object.assign(row, c); persist(); return { ...row }; },
    async deactivateClient(cid, reason, note) { const c = D.clients.find((x) => x.id === cid); if (c) { c.active = false; c.churned_on = new Date().toISOString().slice(0, 10); c.churn_reason = reason || null; c.churn_note = note || ""; } persist(); },
    async reactivateClient(cid) { const c = D.clients.find((x) => x.id === cid); if (c) { c.active = true; c.churned_on = null; c.churn_reason = null; c.churn_note = ""; } persist(); },
    async touchSeen() { const me = meSync(); if (me && me.client_id) { D.seen = D.seen || {}; D.seen[me.client_id] = new Date().toISOString(); persist(); } },
    async loadLastSeen() { const m = { ...(D.seen || {}) }; const days = (n) => new Date(Date.now() - n * 864e5).toISOString(); if (!m[D.clients[0].id]) m[D.clients[0].id] = days(2); if (D.clients[1] && !m[D.clients[1].id]) m[D.clients[1].id] = days(19); return m; },
    async getWebhookKey(cid) { return D.secrets[cid] || ""; },
    async upsertMonth(m) { let row = D.months.find((x) => x.client_id === m.client_id && x.ym === m.ym); if (!row) { row = { id: uid(), ad_spend: 0, pdf_path: null, published_at: null, ...m }; D.months.push(row); } else Object.assign(row, m); persist(); return { ...row }; },
    async setAdSpend(month_id, ad_spend) { const m = D.months.find((x) => x.id === month_id); if (m) m.ad_spend = ad_spend; persist(); },
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
const DB = { me: null, clients: [], months: [], calls: [], enquiries: [], counts: [], loaded: {}, keys: {}, seen: {} };
function resetDB() { DB.me = null; DB.clients = []; DB.months = []; DB.calls = []; DB.enquiries = []; DB.counts = []; DB.loaded = {}; DB.keys = {}; DB.seen = {}; }
async function loadBase() {
  DB.me = await api.me();
  if (!DB.me) return;
  DB.clients = await api.loadClients();
  if (DB.me.role === "admin") { const [counts, months, seen] = await Promise.all([api.loadCounts(), api.loadMonths(), api.loadLastSeen().catch(() => ({}))]); DB.counts = counts; DB.months = months; DB.seen = seen; }
  else if (DB.me.client_id) api.touchSeen();
}
async function ensureClient(cid, force) {
  if (!force && DB.loaded[cid]) return;
  const d = await api.loadClientData(cid);
  DB.months = DB.months.filter((m) => m.client_id !== cid).concat(d.months);
  DB.calls = DB.calls.filter((x) => x.client_id !== cid).concat(d.calls);
  DB.enquiries = DB.enquiries.filter((x) => x.client_id !== cid).concat(d.enquiries);
  DB.loaded[cid] = true;
}
async function refreshAdmin() { if (DB.me && DB.me.role === "admin") { const [counts, months] = await Promise.all([api.loadCounts(), api.loadMonths()]); DB.counts = counts; DB.months = months; } }
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
function clientMonths(cid) {
  const set = new Set(DB.months.filter((m) => m.client_id === cid && m.status === "published").map((m) => m.ym));
  const cur = CUR_YM(); for (const x of DB.calls) if (x.client_id === cid && x.ym === cur) set.add(cur); for (const x of DB.enquiries) if (x.client_id === cid && x.ym === cur) set.add(cur);
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
  v = String(v || "").trim().toLowerCase();
  if (/voicemail|\bvm\b/.test(v)) return "voicemail";
  if (/missed|no answer|noanswer|unanswered|busy|failed|abandon|not answered|ringout|no-answer/.test(v)) return "missed";
  if (/answer|complete|connect|success|yes|true/.test(v)) return "answered";
  return durSec >= 20 ? "answered" : "missed";
}
function rowsToCalls(rows, map) {
  const headers = rows[0]; const out = []; const skipped = [];
  for (let i = 1; i < rows.length; i++) { const r = rows[i]; const g = (f) => (map[f] === undefined ? "" : String(r[map[f]] ?? "").trim());
    const dt = parseDate(g("datetime"), map.time !== undefined && map.time !== map.datetime ? g("time") : "");
    if (!dt) { skipped.push(i + 1); continue; }
    const duration_sec = parseDuration(g("duration")); const rec = g("recording");
    const raw = {}; headers.forEach((hd, ix) => { if (hd && r[ix] !== undefined && r[ix] !== "") raw[hd] = r[ix]; });
    out.push({ called_at: dt.date.toISOString(), ym: dt.ym, caller_number: g("caller") || "Unknown", duration_sec, outcome: parseOutcome(g("outcome"), duration_sec), tracking_number: g("tracking") || null, source: g("source") || "Google Ads", campaign: g("campaign") || null, keyword: g("keyword") || null, city: g("city") || null, recording_url: /^https?:/i.test(rec) ? rec : null, nimbata_call_id: g("callId") || null, admin_note: g("notes") || "", summary: g("summary").replace(/\s+/g, " ").slice(0, 700), estimated_value: (() => { const v = parseFloat(String(g("value")).replace(/[^0-9.]/g, "")); return isFinite(v) && v > 0 ? v : null; })(), raw });
  }
  return { calls: out, skipped };
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
function columnChart({ labels, values, highlight = -1, gold = [], height = 150, valueFmt = (v) => v, tipFmt }) {
  const W = 360, H = height, padL = 6, padR = 6, padT = 18, padB = 24; const n = values.length || 1; const max = Math.max(1, ...values);
  const niceMax = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10; return s * p; })();
  const slot = (W - padL - padR) / n; const bw = Math.min(24, slot * 0.6); const y = (v) => padT + (H - padT - padB) * (1 - v / niceMax);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Column chart">`;
  for (const g of [0, 0.5, 1]) { const yy = y(niceMax * g); s += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>`; if (g > 0) s += `<text class="t" x="${W - padR}" y="${(yy - 3).toFixed(1)}" text-anchor="end">${valueFmt(niceMax * g)}</text>`; }
  values.forEach((v, i) => { const x = padL + slot * i + (slot - bw) / 2; const top = y(v); const hgt = Math.max(0, H - padB - top);
    const fill = gold.includes(i) ? "var(--gold)" : i === highlight ? "var(--blue)" : "#C7D3DF"; const tipText = tipFmt ? tipFmt(i) : `${labels[i]}: ${valueFmt(v)}`;
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
    const adminPages = { admin: renderAdmin, client: renderAdminClient, upload: renderUpload, settings: renderSettings, newclient: renderSettings };
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
    app().innerHTML = `<div class="shell" style="padding-top:60px"><div class="card"><b>Something went wrong</b><p class="lede mt8">${h(e.message || e)}</p><button class="btn navy mt16" id="retry">Try again</button><button class="btn ghost mt12" id="out">Log out</button></div></div>`;
    $("retry").onclick = () => route(); $("out").onclick = async () => { await api.signOut(); resetDB(); go("/"); route(); };
  }
}
function renderTabs(ctx, page) {
  const t = $("tabs"), inn = $("tabs-in"); document.body.classList.add("has-tabs"); t.classList.remove("hidden");
  if (!ctx.cid || ["admin", "client", "upload", "settings", "newclient"].includes(page) && !ctx.viewAs) {
    inn.innerHTML = `<a href="#/admin" class="${page === "admin" || page === "client" ? "on" : ""}">${ICON.user}Partners</a><a href="#/admin/upload" class="${page === "upload" ? "on" : ""}">${ICON.upload}Upload</a><a href="#" data-logout>${ICON.out}Log out</a>`;
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
    catch (ex) { err.textContent = /invalid/i.test(ex.message) ? "That email or password isn't right." : ex.message; err.classList.remove("hidden"); $("l-btn").removeAttribute("disabled"); $("l-btn").textContent = "Log in"; } };
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
    catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); $("su-btn").removeAttribute("disabled"); } };
}
function renderReset() {
  app().innerHTML = loginShell(`<h2>Set a new password</h2>
    <form id="rs-f"><label class="fld"><span>New password</span><input id="rs-pass" type="password" autocomplete="new-password" minlength="6" required></label>
    <label class="fld"><span>Again</span><input id="rs-pass2" type="password" autocomplete="new-password" minlength="6" required></label>
    <div class="err hidden" id="rs-err"></div><button class="btn primary mt20" type="submit">Save password</button></form>`);
  $("rs-f").onsubmit = async (e) => { e.preventDefault(); const err = $("rs-err"); err.classList.add("hidden"); if ($("rs-pass").value !== $("rs-pass2").value) { err.textContent = "Those passwords don't match."; err.classList.remove("hidden"); return; }
    try { await api.updatePassword($("rs-pass").value); toast("Password saved"); resetDB(); go("/"); await route(); } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); } };
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
  const startYm = String(c.started_on || "").slice(0, 7) || ymAdd(cur, -5); const allMonths = []; for (let i = 5; i >= 0; i--) { const y = ymAdd(ym, -i); if (y >= startYm) allMonths.push(y); }
  if (!allMonths.length) allMonths.push(ym);
  const series = allMonths.map((y) => monthStats(c, y).leads);
  const prevLab = MON[+ymAdd(ym, -1).split("-")[1] - 1];
  const delta = (a, b, goodUp = true, unit = "") => { if (live || !b) return ""; const d = a - b; if (!d) return `<div class="d flat">— vs ${prevLab}</div>`; const up = d > 0; const good = goodUp ? up : !up; return `<div class="d ${good ? "up" : "dn"}">${up ? ICON.up : ICON.dn}${Math.abs(d)}${unit} vs ${prevLab}</div>`; };
  const fill = Math.min(100, (st.leads / c.lead_target_max) * 100); const minTick = (c.lead_target_min / c.lead_target_max) * 100;
  const latestPub = DB.months.filter((m) => m.client_id === c.id && m.status === "published").sort((a, b) => (a.ym < b.ym ? 1 : -1))[0];
  const recent = leadsFor(c.id, ym).slice(0, 3);
  const showCpl = c.show_cost_per_lead && !live;
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
    <div class="kpi"><div class="l">${showCpl ? "Cost per lead" : "Jobs won"}</div><div class="v">${showCpl ? (st.leads ? money(st.cplFee) : "–") : st.won}</div><div class="d flat">${showCpl ? `on your ${money(c.monthly_fee)} plan` : live ? "tagged so far" : "tagged by you"}</div></div>
  </div>
  ${latestPub ? `<div class="sec"><div class="sec-h"><h2>Note from ${h(JOE.name)}</h2><a href="#${ctx.base}/report/${latestPub.ym}">Full report</a></div><div class="card note"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)} · LeadHive</b><small>${ymLabel(latestPub.ym)} results · published ${fmtDate(latestPub.published_at)}</small></div></div><p>${h(latestPub.summary)}</p></div></div>`
    : `<div class="sec"><div class="card note"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)} · LeadHive</b><small>Welcome aboard</small></div></div><p>Your campaign is live. Calls and web enquiries will show up here as they come in, and your first full report lands at the end of the month.</p></div></div>`}
  <div class="sec"><div class="sec-h"><h2>Leads by month</h2><span class="small muted">calls + web enquiries</span></div><div class="card chart">${columnChart({ labels: allMonths.map((y) => MON[+y.split("-")[1] - 1]), values: series, highlight: allMonths.length - 1, tipFmt: (i) => `${ymLabel(allMonths[i])}: ${series[i]} leads` })}</div></div>
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
  <p class="lede" style="margin:16px 0 12px">One report a month, written by ${h(JOE.name)}. What came in, what it cost per lead, and what's being changed next.</p>
  ${ms.length ? ms.map((m) => { const st = monthStats(c, m.ym); return `<a class="card" style="display:block;text-decoration:none;margin-top:10px" href="#${ctx.base}/report/${m.ym}"><div class="row"><div class="grow"><b style="font-size:16px;font-family:var(--head)">${ymLabel(m.ym)}</b><div class="small muted" style="margin-top:3px">${st.leads} leads · ${st.calls} calls · ${st.enq} web · ${st.missedRate}% missed${st.wonValue ? ` · ${money(st.wonValue)} won` : ""}</div></div>${targetChip(st)}<span class="chev">${ICON.chev}</span></div></a>`; }).join("") : `<div class="card" style="padding:0">${emptyState("Your first report is on its way", "It lands at the end of your first full month.")}</div>`}</div>`;
}
function renderReport(ctx) {
  const c = ctx.client; const ym = ctx.args[0]; const m = monthRec(c.id, ym); if (!m || m.status !== "published") return go(`${ctx.base}/reports`);
  const st = monthStats(c, ym); const prev = monthStats(c, ymAdd(ym, -1));
  const kv = (k, v) => `<div class="rpt-k"><span>${k}</span><b>${v}</b></div>`;
  app().innerHTML = topBar({ title: `${ymLabel(ym)} report`, sub: h(c.business_name), back: `${ctx.base}/reports` }) + `<div class="shell">
  <div class="hero" style="margin-top:16px"><div class="k">${ymLabel(ym)}${st.wonValue ? " · your return" : ""}</div>${st.wonValue ? `<div class="n ret">${(st.wonValue / (Number(c.monthly_fee) || 1)).toFixed(1)}x</div><div class="sub">${money(st.wonValue)} confirmed won from your ${money(c.monthly_fee)} plan · ${st.leads} leads</div>` : `<div class="n">${st.leads}<small>leads</small></div><div class="sub">${h(c.package_name)} plan · target ${c.lead_target_min} to ${c.lead_target_max}</div>`}<div class="mt12">${targetChip(st)}${prev.leads ? ` <span class="chip white">${st.leads >= prev.leads ? "+" : ""}${st.leads - prev.leads} leads vs ${ymLabel(ymAdd(ym, -1), false)}</span>` : ""}</div></div>
  <div class="card mt12">${kv("Phone calls", st.calls)}${kv("Answered", `${st.answered} <span class="muted small">(${pct(st.answered, st.calls)}%)</span>`)}${kv("Missed or voicemail", `${st.missed} <span class="muted small">(${st.missedRate}%)</span>`)}${kv("Web enquiries", st.enq)}${kv("Average call length", st.avgDur ? dur(st.avgDur) : "–")}${st.spam && ctx.isAdmin ? kv("Spam removed (admin only)", st.spam) : ""}${c.show_cost_per_lead ? kv("Cost per lead", `${money(st.cplFee)} <span class="muted small">on ${money(c.monthly_fee)}</span>`) : ""}${c.show_ad_spend && st.adSpend != null ? kv("Ad spend (Google)", money(st.adSpend)) : ""}${kv("Estimated value of leads", money(st.estTotal))}${st.won ? kv("Jobs you tagged won", `${st.won} · ${money(st.wonValue)}`) : ""}${st.lost ? kv("Tagged lost", st.lost) : ""}${st.quoted ? kv("Ongoing", st.quoted) : ""}${st.untagged ? kv("Still to tag", st.untagged) : ""}</div>
  ${st.wonValue ? `<div class="card mt12" style="background:var(--good-bg);border-color:#BFE5CF"><b style="font-size:15px;color:#0F6B3D">${money(st.wonValue)} confirmed won from a ${money(c.monthly_fee)} plan</b><p class="small mt8" style="color:#1F5A3C;line-height:1.45">That's ${(st.wonValue / (Number(c.monthly_fee) || 1)).toFixed(1)}x on your own numbers, from the ${st.won} job${st.won === 1 ? "" : "s"} you tagged won.${st.untagged ? ` ${st.untagged} lead${st.untagged === 1 ? " is" : "s are"} still untagged.` : ""}</p></div>` : `<div class="card mt12" style="background:var(--gold-bg);border-color:#F3DDA8"><b style="font-size:15px;color:var(--gold-ink)">${money(st.estTotal)} of estimated work in these leads</b><p class="small mt8" style="color:var(--gold-ink);line-height:1.45">Tap Won or Lost on each lead and put your real numbers in. The report then shows your actual return, not our estimate.</p></div>`}
  <div class="sec"><div class="sec-h"><h2>Leads by week</h2></div><div class="card chart">${columnChart({ labels: st.weeks.map((_, i) => "Wk " + (i + 1)), values: st.weeks, gold: st.leads ? [st.weeks.indexOf(Math.max(...st.weeks))] : [], height: 130, tipFmt: (i) => `Week ${i + 1}: ${st.weeks[i]} leads` })}</div></div>
  <div class="sec"><div class="sec-h"><h2>${h(JOE.name)}'s summary</h2></div><div class="card note"><div class="who"><div class="avatar">${h(JOE.name[0])}</div><div><b>${h(JOE.name)} · LeadHive</b><small>Published ${fmtDate(m.published_at)}</small></div></div><p>${h(m.summary)}</p></div></div>
  ${m.points && m.points.length ? `<div class="sec"><div class="sec-h"><h2>What I'm changing</h2></div><div class="card">${m.points.map((p, i) => `<div class="pt"><div class="ix">${i + 1}</div><div><b>${h(p.title)}</b><p>${h(p.body)}</p></div></div>`).join("")}</div></div>` : ""}
  ${m.pdf_path ? `<a class="btn ghost mt20" href="#" id="pdf">${ICON.dl}Download PDF report</a>` : ""}
  <a class="btn navy mt12" href="#${ctx.base}/leads/${ym}">See every lead from ${ymLabel(ym, false)}</a>
  <p class="small muted center" style="margin:18px 0 8px">Questions? Text ${h(JOE.name)}, he reads every reply.</p></div>`;
  const p = $("pdf"); if (p) p.onclick = async (e) => { e.preventDefault(); try { const url = await api.signedUrl("reports", m.pdf_path); window.open(url, "_blank", "noopener"); } catch (ex) { toast(ex.message, true); } };
  bindTips(app());
}
function renderAccount(ctx) {
  const c = ctx.client; const user = ctx.user;
  const next = (() => { const p = tzParts(new Date()); let y = +p.year, mo = +p.month; if (+p.day >= c.billing_day) { mo++; if (mo > 12) { mo = 1; y++; } } return new Date(Date.UTC(y, mo - 1, c.billing_day, 12)); })();
  const telJ = (JOE.phone || "").replace(/\s/g, "");
  app().innerHTML = topBar({ title: ctx.viewAs ? "Viewing as partner" : "Account", sub: h(c.business_name) }) + `<div class="shell">
  ${ctx.viewAs ? `<a class="btn navy" style="margin-top:16px" href="#/admin/client/${c.id}">${ICON.back}Back to admin</a>` : ""}
  <div class="card mt16"><div class="row"><div class="avatar" style="width:46px;height:46px;font-size:16px">${h(c.initials || "")}</div><div class="grow"><b style="font-size:16px;font-family:var(--head)">${h(c.business_name)}</b><div class="small muted">${h(c.contact_name)} · ${h(c.niche)} · ${h(c.region)}</div></div></div>
  <div class="facts"><div><small>Plan</small>${h(c.package_name)}</div><div><small>Monthly fee</small>${money(c.monthly_fee)} + GST</div><div><small>Lead target</small>${c.lead_target_min} to ${c.lead_target_max} a month</div><div><small>Next invoice</small>${next.toLocaleDateString("en-NZ", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}</div><div><small>Partner since</small>${c.started_on ? new Date(c.started_on + "T12:00:00Z").toLocaleDateString("en-NZ", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "–"}</div><div><small>Login</small>${h(ctx.viewAs ? c.email : user.email)}</div></div></div>
  <div class="sec"><div class="sec-h"><h2>Talk to ${h(JOE.name)}</h2></div><div class="btn-row">${telJ ? `<a class="btn navy" href="tel:${h(telJ)}">${ICON.phone}Call</a>` : ""}${JOE.whatsapp ? `<a class="btn ghost" href="${h(JOE.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<a class="btn ghost" href="mailto:${h(JOE.email)}">Email</a></div></div>
  <div class="sec"><div class="sec-h"><h2>Put it on your home screen</h2></div><div class="card"><p class="lede">This portal works like an app. On iPhone tap <b>Share</b> then <b>Add to Home Screen</b>. On Android tap the <b>⋮ menu</b> then <b>Add to Home screen</b>. You'll get a LeadHive icon and it opens full-screen.</p></div></div>
  <div class="sec"><div class="sec-h"><h2>Your lead line</h2></div><div class="card"><p class="lede">Calls from your Google ads come through a LeadHive tracking number that forwards straight to <b>${h(c.phone || "your mobile")}</b>. That's how we count calls and record them. Web enquiries come from your LeadHive landing page and land here the moment they're sent.</p></div></div>
  ${ctx.viewAs ? "" : `<button class="btn danger mt20" id="logout">${ICON.out}Log out</button>`}
  <p class="small muted center" style="margin:18px 0 8px">LeadHive ${c.country === "AU" ? "AU" : "NZ"} · Partner portal</p></div>`;
  const lo = $("logout"); if (lo) lo.onclick = async () => { await api.signOut(); resetDB(); go("/"); route(); };
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
  <div class="list mt16">${cs.length ? cs.map((c) => { const s = clientStatus(c); const k = countFor(c.id, prevYm); return `<a class="li client-li" href="#/admin/client/${c.id}"><div class="ic">${h(c.initials || "")}</div><div class="grow"><div class="t1"><span>${h(c.business_name)}</span></div><div class="t2"><span class="tx">${h(c.niche)} · ${h(c.region)} ${h(c.country)} · ${h(c.package_name)} ${money(c.monthly_fee)}</span></div><div style="margin-top:5px"><span class="chip ${s.cls}"><i></i>${s.l}</span> ${(() => { const seen = DB.seen[c.id]; const d = seen ? Math.floor((Date.now() - new Date(seen)) / 864e5) : null; return `<span class="chip ${d == null || d >= 14 ? "warn" : ""}">${agoText(seen)}</span>`; })()}</div></div><div class="meta"><div class="tm">${k.leads ? k.leads + (k.leads === 1 ? " lead" : " leads") : ""}</div><div class="du muted">${k.leads ? ymLabel(prevYm, false) : ""}</div></div><span class="chev">${ICON.chev}</span></a>`; }).join("") : `<div class="empty">No partners yet. Add your first one.</div>`}</div>
  <div class="sec"><div class="sec-h"><h2>Month-end routine</h2></div><div class="card"><div class="pt"><div class="ix">1</div><div><b>Export from Nimbata, as often as you like</b><p>Call log → filter the partner's project and the month → Export CSV. Fortnightly is fine: uploads add new calls and refresh existing ones, nothing gets wiped.</p></div></div><div class="pt"><div class="ix">2</div><div><b>Send the stats to Claude for the notes</b><p>Upload step 2 has a "Copy summary" button. Paste it to Claude with the Google Ads spend and you get the summary and three "what I'm changing" points back.</p></div></div><div class="pt"><div class="ix">3</div><div><b>Paste, attach the PDF, publish</b><p>The partner gets an email saying their results are in, and it's in their portal the moment you hit publish.</p></div></div></div></div>
  ${inactive.length ? `<div class="sec"><div class="sec-h"><h2>Past partners</h2><span class="small muted">${inactive.length}</span></div><div class="list">${inactive.map((c) => `<a class="li client-li" href="#/admin/client/${c.id}" style="opacity:.75"><div class="ic" style="background:var(--ink-3)">${h(c.initials || "")}</div><div class="grow"><div class="t1"><span>${h(c.business_name)}</span></div><div class="t2"><span class="tx">${h(c.region)} · left ${c.churned_on ? fmtDate(c.churned_on + "T12:00:00Z") : "–"}${c.churn_reason ? " · " + h(CHURN_REASONS[c.churn_reason] || c.churn_reason) : ""}</span></div></div><span class="chev">${ICON.chev}</span></a>`).join("")}</div><p class="small muted mt8">Their data and recordings are kept. Open one to reactivate.</p></div>` : ""}
  ${DEMO ? `<button class="btn ghost mt20" id="reset" style="color:var(--ink-3)">Reset demo data</button>` : ""}</div>`;
  const r = $("reset"); if (r) r.onclick = () => { if (confirm("Reset the demo data to the starting state?")) { api.resetDemo(); resetDB(); route(); toast("Demo reset"); } };
}
function renderAdminClient(ctx) {
  const c = client(ctx.args[0]); if (!c) return go("/admin");
  TZ = tzOf(c);
  const ms = DB.months.filter((m) => m.client_id === c.id).sort((a, b) => (a.ym < b.ym ? 1 : -1)); const s = clientStatus(c); const cur = CUR_YM();
  const live = leadsFor(c.id, cur);
  app().innerHTML = topBar({ title: h(c.business_name), sub: `${h(c.contact_name)} · ${h(c.package_name)} · ${money(c.monthly_fee)}/mo`, back: "/admin" }) + `<div class="shell">
  ${c.active ? "" : `<div class="card mt16" style="background:var(--bad-bg);border-color:#F2C9C9"><b style="color:var(--bad)">Past partner · left ${c.churned_on ? fmtDate(c.churned_on + "T12:00:00Z") : "–"}${c.churn_reason ? " · " + h(CHURN_REASONS[c.churn_reason] || c.churn_reason) : ""}</b>${c.churn_note ? `<p class="small mt8" style="color:#7A2E2E">${h(c.churn_note)}</p>` : ""}<p class="small mt8" style="color:#7A2E2E">Their login is paused and their webhook is off. Everything is kept for a win-back.</p><button class="btn navy mt12" id="react">Reactivate partner</button></div>`}
  <div class="mt16"><span class="chip ${s.cls}"><i></i>${s.l}</span> <span class="chip">${c.lead_target_min}–${c.lead_target_max} leads</span> <span class="chip">${h(c.country)}</span> <span class="chip ${DB.seen[c.id] && (Date.now() - new Date(DB.seen[c.id])) / 864e5 < 14 ? "" : "warn"}">${agoText(DB.seen[c.id])}</span></div>
  <div class="btn-row mt12"><a class="btn primary" href="#/admin/upload/${c.id}">${ICON.upload}Upload month</a><a class="btn ghost" href="#/as/${c.id}/home">View as ${h(c.contact_name || "partner")}</a></div>
  <div class="btn-row" style="margin-top:8px"><a class="btn ghost sm" style="flex:1" href="#/admin/settings/${c.id}">${ICON.cog}Settings &amp; login</a><button class="btn ghost sm" style="flex:1" id="copy-hook">${ICON.copy}Enquiry webhook</button></div>
  <div class="sec"><div class="sec-h"><h2>Months</h2></div><div class="list">${ms.length ? ms.map((m) => { const st = monthStats(c, m.ym); return `<a class="li" href="#/admin/upload/${c.id}/${m.ym}"><div class="grow"><div class="t1"><span>${ymLabel(m.ym)}</span>${m.status === "published" ? `<span class="chip good">Published</span>` : `<span class="chip warn">Draft</span>`}</div><div class="t2"><span class="tx">${st.leads} leads · ${st.calls} calls · ${st.missedRate}% missed · ${st.enq} web${st.adSpend ? ` · ads ${money(st.adSpend)}${st.leads ? ` (${money(st.cplAd)}/lead)` : ""}` : ""}</span></div></div><span class="chev">${ICON.chev}</span></a>`; }).join("") : `<div class="empty">No months uploaded yet.</div>`}</div></div>
  <div class="sec"><div class="sec-h"><h2>${ymLabel(cur, false)} so far</h2><a href="#/as/${c.id}/leads/${cur}">${live.length} lead${live.length === 1 ? "" : "s"}</a></div><div class="list">${live.length ? live.slice(0, 4).map((x) => leadRow(x, `/as/${c.id}`, null)).join("") : `<div class="empty">Nothing logged yet this month. Web enquiries land here live once the webhook is on the landing page; calls arrive with the CSV.</div>`}</div></div>
  <div class="sec"><div class="sec-h"><h2>Margin (admin only)</h2></div><div class="card">${ms.filter((m) => m.status === "published").slice(0, 3).map((m) => { const ad = Number(m.ad_spend) || 0; const fee = Number(c.monthly_fee) || 0; return `<div class="rpt-k"><span>${ymLabel(m.ym, false)}</span><b>${money(fee - ad)} <span class="muted small">of ${money(fee)} · ${pct(fee - ad, fee)}%</span></b></div>`; }).join("") || `<div class="muted small">Nothing published yet.</div>`}<p class="small muted mt8">Partners never see ad spend unless you switch it on in Settings.</p></div></div></div>`;
  $("copy-hook").onclick = async () => { try { const key = DB.keys[c.id] || (DB.keys[c.id] = await api.getWebhookKey(c.id)); copyText(`POST ${PORTAL_URL}/api/enquiry\nx-leadhive-key: ${key}\n{ "name", "phone", "suburb", "issue", "isUrgent", "page" }`, "Webhook details copied"); } catch (e) { toast(e.message, true); } };
  const ra = $("react"); if (ra) ra.onclick = async () => { try { ra.setAttribute("disabled", ""); await api.reactivateClient(c.id); Object.assign(c, { active: true, churned_on: null, churn_reason: null, churn_note: "" }); toast(`${c.business_name} is back`); route(); } catch (e) { toast(e.message, true); ra.removeAttribute("disabled"); } };
}
function renderUpload(ctx) {
  const pre = ctx.args[0] ? client(ctx.args[0]) : null; const cur = CUR_YM(); const preYm = ctx.args[1] || ymAdd(cur, -1);
  if (pre) TZ = tzOf(pre);
  const existing = pre ? monthRec(pre.id, preYm) : null;
  const state = { cid: pre ? pre.id : (DB.clients.find((c) => c.active) || {}).id || "", ym: preYm, calls: [], map: {}, headers: [], skipped: [], fileName: "", pdf: null };
  const ymOpts = []; for (let i = 0; i < 12; i++) ymOpts.push(ymAdd(cur, -i));
  const pts = existing && existing.points ? existing.points : [];
  app().innerHTML = topBar({ title: "Upload a month", sub: pre ? h(pre.business_name) : "Pick a partner", back: pre ? `/admin/client/${pre.id}` : "/admin" }) + `<div class="shell">
  <div class="steps"><i class="on"></i><i id="s2"></i><i id="s3"></i></div>
  <div class="card"><div class="two"><label class="fld" style="margin-top:0"><span>Partner</span><select id="u-cid">${DB.clients.filter((c) => c.active).map((c) => `<option value="${c.id}" ${state.cid === c.id ? "selected" : ""}>${h(c.business_name)}</option>`).join("")}</select></label><label class="fld" style="margin-top:0"><span>Month</span><select id="u-ym">${ymOpts.map((y) => `<option value="${y}" ${y === state.ym ? "selected" : ""}>${ymLabel(y)}</option>`).join("")}</select></label></div>
  ${existing ? `<p class="small mt12" style="color:var(--ink-2)">${ymLabel(existing.ym)} already has data (${existing.status}). Upload as often as you like: new calls are added, calls already here are refreshed, and the partner's tags are kept. Notes below are pre-filled.</p>` : ""}</div>
  <div class="sec"><div class="sec-h"><h2>1 · Nimbata call export</h2><button id="u-sample">Use sample CSV</button></div>
  <label class="drop" id="drop"><b>Drop the CSV here or tap to choose</b>Nimbata → Call log → Export. Columns are matched automatically (date, caller, duration, outcome, recording, AI summary, value, keyword…).<input type="file" id="u-file" accept=".csv,text/csv,.txt,.tsv"></label>
  <details class="mt8"><summary>Or paste the CSV text</summary><textarea id="u-paste" class="mt8" style="width:100%;min-height:90px;font:12px ui-monospace,Menlo,monospace;padding:10px;border:1px solid var(--rule);border-radius:10px;background:var(--card)" placeholder="Date,Time,Caller,Call Duration,Outcome,..."></textarea><button class="btn ghost sm mt8" id="u-parse">Parse pasted text</button></details>
  <div id="u-preview"></div>
  <label class="switch" style="margin-top:10px;border-top:0;padding:8px 0 0"><div><b style="font-size:13.5px">Replace the month instead of adding to it</b><small>Only tick this if the file is the complete month and you want calls that aren't in it removed. Tags are still kept on matching calls.</small></div><button type="button" class="tog" id="u-replace" aria-label="toggle"></button></label>
  <p class="small muted mt8">No CSV? You can still publish the notes on their own, or just save the ad spend.</p></div>
  <div class="sec"><div class="sec-h"><h2>2 · Notes for the partner</h2><button id="u-copy">${ICON.copy} Copy summary for Claude</button></div>
  <div class="card"><label class="fld" style="margin-top:0"><span>Summary (plain English, like a text to a mate)</span><textarea id="u-sum" placeholder="A steady month. 22 leads, inside the plan. The one thing to work on is...">${h(existing ? existing.summary : "")}</textarea></label>
  ${[0, 1, 2].map((i) => `<label class="fld"><span>What I'm changing · ${i + 1}</span><input id="u-pt${i}" placeholder="Title, e.g. Missed call follow-up" value="${h(pts[i] ? pts[i].title : "")}"><textarea id="u-pb${i}" class="mt8" style="min-height:64px" placeholder="One or two sentences.">${h(pts[i] ? pts[i].body : "")}</textarea></label>`).join("")}
  <div class="two mt12"><label class="fld" style="margin-top:0"><span>Google Ads spend (admin only)</span><input id="u-ad" type="number" inputmode="decimal" placeholder="e.g. 702" value="${existing && existing.ad_spend != null ? existing.ad_spend : ""}"><div class="hint">Never shown to the partner unless their toggle is on.</div></label><label class="fld" style="margin-top:0"><span>PDF report (optional)</span><input id="u-pdf" type="file" accept="application/pdf"><div class="hint">${existing && existing.pdf_path ? "A PDF is already attached; choose a file to replace it." : "From the lead-report skill."}</div></label></div></div></div>
  <div class="sec"><div class="sec-h"><h2>3 · Publish</h2></div><div class="card"><div class="switch"><div><b>Email the partner when published</b><small>"Your ${ymLabel(state.ym, false)} results are in" with a login link.</small></div><button class="tog on" id="u-mail" aria-label="toggle"></button></div>
  <div class="btn-row mt12"><button class="btn ghost" id="u-draft">${existing && existing.status === "published" ? "Save (no email)" : "Save draft"}</button><button class="btn primary" id="u-pub">${existing && existing.status === "published" ? "Publish again" : "Publish to partner"}</button></div><p class="small muted mt12" id="u-msg">${existing && existing.status === "published" ? "This month is already live for the partner. Save keeps it live and skips the email; Publish again re-sends it." : ""}</p></div></div></div>`;
  const prev = $("u-preview");
  const renderPreview = () => {
    if (!state.headers.length) { prev.innerHTML = ""; $("s2").classList.remove("on"); return; }
    const sm = importSummary(state.calls); const other = Object.keys(sm.byYm).filter((y) => y !== state.ym); const inMonth = state.calls.filter((c) => c.ym === state.ym).length;
    const fields = [["datetime", "Date / time"], ["time", "Time"], ["caller", "Caller"], ["duration", "Duration"], ["outcome", "Outcome"], ["recording", "Recording"], ["summary", "AI summary"], ["value", "Estimate"], ["keyword", "Keyword"], ["campaign", "Campaign"], ["city", "City"], ["notes", "Notes"], ["callId", "Call ID"], ["source", "Source"]];
    prev.innerHTML = `<div class="card mt12"><div class="row"><div class="grow"><b style="font-size:15px">${h(state.fileName || "Pasted CSV")}</b><div class="small muted">${state.headers.length} columns · ${state.calls.length} calls parsed${state.skipped.length ? ` · ${state.skipped.length} rows skipped (no date)` : ""}</div></div><span class="chip ${other.length ? "warn" : "good"}">${other.length ? "Check months" : "Looks good"}</span></div>
    ${other.length ? `<p class="small mt8" style="color:var(--warn);font-weight:600">${other.map((y) => `${sm.byYm[y]} call${sm.byYm[y] === 1 ? "" : "s"} dated ${ymLabel(y, false)}`).join(", ")} in this file. Only the ${inMonth} ${ymLabel(state.ym, false)} rows will be imported.</p>` : ""}
    <div class="kpis" style="margin-top:12px"><div class="kpi"><div class="l">Calls</div><div class="v">${sm.n}</div></div><div class="kpi"><div class="l">Missed</div><div class="v">${sm.missed}<small>${pct(sm.missed, sm.n)}%</small></div></div><div class="kpi"><div class="l">Avg answered</div><div class="v">${dur(sm.avg)}</div></div><div class="kpi"><div class="l">Recordings</div><div class="v">${sm.recordings}</div></div></div>
    <details class="mt12"><summary>Column mapping</summary><div class="map mt8">${fields.map(([f, l]) => `<div class="${state.map[f] !== undefined ? "ok" : ""}"><span>${l}</span><span>${state.map[f] !== undefined ? h(state.headers[state.map[f]]) : "not found"}</span></div>`).join("")}</div></details>
    <details class="mt8"><summary>First rows</summary><div class="tbl-wrap mt8"><table class="tbl"><tr><th>When</th><th>Caller</th><th class="r">Dur</th><th>Outcome</th><th>Rec</th></tr>${state.calls.slice(0, 6).map((c) => `<tr><td>${fmtDate(c.called_at)} ${fmtTime(c.called_at)}</td><td>${h(c.caller_number)}</td><td class="r">${durShort(c.duration_sec)}</td><td>${c.outcome}</td><td>${c.recording_url ? "✓" : ""}</td></tr>`).join("")}</table></div></details></div>`;
    $("s2").classList.add("on");
  };
  const ingest = (text, name) => { const rows = parseCSV(text); if (rows.length < 2) { toast("Couldn't read that file", true); return; } state.headers = rows[0]; state.map = mapColumns(rows[0]); const r = rowsToCalls(rows, state.map); state.calls = r.calls; state.skipped = r.skipped; state.fileName = name || ""; renderPreview(); toast(`${state.calls.length} calls parsed`); };
  $("u-cid").onchange = (e) => go(`/admin/upload/${e.target.value}/${state.ym}`);
  $("u-ym").onchange = (e) => go(`/admin/upload/${state.cid}/${e.target.value}`);
  $("u-file").onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => ingest(t, f.name)); };
  const drop = $("drop"); ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("on"); })); ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("on"); })); drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => ingest(t, f.name)); });
  $("u-parse").onclick = () => ingest($("u-paste").value, "Pasted CSV");
  $("u-sample").onclick = () => { const [y, m] = state.ym.split("-"); const csv = SAMPLE_CSV.replace(/\{M\}/g, m).replace(/\{Y\}/g, y); $("u-paste").value = csv; $("u-paste").closest("details").open = true; ingest(csv, "nimbata-sample.csv"); };
  $("u-pdf").onchange = (e) => (state.pdf = e.target.files[0] || null);
  $("u-mail").onclick = (e) => e.currentTarget.classList.toggle("on");
  $("u-replace").onclick = (e) => e.currentTarget.classList.toggle("on");
  $("u-copy").onclick = () => { const c = client(state.cid); const inMonth = state.calls.filter((x) => x.ym === state.ym); const sm = importSummary(inMonth.length ? inMonth : DB.calls.filter((x) => x.client_id === state.cid && x.ym === state.ym).map((x) => ({ ...x, recording_url: x.recording_url }))); const enq = DB.enquiries.filter((x) => x.client_id === state.cid && x.ym === state.ym).length; const ad = $("u-ad").value;
    const kws = [...new Set((inMonth.length ? inMonth : DB.calls.filter((x) => x.client_id === state.cid && x.ym === state.ym)).map((x) => x.keyword).filter(Boolean))].slice(0, 5);
    const src = inMonth.length ? inMonth : DB.calls.filter((x) => x.client_id === state.cid && x.ym === state.ym);
    const sums = src.filter((x) => x.summary).slice(0, 15).map((x) => `- ${fmtDate(x.called_at)}: ${String(x.summary).slice(0, 160)}`);
    copyText(`Lead report notes for ${c.business_name} (${c.contact_name}), ${c.niche}, ${c.region}. ${ymLabel(state.ym)}. Plan ${c.package_name} ${money(c.monthly_fee)}/mo, target ${c.lead_target_min}-${c.lead_target_max}.\nCalls ${sm.n}, missed ${sm.missed} (${pct(sm.missed, sm.n)}%), avg answered ${dur(sm.avg)}, web enquiries ${enq}, total leads ${sm.n + enq}${ad ? `, ad spend $${ad}` : ""}.\nTop keywords: ${kws.join(", ") || "n/a"}.${sums.length ? `\nCall summaries:\n${sums.join("\n")}` : ""}\nWrite the client summary (2-3 sentences, plain English, like a text to a mate) and three "what I'm changing" points with a title and one or two sentences each.`, "Copied. Paste it to Claude."); };
  const collect = () => ({ summary: $("u-sum").value.trim(), points: [0, 1, 2].map((i) => ({ title: $("u-pt" + i).value.trim(), body: $("u-pb" + i).value.trim() })).filter((p) => p.title || p.body), adSpend: $("u-ad").value === "" ? null : Number($("u-ad").value) || 0 });
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
      const inMonth = state.calls.filter((x) => x.ym === state.ym).map(({ ym, ...r }) => r);
      let importNote = "";
      if (inMonth.length) { msg.textContent = `Importing ${inMonth.length} calls…`; const r = $("u-replace").classList.contains("on") ? await api.replaceMonthCalls(state.cid, state.ym, inMonth) : await api.mergeMonthCalls(state.cid, state.ym, inMonth); importNote = r.replaced ? ` · ${r.inserted} calls loaded` : ` · ${r.inserted} new, ${r.updated} refreshed`; }
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
async function renderSettings(ctx) {
  const isNew = !ctx.args[0]; const cur = CUR_YM();
  const c = isNew ? { id: "", business_name: "", initials: "", contact_name: "", email: "", phone: "", niche: "Emergency plumber", region: "", country: "NZ", timezone: "Pacific/Auckland", package_name: "Starter", monthly_fee: 1500, lead_target_min: 15, lead_target_max: 25, started_on: cur + "-01", billing_day: 1, show_cost_per_lead: true, show_ad_spend: false, avg_job_value: 450, active: true } : client(ctx.args[0]);
  if (!c) return go("/admin");
  const f = (id, l, v, type = "text", extra = "") => `<label class="fld"><span>${l}</span><input id="${id}" type="${type}" value="${h(v ?? "")}" ${extra}></label>`;
  app().innerHTML = topBar({ title: isNew ? "New partner" : "Settings", sub: isNew ? "Creates their login too" : h(c.business_name), back: isNew ? "/admin" : `/admin/client/${c.id}` }) + `<div class="shell">
  <div class="card mt16"><h2 style="font-size:16px;font-weight:600">Business</h2>${f("s-biz", "Business name", c.business_name)}<div class="two">${f("s-contact", "Contact first name", c.contact_name)}${f("s-init", "Initials (avatar)", c.initials)}</div><div class="two">${f("s-phone", "Mobile (number Nimbata forwards to)", c.phone, "tel")}${f("s-email", "Email (their login)", c.email, "email")}</div>
  <div class="two"><label class="fld"><span>Niche</span><select id="s-niche">${["Emergency plumber", "Emergency electrician", "Handyman", "Locksmith", "Roofer", "Drainlayer", "Builder", "Other"].map((n) => `<option ${c.niche === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>${f("s-region", "Region", c.region)}</div>
  <div class="two"><label class="fld"><span>Country</span><select id="s-country"><option ${c.country === "NZ" ? "selected" : ""}>NZ</option><option ${c.country === "AU" ? "selected" : ""}>AU</option></select></label><label class="fld"><span>Time zone</span><select id="s-tz">${TZ_OPTIONS.map((t) => `<option ${(c.timezone || TZ_FOR[c.country]) === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
  ${f("s-started", "Start date", c.started_on, "date")}</div>
  <div class="card mt12"><h2 style="font-size:16px;font-weight:600">Plan</h2><div class="two"><label class="fld"><span>Package</span><select id="s-pkg">${["Starter", "Growth", "Dominator", "Starter (trial)", "Custom"].map((n) => `<option ${c.package_name === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>${f("s-fee", "Monthly fee (ex GST)", c.monthly_fee, "number")}</div><div class="two">${f("s-tmin", "Lead target min", c.lead_target_min, "number")}${f("s-tmax", "Lead target max", c.lead_target_max, "number")}</div><div class="two">${f("s-bill", "Billing day of month", c.billing_day, "number", 'min="1" max="28"')}${f("s-avg", "Average job value (your estimate)", c.avg_job_value, "number")}</div><p class="small muted mt8">Shown as "Est." on every lead that has no estimate of its own. A CSV "Value" column sets per-lead estimates.</p>
  <div class="mt12"><div class="switch"><div><b>Show cost per lead</b><small>Worked out from their fee, not your ad spend: ${money(c.monthly_fee)} ÷ leads.</small></div><button class="tog ${c.show_cost_per_lead ? "on" : ""}" id="s-cpl"></button></div><div class="switch"><div><b>Show Google Ads spend</b><small>Off by default. Turning this on reveals your margin.</small></div><button class="tog ${c.show_ad_spend ? "on" : ""}" id="s-ads"></button></div></div></div>
  <div class="card mt12"><h2 style="font-size:16px;font-weight:600">Login</h2><p class="small muted mt8">They log in with the email above. Set a password here and send it to them, or let them use "Set up your login" on the login screen with that email.</p>${f("s-pass", isNew ? "Password for their login" : "Set or reset their password", "", "text", 'placeholder="e.g. Plumbing2026" autocomplete="off"')}<div class="btn-row mt12"><button class="btn ghost sm" style="flex:1" id="s-sendlogin">${ICON.copy}Copy login message</button></div></div>
  ${isNew ? "" : `<div class="card mt12"><h2 style="font-size:16px;font-weight:600">Website enquiries</h2><p class="small muted mt8">Add this to the landing page's enquiry route and every form submission lands in their portal instantly.</p><pre class="code mt8" id="hook">loading…</pre></div>`}
  <button class="btn primary mt16" id="s-save">${isNew ? "Create partner + login" : "Save settings"}</button>
  ${isNew || !c.active ? "" : `<button class="btn danger mt12" id="s-off">Partner is leaving…</button>
  <div class="card mt12 hidden" id="off-box"><h2 style="font-size:16px;font-weight:600">Why are they leaving?</h2><p class="small muted mt8">One tap. You'll see this on the past partners list and it shapes what we fix.</p><label class="fld"><span>Reason</span><select id="off-reason">${Object.entries(CHURN_REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="fld"><span>Note (optional)</span><textarea id="off-note" placeholder="e.g. Hired a second plumber, wants to pause until March"></textarea></label><div class="btn-row mt12"><button class="btn ghost" id="off-cancel">Keep them</button><button class="btn danger" id="off-go">Pause their portal</button></div></div>`}
  <div style="height:20px"></div></div>`;
  $("s-cpl").onclick = (e) => e.currentTarget.classList.toggle("on"); $("s-ads").onclick = (e) => e.currentTarget.classList.toggle("on");
  $("s-country").onchange = (e) => { $("s-tz").value = TZ_FOR[e.target.value] || "Pacific/Auckland"; };
  const read = () => ({ business_name: $("s-biz").value.trim(), contact_name: $("s-contact").value.trim(), initials: ($("s-init").value.trim() || $("s-biz").value.trim().split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2)).toUpperCase(), phone: $("s-phone").value.trim(), email: $("s-email").value.trim().toLowerCase() || null, niche: $("s-niche").value, region: $("s-region").value.trim(), country: $("s-country").value, timezone: $("s-tz").value, started_on: $("s-started").value || cur + "-01", package_name: $("s-pkg").value, monthly_fee: Number($("s-fee").value) || 0, lead_target_min: Number($("s-tmin").value) || 0, lead_target_max: Number($("s-tmax").value) || 0, billing_day: Math.min(28, Math.max(1, Number($("s-bill").value) || 1)), avg_job_value: Number($("s-avg").value) || 0, show_cost_per_lead: $("s-cpl").classList.contains("on"), show_ad_spend: $("s-ads").classList.contains("on") });
  $("s-save").onclick = async () => { const v = read(); if (!v.business_name) { toast("Business name is needed", true); return; }
    const btn = $("s-save"); btn.setAttribute("disabled", "");
    try { const saved = await api.upsertClient(isNew ? v : { id: c.id, ...v });
      const ix = DB.clients.findIndex((x) => x.id === saved.id); if (ix >= 0) DB.clients[ix] = saved; else DB.clients.push(saved);
      const pw = $("s-pass").value.trim(); let note = "";
      if (pw || (isNew && v.email)) { if (!v.email) note = " · no email, so no login yet"; else if (!pw) note = " · no password set, they can use Set up your login"; else { try { await api.createLogin(saved.id, v.email, pw); note = " · login ready"; } catch (ex) { note = " · login not created: " + ex.message; } } }
      await refreshAdmin(); toast((isNew ? "Partner created" : "Saved") + note, /not created/.test(note)); setTimeout(() => go(`/admin/client/${saved.id}`), 600); }
    catch (ex) { toast(ex.message, true); btn.removeAttribute("disabled"); } };
  $("s-sendlogin").onclick = () => { const v = read(); const pw = $("s-pass").value.trim() || "(set a password first)"; copyText(`Hey ${v.contact_name}, your LeadHive portal is live.\n\nLog in: ${PORTAL_URL}\nEmail: ${v.email || "(add their email)"}\nPassword: ${pw}\n\nYou'll see every call and web enquiry, listen to recordings, and get my monthly notes there. Add it to your home screen and it works like an app. Tag each lead as won/quoted/not a lead when you get a sec, it shows your real return.\n\n${JOE.name}`, "Login message copied"); };
  const off = $("s-off"); if (off) off.onclick = () => { $("off-box").classList.toggle("hidden"); $("off-box").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const offC = $("off-cancel"); if (offC) offC.onclick = () => $("off-box").classList.add("hidden");
  const offG = $("off-go"); if (offG) offG.onclick = async () => { try { offG.setAttribute("disabled", ""); await api.deactivateClient(c.id, $("off-reason").value, $("off-note").value.trim()); Object.assign(c, { active: false, churned_on: new Date().toISOString().slice(0, 10), churn_reason: $("off-reason").value, churn_note: $("off-note").value.trim() }); toast(`${c.business_name} paused. Their data is kept.`); go(`/admin/client/${c.id}`); } catch (ex) { toast(ex.message, true); offG.removeAttribute("disabled"); } };
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
