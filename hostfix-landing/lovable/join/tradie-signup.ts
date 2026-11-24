import AGREEMENT_TEXT from "@/content/tradie-agreement-24-nov-2026.md?raw";

/** Shared rules for /tradies/join: used by the form (for friendly errors) and the server (the real check). */
export { AGREEMENT_TEXT };
export const AGREEMENT_VERSION = "24 November 2026";
export const TRADES: [string, string][] = [
  ["plumber", "Plumber"],
  ["electrician", "Electrician"],
  ["gasfitter", "Gasfitter"],
  ["handyman", "Handyman"],
  ["other", "Other"],
];
export const LICENSED_TRADES = ["plumber", "electrician", "gasfitter"];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
};

export type Licence = { trade: string; number: string; expiry: string };
export type SignupData = {
  full_name: string;
  business_name: string | null;
  phone: string;
  email: string;
  nzbn: string | null;
  gst_registered: boolean;
  gst_number: string | null;
  trades: string[];
  towns: string;
  work_days: string[];
  licences: Licence[];
  lbp_number: string | null;
  insurer: string;
  policy_number: string;
  insurance_expiry: string;
  record_requested: boolean;
  existing_clients: string | null;
  signature_name: string;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

/** Read fields as strings (first value) or lists (all values). Works with FormData on both sides. */
export type FieldSource = { get(key: string): unknown; getAll(key: string): unknown[] };

function str(src: FieldSource, key: string, max: number): string | null {
  const value = src.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return "\u0000too-long";
  return trimmed === "" ? null : trimmed;
}

/** YYYY-MM-DD, a real date, not before `today` (also YYYY-MM-DD). */
export function isCurrentDate(value: string | null, today: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return value >= today;
}

export function nzToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now);
}

export type FileInfo = { name: string; type: string; size: number } | null;

/** Returns the lowercase extension if the file is an allowed PDF/JPG/PNG under 10 MB, else null. */
export function checkFile(file: FileInfo): string | null {
  if (!file || file.size <= 0 || file.size > MAX_FILE_BYTES) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const types = FILE_TYPES[ext];
  if (!types || !types.includes(file.type.toLowerCase())) return null;
  return ext === "jpeg" ? "jpg" : ext;
}

export type SignupErrors = Record<string, string>;

