import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { inviteTradie, staffSaveLicence, staffSaveTradie, staffSetTradieStatus, verifyLicence } from "@/app/actions/staff";
import { ActionForm, Area, CheckList, Checks, Field, Tick } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { JobRow } from "@/components/jobs/JobRow";
import { Card, Chip, Facts, Notice, PageTitle, SectionTitle, Stat } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { findTrade, trades } from "@config/trades";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { listJobsForTradie } from "@/lib/jobs/store";
import { getMarket } from "@/lib/markets/store";
import { displayPhone } from "@/lib/phone";
import { SCORE_DAYS, scorecards } from "@/lib/tradies/scorecard";
import { getTradie, listLicences, listSlots } from "@/lib/tradies/service";
import { dateKey, formatDate } from "@/lib/time";
import { WEEKDAY_OPTIONS } from "@/lib/weekdays";

export const metadata: Metadata = { title: "Tradie" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pct = (rate: number | null) => (rate === null ? "No history" : `${Math.round(rate * 100)}%`);

const DID: Record<string, string> = {
  approved: "Approved. They have been texted a link to sign in and add their bank details.",
  back_on: "Back on. They can be offered jobs again.",
  paused: "Paused. They will not be offered jobs.",
  removed: "Removed from the network. Any first-choice or backup slots they held are now empty.",
};

export default async function StaffTradiePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  await requireStaff();
  const query = await searchParams;
  const db = await getDb();
  const tradie = await getTradie(db, id);
  if (!tradie) notFound();
  const market = await getMarket(db, tradie.market);
  if (!market) notFound();
  const licences = await listLicences(db, tradie.id);
  const slots = (await listSlots(db, market.slug)).filter((slot) => slot.tradieId === tradie.id);
  const card = (await scorecards(db, market.slug)).find((candidate) => candidate.tradieId === tradie.id);
  const jobs = await listJobsForTradie(db, tradie.id, { limit: 12 });
  const at = now();
  const today = dateKey(at, market.timezone);
  const licensed = tradie.trades.filter((key) => findTrade(key)?.licenceRequired);
  const licenceOk = (key: string) => licences.some((licence) => licence.trade === key && licence.expiresOn >= today);

  const checks: { ok: boolean; label: string; fix: string }[] = [
    { ok: tradie.status === "approved", label: "Approved by the team", fix: tradie.status === "applied" ? "Approve them below once their details check out." : tradie.status === "paused" ? "They are paused." : "They have been removed." },
    { ok: Boolean(tradie.phone), label: "Mobile number on file", fix: "Offers are sent by text. They need a mobile number." },
    { ok: tradie.payoutsEnabled, label: "Bank details set up", fix: "They do this themselves: sign in, Profile, Add bank details. Text them the link below." },
    ...licensed.map((key) => ({
      ok: licenceOk(key),
      label: `${findTrade(key)?.label ?? key} licence, in date`,
      fix: `Without it they are not offered ${findTrade(key)?.label.toLowerCase() ?? key} jobs. Other work is not affected.`,
    })),
  ];
  const blocking = checks.slice(0, 3).filter((check) => !check.ok);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle
        title={tradie.businessName}
        back={{ href: `/admin/tradies?market=${market.slug}`, label: "Tradies" }}
        intro={`${tradie.name} · ${market.name}`}
        action={<Chip tone={tradie.status === "approved" ? "done" : tradie.status === "applied" ? "alert" : tradie.status === "paused" ? "waiting" : "quiet"}>{tradie.status === "applied" ? "Waiting for approval" : tradie.status}</Chip>}
      />

      {typeof query.did === "string" && DID[query.did] && <Notice tone="good" title={DID[query.did]} />}
      {query.added && (
        <Notice tone="good" title="Added">
          Next: add and check their licences, then approve them.
        </Notice>
      )}

      <Card className="sm:p-6">
        <SectionTitle action={<Chip tone={blocking.length === 0 ? "done" : "alert"}>{blocking.length === 0 ? "Getting offers" : "Not getting offers"}</Chip>}>Can they be offered jobs?</SectionTitle>
        <ul className="space-y-2.5">
          {checks.map((check) => (
            <li key={check.label} className="flex gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${check.ok ? "bg-done-soft text-done" : "bg-alert-soft text-alert"}`}>
                <Icon name={check.ok ? "check" : "queue"} size={14} />
              </span>
              <span>
                <span className="block font-semibold text-ink">{check.label}</span>
                {!check.ok && <span className="block text-sm text-muted">{check.fix}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {tradie.status === "applied" && (
            <ActionForm action={staffSetTradieStatus} className="">
              <input type="hidden" name="tradieId" value={tradie.id} />
              <input type="hidden" name="status" value="approved" />
              <SubmitButton pendingLabel="Approving...">Approve</SubmitButton>
            </ActionForm>
          )}
          {tradie.status === "approved" && (
            <ActionForm action={staffSetTradieStatus} className="">
              <input type="hidden" name="tradieId" value={tradie.id} />
              <input type="hidden" name="status" value="paused" />
              <SubmitButton variant="secondary" pendingLabel="Pausing...">
                Pause
              </SubmitButton>
            </ActionForm>
          )}
          {(tradie.status === "paused" || tradie.status === "removed") && (
            <ActionForm action={staffSetTradieStatus} className="">
              <input type="hidden" name="tradieId" value={tradie.id} />
              <input type="hidden" name="status" value="approved" />
              <SubmitButton variant="secondary" pendingLabel="Saving...">
                Put back on
              </SubmitButton>
            </ActionForm>
          )}
          {tradie.status !== "removed" && tradie.phone && (
            <ActionForm action={inviteTradie} className="">
              <input type="hidden" name="tradieId" value={tradie.id} />
              <SubmitButton variant="secondary" pendingLabel="Texting...">
                Text them the sign-in link
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <SectionTitle>Contact</SectionTitle>
          <Facts
            rows={[
              { label: "Name", value: tradie.name },
              {
                label: "Mobile",
                value: tradie.phone ? (
                  <a href={`tel:${tradie.phone}`} className="text-brand underline underline-offset-2">
                    {displayPhone(tradie.phone)}
                  </a>
                ) : (
                  "None"
                ),
              },
              { label: "Email", value: tradie.email ?? "None" },
              { label: "Joined", value: formatDate(tradie.createdAt, market.timezone) },
              ...(slots.length > 0
                ? [{ label: "First pick for", value: slots.map((slot) => `${findTrade(slot.trade)?.label ?? slot.trade} (${slot.rank === 1 ? "first choice" : "backup"})`).join(", ") }]
                : []),
            ]}
          />
        </Card>
        <div className="grid grid-cols-2 content-start gap-3">
          <Stat label="Offers accepted" value={pct(card?.acceptanceRate ?? null)} note={card && card.offers > 0 ? `${card.accepted} of ${card.offers}` : `Last ${SCORE_DAYS} days`} tone={card?.belowTarget && card.acceptanceRate !== null && card.acceptanceRate < 0.8 ? "alert" : undefined} />
          <Stat label="On site in time" value={pct(card?.onTimeRate ?? null)} note={card && card.jobs > 0 ? `${card.onTime} of ${card.jobs}` : `Last ${SCORE_DAYS} days`} tone={card?.belowTarget && card.onTimeRate !== null && card.onTimeRate < 0.8 ? "alert" : undefined} />
          <div className="col-span-2">
            <Stat label="Usual time to accept" value={card?.avgMinutesToAccept !== null && card?.avgMinutesToAccept !== undefined ? `${card.avgMinutesToAccept} min` : "No history"} />
          </div>
        </div>
      </div>

      <Card className="sm:p-6">
        <SectionTitle>Licences</SectionTitle>
        {licensed.length === 0 ? (
          <p className="text-muted">None of their work needs a licence.</p>
        ) : (
          <div className="space-y-5">
            <p className="text-muted">
              Check each licence against the public register before marking it as checked (in New Zealand: the Plumbers, Gasfitters and Drainlayers Board, and the Electrical Workers Registration Board). Licensed jobs are only offered while
              the number is on file and the date has not passed.
            </p>
            {licensed.map((key) => {
              const licence = licences.find((candidate) => candidate.trade === key);
              const current = licence ? licence.expiresOn >= today : false;
              return (
                <div key={key} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink">{findTrade(key)?.label ?? key}</p>
                    {!licence ? <Chip tone="alert">Not on file</Chip> : !current ? <Chip tone="alert">Run out</Chip> : licence.verifiedAt ? <Chip tone="done">Checked</Chip> : <Chip tone="waiting">Not checked yet</Chip>}
                  </div>
                  <ActionForm action={staffSaveLicence} className="space-y-3">
                    <input type="hidden" name="tradieId" value={tradie.id} />
                    <input type="hidden" name="trade" value={key} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Licence number" name={`licenceNumber-${key}`} required maxLength={40} defaultValue={licence?.licenceNumber ?? ""} />
                      <Field label="Runs out on" name={`expiresOn-${key}`} type="date" required defaultValue={licence?.expiresOn ?? ""} />
                    </div>
                    <SubmitButton variant="secondary" pendingLabel="Saving...">
                      Save licence
                    </SubmitButton>
                  </ActionForm>
                  {licence && current && !licence.verifiedAt && (
                    <ActionForm action={verifyLicence} className="mt-3">
                      <input type="hidden" name="tradieId" value={tradie.id} />
                      <input type="hidden" name="licenceId" value={licence.id} />
                      <SubmitButton variant="small" pendingLabel="Saving...">
                        I have checked this on the register
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {licence?.verifiedAt && <p className="mt-2 text-sm text-muted">Checked on {formatDate(licence.verifiedAt, market.timezone)}.</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Reveal label="Edit their details and notes" open={Boolean(query.edit)}>
        <ActionForm action={staffSaveTradie} className="space-y-4">
          <input type="hidden" name="tradieId" value={tradie.id} />
          <Field label="Business name" name="businessName" required maxLength={80} defaultValue={tradie.businessName} />
          <CheckList
            name="trades"
            legend="Work they do"
            defaultValues={tradie.trades}
            options={trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: trade.label, detail: trade.licenceRequired ? "Needs a licence on file" : undefined }))}
          />
          <Checks label="Days they work" name="daysAvailable" options={WEEKDAY_OPTIONS} defaultValues={tradie.daysAvailable} />
          <Tick name="afterHours" label="Takes after-hours call-outs" defaultChecked={tradie.afterHours} />
          <Tick name="gstRegistered" label={`Registered for ${market.taxName}`} defaultChecked={tradie.gstRegistered} />
          <Field label={`${market.taxName} number`} name="gstNumber" maxLength={20} defaultValue={tradie.gstNumber ?? ""} />
          <Field label="Public liability insurance runs out on" name="insuranceExpiresOn" type="date" defaultValue={tradie.insuranceExpiresOn ?? ""} />
          <Area label="Notes (only the team sees these)" name="notes" rows={3} maxLength={2000} defaultValue={tradie.notes} />
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save
          </SubmitButton>
        </ActionForm>
      </Reveal>

      {jobs.length > 0 && (
        <section>
          <SectionTitle>Their jobs</SectionTitle>
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} href={`/admin/jobs/${job.id}`} audience="staff" now={at} timeZone={market.timezone} />
            ))}
          </div>
        </section>
      )}

      {tradie.status !== "removed" && (
        <Reveal label="Remove from the network" tone="alert">
          <ActionForm action={staffSetTradieStatus} className="space-y-3">
            <input type="hidden" name="tradieId" value={tradie.id} />
            <input type="hidden" name="status" value="removed" />
            <p className="text-muted">They stop getting offers and lose any first-choice or backup slot. Jobs they have already accepted stay theirs: cancel or reassign those first. Their history is kept.</p>
            <SubmitButton variant="danger" pendingLabel="Removing...">
              Remove this tradie
            </SubmitButton>
          </ActionForm>
        </Reveal>
      )}
    </div>
  );
}
