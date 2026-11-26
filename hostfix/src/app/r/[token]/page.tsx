import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { checkTeamCode, sendReport, sendTeamCode } from "@/app/actions/report";
import { ActionForm, Field } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { ReportForm } from "@/components/jobs/ReportForm";
import { Chip, Notice, RowLink } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { appSecret } from "@/lib/env";
import { reportFormData } from "@/lib/jobs/report-data";
import { statusLabel } from "@/lib/jobs/types";
import { displayPhone } from "@/lib/phone";
import { addressLine, findPropertyByReportToken, type Property } from "@/lib/properties/service";
import { maskedPhone, openTeamPending, TEAM_DEVICE_COOKIE, TEAM_PENDING_COOKIE, teamDeviceMatches } from "@/lib/team/device";
import { findTeamLink, housesForLink, type TeamHouse, type TeamLink } from "@/lib/team/service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** What is already being dealt with at this property, so the same thing is not reported twice. Titles only. */
async function openJobs(db: Db, propertyId: string) {
  return db.query<{ title: string; status: "awaiting_owner" | "offering" | "unfilled" | "accepted" | "on_site" | "awaiting_approval" }>(
    `select title, status from public.jobs
      where property_id = $1::uuid and status in ('awaiting_owner', 'offering', 'unfilled', 'accepted', 'on_site', 'awaiting_approval')
      order by created_at desc limit 6`,
    [propertyId],
  );
}

function Broken() {
  return (
    <div className="space-y-4">
      <h1 className="display text-4xl text-ink">This link does not work any more</h1>
      <p className="text-lg text-muted">It may have been replaced. Please ask your host for the new one, or contact them directly.</p>
    </div>
  );
}

/**
 * The page behind every report link: the guest QR card, an older
 * per-property team link, or a cleaner's own team link (DECISIONS.md,
 * 2026-11-18), which lists their houses once the phone has proved the number.
 */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: SearchParams }) {
  const { token } = await params;
  await connection();
  // Read the cookies before anything else: what this page shows depends on the phone looking at it.
  const cookieStore = await cookies();
  const query = await searchParams;
  const db = await getDb();
  const found = await findPropertyByReportToken(db, token);
  if (found) return <PropertyReport db={db} token={token} property={found.property} via={found.via} />;

  const link = await findTeamLink(db, token);
  if (!link) return <Broken />;
  const secret = appSecret();
  if (!teamDeviceMatches(secret, cookieStore.get(TEAM_DEVICE_COOKIE)?.value, link)) {
    const pending = query.code ? openTeamPending(secret, cookieStore.get(TEAM_PENDING_COOKIE)?.value) : null;
    return <CheckPhone link={link} pending={pending && pending.linkId === link.id ? pending : null} />;
  }

  const houses = await housesForLink(db, link.id);
  const chosen = typeof query.p === "string" ? houses.find((house) => house.property.id === query.p) : houses.length === 1 ? houses[0] : undefined;
  if (chosen) return <TeamHouseReport db={db} token={token} house={chosen} many={houses.length > 1} />;
  return <HouseList token={token} houses={houses} />;
}

/** A forwarded link opens nothing until the phone proves the number with a code, once. */
function CheckPhone({ link, pending }: { link: TeamLink; pending: { demoCode?: string } | null }) {
  const where = maskedPhone(displayPhone(link.phone));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl text-ink">Your houses</h1>
        <p className="mt-2 text-lg text-muted">
          This is your own link for reporting problems at the houses you look after. To keep it private, we check it is you once on each phone.
        </p>
      </div>
      {pending ? (
        <div className="space-y-4">
          <p className="text-muted">
            We sent a six-digit code to <strong className="text-ink">{where}</strong>. It works for 10 minutes.
          </p>
          {pending.demoCode && (
            <Notice tone="info" title="Demo mode">
              No text service is connected, so nothing was really sent. The code is{" "}
              <strong className="tabular text-lg tracking-widest text-ink" data-demo-code>
                {pending.demoCode}
              </strong>
            </Notice>
          )}
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
            <ActionForm action={checkTeamCode}>
              <input type="hidden" name="token" value={link.token} />
              <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} placeholder="123456" />
              <SubmitButton pendingLabel="Checking..." className="w-full">
                Open my houses
              </SubmitButton>
            </ActionForm>
          </div>
          <ActionForm action={sendTeamCode}>
            <input type="hidden" name="token" value={link.token} />
            <SubmitButton variant="small" pendingLabel="Sending...">
              Send a new code
            </SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-ink">
            We will text a six-digit code to <strong>{where}</strong>. You only do this once on this phone.
          </p>
          <ActionForm action={sendTeamCode} className="mt-4 space-y-3">
            <input type="hidden" name="token" value={link.token} />
            <SubmitButton pendingLabel="Sending..." className="w-full">
              Text me the code
            </SubmitButton>
          </ActionForm>
          <p className="mt-3 text-sm text-muted">Not your number? This link was sent to someone else. Ask the owner to add you to their team.</p>
        </div>
      )}
    </div>
  );
}

