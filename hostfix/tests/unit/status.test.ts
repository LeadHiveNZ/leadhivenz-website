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
    expect(keys).toEqual(["database", "email", "sms", "payments", "timer", "photos", "address-lookup", "map-pictures", "push", "hourly-rates", "pixel", "capi", "analytics", "copy", "legal"]);
  });

  it("lists app notifications as still to do until the three VAPID settings are set, and the hourly rates as confirmed (DECISIONS.md, 2026-11-24, second entry)", async () => {
    expect(await statusOf("push")).toMatchObject({ state: "todo", detail: expect.stringContaining("VAPID_PUBLIC_KEY") });
    expect(await statusOf("hourly-rates")).toMatchObject({ state: "ok", detail: expect.stringContaining("Confirmed 24 Nov 2026: plumber NZ$160, electrician NZ$160, gasfitter NZ$170, handyman NZ$110") });
    process.env.VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
    process.env.VAPID_SUBJECT = "mailto:hello@example.com";
    try {
      expect(await statusOf("push")).toMatchObject({ state: "ok" });
    } finally {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
    }
  });

  it("lists the two free map keys as still to do until they are set (DECISIONS.md, 2026-11-19)", async () => {
    expect(await statusOf("address-lookup")).toMatchObject({ state: "todo", detail: expect.stringContaining("LINZ_DATA_KEY is not set") });
    expect(await statusOf("map-pictures")).toMatchObject({ state: "todo", detail: expect.stringContaining("OpenStreetMap") });
    process.env.LINZ_DATA_KEY = "abc";
    process.env.LINZ_BASEMAPS_KEY = "def";
    try {
      expect(await statusOf("address-lookup")).toMatchObject({ state: "ok" });
      expect(await statusOf("map-pictures")).toMatchObject({ state: "ok" });
    } finally {
      delete process.env.LINZ_DATA_KEY;
      delete process.env.LINZ_BASEMAPS_KEY;
    }
  });

  it("marks nothing that needs a key or an account as ready on a fresh install", async () => {
    const items = await setupStatus();
    // Only what is decided in the code is done without any outside account: the hourly rates, confirmed 24 Nov 2026
    // (DECISIONS.md, 2026-11-24, second entry), and the page copy (the words and the brand details).
    expect(items.filter((item) => item.state === "ok").map((item) => item.key)).toEqual(["hourly-rates", "copy"]);
  });

  it("never claims the legal pages are done until a person has reviewed them", async () => {
    expect(await statusOf("legal")).toMatchObject({ state: "todo", detail: expect.stringContaining("Community Law") });
  });

  it("says the copy is done once no [EDIT] placeholders are left in the copy or the brand settings", async () => {
    const copy = await statusOf("copy");
    // The page copy, the contact email and the company name are all filled in (config/brand.ts, content/*.md).
    expect(copy.state).toBe("ok");
    expect(copy.detail).toBe("No [EDIT] placeholders left.");
  });

  it("has no founding line while no deposit is held: the deposit is switched off", async () => {
    const items = await setupStatus();
    expect(items.find((item) => item.key === "founding-queenstown")).toBeUndefined();
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
