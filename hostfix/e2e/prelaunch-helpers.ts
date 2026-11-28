import { expect, type Page } from "@playwright/test";
import { E2E } from "../playwright.config";

/**
 * Shared by the pre-launch browser test and the soak run (DECISIONS.md,
 * 2026-11-27, second entry). Both use the "prelaunch" copy of the site: empty,
 * with Queenstown and Wānaka on the waiting list with pre-launch on.
 */

export const BASE = E2E.prelaunchUrl;

/** Text that is on screen. Next.js keeps the page you came from in the background, hidden (AGENTS.md). */
export function shown(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true });
}

/** Waits until the page has finished loading its content (the grey placeholder blocks are gone). */
export async function ready(page: Page) {
  await expect(page.locator('[role="status"].animate-pulse')).toHaveCount(0);
}

/**
 * Waits until a freshly loaded page has finished starting up and stopped redrawing itself. A person cannot type
 * into a form in the first fraction of a second; a test can, and whatever it typed is lost if the page then
 * redraws (which these test copies do on signed-in pages: see DEMO_STRIP_NOISE below). So: the first button or
 * link on the page must be live, and still be the same one a moment later.
 */
export async function settled(page: Page) {
  await page.waitForFunction(async () => {
    const pick = () => document.querySelector("form button, nav a, main a, a[href]");
    const live = (element: Element | null) => element !== null && Object.keys(element).some((key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"));
    const first = pick();
    if (!live(first)) return false;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return pick() === first && live(first);
  });
}

/** Loads a page the way typing its address does, and waits for it to be ready to use. */
export async function visit(page: Page, url: string) {
  await page.goto(url);
  await ready(page);
  await settled(page);
}

export async function open(page: Page, path: string) {
  await visit(page, `${BASE}${path}`);
}

/**
 * Only in these test copies of the site: they are built as the live site is (`npx next build`, no demo strip in the
 * page's fixed part) and then run in demo mode (the "DEMO: nothing here is real" strip at the top of
 * src/app/layout.tsx). On a signed-in page React notices the strip was not in the part it was sent first, says so
 * (error 418) and draws the page again, and the pieces still arriving for the first drawing find nowhere to go
 * ("parentNode"). The person sees the right page. It happens on every signed-in page of every test copy, on code
 * this change never touched, and cannot happen on the live site, where there is no demo mode. So these two, and only
 * these two, are not counted.
 */
const DEMO_STRIP_NOISE = [/Minified React error #418/, /^Cannot read properties of null \(reading 'parentNode'\)$/];

/**
 * Writes down anything that would be an error page for a person: a reply from
 * the site with a 500, or a script error. Call once per page, then read
 * `problems` at the end.
 */
export function watchForErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith(BASE) && response.status() >= 500) problems.push(`${response.status()} from ${response.request().method()} ${response.url()}`);
  });
  page.on("pageerror", (error) => {
    if (!DEMO_STRIP_NOISE.some((known) => known.test(error.message))) problems.push(`script error on ${page.url()}: ${error.message}`);
  });
  return problems;
}

/** Every way to a card form or a card page. None of them may be on screen before launch. */
const CARD_BUTTONS = /^(Add a card|Cover this property|Cover this property again|Start membership|Start the membership|Continue to payment|Change card|Update my card|Add my bank account|Start the retainer|Save card)$/;
const CARD_LINKS = /^(Add a bank account|Change bank account|Finish setting up|Update my card|Report a problem here)$/;

/**
 * The page on screen is a real page (not an error, not "can't find that page"),
 * and it offers no card form, no membership button and no way to log a job.
 */
export async function expectCalm(page: Page, where: string) {
  await ready(page);
  expect(page.url(), `${where}: sent to a card page`).not.toContain("/demo/checkout");
  await expect(shown(page, "Something went wrong on our side."), `${where}: the error page`).toHaveCount(0);
  await expect(shown(page, "We can't find that page."), `${where}: page not found`).toHaveCount(0);
  await expect(page.getByRole("button", { name: CARD_BUTTONS }).filter({ visible: true }), `${where}: a card or membership button`).toHaveCount(0);
  await expect(page.getByRole("link", { name: CARD_LINKS }).filter({ visible: true }), `${where}: a link to a card page or the job form`).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Add a card" }).filter({ visible: true }), `${where}: the card form`).toHaveCount(0);
  await expect(shown(page, /is not covered yet/), `${where}: "not covered yet"`).toHaveCount(0);
}

