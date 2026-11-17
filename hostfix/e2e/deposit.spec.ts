import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { E2E } from "../playwright.config";
import { createLeadToken } from "../src/lib/auth/lead-token";
import { leadCard, ownerDetails, signIn, submitOwnerLead, uniqueIp, type OwnerDetails } from "./helpers";

/**
 * The founding deposit after the move to free to join (DECISIONS.md,
 * 2026-11-17), against a stand-in Stripe (e2e/fake-stripe.mjs). No real money
 * and no real network.
 *
 * The deposit is never offered any more: the owner form has one button, "Send
 * me the price list", even with card payments connected (this copy of the site
 * has them). Deposits paid before the change still arrive from Stripe and are
 * still recorded, shown and refunded, so those paths are tested by making the
 * payment at the stand-in Stripe directly, as an old card page would have.
 */

const BASE = E2E.paymentsUrl;
const FAKE_STRIPE = "http://localhost:3299";
const signer = new Stripe("sk_test_e2e_signer");
const APP_SECRET = "e2e-secret-e2e-secret-e2e-secret-e2e-secret";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
});

function signedHeaders(payload: string, secret: string = E2E.webhookSecret) {
  return {
    "content-type": "application/json",
    "stripe-signature": signer.webhooks.generateTestHeaderString({ payload, secret }),
  };
}

async function postWebhook(request: APIRequestContext, event: unknown, secret?: string) {
  const payload = JSON.stringify(event);
  return request.post(`${BASE}/api/stripe/webhook`, { data: payload, headers: signedHeaders(payload, secret) });
}

/**
 * A founding deposit card page, as the site made them before it was free to join: created at the stand-in
 * Stripe for this lead, NZ$99 (config/markets.ts, 9900 cents). Returns the card page's id.
 */
async function oldCardPage(request: APIRequestContext, leadId: string, email: string): Promise<string> {
  const form = new URLSearchParams({
    mode: "payment",
    client_reference_id: leadId,
    customer_email: email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "nzd",
    "line_items[0][price_data][unit_amount]": "9900",
    "metadata[lead_id]": leadId,
    "metadata[market]": "queenstown",
    "metadata[purpose]": "founding_deposit",
    success_url: `${BASE}/owners/deposit/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE}/owners/thanks?deposit=cancelled`,
  });
  const created = await request.post(`${FAKE_STRIPE}/v1/checkout/sessions`, { data: form.toString(), headers: { "content-type": "application/x-www-form-urlencoded" } });
  return (await created.json()).id as string;
}

/** An owner who asked for the price list, and the id of their lead from the leads page. */
async function ownerLeadWithId(page: Page, admin: Page, owner: OwnerDetails): Promise<string> {
  await submitOwnerLead(page, BASE, owner);
  await signIn(admin, BASE);
  const leadId = await leadCard(admin, owner.name).getAttribute("data-lead-id");
  expect(leadId).toMatch(/^[0-9a-f-]{36}$/);
  return leadId!;
}

/** The deposit is paid at Stripe and Stripe tells the site, the way a deposit paid before the change arrives. */
async function payOldDeposit(request: APIRequestContext, leadId: string, email: string): Promise<string> {
  const sessionId = await oldCardPage(request, leadId, email);
  await request.get(`${FAKE_STRIPE}/pay/${sessionId}/confirm`, { maxRedirects: 0 });
  const session = await (await request.get(`${FAKE_STRIPE}/v1/checkout/sessions/${sessionId}`)).json();
  expect(session.payment_status).toBe("paid");
  const recorded = await postWebhook(request, { id: `evt_${sessionId}`, object: "event", type: "checkout.session.completed", data: { object: session } });
  expect(await recorded.json()).toEqual({ received: true, outcome: "recorded" });
  return sessionId;
}

