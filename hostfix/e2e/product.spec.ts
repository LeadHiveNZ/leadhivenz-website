import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../playwright.config";

/**
 * THE PRODUCT, END TO END, in a real browser at phone size.
 *
 * These run against the copy of the site that starts with the made-up sample
 * business (see src/lib/demo/sample.ts): three owners, five tradies and nine
 * jobs at different points. Each test picks up one of those and carries it
 * through the way a real person would, pressing the real buttons.
 *
 * They run one after another and share the same data, in this order.
 */

const BASE = E2E.demoUrl;

test.describe.configure({ mode: "serial" });

/** A tiny real picture, to use wherever a photo is needed. */
const PHOTO = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
};

/**
 * Text that is on screen. Next.js keeps the page you came from in the
 * background, hidden, so a check that something is NOT shown has to look at
 * what is visible only.
 */
function shown(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true });
}

/** Waits until the page has finished loading its content (the grey placeholder blocks are gone). */
async function ready(page: Page) {
  await expect(page.locator('[role="status"].animate-pulse')).toHaveCount(0);
}

async function open(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await ready(page);
}

/** Signs in as one of the sample people from the demo menu. */
async function be(page: Page, label: string) {
  await open(page, "/demo");
  await page.locator("form", { hasText: label }).first().getByRole("button", { name: "Be them" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/demo"));
  await ready(page);
}

async function signOut(page: Page) {
  await page.context().clearCookies();
}

/** The texts on one sample person's pretend phone, oldest first. */
async function phone(page: Page, who: string) {
  await open(page, `/demo/phone?who=${who}`);
  return page.locator("p.rounded-2xl");
}

test("a tradie takes a job from the link in a text, without signing in, and finishes it", async ({ page }) => {
  const texts = await phone(page, "dave");
  const offer = texts.filter({ hasText: "Fix a dripping tap" }).last();
  await expect(offer).toContainText("Pays NZ$161");
  await offer.locator('a[href^="/o/"]').click();
  await ready(page);

  // Before accepting: what it pays and where roughly, but not the address or how to get in.
  await expect(page.getByRole("heading", { name: "Fix a dripping tap or mixer" })).toBeVisible();
  await expect(shown(page, "NZ$161").first().first()).toBeVisible();
  await expect(shown(page, "14B Lake Esplanade")).toHaveCount(0);
  await expect(shown(page, "code 4821")).toHaveCount(0);

  await page.getByRole("button", { name: "Accept job" }).click();
  await page.waitForURL(/yours=1/);
  await ready(page);
  await expect(shown(page, "The job is yours").first()).toBeVisible();
  await expect(shown(page, "14B Lake Esplanade, Queenstown 9300").first()).toBeVisible();
  await expect(shown(page, /code 4821/).first()).toBeVisible();

  await page.getByRole("button", { name: "I have arrived" }).click();
  await page.waitForURL(/here=1/);
  await ready(page);

  // A job cannot be finished without a photo.
  const finish = page.locator("form", { has: page.getByRole("button", { name: "Job done" }) });
  await finish.getByRole("button", { name: "Job done" }).click();
  await expect(finish.locator('[role="alert"]')).toContainText("Add at least one photo of the finished work.");

  await finish.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(finish.locator('img[alt="Photo added"]')).toBeVisible();
  await finish.getByLabel("What did you do?").fill("Replaced the tap washer. No drip after ten minutes.");
  await finish.getByRole("button", { name: "Job done" }).click();
  await page.waitForURL(/done=1/);
  await ready(page);
  await expect(shown(page, "Job finished. Thank you.").first()).toBeVisible();
  await expect(shown(page, /NZ\$161 will be sent to your bank on/).first()).toBeVisible();

  // The owner was texted at each step, and charged the fixed price.
  const owner = await phone(page, "sam");
  await expect(owner.filter({ hasText: "Dave's Plumbing & Gas is booked for Lakeview Apartment" }).last()).toBeVisible();
  await expect(owner.filter({ hasText: "has arrived at Lakeview Apartment" }).last()).toBeVisible();
  await expect(owner.filter({ hasText: '"Fix a dripping tap or mixer" at Lakeview Apartment is done. NZ$190 charged to your card.' })).toHaveCount(1);
});

test("an owner answers a quote from the link in their text, without signing in", async ({ page }) => {
  const texts = await phone(page, "sam");
  const quote = texts.filter({ hasText: "has quoted NZ$605" }).last();
  await quote.locator('a[href^="/j/"]').click();
  await ready(page);

  await expect(shown(page, "A quote needs your answer").first()).toBeVisible();
  await expect(shown(page, "Replace the leaking shower mixer and the section of pipe behind it").first().first()).toBeVisible();
  await page.getByRole("button", { name: "Yes, go ahead · NZ$605" }).click();
  await page.waitForURL(/answered=1/);
  await ready(page);
  await expect(shown(page, "Thanks, the tradie has been told").first()).toBeVisible();

  const tradie = await phone(page, "mere");
  await expect(tradie.filter({ hasText: "the owner approved your quote of NZ$605. Go ahead." })).toHaveCount(1);
});

test("a guest's report waits for the owner's yes, and the guest never sees a price", async ({ page }) => {
  await be(page, "Sam Taylor");
  await open(page, "/app/properties");
  await page.getByRole("link", { name: /Lakeview Apartment/ }).click();
  await ready(page);
  await page.getByRole("link", { name: "Print the QR card" }).click();
  await page.waitForURL(/\/card$/);
  await ready(page);
  // The address printed under the QR code, without the site's name in front.
  const printed = await page.locator("p.break-all").filter({ visible: true }).first().innerText();
  const guestPath = `/${printed.split("/").slice(1).join("/")}`;
  expect(guestPath).toMatch(/^\/r\/[A-Za-z0-9]{20}$/);

  // The guest has no account and is not signed in.
  await signOut(page);
  await open(page, guestPath);
  await expect(page.getByRole("heading", { name: "Something not working?" })).toBeVisible();
  await expect(shown(page, "In danger? Call 111 first").first()).toBeVisible();
  await page.getByRole("button", { name: /Plumbing/ }).click();
  await expect(page.getByRole("radio", { name: "Unblock a toilet" })).toBeVisible();
  await expect(shown(page, /NZ\$\d/)).toHaveCount(0);

  // A name that is too short is turned back, with the chosen job kept.
  await page.getByRole("radio", { name: "Unblock a toilet" }).click();
  await page.getByLabel("Your name").fill("G");
  await page.getByRole("button", { name: "Report it" }).click();
  await expect(page.locator('form [role="alert"]').first()).toContainText("Please check the highlighted fields.");
  await expect(page.getByRole("radio", { name: "Unblock a toilet" })).toHaveAttribute("aria-checked", "true");

  await page.getByLabel("Your name").fill("Gus Guest");
  await page.getByRole("button", { name: "Report it" }).click();
  await page.waitForURL(/\/sent\?w=owner/);
  await ready(page);
  await expect(shown(page, "Your host has been told and will arrange the fix.").first()).toBeVisible();

  // Nobody has been sent. The owner is asked first.
  await be(page, "Sam Taylor");
  const waiting = page.getByRole("link", { name: /Unblock a toilet/ });
  await expect(waiting).toContainText("Waiting for your go-ahead");
  await waiting.click();
  await ready(page);
  await expect(shown(page, "Gus Guest reported this from the QR card").first()).toBeVisible();
  await page.getByRole("button", { name: /Yes, send a tradie · NZ\$220/ }).click();
  await page.waitForURL(/sent=1/);
  await ready(page);
  await expect(shown(page, "Finding a tradie").first().first()).toBeVisible();
});

test("the dispatcher gives a job nobody accepted to a tradie they have rung", async ({ page }) => {
  await be(page, "Maria (dispatcher)");
  const item = page.locator("li", { hasText: "nobody accepted" }).first();
  await expect(item).toContainText("Replace or re-code a door lock or key safe");
  await expect(item).toContainText("What to do:");
  await item.getByRole("link", { name: /Open job/ }).click();
  await ready(page);

  await page.getByLabel("Give the job to").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Assign this tradie" }).click();
  await page.waitForURL(/did=assigned/);
  await ready(page);
  await expect(shown(page, "Assigned. The tradie and the owner have both been texted.").first()).toBeVisible();
  await expect(shown(page, "Tradie booked").first().first()).toBeVisible();

  await open(page, "/admin/queue");
  await expect(page.locator("li", { hasText: "nobody accepted" })).toHaveCount(0);

  const tradie = await phone(page, "andy");
  await expect(tradie.filter({ hasText: /job \d+ is yours\. 14B Lake Esplanade/ }).last()).toBeVisible();
});

test("an offer nobody answers moves on to the backup after 15 minutes", async ({ page }) => {
  await be(page, "Sam Taylor");
  await open(page, "/app/jobs/new");
  await page.getByRole("link", { name: /Lakeview Apartment/ }).click();
  await ready(page);
  await page.getByRole("button", { name: /Plumbing/ }).click();
  await page.getByRole("radio", { name: /Fix a running or leaking toilet cistern/ }).click();
  await expect(shown(page, "NZ$210").last().first()).toBeVisible();
  await page.getByRole("button", { name: "Send a tradie" }).click();
  await page.waitForURL(/sent=1/);
  const jobUrl = page.url().split("?")[0]!;
  const jobId = jobUrl.split("/").pop()!;

  await open(page, "/demo");
  await page.getByRole("button", { name: "Skip 15 minutes" }).click();
  await page.waitForURL(/skipped=15/);

  await be(page, "Maria (dispatcher)");
  await open(page, `/admin/jobs/${jobId}`);
  await expect(page.getByRole("heading", { name: "Who was offered it" })).toBeVisible();
  await expect(page.locator("li", { hasText: "Dave's Plumbing & Gas" }).filter({ hasText: "First choice" })).toContainText("Ran out");
  await expect(page.locator("li", { hasText: "Lakes Plumbing" }).filter({ hasText: "Backup" })).toContainText("Waiting for an answer");
});

test("people only see their own data", async ({ page, request }) => {
  // Collect the address of one of Sam's jobs, one of his properties and one of his photos.
  await be(page, "Sam Taylor");
  await open(page, "/app/jobs");
  await page.getByRole("link", { name: /Unblock a sink, basin, shower or bath drain/ }).click();
  await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await ready(page);
  const jobPath = new URL(page.url()).pathname;
  const jobId = jobPath.split("/").pop()!;
  const photoPath = await page.locator('img[src^="/files/"]').first().getAttribute("src");
  expect(photoPath).toMatch(/^\/files\/[0-9a-f-]{36}$/);
  expect((await page.request.get(`${BASE}${photoPath}`)).status()).toBe(200);
  await open(page, "/app/properties");
  await page.getByRole("link", { name: /Lakeview Apartment/ }).click();
  await page.waitForURL(/\/app\/properties\/[0-9a-f-]{36}$/);
  await ready(page);
  const propertyPath = new URL(page.url()).pathname;

  // Another owner cannot open any of them.
  await be(page, "Priya Patel");
  for (const path of [jobPath, propertyPath, `${propertyPath}/card`]) {
    await open(page, path);
    await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
    await expect(shown(page, "Lakeview Apartment")).toHaveCount(0);
  }
  expect((await page.request.get(`${BASE}${photoPath}`)).status()).toBe(404);
  await open(page, "/app/jobs");
  await expect(shown(page, "Lakeview Apartment")).toHaveCount(0);
  await expect(shown(page, "Fernhill Studio").first().first()).toBeVisible();

  // A tradie who is not on the job cannot open it, or its photos, or an owner's or the team's pages.
  await be(page, "Lena (handyman)");
  await open(page, `/tradie/jobs/${jobId}`);
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
  expect((await page.request.get(`${BASE}${photoPath}`)).status()).toBe(404);
  await page.goto(`${BASE}${jobPath}`);
  await expect(page).toHaveURL(`${BASE}/tradie`);
  await page.goto(`${BASE}/admin/queue`);
  await expect(page).toHaveURL(`${BASE}/admin`);
  await page.goto(`${BASE}/admin/jobs/${jobId}`);
  await expect(page).toHaveURL(`${BASE}/admin`);

  // The dispatcher sees jobs but not prices, markets, staff or the numbers.
  await be(page, "Maria (dispatcher)");
  await open(page, `/admin/jobs/${jobId}`);
  await expect(shown(page, "Lakeview Apartment").first().first()).toBeVisible();
  for (const path of ["/admin/dashboard", "/admin/markets", "/admin/markets/queenstown", "/admin/staff", "/admin/audit", "/admin/leads"]) {
    await page.goto(`${BASE}${path}`);
    await expect(page).toHaveURL(`${BASE}/admin/queue`);
  }
  expect((await page.request.get(`${BASE}/admin/leads/export`)).status()).toBe(401);

  // Someone who is not signed in sees nothing at all.
  await signOut(page);
  for (const path of [jobPath, propertyPath, "/app", "/tradie", "/tradie/pay"]) {
    await page.goto(`${BASE}${path}`);
    await expect(page).toHaveURL(new RegExp(`^${BASE}/sign-in\\?next=`));
  }
  for (const path of ["/admin/queue", `/admin/jobs/${jobId}`, "/admin/owners"]) {
    await page.goto(`${BASE}${path}`);
    await expect(page).toHaveURL(`${BASE}/admin`);
  }
  expect((await request.get(`${BASE}${photoPath}`)).status()).toBe(404);

  // A one-tap link only opens with its own code. A guessed or altered one opens nothing.
  const texts = await phone(page, "sam");
  const real = await texts.locator('a[href^="/j/"]').first().getAttribute("href");
  const [number, code] = real!.replace("/j/", "").split(".");
  const altered = `${code!.slice(0, -1)}${code!.endsWith("A") ? "B" : "A"}`;
  for (const path of [`/j/${number}.${altered}`, `/j/${Number(number) + 1}.${code}`, `/o/${number}.${code}`, "/j/1001.AAAAAAAAAAAA", "/r/AAAAAAAAAAAAAAAAAAAA"]) {
    await open(page, path);
    await expect(shown(page, /That link did not open|This link does not work any more/)).toHaveCount(1);
    await expect(shown(page, "Lakeview Apartment")).toHaveCount(0);
  }
});

test("an admin changes a price and owners see it straight away; jobs already logged keep theirs", async ({ page }) => {
  await be(page, "Admin (you)");
  await open(page, "/admin/markets/queenstown");
  const row = page.locator("details", { hasText: "Replace a tap or mixer (owner supplies the tap)" }).first();
  await row.locator("summary").click();
  await row.getByLabel("Owner pays (NZD)").fill("255");
  await row.getByLabel("Tradie gets (NZD)").fill("216");
  await row.getByRole("button", { name: "Save job" }).click();
  await expect(row.locator('[role="status"]')).toContainText("Saved. The new price applies to jobs logged from now on.");

  await be(page, "Sam Taylor");
  await open(page, "/app/jobs/new");
  await page.getByRole("link", { name: /Arthurs Point Cabin/ }).click();
  await ready(page);
  await page.getByRole("button", { name: /Plumbing/ }).click();
  await expect(page.getByRole("radio", { name: /Replace a tap or mixer/ })).toContainText("NZ$255");

  // The job finished earlier at the old menu price is unchanged.
  await open(page, "/app/jobs");
  await page.getByRole("link", { name: /Fix a dripping tap or mixer/ }).click();
  await ready(page);
  await expect(shown(page, "NZ$190").first().first()).toBeVisible();
});

test("a new owner joins, pays for a membership and gets their QR card", async ({ page }) => {
  // Saving the market's settings also refreshes the public pages, which were built before the market opened.
  await be(page, "Admin (you)");
  await open(page, "/admin/markets/queenstown");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(shown(page, /Saved\. New prices apply to jobs logged from now on\./).first()).toBeVisible();
  await signOut(page);

  await open(page, "/sign-up");
  await page.getByLabel("Your name").fill("Nina New");
  await page.getByLabel("Email").fill("nina.new@example.com");
  await page.getByLabel("Mobile number").fill("021 555 0101");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/sign-in\/code/);
  await ready(page);
  const code = (await page.locator("[data-demo-code]").innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);

  // A wrong code is refused.
  await page.getByLabel("Six-digit code").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.locator('form [role="alert"]').first()).toContainText("That code is not right.");
  await page.getByLabel("Six-digit code").fill(code);
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL(/app\/properties\/new/);
  await ready(page);

  await page.getByLabel("What do you call this place?").fill("Gorge Road Flat");
  await page.getByLabel("Street address").fill("120 Gorge Road");
  await page.getByLabel("Suburb or town").fill("Queenstown");
  await page.getByLabel("How does a tradie get in?").fill("Lockbox by the meter box, code 1357.");
  await page.getByRole("radio", { name: /Priority/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL(/added=1/);
  await ready(page);

  // Not a member yet: jobs cannot be logged.
  await open(page, "/app/jobs/new");
  await expect(shown(page, "Start a membership first").first()).toBeVisible();
  await page.getByRole("link", { name: "Finish setting up" }).click();
  await ready(page);

  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.waitForURL(/demo\/checkout/);
  await ready(page);
  await expect(shown(page, "Priority membership").first()).toBeVisible();
  await expect(shown(page, "NZ$149").first().first()).toBeVisible();
  await page.getByRole("button", { name: "Pay NZ$149 and start" }).click();
  await page.waitForURL(/member=1/);
  await ready(page);
  await expect(shown(page, "You are covered").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Print the QR card" })).toBeVisible();
  await expect(shown(page, "Priority, NZ$149 a month").first()).toBeVisible();

  // The statement shows the first month.
  await open(page, "/app/billing");
  await expect(shown(page, "Monthly membership").first()).toBeVisible();
  await expect(shown(page, "Visa").first().first()).toBeVisible();
});

test("a tradie signs in with their mobile, adds a licence and bank details", async ({ page }) => {
  await open(page, "/sign-in?next=/tradie/profile");
  await page.getByLabel(/Email or mobile/).fill("021 123 4506");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.waitForURL(/sign-in\/code/);
  await ready(page);
  const code = (await page.locator("[data-demo-code]").innerText()).trim();
  await page.getByLabel("Six-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/tradie\/profile/);
  await ready(page);

  await expect(page.getByText("Needed", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add bank details" }).click();
  await page.waitForURL(/demo\/payout-setup/);
  await ready(page);
  await page.getByRole("button", { name: /Done: my bank details are in/ }).click();
  await page.waitForURL(/payouts=done/);
  await ready(page);
  await expect(shown(page, "Bank details set up. You can be paid.").first()).toBeVisible();

  // Still waiting for a person on the team to approve them, so no offers yet.
  await open(page, "/tradie");
  await expect(shown(page, "We are checking your details").first()).toBeVisible();
  await expect(shown(page, "No offers right now").first()).toBeVisible();
});
