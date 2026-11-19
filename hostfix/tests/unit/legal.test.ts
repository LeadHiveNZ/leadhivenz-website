import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import TermsPage from "@/app/(site)/legal/terms/page";
import TradieAgreementPage from "@/app/(site)/legal/tradie-agreement/page";
import { FAR_METRES } from "@/lib/jobs/arrival";
import { FLAG_DAYS, FLAG_REVIEW, TRUSTED_FINISHED_JOBS } from "@/lib/tradies/reliability";
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
    .replace(/&rsquo;|&#x27;|&#39;|\u2019/g, "'")
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

  it("say the checks on every job with the market's own numbers: 300 m, 10 minutes, 48 hours, 10 jobs, 90 days (DECISIONS.md, 2026-11-19)", () => {
    expect(launchMarket.minMinutesOnSite).toBe(10);
    expect(launchMarket.ownerConfirmHours).toBe(48);
    expect(FAR_METRES).toBe(300);
    expect(TRUSTED_FINISHED_JOBS).toBe(10);
    expect(FLAG_DAYS).toBe(90);
    const terms = text(TermsPage);
    expect(terms).toContain("is more than 300 m away, or the job is finished less than 10 minutes after the tradie arrived");
    expect(terms).toContain("the tradie's payment may be held while we ask you to look at the before and after photos");
    expect(terms).toContain("If you have not answered within 48 hours, a tradie with 10 or more finished jobs and no other flagged job in the last 90 days is paid");
    expect(terms).toContain("Your card is charged as normal");
  });

  it("match the database's own defaults for a new market", async () => {
    const rows = await t.db.query<{ column_name: string; column_default: string }>(
      `select column_name, column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'markets'
          and column_name in ('unaccepted_alert_hours', 'counter_offer_hours', 'min_minutes_on_site', 'owner_confirm_hours')`,
    );
    const defaults = Object.fromEntries(rows.map((row) => [row.column_name, Number(String(row.column_default).replace(/[^0-9]/g, ""))]));
    expect(defaults).toEqual({
      unaccepted_alert_hours: launchMarket.unacceptedAlertHours, counter_offer_hours: launchMarket.counterOfferHours,
      min_minutes_on_site: launchMarket.minMinutesOnSite, owner_confirm_hours: launchMarket.ownerConfirmHours,
    });
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

  it("says the checks on every job, who decides a flagged one, and what a faked job costs (DECISIONS.md, 2026-11-19)", () => {
    expect(FLAG_REVIEW).toBe(3);
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("or more than 300 m from the pin, still works (phones get it wrong), but the job is flagged");
    expect(agreement).toContain("a job finished less than 10 minutes after you arrived");
    expect(agreement).toContain("If they have not answered within 48 hours, you are paid if you are trusted (10 or more finished jobs, and no other flagged job in the last 90 days)");
    expect(agreement).toContain("3 flagged jobs in 90 days put you in front of our team for a conversation. Nobody is removed automatically");
    expect(agreement).toContain("declining a job can never flag anything");
    expect(agreement).toContain("A job reported as done that was not done, including a faked location or faked photos, means removal from HostFix, and any money paid to you for it must be repaid.");
    // Money is never promised to come off future payouts automatically: the code has no such step (src/lib/billing/settle.ts).
    expect(agreement).not.toMatch(/from your (next|future) payments/);
  });
});
