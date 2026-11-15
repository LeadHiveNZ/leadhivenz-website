import { describe, expect, it, vi } from "vitest";
import {
  alertEmailRecipients,
  alertSmsNumbers,
  alertSmsRecipients,
  depositAlertContent,
  duplicateDepositAlertContent,
  escapeHtml,
  leadAlertContent,
  leadDetailRows,
  orphanDepositAlertContent,
  sendAlert,
  testAlertContent,
} from "@/lib/notify/alerts";
import { isGsm7, smsParts } from "@/lib/notify/gsm";
import { SqlLeadStore } from "@/lib/store/sql";
import type { Lead } from "@/lib/store/types";
import { testDb } from "./db";
import { fakeFetch, jsonReply } from "./helpers";

const t = testDb();
async function freshStore(): Promise<SqlLeadStore> {
  return new SqlLeadStore(async () => t.db, "demo");
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-11-15T02:00:00.000Z",
    leadType: "owner",
    market: "queenstown",
    name: "Olive Owner",
    phone: "+64211234567",
    email: "olive@example.com",
    propertyCount: 2,
    managedBy: "property_manager",
    ownerLocation: "Auckland",
    trade: null,
    licenceNumber: null,
    daysAvailable: null,
    source: "meta",
    utmSource: "facebook",
    utmMedium: "paid",
    utmCampaign: "qt-owners-nov",
    utmContent: "video-1",
    utmTerm: null,
    fbclid: "abc",
    gclid: null,
    refCode: null,
    referrer: null,
    landingPath: "/owners",
    depositStatus: "none",
    depositAmount: null,
    depositCurrency: null,
    stripeAccount: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    depositPaidAt: null,
    depositRefundedAt: null,
    convertedAt: null,
    invitedAt: null,
    ...overrides,
  };
}

const tradie = lead({
  leadType: "tradie",
  name: "Tāne Tradie",
  phone: "+64221234567",
  email: null,
  propertyCount: null,
  managedBy: null,
  ownerLocation: null,
  trade: "plumber",
  licenceNumber: "PGDB 12345",
  daysAvailable: ["mon", "tue", "sat"],
  source: "direct",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  fbclid: null,
  landingPath: "/tradies",
});

function connectEverything() {
  vi.stubEnv("CLICKSEND_USERNAME", "joe");
  vi.stubEnv("CLICKSEND_API_KEY", "KEY");
  vi.stubEnv("RESEND_API_KEY", "re_1");
  vi.stubEnv("ALERT_SMS_TO", "+61 411 111 111");
  vi.stubEnv("ALERT_EMAIL_TO", "joe@example.com");
  vi.stubEnv("APP_URL", "https://hostfix.example");
}

const clicksendOk = () =>
  jsonReply({ response_code: "SUCCESS", data: { messages: [{ message_id: "MSG-1", status: "SUCCESS" }] } });
const resendOk = () => jsonReply({ id: "email-1" });

