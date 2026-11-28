import { expect, test } from "@playwright/test";
import { fillOwnerForm, ownerDetails, priceListButton, uniqueIp, waitLikeAPerson } from "./helpers";
import { addProperty, adminSignIn, BASE, expectCalm, finishSignUp, open, OWNER_PAGES, ready, saveMarket, settled, setUpCount, shown, startSignUp, visit, watchForErrors } from "./prelaunch-helpers";

/**
 * PRE-LAUNCH, END TO END, in a real browser at phone size (DECISIONS.md,
 * 2026-11-27, second entry).
 *
 * This copy of the site starts the way production does: Queenstown on the
 * waiting list with pre-launch on, nothing connected, no sample business. An
 * owner signs up with the code emailed to them (shown on screen here, as no
 * email service is connected), adds properties, and finds no card form and no
 * error anywhere. Then the team opens the market, and the same owner is at the
 * normal add-a-card step.
 *
 * Everything names Queenstown outright, so the tests do not care what the
 * soak run (e2e/prelaunch-soak.spec.ts) left behind in Wānaka.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
});

const stamp = String(Date.now()).slice(-7);
const NINA = { name: "Nina Ngāwhare-O'Connor", email: `Nina.Early.${stamp}@Example.com`, phone: `021 ${stamp.slice(0, 3)} ${stamp.slice(3)}`, market: "queenstown" };
const WORDS = "We'll email you the day we go live. You'll add a card then, and it's only charged when a job is done.";

test("the sign-up page and the lead thank-you page invite owners to set up before launch", async ({ page }) => {
  await open(page, "/sign-up?market=queenstown");
  await expect(shown(page, /Set up your account and properties now, so you.re ready on day one in Queenstown\./).first()).toBeVisible();
  await expect(shown(page, "Free, and no card needed yet").first()).toBeVisible();
  await expect(shown(page, /Add your properties and we.ll email you the day they open\. You add a card then, and it.s only charged when a job is done\./).first()).toBeVisible();

  // An owner who only asked for the price list is shown one line and one link to set up now.
  // This is the first visit to the page on a site that has only just started, so wait for the form to finish
  // starting up before typing into it (as e2e/leads.spec.ts does for its quick robot).
  await visit(page, `${BASE}/owners`);
  await expect(page.locator('input[name="startedAt"]').last()).not.toHaveValue("");
  await fillOwnerForm(page, ownerDetails());
  await waitLikeAPerson(page);
  await priceListButton(page).click();
  await expect(page).toHaveURL(`${BASE}/owners/thanks`);
  await expect(page.getByRole("heading", { name: "You're on the list." })).toBeVisible();
  await expect(shown(page, "Want to be ready on day one?").first()).toBeVisible();
  await page.getByRole("link", { name: "Set up your account and properties now." }).click();
  await page.waitForURL(/\/sign-up\?market=queenstown$/);
  // The form she came from is still in the page, hidden (AGENTS.md): look at the one on screen.
  await expect(page.getByLabel("Your name").filter({ visible: true })).toBeVisible();
  await expect(shown(page, "Free, and no card needed yet").first()).toBeVisible();
});

test("the team switches set-up off and on again with one tick", async ({ page, browser }) => {
  await adminSignIn(page);
  await open(page, "/admin/markets/queenstown");
  const tick = page.getByRole("checkbox", { name: "Owners can set up their account and properties before launch" });
  await expect(tick).toBeChecked();
  await expect(shown(page, "waitlist · owners setting up").first()).toBeVisible();

  await saveMarket(page, "queenstown", { preLaunch: false });
  // With the box unticked the thank-you page no longer offers it.
  const visitor = await browser.newPage();
  await visitor.goto(`${BASE}/owners/thanks`);
  await expect(visitor.getByRole("heading", { name: "You're on the list." })).toBeVisible();
  await expect(visitor.getByText(/in touch before HostFix opens in Queenstown/)).toBeVisible();
  await expect(visitor.getByText("Want to be ready on day one?")).toHaveCount(0);
  await visitor.close();
  await open(page, "/admin/markets/queenstown");
  await expect(shown(page, /Owners cannot set up here yet\./).first()).toBeVisible();

  await saveMarket(page, "queenstown", { preLaunch: true });
  await open(page, "/admin/markets/queenstown");
  await expect(tick).toBeChecked();
  await expect(shown(page, /None has a card on file, and none can book a job, until you change the stage to Live\./).first()).toBeVisible();
});

test("an owner signs up before launch, sets everything up, and never meets a card form or an error", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const problems = watchForErrors(page);
  const admin = await browser.newPage();
  await adminSignIn(admin);
  const before = await setUpCount(admin, "queenstown");

  // Signing up, with the code emailed to her. A wrong code is refused.
  await startSignUp(page, NINA);
  await page.waitForURL(/sign-in\/code/);
  await ready(page);
  await page.getByLabel("Six-digit code").fill("000000");
  await page.getByRole("button", { name: "Create my account" }).click();
  const refused = page.locator('form [role="alert"]').filter({ visible: true }).first();
  // One time in a million the real code is 000000 and she is simply let in.
  if (!page.url().includes("/app/properties/new")) await expect(refused).toContainText("That code is not right.");
  await finishSignUp(page);
  expect(page.url()).toContain("market=queenstown");

  // Add a property: the form says no card is needed, and saving it never leads to a card page.
  await expect(shown(page, "Bookings open soon in Queenstown").first()).toBeVisible();
  await expect(shown(page, /Nothing is charged now, and no card is needed yet\./).first()).toBeVisible();
  const first = await addProperty(page, "queenstown", {
    name: "Gorge Road Flat", address: "120 Gorge Road", suburb: "Queenstown", postcode: "9300", access: "Lockbox by the meter box, code 1357.", hazards: "Steep steps at the back.",
  });
  await expect(shown(page, "You're set up").first()).toBeVisible();
  await expect(shown(page, `Bookings open soon in Queenstown. ${WORDS}`).first()).toBeVisible();
  await expect(shown(page, "Opens soon").first()).toBeVisible();
  await expectCalm(page, "the new property");
  // Set-up is open: the map pin, the QR card, the team, her own tradie.
  await expect(shown(page, "Check where the house is").first()).toBeVisible();
  await expect(shown(page, "Get ready for day one").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Print the QR card" }).filter({ visible: true })).toBeVisible();
  await expect(shown(page, "Bring your own tradie").first()).toBeVisible();

  // The map pin, from her phone at the house.
  await page.context().grantPermissions(["geolocation"], { origin: BASE });
  await page.context().setGeolocation({ latitude: -45.0272, longitude: 168.6489 });
  await page.getByRole("button", { name: "I'm at the property now" }).click();
  await expect(shown(page, "Pin moved. Save it below.").first()).toBeVisible();
  await page.getByRole("button", { name: "Yes, the pin is on the house" }).click();
  await page.waitForURL(/pinned=1/);
  await ready(page);
  await expect(shown(page, "Pin saved").first()).toBeVisible();
  await expectCalm(page, "the property after its pin");

  // Two more from a pasted spreadsheet.
  await open(page, "/app/properties/import?market=queenstown");
  await expect(shown(page, /no card is needed yet\. We'll email you the day bookings open in Queenstown/).first()).toBeVisible();
  await page.getByLabel("Paste your properties").fill(["Kawarau Flat\t3 Kawarau Road\tFrankton\t9300\tKey safe 1122", "Arrow Cottage, 8 Buckingham Street, Arrowtown, 9302, Ring first"].join("\n"));
  await page.getByRole("button", { name: "Save 2 properties" }).click();
  await page.waitForURL(/\/app\/properties\?imported=2$/);
  await ready(page);
  await expect(shown(page, "2 properties added").first()).toBeVisible();
  await expect(shown(page, `You're set up. Bookings open soon in Queenstown. ${WORDS}`).first()).toBeVisible();
  await expect(shown(page, "Opens soon")).toHaveCount(3);
  await expectCalm(page, "the list after a paste");

  // Every owner screen: a real page, calm, no card form, no way to log a job.
  for (const path of OWNER_PAGES) {
    await open(page, path);
    await expectCalm(page, path);
  }
  await open(page, "/app");
  await expect(shown(page, "Bookings open soon in Queenstown").first()).toBeVisible();
  await expect(shown(page, `You’re set up. ${WORDS}`).first()).toBeVisible();
  await open(page, "/app/jobs/new");
  await expect(shown(page, "Bookings open soon in Queenstown").first()).toBeVisible();
  await expect(shown(page, /Jobs can be booked from the day we go live\./).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Plumbing/ })).toHaveCount(0);
  await open(page, "/app/billing");
  await expect(shown(page, /No card is needed yet\. Bookings open soon in Queenstown\./).first()).toBeVisible();
  await expect(shown(page, "Opens soon: you can add one from the day bookings open.").first()).toBeVisible();
  await open(page, "/app/billing/bank");
  await expect(shown(page, /You can add your bank account from the day we go live\./).first()).toBeVisible();

  // Her cleaner is added now. The cleaner's link, once her phone is checked, says we are not open yet.
  await open(page, "/app/team");
  await page.getByLabel("Their name").fill("Kiri");
  await page.getByLabel("Their mobile").fill(`022 ${stamp.slice(0, 3)} ${stamp.slice(3)}`);
  await page.getByRole("checkbox", { name: /Gorge Road Flat/ }).check();
  await page.getByRole("button", { name: "Add and text them their link" }).click();
  await page.waitForURL(/\/app\/team\/[0-9a-f-]{36}\?added=1$/);
  await ready(page);
  const teamLink = new URL((await page.locator("[data-team-link]").filter({ visible: true }).innerText()).trim()).pathname;
  const cleaner = await browser.newPage();
  const cleanerProblems = watchForErrors(cleaner);
  await visit(cleaner, `${BASE}${teamLink}`);
  await cleaner.getByRole("button", { name: "Text me the code" }).click();
  await cleaner.waitForURL(/\?code=1$/);
  await ready(cleaner);
  await settled(cleaner);
  await cleaner.getByLabel("Six-digit code").fill((await cleaner.locator("[data-demo-code]").innerText()).trim());
  await cleaner.getByRole("button", { name: "Open my houses" }).click();
  await expect(cleaner.getByRole("heading", { name: "HostFix isn't open in Queenstown yet" })).toBeVisible();
  await expect(cleaner.getByText("Gorge Road Flat")).toHaveCount(0);
  await expect(cleaner.getByRole("button", { name: /Send/ })).toHaveCount(0);

  // The guest QR card can be printed. Scanning it says the same, with no form.
  await open(page, `/app/properties/${first}/card`);
  await expect(shown(page, /You can print the card now\./).first()).toBeVisible();
  const guestLink = `http://${(await page.locator(".qr-card p.break-all").filter({ visible: true }).innerText()).trim()}`;
  await cleaner.goto(guestLink);
  await expect(cleaner.getByRole("heading", { name: "HostFix isn't open in Queenstown yet" })).toBeVisible();
  await expect(cleaner.getByText(/please contact your host directly/)).toBeVisible();
  await expect(cleaner.getByLabel("Your name")).toHaveCount(0);

  // The team sees her on the market's screen: one more owner, three more properties.
  const after = await setUpCount(admin, "queenstown");
  expect(after).toEqual({ owners: before.owners + 1, properties: before.properties + 3 });

  // A second account with her email (in other letters) or her mobile is refused in friendly words.
  const other = await browser.newPage();
  await other.context().setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await startSignUp(other, { ...NINA, name: "Someone Else", email: NINA.email.toUpperCase(), phone: "021 999 0001" });
  await expect(other.locator('form [role="alert"]').filter({ visible: true }).first()).toContainText("That email address already has an account. Sign in instead.");
  await startSignUp(other, { ...NINA, name: "Someone Else", email: `fresh.${stamp}@example.com`, phone: `+64 21 ${stamp.slice(0, 3)} ${stamp.slice(3)}` });
  await expect(other.locator('form [role="alert"]').filter({ visible: true }).first()).toContainText("That mobile number already has an account. Sign in instead.");
  await other.close();

  // ------------------------------------------------------------------ the market goes live
  const saved = await saveMarket(admin, "queenstown", { stage: "live" });
  expect(saved).toContain("This market is now live: every owner who set up before launch has been emailed to add their card.");
  // Saved a second time by mistake: nobody is emailed twice.
  await saveMarket(admin, "queenstown", { stage: "live" });
  await open(admin, "/admin/messages");
  const toNina = admin.locator("li").filter({ hasText: `Email to ${NINA.email.toLowerCase()}` }).filter({ hasText: "market live" });
  await expect(toNina).toHaveCount(1);
  await expect(toNina).toContainText("HostFix is live in Queenstown. Add your card to be covered");
  await expect(toNina).toContainText("Your 3 properties are set up and ready.");
  await open(admin, "/admin/markets/queenstown");
  await expect(shown(admin, /already set up\./).first()).toBeVisible();

  // Nina reloads: the normal add-a-card step, and only now.
  await open(page, "/app");
  await expect(shown(page, "Gorge Road Flat is not covered yet").first()).toBeVisible();
  await expect(shown(page, "Bookings open soon in Queenstown")).toHaveCount(0);
  await open(page, "/app/jobs/new");
  await expect(shown(page, "Add a card to cover your property first").first()).toBeVisible();
  await open(page, `/app/properties/${first}`);
  await expect(shown(page, /Free to join\. You add a card on the next page and nothing is charged today\./).first()).toBeVisible();
  await page.getByRole("button", { name: "Add a card" }).click();
  await page.waitForURL(/demo\/checkout/);
  await ready(page);
  await expect(page.getByRole("heading", { name: "Add a card" })).toBeVisible();
  await expect(shown(page, "NZ$0").first()).toBeVisible();
  await page.getByRole("button", { name: "Save card" }).click();
  await page.waitForURL(/member=1/);
  await ready(page);
  await expect(shown(page, "You are covered").first()).toBeVisible();

  // The same QR card and the same cleaner's link now open onto the real thing.
  await cleaner.goto(guestLink);
  await expect(cleaner.getByRole("heading", { name: "Something not working?" })).toBeVisible();
  await cleaner.goto(`${BASE}${teamLink}`);
  await expect(cleaner.getByRole("heading", { name: "Report a problem" })).toBeVisible();
  await expect(cleaner.getByText("Gorge Road Flat").first()).toBeVisible();
  await cleaner.close();
  await admin.close();

  expect(problems, "error replies or script errors on the owner's pages").toEqual([]);
  expect(cleanerProblems, "error replies or script errors on the cleaner's and guest's pages").toEqual([]);
});

test("with one area live and another not open yet, she keeps her card and sets up the new place without one", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = watchForErrors(page);
  // Nina signs in again on a new phone, with a code to her mobile this time.
  await open(page, "/sign-in");
  await page.getByLabel("Email or mobile number").fill(NINA.phone);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.waitForURL(/sign-in\/code/);
  await ready(page);
  await page.getByLabel("Six-digit code").fill((await page.locator("[data-demo-code]").innerText()).trim());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app$/);
  await ready(page);

  // Wānaka is still on the waiting list with pre-launch on. Adding a property there asks for no card,
  // even though hers is on file for Queenstown.
  await open(page, "/app/properties/new?market=wanaka");
  await expect(shown(page, "Bookings open soon in Wānaka").first()).toBeVisible();
  const cottage = await addProperty(page, "wanaka", { name: "Albert Town Cottage", address: "5 Gunn Road", suburb: "albert town", access: "Key safe 2468." });
  await expect(shown(page, "You're set up").first()).toBeVisible();
  await expect(shown(page, `Bookings open soon in Wānaka. ${WORDS}`).first()).toBeVisible();
  await expectCalm(page, "the Wānaka property");

  // Home: Wānaka opens soon, the Queenstown ones are as they were, and nothing calls the new one "not covered".
  await open(page, "/app");
  await expect(shown(page, "Bookings open soon in Wānaka").first()).toBeVisible();
  await expect(shown(page, "Albert Town Cottage is not covered yet")).toHaveCount(0);
  await expect(shown(page, "Kawarau Flat is not covered yet").first()).toBeVisible();

  // Billing: her card is there and can still be changed, because Queenstown is open.
  await open(page, "/app/billing");
  await expect(shown(page, "Visa").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Change card" }).filter({ visible: true })).toBeVisible();
  await expect(shown(page, /No card is needed yet\./)).toHaveCount(0);

  // A job can be reported at the covered Queenstown flat, and only there.
  await open(page, "/app/jobs/new");
  await expect(shown(page, /At Gorge Road Flat/).first()).toBeVisible();
  await expect(shown(page, "Albert Town Cottage")).toHaveCount(0);

  // The Wānaka property itself: still no card button, whatever is on file.
  await open(page, `/app/properties/${cottage}`);
  await expect(shown(page, "Opens soon").first()).toBeVisible();
  await expectCalm(page, "the Wānaka property, later");
  expect(problems, "error replies or script errors").toEqual([]);
});
