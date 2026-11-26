import type { Metadata } from "next";
import { saveTradieAreas, saveTradieLicence, saveTradieProfile, setPaused, setUpPayouts } from "@/app/actions/tradie";
import { ActionForm, CheckList, Checks, Field, FileInput, Tick } from "@/components/forms/ActionForm";
import { HoursFields } from "@/components/forms/HoursFields";
import { CERTIFICATE_ACCEPT } from "@/components/forms/Fields";
import { CertificateList } from "@/components/ui/CertificateList";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { SignOut } from "@/components/ui/SignOut";
import { findTrade, trades } from "@config/trades";
import { requireTradie } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { fileStoreReady } from "@/lib/files/store";
import { listInsuranceCertificates } from "@/lib/tradies/certificate";
import { getMarket } from "@/lib/markets/store";
import { displayPhone } from "@/lib/phone";
import { getTradie, insuranceProblem, listLicences } from "@/lib/tradies/service";
import { dateKey } from "@/lib/time";
import { WEEKDAY_OPTIONS } from "@/lib/weekdays";
import { payTiming } from "@/lib/markets/display";
import { workingHours } from "@/lib/leads/price-list";
import { formatMoney } from "@/lib/money";
import { surchargeShare } from "@/lib/jobs/pricing";
import { AgreementCard } from "@/components/jobs/AgreementCard";
import { TradieOwnClients } from "@/components/jobs/OwnClients";
import { invitesFromTradie, pairsForTradie } from "@/lib/clients/own-clients";

