import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { markets } from "../config/markets";
import { areaForSuburb } from "../src/lib/markets/areas";
import { addProperty, adminSignIn, BASE, expectCalm, finishSignUp, open, OWNER_PAGES, ready, saveMarket, setUpCount, shown, startSignUp, watchForErrors, type NewProperty } from "./prelaunch-helpers";

/**
 * THE PRE-LAUNCH SOAK (DECISIONS.md, 2026-11-27, second entry).
 *
 * Many made-up owners, one after another, each different: names with macrons,
 * apostrophes and emoji, long names, every way a New Zealander writes a
 * mobile, mixed-case emails, one to four properties across the Queenstown and
 * Wānaka areas, typed one at a time or pasted as a list, with awkward input
 * mixed in (trailing spaces, very long address lines, the same property name
 * twice, an email or mobile somebody already used). Each owner must end up
 * with exactly the properties they added, every one "Opens soon", and must
 * never see an error page, a card form or a way to log a job. At the end the
 * team's own count must agree, Wānaka goes live, and each owner there gets
 * exactly one email.
 *
 * It is skipped unless SOAK is set, because it takes a while:
 *
 *   npx next build && SOAK=50 npx playwright test e2e/prelaunch-soak.spec.ts --trace off
 *
 * The same SOAK_SEED (default 20261127) makes the same owners every time.
 */

const COUNT = Number(process.env.SOAK ?? 0);
const SEED = Number(process.env.SOAK_SEED ?? 20261127);
const TALLY = path.join(__dirname, "..", ".data", "e2e", "prelaunch-soak-tally.json");

test.skip(!(COUNT > 0), "Set SOAK to the number of owners, for example SOAK=50.");

/** A small repeatable random number maker, so a failing owner can be made again. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "Mārama Te Whāiti", "Siobhán O'Connor", "Tāne Ngāwhika-Rāwiri", "D'Arcy O'Neill-Fitzgerald", "Ngaire Te Rangi-Kaihoro", "José Ñíguez", "Wei Lǐ",
  "Wolfeschlegelsteinhausenbergerdorff Montgomery-Featherstonehaugh the Third", "Zoë 🌿 Green", "Bo Xu", "  Padded Pete  ", "Hēmi Pōtatau", "Anne-Marie d'Entrecasteaux",
  "Kahurangi Whatuira-O'Sullivan", "Björn Ångström", "MARY-JANE WATSON", "rangi parata", "Te Aroha Ngā Hau e Whā Tūhoe-Pōtiki", "Ọlá Adébáyọ̀", "Dr. Priya Raghunathan-Venkataraman",
];
const PLACES = [
  "Lakeview Apartment", "Tāhuna Bach", "The Old Miner's Cottage", "Remarkables View 🏔️", "Unit 4B / 12", "Kōwhai Lodge & Spa", "Hāwea Hideaway", "Bob's Place", "Crib No. 9",
  "The Extremely Long Named Holiday House at the Very End of the Longest Road", "Ōtākou Whare", "Sunset \"Deluxe\" Studio", "Aroha ❤️ Nest", "Flat #2", "Château d'Été",
];
const STREETS = ["Lake Esplanade", "Gorge Road", "Kawarau Road", "Buckingham Street", "Ardmore Street", "Aubrey Road", "Capell Avenue", "Atley Road", "Peninsula Road", "Te Awa Road", "O'Connell's Lane", "Māori Point Road"];
const ACCESS = [
  "Lockbox by the front door, code 4821.", "Key under the 2nd pot. Don't let the cat out!", "Ring Mere on arrival.\nGate code: 1904#", "", "Side door <always> unlocked & alarm is OFF", "Code is \"7 7 7 1\"; park on the street",
];
const HAZARDS = ["", "", "Steep drive, park at the top.", "Friendly dog next door 🐕", "Older home: possible asbestos in the ceiling."];
const LONG_ADDRESS = "Flat 3, Level 2, The Old Post Office Building, behind the bakery and up the shared right-of-way past the three red letterboxes, 1487A Glenorchy-Queenstown Road extension";

/** The suburbs an owner might type, with odd spellings: no macrons, capitals, a stray space. Some match no area at all. */
function suburbsFor(slug: string): string[] {
  const market = markets.find((candidate) => candidate.slug === slug)!;
  const real = market.areas.flatMap((area) => area.suburbs);
  const odd = slug === "wanaka" ? ["wanaka", "ALBERT TOWN", "Hawea Flat", "lake hawea ", "Mt Barker"] : ["QUEENSTOWN", "arthur's point", "jacks point", "Lake Hayes Estate ", "Closeburn"];
  return [...real, ...odd];
}

