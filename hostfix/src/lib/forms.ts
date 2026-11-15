/**
 * What a form shows after it is sent. Every form in the app uses the same
 * shape, so a problem is always reported the same way: one plain message at
 * the top, and a note under each field that needs fixing.
 */
export type FormState = {
  /** A message for the top of the form when something needs fixing. */
  message?: string;
  /** A message for the top of the form when it worked and the person stays on the page. */
  done?: string;
  /** One message per field that needs fixing, keyed by field name. */
  fieldErrors?: Record<string, string>;
  /** What the person typed, so they do not have to type it again. */
  values?: Record<string, string | string[]>;
};

/** Everything typed into the form, so it can be put back after a problem. Files are left out. */
export function typed(formData: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue;
    const all = formData.getAll(key).filter((value): value is string => typeof value === "string");
    if (all.length === 1) values[key] = all[0]!;
    else if (all.length > 1) values[key] = all;
  }
  return values;
}

/** The answer a form action gives when something needs fixing. */
export function problem(formData: FormData, message: string, fieldErrors: Record<string, string> = {}): FormState {
  return { message, fieldErrors, values: typed(formData) };
}

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function ticked(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function list(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string" && value !== "");
}

/**
 * Reads an amount typed in dollars ("180", "180.50", "$1,200") as whole cents.
 * Returns null if it is not a sensible amount.
 */
export function dollarsToCents(input: string): number | null {
  const clean = input.replace(/[\s,$]/g, "").replace(/^(NZ|A|AU)\$?/i, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** "180" or "180.50": an amount in cents written for a form field. */
export function centsToDollars(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}
