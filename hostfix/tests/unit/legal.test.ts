import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import TermsPage from "@/app/(site)/legal/terms/page";
import TradieAgreementPage from "@/app/(site)/legal/tradie-agreement/page";
import PrivacyPage from "@/app/(site)/legal/privacy/page";
import { FEE_NOTICE_DAYS } from "@/lib/markets/admin";
import { TRADIE_AGREEMENT_VERSION } from "@/lib/tradies/service";
import { FAR_METRES } from "@/lib/jobs/arrival";
import { FLAG_DAYS, FLAG_REVIEW, TRUSTED_FINISHED_JOBS } from "@/lib/tradies/reliability";
import { OLD_RECEIPT_DAYS, RECEIPT_TO_FOLLOW_DAYS } from "@/lib/jobs/parts";
import { LIST_PART_FEE_BPS } from "@/lib/jobs/pricing";
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

describe("parts (DECISIONS.md, 2026-11-20)", () => {
  it("the owner terms say the parts rule in the agreed words, with the market's NZ$30 and NZ$150, and never 'at cost' or 'retail'", () => {
    expect(launchMarket.partsIncludedCents).toBe(3000);
    expect(launchMarket.partsApprovalCents).toBe(15000);
    const terms = text(TermsPage);
    expect(terms).toContain("Small parts up to NZ$30 are in the price. Common parts are on the price list at a fixed price. Anything else is charged at the merchant's price plus 20% for sourcing it. Prices include GST.");
    expect(terms).toContain("Up to NZ$150 of parts on a job");
    expect(terms).toContain("If you supply a part yourself there is no parts charge, but a fault in a part you supplied is not covered by the tradie's 30-day callback.");
    expect(terms).toContain("parts already bought for it that cannot be returned are charged at what they cost, with nothing added");
    expect(terms).not.toMatch(/retail|charged at cost/i);
  });

  it("the tradie agreement says what the tradie gets: the list price less 3%, or what they paid plus 17%, and the 7 days for a receipt", () => {
    expect(LIST_PART_FEE_BPS).toBe(300);
    expect(RECEIPT_TO_FOLLOW_DAYS).toBe(7);
    expect(OLD_RECEIPT_DAYS).toBe(90);
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("you get it less 3% (which covers the card fee); no receipt is needed");
    expect(agreement).toContain("you get what you paid plus 17% (the 15% platform fee comes off the 20% only)");
    expect(agreement).toContain("if it has not come within 7 days the part is refunded to the owner out of your payment");
    expect(agreement).toContain("Only our team sees the receipt.");
    expect(agreement).not.toMatch(/at cost|paid back to you in full/i);
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
    // Only a lost chargeback found to be the tradie's fault is taken from later payouts (DECISIONS.md, 2026-11-20, second entry).
    expect(agreement.match(/from your later payments/g)).toHaveLength(1);
    expect(agreement).not.toMatch(/from your (next|future) payments/);
  });

  it("says a finished job is paid whatever the card does, the chargeback rule word for word, the knock, safety, and the 30 days (DECISIONS.md, 2026-11-20, second entry)", () => {
    expect(FEE_NOTICE_DAYS).toBe(30);
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("Once you finish a job the owner approved, you're paid even if their card fails. Chasing is our job.");
    expect(agreement).not.toMatch(/once the owner's card has been charged|when the charge succeeds/i);
    expect(agreement).toContain(
      "If we lose, our team decides whether it was your fault (bad work or a no-show). If it was, a payment not yet sent for that job is cancelled, and a payment already sent becomes a balance you owe us, taken back from your later payments, never more than 50% of any one payment; we text you when this happens, and your Pay page shows what is left. If it was not your fault, HostFix carries the loss and you are paid as normal. Any balance left when you leave HostFix must be repaid.",
    );
    expect(agreement).toContain("Guest staying: knock and wait. Don't let yourself in unless nobody answers after 5 minutes and the owner said that's OK.");
    expect(agreement).toContain("Entering an occupied property without knocking is a serious breach of this agreement.");
    expect(agreement).toContain("You manage the safety of your own work");
    expect(agreement).toContain("report it from the job screen");
    expect(agreement).toContain("the claim goes to your public liability insurer. HostFix supplies the job's photos and times.");
    expect(agreement).toContain("We give you 30 days' notice by text before a change to the platform fee applies to you.");
    expect(agreement).toContain("you are asked to agree to the new version in the app (on your home page) before your next offer");
    // The date on the page is the version a tradie agrees to.
    expect(agreement).toContain(TRADIE_AGREEMENT_VERSION);
  });
});

describe("the owner terms and privacy page (DECISIONS.md, 2026-11-20, second entry)", () => {
  it("say what the code does about cards, disputes, access, codes, hazards, damage and guests", () => {
    const terms = text(TermsPage);
    expect(terms).toContain("we check you have a usable saved card: one on file, not expired, and no earlier charge unpaid");
    expect(terms).toContain("The tradie is paid at the usual time either way, so a charge that still fails is an amount you owe us. You cannot send new jobs until it is paid.");
    expect(terms).toContain("We decide from the photos, times and locations the app recorded");
    expect(terms).toContain("Owners who misuse “Something's wrong” (for example on work that was plainly done) can lose access to HostFix.");
    expect(terms).toContain("If the tradie can't get in, the call-out is charged");
    expect(terms).toContain("Changing a door or lockbox code after a job is your responsibility");
    expect(terms).toContain("Under the Health and Safety at Work Act you and the tradie share a duty to keep the work safe.");
    expect(terms).toContain("the claim goes to the tradie's public liability insurer");
    expect(terms).toContain("we supply the job's photos and times");
    expect(terms).toContain("yes unless a guest is staying or you are not sure");
    expect(terms).not.toContain("Jobs cannot be logged at a property while a charge is outstanding");
    const privacy = text(PrivacyPage);
    expect(privacy).toContain("We use that number only for that job's texts");
    expect(privacy).toContain("the tradie sees only your first name");
  });
});
