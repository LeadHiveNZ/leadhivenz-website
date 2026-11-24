import { formatMoney } from "@/lib/money";
import type { Db } from "@/lib/db/types";
import { supplierTax } from "@/lib/billing/invoices";
import { taxPortion } from "@/lib/jobs/pricing";
import { monthBounds } from "@/lib/time";

/**
 * MONTHLY STATEMENTS. Worked out from the payment records when asked for, so
 * a statement can never disagree with what was actually charged or paid.
 *
 * NOTE FOR YOUR ACCOUNTANT: these are records of what moved. Each job also has
 * its own invoice, issued by HostFix on the tradie's behalf (src/lib/billing/invoices.ts):
 * HostFix collects payment as the tradie's agent (DECISIONS.md, 2026-11-24, fourth
 * entry), so the GST on a job is the tradie's, and only a GST-registered tradie's.
 */

export type OwnerStatementLine = {
  date: Date;
  kind: "membership" | "job" | "refund" | "credit";
  description: string;
  property: string;
  /** Money out of the owner's pocket is positive. Refunds and credits are negative. */
  amountCents: number;
  taxCents: number;
};

export type OwnerStatement = {
  month: string;
  currency: string;
  lines: OwnerStatementLine[];
  membershipCents: number;
  jobsCents: number;
  refundsCents: number;
  creditsCents: number;
  totalCents: number;
  taxCents: number;
};

/** Everything one owner was charged, refunded and credited in one calendar month, for properties in one market. */
export async function ownerStatement(db: Db, ownerId: string, market: { slug: string; currency: string; timezone: string }, month: string): Promise<OwnerStatement> {
  const { start, end } = monthBounds(month, market.timezone);
  const range = [ownerId, market.slug, start.toISOString(), end.toISOString()];
  const lines: OwnerStatementLine[] = [];

  const memberships = await db.query<{ paid_at: Date; amount_cents: number; tax_cents: number; property: string | null; period_start: Date | null; portfolio_id: string | null }>(
    `select i.paid_at, i.amount_cents, i.tax_cents, p.name as property, i.period_start, i.portfolio_id
       from public.membership_invoices i
       left join public.properties p on p.id = i.property_id
       left join public.portfolios f on f.id = i.portfolio_id
      where i.owner_id = $1::uuid and coalesce(p.market, f.market) = $2 and i.status = 'paid' and i.paid_at >= $3::timestamptz and i.paid_at < $4::timestamptz`,
    range,
  );
  for (const row of memberships) {
    // A Portfolio retainer is one payment for the whole account, not for one property.
    const retainer = Boolean(row.portfolio_id);
    lines.push({
      date: new Date(row.paid_at), kind: "membership", description: retainer ? "Monthly Portfolio retainer" : "Monthly membership",
      property: retainer ? "All properties on your Portfolio" : (row.property ?? ""), amountCents: row.amount_cents, taxCents: row.tax_cents,
    });
  }

  const jobs = await db.query<{
    paid_at: Date; amount_cents: number; tax_cents: number; refunded_cents: number; number: number; title: string; property: string; callout_off: number | null;
    urgent_off: boolean; after_hours_off: boolean; gst_registered: boolean | null; gst_number: string | null; tax_rate: string | number;
  }>(
    `select pay.paid_at, pay.amount_cents, pay.tax_cents, pay.refunded_cents, j.number, j.title, p.name as property,
            t.gst_registered, t.gst_number, m.tax_rate,
            (select c.amount_cents from public.credits c where c.job_id = j.id and c.reason = 'missed_window' and c.status = 'applied') as callout_off,
            -- A surcharge taken off because of when the tradie arrived (DECISIONS.md, 2026-11-18).
            exists (select 1 from public.job_lines l where l.job_id = j.id and l.kind = 'urgent' and l.status = 'void') as urgent_off,
            exists (select 1 from public.job_lines l where l.job_id = j.id and l.kind = 'after_hours' and l.status = 'void') as after_hours_off
       from public.payments pay join public.jobs j on j.id = pay.job_id join public.properties p on p.id = j.property_id
       join public.markets m on m.slug = j.market left join public.tradies t on t.id = j.tradie_id
      where pay.owner_id = $1::uuid and j.market = $2 and pay.paid_at is not null and pay.paid_at >= $3::timestamptz and pay.paid_at < $4::timestamptz`,
    range,
  );
  for (const row of jobs) {
    // A missed promise took the call-out off this job's charge: the amount here is already the smaller one.
    const off = row.callout_off ? ` (${formatMoney(Number(row.callout_off), market.currency)} off: we missed our promised time)` : "";
    const surcharges = [row.urgent_off ? "urgent" : null, row.after_hours_off ? "after-hours" : null].filter(Boolean);
    const dropped = surcharges.length > 0 ? ` (no ${surcharges.join(" or ")} fee charged)` : "";
    // The GST in a job is the tradie's: only a GST-registered tradie's job has any (src/lib/billing/invoices.ts).
    const taxCents = supplierTax(Number(row.amount_cents), Number(row.tax_rate), { gstRegistered: Boolean(row.gst_registered), gstNumber: row.gst_number?.trim() || null });
    lines.push({ date: new Date(row.paid_at), kind: "job", description: `Job ${Number(row.number)}: ${row.title}${off}${dropped}`, property: row.property, amountCents: row.amount_cents, taxCents });
    if (row.refunded_cents > 0) {
      const share = row.amount_cents > 0 ? Math.round((taxCents * row.refunded_cents) / row.amount_cents) : 0;
      lines.push({ date: new Date(row.paid_at), kind: "refund", description: `Refund on job ${Number(row.number)}`, property: row.property, amountCents: -row.refunded_cents, taxCents: -share });
    }
  }

  const credits = await db.query<{ created_at: Date; amount_cents: number; reason: string; property: string | null }>(
    `select c.created_at, c.amount_cents, c.reason, p.name as property
       from public.credits c left join public.properties p on p.id = c.property_id
      where c.owner_id = $1::uuid and (p.market = $2 or p.id is null) and c.status in ('applied', 'pending')
        and c.reason <> 'founding_deposit'
        -- A missed promise on a job comes off that job's own charge, shown on the job's line, not off a later payment.
        and not (c.reason = 'missed_window' and c.job_id is not null)
        and c.created_at >= $3::timestamptz and c.created_at < $4::timestamptz`,
    range,
  );
  for (const row of credits) {
    lines.push({
      date: new Date(row.created_at), kind: "credit",
      // Missed-promise credits stopped on 18 November 2026; older ones still show.
      description: row.reason === "missed_window" ? "Missed-time credit (comes off your next membership payment)" : "Credit (comes off your next membership payment)",
      property: row.property ?? "", amountCents: -row.amount_cents, taxCents: 0,
    });
  }

  lines.sort((a, b) => a.date.getTime() - b.date.getTime());
  const sum = (kind: OwnerStatementLine["kind"]) => lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amountCents, 0);
  const charged = lines.filter((line) => line.kind !== "credit");
  return {
    month, currency: market.currency, lines,
    membershipCents: sum("membership"), jobsCents: sum("job"), refundsCents: sum("refund"), creditsCents: sum("credit"),
    // Credits reduce a later membership payment, which will show as a smaller amount then, so they are not taken off here.
    totalCents: charged.reduce((total, line) => total + line.amountCents, 0),
    taxCents: charged.reduce((total, line) => total + line.taxCents, 0),
  };
}

