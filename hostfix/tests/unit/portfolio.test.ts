import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import { marketNumbers } from "@/lib/admin/metrics";
import { chargeJob, markMissedWindows } from "@/lib/billing/settle";
import { ownerStatement } from "@/lib/billing/statements";
import { addHours, addMinutes, setTestNow } from "@/lib/clock";
import { acceptOffer } from "@/lib/dispatch/cascade";
import { completeJob, markArrived, markEnRoute } from "@/lib/jobs/work";
import { AdminInputError, saveTier, type TierInput } from "@/lib/markets/admin";
import { bandFor, bandProblem, minimumProperties } from "@/lib/markets/bands";
import { getMarket, listTiers } from "@/lib/markets/store";
import { completeDemoCheckout, createDemoGateway } from "@/lib/payments/demo-gateway";
import type { PaymentsGateway } from "@/lib/payments/gateway";
import { activatePortfolio, countPortfolioProperties, getPortfolio, rebandPortfolio, setAgreedRetainer, startPortfolio } from "@/lib/properties/portfolio";
import { endMembership, getProperty, recordMembershipPaymentFailed, recordRenewal, requestCancel } from "@/lib/properties/service";
import { testDb } from "./db";
import { gatewayFor, liveMarket, logJob, makeOwner, makePortfolio, makeProperty, makeTradie, MONDAY_10AM, offersFor, photo, textsTo } from "./factory";

/**
 * PORTFOLIO (DECISIONS.md, 2026-11-17).
 *
 * THE NUMBERS THESE TESTS ARE BUILT ON, from the decision, worked out by hand:
 *
 *   Portfolio, one retainer per account, per month:
 *     10-24 properties   60000  (NZ$600)
 *     25-49 properties   90000  (NZ$900)
 *     50-99 properties  120000  (NZ$1,200)
 *     100 and more       by arrangement: the app never sets it
 *   Essential, per property, per month: 0 (free to join, DECISIONS.md 2026-11-17)
 *   A paid per-property tier, where a test needs one: 9900 (NZ$99), the price Essential had before
 *   PL-01 from seed/menu-queenstown.json: owner 22500, tradie 19000, we keep 3500 (15% of the job, rounded
 *   by the menu to the nearest NZ$5). The same in both tiers.
 */

const t = testDb();
beforeEach(() => setTestNow(MONDAY_10AM));
afterEach(() => setTestNow(null));

const PORTFOLIO = launchMarket.tiers.find((tier) => tier.key === "portfolio")!;

/** The demo gateway, with every band change it is asked for written down. */
function watchedGateway() {
  const base = createDemoGateway(t.db, "NZ");
  const priceChanges: { subscriptionId: string; cents: number; key: string }[] = [];
  const gateway: PaymentsGateway = {
    ...base,
    changeMembershipPrice: async (input) => {
      priceChanges.push({ subscriptionId: input.subscriptionId, cents: input.tier.priceCents, key: input.idempotencyKey });
      await base.changeMembershipPrice(input);
    },
  };
  return { gateway, priceChanges };
}

const bandAudits = async (portfolioId: string) =>
  (await t.db.query<{ amount: number; detail: { from_cents: number; to_cents: number; properties: number } }>(
    "select amount, detail from public.audit_log where entity_id = $1 and action = 'portfolio.band_changed' order by id",
    [portfolioId],
  )).map((row) => [Number(row.detail.from_cents), Number(row.detail.to_cents), Number(row.detail.properties)]);

const openBandExceptions = async () =>
  (await t.db.query<{ summary: string }>("select summary from public.exceptions where kind = 'portfolio_band' and status = 'open' order by created_at")).map((row) => row.summary);

