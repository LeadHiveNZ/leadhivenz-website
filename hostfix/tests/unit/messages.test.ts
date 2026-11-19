import { describe, expect, it } from "vitest";
import { isGsm7, smsParts } from "@/lib/notify/gsm";
import { clip, STOP_LINE, texts } from "@/lib/notify/messages";
import { redactLinks } from "@/lib/notify/outbox";

// Long but realistic values (DECISIONS.md, 2026-11-20, third entry): the real links' length, the longest menu
// names, a long property name and business name, a four-figure amount and the longest window wording.
const link = "https://hostfix.co.nz/o/104237.k3Xb9aQ2LmPq";
const jobLink = "https://hostfix.co.nz/j/10423.k3Xb9aQ2LmPq";
const billing = "https://hostfix.co.nz/app/billing";
const profile = "https://hostfix.co.nz/tradie/profile";
const longTitle = "Unblock a sink, basin, shower or bath drain";
const longProperty = "The Lakeview Penthouse Apartment 14B";
const business = "Mike Fitzgerald at Wakatipu Plumbing Ltd";
const when = "between 10:30am and 12:30pm Wed 18 Nov";
const big = 123450;

const samples: Record<string, string> = {
  signInCode: texts.signInCode("123456"),
  offer: texts.offer({ title: longTitle, suburb: "Arthurs Point", payoutCents: 23250, currency: "NZD", deadline: "12:15pm tomorrow", minutes: 15, urgent: false, link }),
  offerUrgent: texts.offer({ title: longTitle, suburb: "Arthurs Point", payoutCents: 63250, currency: "NZD", deadline: "12:15pm today", minutes: 15, urgent: true, urgentShareCents: 4250, link }),
  offerOpen: texts.offerOpen({ title: longTitle, suburb: "Arthurs Point", payoutCents: 123250, currency: "NZD", deadline: "12:15pm tomorrow", minutes: 15, urgent: false, link }),
  jobYours: texts.jobYours({ number: 104237, link }),
  jobCancelledTradie: texts.jobCancelledTradie({ number: 104237, suburb: "Arthurs Point" }),
  quoteApproved: texts.quoteApproved({ number: 104237, amountCents: big, currency: "NZD", link }),
  quoteDeclined: texts.quoteDeclined({ number: 104237, link }),
  calloutDecided: texts.calloutDecided({ number: 104237, paid: false, amountCents: 19000, currency: "NZD" }),
  calloutDecidedPaid: texts.calloutDecided({ number: 104237, paid: true, amountCents: 19000, currency: "NZD" }),
  payoutSent: texts.payoutSent({ number: 104237, amountCents: big, currency: "NZD", deductedCents: 61725 }),
  payoutOnHold: texts.payoutOnHold({ number: 104237 }),
  payoutCheckHeld: texts.payoutCheckHeld({ number: 104237 }),
  balanceOwed: texts.balanceOwed({ number: 104237, amountCents: big, currency: "NZD" }),
  feeChange: texts.feeChange({ market: "Queenstown Lakes", fromPct: "15%", toPct: "16.5%", date: "Wed 16 Dec" }),
  guestBooked: texts.guestBooked({ tradie: "Christopher", title: longTitle, when }),
  guestOnTheWay: texts.guestOnTheWay({ tradie: "Christopher", title: longTitle }),
  cardNeeded: texts.cardNeeded({ property: longProperty, title: longTitle, problem: "unpaid", link: billing }),
  hazardAdded: texts.hazardAdded({ tradie: business, property: longProperty, hazard: "The deck boards by the back door are rotten and give way underfoot", link: jobLink }),
  receiptCheckHeld: texts.receiptCheckHeld({ number: 104237 }),
  receiptMissingTradie: texts.receiptMissingTradie({ number: 104237, what: "15 mm copper elbows and two metres of pipe", amountCents: big, currency: "NZD", link }),
  tradieApproved: texts.tradieApproved({ market: "Queenstown Lakes", link: profile }),
  tradieInvite: texts.tradieInvite({ name: "Christopher Fitzgerald", link: "https://hostfix.co.nz/sign-up/tradie?invite=Ab3xK9mQ2LpR" }),
  licenceExpiring: texts.licenceExpiring({ trade: "electrician", date: "Mon 30 Nov 2026", link: profile }),
  insuranceExpiring: texts.insuranceExpiring({ date: "Mon 30 Nov 2026", link: profile }),
  guestReport: texts.guestReport({ property: longProperty, title: longTitle, link: jobLink }),
  guestReportReminder: texts.guestReportReminder({ property: longProperty, link: jobLink }),
  teamReport: texts.teamReport({ reporter: "Mele Fifita-Longname", property: longProperty, title: longTitle, link: jobLink }),
  teamInvite: texts.teamInvite({ name: "Mele Fifita", owner: "Samantha Fitzgerald", link: "https://hostfix.co.nz/r/Ab3xK9mQ2LpRAb3xK9mQ2LpR" }),
  jobLogged: texts.jobLogged({ reporter: "Sam the cleaner", property: longProperty, title: longTitle, totalCents: big, currency: "NZD", link: jobLink }),
  jobBooked: texts.jobBooked({ tradie: business, property: longProperty, when, link: jobLink }),
  tradieArrived: texts.tradieArrived({ tradie: business, property: longProperty, link: jobLink }),
  notTakenYet: texts.notTakenYet({ property: longProperty, link: jobLink }),
  laterTimeOffered: texts.laterTimeOffered({ tradie: business, hours: 24, when, link: jobLink }),
  laterTimeAccepted: texts.laterTimeAccepted({ number: 104237, when, link }),
  laterTimeSentOn: texts.laterTimeSentOn({ number: 104237 }),
  stillArranging: texts.stillArranging({ property: longProperty }),
  quoteNeedsApproval: texts.quoteNeedsApproval({ tradie: business, amountCents: big, currency: "NZD", property: longProperty, link: jobLink }),
  quoteGoingAhead: texts.quoteGoingAhead({ tradie: business, amountCents: big, currency: "NZD", property: longProperty, link: jobLink }),
  notDescribed: texts.notDescribed({ tradie: business, property: longProperty, amountCents: big, currency: "NZD", link: jobLink }),
  jobDone: texts.jobDone({ title: longTitle, property: longProperty, totalCents: big, currency: "NZD", link: jobLink }),
  jobCheck: texts.jobCheck({ title: longTitle, property: longProperty, totalCents: big, currency: "NZD", flags: ["arrived_far", "quick_finish"], link: jobLink }),
  jobCheckOne: texts.jobCheck({ title: longTitle, property: longProperty, totalCents: big, currency: "NZD", flags: ["old_photo"], link: jobLink }),
  partsAdded: texts.partsAdded({ tradie: business, what: "Mixer tap cartridge (40 mm) x 2, Toilet cistern inlet valve", amountCents: 14906, currency: "NZD", limitCents: 15000, link: jobLink }),
  partsNeedApproval: texts.partsNeedApproval({ tradie: business, what: "Hot water cylinder element and thermostat kit", amountCents: big, currency: "NZD", link: jobLink }),
  receiptMissingOwner: texts.receiptMissingOwner({ number: 104237, what: "15 mm copper elbows and two metres of pipe", amountCents: big, currency: "NZD", charged: true }),
  boughtPartsCharged: texts.boughtPartsCharged({ number: 104237, property: longProperty, totalCents: big, currency: "NZD", link: jobLink }),
  jobCancelledOwner: texts.jobCancelledOwner({ title: longTitle, property: longProperty }),
  paymentFailed: texts.paymentFailed({ amountCents: big, currency: "NZD", number: 104237, link: billing }),
  membershipFailed: texts.membershipFailed({ property: longProperty, link: billing }),
  disputeReceived: texts.disputeReceived({ number: 104237 }),
  reporterBooked: texts.reporterBooked({ property: longProperty, when, knock: true }),
  reporterDone: texts.reporterDone({ property: longProperty }),
  referralThanks: texts.referralThanks({ name: "Christopher Fitzgerald", link: "https://hostfix.co.nz/refer/Ab3xK9mQ2LpR" }),
};

