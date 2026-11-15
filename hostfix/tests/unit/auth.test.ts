import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_SECONDS,
  createAdminToken,
  passwordMatches,
  readAdminSettings,
  verifyAdminToken,
  type AdminSettings,
} from "@/lib/auth/admin-session";
import { createLeadToken, isUuid, LEAD_COOKIE_SECONDS, readLeadToken } from "@/lib/auth/lead-token";
import { safeEqual } from "@/lib/auth/signing";

const settings: AdminSettings = { password: "correct horse battery", secret: "s".repeat(40) };
const NOW = Date.UTC(2026, 10, 15);

describe("admin settings", () => {
  it("accepts a proper password and secret", () => {
    expect(readAdminSettings({ ADMIN_PASSWORD: " correct horse battery ", APP_SECRET: "s".repeat(40) })).toEqual({ settings });
  });

  it("says exactly what is missing, so sign-in is never open by accident", () => {
    expect(readAdminSettings({})).toEqual({ problems: ["ADMIN_PASSWORD is not set.", "APP_SECRET is not set."] });
    expect(readAdminSettings({ ADMIN_PASSWORD: "   ", APP_SECRET: "" })).toEqual({
      problems: ["ADMIN_PASSWORD is not set.", "APP_SECRET is not set."],
    });
  });

  it("refuses weak values", () => {
    expect(readAdminSettings({ ADMIN_PASSWORD: "short", APP_SECRET: "tiny" })).toEqual({
      problems: ["ADMIN_PASSWORD is too short. Use at least 10 characters.", "APP_SECRET is too short. It needs at least 32 characters."],
    });
  });
});

describe("admin password", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches(settings, "correct horse battery")).toBe(true);
    expect(passwordMatches(settings, "correct horse batter")).toBe(false);
    expect(passwordMatches(settings, "Correct horse battery")).toBe(false);
    expect(passwordMatches(settings, "")).toBe(false);
    expect(passwordMatches(settings, "correct horse battery ")).toBe(false);
  });

  it("compares safely whatever the lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("admin pass", () => {
  it("is accepted until it expires", () => {
    const token = createAdminToken(settings, NOW);
    expect(verifyAdminToken(settings, token, NOW)).toBe(true);
    expect(verifyAdminToken(settings, token, NOW + ADMIN_SESSION_SECONDS * 1000 - 1)).toBe(true);
    expect(verifyAdminToken(settings, token, NOW + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  });

  it("is different every time", () => {
    expect(createAdminToken(settings, NOW)).not.toBe(createAdminToken(settings, NOW));
  });

  it("is rejected when missing, malformed or tampered with", () => {
    const token = createAdminToken(settings, NOW);
    const [version, expires, nonce, signature] = token.split(".");
    expect(verifyAdminToken(settings, undefined, NOW)).toBe(false);
    expect(verifyAdminToken(settings, "", NOW)).toBe(false);
    expect(verifyAdminToken(settings, "v1.x.y", NOW)).toBe(false);
    expect(verifyAdminToken(settings, "x".repeat(400), NOW)).toBe(false);
    expect(verifyAdminToken(settings, `${version}.${Number(expires) + 86_400_000}.${nonce}.${signature}`, NOW)).toBe(false);
    expect(verifyAdminToken(settings, `${version}.${expires}.${nonce}x.${signature}`, NOW)).toBe(false);
    expect(verifyAdminToken(settings, `${version}.${expires}.${nonce}.${signature?.slice(0, -2)}AA`, NOW)).toBe(false);
    expect(verifyAdminToken(settings, `v2.${expires}.${nonce}.${signature}`, NOW)).toBe(false);
  });

  it("stops working the moment the password or the secret changes", () => {
    const token = createAdminToken(settings, NOW);
    expect(verifyAdminToken({ ...settings, password: "a brand new password" }, token, NOW)).toBe(false);
    expect(verifyAdminToken({ ...settings, secret: "t".repeat(40) }, token, NOW)).toBe(false);
  });

  it("cannot be made by someone who knows the password but not the secret", () => {
    const forged = createAdminToken({ password: settings.password, secret: "guess".repeat(8) }, NOW);
    expect(verifyAdminToken(settings, forged, NOW)).toBe(false);
  });
});

describe("lead note", () => {
  const secret = "k".repeat(40);
  const leadId = "11111111-1111-4111-8111-111111111111";

  it("round-trips a lead id until it expires", () => {
    const token = createLeadToken(secret, leadId, NOW);
    expect(readLeadToken(secret, token, NOW)).toBe(leadId);
    expect(readLeadToken(secret, token, NOW + LEAD_COOKIE_SECONDS * 1000 - 1)).toBe(leadId);
    expect(readLeadToken(secret, token, NOW + LEAD_COOKIE_SECONDS * 1000)).toBeNull();
  });

  it("cannot be pointed at a different lead", () => {
    const token = createLeadToken(secret, leadId, NOW);
    const other = "22222222-2222-4222-8222-222222222222";
    expect(readLeadToken(secret, token.replace(leadId, other), NOW)).toBeNull();
    expect(readLeadToken("another-secret-another-secret-12345", token, NOW)).toBeNull();
    expect(readLeadToken(secret, undefined, NOW)).toBeNull();
    expect(readLeadToken(secret, "garbage", NOW)).toBeNull();
    expect(readLeadToken(secret, "x".repeat(400), NOW)).toBeNull();
  });

  it("only signs real lead ids", () => {
    expect(() => createLeadToken(secret, "not-an-id", NOW)).toThrow();
    expect(isUuid(leadId)).toBe(true);
    expect(isUuid("../../etc/passwd")).toBe(false);
  });
});