describe("the band for a number of properties", () => {
  it("follows the decision on every boundary", () => {
    // Below the smallest band there is no Portfolio price: the minimum is 10.
    expect(minimumProperties(PORTFOLIO)).toBe(10);
    expect(bandFor(PORTFOLIO, 9)).toBeNull();
    expect(bandFor(PORTFOLIO, 10)).toEqual({ cents: 60000, label: "10 to 24 properties" });
    expect(bandFor(PORTFOLIO, 24)).toEqual({ cents: 60000, label: "10 to 24 properties" });
    expect(bandFor(PORTFOLIO, 25)).toEqual({ cents: 90000, label: "25 to 49 properties" });
    expect(bandFor(PORTFOLIO, 49)).toEqual({ cents: 90000, label: "25 to 49 properties" });
    expect(bandFor(PORTFOLIO, 50)).toEqual({ cents: 120000, label: "50 to 99 properties" });
    expect(bandFor(PORTFOLIO, 99)).toEqual({ cents: 120000, label: "50 to 99 properties" });
    // 100 and more is by arrangement: no price the app may charge by itself.
    expect(bandFor(PORTFOLIO, 100)).toBeNull();
    expect(bandFor(PORTFOLIO, 400)).toBeNull();
  });

  it("is the price times the count for a per-property membership", () => {
    const essential = launchMarket.tiers.find((tier) => tier.key === "essential")!;
    // Essential is free: 3 properties at 0 each is 0.
    expect(bandFor(essential, 3)).toEqual({ cents: 0, label: "3 properties" });
    expect(minimumProperties(essential)).toBe(1);
    // A paid per-property tier: 3 properties at NZ$99 each, 3 x 9900 = 29700.
    expect(bandFor({ ...essential, monthlyPriceCents: 9900 }, 3)).toEqual({ cents: 29700, label: "3 properties" });
  });

  it("must be lowest first, with no gaps or overlaps, and only the top band open or by arrangement", () => {
    expect(bandProblem(PORTFOLIO.bands)).toBeNull();
    expect(bandProblem([])).toBe("Add at least one band.");
    expect(bandProblem([{ from: 10, to: 24, cents: 60000 }, { from: 26, to: null, cents: 90000 }])).toBe(
      "There is a gap between band 1 and band 2. Band 2 should start at 25.",
    );
    expect(bandProblem([{ from: 10, to: 24, cents: 60000 }, { from: 20, to: null, cents: 90000 }])).toBe("Band 2 overlaps the band before it. It should start at 25.");
    expect(bandProblem([{ from: 10, to: null, cents: 60000 }, { from: 25, to: null, cents: 90000 }])).toBe('Band 1: only the top band can be left open ("and up").');
    expect(bandProblem([{ from: 10, to: 24, cents: null }, { from: 25, to: null, cents: 90000 }])).toBe('Band 1: only the top band can be "by arrangement". Give this one a price.');
    expect(bandProblem([{ from: 10, to: null, cents: null }])).toBe("The lowest band needs a price.");
    expect(bandProblem([{ from: 10, to: 5, cents: 60000 }])).toBe('Band 1: "to" must be a whole number, no smaller than "from".');
  });
});

describe("the admin's tier editor", () => {
  const base: TierInput = {
    id: null, key: "managers", name: "Managers", priceCents: 1, responseHours: 24, urgentResponseHours: 4, urgentIncluded: false,
    urgentIncludedPerMonth: null, quarterlyCheck: false, blurb: "", active: false, billingBasis: "per_account",
  };

  it("saves a retainer with its bands, priced from the lowest band", async () => {
    await saveTier(t.db, "queenstown", { ...base, bands: [{ from: 5, to: 9, cents: 30000 }, { from: 10, to: null, cents: null }] }, "test");
    const saved = (await listTiers(t.db, "queenstown")).find((tier) => tier.key === "managers")!;
    expect(saved).toMatchObject({ billingBasis: "per_account", monthlyPriceCents: 30000, bands: [{ from: 5, to: 9, cents: 30000 }, { from: 10, to: null, cents: null }] });
  });

  it("refuses bands with a gap, and saves nothing", async () => {
    await expect(saveTier(t.db, "queenstown", { ...base, bands: [{ from: 10, to: 20, cents: 60000 }, { from: 30, to: null, cents: null }] }, "test")).rejects.toThrow(AdminInputError);
    expect((await listTiers(t.db, "queenstown")).map((tier) => tier.key)).toEqual(["essential", "portfolio"]);
  });

  it("will not change the bands under a Portfolio that is paying", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    await makePortfolio(t.db, owner.ownerId, 10);
    const tier = (await listTiers(t.db, "queenstown")).find((candidate) => candidate.key === "portfolio")!;
    await expect(
      saveTier(t.db, "queenstown", { ...base, id: tier.id, key: "portfolio", name: "Portfolio", active: true, bands: [{ from: 10, to: null, cents: 50000 }] }, "test"),
    ).rejects.toThrow("1 portfolio is on these bands");
  });
});

