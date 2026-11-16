import { createFileRoute } from "@tanstack/react-router";
import { HostFixLanding, type Lead } from "@/components/HostFixLanding";

// The page itself is src/components/HostFixLanding.tsx (built outside Lovable, see the leadhivenz-website repo,
// folder hostfix-landing). This file only connects its form to /api/public/leads, which saves the lead
// and emails it to Joe.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HostFix · Queenstown holiday home maintenance" },
      { name: "description", content: "Queenstown Airbnb owners: tap what's broken, see the fixed price, and a checked local tradie is on site within 24 hours." },
      { property: "og:title", content: "HostFix · Queenstown" },
      { property: "og:description", content: "Never ring round for a tradie again. Fixed prices, on site within 24 hours." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

async function saveLead(lead: Lead) {
  const response = await fetch("/api/public/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!response.ok) console.error("Could not save lead", response.status);
  return { ok: response.ok };
}

function Index() {
  return <HostFixLanding saveLead={saveLead} />;
}
