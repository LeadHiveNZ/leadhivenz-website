import { chromium, type Frame, type Page } from "playwright";

/**
 * STRIPE'S OWN PAGES, FILLED IN BY A REAL (HEADLESS) BROWSER.
 * Used only by stripe-live.test.ts, which runs only when asked (LIVE_STRIPE_RUN=1) and only against Stripe's
 * test area. The owner's "save your card" and "add your bank account" pages are Stripe's, not ours, so the
 * only honest way to test them is to open them and type into them as an owner would.
 *
 * Stripe draws the form inside a frame of its own (js.stripe.com "elements-inner"), and the field names
 * below are Stripe's (read from the page, 27 Nov 2026). If Stripe renames them this helper says which
 * field it could not find, rather than the test failing somewhere unrelated.
 */

export type PageResult = {
  /** The payment choices Stripe's page offered, as shown ("Card", "NZ Direct Debit"). */
  offered: string[];
  /** Where Stripe sent the browser afterwards (our success address, with the session id). */
  returnedTo: string;
};

async function formFrame(page: Page): Promise<Frame> {
  for (let i = 0; i < 80; i += 1) {
    const frame = page.frames().find((candidate) => /js\.stripe\.com\/v3\/elements-inner-(?!payment-api)/.test(candidate.url()) && !/google-pay|link-modal/.test(candidate.url()));
    if (frame && (await frame.locator("button[type=submit]").count().catch(() => 0)) > 0) return frame;
    await page.waitForTimeout(500);
  }
  throw new Error("Stripe's page did not show its form within 40 seconds.");
}

async function offeredChoices(frame: Frame): Promise<string[]> {
  const text = (await frame.locator("body").innerText()).replace(/\s+/g, " ");
  return ["Card", "NZ Direct Debit", "Afterpay", "Klarna"].filter((choice) => text.includes(choice));
}

async function open(url: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const page = await browser.newPage({ viewport: { width: 420, height: 1200 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  return { page, close: () => browser.close() };
}

async function finish(page: Page, frame: Frame, returnPrefix: string): Promise<string> {
  await frame.locator("button[type=submit]").click();
  try {
    await page.waitForURL((address) => address.toString().startsWith(returnPrefix), { timeout: 60_000, waitUntil: "commit" });
  } catch {
    const words = (await frame.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
    throw new Error(`Stripe's page did not send the browser back. It was showing: ${words}`);
  }
  return page.url();
}

/** Saves a card on Stripe's "save your card" page. `returnPrefix` is the start of our success address. */
export async function saveCardOnStripePage(url: string, returnPrefix: string, card: { number: string; name: string }): Promise<PageResult> {
  const { page, close } = await open(url);
  try {
    const frame = await formFrame(page);
    const offered = await offeredChoices(frame);
    // With more than one choice Stripe shows a list to pick from; with only cards, the card fields are already there.
    if ((await frame.locator("#payment-numberInput").count()) === 0) await frame.getByText("Card", { exact: true }).first().click();
    await frame.locator("#payment-numberInput").fill(card.number);
    await frame.locator("#payment-expiryInput").fill("12 / 34");
    await frame.locator("#payment-cvcInput").fill("123");
    if ((await frame.locator("#payment-nameInput").count()) > 0) await frame.locator("#payment-nameInput").fill(card.name);
    if ((await frame.locator("#payment-countryInput").count()) > 0) await frame.locator("#payment-countryInput").selectOption("NZ");
    // "Save my details with Link" would ask for a mobile number: leave it off, as most owners will.
    const link = frame.locator("#payment-linkOptInInput");
    if ((await link.count()) > 0 && (await link.isChecked())) await link.uncheck();
    return { offered, returnedTo: await finish(page, frame, returnPrefix) };
  } finally {
    await close();
  }
}

/** Adds a NZ bank account on Stripe's "add your bank account" page and agrees to the direct debit. */
export async function saveBankOnStripePage(
  url: string, returnPrefix: string, account: { name: string; email: string; bank: string; branch: string; account: string; suffix: string },
): Promise<PageResult & { fieldsSeen: string[] }> {
  const { page, close } = await open(url);
  try {
    const frame = await formFrame(page);
    const offered = await offeredChoices(frame);
    const visible = () =>
      frame.$$eval("input,select", (elements) => elements.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => `${e.id || (e as HTMLInputElement).name}`));
    if (!(await visible()).some((id) => /bank|account|branch/i.test(id))) await frame.getByText("NZ Direct Debit", { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const fieldsSeen = await visible();
    const fill = async (pattern: RegExp, value: string) => {
      const id = fieldsSeen.find((candidate) => pattern.test(candidate));
      if (!id) return false;
      await frame.locator(`[id="${id}"], [name="${id}"]`).first().fill(value);
      return true;
    };
    await fill(/name/i, account.name);
    await fill(/email/i, account.email).catch(() => false);
    const split = (await fill(/bankCode|bank(?!.*account)/i, account.bank)) && (await fill(/branch/i, account.branch));
    if (split) {
      await fill(/accountNumber|account(?!.*holder)/i, account.account);
      await fill(/suffix/i, account.suffix);
    } else {
      await fill(/account/i, `${account.bank}-${account.branch}-${account.account}-${account.suffix}`);
    }
    return { offered, fieldsSeen, returnedTo: await finish(page, frame, returnPrefix) };
  } finally {
    await close();
  }
}

/**
 * Opens Stripe's card or bank page and reports what it offers and asks for, without sending it. Used where the
 * page cannot be sent from the test machine (a network that supplies the secret key itself also supplies it to the
 * page's own calls, which Stripe then refuses).
 */
export async function inspectStripeFormPage(url: string): Promise<{ offered: string[]; fields: string[]; words: string }> {
  const { page, close } = await open(url);
  try {
    const frame = await formFrame(page);
    await page.waitForTimeout(1500);
    const fields = await frame.$$eval("input,select", (elements) => elements.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => `${e.id || (e as HTMLInputElement).name}`).filter(Boolean));
    return { offered: await offeredChoices(frame), fields, words: (await frame.locator("body").innerText()).replace(/\s+/g, " ") };
  } finally {
    await close();
  }
}

/** Opens one of Stripe's pages and says what its heading area reads, to show the link works. */
export async function readStripePage(url: string): Promise<{ status: number | null; address: string; words: string }> {
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 1200 } });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(6000);
    const texts = await Promise.all(page.frames().map((frame) => frame.locator("body").innerText({ timeout: 2000 }).catch(() => "")));
    return { status: response?.status() ?? null, address: page.url(), words: texts.join(" ").replace(/\s+/g, " ").slice(0, 600) };
  } finally {
    await browser.close();
  }
}
