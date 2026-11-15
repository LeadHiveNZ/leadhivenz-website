/**
 * The fixed choices offered on the two lead forms. Kept apart from the
 * validation code so the browser can use them without loading anything else.
 */

export const MANAGED_BY_OPTIONS = [
  { key: "self", label: "I look after it myself" },
  { key: "property_manager", label: "A property manager" },
  { key: "cleaner_cohost", label: "My cleaner or a co-host" },
  { key: "family_friends", label: "Family or friends" },
  { key: "other", label: "Someone else" },
] as const;

export const DAY_OPTIONS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export type ManagedByKey = (typeof MANAGED_BY_OPTIONS)[number]["key"];
export type DayKey = (typeof DAY_OPTIONS)[number]["key"];

export function managedByLabel(key: string | null): string {
  return MANAGED_BY_OPTIONS.find((o) => o.key === key)?.label ?? (key ?? "");
}

export function daysLabel(days: string[] | null): string {
  if (!days || days.length === 0) return "";
  if (days.length === 7) return "Every day";
  return DAY_OPTIONS.filter((d) => days.includes(d.key))
    .map((d) => d.label)
    .join(", ");
}
