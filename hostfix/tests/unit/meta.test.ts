import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildMetaPayload, metaSettings, sendMetaEvent, type MetaServerEvent, type MetaSettings } from "@/lib/meta/capi";
import { fakeFetch, jsonReply } from "./helpers";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const settings: MetaSettings = { pixelId: "1234567890", accessToken: "TOKEN", testEventCode: null, apiVersion: "v27.0" };
const NOW = 1_764_975_551_000;

const lead: MetaServerEvent = {
  name: "Lead",
  eventId: "11111111-1111-4111-8111-111111111111",
  sourceUrl: "https://hostfix.example/owners",
  userAgent: "Mozilla/5.0 (iPhone)",
  ip: "203.0.113.9",
  email: "  Olive@Example.COM ",
  phone: "+64211234567",
  fbp: "fb.1.1596403881668.1116446470",
  fbc: null,
  fbclid: "AbCdEf",
};

describe("buildMetaPayload", () => {
  it("builds the event the way Meta's Conversions API expects", () => {
    expect(buildMetaPayload(lead, settings, NOW)).toEqual({
      data: [
        {
          event_name: "Lead",
          event_time: 1_764_975_551,
          event_id: "11111111-1111-4111-8111-111111111111",
          action_source: "website",
          event_source_url: "https://hostfix.example/owners",
          user_data: {
            client_user_agent: "Mozilla/5.0 (iPhone)",
            client_ip_address: "203.0.113.9",
            em: [sha("olive@example.com")],
            ph: [sha("64211234567")],
            fbp: "fb.1.1596403881668.1116446470",
            fbc: "fb.1.1764975551000.AbCdEf",
          },
        },
      ],
    });
  });

  it("matches Meta's own published example for hashing an email", () => {
    const payload = buildMetaPayload({ ...lead, email: "John_Smith@gmail.com" }, settings, NOW) as { data: { user_data: { em: string[] } }[] };
    expect(payload.data[0]?.user_data.em).toEqual(["62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f"]);
  });

  it("never sends an email or phone number in the clear", () => {
    const text = JSON.stringify(buildMetaPayload(lead, settings, NOW));
    expect(text.toLowerCase()).not.toContain("olive@example.com");
    expect(text).not.toContain("64211234567");
  });

  it("prefers the browser's own click cookie over rebuilding one", () => {
    const payload = buildMetaPayload({ ...lead, fbc: "fb.1.1554763741205.Original" }, settings, NOW) as { data: { user_data: { fbc: string } }[] };
    expect(payload.data[0]?.user_data.fbc).toBe("fb.1.1554763741205.Original");
  });

  it("leaves out what it does not know", () => {
    const payload = buildMetaPayload(
      { name: "SubmitApplication", eventId: "e1", sourceUrl: "https://hostfix.example/tradies", userAgent: "UA", ip: null, phone: "+64221234567" },
      settings,
      NOW,
    ) as { data: { user_data: Record<string, unknown>; custom_data?: unknown }[] };
    expect(payload.data[0]?.user_data).toEqual({ client_user_agent: "UA", ph: [sha("64221234567")] });
    expect(payload.data[0]).not.toHaveProperty("custom_data");
  });

  it("sends the deposit value in dollars with its currency", () => {
    const payload = buildMetaPayload({ ...lead, name: "Purchase", valueCents: 4900, currency: "nzd" }, settings, NOW) as { data: { custom_data: unknown }[] };
    expect(payload.data[0]?.custom_data).toEqual({ value: 49, currency: "NZD" });
  });

  it("adds the test code only when one is set", () => {
    expect(buildMetaPayload(lead, settings, NOW)).not.toHaveProperty("test_event_code");
    expect(buildMetaPayload(lead, { ...settings, testEventCode: "TEST123" }, NOW)).toMatchObject({ test_event_code: "TEST123" });
  });
});

describe("sendMetaEvent", () => {
  function connect() {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "TOK EN");
  }

  it("posts to the right address", async () => {
    connect();
    const net = fakeFetch([jsonReply({ events_received: 1 })]);
    const result = await sendMetaEvent(lead, net.fetch, NOW);
    expect(result).toEqual({ status: "sent", detail: "Lead sent to Meta." });
    expect(net.requests[0]?.url).toBe("https://graph.facebook.com/v27.0/1234567890/events?access_token=TOK%20EN");
    expect(net.requests[0]?.method).toBe("POST");
    expect(JSON.parse(net.requests[0]!.body).data[0].event_name).toBe("Lead");
  });

  it("does nothing when Meta is not set up", async () => {
    const net = fakeFetch([]);
    expect(await sendMetaEvent(lead, net.fetch, NOW)).toEqual({ status: "skipped", detail: "NEXT_PUBLIC_META_PIXEL_ID is not set." });
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
    expect(await sendMetaEvent(lead, net.fetch, NOW)).toEqual({ status: "skipped", detail: "META_CAPI_ACCESS_TOKEN is not set." });
    expect(net.requests).toHaveLength(0);
  });

  it("does not send an event with no browser details (Meta requires them)", async () => {
    connect();
    const net = fakeFetch([]);
    expect((await sendMetaEvent({ ...lead, userAgent: null }, net.fetch, NOW)).status).toBe("skipped");
    expect(net.requests).toHaveLength(0);
  });

  it("reports Meta's reason on failure and never throws", async () => {
    connect();
    const refused = fakeFetch([jsonReply({ error: { message: "Invalid OAuth access token." } }, 400)]);
    expect(await sendMetaEvent(lead, refused.fetch, NOW)).toEqual({
      status: "failed",
      detail: "Meta refused the event (HTTP 400): Invalid OAuth access token.",
    });
    const down = fakeFetch(() => {
      throw new Error("network is down");
    });
    expect(await sendMetaEvent(lead, down.fetch, NOW)).toEqual({ status: "failed", detail: "Could not reach Meta: network is down" });
  });
});

describe("metaSettings", () => {
  it("checks the Pixel ID is digits and the version looks right", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "abc");
    expect(metaSettings()).toEqual({ problem: "NEXT_PUBLIC_META_PIXEL_ID should be the Pixel ID: digits only." });
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "T");
    vi.stubEnv("META_GRAPH_VERSION", "27");
    expect(metaSettings()).toEqual({ problem: "META_GRAPH_VERSION should look like v27.0." });
    vi.stubEnv("META_GRAPH_VERSION", "v28.0");
    vi.stubEnv("META_TEST_EVENT_CODE", "TEST1");
    expect(metaSettings()).toEqual({ settings: { pixelId: "1234567890", accessToken: "T", testEventCode: "TEST1", apiVersion: "v28.0" } });
  });
});