test.describe("no founding spot: free to join", () => {
  test("the owner page offers the price list only, with no founding button, terms or spots, even with payments connected", async ({ page }) => {
    await page.goto(`${BASE}/owners`);
    await expect(page.getByRole("heading", { name: "Get the full price list" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Take a founding spot" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send me the price list" })).toBeVisible();
    await expect(page.getByRole("button", { name: /founding spot/i })).toHaveCount(0);
    for (const gone of ["25 founding properties", "Half price for your first three months", "Your $99 deposit comes off your first bills", "founding spot left", "We never see your card number."]) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }
  });

  test("the thank-you page shows the price list and no founding offer", async ({ page }) => {
    await submitOwnerLead(page, BASE, ownerDetails());
    await expect(page.getByRole("region", { name: "The Queenstown price list" })).toContainText("NZ$245");
    await expect(page.getByRole("region", { name: /Take a founding spot/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /founding spot/i })).toHaveCount(0);
    // Even if someone comes back from an old card page they left.
    await page.goto(`${BASE}/owners/thanks?deposit=cancelled`);
    await expect(page.getByRole("region", { name: "The Queenstown price list" })).toBeVisible();
    await expect(page.getByRole("button", { name: /founding spot/i })).toHaveCount(0);
  });

  test("a deposit paid before the change still shows Paid on the leads page, and the owner is told it is being refunded", async ({ page, browser, request }) => {
    const owner = ownerDetails();
    const admin = await browser.newPage();
    const leadId = await ownerLeadWithId(page, admin, owner);
    await payOldDeposit(request, leadId, owner.email);

    await admin.reload();
    await expect(leadCard(admin, owner.name)).toContainText("Paid NZ$99");
    await admin.close();

    await page.goto(`${BASE}/owners/thanks`);
    await expect(page.getByText("is now free to join, so we are refunding your NZ$99 founding deposit in full")).toBeVisible();
    await expect(page.getByRole("region", { name: "The Queenstown price list" })).toBeVisible();
    await expect(page.getByRole("button", { name: /founding spot/i })).toHaveCount(0);
    await page.goto(`${BASE}/owners/founding-member`);
    await expect(page.getByText("Your NZ$99 deposit is confirmed")).toBeVisible();
  });

  test("a different visitor cannot see someone else's deposit", async ({ page, browser, request }) => {
    const owner = ownerDetails();
    const admin = await browser.newPage();
    const leadId = await ownerLeadWithId(page, admin, owner);
    await admin.close();
    await payOldDeposit(request, leadId, owner.email);

    const stranger = await browser.newPage();
    await stranger.goto(`${BASE}/owners/founding-member`);
    await expect(stranger.getByRole("heading", { name: "We haven't seen a payment yet." })).toBeVisible();
    await expect(stranger.getByText(owner.name)).toHaveCount(0);
    await expect(stranger.getByText("deposit is confirmed")).toHaveCount(0);

    // A forged "this is me" cookie is ignored.
    await stranger.context().addCookies([{ name: "hf_lead", value: "v1.11111111-1111-4111-8111-111111111111.9999999999999.forged", url: BASE }]);
    await stranger.goto(`${BASE}/owners/founding-member`);
    await expect(stranger.getByRole("heading", { name: "We haven't seen a payment yet." })).toBeVisible();
    await stranger.goto(`${BASE}/owners/thanks`);
    await expect(stranger.getByText("founding deposit")).toHaveCount(0);
    await stranger.close();
  });

  test("coming back from an old card page without paying records nothing", async ({ page, browser, request }) => {
    const owner = ownerDetails();
    const admin = await browser.newPage();
    const leadId = await ownerLeadWithId(page, admin, owner);
    await admin.close();
    const sessionId = await oldCardPage(request, leadId, owner.email);
    await page.goto(`${BASE}/owners/deposit/return?session_id=${sessionId}`);
    await expect(page).toHaveURL(`${BASE}/owners/founding-member`);
    await expect(page.getByRole("heading", { name: "We haven't seen a payment yet." })).toBeVisible();
  });

  test("a made-up payment reference is ignored", async ({ page }) => {
    for (const bad of ["cs_test_doesnotexist1234567890", "not-a-session", "../../admin"]) {
      await page.goto(`${BASE}/owners/deposit/return?session_id=${encodeURIComponent(bad)}`);
      await expect(page).toHaveURL(`${BASE}/owners/founding-member`);
      await expect(page.getByRole("heading", { name: "We haven't seen a payment yet." })).toBeVisible();
    }
  });

  test("the link in the price list email brings the owner back to the price list, on any device, with no founding offer", async ({ page, browser }) => {
    const owner = ownerDetails();
    await submitOwnerLead(page, BASE, owner);
    await signIn(page, BASE);
    const leadId = await leadCard(page, owner.name).getAttribute("data-lead-id");
    expect(leadId).toMatch(/^[0-9a-f-]{36}$/);

    // A phone that has never seen the site, opening the email.
    const phone = await browser.newPage();
    await phone.goto(`${BASE}/owners/founding/${createLeadToken(APP_SECRET, leadId!)}`);
    await expect(phone).toHaveURL(`${BASE}/owners/thanks?from=email`);
    await expect(phone.getByText(`Welcome back, ${owner.name.split(" ")[0]}.`)).toBeVisible();
    await expect(phone.getByRole("region", { name: "The Queenstown price list" })).toBeVisible();
    await expect(phone.getByRole("button", { name: /founding spot/i })).toHaveCount(0);

    // A link that has been tampered with opens nothing.
    const stranger = await browser.newPage();
    await stranger.goto(`${BASE}/owners/founding/${createLeadToken("not-the-real-secret-not-the-real-secret", leadId!)}`);
    await expect(stranger).toHaveURL(`${BASE}/owners`);
    await phone.close();
    await stranger.close();
  });
});

