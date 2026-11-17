import { expect, test } from "@playwright/test";
import { E2E } from "../playwright.config";
import { fillOwnerForm, formAlert, leadCard, ownerDetails, priceListButton, signIn, submitOwnerLead, uniqueIp, uniquePhone, waitLikeAPerson } from "./helpers";

const BASE = E2E.plainUrl;

test.beforeEach(async ({ context }) => {
  // Each test is a different visitor as far as rate limits are concerned.
  await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
});

test.describe("owner landing page on a phone", () => {
  test("shows the headline, the price and the form without sideways scrolling", async ({ page }) => {
    await page.goto("/owners");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Queenstown");
    await expect(page.getByText("NZ$99 a month per property").first()).toBeVisible();
    // Card payments are not connected on this copy of the site, so the form offers the price list only.
    await expect(page.getByRole("heading", { name: "Get the full price list" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Take a founding spot" })).toHaveCount(0);
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page).toHaveTitle(/Queenstown.*\| HostFix/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("shows real prices and no unfinished copy", async ({ page }) => {
    for (const path of ["/owners", "/tradies"]) {
      await page.goto(path);
      await expect(page.locator("mark[data-edit-marker]")).toHaveCount(0);
      await expect(page.getByText("[EDIT")).toHaveCount(0);
    }
    await page.goto("/owners");
    // A few of the researched Queenstown prices (seed/menu-queenstown.json), GST included.
    const menu = page.getByRole("region", { name: "Fixed prices for the common jobs" });
    await expect(menu).toContainText("Blocked toilet, sink or shower drain");
    await expect(menu).toContainText("NZ$245");
    await expect(page.getByText(/priority/i)).toHaveCount(0);
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
    await priceListButton(page).click();
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
    await priceListButton(page).click();

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
    await priceListButton(page).click();
    await expect(page).toHaveURL(`${BASE}/owners/thanks`);
  });

  test("shows the full price list straight after the form, and no deposit when card payments are not connected", async ({ page }) => {
    await page.goto("/owners");
    await expect(page.getByRole("button", { name: /founding spot/i })).toHaveCount(0);
    await submitOwnerLead(page, BASE, ownerDetails());
    // The form is far down a long page. The thank-you page must open at the top, not at its footer.
    await expect(page.getByRole("heading", { name: "You're on the list." })).toBeInViewport();

    const prices = page.getByRole("region", { name: "The Queenstown price list" });
    await expect(prices).toContainText("Blocked toilet, sink or shower drain");
    await expect(prices).toContainText("NZ$245");
    await expect(prices).toContainText("Membership NZ$99 a month per property.");
    // Every other charge, from the market's own settings.
    await expect(prices).toContainText("Add NZ$90, plus NZ$140 outside working hours (7am to 4:30pm, Monday to Friday)");
    await expect(prices).toContainText("NZ$225 for a tradie to come and look");
    await expect(prices).toContainText("Nothing over NZ$600 starts without your yes.");
    // Prices still waiting on a local quote are not shown (DECISIONS.md).
    await expect(prices).not.toContainText("Log burner or chimney sweep");

    await expect(page.getByRole("button", { name: /founding spot/i })).toHaveCount(0);
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
    await priceListButton(page).click();
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
    await priceListButton(page).click();
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
    await priceListButton(page).click();
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

  test("the legal pages are real, in plain English, and say when they were last updated", async ({ page }) => {
    const pages: [string, string, string][] = [
      ["/legal/terms", "Terms of service", "Our promise, and what happens if we miss it"],
      ["/legal/privacy", "Privacy statement", "Who sees what"],
      ["/legal/tradie-agreement", "Tradie agreement", "The price is the price"],
      ["/legal/insurance", "Insurance", "The tradie"],
    ];
    for (const [path, title, heading] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("heading", { name: new RegExp(heading) })).toBeVisible();
      await expect(page.getByText(/Last updated \d{1,2} \w+ \d{4}/)).toBeVisible();
      await expect(page.getByText("Placeholder page")).toHaveCount(0);
      await expect(page.getByText("[EDIT")).toHaveCount(0);
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
