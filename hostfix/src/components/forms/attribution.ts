/**
 * Remembers how a visitor arrived (which ad, which site) for the length of
 * their visit, so a lead can be matched to its source even if they look at a
 * few pages before filling in the form. Runs in the browser only.
 */

const STORAGE_KEY = "hf_attribution";
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ref"];
const MAX_LENGTH = 300;

/** Returns the saved details as text for the hidden form field. Never throws. */
export function captureAttribution(): string {
  try {
    const url = new URL(window.location.href);
    const fromLink: Record<string, string> = {};
    for (const key of CAMPAIGN_PARAMS) {
      const value = url.searchParams.get(key);
      if (value) fromLink[key] = value.slice(0, MAX_LENGTH);
    }

    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    // Keep the first-seen details unless this page was opened from a new ad link.
    if (saved && Object.keys(fromLink).length === 0) return saved;

    const details: Record<string, string> = { ...fromLink, landing_path: url.pathname.slice(0, MAX_LENGTH) };
    if (document.referrer) {
      try {
        if (new URL(document.referrer).host !== window.location.host) {
          details.referrer = document.referrer.slice(0, MAX_LENGTH);
        }
      } catch {
        // An unreadable referrer is simply left out.
      }
    }
    const text = JSON.stringify(details);
    window.sessionStorage.setItem(STORAGE_KEY, text);
    return text;
  } catch {
    return "";
  }
}
