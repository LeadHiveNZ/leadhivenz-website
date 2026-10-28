import { TopBar } from "@/components/TopBar";
import { OfficeNav } from "../OfficeNav";

export const metadata = { title: "Invoices" };

/** Phase 2 lands here: draft invoice lines from the price book, approve, export to Xero as DRAFT. */
export default function InvoicesPage() {
  return (
    <div className="min-h-dvh">
      <TopBar title="Invoices" home="/office" />
      <OfficeNav active="invoices" />
      <main className="mx-auto max-w-3xl px-3 pt-4">
        <div className="card p-6">
          <h2 className="text-2xl">Coming in phase 2</h2>
          <p className="mt-2 text-muted">
            Each Done job will turn into draft invoice lines priced from the price book (labour by person and rate band, call-out,
            travel zone, sundries, materials at cost plus markup). You edit and approve here, and approved invoices go to Xero as
            drafts only. Nothing is ever sent to a customer from this app.
          </p>
        </div>
      </main>
    </div>
  );
}
