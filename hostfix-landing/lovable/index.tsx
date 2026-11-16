import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { HostFixLanding, type Lead } from "@/components/HostFixLanding";

// The page itself is src/components/HostFixLanding.tsx (built outside Lovable, see the leadhivenz-website repo,
// folder hostfix-landing). This file only connects its form to the leads table.
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
  const { error } = await supabase.from("leads").insert(lead);
  if (error) console.error("Could not save lead", error.message);
  return { ok: !error };
}

function Index() {
  return <HostFixLanding saveLead={saveLead} />;
}
