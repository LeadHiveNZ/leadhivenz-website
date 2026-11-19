import { brand } from "@config/brand";
import type { Market } from "@config/markets";
import type { Db } from "@/lib/db/types";
import { groupMenu } from "@/lib/markets/menu-groups";
import { listMenu } from "@/lib/markets/store";
import { partsWords } from "@/lib/markets/display";
import { listPriceList } from "@/lib/jobs/parts";
import { formatMoney } from "@/lib/money";
import type { EmailMessage } from "@/lib/notify/email";
import type { Lead } from "@/lib/store/types";
import { formatHourOfDay } from "@/lib/time";

/**
 * THE PRICE LIST an owner asks for on the landing page. It is the menu as it
 * is right now in the database: every job that can be booked, at the price
 * the owner's card is charged. Jobs switched off on the admin screen (for
 * example a price still waiting on a local quote) are left out.
 */

export type PriceListItem = { code: string; trade: string; name: string; ownerPriceCents: number };
export type PriceList = { groups: { group: string; items: PriceListItem[] }[]; count: number };

export async function priceListFor(db: Db, market: string): Promise<PriceList> {
  const items = (await listMenu(db, market)).map((item) => ({ code: item.code, trade: item.trade, name: item.name, ownerPriceCents: item.ownerPriceCents }));
  // The common parts, at their fixed price each (DECISIONS.md, 2026-11-20). "count" stays the number of jobs.
  const parts = (await listPriceList(db, market)).map((item) => ({ code: item.code, trade: "parts", name: `${item.name}, each`, ownerPriceCents: item.priceCents }));
  const groups = groupMenu(items);
  if (parts.length > 0) groups.push({ group: "Common parts, fitted on any job", items: parts });
  return { groups, count: items.length };
}

const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/** "7am to 4:30pm, Monday to Friday", from the market's own settings. */
export function workingHours(market: Pick<Market, "hoursStart" | "hoursEnd" | "workDays">): string {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const days = order.filter((day) => market.workDays.includes(day));
  const consecutive = days.length > 1 && days.every((day, index) => index === 0 || order.indexOf(day) === order.indexOf(days[index - 1]!) + 1);
  const dayText =
    days.length === 7 ? "every day" : consecutive ? `${DAY_NAMES[days[0]!]} to ${DAY_NAMES[days[days.length - 1]!]}` : days.map((day) => DAY_NAMES[day]).join(", ");
  return `${formatHourOfDay(market.hoursStart)} to ${formatHourOfDay(market.hoursEnd)}, ${dayText}`;
}

/**
 * The lines under the list that say what else can be charged. Every number
 * comes from the market's settings, so the words never drift from what the
 * app actually charges.
 */
export function priceListNotes(market: Market): string[] {
  const money = (cents: number) => formatMoney(cents, market.currency);
  const membership = market.tiers[0];
  const urgentHours = membership?.urgentResponseHours ?? 4;
  return [
    `This is what your card is charged when the job is done, ${market.taxName} included. No call-out fee on top.`,
    `Need someone within ${urgentHours} hours? Add ${money(market.urgentSurchargeCents)} and the tradie drops what they are doing, plus ${money(market.afterHoursSurchargeCents)} outside working hours (${workingHours(market)}).`,
    `Not on the list? ${money(market.diagnosisFeeCents)} for a tradie to come and look, then a quote. Nothing over ${money(market.approvalThresholdCents)} starts without your yes.`,
    partsWords(market),
  ];
}

