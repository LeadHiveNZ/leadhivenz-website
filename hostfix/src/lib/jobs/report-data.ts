import { jobTrades, NOT_SURE_TRADE } from "@config/trades";
import { menuGroup, tradeGroup } from "@/lib/markets/menu-groups";
import { now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";
import { getMarket, getTier, listMenu } from "@/lib/markets/store";
import type { Property } from "@/lib/properties/service";
import { isAfterHours } from "@/lib/time";
import { urgentIsIncluded } from "./included";
import { coverByTrade, coverNow, noCoverWords } from "@/lib/tradies/cover";
import { previewPrice, type PricePreview } from "./create";
import type { Job } from "./types";

/** Everything the "report a problem" form needs to show the right jobs and the right prices for one property. */
export type ReportFormData = {
  marketName: string;
  country: "NZ" | "AU";
  items: { id: string; name: string; trade: string; tradeLabel: string; ownerCents: number; tryFirst: string }[];
  offMenuTrades: { key: string; label: string }[];
  currency: string;
  diagnosisCents: number;
  standardHours: number;
  urgentHours: number;
  urgentCents: number;
  urgentIncluded: boolean;
  afterHoursNow: boolean;
  afterHoursCents: number;
  /** Emergency (DECISIONS.md, 2026-11-26, third entry): within this many minutes, for this much more. */
  emergencyMinutes: number;
  emergencyCents: number;
  /** By trade: is anyone who could take it inside their hours now, and if not, what to say instead of Urgent and Emergency. */
  cover: Record<string, { onNow: boolean; words: string | null }>;
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
      id: item.id, name: item.name, trade: item.trade, tradeLabel: menuGroup(item), ownerCents: item.ownerPriceCents, tryFirst: item.tryFirst,
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
    emergencyMinutes: market.emergencyResponseMinutes,
    emergencyCents: market.emergencySurchargeCents,
    cover: Object.fromEntries(
      Object.entries(await coverByTrade(db, market, at, property.area)).map(([trade, cover]) => [trade, { onNow: cover.onNow, words: cover.onNow ? null : noCoverWords(cover, at, market.timezone) }]),
    ),
  };
}

export type GoAheadPrices = {
  standard: PricePreview | null;
  /** Null when nobody who could take it is inside their hours now: then `noCover` says when they are. */
  urgent: PricePreview | null;
  emergency: PricePreview | null;
  noCover: string | null;
};

/** The prices on the owner's "Send a tradie?" buttons for a report waiting for their yes, with the same cover rule as the form. */
export async function goAheadPrices(db: Db, property: Property, job: Pick<Job, "menuItemId" | "trade" | "licenceRequired">): Promise<GoAheadPrices> {
  const market = await getMarket(db, property.market);
  const at = now();
  const cover = market ? await coverNow(db, market, job.trade, at, job.licenceRequired, property.area) : { onNow: true, nextFrom: null };
  const standard = await previewPrice(db, property, { menuItemId: job.menuItemId, urgent: false });
  if (!cover.onNow) return { standard, urgent: null, emergency: null, noCover: noCoverWords(cover, at, market!.timezone) };
  return {
    standard,
    urgent: await previewPrice(db, property, { menuItemId: job.menuItemId, urgent: true }),
    emergency: await previewPrice(db, property, { menuItemId: job.menuItemId, urgent: false, emergency: true }),
    noCover: null,
  };
}
