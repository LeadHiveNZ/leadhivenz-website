import fs from "node:fs";
import path from "node:path";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchMarket, type Market } from "@config/markets";
import { DAY, setTestNow } from "@/lib/clock";
import { startsOnTheMenu, type MenuSeed } from "@/lib/db/seed-core";
import { demandNumbers, getDemandTest, startDemandTest, TARGETS, TEST_DAYS, verdict } from "@/lib/leads/demand-test";
import { currentMarket, foundingBillingLine, foundingSpotsTaken, spotsLeft } from "@/lib/leads/founding";
import { priceListEmail, priceListFor, priceListNotes, workingHours } from "@/lib/leads/price-list";
import { sendPriceList } from "@/lib/leads/send-price-list";
import { readIntent, submitLead, type RawLeadForm, type SubmitDeps } from "@/lib/leads/service";
import { updateMarket } from "@/lib/markets/admin";
import { DepositNotAllowedError, startDepositCheckout } from "@/lib/payments/deposit";
import { SqlLeadStore } from "@/lib/store/sql";
import type { Lead } from "@/lib/store/types";
import { testDb } from "./db";
import { fakeFetch, jsonReply } from "./helpers";
import { ownerLead, tradieLead } from "./store-contract";

/**
 * THE DEMAND TEST: the two buttons on the owner page, the founding spots, the
 * scorecard on the leads page, the price list email, and the go-live line that
 * keeps the founding promises honest. Every expected number is worked out from
 * the rules in the code comments and DECISIONS.md, not copied from a run.
 */

const t = testDb();
const store = () => new SqlLeadStore(async () => t.db, "demo");
const quiet = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

const START = new Date("2026-11-20T00:00:00.000Z"); // Friday 20 November, 1pm in Queenstown

async function addLead(lead: Parameters<SqlLeadStore["insertLead"]>[0], at: Date, deposit?: "started" | "paid" | "refunded" | "credited"): Promise<Lead> {
  const saved = await store().insertLead(lead);
  await t.db.query("update public.leads set created_at = $2::timestamptz where id = $1::uuid", [saved.id, at.toISOString()]);
  if (deposit) {
    await t.db.query("update public.leads set deposit_status = $2, deposit_amount = 9900, deposit_currency = 'NZD' where id = $1::uuid", [saved.id, deposit]);
  }
  return (await store().getLead(saved.id))!;
}

let phone = 0;
const nextPhone = () => `+6421555${String(++phone).padStart(4, "0")}`;

afterEach(() => {
  setTestNow(null);
  vi.unstubAllEnvs();
});