/** Every house this person may report on, across every owner who has added them. */
function HouseList({ token, houses }: { token: string; houses: TeamHouse[] }) {
  const owners = new Set(houses.map((house) => house.property.ownerId));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl text-ink">Your houses</h1>
        <p className="mt-2 text-lg text-muted">Choose the house with the problem.</p>
      </div>
      {houses.length === 0 ? (
        <Notice tone="info" title="No houses on your list right now">
          The owner may have taken you off, or the property is not covered at the moment. Ask them if it should be on your list.
        </Notice>
      ) : (
        <div className="space-y-2.5">
          {houses.map((house) => (
            <RowLink
              key={house.property.id}
              href={`/r/${token}?p=${house.property.id}`}
              title={house.property.name}
              subtitle={owners.size > 1 ? `${house.property.suburb} · ${house.ownerFirstName}'s` : house.property.suburb}
              leading={
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
                  <Icon name="property" />
                </span>
              }
            />
          ))}
        </div>
      )}
      <p className="text-center text-sm text-muted">Tip: add this page to your phone&apos;s home screen so it is one tap away next time.</p>
    </div>
  );
}

function AlreadyBeingDealtWith({ jobs, guest }: { jobs: Awaited<ReturnType<typeof openJobs>>; guest: boolean }) {
  if (jobs.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-bold text-ink">Already being dealt with</p>
      <ul className="mt-2 space-y-2">
        {jobs.map((job, index) => (
          <li key={index} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ink">{job.title}</span>
            <Chip tone={job.status === "accepted" || job.status === "on_site" ? "active" : "waiting"}>
              {job.status === "awaiting_owner" ? (guest ? "With the host" : "With the owner") : statusLabel(job.status, "owner")}
            </Chip>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">No need to report these again.</p>
    </div>
  );
}

function Danger({ country }: { country: "NZ" | "AU" }) {
  const emergency = country === "AU" ? "000" : "111";
  return (
    <Notice tone="warn" title={`In danger? Call ${emergency} first`}>
      Fire, a gas smell, sparks or anyone hurt: get out and call {emergency}. Then tell us.
    </Notice>
  );
}

/** The report form for one house on a team member's list, signed with their name. */
async function TeamHouseReport({ db, token, house, many }: { db: Db; token: string; house: TeamHouse; many: boolean }) {
  const { property } = house;
  const data = await reportFormData(db, property, "team");
  const ask = house.dispatch === "ask";
  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">Reports are switched off for this property</h1>
        <p className="text-lg text-muted">Please contact the owner directly about anything that needs fixing.</p>
      </div>
    );
  }
  const already = await openJobs(db, property.id);
  return (
    <div className="space-y-6">
      <div>
        {many && (
          <Link href={`/r/${token}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <Icon name="back" size={16} /> All my houses
          </Link>
        )}
        <h1 className="display text-4xl text-ink">Report a problem</h1>
        <p className="mt-2 text-lg text-muted">
          At <strong className="text-ink">{property.name}</strong>, {addressLine(property)}.{" "}
          {ask ? "The owner is asked first, then a tradie is sent." : "A tradie is sent as soon as you send this, and the owner is told."} Nothing for you to pay.
        </p>
      </div>
      <Danger country={data.country} />
      <AlreadyBeingDealtWith jobs={already} guest={false} />
      <ReportForm
        action={sendReport}
        hidden={{ token, propertyId: property.id }}
        audience="team"
        signedAs={house.memberName}
        asksOwner={ask}
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
        emergencyMinutes={data.emergencyMinutes}
        emergencyCents={data.emergencyCents}
        cover={data.cover}
        uploadToken={token}
      />
    </div>
  );
}

/** The guest QR card, or an older per-property team link. Unchanged for anyone who already has one. */
async function PropertyReport({ db, token, property, via }: { db: Db; token: string; property: Property; via: "team" | "guest" }) {
  const data = property.status === "active" ? await reportFormData(db, property, via) : null;
  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl text-ink">Reports are switched off for this property</h1>
        <p className="text-lg text-muted">Please contact {via === "guest" ? "your host" : "the owner"} directly about anything that needs fixing.</p>
      </div>
    );
  }
  const already = await openJobs(db, property.id);

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

      <Danger country={data.country} />
      <AlreadyBeingDealtWith jobs={already} guest={via === "guest"} />

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
        emergencyMinutes={data.emergencyMinutes}
        emergencyCents={data.emergencyCents}
        cover={data.cover}
        uploadToken={token}
      />
      {via === "team" && <p className="text-center text-sm text-muted">Tip: add this page to your phone&apos;s home screen so it is one tap away next time.</p>}
    </div>
  );
}
