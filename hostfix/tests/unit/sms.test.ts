import { describe, expect, it, vi } from "vitest";
import { sendSms, smsSettings, type SmsSettings } from "@/lib/notify/sms";
import { decodeBasicAuth, fakeFetch, jsonReply } from "./helpers";

const clicksend: SmsSettings = { provider: "clicksend", username: "joe", apiKey: "KEY-123", from: null };
const twilio: SmsSettings = { provider: "twilio", accountSid: "AC123", authToken: "tok", from: "+15005550006" };

const clicksendOk = () =>
  jsonReply({
    http_code: 200,
    response_code: "SUCCESS",
    response_msg: "Messages queued for delivery.",
    data: { total_count: 1, queued_count: 1, messages: [{ message_id: "MSG-1", status: "SUCCESS", to: "+61411111111" }] },
  });

describe("ClickSend", () => {
  it("sends the text the way ClickSend's API expects", async () => {
    const net = fakeFetch([clicksendOk()]);
    const result = await sendSms(clicksend, "+61411111111", "HostFix lead: OWNER Sam", net.fetch);

    expect(result).toEqual({ provider: "clicksend", messageId: "MSG-1" });
    expect(net.requests).toHaveLength(1);
    const request = net.requests[0]!;
    expect(request.url).toBe("https://rest.clicksend.com/v3/sms/send");
    expect(request.method).toBe("POST");
    expect(request.headers["content-type"]).toBe("application/json");
    expect(decodeBasicAuth(request.headers.authorization)).toBe("joe:KEY-123");
    expect(JSON.parse(request.body)).toEqual({
      messages: [{ source: "hostfix", to: "+61411111111", body: "HostFix lead: OWNER Sam" }],
    });
  });

  it("includes the sender only when one is set", async () => {
    const net = fakeFetch([clicksendOk()]);
    await sendSms({ ...clicksend, from: "HostFix" }, "+61411111111", "Hi", net.fetch);
    expect(JSON.parse(net.requests[0]!.body).messages[0].from).toBe("HostFix");
  });

  it("fails when ClickSend accepts the request but not the message itself", async () => {
    const net = fakeFetch([
      jsonReply({
        http_code: 200,
        response_code: "SUCCESS",
        data: { messages: [{ status: "INSUFFICIENT_CREDIT", to: "+61411111111" }] },
      }),
    ]);
    await expect(sendSms(clicksend, "+61411111111", "Hi", net.fetch)).rejects.toThrow(/INSUFFICIENT_CREDIT/);
  });

  it("fails with a clear message when the login is wrong", async () => {
    const net = fakeFetch([jsonReply({ http_code: 401, response_code: "UNAUTHORIZED", response_msg: "Authorization failed." }, 401)]);
    await expect(sendSms(clicksend, "+61411111111", "Hi", net.fetch)).rejects.toThrow("ClickSend rejected the username or API key.");
  });

  it("fails on any other error and passes on ClickSend's reason", async () => {
    const net = fakeFetch([jsonReply({ response_code: "BAD_REQUEST", response_msg: "Invalid recipient." }, 400)]);
    await expect(sendSms(clicksend, "+61411111111", "Hi", net.fetch)).rejects.toThrow(/HTTP 400.*Invalid recipient/);
  });

  it("copes with a reply that is not JSON", async () => {
    const net = fakeFetch([new Response("<html>Bad gateway</html>", { status: 502 })]);
    await expect(sendSms(clicksend, "+61411111111", "Hi", net.fetch)).rejects.toThrow(/HTTP 502/);
  });
});

describe("Twilio", () => {
  it("sends the text the way Twilio's API expects", async () => {
    const net = fakeFetch([jsonReply({ sid: "SM123", status: "queued", error_code: null }, 201)]);
    const result = await sendSms(twilio, "+64211234567", "HostFix lead: TRADIE Tane", net.fetch);

    expect(result).toEqual({ provider: "twilio", messageId: "SM123" });
    const request = net.requests[0]!;
    expect(request.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(request.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(decodeBasicAuth(request.headers.authorization)).toBe("AC123:tok");
    const form = new URLSearchParams(request.body);
    expect(Object.fromEntries(form)).toEqual({ To: "+64211234567", From: "+15005550006", Body: "HostFix lead: TRADIE Tane" });
  });

  it("uses a Messaging Service when the sender starts with MG", async () => {
    const net = fakeFetch([jsonReply({ sid: "SM1", status: "accepted" }, 201)]);
    await sendSms({ ...twilio, from: "MG999" }, "+64211234567", "Hi", net.fetch);
    const form = new URLSearchParams(net.requests[0]!.body);
    expect(form.get("MessagingServiceSid")).toBe("MG999");
    expect(form.has("From")).toBe(false);
  });

  it("fails with Twilio's reason and code", async () => {
    const net = fakeFetch([jsonReply({ code: 21608, message: "The number is unverified.", status: 400 }, 400)]);
    await expect(sendSms(twilio, "+64211234567", "Hi", net.fetch)).rejects.toThrow(/code 21608.*unverified/);
  });

  it("fails when Twilio says the message failed", async () => {
    const net = fakeFetch([jsonReply({ sid: "SM1", status: "failed", error_code: 30007 }, 201)]);
    await expect(sendSms(twilio, "+64211234567", "Hi", net.fetch)).rejects.toThrow(/30007/);
  });
});

describe("links in alert texts", () => {
  it.each(["See https://hostfix.example/admin", "go to www.hostfix.example", "HTTP://X.Y"])(
    "refuses to send %s",
    async (body) => {
      const net = fakeFetch([]);
      await expect(sendSms(clicksend, "+61411111111", body, net.fetch)).rejects.toThrow(/must not contain web links/);
      expect(net.requests).toHaveLength(0);
    },
  );
});

describe("smsSettings", () => {
  it("says what is missing when nothing is set", () => {
    expect(smsSettings()).toEqual({ problem: "CLICKSEND_USERNAME and CLICKSEND_API_KEY are not set." });
  });

  it("uses ClickSend when its login is set", () => {
    vi.stubEnv("CLICKSEND_USERNAME", "joe");
    vi.stubEnv("CLICKSEND_API_KEY", " KEY ");
    expect(smsSettings()).toEqual({ settings: { provider: "clicksend", username: "joe", apiKey: "KEY", from: null } });
  });

  it("names the one missing ClickSend value", () => {
    vi.stubEnv("CLICKSEND_USERNAME", "joe");
    expect(smsSettings()).toEqual({ problem: "CLICKSEND_API_KEY is not set." });
  });

  it("switches to Twilio when asked", () => {
    vi.stubEnv("SMS_PROVIDER", "twilio");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("TWILIO_FROM", "+15005550006");
    expect(smsSettings()).toEqual({ settings: { provider: "twilio", accountSid: "AC1", authToken: "tok", from: "+15005550006" } });
  });

  it("uses Twilio without being asked when only Twilio is set up", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("TWILIO_FROM", "+15005550006");
    expect(smsSettings()).toMatchObject({ settings: { provider: "twilio" } });
  });

  it("says which Twilio values are missing", () => {
    vi.stubEnv("SMS_PROVIDER", "twilio");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
    expect(smsSettings()).toEqual({ problem: "Twilio is selected but TWILIO_AUTH_TOKEN and TWILIO_FROM are not set." });
  });

  it("rejects a provider it does not know", () => {
    vi.stubEnv("SMS_PROVIDER", "carrier-pigeon");
    expect(smsSettings()).toEqual({ problem: 'SMS_PROVIDER is "carrier-pigeon". It must be clicksend or twilio.' });
  });
});
