import { expect, type Page } from "@playwright/test";
import { E2E } from "../playwright.config";

let counter = 0;

/** A different, valid New Zealand mobile number every time. */
export function uniquePhone(): string {
  counter += 1;
  const tail = String((Date.now() + counter * 7919) % 10_000_000).padStart(7, "0");
  return `021 ${tail.slice(0, 3)} ${tail.slice(3)}`;
}

/** A different pretend visitor address every time, so rate limits never mix tests up. */
export function uniqueIp(): string {
  counter += 1;
  return `10.${(counter >> 8) & 255}.${counter & 255}.${Math.floor(Math.random() * 250) + 1}`;
}

/** The form ignores anything sent faster than a person could type it. Wait like a person. */
export async function waitLikeAPerson(page: Page) {
  await page.waitForTimeout(1700);
}

export type OwnerDetails = { name: string; phone: string; email: string; properties: string; managedBy: string; location: string };

export function ownerDetails(overrides: Partial<OwnerDetails> = {}): OwnerDetails {
  const phone = uniquePhone();
  return {
    name: `Olive Owner ${phone.slice(-4)}`,
    phone,
    email: `olive.${phone.replace(/\D/g, "")}@example.com`,
    properties: "2",
    managedBy: "property_manager",
    location: "Auckland",
    ...overrides,
  };
}

export async function fillOwnerForm(page: Page, details: OwnerDetails) {
  await page.getByLabel("Your name").fill(details.name);
  await page.getByLabel("Mobile number").fill(details.phone);
  await page.getByLabel("Email").fill(details.email);
  await page.getByLabel(/How many properties/).fill(details.properties);
  await page.getByLabel("Who looks after them now?").selectOption(details.managedBy);
  await page.getByLabel("Where do you live?").fill(details.location);
}

/**
 * The owner form's price list button. With card payments connected the form has two buttons and this
 * is the second ("Not yet: just send me the price list"). Without, it is the only one.
 */
export function priceListButton(page: Page) {
  return page.getByRole("button", { name: /send me the price list/i });
}

/** Fills in the owner form and asks for the price list. Ends on the thank-you page. */
export async function submitOwnerLead(page: Page, base: string, details: OwnerDetails, query = "") {
  await page.goto(`${base}/owners${query}`);
  await fillOwnerForm(page, details);
  await waitLikeAPerson(page);
  await priceListButton(page).click();
  await expect(page).toHaveURL(`${base}/owners/thanks`);
  await expect(page.getByRole("heading", { name: "You're on the list." })).toBeVisible();
}

export async function signIn(page: Page, base: string = E2E.plainUrl) {
  await page.goto(`${base}/admin`);
  await page.getByLabel("Password").fill(E2E.adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // The team lands on the queue. The leads are one tap away.
  await expect(page).toHaveURL(`${base}/admin/queue`);
  await page.goto(`${base}/admin/leads`);
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
}

/** The card for one lead on the phone-sized leads list. */
export function leadCard(page: Page, name: string) {
  return page.locator("li[data-lead-id]").filter({ hasText: name });
}

/**
 * The message box at the top of a form. Next.js has its own invisible element
 * with the same role, and keeps the page you came from in the background, so
 * only the visible one inside a form counts.
 */
export function formAlert(page: Page) {
  return page.locator('form [role="alert"]').filter({ visible: true });
}