/** The owner's screens, each of which must make sense before launch. */
export const OWNER_PAGES = ["/app", "/app/properties", "/app/billing", "/app/billing/bank", "/app/jobs/new", "/app/jobs", "/app/team", "/app/properties/cards", "/app/account"];

export type NewOwner = { name: string; email: string; phone: string; market?: string | null };

/** Fills in the sign-up form and presses Continue. Ends wherever that leads: the code page, or the form with a message. */
export async function startSignUp(page: Page, owner: NewOwner) {
  await open(page, `/sign-up${owner.market ? `?market=${owner.market}` : ""}`);
  await page.getByLabel("Your name").fill(owner.name);
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Mobile number").fill(owner.phone);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Types the code "emailed" to the owner (shown on screen, as no email service is connected) and lands on Add a property. */
export async function finishSignUp(page: Page) {
  await page.waitForURL(/sign-in\/code/);
  await ready(page);
  const code = (await page.locator("[data-demo-code]").innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Six-digit code").fill(code);
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL(/\/app\/properties\/new/);
  await ready(page);
}

export type NewProperty = { name: string; address: string; suburb: string; postcode?: string; access?: string; hazards?: string };

/** Fills in Add a property and saves. Ends on the new property's page and returns its id. */
export async function addProperty(page: Page, market: string, property: NewProperty): Promise<string> {
  if (!new URL(page.url()).pathname.endsWith("/app/properties/new") || !page.url().includes(`market=${market}`)) await open(page, `/app/properties/new?market=${market}`);
  await page.getByLabel("What do you call this place?").fill(property.name);
  await page.getByLabel("Street address").fill(property.address);
  await page.getByLabel("Suburb or town").fill(property.suburb);
  if (property.postcode) await page.getByLabel("Postcode").fill(property.postcode);
  if (property.access) await page.getByLabel("How does a tradie get in?").fill(property.access);
  if (property.hazards) await page.getByLabel("Anything a tradie should know to stay safe?").fill(property.hazards);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL(/\/app\/properties\/[0-9a-f-]{36}\?added=1$/);
  await ready(page);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Signs in to the admin side with the password, as the founder does. */
export async function adminSignIn(page: Page) {
  await visit(page, `${BASE}/admin`);
  await page.getByLabel("Password").fill(E2E.adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/admin/queue`);
}

/**
 * Changes a market's stage (and, when given, the pre-launch tick) on Admin >
 * Markets and saves. Returns the message the screen shows.
 */
export async function saveMarket(page: Page, slug: string, change: { stage?: "waitlist" | "live" | "paused"; preLaunch?: boolean }): Promise<string> {
  await open(page, `/admin/markets/${slug}`);
  if (change.stage) await page.getByLabel("Stage", { exact: true }).selectOption(change.stage);
  if (change.preLaunch !== undefined) await page.getByRole("checkbox", { name: "Owners can set up their account and properties before launch" }).setChecked(change.preLaunch);
  await page.getByRole("button", { name: "Save settings" }).click();
  const done = shown(page, /Saved\. New prices apply to jobs logged from now on\./).first();
  await expect(done).toBeVisible();
  return (await done.innerText()).trim();
}

/** "3 owners · 7 properties" on the market's admin screen, as numbers. */
export async function setUpCount(page: Page, slug: string): Promise<{ owners: number; properties: number }> {
  await open(page, `/admin/markets/${slug}`);
  const words = (await page.locator("[data-set-up-count]").filter({ visible: true }).innerText()).trim();
  const found = /^(\d+) owners? · (\d+) propert(?:y|ies)$/.exec(words);
  if (!found) throw new Error(`The set-up count did not read as numbers: "${words}"`);
  return { owners: Number(found[1]), properties: Number(found[2]) };
}
