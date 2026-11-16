/**
 * MARKETS: STARTING VALUES
 * ---------------------------------------------------------------------------
 * A market is one town or region you operate in. Everything that differs by
 * place lives on the market: currency, tax, timezone, prices, fees and hours.
 * Nothing in the app is tied to one town.
 *
 * HOW THIS FILE IS USED: the first time the site is built against an empty
 * database, each market below is copied into the database, together with its
 * menu from the /seed folder. After that the DATABASE is the source of truth:
 * change prices and settings on the Admin > Markets screen, not here. Editing
 * this file later only affects markets that do not exist in the database yet.
 *
 * All money is in CENTS as whole numbers. NZ$99.00 is written 9900.
 */

export type CountryCode = "NZ" | "AU";
export type CurrencyCode = "NZD" | "AUD";

/**
 * draft: being set up, not visible. waitlist: landing pages collect interest.
 * live: owners can join and log jobs. paused: no new members or jobs.
 */
export type MarketStage = "draft" | "waitlist" | "live" | "paused";

export type MembershipTier = {
  /** Set once the tier is in the database. */
  id?: string;
  key: string;
  name: string;
  /** Price per property, per month, in cents, including tax. */
  monthlyPriceCents: number;
  /** The promise for a normal job: a tradie on site within this many hours. */
  responseHours: number;
  /** The promise for an urgent job. */
  urgentResponseHours: number;
  /** True when urgent jobs cost the owner no surcharge. The tradie still gets it. */
  urgentIncluded: boolean;
  /** How many urgent jobs a month are included. null means no limit. */
  urgentIncludedPerMonth: number | null;
  quarterlyCheck: boolean;
  /** One short line shown under the tier name. */
  blurb: string;
};

export type Market = {
  /** Short code used in the database and in links. Lowercase, no spaces. */
  slug: string;
  /** The name people see. */
  name: string;
  country: CountryCode;
  countryName: string;
  currency: CurrencyCode;
  /** Used to show dates and times in local time and to work out after-hours. */
  timezone: string;
  stage: MarketStage;

  /** Tax rate as a fraction. 0.15 means 15%. All prices include it. */
  taxRate: number;
  taxName: string;
  /** Whether the business is registered for this tax yet. */
  taxRegistered: boolean;
  taxNumber: string | null;

  /** The platform's share of a job, in hundredths of a percent. 1500 means 15%. */
  platformFeeBps: number;
  /** Paid to the tradie in full. */
  urgentSurchargeCents: number;
  afterHoursSurchargeCents: number;
  /** Off-menu work: the fee to come and look, and what the tradie gets of it. */
  diagnosisFeeCents: number;
  diagnosisPayoutCents: number;
  /** A quote above this needs the owner's approval before work starts. */
  approvalThresholdCents: number;
  /** Small consumables up to this are part of the menu price. */
  partsIncludedCents: number;
  /** Parts above this need the owner's approval. */
  partsApprovalCents: number;

  /** Minutes each tradie has to accept an offer before it moves on. */
  offerMinutes: number;
  /** Normal working hours in local time (24-hour clock). Outside them is after-hours. */
  hoursStart: number;
  hoursEnd: number;
  workDays: string[];
  /** Hours the tradie's money is held after a job, as the window to raise a problem. */
  payoutHoldHours: number;

  referralRewardCents: number;
  referralPaidMonths: number;
  /** True once this market has a number tradies can reply YES to. */
  replyByText: boolean;

  tiers: MembershipTier[];
  foundingDeposit: {
    /** Set to false to hide the deposit offer in this market. */
    enabled: boolean;
    /** Deposit in cents. */
    amountCents: number;
    /** How many founding spots there are. The deposit is no longer offered once this many are paid. null: no limit. */
    spots: number | null;
    /**
     * The promises shown beside the pay button and on the card page. They are
     * commitments to your customers, so only list what you will honour.
     */
    terms: string[];
  };
};

const COUNTRY_DEFAULTS: Record<CountryCode, Pick<Market, "countryName" | "currency" | "taxRate" | "taxName">> = {
  NZ: { countryName: "New Zealand", currency: "NZD", taxRate: 0.15, taxName: "GST" },
  AU: { countryName: "Australia", currency: "AUD", taxRate: 0.1, taxName: "GST" },
};