describe("starting a Portfolio", () => {
  it("needs 10 properties, then charges one retainer for all of them and covers every one", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const { portfolio, properties } = await makePortfolio(t.db, owner.ownerId, 9, { start: false });
    expect(properties.map((property) => property.portfolioId)).toEqual(Array(9).fill(portfolio.id));

    // Nine is not enough, and nothing is charged.
    const tooFew = await startPortfolio(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" });
    expect(tooFew).toEqual({ kind: "error", message: "Portfolio is for 10 or more properties. You have 9 so far: add 1 more, then start the retainer." });
    expect(await t.db.query("select 1 from public.membership_invoices")).toHaveLength(0);

    // The tenth (the pilot size) starts it on the 10-24 band: NZ$600, once, for the whole account.
    const { portfolio: started } = await makePortfolio(t.db, owner.ownerId, 1);
    expect(started).toMatchObject({ id: portfolio.id, status: "active", bandCents: 60000, propertyCountBilled: 10 });
    const invoices = await t.db.query<{ amount_cents: number; list_cents: number; property_id: string | null }>("select amount_cents, list_cents, property_id from public.membership_invoices");
    expect(invoices.map((row) => [Number(row.amount_cents), Number(row.list_cents), row.property_id])).toEqual([[60000, 60000, null]]);
    const statuses = await t.db.query<{ status: string }>("select status from public.properties where portfolio_id = $1::uuid", [portfolio.id]);
    expect(statuses.map((row) => row.status)).toEqual(Array(10).fill("active"));
    const audits = await t.db.query<{ action: string; amount: number }>("select action, amount from public.audit_log where entity_id = $1 order by id", [portfolio.id]);
    expect(audits.map((row) => `${row.action}:${row.amount ?? ""}`)).toEqual(["portfolio.chosen:", "portfolio.started:60000", "portfolio.paid:60000"]);

    // Asking again changes nothing and charges nothing.
    const again = await startPortfolio(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" });
    expect(again.kind).toBe("active");
    expect(await t.db.query("select 1 from public.membership_invoices")).toHaveLength(1);
  });

  it("with no card yet, goes through the card page, and being told twice about the payment changes nothing", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db, { card: "none" });
    const { portfolio } = await makePortfolio(t.db, owner.ownerId, 10, { start: false });
    const sent = await startPortfolio(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" });
    expect(sent.kind).toBe("redirect");
    const checkoutId = (sent as { url: string }).url.split("/").pop()!;
    const paid = (await completeDemoCheckout(t.db, checkoutId))!;
    // The card page asks for the 10-24 band, with no discount (Portfolio has none).
    expect(paid.checkout).toMatchObject({ portfolioId: portfolio.id, propertyId: null, priceCents: 60000, discountCents: 0 });
    const activation = { portfolioId: portfolio.id, provider: "demo" as const, subscriptionId: paid.subscriptionId, periodEnd: paid.periodEnd, invoice: paid.invoice, card: paid.card, customerId: paid.checkout.customerId };
    await activatePortfolio(t.db, activation);
    await activatePortfolio(t.db, activation);
    expect((await getPortfolio(t.db, owner.ownerId, portfolio.id))?.status).toBe("active");
    expect(await t.db.query("select 1 from public.membership_invoices")).toHaveLength(1);
    expect(await t.db.query("select 1 from public.audit_log where action = 'portfolio.started'")).toHaveLength(1);
  });

  it("will not set a price for 100 or more: the team is told and nothing is charged until a person agrees one", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const { portfolio } = await makePortfolio(t.db, owner.ownerId, 100, { start: false });
    const refused = await startPortfolio(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" });
    expect(refused.kind).toBe("error");
    expect(await t.db.query("select 1 from public.membership_invoices")).toHaveLength(0);
    expect((await openBandExceptions())[0]).toContain("wants to start Portfolio with 100 properties");

    // The admin agrees NZ$1,500 with them. Now it starts, at that price.
    await setAgreedRetainer(t.db, null, portfolio.id, 150000, "staff:test");
    const started = await startPortfolio(t.db, createDemoGateway(t.db, "NZ"), { ownerId: owner.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" });
    expect(started).toMatchObject({ kind: "active", portfolio: { bandCents: 150000 } });
  });
});

describe("the band follows the number of properties", () => {
  it("moves up and down with the next monthly payment, never part-way through a month, and audits each change", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const { gateway, priceChanges } = watchedGateway();
    const { portfolio, properties } = await makePortfolio(t.db, owner.ownerId, 24, { gateway });
    expect(portfolio.bandCents).toBe(60000);
    const periodEnd = portfolio.currentPeriodEnd!.getTime();

    // The 25th property: from the 10-24 band (60000) to the 25-49 band (90000).
    await makePortfolio(t.db, owner.ownerId, 1, { gateway, start: false });
    expect(priceChanges).toEqual([{ subscriptionId: portfolio.subscriptionId, cents: 90000, key: `hostfix-band-${portfolio.id}-v1-90000` }]);
    let now = (await getPortfolio(t.db, owner.ownerId, portfolio.id))!;
    expect(now).toMatchObject({ bandCents: 90000, propertyCountBilled: 25, bandVersion: 1 });
    // Nothing is charged today: still one payment, and the next one is on the same date as before.
    expect(await t.db.query("select 1 from public.membership_invoices")).toHaveLength(1);
    expect(now.currentPeriodEnd!.getTime()).toBe(periodEnd);

    // Taking one off brings it back to 24 and the 10-24 band, as a new change (its own key).
    await requestCancel(t.db, gateway, owner.ownerId, properties[0]!.id);
    expect((await getProperty(t.db, owner.ownerId, properties[0]!.id))?.status).toBe("cancelled");
    expect(priceChanges.map((change) => [change.cents, change.key])).toEqual([
      [90000, `hostfix-band-${portfolio.id}-v1-90000`],
      [60000, `hostfix-band-${portfolio.id}-v2-60000`],
    ]);
    now = (await getPortfolio(t.db, owner.ownerId, portfolio.id))!;
    expect(now).toMatchObject({ bandCents: 60000, propertyCountBilled: 24, bandVersion: 2 });
    expect(await bandAudits(portfolio.id)).toEqual([[60000, 90000, 25], [90000, 60000, 24]]);

    // Checking again finds nothing to change: no call, no audit.
    expect(await rebandPortfolio(t.db, gateway, portfolio.id, "test")).toEqual({ propertyCount: 24, cents: 60000, changed: false });
    expect(priceChanges).toHaveLength(2);
    expect(await bandAudits(portfolio.id)).toHaveLength(2);

    // The next demo renewal charges the new band: 60000.
    await recordRenewal(t.db, {
      provider: "demo", subscriptionId: portfolio.subscriptionId!,
      invoice: { invoiceId: "demo_in_second", amountCents: 60000, currency: "NZD", periodStart: now.currentPeriodEnd!, periodEnd: addHours(now.currentPeriodEnd!, 24 * 30), paidAt: now.currentPeriodEnd! },
    });
    const amounts = await t.db.query<{ amount_cents: number }>("select amount_cents from public.membership_invoices order by created_at, id");
    expect(amounts.map((row) => Number(row.amount_cents))).toEqual([60000, 60000]);
  });

  it("if the payment company cannot be told, keeps the property, records nothing about the band, tells a person, and tries again next time", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const { portfolio } = await makePortfolio(t.db, owner.ownerId, 24);
    const base = createDemoGateway(t.db, "NZ");
    const broken: PaymentsGateway = { ...base, changeMembershipPrice: async () => { throw new Error("connection lost"); } };
    await makePortfolio(t.db, owner.ownerId, 1, { gateway: broken, start: false });
    // The property itself was saved and is covered, but the band was not changed, and a person is told.
    expect(await countPortfolioProperties(t.db, portfolio.id)).toBe(25);
    expect((await getPortfolio(t.db, owner.ownerId, portfolio.id))).toMatchObject({ bandCents: 60000, bandVersion: 0 });
    expect(await bandAudits(portfolio.id)).toEqual([]);
    expect((await openBandExceptions())[0]).toContain("the payment company could not be reached to change the retainer");
    // The next check gets through.
    expect(await rebandPortfolio(t.db, base, portfolio.id, "test")).toEqual({ propertyCount: 25, cents: 90000, changed: true });
    expect(await bandAudits(portfolio.id)).toEqual([[60000, 90000, 25]]);
  });

  it("below 10, keeps the lowest band and asks a person, rather than moving them to Essential", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const { gateway, priceChanges } = watchedGateway();
    const { portfolio, properties } = await makePortfolio(t.db, owner.ownerId, 10, { gateway });
    await requestCancel(t.db, gateway, owner.ownerId, properties[0]!.id);

    // Nine properties: still the 10-24 band, NZ$600, so nothing for the payment company to change.
    expect(priceChanges).toEqual([]);
    expect(await getPortfolio(t.db, owner.ownerId, portfolio.id)).toMatchObject({ status: "active", bandCents: 60000, propertyCountBilled: 9 });
    const remaining = await t.db.query<{ tier_key: string; status: string }>(
      "select t.key as tier_key, p.status from public.properties p join public.membership_tiers t on t.id = p.tier_id where p.portfolio_id = $1::uuid and p.status <> 'cancelled'",
      [portfolio.id],
    );
    expect(remaining).toHaveLength(9);
    expect(new Set(remaining.map((row) => `${row.tier_key}:${row.status}`))).toEqual(new Set(["portfolio:active"]));
    const flagged = await openBandExceptions();
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toContain("is down to 9 properties, fewer than 10. They stay on the lowest band (NZ$600 a month)");
  });

  it("at 100, keeps billing the 50-99 band and asks a person to set the price", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    const { gateway, priceChanges } = watchedGateway();
    const { portfolio } = await makePortfolio(t.db, owner.ownerId, 99, { gateway, start: false });
    await startPortfolio(t.db, gateway, { ownerId: owner.ownerId, portfolioId: portfolio.id, successUrl: "/", cancelUrl: "/" });
    expect((await getPortfolio(t.db, owner.ownerId, portfolio.id))?.bandCents).toBe(120000);

    await makePortfolio(t.db, owner.ownerId, 1, { gateway, start: false });
    // Still 120000 (the 50-99 band): nothing sent to the payment company.
    expect(priceChanges).toEqual([]);
    expect(await getPortfolio(t.db, owner.ownerId, portfolio.id)).toMatchObject({ bandCents: 120000, propertyCountBilled: 100 });
    expect((await openBandExceptions())[0]).toContain("now has 100 properties. 100 is priced by arrangement");

    // A person agrees NZ$1,500 with them: it goes to the payment company for the next payment, and is audited.
    await setAgreedRetainer(t.db, gateway, portfolio.id, 150000, "staff:admin");
    expect(priceChanges.map((change) => change.cents)).toEqual([150000]);
    expect(await bandAudits(portfolio.id)).toEqual([[120000, 150000, 100]]);
  });
});

