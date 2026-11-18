import { brand } from "@config/brand";
import { formatMoney } from "@/lib/money";

/**
 * THE WORDS OF EVERY TEXT. One place, so the tone stays the same and each
 * text can be checked for length. A text is cheapest at 160 characters or
 * fewer; the tests fail if a normal one runs past two texts' worth.
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
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const texts = {
  signInCode: (code: string) => `${B} code: ${code}. It works for 10 minutes. Do not share it with anyone.`,

  // ---- to tradies -------------------------------------------------------
  offer: (o: { title: string; suburb: string; payoutCents: number; currency: string; deadline: string; minutes: number; urgent: boolean; link: string }) =>
    `${B}${o.urgent ? " URGENT" : ""}: ${clip(o.title, 44)}, ${clip(o.suburb || "local", 18)}. Pays ${money(o.payoutCents, o.currency)}. On site by ${o.deadline}. Yours for ${o.minutes} min: ${o.link}`,

  offerOpen: (o: { title: string; suburb: string; payoutCents: number; currency: string; deadline: string; minutes: number; urgent: boolean; link: string }) =>
    `${B}${o.urgent ? " URGENT" : ""}: ${clip(o.title, 44)}, ${clip(o.suburb || "local", 18)}. Pays ${money(o.payoutCents, o.currency)}. On site by ${o.deadline}. First to accept gets it: ${o.link}`,

  jobYours: (o: { number: number; address: string; link: string }) =>
    `${B}: job ${o.number} is yours. ${clip(o.address, 60)}. Access notes and next steps: ${o.link}`,

  jobCancelledTradie: (o: { number: number; suburb: string }) =>
    `${B}: job ${o.number}${o.suburb ? ` in ${clip(o.suburb, 20)}` : ""} has been cancelled. No need to attend.`,

  quoteApproved: (o: { number: number; amountCents: number; currency: string; link: string }) =>
    `${B} job ${o.number}: the owner approved your quote of ${money(o.amountCents, o.currency)}. Go ahead. ${o.link}`,

  quoteDeclined: (o: { number: number; link: string }) =>
    `${B} job ${o.number}: the owner said no to the quote. Finish what you came for and tap Done. ${o.link}`,

  payoutSent: (o: { number: number; amountCents: number; currency: string }) =>
    `${B}: ${money(o.amountCents, o.currency)} for job ${o.number} is on its way to your bank account.`,

  payoutOnHold: (o: { number: number }) =>
    `${B} job ${o.number}: the owner has raised a problem, so your payment is on hold while we sort it out. We will be in touch today.`,

  tradieApproved: (o: { market: string; link: string }) =>
    `${B}: you are approved for jobs in ${o.market}. Add your bank details so we can pay you: ${o.link}`,

  tradieInvite: (o: { name: string; link: string }) =>
    `${B}: hi ${first(o.name)}, we are ready for you. Finish your details here and start getting fixed-price jobs by text: ${o.link}`,

  licenceExpiring: (o: { trade: string; date: string; link: string }) =>
    `${B}: your ${o.trade} licence on file runs out on ${o.date}. Update it to keep getting offers: ${o.link}`,

  insuranceExpiring: (o: { date: string; link: string }) =>
    `${B}: your public liability insurance on file runs out on ${o.date}. Add your renewed policy and upload its certificate to keep getting offers: ${o.link}`,

  // ---- to cleaners and co-hosts -----------------------------------------
  teamInvite: (o: { name: string; owner: string; link: string }) =>
    `${B}: hi ${clip(first(o.name), 16)}, ${clip(o.owner, 16)} has added you to their team. Save this link and report anything that needs fixing at their houses: ${o.link}`,

  // ---- to owners --------------------------------------------------------
  guestReport: (o: { property: string; title: string; link: string }) =>
    `${B}: a guest at ${clip(o.property, 28)} reported "${clip(o.title, 40)}". See it and tell us whether to send someone: ${o.link}`,

  teamReport: (o: { reporter: string; property: string; title: string; link: string }) =>
    `${B}: ${clip(o.reporter, 20)} reported "${clip(o.title, 40)}" at ${clip(o.property, 28)}. You asked to say yes first. Send someone? ${o.link}`,

  guestReportReminder: (o: { property: string; link: string }) =>
    `${B}: the report at ${clip(o.property, 28)} is still waiting for your go-ahead. Nobody has been sent yet: ${o.link}`,

  jobLogged: (o: { reporter: string; property: string; title: string; totalCents: number; currency: string; link: string }) =>
    `${B}: ${clip(o.reporter, 20)} logged "${clip(o.title, 36)}" at ${clip(o.property, 24)} (${money(o.totalCents, o.currency)}). Finding a tradie now. ${o.link}`,

  jobBooked: (o: { tradie: string; property: string; deadline: string; link: string }) =>
    `${B}: ${clip(o.tradie, 30)} is booked for ${clip(o.property, 28)}, on site by ${o.deadline}. ${o.link}`,

  tradieArrived: (o: { tradie: string; property: string }) => `${B}: ${clip(o.tradie, 30)} has arrived at ${clip(o.property, 28)}.`,

  stillArranging: (o: { property: string }) =>
    `${B}: we are still arranging a tradie for ${clip(o.property, 28)}. Our team is on it and will text you as soon as someone is booked.`,

  quoteNeedsApproval: (o: { tradie: string; amountCents: number; currency: string; property: string; link: string }) =>
    `${B}: ${clip(o.tradie, 26)} has quoted ${money(o.amountCents, o.currency)} for more work at ${clip(o.property, 24)}. Nothing starts until you say yes: ${o.link}`,

  quoteGoingAhead: (o: { tradie: string; amountCents: number; currency: string; property: string; link: string }) =>
    `${B}: ${clip(o.tradie, 26)} is doing ${money(o.amountCents, o.currency)} of extra work at ${clip(o.property, 24)}, inside your pre-approved limit. Details: ${o.link}`,

  jobDone: (o: { title: string; property: string; totalCents: number; currency: string; link: string }) =>
    `${B}: "${clip(o.title, 36)}" at ${clip(o.property, 24)} is done. ${money(o.totalCents, o.currency)} charged to your card. Photos, and what to do if something is wrong: ${o.link}`,

  jobCancelledOwner: (o: { title: string; property: string }) =>
    `${B}: "${clip(o.title, 40)}" at ${clip(o.property, 28)} has been cancelled. You have not been charged.`,

  paymentFailed: (o: { amountCents: number; currency: string; number: number; link: string }) =>
    `${B}: we could not charge your card ${money(o.amountCents, o.currency)} for job ${o.number}. Please update your card: ${o.link}`,

  windowMissed: (o: { property: string; amountCents: number; currency: string }) =>
    `${B}: we missed our promised time at ${clip(o.property, 28)}, so ${money(o.amountCents, o.currency)} of this job is on us. It comes off the bill when the job is done. We are sorry, and we are still on it.`,

  membershipFailed: (o: { property: string; link: string }) =>
    `${B}: your membership payment for ${clip(o.property, 28)} did not go through. Update your card to keep your cover: ${o.link}`,

  disputeReceived: (o: { number: number }) =>
    `${B}: thanks for telling us about job ${o.number}. The tradie's payment is on hold and one of our team will be in touch.`,

  // ---- to cleaners and guests who reported -------------------------------
  reporterBooked: (o: { property: string; deadline: string }) =>
    `${B}: thanks for reporting the problem at ${clip(o.property, 28)}. A tradie is booked and will be there by ${o.deadline}.`,

  reporterDone: (o: { property: string }) => `${B}: the problem you reported at ${clip(o.property, 28)} has been fixed. Thank you.`,

  referralThanks: (o: { name: string; link: string }) =>
    `${B}: thanks ${first(o.name)}. Share this link with owners. When one stays a member for 3 months, we pay you: ${o.link}`,
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
