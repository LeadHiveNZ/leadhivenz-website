import { expect, test } from "@playwright/test";
import { E2E } from "../playwright.config";
import { fillOwnerForm, formAlert, leadCard, ownerDetails, signIn, submitOwnerLead, uniqueIp, uniquePhone, waitLikeAPerson } from "./helpers";

const BASE = E2E.plainUrl;

test.beforeEach(async ({ context }) => {
  // Each test is a different visitor as far as rate limits are concerned.
  await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
});

test.describe("owner landing page on a phone", () => {
  test("shows the headline, the price and the form without sideways scrolling", async ({ page }) => {
    await page.goto("/owners");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Queenstown");
    await expect(page.getByText("From NZ$99 a month per property")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Get early access" })).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page).toHaveTitle(/Queenstown.*\| HostFix/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("highlights unfinished copy so it cannot be missed", async ({ page }) => {
    await page.goto("/owners");
    const markers = page.locator("mark[data-edit-marker]");
    expect(await markers.count()).toBeGreaterThan(0);
    await expect(markers.first()).toContainText("[EDIT");
  });

  test("saves a lead with where it came from, and shows it on the leads list", async ({ page }) => {
    const owner = ownerDetails({ location: "Wellington" });
    await submitOwnerLead(page, BASE, owner, "?utm_source=facebook&utm_medium=paid&utm_campaign=qt-owners-test&fbclid=abc123");

    await signIn(page);
    const card = leadCard(page, owner.name);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Owner");
    await expect(card).toContainText(owner.phone);
    await expect(card).toContainText(owner.email);
    await expect(card).toContainText("2 properties");
    await expect(card).toContainText("A property manager");
    await expect(card).toContainText("lives in Wellington");
    await expect(card).toContainText("Facebook / Instagram");
    await expect(card).toContainText("qt-owners-test");
    await expect(card.getByRole("link", { name: owner.phone })).toHaveAttribute("href", /^tel:\+6421/);
  });

  test("remembers the ad a visitor arrived from while they look around first", async ({ page }) => {
    const owner = ownerDetails();
    await page.goto("/?gclid=test-click-1");
    await page.getByRole("link", { name: /I own a holiday home/ }).click();
    await expect(page).toHaveURL(`${BASE}/owners`);
    await fillOwnerForm(page, owner);
    await waitLikeAPerson(page);
    await page.getByRole("button", { name: "Get early access" }).click();
    await expect(page).toHaveURL(`${BASE}/owners/thanks`);

    await signIn(page);
    await expect(leadCard(page, owner.name)).toContainText("Google Ads");
  });

  test("explains mistakes in plain words and keeps what was typed", async ({ page }) => {
    const owner = ownerDetails({ email: "not-an-email@", phone: "12345" });
    await page.goto("/owners");
    await fillOwnerForm(page, owner);
    await waitLikeAPerson(page);
    // Skip the browser's own pop-up checks so the server's messages are what is tested.
    await page.locator("form").first().evaluate((form) => form.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: "Get early access" }).click();

    await expect(formAlert(page)).toContainText("Please check the highlighted fields below.");
    await expect(page.getByText("That email address doesn't look right. Please check it.")).toBeVisible();
    await expect(page.getByText("Please enter your mobile number.")).toBeVisible();
    await expect(page).toHaveURL(`${BASE}/owners`);

    await expect(page.getByLabel("Your name")).toHaveValue(owner.name);
    await expect(page.getByLabel("Where do you live?")).toHaveValue("Auckland");
    await expect(page.getByLabel("Who looks after them now?")).toHaveValue("property_manager");
    await expect(page.getByLabel("Mobile number")).toBeFocused();

    // Fix the two fields and it goes through, with the source still attached.
    const fixedPhone = uniquePhone();
    await page.getByLabel("Mobile number").fill(fixedPhone);
    await page.getByLabel("Email").fill("fixed@example.com");
    await page.getByRole("button", { name: "Get early access" }).click();
    await expect(page).toHaveURL(`${BASE}/owners/thanks`);
  });

  test("does not offer the deposit when card payments are not connected", async ({ page }) => {
    await submitOwnerLead(page, BASE, ownerDetails());
    await expect(page.getByRole("button", { name: /Reserve my founding spot/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Lock in your spot/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
  });

  test("treats the same person sending the form twice as one lead", async ({ page }) => {
    const owner = ownerDetails();
    await submitOwnerLead(page, BASE, owner);
    await submitOwnerLead(page, BASE, owner);
    await signIn(page);
    await expect(leadCard(page, owner.name)).toHaveCount(1);
  });
});

test.describe("robots", () => {
  test("a robot that fills in the hidden field gets a thank-you page and nothing is saved", async ({ page }) => {
    const owner = ownerDetails({ name: "Robot Hidden Field" });
    await page.goto("/owners");
    await fillOwnerForm(page, owner);
    await page.locator('input[name="hf_confirm_field"]').evaluate((input: HTMLInputElement) => {
      input.value = "http://spam.example";
    });
    await waitLikeAPerson(page);
    await page.getByRole("button", { name: "Get early access" }).click();
    await expect(page).toHaveURL(`${BASE}/owners/thanks`);

    await signIn(page);
    await expect(leadCard(page, owner.name)).toHaveCount(0);
  });

  test("a form sent faster than a person could type is not saved", async ({ page }) => {
    const owner = ownerDetails({ name: "Robot Too Fast" });
    await page.goto("/owners");
    // Wait for the page to finish starting up, then submit straight away.
    await expect(page.locator('input[name="startedAt"]')).not.toHaveValue("");
    await page.locator('input[name="startedAt"]').evaluate((input: HTMLInputElement) => {
      input.value = String(Date.now());
    });
    await fillOwnerForm(page, owner);
    await page.getByRole("button", { name: "Get early access" }).click();
    await expect(page).toHaveURL(`${BASE}/owners/thanks`);

    await signIn(page);
    await expect(leadCard(page, owner.name)).toHaveCount(0);
  });

  test("one visitor cannot flood the form", async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.99.99" });
    for (let i = 0; i < 6; i += 1) {
      await submitOwnerLead(page, BASE, ownerDetails());
    }
    await page.goto("/owners");
    await fillOwnerForm(page, ownerDetails({ name: "One Too Many" }));
    await waitLikeAPerson(page);
    await page.getByRole("button", { name: "Get early access" }).click();
    await expect(formAlert(page)).toContainText("You've sent this form a few times in a row.");
    await expect(page).toHaveURL(`${BASE}/owners`);
  });
});

test.describe("tradie landing page on a phone", () => {
  test("saves a tradie lead and shows it on the leads list", async ({ page }) => {
    const phone = uniquePhone();
    const name = `Tane Tradie ${phone.slice(-4)}`;
    await page.goto("/tradies?utm_source=flyer");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Queenstown");

    await page.getByLabel("Your name").fill(name);
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByLabel("Your trade").selectOption("plumber");
    await page.getByLabel("Licence number").fill("PGDB 12345");
    await page.getByText("Mon", { exact: true }).click();
    await page.getByText("Sat", { exact: true }).click();
    await waitLikeAPerson(page);
    await page.getByRole("button", { name: "Put my name down" }).click();

    await expect(page).toHaveURL(`${BASE}/tradies/thanks`);
    await expect(page.getByRole("heading", { name: "You're on the list." })).toBeVisible();

    await signIn(page);
    await page.getByRole("navigation", { name: "Filter leads" }).getByRole("link", { name: "Tradies", exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/admin/leads?type=tradie`);
    const card = leadCard(page, name);
    await expect(card).toContainText("Tradie");
    await expect(card).toContainText("Plumber");
    await expect(card).toContainText("licence PGDB 12345");
    await expect(card).toContainText("Mon, Sat");
    await expect(card).toContainText("Flyer");
    await expect(page.locator("li[data-lead-id]").filter({ hasText: "Owner" })).toHaveCount(0);
  });

  test("asks for at least one day and keeps the trade that was chosen", async ({ page }) => {
    await page.goto("/tradies");
    await page.getByLabel("Your name").fill("Dayless Dave");
    await page.getByLabel("Mobile number").fill(uniquePhone());
    await page.getByLabel("Your trade").selectOption("electrician");
    await waitLikeAPerson(page);
    await page.getByRole("button", { name: "Put my name down" }).click();
    await expect(page.getByText("Please tick at least one day.")).toBeVisible();
    await expect(page.getByLabel("Your trade")).toHaveValue("electrician");
    await expect(page).toHaveURL(`${BASE}/tradies`);
  });
});

test.describe("other public pages", () => {
  test("the home page sends owners and tradies to their own page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /I own a holiday home/ })).toHaveAttribute("href", "/owners");
    await expect(page.getByRole("link", { name: /I'm a tradie/ })).toHaveAttribute("href", "/tradies");
  });

  test("legal pages are clearly marked as placeholders", async ({ page }) => {
    for (const path of ["/legal/terms", "/legal/privacy", "/legal/tradie-agreement", "/legal/insurance"]) {
      await page.goto(path);
      await expect(page.getByText("Placeholder page")).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("search engines are told to stay out of the private pages", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /owners/thanks");
  });

  test("an address that does not exist shows a friendly page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  });
});
