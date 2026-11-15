import { describe, expect, it, vi } from "vitest";
import { setupStatus, type StatusItem } from "@/lib/status";

async function statusOf(key: string): Promise<StatusItem> {
  const item = (await setupStatus()).find((entry) => entry.key === key);
  if (!item) throw new Error(`no status line for ${key}`);
  return item;
}

describe("the setup checklist", () => {
  it("lists every part of the system once", async () => {
    const keys = (await setupStatus()).map((item) => item.key);
    expect(keys).toEqual(["database", "email", "sms", "payments", "pixel", "capi", "analytics", "copy", "legal"]);
  });

  it("marks nothing as ready on a fresh install", async () => {
    const items = await setupStatus();
    expect(items.filter((item) => item.state === "ok")).toEqual([]);
  });

  it("never claims the legal pages are done", async () => {
    expect(await statusOf("legal")).toMatchObject({ state: "todo", detail: expect.stringContaining("A lawyer needs to write them") });
  });

  it("counts the [EDIT] placeholders still in the copy and brand settings", async () => {
    const copy = await statusOf("copy");
    expect(copy.state).toBe("todo");
    expect(copy.detail).toMatch(/\d+ \[EDIT\] placeholders? still to replace/);
    expect(copy.detail).toContain("content/landing-owner.md");
  });
});

describe("database line", () => {
  it("says demo mode on a developer's computer", async () => {
    expect(await statusOf("database")).toMatchObject({ state: "todo", detail: expect.stringContaining("Demo mode") });
  });

  it("is a problem on the live site until Supabase is connected", async () => {
    vi.stubEnv("VERCEL", "1");
    expect(await statusOf("database")).toEqual({
      key: "database",
      label: "Database",
      state: "problem",
      detail: "SUPABASE_URL and SUPABASE_SECRET_KEY are not set. Leads cannot be saved until this is fixed.",
    });
  });

  it("catches the publishable key being pasted where the secret key belongs", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_publishable_abc");
    const database = await statusOf("database");
    expect(database.state).toBe("problem");
    expect(database.detail).toContain("holds the publishable key");
  });
});

describe("alert lines", () => {
  it("email is ready once there is a key and an address, and warns about the test sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_1");
    expect(await statusOf("email")).toMatchObject({ state: "todo", detail: "ALERT_EMAIL_TO is not set." });
    vi.stubEnv("ALERT_EMAIL_TO", "joe@example.com");
    const email = await statusOf("email");
    expect(email.state).toBe("ok");
    expect(email.detail).toContain("Alerts go to joe@example.com.");
    expect(email.detail).toContain("test sender");
    vi.stubEnv("EMAIL_FROM", "HostFix <alerts@hostfix.example>");
    expect((await statusOf("email")).detail).toBe("Alerts go to joe@example.com.");
  });

  it("texts are ready once there is a login and a number in international format", async () => {
    vi.stubEnv("CLICKSEND_USERNAME", "joe");
    vi.stubEnv("CLICKSEND_API_KEY", "KEY");
    expect(await statusOf("sms")).toMatchObject({ state: "todo", detail: "ALERT_SMS_TO is not set." });
    vi.stubEnv("ALERT_SMS_TO", "0412 345 678");
    expect(await statusOf("sms")).toMatchObject({
      state: "problem",
      detail: "ALERT_SMS_TO must start with + and the country code, for example +61412345678 or +64211234567.",
    });
    vi.stubEnv("ALERT_SMS_TO", "+61 412 345 678");
    expect(await statusOf("sms")).toMatchObject({ state: "ok", detail: "Texts go to +61412345678 through ClickSend." });
  });
});

describe("card payments line", () => {
  it("walks from not connected, to missing webhook, to test mode, to live", async () => {
    expect(await statusOf("payments")).toMatchObject({ state: "todo", detail: "STRIPE_NZ_SECRET_KEY is not set." });

    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_abc");
    const noWebhook = await statusOf("payments");
    expect(noWebhook.state).toBe("problem");
    expect(noWebhook.detail).toContain("STRIPE_NZ_WEBHOOK_SECRET is not set.");

    vi.stubEnv("STRIPE_NZ_WEBHOOK_SECRET", "whsec_abc");
    expect(await statusOf("payments")).toMatchObject({ state: "todo", detail: expect.stringContaining("TEST mode") });

    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_live_abc");
    expect(await statusOf("payments")).toMatchObject({ state: "ok", detail: "Connected and taking real payments." });
  });

  it("flags a key that is the wrong kind", async () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "pk_live_abc");
    expect(await statusOf("payments")).toMatchObject({ state: "problem", detail: expect.stringContaining("publishable key") });
  });
});

describe("Meta lines", () => {
  it("asks for the Pixel first, then the Conversions API token", async () => {
    expect(await statusOf("pixel")).toMatchObject({ state: "todo", detail: "NEXT_PUBLIC_META_PIXEL_ID is not set." });
    expect(await statusOf("capi")).toMatchObject({ state: "todo", detail: "Set up the Meta Pixel first, then add META_CAPI_ACCESS_TOKEN." });

    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
    expect(await statusOf("pixel")).toMatchObject({ state: "ok", detail: "Pixel 1234567890 is on the public pages." });
    expect(await statusOf("capi")).toMatchObject({ state: "todo", detail: "META_CAPI_ACCESS_TOKEN is not set." });

    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOKEN");
    expect(await statusOf("capi")).toMatchObject({ state: "ok" });

    vi.stubEnv("META_TEST_EVENT_CODE", "TEST1");
    expect(await statusOf("capi")).toMatchObject({ state: "todo", detail: expect.stringContaining("Remove META_TEST_EVENT_CODE") });
  });

  it("rejects a Pixel ID that is not a number", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "my-pixel");
    expect(await statusOf("pixel")).toMatchObject({ state: "todo", detail: "NEXT_PUBLIC_META_PIXEL_ID should be the Pixel ID: digits only." });
  });
});
