import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { brand } from "@config/brand";
import type { Market } from "@config/markets";
import { trades } from "@config/trades";
import { OwnerLeadForm } from "@/components/forms/OwnerLeadForm";
import { TradieLeadForm } from "@/components/forms/TradieLeadForm";
import { buttonClass } from "@/components/forms/styles";
import { FormHeader, LandingPage, type MenuPreview } from "@/components/LandingPage";
import { Icon } from "@/components/ui/Icon";
import { loadLanding, plainText, type LandingContent } from "@/lib/content";
import { getDb } from "@/lib/db";
import { foundingSpotsTaken, SHOW_SPOTS_LEFT_AT, spotsLeft } from "@/lib/leads/founding";
import type { PublicMarket } from "@/lib/markets/public";
import { formatMoney } from "@/lib/money";
import { depositAvailability } from "@/lib/payments/deposit";
import { OwnerPhone, TradiePhone } from "./PhoneMock";

/** The owner and tradie landing pages for one market. The words live in /content. */

function example(data: PublicMarket) {
  const item = data.menu.find((entry) => entry.code === "PL-08") ?? data.menu.find((entry) => entry.code === "PL-01") ?? data.menu[0];
  return {
    jobName: item?.name ?? "Unblock a toilet",
    ownerCents: item?.ownerPriceCents ?? 22000,
    payoutCents: item?.tradiePayoutCents ?? 18700,
    currency: data.market.currency,
    suburb: data.market.name,
  };
}

/**
 * The jobs owners most often need, shown first in the price preview when they
 * are on the menu: blocked drains, hot water, power, heat pumps, Wi-Fi and
 * lockouts are what guests complain about most. Any gaps are filled with a
 * spread across the trades, so a market with a different menu still works.
 */
const FEATURED = ["PL-08", "PL-03", "PL-04", "PL-06", "EL-01", "EL-02", "HP-03", "HM-02", "HM-05", "LS-01", "HM-14", "HM-15"];

function featured(data: PublicMarket, count: number): PublicMarket["menu"] {
  const byCode = new Map(data.menu.map((item) => [item.code, item]));
  const picked = FEATURED.map((code) => byCode.get(code)).filter((item): item is PublicMarket["menu"][number] => item !== undefined);
  for (const item of spread(data, count)) if (picked.length < count && !picked.includes(item)) picked.push(item);
  return picked.slice(0, count);
}

/** A spread of jobs across the trades, so the menu preview is not all plumbing. */
function spread(data: PublicMarket, count: number): PublicMarket["menu"] {
  const byTrade = new Map<string, PublicMarket["menu"]>();
  for (const item of data.menu) byTrade.set(item.trade, [...(byTrade.get(item.trade) ?? []), item]);
  const picked: PublicMarket["menu"] = [];
  for (let round = 0; picked.length < count && round < 6; round += 1) {
    for (const items of byTrade.values()) {
      if (items[round] && picked.length < count) picked.push(items[round]!);
    }
  }
  return picked;
}

