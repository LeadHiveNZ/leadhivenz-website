import { sourceLabel } from "@/lib/attribution";
import { isAdminSignedIn } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { formatWhenSortable, leadTimezone, tradeLabel } from "@/lib/leads/display";
import { daysLabel, managedByLabel } from "@/lib/leads/options";
import { getStore } from "@/lib/store";

/** Downloads every lead as a spreadsheet. Signed-in admins only. */
export async function GET() {
  if (!(await isAdminSignedIn())) {
    return new Response("Please sign in first.", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let leads;
  try {
    leads = await getStore().listLeads({ limit: 10_000 });
  } catch (error) {
    console.error("[export] could not load leads:", error instanceof Error ? error.message : error);
    return new Response("The leads could not be loaded. Please try again.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const header = [
    "Date",
    "Type",
    "Name",
    "Phone",
    "Email",
    "Properties",
    "Looked after by",
    "Lives in",
    "Trade",
    "Licence number",
    "Days available",
    "Market",
    "Source",
    "Campaign",
    "Ad",
    "Referred by",
    "Came from site",
    "Landed on",
    "Deposit",
    "Deposit amount",
    "Deposit currency",
    "Lead ID",
  ];
  const rows = leads.map((lead) => [
    formatWhenSortable(lead.createdAt, leadTimezone(lead)),
    lead.leadType === "owner" ? "Owner" : "Tradie",
    lead.name,
    lead.phone,
    lead.email,
    lead.propertyCount,
    managedByLabel(lead.managedBy),
    lead.ownerLocation,
    tradeLabel(lead),
    lead.licenceNumber,
    daysLabel(lead.daysAvailable),
    lead.market,
    sourceLabel(lead.source),
    lead.utmCampaign,
    lead.utmContent,
    lead.refCode,
    lead.referrer,
    lead.landingPath,
    lead.depositStatus === "none" ? "" : lead.depositStatus,
    lead.depositAmount === null ? "" : (lead.depositAmount / 100).toFixed(2),
    lead.depositCurrency,
    lead.id,
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hostfix-leads-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
