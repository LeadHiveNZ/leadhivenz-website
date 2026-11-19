import { describe, expect, it } from "vitest";
import { isGsm7, smsParts } from "@/lib/notify/gsm";
import { clip, texts } from "@/lib/notify/messages";
import { redactLinks } from "@/lib/notify/outbox";

const link = "https://hostfix.co.nz/o/Ab3xK9mQ2LpR";
const longTitle = "Unblock a sink, basin, shower or bath drain";
const longProperty = "The Lakeview Penthouse Apartment 14B";

const samples: Record<string, string> = {
  signInCode: texts.signInCode("123456"),
  offer: texts.offer({ title: longTitle, suburb: "Frankton", payoutCents: 17800, currency: "NZD", deadline: "4:15pm today", minutes: 15, urgent: true, urgentShareCents: 4250, link }),
  offerOpen: texts.offerOpen({ title: longTitle, suburb: "Frankton", payoutCents: 17800, currency: "NZD", deadline: "4:15pm today", minutes: 15, urgent: false, link }),
  jobYours: texts.jobYours({ number: 1042, address: "14B Lake Esplanade, Queenstown 9300", link }),
  jobCancelledTradie: texts.jobCancelledTradie({ number: 1042, suburb: "Frankton" }),
  quoteApproved: texts.quoteApproved({ number: 1042, amountCents: 52000, currency: "NZD", link }),
  quoteDeclined: texts.quoteDeclined({ number: 1042, link }),
  payoutSent: texts.payoutSent({ number: 1042, amountCents: 21000, currency: "NZD" }),
  payoutOnHold: texts.payoutOnHold({ number: 1042 }),
  payoutCheckHeld: texts.payoutCheckHeld({ number: 1042 }),
  receiptCheckHeld: texts.receiptCheckHeld({ number: 1042 }),
  receiptMissingTradie: texts.receiptMissingTradie({ number: 1042, what: "15 mm copper elbows and two metres of pipe", amountCents: 35100, currency: "NZD", link }),
  tradieApproved: texts.tradieApproved({ market: "Queenstown", link }),
  tradieInvite: texts.tradieInvite({ name: "Tane Tradie", link }),
  licenceExpiring: texts.licenceExpiring({ trade: "plumber", date: "30 Nov 2026", link }),
  insuranceExpiring: texts.insuranceExpiring({ date: "30 Nov 2026", link }),
  guestReport: texts.guestReport({ property: longProperty, title: longTitle, link }),
  guestReportReminder: texts.guestReportReminder({ property: longProperty, link }),
  teamReport: texts.teamReport({ reporter: "Mele Fifita-Longname", property: longProperty, title: longTitle, link }),
  teamInvite: texts.teamInvite({ name: "Mele Fifita", owner: "Samantha", link: "https://hostfix.co.nz/r/Ab3xK9mQ2LpRAb3xK9mQ2LpR" }),
  jobLogged: texts.jobLogged({ reporter: "Sam the cleaner", property: longProperty, title: longTitle, totalCents: 38000, currency: "NZD", link }),
  jobBooked: texts.jobBooked({ tradie: "Mike at Wakatipu Plumbing", property: longProperty, when: "between 1pm and 3pm Wed 18 Nov", link }),
  tradieArrived: texts.tradieArrived({ tradie: "Mike at Wakatipu Plumbing", property: longProperty, link }),
  notTakenYet: texts.notTakenYet({ property: longProperty, link }),
  laterTimeOffered: texts.laterTimeOffered({ tradie: "Mike at Wakatipu Plumbing", hours: 24, when: "between 1pm and 3pm Wed 18 Nov", link }),
  laterTimeAccepted: texts.laterTimeAccepted({ number: 1042, when: "between 1pm and 3pm Wed 18 Nov", link }),
  laterTimeSentOn: texts.laterTimeSentOn({ number: 1042 }),
  stillArranging: texts.stillArranging({ property: longProperty }),
  quoteNeedsApproval: texts.quoteNeedsApproval({ tradie: "Mike at Wakatipu Plumbing", amountCents: 52000, currency: "NZD", property: longProperty, link }),
  quoteGoingAhead: texts.quoteGoingAhead({ tradie: "Mike at Wakatipu Plumbing", amountCents: 32000, currency: "NZD", property: longProperty, link }),
  jobDone: texts.jobDone({ title: longTitle, property: longProperty, totalCents: 38000, currency: "NZD", link }),
  jobCheck: texts.jobCheck({ title: longTitle, property: longProperty, totalCents: 38000, currency: "NZD", flags: ["arrived_far", "quick_finish"], link }),
  partsAdded: texts.partsAdded({ tradie: "Mike at Wakatipu Plumbing", what: "Mixer tap cartridge (40 mm) x 2, Toilet cistern inlet valve", amountCents: 8906, currency: "NZD", limitCents: 15000, link }),
  partsNeedApproval: texts.partsNeedApproval({ tradie: "Mike at Wakatipu Plumbing", what: "Hot water cylinder element and thermostat kit", amountCents: 36000, currency: "NZD", link }),
  receiptMissingOwner: texts.receiptMissingOwner({ number: 1042, what: "15 mm copper elbows and two metres of pipe", amountCents: 36000, currency: "NZD", charged: true }),
  boughtPartsCharged: texts.boughtPartsCharged({ number: 1042, property: longProperty, totalCents: 30000, currency: "NZD", link }),
  jobCancelledOwner: texts.jobCancelledOwner({ title: longTitle, property: longProperty }),
  paymentFailed: texts.paymentFailed({ amountCents: 38000, currency: "NZD", number: 1042, link }),
  membershipFailed: texts.membershipFailed({ property: longProperty, link }),
  disputeReceived: texts.disputeReceived({ number: 1042 }),
  reporterBooked: texts.reporterBooked({ property: longProperty, when: "between 1pm and 3pm Wed 18 Nov" }),
  reporterDone: texts.reporterDone({ property: longProperty }),
  referralThanks: texts.referralThanks({ name: "Sam Cleaner", link }),
};

