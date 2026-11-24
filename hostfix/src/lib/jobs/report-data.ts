import { jobTrades, NOT_SURE_TRADE } from "@config/trades";
import { menuGroup, tradeGroup } from "@/lib/markets/menu-groups";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { getMarket, getTier, listMenu } from "@/lib/markets/store";
import type { Property } from "@/lib/properties/service";
import { isAfterHours } from "@/lib/time";
import { urgentIsIncluded } from "./create";

/** Everything the "report a problem" form needs to show the right jobs and the right prices for one property. */
export type ReportFormData = {
  marketName: string;
  country: "NZ" | "AU";
  items: { id: string; name: string; tradeLabel: string; ownerCents: number; tryFirst: string }[];
  offMenuTrades: { key: string; label: string }[];
  currency: string;
  diagnosisCents: number;
  standardHours: number;
  urgentHours: number;
  urgentCents: number;
  urgentIncluded: boolean;
  afterHoursNow: boolean;
  afterHoursCents: number;
};

export async function reportFormData(db: Db, property: Property, audience: "owner" | "team" | "guest"): Promise<ReportFormData | null> {
  const market = await getMarket(db, property.market);
  if (!market) return null;
  const tier = property.tierId ? await getTier(db, property.tierId) : null;
  // In the menu's own order, so the groups appear in the order the menu was written.
  const menu = (await listMenu(db, market.slug))
    .filter((item) => audience !== "guest" || item.guestVisible)
    .sort((a, b) => a.sort - b.sort);
  const at = now();
  return {
    marketName: market.name,
    country: market.country,
    items: menu.map((item) => ({
      id: item.id, name: item.name, tradeLabel: menuGroup(item), ownerCents: item.ownerPriceCents, tryFirst: item.tryFirst,
    })),
    // Every trade, then "Not sure", which goes to our team to pick the trade (DECISIONS.md, 2026-11-24).
    offMenuTrades: [
      // The kind of problem ("Plumbing") where only one trade does it, otherwise the trade's own name ("Window cleaner").
      ...jobTrades.map((trade) => {
        const group = tradeGroup(trade.key);
        const shared = jobTrades.filter((other) => tradeGroup(other.key) === group).length > 1;
        return { key: trade.key, label: group === trade.key || shared ? trade.label : group };
      }),
      { key: NOT_SURE_TRADE, label: "Not sure" },
    ],
    currency: market.currency,
    diagnosisCents: market.diagnosisFeeCents,
    standardHours: tier?.responseHours ?? 24,
    urgentHours: tier?.urgentResponseHours ?? 4,
    urgentCents: market.urgentSurchargeCents,
    urgentIncluded: await urgentIsIncluded(db, property, tier, market.timezone, at),
    afterHoursNow: isAfterHours(at, market),
    afterHoursCents: market.afterHoursSurchargeCents,
  };
}