describe("what the alert says", () => {
  it("fits an owner lead into one plain text message with the facts that matter", () => {
    const content = leadAlertContent(lead(), { saved: true });
    expect(content.sms).toBe(
      "HostFix lead: OWNER Olive Owner, 021 123 4567. 2 properties in Queenstown, lives in Auckland. Via Facebook / Instagram.",
    );
    expect(isGsm7(content.sms)).toBe(true);
    expect(smsParts(content.sms)).toBe(1);
    expect(content.template).toBe("lead_alert");
    expect(content.leadId).toBe(lead().id);
  });

  it("says property, not properties, for one", () => {
    expect(leadAlertContent(lead({ propertyCount: 1 }), { saved: true }).sms).toContain("1 property in Queenstown");
  });

  it("describes a tradie lead and keeps macrons out of the text", () => {
    const content = leadAlertContent(tradie, { saved: true });
    expect(content.sms).toBe("HostFix lead: TRADIE Tane Tradie, 022 123 4567. Plumber, licence PGDB 12345. Via Direct.");
    expect(content.email.subject).toBe("New tradie lead: Tāne Tradie, Plumber (Queenstown)");
    expect(content.email.html).toContain("Tāne Tradie");
    expect(content.email.replyTo).toBeNull();
  });

  it("never puts a web link in a text (new ClickSend accounts have those held back)", () => {
    vi.stubEnv("APP_URL", "https://hostfix.example");
    const texts = [
      leadAlertContent(lead(), { saved: true }).sms,
      leadAlertContent(tradie, { saved: false }).sms,
      depositAlertContent(lead({ depositAmount: 4900, depositCurrency: "NZD" })).sms,
      duplicateDepositAlertContent(lead(), "cs_test_1").sms,
      orphanDepositAlertContent("cs_test_1", 4900, "nzd").sms,
      testAlertContent().sms,
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/https?:|www\./i);
      expect(isGsm7(text)).toBe(true);
    }
  });

  it("puts every detail in the email and lets you reply straight to the owner", () => {
    vi.stubEnv("APP_URL", "https://hostfix.example");
    const content = leadAlertContent(lead(), { saved: true });
    expect(content.email.subject).toBe("New owner lead: Olive Owner (Queenstown)");
    expect(content.email.replyTo).toBe("olive@example.com");
    for (const expected of [
      "Olive Owner",
      "021 123 4567",
      "olive@example.com",
      "A property manager",
      "Auckland",
      "Queenstown",
      "Facebook / Instagram",
      "qt-owners-nov",
      "video-1",
      "/owners",
      "https://hostfix.example/admin/leads",
    ]) {
      expect(content.email.html).toContain(expected);
      expect(content.email.text).toContain(expected);
    }
  });

  it("shouts when the lead was not saved", () => {
    const content = leadAlertContent(lead(), { saved: false });
    expect(content.sms.startsWith("NOT SAVED, keep this text.")).toBe(true);
    expect(content.email.subject).toBe("NOT SAVED: New owner lead: Olive Owner (Queenstown)");
    expect(content.email.html).toContain("NOT saved to the database");
    expect(content.leadId).toBeNull();
  });

  it("cannot be used to inject HTML into your inbox", () => {
    const nasty = lead({ name: '<img src=x onerror="alert(1)">', ownerLocation: "<script>steal()</script>", utmCampaign: '"><b>x' });
    const html = leadAlertContent(nasty, { saved: true }).email.html;
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('"><b>');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escapeHtml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;");
  });

  it("keeps a very long lead inside two text parts", () => {
    const long = lead({ name: "N".repeat(80), ownerLocation: "L".repeat(80) });
    const sms = leadAlertContent(long, { saved: false }).sms;
    expect(sms.length).toBeLessThanOrEqual(300);
    expect(smsParts(sms)).toBeLessThanOrEqual(2);
  });

  it("states the deposit amount in the deposit alert", () => {
    const paid = lead({ depositStatus: "paid", depositAmount: 4900, depositCurrency: "NZD" });
    const content = depositAlertContent(paid);
    expect(content.sms).toBe("HostFix: DEPOSIT PAID NZ$49 by Olive Owner, 021 123 4567.");
    expect(content.email.subject).toBe("Deposit paid: NZ$49 from Olive Owner");
    expect(content.template).toBe("deposit_alert");
  });

  it("lists a tradie's details in reading order", () => {
    expect(leadDetailRows(tradie).map((row) => `${row.label}: ${row.value}`)).toEqual([
      "Name: Tāne Tradie",
      "Phone: 022 123 4567",
      "Trade: Plumber",
      "Licence number: PGDB 12345",
      "Days available: Mon, Tue, Sat",
      "Market: Queenstown",
      "Source: Direct",
      "Landed on: /tradies",
    ]);
  });
});

describe("who gets the alert", () => {
  it("reads one or several phone numbers written the international way", () => {
    vi.stubEnv("ALERT_SMS_TO", "+61 411 111 111, +64 21 123 4567; +61411111111");
    expect(alertSmsRecipients()).toEqual(["+61411111111", "+64211234567"]);
  });

  it("refuses local-style numbers instead of guessing the country", () => {
    // "021 123 4567" is a New Zealand mobile AND a valid Sydney landline.
    vi.stubEnv("ALERT_SMS_TO", "021 123 4567, 0411 111 111, nonsense, +64211234567");
    expect(alertSmsNumbers()).toEqual({
      numbers: ["+64211234567"],
      rejected: ["021 123 4567", "0411 111 111", "nonsense"],
    });
  });

  it("reads one or several email addresses", () => {
    vi.stubEnv("ALERT_EMAIL_TO", "joe@example.com, va@example.com , not-an-email");
    expect(alertEmailRecipients()).toEqual(["joe@example.com", "va@example.com"]);
  });

  it("returns nobody when nothing is set", () => {
    expect(alertSmsRecipients()).toEqual([]);
    expect(alertEmailRecipients()).toEqual([]);
  });
});

