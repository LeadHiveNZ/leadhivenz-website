/**
 * Works out where a lead came from, using the tags on the link they clicked
 * (utm_source and friends), the click IDs Meta and Google add, and the site
 * that sent them.
 */

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ref?: string;
  referrer?: string;
  landing_path?: string;
};

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ref",
  "referrer",
  "landing_path",
] as const satisfies readonly (keyof Attribution)[];

const MAX_LENGTH = 300;

/**
 * Reads the hidden form field. It comes from the visitor's browser, so nothing
 * in it is trusted: unknown keys are dropped and long values are cut short.
 */
export function parseAttribution(input: unknown): Attribution {
  let data: unknown = input;
  if (typeof input === "string") {
    if (input.trim() === "") return {};
    try {
      data = JSON.parse(input);
    } catch {
      return {};
    }
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};

  const result: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_LENGTH);
    if (cleaned !== "") result[key] = cleaned;
  }
  return result;
}

const META_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta", "messenger", "audience_network", "an", "threads"]);
const GOOGLE_SOURCES = new Set(["google", "adwords", "googleads", "google_ads", "youtube"]);
const PAID_MEDIUMS = /(cpc|ppc|paid|ads?$|display|pmax)/i;

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * One short code for the lead's source. Order matters: a tagged ad click wins
 * over the referring site, and the referring site wins over "direct".
 */
export function deriveSource(a: Attribution): string {
  const utmSource = a.utm_source ? slug(a.utm_source) : "";

  if (a.fbclid || META_SOURCES.has(utmSource)) return "meta";

  if (a.gclid) return "google_ads";
  if (GOOGLE_SOURCES.has(utmSource)) {
    return a.utm_medium && PAID_MEDIUMS.test(a.utm_medium) ? "google_ads" : "google_search";
  }

  if (utmSource) return utmSource;
  if (a.ref) return "referral";

  const host = hostOf(a.referrer);
  if (host) {
    if (/(^|\.)google\./.test(host)) return "google_search";
    if (/(^|\.)(facebook|instagram|fb)\.(com|me)$/.test(host)) return "meta";
    if (/(^|\.)bing\.com$/.test(host)) return "bing_search";
    return `site:${host.slice(0, 60)}`;
  }

  return "direct";
}

const LABELS: Record<string, string> = {
  meta: "Facebook / Instagram",
  google_ads: "Google Ads",
  google_search: "Google search",
  bing_search: "Bing search",
  referral: "Referral",
  direct: "Direct",
};

/** The source in plain words for the leads list and alert messages. */
export function sourceLabel(source: string): string {
  const known = LABELS[source];
  if (known) return known;
  if (source.startsWith("site:")) return source.slice(5);
  const words = source.replace(/_/g, " ").trim();
  return words === "" ? "Direct" : words.charAt(0).toUpperCase() + words.slice(1);
}
