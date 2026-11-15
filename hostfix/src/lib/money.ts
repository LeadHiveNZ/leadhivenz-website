/**
 * Money helpers. All amounts are whole numbers of CENTS. Never use decimals
 * for money: 0.1 + 0.2 is not 0.3 on a computer.
 */

const SYMBOLS: Record<string, string> = {
  NZD: "NZ$",
  AUD: "A$",
};

/** 4900 + "NZD" becomes "NZ$49". 4950 becomes "NZ$49.50". */
export function formatMoney(cents: number, currency: string): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`Money must be a whole number of cents, got ${cents}`);
  }
  const code = currency.toUpperCase();
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const dollars = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  const whole = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const amount = remainder === 0 ? whole : `${whole}.${remainder.toString().padStart(2, "0")}`;
  const symbol = SYMBOLS[code];
  const text = symbol ? `${symbol}${amount}` : `${code} ${amount}`;
  return negative ? `-${text}` : text;
}
