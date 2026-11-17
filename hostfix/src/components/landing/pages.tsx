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
import { publicMarketNow, type PublicMarket } from "@/lib/markets/public";
import { formatMoney } from "@/lib/money";
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
        {["Add your property and a card. Free to join", "Get a link and QR code for your cleaner and guests", "The first time something breaks, it is already sorted"].map((line) => (
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

/**
 * The owner form before a market opens: one button, "Send me the price list".
 * HostFix is free to join (DECISIONS.md, 2026-11-17), so there is no founding
 * deposit, no founding terms and no count of spots left.
 */
function OwnerForm({ market }: { market: Market }) {
  return (
    <>
      <FormHeader title="Get the full price list" note="Every price on the menu, sent to you now. Free to join, and no payment needed." />
      <div className="mt-5">
        <OwnerLeadForm marketName={market.name} brandName={brand.name} />
      </div>
    </>
  );
}

/**
 * The form, worked out on each visit. The page around it is built once and
 * kept, and the build cannot always know whether the market has opened (the
 * demo build pretends it has). So the choice between "send me the price list"
 * and "join now" is made from the market as it is this instant, after the
 * request is touched, inside Suspense. The kept copy is the fallback.
 */
async function OwnerFormSlot({ data }: { data: PublicMarket }) {
  await connection();
  const market = (await publicMarketNow(data.market.slug))?.market ?? data.market;
  if (market.stage !== "live") return <OwnerForm market={market} />;
  const tier = market.tiers[0];
  return (
    <>
      <FormHeader
        title={`Join ${brand.name}`}
        note={tier && tier.monthlyPriceCents > 0 ? `${formatMoney(tier.monthlyPriceCents, market.currency)} a month per property. Cancel any time.` : "Free to join. You pay the fixed price when a job is done."}
      />
      <div className="mt-5">
        <JoinPanel marketSlug={market.slug} marketName={market.name} />
      </div>
    </>
  );
}

export function OwnerLanding({ data }: { data: PublicMarket }) {
  const { market } = data;
  const live = market.stage === "live";
  const content = live ? forOpenMarket(loadLanding("owner", market)) : loadLanding("owner", market);
  const tier = market.tiers[0];
  const items = featured(data, 12);
  const money = (cents: number) => formatMoney(cents, market.currency);
  const menu: MenuPreview | null =
    items.length > 0
      ? {
          title: "Fixed prices for the common jobs",
          note: `What your card is charged when the job is done, ${market.taxName} included. No call-out fee on top. ${data.menu.length > items.length ? `These are ${items.length} of the ${data.menu.length} jobs on the menu: the full list comes as soon as you ask for it.` : ""}`.trim(),
          currency: market.currency,
          showPrices: true,
          priceLabel: `Prices include ${market.taxName}`,
          items: items.map((item) => ({ name: item.name, cents: item.ownerPriceCents })),
        }
      : null;
  const cta = live ? "Join now" : "Get the price list";
  const form = (
    <Suspense fallback={<OwnerForm market={market} />}>
      <OwnerFormSlot data={data} />
    </Suspense>
  );
  return (
    <LandingPage
      content={content}
      eyebrow={`${market.name}, ${market.countryName}`}
      form={form}
      ctaLabel={cta}
      closingTitle={live ? `Sort it once in ${market.name}` : `Be one of the first in ${market.name}`}
      closingNote={
        live
          ? "Add your property today. The next time something breaks, you will not need to make a single call."
          : "Free to join. Take the price list now, and we will let you know the day we open."
      }
      proof={[
        { value: `${tier?.responseHours ?? 24}h`, label: "A tradie on site, or the call-out is on us" },
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
