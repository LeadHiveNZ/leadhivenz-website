import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { inviteTradie, recordCheckSeen, staffSaveLicence, staffSaveTradie, staffSaveTradieAreas, staffSetTradieStatus, staffUploadCertificate, verifyLicence } from "@/app/actions/staff";
import { ActionForm, Area, CheckList, Checks, Field, FileInput, Tick } from "@/components/forms/ActionForm";
import { CERTIFICATE_ACCEPT } from "@/components/forms/Fields";
import { CertificateList } from "@/components/ui/CertificateList";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { JobRow } from "@/components/jobs/JobRow";
import { Card, Chip, Facts, Notice, PageTitle, SectionTitle, Stat } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { findTrade, trades } from "@config/trades";
import { requireStaff } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { fileStoreReady } from "@/lib/files/store";
import { listInsuranceCertificates } from "@/lib/tradies/certificate";
import { listJobsForTradie } from "@/lib/jobs/store";
import { getMarket } from "@/lib/markets/store";
import { displayPhone } from "@/lib/phone";
import {
  FLAG_DAYS, flagsNeedReview, laterWave, MIN_ARRIVALS, needsReview, NO_SHOW_DAYS, ON_TIME_TARGET, onTimeRecords, recentFlags, recentNoShows, tradieTrust, TRUSTED_FINISHED_JOBS,
} from "@/lib/tradies/reliability";
import { SCORE_DAYS, scorecards } from "@/lib/tradies/scorecard";
import { getTradie, listLicences, listSlots, insuranceProblem, TRADIE_AGREEMENT_VERSION } from "@/lib/tradies/service";
import { formatMoney } from "@/lib/money";
import { balanceOwed } from "@/lib/billing/chargebacks";
import { hoursByJobType, marketQuoteRate, QUOTE_RATE_FLOOR, QUOTE_RATE_MIN_JOBS, QUOTE_RATE_MULTIPLE, quoteRate, quoteRateFlagged } from "@/lib/tradies/quote-rate";
import { dateKey, formatDate } from "@/lib/time";
import { WEEKDAY_OPTIONS } from "@/lib/weekdays";

