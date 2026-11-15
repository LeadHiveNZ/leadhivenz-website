import { trades } from "@config/trades";
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

const GROUP_LABELS: Record<string, string> = {
  handyman: "Odd jobs and repairs",
  plumber: "Plumbing",
  electrician: "Power and lights",
  gasfitter: "Gas and hot water",
  appliance_tech: "Appliances",
  heat_pump_tech: "Heating and cooling",
  locksmith: "Locks and keys",
};

export async function reportFormData(db: Db, property: Property, audience: "owner" | "team" | "guest"): Promise<ReportFormData | null> {
  const market = await getMarket(db, property.market);
  if (!market) return null;
  const tier = property.tierId ? await getTier(db, property.tierId) : null;
  const order = new Map(trades.map((trade, index) => [trade.key, index]));
  const menu = (await listMenu(db, market.slug))
    .filter((item) => audience !== "guest" || item.guestVisible)
    .sort((a, b) => (order.get(a.trade) ?? 99) - (order.get(b.trade) ?? 99) || a.sort - b.sort);
  const at = now();
  return {
    marketName: market.name,
    country: market.country,
    items: menu.map((item) => ({
      id: item.id, name: item.name, tradeLabel: GROUP_LABELS[item.trade] ?? item.trade, ownerCents: item.ownerPriceCents, tryFirst: item.tryFirst,
    })),
    offMenuTrades: trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: GROUP_LABELS[trade.key] ?? trade.label })),
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