describe("a job at a Portfolio property", () => {
  it("is priced, charged and paid exactly as at an Essential property", async () => {
    await liveMarket(t.db);
    const tradie = await makeTradie(t.db, { slot: 1, name: "Wakatipu Plumbing" });
    const essentialOwner = await makeOwner(t.db);
    const essentialHome = await makeProperty(t.db, essentialOwner.ownerId);
    const manager = await makeOwner(t.db);
    const { properties } = await makePortfolio(t.db, manager.ownerId, 10);

    const outcomes = [];
    for (const property of [essentialHome, properties[3]!]) {
      const job = await logJob(t.db, property, { code: "PL-01" });
      const [offer] = await offersFor(t.db, job.id);
      await t.db.tx((tx) => acceptOffer(tx, offer!.id, "link"));
      await markEnRoute(t.db, job.id, tradie.tradieId);
      await markArrived(t.db, job.id, tradie.tradieId, { lat: -45.03, lng: 168.66 });
      const done = await completeJob(t.db, job.id, tradie.tradieId, { note: "Sorted.", uploadIds: [await photo(t.db, `tradie:${tradie.tradieId}`)] });
      if (!done.ok) throw new Error(done.message);
      expect(await chargeJob(t.db, gatewayFor(t.db), job.id)).toBe("succeeded");
      const [payment] = await t.db.query<{ amount_cents: number; status: string }>("select amount_cents, status from public.payments where job_id = $1::uuid", [job.id]);
      const [payout] = await t.db.query<{ amount_cents: number }>("select amount_cents from public.payouts where job_id = $1::uuid", [job.id]);
      outcomes.push({ owner: done.job.ownerTotalCents, tradie: done.job.tradieTotalCents, charged: Number(payment!.amount_cents), status: payment!.status, payout: Number(payout!.amount_cents) });
    }
    // PL-01: owner 22500, tradie 19000, we keep 3500. The same at both.
    const expected = { owner: 22500, tradie: 19000, charged: 22500, status: "succeeded", payout: 19000 };
    expect(outcomes).toEqual([expected, expected]);
    expect(22500 - 19000).toBe(3500);
  });

  it("missing the promised time credits nothing automatically and asks a person", async () => {
    await liveMarket(t.db);
    await makeTradie(t.db, { slot: 1 });
    const manager = await makeOwner(t.db);
    const { properties } = await makePortfolio(t.db, manager.ownerId, 10);
    const job = await logJob(t.db, properties[0]!, { code: "PL-01" });
    setTestNow(addMinutes(addHours(MONDAY_10AM, 24), 1));
    // Missed promises are no longer credited anywhere (DECISIONS.md, 2026-11-18): Portfolio is the same as Essential.
    expect(await markMissedWindows(t.db)).toEqual({ missed: 1, noShows: 0 });
    expect(await t.db.query("select 1 from public.credits")).toHaveLength(0);
    const [raised] = await t.db.query<{ summary: string }>("select summary from public.exceptions where job_id = $1::uuid and kind = 'missed_window'", [job.id]);
    expect(raised!.summary).toContain("Nothing is charged unless a tradie does the job");
    expect(await textsTo(t.db, manager.user.phone!, "window_missed")).toHaveLength(0);
  });
});