export const metadata: Metadata = { title: "Profile" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TradieProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireTradie("/tradie/profile", { whileWaiting: true });
  const query = await searchParams;
  const db = await getDb();
  const tradie = await getTradie(db, viewer.tradieId);
  const market = tradie ? await getMarket(db, tradie.market) : null;
  if (!tradie || !market) return <Notice tone="error" title="We could not find your tradie profile" />;
  const licences = await listLicences(db, tradie.id);
  const certificates = await listInsuranceCertificates(db, tradie.id);
  const filesReady = fileStoreReady();
  const today = dateKey(now(), market.timezone);
  const licensed = tradie.trades.filter((key) => findTrade(key)?.licenceRequired);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle title="Profile" intro={`${tradie.name} · ${tradie.phone ? displayPhone(tradie.phone) : "no mobile"} · ${market.name}`} />

      {tradie.status === "applied" && (
        <Notice tone="warn" title="Waiting for approval: we'll text you">
          A person on our team checks every tradie before any work is offered. Until then this page is all there is. Fill in your insurance, upload
          your certificate, and add your licences and bank details, so we can approve you sooner.
        </Notice>
      )}

      <AgreementCard tradie={tradie} />

      {query.payouts === "done" && <Notice tone="good" title="Bank details set up. You can be paid." />}
      {query.payouts === "checking" && (
        <Notice tone="info" title="Your bank details are being checked">
          This usually takes a few minutes. Offers start once it is done.
        </Notice>
      )}
      {query.payouts === "again" && (
        <Notice tone="warn" title="Bank details are not finished">
          Something was left out. Tap the button below to carry on where you stopped.
        </Notice>
      )}

      <Card className="scroll-mt-20 sm:p-6" as="section">
        <div id="bank" className="scroll-mt-24" />
        <SectionTitle action={<Chip tone={tradie.payoutsEnabled ? "done" : "alert"}>{tradie.payoutsEnabled ? "Ready" : "Needed"}</Chip>}>Getting paid</SectionTitle>
        <p className="text-muted">
          {tradie.payoutsEnabled
            ? `Your bank details are set up. ${payTiming(market).line}`
            : "Your bank account and ID are entered on our payment company's secure page, not here. It takes about five minutes. You are only offered jobs once this is done."}
        </p>
        {!tradie.payoutsEnabled && (
          <ActionForm action={setUpPayouts} className="mt-4">
            <SubmitButton pendingLabel="Opening...">{tradie.payoutAccountId ? "Carry on with bank details" : "Add bank details"}</SubmitButton>
          </ActionForm>
        )}
      </Card>

      {market.areas.length > 0 && (
        <Card className="sm:p-6" as="section">
          <SectionTitle>Areas you cover</SectionTitle>
          <ActionForm action={saveTradieAreas} className="space-y-4">
            <CheckList
              name="areas"
              legend="Where you will go"
              hint="You are only offered jobs at properties in the areas you tick. There is no travel charge, so only tick the areas you are happy to go to at the fixed price. Change them any time."
              defaultValues={tradie.areas}
              options={market.areas.map((area) => ({ key: area.key, label: area.name, detail: area.suburbs.filter((name) => name !== area.name).join(", ") || undefined }))}
            />
            <SubmitButton pendingLabel="Saving...">Save areas</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card className="sm:p-6" as="section">
        <SectionTitle>Your business</SectionTitle>
        <ActionForm action={saveTradieProfile} className="space-y-5">
          <Field label="Business name" name="businessName" required maxLength={80} defaultValue={tradie.businessName} hint="Owners see this when you take their job." />
          <CheckList
            name="trades"
            legend="Work you do"
            defaultValues={tradie.trades}
            options={trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: trade.label, detail: trade.licenceRequired ? "Needs a licence on file" : trade.lbpRequired ? "Needs an LBP number on file" : undefined }))}
          />
          <Checks label="Days you work" name="daysAvailable" options={WEEKDAY_OPTIONS} defaultValues={tradie.daysAvailable} hint="We only send you jobs on these days." />
          <HoursFields
            legend="Send me jobs from __ to __"
            from={tradie.hoursFrom}
            to={tradie.hoursTo}
            hint={`No jobs, texts or notifications outside these hours. Standard, urgent and emergency jobs all follow them. Arrive outside ${workingHours(market)} and you get ${formatMoney(surchargeShare(market.afterHoursSurchargeCents, market.platformFeeBps), market.currency)} on top of the job's pay: the after-hours surcharge less the platform fee.`}
          />
          <Tick name="gstRegistered" label={`I am registered for ${market.taxName}`} defaultChecked={tradie.gstRegistered} />
          <Field label={`${market.taxName} number (if registered)`} name="gstNumber" maxLength={20} defaultValue={tradie.gstNumber ?? ""} />
          <Field
            label="Licensed Building Practitioner (LBP) number (optional)"
            name="lbpNumber"
            maxLength={40}
            defaultValue={tradie.lbpNumber ?? ""}
            hint="Only if you have one. Building jobs only go to tradies with an LBP number on file. Most other jobs do not need one."
          />
          <fieldset className="space-y-4 rounded-2xl border border-line p-4">
            <legend className="flex items-center gap-2 px-1 font-semibold text-ink">
              Public liability insurance
              <Chip tone={insuranceProblem(tradie, today) ? "alert" : "done"}>{insuranceProblem(tradie, today) ? "Needed" : "In date"}</Chip>
            </legend>
            <p className="text-sm text-muted">
              Public liability insurance: insurer, policy number, expiry date, and the certificate from your insurer uploaded. We can&apos;t offer you jobs without it.
            </p>
            <Field label="Insurer" name="insurer" maxLength={120} defaultValue={tradie.insurer ?? ""} />
            <Field label="Policy number" name="insurancePolicyNumber" maxLength={80} defaultValue={tradie.insurancePolicyNumber ?? ""} />
            <Field label="Expiry date" name="insuranceExpiresOn" type="date" defaultValue={tradie.insuranceExpiresOn ?? ""} hint="When it runs out, jobs stop being offered to you until you add the renewed policy." />
            <CertificateList certificates={certificates} timeZone={market.timezone} />
            <FileInput
              label={certificates.length > 0 ? "Upload a new certificate (when you renew)" : "Upload your certificate"}
              name="certificate"
              accept={CERTIFICATE_ACCEPT}
              ready={filesReady}
              hint="The certificate of currency from your insurer. A PDF, JPG or PNG, up to 4 MB. Only our team and you can open it."
              laterNote="Certificates can't be uploaded yet because file storage is not set up. You can add it here later. We can't approve you until it is on file."
            />
          </fieldset>
          <SubmitButton variant="secondary" pendingLabel="Saving...">
            Save
          </SubmitButton>
        </ActionForm>
      </Card>

      <Card className="sm:p-6" as="section">
        <div id="licences" className="scroll-mt-24" />
        <SectionTitle>Licences</SectionTitle>
        {licensed.length === 0 ? (
          <p className="text-muted">None of the work you have ticked needs a licence.</p>
        ) : (
          <div className="space-y-5">
            <p className="text-muted">Licensed jobs are only offered to you while a licence with a number and a date that has not passed is on file.</p>
            {licensed.map((key) => {
              const licence = licences.find((candidate) => candidate.trade === key);
              const current = licence ? licence.expiresOn >= today : false;
              return (
                <div key={key} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink">{findTrade(key)?.label ?? key}</p>
                    {!licence ? (
                      <Chip tone="alert">Not on file</Chip>
                    ) : !current ? (
                      <Chip tone="alert">Run out</Chip>
                    ) : licence.verifiedAt ? (
                      <Chip tone="done">Checked</Chip>
                    ) : (
                      <Chip tone="waiting">On file, being checked</Chip>
                    )}
                  </div>
                  <ActionForm action={saveTradieLicence} className="space-y-3">
                    <input type="hidden" name="trade" value={key} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Licence number" name={`licenceNumber-${key}`} required maxLength={40} defaultValue={licence?.licenceNumber ?? ""} />
                      <Field label="Runs out on" name={`expiresOn-${key}`} type="date" required defaultValue={licence?.expiresOn ?? ""} />
                    </div>
                    <SubmitButton variant="secondary" pendingLabel="Saving...">
                      Save licence
                    </SubmitButton>
                  </ActionForm>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(tradie.status === "approved" || tradie.status === "paused") && (
        <Card className="sm:p-6" as="section">
          <SectionTitle>{tradie.status === "paused" ? "You are paused" : "Taking a break?"}</SectionTitle>
          <p className="text-muted">
            {tradie.status === "paused"
              ? "No jobs are being offered to you. Jobs you have already accepted are still yours."
              : "Pause when you are away or flat out, so offers do not run out on you and pull your numbers down. Jobs you have already accepted are still yours."}
          </p>
          <ActionForm action={setPaused} className="mt-4">
            <input type="hidden" name="pause" value={tradie.status === "paused" ? "no" : "yes"} />
            <SubmitButton variant={tradie.status === "paused" ? "primary" : "secondary"} pendingLabel="Saving...">
              {tradie.status === "paused" ? "Start getting offers again" : "Pause my offers"}
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      {/* Own clients at 5% (DECISIONS.md, 2026-11-23). */}
      {query.own === "1" && <Notice tone="good" title="Done">You are now this owner&apos;s first choice there. Their jobs with you are 5%.</Notice>}
      <TradieOwnClients pairs={await pairsForTradie(db, tradie.id)} invites={await invitesFromTradie(db, tradie.id)} timeZone={market.timezone} marketFeePct={`${market.platformFeeBps / 100}%`} />

      <div className="md:hidden">
        <SignOut full />
      </div>
    </div>
  );
}