export function countryDefaults(country: CountryCode) {
  return COUNTRY_DEFAULTS[country];
}

/**
 * HOW LONG A TRADIE'S MONEY TAKES TO REACH THEIR BANK, counted from the job
 * being finished. This is not ours to choose. The payment company (Stripe)
 * holds card money for a set number of working days before it can be paid out
 * (4 in New Zealand, 2 in Australia, from Stripe's documentation in November
 * 2026), and the bank transfer then takes a day or two. These words are shown
 * to tradies, so keep them honest: time a real payout and correct them here if
 * they are wrong. docs/PLAN.md explains how this could be made faster.
 */
const PAYOUT_ARRIVAL: Record<CountryCode, string> = {
  NZ: "5 to 6 working days",
  AU: "3 to 4 working days",
};

export function payoutArrival(country: CountryCode): string {
  return PAYOUT_ARRIVAL[country];
}

type TierInput = Pick<MembershipTier, "key" | "name" | "monthlyPriceCents"> & Partial<MembershipTier>;
type MarketInput = Pick<Market, "slug" | "name" | "country" | "timezone"> &
  Partial<Omit<Market, "tiers">> & { tiers: TierInput[] };

/** Fills in the standard settings so a market can be written in a few lines. */
export function defineMarket(input: MarketInput): Market {
  return {
    ...COUNTRY_DEFAULTS[input.country],
    stage: "waitlist",
    taxRegistered: false,
    taxNumber: null,
    platformFeeBps: 1500,
    // The same figures as seed/menu-queenstown.json, so a market added later
    // starts from them too. Why each one: DECISIONS.md.
    urgentSurchargeCents: 9000,
    afterHoursSurchargeCents: 14000,
    diagnosisFeeCents: 22500,
    diagnosisPayoutCents: 19000,
    approvalThresholdCents: 60000,
    partsIncludedCents: 3000,
    partsApprovalCents: 15000,
    offerMinutes: 15,
    // The after-hours rate applies after 4:30pm and on Saturdays (DECISIONS.md). 16.5 is 4:30pm.
    hoursStart: 7,
    hoursEnd: 16.5,
    workDays: ["mon", "tue", "wed", "thu", "fri"],
    payoutHoldHours: 24,
    referralRewardCents: 10000,
    referralPaidMonths: 3,
    replyByText: false,
    foundingDeposit: { enabled: false, amountCents: 0, spots: null, terms: [] },
    ...input,
    tiers: input.tiers.map((tier) => ({
      responseHours: 24,
      urgentResponseHours: 4,
      urgentIncluded: false,
      urgentIncludedPerMonth: null,
      quarterlyCheck: false,
      blurb: "",
      ...tier,
    })),
  };
}

export const markets: Market[] = [
  defineMarket({
    slug: "queenstown",
    name: "Queenstown",
    country: "NZ",
    timezone: "Pacific/Auckland",
    tiers: [
      // One membership. Urgent response is an add-on the owner pays for on the
      // day, never an inclusion. A second tier was dropped because delivering
      // it cost more than it charged (DECISIONS.md). The app still supports
      // more than one: add it on the admin screen if that ever changes.
      {
        key: "essential",
        name: "Essential",
        monthlyPriceCents: 9900,
        blurb: "A tradie on site within 24 hours. Urgent 4-hour response when you need it, for a surcharge.",
      },
    ],
    // The demand test (DECISIONS.md): 25 founding properties, a $99 deposit
    // that is refundable and comes off the first bills, and half price for
    // the first three months. The words are promises: change them on the
    // admin screen (More > Markets) if the offer changes.
    foundingDeposit: {
      enabled: true,
      amountCents: 9900,
      spots: 25,
      terms: [
        "Half price for your first three months: $49.50 a month, then $99",
        "Your $99 deposit comes off your first bills",
        "Refundable any time before your first job. One email and it is back on your card",
      ],
    },
  }),
];

/** The market the public landing pages sell when no town is named in the link. */
export const launchMarket: Market = markets[0]!;

export function findMarket(slug: string): Market | undefined {
  return markets.find((m) => m.slug === slug);
}