export function validateSignup(
  src: FieldSource,
  files: { insurance: FileInfo; record: FileInfo },
  today: string,
): { ok: true; data: SignupData } | { ok: false; errors: SignupErrors } {
  const e: SignupErrors = {};
  const tooLong = (v: string | null) => v === "\u0000too-long";

  const full_name = str(src, "full_name", 100);
  if (!full_name || tooLong(full_name) || full_name.length < 2) e["full_name"] = "Please enter your full name.";
  const business_name = str(src, "business_name", 120);
  if (tooLong(business_name)) e["business_name"] = "That's too long.";
  const phone = str(src, "phone", 30);
  if (!phone || tooLong(phone) || phone.replace(/\D/g, "").length < 8 || !/^[0-9+()\s-]+$/.test(phone)) e["phone"] = "Please check your mobile number.";
  const email = str(src, "email", 255);
  if (!email || tooLong(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e["email"] = "Please check your email.";
  const nzbn = str(src, "nzbn", 20);
  if (nzbn && (tooLong(nzbn) || !/^\d{13}$/.test(nzbn.replace(/\s/g, "")))) e["nzbn"] = "An NZBN is 13 digits.";
  const gst = str(src, "gst_registered", 5);
  if (gst !== "yes" && gst !== "no") e["gst_registered"] = "Pick one.";
  const gst_number = str(src, "gst_number", 20);
  if (gst === "yes" && (!gst_number || tooLong(gst_number) || !/^\d{8,9}$/.test(gst_number.replace(/[\s-]/g, "")))) e["gst_number"] = "A GST number is 8 or 9 digits.";

  const tradeKeys = TRADES.map(([k]) => k);
  const tradesRaw = src.getAll("trades").filter((v): v is string => typeof v === "string");
  const trades = tradeKeys.filter((k) => tradesRaw.includes(k));
  if (trades.length === 0 || tradesRaw.some((t) => !tradeKeys.includes(t))) e["trades"] = "Pick at least one trade.";
  const towns = str(src, "towns", 200);
  if (!towns || tooLong(towns) || towns.length < 2) e["towns"] = "Which towns do you cover?";
  const daysRaw = src.getAll("work_days").filter((v): v is string => typeof v === "string");
  if (daysRaw.some((d) => !DAYS.includes(d))) e["work_days"] = "Pick days from the list.";
  const work_days = DAYS.filter((d) => daysRaw.includes(d));

  const licences: Licence[] = [];
  for (const trade of trades.filter((t) => LICENSED_TRADES.includes(t))) {
    const number = str(src, `licence_number_${trade}`, 40);
    const expiry = str(src, `licence_expiry_${trade}`, 10);
    if (!number || tooLong(number)) e[`licence_number_${trade}`] = "Enter your licence number.";
    if (!isCurrentDate(expiry, today)) e[`licence_expiry_${trade}`] = "Enter an expiry date that hasn't passed.";
    if (number && expiry) licences.push({ trade, number, expiry });
  }
  const lbp_number = str(src, "lbp_number", 40);
  if (tooLong(lbp_number)) e["lbp_number"] = "That's too long.";

  const insurer = str(src, "insurer", 100);
  if (!insurer || tooLong(insurer) || insurer.length < 2) e["insurer"] = "Who is your insurer?";
  const policy_number = str(src, "policy_number", 60);
  if (!policy_number || tooLong(policy_number)) e["policy_number"] = "Enter your policy number.";
  const insurance_expiry = str(src, "insurance_expiry", 10);
  if (!isCurrentDate(insurance_expiry, today)) e["insurance_expiry"] = "Enter an expiry date that hasn't passed.";
  if (!checkFile(files.insurance)) e["insurance_file"] = "Upload your certificate: PDF, JPG or PNG, up to 10 MB.";

  const record_requested = src.get("record_requested") === "yes";
  if (files.record) {
    if (!checkFile(files.record)) e["record_file"] = "Upload a PDF, JPG or PNG, up to 10 MB.";
  } else if (!record_requested) e["record_file"] = "Upload your record, or tick that you've requested it.";

  const existing_clients = str(src, "existing_clients", 2000);
  if (tooLong(existing_clients)) e["existing_clients"] = "Please keep this under 2,000 characters.";

  for (const key of ["agree_terms", "agree_contractor", "agree_true"]) {
    if (src.get(key) !== "yes") e[key] = "Please tick this to sign.";
  }
  const signature_name = str(src, "signature_name", 100);
  if (!signature_name || tooLong(signature_name) || !full_name || signature_name.toLowerCase().replace(/\s+/g, " ") !== full_name.toLowerCase().replace(/\s+/g, " ")) {
    e["signature_name"] = "Type your full name exactly as above.";
  }

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  const utm = (k: string) => {
    const v = str(src, k, 255);
    return v && !tooLong(v) ? v : null;
  };
  return {
    ok: true,
    data: {
      full_name: full_name!,
      business_name,
      phone: phone!,
      email: email!,
      nzbn: nzbn ? nzbn.replace(/\s/g, "") : null,
      gst_registered: gst === "yes",
      gst_number: gst === "yes" ? gst_number!.replace(/[\s-]/g, "") : null,
      trades,
      towns: towns!,
      work_days,
      licences,
      lbp_number,
      insurer: insurer!,
      policy_number: policy_number!,
      insurance_expiry: insurance_expiry!,
      record_requested: files.record ? false : true,
      existing_clients,
      signature_name: signature_name!,
      utm_source: utm("utm_source"),
      utm_campaign: utm("utm_campaign"),
      utm_content: utm("utm_content"),
    },
  };
}