describe("which button an owner pressed", () => {
  it("is read only from the two real buttons", () => {
    expect(readIntent("deposit")).toBe("deposit");
    expect(readIntent("pricelist")).toBe("pricelist");
    for (const other of ["DEPOSIT", "yes", "", undefined, null, 1]) expect(readIntent(other)).toBeNull();
  });

  it("is kept on owner leads and never on tradie leads", async () => {
    const owner = await store().insertLead(ownerLead({ intent: "deposit" }));
    expect(owner.intent).toBe("deposit");
    const tradie = await store().insertLead(tradieLead({ intent: "deposit" }));
    expect(tradie.intent).toBeNull();
    // And the database itself refuses one on a tradie.
    await expect(t.db.query("update public.leads set intent = 'pricelist' where id = $1::uuid", [tradie.id])).rejects.toThrow();
  });

  it("only ever moves up to a founding spot when the same owner presses again", async () => {
    const lead = await store().insertLead(ownerLead({ intent: null, phone: nextPhone() }));
    expect((await store().recordIntent(lead.id, "pricelist"))?.intent).toBe("pricelist");
    expect((await store().recordIntent(lead.id, "deposit"))?.intent).toBe("deposit");
    // Asking for the price list afterwards does not undo wanting a spot.
    expect((await store().recordIntent(lead.id, "pricelist"))?.intent).toBe("deposit");
  });

  it("an owner who comes back and presses the deposit button is one lead, now wanting a spot, with one alert", async () => {
    // Leads are stamped by the database's own clock, so the repeat check has to run at the real time.
    const now = new Date();
    const alerts: string[] = [];
    const deferred: (() => Promise<void>)[] = [];
    const deps: SubmitDeps = {
      getStore: () => store(),
      sendLeadAlert: async (lead) => {
        alerts.push(lead.id);
        return { anySent: true };
      },
      defer: (work) => {
        deferred.push(work);
      },
      now: () => now,
      log: quiet,
    };
    const form = (intent: string): RawLeadForm => ({
      fields: { name: "Olive Owner", phone: "021 777 1234", email: "olive@example.com", propertyCount: "1", managedBy: "self", ownerLocation: "Auckland", intent },
      attribution: JSON.stringify({ utm_source: "facebook", utm_content: "ad-a" }),
      honeypot: "",
      startedAt: String(now.getTime() - 20_000),
    });
    const first = await submitLead("owner", form("pricelist"), { market: launchMarket, ipKey: null }, deps);
    const second = await submitLead("owner", form("deposit"), { market: launchMarket, ipKey: null }, deps);
    for (const work of deferred.splice(0)) await work();

    expect(first).toMatchObject({ status: "ok", duplicate: false, lead: { intent: "pricelist" } });
    expect(second).toMatchObject({ status: "ok", duplicate: true, lead: { intent: "deposit" } });
    if (first.status !== "ok" || second.status !== "ok") throw new Error("both should be saved");
    expect(second.lead.id).toBe(first.lead.id);
    expect(alerts).toEqual([first.lead.id]);
  });
});

