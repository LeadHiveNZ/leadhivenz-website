import { brand } from "@config/brand";
import { formatMoney } from "@/lib/money";

/**
 * THE WORDS OF EVERY TEXT. One place, so the tone stays the same and each
 * text can be checked for length. Every text fits in one message (160 basic
 * characters) with long but realistic names and links, and still fits with
 * "Reply STOP to opt out" added (DECISIONS.md, 2026-11-20, third entry):
 * tests/unit/messages.test.ts renders each one and checks.
 *
 * Every text starts with the brand name, so the person knows who it is from
 * (required by the anti-spam rules in both countries).
 */

const B = brand.name;

/** Shortens long names so a text stays short. "Unblock a sink, basin, shower or bath drain" becomes "Unblock a sink, basin, shower…". */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 3)).trimEnd()}...`;
}

const money = (cents: number, currency: string) => formatMoney(cents, currency);

/** Added to every job offer, and to the first text a phone number ever gets from us. */
export const STOP_LINE = "Reply STOP to opt out";

/** What a flagged job's owner is asked about, in a few neutral words: never that the tradie did anything wrong. */
export function checkSubject(flags: string[]): string {
  const location = flags.some((flag) => flag.startsWith("arrived_") || flag.startsWith("finished_"));
  const time = flags.includes("quick_finish");
  const photos = flags.includes("old_photo");
  const count = [location, time, photos].filter(Boolean).length;
  if (count !== 1) return "everything";
  return location ? "the tradie's location" : time ? "how long the job took" : "when the photos were taken";
}
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

type OfferWords = {
  title: string; suburb: string; payoutCents: number; currency: string; deadline: string; minutes: number; urgent: boolean; link: string;
  /** Urgent only: the tradie's share of the urgent surcharge, paid only if they are on site by the deadline. */
  urgentShareCents?: number | null;
};

function offerHead(o: OfferWords): string {
  const pay = money(o.payoutCents, o.currency);
  if (o.urgent && o.urgentShareCents) {
    return `${B} URGENT ${clip(o.title, 18)} ${clip(o.suburb || "local", 10)}: ${pay} (${money(o.urgentShareCents, o.currency)} if there by ${o.deadline})`;
  }
  return `${B}${o.urgent ? " URGENT" : ""}: ${clip(o.title, 24)}, ${clip(o.suburb || "local", 12)}: ${pay}, by ${o.deadline}.`;
}

export const texts = {
  signInCode: (code: string) => `${B} code: ${code}. It works for 10 minutes. Do not share it with anyone.`,

  // ---- to tradies -------------------------------------------------------
  // An urgent offer says the urgent share is only paid if they are there by the deadline (DECISIONS.md, 2026-11-18).
  // An urgent offer leaves out the minutes to fit one text: the offer page shows how long is left.
  offer: (o: OfferWords) => (o.urgent && o.urgentShareCents ? `${offerHead(o)} ${o.link}` : `${offerHead(o)} ${o.minutes} min: ${o.link}`),

  offerOpen: (o: OfferWords) => `${offerHead(o)} Open: ${o.link}`,

  // Never the address: it is only on the job page, so it is not left in their messages if the job is later cancelled or reassigned.
  jobYours: (o: { number: number; link: string }) => `${B}: job ${o.number} is yours. The address and access notes are here: ${o.link}`,

  laterTimeAccepted: (o: { number: number; when: string; link: string }) => `${B}: job ${o.number} is yours, the owner will wait: ${o.when}. ${o.link}`,

  laterTimeSentOn: (o: { number: number }) => `${B} job ${o.number}: the owner needs someone sooner, so it has gone to another tradie. Thanks. This never counts against you.`,

  jobCancelledTradie: (o: { number: number; suburb: string }) => `${B}: job ${o.number}${o.suburb ? ` in ${clip(o.suburb, 20)}` : ""} is cancelled. No need to go.`,

  /** The owner cancelled after the tradie tapped Arrived (DECISIONS.md, 2026-11-23): paid as for a call-out. */
  jobCancelledOnSiteTradie: (o: { number: number; payoutCents: number; currency: string }) =>
    `${B}: job ${o.number} was cancelled after you arrived. You're paid the call-out, ${money(o.payoutCents, o.currency)}, at the usual time.`,

  /** Big work whose deposit the owner's card declined (DECISIONS.md, 2026-11-23, second entry). */
  quoteCannotStart: (o: { number: number; link: string }) =>
    `${B} job ${o.number}: the owner's card declined the deposit: don't start yet. We'll text you. ${o.link}`,

  /** Big work approved, the 50% deposit on its way from the owner's bank (DECISIONS.md, 2026-11-23, second entry). */
  depositClearing: (o: { number: number; link: string }) =>
    `${B} job ${o.number}: approved, deposit clearing (usually 3-4 working days). Don't start yet. ${o.link}`,

  /** The deposit has cleared: the tradie can start. */
  depositCleared: (o: { number: number; link: string }) =>
    `${B} job ${o.number}: deposit cleared, go ahead with the approved work. ${o.link}`,

  /** The deposit from the owner's bank did not go through: the work is not approved. */
  depositFailedTradie: (o: { number: number; link: string }) =>
    `${B} job ${o.number}: the owner's deposit didn't go through: don't start. We'll text you. ${o.link}`,

  /** The team asks for a part's receipt (a spot check, DECISIONS.md, 2026-11-23). Neutral: never says anything is wrong. */
  receiptRequested: (o: { number: number; what: string; days: number; link: string }) =>
    `${B} job ${o.number}: spot check. Add the receipt for "${clip(o.what, 16)}" in ${o.days} days. Pay waits: ${o.link}`,

  /** An owner the tradie works for already, invited to book them through the app (DECISIONS.md, 2026-11-23). */
  clientInvite: (o: { tradie: string; link: string }) =>
    `${B}: ${clip(o.tradie, 18)} invites you to book them through ${B}: ${o.link}`,

  /** A tradie an owner brought, invited to sign up (DECISIONS.md, 2026-11-23). */
  ownTradieInvite: (o: { owner: string; link: string }) =>
    `${B}: ${clip(o.owner, 18)} wants to book you through ${B}. Sign up: ${o.link}`,

  quoteApproved: (o: { number: number; amountCents: number; currency: string; link: string }) =>
    `${B} job ${o.number}: the owner approved your ${money(o.amountCents, o.currency)} quote. Go ahead. ${o.link}`,

  quoteDeclined: (o: { number: number; link: string }) => `${B} job ${o.number}: the owner said no to the quote. Finish what you came for and tap Job done. ${o.link}`,

  /** The team decided a "not the job described" call-out the owner objected to. */
  calloutDecided: (o: { number: number; paid: boolean; amountCents: number; currency: string }) =>
    o.paid
      ? `${B} job ${o.number}: our team looked at your photos. The ${money(o.amountCents, o.currency)} call-out is paid.`
      : `${B} job ${o.number}: our team looked at the photos and found it was the job described, so no call-out is paid.`,

  payoutSent: (o: { number: number; amountCents: number; currency: string; deductedCents?: number }) =>
    o.deductedCents
      ? `${B}: ${money(o.amountCents - o.deductedCents, o.currency)} for job ${o.number} is on its way to your bank. ${money(o.deductedCents, o.currency)} came off towards what you owe us.`
      : `${B}: ${money(o.amountCents, o.currency)} for job ${o.number} is on its way to your bank.`,

  payoutOnHold: (o: { number: number }) => `${B} job ${o.number}: the owner raised a problem, so your payment is on hold while we sort it. We will be in touch today.`,

  /** The team chose to hold a flagged job's payment (DECISIONS.md, 2026-11-19). Neutral: it never says the tradie did anything wrong. */
  payoutCheckHeld: (o: { number: number }) => `${B} job ${o.number}: we are checking this job, so your payment is on hold for now. Our team will be in touch.`,

  /** A lost chargeback decided as the tradie's fault: what they owe, and how it is taken back. */
  balanceOwed: (o: { number: number; amountCents: number; currency: string }) =>
    `${B} job ${o.number}: the bank took the owner's payment back (bad work or no-show). ${money(o.amountCents, o.currency)} comes off later pay, max half of each.`,

  /** A change to the platform fee, at least 30 days ahead. */
  feeChange: (o: { market: string; fromPct: string; toPct: string; date: string }) =>
    `${B}: from ${o.date} the platform fee in ${clip(o.market, 20)} changes from ${o.fromPct} to ${o.toPct}. Work already on a job keeps its fee.`,

  /** The team is checking a receipt (DECISIONS.md, 2026-11-20). Neutral, like every hold. */
  receiptCheckHeld: (o: { number: number }) => `${B} job ${o.number}: we are checking a receipt, so your payment is on hold for now. Our team will be in touch.`,

  /** No receipt 7 days after Job done: the part came off the job. */
  receiptMissingTradie: (o: { number: number; what: string; amountCents: number; currency: string; link: string | null }) =>
    `${B} job ${o.number}: no receipt for "${clip(o.what, 24)}" in 7 days. It was refunded and ${money(o.amountCents, o.currency)} came off your pay.`,

  tradieApproved: (o: { market: string; link: string }) => `${B}: you are approved for jobs in ${clip(o.market, 20)}. Add your bank details so we can pay you: ${o.link}`,

  tradieInvite: (o: { name: string; link: string }) => `${B}: hi ${clip(first(o.name), 12)}, we are ready for you. Finish your details to get jobs: ${o.link}`,

  licenceExpiring: (o: { trade: string; date: string; link: string }) => `${B}: your ${clip(o.trade, 14)} licence runs out ${o.date}. Update it to keep getting offers: ${o.link}`,

  insuranceExpiring: (o: { date: string; link: string }) => `${B}: your liability insurance runs out ${o.date}. Add the renewal to keep getting offers: ${o.link}`,

  // ---- to cleaners and co-hosts -----------------------------------------
  teamInvite: (o: { name: string; owner: string; link: string }) =>
    `${B}: hi ${clip(first(o.name), 12)}, ${clip(o.owner, 14)} added you to their team. Report anything broken here: ${o.link}`,

  // ---- to owners --------------------------------------------------------
  guestReport: (o: { property: string; title: string; link: string }) =>
    `${B}: a guest at ${clip(o.property, 20)} reported "${clip(o.title, 24)}". Send someone? ${o.link}`,

  teamReport: (o: { reporter: string; property: string; title: string; link: string }) =>
    `${B}: ${clip(o.reporter, 14)} reported "${clip(o.title, 22)}" at ${clip(o.property, 18)}. Send someone? ${o.link}`,

  guestReportReminder: (o: { property: string; link: string }) => `${B}: the report at ${clip(o.property, 24)} still needs your yes. Nobody sent yet: ${o.link}`,

  jobLogged: (o: { reporter: string; property: string; title: string; totalCents: number; currency: string; link: string }) =>
    `${B}: ${clip(o.reporter, 14)} logged "${clip(o.title, 20)}" at ${clip(o.property, 16)} (${money(o.totalCents, o.currency)}). ${o.link}`,

  /** `when` is "by 4:15pm today" for urgent, or the window the tradie chose: "between 9am and 11am tomorrow". */
  jobBooked: (o: { tradie: string; property: string; when: string; link: string }) =>
    `${B}: ${clip(o.tradie, 16)} booked for ${clip(o.property, 14)}, ${o.when} ${o.link}`,

  tradieArrived: (o: { tradie: string; property: string; link: string }) =>
    `${B}: ${clip(o.tradie, 20)} has arrived at ${clip(o.property, 20)}. Not there? Tell us: ${o.link}`,

  stillArranging: (o: { property: string }) => `${B}: we are still arranging a tradie for ${clip(o.property, 28)}. Our team is on it and will text you once someone is booked.`,

  notTakenYet: (o: { property: string; link: string }) =>
    `${B}: no tradie for ${clip(o.property, 16)} yet. We're ringing round. No charge unless it's done. ${o.link}`,

  laterTimeOffered: (o: { tradie: string; hours: number; when: string; link: string }) =>
    `${B}: ${clip(o.tradie, 14)} can come ${o.when}, not in ${o.hours}h. Wait? ${o.link}`,

  quoteNeedsApproval: (o: { tradie: string; amountCents: number; currency: string; property: string; link: string }) =>
    `${B}: ${clip(o.tradie, 16)} quoted ${money(o.amountCents, o.currency)} for more work at ${clip(o.property, 14)}. Yes or no: ${o.link}`,

  quoteGoingAhead: (o: { tradie: string; amountCents: number; currency: string; property: string; link: string }) =>
    `${B}: ${clip(o.tradie, 16)} is doing ${money(o.amountCents, o.currency)} more work at ${clip(o.property, 14)}, in your limit. ${o.link}`,

  /** "Not the job described" (DECISIONS.md, 2026-11-20, third entry): the reason and photos are on the page, with the quote. */
  notDescribed: (o: { tradie: string; property: string; amountCents: number; currency: string; link: string }) =>
    `${B}: ${clip(o.tradie, 16)} says it is not the job described, and quoted ${money(o.amountCents, o.currency)}. See why: ${o.link}`,

  jobDone: (o: { title: string; property: string; totalCents: number; currency: string; link: string }) =>
    `${B}: "${clip(o.title, 22)}" at ${clip(o.property, 16)} is done, ${money(o.totalCents, o.currency)} charged. Photos: ${o.link}`,

  /**
   * A flagged job (DECISIONS.md, 2026-11-19): the same news as jobDone, and a
   * neutral question. The link only opens the page; the answer is a button.
   */
  jobCheck: (o: { title: string; property: string; totalCents?: number | null; currency?: string; flags: string[]; link: string }) =>
    `${B}: ${clip(o.property, 16)} is done. We couldn't confirm ${checkSubject(o.flags)}. Check? ${o.link}`,

  /** A job waiting before it goes to tradies, because the owner's card cannot be charged. */
  cardNeeded: (o: { property: string; title: string; problem: "no_card" | "expired" | "unpaid" | "declined"; link: string }) =>
    `${B}: the job at ${clip(o.property, 18)} is waiting: ${o.problem === "unpaid" ? "a card payment failed" : o.problem === "expired" ? "your card expired" : o.problem === "declined" ? "your card declined" : "no card saved"}. Update it: ${o.link}`,

  /** The hold on an open job could not be renewed (DECISIONS.md, 2026-11-23). The job stays booked. */
  holdRenewFailed: (o: { number: number; link: string }) =>
    `${B}: your card declined renewing the hold for job ${o.number}. It's still booked. Update your card: ${o.link}`,

  /** Cancelled after the tradie arrived: the call-out is charged (DECISIONS.md, 2026-11-23). */
  jobCancelledCallOut: (o: { title: string; amountCents: number; currency: string }) =>
    `${B}: "${clip(o.title, 30)}" is cancelled. The tradie had arrived, so the ${money(o.amountCents, o.currency)} call-out is charged.`,

  callOutCharged: (o: { number: number; totalCents: number; currency: string; link: string }) =>
    `${B}: job ${o.number} was cancelled after the tradie arrived: ${money(o.totalCents, o.currency)} call-out charged. ${o.link}`,

  /** A big quote's deposit declined by the card (DECISIONS.md, 2026-11-23, second entry). */
  quotePaymentFailed: (o: { number: number; amountCents: number; currency: string; link: string }) =>
    `${B} job ${o.number}: your card declined the ${money(o.amountCents, o.currency)} deposit, so the work is not approved. Update it: ${o.link}`,

  /** A big quote's deposit debit from the owner's bank failed or came back. */
  depositFailedOwner: (o: { number: number; amountCents: number; currency: string; link: string }) =>
    `${B} job ${o.number}: the ${money(o.amountCents, o.currency)} deposit from your bank didn't go through, so the work isn't approved. ${o.link}`,

  /** The bank debit at Job done failed: the owner owes it. */
  debitFailedOwner: (o: { number: number; amountCents: number; currency: string; link: string }) =>
    `${B} job ${o.number}: the ${money(o.amountCents, o.currency)} debit from your bank didn't go through. Update your card to pay: ${o.link}`,

  /** A quote paid on approval whose work did not go ahead, refunded. */
  quoteRefunded: (o: { number: number; amountCents: number; currency: string }) =>
    `${B}: job ${o.number}: the ${money(o.amountCents, o.currency)} deposit you paid for the approved work is refunded, as the work did not go ahead.`,

  /** A tradie found a hazard at the property and added it to the property's safety notes. */
  hazardAdded: (o: { tradie: string; property: string; hazard: string; link: string }) =>
    `${B}: ${clip(o.tradie, 18)} noted a hazard at ${clip(o.property, 16)}: "${clip(o.hazard, 28)}" ${o.link}`,

  /** Parts added inside the owner's no-ask limit (DECISIONS.md, 2026-11-20). */
  partsAdded: (o: { tradie: string; what: string; amountCents: number; currency: string; limitCents: number; link: string }) =>
    `${B}: ${clip(o.tradie, 18)} needs ${clip(o.what, 22)}, ${money(o.amountCents, o.currency)}, within your ${money(o.limitCents, o.currency)} limit. ${o.link}`,

  /** Parts above the no-ask limit: the owner says yes on the job page (a button, never the link). */
  partsNeedApproval: (o: { tradie: string; what: string; amountCents: number; currency: string; link: string }) =>
    `${B}: ${clip(o.tradie, 16)} needs ${clip(o.what, 22)}, ${money(o.amountCents, o.currency)}. Yes or no: ${o.link}`,

  /** The part whose receipt never came, refunded. */
  receiptMissingOwner: (o: { number: number; what: string; amountCents: number; currency: string; charged: boolean }) =>
    `${B}: job ${o.number}: "${clip(o.what, 26)}" (${money(o.amountCents, o.currency)}) was ${o.charged ? "refunded to your card" : "taken off your bill"}: no receipt came.`,

  /** A cancelled job charged only for parts already bought for it that could not go back. */
  boughtPartsCharged: (o: { number: number; property: string; totalCents: number; currency: string; link: string }) =>
    `${B}: job ${o.number} was cancelled after parts were bought. ${money(o.totalCents, o.currency)}, their cost, is charged: ${o.link}`,

  jobCancelledOwner: (o: { title: string; property: string }) => `${B}: "${clip(o.title, 30)}" at ${clip(o.property, 24)} is cancelled. You have not been charged.`,

  paymentFailed: (o: { amountCents: number; currency: string; number: number; link: string }) =>
    `${B}: we could not charge your card ${money(o.amountCents, o.currency)} for job ${o.number}. Update your card: ${o.link}`,

  membershipFailed: (o: { property: string; link: string }) => `${B}: the membership payment for ${clip(o.property, 22)} failed. Update your card: ${o.link}`,

  disputeReceived: (o: { number: number }) => `${B}: thanks for telling us about job ${o.number}. The tradie's payment is on hold and our team will be in touch.`,

  // ---- to cleaners and guests who reported -------------------------------
  reporterBooked: (o: { property: string; when: string; knock?: boolean }) =>
    `${B}: a tradie will be at ${clip(o.property, 20)} ${o.when}.${o.knock ? " They'll knock first." : ""}`,

  /** To a guest staying in the house (DECISIONS.md, 2026-11-20, second entry): the tradie's first name, the job and the window. */
  guestBooked: (o: { tradie: string; title: string; when: string }) =>
    `${B}: a ${B} tradie, ${clip(o.tradie, 12)}, is coming to fix ${clip(o.title, 18)} ${o.when}. They'll knock first.`,

  guestOnTheWay: (o: { tradie: string; title: string }) => `${B}: ${clip(o.tradie, 12)}, the ${B} tradie, is on the way to fix ${clip(o.title, 30)}. They'll knock first.`,

  reporterDone: (o: { property: string }) => `${B}: the problem you reported at ${clip(o.property, 28)} has been fixed. Thank you.`,

  referralThanks: (o: { name: string; link: string }) => `${B}: thanks ${clip(first(o.name), 12)}. Share this link with owners. We pay you once one stays 3 months: ${o.link}`,
} as const;

