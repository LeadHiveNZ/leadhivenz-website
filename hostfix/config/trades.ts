/**
 * TRADES
 * ---------------------------------------------------------------------------
 * The kinds of tradie on the network. "licenceRequired" means jobs for this
 * trade are only ever offered to someone with a current licence on file.
 *
 * IMPORTANT: which work legally needs a licence is set by law in each country
 * (in New Zealand: the Plumbers, Gasfitters and Drainlayers Board and the
 * Electrical Workers Registration Board). These flags are a cautious starting
 * point. Confirm them with a professional before launch.
 */
export type Trade = {
  key: string;
  /** What a person calls this trade. */
  label: string;
  licenceRequired: boolean;
};

export const trades: Trade[] = [
  { key: "handyman", label: "Handyman", licenceRequired: false },
  { key: "plumber", label: "Plumber", licenceRequired: true },
  { key: "electrician", label: "Electrician", licenceRequired: true },
  { key: "gasfitter", label: "Gasfitter", licenceRequired: true },
  { key: "appliance_tech", label: "Appliance repair", licenceRequired: true },
  { key: "heat_pump_tech", label: "Heat pump or air conditioning", licenceRequired: true },
  { key: "locksmith", label: "Locksmith", licenceRequired: false },
  { key: "other", label: "Something else", licenceRequired: false },
];

export function findTrade(key: string): Trade | undefined {
  return trades.find((t) => t.key === key);
}