describe("what the payment company tells us about a retainer", () => {
  it("a failed payment holds every property on it, and the end of the retainer ends them all", async () => {
    await liveMarket(t.db);
    const manager = await makeOwner(t.db);
    const { portfolio } = await makePortfolio(t.db, manager.ownerId, 10);
    const invoice = { invoiceId: "demo_in_failed", amountCents: 60000, currency: "NZD", periodStart: MONDAY_10AM, periodEnd: MONDAY_10AM, paidAt: MONDAY_10AM };
    expect(await recordMembershipPaymentFailed(t.db, { provider: "demo", subscriptionId: portfolio.subscriptionId!, invoice, updateCardUrl: "https://example.com/app/billing" })).toBe(true);
    const held = await t.db.query<{ status: string }>("select distinct status from public.properties where portfolio_id = $1::uuid", [portfolio.id]);
    expect(held.map((row) => row.status)).toEqual(["past_due"]);
    expect((await textsTo(t.db, manager.user.phone!, "membership_failed"))[0]!.body).toContain("your membership payment for your Portfolio did not go through");

    expect(await endMembership(t.db, { provider: "demo", subscriptionId: portfolio.subscriptionId! })).toBe(true);
    expect(await endMembership(t.db, { provider: "demo", subscriptionId: portfolio.subscriptionId! })).toBe(false);
    const ended = await t.db.query<{ status: string }>("select distinct status from public.properties where portfolio_id = $1::uuid", [portfolio.id]);
    expect(ended.map((row) => row.status)).toEqual(["cancelled"]);
  });
});

