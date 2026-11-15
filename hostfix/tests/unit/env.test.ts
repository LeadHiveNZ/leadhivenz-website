import { describe, expect, it, vi } from "vitest";
import { appSecret, appSecretProblem, baseUrl, demoModeAllowed, env } from "@/lib/env";

describe("env", () => {
  it("treats blank values as missing and trims the rest", () => {
    vi.stubEnv("HF_TEST_A", "  value  ");
    vi.stubEnv("HF_TEST_B", "   ");
    expect(env("HF_TEST_A")).toBe("value");
    expect(env("HF_TEST_B")).toBeUndefined();
    expect(env("HF_TEST_MISSING")).toBeUndefined();
  });
});

describe("demo mode", () => {
  it("is available on a developer's computer", () => {
    expect(demoModeAllowed()).toBe(true);
  });

  it("is off for a production build unless asked for", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(demoModeAllowed()).toBe(false);
    vi.stubEnv("HOSTFIX_DEMO", "1");
    expect(demoModeAllowed()).toBe(true);
  });

  it("can never switch on once the site is hosted on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("HOSTFIX_DEMO", "1");
    expect(demoModeAllowed()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(demoModeAllowed()).toBe(false);
  });
});

describe("the site's own address", () => {
  it("uses APP_URL when set, without a trailing slash", () => {
    vi.stubEnv("APP_URL", "https://hostfix.example/");
    expect(baseUrl()).toBe("https://hostfix.example");
  });

  it("falls back to this computer", () => {
    expect(baseUrl()).toBe("http://localhost:3000");
    vi.stubEnv("PORT", "4000");
    expect(baseUrl()).toBe("http://localhost:4000");
  });

  it("works itself out on the live Vercel site", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "hostfix.co.nz");
    vi.stubEnv("VERCEL_URL", "hostfix-abc123.vercel.app");
    expect(baseUrl()).toBe("https://hostfix.co.nz");
    vi.stubEnv("APP_URL", "https://www.hostfix.co.nz");
    expect(baseUrl()).toBe("https://www.hostfix.co.nz");
  });

  it("uses the preview address on a Vercel preview, so test payments come back to the preview", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "hostfix.co.nz");
    vi.stubEnv("VERCEL_BRANCH_URL", "hostfix-git-my-branch.vercel.app");
    vi.stubEnv("VERCEL_URL", "hostfix-abc123.vercel.app");
    vi.stubEnv("APP_URL", "https://hostfix.co.nz");
    expect(baseUrl()).toBe("https://hostfix-git-my-branch.vercel.app");
  });
});

describe("the signing secret", () => {
  it("uses APP_SECRET when it is long enough", () => {
    vi.stubEnv("APP_SECRET", "x".repeat(32));
    expect(appSecret()).toBe("x".repeat(32));
    expect(appSecretProblem()).toBeNull();
  });

  it("falls back to a development value only off the live site", () => {
    expect(appSecret()).toMatch(/dev-only/);
    vi.stubEnv("NODE_ENV", "production");
    expect(appSecret()).toBeNull();
    vi.stubEnv("VERCEL", "1");
    expect(appSecret()).toBeNull();
  });

  it("refuses a short secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "too-short");
    expect(appSecret()).toBeNull();
    expect(appSecretProblem()).toBe("APP_SECRET is too short. It needs at least 32 characters.");
  });

  it("says when it is missing", () => {
    expect(appSecretProblem()).toBe("APP_SECRET is not set.");
  });
});
