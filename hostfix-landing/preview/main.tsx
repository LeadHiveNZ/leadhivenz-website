// Local preview only: leads are kept in the browser so the page can be tried without a database.
import { createRoot } from "react-dom/client";
import { HostFixLanding, type Lead } from "../src/HostFixLanding";
import "../src/hostfix.css";
const saveLead = async (lead: Lead) => {
  (window as unknown as { __leads: Lead[] }).__leads = [...((window as unknown as { __leads?: Lead[] }).__leads ?? []), lead];
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true };
};
createRoot(document.getElementById("root")!).render(<HostFixLanding saveLead={saveLead} />);