describe("the numbers and the statement", () => {
  it("count each Portfolio retainer once, not once per property", async () => {
    await liveMarket(t.db);
    const owner = await makeOwner(t.db);
    await makeProperty(t.db, owner.ownerId);
    const manager = await makeOwner(t.db);
    await makePortfolio(t.db, manager.ownerId, 12);
    const numbers = await marketNumbers(t.db, "queenstown");
    // One Essential property, free to join so 0 a month, plus one retainer for 12 properties on the 10-24
    // band at 60000: 0 + 60000 = 60000. Thirteen properties are covered.
    expect(numbers).toMatchObject({ mrrCents: 60000, properties: 13, portfolios: 1 });

    const market = (await getMarket(t.db, "queenstown"))!;
    const statement = await ownerStatement(t.db, manager.ownerId, market, "2026-11");
    expect(statement.lines.filter((line) => line.kind === "membership").map((line) => [line.description, line.amountCents])).toEqual([["Monthly Portfolio retainer", 60000]]);
    expect(statement.membershipCents).toBe(60000);
  });
});

describe("the database change", () => {
  it("is safe to run twice, and gives Queenstown one Portfolio tier", async () => {
    const file = path.resolve(__dirname, "../../supabase/migrations/20261119000000_portfolio.sql");
    await t.db.exec(fs.readFileSync(file, "utf8"));
    await t.db.exec(fs.readFileSync(file, "utf8"));
    const tiers = await listTiers(t.db, "queenstown");
    // Essential is 0 here: the database is built from config/markets.ts, which is free to join.
    expect(tiers.map((tier) => [tier.key, tier.billingBasis, tier.monthlyPriceCents])).toEqual([["essential", "per_property", 0], ["portfolio", "per_account", 60000]]);
    expect(tiers[1]!.bands).toEqual(PORTFOLIO.bands);
  });

  it("adds the Portfolio tier to a Queenstown that was set up before it existed", async () => {
    await t.db.query("delete from public.membership_tiers where key = 'portfolio'");
    await t.db.exec(fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261119000000_portfolio.sql"), "utf8"));
    const portfolio = (await listTiers(t.db, "queenstown")).find((tier) => tier.key === "portfolio");
    expect(portfolio).toMatchObject({ billingBasis: "per_account", monthlyPriceCents: 60000, active: true, bands: PORTFOLIO.bands });
  });
});
