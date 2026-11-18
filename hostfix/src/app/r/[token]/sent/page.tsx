import { connection } from "next/server";
import Link from "next/link";
import { secondaryButtonClass } from "@/components/forms/styles";
import { Icon } from "@/components/ui/Icon";
import { getDb } from "@/lib/db";
import { findPropertyByReportToken } from "@/lib/properties/service";
import { findTeamLink } from "@/lib/team/service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The thank-you screen after a report is sent from a link or QR code. */
export default async function ReportSentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: SearchParams }) {
  const { token } = await params;
  await connection();
  const query = await searchParams;
  const db = await getDb();
  const found = await findPropertyByReportToken(db, token);
  // A cleaner's own team link: back to the same house, or to their list.
  const teamLink = found ? null : await findTeamLink(db, token);
  const house = typeof query.p === "string" && /^[0-9a-f-]{36}$/.test(query.p) ? query.p : null;
  const what = query.w === "owner" || query.w === "dup" ? query.w : "go";
  const number = typeof query.n === "string" && /^\d{1,9}$/.test(query.n) ? query.n : null;
  const guest = found?.via === "guest";

  const title = what === "dup" ? "Already reported" : "Thank you. Sent.";
  const body =
    what === "dup"
      ? "Someone has already told us about this and it is being dealt with. You do not need to do anything else."
      : what === "owner"
        ? teamLink
          ? "The owner has been told and will say whether to send a tradie."
          : "Your host has been told and will arrange the fix."
        : guest
          ? "Your host has been told and a tradie is being found now."
          : "A tradie is being found now and the owner has been told.";

  return (
    <div className="pt-6 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-done-soft text-done">
        <Icon name="check" size={34} />
      </span>
      <h1 className="display mt-5 text-4xl text-ink">{title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-lg text-muted">{body}</p>
      {what !== "dup" && query.t && <p className="mx-auto mt-2 max-w-sm text-muted">We will text you when a tradie is booked and when it is fixed.</p>}
      {number && <p className="tabular mt-4 text-sm text-muted">Job {number}</p>}
      {(found || teamLink) && (
        <Link href={teamLink && house ? `/r/${token}?p=${house}` : `/r/${token}`} className={`${secondaryButtonClass} mt-8`}>
          Report something else
        </Link>
      )}
    </div>
  );
}
