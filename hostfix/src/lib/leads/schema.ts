import { z } from "zod";
import { trades } from "@config/trades";
import { DAY_OPTIONS, MANAGED_BY_OPTIONS } from "./options";

/**
 * The rules each form must pass before a lead is saved. Messages are written
 * for the person filling in the form, in plain words.
 */

const name = z
  .string("Please enter your name.")
  .trim()
  .min(2, "Please enter your name.")
  .max(80, "That name is too long. Please shorten it.")
  .refine((value) => !/(https?:|www\.)/i.test(value), "Please enter just your name.");

const phone = z
  .string("Please enter your mobile number.")
  .trim()
  .min(6, "Please enter your mobile number.")
  .max(30, "That phone number is too long. Please check it.");

const email = z
  .string("Please enter your email address.")
  .trim()
  .toLowerCase()
  .min(1, "Please enter your email address.")
  .max(254, "That email address is too long. Please check it.")
  .pipe(z.email("That email address doesn't look right. Please check it."));

const managedByKeys = MANAGED_BY_OPTIONS.map((o) => o.key) as [string, ...string[]];
const dayKeys = DAY_OPTIONS.map((o) => o.key) as [string, ...string[]];
const tradeKeys = trades.map((t) => t.key) as [string, ...string[]];

export const ownerLeadSchema = z.object({
  name,
  phone,
  email,
  propertyCount: z.coerce
    .number("Please enter how many properties you have.")
    .int("Please enter a whole number of properties.")
    .min(1, "Please enter how many properties you have (at least 1).")
    .max(200, "That's a lot of properties. Please email us instead."),
  managedBy: z.enum(managedByKeys, "Please choose who looks after it now."),
  ownerLocation: z
    .string("Please tell us where you live.")
    .trim()
    .min(2, "Please tell us where you live.")
    .max(80, "Please shorten that a little."),
});

export const tradieLeadSchema = z.object({
  name,
  phone,
  trade: z.enum(tradeKeys, "Please choose your trade."),
  licenceNumber: z
    .string()
    .trim()
    .max(60, "That licence number is too long. Please check it.")
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
  daysAvailable: z
    .array(z.enum(dayKeys, "Please tick the days you're available."), "Please tick the days you're available.")
    .min(1, "Please tick at least one day.")
    .transform((days) => dayKeys.filter((d) => days.includes(d))),
});

export type OwnerLeadInput = z.infer<typeof ownerLeadSchema>;
export type TradieLeadInput = z.infer<typeof tradieLeadSchema>;

/** The first problem for each field, ready to show next to that field. */
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in result)) result[field] = issue.message;
  }
  return result;
}
