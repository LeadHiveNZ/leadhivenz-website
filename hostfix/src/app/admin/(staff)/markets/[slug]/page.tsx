import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveMarketSettings, saveMenuItemAction, savePriceListAction, saveTierAction } from "@/app/actions/staff-admin";
import { listPriceList, type PriceListItem } from "@/lib/jobs/parts";
import { LIST_PART_FEE_BPS, listPartLine } from "@/lib/jobs/pricing";
import { ActionForm, Area, Checks, Field, Select, Tick } from "@/components/forms/ActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, Chip, Notice, PageTitle, SectionTitle } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { trades } from "@config/trades";
import { requireAdminRole } from "@/lib/auth/current";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { centsToDollars } from "@/lib/forms";
import { getMarket, listMenu, listTiers, type MenuItem, type Tier } from "@/lib/markets/store";
import { formatMoney } from "@/lib/money";
import { smsSettings } from "@/lib/notify/sms";
import { paymentsProblem } from "@/lib/payments";
import { coverage } from "@/lib/tradies/service";
import { HOURLY_LIMIT_CENTS, hourlyRates } from "@/lib/jobs/rates";
import { dateKey, formatDate } from "@/lib/time";
import { WEEKDAY_OPTIONS } from "@/lib/weekdays";

export const metadata: Metadata = { title: "Market" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TRADE_OPTIONS = trades.filter((trade) => trade.key !== "other").map((trade) => ({ key: trade.key, label: trade.label }));
const STAGES = [
  { key: "draft", label: "Draft: hidden from everyone" },
  { key: "waitlist", label: "Waiting list: public pages collect interest, nobody can join yet" },
  { key: "live", label: "Live: owners can join and log jobs" },
  { key: "paused", label: "Paused: no new members or jobs, existing jobs carry on" },
];

/** 16.5 shows as "16:30", 7 as "7". */
function clockText(value: number): string {
  const whole = Math.floor(value);
  return value === whole ? String(whole) : `${whole}:${String(Math.round((value - whole) * 60)).padStart(2, "0")}`;
}

const BASIS_OPTIONS = [
  { key: "per_property", label: "Per property, each month (owners)" },
  { key: "per_account", label: "One retainer for the whole account, banded by number of properties (managers)" },
];
/** The same number of band rows the save action reads. */
const BAND_ROWS = 6;

/** "10-24 NZ$600 · 25-49 NZ$900 · 100+ by arrangement". */
function bandSummary(tier: Tier, money: (cents: number) => string): string {
  return tier.bands.map((band) => `${band.from}${band.to === null ? "+" : `-${band.to}`} ${band.cents === null ? "by arrangement" : money(band.cents)}`).join(" · ");
}

function TierForm({ slug, currency, tier }: { slug: string; currency: string; tier: Tier | null }) {
  const key = tier?.id ?? "new";
  return (
    <ActionForm action={saveTierAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="tierId" value={tier?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name={`name-${key}`} required maxLength={40} defaultValue={tier?.name ?? ""} placeholder="Essential" />
        <Field label="Short code" name={`key-${key}`} required maxLength={30} defaultValue={tier?.key ?? ""} placeholder="essential" hint="Lower-case, no spaces." />
        <Select
          label="How it is charged"
          name={`basis-${key}`}
          placeholder="Choose"
          options={BASIS_OPTIONS}
          defaultValue={tier?.billingBasis ?? "per_property"}
        />
        <Field
          label={`Price per property each month (${currency})`}
          name={`price-${key}`}
          inputMode="decimal"
          maxLength={8}
          defaultValue={tier && tier.billingBasis === "per_property" ? centsToDollars(tier.monthlyPriceCents) : ""}
          hint="Per-property memberships only. 0 means free to join: covered once a card is on file. A retainer's price comes from its bands below."
        />
        <Field label="Promise for a normal job (hours)" name={`responseHours-${key}`} required inputMode="numeric" maxLength={3} defaultValue={String(tier?.responseHours ?? 24)} />
        <Field label="Promise for an urgent job (hours)" name={`urgentHours-${key}`} required inputMode="numeric" maxLength={2} defaultValue={String(tier?.urgentResponseHours ?? 4)} />
        <Field
          label="Included urgent call-outs a month"
          name={`urgentPerMonth-${key}`}
          inputMode="numeric"
          maxLength={2}
          defaultValue={tier?.urgentIncludedPerMonth === null || tier?.urgentIncludedPerMonth === undefined ? "" : String(tier.urgentIncludedPerMonth)}
          hint="Only matters if urgent is included. Empty means no limit."
        />
      </div>
      <Field label="One line under the name" name={`blurb-${key}`} maxLength={140} defaultValue={tier?.blurb ?? ""} />
      <fieldset className="space-y-3 rounded-2xl border border-line p-4">
        <legend className="px-1 font-semibold text-ink">Retainer bands (one retainer for the whole account only)</legend>
        <p className="text-sm text-muted">
          Lowest first, with no gaps: each band starts one above where the last one ended. Leave &ldquo;up to&rdquo; empty on the top band for &ldquo;and up&rdquo;. Leave its retainer empty
          for &ldquo;by arrangement&rdquo;: the app then never charges that many properties by itself, and asks a person instead. Rows left empty are ignored.
        </p>
        {Array.from({ length: BAND_ROWS }, (_, index) => {
          const band = tier?.bands[index];
          return (
            <div key={index} className="grid grid-cols-3 gap-2">
              <Field label={`Band ${index + 1}: from (properties)`} name={`bandFrom-${key}-${index}`} inputMode="numeric" maxLength={4} defaultValue={band ? String(band.from) : ""} />
              <Field label="Up to (empty: and up)" name={`bandTo-${key}-${index}`} inputMode="numeric" maxLength={4} defaultValue={band && band.to !== null ? String(band.to) : ""} />
              <Field
                label={`Retainer a month (${currency}, empty: by arrangement)`}
                name={`bandPrice-${key}-${index}`}
                inputMode="decimal"
                maxLength={9}
                defaultValue={band && band.cents !== null ? centsToDollars(band.cents) : ""}
              />
            </div>
          );
        })}
      </fieldset>
      <Tick name="urgentIncluded" label="Urgent call-outs cost the owner nothing extra" hint="The tradie still gets their share of the urgent surcharge. We pay it. Watch 'Urgent surcharges we covered' on the Numbers page." defaultChecked={tier?.urgentIncluded ?? false} />
      <Tick name="quarterlyCheck" label="Includes a property check every three months" hint="This is a promise on the page. The check itself is booked by a person: it is not automatic yet." defaultChecked={tier?.quarterlyCheck ?? false} />
      <Tick name="active" label="Offered to new members" defaultChecked={tier?.active ?? true} />
      <SubmitButton variant="secondary" pendingLabel="Saving...">
        {tier ? "Save tier" : "Add tier"}
      </SubmitButton>
    </ActionForm>
  );
}

function MenuForm({ slug, currency, item }: { slug: string; currency: string; item: MenuItem | null }) {
  const key = item?.id ?? "new";
  return (
    <ActionForm action={saveMenuItemAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="itemId" value={item?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name the owner sees" name={`name-${key}`} required maxLength={80} defaultValue={item?.name ?? ""} placeholder="Unblock a toilet" />
        <Field label="Code" name={`code-${key}`} required maxLength={8} defaultValue={item?.code ?? ""} placeholder="PL-01" hint="Two to four letters, a dash, a number." />
        <Select label="Trade" name={`trade-${key}`} required placeholder="Choose" options={TRADE_OPTIONS} defaultValue={item?.trade} />
        <div />
        <Field label={`Owner pays (${currency})`} name={`ownerPrice-${key}`} required inputMode="decimal" maxLength={8} defaultValue={item ? centsToDollars(item.ownerPriceCents) : ""} />
        <Field label={`Tradie gets (${currency})`} name={`payout-${key}`} required inputMode="decimal" maxLength={8} defaultValue={item ? centsToDollars(item.tradiePayoutCents) : ""} hint="The difference is what we keep." />
      </div>
      <Area label="What is included (the tradie sees this)" name={`description-${key}`} rows={2} maxLength={400} defaultValue={item?.description ?? ""} />
      <Area label="Worth trying first (shown to whoever is reporting it)" name={`tryFirst-${key}`} rows={2} maxLength={300} defaultValue={item?.tryFirst ?? ""} hint="A quick fix that saves a call-out, for example: check the switch on the wall is on. Leave empty for none." />
      <Tick name="licenceRequired" label="Only for tradies with a current licence" hint="Always on for plumbing, gas and electrical work, whatever is ticked here." defaultChecked={item?.licenceRequired ?? false} />
      <Tick name="guestVisible" label="Guests can report this from the QR code" defaultChecked={item?.guestVisible ?? true} />
      <Tick name="active" label="On the menu" defaultChecked={item?.active ?? true} />
      <SubmitButton variant="secondary" pendingLabel="Saving...">
        {item ? "Save job" : "Add job"}
      </SubmitButton>
    </ActionForm>
  );
}

function PartForm({ slug, currency, item }: { slug: string; currency: string; item: PriceListItem | null }) {
  const key = item?.id ?? "new";
  return (
    <ActionForm action={savePriceListAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="partItemId" value={item?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name the owner sees" name={`partName-${key}`} required maxLength={80} defaultValue={item?.name ?? ""} placeholder="Mixer tap cartridge (40 mm)" />
        <Field label="Code" name={`partCode-${key}`} required maxLength={8} defaultValue={item?.code ?? ""} placeholder="PTP-02" hint="Two to four letters, a dash, a number." />
        <Field label={`Owner pays for one, including GST (${currency})`} name={`partPrice-${key}`} required inputMode="decimal" maxLength={8} defaultValue={item ? centsToDollars(item.priceCents) : ""} hint={`The tradie gets it less ${LIST_PART_FEE_BPS / 100}%, which covers the card fee.`} />
      </div>
      <Area label="Where the price came from" name={`partSource-${key}`} rows={2} maxLength={400} defaultValue={item?.source ?? ""} hint="The shop, the product, the web address and the date, for whoever checks it next." />
      <Tick name="partActive" label="On the price list" defaultChecked={item?.active ?? true} />
      <SubmitButton variant="secondary" pendingLabel="Saving...">
        {item ? "Save part" : "Add part"}
      </SubmitButton>
    </ActionForm>
  );
}

export default async function MarketPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  await requireAdminRole();
  const query = await searchParams;
  const db = await getDb();
  const market = await getMarket(db, slug);
  const rates = await hourlyRates(db, slug);
  if (!market) notFound();
  const tiers = await listTiers(db, market.slug);
  const menu = await listMenu(db, market.slug, { includeInactive: true });
  const priceList = await listPriceList(db, market.slug, { includeInactive: true });
  const cover = await coverage(db, market.slug, dateKey(now(), market.timezone));
  const money = (cents: number) => formatMoney(cents, market.currency);
  const usedTrades = new Set(menu.filter((item) => item.active).map((item) => item.trade));
  const thin = cover.filter((row) => usedTrades.has(row.trade) && row.ready === 0);
  const noPayments = paymentsProblem(market.country);
  const sms = smsSettings();

  const checks = [
    { ok: tiers.some((tier) => tier.active), label: "At least one membership is on offer" },
    { ok: menu.some((item) => item.active), label: "The menu has jobs on it" },
    { ok: thin.length === 0, label: thin.length === 0 ? "Every trade on the menu has a tradie ready" : `No tradie is ready for: ${thin.map((row) => row.label.toLowerCase()).join(", ")}` },
    { ok: !noPayments, label: noPayments ? `Card payments are not set up for ${market.countryName}` : `Card payments are set up for ${market.countryName}` },
    { ok: "settings" in sms, label: "settings" in sms ? "Texts are set up" : "Texts are not set up, so tradies cannot be sent offers" },
    { ok: true, label: market.taxRegistered ? `Registered for ${market.taxName}: statements show it` : `Not registered for ${market.taxName} yet: statements show no tax. Change this the day you register.` },
  ];

  const byTrade = new Map<string, MenuItem[]>();
  for (const item of menu) byTrade.set(item.trade, [...(byTrade.get(item.trade) ?? []), item]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        title={market.name}
        back={{ href: "/admin/markets", label: "Markets" }}
        intro={`${market.countryName} · ${market.currency} · short code ${market.slug}`}
        action={<Chip tone={market.stage === "live" ? "done" : market.stage === "waitlist" ? "waiting" : market.stage === "paused" ? "alert" : "quiet"}>{market.stage}</Chip>}
      />

      {query.created && (
        <Notice tone="good" title="Market added as a draft">
          Nothing is visible to the public yet. Check the prices below, add tradies, then change the stage.
        </Notice>
      )}

      <Card className="sm:p-6">
        <SectionTitle>Ready to go live?</SectionTitle>
        <ul className="space-y-2">
          {checks.map((check) => (
            <li key={check.label} className="flex gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${check.ok ? "bg-done-soft text-done" : "bg-alert-soft text-alert"}`}>
                <Icon name={check.ok ? "check" : "queue"} size={14} />
              </span>
              <span className="text-ink">{check.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href={`/admin/tradies?market=${market.slug}`} className="font-semibold text-brand underline underline-offset-2">
            Tradies and first picks
          </Link>
          <Link href={`/in/${market.slug}`} className="font-semibold text-brand underline underline-offset-2">
            Owner page
          </Link>
          <Link href={`/in/${market.slug}/tradies`} className="font-semibold text-brand underline underline-offset-2">
            Tradie page
          </Link>
          <Link href={`/admin/dashboard?market=${market.slug}`} className="font-semibold text-brand underline underline-offset-2">
            Numbers
          </Link>
        </div>
      </Card>

      <Card className="sm:p-6">
        <SectionTitle>Settings</SectionTitle>
        <ActionForm action={saveMarketSettings} className="space-y-5">
          <input type="hidden" name="slug" value={market.slug} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" required maxLength={60} defaultValue={market.name} />
            <Field label="Timezone" name="timezone" required maxLength={40} defaultValue={market.timezone} hint="For example Pacific/Auckland." />
          </div>
          <Select label="Stage" name="stage" required placeholder="Choose" options={STAGES} defaultValue={market.stage} />

          <p className="border-t border-line pt-4 text-sm font-bold tracking-wide text-muted uppercase">Fees and surcharges ({market.currency})</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Our share of off-menu work (%)" name="platformFee" required inputMode="decimal" maxLength={5} defaultValue={String((market.platformFeeNext?.bps ?? market.platformFeeBps) / 100)} hint={`Also taken from the urgent and after-hours surcharges. Menu jobs use the two prices on each job instead. Once the market has tradies, a change starts 30 days after you save it, and every tradie here is texted.${market.platformFeeNext ? ` Now ${market.platformFeeBps / 100}%; ${market.platformFeeNext.bps / 100}% from ${formatDate(market.platformFeeNext.from, market.timezone)}. Put ${market.platformFeeBps / 100} back to call it off.` : ""}`} />
            <Field label="Urgent surcharge" name="urgentSurcharge" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.urgentSurchargeCents)} hint="The tradie drops what they are doing. They get it less our share, like the rest of the price." />
            <Field label="After-hours surcharge" name="afterHoursSurcharge" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.afterHoursSurchargeCents)} hint="The tradie gets it less our share, like the rest of the price." />
            <Field label="Call-out fee for off-menu work" name="diagnosisFee" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.diagnosisFeeCents)} hint="What the owner pays for a tradie to come and look." />
            <Field label="What the tradie gets of that call-out" name="diagnosisPayout" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.diagnosisPayoutCents)} />
            <Field label="Quotes above this need the owner's yes" name="approvalThreshold" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.approvalThresholdCents)} />
            <Field label="Small parts included in every job's price, up to" hint="Shown to owners. A part off the price list costing this or less is never added to a job." name="partsIncluded" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.partsIncludedCents)} />
            <Field label="Parts on one job above this need the owner's yes" hint="Below it, parts are added and the owner is texted at once. The property's overall limit applies too." name="partsApproval" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.partsApprovalCents)} />
          </div>

          <p className="border-t border-line pt-4 text-sm font-bold tracking-wide text-muted uppercase">Offers, hours and paying tradies</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minutes each tradie has to accept" name="offerMinutes" required inputMode="numeric" maxLength={3} defaultValue={String(market.offerMinutes)} />
            <Field label="Hours a tradie's payment is held after a job" name="payoutHoldHours" required inputMode="numeric" maxLength={2} defaultValue={String(market.payoutHoldHours)} hint="The window for the owner to raise a problem. 48 at most." />
            <Field label="Hours before we ring round for a normal job nobody has taken" name="unacceptedAlertHours" required inputMode="numeric" maxLength={2} defaultValue={String(market.unacceptedAlertHours)} hint="The owner is texted that we are ringing round, and you are alerted. 1 to 23." />
            <Field label="Hours an owner has to answer their tradie's later time" name="counterOfferHours" required inputMode="numeric" maxLength={2} defaultValue={String(market.counterOfferHours)} hint="When the first choice or backup can't make it in time and suggests a later one. No answer and it goes to the next tradies. 1 to 12." />
            <Field label="Shortest time on site before a job is flagged (minutes)" name="minMinutesOnSite" required inputMode="numeric" maxLength={3} defaultValue={String(market.minMinutesOnSite)} hint="Job done sooner than this after Arrived and the tradie's payment waits for the owner to check the photos. Diagnosis and look-and-price jobs, and could-not-get-in, are never flagged for this. 0 switches it off." />
            <Field label="Hours an owner has to confirm a flagged job" name="ownerConfirmHours" required inputMode="numeric" maxLength={3} defaultValue={String(market.ownerConfirmHours)} hint="No answer by then: a trusted tradie is paid, anyone else comes to your queue to approve or hold. 1 to 168." />
            <Field label="Hours an owner has to say &quot;This was the job I described&quot;" name="notDescribedHours" required inputMode="numeric" maxLength={3} defaultValue={String(market.notDescribedHours)} hint="After a tradie says a menu job is not the job described. No objection by then and the call-out is paid. 1 to 168." />
            <Field label="Minutes before an unopened offer is also texted" name="offerPushSmsMinutes" required inputMode="numeric" maxLength={2} defaultValue={String(market.offerPushSmsMinutes)} hint="For tradies with app notifications on: the offer goes by notification first, and by text after this long if they have not opened it. 0 to 15." />
            <Field label="Working day starts (for example 7 or 7:30)" name="hoursStart" required maxLength={7} defaultValue={clockText(market.hoursStart)} />
            <Field label="Working day ends (for example 17 or 16:30)" name="hoursEnd" required maxLength={7} defaultValue={clockText(market.hoursEnd)} hint="24-hour clock. An urgent job logged outside these hours, or on a day that is not ticked, carries the after-hours surcharge, charged only if the tradie also arrives outside them." />
          </div>
          <Checks label="Working days" name="workDays" options={WEEKDAY_OPTIONS} defaultValues={market.workDays} />

          <p className="border-t border-line pt-4 text-sm font-bold tracking-wide text-muted uppercase">Hourly rates for extra work (to confirm before launch)</p>
          <p className="text-sm text-muted">
            What the owner pays an hour, GST included. Extra work up to {formatMoney(HOURLY_LIMIT_CENTS, market.currency)} is quoted in quarter hours at this rate, and the tradie cannot type another. Above that, and for a trade with no rate, the tradie prices it their own way. The 15% fee comes off the labour, as on every quote.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {trades.filter((trade) => trade.key !== "other").map((trade) => (
              <Field key={trade.key} label={`${trade.label} (${market.currency} an hour)`} name={`rate-${trade.key}`} inputMode="decimal" maxLength={8} defaultValue={rates[trade.key] ? centsToDollars(rates[trade.key]!) : ""} />
            ))}
          </div>
          <Tick name="replyByText" label="Tradies can accept by replying YES to the text" hint="Only switch this on once this market's text number can receive replies and you have tested it. The link in the text always works." defaultChecked={market.replyByText} />

          <p className="border-t border-line pt-4 text-sm font-bold tracking-wide text-muted uppercase">Tax</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax name" name="taxName" required maxLength={10} defaultValue={market.taxName} />
            <Field label="Tax rate (%)" name="taxRate" required inputMode="decimal" maxLength={5} defaultValue={String(Math.round(market.taxRate * 10000) / 100)} />
          </div>
          <Tick name="taxRegistered" label={`The business is registered for ${market.taxName}`} hint="When off, statements show no tax. Prices do not change either way: they are what the customer pays." defaultChecked={market.taxRegistered} />
          <Field label={`${market.taxName} number`} name="taxNumber" maxLength={20} defaultValue={market.taxNumber ?? ""} hint="Shown on statements once registered." />

          <p className="border-t border-line pt-4 text-sm font-bold tracking-wide text-muted uppercase">Referrals and the founding deposit</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reward for a cleaner or co-host" name="referralReward" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.referralRewardCents)} />
            <Field label="Paid after this many paid months" name="referralPaidMonths" required inputMode="numeric" maxLength={2} defaultValue={String(market.referralPaidMonths)} />
            <Field label="Founding deposit amount" name="deposit" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.foundingDeposit.amountCents)} />
            <Field
              label="Founding spots"
              name="depositSpots"
              inputMode="numeric"
              maxLength={4}
              defaultValue={market.foundingDeposit.spots === null ? "" : String(market.foundingDeposit.spots)}
              hint="How many owners can put a deposit down. Leave empty for no limit. When they are gone, the page stops taking cards."
            />
          </div>
          <Tick name="depositEnabled" label="Offer the founding deposit on the waiting-list page" defaultChecked={market.foundingDeposit.enabled} />
          <Area
            label="What the deposit gets them (one promise per line)"
            name="depositTerms"
            rows={4}
            maxLength={900}
            defaultValue={market.foundingDeposit.terms.join("\n")}
            hint="Shown next to the deposit button and on the card page. Up to six lines. Only promise what billing actually does: see the go-live checklist."
          />

          <SubmitButton pendingLabel="Saving...">Save settings</SubmitButton>
        </ActionForm>
      </Card>

      <section>
        <SectionTitle>Memberships</SectionTitle>
        <div className="space-y-2.5">
          {tiers.map((tier) => (
            <Reveal
              key={tier.id}
              label={
                <span>
                  {tier.name} <span className="font-normal text-muted">· {tier.billingBasis === "per_account" ? `one retainer: ${bandSummary(tier, money)}` : tier.monthlyPriceCents === 0 ? "free to join (card on file)" : `${money(tier.monthlyPriceCents)} a month per property`} · {tier.responseHours} h, urgent {tier.urgentResponseHours} h{tier.urgentIncluded ? ", urgent included" : ""}{tier.active ? "" : " · not offered"}</span>
                </span>
              }
            >
              <TierForm slug={market.slug} currency={market.currency} tier={tier} />
            </Reveal>
          ))}
          <Reveal label="Add a membership">
            <TierForm slug={market.slug} currency={market.currency} tier={null} />
          </Reveal>
        </div>
        <p className="mt-2 text-sm text-muted">
          Once properties have joined a membership, its price is fixed. To change a price, add a new membership at the new price and untick &ldquo;Offered to new members&rdquo; on the old one. Members on the old one keep it, at
          the old price, until they switch. The promise hours and what is included can be changed at any time, and apply to members straight away.
        </p>
      </section>

      <section>
        <SectionTitle>Parts price list ({priceList.filter((item) => item.active).length} parts)</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          A part on this list is charged at its fixed price, as many as are fitted, with no receipt. Anything else is the receipt plus 20%. Small parts up to {money(market.partsIncludedCents)} are in the job&apos;s price.
          Check new prices with the first tradies.
        </p>
        <div className="space-y-2">
          {priceList.map((item) => (
            <Reveal
              key={item.id}
              label={
                <span className={item.active ? "" : "text-muted line-through"}>
                  {item.name} <span className="font-normal text-muted">· owner {money(item.priceCents)} · tradie {money(listPartLine(item.name, item.priceCents, 1).tradieCents)}</span>
                </span>
              }
            >
              <PartForm slug={market.slug} currency={market.currency} item={item} />
            </Reveal>
          ))}
          <Reveal label="Add a part to the price list">
            <PartForm slug={market.slug} currency={market.currency} item={null} />
          </Reveal>
        </div>
      </section>

      <section>
        <SectionTitle>The menu ({menu.filter((item) => item.active).length} jobs)</SectionTitle>
        <div className="space-y-5">
          {[...byTrade.entries()].map(([trade, items]) => (
            <div key={trade}>
              <p className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{trades.find((candidate) => candidate.key === trade)?.label ?? trade}</p>
              <div className="space-y-2">
                {items.map((item) => {
                  const kept = item.ownerPriceCents - item.tradiePayoutCents;
                  const share = item.ownerPriceCents > 0 ? Math.round((kept / item.ownerPriceCents) * 100) : 0;
                  return (
                    <Reveal
                      key={item.id}
                      label={
                        <span className={item.active ? "" : "text-muted line-through"}>
                          {item.name}{" "}
                          <span className="font-normal text-muted">
                            · owner {money(item.ownerPriceCents)} · tradie {money(item.tradiePayoutCents)} · we keep {money(kept)} ({share}%)
                          </span>
                        </span>
                      }
                    >
                      <MenuForm slug={market.slug} currency={market.currency} item={item} />
                    </Reveal>
                  );
                })}
              </div>
            </div>
          ))}
          <Reveal label="Add a job to the menu">
            <MenuForm slug={market.slug} currency={market.currency} item={null} />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