test.describe("messages from Stripe", () => {
  test("records a deposit paid before the change, once, even if the owner never comes back to the site", async ({ page, browser, request }) => {
    const owner = ownerDetails();
    const admin = await browser.newPage();
    const leadId = await ownerLeadWithId(page, admin, owner);
    await admin.close();
    const sessionId = await oldCardPage(request, leadId, owner.email);

    // The card goes through, but the browser is closed before returning.
    await request.get(`${FAKE_STRIPE}/pay/${sessionId}/confirm`, { maxRedirects: 0 });
    const session = await (await request.get(`${FAKE_STRIPE}/v1/checkout/sessions/${sessionId}`)).json();
    expect(session.payment_status).toBe("paid");

    const event = { id: `evt_${sessionId}`, object: "event", type: "checkout.session.completed", data: { object: session } };
    const first = await postWebhook(request, event);
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ received: true, outcome: "recorded" });

    // Stripe sometimes sends the same message twice. Nothing changes the second time.
    const second = await postWebhook(request, event);
    expect(await second.json()).toEqual({ received: true, outcome: "already_recorded" });

    await signIn(page, BASE);
    await expect(leadCard(page, owner.name)).toContainText("Paid NZ$99");
  });

  test("marks the deposit refunded when you refund it in Stripe (RUNBOOK.md)", async ({ page, browser, request }) => {
    const owner = ownerDetails();
    const admin = await browser.newPage();
    const leadId = await ownerLeadWithId(page, admin, owner);
    await admin.close();
    const sessionId = await payOldDeposit(request, leadId, owner.email);

    const session = await (await request.get(`${FAKE_STRIPE}/v1/checkout/sessions/${sessionId}`)).json();
    const refund = {
      id: `evt_refund_${sessionId}`,
      object: "event",
      type: "charge.refunded",
      data: { object: { id: "ch_fake", object: "charge", payment_intent: session.payment_intent, amount: 9900, amount_refunded: 9900, refunded: true } },
    };
    expect(await (await postWebhook(request, refund)).json()).toEqual({ received: true, outcome: "refunded" });
    expect(await (await postWebhook(request, refund)).json()).toEqual({ received: true, outcome: "nothing_to_change" });

    await page.goto(`${BASE}/owners/founding-member`);
    await expect(page.getByRole("heading", { name: "Your deposit has been refunded." })).toBeVisible();
    // Refunded: the thank-you page no longer says a refund is coming.
    await page.goto(`${BASE}/owners/thanks`);
    await expect(page.getByText("founding deposit in full")).toHaveCount(0);

    await signIn(page, BASE);
    await expect(leadCard(page, owner.name)).toContainText("Refunded NZ$99");
  });

  test("refuses messages that are not genuinely from Stripe", async ({ request }) => {
    const event = { id: "evt_forged", object: "event", type: "checkout.session.completed", data: { object: {} } };

    const wrongSecret = await postWebhook(request, event, "whsec_not_the_real_one");
    expect(wrongSecret.status()).toBe(400);

    const noSignature = await request.post(`${BASE}/api/stripe/webhook`, { data: JSON.stringify(event), headers: { "content-type": "application/json" } });
    expect(noSignature.status()).toBe(400);

    const payload = JSON.stringify(event);
    const tampered = await request.post(`${BASE}/api/stripe/webhook`, {
      data: payload.replace("evt_forged", "evt_changed"),
      headers: signedHeaders(payload),
    });
    expect(tampered.status()).toBe(400);
  });

  test("ignores message types it does not use", async ({ request }) => {
    const response = await postWebhook(request, { id: "evt_other", object: "event", type: "customer.created", data: { object: {} } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "ignored" });
  });

  test("says clearly when webhooks are not set up", async ({ request }) => {
    const payload = JSON.stringify({ id: "evt_x", object: "event", type: "customer.created", data: { object: {} } });
    const response = await request.post(`${E2E.plainUrl}/api/stripe/webhook`, { data: payload, headers: signedHeaders(payload) });
    expect(response.status()).toBe(503);
  });
});

test.describe("the demand test scorecard", () => {
  test("starts the fourteen days and still counts a card put down, by the ad the owner came from", async ({ page, browser, request }) => {
    await signIn(page, BASE);
    const card = page.getByRole("region", { name: "The demand test" });
    const start = card.getByRole("button", { name: "Start the 14 days today" });
    if (await start.isVisible()) {
      await start.click();
    } else {
      await card.getByText("Start the 14 days again").click();
      await card.getByRole("button", { name: "Start again from today" }).click();
    }
    await expect(card).toContainText("Day 1 of 14");
    await expect(card).toContainText("Cards down");

    // An owner arrives from an ad and asks for the price list (the only button now). A deposit they paid
    // before the change arrives from Stripe and still counts as a card down.
    const owner = ownerDetails();
    const buyer = await browser.newPage();
    await submitOwnerLead(buyer, BASE, owner, "?utm_source=facebook&utm_medium=paid&utm_campaign=qt-demand&utm_content=ad-e2e");
    await buyer.close();
    await page.reload();
    const leadId = await leadCard(page, owner.name).getAttribute("data-lead-id");
    await payOldDeposit(request, leadId!, owner.email);

    await page.reload();
    await expect(card).toContainText(/[1-9]\d* of 3/);
    const byAd = card.getByRole("table", { name: /By ad/ });
    await expect(byAd.getByRole("row", { name: /ad-e2e/ })).toContainText("1");
  });
});

test("the setup checklist shows card payments connected in test mode", async ({ page }) => {
  await signIn(page, BASE);
  const payments = page.locator('[data-status-key="payments"]');
  await expect(payments).toContainText("Connected in TEST mode. No real money moves.");
});
