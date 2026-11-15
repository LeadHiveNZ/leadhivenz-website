import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { E2E } from "../playwright.config";
import { leadCard, ownerDetails, signIn, submitOwnerLead, uniqueIp, type OwnerDetails } from "./helpers";

/**
 * The founding member deposit, end to end, against a stand-in Stripe
 * (e2e/fake-stripe.mjs). No real money and no real network.
 */

const BASE = E2E.paymentsUrl;
const FAKE_STRIPE = "http://localhost:3299";
const signer = new Stripe("sk_test_e2e_signer");

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

/** Fills in the owner form and presses the deposit button. Ends on the pretend card page. */
async function goToCardPage(page: Page, owner: OwnerDetails): Promise<string> {
  await submitOwnerLead(page, BASE, owner);
  await expect(page.getByRole("heading", { name: "Lock in your spot for NZ$49" })).toBeVisible();
  await page.getByRole("button", { name: "Reserve my founding spot for NZ$49" }).click();
  await page.waitForURL(/localhost:3299\/pay\/cs_test_/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test.describe("founding member deposit", () => {
  test("offers the deposit after the form, with its promises", async ({ page }) => {
    await submitOwnerLead(page, BASE, ownerDetails());
    const offer = page.getByRole("region", { name: "Lock in your spot for NZ$49" });
    await expect(offer).toBeVisible();
    await expect(offer).toContainText("Comes off your first month");
    await expect(offer).toContainText("Fully refundable any time before we launch");
    await expect(offer).toContainText("We never see your card number.");
  });

  test("takes a deposit and shows it everywhere it should appear", async ({ page, browser }) => {
    const owner = ownerDetails();
    const sessionId = await goToCardPage(page, owner);

    // What we asked the card page to charge.
    await expect(page.getByTestId("amount")).toHaveText("4900 nzd");
    await expect(page.getByTestId("email")).toHaveText(owner.email);

    // Before paying, the leads list shows the deposit as started only.
    const admin = await browser.newPage();
    await signIn(admin, BASE);
    await expect(leadCard(admin, owner.name)).toContainText("Started, not paid");

    await page.getByTestId("pay").click();
    await expect(page).toHaveURL(`${BASE}/owners/founding-member`);
    await expect(page.getByRole("heading", { name: "You're a founding member." })).toBeVisible();
    await expect(page.getByText("Your NZ$49 deposit is confirmed")).toBeVisible();
    // The Stripe reference is not left in the address bar.
    expect(page.url()).not.toContain(sessionId);

    await admin.reload();
    await expect(leadCard(admin, owner.name)).toContainText("Paid NZ$49");
    await expect(admin.locator("dl")).toContainText("NZ$49");
    await admin.close();

    // Going back to the offer page now shows a confirmation, not another pay button.
    await page.goto(`${BASE}/owners/thanks`);
    await expect(page.getByText("Your founding member deposit is confirmed.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Reserve my founding spot/ })).toHaveCount(0);
  });

  test("a different visitor cannot see someone else's deposit", async ({ page, browser }) => {
    const owner = ownerDetails();
    await goToCardPage(page, owner);
    await page.getByTestId("pay").click();
    await expect(page.getByRole("heading", { name: "You're a founding member." })).toBeVisible();

    const stranger = await browser.newPage();
    await stranger.goto(`${BASE}/owners/founding-member`);
    await expect(stranger.getByRole("heading", { name: "We haven't seen a payment yet." })).toBeVisible();
    await expect(stranger.getByText("NZ$49")).toHaveCount(0);

    // A forged "this is me" cookie is ignored.
    await stranger.context().addCookies([{ name: "hf_lead", value: "v1.11111111-1111-4111-8111-111111111111.9999999999999.forged", url: BASE }]);
    await stranger.goto(`${BASE}/owners/founding-member`);
    await expect(stranger.getByRole("heading", { name: "We haven't seen a payment yet." })).toBeVisible();
    await stranger.goto(`${BASE}/owners/thanks`);
    await expect(stranger.getByRole("button", { name: /Reserve my founding spot/ })).toHaveCount(0);
    await stranger.close();
  });

  test("backing out of the card page takes no money and says so", async ({ page }) => {
    const owner = ownerDetails();
    await goToCardPage(page, owner);
    await page.getByTestId("cancel").click();
    await expect(page).toHaveURL(`${BASE}/owners/thanks?deposit=cancelled`);
    await expect(page.getByText("No payment was taken.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reserve my founding spot for NZ$49" })).toBeVisible();

    await signIn(page, BASE);
    await expect(leadCard(page, owner.name)).toContainText("Started, not paid");
  });

  test("coming back from the card page without paying records nothing", async ({ page }) => {
    const owner = ownerDetails();
    const sessionId = await goToCardPage(page, owner);
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
});

test.describe("messages from Stripe", () => {
  test("records the payment even if the owner never comes back to the site", async ({ page, request }) => {
    const owner = ownerDetails();
    const sessionId = await goToCardPage(page, owner);

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
    await expect(leadCard(page, owner.name)).toContainText("Paid NZ$49");
  });

  test("marks the deposit refunded when you refund it in Stripe", async ({ page, request }) => {
    const owner = ownerDetails();
    const sessionId = await goToCardPage(page, owner);
    await page.getByTestId("pay").click();
    await expect(page.getByRole("heading", { name: "You're a founding member." })).toBeVisible();

    const session = await (await request.get(`${FAKE_STRIPE}/v1/checkout/sessions/${sessionId}`)).json();
    const refund = {
      id: `evt_refund_${sessionId}`,
      object: "event",
      type: "charge.refunded",
      data: { object: { id: "ch_fake", object: "charge", payment_intent: session.payment_intent, amount: 4900, amount_refunded: 4900, refunded: true } },
    };
    expect(await (await postWebhook(request, refund)).json()).toEqual({ received: true, outcome: "refunded" });
    expect(await (await postWebhook(request, refund)).json()).toEqual({ received: true, outcome: "nothing_to_change" });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Your deposit has been refunded." })).toBeVisible();

    await signIn(page, BASE);
    await expect(leadCard(page, owner.name)).toContainText("Refunded NZ$49");
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

test("the setup checklist shows card payments connected in test mode", async ({ page }) => {
  await signIn(page, BASE);
  const payments = page.locator('[data-status-key="payments"]');
  await expect(payments).toContainText("Connected in TEST mode. No real money moves.");
});
