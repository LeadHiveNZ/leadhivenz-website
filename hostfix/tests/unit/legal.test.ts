import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { launchMarket } from "@config/markets";
import TermsPage from "@/app/(site)/legal/terms/page";
import TradieAgreementPage from "@/app/(site)/legal/tradie-agreement/page";
import PrivacyPage from "@/app/(site)/legal/privacy/page";
import { FEE_NOTICE_DAYS } from "@/lib/markets/admin";
import { TRADIE_AGREEMENT_VERSION } from "@/lib/tradies/service";
import { HOURLY_LIMIT_CENTS } from "@/lib/jobs/rates";
import { FAR_METRES } from "@/lib/jobs/arrival";
import { FLAG_DAYS, FLAG_REVIEW, TRUSTED_FINISHED_JOBS } from "@/lib/tradies/reliability";
import { OLD_RECEIPT_DAYS, PART_PRICE_FLAG_MULTIPLE, RECEIPT_TO_FOLLOW_DAYS } from "@/lib/jobs/parts";
import { OWN_CLIENT_FEE_BPS, PART_FEE_BPS, PAYOUT_GUARANTEE_CENTS } from "@/lib/jobs/pricing";
import { PATTERN_DAYS, PATTERN_PAIR_JOBS, PATTERN_TRADIE_CANCELS } from "@/lib/ops/patterns";
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

