import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveMarketSettings, saveMenuItemAction, saveTierAction } from "@/app/actions/staff-admin";
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
import { dateKey } from "@/lib/time";
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

function TierForm({ slug, currency, tier }: { slug: string; currency: string; tier: Tier | null }) {
  const key = tier?.id ?? "new";
  return (
    <ActionForm action={saveTierAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="tierId" value={tier?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name={`name-${key}`} required maxLength={40} defaultValue={tier?.name ?? ""} placeholder="Essential" />
        <Field label="Short code" name={`key-${key}`} required maxLength={30} defaultValue={tier?.key ?? ""} placeholder="essential" hint="Lower-case, no spaces." />
        <Field label={`Price per property each month (${currency})`} name={`price-${key}`} required inputMode="decimal" maxLength={8} defaultValue={tier ? centsToDollars(tier.monthlyPriceCents) : ""} />
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
      <Tick name="urgentIncluded" label="Urgent call-outs cost the owner nothing extra" hint="The tradie still gets the urgent surcharge. We pay it. Watch 'Urgent surcharges we covered' on the Numbers page." defaultChecked={tier?.urgentIncluded ?? false} />
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

export default async function MarketPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  await requireAdminRole();
  const query = await searchParams;
  const db = await getDb();
  const market = await getMarket(db, slug);
  if (!market) notFound();
  const tiers = await listTiers(db, market.slug);
  const menu = await listMenu(db, market.slug, { includeInactive: true });
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
            <Field label="Our share of off-menu work (%)" name="platformFee" required inputMode="decimal" maxLength={5} defaultValue={String(market.platformFeeBps / 100)} hint="Menu jobs use the two prices on each job instead." />
            <Field label="Urgent surcharge" name="urgentSurcharge" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.urgentSurchargeCents)} hint="Paid to the tradie in full." />
            <Field label="After-hours surcharge" name="afterHoursSurcharge" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.afterHoursSurchargeCents)} hint="Paid to the tradie in full." />
            <Field label="Call-out fee for off-menu work" name="diagnosisFee" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.diagnosisFeeCents)} hint="What the owner pays for a tradie to come and look." />
            <Field label="What the tradie gets of that call-out" name="diagnosisPayout" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.diagnosisPayoutCents)} />
            <Field label="Quotes above this need the owner's yes" name="approvalThreshold" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.approvalThresholdCents)} />
            <Field label="Small parts included in a menu price, up to" name="partsIncluded" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.partsIncludedCents)} />
            <Field label="Parts above this need the owner's yes" name="partsApproval" required inputMode="decimal" maxLength={8} defaultValue={centsToDollars(market.partsApprovalCents)} />
          </div>

          <p className="border-t border-line pt-4 text-sm font-bold tracking-wide text-muted uppercase">Offers, hours and paying tradies</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minutes each tradie has to accept" name="offerMinutes" required inputMode="numeric" maxLength={3} defaultValue={String(market.offerMinutes)} />
            <Field label="Hours a tradie's payment is held after a job" name="payoutHoldHours" required inputMode="numeric" maxLength={2} defaultValue={String(market.payoutHoldHours)} hint="The window for the owner to raise a problem. 48 at most." />
            <Field label="Working day starts (hour, 0 to 23)" name="hoursStart" required inputMode="numeric" maxLength={2} defaultValue={String(market.hoursStart)} />
            <Field label="Working day ends (hour, 1 to 24)" name="hoursEnd" required inputMode="numeric" maxLength={2} defaultValue={String(market.hoursEnd)} hint="Urgent jobs outside these hours carry the after-hours surcharge." />
          </div>
          <Checks label="Working days" name="workDays" options={WEEKDAY_OPTIONS} defaultValues={market.workDays} />
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
          </div>
          <Tick name="depositEnabled" label="Offer the founding deposit on the waiting-list page" defaultChecked={market.foundingDeposit.enabled} />

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
                  {tier.name} <span className="font-normal text-muted">· {money(tier.monthlyPriceCents)} a month · {tier.responseHours} h, urgent {tier.urgentResponseHours} h{tier.urgentIncluded ? ", urgent included" : ""}{tier.active ? "" : " · not offered"}</span>
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
          A new price applies to properties that join from now on. Properties that are already members keep paying their old price until it is changed with the payment company too. The runbook explains how.
        </p>
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
