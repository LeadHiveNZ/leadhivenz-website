import { expect, test } from "@playwright/test";
import { E2E } from "../playwright.config";
import { formAlert, leadCard, ownerDetails, signIn, submitOwnerLead, uniqueIp } from "./helpers";

const BASE = E2E.plainUrl;

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
});

test.describe("the leads are private", () => {
  test("the leads list sends a signed-out visitor to the sign-in page", async ({ page }) => {
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(`${BASE}/admin`);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("li[data-lead-id]")).toHaveCount(0);
  });

  test("the leads list answers a signed-out request with a redirect, never with leads", async ({ request }) => {
    const response = await request.get("/admin/leads", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin");
    expect(await response.text()).not.toContain("data-lead-id");
  });

  test("the spreadsheet download is refused without signing in", async ({ request }) => {
    const response = await request.get("/admin/leads/export", { maxRedirects: 0 });
    expect([307, 401]).toContain(response.status());
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
  });

  test("a made-up or tampered pass does not get in", async ({ context, page }) => {
    for (const value of ["v1.9999999999999.abc.def", "anything", ""]) {
      await context.clearCookies();
      await context.addCookies([{ name: "hf_admin", value, url: BASE }]);
      await page.goto("/admin/leads");
      await expect(page).toHaveURL(`${BASE}/admin`);
    }
  });

  test("the wrong password is refused", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Password").fill("definitely-not-it");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("That password isn't right.");
    await expect(page).toHaveURL(`${BASE}/admin`);
  });

  test("too many wrong passwords locks sign-in for a while, even for the right one", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "10.88.88.88" });
    await page.goto("/admin");
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await page.getByLabel("Password").fill(`wrong-${attempt}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(formAlert(page)).toContainText("That password isn't right.");
      // The box is emptied once the answer has come back. Wait for that before the next try.
      await expect(page.getByLabel("Password")).toHaveValue("");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    }
    await page.getByLabel("Password").fill(E2E.adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toContainText("Too many tries. Please wait 15 minutes and try again.");
    await expect(page).toHaveURL(`${BASE}/admin`);
  });

  test("the private pages tell search engines to keep out", async ({ request }) => {
    const response = await request.get("/admin");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  });
});

test.describe("signed in", () => {
  test("shows totals, the setup checklist and a working sign-out", async ({ page }) => {
    const owner = ownerDetails();
    await submitOwnerLead(page, BASE, owner);
    await signIn(page);

    await expect(page.getByText("Demo mode.")).toBeVisible();
    await expect(page.locator("dl")).toContainText("Owners");
    await expect(leadCard(page, owner.name)).toBeVisible();

    const checklist = page.getByRole("region", { name: "Setup checklist" });
    await expect(checklist.locator('[data-status-key="database"]')).toContainText("Demo mode");
    await expect(checklist.locator('[data-status-key="email"]')).toContainText("RESEND_API_KEY is not set.");
    await expect(checklist.locator('[data-status-key="sms"]')).toContainText("CLICKSEND_USERNAME and CLICKSEND_API_KEY are not set.");
    await expect(checklist.locator('[data-status-key="payments"]')).toContainText("STRIPE_NZ_SECRET_KEY is not set.");
    await expect(checklist.locator('[data-status-key="copy"]')).toContainText("[EDIT] placeholder");
    await expect(checklist.locator('[data-status-key="legal"]')).toContainText("A lawyer needs to write them");

    // Visiting the sign-in page while signed in goes straight to the leads.
    await page.goto("/admin");
    await expect(page).toHaveURL(`${BASE}/admin/leads`);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${BASE}/admin`);
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(`${BASE}/admin`);
  });

  test("the test alert button reports honestly when nothing is connected", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Send me a test alert" }).click();
    const result = page.getByRole("status");
    await expect(result).toContainText("Text: Not sent. CLICKSEND_USERNAME and CLICKSEND_API_KEY are not set.");
    await expect(result).toContainText("Email: Not sent. RESEND_API_KEY is not set.");
  });

  test("downloads every lead as a spreadsheet", async ({ page }) => {
    const owner = ownerDetails({ name: "Spreadsheet, Sam" });
    await submitOwnerLead(page, BASE, owner);
    await signIn(page);

    const response = await page.request.get("/admin/leads/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="hostfix-leads-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(response.headers()["cache-control"]).toContain("no-store");

    const csv = await response.text();
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Date,Type,Name,Phone,Email,Properties,Looked after by,Lives in,Trade,Licence number,Days available,Market,Source,Campaign,Ad,Referred by,Came from site,Landed on,Deposit,Deposit amount,Deposit currency,Lead ID",
    );
    const row = lines.find((line) => line.includes(owner.email));
    expect(row).toBeDefined();
    expect(row).toContain('"Spreadsheet, Sam"');
    expect(row).toContain("Owner");
    expect(row).toContain("+6421");
    expect(row).toContain("queenstown");
    expect(row).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2},/);
  });
});