/** amountCents is what the job earned; deductedCents what came off it towards a balance owed (DECISIONS.md, 2026-11-20). */
/** jobPriceCents and feeCents: the job's price and HostFix's fee on it (DECISIONS.md, 2026-11-23, second entry: 15% to NZ$1,000, 3% above). */
export type TradieStatementLine = { date: Date; number: number; title: string; suburb: string; amountCents: number; deductedCents: number; status: string; jobPriceCents: number; feeCents: number };

export type TradieStatement = {
  month: string;
  currency: string;
  lines: TradieStatementLine[];
  paidCents: number;
  /** Still to come: held for the 24-hour window, or on hold. */
  pendingCents: number;
  /** The tax inside what was paid, shown when the tradie says they are registered for it. */
  taxCents: number | null;
};

/** Everything one tradie was paid in one calendar month. */
export async function tradieStatement(
  db: Db, tradie: { id: string; gstRegistered: boolean }, market: { currency: string; timezone: string; taxRate: number }, month: string,
): Promise<TradieStatement> {
  const { start, end } = monthBounds(month, market.timezone);
  const rows = await db.query<{ status: string; sent_at: Date | null; created_at: Date; amount_cents: number; deducted_cents: number | null; number: number; title: string; suburb: string; owner_total_cents: number; tradie_total_cents: number }>(
    `select po.status, po.sent_at, po.created_at, po.amount_cents, po.deducted_cents, j.number, j.title, p.suburb, j.owner_total_cents, j.tradie_total_cents
       from public.payouts po join public.jobs j on j.id = po.job_id join public.properties p on p.id = j.property_id
      where po.tradie_id = $1::uuid
        and ((po.status = 'sent' and po.sent_at >= $2::timestamptz and po.sent_at < $3::timestamptz)
          or (po.status in ('waiting', 'scheduled', 'paused', 'held', 'failed') and po.created_at >= $2::timestamptz and po.created_at < $3::timestamptz))
      order by coalesce(po.sent_at, po.created_at)`,
    [tradie.id, start.toISOString(), end.toISOString()],
  );
  const lines = rows.map((row) => ({
    date: new Date(row.sent_at ?? row.created_at), number: Number(row.number), title: row.title, suburb: row.suburb, amountCents: row.amount_cents,
    deductedCents: row.status === "sent" ? Number(row.deducted_cents ?? 0) : 0, status: row.status,
    jobPriceCents: Number(row.owner_total_cents), feeCents: Math.max(0, Number(row.owner_total_cents) - Number(row.tradie_total_cents)),
  }));
  const paidCents = lines.filter((line) => line.status === "sent").reduce((total, line) => total + line.amountCents, 0);
  return {
    month, currency: market.currency, lines, paidCents,
    pendingCents: lines.filter((line) => line.status !== "sent").reduce((total, line) => total + line.amountCents, 0),
    taxCents: tradie.gstRegistered ? taxPortion(paidCents, market.taxRate) : null,
  };
}
