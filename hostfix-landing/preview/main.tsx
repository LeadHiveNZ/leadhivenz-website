// Local preview only: leads are kept in the browser so the pages can be tried without a database.
// Open /?page=tradies for the tradie page.
import { createRoot } from "react-dom/client";
import { HostFixLanding, type Lead } from "../src/HostFixLanding";
import { HostFixTradies, type TradieLead } from "../src/HostFixTradies";
import "../src/hostfix.css";
const keep = async (lead: Lead | TradieLead) => {
  const w = window as unknown as { __leads?: unknown[] };
  w.__leads = [...(w.__leads ?? []), lead];
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true };
};
const page = new URLSearchParams(window.location.search).get("page");
createRoot(document.getElementById("root")!).render(page === "tradies" ? <HostFixTradies saveLead={keep} /> : <HostFixLanding saveLead={keep} />);