describe("parts (DECISIONS.md, 2026-11-23)", () => {
  it("the owner terms say the parts rule in the agreed words, with the market's NZ$20 and NZ$150, and never 'at cost' or 'retail'", () => {
    expect(launchMarket.partsIncludedCents).toBe(2000);
    expect(launchMarket.partsApprovalCents).toBe(15000);
    const terms = text(TermsPage);
    expect(terms).toContain("Small parts up to NZ$20 are in the price. Other parts are charged at the tradie's price, including GST, and above NZ$150 of parts on a job you say yes first.");
    expect(terms).toContain("Up to NZ$150 of parts on a job");
    expect(terms).toContain("Our team can ask the tradie for the receipt for any part, and checks it.");
    expect(terms).toContain("If you supply a part yourself there is no parts charge, but a fault in a part you supplied is not covered by the tradie's 30-day callback.");
    expect(terms).toContain("parts already bought for it that cannot be returned are charged at what they cost, with nothing added");
    expect(terms).not.toMatch(/retail|charged at cost|plus 20%/i);
  });

  it("the tradie agreement says what the tradie gets: their own price less 3%, no receipt unless asked, the 7 days, and the 1.5 times look", () => {
    expect(PART_FEE_BPS).toBe(300);
    expect(RECEIPT_TO_FOLLOW_DAYS).toBe(7);
    expect(OLD_RECEIPT_DAYS).toBe(90);
    expect(PART_PRICE_FLAG_MULTIPLE).toBe(1.5);
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("Small parts up to NZ$20 are in the job's price");
    expect(agreement).toContain("your own price for one, including GST: your cost plus your own usual markup. The owner pays that price, and you get it less 3%, which covers the card fee. No receipt is needed.");
    expect(agreement).toContain("A part you pick from the list and price at more than 1.5 times its list price is looked at by our team; nothing is held for that.");
    expect(agreement).toContain("if it has not come within 7 days the part is refunded to the owner out of your payment");
    expect(agreement).toContain("Only our team sees a receipt.");
    expect(agreement).toContain("Parts you added before 23 November 2026 stay on the terms you agreed then.");
    expect(agreement).not.toMatch(/at cost|paid back to you in full|what you paid plus 20%/i);
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
    // Capped at NZ$1,000 of the job's price since 23 Nov 2026 (DECISIONS.md, 2026-11-23).
    expect(agreement).toContain("Once you finish a job the owner approved, you're paid even if their card fails, for up to NZ$1,000 of the job's price. Chasing is our job.");
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

describe("quotes and texts (DECISIONS.md, 2026-11-20, third entry)", () => {
  it("the tradie agreement says the quote rules and the call-out credit worked by hand", () => {
    expect(HOURLY_LIMIT_CENTS).toBe(100000);
    expect(launchMarket.notDescribedHours).toBe(24);
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("That quote is only for work beyond the job described: you still do the job described, at its price.");
    expect(agreement).toContain("You are paid the call-out (NZ$190) once the owner approves your quote, or if they have not objected within 24 hours.");
    expect(agreement).toContain("Work up to NZ$1,000 is quoted in hours, in quarter hours");
    expect(agreement).toContain("If you need to come back, include the extra visit in your quote. There is no second call-out on the same job.");
    // 50000 quote, 22500 credit: owner 22500 + 50000 - 22500 = 50000; tradie 19000 + (27500 - 4125) = 42375.
    expect(agreement).toContain("A NZ$500 quote: the owner pays NZ$500 in all, and you get NZ$190 plus 85% of NZ$275 (NZ$233.75), NZ$423.75.");
    expect(agreement).not.toContain("This needs a quote");
  });

  it("the owner terms and privacy page say what the code does about quotes, STOP and app notifications", () => {
    const terms = text(TermsPage);
    expect(terms).toContain("When a quote goes ahead (your yes, or inside your limit), the call-out comes off it, so you pay for the visit once.");
    expect(terms).toContain("A return visit is part of the quote, never a second call-out.");
    expect(terms).toContain("if you have not pressed \u201cThis was the job I described\u201d within 24 hours");
    const privacy = text(PrivacyPage);
    expect(privacy).toContain("You can stop texts from us at any time by replying STOP (START turns them back on).");
    expect(privacy).toContain("Notifications never contain an address or door code.");
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

describe("the hold on the card, cancelling, the payout guarantee, own clients and the one in-app rule (DECISIONS.md, 2026-11-23)", () => {
  it("the agreement's numbers come from the constants and the market: NZ$1,000, 5%, 15%, the call-out pay, 2 and 3 in 90 days", () => {
    expect(PAYOUT_GUARANTEE_CENTS).toBe(100000);
    expect(launchMarket.payoutGuaranteeCents).toBe(PAYOUT_GUARANTEE_CENTS);
    expect(OWN_CLIENT_FEE_BPS).toBe(500);
    expect(launchMarket.platformFeeBps).toBe(1500);
    expect(launchMarket.diagnosisPayoutCents).toBe(19000);
    expect([PATTERN_PAIR_JOBS, PATTERN_TRADIE_CANCELS, PATTERN_DAYS]).toEqual([2, 3, 90]);
    expect(TRADIE_AGREEMENT_VERSION).toBe("23 November 2026");
  });

  it("the tradie agreement says the hold, the free cancel before Arrived (the travel is theirs), and the call-out after it", () => {
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("The job's price is held on the owner's card when the job is sent out");
    expect(agreement).toContain("If the owner cancels before you tap I have arrived , even after you tapped On my way, they pay nothing and you are not paid: the travel is yours.");
    expect(agreement).toContain("If they cancel after you tap I have arrived , they are charged the call-out and you are paid your share of it, as for a call-out (NZ$190, plus your share of any urgent or after-hours surcharge).");
  });

  it("the tradie agreement says the guarantee up to NZ$1,000, the rest waiting for the card, and over NZ$1,000 charged on approval", () => {
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("you're paid even if their card fails, for up to NZ$1,000 of the job's price");
    expect(agreement).toContain("your share of the part above NZ$1,000 waits, and is sent to you as soon as the card pays");
    expect(agreement).toContain("Work you price yourself over NZ$1,000 always waits for the owner's yes, and is charged to their card in full when they approve it, before you start.");
    expect(agreement).toContain("If the work then does not go ahead, the owner is refunded.");
  });

  it("the tradie agreement says the 5% own-client rate in the agreed words, and the one rule in place of the 12 months", () => {
    const agreement = text(TradieAgreementPage);
    expect(agreement).toContain("jobs between you and that property take a 5% platform fee instead of 15%");
    expect(agreement).toContain("5% covers the card fees (about 3%), the automatic texts and payment, and chasing late payers.");
    expect(agreement).toContain("we check that by the property's address and map pin, not by the owner's account");
    expect(agreement).toContain("Owners HostFix introduces stay at the normal 15% fee for every job through the app, however long you have known them. There is no time limit and no buyout.");
    expect(agreement).toContain("One rule: a job booked in the app is finished and paid through the app.");
    expect(agreement).toContain("can lead to removal from the network. A person decides");
    expect(agreement).toContain("our team may look at them and talk to you. That is never a removal by itself, and it is never counted as declining.");
    expect(agreement).not.toMatch(/12 months|NZ\$250|buy (an owner )?out|released for one of their properties/i);
  });

  it("the owner terms say the hold at booking, 'You're only charged once it's fixed', the free cancel before Arrived and the call-out after", () => {
    const terms = text(TermsPage);
    expect(terms).toContain("When the job is sent out we hold its price on your saved card. You're only charged once it's fixed.");
    expect(terms).toContain("When a job is sent out, we hold the price you saw on your card: the menu price with GST and any urgent or after-hours charge, or for a job not on the menu the NZ$225 call-out.");
    expect(terms).toContain("If your card declines the hold, the job is not sent");
    expect(terms).toContain("Until the tradie taps “I have arrived”, even when they are on the way, it is free: the hold is let go and you pay nothing.");
    expect(terms).toContain("After they have arrived, cancelling charges the call-out");
    expect(terms).toContain("Work a tradie prices themselves over NZ$1,000 is different: it is charged in full when you approve it, before the work starts");
    const privacy = text(PrivacyPage);
    expect(privacy).toContain("If a tradie invites you as their client, or an owner invites their own tradie");
  });
});