/** Every way the same New Zealand mobile gets written. `digits` is seven digits after 02x. */
function writePhone(prefix: string, digits: string, style: number): string {
  const a = digits.slice(0, 3);
  const b = digits.slice(3);
  const short = prefix.slice(1); // 21, 22, 27
  return [`${prefix} ${a} ${b}`, `${prefix}${a}${b}`, `+64 ${short} ${a} ${b}`, `+64${short}${a}${b}`, `(${prefix}) ${a}-${b}`, `${prefix}-${a}-${b}`, `0064 ${short} ${a} ${b}`, ` ${prefix} ${a}${b} `][style % 8]!;
}

type SoakOwner = {
  index: number; name: string; email: string; prefix: string; digits: string; phoneStyle: number; phone: string; signUpMarket: string | null;
  properties: (NewProperty & { market: string; long: boolean })[]; paste: boolean; duplicate: "email" | "phone" | null; pin: boolean; cleaner: boolean;
};

/** Owner number `index`, the same every time for the same seed. */
function makeOwner(index: number): SoakOwner {
  const next = random(SEED * 1000 + index);
  const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)]!;
  const base = pick(NAMES);
  const where = pick(["queenstown", "queenstown", "wanaka", "wanaka", "both"]);
  const count = 1 + Math.floor(next() * 4);
  const run = String(SEED).slice(-4);
  const prefix = pick(["021", "022", "027"]);
  // Unique for this owner: the first digit is never 0 or 1, which some prefixes group differently.
  const digits = `${2 + (index % 8)}${String(100000 + ((index * 7919 + SEED) % 900000))}`;
  const phoneStyle = Math.floor(next() * 8);
  const properties: SoakOwner["properties"] = [];
  let lastName = "";
  for (let n = 0; n < count; n += 1) {
    const market = where === "both" ? (n % 2 === 0 ? "queenstown" : "wanaka") : where;
    const odd = Math.floor(next() * 8);
    // The same name twice on one account is allowed: two flats in one building often share one.
    const name = odd === 0 && lastName ? lastName : `${pick(PLACES)}${odd === 1 ? "  " : ""}`;
    lastName = name;
    properties.push({
      market, name, long: odd === 2,
      address: odd === 2 ? LONG_ADDRESS : `${1 + Math.floor(next() * 180)}${pick(["", "A", "B", "/2"])} ${pick(STREETS)}${odd === 3 ? "   " : ""}`,
      suburb: pick(suburbsFor(market)), postcode: pick(["9300", "9305", "", "9302", "9371 "]), access: pick(ACCESS), hazards: pick(HAZARDS),
    });
  }
  return {
    index, name: base, email: `Soak.${run}.Owner${index}@${pick(["Example.com", "EXAMPLE.CO.NZ", "example.org"])}`, prefix, digits, phoneStyle,
    phone: writePhone(prefix, digits, phoneStyle), signUpMarket: pick([where === "both" ? "queenstown" : where, where === "both" ? "wanaka" : where, null]),
    properties, paste: count >= 2 && next() < 0.4, duplicate: index % 7 === 3 ? "email" : index % 11 === 5 ? "phone" : null, pin: next() < 0.2, cleaner: next() < 0.25,
  };
}

type Tally = { owners: Record<string, { email: string; prefix: string; digits: string; markets: Record<string, number>; tooLongRefused?: number }> };
const readTally = (): Tally => (fs.existsSync(TALLY) ? (JSON.parse(fs.readFileSync(TALLY, "utf8")) as Tally) : { owners: {} });
function note(index: number, change: (owner: Tally["owners"][string]) => void, start?: { email: string; prefix: string; digits: string }) {
  const tally = readTally();
  if (start) tally.owners[String(index)] = { ...start, markets: {} };
  const owner = tally.owners[String(index)];
  if (owner) change(owner);
  fs.mkdirSync(path.dirname(TALLY), { recursive: true });
  fs.writeFileSync(TALLY, JSON.stringify(tally));
}

/** What the app keeps of a name or address: trimmed. The screen then shows runs of spaces as one. */
const kept = (value: string) => value.trim().replace(/\s+/g, " ");

