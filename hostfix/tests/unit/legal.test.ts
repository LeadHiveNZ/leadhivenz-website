import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import TermsPage from "@/app/(site)/legal/terms/page";
import TradieAgreementPage from "@/app/(site)/legal/tradie-agreement/page";
import { testDb } from "./db";

/**
 * THE LEGAL PAGES SAY ONLY WHAT THE APP DOES (AGENTS.md). The hours in the
 * terms (nobody has taken it, the owner's answer to a later time) are read from
 * the launch market's settings, and the tradie agreement's limits from the
 * code's own constants. These tests fail if the page, the settings and the
 * database's defaults ever say different things.
 */

const t = testDb();

const text = (page: () => React.ReactElement) =>
  renderToStaticMarkup(createElement(page))
    .replace(/<[^>]+>/g, " ")
    .replace(/&rsquo;|&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("the owner terms", () => {
  it("say the same 3 hours and 2 hours as the market, written out by hand here", () => {
    // DECISIONS.md, 2026-11-18: 3 hours to the "nobody has taken it" text, 2 hours for the owner to answer a later time.
    expect(launchMarket.unacceptedAlertHours).toBe(3);
    expect(launchMarket.counterOfferHours).toBe(2);
    const terms = text(TermsPage);
    expect(terms).toContain("Nobody has taken it after 3 hours.");
    expect(terms).toContain("If you have not answered within 2 hours we send it on.");
    expect(terms).toContain("we do not text you about it between 9pm and 7am: the text waits until 7am");
    expect(terms).toContain("they choose a 2-hour window");
    expect(terms).toContain("up to 7 days ahead");
  });

  it("match the database's own defaults for a new market", async () => {
    const rows = await t.db.query<{ column_name: string; column_default: string }>(
      `select column_name, column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'markets' and column_name in ('unaccepted_alert_hours', 'counter_offer_hours')`,
    );
    const defaults = Object.fromEntries(rows.map((row) => [row.column_name, Number(String(row.column_default).replace(/[^0-9]/g, ""))]));
    expect(defaults).toEqual({ unaccepted_alert_hours: launchMarket.unacceptedAlertHours, counter_offer_hours: launchMarket.counterOfferHours });
  });
});

describe("the tradie agreement", () => {
  it("says the limits the code uses, and that declining never counts", () => {
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("Declining a job never leads to removal or to fewer offers.");
    expect(agreement).toContain("Your on-time record on jobs you accept decides who is offered network jobs first.");
    expect(agreement).toContain("Once you have arrived at 10 jobs, if fewer than 90% of your last 20 were on time");
    expect(agreement).toContain("Repeated no-shows on accepted jobs (3 in 90 days) can lead to removal from the network, but only after a conversation with you.");
    expect(agreement).toContain("up to 7 days ahead");
    expect(agreement).toContain("choosing the 2-hour window");
  });
});
