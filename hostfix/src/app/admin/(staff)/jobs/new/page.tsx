import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { staffLogJob } from "@/app/actions/staff";
import { ReportForm } from "@/components/jobs/ReportForm";
import { Notice, PageTitle } from "@/components/ui/Bits";
import { requireStaff } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { reportFormData } from "@/lib/jobs/report-data";
import { addressLine, getPropertyForStaff } from "@/lib/properties/service";

export const metadata: Metadata = { title: "Log a job" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** For when an owner phones a problem in. The job is logged exactly as if they had done it themselves. */
export default async function StaffNewJobPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const property = typeof query.property === "string" ? await getPropertyForStaff(db, query.property) : null;
  if (!property) notFound();
  const data = property.status === "active" ? await reportFormData(db, property, "owner") : null;

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Log a job for an owner" back={{ href: `/admin/owners/${property.ownerId}`, label: "Owner" }} intro={`At ${property.name}, ${addressLine(property)}. The owner is charged the fixed price when it is done, as if they had logged it.`} />
      {!data || data.items.length === 0 ? (
        <Notice tone="warn" title="Jobs cannot be logged for this property">
          It does not have an active membership.
        </Notice>
      ) : (
        <ReportForm
          action={staffLogJob}
          hidden={{ propertyId: property.id }}
          audience="owner"
          items={data.items}
          offMenuTrades={data.offMenuTrades}
          currency={data.currency}
          diagnosisCents={data.diagnosisCents}
          standardHours={data.standardHours}
          urgentHours={data.urgentHours}
          urgentCents={data.urgentCents}
          urgentIncluded={data.urgentIncluded}
          afterHoursNow={data.afterHoursNow}
          afterHoursCents={data.afterHoursCents}
        />
      )}
    </div>
  );
}
