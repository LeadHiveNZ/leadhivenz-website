/**
 * HOW THE MENU IS GROUPED for people reading it: on the report form, on the
 * landing page and in the price list.
 *
 * The menu's codes say what kind of job it is (the letters before the dash),
 * and that is a better way to find a job than the trade that does it: a third
 * of the menu is handyman work. A code this list does not know falls back to
 * its trade's group, so a job added later always lands somewhere sensible.
 */

const GROUPS_BY_TRADE: Record<string, string> = {
  handyman: "Odd jobs and repairs",
  plumber: "Plumbing",
  electrician: "Power and lights",
  gasfitter: "Gas and hot water",
  appliance_tech: "Appliances",
  heat_pump_tech: "Heating and cooling",
  locksmith: "Locks and keys",
  cleaner: "Cleaning",
  window_cleaner: "Cleaning",
  carpet_cleaner: "Cleaning",
  gardener: "Outside",
  builder: "Building and painting",
  painter: "Building and painting",
  roofer: "Roof and gutters",
  pest_control: "Pests",
  pool_spa: "Spa and pool",
  drainage_septic: "Drains and septic",
};

const GROUPS_BY_CODE: Record<string, string> = {
  HM: "Odd jobs and repairs",
  PL: "Plumbing",
  EL: "Power and lights",
  GA: "Gas and hot water",
  HP: "Heating and cooling",
  AP: "Appliances",
  LS: "Locks and keys",
  LK: "Locks and keys",
  SP: "Spa and pool",
  WI: "Winter and frozen pipes",
  CP: "Safety checks",
  GD: "Breakages and lost things",
  PV: "Upkeep",
  OD: "Outside",
  CL: "Cleaning",
  WC: "Cleaning",
  CC: "Cleaning",
  BL: "Building and painting",
  PT: "Building and painting",
  RF: "Roof and gutters",
  PC: "Pests",
  DS: "Drains and septic",
};

export function tradeGroup(trade: string): string {
  return GROUPS_BY_TRADE[trade] ?? trade;
}

export function menuGroup(item: { code: string; trade: string }): string {
  return GROUPS_BY_CODE[item.code.split("-")[0] ?? ""] ?? tradeGroup(item.trade);
}

/** Items in groups, keeping the order the items arrive in (the menu's own order). */
export function groupMenu<T extends { code: string; trade: string }>(items: T[]): { group: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = menuGroup(item);
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return [...groups.entries()].map(([group, entries]) => ({ group, items: entries }));
}
