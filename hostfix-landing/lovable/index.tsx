import { createFileRoute } from "@tanstack/react-router";
import { HostFixLanding, type Lead } from "@/components/HostFixLanding";

// The page itself is src/components/HostFixLanding.tsx (built outside Lovable, see the leadhivenz-website repo,
// folder hostfix-landing). This file only connects its form to /api/public/leads, which saves the lead
// and emails it to Joe.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HostFix · Holiday home maintenance, New Zealand" },
      { name: "description", content: "Airbnb and holiday home owners across New Zealand: tap what's broken, see the fixed price, and a checked local tradie is on site within 24 hours. Free to join." },
      { property: "og:title", content: "HostFix · New Zealand" },
      { property: "og:description", content: "Never ring round for a tradie again. Fixed prices, free to join, on site within 24 hours." },
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
