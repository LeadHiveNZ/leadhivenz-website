/**
 * MARKETS
 * ---------------------------------------------------------------------------
 * A market is one town or region you operate in. Everything that differs by
 * place lives here: currency, tax rate, timezone, prices and the founding
 * member deposit. Nothing in the app is tied to one town.
 *
 * All money is in CENTS as whole numbers. NZ$99.00 is written 9900.
 *
 * From Phase 1 these prices move into the database so you can edit them on a
 * screen. Until then, this file is the source.
 */

export type CountryCode = "NZ" | "AU";
export type CurrencyCode = "NZD" | "AUD";

export type MembershipTier = {
  key: "essential" | "priority";
  name: string;
  /** Price per property, per month, in cents, including tax. */
  monthlyPriceCents: number;
};

export type Market = {
  /** Short code used in the database and in links. Lowercase, no spaces. */
  slug: string;
  /** The name people see. */
  name: string;
  country: CountryCode;
  countryName: string;
  currency: CurrencyCode;
  /** Used to show dates and times in local time. */
  timezone: string;
  /** Tax rate as a fraction. 0.15 means 15%. Used from Phase 3. */
  taxRate: number;
  taxName: string;
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

export const markets: Market[] = [
  {
    slug: "queenstown",
    name: "Queenstown",
    country: "NZ",
    countryName: "New Zealand",
    currency: "NZD",
    timezone: "Pacific/Auckland",
    taxRate: 0.15,
    taxName: "GST",
    tiers: [
      { key: "essential", name: "Essential", monthlyPriceCents: 9900 },
      { key: "priority", name: "Priority", monthlyPriceCents: 14900 },
    ],
    foundingDeposit: {
      enabled: true,
      amountCents: 4900,
      terms: ["Comes off your first month", "Fully refundable any time before we launch"],
    },
  },
];

/** The market the public landing pages are selling right now. */
export const launchMarket: Market = markets[0]!;

export function findMarket(slug: string): Market | undefined {
  return markets.find((m) => m.slug === slug);
}