export const metadata: Metadata = { title: "Tradie" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The public register of Licensed Building Practitioners, as linked from www.lbp.govt.nz (checked 17 Nov 2026). */
const LBP_REGISTER = "https://kete-lbp.mbie.govt.nz/advanced-building-practitioner-search/";

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
  const certificates = await listInsuranceCertificates(db, tradie.id);
  const slots = (await listSlots(db, market.slug)).filter((slot) => slot.tradieId === tradie.id);
  const card = (await scorecards(db, market.slug)).find((candidate) => candidate.tradieId === tradie.id);
  const jobs = await listJobsForTradie(db, tradie.id, { limit: 12 });
  const at = now();
  const noShows = await recentNoShows(db, tradie.id, at);
  // Jobs the app could not confirm (DECISIONS.md, 2026-11-19), and whether an unanswered one is paid without the team.
  const flagged = await recentFlags(db, tradie.id, at);
  const owed = await balanceOwed(db, tradie.id);
  const trust = await tradieTrust(db, tradie.id, null, at);
  const record = (await onTimeRecords(db, [tradie.id])).get(tradie.id);
  // Quote rate and hours quoted (DECISIONS.md, 2026-11-20, third entry). Admin only.
  const quotes = await quoteRate(db, tradie.id);
  const quoteAverage = await marketQuoteRate(db, tradie.market);
  const hours = await hoursByJobType(db, tradie.id, tradie.market);
  const today = dateKey(at, market.timezone);
  const licensed = tradie.trades.filter((key) => findTrade(key)?.licenceRequired);
  const licenceOk = (key: string) => licences.some((licence) => licence.trade === key && licence.expiresOn >= today);

  const checks: { ok: boolean; label: string; fix: string }[] = [
    { ok: tradie.status === "approved", label: "Approved by the team", fix: tradie.status === "applied" ? "Approve them below once their details check out." : tradie.status === "paused" ? "They are paused." : "They have been removed." },
    { ok: Boolean(tradie.phone), label: "Mobile number on file", fix: "Offers are sent by text. They need a mobile number." },
    { ok: tradie.payoutsEnabled, label: "Bank details set up", fix: "They do this themselves: sign in, Profile, Add bank details. Text them the link below." },
    {
      ok: insuranceProblem(tradie, today) === null,
      label: "Public liability insurance on file, in date",
      fix:
        insuranceProblem(tradie, today) ??
        "Insurer, policy number, expiry date and the certificate, under Insurance below or by them on their profile. No jobs are offered without it.",
    },
    {
      ok: Boolean(tradie.recordCheckSeenAt),
      label: tradie.recordCheckSeenAt
        ? `Criminal record check seen (${tradie.recordCheckSeenBy ?? "staff"}, ${formatDate(tradie.recordCheckSeenAt, market.timezone)})`
        : "Criminal record check seen",
      fix: "They request it free from the Ministry of Justice (up to 20 working days) and send it to you. Look at it, then press \"I've seen their record check\" below. Only that note is kept.",
    },
    {
      ok: tradie.agreementVersion === TRADIE_AGREEMENT_VERSION,
      label: `Agreed to the tradie agreement (${TRADIE_AGREEMENT_VERSION})`,
      fix: tradie.agreementVersion
        ? `They agreed to the ${tradie.agreementVersion} version. They agree to the new one in the app, on their home page. No offers until they do.`
        : "They agree in the app, on their home page or profile. No offers until they do.",
    },
    ...licensed.map((key) => ({
      ok: licenceOk(key),
      label: `${findTrade(key)?.label ?? key} licence, in date`,
      fix: `Without it they are not offered ${findTrade(key)?.label.toLowerCase() ?? key} jobs. Other work is not affected.`,
    })),
    // Building work only goes to a tradie with an LBP number on file (DECISIONS.md, 2026-11-24).
    ...(tradie.trades.some((key) => findTrade(key)?.lbpRequired)
      ? [{ ok: (tradie.lbpNumber ?? "").length >= 2, label: "LBP number on file (for building work)", fix: "Without it they are not offered building jobs. Check the number on the public LBP register (linked below) and add it under Details." }]
      : []),
  ];
  const blocking = checks.slice(0, 6).filter((check) => !check.ok);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle
        title={tradie.businessName}
        back={{ href: `/admin/tradies?market=${market.slug}`, label: "Tradies" }}
        intro={`${tradie.name} · ${market.name}`}
        action={<Chip tone={tradie.status === "approved" ? "done" : tradie.status === "applied" ? "alert" : tradie.status === "paused" ? "waiting" : "quiet"}>{tradie.status === "applied" ? "Waiting for approval" : tradie.status}</Chip>}
      />

      {typeof query.did === "string" && DID[query.did] && <Notice tone="good" title={DID[query.did]} />}
      {owed > 0 && (
        <Notice tone="warn" title={`Owes ${formatMoney(owed, market.currency)} from a lost chargeback`}>
          Taken from their later payments, never more than half of any one. Anything left when they leave must be repaid.
        </Notice>
      )}
      {needsReview(noShows) && (
        <Notice tone="warn" title={`For review: ${noShows} no-shows in the last ${NO_SHOW_DAYS} days`}>
          They accepted {noShows} jobs and were not there by the promised time. Talk to them before deciding anything. Nothing on their account has been changed, and only a person can pause or
          remove a tradie. Passing on offers is never counted.
        </Notice>
      )}
      {flagsNeedReview(flagged) && (
        <Notice tone="warn" title={`For review: ${flagged} flagged jobs in the last ${FLAG_DAYS} days`}>
          The app could not confirm {flagged} of their jobs (location, photos or time on site). Open their recent jobs below, look at the before and after photos, and talk to them before
          deciding anything. Nothing on their account has been changed, and only a person can pause or remove a tradie.
        </Notice>
      )}
      {query.added && (
        <Notice tone="good" title="Added">
          Next: add their insurance and certificate, and check their licences, then approve them.
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
          {!tradie.recordCheckSeenAt && (
            <ActionForm action={recordCheckSeen} className="">
              <input type="hidden" name="tradieId" value={tradie.id} />
              <SubmitButton variant="secondary" pendingLabel="Saving...">I&apos;ve seen their record check</SubmitButton>
            </ActionForm>
          )}
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
          <Stat label="On site in time" value={pct(card?.onTimeRate ?? null)} note={card && card.jobs > 0 ? `${card.onTime} of ${card.jobs} accepted, last ${SCORE_DAYS} days` : `Last ${SCORE_DAYS} days`} tone={card?.belowTarget ? "alert" : undefined} />
          <Stat label={`No-shows, last ${NO_SHOW_DAYS} days`} value={String(noShows)} note="Accepted, nobody there by the promised time" tone={needsReview(noShows) ? "alert" : undefined} />
          <Stat label={`Flagged jobs, last ${FLAG_DAYS} days`} value={String(flagged)} note="Location, photos or time on site not confirmed" tone={flagsNeedReview(flagged) ? "alert" : undefined} />
          <Stat
            label="Trusted"
            value={trust.trusted ? "Yes" : "Not yet"}
            note={trust.trusted ? `${trust.finishedJobs} finished jobs, no flags in ${FLAG_DAYS} days: paid if an owner does not answer` : `${trust.finishedJobs} of ${TRUSTED_FINISHED_JOBS} finished jobs${trust.otherFlags > 0 ? `, ${trust.otherFlags} flagged in ${FLAG_DAYS} days` : ""}`}
          />
          <div className="col-span-2">
            <Stat
              label="Network order"
              value={record && record.arrivals >= MIN_ARRIVALS ? `${record.onTime} of last ${record.arrivals} on time` : `${record?.arrivals ?? 0} arrivals so far`}
              note={laterWave(record) ? `Under ${Math.round(ON_TIME_TARGET * 100)}%: offered network jobs in the second wave` : `Offered network jobs in the first wave. Counted from ${MIN_ARRIVALS} arrivals.`}
              tone={laterWave(record) ? "alert" : undefined}
            />
          </div>
          <div className="col-span-2">
            <Stat
              label="Menu jobs turned into a quote"
              value={quotes.rate === null ? `${quotes.quoted} of ${quotes.jobs} so far` : `${Math.round(quotes.rate * 100)}% (${quotes.quoted} of last ${quotes.jobs})`}
              note={`Quotes and "not the job described" on menu jobs they took. Market average ${quoteAverage === null ? "not known yet" : `${Math.round(quoteAverage * 100)}%`}. Flagged over ${Math.round(QUOTE_RATE_FLOOR * 100)}% and over ${QUOTE_RATE_MULTIPLE} times the average, from ${QUOTE_RATE_MIN_JOBS} jobs. Declines never count.`}
              tone={quoteRateFlagged(quotes.rate, quoteAverage) ? "alert" : undefined}
            />
          </div>
          <div className="col-span-2">
            <Stat label="Usual time to accept" value={card?.avgMinutesToAccept !== null && card?.avgMinutesToAccept !== undefined ? `${card.avgMinutesToAccept} min` : "No history"} />
          </div>
        </div>
      </div>

      {market.areas.length > 0 && (
        <Card className="sm:p-6">
          <SectionTitle>Areas they cover</SectionTitle>
          <ActionForm action={staffSaveTradieAreas} className="space-y-4">
            <input type="hidden" name="tradieId" value={tradie.id} />
            <CheckList
              name="areas"
              legend="Offers only come for properties in these areas"
              hint="A property with no area is offered to everyone. There is no travel charge."
              defaultValues={tradie.areas}
              options={market.areas.map((area) => ({ key: area.key, label: area.name }))}
            />
            <SubmitButton pendingLabel="Saving...">Save areas</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {hours.length > 0 && (
        <Card className="sm:p-6">
          <SectionTitle>Hours quoted, against other tradies</SectionTitle>
          <ul className="divide-y divide-line text-sm">
            {hours.map((row) => (
              <li key={row.jobType} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold text-ink">{row.jobType}</span>
                <span className="tabular text-muted">
                  {row.mineAverage.toFixed(2)} h average ({row.mineCount}) · others {row.othersAverage === null ? "none yet" : `${row.othersAverage.toFixed(2)} h (${row.othersCount})`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="sm:p-6">
        <SectionTitle action={<Chip tone={insuranceProblem(tradie, today) ? "alert" : "done"}>{insuranceProblem(tradie, today) ? "Not complete" : "In date"}</Chip>}>
          Public liability insurance
        </SectionTitle>
        <Facts
          rows={[
            { label: "Insurer", value: tradie.insurer ?? "Not given" },
            { label: "Policy number", value: tradie.insurancePolicyNumber ?? "Not given" },
            { label: "Runs out on", value: tradie.insuranceExpiresOn ?? "Not given" },
          ]}
        />
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">Open the certificate and check the insurer, policy number, expiry date and their name match what is typed in, before you approve them.</p>
          <CertificateList certificates={certificates} timeZone={market.timezone} />
          <ActionForm action={staffUploadCertificate} className="space-y-3">
            <input type="hidden" name="tradieId" value={tradie.id} />
            <FileInput
              label="Add a certificate for them"
              name="certificate"
              accept={CERTIFICATE_ACCEPT}
              ready={fileStoreReady()}
              hint="For one they sent you. A PDF, JPG or PNG, up to 4 MB."
              laterNote="File storage is not set up, so certificates cannot be added yet. See the setup checklist."
            />
            <SubmitButton variant="secondary" pendingLabel="Uploading...">
              Upload certificate
            </SubmitButton>
          </ActionForm>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-semibold text-ink">Licensed Building Practitioner (LBP) number</p>
          <p className="mt-1 text-muted">
            {tradie.lbpNumber ?? "None given. That is fine: most jobs do not need one."}{" "}
            <a href={LBP_REGISTER} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
              Search the LBP register
            </a>
          </p>
          <p className="mt-1 text-sm text-muted">Optional. Nothing is held back without it.</p>
        </div>
      </Card>

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
            options={trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: trade.label, detail: trade.licenceRequired ? "Needs a licence on file" : trade.lbpRequired ? "Needs an LBP number on file" : undefined }))}
          />
          <Checks label="Days they work" name="daysAvailable" options={WEEKDAY_OPTIONS} defaultValues={tradie.daysAvailable} />
          <Tick name="afterHours" label="Takes after-hours call-outs" defaultChecked={tradie.afterHours} />
          <Tick name="gstRegistered" label={`Registered for ${market.taxName}`} defaultChecked={tradie.gstRegistered} />
          <Field label={`${market.taxName} number`} name="gstNumber" maxLength={20} defaultValue={tradie.gstNumber ?? ""} />
          <Field label="Public liability insurer" name="insurer" maxLength={120} defaultValue={tradie.insurer ?? ""} />
          <Field label="Insurance policy number" name="insurancePolicyNumber" maxLength={80} defaultValue={tradie.insurancePolicyNumber ?? ""} />
          <Field label="Public liability insurance runs out on" name="insuranceExpiresOn" type="date" defaultValue={tradie.insuranceExpiresOn ?? ""} hint="All three, and the certificate, are needed before they can be approved. No jobs are offered once it runs out." />
          <Field label="Licensed Building Practitioner (LBP) number (optional)" name="lbpNumber" maxLength={40} defaultValue={tradie.lbpNumber ?? ""} />
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
