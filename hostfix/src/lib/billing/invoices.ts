import type { Db } from "@/lib/db/types";
import { taxPortion } from "@/lib/jobs/pricing";

/**
 * ONE INVOICE PER JOB, ISSUED ON THE TRADIE'S BEHALF (DECISIONS.md, 2026-11-24, fourth entry).
 *
 * HostFix arranges the work and collects the payment as the tradie's agent: the work is the tradie's supply to the
 * owner. So the invoice is in the tradie's name. A tradie registered for GST, with their GST number on file, gives a
 * tax invoice that shows the GST inside the price; anyone else gives an invoice with no GST on it, because they cannot
 * charge GST. HostFix issues it for them (the tradie agrees to that in the tradie agreement, section 6). HostFix's own
 * fee is a charge to the tradie, not to the owner, and is not on this invoice.
 *
 * Worked out from the payment when asked for, so it can never disagree with what was charged.
 */
export type JobInvoice = {
  /** The invoice number: HF- and the job number. One job, one invoice. */
  number: string;
  issuedAt: Date;
  timezone: string;
  currency: string;
  taxName: string;
  /** True when the tradie is GST-registered: the document is a tax invoice and shows the GST. */
  taxInvoice: boolean;
  supplier: { name: string; businessName: string; taxNumber: string | null };
  recipient: { name: string; property: string; address: string };
  jobNumber: number;
  title: string;
  lines: { label: string; cents: number }[];
  totalCents: number;
  taxCents: number;
  refundedCents: number;
};

/** The GST inside an amount the tradie charged: only when they are registered and their number is on file. */
export function supplierTax(cents: number, taxRate: number, tradie: { gstRegistered: boolean; gstNumber: string | null }): number {
  return tradie.gstRegistered && tradie.gstNumber ? taxPortion(cents, taxRate) : 0;
}

/** The invoice for one of this owner's jobs, or null until the job has been charged (or for a job that is not theirs). */
export async function jobInvoice(db: Db, ownerId: string, jobId: string): Promise<JobInvoice | null> {
  const rows = await db.query<{
    number: number; title: string; currency: string; paid_at: Date | null; amount_cents: number; refunded_cents: number; status: string;
    tax_rate: string | number; tax_name: string; timezone: string; owner_name: string; property: string; address_line1: string; address_line2: string | null;
    suburb: string; postcode: string; tradie_name: string | null; business_name: string | null; gst_registered: boolean | null; gst_number: string | null;
  }>(
    `select j.number, j.title, j.currency, pay.paid_at, pay.amount_cents, pay.refunded_cents, pay.status,
            m.tax_rate, m.tax_name, m.timezone, ou.name as owner_name, p.name as property, p.address_line1, p.address_line2, p.suburb, p.postcode,
            tu.name as tradie_name, t.business_name, t.gst_registered, t.gst_number
       from public.jobs j
       join public.properties p on p.id = j.property_id
       join public.owners o on o.id = p.owner_id
       join public.users ou on ou.id = o.user_id
       join public.markets m on m.slug = j.market
       join public.payments pay on pay.job_id = j.id
       left join public.tradies t on t.id = j.tradie_id
       left join public.users tu on tu.id = t.user_id
      where j.id = $1::uuid and p.owner_id = $2::uuid
      order by pay.created_at desc
      limit 1`,
    [jobId, ownerId],
  );
  const row = rows[0];
  if (!row || !row.paid_at || !row.tradie_name || !["succeeded", "part_refunded", "refunded"].includes(row.status)) return null;

  const lines = await db.query<{ label: string; owner_cents: number }>(
    "select label, owner_cents from public.job_lines where job_id = $1::uuid and status = 'active' and owner_cents <> 0 order by created_at, id",
    [jobId],
  );
  const tradie = { gstRegistered: Boolean(row.gst_registered), gstNumber: row.gst_number?.trim() || null };
  const taxInvoice = Boolean(tradie.gstRegistered && tradie.gstNumber);
  const totalCents = Number(row.amount_cents);
  const listed = lines.reduce((sum, line) => sum + Number(line.owner_cents), 0);
  return {
    number: `HF-${Number(row.number)}`,
    issuedAt: new Date(row.paid_at),
    timezone: row.timezone,
    currency: row.currency,
    taxName: row.tax_name,
    taxInvoice,
    supplier: { name: row.tradie_name, businessName: row.business_name ?? row.tradie_name, taxNumber: taxInvoice ? tradie.gstNumber : null },
    recipient: {
      name: row.owner_name,
      property: row.property,
      address: [row.address_line1, row.address_line2, row.suburb, row.postcode].filter((part) => part && part.trim()).join(", "),
    },
    jobNumber: Number(row.number),
    title: row.title,
    // The lines are the job's own; if they do not add up to what was charged (a hold captured short), one line says what was.
    lines: listed === totalCents ? lines.map((line) => ({ label: line.label, cents: Number(line.owner_cents) })) : [{ label: row.title, cents: totalCents }],
    totalCents,
    taxCents: supplierTax(totalCents, Number(row.tax_rate), tradie),
    refundedCents: Number(row.refunded_cents),
  };
}
