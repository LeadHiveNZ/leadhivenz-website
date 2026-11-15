import { describe, expect, it, vi } from "vitest";
import { emailSettings, sendEmail, usingResendTestSender } from "@/lib/notify/email";
import { fakeFetch, jsonReply } from "./helpers";

const settings = { apiKey: "re_test_123", from: "HostFix <alerts@hostfix.example>" };
const message = {
  to: ["joe@example.com"],
  subject: "New owner lead: Olive Owner (Queenstown)",
  html: "<p>Hello</p>",
  text: "Hello",
};

describe("sendEmail", () => {
  it("sends the email the way Resend's API expects", async () => {
    const net = fakeFetch([jsonReply({ id: "email-1" })]);
    const result = await sendEmail(settings, { ...message, replyTo: "olive@example.com", idempotencyKey: "lead-1" }, net.fetch);

    expect(result).toEqual({ provider: "resend", messageId: "email-1" });
    const request = net.requests[0]!;
    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.method).toBe("POST");
    expect(request.headers.authorization).toBe("Bearer re_test_123");
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.headers["user-agent"]).toBe("hostfix/1.0");
    expect(request.headers["idempotency-key"]).toBe("lead-1");
    expect(JSON.parse(request.body)).toEqual({
      from: "HostFix <alerts@hostfix.example>",
      to: ["joe@example.com"],
      subject: "New owner lead: Olive Owner (Queenstown)",
      html: "<p>Hello</p>",
      text: "Hello",
      reply_to: "olive@example.com",
    });
  });

  it("leaves out reply-to and the idempotency key when there are none", async () => {
    const net = fakeFetch([jsonReply({ id: "email-2" })]);
    await sendEmail(settings, message, net.fetch);
    expect(JSON.parse(net.requests[0]!.body)).not.toHaveProperty("reply_to");
    expect(net.requests[0]!.headers).not.toHaveProperty("idempotency-key");
  });

  it("explains the test-sender limit in plain words", async () => {
    const net = fakeFetch([
      jsonReply({ statusCode: 403, name: "validation_error", message: "You can only send testing emails to your own email address (joe@example.com)." }, 403),
    ]);
    await expect(sendEmail(settings, message, net.fetch)).rejects.toThrow(/test sender can only email the address that owns the Resend account/);
  });

  it("fails clearly on a bad API key", async () => {
    const net = fakeFetch([jsonReply({ statusCode: 401, name: "validation_error", message: "API key is invalid" }, 401)]);
    await expect(sendEmail(settings, message, net.fetch)).rejects.toThrow("Resend rejected the API key.");
  });

  it("passes on Resend's reason for any other failure", async () => {
    const net = fakeFetch([jsonReply({ name: "rate_limit_exceeded", message: "Too many requests" }, 429)]);
    await expect(sendEmail(settings, message, net.fetch)).rejects.toThrow(/HTTP 429.*Too many requests/);
  });
});

describe("emailSettings", () => {
  it("says the key is missing", () => {
    expect(emailSettings()).toEqual({ problem: "RESEND_API_KEY is not set." });
  });

  it("defaults to Resend's test sender until a domain is verified", () => {
    vi.stubEnv("RESEND_API_KEY", "re_1");
    const result = emailSettings();
    expect(result).toEqual({ settings: { apiKey: "re_1", from: "HostFix <onboarding@resend.dev>" } });
    if ("settings" in result) expect(usingResendTestSender(result.settings)).toBe(true);
  });

  it("uses your own sender when EMAIL_FROM is set", () => {
    vi.stubEnv("RESEND_API_KEY", "re_1");
    vi.stubEnv("EMAIL_FROM", "HostFix <alerts@hostfix.example>");
    const result = emailSettings();
    expect(result).toMatchObject({ settings: { from: "HostFix <alerts@hostfix.example>" } });
    if ("settings" in result) expect(usingResendTestSender(result.settings)).toBe(false);
  });
});
