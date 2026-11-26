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

/**
 * How a membership is charged (DECISIONS.md, 2026-11-17):
 *   per_property  one monthly price for each property (Essential, for owners)
 *   per_account   one monthly retainer for the whole account, set by how many
 *                 properties are on it (Portfolio, for managers with 10+)
 */
export type BillingBasis = "per_property" | "per_account";

/**
 * One band of a retainer: from this many properties up to that many, this much
 * a month. `to: null` means "and up". `cents: null` means "by arrangement":
 * the app never sets that price itself, a person agrees it with the manager.
 */
export type RetainerBand = { from: number; to: number | null; cents: number | null };

export type MembershipTier = {
  /** Set once the tier is in the database. */
  id?: string;
  key: string;
  name: string;
  /**
   * per_property: the price per property, per month, in cents, including tax.
   * Zero means free to join: the property is covered once a card is on file,
   * with no subscription and no monthly payment.
   * per_account: the lowest band, the retainer a Portfolio starts from. The
   * bands below decide what each account actually pays.
   */
  monthlyPriceCents: number;
  billingBasis: BillingBasis;
  /** per_account only: the retainer bands, lowest first, with no gaps. Empty for per_property. */
  bands: RetainerBand[];
  /** The promise for a normal job: a tradie on site within this many hours. */
  responseHours: number;
  /** The promise for an urgent job. */
  urgentResponseHours: number;
  /** True when urgent jobs cost the owner no surcharge. The tradie still gets their share of it. */
  urgentIncluded: boolean;
  /** How many urgent jobs a month are included. null means no limit. */
  urgentIncludedPerMonth: number | null;
  quarterlyCheck: boolean;
  /** One short line shown under the tier name. */
  blurb: string;
};

/**
 * A service area (DECISIONS.md, 2026-11-26): a part of the market a tradie can
 * choose to cover. A job is only offered to tradies who cover its property's
 * area. There is no travel charge anywhere. `suburbs` are the names an owner may
 * type for a property there; matching ignores case and macrons.
 */
