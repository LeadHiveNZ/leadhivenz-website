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
    expect(keys).toEqual(["database", "email", "sms", "payments", "timer", "photos", "pixel", "capi", "analytics", "copy", "founding-queenstown", "legal"]);
  });

  it("marks nothing as ready on a fresh install", async () => {
    const items = await setupStatus();
    expect(items.filter((item) => item.state === "ok")).toEqual([]);
  });

  it("never claims the legal pages are done until a person has reviewed them", async () => {
    expect(await statusOf("legal")).toMatchObject({ state: "todo", detail: expect.stringContaining("Community Law") });
  });

  it("counts the [EDIT] placeholders still in the copy and brand settings", async () => {
    const copy = await statusOf("copy");
    expect(copy.state).toBe("todo");
    expect(copy.detail).toMatch(/\d+ \[EDIT\] placeholders? still to replace/);
    // The page copy is written. The contact email and company name are the owner's to fill in.
    expect(copy.detail).toContain("2 in config/brand.ts");
    expect(copy.detail).not.toContain("content/landing-owner.md");
  });

  it("shows the founding promises next to what billing actually does, until someone checks", async () => {
    const line = await statusOf("founding-queenstown");
    expect(line.label).toBe("Founding billing (Queenstown)");
    expect(line.state).toBe("todo");
    expect(line.detail).toContain('"Half price for your first three months: $49.50 a month, then $99"');
    expect(line.detail).toContain("the deposit comes off the first month's bill (up to one month's price), then the membership is full price");
    expect(line.detail).toContain("0 founding spots taken so far.");
  });
});

describe("database line", () => {
  it("says demo mode on a developer's computer", async () => {
    expect(await statusOf("database")).toMatchObject({ state: "todo", detail: expect.stringContaining("Demo mode") });
  });

  it("is a problem on the live site until the database is connected", async () => {
    vi.stubEnv("VERCEL", "1");
    expect(await statusOf("database")).toEqual({
      key: "database",
      label: "Database",
      state: "problem",
      detail: "DATABASE_URL is not set. Nothing can be saved until this is fixed.",
    });
  });

  it("catches the wrong kind of database address being pasted in", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres");
    const database = await statusOf("database");
    expect(database.state).toBe("problem");
    expect(database.detail).toContain("Transaction pooler");
  });

  it("catches the password placeholder being left in", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres");
    expect((await statusOf("database")).detail).toContain("[YOUR-PASSWORD]");
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
    expect(await statusOf("payments")).toMatchObject({ state: "ok", detail: expect.stringContaining("Connected and taking real payments.") });
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

describe("the timer line", () => {
  it("says the app runs its own timer in demo mode", async () => {
    expect(await statusOf("timer")).toMatchObject({ state: "todo", detail: expect.stringContaining("Demo mode") });
  });

  it("is a problem on the live site without CRON_SECRET, and says what stops working", async () => {
    vi.stubEnv("VERCEL", "1");
    const line = await statusOf("timer");
    expect(line.state).toBe("problem");
    expect(line.detail).toContain("CRON_SECRET is not set");
    expect(line.detail).toContain("tradies are not paid");
  });

  it("is a problem when the secret is set but the timer has never run", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CRON_SECRET", "a-long-enough-secret-value");
    expect(await statusOf("timer")).toMatchObject({ state: "problem", detail: expect.stringContaining("It has never run.") });
  });
});

describe("the photo storage line", () => {
  it("keeps photos on this computer in demo mode", async () => {
    expect(await statusOf("photos")).toMatchObject({ state: "todo", detail: expect.stringContaining("Demo mode") });
  });

  it("is a problem on the live site until storage is connected, because a job cannot be finished without a photo", async () => {
    vi.stubEnv("VERCEL", "1");
    const line = await statusOf("photos");
    expect(line.state).toBe("problem");
    expect(line.detail).toContain("SUPABASE_URL and SUPABASE_SECRET_KEY are not set.");
    expect(line.detail).toContain("a tradie cannot finish a job without one");
  });

  it("is ready once the storage address and secret key are set", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "https://abcdefgh.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_example");
    expect(await statusOf("photos")).toMatchObject({ state: "ok", detail: expect.stringContaining('"hostfix" bucket') });
  });

  it("catches the publishable key being pasted in by mistake", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "https://abcdefgh.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_publishable_example");
    expect(await statusOf("photos")).toMatchObject({ state: "problem", detail: expect.stringContaining("publishable key") });
  });
});