function JoinPanel({ marketSlug, marketName }: { marketSlug: string; marketName: string }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2.5 text-[0.98rem] text-muted">
        {["Add your property and choose a membership", "Get a link and QR code for your cleaner and guests", "The first time something breaks, it is already sorted"].map((line) => (
          <li key={line} className="flex gap-2.5">
            <Icon name="check" size={18} className="mt-1 text-done" />
            {line}
          </li>
        ))}
      </ul>
      <Link href={`/sign-up?market=${marketSlug}`} className={`${buttonClass} w-full`}>
        Join in {marketName} <Icon name="arrow" size={18} />
      </Link>
      <p className="text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/sign-in" className="font-semibold text-brand underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}

/**
 * Once a market is open, the parts of the copy that only make sense before
 * launch are left out: the founding member offer, and the questions about
 * the launch date and the deposit. The copy file itself is not changed.
 */
const BEFORE_LAUNCH_ONLY = /founding member|when do (you|jobs) (launch|start)|deposit/i;

function forOpenMarket(content: LandingContent): LandingContent {
  return {
    ...content,
    sections: content.sections
      .filter((section) => !BEFORE_LAUNCH_ONLY.test(plainText(section.title)))
      .map((section) => ({ ...section, blocks: section.blocks.filter((block) => block.type !== "card" || !BEFORE_LAUNCH_ONLY.test(plainText(block.title))) })),
  };
}

/** The deposit as shown, or null when the founding offer is switched off. */
function depositLabel(market: Market): string | null {
  return market.stage === "waitlist" && market.foundingDeposit.enabled ? formatMoney(market.foundingDeposit.amountCents, market.currency) : null;
}

/** The founding offer's promises, as set on the admin screen, above the form. */
function FoundingTerms({ market, note }: { market: Market; note?: React.ReactNode }) {
  if (market.foundingDeposit.terms.length === 0 && !note) return null;
  return (
    <div className="mb-5 rounded-2xl bg-tint px-4 py-3.5">
      {note}
      {market.foundingDeposit.terms.length > 0 && (
        <ul className="space-y-1.5 text-[0.95rem] text-ink">
          {market.foundingDeposit.terms.map((term) => (
            <li key={term} className="flex gap-2">
              <Icon name="check" size={18} className="mt-0.5 shrink-0 text-done" />
              {term}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The form, worked out on each visit: whether the card page can be opened
 * (payments switched on) and how many founding spots are left. The page
 * around it is built once and kept.
 */
async function LiveOwnerForm({ market }: { market: Market }) {
  await connection();
  const label = depositLabel(market);
  let left: number | null = null;
  if (label) {
    try {
      left = spotsLeft(market, await foundingSpotsTaken(await getDb(), market.slug));
    } catch {
      left = null;
    }
  }
  const canTake = label !== null && depositAvailability(market).available && left !== 0;
  const note =
    label && left === 0 ? (
      <p className="mb-2 font-bold text-ink">All the founding spots have been taken. Leave your details for the price list and we will let you know when we open.</p>
    ) : canTake && left !== null && left <= SHOW_SPOTS_LEFT_AT ? (
      <p className="mb-2 font-bold text-ink">
        Only {left} founding {left === 1 ? "spot" : "spots"} left in {market.name}.
      </p>
    ) : null;
  return (
    <>
      <OwnerFormHeader market={market} deposit={canTake ? label : null} />
      <div className="mt-5">
        {canTake || note ? <FoundingTerms market={market} note={note} /> : null}
        <OwnerLeadForm marketName={market.name} brandName={brand.name} deposit={canTake ? label : null} />
      </div>
    </>
  );
}

/** "Take a founding spot" only when the form below has that button. */
function OwnerFormHeader({ market, deposit }: { market: Market; deposit: string | null }) {
  const spots = market.foundingDeposit.spots;
  return deposit ? (
    <FormHeader
      title="Take a founding spot"
      note={`${spots ? `${spots} founding properties in ${market.name}.` : `Founding properties in ${market.name}.`} ${deposit} deposit, refundable.`}
    />
  ) : (
    <FormHeader title="Get the full price list" note="Every price on the menu, sent to you now. No payment needed." />
  );
}

export function OwnerLanding({ data }: { data: PublicMarket }) {
  const { market } = data;
  const live = market.stage === "live";
  const content = live ? forOpenMarket(loadLanding("owner", market)) : loadLanding("owner", market);
  const tier = market.tiers[0];
  const items = featured(data, 12);
  const money = (cents: number) => formatMoney(cents, market.currency);
  const deposit = depositLabel(market);
  const spots = market.foundingDeposit.spots;
  const menu: MenuPreview | null =
    items.length > 0
      ? {
          title: "Fixed prices for the common jobs",
          note: `What your card is charged when the job is done, ${market.taxName} included. No call-out fee on top. ${data.menu.length > items.length ? `These are ${items.length} of the ${data.menu.length} jobs on the menu: the full list comes with your founding spot, or as soon as you ask for it.` : ""}`.trim(),
          currency: market.currency,
          showPrices: true,
          priceLabel: `Prices include ${market.taxName}`,
          items: items.map((item) => ({ name: item.name, cents: item.ownerPriceCents })),
        }
      : null;
  const cta = live ? "Join now" : deposit ? "Take a founding spot" : "Get the price list";
  const form = live ? (
    <JoinPanel marketSlug={market.slug} marketName={market.name} />
  ) : (
    <Suspense
      fallback={
        <>
          <OwnerFormHeader market={market} deposit={deposit} />
          <div className="mt-5">
            {deposit && <FoundingTerms market={market} />}
            <OwnerLeadForm marketName={market.name} brandName={brand.name} deposit={deposit} />
          </div>
        </>
      }
    >
      <LiveOwnerForm market={market} />
    </Suspense>
  );
  return (
    <LandingPage
      content={content}
      eyebrow={`${market.name}, ${market.countryName}`}
      formTitle={live ? `Join ${brand.name}` : undefined}
      formNote={live ? `${tier ? money(tier.monthlyPriceCents) : ""} a month per property. Cancel any time.` : undefined}
      form={form}
      ctaLabel={cta}
      closingTitle={live ? `Sort it once in ${market.name}` : `Be one of the first in ${market.name}`}
      closingNote={
        live
          ? "Add your property today. The next time something breaks, you will not need to make a single call."
          : `${spots ? `${spots} founding properties` : "Founding properties"}, set up first when we open. Or just take the price list and decide later.`
      }
      proof={[
        { value: `${tier?.responseHours ?? 24}h`, label: "A tradie on site, or that month's membership is credited" },
        { value: String(data.menu.length || 25), label: "Common jobs at a fixed price, shown before you book" },
        { value: `${tier?.urgentResponseHours ?? 4}h`, label: `When it is urgent, for ${money(market.urgentSurchargeCents)} more` },
      ]}
      phone={<OwnerPhone example={example(data)} />}
      menu={menu}
    />
  );
}

export function TradieLanding({ data }: { data: PublicMarket }) {
  const { market } = data;
  const live = market.stage === "live";
  const content = live ? forOpenMarket(loadLanding("tradie", market)) : loadLanding("tradie", market);
  const items = spread(data, 10);
  const cta = "Put my name down";
  return (
    <LandingPage
      content={content}
      eyebrow={`Tradies in ${market.name}`}
      formTitle="Get jobs by text"
      formNote="Takes about a minute. We'll be in touch to check your details."
      form={<TradieLeadForm brandName={brand.name} buttonLabel={cta} trades={trades.map((trade) => ({ key: trade.key, label: trade.label }))} />}
      ctaLabel={cta}
      closingTitle="Fixed-price jobs, straight to your phone"
      closingNote="No quoting, no invoicing, no chasing. Leave your details and we'll be in touch."
      proof={[
        { value: `${Math.max(24, market.payoutHoldHours)}h`, label: "From your photo to your payment being sent. No invoice to write" },
        { value: `${market.offerMinutes}min`, label: "To take a job. One tap from the text, no login" },
        { value: formatMoney(0, market.currency), label: "To join. No lead fees, no bidding, no subscription" },
      ]}
      phone={<TradiePhone example={example(data)} />}
      menu={
        items.length > 0
          ? {
              title: "What the jobs pay",
              note: `What you are paid for each job, shown in the text before you accept. Urgent adds ${formatMoney(market.urgentSurchargeCents, market.currency)} and after hours adds ${formatMoney(market.afterHoursSurchargeCents, market.currency)}, and both go to you in full.`,
              currency: market.currency,
              showPrices: true,
              priceLabel: "What you are paid",
              items: items.map((item) => ({ name: item.name, cents: item.tradiePayoutCents })),
            }
          : null
      }
    />
  );
}