export type ServiceArea = { key: string; name: string; suburbs: string[] };

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
  /** A new platform fee waiting out its 30 days' notice to tradies (DECISIONS.md, 2026-11-20). Only read from the database. */
  platformFeeNext?: { bps: number; from: Date } | null;
  /** Both carry the platform fee: the tradie gets the surcharge less the fee (DECISIONS.md, 2026-11-18). */
  urgentSurchargeCents: number;
  afterHoursSurchargeCents: number;
  /**
   * Emergency (DECISIONS.md, 2026-11-26, third entry): a tradie on site within emergencyResponseMinutes (60) for
   * this much more (NZ$150). Like urgent it carries the platform fee, and it is charged to the owner and paid to the
   * tradie only if they tap Arrived in time. It stacks with the after-hours call-out. Never included in a membership.
   */
  emergencySurchargeCents: number;
  emergencyResponseMinutes: number;
  /** An emergency nobody has accepted after this many minutes: the owner is offered "within 4 hours instead", for less. */
  emergencyStepDownMinutes: number;
  /** Off-menu work: the fee to come and look, and what the tradie gets of it. */
  diagnosisFeeCents: number;
  diagnosisPayoutCents: number;
  /** A quote above this needs the owner's approval before work starts. */
  approvalThresholdCents: number;
  /** Small consumables up to this are part of the menu price. */
  partsIncludedCents: number;
  /** Parts above this need the owner's approval. */
  partsApprovalCents: number;
  /**
   * The payout guarantee (DECISIONS.md, 2026-11-23): up to this much of a job's price that the owner's card has not
   * paid yet, the tradie is paid at the usual time anyway. Above it, their share of what has not been collected
   * waits until it is. NZ$1,000.
   */
  payoutGuaranteeCents: number;
  /**
   * The tiered fee (DECISIONS.md, 2026-11-23, second entry): of a job's price, parts aside, the part up to
   * tierThresholdCents (NZ$1,000) pays the job's fee (platformFeeBps, or 5% for an own client); the part above it
   * pays aboveTierFeeBps (3%).
   */
  tierThresholdCents: number;
  aboveTierFeeBps: number;

  /** Minutes each tradie has to accept an offer before it moves on. */
  offerMinutes: number;
  /** Normal working hours in local time (24-hour clock). Outside them is after-hours. */
  hoursStart: number;
  hoursEnd: number;
  workDays: string[];
  /** Hours the tradie's money is held after a job, as the window to raise a problem. */
  payoutHoldHours: number;
  /**
   * A normal job nobody has accepted after this many hours: the owner is told we
   * are ringing round, and the team is asked to (DECISIONS.md, 2026-11-18).
   */
  unacceptedAlertHours: number;
  /**
   * Hours the owner has to answer when their chosen tradie (first choice or
   * backup) suggests a later time. No answer by then and the job goes on to the
   * other tradies, as if the owner had said "send it now".
   */
  counterOfferHours: number;
  /**
   * A job finished sooner than this many minutes after the tradie tapped
   * Arrived is flagged for the owner to check (DECISIONS.md, 2026-11-19).
   * Diagnosis and look-and-price jobs, and "could not get in", are never flagged for this.
   * 0 switches the check off.
   */
  minMinutesOnSite: number;
  /**
   * Hours the owner has to answer "is it fixed?" on a flagged job before the
   * app decides: paid if the tradie is trusted, otherwise to the dispatcher.
   */
  ownerConfirmHours: number;
  /** Hours an owner has to say "This was the job I described" before the call-out is paid (DECISIONS.md, 2026-11-20, third entry). */
  notDescribedHours: number;
  /** Minutes after an offer's app notification before its text goes too, unless the offer has been opened. */
  offerPushSmsMinutes: number;
  /** Where the map opens for a property that has no pin yet. Null: the whole country. */
  mapCentre: { lat: number; lng: number } | null;
  /** The areas tradies choose to cover. Empty: the market is one area and every tradie covers it. */
  areas: ServiceArea[];

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
    urgentSurchargeCents: 5000,
    afterHoursSurchargeCents: 14000,
    emergencySurchargeCents: 15000,
    emergencyResponseMinutes: 60,
    emergencyStepDownMinutes: 10,
    diagnosisFeeCents: 22500,
    diagnosisPayoutCents: 19000,
    approvalThresholdCents: 60000,
    // NZ$20 from 23 Nov 2026 (was NZ$30): DECISIONS.md, 2026-11-23.
    partsIncludedCents: 2000,
    partsApprovalCents: 15000,
    payoutGuaranteeCents: 100000,
    tierThresholdCents: 100000,
    aboveTierFeeBps: 300,
    offerMinutes: 15,
    // The after-hours rate applies after 4:30pm and on Saturdays (DECISIONS.md). 16.5 is 4:30pm.
    hoursStart: 7,
    hoursEnd: 16.5,
    workDays: ["mon", "tue", "wed", "thu", "fri"],
    payoutHoldHours: 24,
    unacceptedAlertHours: 3,
    counterOfferHours: 2,
    minMinutesOnSite: 10,
    ownerConfirmHours: 48,
    notDescribedHours: 24,
    offerPushSmsMinutes: 3,
    mapCentre: null,
    areas: [],
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
      billingBasis: "per_property" as const,
      bands: [],
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
    // The middle of town, where the map opens for a property with no pin yet.
    mapCentre: { lat: -45.0312, lng: 168.6626 },
    // Service areas (DECISIONS.md, 2026-11-26). The same list is in migration 20261207000000_service_areas.sql
    // for a database that already has the market; tests/unit/areas.test.ts checks the two agree.
    areas: [
      { key: "queenstown-central", name: "Queenstown central", suburbs: ["Queenstown", "Queenstown Central", "Fernhill", "Sunshine Bay", "Queenstown Hill"] },
      { key: "frankton", name: "Frankton", suburbs: ["Frankton", "Quail Rise", "Remarkables Park"] },
      { key: "kelvin-heights", name: "Kelvin Heights", suburbs: ["Kelvin Heights", "Kelvin Peninsula"] },
      { key: "jacks-point", name: "Jack's Point & Hanley's Farm", suburbs: ["Jack's Point", "Jacks Point", "Hanley's Farm", "Hanleys Farm"] },
      { key: "lake-hayes", name: "Lake Hayes & Shotover Country", suburbs: ["Lake Hayes", "Lake Hayes Estate", "Shotover Country", "Lower Shotover"] },
      { key: "arthurs-point", name: "Arthurs Point", suburbs: ["Arthurs Point", "Arthur's Point"] },
      { key: "arrowtown", name: "Arrowtown", suburbs: ["Arrowtown"] },
      { key: "gibbston", name: "Gibbston", suburbs: ["Gibbston", "Gibbston Valley"] },
      { key: "glenorchy", name: "Glenorchy & Kinloch", suburbs: ["Glenorchy", "Kinloch"] },
    ],
    tiers: [
      // Essential, for owners. Free to join (DECISIONS.md, 2026-11-17, "Free
      // to join"): a property is covered as soon as a card is on file, and the
      // money is the 15% inside every fixed job price. Urgent response is an
      // add-on the owner pays for on the day, never an inclusion.
      {
        key: "essential",
        name: "Essential",
        monthlyPriceCents: 0,
        blurb: "Free to join. Fixed prices, charged only when something is fixed. A tradie on site within 24 hours, or 4 when it's urgent.",
      },
      // For property managers with 10 or more properties (DECISIONS.md,
      // 2026-11-17): one monthly retainer for the whole account, banded by how
      // many properties are on it. The same 15% fee and the same job prices.
      // No discount: the intro offer is a 60-day pilot on 10 properties at the
      // 10-24 band, kept by hand. 100+ is priced by a person, never by the app.
      {
        key: "portfolio",
        name: "Portfolio",
        monthlyPriceCents: 60000,
        billingBasis: "per_account",
        bands: [
          { from: 10, to: 24, cents: 60000 },
          { from: 25, to: 49, cents: 90000 },
          { from: 50, to: 99, cents: 120000 },
          { from: 100, to: null, cents: null },
        ],
        blurb: "For managers with 10 or more properties. One monthly retainer for the whole portfolio, plus the same fixed job prices.",
      },
    ],
    // The founding deposit from the first demand test. Switched off since
    // HostFix became free to join (DECISIONS.md, 2026-11-17): no new deposit
    // is taken, and the ones paid are refunded by hand. The words stay so the
    // checklist can show what those owners were promised.
    foundingDeposit: {
      enabled: false,
      amountCents: 9900,
      spots: 25,
      terms: [
        "Half price for your first three months: $49.50 a month, then $99",
        "Your $99 deposit comes off your first bills",
        "Refundable any time before your first job. One email and it is back on your card",
      ],
    },
  }),
  // Wānaka (DECISIONS.md, 2026-11-24, third entry): the follow-up straight after Queenstown. The same prices,
  // fees and settings as Queenstown, its menu and parts list loaded from Queenstown's files (SHARED_SEED in
  // src/lib/db/seed-core.ts), and its own tradies. Starts on the waitlist; switch it to live on Admin > Markets.
  defineMarket({
    slug: "wanaka",
    name: "Wānaka",
    country: "NZ",
    timezone: "Pacific/Auckland",
    mapCentre: { lat: -44.6998, lng: 169.1324 },
    areas: [
      { key: "wanaka-town", name: "Wānaka town", suburbs: ["Wānaka", "Wānaka town"] },
      { key: "albert-town", name: "Albert Town", suburbs: ["Albert Town"] },
      { key: "hawea", name: "Lake Hāwea & Hāwea Flat", suburbs: ["Lake Hāwea", "Hāwea", "Hāwea Flat"] },
      { key: "luggate", name: "Luggate", suburbs: ["Luggate"] },
      { key: "cardrona", name: "Cardrona", suburbs: ["Cardrona", "Cardrona Valley"] },
    ],
    tiers: [
      {
        key: "essential",
        name: "Essential",
        monthlyPriceCents: 0,
        blurb: "Free to join. Fixed prices, charged only when something is fixed. A tradie on site within 24 hours, or 4 when it's urgent.",
      },
      {
        key: "portfolio",
        name: "Portfolio",
        monthlyPriceCents: 60000,
        billingBasis: "per_account",
        bands: [
          { from: 10, to: 24, cents: 60000 },
          { from: 25, to: 49, cents: 90000 },
          { from: 50, to: 99, cents: 120000 },
          { from: 100, to: null, cents: null },
        ],
        blurb: "For managers with 10 or more properties. One monthly retainer for the whole portfolio, plus the same fixed job prices.",
      },
    ],
  }),
];

/** The market the public landing pages sell when no town is named in the link. */
export const launchMarket: Market = markets[0]!;

export function findMarket(slug: string): Market | undefined {
  return markets.find((m) => m.slug === slug);
}