describe("every text the product sends", () => {
  it("has a sample here, so a new text cannot skip these checks", () => {
    expect(Object.keys(samples).sort()).toEqual(Object.keys(texts).sort());
  });

  it.each(Object.entries(samples))("%s says who it is from", (_name, text) => {
    expect(text.startsWith("HostFix")).toBe(true);
  });

  it.each(Object.entries(samples))("%s uses only the basic phone alphabet", (_name, text) => {
    expect(isGsm7(text)).toBe(true);
  });

  it.each(Object.entries(samples))("%s fits in two texts even with long names", (_name, text) => {
    expect(smsParts(text)).toBeLessThanOrEqual(2);
  });

  it("keeps the job offer to a single text for a normal job", () => {
    const text = texts.offer({ title: "Unblock a toilet", suburb: "Frankton", payoutCents: 18700, currency: "NZD", deadline: "4:15pm today", minutes: 15, urgent: false, link });
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text).toContain("Pays NZ$187");
    expect(text).toContain("4:15pm today");
    expect(text).toContain(link);
  });

  it("tells the tradie, on an urgent offer, that the urgent share is paid only if they are on site by the deadline", () => {
    // PL-01 urgent: 19000 menu share + 4250 urgent share (5000 less 15%, 750) = 23250.
    const text = texts.offer({ title: "Toilet seat or cistern parts", suburb: "Frankton", payoutCents: 23250, currency: "NZD", deadline: "2pm today", minutes: 15, urgent: true, urgentShareCents: 4250, link });
    expect(text).toContain("Pays NZ$232.50. NZ$42.50 of it only if on site by 2pm today.");
  });

  it("never tells a tradie the street address before they accept", () => {
    expect(samples.offer).not.toMatch(/Esplanade|\d+[A-Z]? [A-Z][a-z]+ (Street|Road|Esplanade)/);
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
