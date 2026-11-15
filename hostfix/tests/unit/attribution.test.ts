import { describe, expect, it } from "vitest";
import { deriveSource, parseAttribution, sourceLabel } from "@/lib/attribution";

describe("parseAttribution", () => {
  it("reads the hidden form field", () => {
    expect(parseAttribution('{"utm_source":"facebook","utm_campaign":"owners-qt","fbclid":"abc"}')).toEqual({
      utm_source: "facebook",
      utm_campaign: "owners-qt",
      fbclid: "abc",
    });
  });

  it("returns nothing for empty or broken input", () => {
    expect(parseAttribution("")).toEqual({});
    expect(parseAttribution("{not json")).toEqual({});
    expect(parseAttribution(null)).toEqual({});
    expect(parseAttribution(undefined)).toEqual({});
    expect(parseAttribution("[1,2]")).toEqual({});
    expect(parseAttribution('"just a string"')).toEqual({});
  });

  it("drops unknown keys and values that are not text", () => {
    expect(parseAttribution('{"utm_source":"x","evil":"y","gclid":123,"ref":{"a":1}}')).toEqual({ utm_source: "x" });
  });

  it("cuts very long values short and strips control characters", () => {
    const parsed = parseAttribution(JSON.stringify({ utm_campaign: "a".repeat(1000), utm_term: "line1\nline2\u0000" }));
    expect(parsed.utm_campaign).toHaveLength(300);
    expect(parsed.utm_term).toBe("line1line2");
  });
});

describe("deriveSource", () => {
  it.each([
    [{ fbclid: "abc" }, "meta"],
    [{ utm_source: "facebook", utm_medium: "paid" }, "meta"],
    [{ utm_source: "Instagram" }, "meta"],
    [{ utm_source: "ig", utm_medium: "story" }, "meta"],
    [{ gclid: "xyz" }, "google_ads"],
    [{ utm_source: "google", utm_medium: "cpc" }, "google_ads"],
    [{ utm_source: "google", utm_medium: "organic" }, "google_search"],
    [{ utm_source: "newsletter" }, "newsletter"],
    [{ utm_source: "QR Code (fridge)" }, "qr_code_fridge"],
    [{ ref: "jane-cleaner" }, "referral"],
    [{ referrer: "https://www.google.co.nz/search?q=x" }, "google_search"],
    [{ referrer: "https://l.facebook.com/l.php" }, "meta"],
    [{ referrer: "https://www.bing.com/search" }, "bing_search"],
    [{ referrer: "https://www.queenstownnz.co.nz/stay" }, "site:queenstownnz.co.nz"],
    [{ referrer: "not a url" }, "direct"],
    [{}, "direct"],
  ])("%j is %s", (attribution, expected) => {
    expect(deriveSource(attribution)).toBe(expected);
  });

  it("lets an ad click win over the site that sent the visitor", () => {
    expect(deriveSource({ gclid: "x", referrer: "https://www.facebook.com/" })).toBe("google_ads");
    expect(deriveSource({ utm_source: "newsletter", referrer: "https://www.google.com/" })).toBe("newsletter");
  });
});

describe("sourceLabel", () => {
  it("uses plain words", () => {
    expect(sourceLabel("meta")).toBe("Facebook / Instagram");
    expect(sourceLabel("google_ads")).toBe("Google Ads");
    expect(sourceLabel("direct")).toBe("Direct");
    expect(sourceLabel("site:queenstownnz.co.nz")).toBe("queenstownnz.co.nz");
    expect(sourceLabel("qr_code_fridge")).toBe("Qr code fridge");
    expect(sourceLabel("")).toBe("Direct");
  });
});
