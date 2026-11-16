import { audit } from "@/lib/audit";
import { DAY, now } from "@/lib/clock";
import type { Db } from "@/lib/db/types";

/**
 * THE DEMAND TEST SCORECARD. Fourteen days of ads to one owner page, then a
 * yes or no on whether owners will pay. The pass mark was agreed before the
 * test (DECISIONS.md): three owners put a card down for a founding spot.
 *
 * Everything here is counted from the leads themselves, so nobody has to keep
 * a spreadsheet. Ad spend is not here: read it in the ad accounts.
 */

export const TEST_DAYS = 14;

/** What passing looks like. Deposits are the pass mark. The rest are signs to read alongside it. */
export const TARGETS = {
  deposits: 3,
  ownerLeads: 10,
  tradies: { handyman: 2, plumber: 1, electrician: 1 } as Record<string, number>,
};

const KEY = "demand_test";

export type DemandTest = { market: string; startedAt: Date; endsAt: Date; startedBy: string };

export async function getDemandTest(db: Db): Promise<DemandTest | null> {
  const rows = await db.query<{ value: { market: string; startedAt: string; startedBy: string } }>("select value from public.app_state where key = $1", [KEY]);
  const value = rows[0]?.value;
  if (!value?.startedAt) return null;
  const startedAt = new Date(value.startedAt);
  return { market: value.market, startedAt, endsAt: new Date(startedAt.getTime() + TEST_DAYS * DAY), startedBy: value.startedBy };
}

/** Starts the fourteen days from now. Starting again moves the start, and the audit log keeps every start. */
export async function startDemandTest(db: Db, market: string, actor: string): Promise<DemandTest> {
  const at = now();
  await db.query(
    `insert into public.app_state (key, value, updated_at) values ($1, $2::jsonb, $3::timestamptz)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [KEY, JSON.stringify({ market, startedAt: at.toISOString(), startedBy: actor }), at.toISOString()],
  );
  await audit(db, { actor, action: "demand_test.started", entity: "market", entityId: market, detail: { started_at: at.toISOString(), days: TEST_DAYS } });
  return { market, startedAt: at, endsAt: new Date(at.getTime() + TEST_DAYS * DAY), startedBy: actor };
}

export type AdLine = { ad: string; leads: number; spotsWanted: number; paid: number };

export type DemandNumbers = {
  ownerLeads: number;
  /** Pressed "send me the price list". */
  priceList: number;
  /** Pressed "take a founding spot". */
  wantedSpot: number;
  /** Got as far as the card page. */
  reachedCardPage: number;
  /** Put a card down. Refunded deposits are counted separately and not here. */
  paid: number;
  refunded: number;
  tradieLeads: Record<string, number>;
  byAd: AdLine[];
};

/** The leads that came in during the test, and what each did. A deposit paid after day 14 still counts for a lead from inside it. */
export async function demandNumbers(db: Db, test: Pick<DemandTest, "market" | "startedAt" | "endsAt">): Promise<DemandNumbers> {
  const window = [test.market, test.startedAt.toISOString(), test.endsAt.toISOString()];
  const owners = await db.query<{ leads: number; price_list: number; wanted: number; card_page: number; paid: number; refunded: number }>(
    `select count(*) as leads,
            count(*) filter (where intent = 'pricelist') as price_list,
            count(*) filter (where intent = 'deposit') as wanted,
            count(*) filter (where deposit_status <> 'none') as card_page,
            count(*) filter (where deposit_status in ('paid', 'credited')) as paid,
            count(*) filter (where deposit_status = 'refunded') as refunded
       from public.leads
      where lead_type = 'owner' and market = $1 and created_at >= $2::timestamptz and created_at < $3::timestamptz`,
    window,
  );
  const tradies = await db.query<{ trade: string; count: number }>(
    `select trade, count(*) as count from public.leads
      where lead_type = 'tradie' and market = $1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
      group by trade order by trade`,
    window,
  );
  // Which ad each owner came from: the ad name in the link (utm_content), else the campaign, else where they came from.
  const ads = await db.query<{ ad: string; leads: number; wanted: number; paid: number }>(
    `select coalesce(nullif(utm_content, ''), nullif(utm_campaign, ''), source) as ad,
            count(*) as leads,
            count(*) filter (where intent = 'deposit') as wanted,
            count(*) filter (where deposit_status in ('paid', 'credited')) as paid
       from public.leads
      where lead_type = 'owner' and market = $1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
      group by 1 order by count(*) desc, 1 limit 12`,
    window,
  );
  const row = owners[0];
  return {
    ownerLeads: Number(row?.leads ?? 0),
    priceList: Number(row?.price_list ?? 0),
    wantedSpot: Number(row?.wanted ?? 0),
    reachedCardPage: Number(row?.card_page ?? 0),
    paid: Number(row?.paid ?? 0),
    refunded: Number(row?.refunded ?? 0),
    tradieLeads: Object.fromEntries(tradies.map((entry) => [entry.trade, Number(entry.count)])),
    byAd: ads.map((entry) => ({ ad: entry.ad, leads: Number(entry.leads), spotsWanted: Number(entry.wanted), paid: Number(entry.paid) })),
  };
}

export type Verdict = {
  /** 1 to 14 while it runs. */
  day: number;
  finished: boolean;
  passed: boolean;
  /** One plain sentence on where it stands. */
  headline: string;
};

export function verdict(numbers: Pick<DemandNumbers, "paid" | "ownerLeads" | "priceList">, test: Pick<DemandTest, "startedAt" | "endsAt">, at: Date = now()): Verdict {
  const elapsed = at.getTime() - test.startedAt.getTime();
  const finished = at.getTime() >= test.endsAt.getTime();
  const day = Math.min(TEST_DAYS, Math.max(1, Math.floor(elapsed / DAY) + 1));
  const passed = numbers.paid >= TARGETS.deposits;
  const need = TARGETS.deposits - numbers.paid;
  const daysLeft = Math.max(0, Math.ceil((test.endsAt.getTime() - at.getTime()) / DAY));
  let headline: string;
  if (passed) headline = `Passed: ${numbers.paid} owners have put a card down for a founding spot.`;
  else if (finished && numbers.priceList >= 20 && numbers.paid === 0) {
    headline = `Not passed. ${numbers.priceList} owners took the price list and nobody took a founding spot: the price list interests them, the membership does not yet.`;
  } else if (finished) headline = `Not passed: ${numbers.paid} of the ${TARGETS.deposits} deposits needed in ${TEST_DAYS} days.`;
  else headline = `${need} more ${need === 1 ? "deposit" : "deposits"} needed in the ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left.`;
  return { day, finished, passed, headline };
}
