import { findMarket } from "@config/markets";
import { findTrade } from "@config/trades";
import { formatMoney } from "@/lib/money";
import type { Lead } from "@/lib/store/types";
import { daysLabel, managedByLabel } from "./options";

/** Plain-words descriptions of a lead, shared by the leads list and the spreadsheet. */

export function leadTimezone(lead: Lead): string {
  return findMarket(lead.market)?.timezone ?? "Pacific/Auckland";
}

/** "15 Nov 2026, 3:02 pm" in the market's own time. */
export function formatWhen(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** "2026-11-15 15:02" in the market's own time, for spreadsheets that sort by date. */
export function formatWhenSortable(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function tradeLabel(lead: Lead): string {
  return (lead.trade && findTrade(lead.trade)?.label) || lead.trade || "";
}

/** One line summing up what the lead told us. */
export function leadSummary(lead: Lead): string {
  if (lead.leadType === "owner") {
    const count = lead.propertyCount ?? 0;
    return [
      `${count} ${count === 1 ? "property" : "properties"}`,
      managedByLabel(lead.managedBy),
      lead.ownerLocation ? `lives in ${lead.ownerLocation}` : "",
    ]
      .filter((part) => part !== "")
      .join(" · ");
  }
  return [tradeLabel(lead), lead.licenceNumber ? `licence ${lead.licenceNumber}` : "no licence given", daysLabel(lead.daysAvailable)]
    .filter((part) => part !== "")
    .join(" · ");
}

export function depositLabel(lead: Lead): string {
  const money = lead.depositAmount && lead.depositCurrency ? formatMoney(lead.depositAmount, lead.depositCurrency) : "";
  switch (lead.depositStatus) {
    case "paid":
      return `Paid ${money}`.trim();
    case "refunded":
      return `Refunded ${money}`.trim();
    case "started":
      return "Started, not paid";
    default:
      return "";
  }
}