export const emails = {
  signInCode: (code: string) => ({
    subject: `${code} is your ${B} sign-in code`,
    body: `Your ${B} sign-in code is ${code}.\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email. Do not share the code with anyone.`,
  }),

  welcomeOwner: (o: { name: string; link: string }) => ({
    subject: `Welcome to ${B}`,
    body: `Hi ${first(o.name)},\n\nYour ${B} account is ready. Add your first property and choose a membership here:\n${o.link}\n\nOnce a property is a member you get a link and a QR code to put in the property, so your cleaner or a guest can report a problem in under a minute.`,
  }),

  ownerInvite: (o: { name: string; link: string }) => ({
    subject: `${B} is open in your area`,
    body: `Hi ${first(o.name)},\n\nYou asked us to tell you when ${B} opened near you. We are open. Add your property and choose a membership here:\n${o.link}\n\nIt takes about two minutes.`,
    /** The same message short enough for a text. */
    text: `${B}: hi ${first(o.name)}, we are now open in your area. Join here: ${o.link}`,
  }),

  staffInvite: (o: { name: string; role: string; link: string }) => ({
    subject: `You have been added to ${B}`,
    body: `Hi ${first(o.name)},\n\nYou have been added to ${B} as ${o.role === "admin" ? "an admin" : "a dispatcher"}. Sign in with this email address here:\n${o.link}\n\nYou will be sent a six-digit code each time. There is no password.`,
  }),

  exception: (o: { summary: string; link: string }) => ({
    subject: `${B} needs you: ${clip(o.summary, 70)}`,
    body: `${o.summary}\n\nOpen the queue:\n${o.link}`,
  }),
};
