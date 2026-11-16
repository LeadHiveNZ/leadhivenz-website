import type { MembershipTier, RetainerBand } from "@config/markets";

/**
 * PORTFOLIO RETAINER BANDS (DECISIONS.md, 2026-11-17).
 *
 * A Portfolio account pays one monthly retainer, set by how many properties
 * are on it. These are the plain rules for that, with no database and no
 * clock, so they can be tested on every boundary:
 *
 *   10-24 properties  NZ$600      25-49  NZ$900      50-99  NZ$1,200
 *   100 and more      by arrangement: a person sets the price, never the app
 */

type Banded = Pick<MembershipTier, "billingBasis" | "bands" | "monthlyPriceCents">;

/** "10 to 24 properties", "100 or more properties". */
export function bandLabel(band: RetainerBand): string {
  if (band.to === null) return `${band.from} or more properties`;
  if (band.to === band.from) return `${band.from} ${band.from === 1 ? "property" : "properties"}`;
  return `${band.from} to ${band.to} properties`;
}

/** The smallest number of properties the tier takes. 1 for a per-property tier. */
export function minimumProperties(tier: Banded): number {
  return tier.billingBasis === "per_account" ? (tier.bands[0]?.from ?? 1) : 1;
}

/**
 * What an account with this many properties pays each month.
 *
 * Returns null when there is no price the app may charge by itself: either
 * the count is in a "by arrangement" band (100 and more), or it is below the
 * smallest band (fewer than 10). Callers tell the two apart with
 * minimumProperties(). For a per-property tier it is the price times the count.
 */
export function bandFor(tier: Banded, propertyCount: number): { cents: number; label: string } | null {
  if (tier.billingBasis === "per_property") {
    return { cents: tier.monthlyPriceCents * propertyCount, label: `${propertyCount} ${propertyCount === 1 ? "property" : "properties"}` };
  }
  const band = tier.bands.find((candidate) => propertyCount >= candidate.from && (candidate.to === null || propertyCount <= candidate.to));
  if (!band || band.cents === null) return null;
  return { cents: band.cents, label: bandLabel(band) };
}

/** The lowest band with a price: where an account below the minimum is kept until a person decides. */
export function lowestBand(tier: Banded): { cents: number; label: string } | null {
  const band = tier.bands.find((candidate) => candidate.cents !== null);
  return band ? { cents: band.cents!, label: bandLabel(band) } : null;
}

/** The highest band with a price: what an account of 100+ keeps paying until a person sets theirs. */
export function highestPricedBand(tier: Banded): { cents: number; label: string } | null {
  const band = [...tier.bands].reverse().find((candidate) => candidate.cents !== null);
  return band ? { cents: band.cents!, label: bandLabel(band) } : null;
}

/**
 * Checks a set of bands the admin typed in. Returns what is wrong in plain
 * words, or null when they are fine. The rules: at least one band; each
 * starts where the one before ended plus one (no gaps, no overlaps, lowest
 * first); only the top band may be open-ended; only the top band may be "by
 * arrangement"; the lowest band has a price.
 */
export function bandProblem(bands: RetainerBand[]): string | null {
  if (bands.length === 0) return "Add at least one band.";
  for (const [index, band] of bands.entries()) {
    const name = `Band ${index + 1}`;
    const last = index === bands.length - 1;
    if (!Number.isInteger(band.from) || band.from < 1 || band.from > 10_000) return `${name}: "from" must be a whole number of properties, 1 or more.`;
    if (band.to !== null && (!Number.isInteger(band.to) || band.to < band.from)) return `${name}: "to" must be a whole number, no smaller than "from".`;
    if (band.to === null && !last) return `${name}: only the top band can be left open ("and up").`;
    if (band.cents !== null && (!Number.isInteger(band.cents) || band.cents <= 0 || band.cents > 5_000_000)) return `${name}: the retainer must be more than zero.`;
    if (band.cents === null && !last) return `${name}: only the top band can be "by arrangement". Give this one a price.`;
    if (index > 0) {
      const before = bands[index - 1]!;
      if (before.to !== null && band.from !== before.to + 1) {
        return band.from <= before.to
          ? `${name} overlaps the band before it. It should start at ${before.to + 1}.`
          : `There is a gap between band ${index} and band ${index + 1}. Band ${index + 1} should start at ${before.to + 1}.`;
      }
    }
  }
  if (bands[0]!.cents === null) return "The lowest band needs a price.";
  return null;
}