export type PriceListEmailInput = {
  lead: Pick<Lead, "name">;
  market: Market;
  list: PriceList;
  /** The link back to take a founding spot. Null when the deposit is not on offer. */
  foundingUrl: string | null;
  spotsLeft: number | null;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** The email itself, as text and as HTML. */
export function priceListEmail(input: PriceListEmailInput): Pick<EmailMessage, "subject" | "text" | "html"> {
  const { market, list } = input;
  const money = (cents: number) => formatMoney(cents, market.currency);
  const membership = market.tiers[0];
  const deposit = money(market.foundingDeposit.amountCents);
  const founding = input.foundingUrl && market.foundingDeposit.enabled && input.spotsLeft !== 0;
  const spots = market.foundingDeposit.spots;
  const subject = `Your ${brand.name} price list for ${market.name}`;

  const intro = `Hi ${firstName(input.lead.name)}, here is the full ${brand.name} price list for ${market.name}: ${list.count} jobs at a fixed price.`;
  const membershipLine = !membership
    ? ""
    : membership.monthlyPriceCents === 0
      ? `It is free to join: you only pay the fixed price when a job is done. A tradie on site within ${membership.responseHours} hours, or ${membership.urgentResponseHours} when it's urgent. If an urgent job is reached late, the urgent fee is not charged, and the after-hours fee is charged only if the tradie comes outside working hours.`
      : `The membership is ${money(membership.monthlyPriceCents)} a month per property: a tradie on site within ${membership.responseHours} hours, or ${membership.urgentResponseHours} when it's urgent. If an urgent job is reached late, the urgent fee is not charged.`;
  const foundingLines = founding
    ? [
        `${spots ? `We are taking ${spots} founding properties in ${market.name}.` : `We are taking founding properties in ${market.name}.`} A founding spot takes a ${deposit} deposit:`,
        ...market.foundingDeposit.terms.map((term) => `- ${term}`),
      ]
    : [];
  const notes = priceListNotes(market);

  const text = [
    intro,
    "",
    ...list.groups.flatMap((group) => [group.group.toUpperCase(), ...group.items.map((item) => `  ${item.name}: ${money(item.ownerPriceCents)}`), ""]),
    ...notes,
    "",
    membershipLine,
    ...(founding ? ["", ...foundingLines, "", `Take a founding spot: ${input.foundingUrl}`] : []),
    "",
    "Questions? Reply to this email and a person will answer.",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");

  const rows = list.groups
    .map(
      (group) =>
        `<tr><td colspan="2" style="padding:18px 0 6px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6a5b70">${escapeHtml(group.group)}</td></tr>` +
        group.items
          .map(
            (item) =>
              `<tr><td style="padding:7px 16px 7px 0;border-bottom:1px solid #e2d9e6;color:#24122a">${escapeHtml(item.name)}</td>` +
              `<td style="padding:7px 0;border-bottom:1px solid #e2d9e6;color:#24122a;font-weight:700;text-align:right;white-space:nowrap">${escapeHtml(money(item.ownerPriceCents))}</td></tr>`,
          )
          .join(""),
    )
    .join("");
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#24122a;max-width:600px">` +
    `<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#3b1e3f">${escapeHtml(brand.name)} · ${escapeHtml(market.name)}</p>` +
    `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">${escapeHtml(subject)}</h1>` +
    `<p style="margin:0 0 8px">${escapeHtml(intro)}</p>` +
    `<table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">${rows}</table>` +
    `<ul style="margin:18px 0 0;padding-left:20px;color:#6a5b70;font-size:14px">${notes.map((note) => `<li style="margin:0 0 6px">${escapeHtml(note)}</li>`).join("")}</ul>` +
    (membershipLine ? `<p style="margin:18px 0 0">${escapeHtml(membershipLine)}</p>` : "") +
    (founding
      ? `<div style="margin:22px 0 0;padding:18px;border-radius:14px;background:#3b1e3f;color:#ffffff">` +
        `<p style="margin:0 0 8px;font-weight:700">${escapeHtml(foundingLines[0]!)}</p>` +
        `<ul style="margin:0 0 14px;padding-left:20px">${market.foundingDeposit.terms.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ul>` +
        `<a href="${escapeHtml(input.foundingUrl!)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#d4f23a;color:#2a132d;font-weight:700;text-decoration:none">Take a founding spot · ${escapeHtml(deposit)}</a>` +
        `</div>`
      : "") +
    `<p style="margin:22px 0 0;color:#6a5b70;font-size:14px">Questions? Reply to this email and a person will answer.</p>` +
    `</div>`;

  return { subject, text, html };
}
