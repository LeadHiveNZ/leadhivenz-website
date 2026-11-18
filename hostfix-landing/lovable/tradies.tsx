import { createFileRoute } from "@tanstack/react-router";
import { HostFixTradies, type TradieLead } from "@/components/HostFixTradies";

// The tradie page is src/components/HostFixTradies.tsx (built outside Lovable, see the leadhivenz-website
// repo, folder hostfix-landing). This file connects its form to /api/public/tradie-leads.
export const Route = createFileRoute("/tradies")({
  head: () => ({
    meta: [
      { title: "HostFix for tradies · Fixed-price jobs at holiday homes" },
      { name: "description", content: "Plumbers, sparkies and handymen: fixed-price maintenance jobs at Airbnbs texted to your phone. Free to join, paid out the next day, no invoicing." },
      { property: "og:title", content: "HostFix for tradies" },
      { property: "og:description", content: "Fixed-price jobs at holiday homes, texted to you. Free to join. Paid out the next day." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Tradies,
});

async function saveLead(lead: TradieLead) {
  const response = await fetch("/api/public/tradie-leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!response.ok) console.error("Could not save tradie lead", response.status);
  return { ok: response.ok };
}

function Tradies() {
  return <HostFixTradies saveLead={saveLead} />;
}
