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
    urgentSurchargeCents: 8000,
    afterHoursSurchargeCents: 12000,
    diagnosisFeeCents: 12000,
    diagnosisPayoutCents: 10200,
    approvalThresholdCents: 40000,
    partsIncludedCents: 3000,
    partsApprovalCents: 15000,
    offerMinutes: 15,
    hoursStart: 7,
    hoursEnd: 18,
    workDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    payoutHoldHours: 24,
    referralRewardCents: 10000,
    referralPaidMonths: 3,
    replyByText: false,
    foundingDeposit: { enabled: false, amountCents: 0, terms: [] },
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
      {
        key: "essential",
        name: "Essential",
        monthlyPriceCents: 9900,
        blurb: "A tradie on site within 24 hours.",
      },
      {
        key: "priority",
        name: "Priority",
        monthlyPriceCents: 14900,
        urgentIncluded: true,
        quarterlyCheck: true,
        blurb: "Urgent 4-hour response included, plus a quarterly property check.",
      },
    ],
    foundingDeposit: {
      enabled: true,
      amountCents: 4900,
      terms: ["Comes off your first month", "Fully refundable any time before we launch"],
    },
  }),
];

/** The market the public landing pages sell when no town is named in the link. */
export const launchMarket: Market = markets[0]!;

export function findMarket(slug: string): Market | undefined {
  return markets.find((m) => m.slug === slug);
}
