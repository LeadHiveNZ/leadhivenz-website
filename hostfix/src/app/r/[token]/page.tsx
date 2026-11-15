import { connection } from "next/server";
import { sendReport } from "@/app/actions/report";
import { ReportForm } from "@/components/jobs/ReportForm";
import { Chip, Notice } from "@/components/ui/Bits";
import { getDb } from "@/lib/db";
import { reportFormData } from "@/lib/jobs/report-data";
import { statusLabel } from "@/lib/jobs/types";
import { addressLine, findPropertyByReportToken } from "@/lib/properties/service";

/** What is already being dealt with at this property, so the same thing is not reported twice. Titles only. */
async function openJobs(propertyId: string) {
  const db = await getDb();
  return db.query<{ title: string; status: "awaiting_owner" | "offering" | "unfilled" | "accepted" | "on_site" | "awaiting_approval" }>(
    `select title, status from public.jobs
      where property_id = $1::uuid and status in ('awaiting_owner', 'offering', 'unfilled', 'accepted', 'on_site', 'awaiting_approval')
      order by created_at desc limit 6`,
    [propertyId],
  );
}

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const db = await getDb();
  const found = await findPropertyByReportToken(db, token);

  if (!found) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">This link does not work any more</h1>
        <p className="text-lg text-muted">It may have been replaced. Please ask your host for the new one, or contact them directly.</p>
      </div>
    );
  }
  const { property, via } = found;
  const data = property.status === "active" ? await reportFormData(db, property, via) : null;
  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">Reports are switched off for this property</h1>
        <p className="text-lg text-muted">Please contact {via === "guest" ? "your host" : "the owner"} directly about anything that needs fixing.</p>
      </div>
    );
  }
  const already = await openJobs(property.id);
  const emergency = data.country === "AU" ? "000" : "111";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl text-ink">{via === "guest" ? "Something not working?" : "Report a problem"}</h1>
        {via === "guest" ? (
          <p className="mt-2 text-lg text-muted">
            Tell us what is wrong at <strong className="text-ink">{property.name}</strong>. We let your host know straight away and get it sorted. It takes a minute and costs you nothing.
          </p>
        ) : (
          <p className="mt-2 text-lg text-muted">
            At <strong className="text-ink">{property.name}</strong>, {addressLine(property)}. A tradie is sent as soon as you send this, and the owner is told. Nothing for you to pay.
          </p>
        )}
      </div>

      <Notice tone="warn" title={`In danger? Call ${emergency} first`}>
        Fire, a gas smell, sparks or anyone hurt: get out and call {emergency}. Then tell us.
      </Notice>

      {already.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="font-bold text-ink">Already being dealt with</p>
          <ul className="mt-2 space-y-2">
            {already.map((job, index) => (
              <li key={index} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">{job.title}</span>
                <Chip tone={job.status === "accepted" || job.status === "on_site" ? "active" : "waiting"}>
                  {job.status === "awaiting_owner" ? "With the host" : statusLabel(job.status, "owner")}
                </Chip>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">No need to report these again.</p>
        </div>
      )}

      <ReportForm
        action={sendReport}
        hidden={{ token }}
        audience={via}
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
        uploadToken={token}
      />
      {via === "team" && <p className="text-center text-sm text-muted">Tip: add this page to your phone&apos;s home screen so it is one tap away next time.</p>}
    </div>
  );
}
