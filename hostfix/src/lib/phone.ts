import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Countries whose local-format numbers we understand without a +country code. */
const LOCAL_COUNTRIES: CountryCode[] = ["NZ", "AU"];

export type NormalisedPhone = {
  /** International format with no spaces, for example +64211234567. */
  e164: string;
  /** How a local would write it, for example 021 123 4567. */
  national: string;
  country: string | null;
};

/**
 * Turns whatever someone typed into one standard phone number, or null if it
 * is not a real number. Local numbers are read as the market's country first,
 * then the other supported country (an Auckland owner and a Sydney owner can
 * both type their number the way they always do). Numbers from anywhere else
 * work when typed with their +country code.
 */
export function normalisePhone(input: string, preferredCountry: "NZ" | "AU"): NormalisedPhone | null {
  const raw = input.trim();
  if (raw === "" || raw.length > 40) return null;

  const order: CountryCode[] = [preferredCountry, ...LOCAL_COUNTRIES.filter((c) => c !== preferredCountry)];
  for (const country of order) {
    const parsed = parsePhoneNumberFromString(raw, country);
    if (parsed && parsed.isValid()) {
      return {
        e164: parsed.number,
        national: parsed.formatNational(),
        country: parsed.country ?? null,
      };
    }
  }
  return null;
}

/** For screens and alert texts: local format for NZ and AU numbers, international otherwise. */
export function displayPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  if (parsed.country === "NZ" || parsed.country === "AU") return parsed.formatNational();
  return parsed.formatInternational();
}
