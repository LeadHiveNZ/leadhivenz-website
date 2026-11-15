import Link from "next/link";
import { brand } from "@config/brand";
import { trades } from "@config/trades";
import { OwnerLeadForm } from "@/components/forms/OwnerLeadForm";
import { TradieLeadForm } from "@/components/forms/TradieLeadForm";
import { buttonClass } from "@/components/forms/styles";
import { LandingPage, type MenuPreview } from "@/components/LandingPage";
import { Icon } from "@/components/ui/Icon";
import { loadLanding, plainText, type LandingContent } from "@/lib/content";
import type { PublicMarket } from "@/lib/markets/public";
import { formatMoney } from "@/lib/money";
import { OwnerPhone, TradiePhone } from "./PhoneMock";

/** The owner and tradie landing pages for one market. The words live in /content. */

function example(data: PublicMarket) {
  const item = data.menu.find((entry) => entry.code === "PL-01") ?? data.menu[0];
  return {
    jobName: item?.name ?? "Unblock a toilet",
    ownerCents: item?.ownerPriceCents ?? 22000,
    payoutCents: item?.tradiePayoutCents ?? 18700,
    currency: data.market.currency,
    suburb: data.market.name,
  };
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

export function OwnerLanding({ data }: { data: PublicMarket }) {
  const { market } = data;
  const live = market.stage === "live";
  const content = live ? forOpenMarket(loadLanding("owner", market)) : loadLanding("owner", market);
  const tier = market.tiers[0];
  const items = spread(data, 10);
  const menu: MenuPreview | null =
    items.length > 0
      ? {
          title: live ? "Fixed prices for the common jobs" : "The jobs on the fixed-price menu",
          note: live
            ? "This is what your card is charged when the job is done. No call-out fee on top, no quote to wait for. Anything not on the menu starts with a fixed diagnosis fee."
            : "Every one of these has a fixed price, shown before the job is booked. Prices are published when we open.",
          currency: market.currency,
          showPrices: live,
          priceLabel: `Prices include ${market.taxName}`,
          items: items.map((item) => ({ name: item.name, cents: item.ownerPriceCents })),
        }
      : null;
  const cta = live ? "Join now" : "Get early access";
  return (
    <LandingPage
      content={content}
      eyebrow={`${market.name}, ${market.countryName}`}
      formTitle={live ? `Join ${brand.name}` : "Get early access"}
      formNote={live ? `From ${tier ? formatMoney(tier.monthlyPriceCents, market.currency) : ""} a month per property. Cancel any time.` : "Takes about a minute. No payment needed to join the list."}
      form={live ? <JoinPanel marketSlug={market.slug} marketName={market.name} /> : <OwnerLeadForm marketName={market.name} brandName={brand.name} buttonLabel={cta} />}
      ctaLabel={cta}
      closingTitle={live ? `Sort it once in ${market.name}` : `Be first in line in ${market.name}`}
      closingNote={live ? "Add your property today. The next time something breaks, you will not need to make a single call." : "Leave your details and we'll be in touch before we launch."}
      proof={[
        { value: `${tier?.responseHours ?? 24}h`, label: "A tradie on site, or that month's membership is credited" },
        { value: String(data.menu.length || 25), label: "Common jobs at a fixed price, shown before you book" },
        { value: `${market.offerMinutes}min`, label: "For a tradie to accept, before the job moves to the next one" },
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
        { value: `${Math.max(48, market.payoutHoldHours)}h`, label: "From your photo to the money in your bank account" },
        { value: `${market.offerMinutes}min`, label: "To take a job. One tap from the text, no login" },
        { value: formatMoney(0, market.currency), label: "To join. No lead fees, no bidding, no subscription" },
      ]}
      phone={<TradiePhone example={example(data)} />}
      menu={
        items.length > 0
          ? {
              title: live ? "What the jobs pay" : "The kind of jobs we send",
              note: live
                ? "This is what lands in your bank account for each job. Urgent and after-hours surcharges are added on top and go to you in full."
                : "Every job has a fixed payout, shown in the text before you accept. Payouts are published when we open.",
              currency: market.currency,
              showPrices: live,
              priceLabel: "What you are paid",
              items: items.map((item) => ({ name: item.name, cents: item.tradiePayoutCents })),
            }
          : null
      }
    />
  );
}
