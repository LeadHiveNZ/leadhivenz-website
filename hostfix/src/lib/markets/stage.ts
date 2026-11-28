import { brand } from "@config/brand";
import type { Market } from "@config/markets";

/**
 * WHAT A MARKET'S STAGE LETS OWNERS DO (DECISIONS.md, 2026-11-27, second entry).
 *
 *   live                        owners join, add a card and book jobs
 *   waitlist + pre-launch on    owners join and add their properties. No card
 *                               is taken and no job can be booked yet.
 *   anything else               owners cannot join
 *
 * The pre-launch flag means nothing unless the stage is "waitlist". Every
 * screen and action that cares asks these three questions, never the stage
 * itself, and uses the words below so an owner reads the same thing everywhere.
 */

type Staged = Pick<Market, "stage" | "preLaunch">;

/** Jobs can be booked, cards saved and memberships started. */
export function bookingOpen(market: Staged): boolean {
  return market.stage === "live";
}

/** Owners can set up now, but nothing that needs a card or a tradie is open yet. */
export function inPreLaunch(market: Staged): boolean {
  return market.stage === "waitlist" && Boolean(market.preLaunch);
}

/** An owner can make an account and add properties here. */
export function ownersCanJoin(market: Staged): boolean {
  return bookingOpen(market) || inPreLaunch(market);
}

/** "Queenstown", "Queenstown and Wānaka", "Queenstown, Wānaka and Cromwell". */
export function marketNames(markets: Pick<Market, "name">[]): string {
  const names = [...new Set(markets.map((market) => market.name))];
  if (names.length <= 1) return names[0] ?? "your area";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The words an owner reads in pre-launch, wherever a card, a membership or a job would be. */
export const preLaunchWords = {
  /** The heading of the calm "Opens soon" notice. */
  title: (where: string) => `Bookings open soon in ${where}`,
  /** What happens next. Every part of this is something the app does (go-live email, card then, charged per job). */
  body: "We'll email you the day we go live. You'll add a card then, and it's only charged when a job is done.",
  /** Straight after adding a property. */
  setUp: (where: string) => `You're set up. Bookings open soon in ${where}. We'll email you the day we go live. You'll add a card then, and it's only charged when a job is done.`,
  /** The refusal from anything that would save a card, start a membership or a retainer. */
  noCardYet: (where: string) => `Bookings open soon in ${where}. No card is needed yet: we'll email you the day we go live, and you add one then.`,
  /** The refusal when someone tries to log a job, and the heading on the public report pages. */
  notOpen: (where: string) => `${brand.name} isn't open in ${where} yet`,
  notOpenJobs: (where: string) => `${brand.name} isn't open in ${where} yet. Jobs can be booked from the day we go live.`,
};