async function alertText(page: Page): Promise<string> {
  const alert = page.locator('form [role="alert"]').filter({ visible: true }).first();
  await expect(alert).toBeVisible();
  return (await alert.innerText()).trim();
}

test.describe("pre-launch soak", () => {
  // The tally file sits with the site's own data, which the global setup empties before every run.

  for (let index = 0; index < COUNT; index += 1) {
    const owner = makeOwner(index);
    test(`owner ${index + 1} of ${COUNT}: ${owner.name.trim()}, ${owner.properties.length} ${owner.properties.length === 1 ? "property" : "properties"}${owner.paste ? " (pasted)" : ""}${owner.duplicate ? `, tries a used ${owner.duplicate} first` : ""}`, async ({ page, context }) => {
      test.setTimeout(240_000);
      await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${(index >> 8) & 255}.${(index & 255) + 1}` });
      const problems = watchForErrors(page);

      // ---- an email or mobile somebody already used: friendly words, no account
      const earlier = Object.values(readTally().owners)[0];
      if (owner.duplicate && earlier) {
        if (owner.duplicate === "email") {
          await startSignUp(page, { name: owner.name, email: earlier.email.toUpperCase(), phone: owner.phone, market: owner.signUpMarket });
          expect(await alertText(page)).toContain("That email address already has an account. Sign in instead.");
        } else {
          await startSignUp(page, { name: owner.name, email: owner.email, phone: writePhone(earlier.prefix, earlier.digits, owner.phoneStyle + 3), market: owner.signUpMarket });
          expect(await alertText(page)).toContain("That mobile number already has an account. Sign in instead.");
        }
        await expectCalm(page, "sign-up refused");
      }

      // ---- sign up with the emailed code
      await startSignUp(page, { name: owner.name, email: owner.email, phone: owner.phone, market: owner.signUpMarket });
      await finishSignUp(page);
      note(index, () => {}, { email: owner.email, prefix: owner.prefix, digits: owner.digits });
      await expectCalm(page, "add a property, first visit");

      // ---- add the properties: typed one at a time, or the first typed and the rest pasted
      const typed = owner.paste ? owner.properties.slice(0, 1) : owner.properties;
      const pasted = owner.paste ? owner.properties.slice(1) : [];
      const ids: string[] = [];
      for (const property of typed) {
        if (property.long) {
          // A very long address line and a very long name, sent past the boxes' own limits the way an autofill or a
          // script can: the site must answer in words, never with an error page, and save nothing.
          await open(page, `/app/properties/new?market=${property.market}`);
          for (const label of ["What do you call this place?", "Street address"]) await page.getByLabel(label).evaluate((input) => input.removeAttribute("maxlength"));
          await page.getByLabel("What do you call this place?").fill("An Absurdly Long Name For A Holiday Home ".repeat(3));
          await page.getByLabel("Street address").fill(property.address);
          await page.getByLabel("Suburb or town").fill(property.suburb);
          await page.getByRole("button", { name: "Save and continue" }).click();
          await expect(shown(page, /Keep the street address to 120 letters or fewer\./).first()).toBeVisible();
          await expect(shown(page, "Keep the name to 80 letters or fewer.").first()).toBeVisible();
          await expectCalm(page, "a too-long name and address");
          note(index, (record) => { record.tooLongRefused = (record.tooLongRefused ?? 0) + 1; });
          // Then typed the way a person does: the box stops at 120 letters, and that is what is kept.
          await open(page, `/app/properties/new?market=${property.market}`);
          await page.getByLabel("Street address").pressSequentially(property.address);
          const taken = await page.getByLabel("Street address").inputValue();
          expect(taken).toBe(property.address.slice(0, 120));
          property.address = taken;
          await page.getByLabel("What do you call this place?").fill(property.name);
          await page.getByLabel("Suburb or town").fill(property.suburb);
          await page.getByRole("button", { name: "Save and continue" }).click();
          await page.waitForURL(/\/app\/properties\/[0-9a-f-]{36}\?added=1$/);
          await ready(page);
          ids.push(new URL(page.url()).pathname.split("/").pop()!);
          note(index, (record) => { record.markets[property.market] = (record.markets[property.market] ?? 0) + 1; });
          const where = markets.find((market) => market.slug === property.market)!.name;
          await expect(shown(page, `Bookings open soon in ${where}. We'll email you the day we go live. You'll add a card then, and it's only charged when a job is done.`).first()).toBeVisible();
          await expectCalm(page, "the long-address property just added");
          continue;
        }
        const id = await addProperty(page, property.market, property);
        ids.push(id);
        note(index, (record) => { record.markets[property.market] = (record.markets[property.market] ?? 0) + 1; });
        const marketName = markets.find((market) => market.slug === property.market)!.name;
        await expect(shown(page, "You're set up").first()).toBeVisible();
        await expect(shown(page, `Bookings open soon in ${marketName}. We'll email you the day we go live. You'll add a card then, and it's only charged when a job is done.`).first()).toBeVisible();
        await expect(page.getByRole("heading", { name: kept(property.name), exact: true }).filter({ visible: true })).toBeVisible();
        await expectCalm(page, `property ${ids.length} just added`);
      }
      const byMarket = new Map<string, typeof pasted>();
      for (const property of pasted) byMarket.set(property.market, [...(byMarket.get(property.market) ?? []), property]);
      for (const [market, list] of byMarket) {
        await open(page, `/app/properties/import?market=${market}`);
        const cell = (value: string) => kept(value).replace(/\t/g, " ");
        await page.getByLabel("Paste your properties").fill(list.map((property) => [cell(property.name), cell(property.address).slice(0, 120), cell(property.suburb), cell(property.postcode ?? ""), cell(property.access ?? "")].join("\t")).join("\n"));
        for (const property of list) property.address = property.address.slice(0, 120);
        await page.getByRole("button", { name: `Save ${list.length} ${list.length === 1 ? "property" : "properties"}` }).click();
        await page.waitForURL(new RegExp(`/app/properties\\?imported=${list.length}$`));
        await ready(page);
        note(index, (record) => { record.markets[market] = (record.markets[market] ?? 0) + list.length; });
        await expect(shown(page, `${list.length} ${list.length === 1 ? "property" : "properties"} added`).first()).toBeVisible();
        await expectCalm(page, "the list after a paste");
      }

      // ---- the area was worked out from the suburb, however it was spelled
      const firstProperty = owner.properties[0]!;
      await open(page, `/app/properties/${ids[0]}?edit=1`);
      const expectedArea = areaForSuburb(markets.find((market) => market.slug === firstProperty.market)!.areas, firstProperty.suburb) ?? "";
      await expect(page.locator('select[name="area"]').filter({ visible: true })).toHaveValue(expectedArea);
      await expect(page.locator('input[name="addressLine1"]').filter({ visible: true })).toHaveValue(firstProperty.address.trim());
      await expectCalm(page, "the property, details open");

      // ---- some owners check the pin, some add a cleaner: both are only set-up
      if (owner.pin) {
        await context.grantPermissions(["geolocation"], { origin: BASE });
        await context.setGeolocation({ latitude: -45.03 + index / 10000, longitude: 168.66 });
        await page.getByRole("button", { name: "I'm at the property now" }).click();
        await expect(shown(page, "Pin moved. Save it below.").first()).toBeVisible();
        await page.getByRole("button", { name: "Yes, the pin is on the house" }).click();
        await page.waitForURL(/pinned=1/);
        await expectCalm(page, "the property after its pin");
      }
      if (owner.cleaner) {
        await open(page, "/app/team");
        await page.getByLabel("Their name").fill("Mele Tāufa-O'Brien");
        await page.getByLabel("Their mobile").fill(writePhone("029", `${3 + (index % 6)}${String(200000 + ((index * 104729) % 700000))}`, index));
        await page.getByRole("checkbox").first().check();
        await page.getByRole("button", { name: "Add and text them their link" }).click();
        await page.waitForURL(/\/app\/team\/[0-9a-f-]{36}\?added=1$/);
        await expectCalm(page, "the cleaner just added");
      }

      // ---- every owner screen: a real page, no card form, no way to log a job
      for (const pagePath of OWNER_PAGES) {
        await open(page, pagePath);
        await expectCalm(page, pagePath);
      }
      await open(page, "/app/jobs/new");
      await expect(shown(page, /Bookings open soon in/).first()).toBeVisible();
      await open(page, "/app/billing");
      await expect(shown(page, /No card is needed yet\./).first()).toBeVisible();

      // ---- the final state: exactly the properties added, each one "Opens soon"
      await open(page, "/app/properties");
      const rows = page.locator('a[href^="/app/properties/"]').filter({ visible: true }).filter({ hasText: /Opens soon/i });
      await expect(rows).toHaveCount(owner.properties.length);
      await expect(shown(page, "Not a member yet")).toHaveCount(0);
      await expect(page.getByText("Member", { exact: true }).filter({ visible: true })).toHaveCount(0);
      const titles = (await rows.locator("span.block.font-bold").allInnerTexts()).map((title) => kept(title)).sort();
      expect(titles).toEqual(owner.properties.map((property) => kept(property.name)).sort());

      expect(problems, "error replies or script errors").toEqual([]);
    });
  }

  test("the team's count agrees, Wānaka goes live, and each owner there gets exactly one email", async ({ page }) => {
    test.setTimeout(240_000);
    const owners = Object.values(readTally().owners);
    const expected = (slug: string) => ({
      owners: owners.filter((owner) => (owner.markets[slug] ?? 0) > 0).length,
      properties: owners.reduce((sum, owner) => sum + (owner.markets[slug] ?? 0), 0),
    });
    await adminSignIn(page);
    expect(await setUpCount(page, "queenstown"), "Queenstown, on the admin screen").toEqual(expected("queenstown"));
    expect(await setUpCount(page, "wanaka"), "Wānaka, on the admin screen").toEqual(expected("wanaka"));

    const done = await saveMarket(page, "wanaka", { stage: "live" });
    expect(done).toContain("This market is now live");
    // Saved again, then back to the waiting list and live once more: still one email each.
    await saveMarket(page, "wanaka", { stage: "live" });
    await saveMarket(page, "wanaka", { stage: "waitlist" });
    await saveMarket(page, "wanaka", { stage: "live" });
    await open(page, "/admin/messages");
    const sent = page.locator("li").filter({ hasText: "market live" }).filter({ hasText: "HostFix is live in Wānaka. Add your card to be covered" });
    const recipients = (await sent.locator("span.font-semibold").allInnerTexts()).map((line) => line.replace(/^Email to /, "").trim()).sort();
    const wanakaOwners = owners.filter((owner) => (owner.markets.wanaka ?? 0) > 0).map((owner) => owner.email.toLowerCase()).sort();
    // The log shows the last 300 messages. A bigger run than that is checked by count on the market's screen instead.
    if (owners.length <= 90) expect(recipients).toEqual(wanakaOwners);
    // Nobody was told Queenstown is live: it is not.
    await expect(page.locator("li").filter({ hasText: "HostFix is live in Queenstown" })).toHaveCount(0);
    await open(page, "/admin/markets/wanaka");
    await expect(shown(page, new RegExp(`${wanakaOwners.length} owners?`)).first()).toBeVisible();

    // Back to how production is today, for whatever runs next.
    await saveMarket(page, "wanaka", { stage: "waitlist", preLaunch: true });
    expect(await setUpCount(page, "wanaka")).toEqual(expected("wanaka"));

    // What this run covered, for whoever reads the log.
    const planned = Array.from({ length: COUNT }, (_, index) => makeOwner(index));
    const all = planned.flatMap((owner) => owner.properties);
    console.log(
      [
        `SOAK SUMMARY (seed ${SEED}): ${owners.length} of ${COUNT} owners signed up.`,
        `Properties saved: ${expected("queenstown").properties} in Queenstown (${expected("queenstown").owners} owners), ${expected("wanaka").properties} in Wānaka (${expected("wanaka").owners} owners).`,
        `Planned: ${all.length} properties; ${planned.filter((owner) => owner.paste).length} owners pasted a list; ${all.filter((property) => property.long).length} very long addresses (${owners.reduce((sum, owner) => sum + (owner.tooLongRefused ?? 0), 0)} refused in words when sent past the box's limit);`,
        `${planned.filter((owner) => owner.duplicate === "email").length} tried a used email and ${planned.filter((owner) => owner.duplicate === "phone").length} a used mobile first; ${planned.filter((owner) => owner.pin).length} set a map pin; ${planned.filter((owner) => owner.cleaner).length} added a cleaner;`,
        `mobile written ${new Set(planned.map((owner) => owner.phoneStyle)).size} different ways; ${new Set(planned.map((owner) => owner.name)).size} different names; ${all.filter((property) => property.name !== property.name.trim() || property.address !== property.address.trim()).length} with stray spaces;`,
        `${planned.filter((owner) => new Set(owner.properties.map((property) => kept(property.name))).size < owner.properties.length).length} owners used the same property name twice. Wānaka go-live emails: ${recipients.length} sent, one each.`,
      ].join("\n"),
    );
  });
});
