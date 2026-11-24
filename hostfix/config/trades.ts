/**
 * TRADES
 * ---------------------------------------------------------------------------
 * The kinds of tradie on the network. "licenceRequired" means jobs for this
 * trade are only ever offered to someone with a current licence on file.
 * "lbpRequired" means jobs for this trade are only ever offered to someone with
 * a Licensed Building Practitioner (LBP) number on file (the founder's rule for
 * building work, DECISIONS.md, 2026-11-24). Both are checked when a job is
 * offered and again when it is accepted or given to someone by our team.
 *
 * The keys are shared with the separate public sign-up form: never rename one.
 * "other" is "Not sure" on the job form: such a job goes to our team, who pick
 * the trade (src/lib/dispatch/cascade.ts).
 *
 * IMPORTANT: which work legally needs a licence is set by law in each country
 * (in New Zealand: the Plumbers, Gasfitters and Drainlayers Board, the
 * Electrical Workers Registration Board, and the LBP scheme for restricted
 * building work). These flags are a cautious starting point. Confirm them with
 * a professional before launch.
 */
export type Trade = {
  key: string;
  /** What a person calls this trade. */
  label: string;
  licenceRequired: boolean;
  /** Only offered to a tradie with an LBP number on file. */
  lbpRequired?: boolean;
};

export const trades: Trade[] = [
  { key: "handyman", label: "Handyman", licenceRequired: false },
  { key: "cleaner", label: "Cleaner", licenceRequired: false },
  { key: "plumber", label: "Plumber", licenceRequired: true },
  { key: "electrician", label: "Electrician", licenceRequired: true },
  { key: "gasfitter", label: "Gasfitter", licenceRequired: true },
  { key: "appliance_tech", label: "Appliance repair", licenceRequired: true },
  { key: "heat_pump_tech", label: "Heat pump or air conditioning", licenceRequired: true },
  { key: "locksmith", label: "Locksmith", licenceRequired: false },
  { key: "window_cleaner", label: "Window cleaner", licenceRequired: false },
  { key: "gardener", label: "Gardener or landscaper", licenceRequired: false },
  { key: "builder", label: "Builder (LBP)", licenceRequired: false, lbpRequired: true },
  { key: "painter", label: "Painter", licenceRequired: false },
  { key: "roofer", label: "Roofing and gutters", licenceRequired: false },
  { key: "pest_control", label: "Pest control", licenceRequired: false },
  { key: "carpet_cleaner", label: "Carpet and upholstery cleaning", licenceRequired: false },
  { key: "pool_spa", label: "Pool and spa", licenceRequired: false },
  { key: "drainage_septic", label: "Drainage and septic", licenceRequired: true },
  { key: "other", label: "Something else", licenceRequired: false },
];

/** The trade an owner picks when they do not know which trade a job needs. */
export const NOT_SURE_TRADE = "other";

export function findTrade(key: string): Trade | undefined {
  return trades.find((t) => t.key === key);
}

/** True if jobs in this trade only go to a tradie with an LBP number on file. */
export function needsLbp(key: string): boolean {
  return Boolean(findTrade(key)?.lbpRequired);
}

/** The trades a job can be sent to (everything but "Not sure"). */
export const jobTrades: Trade[] = trades.filter((trade) => trade.key !== NOT_SURE_TRADE);
