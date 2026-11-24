import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand } from "@config/brand";
import { PrintButton } from "@/components/ui/Buttons";
import { Card, PageTitle } from "@/components/ui/Bits";
import { requireOwner } from "@/lib/auth/current";
import { jobInvoice } from "@/lib/billing/invoices";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Invoice" };

type Params = Promise<{ id: string }>;

/** The owner's invoice for one job, issued by HostFix on the tradie's behalf (src/lib/billing/invoices.ts). */
export default async function JobInvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const viewer = await requireOwner(`/app/jobs/${id}/invoice`);
  const db = await getDb();
  const invoice = await jobInvoice(db, viewer.ownerId, id);
  if (!invoice) notFound();
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const supplier = invoice.supplier.businessName === invoice.supplier.name ? invoice.supplier.name : `${invoice.supplier.businessName} (${invoice.supplier.name})`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={invoice.taxInvoice ? "Tax invoice" : "Invoice"} back={{ href: `/app/jobs/${id}`, label: "Job" }} action={<PrintButton>Print or save as PDF</PrintButton>} />
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">From</p>
            <p className="font-bold text-ink">{supplier}</p>
            {invoice.supplier.taxNumber ? (
              <p className="text-sm text-muted">{invoice.taxName} number {invoice.supplier.taxNumber}</p>
            ) : (
              <p className="text-sm text-muted">Not registered for {invoice.taxName}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-muted">{invoice.taxInvoice ? "Tax invoice" : "Invoice"} {invoice.number}</p>
            <p className="text-sm text-muted">{formatDate(invoice.issuedAt, invoice.timezone)}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-muted">To</p>
          <p className="font-bold text-ink">{invoice.recipient.name}</p>
          <p className="text-sm text-muted">
            {invoice.recipient.property}, {invoice.recipient.address}
          </p>
        </div>

        <ul className="mt-6 divide-y divide-line border-y border-line">
          {invoice.lines.map((line, index) => (
            <li key={index} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="min-w-0 text-ink">{line.label}</span>
              <span className="tabular shrink-0 text-ink">{money(line.cents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="font-bold text-ink">Total</span>
          <span className="tabular font-bold text-ink">{money(invoice.totalCents)}</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {invoice.taxInvoice ? `Includes ${invoice.taxName} of ${money(invoice.taxCents)}.` : `No ${invoice.taxName} is charged: the tradie is not registered for it.`}
        </p>
        {invoice.refundedCents > 0 && <p className="mt-1 text-sm text-muted">{money(invoice.refundedCents)} of this was later refunded to you.</p>}

        <p className="mt-6 text-sm text-muted">
          Job {invoice.jobNumber}: {invoice.title}. Paid by card or bank to {brand.name}, which collects payment for the tradie. Issued by {brand.name} on behalf of the
          tradie named above, who did the work.
        </p>
      </Card>
    </div>
  );
}