describe("every text the product sends", () => {
  it("has a sample here, so a new text cannot skip these checks", () => {
    const names = new Set(Object.keys(samples).map((name) => name.replace(/(Urgent|One|Paid)$/, "")));
    expect([...names].sort()).toEqual(Object.keys(texts).sort());
  });

  it.each(Object.entries(samples))("%s says who it is from", (_name, text) => {
    expect(text.startsWith("HostFix")).toBe(true);
  });

  it.each(Object.entries(samples))("%s uses only the basic phone alphabet: no curly quotes, no emoji", (_name, text) => {
    expect(isGsm7(text)).toBe(true);
  });

  it.each(Object.entries(samples))("%s fits in one 160-character text, even with \"Reply STOP to opt out\" added", (_name, text) => {
    const withStop = `${text} ${STOP_LINE}`;
    expect(withStop.length).toBeLessThanOrEqual(160);
    expect(smsParts(withStop)).toBe(1);
  });

  it("puts the pay and the deadline in a normal offer", () => {
    const text = texts.offer({ title: "Unblock a toilet", suburb: "Frankton", payoutCents: 18700, currency: "NZD", deadline: "4:15pm today", minutes: 15, urgent: false, link });
    expect(text).toBe(`HostFix: Unblock a toilet, Frankton: NZ$187, by 4:15pm today. 15 min: ${link}`);
  });

  it("tells the tradie, on an urgent offer, that the urgent share is paid only if they are on site by the deadline", () => {
    // PL-01 urgent: 19000 menu share + 4250 urgent share (5000 less 15%, 750) = 23250.
    const text = texts.offer({ title: "Toilet seat or cistern parts", suburb: "Frankton", payoutCents: 23250, currency: "NZD", deadline: "2pm today", minutes: 15, urgent: true, urgentShareCents: 4250, link });
    expect(text).toBe(`HostFix URGENT Toilet seat or... Frankton: NZ$232.50 (NZ$42.50 if there by 2pm today) ${link}`);
  });

  it("never puts the address in an offer or the job-yours text: it is only on the job page (Joe, 2026-11-20)", () => {
    for (const text of [samples.offer, samples.offerUrgent, samples.offerOpen, samples.jobYours, samples.laterTimeAccepted]) {
      expect(text).not.toMatch(/Highway|Esplanade|Street|Road|Apartment|\d+ [A-Z][a-z]+ /);
    }
  });

  it("never tells a tradie the street address before they accept", () => {
    expect(samples.offer).not.toMatch(/Highway|Esplanade|\d+[A-Z]? [A-Z][a-z]+ (Street|Road|Esplanade)/);
  });
});

describe("helpers", () => {
  it("shortens long names without cutting mid-way through the limit", () => {
    expect(clip("short", 20)).toBe("short");
    expect(clip(longTitle, 20)).toBe("Unblock a sink, b...");
    expect(clip(longTitle, 20).length).toBeLessThanOrEqual(20);
    expect(clip("  spaced   out  ", 20)).toBe("spaced out");
  });

  it("hides the secret part of one-tap links in the log", () => {
    expect(redactLinks(`Yours for 15 min: ${link}`)).toBe("Yours for 15 min: https://hostfix.co.nz/o/...");
    expect(redactLinks("See https://hostfix.co.nz/j/1042.k3Xb9aQ2 and https://hostfix.co.nz/app")).toBe(
      "See https://hostfix.co.nz/j/... and https://hostfix.co.nz/app",
    );
  });
});