describe("sending the alert", () => {
  it("sends the text and the email and records both against the lead", async () => {
    connectEverything();
    const store = await freshStore();
    const saved = await store.insertLead({ ...lead(), leadType: "owner" });
    const net = fakeFetch((request) => (request.url.includes("clicksend") ? clicksendOk() : resendOk()));

    const outcome = await sendAlert(leadAlertContent(saved, { saved: true }), { fetchImpl: net.fetch, store });

    expect(outcome).toMatchObject({ anySent: true, sms: { status: "sent" }, email: { status: "sent" } });
    expect(net.requests.map((r) => new URL(r.url).hostname).sort()).toEqual(["api.resend.com", "rest.clicksend.com"]);
    expect(JSON.parse(net.requests.find((r) => r.url.includes("clicksend"))!.body).messages[0].to).toBe("+61411111111");

    const recorded = await store.listNotifications([saved.id]);
    expect(recorded.map((n) => `${n.channel}:${n.status}:${n.provider}:${n.providerMessageId}`).sort()).toEqual([
      "email:sent:resend:email-1",
      "sms:sent:clicksend:MSG-1",
    ]);
  });

  it("still sends the email when the text fails", async () => {
    connectEverything();
    const store = await freshStore();
    const saved = await store.insertLead({ ...lead(), leadType: "owner" });
    const net = fakeFetch((request) =>
      request.url.includes("clicksend") ? jsonReply({ response_msg: "Authorization failed." }, 401) : resendOk(),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const outcome = await sendAlert(leadAlertContent(saved, { saved: true }), { fetchImpl: net.fetch, store });

    expect(outcome.anySent).toBe(true);
    expect(outcome.sms).toEqual({ status: "failed", detail: "ClickSend rejected the username or API key." });
    expect(outcome.email.status).toBe("sent");
    const recorded = await store.listNotifications([saved.id]);
    expect(recorded.find((n) => n.channel === "sms")).toMatchObject({ status: "failed", error: "ClickSend rejected the username or API key." });
  });

  it("still sends the text when the email fails", async () => {
    connectEverything();
    const net = fakeFetch((request) =>
      request.url.includes("clicksend") ? clicksendOk() : jsonReply({ message: "API key is invalid" }, 401),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcome = await sendAlert(leadAlertContent(lead(), { saved: true }), { fetchImpl: net.fetch, store: null });
    expect(outcome).toMatchObject({ anySent: true, sms: { status: "sent" }, email: { status: "failed" } });
  });

  it("reports that nothing was sent when both fail", async () => {
    connectEverything();
    const net = fakeFetch(() => {
      throw new Error("network is down");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcome = await sendAlert(leadAlertContent(lead(), { saved: true }), { fetchImpl: net.fetch, store: null });
    expect(outcome).toMatchObject({ anySent: false, sms: { status: "failed" }, email: { status: "failed" } });
  });

  it("skips a channel that is not set up, and says why", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const net = fakeFetch([]);
    const outcome = await sendAlert(testAlertContent(), { fetchImpl: net.fetch, store: null });
    expect(outcome).toEqual({
      anySent: false,
      sms: { status: "skipped", detail: "CLICKSEND_USERNAME and CLICKSEND_API_KEY are not set." },
      email: { status: "skipped", detail: "RESEND_API_KEY is not set." },
    });
    expect(net.requests).toHaveLength(0);
  });

  it("skips the text when there is a login but no number to send to", async () => {
    vi.stubEnv("CLICKSEND_USERNAME", "joe");
    vi.stubEnv("CLICKSEND_API_KEY", "KEY");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const outcome = await sendAlert(testAlertContent(), { fetchImpl: fakeFetch([]).fetch, store: null });
    expect(outcome.sms).toEqual({ status: "skipped", detail: "ALERT_SMS_TO is not set." });
  });

  it("explains the format when the number was typed the local way", async () => {
    vi.stubEnv("CLICKSEND_USERNAME", "joe");
    vi.stubEnv("CLICKSEND_API_KEY", "KEY");
    vi.stubEnv("ALERT_SMS_TO", "021 123 4567");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const net = fakeFetch([]);
    const outcome = await sendAlert(testAlertContent(), { fetchImpl: net.fetch, store: null });
    expect(outcome.sms).toEqual({
      status: "skipped",
      detail: "ALERT_SMS_TO must start with + and the country code, for example +61412345678 or +64211234567.",
    });
    expect(net.requests).toHaveLength(0);
  });

  it("texts every number on the list", async () => {
    connectEverything();
    vi.stubEnv("ALERT_SMS_TO", "+61411111111, +64211234567");
    const net = fakeFetch((request) => (request.url.includes("clicksend") ? clicksendOk() : resendOk()));
    const outcome = await sendAlert(testAlertContent(), { fetchImpl: net.fetch, store: null });
    expect(outcome.sms).toEqual({ status: "sent", detail: "Text sent to 2 numbers." });
    const numbers = net.requests.filter((r) => r.url.includes("clicksend")).map((r) => JSON.parse(r.body).messages[0].to);
    expect(numbers.sort()).toEqual(["+61411111111", "+64211234567"]);
  });

  it("carries on when recording the alert fails", async () => {
    connectEverything();
    const store = await freshStore();
    vi.spyOn(store, "logNotification").mockRejectedValue(new Error("table missing"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const net = fakeFetch((request) => (request.url.includes("clicksend") ? clicksendOk() : resendOk()));
    const outcome = await sendAlert(testAlertContent(), { fetchImpl: net.fetch, store });
    expect(outcome.anySent).toBe(true);
  });
});