describe("founding spots", () => {
  it("are taken by a paid deposit, and stay taken once it is used against a membership", async () => {
    await addLead(ownerLead({ phone: nextPhone() }), START, "paid");
    await addLead(ownerLead({ phone: nextPhone() }), START, "credited");
    await addLead(ownerLead({ phone: nextPhone() }), START, "started"); // left the card page
    await addLead(ownerLead({ phone: nextPhone() }), START, "refunded"); // asked for it back
    await addLead(ownerLead({ phone: nextPhone() }), START); // price list only
    await addLead(ownerLead({ phone: nextPhone(), market: "wanaka" }), START, "paid"); // another market
    expect(await foundingSpotsTaken(t.db, "queenstown")).toBe(2);
  });

  it("left is the limit less those taken, never below nothing, and no limit means no count", () => {
    const withSpots = (spots: number | null) => ({ foundingDeposit: { ...launchMarket.foundingDeposit, spots } });
    expect(spotsLeft(withSpots(25), 3)).toBe(22);
    expect(spotsLeft(withSpots(25), 25)).toBe(0);
    expect(spotsLeft(withSpots(25), 27)).toBe(0);
    expect(spotsLeft(withSpots(null), 40)).toBeNull();
  });

  it("follow what the admin set, not the starting values in the code", async () => {
    await updateMarket(t.db, "queenstown", { depositCents: 7900, depositSpots: 10, depositTerms: ["Comes off your first bill"] }, "test");
    const market = await currentMarket(async () => t.db, "queenstown", quiet);
    expect(market.foundingDeposit).toMatchObject({ amountCents: 7900, spots: 10, terms: ["Comes off your first bill"] });
  });

  it("fall back to the starting values if the database cannot be read, so the page still works", async () => {
    const log = { error: vi.fn() };
    const market = await currentMarket(async () => Promise.reject(new Error("down")), "queenstown", log);
    expect(market.foundingDeposit).toEqual(launchMarket.foundingDeposit);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it("nobody is sent to the card page, with spots left or not: HostFix is free to join (DECISIONS.md, 2026-11-17)", async () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const lead = await store().insertLead(ownerLead({ phone: nextPhone() }));
    const create = vi.fn(async () => ({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
    const stripe = { checkout: { sessions: { create } } } as unknown as Stripe;

    await expect(startDepositCheckout(lead, launchMarket, "https://hostfix.example", { store: store(), stripe, spotsLeft: 0 })).rejects.toBeInstanceOf(DepositNotAllowedError);
    expect(create).not.toHaveBeenCalled();
    expect((await store().getLead(lead.id))?.depositStatus).toBe("none");

    // With a spot left it is refused too: no deposit is taken any more.
    await expect(startDepositCheckout(lead, launchMarket, "https://hostfix.example", { store: store(), stripe, spotsLeft: 1 })).rejects.toThrow(
      "Deposits are no longer taken: HostFix is free to join.",
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe("the scorecard", () => {
  it("has not started until someone starts it, then runs fourteen days and keeps every start in the audit log", async () => {
    expect(await getDemandTest(t.db)).toBeNull();
    setTestNow(START);
    const test = await startDemandTest(t.db, "queenstown", "admin@test");
    expect(test.startedAt.toISOString()).toBe(START.toISOString());
    expect(test.endsAt.toISOString()).toBe("2026-12-04T00:00:00.000Z"); // 14 days later
    expect(await getDemandTest(t.db)).toMatchObject({ market: "queenstown", startedBy: "admin@test", startedAt: START });

    setTestNow(new Date(START.getTime() + 2 * DAY));
    await startDemandTest(t.db, "queenstown", "admin@test");
    expect((await getDemandTest(t.db))?.startedAt.toISOString()).toBe("2026-11-22T00:00:00.000Z");
    const starts = await t.db.query<{ n: number }>("select count(*) as n from public.audit_log where action = 'demand_test.started'");
    expect(Number(starts[0]?.n)).toBe(2);
  });

  it("counts only this market's leads from inside the fourteen days, and what each one did", async () => {
    const test = { market: "queenstown", startedAt: START, endsAt: new Date(START.getTime() + TEST_DAYS * DAY) };
    const inside = new Date(START.getTime() + 3 * DAY);
    // Owners
    await addLead(ownerLead({ phone: nextPhone(), intent: "pricelist", utmContent: "ad-a" }), inside);
    await addLead(ownerLead({ phone: nextPhone(), intent: "deposit", utmContent: "ad-b" }), inside, "paid");
    await addLead(ownerLead({ phone: nextPhone(), intent: "deposit", utmContent: "ad-b" }), inside, "started");
    await addLead(ownerLead({ phone: nextPhone(), intent: "deposit", utmContent: null, utmCampaign: "qt-demand" }), inside, "refunded");
    await addLead(ownerLead({ phone: nextPhone(), intent: null, utmSource: null, utmMedium: null, utmCampaign: null, source: "direct" }), inside);
    // Not counted: before the start, on the last moment (the window ends there), another market.
    await addLead(ownerLead({ phone: nextPhone(), intent: "deposit" }), new Date(START.getTime() - 1), "paid");
    await addLead(ownerLead({ phone: nextPhone(), intent: "deposit" }), test.endsAt, "paid");
    await addLead(ownerLead({ phone: nextPhone(), intent: "deposit", market: "wanaka" }), inside, "paid");
    // Tradies
    await addLead(tradieLead({ phone: nextPhone(), trade: "handyman" }), inside);
    await addLead(tradieLead({ phone: nextPhone(), trade: "handyman" }), inside);
    await addLead(tradieLead({ phone: nextPhone(), trade: "plumber" }), inside);
    await addLead(tradieLead({ phone: nextPhone(), trade: "electrician" }), test.endsAt);

    const numbers = await demandNumbers(t.db, test);
    expect(numbers).toEqual({
      ownerLeads: 5,
      priceList: 1,
      wantedSpot: 3,
      reachedCardPage: 3, // paid, started and refunded all reached it
      paid: 1,
      refunded: 1,
      tradieLeads: { handyman: 2, plumber: 1 },
      byAd: [
        { ad: "ad-b", leads: 2, spotsWanted: 2, paid: 1 },
        { ad: "ad-a", leads: 1, spotsWanted: 0, paid: 0 },
        { ad: "direct", leads: 1, spotsWanted: 0, paid: 0 },
        { ad: "qt-demand", leads: 1, spotsWanted: 1, paid: 0 },
      ],
    });
  });

  it("gives one plain verdict: the pass mark is three cards down", () => {
    const test = { startedAt: START, endsAt: new Date(START.getTime() + TEST_DAYS * DAY) };
    const none = { paid: 0, ownerLeads: 0, priceList: 0 };
    expect(TARGETS.deposits).toBe(3);

    expect(verdict(none, test, START)).toEqual({ day: 1, finished: false, passed: false, headline: "3 more deposits needed in the 14 days left." });
    expect(verdict({ ...none, paid: 2 }, test, new Date(START.getTime() + 13.5 * DAY))).toEqual({
      day: 14, finished: false, passed: false, headline: "1 more deposit needed in the 1 day left.",
    });
    expect(verdict({ ...none, paid: 3 }, test, new Date(START.getTime() + 4 * DAY))).toMatchObject({
      day: 5, finished: false, passed: true, headline: "Passed: 3 owners have put a card down for a founding spot.",
    });
    expect(verdict({ ...none, paid: 1 }, test, test.endsAt)).toMatchObject({ day: 14, finished: true, passed: false, headline: "Not passed: 1 of the 3 deposits needed in 14 days." });
    // Plenty of interest in prices but nobody wants the membership: that is its own answer.
    expect(verdict({ paid: 0, ownerLeads: 30, priceList: 25 }, test, test.endsAt).headline).toBe(
      "Not passed. 25 owners took the price list and nobody took a founding spot: the price list interests them, the membership does not yet.",
    );
  });
});

describe("the price list", () => {
  const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "seed/menu-queenstown.json"), "utf8")) as MenuSeed;

  it("is every job that can be booked, at the owner's price, leaving out prices still waiting on a local quote", async () => {
    const list = await priceListFor(t.db, "queenstown");
    // 60 researched jobs, less the five priced off national averages that wait on a local quote
    // (DECISIONS.md: GD-01, PV-01, PV-02, PV-04, OD-03) and the two add-ons that only go on another job
    // (HP-01 each extra heat pump, PV-03 filter clean between guests): 60 - 5 - 2 = 53.
    expect(seed.items).toHaveLength(60);
    expect(list.count).toBe(53);
    const codes = list.groups.flatMap((group) => group.items.map((item) => item.code));
    for (const code of ["GD-01", "PV-01", "PV-02", "PV-04", "OD-03", "HP-01", "PV-03"]) expect(codes).not.toContain(code);
    const drain = list.groups.flatMap((group) => group.items).find((item) => item.code === "PL-08");
    expect(drain).toMatchObject({ name: "Blocked toilet, sink or shower drain", ownerPriceCents: 24500 });
  });

  it("says when the working day is, from the market's settings", () => {
    expect(workingHours(launchMarket)).toBe("7am to 4:30pm, Monday to Friday");
    expect(workingHours({ hoursStart: 8, hoursEnd: 20, workDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] })).toBe("8am to 8pm, every day");
    expect(workingHours({ hoursStart: 7.5, hoursEnd: 17, workDays: ["mon", "wed", "fri"] })).toBe("7:30am to 5pm, Monday, Wednesday, Friday");
  });

  it("states every other charge with the market's own numbers", () => {
    expect(priceListNotes(launchMarket)).toEqual([
      "This is what your card is charged when the job is done, GST included. No call-out fee on top.",
      "Need someone within 4 hours? Add NZ$50 and the tradie drops what they are doing, plus NZ$140 outside working hours (7am to 4:30pm, Monday to Friday).",
      "Not on the list? NZ$225 for a tradie to come and look, then a quote. Nothing over NZ$600 starts without your yes.",
      "Small parts are in the price. Bigger parts are charged at cost: we add nothing on parts.",
    ]);
  });

  it("emails the list with no founding spot, even when handed a link, and nothing an owner typed can break the email", async () => {
    const list = await priceListFor(t.db, "queenstown");
    const email = priceListEmail({ lead: { name: "<b>Olive</b> Owner" }, market: launchMarket, list, foundingUrl: "https://hostfix.example/owners/founding/abc", spotsLeft: 25 });
    expect(email.subject).toBe("Your HostFix price list for Queenstown");
    expect(email.text).toContain("Blocked toilet, sink or shower drain: NZ$245");
    expect(email.text).toContain("It is free to join");
    expect(email.text).not.toMatch(/founding/i);
    expect(email.html).not.toMatch(/founding/i);
    expect(email.html).toContain("&lt;b&gt;Olive&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Olive</b>");
  });

  it("only ever offered a founding spot while the market's deposit switch was on", async () => {
    const list = await priceListFor(t.db, "queenstown");
    const withDeposit = { ...launchMarket, foundingDeposit: { ...launchMarket.foundingDeposit, enabled: true } };
    const on = priceListEmail({ lead: { name: "Olive" }, market: withDeposit, list, foundingUrl: "https://hostfix.example/owners/founding/abc", spotsLeft: 25 });
    expect(on.text).toContain("Take a founding spot: https://hostfix.example/owners/founding/abc");
    for (const [foundingUrl, left] of [[null, 25], ["https://hostfix.example/owners/founding/abc", 0]] as const) {
      const email = priceListEmail({ lead: { name: "Olive" }, market: withDeposit, list, foundingUrl, spotsLeft: left });
      expect(email.text).not.toMatch(/founding/i);
    }
  });
});

describe("sending the price list", () => {
  const RESEND = { settings: { apiKey: "re_test_key", from: "HostFix <hello@hostfix.example>" } };

  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://hostfix.example");
    vi.stubEnv("APP_SECRET", "a-test-secret-that-is-at-least-32-characters-long");
  });

  async function recorded(leadId: string) {
    return (await store().listNotifications([leadId])).filter((n) => n.template === "price_list");
  }

  it("sends it to the owner, says it is free to join with no founding link, and records that it went", async () => {
    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const lead = await store().insertLead(ownerLead({ phone: nextPhone() }));
    const web = fakeFetch([jsonReply({ id: "em_123" })]);

    const outcome = await sendPriceList(lead, { store: store(), open: async () => t.db, settings: RESEND, fetchImpl: web.fetch });

    expect(outcome.status).toBe("sent");
    expect(web.requests).toHaveLength(1);
    const body = JSON.parse(web.requests[0]!.body) as { to: string[]; subject: string; text: string };
    expect(body.to).toEqual(["olive@example.com"]);
    expect(body.subject).toBe("Your HostFix price list for Queenstown");
    expect(body.text).not.toContain("/owners/founding/");
    // DECISIONS.md, 2026-11-18: no missed-promise credit. The urgent fee is not charged when the tradie is late.
    expect(body.text).toContain("It is free to join: you only pay the fixed price when a job is done. A tradie on site within 24 hours, or 4 when it's urgent. If an urgent job is reached late, the urgent fee is not charged, and the after-hours fee is charged only if the tradie comes outside working hours.");
    expect(body.text).not.toContain("is on us");
    expect(web.requests[0]!.headers["idempotency-key"]).toBe(`hostfix-price-list-${lead.id}`);
    expect(await recorded(lead.id)).toMatchObject([{ status: "sent", providerMessageId: "em_123" }]);
  });

  it("sends no founding link when card payments are not connected, or the owner has already paid", async () => {
    const lead = await store().insertLead(ownerLead({ phone: nextPhone() }));
    const web = fakeFetch([jsonReply({ id: "em_1" })]);
    await sendPriceList(lead, { store: store(), open: async () => t.db, settings: RESEND, fetchImpl: web.fetch });
    expect(JSON.parse(web.requests[0]!.body).text).not.toContain("/owners/founding/");

    vi.stubEnv("STRIPE_NZ_SECRET_KEY", "sk_test_nz");
    const paid = await addLead(ownerLead({ phone: nextPhone() }), new Date(), "paid");
    const again = fakeFetch([jsonReply({ id: "em_2" })]);
    await sendPriceList(paid, { store: store(), open: async () => t.db, settings: RESEND, fetchImpl: again.fetch });
    expect(JSON.parse(again.requests[0]!.body).text).not.toContain("/owners/founding/");
  });

  it("does not send, and says why, when email to owners is not set up", async () => {
    const lead = await store().insertLead(ownerLead({ phone: nextPhone() }));
    const web = fakeFetch([]);
    expect(await sendPriceList(lead, { store: store(), open: async () => t.db, settings: { problem: "RESEND_API_KEY is not set." }, fetchImpl: web.fetch })).toEqual({
      status: "skipped", detail: "RESEND_API_KEY is not set.",
    });
    // Resend's test sender can only email the account's own address, so owners would never get it.
    const testSender = { settings: { apiKey: "re_test_key", from: "HostFix <onboarding@resend.dev>" } };
    expect((await sendPriceList(lead, { store: store(), open: async () => t.db, settings: testSender, fetchImpl: web.fetch })).status).toBe("skipped");
    expect(web.requests).toHaveLength(0);
    expect((await recorded(lead.id)).map((n) => n.status)).toEqual(["skipped", "skipped"]);
  });

  it("records a failure when the email company says no", async () => {
    const lead = await store().insertLead(ownerLead({ phone: nextPhone() }));
    const web = fakeFetch([jsonReply({ message: "The domain is not verified" }, 403)]);
    const outcome = await sendPriceList(lead, { store: store(), open: async () => t.db, settings: RESEND, fetchImpl: web.fetch });
    expect(outcome.status).toBe("failed");
    expect((await recorded(lead.id))[0]).toMatchObject({ status: "failed" });
  });

  it("is only for owners with an email address", async () => {
    const tradie = await store().insertLead(tradieLead({ phone: nextPhone() }));
    const web = fakeFetch([]);
    expect((await sendPriceList(tradie, { store: store(), open: async () => t.db, settings: RESEND, fetchImpl: web.fetch })).status).toBe("skipped");
    expect(web.requests).toHaveLength(0);
  });
});

describe("the go-live line for founding deposits", () => {
  const market = (stage: Market["stage"], terms = launchMarket.foundingDeposit.terms) => ({
    name: "Queenstown", stage, foundingDeposit: { ...launchMarket.foundingDeposit, terms },
  });

  it("says to refund each deposit still held, and what those owners were promised", () => {
    const line = foundingBillingLine(market("waitlist"), 2);
    expect(line?.state).toBe("todo");
    expect(line?.detail).toContain("2 founding deposits are still held in Queenstown.");
    expect(line?.detail).toContain("refunded in full in Stripe");
    expect(line?.detail).toContain('"Half price for your first three months: $49.50 a month, then $99"');
  });

  it("is a problem once the market is live with a deposit still held", () => {
    const line = foundingBillingLine(market("live"), 1);
    expect(line).toMatchObject({ state: "problem", detail: expect.stringContaining("1 founding deposit is still held in Queenstown.") });
    expect(line?.detail).toContain("before their first job is charged");
  });

  it("is not shown once nothing is held, whatever was promised", () => {
    expect(foundingBillingLine(market("waitlist"), 0)).toBeNull();
    expect(foundingBillingLine(market("live"), 0)).toBeNull();
    expect(foundingBillingLine(market("waitlist", []), 3)?.detail).not.toContain("promised");
  });
});

describe("what starts on the menu", () => {
  it("leaves out prices waiting on a local quote and add-ons, unless switched on by hand", () => {
    expect(startsOnTheMenu({})).toBe(true);
    expect(startsOnTheMenu({ needsLocalQuote: true })).toBe(false);
    expect(startsOnTheMenu({ isAddOn: true })).toBe(false);
    expect(startsOnTheMenu({ needsLocalQuote: true, active: true })).toBe(true);
    expect(startsOnTheMenu({ active: false })).toBe(false);
  });
});
